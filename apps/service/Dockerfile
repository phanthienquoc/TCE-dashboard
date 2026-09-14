FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# This is an npm monorepo without a workspace lockfile. Install the root
# dependency graph once; service/package.json duplicates runtime dependencies
# for local development but must not create a second node_modules tree in CI.
COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund

# Puppeteer extracts Chrome for Testing from a zip archive. Keep the build
# image minimal but provide the extractor required by @puppeteer/browsers.
RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/*

# Chrome for Testing added Linux arm64 assets in Chrome 153. Puppeteer 25.10
# still pins 152, which has no Linux arm64 headless-shell asset. Install the
# current arm64-compatible shell explicitly and point Puppeteer at it below.
RUN rm -rf /app/.cache/puppeteer/chrome-headless-shell \
  && npx puppeteer browsers install chrome-headless-shell@153.0.8010.36 \
  && test -x /app/.cache/puppeteer/chrome-headless-shell/linux_arm-153.0.8010.36/chrome-headless-shell-linux-arm64/chrome-headless-shell

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.cache ./.cache
COPY package.json ./package.json
COPY tsconfig.base.json nx.json ./
COPY apps/service ./apps/service
COPY libs ./libs
COPY packages ./packages

# Verify the dependency graph before TypeScript so module-resolution failures
# are reported at the actual dependency boundary.
RUN node -e "for (const p of ['@nestjs/common','@nestjs/core','@supabase/supabase-js','@ssi.developer/ssi-sdk','puppeteer','nx','typescript']) require.resolve(p)"
RUN ./node_modules/.bin/nx build service

# Node ESM requires explicit .js extensions for relative and internal package imports.
RUN node apps/service/scripts/fix-esm-extensions.mjs /app/dist

RUN test -f /app/dist/apps/service/src/main.js
RUN test -f /app/dist/apps/service/src/app.module.js
RUN test -f /app/dist/libs/contracts/src/index.js
RUN test -f /app/dist/libs/db/src/index.js
RUN node --check /app/dist/apps/service/src/main.js
RUN npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8210
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/app/.cache/puppeteer/chrome-headless-shell/linux_arm-153.0.8010.36/chrome-headless-shell-linux-arm64/chrome-headless-shell

# Chrome for Testing is dynamically linked and needs these runtime libraries
# even though the headless shell binary itself is copied from the build stage.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libu2f-udev \
    libvulkan1 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.cache ./.cache
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist

# Fail the image build if the configured executable path is not present.
RUN test -x "$PUPPETEER_EXECUTABLE_PATH"

EXPOSE 8210
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8210/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/apps/service/src/main.js"]
