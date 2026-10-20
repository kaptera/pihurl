import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeAgentFile } from "./agent.js";
import { loadTemplates, saveTemplates, type PromptTemplate } from "./config.js";
import type { Project } from "./projects.js";

/**
 * First-boot content for the workspace volume: the agent's standing
 * instructions (AGENTS.md), a Hurl syntax skill and the prompt templates shown in
 * the UI. Existing files are never overwritten — the user edits them in the UI.
 */

export const DEFAULT_AGENTS_MD = `# pihurl agent instructions

You write and maintain **Hurl** API tests for the services described by the specs
in this folder, and you write the specs when there are none. The pihurl backend runs
the tests and shows the report to the user; your job is to keep the files correct.

## Layout

- \`specs/<api-name>.yaml\` — the API specs (OpenAPI 3 or Swagger 2). Older ones may sit
  in this folder as \`openapi*.yaml\`. The Spec tab of the UI lists all of them.
- \`tests/<tag>/<resource>.hurl\` — one file per resource (tag = first OpenAPI tag).
  Use lowercase names with dashes. Several requests per file are fine.
- \`hurl.env\` — variables for the current target, written by the UI (\`host=...\`).
- Everything you write stays inside this folder. Do not touch anything else.

## Specs

- Read the spec before writing tests, and never edit one the user uploaded unless
  asked. The prompt names the spec to use (\`specs/x.yaml\`); if it does not and there
  is exactly one spec, use that, otherwise ask which.
- If the user wants tests for an API that has no spec, create one yourself: read the
  \`openapi-spec\` skill and write \`specs/<api-name>.yaml\`. The UI shows new specs on the
  Spec tab when you finish your turn. Say in your answer what is verified against the
  real API and what is inferred.
- After writing a spec, check that it parses: \`curl -s "$PIHURL_INTERNAL_URL/api/specs"\`
  lists every spec with its endpoints, or an \`error\` that says what is wrong.

## Writing tests

- Always use \`{{host}}\` as the base URL: \`GET {{host}}/users/{{id}}\`. Never hardcode a host.
- Cover every operation: the success path first, then negative cases (missing
  or invalid fields, unknown ids, missing auth) when asked.
- Assert the status (\`HTTP 200\`) and the parts of the body the spec promises:
  \`jsonpath "$.id" exists\`, types, enums, required fields. Do not assert exact
  values of server-generated fields (ids, timestamps).
- Chain CRUD operations in one file with \`[Captures]\`: create, read, update,
  delete, then check that a read returns 404.
- pihurl groups test files by the spec whose endpoints they call (it works that out
  from the requests). To pin a file to a spec, put \`# spec: specs/x.yaml\` in its first
  lines.
- Make test data unique with \`{{newUuid}}\`, so reruns do not collide.
- Authentication: capture the token from a login call (\`token: jsonpath "$.access_token"\`)
  and send \`Authorization: Bearer {{token}}\`. Never write real secrets into files; use a
  variable and tell the user to pass it.
- Only talk to the host from \`hurl.env\`. If the file is missing, stop and ask the
  user to set the target host on the Tests tab. Do not invent a host, and do not
  start mock servers: tests must run against the real target.
- Look at the real API when the spec is unclear, but only with GET requests;
  anything that creates, changes or deletes data belongs in a test file.
- Other folders and old files in this directory are not part of the task. Read
  existing tests only when you are asked to change them.

Read the \`hurl-syntax\` skill before writing the first test and whenever hurl
reports a parse error. Do not guess syntax: use the constructs listed there.

## Verifying

After every change run the files you touched and fix failures until they pass:

\`\`\`bash
hurl --test --variables-file hurl.env tests/users/users.hurl
\`\`\`

If a test keeps failing and the response contradicts the spec, the API is
probably wrong, not the test: leave the assertion in place, and say so in your
final answer with the request, the expected and the actual response.

Finish with a short summary: files created or changed, what is covered, what
still fails and why.
`;

export const HURL_SKILL_MD = `---
name: hurl-syntax
description: Hurl file syntax reference - requests, headers, bodies, captures, asserts, filters, variables. Use when writing or fixing .hurl API test files.
---

# Hurl syntax

A file is a list of entries. Each entry is a request followed by an optional
expected response.

\`\`\`hurl
# comment
POST {{host}}/users
Content-Type: application/json
{
  "name": "user-{{newUuid}}",
  "email": "{{newUuid}}@example.com"
}
HTTP 201
[Captures]
user_id: jsonpath "$.id"
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.name" startsWith "user-"
jsonpath "$.tags" count == 0
duration < 2000

GET {{host}}/users/{{user_id}}
Authorization: Bearer {{token}}
[Query]
expand: true
HTTP 200
[Asserts]
jsonpath "$.id" == "{{user_id}}"
jsonpath "$.email" matches /^[^@]+@example\\.com$/
\`\`\`

## Requests

- Method and URL on one line. Headers follow, one per line, then the body.
- Request sections (before the body, after headers): \`[Query]\`, \`[Form]\`,
  \`[MultipartForm]\`, \`[BasicAuth]\`, \`[Cookies]\`, \`[Options]\`.
- Order inside one entry: request line, headers, request sections, then the body. A
  header after a \`[Query]\` or \`[BasicAuth]\` line is a parse error.
- JSON bodies are written inline; multi-line text and XML bodies go between
  \`"""\` lines. \`file,payload.json;\` sends a file from the folder.

## Response

- \`HTTP 200\` checks the status (\`HTTP *\` accepts any).
- \`[Captures]\` stores values in variables for later entries:
  \`name: jsonpath "$.id"\`, \`name: header "Location"\`, \`name: cookie "session"\`,
  \`name: regex "id=(\\\\d+)"\`, \`name: body\`.
- \`[Asserts]\` holds one query + predicate per line.

## Queries

\`status\`, \`header "Name"\`, \`cookie "name"\`, \`body\`, \`bytes\`, \`jsonpath "$.a[0].b"\`,
\`xpath "string(//title)"\`, \`regex "..."\`, \`duration\`, \`url\`, \`sha256\`.

## Predicates

\`==\`, \`!=\`, \`>\`, \`>=\`, \`<\`, \`<=\`, \`startsWith\`, \`endsWith\`, \`contains\`,
\`matches /regex/\`, \`exists\`, \`isString\`, \`isInteger\`, \`isFloat\`, \`isBoolean\`,
\`isCollection\`, \`isDate\`, \`isIsoDate\`, \`isUuid\`, \`isEmpty\`.
Prefix with \`not\` to negate (\`not exists\`, \`not contains "x"\`).
There is no \`all\`, \`none\`, \`list\`, \`unique\`, \`equals\` or \`includes\` (deprecated).

## Filters

Chain after a query: \`jsonpath "$.items" count == 3\`,
\`header "Set-Cookie" regex "id=(.*?);" == "abc"\`,
\`jsonpath "$.name" toLower == "bob"\`, \`toInt\`, \`toFloat\`, \`replace "a" "b"\`,
\`split ","\`, \`nth 0\`, \`first\`, \`last\`, \`jsonpath "$.d" toDate "%Y-%m-%d"\`.

## Variables and functions

- \`{{name}}\` is replaced from captures and \`--variable\` / \`--variables-file\`.
- Built in: \`{{newUuid}}\`, \`{{newDate}}\`.
- Undefined variables are an error; capture before you use.

## Common recipes

- Bearer login: capture \`token: jsonpath "$.access_token"\`, then send
  \`Authorization: Bearer {{token}}\`.
- Cookie session: hurl keeps cookies between entries of one file automatically.
- Expected failure: \`HTTP 404\` (or 400/401/422) and assert the error body.
- Optional field: \`jsonpath "$.nickname" exists\` only when the spec marks it required.
- Query parameters go in a \`[Query]\` section, one per line, repeat the key for
  several values. Do not write them as header-style lines:

  \`\`\`hurl
  GET {{host}}/pet/findByTags
  [Query]
  tags: a
  tags: b
  HTTP 200
  \`\`\`

- Array responses (this exact set of checks was run against a real API):

  \`\`\`hurl
  HTTP 200
  [Asserts]
  jsonpath "$" isCollection
  jsonpath "$" count > 0
  jsonpath "$[0].id" isInteger
  jsonpath "$[*].status" contains "available"
  jsonpath "$[?(@.status != 'available')]" not exists
  \`\`\`

  "Every item has status X" is \`jsonpath "$[?(@.status != 'X')]" not exists\`. A
  filter with no match yields no value, so use \`not exists\`, never \`count == 0\`,
  on it. \`jsonpath "$[*].id"\` returns a plain value (not a list) when only one
  item matches, so count the array itself: \`jsonpath "$" count == 3\`.
- A server error that contradicts the spec (a 500 where the spec says 200/400) is
  an API bug: assert what the spec promises, let the test fail, and report it.

- OData services: query options go in \`[Query]\`, keys in parentheses,
  and \`@\` names need the bracket form of jsonpath. All of this was run against a real service:

  \`\`\`hurl
  GET {{host}}/Books
  [Query]
  $filter: genre eq 'Novel'
  $orderby: title
  $count: true
  HTTP 200
  [Asserts]
  jsonpath "$['@odata.count']" >= 2
  jsonpath "$.value[?(@.genre != 'Novel')]" not exists

  POST {{host}}/Books
  Content-Type: application/json
  [BasicAuth]
  alice: alice
  {"title": "t-{{newUuid}}"}
  HTTP 201
  [Captures]
  id: jsonpath "$.ID"

  GET {{host}}/Books({{id}})
  HTTP 200

  GET {{host}}/stockOf(book={{id}})
  HTTP 200
  \`\`\`

## Syntax that does not exist

Do not write \`Headers:\`, \`Body:\`, \`Response:\`, \`Capture:\`, \`Assert:\`, \`Json:\`,
\`[Vars]\`, \`[Headers]\` or \`[Body]\` blocks. Headers are plain \`Name: value\` lines under
the request line; the response is \`HTTP <status>\` followed by \`[Captures]\` and
\`[Asserts]\`.
`;

export const OPENAPI_SKILL_MD = `---
name: openapi-spec
description: Create an OpenAPI 3 spec for an API that has none, from its docs or by probing it. Use when the user asks for a spec or wants tests for an API that has no spec file.
---

# Writing an OpenAPI spec

The spec is what pihurl lists on the Spec tab and what you test against, so it must
parse and must describe the real API, not a guess.

## 1. Look for an existing one

Many APIs publish a spec. Try, with \`curl -s -m 20 -o /tmp/s.json -w '%{http_code}\\n' URL\`, the
paths \`/openapi.json\`, \`/openapi.yaml\`, \`/swagger.json\`, \`/v3/api-docs\`, \`/api-docs\`,
\`/docs/openapi.json\` on the API host and on its docs site. If you get a spec, copy it to
\`specs/<api-name>.yaml\` (or \`.json\`) unchanged and go to step 4.

## 2. Otherwise gather facts

- Read the docs the user pointed at (\`curl -s URL\`), the endpoint list, auth, examples.
- Probe the live API with **GET (and OPTIONS) only**, against the host in \`hurl.env\`:
  status codes, \`Content-Type\`, the JSON shape of real responses. Never use POST, PUT,
  PATCH or DELETE to explore; take write operations from the docs.
- Do not invent operations. If the docs do not mention an operation and you did not see
  it, leave it out.

## 3. Write \`specs/<api-name>.yaml\`

Lowercase name with dashes. OpenAPI 3.0.3, with an absolute \`servers\` URL (the real
base URL of the API) so the UI can offer it as the target host:

\`\`\`yaml
openapi: 3.0.3
info:
  title: Objects API
  version: "1.0"
  description: Written from https://example.com/docs. Operations marked x-unverified were not called.
servers:
  - url: https://api.example.com
tags:
  - name: objects
paths:
  /objects:
    get:
      tags: [objects]
      summary: List objects
      parameters:
        - { name: limit, in: query, required: false, schema: { type: integer } }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/Object" }
    post:
      tags: [objects]
      summary: Create an object
      x-unverified: true
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/NewObject" }
      responses:
        "200": { description: Created }
        "400": { description: Invalid input }
  /objects/{id}:
    get:
      tags: [objects]
      summary: Get one object
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "200": { description: OK }
        "404": { description: Not found }
components:
  schemas:
    NewObject:
      type: object
      required: [name]
      properties:
        name: { type: string }
    Object:
      allOf:
        - $ref: "#/components/schemas/NewObject"
        - type: object
          properties:
            id: { type: string }
\`\`\`

Rules that keep it valid and honest:

- Every \`{param}\` in a path needs a path parameter with \`required: true\`.
- Quote status codes (\`"200"\`) and any string containing \`:\` or starting with \`{\`, \`*\`, \`&\`.
- List the status codes you actually saw, including errors (400, 401, 404, 422).
- Describe schemas only as precisely as you know them: required fields, types and enums
  you saw, nothing more. Mark operations you could not try with \`x-unverified: true\`.
- Authentication: add \`components.securitySchemes\` (\`type: http, scheme: bearer\` or
  \`type: apiKey, in: header, name: X-Api-Key\`) and \`security\` where it applies.

## 4. Check that it parses

\`\`\`bash
curl -s "$PIHURL_INTERNAL_URL/api/specs" | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8")).specs.find(x=>x.path==="specs/NAME.yaml");console.log(s?{error:s.error,endpoints:s.endpoints.length,server:s.server}:"not listed")'
\`\`\`

Replace \`NAME\`. \`error\` explains what is wrong (YAML syntax, missing \`paths\`, ...); fix it and
check again. \`endpoints\` must match the number of operations you wrote.

## 5. Report

Say which file you wrote, how many operations it has, which were verified against the
live API and which come only from the docs. The UI shows the new spec on the Spec tab
when you finish your turn.
`;

const TEMPLATES: PromptTemplate[] = [
	{
		id: "gen-tests",
		name: "Generate CRUD tests",
		desc: "Write tests for one endpoint or resource",
		builtin: true,
		body: `Read {{spec.path}} ({{spec.title}}) and write Hurl tests for {{endpoint}} in tests/.

- Follow AGENTS.md. Use {{host}} as the base URL.
- Chain create, read, update and delete in one file with [Captures] when the resource supports it.
- Run the new files with hurl, and fix them until they pass.
- Finish with a short summary of the files and what they cover.`,
	},
	{
		id: "add-negative",
		name: "Add negative cases",
		desc: "Auth, validation and unknown-id cases",
		builtin: true,
		body: `Add negative test cases for {{endpoint}}.

Cover: missing or invalid required fields, wrong types, unknown ids (404), missing or invalid auth (401/403) and duplicates where the spec allows them. Put them next to the existing tests for the same resource (see the existing tests: {{existing_tests}}). Assert the status and the error body shape from the spec. Run them with hurl and fix until they pass.`,
	},
	{
		id: "fix-failures",
		name: "Fix failing tests",
		desc: "Analyse the latest run and fix the tests",
		builtin: true,
		body: `These tests failed in the latest run:

{{last_report}}

For each failure decide whether the test or the API is wrong. Fix the tests that are wrong (re-run them with hurl). If the response contradicts the spec, keep the assertion and report it as a probable API bug with request, expected and actual response.`,
	},
	{
		id: "create-spec",
		name: "Create a spec",
		desc: "Write an OpenAPI spec for an API that has none",
		builtin: true,
		body: `Create an OpenAPI spec for the API at {{base_url}}. Documentation: <paste a link or describe the API here>.

Follow the openapi-spec skill: look for a published spec first, otherwise read the docs and probe the API with GET requests only. Save it as specs/<api-name>.yaml, check that it parses, and tell me what is verified and what is inferred.`,
	},
	{
		id: "review-coverage",
		name: "Review coverage",
		desc: "Find endpoints without tests",
		builtin: true,
		body: `Compare {{spec.path}} with the tests in tests/ (currently: {{existing_tests}}).

List every operation without a test, then every operation that only has a happy-path test. Do not change any files; answer with a table: method, path, what is missing.`,
	},
];

// Files we ship are upgraded when a newer build changes them, unless the user has
// edited them: a file is "untouched" if it still has the content we last wrote (we
// remember its hash in <state>/defaults.json) or is one of the builds shipped before
// that record existed (LEGACY).
const LEGACY: Record<string, string[]> = {
	agents: ["2cc3a189f86ceac0"],
	"skill:hurl-syntax": ["90ef0304759e6963"],
	"tpl:gen-tests": ["6aee78f7ef23102c"],
	"tpl:add-negative": ["0d3b8ea179793e51"],
	"tpl:fix-failures": ["7b6cc563b1d4f5f7"],
	"tpl:review-coverage": ["c11dd10556d9368f"],
};

const hash = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

function readRecord(p: Project): Record<string, string> {
	try {
		return JSON.parse(readFileSync(p.defaultsPath, "utf8")) as Record<string, string>;
	} catch {
		return {};
	}
}

/** Write `content` to `path` if the file is missing or untouched; true if it was written. */
function manage(rec: Record<string, string>, key: string, path: string, content: string): boolean {
	const fresh = hash(content);
	if (existsSync(path)) {
		const cur = hash(readFileSync(path, "utf8"));
		if (cur === fresh) {
			rec[key] = fresh;
			return false;
		}
		const untouched = rec[key] === cur || (LEGACY[key] ?? []).includes(cur);
		if (!untouched) return false; // edited by the user: leave it alone
	}
	writeAgentFile(path, content);
	rec[key] = fresh;
	return true;
}

export function seedDefaults(p: Project): void {
	const rec = readRecord(p);
	manage(rec, "agents", p.instructionsPath, DEFAULT_AGENTS_MD);
	manage(rec, "skill:hurl-syntax", join(p.agentDir, "skills", "hurl-syntax", "SKILL.md"), HURL_SKILL_MD);
	manage(rec, "skill:openapi-spec", join(p.agentDir, "skills", "openapi-spec", "SKILL.md"), OPENAPI_SKILL_MD);

	// Templates: add the built-in ones that are missing, update untouched ones.
	const current = loadTemplates(p);
	const byId = new Map(current.map((t) => [t.id, t]));
	let changed = false;
	for (const t of TEMPLATES) {
		const key = `tpl:${t.id}`;
		const have = byId.get(t.id);
		if (!have) {
			current.push({ ...t });
			changed = true;
			rec[key] = hash(t.body);
		} else if (have.body === t.body) {
			rec[key] = hash(t.body);
		} else {
			const cur = hash(have.body);
			if (rec[key] === cur || (LEGACY[key] ?? []).includes(cur)) {
				Object.assign(have, { name: t.name, desc: t.desc, body: t.body });
				changed = true;
				rec[key] = hash(t.body);
			} // else: edited by the user, keep theirs
		}
	}
	if (changed || !existsSync(p.templatesPath)) saveTemplates(p, current);

	mkdirSync(p.stateDir, { recursive: true });
	writeFileSync(p.defaultsPath, JSON.stringify(rec, null, 2));
}
