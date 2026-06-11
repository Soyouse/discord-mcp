import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageRow } from "./MessageRow.jsx";

/*
 * Fil de messages VIRTUALISÉ (@tanstack/react-virtual) — Discord-like = listes longues.
 * ⚠️ La virtualisation dépend de mesures DOM (0 en jsdom) → validée par SCREENSHOT, pas test jsdom.
 *    Le test jsdom ne couvre que l'état vide ; MessageRow (pur) est testé séparément.
 * Les messages sont supposés déjà triés chronologiquement (plus ancien en haut).
 */
export function MessageList({ messages = [], avatarsByUserId = {} }) {
  const parentRef = useRef(null);
  const virt = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Aucun message
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto" data-testid="message-scroll">
      <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
        {virt.getVirtualItems().map((vi) => (
          <div
            key={messages[vi.index].message_id}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
            ref={virt.measureElement}
            data-index={vi.index}
          >
            <MessageRow
              message={messages[vi.index]}
              avatarUrl={avatarsByUserId[messages[vi.index].author_id] ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
