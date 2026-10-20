#!/usr/bin/env bash
# Start an image, wait for it to answer, check what it ships, remove it.
# Usage: scripts/docker-smoke.sh [image]   # default: pihurl
set -euo pipefail

IMAGE="${1:-pihurl}"
NAME="pihurl-smoke-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:3000" "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if curl -fsS -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS -m 5 "http://127.0.0.1:${PORT}/health" >/dev/null || { docker logs "$NAME"; echo "smoke: no /health" >&2; exit 1; }

info="$(curl -fsS -m 5 "http://127.0.0.1:${PORT}/api/info")"
echo "$info"
echo "$info" | grep -q '"hurl":"hurl ' || { echo "smoke: hurl is missing from the image" >&2; exit 1; }
echo "$info" | grep -q '"agentIsolated":true' || { echo "smoke: the agent does not run as an unprivileged user" >&2; exit 1; }

# the web UI and its scripts are served
for path in / /app.js /js/core.js /markdown.js /grouping.js /style.css; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:${PORT}${path}")"
  [ "$code" = "200" ] || { echo "smoke: ${path} answered ${code}" >&2; exit 1; }
done
echo "smoke: ok"
