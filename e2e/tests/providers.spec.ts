import { expect, test, type Page } from "@playwright/test";

// Provider settings reach the model. Runs after the other specs and puts the provider back as it found it.
test.describe.configure({ mode: "serial" });

const MODEL = "http://127.0.0.1:11500"; // the scripted model, as this machine sees it

let page: Page;

test.beforeAll(async ({ browser, request }) => {
	await request.post("/api/providers", { data: { action: "save", kind: "custom", name: "Mock", baseUrl: "http://host.docker.internal:11500/v1", model: "mock-1", active: true } });
	page = await browser.newPage();
	await page.goto("/");
});
test.afterAll(async () => {
	await page.close();
});

const nav = (name: string) => page.locator("#nav button", { hasText: name });
const lastRequest = async (request: import("@playwright/test").APIRequestContext) => (await request.get(`${MODEL}/_last`)).json();

const activeProvider = async (request: import("@playwright/test").APIRequestContext) =>
	(await (await request.get("/api/providers")).json()).providers.find((p: { active: boolean }) => p.active);

async function saveProvider() {
	await page.locator("[data-act=saveProv]").click();
	await expect(page.locator("#toast")).toContainText("Provider saved");
}

async function askAndWait(prompt: string) {
	await nav("Chat").click();
	await page.locator("#chatsBtn").click();
	await page.locator("#chatMenu [data-act=newChat]").click();
	await expect(page.getByRole("heading", { name: "What should we test?" })).toBeVisible(); // the new chat has replaced the old one
	await page.locator("#inp").fill(prompt);
	await page.locator("#inp").press("Enter");
	await expect(page.locator(".ptxt").first()).toBeVisible({ timeout: 30_000 });
	await expect(page.locator("#sendBtn")).not.toHaveClass(/stop/, { timeout: 30_000 });
}

test("by default the model's own temperature is used", async ({ request }) => {
	await nav("Providers").click();
	await page.locator("#provList .prov:has(.badge)").click();
	await expect(page.locator("#pf-tdef")).toBeChecked();
	await expect(page.locator("#pf-temp")).toBeDisabled();
	await askAndWait("hello default");
	expect(await lastRequest(request)).not.toHaveProperty("temperature");
});

test("a chosen temperature is sent with every request", async ({ request }) => {
	await nav("Providers").click();
	await page.locator("#provList .prov:has(.badge)").click();
	await page.locator("#pf-tdef").uncheck();
	await page.locator("#pf-temp").fill("0.35");
	await page.locator("#pf-ctx").fill("32768");
	await saveProvider();
	// the form shows what was saved
	await expect(page.locator("#tv")).toHaveText("0.35");
	await expect(page.locator("#pf-ctx")).toHaveValue("32768");
	const saved = await activeProvider(request);
	expect(saved).toMatchObject({ temperature: 0.35, contextWindow: 32768 });

	await askAndWait("hello with temperature");
	expect(await lastRequest(request)).toMatchObject({ temperature: 0.35 });
});

test("clearing the settings goes back to the model's defaults; bad values are refused", async ({ request }) => {
	const bad = await request.post("/api/providers", { data: { action: "save", id: (await activeProvider(request)).id, temperature: 7 } });
	expect(bad.status()).toBe(400);

	await nav("Providers").click();
	await page.locator("#provList .prov:has(.badge)").click();
	await page.locator("#pf-tdef").check();
	await page.locator("#pf-ctx").fill("");
	await saveProvider();
	const saved = await activeProvider(request);
	expect(saved.temperature).toBeUndefined();
	expect(saved.contextWindow).toBeUndefined();

	await askAndWait("hello again");
	expect(await lastRequest(request)).not.toHaveProperty("temperature");
});
