import { expect, test, type Page } from "@playwright/test";

// One pihurl container, one workspace: these tests run in order and build on each other.
test.describe.configure({ mode: "serial" });

const API = "http://host.docker.internal:8080"; // the scripted target API, as the container sees it
const MODEL = "http://host.docker.internal:11500/v1"; // the scripted model

let page: Page;
const problems: string[] = [];

test.beforeAll(async ({ browser }) => {
	page = await browser.newPage();
	page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
	page.on("console", (m) => {
		if (m.type() === "error" && !/ERR_INCOMPLETE_CHUNKED_ENCODING|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
	});
});
test.afterAll(async () => {
	await page.close();
});

const nav = (name: string | RegExp) => page.locator("#nav button", { hasText: name });

async function ask(prompt: string) {
	await nav("Chat").click();
	await page.locator("#inp").fill(prompt);
	await page.locator("#inp").press("Enter");
}

/** Start a new chat and wait until the (empty) chat has replaced the old one. */
async function newChat() {
	await nav("Chat").click();
	await page.locator("#chatsBtn").click();
	await page.locator("#chatMenu [data-act=newChat]").click();
	await expect(page.getByRole("heading", { name: "What should we test?" })).toBeVisible();
}

/** Wait until the agent is idle again (the send button is the "stop" button while it works). */
async function settled() {
	await expect(page.locator("#sendBtn")).not.toHaveClass(/stop/, { timeout: 60_000 });
}

test("the app loads and shows the empty chat", async () => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "What should we test?" })).toBeVisible();
	await expect(page.locator("#sfProv")).toContainText("not connected");
});

test("a provider is added and checked from the Providers tab", async () => {
	await nav("Providers").click();
	await page.locator("#pf-name").fill("Mock");
	await page.locator("#pf-url").fill(MODEL);
	await page.locator("#pf-model").fill("mock-1");
	await page.locator("[data-act=testProv]").click();
	await expect(page.locator("#pf-test")).toContainText("Connected");
	await page.locator("[data-act=saveProv]").click();
	await expect(page.locator("#toast")).toContainText("Provider saved");
	await expect(page.locator("#sfProv")).toContainText("Mock · mock-1");
	// the browser never gets the key back
	await expect(page.locator("#provList")).not.toContainText("sk-");
});

test("the target host is set on the Tests tab", async () => {
	await nav("Tests & Reports").click();
	await page.locator("#hostInp").fill(API);
	await page.locator("#hostInp").press("Tab");
	await expect.poll(async () => (await (await page.request.get("/api/hosts")).json()).hosts?.[0]?.baseUrl).toBe(API);
});

test("the agent writes a test, runs it, and the answer is rendered as Markdown", async () => {
	await ask("Write CRUD tests for /users");
	await expect(page.locator(".tool")).toHaveCount(2, { timeout: 60_000 });
	await settled();
	// bold text became <strong>, not literal asterisks
	await expect(page.locator(".ptxt strong", { hasText: "tests/users/users.hurl" })).toBeVisible();
	await expect(page.locator("#msgsIn")).not.toContainText("**");
	// the bash card, once finished, is folded; open it to see hurl's own output
	const bash = page.locator(".tool.bash");
	await bash.locator(".th").click();
	await expect(bash.locator(".out")).toContainText("Success tests/users/users.hurl");
	await expect(page.locator("#chatTitle")).toContainText("Write CRUD tests");
});

test("the chat survives a reload", async () => {
	await page.reload();
	await expect(page.locator(".tool")).toHaveCount(2);
	await expect(page.locator(".ptxt strong", { hasText: "tests/users/users.hurl" })).toBeVisible();
});

test("a spec written by the agent shows up without a reload", async () => {
	await newChat();
	await ask("SPECTEST create a spec for the users API");
	await settled();
	await expect(page.locator("#sfSpec")).toContainText("Mock Users");
	await nav("Spec").click();
	await expect(page.locator("#specSel")).toContainText("Mock Users");
	await expect(page.locator("#epList .ep")).toHaveCount(2);
	// the agent's own check works on the loopback listener
	await expect(page.locator("#specInfo")).toContainText("specs/mock-users.yaml");
});

test("tests are grouped under their spec, and run from there", async () => {
	await nav("Tests & Reports").click();
	const group = page.locator(".sg", { hasText: "Mock Users" });
	await expect(group).toContainText("1 file");
	await group.getByRole("checkbox", { name: "Select all files of Mock Users" }).click(); // the whole group
	await expect(page.locator("#runSel")).toContainText("Run selected (1)");
	await page.locator("#runAll").click();
	await expect(group).toContainText("1/1 passing", { timeout: 60_000 });
	await expect(page.locator("#tMain .ring")).toContainText("100");
	await page.locator("#tMain .rfh").first().click();
	await expect(page.locator("#tMain .ent")).toHaveCount(4);
});

test("chats can be switched and deleted", async () => {
	await nav("Chat").click();
	await page.locator("#chatsBtn").click();
	const rows = page.locator("#chatMenu .cm-row");
	await expect(rows).toHaveCount(2);
	await rows.filter({ hasText: "Write CRUD tests" }).locator(".cm-main").click();
	await expect(page.locator(".tool")).toHaveCount(2);

	page.once("dialog", (d) => d.accept());
	await page.locator("#chatsBtn").click();
	await page.locator("#chatMenu .cm-row", { hasText: "SPECTEST" }).locator(".del").click();
	await page.locator("#chatsBtn").click();
	await expect(page.locator("#chatMenu .cm-row")).toHaveCount(1);
	await page.keyboard.press("Escape");
});

test("tool cards follow the setting and the fold-all button", async () => {
	await nav("Settings").click();
	await page.locator("[data-act=setPref][data-k=toolCards][data-v=expanded]").click();
	await nav("Chat").click();
	const cards = page.locator(".tool");
	await expect(cards).toHaveCount(2);
	await expect(page.locator(".tool.open")).toHaveCount(2);
	await page.locator("#toolsBtn").click();
	await expect(page.locator(".tool.open")).toHaveCount(0);
	await page.reload(); // the preference is remembered
	await expect(page.locator(".tool.open")).toHaveCount(2);
	await nav("Settings").click();
	await page.locator("[data-act=resetPrefs]").click();
});

test("the agent runs unprivileged and cannot see keys or the token", async () => {
	await newChat();
	await ask("SECTEST probe what you can see");
	await settled();
	const out = page.locator(".tool.bash").first();
	await out.locator(".th").click();
	const text = await out.locator(".out").innerText();
	expect(text).toContain("uid=10001");
	expect(text).not.toContain("uid=0");
	expect(text).toContain("Permission denied"); // /state and /proc/1/environ
	expect(text).toContain("no-secret-env");
	expect(text).toContain('"apiKey": "proxy"'); // models.json holds a placeholder, not the key
	expect(text).toContain('{"ok":true}'); // the loopback listener answers
	expect(text).toContain("ok"); // the workspace is writable
});

test("provider errors are shown in the chat", async () => {
	await newChat();
	await ask("ERRORTEST please");
	await settled();
	await expect(page.locator(".stopnote")).toContainText("Incorrect API key provided");
});

test("nothing logged an error in the browser", async () => {
	expect(problems).toEqual([]);
});
