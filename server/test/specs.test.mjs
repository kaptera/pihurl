import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config.ts reads its paths from the environment on import.
const root = mkdtempSync(join(tmpdir(), "pihurl-specs-"));
process.env.PIHURL_STATE = root;
process.env.WORKSPACE = join(root, "ws");
mkdirSync(process.env.WORKSPACE, { recursive: true });
const { parseSpec, saveSpec, listSpecs, deleteSpec, specFileName } = await import("../dist/specs.js");

const OAS3 = `
openapi: 3.0.3
info: { title: Objects API, version: "1.2" }
servers:
  - url: "{scheme}://api.example.com/v1/"
    variables: { scheme: { default: https } }
security: [ { key: [] } ]
paths:
  /objects:
    parameters: [ { $ref: "#/components/parameters/Limit" } ]
    get: { summary: List, tags: [objects], parameters: [ { name: q, in: query } ], responses: { "200": { description: ok } } }
    post: { operationId: createObject, security: [], responses: { "201": { description: made }, "422": { description: bad } } }
  /objects/{id}:
    delete: { tags: [objects], responses: { "200": { description: ok }, default: { description: err } } }
components:
  parameters:
    Limit: { name: limit, in: query }
`;

test("parses an OpenAPI 3 document", () => {
	const s = parseSpec(OAS3);
	assert.equal(s.title, "Objects API");
	assert.equal(s.version, "1.2");
	assert.equal(s.server, "https://api.example.com/v1");
	assert.deepEqual(s.endpoints.map((e) => `${e.m} ${e.p}`), ["GET /objects", "POST /objects", "DELETE /objects/{id}"]);
	const list = s.endpoints[0];
	assert.deepEqual(list.params, ["limit:query", "q:query"]); // path-level $ref + operation parameter
	assert.equal(list.auth, true); // global security
	assert.equal(s.endpoints[1].auth, false); // security: [] opts out
	assert.equal(s.endpoints[1].sum, "createObject");
	assert.equal(s.endpoints[1].tag, "default");
	assert.deepEqual(s.endpoints[1].resp, ["201", "422"]);
});

test("parses Swagger 2 and JSON", () => {
	const s = parseSpec(JSON.stringify({ swagger: "2.0", info: { title: "httpbin", version: "0.9" }, host: "httpbin.org", schemes: ["https"], basePath: "/", paths: { "/get": { get: { summary: "x" } } } }));
	assert.equal(s.server, "https://httpbin.org");
	assert.equal(s.endpoints.length, 1);
});

test("a relative server url is not a usable host", () => {
	assert.equal(parseSpec("openapi: 3.0.0\nservers: [ { url: /api/v3 } ]\npaths: {}").server, "");
});

test("rejects documents that are not specs, with a readable reason", () => {
	assert.throws(() => parseSpec("a: [unclosed"), /not valid YAML/);
	assert.throws(() => parseSpec("- a\n- b"), /not a mapping/);
	assert.throws(() => parseSpec("info: { title: x }\npaths: {}"), /version field/);
	assert.throws(() => parseSpec("openapi: 3.0.0\ninfo: {}"), /"paths"/);
});

test("saves, lists (workspace root and specs/), reports broken files, deletes", () => {
	assert.equal(specFileName("../../My API (v2).yaml"), "My-API-v2-.yaml");
	assert.equal(specFileName("petstore"), "petstore.yaml");
	const path = saveSpec("objects.yaml", OAS3);
	assert.equal(path, "specs/objects.yaml");
	assert.throws(() => saveSpec("bad.yaml", "nope: 1"), /version field/);
	assert.equal(existsSync(join(process.env.WORKSPACE, "specs", "bad.yaml")), false);

	// what an agent leaves behind: a spec in the root and a broken one in specs/
	writeFileSync(join(process.env.WORKSPACE, "openapi.other.yaml"), OAS3.replace("Objects API", "Other"));
	writeFileSync(join(process.env.WORKSPACE, "specs", "broken.yaml"), "openapi: 3.0.0\n");
	writeFileSync(join(process.env.WORKSPACE, "notes.yaml"), "x: 1");
	const list = listSpecs();
	assert.deepEqual(list.map((s) => s.path).sort(), ["openapi.other.yaml", "specs/broken.yaml", "specs/objects.yaml"]);
	assert.match(list.find((s) => s.path === "specs/broken.yaml").error, /"paths"/);
	assert.equal(list.find((s) => s.path === "openapi.other.yaml").title, "Other");

	assert.equal(deleteSpec("../ws/../outside.yaml"), false);
	assert.equal(deleteSpec("notes.yaml"), false); // not a spec name
	assert.equal(deleteSpec("specs/objects.yaml"), true);
	assert.equal(deleteSpec("openapi.other.yaml"), true);
	assert.equal(deleteSpec("specs/objects.yaml"), false);
});

test("the skeleton in the openapi-spec skill is a valid spec", async () => {
	const { OPENAPI_SKILL_MD } = await import("../dist/defaults.js");
	const yaml = OPENAPI_SKILL_MD.match(/```yaml\n([\s\S]*?)```/)[1];
	const s = parseSpec(yaml);
	assert.equal(s.server, "https://api.example.com");
	assert.deepEqual(s.endpoints.map((e) => `${e.m} ${e.p}`), ["GET /objects", "POST /objects", "GET /objects/{id}"]);
});

test("seeding upgrades untouched defaults and keeps edited ones", async () => {
	const { seedDefaults, DEFAULT_AGENTS_MD } = await import("../dist/defaults.js");
	const { readFileSync, writeFileSync } = await import("node:fs");
	const agents = join(process.env.WORKSPACE, "AGENTS.md");
	seedDefaults();
	assert.equal(readFileSync(agents, "utf8"), DEFAULT_AGENTS_MD);
	assert.ok(existsSync(join(process.env.WORKSPACE, ".pi", "skills", "openapi-spec", "SKILL.md")));

	// an older shipped version (recorded hash) is replaced by the new default
	const rec = join(root, "defaults.json");
	writeFileSync(agents, "old default");
	const r = JSON.parse(readFileSync(rec, "utf8"));
	const { createHash } = await import("node:crypto");
	r.agents = createHash("sha256").update("old default").digest("hex").slice(0, 16);
	writeFileSync(rec, JSON.stringify(r));
	seedDefaults();
	assert.equal(readFileSync(agents, "utf8"), DEFAULT_AGENTS_MD);

	// the user's own text stays
	writeFileSync(agents, "my instructions");
	seedDefaults();
	assert.equal(readFileSync(agents, "utf8"), "my instructions");
});
