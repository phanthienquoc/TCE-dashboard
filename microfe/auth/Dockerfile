FROM node:22-alpine
WORKDIR /app

COPY microfe/auth/package.json ./package.json
RUN npm install --omit=dev

COPY microfe/auth/src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.mjs"]
