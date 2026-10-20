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
│   ├── projects.ts  # projects: registry, per-project paths (workspace, sessions, state)
│   ├── agents.ts    # pool of pi agents, one per chat (limits, idle shutdown, events)
│   ├── chats.ts     # per-project chat index
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
| GET    | `/api/chat`             | SSE stream of the project's pi events, every one tagged with its `chat`; starts with a `pihurl_running` snapshot and sends `pihurl_busy` when a chat starts or stops working |
| GET    | `/api/chat/state`       | which chats of the project are mid-turn                              |
| GET    | `/api/projects`         | list projects                                                        |
| POST   | `/api/projects`         | `action`: `create` / `rename` / `delete` (`id`, `name`); `default` cannot be deleted |
| GET    | `/api/info`             | versions, paths, and whether the token and agent isolation are on, for the Settings page |
| GET/POST/DELETE | `/api/session` | sign-in state / sign in with the token / sign out (public)           |
| GET    | `/api/chats`            | chat list: ids, titles, timestamps, which are running                |
| POST   | `/api/chats`            | `action`: `new` (returns the new `id`) / `rename` / `delete` (`id`, `title`); deleting stops that chat's agent |
| GET    | `/api/chat/history?chat=` | messages of a chat, read from pi's session (the UI redraws it on load) |
| POST   | `/api/chat`             | `{chat, kind, message}`; `kind`: `prompt` / `steer` / `follow_up`, `stop` (abort the run, keep context); `429 too_many_agents` when every agent slot is busy |
| GET    | `/api/specs`            | every spec in the workspace, parsed: title, server, endpoints, or an `error` |
| POST   | `/api/specs`            | upload a spec (`{name, content}`); validated, stored as `specs/<name>` |
| DELETE | `/api/specs?path=`      | delete a spec                                                        |
| GET    | `/api/providers`        | list providers (API keys masked) + defaults (Ollama URL)             |
| POST   | `/api/providers`        | save / activate / delete a provider (rewrites `models.json`, restarts the agent); `temperature` (0 to 2) and `contextWindow` (tokens) are optional, `null` clears them |
| POST   | `/api/providers/test`   | real connectivity check; a blank key falls back to the stored one   |
| GET    | `/api/tests`            | the `.hurl` files in the workspace, with source                      |
| GET    | `/api/run`              | run history, newest first                                            |
| POST   | `/api/run`              | run Hurl tests now (executed directly by the backend, not pi); without a `host` it uses the current target |
| GET/POST | `/api/prompts`        | prompt templates (UI) + `AGENTS.md` (read by the agent)              |
| GET/POST | `/api/hosts`          | target host; the latest is mirrored to `<workspace>/hurl.env`        |
| GET    | `/report/<project>/<run>/*` | static report files (`/report/<run>/*` still serves the default project) |
| GET    | `/*`                    | web-ui SPA assets (falls back to the entry file)                     |

All `/api/*` endpoints except `/api/projects` and `/api/session` act on one project, named by the
`X-Pihurl-Project` header (or `?project=`); without it the `default` project is used and an unknown id is
`404 unknown_project`. Access control is described under "Access control" below.

## Projects

A project is an isolated workspace: its own specs, tests, reports, `AGENTS.md`, skills, target host, chats
and agent settings. The registry is `<state>/projects.json`. `default` is the workspace root itself (so
workspaces from earlier versions are simply the default project); every other project lives in
`<workspace>/.projects/<id>` with its own `.pi/`. Ids are lowercase letters, digits and dashes. Provider
settings (and their keys), the access token and the log are shared by all projects. The UI keeps the selected
project per browser tab, so two tabs can work in two projects.

## Chats run in parallel

Each chat has its own pi process, started on its first prompt and kept in a pool (`agents.ts`). Chats
therefore run at the same time, also across tabs and projects, and a chat keeps working when the UI looks at
another one. `PIHURL_MAX_AGENTS` (default 4) caps the number of processes: when it is reached, an idle agent
(least recently used) is stopped to make room, and if all are mid-turn the prompt is refused with
`429 too_many_agents`. An agent idle for `PIHURL_AGENT_IDLE_MINUTES` (default 15) is stopped; the chat stays,
and the next prompt starts a fresh process on the same session. A provider change stops idle agents at once
and busy ones when their turn ends.

## Workspace and state

pi runs with the project's folder as its working directory and `PI_CODING_AGENT_DIR=<project>/.pi`. The tree below
is the `default` project (the workspace root). The server's own files are kept apart in `PIHURL_STATE`, which the
agent cannot read:

```
<workspace>/                    owned by the agent user
├── AGENTS.md                   standing instructions (edited on the Prompts tab)
├── specs/*.yaml                API specs: uploaded in the UI or written by the agent
├── hurl.env                    host=... — the agent runs hurl with --variables-file hurl.env
├── tests/**/*.hurl             written by the agent
├── report/<run id>/            json/, html/, junit.xml, result.json per run (last 50 kept)
└── .pi/
    ├── models.json             generated: points pi at the loopback model proxy, placeholder key
    ├── sessions/*.jsonl        pi's transcript of every chat (prompts, tool calls, results)
    ├── skills/{hurl-syntax,openapi-spec}/SKILL.md
    └── prompts/templates.json

<state>/                        root only (0700) in the image
├── providers.json              providers including their API keys
├── projects.json               project registry (`default` is implicit)
├── projects/<id>/              per project: chats.json (chat index), hosts.json, defaults.json
└── logs/pihurl.log             application log, JSON lines
```

Files the server creates in the workspace are chowned to the agent user so that it can edit them. A workspace
from an older version, which kept the state files in the workspace or in the state root, is migrated once at
start: provider keys and logs go to `<state>`, chats, hosts and defaults to `<state>/projects/default/`.

## Model settings

A provider can carry two optional settings, both written to the model's entry in the agent's `models.json`:

- **Temperature** becomes `samplingParams.temperature`, which pi sends with every request to OpenAI-compatible
  APIs (it is ignored for Anthropic, and the UI says so). Unset means the model's own default, which is what
  you want for reasoning models that reject a temperature.
- **Context window** becomes the model's `contextWindow`. pi uses it to decide when to summarize old turns and to
  show usage. It does not configure the model server: Ollama's OpenAI endpoint ignores `num_ctx`, so set the same
  size with `OLLAMA_CONTEXT_LENGTH` or in a Modelfile, or Ollama cuts the prompt at its own default and the agent
  loses the start of the conversation without an error.

## Isolation of the agent

When the server runs as root and `PIHURL_AGENT_UID` is set (the image does), `pi` and `hurl` are started as
that user, with an environment built from an allow-list (`PATH`, `LANG`, `TZ`, `HOME`, plus `PI_CODING_AGENT_DIR`
and `PIHURL_INTERNAL_URL`) instead of the server's own. `/state` is `0700 root`, and processes of another
uid cannot read `/proc/<server pid>/environ`, so neither the provider keys nor the access token are reachable
from the agent's shell. The server refuses to start if `PIHURL_STATE` is inside `WORKSPACE` in this mode.

The agent needs two things from the server, which it gets on a separate, loopback-only listener
(`127.0.0.1:PIHURL_INTERNAL_PORT`, `internal.ts`): the **model proxy** `/llm/<provider>/…`, which forwards pi's
requests to the provider's real endpoint and adds the real API key (only for paths below the provider's own
base path), and `GET /p/<project>/api/specs`, which the `openapi-spec` skill uses to check the specs the agent wrote.

## Access control

`security.ts` runs in front of every request (also the streaming `/api/chat`, which is served outside
Hono): with `PIHURL_TOKEN` it requires a bearer token or the session cookie (an HMAC derived from the token;
`POST /api/session` exchanges the token for it, 10 failures per address per 5 minutes) for everything but
the UI's own files, `/health` and `/api/session`; without a token it only answers to the allowed host names;
state-changing requests with a foreign `Origin` are always refused.

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
in `<project>/.pi/sessions/<time>_<id>.jsonl`, so chats survive provider changes, crashes and container
restarts. The UI's Chats menu lists the project's chats with a spinner on those that are working, switches
between them (nothing is stopped), renames and deletes them (which removes the transcript). The server has no
notion of a "current" chat: the client names the chat in every request, and each browser tab remembers its own.
A chat is titled after its first prompt; an empty chat is not listed. `chats.json` is only an index: sessions
found on disk that it does not know are imported, so the sessions folder is the source of truth. A tab that
did not send a prompt still shows it: the stream carries the user message and every event of every chat.

`logs/pihurl.log` (5 MB x 4, rotated) holds one JSON object per line — and the same events
go to `docker logs` in a short readable form:

| event | meaning |
|-------|---------|
| `http` | every API call: method, path, status, ms |
| `agent.start` / `agent.exit` | pi spawned (project, chat, provider, model) / ended (code, signal, intentional, idle) |
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
| `PIHURL_STATE`     | `~/.pihurl` (`/state` in the image) | Server-private state: provider keys, chat index, logs. Must be outside `WORKSPACE` when the agent is unprivileged |
| `WORKSPACE`        | `$PIHURL_STATE/workspace`        | Working folder pi operates in (`/workspace`); owned by the agent user |
| `WEB_UI_DIR`       | `$PIHURL_STATE/web-ui`           | Where the web-ui SPA is served from                 |
| `PI_CLI_PATH`      | *(auto-resolved)*                | Override the pi CLI path                            |
| `PIHURL_TOKEN`     | *(empty)*                        | Access token; empty = no sign-in                    |
| `PIHURL_TOKEN_FILE`| *(empty)*                        | Read the token from a file (Docker secrets)         |
| `PIHURL_ALLOWED_HOSTS` | *(empty)*                    | Extra host names answered when no token is set      |
| `PIHURL_AGENT_UID` / `PIHURL_AGENT_GID` | *(unset; 10001 in the image)* | Run pi and hurl as this user (the server must be root) |
| `PIHURL_AGENT_HOME`| `/home/agent`                    | Home directory of the agent user                    |
| `PIHURL_INTERNAL_PORT` | `3001`                       | Loopback port of the model proxy and spec list      |
| `PIHURL_MAX_AGENTS` | `4`                             | Most pi processes at once (one per working or recently used chat) |
| `PIHURL_AGENT_IDLE_MINUTES` | `15`                    | Stop an agent that has been idle this long (at least 1) |
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
and runs the tests in `test/` (spec parser, default seeding, access guard, model proxy, state migration).

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
