FROM node:24-slim AS builder

WORKDIR /app

# Install build tools for native modules (sharp, onnxruntime-node)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./

# Replace pnpm catalog: refs with real versions for npm compatibility
RUN sed -i \
    -e 's/"@types\/node": "catalog:"/"@types\/node": "^25.3.3"/g' \
    -e 's/"vite": "catalog:"/"vite": "^7.3.2"/g' \
    package.json

RUN npm install

COPY . .

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV PORT=3000
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# Copy pre-built node_modules and dist from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY package.json ./

ENV NODE_ENV=production
ENV BASE_PATH=/

EXPOSE 3000

CMD sh -c "BACKEND_PORT=${PORT:-3000} BASE_PATH=${BASE_PATH:-/} node_modules/.bin/tsx server/index.ts"
