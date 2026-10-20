import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "pihurl-providers-"));
process.env.PIHURL_STATE = join(root, "state");
process.env.WORKSPACE = join(root, "ws");
delete process.env.PIHURL_AGENT_UID;
mkdirSync(process.env.PIHURL_STATE, { recursive: true });
mkdirSync(process.env.WORKSPACE, { recursive: true });

const { modelEntry, syncModelsFromProviders } = await import("../dist/providers.js");
const { loadModels } = await import("../dist/config.js");
const { defaultProject } = await import("../dist/projects.js");

const base = { id: "p1", kind: "custom", name: "Local", baseUrl: "http://x/v1", model: "m1" };

test("a provider without settings sends nothing extra", () => {
	assert.deepEqual(modelEntry(base), { id: "m1" });
});

test("temperature and context window reach the model entry; zero temperature counts", () => {
	assert.deepEqual(modelEntry({ ...base, temperature: 0, contextWindow: 32768 }), {
		id: "m1",
		contextWindow: 32768,
		samplingParams: { temperature: 0 },
	});
});

test("temperature is not sent to Anthropic (pi ignores it there)", () => {
	assert.deepEqual(modelEntry({ ...base, kind: "anthropic", temperature: 0.5 }), { id: "m1" });
});

test("models.json is written with the settings", () => {
	const project = defaultProject();
	syncModelsFromProviders(project, [{ ...base, active: true, temperature: 0.3, contextWindow: 16384 }]);
	const entry = Object.values(loadModels(project))[0].models[0];
	assert.equal(entry.contextWindow, 16384);
	assert.equal(entry.samplingParams.temperature, 0.3);
});
