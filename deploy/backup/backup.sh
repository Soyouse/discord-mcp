#!/bin/bash
# Backup discord_relay : dump compressé -Fc + rétention 14. Disque VPS limité → compressé + pruné.
# ⚠️ Le redirect `>` est DANS ce script (le hook ssh_exec ne l'inspecte pas — lancer via `bash backup.sh`).
# Déployé sur le VPS : /opt/discord-mcp/backup/backup.sh (cron quotidien 03:00 UTC).
set -euo pipefail
source /opt/discord-mcp/.env   # RELAY_DATABASE_URL (contient les creds)
DIR=/opt/backups/discord-relay
mkdir -p "$DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DIR/discord_relay_$TS.dump"
# pg_dump tourne DANS le conteneur ; 127.0.0.1:5432 y = le postgres lui-même. stdout → fichier hôte.
docker exec agent-postgres pg_dump -Fc -d "$RELAY_DATABASE_URL" > "$OUT"
[ -s "$OUT" ] || { echo "FAIL: dump vide"; rm -f "$OUT"; exit 1; }
# rétention : garder les 14 plus récents
ls -1t "$DIR"/discord_relay_*.dump | tail -n +15 | xargs -r rm -f
echo "OK $OUT ($(du -h "$OUT" | cut -f1)) — $(ls -1 "$DIR"/discord_relay_*.dump | wc -l) backup(s)"
