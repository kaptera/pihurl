import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * Application log: one JSON object per line in <state>/logs/pihurl.log (what to
 * grep or feed to jq), and a short readable line on stdout (`docker logs`).
 *
 *   {"ts":"2026-10-20T01:02:03.456Z","level":"info","event":"chat.prompt","len":27,"text":"..."}
 *
 * Secrets never go in here: callers log provider names and models, not keys.
 * The file rotates at 5 MB and keeps three old copies.
 */

type Level = "debug" | "info" | "warn" | "error";

const LOG_DIR = join(config.stateDir, "logs");
const LOG_FILE = join(LOG_DIR, "pihurl.log");
const MAX_BYTES = 5 * 1024 * 1024;
const KEEP = 3;

let ready = false;
let written = 0;

function open(): void {
	if (ready) return;
	mkdirSync(LOG_DIR, { recursive: true });
	written = existsSync(LOG_FILE) ? statSync(LOG_FILE).size : 0;
	ready = true;
}

function rotate(): void {
	rmSync(`${LOG_FILE}.${KEEP}`, { force: true });
	for (let i = KEEP - 1; i >= 1; i--) {
		if (existsSync(`${LOG_FILE}.${i}`)) renameSync(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`);
	}
	renameSync(LOG_FILE, `${LOG_FILE}.1`);
	written = 0;
}

/** Cut long strings (prompts, tool output) so one record stays a readable line. */
export function clip(value: unknown, max = 400): string {
	const s = typeof value === "string" ? value : JSON.stringify(value) ?? "";
	return s.length > max ? `${s.slice(0, max)}… (+${s.length - max})` : s;
}

export function log(level: Level, event: string, data: Record<string, unknown> = {}): void {
	const rec = { ts: new Date().toISOString(), level, event, ...data };
	const line = JSON.stringify(rec);
	try {
		open();
		if (written + line.length > MAX_BYTES) rotate();
		appendFileSync(LOG_FILE, `${line}\n`);
		written += line.length + 1;
	} catch {
		/* logging must never take the server down */
	}
	const rest = Object.entries(data)
		.map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(clip(v, 160)) : clip(v, 160)}`)
		.join(" ");
	const out = `${rec.ts.slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${event}${rest ? ` ${rest}` : ""}`;
	(level === "error" || level === "warn" ? console.error : console.log)(out);
}

export const logFile = LOG_FILE;
