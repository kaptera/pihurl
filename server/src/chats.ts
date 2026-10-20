import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirAgent } from "./agent.js";
import type { Project } from "./projects.js";

/**
 * Chats of a project.
 *
 * A chat is a pi session. Its id is handed to pi as `--session-id`, and pi keeps the
 * transcript in <project>/.pi/sessions/<timestamp>_<id>.jsonl, so a chat survives agent
 * restarts (provider change, crash, idle shutdown) and container restarts.
 *
 * <project state>/chats.json is only an index for the UI (titles and timestamps). Sessions found
 * on disk that the index does not know (older builds, a copied volume) are imported, so the
 * sessions folder stays the source of truth. A chat nobody has written to yet is not listed.
 *
 * There is no "current" chat on the server: each browser tab says which chat it works on, and
 * several chats can run at the same time (agents.ts).
 */

export interface ChatInfo {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

interface Index {
	chats: ChatInfo[];
}

const ID_RE = /^chat-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const TITLE_MAX = 60;

export function validChatId(id: unknown): id is string {
	return typeof id === "string" && ID_RE.test(id);
}

export function newChatId(): string {
	return `chat-${randomUUID()}`;
}

export function ensureSessionsDir(p: Project): void {
	mkdirAgent(p.sessionsDir);
}

function sessionFile(p: Project, id: string): string | undefined {
	try {
		const f = readdirSync(p.sessionsDir).find((n) => n.endsWith(`_${id}.jsonl`));
		return f ? join(p.sessionsDir, f) : undefined;
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

function load(p: Project): Index {
	let idx: Index = { chats: [] };
	try {
		const raw = JSON.parse(readFileSync(p.chatsPath, "utf8")) as Partial<Index>;
		if (Array.isArray(raw.chats)) idx = { chats: raw.chats.filter((c) => validChatId(c?.id)) };
	} catch {
		/* first start */
	}

	// Import sessions on disk that the index does not know.
	try {
		const known = new Set(idx.chats.map((c) => c.id));
		for (const name of readdirSync(p.sessionsDir)) {
			const m = name.match(/^(.*)_(chat-[0-9a-f-]+)\.jsonl$/);
			if (!m || !validChatId(m[2]) || known.has(m[2])) continue;
			const file = join(p.sessionsDir, name);
			const title = oneLine(firstUserText(file));
			if (!title) continue; // never written to
			const st = statSync(file);
			idx.chats.push({ id: m[2], title, createdAt: st.birthtimeMs || st.mtimeMs, updatedAt: st.mtimeMs });
		}
	} catch {
		/* no sessions folder yet */
	}
	return idx;
}

function save(p: Project, idx: Index): void {
	mkdirSync(p.stateDir, { recursive: true });
	writeFileSync(p.chatsPath, JSON.stringify(idx, null, 2));
}

/** Chats to show, newest first. */
export function listChats(p: Project): ChatInfo[] {
	const idx = load(p);
	save(p, idx);
	return [...idx.chats].filter((c) => c.title).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function chatExists(p: Project, id: string): boolean {
	return load(p).chats.some((c) => c.id === id) || !!sessionFile(p, id);
}

export function renameChat(p: Project, id: string, title: string): boolean {
	const idx = load(p);
	const c = idx.chats.find((x) => x.id === id);
	const t = oneLine(title);
	if (!c || !t) return false;
	c.title = t;
	save(p, idx);
	return true;
}

/** Delete a chat and its transcript. Stop its agent first (the agent holds the file open). */
export function deleteChat(p: Project, id: string): boolean {
	const idx = load(p);
	const file = sessionFile(p, id);
	const known = idx.chats.some((c) => c.id === id);
	if (!known && !file) return false;
	if (file) rmSync(file, { force: true });
	idx.chats = idx.chats.filter((c) => c.id !== id);
	save(p, idx);
	return true;
}

/** The user wrote to this chat: create its entry on the first prompt, name it, bump its time. */
export function touchChat(p: Project, id: string, text?: string): void {
	const idx = load(p);
	let c = idx.chats.find((x) => x.id === id);
	if (!c) {
		const now = Date.now();
		c = { id, title: "", createdAt: now, updatedAt: now };
		idx.chats.push(c);
	}
	if (!c.title && text) c.title = oneLine(text);
	c.updatedAt = Date.now();
	save(p, idx);
}

export function sessionExists(p: Project, id: string): boolean {
	return existsSync(p.sessionsDir) && !!sessionFile(p, id);
}
