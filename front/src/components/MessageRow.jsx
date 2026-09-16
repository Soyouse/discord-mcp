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
import { messageUrl } from "../lib/message-url.js";

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
  const permalink = messageUrl({ guildId: message.guild_id, channelId: message.channel_id, messageId: message.message_id });
  const embeds = Array.isArray(message.embeds) ? message.embeds : [];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const embed = embeds[0] ?? null;
  const fields = Array.isArray(embed?.fields) ? embed.fields : [];
  const hasRichContent = Boolean(message.content) || embeds.length > 0 || attachments.length > 0;
  const richContent = (
    <>
      {message.content ? <MarkdownContent content={message.content} /> : null}
      {embed ? (
        <div className="mt-2 max-w-xl rounded border-l-4 border-blurple bg-base-700 px-3 py-2 text-sm">
          {embed.url ? <a href={embed.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-blurple hover:underline">{embed.title || "Ouvrir le lien"}</a> : embed.title ? <div className="font-semibold text-text-normal">{embed.title}</div> : null}
          {embed.description ? <div className="mt-1 whitespace-pre-wrap text-text-muted">{embed.description}</div> : null}
          {fields.map((field, fieldIndex) => (
            <div key={`${field.name ?? "field"}-${fieldIndex}`} className="mt-2">
              <div className="font-medium text-text-normal">{field.name}</div>
              <div className="whitespace-pre-wrap text-text-muted">{field.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {attachments.map((attachment) => (
        <a key={attachment.id || attachment.url} href={attachment.url} target="_blank" rel="noreferrer noopener" className="mt-2 block text-sm text-blurple hover:underline">
          📎 {attachment.filename || "Pièce jointe"}
        </a>
      ))}
    </>
  );
  if (compact) {
    return (
      <div className={`flex gap-3 px-4 py-0.5 hover:bg-base-600/40 ${message.pending ? "opacity-50" : ""}`}>
        <div className="w-9 shrink-0" />
        <div className="min-w-0 flex-1 break-words text-sm text-text-normal">
          {hasRichContent ? richContent : (
            <span className="italic text-text-muted">(sans contenu)</span>
          )}
        </div>
        {permalink ? <a href={permalink} target="_blank" rel="noreferrer noopener" className="shrink-0 text-xs text-text-muted hover:text-blurple" aria-label="Ouvrir le message dans Discord" title="Ouvrir dans Discord">↗</a> : null}
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
          {permalink ? (
            <a href={permalink} target="_blank" rel="noreferrer noopener" className="font-mono text-xs text-text-muted hover:text-blurple hover:underline" title="Ouvrir dans Discord">{relative(message.created_at)}</a>
          ) : <time className="font-mono text-xs text-text-muted">{relative(message.created_at)}</time>}
          {message.edited_at ? <span className="text-xs text-text-muted">(modifié)</span> : null}
          {message.pending ? <span className="text-xs text-text-muted">envoi…</span> : null}
        </div>
        <div className="break-words text-sm text-text-normal">
          {hasRichContent ? richContent : (
            <span className="italic text-text-muted">(sans contenu)</span>
          )}
        </div>
      </div>
    </div>
  );
}
