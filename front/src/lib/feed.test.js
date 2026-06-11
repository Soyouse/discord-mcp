import { describe, it, expect } from "vitest";
import { buildFeed, formatDayLabel } from "./feed.js";

const m = (id, author_id, iso, extra = {}) => ({ message_id: id, author_id, created_at: iso, content: id, ...extra });

describe("buildFeed", () => {
  it("liste vide → fil vide", () => {
    expect(buildFeed([])).toEqual([]);
  });

  it("insère un séparateur de date au premier message et à chaque changement de jour", () => {
    const feed = buildFeed([
      m("a", "u1", "2026-06-10T10:00:00Z"),
      m("b", "u1", "2026-06-11T09:00:00Z"),
    ]);
    expect(feed.map((i) => i.kind)).toEqual(["divider", "message", "divider", "message"]);
    expect(feed[0].id).toBe("day-2026-06-10");
    expect(feed[2].id).toBe("day-2026-06-11");
  });

  it("compact : même auteur, même jour, < 7 min d'écart", () => {
    const feed = buildFeed([
      m("a", "u1", "2026-06-11T10:00:00Z"),
      m("b", "u1", "2026-06-11T10:03:00Z"), // compact
      m("c", "u1", "2026-06-11T10:12:00Z"), // > 7 min → en-tête
      m("d", "u2", "2026-06-11T10:13:00Z"), // autre auteur → en-tête
    ]);
    const msgs = feed.filter((i) => i.kind === "message");
    expect(msgs.map((i) => i.compact)).toEqual([false, true, false, false]);
  });

  it("jamais compact à travers un changement de jour (le divider coupe le groupe)", () => {
    const feed = buildFeed([
      m("a", "u1", "2026-06-10T23:59:00Z"),
      m("b", "u1", "2026-06-11T00:01:00Z"), // 2 min d'écart MAIS autre jour
    ]);
    const msgs = feed.filter((i) => i.kind === "message");
    expect(msgs[1].compact).toBe(false);
  });

  it("un optimiste (pending) ne se compacte pas avec un message confirmé (états visuels distincts)", () => {
    const feed = buildFeed([
      m("a", "u1", "2026-06-11T10:00:00Z"),
      m("tmp-x", "u1", "2026-06-11T10:01:00Z", { pending: true }),
    ]);
    const msgs = feed.filter((i) => i.kind === "message");
    expect(msgs[1].compact).toBe(false);
  });
});

describe("formatDayLabel", () => {
  it("ISO → libellé français lisible", () => {
    expect(formatDayLabel("2026-06-11T10:00:00Z")).toMatch(/11 juin 2026/);
  });

  it("date invalide → chaîne vide (jamais de crash d'affichage)", () => {
    expect(formatDayLabel("n/a")).toBe("");
  });
});
