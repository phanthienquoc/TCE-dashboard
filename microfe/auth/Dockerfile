FROM node:24-alpine AS build
WORKDIR /app
COPY microfe/auth/package.json microfe/auth/tsconfig.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY microfe/auth/src ./src
RUN npm run check && npm test && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
