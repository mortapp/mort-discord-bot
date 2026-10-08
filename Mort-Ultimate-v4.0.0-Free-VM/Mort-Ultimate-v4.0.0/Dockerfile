FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production DATA_FILE=/data/mort-memory.json

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && mkdir -p /data \
  && chown node:node /data

COPY --chown=node:node src ./src

USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
