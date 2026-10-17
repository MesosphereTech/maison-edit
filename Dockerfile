# Builds the Vite frontend and serves it with the server-only Google adapter.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=10000 --fetch-timeout=120000 --maxsockets=4
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY server ./server
# A relative endpoint keeps browser requests on the same Cloud Run origin.
ENV VITE_GUIDE_ENDPOINT=/api/guide
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
# The authoritative catalog imports shared helpers. Keep its complete source
# dependency graph available to the native Node server, not just data.js.
COPY --from=build --chown=node:node /app/src ./src
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node server ./server
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]
