import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/**
 * Who may talk to the server.
 *
 * - With PIHURL_TOKEN set, every API and report request needs the token: as `Authorization:
 *   Bearer <token>` (scripts) or as the session cookie that POST /api/session hands out after a
 *   correct token (the browser). The cookie holds an HMAC derived from the token, not the token.
 *   The web UI's own files are public so that the login page can load; they contain no secrets.
 * - Without a token, only requests for the host names in `allowedHosts` are answered. A web page on
 *   another site could otherwise drive a local pihurl through DNS rebinding.
 * - Requests that change something are refused when their Origin is another site (CSRF).
 */

export const COOKIE = "pihurl_session";
const COOKIE_MAX_AGE = 30 * 24 * 3600;

type Headers = Record<string, string | string[] | undefined>;

export function authEnabled(): boolean {
	return config.token !== "";
}

const digest = (s: string): Buffer => createHash("sha256").update(s).digest();

function safeEqual(a: string, b: string): boolean {
	return timingSafeEqual(digest(a), digest(b));
}

/** The value of the session cookie: stable for a token, useless without it. */
function sessionValue(): string {
	return createHmac("sha256", config.token).update("pihurl-session-v1").digest("hex");
}

export function tokenMatches(candidate: string): boolean {
	return authEnabled() && safeEqual(candidate, config.token);
}

function header(h: Headers, name: string): string {
	const v = h[name];
	return (Array.isArray(v) ? v[0] : v) ?? "";
}

function cookieValue(h: Headers, name: string): string | undefined {
	for (const part of header(h, "cookie").split(";")) {
		const i = part.indexOf("=");
		if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
	}
	return undefined;
}

export function isAuthenticated(h: Headers): boolean {
	if (!authEnabled()) return true;
	const bearer = header(h, "authorization").match(/^Bearer\s+(.+)$/i)?.[1];
	if (bearer && safeEqual(bearer.trim(), config.token)) return true;
	const cookie = cookieValue(h, COOKIE);
	return !!cookie && safeEqual(cookie, sessionValue());
}

export function sessionCookie(secure: boolean): string {
	return `${COOKIE}=${sessionValue()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function clearedCookie(): string {
	return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// ---- login attempts: 10 failures per address in 5 minutes ------------------------------------

const WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 10;
const failures = new Map<string, { n: number; since: number }>();

export function loginAllowed(ip: string, now = Date.now()): boolean {
	const f = failures.get(ip);
	if (!f) return true;
	if (now - f.since > WINDOW_MS) {
		failures.delete(ip);
		return true;
	}
	return f.n < MAX_FAILURES;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
	const f = failures.get(ip);
	if (!f || now - f.since > WINDOW_MS) failures.set(ip, { n: 1, since: now });
	else f.n++;
}

export function clearLoginFailures(ip: string): void {
	failures.delete(ip);
}

// ---- the guard ---------------------------------------------------------------------------------

export interface GuardInput {
	method: string;
	path: string;
	headers: Headers;
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string; message: string };

function hostName(hostHeader: string): string {
	const h = hostHeader.toLowerCase();
	return h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1) : h.replace(/:\d+$/, "");
}

/** Anything that is not data: the UI's own files and the liveness probe. */
function isPublic(i: GuardInput): boolean {
	if (i.path === "/health" || i.path === "/api/session") return true;
	return (i.method === "GET" || i.method === "HEAD") && !i.path.startsWith("/api/") && !i.path.startsWith("/report/");
}

export function guard(i: GuardInput): GuardResult {
	const host = header(i.headers, "host");

	if (!authEnabled() && !config.allowedHosts.includes(hostName(host))) {
		return {
			ok: false,
			status: 403,
			error: "host_not_allowed",
			message: `pihurl without PIHURL_TOKEN only answers to ${config.allowedHosts.join(", ")}. Set PIHURL_TOKEN, or add this name to PIHURL_ALLOWED_HOSTS.`,
		};
	}

	const origin = header(i.headers, "origin");
	if (origin && i.method !== "GET" && i.method !== "HEAD") {
		let same = false;
		try {
			same = new URL(origin).host.toLowerCase() === host.toLowerCase();
		} catch {
			/* "null" or garbage */
		}
		if (!same) return { ok: false, status: 403, error: "cross_origin", message: "requests from another origin are not accepted" };
	}

	if (authEnabled() && !isPublic(i) && !isAuthenticated(i.headers)) {
		return { ok: false, status: 401, error: "unauthorized", message: "sign in with the access token" };
	}
	return { ok: true };
}
