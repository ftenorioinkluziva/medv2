FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS frontend-build

COPY package.json package-lock.json tsconfig.frontend.json vite.config.ts ./
COPY frontend-react ./frontend-react
RUN npm run build:frontend

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node db ./db
COPY --from=frontend-build --chown=node:node /app/frontend/dist ./frontend/dist
COPY --chown=node:node data/katia_haranaka_kb.json data/guilherme_freccia_kb.json data/nutricao_kb.json ./seed-data/
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/medv2-entrypoint

RUN chmod 0755 /usr/local/bin/medv2-entrypoint \
  && mkdir -p /app/data /app/uploads \
  && chown -R node:node /app/data /app/uploads

USER node
EXPOSE 3000

ENTRYPOINT ["medv2-entrypoint"]
CMD ["node_modules/.bin/tsx", "backend/src/server.ts"]
