/*
 * Corps markdown d'un message — chargé en LAZY (cf MarkdownContent.jsx).
 * ⚠️ Export DEFAULT obligatoire (React.lazy). JAMAIS de parsing maison (PLAN §9) ;
 *    HTML brut désactivé (skipHtml) = anti-XSS.
 */
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdComponents = {
  // Liens : nouvel onglet sûr. Paragraphes : pas de marge (densité chat).
  a: ({ node, ...props }) => <a target="_blank" rel="noreferrer noopener" className="text-blurple hover:underline" {...props} />,
  p: ({ node, ...props }) => <p className="m-0" {...props} />,
  code: ({ node, ...props }) => <code className="rounded bg-base-900 px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
};

export default function MarkdownBody({ content }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents} skipHtml>
      {content}
    </Markdown>
  );
}
