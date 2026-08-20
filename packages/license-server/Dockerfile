# Build from the repo root so the workspace:* dependency on
# @markweave/license-core resolves:
#   docker build -f packages/license-server/Dockerfile .
FROM node:22-alpine

# better-sqlite3 falls back to node-gyp when no prebuilt binary exists
RUN apk add --no-cache python3 make g++
RUN corepack enable

WORKDIR /app

# Workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/license-core/package.json packages/license-core/
COPY packages/license-server/package.json packages/license-server/

# Install only the license-server dependency tree. --ignore-scripts skips the
# root postinstall (Electron download + desktop native rebuilds); the only
# native module this server needs is better-sqlite3, rebuilt explicitly.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @markweave/license-server... \
  && pnpm rebuild better-sqlite3

COPY packages/license-core packages/license-core
COPY packages/license-server packages/license-server

WORKDIR /app/packages/license-server
EXPOSE 3210
CMD ["pnpm", "start"]
