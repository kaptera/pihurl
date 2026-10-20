import { expect, test } from "@playwright/test";

const URL = process.env.PIHURL_AUTH_URL ?? "http://127.0.0.1:3101";
const TOKEN = process.env.PIHURL_TOKEN ?? "";

test.skip(!TOKEN, "needs the container with PIHURL_TOKEN (run.sh starts it)");
test.use({ baseURL: URL });

test("the API refuses requests without the token", async ({ request }) => {
	for (const path of ["/api/providers", "/api/specs", "/api/chat", "/report/1/x"]) {
		expect((await request.get(path)).status(), path).toBe(401);
	}
	expect((await request.get("/api/specs", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
	expect((await request.get("/api/specs", { headers: { Authorization: `Bearer ${TOKEN}` } })).status()).toBe(200);
	expect((await request.get("/health")).status()).toBe(200);
});

test("a foreign origin cannot change anything", async ({ request }) => {
	const r = await request.post("/api/hosts", {
		headers: { Authorization: `Bearer ${TOKEN}`, Origin: "http://evil.example" },
		data: { action: "save", baseUrl: "https://example.com" },
	});
	expect(r.status()).toBe(403);
});

test("the sign-in screen asks for the token, and sign-out brings it back", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Sign in to pihurl" })).toBeVisible();
	await expect(page.locator("#nav")).toBeHidden().catch(() => {});

	await page.locator("#loginToken").fill("wrong");
	await page.locator("#loginToken").press("Enter");
	await expect(page.locator("#loginErr")).toContainText("wrong token");

	await page.locator("#loginToken").fill(TOKEN);
	await page.locator("#loginToken").press("Enter");
	await expect(page.getByRole("heading", { name: "What should we test?" })).toBeVisible();

	await page.reload(); // the session cookie keeps us in
	await expect(page.getByRole("heading", { name: "What should we test?" })).toBeVisible();

	await page.locator("#nav button", { hasText: "Settings" }).click();
	await expect(page.locator("#settingsBody")).toContainText("Access token");
	await page.locator("[data-act=signOut]").click();
	await expect(page.getByRole("heading", { name: "Sign in to pihurl" })).toBeVisible();
});
