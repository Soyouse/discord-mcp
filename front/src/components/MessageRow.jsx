/*
 * Une ligne de message (PURE). Forme = projection API (relay/query.js formatRow).
 * ⚠️ Contenu rendu en MARKDOWN via MarkdownContent (react-markdown LAZY — perf boot) — JAMAIS de
 *    parsing maison (piège n°1, PLAN §9). HTML brut DÉSACTIVÉ (skipHtml) = anti-XSS.
 * ⚠️ Temps relatif via date-fns (locale fr). `pending` (optimiste) → opacité réduite.
 */
import { Avatar } from "./Avatar.jsx";
import { MarkdownContent } from "./MarkdownContent.jsx";
import { formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function relative(iso) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}

// `compact` (buildFeed) : message consécutif du même auteur → pas d'avatar/en-tête, contenu aligné
// sous le précédent (gouttière fixe = largeur avatar h-9/w-9 + gap, comme le vrai Discord).
// `tag` = { tag, badgeUrl? } (tag serveur de l'auteur, annuaire) → chip à côté du pseudo, comme Discord.
export function MessageRow({ message, avatarUrl = null, tag = null, compact = false }) {
  const author = message.author || message.author_id || "inconnu";
  if (compact) {
    return (
      <div className={`flex gap-3 px-4 py-0.5 hover:bg-base-600/40 ${message.pending ? "opacity-50" : ""}`}>
        <div className="w-9 shrink-0" />
        <div className="min-w-0 flex-1 break-words text-sm text-text-normal">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            <span className="italic text-text-muted">(sans contenu)</span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex gap-3 px-4 py-1.5 hover:bg-base-600/40 ${message.pending ? "opacity-50" : ""}`}>
      <div className="mt-0.5">
        <Avatar src={avatarUrl} name={author} className="h-9 w-9 rounded-full text-sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-text-normal">{author}</span>
          {tag?.tag ? (
            <span className="flex items-center gap-0.5 rounded bg-base-900 px-1 text-[10px] font-semibold text-text-normal">
              {tag.badgeUrl ? <img src={tag.badgeUrl} alt="" className="h-3 w-3" /> : null}
              {tag.tag}
            </span>
          ) : null}
          <time className="font-mono text-xs text-text-muted">{relative(message.created_at)}</time>
          {message.edited_at ? <span className="text-xs text-text-muted">(modifié)</span> : null}
          {message.pending ? <span className="text-xs text-text-muted">envoi…</span> : null}
        </div>
        <div className="break-words text-sm text-text-normal">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            <span className="italic text-text-muted">(sans contenu)</span>
          )}
        </div>
      </div>
    </div>
  );
}
