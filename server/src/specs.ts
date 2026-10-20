import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { parse } from "yaml";
import { writeAgentFile } from "./agent.js";
import { config } from "./config.js";

/**
 * API specs.
 *
 * A spec is an OpenAPI 3.x or Swagger 2 document (YAML or JSON) in the workspace:
 * everything in <workspace>/specs/, plus openapi*.{yaml,yml,json} / swagger*.{…} in
 * the workspace root (where older builds and agents put them). The user uploads
 * specs through the UI; the agent writes them itself into specs/ — both end up
 * here, and the UI lists whatever is on disk.
 *
 * Specs are parsed on every listing (they are small and the files may change at any
 * time), and a spec that does not parse is listed with an `error` instead of being
 * hidden, so the agent that wrote it can see what is wrong.
 */

export interface SpecEndpoint {
	/** HTTP method, upper case */
	m: string;
	/** path template, e.g. /pet/{petId} */
	p: string;
	/** summary or operationId */
	sum: string;
	/** first tag, or "default" */
	tag: string;
	auth: boolean;
	/** "name:in" pairs */
	params: string[];
	/** response status codes */
	resp: string[];
}

export interface SpecInfo {
	/** workspace-relative path, e.g. specs/petstore.yaml */
	path: string;
	name: string;
	title: string;
	version: string;
	/** absolute base URL of the API if the spec names one, else "" */
	server: string;
	size: string;
	updated: string;
	endpoints: SpecEndpoint[];
	error?: string;
}

export const specsDir = join(config.workspace, "specs");

const SPEC_EXT = /\.(ya?ml|json)$/i;
const ROOT_SPEC = /^(openapi|swagger)[\w.-]*\.(ya?ml|json)$/i;
const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

type Obj = Record<string, any>;

/** Resolve a local `$ref` (#/components/...) one level; anything else is returned as is. */
function deref(doc: Obj, node: any): any {
	if (node && typeof node === "object" && typeof node.$ref === "string" && node.$ref.startsWith("#/")) {
		let cur: any = doc;
		for (const part of node.$ref.slice(2).split("/")) cur = cur?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
		return cur ?? node;
	}
	return node;
}

function serverUrl(doc: Obj): string {
	const first = doc.servers?.[0]?.url;
	if (typeof first === "string") {
		// Variables like {scheme} are replaced by their defaults.
		const url = first.replace(/\{(\w+)\}/g, (_, k) => String(doc.servers[0].variables?.[k]?.default ?? ""));
		return /^https?:\/\//i.test(url) ? url.replace(/\/+$/, "") : "";
	}
	if (typeof doc.host === "string") {
		// Swagger 2
		const scheme = Array.isArray(doc.schemes) && doc.schemes.length ? doc.schemes[0] : "https";
		return `${scheme}://${doc.host}${typeof doc.basePath === "string" ? doc.basePath.replace(/\/+$/, "") : ""}`;
	}
	return "";
}

/** Parse a spec document. Throws an Error with a readable message when it is not usable. */
export function parseSpec(text: string): Pick<SpecInfo, "title" | "version" | "server" | "endpoints"> {
	let doc: Obj;
	try {
		doc = parse(text) as Obj;
	} catch (err) {
		throw new Error(`not valid YAML/JSON: ${(err as Error).message.split("\n")[0]}`);
	}
	if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("the document is not a mapping");
	if (!doc.openapi && !doc.swagger) throw new Error('missing the "openapi: 3.x" (or "swagger: 2.0") version field');
	if (!doc.paths || typeof doc.paths !== "object") throw new Error('missing "paths"');

	const endpoints: SpecEndpoint[] = [];
	const globalSecurity = Array.isArray(doc.security) && doc.security.length > 0;
	for (const [path, rawItem] of Object.entries<any>(doc.paths)) {
		const item = deref(doc, rawItem) as Obj | undefined;
		if (!item || typeof item !== "object") continue;
		for (const method of METHODS) {
			const op = item[method] as Obj | undefined;
			if (!op || typeof op !== "object") continue;
			const params = [...(item.parameters ?? []), ...(op.parameters ?? [])]
				.map((p) => deref(doc, p))
				.filter((p) => p && typeof p.name === "string")
				.map((p) => `${p.name}:${p.in ?? ""}`);
			endpoints.push({
				m: method.toUpperCase(),
				p: path,
				sum: String(op.summary ?? op.operationId ?? ""),
				tag: String(Array.isArray(op.tags) && op.tags.length ? op.tags[0] : "default"),
				auth: Array.isArray(op.security) ? op.security.length > 0 : globalSecurity,
				params: [...new Set(params)],
				resp: Object.keys(op.responses ?? { 200: 1 }).map(String),
			});
		}
	}
	return {
		title: String(doc.info?.title ?? ""),
		version: String(doc.info?.version ?? ""),
		server: serverUrl(doc),
		endpoints,
	};
}

function describe(path: string): SpecInfo {
	const abs = join(config.workspace, path);
	const st = statSync(abs);
	const base: SpecInfo = {
		path,
		name: basename(path),
		title: "",
		version: "",
		server: "",
		size: `${(st.size / 1024).toFixed(1)} KB`,
		updated: new Date(st.mtimeMs).toISOString(),
		endpoints: [],
	};
	try {
		if (st.size > MAX_BYTES) throw new Error("file is larger than 5 MB");
		return { ...base, ...parseSpec(readFileSync(abs, "utf8")) };
	} catch (err) {
		return { ...base, error: (err as Error).message };
	}
}

/** Every spec in the workspace, most recently changed first. */
export function listSpecs(): SpecInfo[] {
	const paths: string[] = [];
	if (existsSync(specsDir)) {
		for (const n of readdirSync(specsDir)) if (SPEC_EXT.test(n) && statSync(join(specsDir, n)).isFile()) paths.push(`specs/${n}`);
	}
	for (const n of readdirSync(config.workspace)) {
		if (ROOT_SPEC.test(n) && statSync(join(config.workspace, n)).isFile()) paths.push(n);
	}
	return paths.map(describe).sort((a, b) => b.updated.localeCompare(a.updated));
}

/** A safe file name for an uploaded spec: letters, digits, dot, dash, underscore. */
export function specFileName(raw: string): string {
	const base = basename(raw).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "");
	const name = base || "openapi";
	return SPEC_EXT.test(name) ? name : `${name}.yaml`;
}

/** Validate and store an uploaded spec as specs/<name>. Returns its workspace-relative path. */
export function saveSpec(name: string, content: string): string {
	if (!content.trim()) throw new Error("the file is empty");
	if (content.length > MAX_BYTES) throw new Error("spec is larger than 5 MB");
	parseSpec(content); // throws with a readable message
	const file = specFileName(name);
	writeAgentFile(join(specsDir, file), content);
	return `specs/${file}`;
}

/** Delete a spec by its workspace-relative path; false if it is not one of ours. */
export function deleteSpec(path: string): boolean {
	const abs = resolve(config.workspace, path);
	const inSpecs = abs.startsWith(specsDir + sep) && SPEC_EXT.test(abs);
	const inRoot = resolve(config.workspace, basename(abs)) === abs && ROOT_SPEC.test(basename(abs));
	if ((!inSpecs && !inRoot) || !existsSync(abs)) return false;
	rmSync(abs);
	return true;
}
