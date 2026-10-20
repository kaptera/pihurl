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

# Two volumes. /workspace is the agent's project (specs, tests, reports, chats). /state holds what
# the agent must not see: provider API keys, the chat index, logs. The server runs as root and
# starts pi and hurl as an unprivileged user (uid 10001 unless PIHURL_AGENT_UID says otherwise);
# /state is 0700 root, so that user cannot read it. See the README, "Security".
ENV PIHURL_STATE=/state
ENV WORKSPACE=/workspace
ENV PIHURL_AGENT_UID=10001
ENV PIHURL_AGENT_GID=10001
ENV WEB_UI_DIR=/app/web-ui
ENV PORT=3000
# Loopback only, never published: the model proxy and spec list the agent uses.
ENV PIHURL_INTERNAL_PORT=3001
# Where the Ollama preset points. "localhost" would be this container.
ENV OLLAMA_HOST=http://host.docker.internal:11434
RUN mkdir -p /state /workspace /home/agent \
 && chmod 700 /state \
 && chown 10001:10001 /workspace /home/agent
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
