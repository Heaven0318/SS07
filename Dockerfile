FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json knowledge.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server/index.mjs"]
