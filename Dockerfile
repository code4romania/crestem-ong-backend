FROM node:22-alpine AS build

WORKDIR /build

# sharp@0.32 has no universal musl prebuild; keep the toolchain around so its
# install script can fall back to compiling against system libvips.
RUN set -ex; \
    apk add --no-cache \
    g++ \
    make \
    python3 \
    vips-dev

COPY package.json package-lock.json ./

# No --ignore-scripts here: sharp and esbuild both need their install scripts.
RUN set -ex; \
    npm ci --no-audit

COPY tsconfig.json favicon.png ./
COPY types ./types
COPY config ./config
COPY src ./src
COPY public ./public

ENV NODE_ENV=production

RUN set -ex; \
    npm run build

RUN set -ex; \
    npm ci --omit=dev --no-audit


FROM node:22-alpine

WORKDIR /app

COPY --from=build --chown=node:node /build/node_modules ./node_modules
COPY --from=build --chown=node:node /build/dist ./dist
COPY --from=build --chown=node:node /build/public ./public

# Strapi decides it is a TypeScript app by the presence of tsconfig.json, and
# only then serves the compiled app from dist/. The sources come along because
# `strapi start` parses tsconfig.json on boot and aborts on any diagnostic --
# a tsconfig whose include globs match nothing raises TS18003 and exits 1.
# Nothing is recompiled at runtime; dist/ is what actually runs.
COPY --from=build --chown=node:node /build/config ./config
COPY --from=build --chown=node:node /build/src ./src
COPY --from=build --chown=node:node /build/types ./types
COPY --chown=node:node tsconfig.json favicon.png package.json package-lock.json ./

RUN set -ex; \
    apk add --no-cache \
    ca-certificates \
    dumb-init \
    libstdc++ \
    vips \
    vips-cpp

# Strapi's database layer creates the user migrations directory during boot, and
# WORKDIR is root-owned, so pre-create it for the unprivileged runtime user.
RUN set -ex; \
    mkdir -p /app/database/migrations; \
    chown -R node:node /app/database

USER node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337

EXPOSE 1337

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
