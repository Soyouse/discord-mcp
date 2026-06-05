/**
 * Normalisation d'un message Discord (gateway OU REST) → ligne canonique du relais.
 * ⚠️ Fonction PURE (zéro I/O) : c'est le contrat de données, testé exhaustivement.
 * Gateway (MESSAGE_CREATE) et REST (GET /channels/{id}/messages) ont le MÊME schéma de message
 * → une seule normalisation pour les deux chemins d'ingestion (live + backfill).
 */

/** @param {object} raw  payload message Discord brut. @param {string} botId  bot ingérant (provenance). */
export function normalizeMessage(raw, botId) {
  if (!raw || typeof raw.id !== "string") {
    throw new Error("normalizeMessage: message.id (snowflake string) requis");
  }
  if (!botId) throw new Error("normalizeMessage: botId requis (provenance)");
  if (!raw.channel_id) throw new Error("normalizeMessage: channel_id requis");
  const author = raw.author || {};
  if (!author.id) throw new Error("normalizeMessage: author.id requis");

  return {
    message_id: raw.id,
    channel_id: raw.channel_id,
    guild_id: raw.guild_id ?? null, // NULL en DM
    author_id: author.id,
    author_username: author.username ?? null,
    bot_id: botId,
    content: raw.content ?? null,
    created_at: parseTs(raw.timestamp) ?? snowflakeToDate(raw.id),
    edited_at: parseTs(raw.edited_timestamp),
    raw,
  };
}

/** ISO Discord → Date, ou null. */
function parseTs(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Époque Discord (2015-01-01). Le snowflake encode le temps sur ses 42 bits de poids fort
// → ordre chronologique garanti même si le champ `timestamp` manque (fallback robuste).
const DISCORD_EPOCH = 1420070400000n;

/** @param {string} id snowflake → Date de création. */
export function snowflakeToDate(id) {
  const ms = (BigInt(id) >> 22n) + DISCORD_EPOCH;
  return new Date(Number(ms));
}
