import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "pihurl-projects-"));
process.env.PIHURL_STATE = join(root, "state");
process.env.WORKSPACE = join(root, "ws");
delete process.env.PIHURL_AGENT_UID;
mkdirSync(process.env.PIHURL_STATE, { recursive: true });
mkdirSync(process.env.WORKSPACE, { recursive: true });

const projects = await import("../dist/projects.js");
const chats = await import("../dist/chats.js");
const specs = await import("../dist/specs.js");
const { seedDefaults } = await import("../dist/defaults.js");

const SPEC = (title) => `openapi: 3.0.0\ninfo: { title: ${title}, version: "1" }\npaths:\n  /a: { get: {} }\n`;

test("the default project is the workspace itself; others live under .projects", () => {
	const d = projects.defaultProject();
	assert.equal(d.id, "default");
	assert.equal(d.dir, process.env.WORKSPACE);
	assert.equal(d.stateDir, join(process.env.PIHURL_STATE, "projects", "default"));
	assert.equal(d.specsDir, join(d.dir, "specs"));
	assert.equal(d.reportDir, join(d.dir, "report"));
	assert.ok(d.internalUrl.endsWith("/p/default"));

	const p = projects.createProject("  My  Cool API! ");
	assert.equal(p.id, "my-cool-api");
	assert.equal(p.name, "My Cool API!");
	assert.equal(p.dir, join(process.env.WORKSPACE, ".projects", "my-cool-api"));
	assert.equal(p.stateDir, join(process.env.PIHURL_STATE, "projects", "my-cool-api"));
	assert.ok(existsSync(p.dir) && existsSync(p.stateDir));
	assert.deepEqual(projects.listProjects().map((x) => x.id), ["default", "my-cool-api"]);
});

test("ids are unique, never numeric, and validated", () => {
	assert.equal(projects.createProject("My Cool API!").id, "my-cool-api-2");
	assert.equal(projects.createProject("2024").id, "p-2024"); // a numeric id would look like a report run id
	assert.match(projects.createProject("???").id, /^p-project/);
	assert.throws(() => projects.createProject("   "), /needs a name/);
	assert.equal(projects.validProjectId("ok-1"), true);
	for (const bad of ["", "Bad", "../x", "a/b", "123", "-x", "x".repeat(41)]) assert.equal(projects.validProjectId(bad), false, bad);
	assert.equal(projects.getProject("nope"), undefined);
	assert.equal(projects.getProject("").id, "default"); // no project named: the default one
});

test("specs of one project are not visible in another", () => {
	const a = projects.getProject("my-cool-api");
	const b = projects.createProject("Other");
	specs.saveSpec(a, "a.yaml", SPEC("A"));
	specs.saveSpec(b, "b.yaml", SPEC("B"));
	assert.deepEqual(specs.listSpecs(a).map((s) => s.title), ["A"]);
	assert.deepEqual(specs.listSpecs(b).map((s) => s.title), ["B"]);
	assert.deepEqual(specs.listSpecs(projects.defaultProject()), []);
	// the default project does not list the other projects' directories as specs
	writeFileSync(join(projects.defaultProject().dir, "openapi.yaml"), SPEC("D"));
	assert.deepEqual(specs.listSpecs(projects.defaultProject()).map((s) => s.title), ["D"]);
});

test("every project is seeded with its own agent files and defaults record", () => {
	const p = projects.getProject("other");
	seedDefaults(p);
	assert.ok(readFileSync(p.instructionsPath, "utf8").includes("pihurl agent instructions"));
	assert.ok(existsSync(join(p.agentDir, "skills", "openapi-spec", "SKILL.md")));
	assert.ok(existsSync(p.defaultsPath));
	assert.notEqual(p.defaultsPath, projects.defaultProject().defaultsPath);
});

test("chats are listed per project, titled by their first prompt, and deleted with their session", () => {
	const a = projects.getProject("my-cool-api");
	const b = projects.getProject("other");
	const id = chats.newChatId();
	assert.equal(chats.validChatId(id), true);
	assert.equal(chats.validChatId("chat-../../x"), false);
	assert.equal(chats.validChatId("whatever"), false);

	assert.deepEqual(chats.listChats(a), []); // nothing is listed before something is written
	chats.touchChat(a, id, "  Write   tests for\n/users  ");
	assert.deepEqual(chats.listChats(a).map((c) => c.title), ["Write tests for /users"]);
	assert.deepEqual(chats.listChats(b), []);
	chats.touchChat(a, id, "a different text"); // the title stays
	assert.equal(chats.listChats(a)[0].title, "Write tests for /users");

	assert.equal(chats.renameChat(a, id, "Renamed"), true);
	assert.equal(chats.renameChat(b, id, "Nope"), false); // not that project's chat
	assert.equal(chats.listChats(a)[0].title, "Renamed");

	// a session pi wrote that the index does not know is imported, titled from its first user message
	const other = chats.newChatId();
	mkdirSync(a.sessionsDir, { recursive: true });
	const file = join(a.sessionsDir, `2026-10-20T00-00-00-000Z_${other}.jsonl`);
	writeFileSync(file, `{"type":"session"}\n${JSON.stringify({ type: "message", message: { role: "user", content: "imported hello" } })}\n`);
	assert.deepEqual(chats.listChats(a).map((c) => c.title).sort(), ["Renamed", "imported hello"]);

	assert.equal(chats.deleteChat(a, other), true);
	assert.equal(existsSync(file), false);
	assert.equal(chats.deleteChat(a, other), false);
	assert.equal(chats.deleteChat(a, id), true);
	assert.deepEqual(chats.listChats(a), []);
});

test("rename and delete; the default project cannot be deleted", () => {
	assert.equal(projects.renameProject("other", "  Renamed  Project "), true);
	assert.equal(projects.getProject("other").name, "Renamed Project");
	assert.equal(projects.renameProject("nope", "x"), false);
	assert.equal(projects.renameProject("other", "   "), false);

	const p = projects.getProject("other");
	assert.equal(projects.deleteProject("default"), false);
	assert.equal(projects.deleteProject("other"), true);
	assert.equal(existsSync(p.dir), false);
	assert.equal(existsSync(p.stateDir), false);
	assert.equal(projects.getProject("other"), undefined);
	assert.equal(projects.deleteProject("other"), false);
	assert.ok(existsSync(projects.defaultProject().dir)); // untouched
});

test("a project that is not in the registry (a hand-edited file) is ignored", () => {
	writeFileSync(join(process.env.PIHURL_STATE, "projects.json"), JSON.stringify({ projects: [{ id: "../evil", name: "x" }, { id: "fine", name: "Fine" }] }));
	assert.deepEqual(projects.listProjects().map((p) => p.id), ["default", "fine"]);
});
