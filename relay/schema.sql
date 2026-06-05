-- Discord relais — schéma historique messages.
-- ⚠️ Idempotent (IF NOT EXISTS partout) : rejoué sans danger à chaque démarrage du relais.
-- ⚠️ Base DÉDIÉE `discord_relay` (rôle discord_relay) — JAMAIS la base n8n partagée.
-- Source de vérité unique de l'historique : le gateway écrit ici, le MCP lit ici (zéro appel REST).

CREATE TABLE IF NOT EXISTS messages (
  message_id       TEXT PRIMARY KEY,                 -- snowflake (string : 64 bits hors safe-int JS)
  channel_id       TEXT NOT NULL,
  guild_id         TEXT,                             -- NULL en DM
  author_id        TEXT NOT NULL,
  author_username  TEXT,
  bot_id           TEXT NOT NULL,                    -- provenance : lequel de NOS bots a ingéré (multi-bot)
  content          TEXT,
  created_at       TIMESTAMPTZ NOT NULL,             -- timestamp du message (ordre chronologique fiable)
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,                      -- soft-delete : MESSAGE_DELETE garde l'historique
  raw              JSONB,                            -- payload complet (pièces jointes/embeds) — future-proof
  -- FTS : config 'simple' (pas de stemming) — chat multilingue FR/EN/code, évite le mauvais stemming.
  tsv              TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED
);

-- Pagination historique par salon, plus récent d'abord.
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages (channel_id, created_at DESC);
-- Recherche full-text.
CREATE INDEX IF NOT EXISTS idx_messages_tsv ON messages USING GIN (tsv);
-- Filtres recherche fréquents.
CREATE INDEX IF NOT EXISTS idx_messages_guild_created  ON messages (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author         ON messages (author_id);

-- Curseurs de backfill REST par salon (où on s'est arrêté de remonter l'historique).
CREATE TABLE IF NOT EXISTS backfill_cursor (
  channel_id      TEXT PRIMARY KEY,
  oldest_seen_id  TEXT,            -- plus vieux message déjà rapatrié (on remonte avant celui-ci)
  complete        BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = début du salon atteint
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
