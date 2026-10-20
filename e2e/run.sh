#!/usr/bin/env bash
# Run the browser tests against a pihurl image.
# Usage: e2e/run.sh [image]   # default: pihurl
#
# Starts the scripted model and target API on this machine, two containers (open on :3100, with an
# access token on :3101), runs Playwright, and cleans up.
set -euo pipefail

IMAGE="${1:-pihurl}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="e2e-token-$$"
PIDS=()
NAMES=("pihurl-e2e-open-$$" "pihurl-e2e-auth-$$")

cleanup() {
  for n in "${NAMES[@]}"; do docker rm -f -v "$n" >/dev/null 2>&1 || true; done
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT

cd "$HERE"
[ -d node_modules ] || npm ci
npx playwright install chromium >/dev/null

node fixtures/mock-servers.mjs & PIDS+=($!)
for _ in $(seq 1 20); do curl -fs -m 1 -o /dev/null http://127.0.0.1:11500/v1/models && break; sleep 0.5; done

start() { # name port [extra docker args...]
  local name="$1" port="$2"; shift 2
  docker run -d --name "$name" -p "127.0.0.1:${port}:3000" \
    --add-host=host.docker.internal:host-gateway \
    --security-opt no-new-privileges:true --cap-drop ALL \
    --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --cap-add SETUID --cap-add SETGID \
    "$@" "$IMAGE" >/dev/null
  for _ in $(seq 1 60); do curl -fs -m 1 -o /dev/null "http://127.0.0.1:${port}/health" && return 0; sleep 1; done
  docker logs "$name" >&2; echo "e2e: $name did not come up" >&2; return 1
}
start "${NAMES[0]}" 3100
start "${NAMES[1]}" 3101 -e "PIHURL_TOKEN=$TOKEN"

PIHURL_URL=http://127.0.0.1:3100 PIHURL_AUTH_URL=http://127.0.0.1:3101 PIHURL_TOKEN="$TOKEN" npx playwright test
