/*
 * Panneau contextuel opérateur (PURE) — fiche du correspondant/conversation actif (PLAN §8 : pas une déco).
 * `subject` = { name, user_id?, kind } ou null. P5c/P5e enrichiront (historique, actions IA suggérées).
 */
export function DetailsPanel({ subject = null }) {
  return (
    <aside className="hidden w-72 flex-col bg-base-800 lg:flex" aria-label="Détails">
      <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">Détails</header>
      <div className="flex-1 px-4 py-4 text-sm">
        {!subject ? (
          <p className="text-text-muted">Sélectionne une conversation</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-base-600 text-lg font-semibold text-text-normal">
                {(subject.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-text-normal">{subject.name}</div>
                <div className="text-xs text-text-muted">{subject.kind === "dm" ? "Message privé" : "Salon"}</div>
              </div>
            </div>
            {subject.user_id ? (
              <div className="text-xs text-text-muted">
                ID <span className="font-mono text-text-normal">{subject.user_id}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
