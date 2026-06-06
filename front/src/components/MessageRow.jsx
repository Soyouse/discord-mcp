/*
 * Une ligne de message (PURE). Forme = projection API (relay/query.js formatRow).
 * ⚠️ Contenu rendu en MARKDOWN via react-markdown (gras/italique/code/liens) — JAMAIS de parsing maison
 *    (piège n°1, PLAN §9). HTML brut DÉSACTIVÉ (pas de dangerouslySetInnerHTML) = anti-XSS.
 * ⚠️ Temps relatif via date-fns (locale fr). `pending` (optimiste) → opacité réduite.
 */
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const mdComponents = {
  // Liens : nouvel onglet sûr. Paragraphes : pas de marge (densité chat).
  a: ({ node, ...props }) => <a target="_blank" rel="noreferrer noopener" className="text-blurple hover:underline" {...props} />,
  p: ({ node, ...props }) => <p className="m-0" {...props} />,
  code: ({ node, ...props }) => <code className="rounded bg-base-900 px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
};

export function MessageRow({ message }) {
  const author = message.author || message.author_id || "inconnu";
  const initial = author.slice(0, 1).toUpperCase();
  return (
    <div className={`flex gap-3 px-4 py-1.5 hover:bg-base-600/40 ${message.pending ? "opacity-50" : ""}`}>
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-600 text-sm font-semibold text-text-normal">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-text-normal">{author}</span>
          <time className="font-mono text-xs text-text-muted">{relative(message.created_at)}</time>
          {message.edited_at ? <span className="text-xs text-text-muted">(modifié)</span> : null}
          {message.pending ? <span className="text-xs text-text-muted">envoi…</span> : null}
        </div>
        <div className="break-words text-sm text-text-normal">
          {message.content ? (
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents} skipHtml>
              {message.content}
            </Markdown>
          ) : (
            <span className="italic text-text-muted">(sans contenu)</span>
          )}
        </div>
      </div>
    </div>
  );
}
