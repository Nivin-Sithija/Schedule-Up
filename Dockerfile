FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN npm ci --no-audit --no-fund --foreground-scripts --fetch-retries=1 --fetch-timeout=60000
ENV EMBEDDING_CACHE_PATH=/opt/followthrough-models
COPY scripts/prewarm-embeddings.mjs ./scripts/prewarm-embeddings.mjs
RUN node scripts/prewarm-embeddings.mjs
COPY . .
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 3001
CMD ["npm", "start"]
