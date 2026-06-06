import { describe, it, expect } from "vitest";
import { toEvent, EVENT_CHANNEL } from "../relay/events.js";

const data = (o = {}) => ({ id: o.id ?? "100", channel_id: o.channel_id ?? "chan1" });

describe("toEvent", () => {
  it("MESSAGE_CREATE → message.created (channel_id + message_id)", () => {
    expect(toEvent("MESSAGE_CREATE", data({ id: "1" }))).toEqual({
      type: "message.created",
      channel_id: "chan1",
      message_id: "1",
    });
  });

  it("MESSAGE_UPDATE → message.updated", () => {
    expect(toEvent("MESSAGE_UPDATE", data({ id: "2" })).type).toBe("message.updated");
  });

  it("MESSAGE_DELETE → message.deleted", () => {
    expect(toEvent("MESSAGE_DELETE", data({ id: "3" })).type).toBe("message.deleted");
  });

  it("sans id ou sans channel_id → null (pas de routage possible)", () => {
    expect(toEvent("MESSAGE_CREATE", { channel_id: "c" })).toBeNull();
    expect(toEvent("MESSAGE_CREATE", { id: "1" })).toBeNull();
    expect(toEvent("MESSAGE_CREATE", null)).toBeNull();
  });

  it("type non-message (annuaire, etc.) → null", () => {
    expect(toEvent("GUILD_CREATE", data())).toBeNull();
    expect(toEvent("MESSAGE_REACTION_ADD", data())).toBeNull();
  });

  it("EVENT_CHANNEL = identifiant de canal NOTIFY (string non vide)", () => {
    expect(typeof EVENT_CHANNEL).toBe("string");
    expect(EVENT_CHANNEL.length).toBeGreaterThan(0);
  });
});
