import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { agentIdentity, mkdirAgent, writeAgentFile } from "./agent.js";

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

// Prompt templates shown in the UI. Kept in the volume under .pi/prompts so
// they travel with the workspace.
const promptsDir = join(workspace, ".pi", "prompts");

export const config = {
	// Port the HTTP server listens on.
	port: Number(env("PORT", "3000")),

	// Root of all persistent state. Defaults to a per-user dir so local dev works
	// without a volume, but the Dockerfile mounts it at /workspace.
	stateDir,

	// Working folder pi operates in (`/workspace` in the container).
	workspace,

	// Provider registry (models.json) + env for keys. Kept inside stateDir.
	providersPath: join(stateDir, "providers.json"),

	// Where Hurl reports are written; previous runs are archived for history.
	reportDir: join(workspace, "report"),

	// Prompt templates for the UI (not pi slash commands).
	templatesPath: join(promptsDir, "templates.json"),

	// Standing instructions. pi loads AGENTS.md from its working folder on every
	// start, so this is the file the "Project instructions" tab edits.
	instructionsPath: join(workspace, "AGENTS.md"),

	// Variables for the current target (host=...). The UI writes it, the agent
	// passes it to hurl via --variables-file.
	hurlEnvPath: join(workspace, "hurl.env"),

	// Default base URL offered for the Ollama preset. Inside Docker "localhost" is
	// the container itself, so the compose file / docker run sets OLLAMA_HOST.
	ollamaHost: env("OLLAMA_HOST", "http://localhost:11434").replace(/\/+$/, ""),

	// A registry of known API hosts (for the run host selector). In stateDir.
	hostsPath: join(stateDir, "hosts.json"),

	// Project-level models.json: OpenAI-compatible endpoints Pi reads to discover
	// models. Written by the backend when a provider is added; travels with the
	// workspace volume so pi can find the endpoint at startup.
	modelsPath: join(workspace, ".pi", "models.json"),

	// Pi's agent directory. We point it at the workspace .pi folder (via the
	// PI_CODING_AGENT_DIR env) so models.json lives in the volume and travels
	// with Docker instead of leaking into ~/.pi/agent.
	agentDir: join(workspace, ".pi"),

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
	for (const d of [config.stateDir, config.workspace, config.reportDir, config.webUiDir]) {
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

export function loadTemplates(): PromptTemplate[] {
	try {
		return JSON.parse(readFileSync(config.templatesPath, "utf8")) as PromptTemplate[];
	} catch {
		return [];
	}
}

export function saveTemplates(list: PromptTemplate[]): void {
	writeAgentFile(config.templatesPath, JSON.stringify(list, null, 2));
}

export function loadInstructions(): string {
	try {
		return readFileSync(config.instructionsPath, "utf8");
	} catch {
		return "";
	}
}

export function saveInstructions(text: string): void {
	writeAgentFile(config.instructionsPath, text);
}

// ---- hosts ------------------------------------------------------------------

export interface HostConfig {
	id: string;
	name: string;
	baseUrl: string;
	updatedAt?: number;
}

export function loadHosts(): HostConfig[] {
	try {
		return JSON.parse(readFileSync(config.hostsPath, "utf8")) as HostConfig[];
	} catch {
		return [];
	}
}

export function saveHosts(list: HostConfig[]): void {
	mkdirSync(config.stateDir, { recursive: true });
	writeFileSync(config.hostsPath, JSON.stringify(list, null, 2));
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

export function loadModels(): ModelsFile {
	try {
		const raw = JSON.parse(readFileSync(config.modelsPath, "utf8")) as { providers?: ModelsFile };
		return raw.providers ?? {};
	} catch {
		return {};
	}
}

export function saveModels(models: ModelsFile): void {
	writeAgentFile(config.modelsPath, JSON.stringify({ providers: models }, null, 2));
}
