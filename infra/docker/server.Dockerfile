# Trefaro server (NestJS).
#
# Two stages: the first builds the server bundle and the curated plug-ins' web
# component bundles, the second carries only what running them needs. The
# plug-in bundles ship in this image because the server serves them under
# /api/plugins — one URL that works the same in development and in production.

FROM node:24-alpine AS build
WORKDIR /workspace

# Dependencies first, so a source-only change does not re-resolve the tree.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build server --configuration=production \
 && npx nx build plugin-room-planning --configuration=production

# ---------------------------------------------------------------------------

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SERVER_PORT=3000 \
    PLUGIN_BUNDLE_DIR=/app/plugins \
    I18N_CATALOGUE_DIR=/app/assets/i18n \
    UPLOAD_DIR=/app/uploads

# `nx build` writes a package.json listing only the dependencies the bundle
# actually requires at runtime, together with a matching lockfile.
COPY --from=build /workspace/dist/apps/server/package.json ./
COPY --from=build /workspace/dist/apps/server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /workspace/dist/apps/server/main.js ./
# The shipped translation catalogues (E22). The build copies them out of
# `libs/shared-i18n/catalogues` into the bundle's assets; without this line the
# image would answer every `/api/i18n/:locale` with an empty catalogue and both
# clients would render their keys - which no suite in this repository can see.
COPY --from=build /workspace/dist/apps/server/assets ./assets
COPY --from=build /workspace/dist/apps/plugins ./plugins

# Uploaded files (logos, avatars, registration attachments) live on a volume;
# the directory is created here so it is owned by the unprivileged user.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

# The reverse proxy and Compose both need to know when the server is ready.
# /api/health reports the database separately, so a running server with an
# unreachable database stays distinguishable from a server that is gone.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "main.js"]
