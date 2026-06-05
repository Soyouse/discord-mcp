# Déploiement — Discord MCP (service HTTP 24/7, VPS Allemagne)

Cible : `100.64.0.1` (Tailscale). Service écoute en **127.0.0.1** ; accès distant via Tailscale + Bearer.

## 1. Code + deps
    rsync/git → /opt/discord-mcp   (sans node_modules ni .secrets.json)
    cd /opt/discord-mcp && npm ci --omit=dev

## 2. Secrets (jamais en repo)
    /etc/discord-mcp/secrets.json   # {default, bots:{...}}  — perms 600 root
    /etc/discord-mcp/env            # perms 600 root :
        DISCORD_MCP_HTTP_TOKEN=<aléatoire 32+ octets>
        DISCORD_SECRETS_PATH=/etc/discord-mcp/secrets.json
        DISCORD_MCP_HTTP_HOST=127.0.0.1
        DISCORD_MCP_HTTP_PORT=8788

## 3. systemd
    cp deploy/discord-mcp.service /etc/systemd/system/
    systemctl daemon-reload && systemctl enable --now discord-mcp
    systemctl status discord-mcp ; journalctl -u discord-mcp -f

## 4. Brancher l'agent (poste de Théo)
~/.mcp.json → entrée `discord` en transport HTTP :
    url   = http://100.64.0.1:8788/mcp   (IP Tailscale)
    header Authorization: Bearer <DISCORD_MCP_HTTP_TOKEN>

## 5. Vérifier
    discord_health → bots listés, warn:false. Puis un POST message de baptême.

⚠️ Cutover : tant que le service distant n'est pas prouvé, garder le MCP stdio local en parallèle.
