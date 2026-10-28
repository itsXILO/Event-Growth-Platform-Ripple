# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with exact lockfile
COPY package*.json ./
RUN npm ci

# Copy TypeScript configs and source code
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# ── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install only production dependencies for smaller image size
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files and migrations from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Run as non-root user for security
USER node

EXPOSE 4000

CMD ["node", "dist/index.js"]
