# syntax=docker/dockerfile:1

FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Optional extra CA bundle for TLS-intercepting proxies (e.g. Zscaler):
#   docker build --secret id=ca,src=/etc/ssl/certs/ca-certificates.crt .
# Mounted only during this step, never stored in the image.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm ci

FROM node:26-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26-alpine AS run
WORKDIR /app
# TZ: "today" (overdue Termine, countdown) and shown times follow Swiss time, not UTC
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CAMPS_CONFIG=/app/config/camps.json \
    TZ=Europe/Zurich
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/config/camps.example.json ./config/camps.example.json
USER app
EXPOSE 3000
# -Y off: never route the local check through HTTP(S)_PROXY (busybox wget ignores NO_PROXY)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -Y off -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
