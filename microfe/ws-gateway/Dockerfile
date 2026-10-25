FROM node:22-alpine
WORKDIR /app
COPY microfe/ws-gateway/package.json ./package.json
RUN npm install --omit=dev
COPY microfe/ws-gateway/src ./src
USER node
EXPOSE 8080
CMD ["node","src/server.mjs"]
