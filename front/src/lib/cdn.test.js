import { describe, it, expect } from "vitest";
import { guildIconUrl, userAvatarUrl, userBannerUrl, clanBadgeUrl } from "./cdn.js";

describe("cdn", () => {
  it("guildIconUrl → URL CDN png avec size", () => {
    expect(guildIconUrl("g1", "abc", 96)).toBe("https://cdn.discordapp.com/icons/g1/abc.png?size=96");
  });

  it("userAvatarUrl → URL CDN png avec size", () => {
    expect(userAvatarUrl("u1", "def", 80)).toBe("https://cdn.discordapp.com/avatars/u1/def.png?size=80");
  });

  it("userBannerUrl / clanBadgeUrl → URLs CDN dédiées (banners / clan-badges)", () => {
    expect(userBannerUrl("u1", "bh", 480)).toBe("https://cdn.discordapp.com/banners/u1/bh.png?size=480");
    expect(clanBadgeUrl("g9", "tb", 32)).toBe("https://cdn.discordapp.com/clan-badges/g9/tb.png?size=32");
    expect(userBannerUrl("u1", null)).toBeNull();
    expect(clanBadgeUrl(null, "tb")).toBeNull();
  });

  it("hash null/absent → null (l'UI affiche l'initiale, jamais d'img cassée)", () => {
    expect(guildIconUrl("g1", null)).toBeNull();
    expect(guildIconUrl(null, "abc")).toBeNull();
    expect(userAvatarUrl("u1", null)).toBeNull();
    expect(userAvatarUrl(null, "def")).toBeNull();
  });
});
