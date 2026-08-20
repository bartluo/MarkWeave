# Build from the repo root so the workspace layout and docs content resolve:
#   docker build -f packages/website/Dockerfile .
FROM node:22-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/website/package.json packages/website/

RUN pnpm install --frozen-lockfile --ignore-scripts --filter markweave-website... \
  && pnpm rebuild esbuild

COPY packages/website packages/website
RUN pnpm --filter markweave-website build

FROM node:22-alpine AS runner

WORKDIR /app/packages/website
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/packages/website/.next/standalone/packages/website ./
COPY --from=builder /app/packages/website/.next/static ./.next/static
COPY --from=builder /app/packages/website/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
