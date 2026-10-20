# pihurl

Self-hosted web tool for testing HTTP APIs with an LLM agent. Give it an OpenAPI spec (or let the agent
write one), connect a model, and ask for tests. The agent writes [Hurl](https://hurl.dev) files and fixes
them; **pihurl itself runs the tests**, so results are reproducible and do not depend on the model.
Everything happens in the browser, in one image.

![pihurl demo](https://raw.githubusercontent.com/kaptera/pihurl/main/docs/images/demo.gif)

- Chat with an agent ([pi](https://github.com/earendil-works/pi)) that reads your spec, writes and edits test files and runs commands
- Specs: upload OpenAPI 3 / Swagger 2, or have the agent create one from an API's docs
- Tests grouped by spec; run all, a group or a selection; Hurl HTML/JUnit/JSON reports and run history
- Any model: Ollama, LM Studio, vLLM and other OpenAI-compatible servers, OpenAI, Anthropic, OpenRouter
- Chats persist across reloads and restarts

## Quick start

```bash
docker run -d --name pihurl \
  -p 127.0.0.1:3000:3000 \
  -v "$PWD/work:/workspace" -v pihurl-state:/state \
  --add-host=host.docker.internal:host-gateway \
  --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --cap-add SETUID --cap-add SETGID \
  --security-opt no-new-privileges:true \
  -e PIHURL_TOKEN="$(openssl rand -hex 24)" \
  0allitter0/pihurl:latest
```

Open <http://localhost:3000>, add a model on the **Providers** tab (for Ollama on the host:
`http://host.docker.internal:11434/v1`), upload a spec or ask the agent to create one, set the target
URL on the **Tests & Reports** tab, and ask for tests.

With Docker Compose, use the `docker-compose.yaml` from the repository.

## Volume and configuration

| | |
|---|---|
| `/workspace` | the agent's project: specs, tests, reports, chat transcripts. Mount it. |
| `/state` | provider keys, chat index, logs; readable by root only, not by the agent. Mount a volume. |
| `PIHURL_TOKEN` | access token for the UI and API (empty = no sign-in; keep the port on `127.0.0.1`) |
| `PORT` | port inside the container, default `3000` |
| `OLLAMA_HOST` | where the Ollama preset points, default `http://host.docker.internal:11434` |

## Tags

| Tag | Meaning |
|---|---|
| `latest` | the newest release |
| `1.2.3`, `1.2`, `1` | a specific release, or the newest release of a minor / major line |

Images are built for `linux/amd64` and `linux/arm64`.

## Security

The agent can run shell commands, but as an unprivileged user that cannot read `/state` (provider keys,
logs) or the server's environment; it reaches the model through a loopback proxy that adds the key.
Set `PIHURL_TOKEN` to require a token, publish the port on `127.0.0.1` (as above) or put a TLS reverse
proxy in front, and point the target host at a test environment. Details: the README on GitHub.

## Links

Source, issues and documentation: <https://github.com/kaptera/pihurl> · License: MIT
