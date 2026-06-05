/**
 * Repository EN MÉMOIRE — même contrat que pg-repository.
 * ⚠️ Raison d'être : tester la logique métier (upsert idempotent, soft-delete, pagination,
 *    recherche) SANS vraie base. Les tests de contrat tournent contre CE repo + le PG réel.
 * La recherche imite la FTS au niveau comportement (match par token, exclut les supprimés) ;
 * le ranking fin reste spécifique à Postgres et n'est pas dans le contrat partagé.
 */
export function createMemoryRepository() {
  const byId = new Map(); // message_id -> row
  const cursors = new Map(); // channel_id -> {oldest_seen_id, complete}

  return {
    async upsertMessage(row) {
      const prev = byId.get(row.message_id);
      // Idempotent : backfill et live peuvent revoir le même message. On ne ressuscite pas un supprimé.
      byId.set(row.message_id, {
        ...row,
        deleted_at: prev?.deleted_at ?? null,
      });
    },

    async markDeleted(messageId, deletedAt) {
      const row = byId.get(messageId);
      if (row) row.deleted_at = deletedAt;
    },

    async getHistory({ channelId, before, after, limit = 50 }) {
      let rows = [...byId.values()].filter(
        (r) => r.channel_id === channelId && !r.deleted_at
      );
      if (before) rows = rows.filter((r) => r.created_at < before);
      if (after) rows = rows.filter((r) => r.created_at > after);
      rows.sort((a, b) => b.created_at - a.created_at); // plus récent d'abord
      return rows.slice(0, limit);
    },

    async search({ query, guildId, channelId, authorId, limit = 25 }) {
      const terms = tokenize(query);
      if (!terms.length) return [];
      let rows = [...byId.values()].filter((r) => !r.deleted_at && r.content);
      if (guildId) rows = rows.filter((r) => r.guild_id === guildId);
      if (channelId) rows = rows.filter((r) => r.channel_id === channelId);
      if (authorId) rows = rows.filter((r) => r.author_id === authorId);
      rows = rows.filter((r) => {
        const hay = tokenize(r.content);
        return terms.every((t) => hay.includes(t));
      });
      rows.sort((a, b) => b.created_at - a.created_at);
      return rows.slice(0, limit);
    },

    async getBackfillCursor(channelId) {
      return cursors.get(channelId) ?? null;
    },

    async setBackfillCursor({ channelId, oldestSeenId, complete = false }) {
      cursors.set(channelId, { oldest_seen_id: oldestSeenId, complete });
    },

    async close() {},
  };
}

function tokenize(s) {
  return String(s)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
