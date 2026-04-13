# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
COPY proto ./proto
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY proto ./proto

CMD ["node", "dist/index.js"]
