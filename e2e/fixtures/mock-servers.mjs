// A scripted stand-in for a model and a tiny target API, so that the UI tests need neither a real
// LLM nor the internet.
//
//   node fixtures/mock-servers.mjs     # API on :8080, model on :11500, both on all interfaces
//
// The model speaks the OpenAI chat-completions protocol with streaming and tool calls. What it does
// depends on a marker word in the last user message:
//
//   (none)      write tests/users/users.hurl, run hurl on it, say it is done
//   SPECTEST    write specs/mock-users.yaml, say it is done
//   SECTEST     run a shell probe that prints what the agent can and cannot see
//   ERRORTEST   answer 401, like a wrong API key
//
// The target API is a bare in-memory users resource.
import http from "node:http";

const API_PORT = Number(process.env.MOCK_API_PORT ?? 8080);
const LLM_PORT = Number(process.env.MOCK_LLM_PORT ?? 11500);

// ---- target API ---------------------------------------------------------------------------------

const users = new Map();
let nextId = 1;

function json(res, code, body) {
	res.writeHead(code, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

export function startApi(port = API_PORT) {
	const server = http.createServer((req, res) => {
		let raw = "";
		req.on("data", (d) => (raw += d));
		req.on("end", () => {
			const m = req.url.match(/^\/users(?:\/([\w-]+))?$/);
			if (!m) return json(res, 404, { error: "not found" });
			if (req.method === "POST" && !m[1]) {
				let body = {};
				try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "bad json" }); }
				if (!body.name) return json(res, 422, { error: "name required" });
				const id = `u${nextId++}`;
				users.set(id, { id, name: body.name });
				return json(res, 201, users.get(id));
			}
			if (req.method === "GET" && m[1]) return users.has(m[1]) ? json(res, 200, users.get(m[1])) : json(res, 404, { error: "no such user" });
			if (req.method === "DELETE" && m[1]) { users.delete(m[1]); res.writeHead(204); return res.end(); }
			json(res, 405, {});
		});
	});
	return new Promise((resolve) => server.listen(port, "0.0.0.0", () => resolve(server)));
}

// ---- scripted model ------------------------------------------------------------------------------

const TEST = `# create, read and delete a user
POST {{host}}/users
Content-Type: application/json
{"name": "user-{{newUuid}}"}
HTTP 201
[Captures]
id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" startsWith "user-"

GET {{host}}/users/{{id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{id}}"

DELETE {{host}}/users/{{id}}
HTTP 204

GET {{host}}/users/{{id}}
HTTP 404
`;

const SPEC = `openapi: 3.0.3
info: { title: Mock Users, version: "1.0" }
servers:
  - url: http://host.docker.internal:${API_PORT}
tags: [{ name: users }]
paths:
  /users:
    post:
      tags: [users]
      summary: Create user
      responses: { "201": { description: Created }, "422": { description: Invalid } }
  /users/{id}:
    get:
      tags: [users]
      summary: Get user
      parameters: [ { name: id, in: path, required: true, schema: { type: string } } ]
      responses: { "200": { description: OK }, "404": { description: Missing } }
`;

// what an agent can and cannot reach: printed by the SECTEST scenario
const PROBE = [
	'echo "uid=$(id -u)"',
	'echo "--- state:"; cat /state/providers.json 2>&1 | head -c 80; ls /state 2>&1 | head -2',
	'echo "--- env:"; env | grep -i -E "token|secret|apikey|api_key" || echo no-secret-env',
	'echo "--- proc1:"; cat /proc/1/environ 2>&1 | head -c 60; echo',
	'echo "--- models.json:"; grep -o \'"apiKey": "[^"]*"\' /workspace/.pi/models.json',
	'echo "--- internal:"; curl -s -m 3 "$PIHURL_INTERNAL_URL/health"; echo',
	'echo "--- write workspace:"; touch /workspace/agent-was-here && echo ok',
].join("; ");

function sse(res, chunks) {
	res.writeHead(200, { "content-type": "text/event-stream" });
	for (const c of chunks) {
		res.write(`data: ${JSON.stringify({ id: "cmpl-1", object: "chat.completion.chunk", created: 1, model: "mock-1", choices: [c] })}\n\n`);
	}
	res.write("data: [DONE]\n\n");
	res.end();
}

const text = (t) => [
	{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null },
	...t.match(/.{1,12}/gs).map((p) => ({ index: 0, delta: { content: p }, finish_reason: null })),
	{ index: 0, delta: {}, finish_reason: "stop" },
];

const tool = (id, name, args) => [
	{ index: 0, delta: { role: "assistant", content: null, tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: "" } }] }, finish_reason: null },
	{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args) } }] }, finish_reason: null },
	{ index: 0, delta: {}, finish_reason: "tool_calls" },
];

export function startModel(port = LLM_PORT) {
	const server = http.createServer((req, res) => {
		let raw = "";
		req.on("data", (d) => (raw += d));
		req.on("end", () => {
			if (req.url.endsWith("/models")) return json(res, 200, { data: [{ id: "mock-1" }] });
			if (!req.url.endsWith("/chat/completions")) { res.writeHead(404); return res.end(); }

			const body = JSON.parse(raw);
			const toolResults = body.messages.filter((m) => m.role === "tool").length;
			const last = [...body.messages].reverse().find((m) => m.role === "user");
			const prompt = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);

			if (prompt.includes("ERRORTEST")) return json(res, 401, { error: { message: "Incorrect API key provided" } });
			if (prompt.includes("SECTEST")) {
				return sse(res, toolResults === 0 ? tool("call_sec", "bash", { command: PROBE }) : text("Checked."));
			}
			if (prompt.includes("SPECTEST")) {
				return sse(res, toolResults === 0
					? tool("call_spec", "write", { path: "specs/mock-users.yaml", content: SPEC })
					: text("Wrote specs/mock-users.yaml with 2 operations."));
			}
			if (toolResults === 0) return sse(res, text("I will write a CRUD test for users.\n").slice(0, -1).concat(tool("call_1", "write", { path: "tests/users/users.hurl", content: TEST })));
			if (toolResults === 1) return sse(res, tool("call_2", "bash", { command: "hurl --test --variables-file hurl.env tests/users/users.hurl" }));
			return sse(res, text("Done: **tests/users/users.hurl** covers create, read and delete. Run passed."));
		});
	});
	return new Promise((resolve) => server.listen(port, "0.0.0.0", () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await startApi();
	await startModel();
	console.log(`mock target API on :${API_PORT}, mock model on :${LLM_PORT}`);
}
