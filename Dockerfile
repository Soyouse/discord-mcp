# Discord MCP — image du service HTTP 24/7.
# ⚠️ Secrets JAMAIS dans l'image : montés au runtime (volume) + env_file. Voir docker-compose.yml.
FROM node:22-alpine

WORKDIR /app

# deps prod seulement, en couche cache séparée.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# code applicatif (le .dockerignore exclut node_modules/.secrets.json/tests/reports).
COPY . .

# tourne en non-root (durcissement).
USER node

EXPOSE 8788
CMD ["node", "http.js"]
