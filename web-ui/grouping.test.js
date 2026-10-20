const test = require("node:test");
const assert = require("node:assert/strict");
const { groupFiles, assignSpec, requestsOf } = require("./grouping.js");

const ep = (m, p) => ({ m, p });
const petstore = { path: "openapi.yaml", title: "Petstore", endpoints: [ep("GET", "/pet/{petId}"), ep("POST", "/pet"), ep("GET", "/pet/findByStatus"), ep("GET", "/store/inventory")] };
const objects = { path: "specs/objects.yaml", title: "Objects", endpoints: [ep("GET", "/objects"), ep("GET", "/objects/{id}"), ep("DELETE", "/objects/{id}")] };
const file = (path, src) => ({ path, src });

test("requests are read without host variable and query", () => {
	assert.deepEqual(requestsOf("# c\nGET {{host}}/pet/findByStatus?status=available\nHTTP 200\n\nPOST {{host}}/pet\n"), [
		{ m: "GET", path: "/pet/findByStatus" },
		{ m: "POST", path: "/pet" },
	]);
});

test("a file goes to the spec its requests hit; variables match path params", () => {
	const f = file("tests/pet/crud.hurl", "POST {{host}}/pet\nHTTP 200\n\nGET {{host}}/pet/{{pet_id}}\nHTTP 200\n");
	assert.equal(assignSpec(f, [objects, petstore], ""), "openapi.yaml");
	assert.equal(assignSpec(file("tests/o.hurl", "GET {{host}}/objects/abc\nHTTP 200"), [objects, petstore], ""), "specs/objects.yaml");
});

test("method must match, absolute urls and unknown paths are unassigned", () => {
	assert.equal(assignSpec(file("a.hurl", "DELETE {{host}}/pet/1\n"), [petstore], ""), "");
	assert.equal(assignSpec(file("a.hurl", "GET http://localhost:9/x\n"), [petstore], ""), "");
	assert.equal(assignSpec(file("a.hurl", "GET {{host}}/nope\n"), [petstore, objects], ""), "");
});

test("the most matching requests win; a tie goes to the preferred spec", () => {
	const both = { path: "specs/both.yaml", title: "Both", endpoints: [ep("GET", "/pet/{petId}"), ep("GET", "/objects")] };
	const src = "GET {{host}}/pet/1\n\nGET {{host}}/objects\n\nGET {{host}}/objects\n";
	assert.equal(assignSpec(file("a.hurl", src), [petstore, both], ""), "specs/both.yaml");
	const tie = "GET {{host}}/pet/1\n";
	assert.equal(assignSpec(file("a.hurl", tie), [petstore, both], "specs/both.yaml"), "specs/both.yaml");
	assert.equal(assignSpec(file("a.hurl", tie), [petstore, both], ""), "openapi.yaml");
});

test("a '# spec:' comment overrides inference; unknown specs are ignored", () => {
	assert.equal(assignSpec(file("a.hurl", "# spec: specs/objects.yaml\nGET {{host}}/pet/1\n"), [petstore, objects], ""), "specs/objects.yaml");
	assert.equal(assignSpec(file("a.hurl", "# spec: specs/gone.yaml\nGET {{host}}/pet/1\n"), [petstore, objects], ""), "openapi.yaml");
});

test("specs with errors never receive files", () => {
	const broken = { path: "specs/b.yaml", title: "B", error: "x", endpoints: [] };
	assert.equal(assignSpec(file("a.hurl", "GET {{host}}/pet/1\n"), [broken, petstore], ""), "openapi.yaml");
});

test("groups: preferred spec first, unassigned last, top-level files, then folders", () => {
	const files = [
		file("tests/zeta/x.hurl", "GET {{host}}/objects\n"),
		file("tests/pet/b.hurl", "GET {{host}}/pet/1\n"),
		file("tests/auth/login.hurl", "POST {{host}}/auth/login\n"),
		file("tests/pet/a.hurl", "POST {{host}}/pet\n"),
		file("tests/other.hurl", "GET http://example.com\n"),
	];
	const g = groupFiles(files, [petstore, objects], "specs/objects.yaml");
	assert.deepEqual(g.map((x) => x.title || "(unassigned)"), ["Objects", "Petstore", "(unassigned)"]);
	assert.deepEqual(g[1].files.map((f) => f.path), ["tests/pet/a.hurl", "tests/pet/b.hurl"]);
	assert.deepEqual(g[2].files.map((f) => f.path), ["tests/other.hurl", "tests/auth/login.hurl"]);
	assert.equal(g[2].specPath, "");
	assert.equal(g[1].files[0].dir, "pet");
	assert.equal(g[2].files[0].dir, ".");
});

test("without specs everything is one unassigned group", () => {
	const g = groupFiles([file("tests/a.hurl", "GET {{host}}/x\n")], [], "");
	assert.equal(g.length, 1);
	assert.equal(g[0].specPath, "");
});
