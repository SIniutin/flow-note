FROM node:20-alpine AS builder

WORKDIR /app/collab-service
COPY collab-service/package.json collab-service/tsconfig.json ./
RUN npm install
COPY collab-service/src ./src
COPY api-contracts/proto /app/api-contracts/proto
COPY api-contracts/google /app/api-contracts/google
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app/collab-service
COPY --from=builder /app/collab-service/dist ./dist
COPY --from=builder /app/collab-service/node_modules ./node_modules
COPY --from=builder /app/api-contracts/proto /app/api-contracts/proto
COPY --from=builder /app/api-contracts/google /app/api-contracts/google

ENV NODE_ENV=production
EXPOSE 4000
EXPOSE 50053

CMD ["node", "dist/index.js"]
