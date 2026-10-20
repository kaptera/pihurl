import { defineConfig } from "@playwright/test";

// The tests drive a running pihurl container (see run.sh). Two instances: one open, one with a token.
export default defineConfig({
	testDir: "tests",
	timeout: 90_000,
	expect: { timeout: 20_000 },
	// the tests of one file build on each other (one chat, one workspace), so run them in order
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: process.env.PIHURL_URL ?? "http://127.0.0.1:3100",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
