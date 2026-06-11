/*
 * Construction du FIL d'affichage (PUR, mutation-testé) — Discord-like :
 * - séparateur de DATE quand le jour change ;
 * - message COMPACT (sans avatar/en-tête) si même auteur que le précédent, même jour, écart < 7 min.
 * Entrée : messages TRIÉS ASC (garanti par useHistory select). Sortie : items {kind:"divider"|"message"}.
 */
const COMPACT_WINDOW_MS = 7 * 60 * 1000;

function dayKey(iso) {
  return String(iso ?? "").slice(0, 10); // YYYY-MM-DD (ISO) — comparaison de jour sans TZ math
}

export function formatDayLabel(iso, locale = "fr-FR") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function buildFeed(messages = []) {
  const items = [];
  let prev = null;
  for (const msg of messages) {
    const day = dayKey(msg.created_at);
    if (!prev || dayKey(prev.created_at) !== day) {
      items.push({ kind: "divider", id: `day-${day}`, iso: msg.created_at });
    }
    const compact =
      !!prev &&
      dayKey(prev.created_at) === day &&
      prev.author_id != null &&
      prev.author_id === msg.author_id &&
      !msg.pending === !prev.pending &&
      new Date(msg.created_at) - new Date(prev.created_at) < COMPACT_WINDOW_MS;
    items.push({ kind: "message", id: msg.message_id, message: msg, compact });
    prev = msg;
  }
  return items;
}
