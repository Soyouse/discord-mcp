import { describe, it, expect } from "vitest";
import { guildIconUrl, userAvatarUrl } from "./cdn.js";

describe("cdn", () => {
  it("guildIconUrl → URL CDN png avec size", () => {
    expect(guildIconUrl("g1", "abc", 96)).toBe("https://cdn.discordapp.com/icons/g1/abc.png?size=96");
  });

  it("userAvatarUrl → URL CDN png avec size", () => {
    expect(userAvatarUrl("u1", "def", 80)).toBe("https://cdn.discordapp.com/avatars/u1/def.png?size=80");
  });

  it("hash null/absent → null (l'UI affiche l'initiale, jamais d'img cassée)", () => {
    expect(guildIconUrl("g1", null)).toBeNull();
    expect(guildIconUrl(null, "abc")).toBeNull();
    expect(userAvatarUrl("u1", null)).toBeNull();
    expect(userAvatarUrl(null, "def")).toBeNull();
  });
});
