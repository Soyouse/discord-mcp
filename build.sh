#!/bin/bash
# Build image avec réseau HÔTE — OBLIGATOIRE sur le VPS Allemagne (Docker iptables:false → DNS conteneur KO).
# Log → build.log (contourne le timeout/quirk ssh_exec). Puis : docker compose up -d.
cd /opt/discord-mcp || exit 1
: > build.log
nohup docker build --network=host -t discord-mcp:latest . >> build.log 2>&1 &
echo "PID=$!"
