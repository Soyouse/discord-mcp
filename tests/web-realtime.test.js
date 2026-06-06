import { describe, it, expect } from "vitest";
import { parseNotification, eventToEmit, EVENT_CHANNEL } from "../web/realtime.js";
import { EVENT_CHANNEL as RELAY_CHANNEL } from "../relay/events.js";

describe("parseNotification", () => {
  it("JSON valide + champs requis → event", () => {
    const ev = parseNotification('{"type":"message.created","channel_id":"c1","message_id":"1"}');
    expect(ev).toEqual({ type: "message.created", channel_id: "c1", message_id: "1" });
  });

  it("JSON invalide → null", () => {
    expect(parseNotification("pas du json")).toBeNull();
  });

  it("champs requis manquants → null", () => {
    expect(parseNotification('{"type":"x"}')).toBeNull();
    expect(parseNotification('{"channel_id":"c1"}')).toBeNull();
    expect(parseNotification("null")).toBeNull();
  });
});

describe("eventToEmit", () => {
  it("event → {room: channel:<id>, name: type, data}", () => {
    const ev = { type: "message.created", channel_id: "c1", message_id: "1" };
    expect(eventToEmit(ev)).toEqual({ room: "channel:c1", name: "message.created", data: ev });
  });

  it("event nul / sans channel_id → null", () => {
    expect(eventToEmit(null)).toBeNull();
    expect(eventToEmit({ type: "x" })).toBeNull();
  });
});

describe("contrat de bridge", () => {
  it("le canal NOTIFY est le MÊME des 2 côtés (relais ⊥ API)", () => {
    expect(EVENT_CHANNEL).toBe(RELAY_CHANNEL);
  });
});
