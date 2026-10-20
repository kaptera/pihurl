#!/usr/bin/env bash
# Build and run the pihurl container.
# Usage: ./run.sh [port]   # default port 3000
set -euo pipefail

PORT="${1:-3000}"
IMAGE="pihurl"

# Always build: layer caching makes it a no-op when nothing changed, and a stale
# image is worse than a second of waiting.
echo ">> Building $IMAGE ..."
docker build -q -t "$IMAGE" .

echo ">> Starting http://localhost:${PORT}"
docker run --rm -p "127.0.0.1:${PORT}:3000" -v "$PWD/work:/workspace" \
  --add-host=host.docker.internal:host-gateway \
  -e OLLAMA_HOST="${OLLAMA_HOST:-http://host.docker.internal:11434}" \
  "$IMAGE"   # nothing after the image name: it would become the container command
