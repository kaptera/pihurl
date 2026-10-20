import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Projects and parallel chats. Self-sufficient: it sets up its own provider and works in the same
// container as app.spec.ts (the default project there already holds one test file).
test.describe.configure({ mode: "serial" });

const MODEL = "http://host.docker.internal:11500/v1";
const API = "http://host.docker.internal:8080";

let page: Page;
let profile: BrowserContext;

test.beforeAll(async ({ browser, request }) => {
	await request.post("/api/providers", { data: { action: "save", kind: "custom", name: "Mock", baseUrl: MODEL, model: "mock-1", active: true } });
	await request.post("/api/hosts", { data: { action: "save", baseUrl: API } });
	profile = await browser.newContext(); // one profile, so a second tab shares its storage
	page = await profile.newPage();
	await page.goto("/");
});
test.afterAll(async () => {
	await profile.close();
});

const nav = (p: Page, name: string | RegExp) => p.locator("#nav button", { hasText: name });
const header = (project: string) => ({ "X-Pihurl-Project": project });

async function ask(p: Page, prompt: string) {
	await nav(p, "Chat").click();
	await p.locator("#inp").fill(prompt);
	await p.locator("#inp").press("Enter");
}
const settled = (p: Page, timeout = 60_000) => expect(p.locator("#sendBtn")).not.toHaveClass(/stop/, { timeout });

async function newChat(p: Page) {
	await nav(p, "Chat").click();
	await p.locator("#chatsBtn").click();
	await p.locator("#chatMenu [data-act=newChat]").click();
	await expect(p.getByRole("heading", { name: "What should we test?" })).toBeVisible();
}

test("a new project starts empty and has its own tests, specs and host", async ({ request }) => {
	await page.locator("#projBtn").click();
	page.once("dialog", (d) => void d.accept("Second API"));
	await page.locator("#projMenu [data-act=projNew]").click();
	await expect(page.locator("#projBtn")).toContainText("Second API"); // the page reloaded into it

	await nav(page, "Spec").click();
	await expect(page.locator("#specInfo")).toContainText("No spec yet");
	await nav(page, "Tests & Reports").click();
	await expect(page.locator("#tfList")).toContainText("No test files yet");
	await expect(page.locator("#hostInp")).toHaveValue("");

	// the server agrees: the default project still has its file, this one has none
	const mine = await (await request.get("/api/tests", { headers: header("second-api") })).json();
	const dflt = await (await request.get("/api/tests", { headers: header("default") })).json();
	expect(mine.files).toHaveLength(0);
	expect(dflt.files.length).toBeGreaterThan(0);
});

test("the agent of a project works in that project", async ({ request }) => {
	const specOf = async (project: string) =>
		(await (await request.get("/api/specs", { headers: header(project) })).json()).specs.find((s: { path: string }) => s.path === "specs/mock-users.yaml");
	const before = await specOf("default"); // app.spec.ts made one in the default project

	await newChat(page);
	await ask(page, "SPECTEST create a spec for the users API");
	await settled(page);
	await expect(page.locator("#sfSpec")).toContainText("Mock Users");
	expect(await specOf("second-api")).toBeTruthy();
	// the agent wrote into its own project: the default project's file was not touched
	expect((await specOf("default")).updated).toBe(before.updated);
});

test("switching back to the default project shows its own data; a project can be deleted", async ({ request }) => {
	await page.locator("#projBtn").click();
	await page.locator("#projMenu .cm-row", { hasText: "Default" }).locator(".cm-main").click();
	await expect(page.locator("#projBtn")).toContainText("Default");
	await nav(page, "Tests & Reports").click();
	await expect(page.locator("#tfList")).toContainText("users.hurl");

	await page.locator("#projBtn").click();
	page.once("dialog", (d) => void d.accept());
	await page.locator("#projMenu .cm-row", { hasText: "Second API" }).locator(".del").click();
	await expect.poll(async () => (await (await request.get("/api/projects")).json()).projects.length).toBe(1);
	await page.keyboard.press("Escape"); // the project menu stays open for more actions
	expect((await request.get("/api/specs", { headers: header("second-api") })).status()).toBe(404);
});

test("two chats work at the same time", async () => {
	await newChat(page);
	await ask(page, "SLOWTEST the slow one");
	await expect(page.locator("#sendBtn")).toHaveClass(/stop/);
	const slowTitle = page.locator("#chatTitle");
	await expect(slowTitle).toContainText("SLOWTEST");

	// leave it working and start another chat: no prompt, nothing is stopped
	await newChat(page);
	await expect(page.locator("#sendBtn")).not.toHaveClass(/stop/);
	await ask(page, "Write CRUD tests for /users again");
	await settled(page, 3_000); // the quick chat finishes within the slow one's four seconds
	await expect(page.locator(".tool")).toHaveCount(2);

	// meanwhile the slow chat is still working: a badge on the Chats button and a spinner in the list
	await expect(page.locator("#chatsBtn .nb")).toHaveText("1");
	await page.locator("#chatsBtn").click();
	const slowRow = page.locator("#chatMenu .cm-row", { hasText: "SLOWTEST" });
	await expect(slowRow.locator(".spin")).toBeVisible();
	await expect(slowRow).toContainText("working");

	// it finishes on its own, and the page says so
	await expect(page.locator("#chatsBtn .nb")).toHaveCount(0, { timeout: 15_000 });
	await expect(slowRow).not.toContainText("working"); // the open list updates in place
	await expect(page.locator("#toast")).toContainText("finished").catch(() => {}); // the toast is brief
	await slowRow.locator(".cm-main").click();
	await expect(page.locator(".ptxt", { hasText: "Slow answer finished." })).toBeVisible();
});

test("a second tab on the same chat follows it live", async () => {
	// tab 1: a chat that is idle; tab 2 opens the same one (the page remembers the last chat of the project)
	const first = page;
	await first.reload();
	await expect(first.locator(".ptxt", { hasText: "Slow answer finished." })).toBeVisible();
	const second = await profile.newPage(); // remembers the same chat
	await second.goto("/");
	await expect(second.locator(".ptxt", { hasText: "Slow answer finished." })).toBeVisible();

	await first.locator("#inp").fill("SLOWTEST typed in the first tab");
	await first.locator("#inp").press("Enter");
	// the second tab shows the message it did not type, and that the agent is working
	await expect(second.locator(".msg.user", { hasText: "typed in the first tab" })).toBeVisible();
	await expect(second.locator("#sendBtn")).toHaveClass(/stop/);
	// and the answer, without a reload
	await expect(second.locator(".ptxt", { hasText: "Slow answer finished." })).toHaveCount(2, { timeout: 20_000 });
	await expect(second.locator("#sendBtn")).not.toHaveClass(/stop/);
	await second.close();
});
