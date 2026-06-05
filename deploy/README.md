# Déploiement — Discord MCP (Docker, VPS Allemagne)

Cible : `100.64.0.1` (Tailscale). Conteneur publié SUR l'IP Tailscale uniquement + Bearer.

## 1. Code → VPS
    /opt/discord-mcp   (git ou rsync ; .dockerignore exclut node_modules/.secrets.json/tests)

## 2. Secrets hôte (jamais dans l'image)
    /etc/discord-mcp/secrets.json   # {default, bots:{echidna:{token,application_id}}} — perms 600 root
    /opt/discord-mcp/.env           # lu par compose, perms 600 :
        DISCORD_MCP_HTTP_TOKEN=<aléatoire 32+ octets>
        BIND_IP=100.64.0.1
        HTTP_PORT=8788
        DISCORD_MCP_ALLOWED_HOSTS=100.64.0.1:8788
        SECRETS_FILE=/etc/discord-mcp/secrets.json

## 3. Build + run
    cd /opt/discord-mcp && docker compose up -d --build
    docker compose ps ; docker compose logs -f

## 4. Brancher l'agent (poste de Théo) — ~/.mcp.json, entrée `discord` en HTTP :
    url   = http://100.64.0.1:8788/mcp   (IP Tailscale)
    header Authorization: Bearer <DISCORD_MCP_HTTP_TOKEN>

## 5. Vérifier
    discord_health → bots listés, warn:false. Puis POST message de baptême.

⚠️ Cutover : garder le MCP stdio local tant que le distant n'est pas prouvé.
⚠️ V2 : Postgres (relais historique) s'ajoute comme 2e service dans docker-compose.yml + réseau interne.
