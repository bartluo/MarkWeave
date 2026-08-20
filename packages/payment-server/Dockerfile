# Build from the repo root so the workspace:* dependency on
# @markweave/license-core resolves:
#   docker build -f packages/payment-server/Dockerfile .
FROM node:22-alpine

# better-sqlite3 falls back to node-gyp when no prebuilt binary exists
RUN sed -i 's#https://dl-cdn.alpinelinux.org#https://mirrors.aliyun.com#g' /etc/apk/repositories \
  && apk add --no-cache python3 make g++ curl
RUN corepack enable

WORKDIR /app

# Workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/license-core/package.json packages/license-core/
COPY packages/payment-server/package.json packages/payment-server/

# Install only the payment-server dependency tree. --ignore-scripts skips the
# root postinstall (Electron download + desktop native rebuilds); the only
# native module this server needs is better-sqlite3, rebuilt explicitly.
RUN NODE_VERSION=$(node -p 'process.versions.node') \
  && mkdir -p /root/.cache/node-gyp/$NODE_VERSION \
  && curl -fsSL https://nodejs.org/download/release/v$NODE_VERSION/node-v$NODE_VERSION-headers.tar.gz \
    | tar -xz -C /root/.cache/node-gyp/$NODE_VERSION --strip-components=1 \
  && pnpm install --frozen-lockfile --ignore-scripts --registry=https://registry.npmmirror.com --filter @markweave/payment-server... \
  && npm_config_build_from_source=true npm_config_nodedir=/root/.cache/node-gyp/$NODE_VERSION \
    pnpm --filter @markweave/payment-server rebuild better-sqlite3

COPY packages/license-core packages/license-core
COPY packages/payment-server packages/payment-server

WORKDIR /app/packages/payment-server
EXPOSE 3220
CMD ["pnpm", "start"]
