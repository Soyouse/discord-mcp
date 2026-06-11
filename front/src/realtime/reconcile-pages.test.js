/*
 * Tests de reconcile-pages (PUR, mutation-testé — stryker mutate).
 * Forme InfiniteData : { pages: [[msg]], pageParams } — pages[0] = la plus RÉCENTE.
 */
import { describe, it, expect } from "vitest";
import {
  flattenPages,
  upsertPages,
  addOptimisticPages,
  confirmOptimisticPages,
  rollbackOptimisticPages,
  removeByIdPages,
} from "./reconcile-pages.js";

const m = (id, iso = "2026-06-11T10:00:00Z", content = id) => ({
  message_id: id,
  channel_id: "c1",
  content,
  created_at: iso,
  edited_at: null,
});
const data = (...pages) => ({ pages, pageParams: pages.map(() => null) });

describe("flattenPages", () => {
  it("aplatit, dédupe par message_id et trie ASC", () => {
    const d = data(
      [m("b", "2026-06-11T11:00:00Z"), m("dup", "2026-06-11T10:30:00Z")],
      [m("a", "2026-06-11T09:00:00Z"), m("dup", "2026-06-11T10:30:00Z", "vieille-version")]
    );
    const flat = flattenPages(d);
    expect(flat.map((x) => x.message_id)).toEqual(["a", "dup", "b"]);
    expect(flat).toHaveLength(3); // dédupe : "dup" une seule fois
  });

  it("data absent/null → []", () => {
    expect(flattenPages(undefined)).toEqual([]);
    expect(flattenPages(null)).toEqual([]);
  });
});

describe("upsertPages", () => {
  it("message inconnu → ajouté à pages[0] (la plus récente), pages suivantes intactes", () => {
    const d = data([m("b")], [m("a")]);
    const next = upsertPages(d, m("c"));
    expect(next.pages[0].map((x) => x.message_id)).toEqual(["b", "c"]);
    expect(next.pages[1].map((x) => x.message_id)).toEqual(["a"]);
  });

  it("message connu → remplacé IN PLACE, où qu'il soit (idempotent : pas de doublon)", () => {
    const d = data([m("b")], [m("a")]);
    const next = upsertPages(d, m("a", "2026-06-11T10:00:00Z", "édité"));
    expect(next.pages[1][0].content).toBe("édité");
    expect(flattenPages(next)).toHaveLength(2);
  });

  it("cache absent (salon jamais chargé) → crée la forme vide et insère", () => {
    const next = upsertPages(undefined, m("a"));
    expect(flattenPages(next).map((x) => x.message_id)).toEqual(["a"]);
  });
});

describe("optimiste sur pages", () => {
  const draft = {
    nonce: "n1",
    content: "salut",
    author: "Echidna",
    authorId: "echidna",
    channelId: "c1",
    createdAt: "2026-06-11T12:00:00Z",
  };

  it("addOptimisticPages → pending dans pages[0]", () => {
    const next = addOptimisticPages(data([m("a")], [m("z")]), draft);
    const added = next.pages[0].find((x) => x.message_id === "tmp-n1");
    expect(added.pending).toBe(true);
    expect(next.pages[1]).toHaveLength(1); // page ancienne intacte
  });

  it("confirmOptimisticPages → temp retiré PARTOUT puis message réel upserté (jamais les deux)", () => {
    const seeded = addOptimisticPages(data([m("a")]), draft);
    const next = confirmOptimisticPages(seeded, "n1", m("real", "2026-06-11T12:00:01Z"));
    const flat = flattenPages(next);
    expect(flat.map((x) => x.message_id)).toEqual(["a", "real"]);
    expect(flat.some((x) => x.pending)).toBe(false);
  });

  it("rollbackOptimisticPages → temp retiré, le reste intact", () => {
    const seeded = addOptimisticPages(data([m("a")]), draft);
    const next = rollbackOptimisticPages(seeded, "n1");
    expect(flattenPages(next).map((x) => x.message_id)).toEqual(["a"]);
  });
});

describe("removeByIdPages", () => {
  it("retire le message de N'IMPORTE quelle page", () => {
    const d = data([m("b")], [m("a")]);
    const next = removeByIdPages(d, "a");
    expect(flattenPages(next).map((x) => x.message_id)).toEqual(["b"]);
  });
});
