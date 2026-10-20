import { existsSync, readdirSync, readFileSync, statSync, Stats } from "node:fs";
import { join } from "node:path";
import type { Project } from "./projects.js";

/**
 * Lists the Hurl test files under <workspace>/tests.
 *
 * The agent (pi) owns these files; the backend only reads and runs them.
 * Each entry carries its workspace-relative path, a group derived from the
 * first path segment (`<tag>` or `.`), and the raw source so the UI can show
 * the file without a second round-trip.
 */

export interface TestFile {
	/** workspace-relative path, e.g. tests/auth/login.hurl */
	path: string;
	/** first path segment, or "." for top-level files */
	group: string;
	/** raw .hurl source */
	src: string;
}

function isHurl(p: string): boolean {
	return /\.(hurl|http)$/.test(p);
}

export function listTestFiles(p: Project): TestFile[] {
	const dir = join(p.dir, "tests");
	if (!existsSync(dir)) return [];

	const out: TestFile[] = [];
	const walk = (base: string, prefix: string): void => {
		let entries: string[];
		try {
			entries = readdirSync(base);
		} catch {
			return;
		}
		for (const name of entries.sort()) {
			const abs = join(base, name);
			let st: Stats;
			try {
				st = statSync(abs);
			} catch {
				continue;
			}
			if (st.isDirectory()) walk(abs, `${prefix}${name}/`);
			else if (isHurl(name)) {
				const rel = `${prefix}${name}`;
				// prefix starts at "tests/"; the group is the first subdirectory (or
				// "." for top-level files directly under tests/).
				const rest = prefix.slice("tests/".length);
				try {
					out.push({ path: rel, group: rest ? rest.split("/")[0] : ".", src: readFileSync(abs, "utf8") });
				} catch {
					// ignore unreadable file
				}
			}
		}
	};
	walk(dir, "tests/");
	return out;
}

export function testFilesExist(p: Project): boolean {
	return listTestFiles(p).length > 0;
}
