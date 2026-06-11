/*
 * Contenu d'un message — rendu markdown LAZY (perf : le chunk `markdown` ≈ 56ko gzip = 26% du JS
 * initial sort du chemin critique du boot ; il ne se charge qu'au PREMIER message affiché).
 * ⚠️ Fallback Suspense = texte BRUT (whitespace-pre-wrap) : aucun flash vide pendant le chargement
 *    du chunk ; le markdown remplace le brut dès qu'il est prêt (un seul chargement, ensuite sync).
 */
import { lazy, Suspense } from "react";

const MarkdownBody = lazy(() => import("./MarkdownBody.jsx"));

export function MarkdownContent({ content }) {
  return (
    <Suspense fallback={<span className="whitespace-pre-wrap">{content}</span>}>
      <MarkdownBody content={content} />
    </Suspense>
  );
}
