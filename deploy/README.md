# Déploiement — Discord MCP (Docker, VPS Allemagne) — DÉPLOYÉ & PROUVÉ 2026-06-05

Cible : `100.64.0.1` (Tailscale), `/opt/discord-mcp`. Service en **réseau hôte**, bind direct IP Tailscale.

## Contraintes de CE VPS (non négociables)
- Docker `iptables:false` → **bridge NAT + port-mapping CASSÉS** + **DNS conteneur KO**.
  → build avec `--network=host` (cf `build.sh`) ET runtime `network_mode: host`.
- Réseau hôte → bind sur l'**IP Tailscale** (jamais 0.0.0.0). Mesh privé chiffré = la frontière.
- `127.0.0.1:8788` est **déjà pris** par un service tiers → on bind l'IP Tailscale, pas le loopback.
- HTTPS = `tailscale serve` (cf §3bis). Le mesh chiffre déjà ; serve ajoute juste un cert valide + URL propre.

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

## 3bis. TLS via tailscale serve (HTTPS propre, cert LE *.ts.net) — convention maison
    tailscale serve --bg --https=8449 http://100.64.0.1:8788
    # → https://ubuntu-8gb-nbg1-1.tail7d7bbd.ts.net:8449/  (tailnet only, persiste au reboot)
    # Le conteneur reste en HTTP sur l'IP Tailscale ; serve termine le TLS par-dessus.
    # ⚠️ Le Host transmis = le nom MagicDNS → déjà dans DISCORD_MCP_ALLOWED_HOSTS (compose).
    # ⚠️ Un nœud ne joint PAS son propre listener serve via son nom ts.net : tester depuis un AUTRE nœud du tailnet.

## 4. Vérifier (depuis un AUTRE nœud du tailnet, ex. PC de Théo)
    H=ubuntu-8gb-nbg1-1.tail7d7bbd.ts.net ; T=<DISCORD_MCP_HTTP_TOKEN>
    curl -sw '%{http_code} verify=%{ssl_verify_result}\n' https://$H:8449/mcp -X POST -d '{}'   # 401, verify=0 (cert OK)
    curl https://$H:8449/mcp -H "authorization: Bearer $T" -H 'accept: application/json, text/event-stream' \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"x","version":"1"}}}'  # 200 + Mcp-Session-Id

## 5. Brancher l'agent (poste de Théo) — ~/.mcp.json, entrée HTTP :
    url    = https://ubuntu-8gb-nbg1-1.tail7d7bbd.ts.net:8449/mcp   # HTTPS via tailscale serve
    header = Authorization: Bearer <DISCORD_MCP_HTTP_TOKEN>          # dans /opt/discord-mcp/.env
⚠️ Garder le MCP stdio local en parallèle tant que la connexion MCP-client HTTP n'est pas prouvée.

## Client web (P6) — API Fastify + front-door nginx, HTTPS via tailscale serve
Deux conteneurs de plus (cf docker-compose.yml) :
- `discord-web` — API Fastify (MÊME image, `command: node web/server.js`), bind **127.0.0.1:8080** (INTERNE, jamais exposé).
- `discord-web-front` — nginx (image SÉPARÉE `discord-web-front:latest`, multi-stage `front/Dockerfile`), sert le SPA Vite
  + reverse-proxy `/api` + `/socket.io` → 127.0.0.1:8080. Bind **IP Tailscale 100.64.0.1:8790**. Même origine → zéro CORS.

⚠️ **Ports VPS** : 8788=MCP, **8789=publer-mcp** (autre service), 8790=web-front · serve 8449=MCP, 8450=publer, **8451=web**.

### Secret en plus (`/opt/discord-mcp/.env`, chmod 600)
    WEB_JWT_SECRET=<openssl rand -hex 32>   # ≥32 chars sinon l'API refuse de booter (config.js)
    # RELAY_DATABASE_URL déjà présent (réutilisé par discord-web pour LIRE + LISTEN).

### Build (les 2 images) + run
    bash build.sh                 # build discord-mcp:latest ET discord-web-front:latest (réseau hôte)
    docker compose up -d          # 4 conteneurs : mcp, relay, web, web-front
    docker compose ps             # discord-web healthy attendu (/api/health)

### TLS via tailscale serve (port DÉDIÉ, ne pas toucher :8449 MCP ni :8450 publer-mcp)
    tailscale serve --bg --https=8451 http://100.64.0.1:8790
    # → https://ubuntu-8gb-nbg1-1.tail7d7bbd.ts.net:8451/  (SPA + API même origine, tailnet only)

### Vérifier (depuis un AUTRE nœud du tailnet) — PROUVÉ LIVE 2026-06-06
    H=ubuntu-8gb-nbg1-1.tail7d7bbd.ts.net
    curl -sw '%{http_code} verify=%{ssl_verify_result}\n' https://$H:8451/api/health   # {"ok":true} 200, verify=0 ✅
    curl -s https://$H:8451/ | grep -o '<title>[^<]*'                                  # <title>Cockpit Discord ✅
    curl -sw '%{http_code}\n' https://$H:8451/api/guilds                               # 401 (JWT requis, normal pré-P2b) ✅
⚠️ Login OAuth = P2b (pas encore : l'UI montre le bouton désactivé, l'API rejette les routes protégées → attendu).

## V2 — relais historique
Ajouter `agent-postgres` (déjà sur le VPS) + gateway listener + outils discord_history/discord_search.

## Backup discord_relay (restauré-PROUVÉ, pas juste configuré)
Scripts : `deploy/backup/` → déployés `/opt/discord-mcp/backup/`. Dumps : `/opt/backups/discord-relay/`.
- `backup.sh` — `pg_dump -Fc` compressé + rétention 14. Cron quotidien 03:00 UTC.
- `verify-restore.sh` — restaure le dernier dump dans une base scratch, compare count(messages) ET
  checksum md5 des ids vs la source, détruit la scratch. PASS ssi les DEUX coïncident. Cron hebdo dim 03:30.
- Logs : `/opt/backups/discord-relay/{backup,verify}.log`.
- ⚠️ Dumps LOCAUX au VPS (pas encore off-site) — DR complète = pousser les dumps hors-box (enhancement).
