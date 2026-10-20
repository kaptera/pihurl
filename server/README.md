# pihurl backend

Node + TypeScript + Hono backend for [pihurl](../README.md). Orchestrates
[`pi`](https://github.com/earendil-works/pi) (the coding agent, over RPC) and
[Hurl](https://hurl.dev) (the test runner), and streams chat to the browser over SSE.

## Stack

- **Node 22** (pi requires `>= 22.19.0`)
- **Hono** for routing + **`@hono/node-server`** for the HTTP server
- **SSE** (`hono/streaming`) for the chat event stream
- **`@earendil-works/pi-coding-agent`** installed from npm (provides the `pi` CLI)

## Layout

```
server/
├── src/
│   ├── config.ts    # env-driven config, provider/template/host stores, dir setup
│   ├── defaults.ts  # first-boot AGENTS.md, hurl-syntax skill, prompt templates
│   ├── pi.ts        # dependency-free RPC client for `pi --mode rpc`
│   ├── run.ts       # Hurl test runner (one hurl process per file, JSON/HTML/JUnit + history)
│   ├── testfiles.ts # lists the .hurl files under <workspace>/tests
│   ├── routes.ts    # all HTTP endpoints + web-ui static serving
│   └── server.ts    # entry point
├── package.json
└── tsconfig.json
```

## Endpoints

| Method | Path                    | Purpose                                                              |
|--------|-------------------------|----------------------------------------------------------------------|
| GET    | `/health`               | liveness probe                                                       |
| GET    | `/api/chat`             | SSE stream of every pi session event                                 |
| GET    | `/api/chat/state`       | is the agent mid-turn?                                               |
| GET    | `/api/info`             | versions (pihurl, Hurl, Node) and paths, shown on the Settings page  |
| GET    | `/api/chats`            | chat list: current id, titles, timestamps                            |
| POST   | `/api/chats`            | `action`: `new` / `switch` / `rename` / `delete` (`id`, `title`); switching and deleting the current chat restarts the agent |
| GET    | `/api/chat/history`     | messages of the current chat, read from pi's session (the UI redraws it on load) |
| POST   | `/api/chat`             | `kind`: `prompt` / `steer` / `follow_up`, `stop` (abort the run, keep context), `new` (fresh chat, or the empty current one) |
| GET    | `/api/specs`            | every spec in the workspace, parsed: title, server, endpoints, or an `error` |
| POST   | `/api/specs`            | upload a spec (`{name, content}`); validated, stored as `specs/<name>` |
| DELETE | `/api/specs?path=`      | delete a spec                                                        |
| GET    | `/api/providers`        | list providers (API keys masked) + defaults (Ollama URL)             |
| POST   | `/api/providers`        | save / activate / delete a provider (rewrites `models.json`, restarts the agent) |
| POST   | `/api/providers/test`   | real connectivity check; a blank key falls back to the stored one   |
| GET    | `/api/tests`            | the `.hurl` files in the workspace, with source                      |
| GET    | `/api/run`              | run history, newest first                                            |
| POST   | `/api/run`              | run Hurl tests now (executed directly by the backend, not pi); without a `host` it uses the current target |
| GET/POST | `/api/prompts`        | prompt templates (UI) + `AGENTS.md` (read by the agent)              |
| GET/POST | `/api/hosts`          | target host; the latest is mirrored to `<workspace>/hurl.env`        |
| GET    | `/report/*`             | static report files                                                  |
| GET    | `/*`                    | web-ui SPA assets (falls back to the entry file)                     |

There is no built-in auth in this build; keep the container behind your own
network controls (see the security notes in the main README). If you add a reverse proxy
or token later, gate it there.

## Workspace

pi runs with `<workspace>` as its working directory and `PI_CODING_AGENT_DIR=<workspace>/.pi`:

```
<workspace>/
├── AGENTS.md              # standing instructions (edited on the Prompts tab)
├── specs/*.yaml           # API specs: uploaded in the UI or written by the agent
├── hurl.env               # host=... — the agent runs hurl with --variables-file hurl.env
├── tests/**/*.hurl        # written by the agent
├── report/<run id>/       # json/, html/, junit.xml, result.json per run (last 50 kept)
├── providers.json         # providers incl. keys (state dir)
├── chats.json             # chat index: current chat, titles (state dir)
├── logs/pihurl.log        # application log, JSON lines (state dir)
└── .pi/
    ├── models.json        # generated from providers.json
    ├── sessions/*.jsonl   # pi's transcript of every chat (prompts, tool calls, results)
    ├── skills/hurl-syntax/SKILL.md
    ├── skills/openapi-spec/SKILL.md
    └── prompts/templates.json
```

Defaults (`AGENTS.md`, the two skills, the prompt templates) are written on first boot. A
newer build upgrades them only while they are untouched (same content as the last copy it
wrote, remembered in `<state>/defaults.json`); anything you edited is left alone.

## Specs

A spec is an OpenAPI 3 / Swagger 2 file (YAML or JSON) in `specs/`, or `openapi*.yaml` /
`swagger*.json` in the workspace root. The backend parses them on every listing, so the UI sees
files the agent wrote: after each agent turn the Spec tab reloads, and a spec that appeared during
the turn is selected. A spec that does not parse is listed with an `error`. The agent creates specs
with the `openapi-spec` skill (published spec first, otherwise docs and read-only probing) and checks
them with `curl localhost:3000/api/specs`. Selecting a spec that names an absolute server URL sets
the target host.

## Settings

The Settings tab holds per-browser preferences (kept in `localStorage`, nothing is stored on the
server): how tool-call cards are shown in the chat (fold when done — a failed call stays open —,
always folded, always open) and which key sends a message (Enter or Ctrl/Cmd+Enter). The chat header
also has a button that folds or unfolds every tool card at once. The page lists where the workspace,
the state, the log file and the chat sessions live.

## Tests grouped by spec

The Tests tab groups test files by the spec they exercise (`web-ui/grouping.js`). A file is assigned
to the spec whose endpoints (method + path) its requests hit; the most matches win and a tie goes
to the selected spec. A `# spec: specs/x.yaml` comment in the first lines of a file overrides that,
and files that match nothing are listed under "No spec". Each group has a tri-state checkbox that
selects all its files, can be collapsed and run as a whole; the header checkbox selects everything,
and the report lists results under the same group headings.

## Chats and logs

A chat is a pi session: its id is passed to pi as `--session-id`, and pi keeps the transcript
in `.pi/sessions/<time>_<id>.jsonl`, so chats survive provider changes, crashes and container
restarts. The UI's Chats menu lists them, switches between them (the agent is restarted on the
chosen session), renames and deletes them (which removes the transcript). A chat is titled
after its first prompt; an empty chat is not listed or kept, and "New chat" on an empty chat
reuses it. `chats.json` is only an index: sessions found on disk that it does not know are
imported, so the sessions folder is the source of truth.

`logs/pihurl.log` (5 MB x 4, rotated) holds one JSON object per line — and the same events
go to `docker logs` in a short readable form:

| event | meaning |
|-------|---------|
| `http` | every API call: method, path, status, ms |
| `agent.start` / `agent.exit` | pi spawned (chat, provider, model) / ended (code, signal, intentional) |
| `chat.user` / `chat.assistant` | prompt and reply text, stop reason, tokens, tool names, provider errors |
| `tool.start` / `tool.end` | tool name, args, output, duration, error flag |
| `agent.retry`, `agent.run.*`, `sse.*` | retries, turn boundaries, browser stream connects |
| `run.done` | test run summary |
| `provider.*`, `chat.new/switch/rename/delete` | configuration and chat changes (never keys) |

```bash
jq -c 'select(.event|test("chat|tool"))' work/logs/pihurl.log   # what the agent did
jq -c 'select(.level=="error")' work/logs/pihurl.log            # what went wrong
```

## Configuration (env)

| Variable           | Default                          | Meaning                                             |
|--------------------|----------------------------------|-----------------------------------------------------|
| `PORT`             | `3000`                           | HTTP port                                           |
| `PIHURL_STATE`     | `~/.pihurl`                      | Root of all persistent state (mount as a volume)    |
| `WORKSPACE`        | `$PIHURL_STATE/workspace`        | Working folder pi operates in (`/workspace`)        |
| `WEB_UI_DIR`       | `$PIHURL_STATE/web-ui`           | Where the web-ui SPA is served from                 |
| `PI_CLI_PATH`      | *(auto-resolved)*                | Override the pi CLI path                            |
| `OLLAMA_HOST`      | `http://localhost:11434`         | Base URL offered by the Ollama preset (in Docker use `http://host.docker.internal:11434`) |

`piCliPath` resolves automatically: `PI_CLI_PATH` → the installed package's bundled
`cli.js` → `node_modules/.bin/pi`. Hurl must be on `PATH` (the Docker image has it).

## Development

```bash
npm ci        # install deps (pulls pi-coding-agent from npm)
npm run build # tsc -> dist/
npm start     # node dist/server.js
# or, from the repo root with the web-ui next to it:
WEB_UI_DIR=../web-ui PORT=3000 npm start
```

`npm run dev` uses `tsx` for hot reload; `npm run typecheck` runs `tsc --noEmit`; `npm test` builds
and runs the tests in `test/` (spec parser, spec files, default seeding).

The web UI is plain files in `web-ui/` (no build step). Agent answers are rendered by
`markdown.js`, a small escaping Markdown renderer; its tests run with
`node --test web-ui/*.test.js` (also covers the test-file grouping).

## RPC protocol notes

The pi client (`src/pi.ts`) speaks the RPC-mode protocol directly
([docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)):

- Strict **JSONL** framing on stdin/stdout, terminated by LF. Node's `readline`
  must **not** be used — it splits on U+2028/U+2029, which are valid inside JSON.
- Commands carry an optional `id`; the matching `response` repeats it, so the
  client correlates by id rather than order.
- A `prompt` response only means "accepted"; the turn streams as events
  (`message_update` with `text_delta`, `tool_execution_*`, `agent_settled`, …),
  all forwarded to connected browsers as SSE frames. Provider failures arrive as a
  `message_end` with `stopReason: "error"`, not as a command error.
- A prompt while the agent streams is rejected; the UI sends it as a `steer`.

## Tests

Tests are run by the backend via Hurl, **not** by the agent — this keeps results
reproducible regardless of the model.

Hurl runs once per file with shared `--report-*` directories: a parse error then only
fails that file, and runtime errors (connection refused, failed capture), which Hurl
reports on stderr only, are attached to the file that caused them.
