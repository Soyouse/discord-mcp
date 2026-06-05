/**
 * Logique des outils de LECTURE (discord_history / discord_search).
 * ⚠️ Prend un `repo` en paramètre → testable contre le repo mémoire (même contrat que PG).
 *    Les handlers MCP ne font que brancher getReadRepo() dessus.
 * Validation stricte des entrées : limites bornées, dates ISO contrôlées (pas de NaN silencieux).
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function clampLimit(v, def = DEFAULT_LIMIT, max = MAX_LIMIT) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

/** ISO string → Date. undefined/null → undefined. Invalide → throw (pas de filtre silencieux faux). */
export function parseDate(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`date invalide: ${v} (attendu ISO 8601)`);
  return d;
}

/** Projette une ligne brute → sortie publique (sans raw/tsv/rank internes). */
export function formatRow(r) {
  return {
    message_id: r.message_id,
    channel_id: r.channel_id,
    guild_id: r.guild_id ?? null,
    author_id: r.author_id,
    author: r.author_username ?? null,
    content: r.content ?? null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    edited_at: r.edited_at instanceof Date ? r.edited_at.toISOString() : (r.edited_at ?? null),
  };
}

export async function runHistory(repo, args = {}) {
  if (!args.channel_id) throw new Error("channel_id requis");
  const rows = await repo.getHistory({
    channelId: args.channel_id,
    limit: clampLimit(args.limit),
    before: parseDate(args.before),
    after: parseDate(args.after),
  });
  return rows.map(formatRow);
}

export async function runSearch(repo, args = {}) {
  if (!args.query || !String(args.query).trim()) throw new Error("query requise");
  const rows = await repo.search({
    query: String(args.query),
    guildId: args.guild_id,
    channelId: args.channel_id,
    authorId: args.author_id,
    limit: clampLimit(args.limit, 25, MAX_LIMIT),
  });
  return rows.map(formatRow);
}
