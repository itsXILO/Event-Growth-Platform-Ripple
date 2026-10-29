# ==============================================================================
# STAGE 1: Build Client (Vite + React)
# ==============================================================================
FROM node:22-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY client/ ./
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ==============================================================================
# STAGE 2: Build Server (TypeScript compilation)
# ==============================================================================
FROM node:22-alpine AS server-builder

WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY server/ ./
RUN npm run build

# ==============================================================================
# STAGE 3: Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install dumb-init for clean signal handling (SIGTERM, SIGINT)
RUN apk add --no-cache dumb-init

# Copy server package definitions and install production-only dependencies
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy compiled backend dist and source files needed for drizzle/schema
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/drizzle.config.ts ./drizzle.config.ts
COPY --from=server-builder /app/server/src/db ./src/db

# Copy compiled client build into the path server expects (/app/client/dist)
COPY --from=client-builder /app/client/dist /app/client/dist

# Security: run as non-root user 'node'
RUN chown -R node:node /app
USER node

EXPOSE 4000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
