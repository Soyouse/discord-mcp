# Discord MCP — image du service HTTP 24/7.
# ⚠️ node:22-slim (Debian/glibc) — PAS alpine : npm ci plante sur alpine ("Exit handler never called!").
# ⚠️ Secrets JAMAIS dans l'image : montés au runtime (volume) + env. Voir docker-compose.yml.
FROM node:22-slim

WORKDIR /app

# deps prod seulement, couche cache séparée. (prepare=husky||true → no-op sans devDeps.)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# code applicatif (.dockerignore exclut node_modules/.secrets.json/tests/reports).
COPY . .

# non-root (durcissement) — l'utilisateur `node` (uid 1000) existe dans l'image officielle.
# ⚠️ Le secret monté doit être lisible par gid 1000 (ex: chown root:1000 + chmod 640 côté hôte).
USER node

EXPOSE 8788
CMD ["node", "http.js"]
