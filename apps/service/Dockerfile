FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# This is an npm monorepo without a workspace lockfile. Install the root
# dependency graph once; service/package.json duplicates runtime dependencies
# for local development but must not create a second node_modules tree in CI.
COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund

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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.cache ./.cache
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
EXPOSE 8210
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8210/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/apps/service/src/main.js"]
