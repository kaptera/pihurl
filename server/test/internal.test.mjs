import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "pihurl-internal-"));
process.env.PIHURL_STATE = join(root, "state");
process.env.WORKSPACE = join(root, "ws");
process.env.PIHURL_INTERNAL_PORT = String(40000 + Math.floor(Math.random() * 20000));
mkdirSync(process.env.PIHURL_STATE, { recursive: true });
mkdirSync(process.env.WORKSPACE, { recursive: true });

// a fake model endpoint that records what it receives and streams a reply
const seen = [];
const upstream = http.createServer((req, res) => {
	let body = "";
	req.on("data", (c) => (body += c));
	req.on("end", () => {
		seen.push({ url: req.url, auth: req.headers.authorization, xkey: req.headers["x-api-key"], ver: req.headers["anthropic-version"], host: req.headers.host, body });
		res.writeHead(200, { "content-type": "text/event-stream" });
		res.write("data: one\n\n");
		setTimeout(() => res.end("data: two\n\n"), 30);
	});
});
await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
const up = `http://127.0.0.1:${upstream.address().port}`;

writeFileSync(join(process.env.PIHURL_STATE, "providers.json"), JSON.stringify([
	{ id: "p1", kind: "custom", name: "Local LLM", baseUrl: `${up}/v1`, model: "m1", apiKey: "sk-real-key", active: true },
	{ id: "p2", kind: "anthropic", name: "Claude", baseUrl: `${up}`, model: "c1", apiKey: "ant-key" },
	{ id: "p3", kind: "ollama", name: "Ollama", baseUrl: `${up}/v1`, model: "o1" },
]));

const { startInternalServer } = await import("../dist/internal.js");
const { syncModelsAtBoot } = await import("../dist/providers.js");
const { defaultProject, createProject } = await import("../dist/projects.js");
const internal = startInternalServer();
await new Promise((r) => internal.once("listening", r));
const base = `http://127.0.0.1:${process.env.PIHURL_INTERNAL_PORT}`;

test.after(() => { internal.close(); upstream.close(); });

test("models.json points pi at the proxy and holds no key or upstream address", () => {
	const second = createProject("Second API");
	syncModelsAtBoot();
	// every project gets its own models.json, all pointing at the same proxy
	assert.ok(JSON.parse(readFileSync(second.modelsPath, "utf8")).providers["local-llm"].baseUrl.startsWith(`${base}/llm/local-llm`));
	const raw = readFileSync(defaultProject().modelsPath, "utf8");
	const models = JSON.parse(raw).providers;
	assert.equal(models["local-llm"].baseUrl, `${base}/llm/local-llm/v1`);
	assert.equal(models["claude"].baseUrl, `${base}/llm/claude`);
	for (const m of Object.values(models)) assert.equal(m.apiKey, "proxy");
	assert.ok(!raw.includes("sk-real-key") && !raw.includes("ant-key") && !raw.includes(up));
});

test("the proxy adds the real key, per provider kind, and streams the answer", async () => {
	const res = await fetch(`${base}/llm/local-llm/v1/chat/completions?x=1`, {
		method: "POST", headers: { "content-type": "application/json", authorization: "Bearer proxy" }, body: '{"hi":1}',
	});
	assert.equal(res.status, 200);
	assert.equal(await res.text(), "data: one\n\ndata: two\n\n");
	const s = seen.at(-1);
	assert.equal(s.url, "/v1/chat/completions?x=1");
	assert.equal(s.auth, "Bearer sk-real-key"); // the placeholder pi sent is replaced
	assert.equal(s.body, '{"hi":1}');
	assert.equal(s.host, `127.0.0.1:${upstream.address().port}`);

	await (await fetch(`${base}/llm/claude/v1/messages`, { method: "POST", body: "{}" })).text();
	const a = seen.at(-1);
	assert.equal(a.xkey, "ant-key");
	assert.equal(a.auth, undefined);
	assert.equal(a.ver, "2023-06-01");

	await (await fetch(`${base}/llm/ollama/v1/models`)).text();
	assert.equal(seen.at(-1).auth, undefined); // a keyless provider gets no Authorization header
});

test("the key cannot be used outside the provider's base path, nor for unknown providers", async () => {
	const n = seen.length;
	assert.equal((await fetch(`${base}/llm/local-llm/admin/secret`)).status, 403);
	assert.equal((await fetch(`${base}/llm/local-llm/v1evil/x`)).status, 403);
	assert.equal((await fetch(`${base}/llm/nobody/v1/models`)).status, 404);
	assert.equal(seen.length, n, "nothing reached the upstream");
});

test("the agent can list the specs of its project and nothing else", async () => {
	const specs = await (await fetch(`${base}/p/default/api/specs`)).json();
	assert.ok(Array.isArray(specs.specs));
	assert.equal((await fetch(`${base}/p/nope/api/specs`)).status, 404);
	assert.equal((await fetch(`${base}/api/specs`)).status, 404);
	assert.equal((await fetch(`${base}/api/providers`)).status, 404);
	assert.equal((await fetch(`${base}/api/run`, { method: "POST" })).status, 404);
	assert.equal((await fetch(`${base}/health`)).status, 200);
});
