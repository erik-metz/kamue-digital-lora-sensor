FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
USER node
CMD ["node", "worker.mjs", "--watch"]
