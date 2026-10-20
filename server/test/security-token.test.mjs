import test from "node:test";
import assert from "node:assert/strict";

// config.ts reads the token from the environment on import
process.env.PIHURL_TOKEN = "s3cret-token";
const sec = await import("../dist/security.js");

const g = (method, path, headers = {}) => sec.guard({ method, path, headers: { host: "example.test", ...headers } });

test("API and reports need the token, the UI's own files do not", () => {
	assert.equal(g("GET", "/api/specs").status, 401);
	assert.equal(g("GET", "/api/chat").status, 401);
	assert.equal(g("GET", "/report/1/html/index.html").status, 401);
	assert.equal(g("POST", "/api/run").status, 401);
	for (const p of ["/", "/app.js", "/style.css", "/markdown.js", "/health", "/api/session"]) assert.equal(g("GET", p).ok, true, p);
	assert.equal(g("POST", "/api/session").ok, true);
	assert.equal(g("POST", "/app.js").ok, false); // not a GET of a UI file
});

test("bearer token and session cookie are accepted, others are not", () => {
	assert.equal(g("GET", "/api/specs", { authorization: "Bearer s3cret-token" }).ok, true);
	assert.equal(g("GET", "/api/specs", { authorization: "bearer s3cret-token" }).ok, true);
	assert.equal(g("GET", "/api/specs", { authorization: "Bearer nope" }).ok, false);
	assert.equal(g("GET", "/api/specs", { authorization: "Basic s3cret-token" }).ok, false);

	const cookie = sec.sessionCookie(false);
	const pair = cookie.split(";")[0];
	assert.match(cookie, /HttpOnly/);
	assert.match(cookie, /SameSite=Strict/);
	assert.ok(!cookie.includes("s3cret-token"), "the cookie must not contain the token");
	assert.equal(g("GET", "/api/specs", { cookie: `a=b; ${pair}; c=d` }).ok, true);
	assert.equal(g("GET", "/api/specs", { cookie: "pihurl_session=deadbeef" }).ok, false);
	assert.match(sec.sessionCookie(true), /; Secure$/);
});

test("any host name is fine once a token is required; cross-origin writes are not", () => {
	assert.equal(g("GET", "/", { host: "pihurl.example.com" }).ok, true);
	const auth = { authorization: "Bearer s3cret-token" };
	assert.equal(g("POST", "/api/run", { ...auth, origin: "https://example.test" }).ok, true);
	assert.equal(g("POST", "/api/run", { ...auth, origin: "https://evil.test" }).status, 403);
	assert.equal(g("POST", "/api/run", { ...auth, origin: "null" }).status, 403);
	assert.equal(g("GET", "/api/specs", { ...auth, origin: "https://evil.test" }).ok, true); // reads are not writes
});

test("tokenMatches is exact", () => {
	assert.equal(sec.tokenMatches("s3cret-token"), true);
	assert.equal(sec.tokenMatches("s3cret-token "), false);
	assert.equal(sec.tokenMatches(""), false);
});

test("ten failed sign-ins lock an address for a while, then it recovers", () => {
	const t0 = 1_000_000;
	for (let i = 0; i < 9; i++) sec.recordLoginFailure("1.2.3.4", t0 + i);
	assert.equal(sec.loginAllowed("1.2.3.4", t0 + 10), true);
	sec.recordLoginFailure("1.2.3.4", t0 + 11);
	assert.equal(sec.loginAllowed("1.2.3.4", t0 + 12), false);
	assert.equal(sec.loginAllowed("5.6.7.8", t0 + 12), true); // per address
	assert.equal(sec.loginAllowed("1.2.3.4", t0 + 5 * 60_000 + 100), true); // window over
	sec.recordLoginFailure("9.9.9.9", t0);
	sec.clearLoginFailures("9.9.9.9");
	assert.equal(sec.loginAllowed("9.9.9.9", t0), true);
});
