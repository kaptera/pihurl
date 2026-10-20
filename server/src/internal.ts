import http from "node:http";
import https from "node:https";
import { config } from "./config.js";
import { log } from "./log.js";
import { providerByKey, upstreamBasePath } from "./providers.js";
import { listSpecs } from "./specs.js";

/**
 * The agent's own, loopback-only listener (127.0.0.1:PIHURL_INTERNAL_PORT; Docker never
 * publishes it). The agent runs without the user's access token and without the provider keys,
 * so the two things it needs from the server are served here:
 *
 *  - /llm/<provider>/...  the model proxy: forwards pi's requests to the provider's real endpoint
 *    and adds the real API key. models.json points at it (providers.ts). Only paths below the
 *    provider's own base path are forwarded, so the key cannot be used elsewhere on that host.
 *  - GET /api/specs       the parsed spec list, for the agent to check the specs it wrote.
 */

const STRIP_REQUEST_HEADERS = new Set([
	"host", "connection", "authorization", "x-api-key", "accept-encoding", "proxy-authorization",
]);

function json(res: http.ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}

function proxyModel(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
	const m = url.pathname.match(/^\/llm\/([^/]+)(\/.*)?$/);
	const provider = m ? providerByKey(m[1]) : undefined;
	if (!m || !provider) return json(res, 404, { error: "unknown provider" });

	let upstream: URL;
	try {
		upstream = new URL(provider.baseUrl);
	} catch {
		return json(res, 502, { error: "provider has no valid base URL" });
	}
	const base = upstreamBasePath(provider);
	const rest = m[2] ?? "/";
	if (!(base === "" || rest === base || rest.startsWith(`${base}/`))) {
		return json(res, 403, { error: "path is outside the provider's base path" });
	}

	const headers: Record<string, string | string[]> = {};
	for (const [k, v] of Object.entries(req.headers)) {
		if (v !== undefined && !STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers[k] = v;
	}
	headers.host = upstream.host;
	headers["accept-encoding"] = "identity";
	const key = provider.apiKey && provider.apiKey !== "none" ? provider.apiKey : "";
	if (key) {
		if (provider.kind === "anthropic") {
			headers["x-api-key"] = key;
			headers["anthropic-version"] ??= "2023-06-01";
		} else {
			headers.authorization = `Bearer ${key}`;
		}
	}

	const target = new URL(`${rest}${url.search}`, upstream.origin);
	const mod = target.protocol === "https:" ? https : http;
	const up = mod.request(target, { method: req.method, headers }, (r) => {
		res.writeHead(r.statusCode ?? 502, r.headers);
		r.pipe(res);
	});
	up.on("error", (err) => {
		log("warn", "llm.proxy.error", { provider: m[1], error: err.message });
		if (!res.headersSent) json(res, 502, { error: "the model endpoint is not reachable" });
		else res.destroy();
	});
	// Stop the upstream request when pi gives up (an abort mid-stream).
	res.on("close", () => up.destroy());
	req.pipe(up);
}

export function startInternalServer(): http.Server {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		if (url.pathname.startsWith("/llm/")) return proxyModel(req, res, url);
		if (req.method === "GET" && url.pathname === "/api/specs") return json(res, 200, { specs: listSpecs() });
		if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
		return json(res, 404, { error: "not_found" });
	});
	server.listen(config.internalPort, "127.0.0.1", () => {
		log("info", "internal.listen", { port: config.internalPort });
	});
	server.on("error", (err) => log("error", "internal.error", { error: err.message }));
	return server;
}
