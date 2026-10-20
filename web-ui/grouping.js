/**
 * Which API spec does a test file belong to?
 *
 * Tests are not labelled, so a file is assigned to the spec whose endpoints its
 * requests hit (method + path, `{param}` and `{{variable}}` segments match
 * anything); the spec with the most matching requests wins. A `# spec: specs/x.yaml`
 * comment near the top of a file overrides that. Files that match nothing (absolute
 * URLs, an API without a spec) are "unassigned".
 *
 * groupFiles(files, specs, preferred) -> [{ specPath, title, files }] where each file
 * gets `dir`, its folder below tests/. Groups follow `specs` order except that the
 * `preferred` spec (the active one) comes first; unassigned is last.
 */
(function (root) {
	const REQUEST = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/;

	const cache = new WeakMap();

	/** Regex for the path template of an endpoint. */
	function endpointRegex(ep) {
		let re = cache.get(ep);
		if (!re) {
			re = new RegExp("^" + ep.p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+") + "/?$");
			cache.set(ep, re);
		}
		return re;
	}

	/** [{m, path}] of the requests in a Hurl source, base URL variable and query removed. */
	function requestsOf(src) {
		const out = [];
		for (const line of String(src).split("\n")) {
			const m = line.match(REQUEST);
			if (m) out.push({ m: m[1], path: m[2].replace(/^\{\{host\}\}/, "").split("?")[0] });
		}
		return out;
	}

	function specOverride(src) {
		const head = String(src).split("\n").slice(0, 20).join("\n");
		const m = head.match(/^\s*#\s*spec:\s*(\S+)/im);
		return m ? m[1] : "";
	}

	/** Path of the spec a file belongs to, or "". */
	function assignSpec(file, specs, preferred) {
		const usable = specs.filter((s) => !s.error && s.endpoints && s.endpoints.length);
		const forced = specOverride(file.src);
		if (forced && specs.some((s) => s.path === forced)) return forced;
		const reqs = requestsOf(file.src);
		let best = "";
		let bestScore = 0;
		for (const s of usable) {
			let score = 0;
			for (const r of reqs) if (s.endpoints.some((e) => e.m === r.m && endpointRegex(e).test(r.path))) score++;
			// a tie goes to the preferred spec, then to the earlier one
			if (score > bestScore || (score === bestScore && score > 0 && s.path === preferred)) {
				best = s.path;
				bestScore = score;
			}
		}
		return best;
	}

	function dirOf(path) {
		const rel = path.replace(/^tests\//, "");
		return rel.includes("/") ? rel.split("/")[0] : ".";
	}

	function groupFiles(files, specs, preferred) {
		const byPath = new Map();
		for (const f of files) {
			const sp = assignSpec(f, specs, preferred);
			if (!byPath.has(sp)) byPath.set(sp, []);
			byPath.get(sp).push({ ...f, dir: dirOf(f.path) });
		}
		const order = [...specs].sort((a, b) => (b.path === preferred) - (a.path === preferred));
		const groups = [];
		for (const s of order) {
			if (byPath.has(s.path)) groups.push({ specPath: s.path, title: s.title || s.name || s.path, files: sortFiles(byPath.get(s.path)) });
		}
		// files that name a spec which is gone, and files that match none
		for (const [sp, list] of byPath) if (sp === "" || !order.some((s) => s.path === sp)) groups.push({ specPath: "", title: "", files: sortFiles(list) });
		return mergeUnassigned(groups);
	}

	function sortFiles(list) {
		return list.sort((a, b) => (a.dir === b.dir ? a.path.localeCompare(b.path) : a.dir.localeCompare(b.dir)));
	}

	function mergeUnassigned(groups) {
		const real = groups.filter((g) => g.specPath);
		const rest = groups.filter((g) => !g.specPath).flatMap((g) => g.files);
		return rest.length ? [...real, { specPath: "", title: "", files: sortFiles(rest) }] : real;
	}

	const api = { groupFiles, assignSpec, requestsOf, specOverride, endpointRegex };
	if (typeof module !== "undefined" && module.exports) module.exports = api;
	else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
