# Copyright 2026 Daniel Schuh
# Licensed under the Apache License, Version 2.0
# http://www.apache.org/licenses/LICENSE-2.0

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:full

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server-dist/server/index.js"]
