import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { agentEnv, mkdirAgent, spawnIdentity, writeAgentFile } from "./agent.js";
import type { Project } from "./projects.js";
import { log } from "./log.js";

/**
 * Test runner.
 *
 * Tests are executed directly by the backend via Hurl — NOT by
 * the agent. The agent only writes/edits .hurl files; the backend runs them and
 * hands results back to the browser.
 *
 * Every run gets its own directory, which doubles as the history archive:
 *
 *   report/<stamp>/json/report.json   Hurl JSON report (+ store/ bodies)
 *   report/<stamp>/html/index.html    Hurl HTML report
 *   report/<stamp>/junit.xml          JUnit report
 *   report/<stamp>/result.json        normalized result the UI renders
 *
 * Files run one hurl process at a time. Hurl aborts the whole invocation on a
 * parse error and attaches runtime errors (connection refused, failed capture)
 * only to stderr, so a process per file isolates a broken file and lets us
 * attribute the error text to it. The three report formats append, so one
 * directory still collects the whole run.
 */

export interface RunOptions {
	/** Explicit host to pass as --variable host=... (from the UI). */
	host?: string;
	/** Extra key=value pairs passed as --variable. */
	variables?: string[];
	/** Files to run, workspace-relative. Defaults to everything under tests/. */
	files?: string[];
}

export interface AssertionResult {
	text: string;
	ok: boolean;
	detail?: string;
}

export interface EntryResult {
	method: string;
	url: string;
	status: number | null;
	ok: boolean;
	skipped?: boolean;
	asserts: AssertionResult[];
	/** Headers are [name, value] pairs, the shape the UI renders. */
	request?: { headers: [string, string][]; body?: string };
	response?: { headers: [string, string][]; body?: string; status?: number; durationMs?: number };
}

export interface FileResult {
	/** workspace-relative, e.g. tests/users/create.hurl */
	path: string;
	status: "pass" | "fail";
	/** milliseconds */
	time: number;
	reqs: number;
	entries: EntryResult[];
	/** First failure, flattened (also set for files that never produced a report). */
	fail?: { text: string; detail: string };
}

export interface RunResult {
	id: number;
	at: number;
	files: FileResult[];
	command: string;
	host?: string;
	/** Wall-clock milliseconds the runner spent. */
	duration: number;
	jsonFile?: string;
	htmlFile?: string;
	junitFile?: string;
}

// ---- hurl report shapes (only what we read) ----------------------------------

interface RawAssert {
	line: number;
	success: boolean;
	message?: string;
}

interface RawCall {
	request: { method: string; url: string; headers?: { name: string; value: string }[] };
	response?: { status: number; headers?: { name: string; value: string }[]; body?: string };
	timings?: { total?: number };
}

interface RawEntry {
	index: number;
	line: number;
	time: number;
	asserts: RawAssert[];
	calls: RawCall[];
}

interface RawFile {
	filename: string;
	success: boolean;
	time: number;
	entries: RawEntry[];
}

const MAX_BODY_BYTES = 20 * 1024;
const MAX_HISTORY = 50;
const FILE_TIMEOUT_MS = 5 * 60_000;

const running = new Set<string>(); // one run at a time per project

/**
 * Turn the requested file list into workspace-relative paths for the hurl CLI
 * (the spawn runs with cwd=workspace). Anything resolving outside the
 * workspace is rejected; with no explicit list, every *.hurl/*.http under
 * tests/ is used recursively (hurl does not accept bare directories).
 */
function expandTestFiles(p: Project, files?: string[]): string[] {
	if (files && files.length) {
		return files.map((f) => {
			const abs = resolve(p.dir, f);
			if (!abs.startsWith(p.dir + "/")) {
				throw new Error(`test file outside the workspace: ${f}`);
			}
			if (!/\.(hurl|http)$/.test(abs)) throw new Error(`not a hurl file: ${f}`);
			return abs.slice(p.dir.length + 1);
		});
	}
	const out: string[] = [];
	const walk = (dir: string, prefix: string): void => {
		if (!existsSync(dir)) return;
		for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (e.isDirectory()) walk(join(dir, e.name), `${prefix}${e.name}/`);
			else if (/\.(hurl|http)$/.test(e.name)) out.push(`${prefix}${e.name}`);
		}
	};
	walk(join(p.dir, "tests"), "tests/");
	return out;
}

function runHurl(p: Project, args: string[]): Promise<{ code: number; stderr: string }> {
	return new Promise((resolvePromise, reject) => {
		// cwd matters: workspace-relative test paths only resolve from the
		// workspace root. Without it hurl would look in the server's own dir.
		const proc = spawn("hurl", args, {
			cwd: p.dir,
			stdio: ["ignore", "ignore", "pipe"],
			// hurl may read files named in a test: run it as the agent user, with a clean environment
			env: agentEnv(),
			...spawnIdentity(),
		});
		let stderr = "";
		proc.stderr.setEncoding("utf8");
		proc.stderr.on("data", (c: string) => {
			if (stderr.length < 64 * 1024) stderr += c;
		});
		const timer = setTimeout(() => proc.kill("SIGKILL"), FILE_TIMEOUT_MS);
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err.message.includes("ENOENT") ? new Error("hurl is not installed or not on PATH") : err);
		});
		proc.on("close", (code) => {
			clearTimeout(timer);
			resolvePromise({ code: code ?? 1, stderr });
		});
	});
}

/** Strip hurl's per-invocation summary block and trailing "Failure/Success" line. */
function errorText(stderr: string): string {
	const cut = stderr.search(/^-{20,}$/m);
	const body = cut >= 0 ? stderr.slice(0, cut) : stderr;
	return body
		.split("\n")
		.filter((l) => !/^(Failure|Success) \S+ \(\d+ request/.test(l))
		.join("\n")
		.trim();
}

const REQUEST_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)/;

function pairs(h?: { name: string; value: string }[]): [string, string][] {
	return (h ?? []).map((x) => [x.name, x.value]);
}

function readBody(jsonDir: string, rel?: string): string | undefined {
	if (!rel) return undefined;
	try {
		const buf = readFileSync(join(jsonDir, rel));
		const text = buf.subarray(0, MAX_BODY_BYTES).toString("utf8");
		return buf.length > MAX_BODY_BYTES ? `${text}\n… (${buf.length - MAX_BODY_BYTES} more bytes in the JSON report)` : text;
	} catch {
		return undefined;
	}
}

function normalizeEntry(raw: RawEntry, src: string[], jsonDir: string): EntryResult {
	const first = raw.calls[0];
	const last = raw.calls[raw.calls.length - 1];

	// Hurl reports one assert per check, several per source line (an `HTTP 200`
	// line yields a version and a status check). Merge them by line and take the
	// assertion text from the source, since the report only carries the line.
	const byLine = new Map<number, AssertionResult>();
	for (const a of raw.asserts) {
		const cur = byLine.get(a.line);
		const detail = a.success ? undefined : a.message;
		if (!cur) {
			byLine.set(a.line, {
				text: (src[a.line - 1] ?? `line ${a.line}`).trim(),
				ok: a.success,
				...(detail ? { detail } : {}),
			});
		} else if (!a.success) {
			cur.ok = false;
			if (detail) cur.detail = detail;
		}
	}
	const asserts = [...byLine.values()];

	const status = last?.response?.status ?? null;
	const durUs = last?.timings?.total;
	return {
		method: first?.request.method ?? (src[raw.line - 1]?.match(REQUEST_LINE)?.[1] ?? "GET"),
		url: first?.request.url ?? (src[raw.line - 1]?.match(REQUEST_LINE)?.[2] ?? ""),
		status,
		// An entry with no assertions is fine as long as the request completed.
		ok: asserts.every((a) => a.ok) && !!last?.response,
		asserts,
		...(first ? { request: { headers: pairs(first.request.headers) } } : {}),
		...(last?.response
			? {
				response: {
					headers: pairs(last.response.headers),
					body: readBody(jsonDir, last.response.body),
					status: last.response.status,
					durationMs: durUs !== undefined ? Math.round(durUs / 1000) : raw.time,
				},
			}
			: {}),
	};
}

function normalizeFile(p: Project, path: string, raw: RawFile | undefined, stderr: string, jsonDir: string): FileResult {
	let src: string[] = [];
	try {
		src = readFileSync(join(p.dir, path), "utf8").split("\n");
	} catch {
		/* unreadable source: asserts fall back to "line N" */
	}
	const err = errorText(stderr);

	// No report entry at all: hurl rejected the file (parse error) before sending
	// anything. Surface hurl's own message as the failure.
	if (!raw) {
		return {
			path,
			status: "fail",
			time: 0,
			reqs: 0,
			entries: [],
			fail: { text: "hurl could not run this file", detail: err || "no report produced" },
		};
	}

	const entries = raw.entries.map((e) => normalizeEntry(e, src, jsonDir));

	// Runtime errors (connection refused, failed capture, ...) leave no failed
	// assertion; the message exists only on stderr. Pin it to the entry that
	// broke: the one without a response, else the last one that ran.
	if (!raw.success && !entries.some((e) => e.asserts.some((a) => !a.ok)) && err) {
		const target = entries.find((e) => !e.response) ?? entries[entries.length - 1];
		if (target) {
			target.ok = false;
			target.asserts.push({ text: "request error", ok: false, detail: err });
		}
	}

	// Hurl stops a file at its first failure; list the requests that never ran so
	// the UI can show them as skipped.
	if (!raw.success) {
		const all = src
			.map((l) => l.match(REQUEST_LINE))
			.filter((m): m is RegExpMatchArray => !!m);
		for (const m of all.slice(entries.length)) {
			entries.push({ method: m[1], url: m[2], status: null, ok: false, skipped: true, asserts: [] });
		}
	}

	const failed = entries.find((e) => !e.ok && !e.skipped);
	const firstBad = failed?.asserts.find((a) => !a.ok);
	return {
		path,
		status: raw.success && !failed ? "pass" : "fail",
		time: raw.time,
		reqs: entries.filter((e) => !e.skipped).length,
		entries,
		...(firstBad ? { fail: { text: firstBad.text, detail: firstBad.detail ?? "" } } : {}),
	};
}

function readRawReport(jsonDir: string): Map<string, RawFile> {
	try {
		const arr = JSON.parse(readFileSync(join(jsonDir, "report.json"), "utf8")) as RawFile[];
		return new Map(arr.map((f) => [f.filename, f]));
	} catch {
		return new Map();
	}
}

function pruneHistory(p: Project): void {
	const dirs = runDirs(p);
	for (const d of dirs.slice(MAX_HISTORY)) rmSync(join(p.reportDir, String(d)), { recursive: true, force: true });
}

/** Run ids (directory names), newest first. */
function runDirs(p: Project): number[] {
	if (!existsSync(p.reportDir)) return [];
	return readdirSync(p.reportDir)
		.filter((e) => /^\d+$/.test(e))
		.map(Number)
		.sort((a, b) => b - a);
}

/** Normalized results of past runs, newest first. */
export function listHistory(p: Project): RunResult[] {
	const out: RunResult[] = [];
	for (const id of runDirs(p)) {
		try {
			out.push(withProjectUrls(p, JSON.parse(readFileSync(join(p.reportDir, String(id), "result.json"), "utf8")) as RunResult));
		} catch {
			/* incomplete run directory */
		}
	}
	return out;
}

// Report URLs name the project: /report/<project>/<run>/... (results written before projects
// existed point at /report/<run>/..., which the server still serves for the default project).
function withProjectUrls(p: Project, r: RunResult): RunResult {
	const fix = (u?: string): string | undefined => (u ? u.replace(/^\/report\/(\d+)\//, `/report/${p.id}/$1/`) : u);
	return { ...r, jsonFile: fix(r.jsonFile), htmlFile: fix(r.htmlFile), junitFile: fix(r.junitFile) };
}

/**
 * Run the given Hurl files of a project and return a normalized result.
 */
export async function runTests(p: Project, opts: RunOptions = {}): Promise<RunResult> {
	if (running.has(p.id)) throw new Error("a run is already in progress");
	const host = typeof opts.host === "string" ? opts.host.trim() : "";
	const variables = (opts.variables ?? []).filter(
		(v): v is string => typeof v === "string" && /^[A-Za-z_][\w-]*=/.test(v),
	);
	const files = expandTestFiles(p, opts.files);
	if (!files.length) throw new Error("no test files to run");

	running.add(p.id);
	try {
		const started = Date.now();
		const id = started;
		const dir = join(p.reportDir, String(id));
		const jsonDir = join(dir, "json");
		const htmlDir = join(dir, "html");
		const junit = join(dir, "junit.xml");
		mkdirAgent(dir);

		const varArgs: string[] = [];
		if (host) varArgs.push("--variable", `host=${host}`);
		for (const v of variables) varArgs.push("--variable", v);

		const stderrByFile = new Map<string, string>();
		for (const f of files) {
			const { stderr } = await runHurl(p, [
				"--test", "--no-color", "--connect-timeout", "10", "--max-time", "60",
				...varArgs,
				"--report-json", jsonDir, "--report-html", htmlDir, "--report-junit", junit,
				f,
			]);
			stderrByFile.set(f, stderr);
		}

		const raw = readRawReport(jsonDir);
		const result: RunResult = {
			id,
			at: started,
			files: files.map((f) => normalizeFile(p, f, raw.get(f), stderrByFile.get(f) ?? "", jsonDir)),
			// Variables other than host may carry tokens; keep their values out of the
			// command shown in the UI and stored in history.
			command: [
				"hurl", "--test",
				...varArgs.map((a) => (/^[A-Za-z_][\w-]*=/.test(a) && !a.startsWith("host=") ? a.replace(/=.*/s, "=***") : a)),
				...files,
			].join(" "),
			...(host ? { host } : {}),
			duration: Date.now() - started,
			...(existsSync(join(jsonDir, "report.json")) ? { jsonFile: `/report/${p.id}/${id}/json/report.json` } : {}),
			...(existsSync(join(htmlDir, "index.html")) ? { htmlFile: `/report/${p.id}/${id}/html/index.html` } : {}),
			...(existsSync(junit) ? { junitFile: `/report/${p.id}/${id}/junit.xml` } : {}),
		};
		writeAgentFile(join(dir, "result.json"), JSON.stringify(result, null, 2));
		log("info", "run.done", {
			project: p.id, id, files: result.files.length, failed: result.files.filter((f) => f.status === "fail").length,
			ms: result.duration, host: host || undefined,
		});
		pruneHistory(p);
		return result;
	} finally {
		running.delete(p.id);
	}
}
