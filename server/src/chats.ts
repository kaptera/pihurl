import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirAgent } from "./agent.js";
import { config } from "./config.js";

/**
 * Chats.
 *
 * A chat is a pi session. Its id is handed to pi as `--session-id`, and pi keeps the
 * transcript in <agentDir>/sessions/<timestamp>_<id>.jsonl, so a chat survives agent
 * restarts (provider change, crash) and container restarts.
 *
 * <state>/chats.json is only an index for the UI — the current chat, titles and
 * timestamps. Sessions found on disk that the index does not know (older builds, a
 * copied volume) are imported, so the sessions folder stays the source of truth.
 * A chat nobody has written to yet is not listed and not kept: "new chat" twice
 * in a row reuses the empty one.
 */

export interface ChatInfo {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

interface Index {
	current: string;
	chats: ChatInfo[];
}

const INDEX_FILE = join(config.stateDir, "chats.json");
const LEGACY_FILE = join(config.stateDir, "chat.json");

export const sessionsDir = join(config.agentDir, "sessions");

const ID_RE = /^[A-Za-z0-9][\w.-]*[A-Za-z0-9]$/;
const TITLE_MAX = 60;

export function ensureSessionsDir(): void {
	mkdirAgent(sessionsDir);
}

function sessionFile(id: string): string | undefined {
	try {
		const f = readdirSync(sessionsDir).find((n) => n.endsWith(`_${id}.jsonl`));
		return f ? join(sessionsDir, f) : undefined;
	} catch {
		return undefined;
	}
}

function oneLine(text: string): string {
	const t = text.replace(/\s+/g, " ").trim();
	return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

/** First user message of a session file (reads only its head), for titles of imported chats. */
function firstUserText(file: string): string {
	const fd = openSync(file, "r");
	try {
		const buf = Buffer.alloc(256 * 1024);
		const n = readSync(fd, buf, 0, buf.length, 0);
		for (const line of buf.subarray(0, n).toString("utf8").split("\n")) {
			if (!line.includes('"role":"user"')) continue;
			try {
				const m = (JSON.parse(line) as { message?: { role?: string; content?: unknown } }).message;
				if (m?.role !== "user") continue;
				const c = m.content;
				return typeof c === "string" ? c : (c as { text?: string }[]).map((b) => b.text ?? "").join("");
			} catch {
				/* cut-off last line of the head */
			}
		}
		return "";
	} finally {
		closeSync(fd);
	}
}

function load(): Index {
	let idx: Index;
	try {
		idx = JSON.parse(readFileSync(INDEX_FILE, "utf8")) as Index;
		if (!Array.isArray(idx.chats)) throw new Error("bad index");
	} catch {
		idx = { current: "", chats: [] };
		try {
			// Builds before the chat list kept only the current id.
			const legacy = (JSON.parse(readFileSync(LEGACY_FILE, "utf8")) as { id?: string }).id;
			if (legacy && ID_RE.test(legacy)) idx.current = legacy;
		} catch {
			/* first run */
		}
	}

	// Import sessions on disk that the index does not know.
	try {
		const known = new Set(idx.chats.map((c) => c.id));
		for (const name of readdirSync(sessionsDir)) {
			const m = name.match(/^(.*)_([A-Za-z0-9][\w.-]*[A-Za-z0-9])\.jsonl$/);
			if (!m || known.has(m[2])) continue;
			const file = join(sessionsDir, name);
			const title = oneLine(firstUserText(file));
			if (!title && m[2] !== idx.current) continue; // never written to
			const st = statSync(file);
			idx.chats.push({ id: m[2], title, createdAt: st.birthtimeMs || st.mtimeMs, updatedAt: st.mtimeMs });
		}
	} catch {
		/* no sessions folder yet */
	}

	if (!idx.current || !ID_RE.test(idx.current)) idx.current = newestId(idx) ?? "";
	if (!idx.current) {
		const now = Date.now();
		idx.current = `chat-${randomUUID()}`;
		idx.chats.push({ id: idx.current, title: "", createdAt: now, updatedAt: now });
	}
	if (!idx.chats.some((c) => c.id === idx.current)) {
		const now = Date.now();
		idx.chats.push({ id: idx.current, title: "", createdAt: now, updatedAt: now });
	}
	return idx;
}

function newestId(idx: Index): string | undefined {
	return [...idx.chats].filter((c) => c.title).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id;
}

function save(idx: Index): void {
	mkdirSync(config.stateDir, { recursive: true });
	writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

/** Forget `id` if nothing was ever written to it. */
function dropIfEmpty(idx: Index, id: string): void {
	const c = idx.chats.find((x) => x.id === id);
	if (c && !c.title && !sessionFile(id)) idx.chats = idx.chats.filter((x) => x.id !== id);
}

export function currentChatId(): string {
	const idx = load();
	save(idx);
	return idx.current;
}

/** Chats to show, newest first. The current one is always listed, even when empty. */
export function listChats(): { current: string; chats: ChatInfo[] } {
	const idx = load();
	save(idx);
	const chats = idx.chats
		.filter((c) => c.title || c.id === idx.current)
		.sort((a, b) => b.updatedAt - a.updatedAt);
	return { current: idx.current, chats };
}

/** Start a fresh conversation (or stay in the current one if it is still empty). */
export function newChat(): string {
	const idx = load();
	const cur = idx.chats.find((c) => c.id === idx.current);
	if (cur && !cur.title) return idx.current;
	const now = Date.now();
	const id = `chat-${randomUUID()}`;
	idx.chats.push({ id, title: "", createdAt: now, updatedAt: now });
	idx.current = id;
	save(idx);
	return id;
}

export function switchChat(id: string): boolean {
	const idx = load();
	if (!idx.chats.some((c) => c.id === id)) return false;
	if (idx.current !== id) {
		const prev = idx.current;
		idx.current = id;
		dropIfEmpty(idx, prev);
	}
	save(idx);
	return true;
}

export function renameChat(id: string, title: string): boolean {
	const idx = load();
	const c = idx.chats.find((x) => x.id === id);
	const t = oneLine(title);
	if (!c || !t) return false;
	c.title = t;
	save(idx);
	return true;
}

/** Delete a chat and its transcript. Returns the id that is current afterwards. */
export function deleteChat(id: string): string {
	const idx = load();
	const file = sessionFile(id);
	if (file) rmSync(file, { force: true });
	idx.chats = idx.chats.filter((c) => c.id !== id);
	if (idx.current === id) idx.current = newestId(idx) ?? "";
	save(idx);
	// If that was the last chat, load() starts an empty one.
	const after = load();
	save(after);
	return after.current;
}

/** The user wrote to this chat: name it after the first prompt, bump its time. */
export function touchChat(id: string, text?: string): void {
	const idx = load();
	const c = idx.chats.find((x) => x.id === id);
	if (!c) return;
	if (!c.title && text) c.title = oneLine(text);
	c.updatedAt = Date.now();
	save(idx);
}
