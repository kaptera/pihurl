# pihurl — self-hosted LLM-driven API testing.
# One image: Node backend + pi (coding agent) + Hurl, web UI on port 3000.
#
# Build:  docker build -t pihurl .
# Run:    docker run -p 3000:3000 -v $PWD/work:/workspace pihurl
FROM node:22-bookworm-slim
ARG TARGETARCH
ENV HURL_VERSION=8.0.1
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates libxml2 bash git ripgrep \
 && rm -rf /var/lib/apt/lists/* \
 && case "$TARGETARCH" in \
      amd64) HARCH=x86_64 ;; \
      arm64) HARCH=aarch64 ;; \
      *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /tmp/hurl.tgz \
      "https://github.com/Orange-OpenSource/hurl/releases/download/${HURL_VERSION}/hurl-${HURL_VERSION}-${HARCH}-unknown-linux-gnu.tar.gz" \
 && mkdir /tmp/hurl && tar -xzf /tmp/hurl.tgz -C /tmp/hurl \
 && install -m 0755 "$(find /tmp/hurl -type f -name hurl | head -n1)" /usr/local/bin/hurl \
 && rm -rf /tmp/hurl /tmp/hurl.tgz \
 && hurl --version

WORKDIR /app

# Install backend deps first (better layer caching; pulls pi-coding-agent from npm).
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Backend source.
COPY server/ ./

# Compile TypeScript — CMD runs the built output, not the sources.
RUN npm run build

# Web UI SPA — served from /app/web-ui (static assets stay in the image; only
# PIHURL_STATE below is a volume).
COPY web-ui/ /app/web-ui/

ENV PIHURL_STATE=/workspace
# The workspace volume mount; without this the backend would default to
# $PIHURL_STATE/workspace and miss the volume contents entirely.
ENV WORKSPACE=/workspace
ENV WEB_UI_DIR=/app/web-ui
ENV PORT=3000
# Where the Ollama preset points. "localhost" would be this container.
ENV OLLAMA_HOST=http://host.docker.internal:11434
EXPOSE 3000

CMD ["node", "dist/server.js"]
