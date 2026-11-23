# The mini-app's web client as a container: built with Vite, served by nginx together with a proxy to
# the Player API on the same origin (deploy/nginx.compose.conf.template). Used by the backend
# repository's staging stack (sono-game: deploy/staging/docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Empty: the Player API is on the same origin; nginx proxies /api/v1/.
ARG VITE_API_BASE_URL=
# 1 only against a backend in its mock profile (a stack without the SONO app). Never for a release.
ARG VITE_API_TEST_MOCK_AUTH=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TEST_MOCK_AUTH=$VITE_API_TEST_MOCK_AUTH
RUN npm run build -- --base=/sono-play/

FROM nginx:1.27-alpine
COPY deploy/nginx.compose.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html/sono-play
# host:port of the backend and the DNS server that resolves it (Docker's own on a compose network),
# substituted into the nginx config when the container starts.
ENV API_UPSTREAM=app:8080 \
    NGINX_RESOLVER=127.0.0.11
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/sono-play/ || exit 1
