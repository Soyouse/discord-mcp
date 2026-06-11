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

-- ═══════════════════════════════════════════════════════════════════════════
-- ANNUAIRE (P0 client web) — serveurs / salons / membres persistés.
-- ⚠️ Le client web LIT ces tables (zéro REST live → plafond invalid-request par-IP évité).
-- ⚠️ tenant_id = COUTURE SaaS : constante 'default' en mono-tenant, JAMAIS retirée. Multi = peupler.
-- Hydratés par l'event gateway GUILD_CREATE (+ backfill REST) — voir P1.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS guilds (
  guild_id    TEXT PRIMARY KEY,
  name        TEXT,
  icon        TEXT,
  bot_id      TEXT NOT NULL,                     -- provenance : lequel de NOS bots voit ce serveur
  tenant_id   TEXT NOT NULL DEFAULT 'default',   -- couture SaaS
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guilds_tenant ON guilds (tenant_id);

CREATE TABLE IF NOT EXISTS channels (
  channel_id  TEXT PRIMARY KEY,
  guild_id    TEXT,                              -- NULL = DM
  type        INTEGER,
  name        TEXT,
  position    INTEGER,
  bot_id      TEXT NOT NULL,
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channels_guild ON channels (guild_id);

-- « Qui je peux DM » = union des membres (hors bots) des serveurs communs.
CREATE TABLE IF NOT EXISTS members (
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  username    TEXT,
  global_name TEXT,
  avatar      TEXT,
  is_bot      BOOLEAN NOT NULL DEFAULT FALSE,
  bot_id      TEXT NOT NULL,
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON members (user_id);

-- PROFIL utilisateur (GLOBAL, pas par-serveur) — enrichi par REST GET /users/{id} côté RELAIS
-- (enrich-profiles.js, garde 24h). Le gateway member-chunk NE donne PAS banner/primary_guild.
-- Dénormalisé sur chaque ligne member (mono-tenant, petit volume) ; updates par user_id (toutes guilds).
ALTER TABLE members ADD COLUMN IF NOT EXISTS public_flags      INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS banner            TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS accent_color      INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS tag               TEXT;  -- tag serveur affiché (ex: "2077")
ALTER TABLE members ADD COLUMN IF NOT EXISTS tag_badge         TEXT;  -- hash badge du tag (CDN clan-badges)
ALTER TABLE members ADD COLUMN IF NOT EXISTS tag_guild_id      TEXT;  -- guild du tag (compose l'URL badge)
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMPTZ;
