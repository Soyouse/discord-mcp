import { describe, expect, it } from "vitest";
import { messageUrl } from "./message-url.js";

describe("messageUrl", () => {
  it("construit le permalien d'un message de serveur", () => {
    expect(messageUrl({ guildId: "123", channelId: "456", messageId: "789" }))
      .toBe("https://discord.com/channels/123/456/789");
  });

  it("utilise @me pour un DM", () => {
    expect(messageUrl({ channelId: "456", messageId: "789" }))
      .toBe("https://discord.com/channels/@me/456/789");
  });

  it("ignore les IDs temporaires ou incomplets", () => {
    expect(messageUrl({ guildId: "123", channelId: "c1", messageId: "m1" })).toBeNull();
    expect(messageUrl({ guildId: "g1", channelId: "456", messageId: "789" })).toBeNull();
  });
});
