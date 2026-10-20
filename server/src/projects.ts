import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirAgent } from "./agent.js";
import { config } from "./config.js";

/**
 * Projects.
 *
 * A project is one API under test: its own specs, tests, reports, target host, instructions, chats
 * and agent files. Providers (the models and their keys), the access token and the logs are shared.
 *
 * The first project, "default", is the workspace root itself, so an install from before projects
 * keeps working without moving a file. Other projects live in <workspace>/.projects/<id>. Their
 * server-side files (chat index, hosts, defaults record) sit in <state>/projects/<id>, out of
 * the agent's reach like the rest of the state.
 */

export interface Project {
	id: string;
	name: string;
	/** the agent's working directory */
	dir: string;
	/** server-private files of this project */
	stateDir: string;
	agentDir: string;
	sessionsDir: string;
	specsDir: string;
	reportDir: string;
	hurlEnvPath: string;
	instructionsPath: string;
	templatesPath: string;
	modelsPath: string;
	chatsPath: string;
	legacyChatPath: string;
	hostsPath: string;
	defaultsPath: string;
	/** where the agent of this project reaches the server's loopback listener */
	internalUrl: string;
}

interface Record {
	id: string;
	name: string;
	createdAt: number;
}

export const DEFAULT_ID = "default";

const REGISTRY = join(config.stateDir, "projects.json");
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function validProjectId(id: string): boolean {
	return ID_RE.test(id) && !/^\d+$/.test(id); // numeric ids would clash with report run ids in URLs
}

function pathsFor(rec: Record): Project {
	const dir = rec.id === DEFAULT_ID ? config.workspace : join(config.workspace, ".projects", rec.id);
	const stateDir = join(config.stateDir, "projects", rec.id);
	const agentDir = join(dir, ".pi");
	return {
		id: rec.id,
		name: rec.name,
		dir,
		stateDir,
		agentDir,
		sessionsDir: join(agentDir, "sessions"),
		specsDir: join(dir, "specs"),
		reportDir: join(dir, "report"),
		hurlEnvPath: join(dir, "hurl.env"),
		instructionsPath: join(dir, "AGENTS.md"),
		templatesPath: join(agentDir, "prompts", "templates.json"),
		modelsPath: join(agentDir, "models.json"),
		chatsPath: join(stateDir, "chats.json"),
		legacyChatPath: join(stateDir, "chat.json"),
		hostsPath: join(stateDir, "hosts.json"),
		defaultsPath: join(stateDir, "defaults.json"),
		internalUrl: `${config.internalUrl}/p/${rec.id}`,
	};
}

function load(): Record[] {
	let list: Record[] = [];
	try {
		list = (JSON.parse(readFileSync(REGISTRY, "utf8")) as { projects?: Record[] }).projects ?? [];
	} catch {
		/* first start */
	}
	if (!list.some((r) => r.id === DEFAULT_ID)) list.unshift({ id: DEFAULT_ID, name: "Default", createdAt: Date.now() });
	return list.filter((r) => r && (r.id === DEFAULT_ID || validProjectId(r.id)));
}

function save(list: Record[]): void {
	mkdirSync(config.stateDir, { recursive: true });
	writeFileSync(REGISTRY, JSON.stringify({ projects: list }, null, 2));
}

export function listProjects(): Project[] {
	return load().map(pathsFor);
}

export function getProject(id: string | undefined): Project | undefined {
	return load().map(pathsFor).find((p) => p.id === (id || DEFAULT_ID));
}

export function defaultProject(): Project {
	return getProject(DEFAULT_ID)!;
}

const slug = (name: string): string => {
	const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
	return s && !/^\d+$/.test(s) ? s : `p-${s || "project"}`;
};

/** Create a project (directories and the registry entry). Seeding its files is the caller's job. */
export function createProject(name: string): Project {
	const list = load();
	const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
	if (!clean) throw new Error("a project needs a name");
	let id = slug(clean);
	for (let n = 2; list.some((r) => r.id === id); n++) id = `${slug(clean).slice(0, 36)}-${n}`;
	list.push({ id, name: clean, createdAt: Date.now() });
	save(list);
	const project = pathsFor(list[list.length - 1]);
	mkdirAgent(project.dir);
	mkdirSync(project.stateDir, { recursive: true });
	return project;
}

export function renameProject(id: string, name: string): boolean {
	const list = load();
	const rec = list.find((r) => r.id === id);
	const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
	if (!rec || !clean) return false;
	rec.name = clean;
	save(list);
	return true;
}

/** Remove a project and everything in it. The default project (the workspace root) cannot be deleted. */
export function deleteProject(id: string): boolean {
	if (id === DEFAULT_ID) return false;
	const list = load();
	const rec = list.find((r) => r.id === id);
	if (!rec) return false;
	const p = pathsFor(rec);
	save(list.filter((r) => r.id !== id));
	if (existsSync(p.dir)) rmSync(p.dir, { recursive: true, force: true });
	if (existsSync(p.stateDir)) rmSync(p.stateDir, { recursive: true, force: true });
	return true;
}
