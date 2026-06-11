import { describe, it, expect } from "vitest";
import { decodeBadges } from "./badges.js";

describe("decodeBadges", () => {
  it("64 (Théo, live) → HypeSquad Bravery seul", () => {
    expect(decodeBadges(64)).toEqual([{ key: "bravery", label: "HypeSquad Bravery" }]);
  });

  it("combinaison de bits → tous les badges, dans l'ordre des flags", () => {
    // staff (1) + early_supporter (512) + active_developer (1<<22)
    const keys = decodeBadges(1 + 512 + (1 << 22)).map((b) => b.key);
    expect(keys).toEqual(["staff", "early_supporter", "active_developer"]);
  });

  it("0 / null / undefined / non-number → [] (jamais de crash UI)", () => {
    expect(decodeBadges(0)).toEqual([]);
    expect(decodeBadges(null)).toEqual([]);
    expect(decodeBadges(undefined)).toEqual([]);
    expect(decodeBadges("64")).toEqual([]);
  });

  it("bit inconnu (forward-compat) → ignoré sans erreur", () => {
    expect(decodeBadges(1 << 30)).toEqual([]);
  });
});
