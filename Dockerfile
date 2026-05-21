FROM node:24-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@latest

COPY package.json ./

# Resolve pnpm catalog: references to actual versions
RUN sed -i \
    's/"catalog:"/"*"/g' \
    package.json

# Allow native builds via .npmrc
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

RUN npm install -g pnpm@latest

COPY package.json ./
RUN sed -i 's/"catalog:"/"*"/g' package.json
RUN printf 'only-built-dependencies[]=sharp\nonly-built-dependencies[]=onnxruntime-node\n' > .npmrc
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV BASE_PATH=/

EXPOSE 3000

CMD sh -c "BACKEND_PORT=${PORT:-3000} BASE_PATH=${BASE_PATH:-/} node_modules/.bin/tsx server/index.ts"
