/*
 * Coquille du cockpit (P5a) — layout 3 colonnes (PLAN §8) :
 *   rail bots → liste convs/DM → fil + composer → panneau contextuel opérateur.
 * P5a = STRUCTURE + états vides. Données (annuaire/fil) = P5c ; temps réel = P5d.
 */
export function CockpitPage() {
  return (
    <div className="flex h-full">
      {/* Rail bots (switch multi-bot) */}
      <nav className="flex w-[72px] flex-col items-center gap-2 bg-base-900 py-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blurple font-bold text-white">
          E
        </div>
      </nav>

      {/* Liste conversations / DM */}
      <aside className="flex w-60 flex-col bg-base-800">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          Conversations
        </header>
        <div className="flex-1 px-2 py-2 text-sm text-text-muted">Aucune conversation</div>
      </aside>

      {/* Fil + composer */}
      <main className="flex flex-1 flex-col bg-base-700">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          Sélectionne une conversation
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-text-muted" />
        <footer className="px-4 pb-4">
          <input
            type="text"
            disabled
            placeholder="Envoyer un message"
            className="w-full rounded-lg bg-base-600 px-4 py-2.5 text-sm text-text-normal placeholder:text-text-muted focus:outline-none"
          />
        </footer>
      </main>

      {/* Panneau contextuel opérateur */}
      <aside className="hidden w-72 flex-col bg-base-800 lg:flex">
        <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">
          Détails
        </header>
        <div className="flex-1 px-4 py-4 text-sm text-text-muted">
          Sélectionne un utilisateur
        </div>
      </aside>
    </div>
  );
}
