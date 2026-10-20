import { config, loadProviders, saveModels, type ModelsFile, type ProviderConfig } from "./config.js";

/**
 * Providers as pi sees them.
 *
 * The real endpoint and API key of a provider stay in the server (providers.json in the state
 * directory, which the agent cannot read). pi gets a models.json whose base URL points at the
 * server's loopback model proxy (internal.ts) and whose key is a placeholder; the proxy puts the
 * real key on the request. So neither the key nor the upstream address is ever in a file or an
 * environment variable that the agent can reach.
 */

// Stable provider key used both as the models.json entry name and the runtime
// --provider flag. Pi resolves --provider against the keys in models.json, so
// the two must match exactly.
export function providerKey(p: ProviderConfig): string {
	const slug = (p.name || p.kind)
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "custom";
}

// models.json is an object keyed by provider name, so two providers whose names
// slugify the same (two "llama" endpoints, say) would silently overwrite each
// other. Disambiguate the second+ occurrence with the provider id.
export function modelsKeyFor(p: ProviderConfig, list: ProviderConfig[]): string {
	const slug = providerKey(p);
	const collide = list.some((q) => q.id !== p.id && providerKey(q) === slug);
	return collide ? `${slug}-${p.id}` : slug;
}

// pi reads the endpoints from models.json (rebuilt on every provider change);
// --provider/--model only select which of them this run uses.
export function providerArgs(p: ProviderConfig, list: ProviderConfig[]): string[] {
	const args: string[] = [];
	if (p.baseUrl && p.model) args.push("--provider", modelsKeyFor(p, list));
	if (p.model) args.push("--model", p.model);
	return args;
}


/** Path part of a provider's base URL (without a trailing slash): "/v1", "/strata/v1" or "". */
export function upstreamBasePath(p: ProviderConfig): string {
	try {
		return new URL(p.baseUrl).pathname.replace(/\/+$/, "");
	} catch {
		return "";
	}
}

/** The provider behind a models.json key (the model proxy resolves requests with it). */
export function providerByKey(key: string): ProviderConfig | undefined {
	const list = loadProviders();
	return list.find((p) => modelsKeyFor(p, list) === key);
}

// Rebuild the models.json from the provider list. Called after any save/delete and at boot.
export function syncModelsFromProviders(list: ProviderConfig[]): void {
	const models: ModelsFile = {};
	for (const p of list) {
		if (!p.baseUrl || !p.model) continue;
		const key = modelsKeyFor(p, list);
		models[key] = {
			baseUrl: `${config.internalUrl}/llm/${key}${upstreamBasePath(p)}`,
			api: p.kind === "anthropic" ? "anthropic-messages" : "openai-completions",
			// pi hides models of a provider without a key; the proxy replaces this with the real one.
			apiKey: "proxy",
			models: [{ id: p.model }],
		};
	}
	saveModels(models);
}

// Run once at boot so models.json reflects the current provider list even if it
// was never saved through the API (e.g. a hand-edited providers.json).
export function syncModelsAtBoot(): void {
	syncModelsFromProviders(loadProviders());
}
