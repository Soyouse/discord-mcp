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

## V2 — relais historique
Ajouter `agent-postgres` (déjà sur le VPS) + gateway listener + outils discord_history/discord_search.
