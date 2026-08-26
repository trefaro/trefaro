# Trefaro web client (participant or organizer).
#
# One Dockerfile for both: they differ only in which Nx project is built and at
# which path the reverse proxy serves them. The organizer client is served under
# /admin/, which Angular has to know at build time through its base href.
#
# Build with, for example:
#   docker build -f infra/docker/client.Dockerfile \
#     --build-arg APP=admin-client --build-arg BASE_HREF=/admin/ .

FROM node:24-alpine AS build
ARG APP
ARG BASE_HREF=/
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN test -n "$APP" || (echo "build-arg APP is required" && exit 1)
RUN npx nx build "$APP" --configuration=production --base-href="$BASE_HREF"

# ---------------------------------------------------------------------------

FROM nginx:1.29-alpine AS runtime
ARG APP

# Serves the built files with the fallback that client-side routing needs. This
# is the container's own nginx; the separate reverse proxy in front of it does
# the routing between the clients and the API.
COPY infra/nginx/client.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/${APP}/browser /usr/share/nginx/html

EXPOSE 80
