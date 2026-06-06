#!/bin/bash
# Build des images avec réseau HÔTE — OBLIGATOIRE sur le VPS Allemagne (Docker iptables:false → DNS conteneur KO).
# Log → build.log (contourne le timeout/quirk ssh_exec). Puis : docker compose up -d.
# Deux images : discord-mcp:latest (Node : mcp+relay+web) ET discord-web-front:latest (nginx : SPA Vite).
cd /opt/discord-mcp || exit 1
: > build.log
{
  echo "=== build discord-mcp:latest ===" \
  && docker build --network=host -t discord-mcp:latest . \
  && echo "=== build discord-web-front:latest ===" \
  && docker build --network=host -t discord-web-front:latest -f front/Dockerfile front/ \
  && echo "=== BUILD_OK ==="
} >> build.log 2>&1 &
echo "PID=$!"
