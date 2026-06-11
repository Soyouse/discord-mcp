import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageRow } from "./MessageRow.jsx";
import { buildFeed, formatDayLabel } from "../lib/feed.js";

/*
 * Fil de messages VIRTUALISÉ (@tanstack/react-virtual) — Discord-like = listes longues.
 * Items dérivés par buildFeed (PUR, testé) : séparateurs de date + messages compacts (groupés par auteur).
 * ⚠️ La virtualisation dépend de mesures DOM (0 en jsdom) → validée par SCREENSHOT/E2E, pas test jsdom.
 * ⚠️ AUTOSCROLL : en bas à l'ouverture d'un salon ET sur nouveau message SI l'utilisateur était déjà
 *    en bas — JAMAIS pendant qu'il lit l'historique plus haut (arracher le scroll = anti-pattern chat).
 */
const BOTTOM_THRESHOLD_PX = 90;

export function MessageList({ messages = [], avatarsByUserId = {} }) {
  const parentRef = useRef(null);
  const items = useMemo(() => buildFeed(messages), [messages]);
  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i]?.kind === "divider" ? 32 : 56),
    overscan: 12,
  });

  // Salon changé (1er lot de messages) OU nouveau message alors qu'on est en bas → coller en bas.
  const lastId = items.length ? items[items.length - 1].id : null;
  const prevLastId = useRef(null);
  useEffect(() => {
    if (!items.length || lastId === prevLastId.current) return;
    const el = parentRef.current;
    const wasAtBottom =
      prevLastId.current === null ||
      (el && el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX);
    prevLastId.current = lastId;
    if (wasAtBottom) virt.scrollToIndex(items.length - 1, { align: "end" });
  }, [lastId, items.length, virt]);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Aucun message
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto" data-testid="message-scroll">
      <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
        {virt.getVirtualItems().map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={item.id}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
              ref={virt.measureElement}
              data-index={vi.index}
            >
              {item.kind === "divider" ? (
                <div className="flex items-center gap-3 px-4 py-2 text-xs text-text-muted" role="separator">
                  <span className="h-px flex-1 bg-base-500/60" />
                  <span className="shrink-0 font-medium">{formatDayLabel(item.iso)}</span>
                  <span className="h-px flex-1 bg-base-500/60" />
                </div>
              ) : (
                <MessageRow
                  message={item.message}
                  compact={item.compact}
                  avatarUrl={avatarsByUserId[item.message.author_id] ?? null}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
