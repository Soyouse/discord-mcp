/*
 * Liste des conversations (PURE). `items` = [{ id, name, kind, avatarUrl? }] (kind: "channel" | "dm").
 * Groupes Discord-like : SALONS puis MESSAGES PRIVÉS (titres rendus seulement si le groupe est non vide).
 * DM avec avatarUrl → avatar image ; sinon préfixe @/#. `activeId` surligne ; clic → onSelect(item).
 */
import { Avatar } from "./Avatar.jsx";

const PREFIX = { channel: "#", dm: "@" };

function Row({ it, active, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(it)}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm ${
          active ? "bg-base-500 text-text-normal" : "text-text-muted hover:bg-base-600/50 hover:text-text-normal"
        }`}
      >
        {it.kind === "dm" ? (
          <Avatar src={it.avatarUrl ?? null} name={it.name} className="h-6 w-6 rounded-full text-[10px]" />
        ) : (
          <span className="text-text-muted">{PREFIX[it.kind] ?? "#"}</span>
        )}
        <span className="truncate">{it.name}</span>
      </button>
    </li>
  );
}

function Group({ title, items, activeId, onSelect }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted first:pt-0">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <Row key={it.id} it={it} active={it.id === activeId} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

// `onSearch` : bouton « Rechercher » (ouvre la palette ⌘K). `footer` : panneau utilisateur (bas, Discord-like).
export function ConversationList({ items = [], activeId = null, onSelect, title = "Conversations", onSearch, footer = null }) {
  const channels = items.filter((it) => it.kind !== "dm");
  const dms = items.filter((it) => it.kind === "dm");
  return (
    <aside className="flex w-60 flex-col bg-base-800">
      <header className="px-4 py-3 text-sm font-semibold text-text-normal shadow">{title}</header>
      {onSearch ? (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={onSearch}
            className="w-full rounded bg-base-900 px-2 py-1.5 text-left text-xs text-text-muted hover:text-text-normal"
          >
            Rechercher ou aller à… <kbd className="float-right">Ctrl K</kbd>
          </button>
        </div>
      ) : null}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <p className="px-2 text-sm text-text-muted">Aucune conversation</p>
        ) : (
          <>
            <Group title="Salons" items={channels} activeId={activeId} onSelect={onSelect} />
            <Group title="Messages privés" items={dms} activeId={activeId} onSelect={onSelect} />
          </>
        )}
      </nav>
      {footer}
    </aside>
  );
}
