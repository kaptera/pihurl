# pihurl

A self-hosted web tool for testing HTTP APIs with an LLM agent. Give it an OpenAPI spec (or let the
agent write one), connect a model — a local one such as Ollama, or a cloud provider — and ask it
for tests. The agent writes [Hurl](https://hurl.dev) files, runs them and fixes them; **pihurl itself
runs the tests**, so results are reproducible and do not depend on the model's mood. Everything
happens in the browser, in one Docker image.

![pihurl: the agent finds a spec and writes tests, pihurl runs them](docs/images/demo.gif)

*A local model is asked to test [httpbin](https://httpbin.org): it finds the published OpenAPI spec,
writes eight Hurl files, and pihurl runs them (8/8 files, 39 requests). Waiting time is cut.*

- **Chat with an agent** that can read your spec, write and edit test files and run commands. It is
  [pi](https://github.com/earendil-works/pi), run in RPC mode inside the container.
- **Specs**: upload OpenAPI 3 / Swagger 2 files, or ask the agent to create one from an API's docs
  or by probing it. Specs the agent writes show up in the UI on their own.
- **Tests grouped by spec**: every test file is filed under the spec it exercises; select, run and
  collapse whole groups.
- **Runs and reports**: run all, a group, or a selection; per-request results with assertions and
  bodies, Hurl's own HTML report, JUnit and JSON, and a history of runs.
- **Send failures to the agent** with one click and let it decide whether the test or the API is
  wrong.
- **Any model**: Ollama, LM Studio, vLLM and other OpenAI-compatible servers, OpenAI, Anthropic,
  OpenRouter.
- **Chats persist** across reloads, restarts and provider changes; there is an application log for
  checking what the agent did.

## Screenshots

| Chat with tool calls and a Markdown answer | The spec the agent found |
|---|---|
| ![Chat](docs/images/chat.png) | ![Spec](docs/images/spec.png) |

| Tests grouped by spec, run results | One test file's requests and assertions |
|---|---|
| ![Tests](docs/images/tests.png) | ![Report](docs/images/report.png) |

## Quick start

You need Docker.

```bash
git clone <this repository> pihurl && cd pihurl
docker compose up -d --build
```

Open <http://localhost:3000>, then:

1. **Providers** → add your model (for Ollama on the host use `http://host.docker.internal:11434/v1`).
   *Test connection*, *Save*.
2. **Spec** → drop an OpenAPI file, or skip this and ask the agent in the chat to create a spec for
   an API you name.
3. **Tests & Reports** → type the base URL of the API under test in the field at the top.
4. **Chat** → "Cover the uncovered endpoints", then **Run all** on the Tests tab.

Without Compose: `./run.sh [port]` builds the image and starts it in the foreground.

Everything lives in `./work` (mounted at `/workspace`): specs, tests, reports, chats, logs and the
provider settings. Delete it to start over.

## How it works

```
Browser ── HTTP / SSE ──▶ backend (Node, Hono)
                           ├─ /api/chat       ⇄  pi --mode rpc   (cwd /workspace)
                           ├─ /api/specs      →  /workspace/specs/*
                           ├─ /api/providers  →  models.json, restarts the agent
                           ├─ /api/run        →  hurl --test --report-json/-html/-junit
                           └─ /report/*          run reports
```

The workspace is the agent's project folder:

```
/workspace
├── AGENTS.md              instructions the agent reads (editable in the UI)
├── specs/                 OpenAPI documents
├── tests/<tag>/*.hurl     tests written by the agent
├── hurl.env               host=<the target API>, used by the agent's own hurl runs
├── report/<run id>/       Hurl reports and the normalised result of each run
├── logs/pihurl.log        application log (JSON lines)
└── .pi/                   models.json, skills, chat transcripts
```

Developer documentation (endpoints, configuration, log events, tests) is in
[`server/README.md`](server/README.md).

## Security

pihurl is meant for a trusted machine or network. Read this before exposing it.

- **No authentication.** Anyone who can reach the port controls the agent. The default Compose file
  and `run.sh` publish the port on `127.0.0.1` only; keep it that way, or put your own reverse proxy
  with authentication in front.
- **The agent has a shell.** It can read, write and run commands as root inside the container. The
  container is the sandbox: do not mount anything you do not want it to touch, and restrict its
  network if the model is not trusted.
- **Secrets are stored in plain text** in the volume (`providers.json`, `.pi/models.json`), and the
  agent can read them. They are never sent back to the browser and pihurl does not log them, but anything the agent
  prints (for example by reading the file) ends up in its transcript. Use keys that you can afford
  to revoke.
- **Tests change data.** Point the target host at a test environment, not at production.
- Content from the tested API ends up in the agent's context, so a hostile API can try to
  prompt-inject it.

## Development

```bash
cd server
npm ci
npm run build && npm start          # http://localhost:3000, state in ~/.pihurl
npm test                            # backend tests
node --test ../web-ui/*.test.js     # UI tests (Markdown renderer, test grouping)
```

Hurl must be on `PATH` when running outside Docker. The web UI is plain files in `web-ui/` and has no
build step. See [`server/README.md`](server/README.md) for the details.

## CI and releases

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: type check, backend and
UI tests, then it builds the Docker image, starts it and checks that it answers and ships Hurl
(`scripts/docker-smoke.sh`, which you can also run locally against your own build).

**Publishing to Docker Hub** is on as soon as the repository has an Actions *variable*
`DOCKERHUB_USERNAME` and an Actions *secret* `DOCKERHUB_TOKEN` (a Docker Hub access token with
read/write scope). Without the variable, forks included, the publish steps are skipped.

| Event | Tags pushed to `<user>/pihurl` |
|---|---|
| push to `main` | `edge`, `sha-<short>` |
| tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest`, `sha-<short>` (no bare `0` tag for `v0.x`) |

Images are built for `linux/amd64` and `linux/arm64`. The official image is
[`0allitter0/pihurl`](https://hub.docker.com/r/0allitter0/pihurl); to use a published image:

```bash
docker run -d --name pihurl -p 127.0.0.1:3000:3000 -v "$PWD/work:/workspace" \
  --add-host=host.docker.internal:host-gateway 0allitter0/pihurl:latest
```

Dependabot keeps the GitHub Actions, the npm packages of `server/` and the base image up to date.

## License

[MIT](LICENSE). Third-party components and their licenses are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). pihurl is an independent project and is not
affiliated with pi, Hurl or any model provider.
