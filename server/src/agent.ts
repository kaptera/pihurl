import { execFileSync } from "node:child_process";
import { chownSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

/**
 * The agent's identity and environment.
 *
 * pi (and so everything its bash tool runs) and hurl are started as an unprivileged user
 * when the server itself is root, which is how the container runs. That user cannot read the
 * state directory (provider keys, logs) or /proc/<server>/environ (the access token), and the
 * environment it gets is built here from an allow-list instead of being inherited.
 *
 * The server stays the owner of everything it must protect, and hands the agent only the
 * workspace: files the server creates in the workspace are chowned to the agent so it can edit
 * them (specs, hurl.env, reports, ...).
 */

export interface AgentIdentity {
	/** true when pi and hurl are started with a different, unprivileged uid */
	enabled: boolean;
	uid?: number;
	gid?: number;
	home: string;
}

function envNumber(name: string): number | undefined {
	const v = process.env[name];
	return v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined;
}

let cached: AgentIdentity | undefined;

export function agentIdentity(): AgentIdentity {
	if (cached) return cached;
	const uid = envNumber("PIHURL_AGENT_UID");
	const gid = envNumber("PIHURL_AGENT_GID") ?? uid;
	const home = process.env.PIHURL_AGENT_HOME ?? "/home/agent";
	if (uid === undefined) return (cached = { enabled: false, home: homedir() });
	if (uid === 0) throw new Error("PIHURL_AGENT_UID must not be 0: the agent would run as root");
	if (process.getuid?.() !== 0) {
		console.warn("PIHURL_AGENT_UID is set but the server is not root: the agent runs as the same user as the server");
		return (cached = { enabled: false, home: homedir() });
	}
	return (cached = { enabled: true, uid, gid, home });
}

/** `uid`/`gid` options for child_process.spawn, empty when the agent is not isolated. */
export function spawnIdentity(): { uid?: number; gid?: number } {
	const a = agentIdentity();
	return a.enabled ? { uid: a.uid, gid: a.gid } : {};
}

/** Hand a path to the agent (best effort: a failure only means the agent cannot write there). */
export function chownAgent(path: string): void {
	const a = agentIdentity();
	if (!a.enabled) return;
	try {
		chownSync(path, a.uid!, a.gid!);
	} catch {
		/* e.g. a mount that does not support chown */
	}
}

/** mkdir -p, giving every directory that did not exist before to the agent. */
export function mkdirAgent(dir: string): void {
	const missing: string[] = [];
	for (let d = resolve(dir); !existsSync(d); d = dirname(d)) missing.push(d);
	mkdirSync(dir, { recursive: true });
	for (const d of missing) chownAgent(d);
}

export function writeAgentFile(path: string, data: string): void {
	mkdirAgent(dirname(path));
	writeFileSync(path, data);
	chownAgent(path);
}

/** chown -R on a whole tree, at start-up (the workspace may come from an older, root-owned install). */
export function chownTreeAgent(dir: string): void {
	const a = agentIdentity();
	if (!a.enabled || !existsSync(dir)) return;
	try {
		execFileSync("chown", ["-R", `${a.uid}:${a.gid}`, dir], { stdio: "ignore" });
	} catch {
		console.warn(`could not hand ${dir} to the agent user; the agent may not be able to write there`);
	}
}

/** A home directory for the agent user (pi and the tools it runs want one). */
export function prepareAgentHome(): void {
	const a = agentIdentity();
	if (!a.enabled) return;
	mkdirSync(a.home, { recursive: true });
	chownAgent(a.home);
}

const ALLOWED_ENV = ["PATH", "LANG", "LC_ALL", "TZ"];

/**
 * Environment for pi and hurl. With an isolated agent only an allow-list gets through; otherwise
 * the server's own environment is passed on minus the access token.
 */
export function agentEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	const a = agentIdentity();
	if (a.enabled) {
		const env: NodeJS.ProcessEnv = { HOME: a.home, TERM: "dumb" };
		for (const k of ALLOWED_ENV) if (process.env[k] !== undefined) env[k] = process.env[k];
		return { ...env, ...extra };
	}
	const env = { ...process.env };
	for (const k of Object.keys(env)) if (k.startsWith("PIHURL_TOKEN")) delete env[k];
	return { ...env, ...extra };
}
