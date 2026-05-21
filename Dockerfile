FROM node:24-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@latest

COPY package.json ./

# Replace pnpm catalog: references with real versions
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

COPY package.json ./

# Replace catalog: refs and remove devDependencies block for npm install
RUN sed -i \
    -e 's/"@types\/node": "catalog:"/"@types\/node": "^25.3.3"/g' \
    -e 's/"vite": "catalog:"/"vite": "^7.3.2"/g' \
    package.json

# Use npm for production install (no catalog: issues)
RUN npm install --omit=dev --ignore-scripts=false

COPY --from=builder /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV BASE_PATH=/

EXPOSE 3000

CMD sh -c "BACKEND_PORT=${PORT:-3000} BASE_PATH=${BASE_PATH:-/} node_modules/.bin/tsx server/index.ts"
