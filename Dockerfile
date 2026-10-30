FROM node:24-alpine AS build
WORKDIR /app

# Public OIDC configuration is compiled into the Next.js browser bundle.
# Keep legacy auth available; this only enables the additional SSO option.
ARG NEXT_PUBLIC_AUTH_MODE=keycloak
ARG NEXT_PUBLIC_KEYCLOAK_URL=https://sso.mrcute.space
ARG NEXT_PUBLIC_KEYCLOAK_REALM=mrcute
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=tce-dashboard
ARG NEXT_PUBLIC_AUTH_BASE_URL=https://auth.mrcute.space
ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE}
ENV NEXT_PUBLIC_KEYCLOAK_URL=${NEXT_PUBLIC_KEYCLOAK_URL}
ENV NEXT_PUBLIC_KEYCLOAK_REALM=${NEXT_PUBLIC_KEYCLOAK_REALM}
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=${NEXT_PUBLIC_KEYCLOAK_CLIENT_ID}
ENV NEXT_PUBLIC_AUTH_BASE_URL=${NEXT_PUBLIC_AUTH_BASE_URL}

COPY package.json ./
COPY postcss.config.mjs ./
RUN npm install

COPY nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
COPY packages ./packages

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
