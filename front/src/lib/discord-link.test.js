import { describe, it, expect } from "vitest";
import { discordMessageUrl } from "./discord-link.js";

describe("discordMessageUrl", () => {
  it("salon (guild_id présent) → URL /channels/{guild}/{channel}/{message}", () => {
    expect(discordMessageUrl("g1", "c1", "m1")).toBe("https://discord.com/channels/g1/c1/m1");
  });

  it("DM (guild_id null) → URL /channels/@me/{channel}/{message}", () => {
    expect(discordMessageUrl(null, "c1", "m1")).toBe("https://discord.com/channels/@me/c1/m1");
  });

  it("guild_id absent (undefined) → même repli @me", () => {
    expect(discordMessageUrl(undefined, "c1", "m1")).toBe("https://discord.com/channels/@me/c1/m1");
  });

  it("channel_id ou message_id manquant → null (jamais de lien cassé)", () => {
    expect(discordMessageUrl("g1", null, "m1")).toBeNull();
    expect(discordMessageUrl("g1", "c1", null)).toBeNull();
    expect(discordMessageUrl("g1", "c1", undefined)).toBeNull();
  });
});
