/*
 * Liste des conversations (PURE). `items` = [{ id, name, kind }] (kind: "channel" | "dm").
 * `activeId` surligne l'entrée courante ; clic → onSelect(item). États vides gérés.
 */
const PREFIX = { channel: "#", dm: "@" };

export function ConversationList({ items = [], activeId = null, onSelect, title = "Conversations" }) {
  return (
    <aside className="flex w-60 flex-col bg-base-800">
      <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">{title}</header>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <p className="px-2 text-sm text-text-muted">Aucune conversation</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((it) => {
              const active = it.id === activeId;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(it)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm ${
                      active
                        ? "bg-base-500 text-text-normal"
                        : "text-text-muted hover:bg-base-600/50 hover:text-text-normal"
                    }`}
                  >
                    <span className="text-text-muted">{PREFIX[it.kind] ?? "#"}</span>
                    <span className="truncate">{it.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
