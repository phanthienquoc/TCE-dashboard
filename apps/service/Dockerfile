FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/service/package.json ./apps/service/package.json
RUN npm install
RUN npm install --prefix apps/service

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/service/package.json ./apps/service/package.json
COPY tsconfig.base.json nx.json ./
COPY apps/service ./apps/service
COPY libs ./libs
RUN ./node_modules/.bin/nx build service
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8210
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist/apps/service ./dist
EXPOSE 8210
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8210/auth/status || exit 1
CMD ["node","dist/src/main.js"]
