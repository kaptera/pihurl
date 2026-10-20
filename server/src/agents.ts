import { EventEmitter } from "node:events";
import { agentEnv, spawnIdentity } from "./agent.js";
import { ensureSessionsDir, touchChat } from "./chats.js";
import { activeProvider, config, loadProviders } from "./config.js";
import { clip, log } from "./log.js";
import { PiRpcClient, type PiEvent, type PiExit } from "./pi.js";
import type { Project } from "./projects.js";
import { providerArgs, syncModelsFromProviders } from "./providers.js";

/**
 * The agents: one pi process per chat, so chats can work at the same time.
 *
 * An agent is started the first time a chat needs it (a prompt, or its history is opened) and
 * stopped when it has been idle for a while or when too many are alive (the least recently used
 * idle one goes first); its session file keeps the conversation, so the next start continues it.
 * A provider change makes every running agent stale: idle ones stop at once, busy ones when their
 * turn ends.
 *
 * The pool is an EventEmitter:
 *   "event" (projectId, chatId, record)   every session event pi writes
 *   "busy"  (projectId, chatId, busy)     a chat started or finished working
 */

const MAX_AGENTS = Math.max(1, Number(process.env.PIHURL_MAX_AGENTS ?? 4));
const IDLE_MS = Math.max(1, Number(process.env.PIHURL_AGENT_IDLE_MINUTES ?? 15)) * 60_000;

interface Entry {
	project: Project;
	chat: string;
	client: PiRpcClient;
	/** a turn is running (or a prompt was just accepted) */
	busy: boolean;
	lastUsed: number;
	/** the provider changed since this agent started: stop it as soon as it is idle */
	stale: boolean;
}

export class AgentLimitError extends Error {}

class Pool extends EventEmitter {
	private entries = new Map<string, Entry>();
	private reaper?: NodeJS.Timeout;

	private key(projectId: string, chat: string): string {
		return `${projectId}/${chat}`;
	}

	find(projectId: string, chat: string): Entry | undefined {
		return this.entries.get(this.key(projectId, chat));
	}

	/** Chats of a project whose agent is working right now. */
	running(projectId: string): string[] {
		return [...this.entries.values()].filter((e) => e.project.id === projectId && e.busy).map((e) => e.chat);
	}

	isBusy(projectId: string, chat: string): boolean {
		return !!this.find(projectId, chat)?.busy;
	}

	/** The agent of a chat, started if it is not running. */
	get(project: Project, chat: string): Entry {
		const existing = this.find(project.id, chat);
		if (existing?.client.isRunning()) {
			existing.lastUsed = Date.now();
			return existing;
		}
		if (existing) this.entries.delete(this.key(project.id, chat));
		this.makeRoom();

		const provider = activeProvider();
		ensureSessionsDir(project);
		// models.json of this project: endpoints are the loopback proxy, keys stay in the server
		syncModelsFromProviders(project, loadProviders());
		const client = new PiRpcClient({
			cliPath: config.piCliPath,
			nodeBin: config.nodeBin,
			// pi treats its cwd as the project: AGENTS.md, tests/, hurl.env.
			cwd: project.dir,
			args: [
				...(provider ? providerArgs(provider, loadProviders()) : []),
				// The transcript lives in the project: it outlives agent and container restarts.
				"--session-id", chat, "--session-dir", project.sessionsDir,
			],
			// The agent's environment is a clean one: no access token, no provider keys.
			env: agentEnv({ PI_CODING_AGENT_DIR: project.agentDir, PIHURL_INTERNAL_URL: project.internalUrl }),
			...spawnIdentity(),
		});
		const entry: Entry = { project, chat, client, busy: false, lastUsed: Date.now(), stale: false };
		this.entries.set(this.key(project.id, chat), entry);
		log("info", "agent.start", { project: project.id, chat, provider: provider?.name ?? null, model: provider?.model ?? null });
		this.wire(entry);
		client.start().catch((err: unknown) => this.failed(entry, err instanceof Error ? err : new Error(String(err))));
		this.ensureReaper();
		return entry;
	}

	/** Make room for one more agent: stop the least recently used idle one, or refuse. */
	private makeRoom(): void {
		if (this.entries.size < MAX_AGENTS) return;
		const idle = [...this.entries.values()].filter((e) => !e.busy).sort((a, b) => a.lastUsed - b.lastUsed)[0];
		if (!idle) throw new AgentLimitError(`${MAX_AGENTS} chats are working at the same time; wait for one to finish`);
		log("info", "agent.evict", { project: idle.project.id, chat: idle.chat });
		void this.shutdown(idle.project.id, idle.chat);
	}

	private setBusy(e: Entry, busy: boolean): void {
		if (e.busy === busy) return;
		e.busy = busy;
		this.emit("busy", e.project.id, e.chat, busy);
	}

	private failed(e: Entry, err: Error): void {
		const rec = (type: string, extra: object): PiEvent => ({ type, ...extra });
		this.emit("event", e.project.id, e.chat, rec("error", { error: `could not start the agent: ${err.message}` }));
		this.emit("event", e.project.id, e.chat, rec("agent_settled", {}));
		this.setBusy(e, false);
		this.entries.delete(this.key(e.project.id, e.chat));
	}

	private wire(e: Entry): void {
		const { client } = e;
		client.on("event", (rec: PiEvent) => {
			if (rec.type === "agent_start") this.setBusy(e, true);
			if (rec.type === "agent_settled") {
				this.setBusy(e, false);
				e.lastUsed = Date.now();
			}
			logAgentEvent(e, rec);
			this.emit("event", e.project.id, e.chat, rec);
			if (rec.type === "agent_settled" && e.stale) void this.shutdown(e.project.id, e.chat);
		});
		client.on("closed", (x: PiExit) => {
			log(x.intentional ? "info" : "error", "agent.exit", { project: e.project.id, chat: e.chat, code: x.code, signal: x.signal, intentional: x.intentional });
			if (this.entries.get(this.key(e.project.id, e.chat)) === e) this.entries.delete(this.key(e.project.id, e.chat));
			if (!x.intentional) {
				// nobody asked for it: tell the browsers, or the turn would stay "busy" forever
				this.emit("event", e.project.id, e.chat, { type: "error", error: `agent exited unexpectedly (${x.signal ?? `code ${x.code}`})` });
				this.emit("event", e.project.id, e.chat, { type: "agent_settled" });
			}
			this.setBusy(e, false);
		});
		client.on("spawn_error", (err: Error) => {
			log("error", "agent.spawn_error", { project: e.project.id, chat: e.chat, error: err.message });
			this.failed(e, err);
		});
	}

	/** Send a prompt, steer or follow-up to a chat's agent (started if needed). */
	async send(project: Project, chat: string, kind: "prompt" | "steer" | "follow_up", message: string): Promise<unknown> {
		touchChat(project, chat, message);
		const e = this.get(project, chat);
		await e.client.start();
		e.lastUsed = Date.now();
		const result =
			kind === "prompt" ? await e.client.prompt(message)
			: kind === "steer" ? await e.client.steer(message)
			: await e.client.followUp(message);
		const rec = result as { success?: boolean } | null;
		// pi accepted it: the turn is about to start, do not reap or evict in the meantime
		if (rec?.success !== false) this.setBusy(e, true);
		return result;
	}

	/** Cancel the current run of a chat; the agent and its context stay. */
	async abort(projectId: string, chat: string): Promise<unknown> {
		const e = this.find(projectId, chat);
		if (!e?.client.isRunning()) return { success: true, data: { stopped: false } };
		return e.client.abort();
	}

	/** The messages of a chat, and whether it is working (starts the agent: the session is read through it). */
	async history(project: Project, chat: string): Promise<{ messages: Record<string, unknown>[]; running: boolean }> {
		const e = this.get(project, chat);
		await e.client.start();
		const [msgs, st] = await Promise.all([e.client.getMessages(), e.client.getState()]);
		const messages = ((msgs as { data?: { messages?: Record<string, unknown>[] } }).data?.messages) ?? [];
		const streaming = !!(st as { data?: { isStreaming?: boolean } }).data?.isStreaming;
		return { messages, running: streaming || e.busy };
	}

	async shutdown(projectId: string, chat: string): Promise<void> {
		const e = this.find(projectId, chat);
		if (!e) return;
		this.entries.delete(this.key(projectId, chat));
		await e.client.shutdown();
	}

	async shutdownProject(projectId: string): Promise<void> {
		await Promise.all([...this.entries.values()].filter((e) => e.project.id === projectId).map((e) => this.shutdown(e.project.id, e.chat)));
	}

	async shutdownAll(): Promise<void> {
		await Promise.all([...this.entries.values()].map((e) => this.shutdown(e.project.id, e.chat)));
	}

	/** The provider changed: idle agents stop now, busy ones when their turn ends. */
	providerChanged(): void {
		for (const e of this.entries.values()) {
			if (e.busy) e.stale = true;
			else void this.shutdown(e.project.id, e.chat);
		}
	}

	private ensureReaper(): void {
		if (this.reaper) return;
		this.reaper = setInterval(() => {
			const now = Date.now();
			for (const e of this.entries.values()) {
				if (!e.busy && now - e.lastUsed > IDLE_MS) {
					log("info", "agent.idle", { project: e.project.id, chat: e.chat });
					void this.shutdown(e.project.id, e.chat);
				}
			}
		}, 60_000);
		this.reaper.unref();
	}
}

export const pool = new Pool();

// What the agent did, in the app log: prompts, model replies, tool calls, errors. Together with
// pi's own session file this is enough to reconstruct a chat.
const toolStart = new Map<string, number>();

function logAgentEvent(e: Entry, ev: PiEvent): void {
	const ctx = { project: e.project.id, chat: e.chat };
	switch (ev.type) {
		case "agent_start":
			return log("info", "agent.run.start", ctx);
		case "agent_settled":
			return log("info", "agent.run.settled", ctx);
		case "message_end": {
			const m = ev.message as { role?: string; content?: unknown; stopReason?: string; errorMessage?: string; usage?: { input?: number; output?: number } } | undefined;
			if (m?.role === "user") {
				const text = typeof m.content === "string" ? m.content : (m.content as { text?: string }[] | undefined)?.map((c) => c.text ?? "").join("");
				return log("info", "chat.user", { ...ctx, text: clip(text, 600) });
			}
			if (m?.role === "assistant") {
				const blocks = (m.content as { type: string; text?: string; name?: string }[] | undefined) ?? [];
				const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
				const calls = blocks.filter((b) => b.type === "toolCall").map((b) => b.name);
				return log(m.stopReason === "error" ? "error" : "info", "chat.assistant", {
					...ctx, stop: m.stopReason, ...(m.errorMessage ? { error: m.errorMessage } : {}),
					tokens_in: m.usage?.input, tokens_out: m.usage?.output,
					...(calls.length ? { tools: calls } : {}), text: clip(text, 600),
				});
			}
			return;
		}
		case "tool_execution_start":
			toolStart.set(String(ev.toolCallId), Date.now());
			return log("info", "tool.start", { ...ctx, id: ev.toolCallId, tool: ev.toolName, args: clip(ev.args, 500) });
		case "tool_execution_end": {
			const out = ((ev.result as { content?: { text?: string }[] } | undefined)?.content ?? []).map((c) => c.text ?? "").join("");
			const t0 = toolStart.get(String(ev.toolCallId));
			toolStart.delete(String(ev.toolCallId));
			return log(ev.isError ? "warn" : "info", "tool.end", {
				...ctx, id: ev.toolCallId, tool: ev.toolName, error: !!ev.isError, ms: t0 ? Date.now() - t0 : undefined, output: clip(out, 500),
			});
		}
		case "auto_retry_start":
			return log("warn", "agent.retry", { ...ctx, attempt: ev.attempt, max: ev.maxAttempts, error: ev.errorMessage });
		case "auto_retry_end":
			return log(ev.success ? "info" : "error", "agent.retry.end", { ...ctx, success: ev.success, error: ev.finalError });
	}
}
