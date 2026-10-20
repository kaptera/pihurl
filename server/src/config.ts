import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { agentIdentity, writeAgentFile } from "./agent.js";
import type { Project } from "./projects.js";

/**
 * Configuration for the pihurl backend.
 *
 * All persistent state (workspace files, providers, reports) lives under a
 * single directory so it can be mounted as a Docker volume. Secrets (provider
 * API keys) are stored only here and never sent back to the browser.
 */

function env(name: string, fallback = ""): string {
	return process.env[name] ?? fallback;
}

const stateDir = resolve(env("PIHURL_STATE", join(homedir(), ".pihurl")));
const workspace = resolve(env("WORKSPACE", join(stateDir, "workspace")));

export const config = {
	// Port the HTTP server listens on.
	port: Number(env("PORT", "3000")),

	// Root of all persistent state. Defaults to a per-user dir so local dev works
	// without a volume, but the Dockerfile mounts it at /workspace.
	stateDir,

	// Root of the agent's files: the default project's directory, and .projects/ for the others
	// (`/workspace` in the container).
	workspace,

	// Default base URL offered for the Ollama preset. Inside Docker "localhost" is
	// the container itself, so the compose file / docker run sets OLLAMA_HOST.
	ollamaHost: env("OLLAMA_HOST", "http://localhost:11434").replace(/\/+$/, ""),

	// Provider registry (with keys): shared by all projects, readable by the server only.
	providersPath: join(stateDir, "providers.json"),

	// The web-ui SPA lives at /app/web-ui in the image (static assets stay in
	// the image; only PIHURL_STATE is a volume). For local dev we can point
	// straight at the project folder via WEB_UI_DIR.
	webUiDir: resolve(env("WEB_UI_DIR", join(stateDir, "web-ui"))),

	// The agent (pi) and hurl run as this unprivileged user when the server starts as root,
	// so that the agent can neither read the state dir (provider keys, logs) nor the server's
	// environment. Without PIHURL_AGENT_UID (local development) everything runs as one user.
	agent: agentIdentity(),

	// Loopback-only listener for the agent: the model proxy (which holds the provider keys)
	// and a read-only spec list. Never published by Docker, unlike `port`.
	internalPort: Number(env("PIHURL_INTERNAL_PORT", "3001")),
	internalUrl: `http://127.0.0.1:${env("PIHURL_INTERNAL_PORT", "3001")}`,

	// Shared secret for the web UI and API; empty = authentication off.
	token: readToken(),

	// Host names the server answers to when authentication is off (DNS-rebinding guard).
	allowedHosts: [
		"localhost", "127.0.0.1", "[::1]", "host.docker.internal",
		...env("PIHURL_ALLOWED_HOSTS", "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
	],

	// Path to the pi CLI (`dist/bundle/cli.js` of @earendil-works/pi-coding-agent).
	// Resolution order: explicit PI_CLI_PATH, then the installed package's own
	// cli.js, then the node_modules/.bin/pi shim.
	piCliPath: resolvePiCli(),

	// Executable used to run the pi CLI. The bundled `pi` shim has a
	// `#!/usr/bin/env node` shebang, so spawning it directly relies on whichever
	// `node` is first on PATH — which may be too old (pi requires >= 22.19.0,
	// e.g. the `enableCompileCache` export). We resolve a known-good Node here and
	// spawn `"$nodeBin" <piCliPath>` explicitly so the shebang is bypassed.
	// Resolution: PI_NODE_BIN override, then process.execPath (the node that started
	// this server), then `node` on PATH. Override in environments where the parent
	// node is correct but PATH points at an older one, and vice versa.
	nodeBin: resolveNodeBin(),
} as const;

function readToken(): string {
	const direct = env("PIHURL_TOKEN").trim();
	if (direct) return direct;
	const file = env("PIHURL_TOKEN_FILE");
	if (file) {
		try {
			return readFileSync(file, "utf8").trim();
		} catch (err) {
			throw new Error(`cannot read PIHURL_TOKEN_FILE: ${(err as Error).message}`);
		}
	}
	return "";
}

function resolveNodeBin(): string {
	const override = env("PI_NODE_BIN", "");
	if (override) return resolve(override);
	// process.execPath is the exact node binary running this server, so it always
	// satisfies pi's >= 22.19.0 requirement as long as we were started by a new one.
	return process.execPath;
}

function resolvePiCli(): string {
	const override = env("PI_CLI_PATH", "");
	if (override) return resolve(override);

	// Prefer the package's bundled CLI. pi.ts spawns `node <cliPath>` — the
	// node_modules/.bin/pi shim is a shell script, and node would choke on it.
	try {
		const here = fileURLToPath(new URL("../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
		if (existsSync(here)) return here;
	} catch {
		/* not resolvable */
	}

	// Fall back to the npm shim (only meaningful when someone spawns it
	// via a shell, not via `node <path>`).
	return join(process.cwd(), "node_modules", ".bin", "pi");
}

export function ensureDirs(): void {
	for (const d of [config.stateDir, config.workspace, config.webUiDir]) {
		if (!existsSync(d)) mkdirSync(d, { recursive: true });
	}
}

export interface ProviderConfig {
	id: string;
	kind: "ollama" | "openai" | "anthropic" | "openrouter" | "custom";
	name: string;
	baseUrl: string;
	model: string;
	apiKey?: string;
	temperature?: number;
	numCtx?: number;
	active?: boolean;
}

export function loadProviders(): ProviderConfig[] {
	try {
		return JSON.parse(readFileSync(config.providersPath, "utf8")) as ProviderConfig[];
	} catch {
		return [];
	}
}

export function saveProviders(list: ProviderConfig[]): void {
	writeFileSync(config.providersPath, JSON.stringify(list, null, 2));
}

export function activeProvider(): ProviderConfig | undefined {
	return loadProviders().find((p) => p.active) ?? loadProviders()[0];
}

// ---- prompt templates & instructions ---------------------------------------

export interface PromptTemplate {
	id: string;
	name: string;
	desc?: string;
	body: string;
	builtin?: boolean;
}

export function loadTemplates(p: Project): PromptTemplate[] {
	try {
		return JSON.parse(readFileSync(p.templatesPath, "utf8")) as PromptTemplate[];
	} catch {
		return [];
	}
}

export function saveTemplates(p: Project, list: PromptTemplate[]): void {
	writeAgentFile(p.templatesPath, JSON.stringify(list, null, 2));
}

export function loadInstructions(p: Project): string {
	try {
		return readFileSync(p.instructionsPath, "utf8");
	} catch {
		return "";
	}
}

export function saveInstructions(p: Project, text: string): void {
	writeAgentFile(p.instructionsPath, text);
}

// ---- hosts ------------------------------------------------------------------

export interface HostConfig {
	id: string;
	name: string;
	baseUrl: string;
	updatedAt?: number;
}

export function loadHosts(p: Project): HostConfig[] {
	try {
		return JSON.parse(readFileSync(p.hostsPath, "utf8")) as HostConfig[];
	} catch {
		return [];
	}
}

export function saveHosts(p: Project, list: HostConfig[]): void {
	mkdirSync(p.stateDir, { recursive: true });
	writeFileSync(p.hostsPath, JSON.stringify(list, null, 2));
}

// ---- models.json ------------------------------------------------------------
// Pi's models.json is an object keyed by provider name:
//   { "providers": { "<name>": { baseUrl, api, apiKey?, models: [{ id }] } } }
// The provider key is what --provider <name> selects at runtime.

export interface ModelEntry {
	id: string;
}

export interface ProviderModel {
	baseUrl: string;
	api?: string;
	apiKey?: string;
	models: ModelEntry[];
}

export type ModelsFile = Record<string, ProviderModel>;

export function loadModels(p: Project): ModelsFile {
	try {
		const raw = JSON.parse(readFileSync(p.modelsPath, "utf8")) as { providers?: ModelsFile };
		return raw.providers ?? {};
	} catch {
		return {};
	}
}

export function saveModels(p: Project, models: ModelsFile): void {
	writeAgentFile(p.modelsPath, JSON.stringify({ providers: models }, null, 2));
}
