# Déploiement — Discord MCP (Docker, VPS Allemagne) — DÉPLOYÉ & PROUVÉ 2026-06-05

Cible : `100.64.0.1` (Tailscale), `/opt/discord-mcp`. Service en **réseau hôte**, bind direct IP Tailscale.

## Contraintes de CE VPS (non négociables)
- Docker `iptables:false` → **bridge NAT + port-mapping CASSÉS** + **DNS conteneur KO**.
  → build avec `--network=host` (cf `build.sh`) ET runtime `network_mode: host`.
- Réseau hôte → bind sur l'**IP Tailscale** (jamais 0.0.0.0). Mesh privé chiffré = la frontière.

## 1. Code → VPS
    /opt/discord-mcp   (tar sans node_modules/.git/.secrets.json/reports)

## 2. Secrets hôte (jamais dans l'image)
    /etc/discord-mcp/secrets.json   # {default, bots:{echidna:{token,application_id}}}
        chown root:1000 + chmod 640  # lisible par le user `node` (uid/gid 1000) du conteneur
    /opt/discord-mcp/.env           # chmod 600 :
        DISCORD_MCP_HTTP_TOKEN=<openssl rand -hex 32>

## 3. Build (réseau hôte) + run
    bash build.sh                 # docker build --network=host -t discord-mcp:latest
    docker compose up -d          # image pré-buildée, network_mode host
    docker compose ps             # healthy attendu

## 4. Vérifier (depuis le VPS ou via Tailscale)
    bash smoke.sh ; cat smoke.log   # 401 sans auth, initialize→session, discord_health, /users/@me

## 5. Brancher l'agent (poste de Théo) — ~/.mcp.json, entrée HTTP :
    url    = http://100.64.0.1:8788/mcp
    header = Authorization: Bearer <DISCORD_MCP_HTTP_TOKEN>   # dans /opt/discord-mcp/.env
⚠️ Garder le MCP stdio local en parallèle tant que la connexion MCP-client HTTP n'est pas prouvée.

## V2 — relais historique
Ajouter `agent-postgres` (déjà sur le VPS) + gateway listener + outils discord_history/discord_search.
