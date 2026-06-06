# Conteneur discord-web-front : build du SPA (Vite) puis service statique + reverse-proxy (nginx).
# ⚠️ Contexte de build = front/ (ce dossier). Build sur le VPS avec `--network=host` (DNS conteneur KO sinon).
# ⚠️ Image SANS secret : aucun token Discord/JWT n'entre ici (le front ne parle qu'à l'API web même-origine).
# Étape 1 — build : node:22-slim (PAS alpine : npm ci y plante, cf Dockerfile racine).
FROM node:22-slim AS build
WORKDIR /app
# deps complètes (vite + plugins sont des devDeps → PAS de --omit=dev ici), couche cache séparée.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build   # → /app/dist (assets hashés, code-splitting)

# Étape 2 — service : nginx alpine (l'image finale ne contient QUE le statique, ~25 Mo).
FROM nginx:1.27-alpine
# ⚠️ Remplace le bloc server par défaut (qui écoute 0.0.0.0:80) par le nôtre (IP Tailscale:8789).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/discord-web-front.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8789
