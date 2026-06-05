#!/bin/bash
# Preuve de RESTAURATION (pas juste « backup configuré ») : restaure le dernier dump dans une base
# scratch, compare count(messages) ET checksum md5 des ids vs la source, puis détruit la scratch.
# PASS uniquement si les DEUX coïncident. ⚠️ lancer via `bash verify-restore.sh`.
# Déployé sur le VPS : /opt/discord-mcp/backup/verify-restore.sh (cron hebdo dimanche 03:30 UTC).
set -euo pipefail
DIR=/opt/backups/discord-relay
DUMP=$(ls -1t "$DIR"/discord_relay_*.dump 2>/dev/null | head -1)
[ -n "$DUMP" ] || { echo "NO DUMP"; exit 1; }
echo "dump testé: $DUMP"

SCRATCH=discord_relay_verify
docker exec agent-postgres psql -U n8n -q -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH OWNER discord_relay;"
docker exec -i agent-postgres pg_restore -U n8n --no-owner -d "$SCRATCH" < "$DUMP"

q() { docker exec agent-postgres psql -U n8n -tAc "$2" -d "$1"; }
SRC=$(q discord_relay   "select count(*) from messages")
RES=$(q "$SCRATCH"      "select count(*) from messages")
SRCSUM=$(q discord_relay "select coalesce(md5(string_agg(message_id, ',' order by message_id)),'EMPTY') from messages")
RESSUM=$(q "$SCRATCH"    "select coalesce(md5(string_agg(message_id, ',' order by message_id)),'EMPTY') from messages")

docker exec agent-postgres psql -U n8n -q -c "DROP DATABASE $SCRATCH;"

echo "source=$SRC restored=$RES"
echo "srcsum=$SRCSUM ressum=$RESSUM"
if [ "$SRC" = "$RES" ] && [ "$SRCSUM" = "$RESSUM" ]; then echo "RESTORE PASS"; else echo "RESTORE FAIL"; exit 1; fi
