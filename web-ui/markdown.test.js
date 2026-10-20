const test = require("node:test");
const assert = require("node:assert/strict");
const { renderMarkdown: md } = require("./markdown.js");

test("escapes HTML and blocks dangerous links", () => {
	assert.equal(md("<script>alert(1)</script>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
	assert.ok(!md("[x](javascript:alert(1))").includes("<a "));
	assert.ok(!md('<img src=x onerror="alert(1)">').includes("<img"));
	assert.match(md("[docs](https://example.com/a?b=1&c=2)"), /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">docs<\/a>/);
});

test("inline formatting", () => {
	assert.equal(md("a **b** *c* ~~d~~ `e`"), "<p>a <strong>b</strong> <em>c</em> <del>d</del> <code>e</code></p>");
	assert.equal(md("snake_case_name stays"), "<p>snake_case_name stays</p>");
	assert.equal(md("2 * 3 * 4"), "<p>2 * 3 * 4</p>");
	assert.equal(md("`**not bold**` and `a<b`"), "<p><code>**not bold**</code> and <code>a&lt;b</code></p>");
});

test("bare urls become links", () => {
	assert.match(md("see https://petstore3.swagger.io/api/v3."), /<a href="https:\/\/petstore3.swagger.io\/api\/v3"[^>]*>[^<]+<\/a>\./);
});

test("headings, hr, line breaks", () => {
	assert.equal(md("# One\n## Two ##"), "<h1>One</h1><h2>Two</h2>");
	assert.equal(md("a\nb"), "<p>a<br>b</p>");
	assert.equal(md("a\n\n---\n\nb"), "<p>a</p><hr><p>b</p>");
});

test("lists, nesting and tasks", () => {
	assert.equal(md("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
	assert.equal(md("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
	assert.equal(md("- a\n  - b\n  - c\n- d"), "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>");
	assert.match(md("- [x] done\n- [ ] todo"), /<input type="checkbox" disabled checked> done.*<input type="checkbox" disabled> todo/);
});

test("code fences, including an unterminated one and a highlight hook", () => {
	assert.equal(md("```hurl\nGET {{host}}/x\n```"), '<pre class="mdcode"><code data-lang="hurl">GET {{host}}/x</code></pre>');
	assert.equal(md("```\n<b>&</b>"), '<pre class="mdcode"><code>&lt;b&gt;&amp;&lt;/b&gt;</code></pre>');
	assert.equal(md("```x\na\n```", { highlight: (lang, code) => `[${lang}:${code}]` }), '<pre class="mdcode"><code data-lang="x">[x:a]</code></pre>');
	assert.equal(md("```\n# not a heading\n- not a list\n```"), '<pre class="mdcode"><code># not a heading\n- not a list</code></pre>');
});

test("blockquote", () => {
	assert.equal(md("> quoted **text**\n> more"), "<blockquote><p>quoted <strong>text</strong><br>more</p></blockquote>");
});

test("tables with alignment and code in cells", () => {
	const html = md("| File | Operations |\n|:--|--:|\n| `a.hurl` | `GET /x` \\| y |\n| b | c |");
	assert.match(html, /<th style="text-align:left">File<\/th><th style="text-align:right">Operations<\/th>/);
	assert.match(html, /<td style="text-align:left"><code>a.hurl<\/code><\/td><td style="text-align:right"><code>GET \/x<\/code> \| y<\/td>/);
	assert.equal((html.match(/<tr>/g) || []).length, 3);
	assert.equal(md("a | b\nno table"), "<p>a | b<br>no table</p>");
});

test("a real agent answer renders without leftovers", () => {
	const html = md("All 19 spec operations are now covered.\n\n**Files created**\n\n| File | Operations covered |\n|---|---|\n| `tests/user/user-crud.hurl` | `POST /user`, `GET /user/{username}` |\n\n- `POST {{host}}/user` — expected 200, actual `500 {\"code\":500}`\n- header `X-Expires-After` is spec'd `format: date-time`");
	assert.ok(!html.includes("**") && !html.includes("`"), html);
	assert.equal((html.match(/<li>/g) || []).length, 2);
	assert.match(html, /<table>/);
});
