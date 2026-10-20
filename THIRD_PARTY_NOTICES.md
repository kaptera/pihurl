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

The inline SVG icons in `web-ui/app.js` are drawn in the style of, and in part adapted from,
[Feather](https://feathericons.com) (MIT) and [Lucide](https://lucide.dev) (ISC):

> The MIT License (MIT) — Copyright (c) 2013-2023 Cole Bemis
>
> ISC License — Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
> Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

## Not affiliated

pihurl is an independent project. It is not affiliated with or endorsed by the authors of pi or
Hurl (Orange), or by any LLM provider it can talk to.
