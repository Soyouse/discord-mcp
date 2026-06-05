# Relais — chemin de scalabilité (zéro dette : l'upgrade est ÉCRIT, pas découvert sous le feu)

Principe : on n'ajoute aucune infra avant d'en avoir besoin (anti *premature scaling*).
La stack actuelle est de grade hyperscale par ses **coutures**, pas par sa lourdeur.
Chaque palier ci-dessous se franchit **sans réécrire le cœur** (handleDispatch + repository pattern).

## Coutures déjà en place (ne pas casser)
- `relay/ingest.js::handleDispatch(type, data, ctx)` — NE connaît pas le websocket. Frontière ingestion⊥persistance.
- Repository pattern (`memory` / `pg`) — Postgres remplaçable derrière un contrat unique.
- Connstring `RELAY_DATABASE_URL` — point d'injection (PgBouncer, replica lecture).
- Idempotence exactly-once GRATUITE : upsert par snowflake PK → resume gateway qui rejoue = zéro doublon.

## Paliers (trigger → action → couture utilisée)

1. **≥ 2 500 serveurs / bot** → sharding gateway.
   Action : `new WebSocketManager({ shardCount, shardIds })` (natif @discordjs/ws, multi-process possible).
   Aucune nouvelle dépendance. Le writer reste unique (les shards écrivent dans le même repo).

2. **Le writer lag (events/s > débit upsert)** → écriture batchée.
   Action : bufferiser dans le listener → INSERT multi-lignes / COPY. UN seul endroit (le writer).
   Pas de nouvelle dépendance.

3. **Ingestion multi-machines / besoin de replay / fan-out N consumers** → bus de messages.
   Action : le listener PUBLIE (NATS JetStream conseillé : persistant, ~200-400k msg/s, 1-5ms) au lieu d'appeler
   le repo ; un consumer séparé rappelle `handleDispatch`. Le cœur ne bouge pas (couture déjà là).
   Seul cas qui justifie vraiment un bus — PAS le simple nombre d'agents (ingestion centralisée = zéro concurrence).

4. **Lectures chaudes (recherche/historique très sollicités)** → cache.
   Action : `CachingRepository` qui décore le repo PG (Redis). Les appelants ne changent pas.

5. **Table énorme (~50-100 M lignes, ou latence index qui monte)** → partitionnement.
   Action : `messages` en `PARTITION BY RANGE (created_at)`, partitions mensuelles (+ routine de création,
   pg_partman si on veut l'automatiser). Le repository masque le changement → zéro impact appelants.

6. **Vrai hyperscale write-bound (milliards de lignes, la voie Discord)** → store wide-column.
   Action : nouvelle impl du contrat repository sur ScyllaDB/Cassandra. Postgres reste pour métadonnées/FTS.
   Le repository pattern EST la porte de sortie — aucune réécriture des outils MCP.

## Observabilité (à brancher au déploiement, pas une dette structurelle)
Compteurs in-process : events ingérés, erreurs, lag. Exposés comme `discord_health` côté MCP.
