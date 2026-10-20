import { ChildProcessByStdio, spawn } from "node:child_process";
import { EventEmitter } from "node:events";

/**
 * A minimal, dependency-free RPC client for `pi --mode rpc`.
 *
 * Protocol (see pi/packages/coding-agent/docs/rpc.md):
 *  - JSONL framing on stdin/stdout. One JSON object per record, terminated by LF.
 *  - Node's `readline` must NOT be used: it splits on U+2028/U+2029 which are
 *    valid inside JSON strings. We decode bytes and split only on LF.
 *  - Commands carry an optional string `id`; the matching response repeats it.
 *  - Session events (message_update, tool_execution_*, agent_settled, ...) stream
 *    asynchronously and generally have no command id.
 *
 * This is intentionally small so the backend compiles before pi itself is built.
 * It can be swapped for `@earendil-works/pi-coding-agent`'s RpcClient later without
 * changing the callers above.
 */

export type PiEvent = {
	type: string;
	[id: string]: unknown;
};

/**
 * Emitted on the client:
 *  - "event"        every session event record pi writes (PiEvent)
 *  - "closed"       the process ended (PiExit); `intentional` after shutdown()
 *  - "spawn_error"  the process could not be started (Error)
 */
export interface PiExit {
	code: number | null;
	signal: NodeJS.Signals | null;
	intentional: boolean;
}

export interface RpcOptions {
	cliPath: string;
	args?: string[];
	/** The complete environment of the process (it is not merged with ours). */
	env?: NodeJS.ProcessEnv;
	/** Run pi as this user (needs a server running as root). */
	uid?: number;
	gid?: number;
	/**
	 * Node executable used to launch the pi CLI. The bundled `pi` shim ships a
	 * `#!/usr/bin/env node` shebang, so spawning it bare relies on PATH and can
	 * hit an old node (pi needs >= 22.19.0). We pass `[nodeBin, cliPath]` to skip
	 * the shebang entirely. Defaults to the process running this server.
	 */
	nodeBin?: string;
	/** Working folder for pi. It treats its cwd as the project (AGENTS.md, tools). */
	cwd?: string;
}

// pi acknowledges every command right away (a prompt response means "accepted",
// the turn itself streams as events), so one short window fits all commands.
const RESPONSE_TIMEOUT_MS = 30_000;

export class PiRpcClient extends EventEmitter {
	private proc: ChildProcessByStdio<
		import("node:stream").Writable,
		import("node:stream").Readable,
		null
	> | null = null;
	private buf = Buffer.alloc(0);
	private seq = 0;
	private intentional = false;
	private pending = new Map<
		string,
		{ resolve: (d: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
	>();

	constructor(private opts: RpcOptions) {
		super();
	}

	async start(): Promise<void> {
		if (this.proc) return;
		const args = ["--mode", "rpc", ...(this.opts.args ?? [])];
		const nodeBin = this.opts.nodeBin ?? process.execPath;
		const proc = spawn(nodeBin, [this.opts.cliPath, ...args], {
			stdio: ["pipe", "pipe", "inherit"],
			cwd: this.opts.cwd,
			env: this.opts.env ?? process.env,
			...(this.opts.uid !== undefined ? { uid: this.opts.uid, gid: this.opts.gid } : {}),
		});
		this.proc = proc;

		// Stdout is reserved for protocol records; diagnostics go to stderr, which
		// we inherit from the parent process (stdio[2] = "inherit"). Never parse it.
		proc.on("error", (err) => {
			// A failed spawn never fires "close" reliably; drop the dead handle so
			// ensurePi() builds a fresh client next time.
			this.proc = null;
			this.emit("spawn_error", err);
		});
		proc.stdout.setEncoding("utf8");
		proc.stdout.on("data", (chunk: string) => this.onChunk(chunk));
		// Writes to a dead child's stdin throw EPIPE; swallow instead of crashing
		// the server (send() rejects its own promise on write failure).
		proc.stdin?.on("error", () => {
			/* handled in send() */
		});
		proc.on("close", (code, signal) => {
			// Without this, isRunning() lies forever after an unexpected exit and
			// ensurePi() would keep handing out the dead client.
			this.proc = null;
			for (const id of [...this.pending.keys()]) this.deletePending(id, new Error("pi process closed"));
			this.emit("closed", { code, signal, intentional: this.intentional } satisfies PiExit);
		});
	}

	private onChunk(chunk: string): void {
		this.buf = Buffer.concat([this.buf, Buffer.from(chunk, "utf8")]);
		let idx: number;
		while ((idx = this.buf.indexOf(0x0a)) >= 0) {
			const line = this.buf.subarray(0, idx).toString("utf8").replace(/\r$/, "");
			this.buf = this.buf.subarray(idx + 1);
			if (!line.trim()) continue;
			let rec: PiEvent;
			try {
				rec = JSON.parse(line) as PiEvent;
			} catch {
				continue; // ignore malformed frames
			}
			this.dispatch(rec);
		}
	}

	private dispatch(rec: PiEvent): void {
		if (rec.type === "response") {
			const id = typeof rec.id === "string" ? rec.id : null;
			if (id) this.finish(id, rec);
			return;
		}
		// One catch-all channel so the SSE bridge forwards every session event
		// (message_end, auto_retry_*, compaction_*, ...) without a hand-kept list.
		this.emit("event", rec);
	}

	private finish(id: string, rec: unknown): void {
		const p = this.pending.get(id);
		if (!p) return;
		clearTimeout(p.timer);
		this.pending.delete(id);
		p.resolve(rec);
	}

	private deletePending(id: string, err: Error): void {
		const p = this.pending.get(id);
		if (!p) return;
		clearTimeout(p.timer);
		this.pending.delete(id);
		p.reject(err);
	}

	private async send<T = unknown>(command: Record<string, unknown>, timeoutMs = RESPONSE_TIMEOUT_MS): Promise<T> {
		if (!this.proc?.stdin) throw new Error("pi not started");
		const proc = this.proc;
		const id = `req-${++this.seq}`;
		const payload = { ...command, id };
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				const err = new Error(`pi response timeout after ${timeoutMs}ms`);
				this.deletePending(id, err);
				reject(err);
			}, timeoutMs);
			this.pending.set(id, { resolve: resolve as (d: unknown) => void, reject, timer });
			try {
				proc.stdin.write(JSON.stringify(payload) + "\n");
			} catch (err) {
				// EPIPE when the child died mid-flight — reject the caller cleanly.
				this.deletePending(id, err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	async prompt(message: string, images?: unknown[]): Promise<unknown> {
		return this.send({ type: "prompt", message, ...(images?.length ? { images } : {}) });
	}

	async steer(message: string): Promise<unknown> {
		return this.send({ type: "steer", message });
	}

	async followUp(message: string): Promise<unknown> {
		return this.send({ type: "follow_up", message });
	}

	/** Cancel the current run; the process and its context stay alive. */
	async abort(): Promise<unknown> {
		return this.send({ type: "abort" });
	}

	/** The whole conversation of the current session (AgentMessage objects). */
	async getMessages(): Promise<unknown> {
		return this.send({ type: "get_messages" });
	}

	async getState(): Promise<unknown> {
		return this.send({ type: "get_state" });
	}

	async shutdown(): Promise<void> {
		const proc = this.proc;
		if (!proc) return;
		this.intentional = true;
		// Drop the reference first: while we wait for close, isRunning() must
		// already report false so ensurePi() doesn't spawn a duplicate.
		this.proc = null;
		try {
			proc.stdin?.end();
		} catch {
			// ignore
		}
		await new Promise<void>((resolve) => {
			let done = false;
			const finish = (): void => {
				if (!done) {
					done = true;
					resolve();
				}
			};
			proc.once("close", finish);
			setTimeout(finish, 2000); // don't hang forever
		});
		try {
			proc.kill("SIGKILL");
		} catch {
			// already dead
		}
	}

	isRunning(): boolean {
		return this.proc !== null;
	}
}
