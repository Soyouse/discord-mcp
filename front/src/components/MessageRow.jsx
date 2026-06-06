/*
 * Une ligne de message (PURE, pilotée par props). Forme = projection API (relay/query.js formatRow) :
 *   { message_id, channel_id, author_id, author, content, created_at, edited_at }.
 * ⚠️ Rendu markdown (gras/code/mentions) = P5e (react-markdown) — ici texte brut, pas de parsing maison.
 * ⚠️ Temps relatif = P5e (date-fns) — ici l'heure ISO telle quelle (hh:mm) sans lib.
 */
function hhmm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MessageRow({ message }) {
  const author = message.author || message.author_id || "inconnu";
  const initial = author.slice(0, 1).toUpperCase();
  return (
    <div className="flex gap-3 px-4 py-1.5 hover:bg-base-600/40">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-600 text-sm font-semibold text-text-normal">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-text-normal">{author}</span>
          <time className="font-mono text-xs text-text-muted">{hhmm(message.created_at)}</time>
          {message.edited_at ? <span className="text-xs text-text-muted">(modifié)</span> : null}
        </div>
        <div className="whitespace-pre-wrap break-words text-sm text-text-normal">
          {message.content || <span className="italic text-text-muted">(sans contenu)</span>}
        </div>
      </div>
    </div>
  );
}
