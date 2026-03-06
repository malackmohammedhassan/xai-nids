# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfile first so Docker caches the install layer correctly.
# npm ci: deterministic, honours package-lock.json exactly, no surprises.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# VITE_API_URL is intentionally left empty so the built bundle uses relative
# /api/ paths.  nginx (or any reverse proxy) routes /api/ to the backend.
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine AS final

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
