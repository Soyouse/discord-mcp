/*
 * Tests de la réconciliation (PURE) — couvre l'invariant anti-doublon dans toutes les courses.
 */
import { describe, it, expect } from "vitest";
import { upsert, addOptimistic, confirmOptimistic, rollbackOptimistic, removeById, sortByTime } from "./reconcile.js";

const m = (id, t, extra = {}) => ({ message_id: id, content: id, created_at: t, ...extra });

describe("sortByTime", () => {
  it("trie ascendant par created_at", () => {
    const r = sortByTime([m("b", "2026-06-06T09:02:00Z"), m("a", "2026-06-06T09:01:00Z")]);
    expect(r.map((x) => x.message_id)).toEqual(["a", "b"]);
  });
});

describe("upsert", () => {
  it("ajoute un nouveau message", () => {
    expect(upsert([m("a", "1")], m("b", "2")).map((x) => x.message_id)).toEqual(["a", "b"]);
  });
  it("remplace par message_id (pas de doublon) et garde le contenu mis à jour", () => {
    const r = upsert([m("a", "1")], { ...m("a", "1"), content: "édité" });
    expect(r).toHaveLength(1);
    expect(r[0].content).toBe("édité");
  });
});

describe("optimiste", () => {
  it("addOptimistic ajoute un temp pending avec id dérivé du nonce", () => {
    const r = addOptimistic([], { nonce: "n1", content: "hi", author: "E", authorId: "e", channelId: "c1", createdAt: "1" });
    expect(r[0]).toMatchObject({ message_id: "tmp-n1", pending: true, content: "hi", channel_id: "c1" });
  });

  it("confirmOptimistic retire le temp et insère le réel", () => {
    const list = addOptimistic([], { nonce: "n1", content: "hi", author: "E", authorId: "e", channelId: "c1", createdAt: "1" });
    const r = confirmOptimistic(list, "n1", m("real1", "2"));
    expect(r.map((x) => x.message_id)).toEqual(["real1"]);
  });

  it("⚠️ course : écho socket AVANT la confirmation → pas de doublon", () => {
    // optimiste ajouté
    let list = addOptimistic([], { nonce: "n1", content: "hi", author: "E", authorId: "e", channelId: "c1", createdAt: "1" });
    // l'écho socket arrive d'abord (message réel real1)
    list = upsert(list, m("real1", "2"));
    // PUIS la réponse POST confirme avec le même real1
    list = confirmOptimistic(list, "n1", m("real1", "2"));
    expect(list.filter((x) => x.message_id === "real1")).toHaveLength(1); // une seule fois
    expect(list.some((x) => x.message_id === "tmp-n1")).toBe(false); // temp retiré
  });

  it("rollbackOptimistic retire le temp en échec", () => {
    const list = addOptimistic([], { nonce: "n1", content: "hi", author: "E", authorId: "e", channelId: "c1", createdAt: "1" });
    expect(rollbackOptimistic(list, "n1")).toEqual([]);
  });
});

describe("removeById", () => {
  it("retire le message supprimé", () => {
    expect(removeById([m("a", "1"), m("b", "2")], "a").map((x) => x.message_id)).toEqual(["b"]);
  });
});
