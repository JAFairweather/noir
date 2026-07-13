# The Noir Director — the AI game master — as a container.
#
# Only what the Director needs is copied: the engine, the protocol libs,
# the shared modules, and the era bibles. The game CLIENT is NOT here —
# that is static and lives on Cloudflare Pages. This image is the API.
#
# Build context is the REPO ROOT (see deploy/docker-compose.yml), so the
# COPY paths below are repo-relative.

FROM node:22-alpine

WORKDIR /app

# Install production deps first so this layer caches across code changes.
# `npm ci` when the lockfile is in sync; fall back to `npm install` if a
# fresh clone's lock has drifted, so the build never wedges on that.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# The Director's own code and data.
COPY gm ./gm
COPY lib ./lib
COPY shared ./shared
COPY eras ./eras
# A local house is optional — a GRANTED house (from the nvoy console)
# outranks it anyway. The bracket makes the copy tolerate its absence.
COPY house.jso[n] ./

ENV NODE_ENV=production
ENV NOIR_GM_PORT=8787
EXPOSE 8787

# The service is supervised by Docker's restart policy, so we run it
# directly. The desk's RESTART button (process exit 75) is honored:
# the process exits, Docker restarts the container. (UPDATE — git pull —
# is a no-op in a container; you update by redeploying a new image.)
CMD ["node", "gm/director-service.mjs"]
