/**
 * Small Markdown renderer for agent output.
 *
 * The text comes from a model (and from files and API responses it quotes), so it is
 * treated as hostile: everything is HTML-escaped first and only tags produced here
 * are emitted. Links are limited to http(s), mailto, relative and #anchor targets.
 *
 * Supported: headings, paragraphs (a single newline is a line break, as in a chat),
 * fenced code with a highlight hook, inline code, bold, italic, strikethrough,
 * links and bare URLs, blockquotes, ordered/unordered/nested lists, task items,
 * tables with alignment, horizontal rules. An unterminated code fence is closed at
 * the end of the text, so a half-streamed answer renders sensibly.
 *
 * renderMarkdown(text, { highlight(lang, code) -> html | null })
 */
(function (root) {
	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

	const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

	function inline(src) {
		const stash = [];
		const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
		let s = String(src);

		// Code spans first: nothing inside them is interpreted.
		s = s.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, __, code) => keep(`<code>${esc(code.trim())}</code>`));
		s = esc(s);

		// Links: [text](url "title")
		s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (m, text, url) => {
			const u = url.replace(/&amp;/g, "&");
			return SAFE_URL.test(u) ? keep(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${text}</a>`) : m;
		});
		// Bare URLs (not already inside a link we stashed).
		s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?'"])/g, (_, pre, url) =>
			`${pre}${keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)}`);

		s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
		s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>");
		s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, "$1<em>$2</em>");
		s = s.replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w])/g, "$1<em>$2</em>");
		s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");

		return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
	}

	const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-") && l.includes("|");
	const splitRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

	function table(head, sep, rows) {
		const align = splitRow(sep).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : /^:-+/.test(c) ? "left" : ""));
		const cell = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ""}>${inline(c)}</${tag}>`;
		return `<div class="mdtable"><table><thead><tr>${splitRow(head).map((c, i) => cell("th", c, i)).join("")}</tr></thead><tbody>${rows
			.map((r) => `<tr>${splitRow(r).map((c, i) => cell("td", c, i)).join("")}</tr>`)
			.join("")}</tbody></table></div>`;
	}

	const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

	/** Render consecutive list lines starting at lines[i]; returns [html, nextIndex]. */
	function list(lines, i, indent) {
		const first = lines[i].match(LIST_ITEM);
		const ordered = /\d/.test(first[2]);
		let html = "";
		while (i < lines.length) {
			const m = lines[i].match(LIST_ITEM);
			if (!m || m[1].length < indent) break;
			if (m[1].length > indent) {
				// A deeper item belongs to the previous <li>.
				const [sub, next] = list(lines, i, m[1].length);
				html = html.replace(/<\/li>$/, `${sub}</li>`);
				i = next;
				continue;
			}
			if (/\d/.test(m[2]) !== ordered) break;
			let body = m[3];
			const task = body.match(/^\[([ xX])\]\s+(.*)$/);
			let prefix = "";
			if (task) {
				prefix = `<input type="checkbox" disabled${task[1] !== " " ? " checked" : ""}> `;
				body = task[2];
			}
			html += `<li>${prefix}${inline(body)}</li>`;
			i++;
		}
		return [`<${ordered ? "ol" : "ul"}>${html}</${ordered ? "ol" : "ul"}>`, i];
	}

	function renderMarkdown(text, opts) {
		const highlight = opts && opts.highlight;
		const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
		const out = [];
		let para = [];
		const flush = () => {
			if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
			para = [];
		};

		for (let i = 0; i < lines.length; ) {
			const line = lines[i];

			const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+-]*)[^\n]*$/);
			if (fence) {
				flush();
				const marker = fence[1][0];
				const body = [];
				i++;
				while (i < lines.length && !new RegExp(`^\\s*${marker}{${fence[1].length},}\\s*$`).test(lines[i])) body.push(lines[i++]);
				i++; // closing fence (or the end of a half-streamed block)
				const code = body.join("\n");
				const lang = fence[2].toLowerCase();
				const hl = highlight && highlight(lang, code);
				out.push(`<pre class="mdcode"><code${lang ? ` data-lang="${esc(lang)}"` : ""}>${hl != null ? hl : esc(code)}</code></pre>`);
				continue;
			}

			if (!line.trim()) {
				flush();
				i++;
				continue;
			}

			const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
			if (h) {
				flush();
				out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
				i++;
				continue;
			}

			if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
				flush();
				out.push("<hr>");
				i++;
				continue;
			}

			if (/^\s*>/.test(line)) {
				flush();
				const quote = [];
				while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
				out.push(`<blockquote>${renderMarkdown(quote.join("\n"), opts)}</blockquote>`);
				continue;
			}

			if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]) && splitRow(line).length > 1) {
				flush();
				const rows = [];
				const head = line;
				const sep = lines[i + 1];
				i += 2;
				while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(lines[i++]);
				out.push(table(head, sep, rows));
				continue;
			}

			if (LIST_ITEM.test(line)) {
				flush();
				const [html, next] = list(lines, i, line.match(LIST_ITEM)[1].length);
				out.push(html);
				i = next;
				continue;
			}

			para.push(line);
			i++;
		}
		flush();
		return out.join("");
	}

	if (typeof module !== "undefined" && module.exports) module.exports = { renderMarkdown };
	else root.renderMarkdown = renderMarkdown;
})(typeof window !== "undefined" ? window : globalThis);
