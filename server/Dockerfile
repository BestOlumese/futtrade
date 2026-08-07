# Empire Live — Colyseus match server.
#
# The container is the portability boundary. render.yaml is a thin layer on
# top of this image; the same image runs unchanged on Fly.io, Railway, Koyeb,
# or any VPS, so changing host is a config change and never a code change.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build

# Don't run as root.
USER node

# Documentation only — Render injects its own PORT, which src/index.ts reads.
EXPOSE 2567

CMD ["node", "build/index.js"]
