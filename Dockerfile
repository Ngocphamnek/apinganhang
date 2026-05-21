FROM node:24-slim AS builder

WORKDIR /app

# Install build tools needed for native modules (sharp, onnxruntime-node)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@latest

COPY package.json ./

# Resolve pnpm catalog: references to real versions
RUN sed -i \
    -e 's/"@types\/node": "catalog:"/"@types\/node": "^25.3.3"/g' \
    -e 's/"vite": "catalog:"/"vite": "^7.3.2"/g' \
    package.json

# Allow native builds
RUN printf 'only-built-dependencies[]=sharp\nonly-built-dependencies[]=onnxruntime-node\n' > .npmrc

RUN pnpm install

COPY . .

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV PORT=3000
RUN pnpm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# Copy everything from builder (node_modules already built with native deps)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY package.json ./

ENV NODE_ENV=production
ENV BASE_PATH=/

EXPOSE 3000

CMD sh -c "BACKEND_PORT=${PORT:-3000} BASE_PATH=${BASE_PATH:-/} node_modules/.bin/tsx server/index.ts"
