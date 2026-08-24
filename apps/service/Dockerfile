FROM node:24-alpine AS deps
WORKDIR /app

# This is an npm monorepo without a workspace lockfile. Install the root
# dependency graph once; service/package.json duplicates runtime dependencies
# for local development but must not create a second node_modules tree in CI.
COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY tsconfig.base.json nx.json ./
COPY apps/service ./apps/service
COPY libs ./libs

# Verify the dependency graph before TypeScript so module-resolution failures
# are reported at the actual dependency boundary.
RUN node -e "for (const p of ['@nestjs/common','@nestjs/core','@supabase/supabase-js','@ssi.developer/ssi-sdk','nx','typescript']) require.resolve(p)"
RUN ./node_modules/.bin/nx build service

# Node ESM requires explicit .js extensions for relative imports.
RUN node apps/service/scripts/fix-esm-extensions.mjs /app/dist/apps/service

RUN test -f /app/dist/apps/service/src/main.js
RUN test -f /app/dist/apps/service/src/app.module.js
RUN node --check /app/dist/apps/service/src/main.js
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8210
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist/apps/service ./dist
EXPOSE 8210
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8210/api/health || exit 1
CMD ["node","dist/src/main.js"]
