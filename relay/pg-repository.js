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

    async close() {
      await pool.end();
    },
  };
}
