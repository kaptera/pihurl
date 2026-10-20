import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "pihurl-boot-"));
const ws = join(root, "ws");
const state = join(root, "state");
process.env.PIHURL_STATE = state;
process.env.WORKSPACE = ws;
delete process.env.PIHURL_AGENT_UID;

// an install from before the split: everything in the workspace
mkdirSync(join(ws, "logs"), { recursive: true });
mkdirSync(join(ws, "tests"), { recursive: true });
writeFileSync(join(ws, "providers.json"), '[{"id":"p"}]');
writeFileSync(join(ws, "chats.json"), '{"current":"c"}');
writeFileSync(join(ws, "logs", "pihurl.log"), "old log\n");
writeFileSync(join(ws, "tests", "a.hurl"), "GET {{host}}/x\n");

const { bootLayout } = await import("../dist/boot.js");

test("state files move out of the workspace once; the agent's files stay", () => {
	bootLayout();
	assert.equal(readFileSync(join(state, "providers.json"), "utf8"), '[{"id":"p"}]');
	assert.equal(readFileSync(join(state, "projects", "default", "chats.json"), "utf8"), '{"current":"c"}');
	assert.equal(readFileSync(join(state, "logs", "pihurl.log"), "utf8").startsWith("old log"), true);
	for (const n of ["providers.json", "chats.json", "logs"]) assert.equal(existsSync(join(ws, n)), false, n);
	assert.equal(existsSync(join(state, "chats.json")), false); // per-project files live under projects/default
	assert.equal(existsSync(join(ws, "tests", "a.hurl")), true);

	// a second start changes nothing, and never overwrites newer state
	writeFileSync(join(state, "providers.json"), '[{"id":"newer"}]');
	writeFileSync(join(ws, "providers.json"), '[{"id":"stale copy"}]');
	bootLayout();
	assert.equal(readFileSync(join(state, "providers.json"), "utf8"), '[{"id":"newer"}]');
});

test("an install from before projects (state in the state root) moves its per-project files", async () => {
	const root2 = mkdtempSync(join(tmpdir(), "pihurl-boot2-"));
	process.env.PIHURL_STATE = join(root2, "state");
	process.env.WORKSPACE = join(root2, "ws");
	mkdirSync(process.env.PIHURL_STATE, { recursive: true });
	mkdirSync(process.env.WORKSPACE, { recursive: true });
	for (const [n, c] of [["providers.json", "[]"], ["chats.json", '{"chats":[]}'], ["hosts.json", "[]"], ["defaults.json", "{}"]]) {
		writeFileSync(join(process.env.PIHURL_STATE, n), c);
	}
	// config.ts reads the environment once, so a second layout needs a fresh process
	const { spawnSync } = await import("node:child_process");
	const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
		const { bootLayout } = await import(${JSON.stringify(new URL("../dist/boot.js", import.meta.url).href)});
		bootLayout();`], { env: { ...process.env, PIHURL_AGENT_UID: "" }, encoding: "utf8" });
	assert.equal(r.status, 0, r.stderr);
	const st = process.env.PIHURL_STATE;
	assert.equal(existsSync(join(st, "providers.json")), true);
	for (const n of ["chats.json", "hosts.json", "defaults.json"]) {
		assert.equal(existsSync(join(st, n)), false, `${n} left in the state root`);
		assert.equal(existsSync(join(st, "projects", "default", n)), true, n);
	}
});
