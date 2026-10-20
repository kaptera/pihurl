import test from "node:test";
import assert from "node:assert/strict";

delete process.env.PIHURL_TOKEN;
process.env.PIHURL_ALLOWED_HOSTS = "Pihurl.LAN";
const sec = await import("../dist/security.js");

const g = (method, path, headers = {}) => sec.guard({ method, path, headers });

test("without a token only the known host names are answered", () => {
	assert.equal(sec.authEnabled(), false);
	for (const h of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "host.docker.internal:3000", "pihurl.lan", "PIHURL.LAN:8080", "localhost"]) {
		assert.equal(g("GET", "/api/specs", { host: h }).ok, true, h);
	}
	for (const h of ["evil.example:3000", "127.0.0.1.evil.example", "", "192.168.1.5:3000"]) {
		const r = g("GET", "/api/specs", { host: h });
		assert.equal(r.ok, false, h);
		assert.equal(r.status, 403);
		assert.equal(r.error, "host_not_allowed");
	}
});

test("cross-origin writes are refused even on localhost", () => {
	const host = "localhost:3000";
	assert.equal(g("POST", "/api/chat", { host, origin: "http://localhost:3000" }).ok, true);
	assert.equal(g("POST", "/api/chat", { host }).ok, true); // curl, scripts: no Origin
	assert.equal(g("POST", "/api/chat", { host, origin: "http://evil.example" }).error, "cross_origin");
	assert.equal(g("DELETE", "/api/specs", { host, origin: "http://localhost:4000" }).error, "cross_origin");
	assert.equal(g("GET", "/api/specs", { host, origin: "http://evil.example" }).ok, true);
});

test("no token means no sign-in at all", () => {
	assert.equal(sec.isAuthenticated({}), true);
	assert.equal(sec.tokenMatches("anything"), false);
});
