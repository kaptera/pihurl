import { cpSync, existsSync, mkdirSync, renameSync, rmSync, chmodSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { agentIdentity, chownTreeAgent, prepareAgentHome } from "./agent.js";
import { config } from "./config.js";
import { log } from "./log.js";

/**
 * Start-up: lay out the state directory and the workspace so that the agent gets the workspace
 * and nothing else.
 *
 *  - state (PIHURL_STATE, default /state in the image): provider keys, chat index, hosts, logs.
 *    Root-only (0700); the agent user cannot read it.
 *  - workspace: specs, tests, reports, chat transcripts, skills. Owned by the agent user.
 *
 * Older versions kept the state inside the workspace; those files are moved out once.
 */

// Where state files used to be, and where they live now. Versions before projects kept everything
// in the workspace, then in the state root; per-project files now sit in <state>/projects/default.
const MOVES: { name: string; to: string }[] = [
	{ name: "providers.json", to: "" },
	{ name: "logs", to: "" },
	{ name: "hosts.json", to: "projects/default" },
	{ name: "chats.json", to: "projects/default" },
	{ name: "chat.json", to: "projects/default" },
	{ name: "defaults.json", to: "projects/default" },
];

function inside(child: string, parent: string): boolean {
	const rel = relative(resolve(parent), resolve(child));
	return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "..");
}

function move(from: string, to: string): void {
	try {
		renameSync(from, to);
	} catch {
		// different filesystems (a volume next to a bind mount)
		cpSync(from, to, { recursive: true });
		rmSync(from, { recursive: true, force: true });
	}
}

export function bootLayout(): void {
	const agent = agentIdentity();

	if (agent.enabled && inside(config.stateDir, config.workspace)) {
		throw new Error(
			"PIHURL_STATE must be outside WORKSPACE when the agent runs unprivileged (it would be able to read the provider keys). " +
				"Mount a separate volume for the state, e.g. -v pihurl-state:/state.",
		);
	}

	mkdirSync(config.stateDir, { recursive: true });
	mkdirSync(join(config.stateDir, "projects", "default"), { recursive: true });
	const moved: string[] = [];
	// the workspace first (oldest layout), then the state root (layout before projects)
	const sources = inside(config.stateDir, config.workspace) ? [config.stateDir] : [config.workspace, config.stateDir];
	for (const src of sources) {
		for (const { name, to } of MOVES) {
			const from = join(src, name);
			const dest = join(config.stateDir, to, name);
			if (resolve(from) !== resolve(dest) && existsSync(from) && !existsSync(dest)) {
				mkdirSync(join(config.stateDir, to), { recursive: true });
				move(from, dest);
				moved.push(name);
			}
		}
	}
	// log only afterwards: the first log line creates logs/ and would hide a legacy one
	if (moved.length) log("info", "state.migrated", { files: moved });
	if (agent.enabled) chmodSync(config.stateDir, 0o700);

	mkdirSync(config.workspace, { recursive: true });
	if (agent.enabled) {
		prepareAgentHome();
		chownTreeAgent(config.workspace);
	}
}
