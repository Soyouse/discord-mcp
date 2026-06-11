import { describe, it, expect } from "vitest";
import { decodeBadges } from "./badges.js";

describe("decodeBadges", () => {
  it("64 (Théo, live) → HypeSquad Bravery seul, avec son icône CDN", () => {
    expect(decodeBadges(64)).toEqual([
      { key: "bravery", label: "HypeSquad Bravery", icon: "8a88d63823d8a71cd5e390baa45efa02" },
    ]);
  });

  it("combinaison de bits → tous les badges, dans l'ordre des flags", () => {
    // staff (1) + early_supporter (512) + active_developer (1<<22)
    const keys = decodeBadges(1 + 512 + (1 << 22)).map((b) => b.key);
    expect(keys).toEqual(["staff", "early_supporter", "active_developer"]);
  });

  it("chaque badge a une icône CDN, SAUF verified_bot (icon null → fallback chip texte)", () => {
    const all = decodeBadges(
      (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) |
      (1 << 14) | (1 << 16) | (1 << 17) | (1 << 18) | (1 << 22)
    );
    expect(all).toHaveLength(13);
    const noIcon = all.filter((b) => !b.icon).map((b) => b.key);
    expect(noIcon).toEqual(["verified_bot"]);
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
