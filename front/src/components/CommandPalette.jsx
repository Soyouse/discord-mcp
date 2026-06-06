/*
 * Command palette ⌘K (cmdk) — standard 2026 (PLAN §8). Saut rapide vers une conversation au clavier.
 * ⚠️ CONTRÔLÉE (open/onOpenChange) → testable sans simuler le raccourci. Le raccourci ⌘K/Ctrl+K
 *    vit dans useCommandPalette (séparé). Filtrage = natif cmdk (fuzzy sur le `value`).
 */
import { Command } from "cmdk";
import { Hash, AtSign } from "lucide-react";

export function CommandPalette({ open, onOpenChange, conversations = [], onSelectConversation }) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Palette de commandes"
      className="fixed left-1/2 top-32 z-50 w-[480px] -translate-x-1/2 overflow-hidden rounded-xl border border-base-500 bg-base-800 shadow-2xl"
    >
      <Command.Input
        placeholder="Aller à une conversation…"
        className="w-full bg-transparent px-4 py-3 text-sm text-text-normal outline-none placeholder:text-text-muted"
      />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="px-2 py-4 text-center text-sm text-text-muted">Aucun résultat.</Command.Empty>
        <Command.Group heading="Conversations" className="text-xs text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
          {conversations.map((c) => (
            <Command.Item
              key={c.id}
              value={`${c.name} ${c.kind}`}
              onSelect={() => {
                onSelectConversation?.(c);
                onOpenChange?.(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text-normal data-[selected=true]:bg-blurple"
            >
              {c.kind === "dm" ? <AtSign size={14} /> : <Hash size={14} />}
              <span className="truncate">{c.name}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
