FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Use the root lockfile for a deterministic dependency graph. The service
# package manifest mirrors runtime dependencies for local development; CI
# installs the root graph once so Nest Schedule and cron resolve one copy.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Puppeteer extracts Chrome for Testing from a zip archive. Keep the build
# image minimal but provide the extractor required by @puppeteer/browsers.
RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/*

# Let Puppeteer select the browser build for the container's actual platform.
# Keep the executable in its installed directory: Chromium resolves icudtl.dat,
# locales and other runtime resources relative to that directory.
RUN rm -rf /app/.cache/puppeteer/chrome-headless-shell \
  && npx puppeteer browsers install chrome-headless-shell \
  && executable="$(find /app/.cache/puppeteer/chrome-headless-shell -type f -name chrome-headless-shell -perm -111 | head -n 1)" \
  && test -n "$executable" \
  && test -s "$(dirname "$executable")/icudtl.dat" \
  && test -d "$(dirname "$executable")/locales"

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

# Chrome Headless Shell is kept in Puppeteer's cache with its adjacent ICU and
# locale resources. These libraries are required by the dynamically linked binary.
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

# Fail the image build if the installed headless shell or its adjacent ICU
# resource is missing. Puppeteer resolves the platform-specific executable.
RUN node -e "const fs=require('node:fs');const path=require('node:path');const root=process.env.PUPPETEER_CACHE_DIR+'/chrome-headless-shell';const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const executable=walk(root).find(file=>path.basename(file)==='chrome-headless-shell'&&(fs.statSync(file).mode&0o111)!==0);if(!executable||!fs.existsSync(path.join(path.dirname(executable),'icudtl.dat'))||!fs.existsSync(path.join(path.dirname(executable),'locales')))throw new Error('Chrome Headless Shell or adjacent runtime resources are missing');"

EXPOSE 8210
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8210/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/apps/service/src/main.js"]
