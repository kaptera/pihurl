import js from "@eslint/js";
import globals from "globals";

// The web UI is plain browser JavaScript without a build step; the two older files are classic scripts that
// the page loads first (and node loads in the tests), app.js and its modules are ES modules.
export default [
	{ ignores: ["**/node_modules/**", "e2e/test-results/**", "e2e/playwright-report/**"] },
	js.configs.recommended,
	{
		files: ["web-ui/**/*.js"],
		languageOptions: { sourceType: "module", globals: { ...globals.browser, renderMarkdown: "readonly", groupFiles: "readonly", assignSpec: "readonly", requestsOf: "readonly", specOverride: "readonly", endpointRegex: "readonly" } },
		rules: {
			"no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
			// storage and clipboard access may be blocked; ignoring that is deliberate
			"no-empty": ["error", { allowEmptyCatch: true }],
		},
	},
	{
		files: ["web-ui/markdown.js", "web-ui/grouping.js", "web-ui/*.test.js"],
		languageOptions: { sourceType: "commonjs", globals: { ...globals.browser, ...globals.node } },
	},
	{ files: ["e2e/fixtures/*.mjs"], languageOptions: { globals: globals.node } },
];
