FROM node:24-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages
COPY src ./src
COPY index.html ./index.html

RUN npm run build:web

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["node", "apps/web/server.js"]
