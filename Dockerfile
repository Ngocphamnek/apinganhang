FROM node:24-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@latest

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install \
    --config.onlyBuiltDependencies[0]=sharp \
    --config.onlyBuiltDependencies[1]=onnxruntime-node

COPY . .

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV PORT=3000
RUN pnpm run build

FROM node:24-slim

WORKDIR /app

RUN npm install -g pnpm@latest

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --prod \
    --config.onlyBuiltDependencies[0]=sharp \
    --config.onlyBuiltDependencies[1]=onnxruntime-node

COPY --from=builder /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
ENV BASE_PATH=/

EXPOSE 3000

CMD sh -c "BACKEND_PORT=${PORT:-3000} BASE_PATH=${BASE_PATH:-/} node_modules/.bin/tsx server/index.ts"
