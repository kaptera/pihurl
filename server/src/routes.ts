import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { Hono } from "hono";
import {
	activeProvider, config, loadHosts, loadInstructions, loadProviders, loadTemplates,
	saveHosts, saveInstructions, saveModels, saveProviders, saveTemplates,
	type HostConfig, type ModelsFile, type PromptTemplate, type ProviderConfig,
} from "./config.js";
import {
	currentChatId, deleteChat, ensureSessionsDir, listChats, newChat, renameChat, sessionsDir, switchChat, touchChat,
} from "./chats.js";
import { clip, log, logFile } from "./log.js";
import { agentEnv, spawnIdentity, writeAgentFile } from "./agent.js";
import {
	authEnabled, clearedCookie, clearLoginFailures, guard, isAuthenticated, loginAllowed, recordLoginFailure, sessionCookie, tokenMatches,
} from "./security.js";
import { PiRpcClient, type PiEvent, type PiExit } from "./pi.js";
import { modelsKeyFor, providerArgs, syncModelsAtBoot, syncModelsFromProviders } from "./providers.js";
import { listHistory, runTests } from "./run.js";
import { deleteSpec, listSpecs, saveSpec } from "./specs.js";
import { listTestFiles, testFilesExist } from "./testfiles.js";

/**
 * Routes for the pihurl backend.
 *
 *  GET  /health              liveness probe
 *  GET  /api/chat            SSE stream of pi session events (served raw, see server.ts)
 *  GET  /api/chat/state      is the agent mid-turn?
 *  GET  /api/chat/history    messages of the current chat (from pi's session)
 *  POST /api/chat            prompt | steer | follow_up | stop (abort the run) | new (fresh chat)
 *  GET  /api/info            versions and paths for the Settings page
 *  GET  /api/chats           the chat list (current id + titles)
 *  POST /api/chats           new | switch | rename | delete
 *  GET  /api/specs           every spec in the workspace, parsed (endpoints, errors)
 *  POST /api/specs           upload a spec ({name, content}) into specs/
 *  DELETE /api/specs?path=   delete a spec
 *  GET  /api/providers       list providers (keys masked)
 *  POST /api/providers       save/activate/delete a provider (restarts the agent)
 *  POST /api/providers/test  real connectivity check for a provider config
 *  GET  /api/tests           list test files (+ source) in the workspace
 *  GET  /api/run             run history, newest first
 *  POST /api/run             run Hurl tests now
 *  GET/POST /api/prompts     prompt templates + AGENTS.md
 *  GET/POST /api/hosts       target hosts (the latest one is mirrored to hurl.env)
 *  GET  /report/*            static report files
 *  GET  /*                   web-ui static assets
 */

export const app = new Hono();

// Host, origin and access-token checks come first (security.ts). The streaming chat endpoint is
// served outside Hono and runs the same guard in server.ts.
app.use("*", async (c, next) => {
	const g = guard({ method: c.req.method, path: c.req.path, headers: c.req.header() });
	if (!g.ok) return c.json({ error: g.error, detail: g.message }, g.status as 401 | 403);
	await next();
});

// The sign-in state, for the UI.
app.get("/api/session", (c) => c.json({ auth: authEnabled(), authed: isAuthenticated(c.req.header()) }));

app.post("/api/session", async (c) => {
	if (!authEnabled()) return c.json({ auth: false, authed: true });
	const ip = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ?? "unknown";
	if (!loginAllowed(ip)) {
		log("warn", "auth.blocked", { ip });
		return c.json({ error: "too_many_attempts", detail: "too many failed attempts, try again in a few minutes" }, 429);
	}
	const body = await c.req.json().catch(() => ({}));
	if (!tokenMatches(typeof body.token === "string" ? body.token : "")) {
		recordLoginFailure(ip);
		log("warn", "auth.failed", { ip });
		return c.json({ error: "wrong_token", detail: "wrong token" }, 401);
	}
	clearLoginFailures(ip);
	const secure = c.req.header("x-forwarded-proto") === "https" || c.req.url.startsWith("https:");
	c.header("Set-Cookie", sessionCookie(secure));
	log("info", "auth.login", { ip });
	return c.json({ auth: true, authed: true });
});

app.delete("/api/session", (c) => {
	c.header("Set-Cookie", clearedCookie());
	return c.json({ auth: authEnabled(), authed: false });
});

// One line per API call (not static assets, not the 1s state polling).
app.use("/api/*", async (c, next) => {
	const t0 = Date.now();
	await next();
	if (c.req.path === "/api/chat/state") return;
	const level = c.res.status >= 500 ? "error" : c.res.status >= 400 ? "warn" : "info";
	log(level, "http", { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - t0 });
});

// ---- agent process ----------------------------------------------------------

let piClient: PiRpcClient | null = null;

// Drop the running agent so a provider change takes effect on the next prompt.
function restartPi(): void {
	const client = piClient;
	piClient = null;
	void client?.shutdown();
}

// Same, but wait until it is gone (a chat switch must not race the old process).
async function dropAgent(): Promise<void> {
	const client = piClient;
	piClient = null;
	await client?.shutdown();
}

function ensurePi(): PiRpcClient {
	if (!piClient?.isRunning()) {
		const provider = activeProvider();
		const chatId = currentChatId();
		ensureSessionsDir();
		const client = new PiRpcClient({
			cliPath: config.piCliPath,
			nodeBin: config.nodeBin,
			// pi treats its cwd as the project: AGENTS.md, tests/, hurl.env.
			cwd: config.workspace,
			args: [
				...(provider ? providerArgs(provider, loadProviders()) : []),
				// The transcript lives in the volume: it outlives agent and container restarts.
				"--session-id", chatId, "--session-dir", sessionsDir,
			],
			// Keep models.json and skills in the workspace volume instead of ~/.pi/agent. The agent's
			// environment is a clean one: no access token, no provider keys (those stay in the server).
			env: agentEnv({ PI_CODING_AGENT_DIR: config.agentDir, PIHURL_INTERNAL_URL: config.internalUrl }),
			...spawnIdentity(),
		});
		log("info", "agent.start", { chat: chatId, provider: provider?.name ?? null, model: provider?.model ?? null });
		attachAgentLog(client);
		piClient = client;
	}
	return piClient;
}

// What the agent did, in the app log: prompts, model replies, tool calls, errors.
// Together with pi's own session file this is enough to reconstruct a chat.
function attachAgentLog(client: PiRpcClient): void {
	const started = new Map<string, number>();
	client.on("event", (e: PiEvent) => {
		switch (e.type) {
			case "agent_start":
				return log("info", "agent.run.start");
			case "agent_settled":
				return log("info", "agent.run.settled");
			case "message_end": {
				const m = e.message as { role?: string; content?: unknown; stopReason?: string; errorMessage?: string; usage?: { input?: number; output?: number } } | undefined;
				if (m?.role === "user") {
					const text = typeof m.content === "string" ? m.content : (m.content as { text?: string }[] | undefined)?.map((c) => c.text ?? "").join("");
					return log("info", "chat.user", { text: clip(text, 600) });
				}
				if (m?.role === "assistant") {
					const blocks = (m.content as { type: string; text?: string; name?: string }[] | undefined) ?? [];
					const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
					const calls = blocks.filter((b) => b.type === "toolCall").map((b) => b.name);
					return log(m.stopReason === "error" ? "error" : "info", "chat.assistant", {
						stop: m.stopReason, ...(m.errorMessage ? { error: m.errorMessage } : {}),
						tokens_in: m.usage?.input, tokens_out: m.usage?.output,
						...(calls.length ? { tools: calls } : {}), text: clip(text, 600),
					});
				}
				return;
			}
			case "tool_execution_start":
				started.set(String(e.toolCallId), Date.now());
				return log("info", "tool.start", { id: e.toolCallId, tool: e.toolName, args: clip(e.args, 500) });
			case "tool_execution_end": {
				const out = ((e.result as { content?: { text?: string }[] } | undefined)?.content ?? []).map((c) => c.text ?? "").join("");
				const t0 = started.get(String(e.toolCallId));
				started.delete(String(e.toolCallId));
				return log(e.isError ? "warn" : "info", "tool.end", {
					id: e.toolCallId, tool: e.toolName, error: !!e.isError, ms: t0 ? Date.now() - t0 : undefined, output: clip(out, 500),
				});
			}
			case "auto_retry_start":
				return log("warn", "agent.retry", { attempt: e.attempt, max: e.maxAttempts, error: e.errorMessage });
			case "auto_retry_end":
				return log(e.success ? "info" : "error", "agent.retry.end", { success: e.success, error: e.finalError });
		}
	});
	client.on("closed", (x: PiExit) =>
		log(x.intentional ? "info" : "error", "agent.exit", { code: x.code, signal: x.signal, intentional: x.intentional }));
	client.on("spawn_error", (err: Error) => log("error", "agent.spawn_error", { error: err.message }));
}

// Is the agent mid-turn? The UI asks this on load so its seed message is
// routed as a steer (queued into the running turn) instead of a plain prompt,
// which pi rejects outright while streaming. Never spawns pi by itself.
app.get("/api/chat/state", async (c) => {
	if (!piClient?.isRunning()) return c.json({ running: false, started: false });
	try {
		const st = (await piClient.getState()) as { data?: { isStreaming?: boolean } };
		return c.json({ running: !!st?.data?.isStreaming, started: true });
	} catch {
		return c.json({ running: false, started: true });
	}
});

// The current chat as the UI should redraw it after a reload: user, assistant
// and tool-result messages of pi's session. Starts pi if needed (the session is
// opened from disk), so a browser reload picks the conversation up again.
app.get("/api/chat/history", async (c) => {
	try {
		const client = ensurePi();
		await client.start();
		const [msgs, st] = await Promise.all([client.getMessages(), client.getState()]);
		const raw = ((msgs as { data?: { messages?: Record<string, unknown>[] } }).data?.messages) ?? [];
		const messages = raw.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult").map(slimMessage);
		const running = !!(st as { data?: { isStreaming?: boolean } }).data?.isStreaming;
		return c.json({ chat: currentChatId(), running, messages });
	} catch (err) {
		return c.json({ chat: currentChatId(), running: false, messages: [], error: err instanceof Error ? err.message : String(err) });
	}
});

// ---- chat list ----------------------------------------------------------------

app.get("/api/chats", (c) => c.json(listChats()));

app.post("/api/chats", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const id = typeof body.id === "string" ? body.id : "";
	const before = currentChatId();
	switch (body.action) {
		case "new": {
			const chat = newChat();
			if (chat !== before) await dropAgent();
			log("info", "chat.new", { chat, reused: chat === before });
			break;
		}
		case "switch":
			if (!switchChat(id)) return c.json({ error: "not_found" }, 404);
			if (id !== before) await dropAgent();
			log("info", "chat.switch", { chat: id });
			break;
		case "rename":
			if (!renameChat(id, String(body.title ?? ""))) return c.json({ error: "not_found" }, 404);
			log("info", "chat.rename", { chat: id });
			break;
		case "delete": {
			if (!listChats().chats.some((x) => x.id === id)) return c.json({ error: "not_found" }, 404);
			// The agent holds the file open (and would keep appending to it).
			if (id === before) await dropAgent();
			const now = deleteChat(id);
			log("info", "chat.delete", { chat: id, current: now });
			break;
		}
		default:
			return c.json({ error: "unknown action" }, 400);
	}
	return c.json(listChats());
});

// Drop what the UI never shows (signatures, thinking, usage) and cap huge tool output.
function slimMessage(m: Record<string, unknown>): Record<string, unknown> {
	const cap = (t: string): string => (t.length > 20000 ? `${t.slice(0, 20000)}\n… (${t.length - 20000} more characters)` : t);
	const blocks = Array.isArray(m.content)
		? (m.content as Record<string, unknown>[])
			.filter((b) => b.type === "text" || b.type === "toolCall")
			.map((b) => (b.type === "text" ? { type: "text", text: cap(String(b.text ?? "")) } : { type: "toolCall", id: b.id, name: b.name, arguments: b.arguments }))
		: [{ type: "text", text: cap(String(m.content ?? "")) }];
	return {
		role: m.role, content: blocks, timestamp: m.timestamp,
		...(m.role === "assistant" ? { stopReason: m.stopReason, errorMessage: m.errorMessage } : {}),
		...(m.role === "toolResult" ? { toolCallId: m.toolCallId, toolName: m.toolName, isError: m.isError } : {}),
	};
}

// SSE bridge from pi events to the browser. Served raw on the node:http
// listener (see server.ts): routing a long-lived Web ReadableStream through
// @hono/node-server stalls the first stream after startup — events pile up
// in its queue and never reach the browser. Raw res.write has no such issue.
export function chatSSEHandler(req: IncomingMessage, res: ServerResponse): void {
	const client = ensurePi();
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"X-Accel-Buffering": "no",
	});
	res.write(":open\n\n");

	log("info", "sse.open");
	let done = false;
	const send = (e: unknown): void => {
		if (!done) res.write(`data: ${JSON.stringify(e)}\n\n`);
	};
	const onEvent = (e: PiEvent): void => send(e);
	const onSpawnError = (err: Error): void => {
		send({ type: "error", error: `could not start the agent: ${err.message}` });
		send({ type: "agent_settled" });
	};
	// The agent ended. If nobody asked for it, tell the browser, otherwise its
	// turn would stay "busy" forever; then end the stream so the reader loop
	// finishes and the next send() reconnects to the next agent.
	const onClosed = (exit: PiExit): void => {
		if (!exit.intentional) {
			send({ type: "error", error: `agent exited unexpectedly (${exit.signal ?? `code ${exit.code}`})` });
			send({ type: "agent_settled" });
		}
		teardown();
	};
	// Comment frames keep proxies from buffering and detect dead sockets.
	const heartbeat = setInterval(() => {
		if (!done) res.write(":ka\n\n");
	}, 15000);
	function teardown(): void {
		if (done) return;
		done = true;
		log("info", "sse.close");
		clearInterval(heartbeat);
		client.off("event", onEvent);
		client.off("closed", onClosed);
		client.off("spawn_error", onSpawnError);
		if (!res.writableEnded) res.end();
	}

	client.on("event", onEvent);
	client.on("closed", onClosed);
	client.on("spawn_error", onSpawnError);
	req.on("close", teardown);
	res.on("error", teardown);
	client.start().catch((err: unknown) => onSpawnError(err instanceof Error ? err : new Error(String(err))));
}

// Never reached in practice (the http listener intercepts this path first);
// kept so the route surface documents the method split.
app.get("/api/chat", (c) => c.json({ error: "SSE is served on the raw listener" }, 405));

app.post("/api/chat", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const kind = body.kind ?? "prompt";
	const message = typeof body.message === "string" ? body.message : "";

	// "stop" cancels the current run but keeps the agent and its context.
	if (kind === "stop") {
		if (!piClient?.isRunning()) return c.json({ success: true, data: { stopped: false } });
		try {
			return c.json(await piClient.abort());
		} catch (err) {
			return c.json({ success: false, error: err instanceof Error ? err.message : String(err) });
		}
	}
	// "new" throws the agent away, and with it the conversation. Null the
	// reference first so ensurePi() won't hand the dying client back out.
	if (kind === "new") {
		const before = currentChatId();
		const chat = newChat();
		if (chat !== before) await dropAgent();
		log("info", "chat.new", { chat, reused: chat === before });
		return c.json({ success: true, data: { stopped: true, chat } });
	}

	if (!message) return c.json({ error: "message required" }, 400);
	if (kind !== "prompt" && kind !== "steer" && kind !== "follow_up") return c.json({ error: "unknown kind" }, 400);

	let client: PiRpcClient;
	try {
		client = ensurePi();
		await client.start();
	} catch (err) {
		return c.json({ error: "agent_unavailable", detail: err instanceof Error ? err.message : String(err) }, 503);
	}

	touchChat(currentChatId(), message);
	let result: unknown;
	try {
		result = kind === "prompt" ? await client.prompt(message)
			: kind === "steer" ? await client.steer(message)
			: await client.followUp(message);
	} catch (err) {
		return c.json({ error: "agent_unavailable", detail: err instanceof Error ? err.message : String(err) }, 503);
	}
	// pi answers every command with {type:"response", success, data|error}. A
	// rejected prompt (e.g. "agent is already processing — use streamingBehavior")
	// must surface as an error, not as a 200 success with a buried flag.
	const rec = result as { success?: boolean; error?: string } | null;
	if (rec && rec.success === false) {
		return c.json({ success: false, error: rec.error ?? "agent rejected the command" }, 200);
	}
	return c.json({ success: true, data: result });
});

// ---- specs ------------------------------------------------------------------

// Both the user (upload) and the agent (it writes files into specs/) produce specs,
// so the list is always read from disk.
app.get("/api/specs", (c) => c.json({ specs: listSpecs() }));

app.post("/api/specs", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	try {
		const path = saveSpec(typeof body.name === "string" ? body.name : "openapi.yaml", typeof body.content === "string" ? body.content : "");
		log("info", "spec.save", { path });
		return c.json({ saved: path, specs: listSpecs() });
	} catch (err) {
		return c.json({ error: "invalid_spec", detail: err instanceof Error ? err.message : String(err) }, 400);
	}
});

app.delete("/api/specs", (c) => {
	const path = c.req.query("path") ?? "";
	if (!deleteSpec(path)) return c.json({ error: "not_found" }, 404);
	log("info", "spec.delete", { path });
	return c.json({ specs: listSpecs() });
});

// ---- providers --------------------------------------------------------------

// Secrets never leave the server: the browser gets a masked hint and sends a
// key back only when the user types a new one (a blank key keeps the stored one).
function maskKey(key: string): string {
	return key.length <= 8 ? "••••" : `${key.slice(0, 3)}…${key.slice(-4)}`;
}

function publicProvider(p: ProviderConfig): ProviderConfig {
	return { ...p, apiKey: p.apiKey ? maskKey(p.apiKey) : undefined };
}

app.get("/api/providers", (c) =>
	c.json({ providers: loadProviders().map(publicProvider), defaults: { ollamaUrl: `${config.ollamaHost}/v1` } }));

app.post("/api/providers", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const action = body.action ?? "save";
	let list = loadProviders();
	let savedId: string | undefined;

	if (action === "save") {
		const id = typeof body.id === "string" && body.id ? body.id : `p-${Date.now()}`;
		savedId = id;
		const idx = list.findIndex((p) => p.id === id);
		const existing = idx >= 0 ? list[idx] : undefined;
		// Merge over the stored provider: an absent/blank field keeps the old
		// value instead of wiping it (in particular an empty apiKey means "keep
		// the stored secret" — the UI never sends keys back it read).
		const provider: ProviderConfig = {
			id,
			kind: body.kind ?? existing?.kind ?? "custom",
			name: typeof body.name === "string" ? body.name : existing?.name ?? "",
			baseUrl: typeof body.baseUrl === "string" ? body.baseUrl.trim() : existing?.baseUrl ?? "",
			model: typeof body.model === "string" ? body.model.trim() : existing?.model ?? "",
			apiKey: body.apiKey ? body.apiKey : existing?.apiKey,
			temperature: body.temperature ?? existing?.temperature,
		};
		// An explicit boolean flips active (deactivating the rest); a plain save
		// keeps the provider's current active state, and a brand-new provider
		// becomes active when nothing else is.
		const active = typeof body.active === "boolean"
			? body.active
			: (existing?.active ?? !list.some((p) => p.active));
		provider.active = active;
		if (idx >= 0) list[idx] = provider;
		else list.push(provider);
		if (active) for (const p of list) p.active = p.id === id;
	} else if (action === "activate") {
		const idx = list.findIndex((p) => p.id === body.id);
		if (idx < 0) return c.json({ error: "not_found" }, 404);
		for (const p of list) p.active = p.id === body.id;
	} else if (action === "delete") {
		list = list.filter((p) => p.id !== body.id);
		// Keep exactly one provider active so ensurePi() always has a candidate.
		if (list.length && !list.some((p) => p.active)) {
			const first = list[0].id;
			for (const p of list) p.active = p.id === first;
		}
	} else {
		return c.json({ error: "unknown action" }, 400);
	}

	saveProviders(list);
	syncModelsFromProviders(list);
	log("info", "provider." + action, { id: body.id ?? savedId, name: list.find((p) => p.id === (body.id ?? savedId))?.name, active: list.find((p) => p.active)?.name });
	// pi was started with the old provider's flags — restart it so the change
	// takes effect on the next prompt.
	restartPi();
	return c.json({
		providers: list.map(publicProvider),
		// The saved provider for `save` (the UI reads its generated id); the
		// list alone is enough for activate/delete.
		saved: savedId ? publicProvider(list.find((p) => p.id === savedId)!) : undefined,
	});
});

// Real connectivity check against a provider endpoint. The browser sends the
// desired config; a blank key falls back to the stored key of provider `id`.
// Nothing is persisted. Always answers 200 with {ok,...} — a refused connection
// is a result, not a server error.
app.post("/api/providers/test", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim().replace(/\/+$/, "") : "";
	const kind = (body.kind as ProviderConfig["kind"]) ?? "custom";
	if (!baseUrl) return c.json({ ok: false, error: "base URL required" });
	if (!/^https?:\/\//i.test(baseUrl)) return c.json({ ok: false, error: "base URL must start with http:// or https://" });

	const stored = typeof body.id === "string" ? loadProviders().find((p) => p.id === body.id)?.apiKey : undefined;
	const key: string = (typeof body.apiKey === "string" && body.apiKey) || stored || "";

	let target: string;
	const headers: Record<string, string> = { Accept: "application/json" };
	if (kind === "ollama") {
		// The OpenAI-compatible base ends in /v1; the native model list does not.
		target = `${baseUrl.replace(/\/v1$/, "")}/api/tags`;
	} else if (kind === "anthropic") {
		target = `${baseUrl}/v1/models`;
		if (key) headers["x-api-key"] = key;
		headers["anthropic-version"] = "2023-06-01";
	} else {
		target = `${baseUrl}/models`;
		if (key) headers.Authorization = `Bearer ${key}`;
	}

	const t0 = Date.now();
	try {
		const res = await fetch(target, { method: "GET", headers, signal: AbortSignal.timeout(8000) });
		const ms = Date.now() - t0;
		if (!res.ok) {
			const hint = res.status === 401 || res.status === 403 ? " (check the API key)" : "";
			return c.json({ ok: false, status: res.status, error: `${target} answered HTTP ${res.status}${hint}`, ms });
		}
		let models = 0;
		try {
			const data = (await res.json()) as { data?: unknown[]; models?: unknown[] };
			models = data.data?.length ?? data.models?.length ?? 0;
		} catch {
			/* non-JSON body — still a connection */
		}
		return c.json({ ok: true, status: res.status, models, ms });
	} catch (err) {
		const e = err as Error & { cause?: { code?: string; message?: string; errors?: { code?: string }[] } };
		const code = e.cause?.code ?? e.cause?.errors?.[0]?.code ?? e.cause?.message;
		const reason = code ? `${e.message} (${code})` : e.message;
		return c.json({ ok: false, error: reason, ms: Date.now() - t0 });
	}
});

// ---- tests & runs -----------------------------------------------------------

// The Hurl files live in the workspace and belong to the agent; the backend only
// lists and runs them.
app.get("/api/tests", (c) => c.json({ files: listTestFiles(), exists: testFilesExist() }));

app.get("/api/run", (c) => c.json({ history: listHistory() }));

app.post("/api/run", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	// No host in the request (a script, curl): run against the current target, the same one the agent uses.
	const given = typeof body.host === "string" ? body.host.trim() : "";
	const host = given || loadHosts()[0]?.baseUrl || "";
	if (given) rememberHost(given);
	try {
		const result = await runTests({
			host,
			variables: Array.isArray(body.variables) ? body.variables : [],
			files: Array.isArray(body.files) && body.files.length ? body.files : undefined,
		});
		return c.json({ result });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return c.json({ error: "run_failed", detail: message }, message.includes("already in progress") ? 409 : 500);
	}
});

// ---- prompts & hosts --------------------------------------------------------

app.get("/api/prompts", (c) =>
	c.json({ templates: loadTemplates(), instructions: loadInstructions() }));

app.post("/api/prompts", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	if (Array.isArray(body.templates)) {
		const ok = (body.templates as PromptTemplate[]).every(
			(t) => t && typeof t.id === "string" && typeof t.name === "string" && typeof t.body === "string",
		);
		if (!ok) return c.json({ error: "invalid templates" }, 400);
		saveTemplates(body.templates);
	}
	if (typeof body.instructions === "string") saveInstructions(body.instructions);
	return c.json({ templates: loadTemplates(), instructions: loadInstructions() });
});

// The agent runs hurl itself while it works, and needs the same target the UI
// uses: mirror the most recent host into hurl.env (read via --variables-file).
function rememberHost(baseUrl: string): void {
	const list = loadHosts();
	const entry: HostConfig = { id: "current", name: "Current target", baseUrl, updatedAt: Date.now() };
	const idx = list.findIndex((h) => h.id === entry.id);
	if (idx >= 0) list[idx] = entry;
	else list.unshift(entry);
	saveHosts(list);
	writeAgentFile(config.hurlEnvPath, `host=${baseUrl}\n`);
}

app.get("/api/hosts", (c) => c.json({ hosts: loadHosts() }));

app.post("/api/hosts", async (c) => {
	const body = await c.req.json().catch(() => ({}));
	if (body.action === "save") {
		const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
		if (!/^https?:\/\/\S+$/i.test(baseUrl)) return c.json({ error: "baseUrl must be an http(s) URL" }, 400);
		rememberHost(baseUrl);
	} else if (body.action === "delete") {
		saveHosts(loadHosts().filter((x) => x.id !== body.id));
	}
	return c.json({ hosts: loadHosts() });
});

// Read-only facts for the Settings page: where things live and what is installed.
const VERSION = (() => {
	try {
		return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string }).version ?? "";
	} catch {
		return "";
	}
})();
let hurlVersion: string | undefined;
function getHurlVersion(): string {
	if (hurlVersion === undefined) {
		const out = spawnSync("hurl", ["--version"], { encoding: "utf8", timeout: 5000 });
		hurlVersion = out.status === 0 ? out.stdout.split(" ").slice(0, 2).join(" ").trim() : "not found";
	}
	return hurlVersion;
}

app.get("/api/info", (c) =>
	c.json({
		version: VERSION,
		node: process.version,
		hurl: getHurlVersion(),
		workspace: config.workspace,
		state: config.stateDir,
		log: logFile,
		sessions: sessionsDir,
		auth: authEnabled(),
		agentIsolated: config.agent.enabled,
	}));

app.get("/health", (c) => c.json({ ok: true }));

// ---- reports & web-ui static assets ----------------------------------------

/** Resolve a URL path under `root`, or null if it escapes it. */
function resolveInside(root: string, urlPath: string): string | null {
	let rel: string;
	try {
		rel = decodeURIComponent(urlPath);
	} catch {
		return null;
	}
	const abs = resolve(root, rel.replace(/^[/\\]+/, ""));
	return abs === root || abs.startsWith(root + sep) ? abs : null;
}

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".woff2": "font/woff2",
};

function fileResponse(file: string, fallbackType: string): Response {
	return new Response(new Uint8Array(readFileSync(file)), {
		headers: { "Content-Type": MIME[extname(file).toLowerCase()] ?? fallbackType },
	});
}

function isFile(p: string | null): p is string {
	try {
		return !!p && statSync(p).isFile();
	} catch {
		return false;
	}
}

// Hurl's HTML report stores response bodies as extension-less files; show them
// as text instead of offering a download.
app.get("/report/*", (c) => {
	const file = resolveInside(config.reportDir, c.req.path.replace(/^\/report\/?/, ""));
	return isFile(file) ? fileResponse(file, "text/plain; charset=utf-8") : c.notFound();
});

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

// Serve the web-ui: assets by path; index.html for "/" and extension-less paths
// (a missing .js/.css is a 404, not an HTML page).
app.get("/*", (c) => {
	const asset = resolveInside(config.webUiDir, c.req.path);
	if (isFile(asset)) return fileResponse(asset, "application/octet-stream");
	if (extname(c.req.path)) return c.notFound();
	const index = join(config.webUiDir, "index.html");
	return isFile(index) ? fileResponse(index, "text/html; charset=utf-8") : c.notFound();
});
