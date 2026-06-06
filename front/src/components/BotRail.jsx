/*
 * Rail des bots (PURE) — switch multi-bot en un geste (PLAN §8). `bots` = [{ id, name }].
 * Pastille active = blurple ; clic → onSelect(id). Initiale du nom comme avatar (pas d'images P5b).
 */
export function BotRail({ bots = [], activeId = null, onSelect }) {
  return (
    <nav className="flex w-[72px] flex-col items-center gap-2 bg-base-900 py-3" aria-label="Bots">
      {bots.map((b) => {
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect?.(b.id)}
            title={b.name}
            aria-current={active ? "true" : undefined}
            className={`grid h-12 w-12 place-items-center font-bold text-white transition-all ${
              active ? "rounded-2xl bg-blurple" : "rounded-full bg-base-700 hover:rounded-2xl hover:bg-blurple"
            }`}
          >
            {(b.name || "?").slice(0, 1).toUpperCase()}
          </button>
        );
      })}
    </nav>
  );
}
