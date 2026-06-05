/**
 * Repository POSTGRES — implémentation réelle du contrat (cf memory-repository pour la sémantique).
 * ⚠️ Repository pattern OBLIGATOIRE : Postgres reste remplaçable, et la logique est testée via
 *    memory-repository sans vraie base. Les MÊMES tests de contrat tournent ici contre un PG réel (CI).
 * ⚠️ upsert idempotent (backfill ⊥ live se recouvrent) et NE ressuscite JAMAIS un message supprimé.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

/** Pool depuis une connstring (RELAY_DATABASE_URL). */
export function createPool(connectionString) {
  if (!connectionString) throw new Error("createPool: RELAY_DATABASE_URL requis");
  return new pg.Pool({ connectionString, max: 4 });
}

/** Applique le schéma (idempotent). À appeler au démarrage du relais. */
export async function migrate(pool) {
  await pool.query(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

export function createPgRepository(pool) {
  return {
    async upsertMessage(row) {
      await pool.query(
        `INSERT INTO messages
           (message_id, channel_id, guild_id, author_id, author_username, bot_id, content, created_at, edited_at, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (message_id) DO UPDATE SET
           content         = EXCLUDED.content,
           edited_at       = EXCLUDED.edited_at,
           author_username = EXCLUDED.author_username,
           raw             = EXCLUDED.raw`,
        // deleted_at JAMAIS dans le SET → un re-upsert ne ressuscite pas un message supprimé.
        [
          row.message_id, row.channel_id, row.guild_id, row.author_id,
          row.author_username, row.bot_id, row.content, row.created_at,
          row.edited_at, JSON.stringify(row.raw ?? null),
        ]
      );
    },

    async markDeleted(messageId, deletedAt) {
      await pool.query(`UPDATE messages SET deleted_at = $2 WHERE message_id = $1`, [
        messageId,
        deletedAt,
      ]);
    },

    async getHistory({ channelId, before, after, limit = 50 }) {
      const cond = ["channel_id = $1", "deleted_at IS NULL"];
      const params = [channelId];
      if (before) { params.push(before); cond.push(`created_at < $${params.length}`); }
      if (after) { params.push(after); cond.push(`created_at > $${params.length}`); }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT * FROM messages WHERE ${cond.join(" AND ")}
         ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return rows;
    },

    async search({ query, guildId, channelId, authorId, limit = 25 }) {
      const cond = ["tsv @@ plainto_tsquery('simple', $1)", "deleted_at IS NULL"];
      const params = [query];
      if (guildId) { params.push(guildId); cond.push(`guild_id = $${params.length}`); }
      if (channelId) { params.push(channelId); cond.push(`channel_id = $${params.length}`); }
      if (authorId) { params.push(authorId); cond.push(`author_id = $${params.length}`); }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT *, ts_rank(tsv, plainto_tsquery('simple', $1)) AS rank
         FROM messages WHERE ${cond.join(" AND ")}
         ORDER BY rank DESC, created_at DESC LIMIT $${params.length}`,
        params
      );
      return rows;
    },

    async getBackfillCursor(channelId) {
      const { rows } = await pool.query(
        `SELECT oldest_seen_id, complete FROM backfill_cursor WHERE channel_id = $1`,
        [channelId]
      );
      return rows[0] ?? null;
    },

    async setBackfillCursor({ channelId, oldestSeenId, complete = false }) {
      await pool.query(
        `INSERT INTO backfill_cursor (channel_id, oldest_seen_id, complete, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (channel_id) DO UPDATE SET
           oldest_seen_id = EXCLUDED.oldest_seen_id,
           complete       = EXCLUDED.complete,
           updated_at     = now()`,
        [channelId, oldestSeenId, complete]
      );
    },

    // ── ANNUAIRE (P0) — mêmes méthodes/contrat que memory-repository. Prouvé par relay-directory.test.js ──

    async upsertGuild(row) {
      await pool.query(
        `INSERT INTO guilds (guild_id, name, icon, bot_id, tenant_id, updated_at)
         VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (guild_id) DO UPDATE SET
           name = EXCLUDED.name, icon = EXCLUDED.icon,
           bot_id = EXCLUDED.bot_id, tenant_id = EXCLUDED.tenant_id, updated_at = now()`,
        [row.guild_id, row.name, row.icon, row.bot_id, row.tenant_id]
      );
    },

    async upsertChannel(row) {
      await pool.query(
        `INSERT INTO channels (channel_id, guild_id, type, name, position, bot_id, tenant_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (channel_id) DO UPDATE SET
           guild_id = EXCLUDED.guild_id, type = EXCLUDED.type, name = EXCLUDED.name,
           position = EXCLUDED.position, bot_id = EXCLUDED.bot_id,
           tenant_id = EXCLUDED.tenant_id, updated_at = now()`,
        [row.channel_id, row.guild_id, row.type, row.name, row.position, row.bot_id, row.tenant_id]
      );
    },

    async upsertMember(row) {
      await pool.query(
        `INSERT INTO members (guild_id, user_id, username, global_name, avatar, is_bot, bot_id, tenant_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
         ON CONFLICT (guild_id, user_id) DO UPDATE SET
           username = EXCLUDED.username, global_name = EXCLUDED.global_name,
           avatar = EXCLUDED.avatar, is_bot = EXCLUDED.is_bot,
           bot_id = EXCLUDED.bot_id, tenant_id = EXCLUDED.tenant_id, updated_at = now()`,
        [row.guild_id, row.user_id, row.username, row.global_name, row.avatar, row.is_bot, row.bot_id, row.tenant_id]
      );
    },

    async listGuilds({ tenantId } = {}) {
      const cond = [];
      const params = [];
      if (tenantId) { params.push(tenantId); cond.push(`tenant_id = $${params.length}`); }
      const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
      const { rows } = await pool.query(`SELECT * FROM guilds ${where} ORDER BY guild_id`, params);
      return rows;
    },

    async listChannels({ guildId, tenantId } = {}) {
      const cond = ["guild_id = $1"];
      const params = [guildId];
      if (tenantId) { params.push(tenantId); cond.push(`tenant_id = $${params.length}`); }
      const { rows } = await pool.query(
        `SELECT * FROM channels WHERE ${cond.join(" AND ")}
         ORDER BY position NULLS LAST, channel_id`,
        params
      );
      return rows;
    },

    async listDMables({ tenantId } = {}) {
      const cond = ["is_bot = FALSE"];
      const params = [];
      if (tenantId) { params.push(tenantId); cond.push(`tenant_id = $${params.length}`); }
      // DISTINCT ON (user_id) : 1 ligne/utilisateur même présent dans N serveurs communs.
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (user_id) *
         FROM members WHERE ${cond.join(" AND ")}
         ORDER BY user_id, updated_at DESC`,
        params
      );
      return rows;
    },

    async close() {
      await pool.end();
    },
  };
}
