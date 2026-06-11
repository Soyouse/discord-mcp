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
  const guilds = new Map(); // guild_id -> row
  const channels = new Map(); // channel_id -> row
  const members = new Map(); // `${guild_id}:${user_id}` -> row

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
      return rows.slice(0, limit).map(projectRead);
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
      return rows.slice(0, limit).map(projectRead);
    },

    async getBackfillCursor(channelId) {
      return cursors.get(channelId) ?? null;
    },

    async setBackfillCursor({ channelId, oldestSeenId, complete = false }) {
      cursors.set(channelId, { oldest_seen_id: oldestSeenId, complete });
    },

    // ── ANNUAIRE (P0) — upsert idempotent (gateway et backfill se recouvrent), lecture pour le client web ──

    async upsertGuild(row) {
      guilds.set(row.guild_id, { ...row });
    },

    async upsertChannel(row) {
      channels.set(row.channel_id, { ...row });
    },

    async upsertMember(row) {
      // ⚠️ MERGE (pas replace) : le chunk gateway n'a PAS les champs PROFIL (banner/tag/flags,
      //    enrichis par REST) — un replace les effacerait à chaque reconnexion. Parité PG (SET partiel).
      const key = `${row.guild_id}:${row.user_id}`;
      members.set(key, { ...(members.get(key) ?? {}), ...row });
    },

    // PROFIL global (REST enrich-profiles) : update par user_id sur TOUTES les guilds (donnée user, pas member).
    async updateUserProfile(userId, profile) {
      for (const [key, m] of members) {
        if (m.user_id === userId) members.set(key, { ...m, ...profile, profile_synced_at: profile.profile_synced_at });
      }
    },

    // user_ids dont le profil n'a jamais été synchronisé OU est plus vieux que `before` (garde 24h).
    async listUserIdsNeedingProfileSync({ before } = {}) {
      const out = new Set();
      for (const m of members.values()) {
        const ts = m.profile_synced_at ? new Date(m.profile_synced_at) : null;
        if (!ts || (before && ts < new Date(before))) out.add(m.user_id);
      }
      return [...out].sort();
    },

    async removeChannel(channelId) {
      channels.delete(channelId);
    },

    async removeMember(guildId, userId) {
      members.delete(`${guildId}:${userId}`);
    },

    async listGuilds({ tenantId } = {}) {
      let rows = [...guilds.values()];
      if (tenantId) rows = rows.filter((g) => g.tenant_id === tenantId);
      return rows.sort((a, b) => cmp(a.guild_id, b.guild_id));
    },

    async listChannels({ guildId, tenantId } = {}) {
      let rows = [...channels.values()].filter((c) => c.guild_id === guildId);
      if (tenantId) rows = rows.filter((c) => c.tenant_id === tenantId);
      // position d'abord (ordre Discord), channel_id en départage stable.
      return rows.sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || cmp(a.channel_id, b.channel_id)
      );
    },

    // Annuaire COMPLET d'un serveur, BOTS INCLUS (≠ listDMables) — même contrat que pg-repository.
    async listMembers({ guildId, tenantId } = {}) {
      let rows = [...members.values()].filter((m) => m.guild_id === guildId);
      if (tenantId) rows = rows.filter((m) => m.tenant_id === tenantId);
      return rows.sort((a, b) => cmp(a.user_id, b.user_id));
    },

    // « Qui je peux DM » : union des membres HORS bots, dédupliquée par user_id (présent dans N serveurs).
    async listDMables({ tenantId } = {}) {
      const seen = new Map(); // user_id -> row (dernier vu gagne)
      for (const m of members.values()) {
        if (m.is_bot) continue;
        if (tenantId && m.tenant_id !== tenantId) continue;
        seen.set(m.user_id, m);
      }
      return [...seen.values()].sort((a, b) => cmp(a.user_id, b.user_id));
    },

    async close() {},
  };
}

// Projection de LECTURE — MÊME contrat que READ_COLUMNS de pg-repository : les lectures
// (getHistory/search) n'exposent JAMAIS `raw` (gros JSONB jeté par formatRow). Parité scellée
// par le test de contrat « n'expose pas raw ».
function projectRead(r) {
  return {
    message_id: r.message_id,
    channel_id: r.channel_id,
    guild_id: r.guild_id,
    author_id: r.author_id,
    author_username: r.author_username,
    content: r.content,
    created_at: r.created_at,
    edited_at: r.edited_at,
  };
}

// Tri stable de chaînes (ids snowflake) — réplique l'ORDER BY texte de Postgres.
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function tokenize(s) {
  return String(s)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
