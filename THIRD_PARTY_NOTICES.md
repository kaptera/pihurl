# Third-party notices

pihurl is MIT licensed (see `LICENSE`). It uses, and its Docker image contains, the following
third-party software. Each keeps its own license.

| Component | Used for | License |
|---|---|---|
| [pi](https://github.com/earendil-works/pi) (`@earendil-works/pi-coding-agent`) | the coding agent, run as a subprocess in RPC mode | MIT |
| [Hurl](https://hurl.dev) | runs the HTTP tests and writes the reports (binary in the image) | Apache-2.0 |
| [Hono](https://hono.dev), `@hono/node-server` | HTTP server | MIT |
| [yaml](https://eemeli.org/yaml/) | parsing OpenAPI documents | ISC |
| [Node.js](https://nodejs.org) | runtime in the image | MIT |
| Debian packages (`bash`, `git`, `ripgrep`, `curl`, …) | base image and agent tooling | their respective licenses |

Development only: TypeScript (Apache-2.0), tsx (MIT), Playwright (Apache-2.0, for the browser tests).

The transitive npm dependencies are listed with their licenses in `server/package-lock.json`;
at the time of writing they are all permissive (MIT, Apache-2.0, BSD-3-Clause, ISC, BlueOak-1.0.0,
Unlicense, 0BSD).

## Icons

The inline SVG icons (`web-ui/js/core.js`) are simple stroke icons, drawn in the style of
[Feather](https://feathericons.com) and [Lucide](https://lucide.dev). They were compared with both
sets: none is a verbatim copy, but several follow a Feather or Lucide shape closely (for example the
pencil, gear, copy, file, lock, chevron and arrow icons). They are treated as derived works, and the
licenses of both projects are reproduced here as they require.

Feather (MIT):

> The MIT License (MIT)
>
> Copyright (c) 2013-2023 Cole Bemis
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
> OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Lucide (ISC):

> ISC License
>
> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
> All other copyright (c) for Lucide are held by Lucide Contributors 2022.
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without
> fee is hereby granted, provided that the above copyright notice and this permission notice appear
> in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
> SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
> AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
> NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
> OF THIS SOFTWARE.

## Not affiliated

pihurl is an independent project. It is not affiliated with or endorsed by the authors of pi or
Hurl (Orange), or by any LLM provider it can talk to.
