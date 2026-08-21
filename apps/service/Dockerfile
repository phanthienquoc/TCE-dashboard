FROM node:22-alpine AS build
WORKDIR /app
COPY apps/service/package.json apps/service/package-lock.json* ./
RUN npm install
COPY apps/service/tsconfig.json ./
COPY apps/service/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8210
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8210
CMD ["node","dist/main.js"]
