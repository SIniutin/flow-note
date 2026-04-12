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
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY proto ./proto

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
