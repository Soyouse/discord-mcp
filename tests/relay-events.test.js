import { describe, it, expect } from "vitest";
import { toEvent, capEventSize, EVENT_CHANNEL, MAX_NOTIFY_BYTES } from "../relay/events.js";
import { normalizeMessage } from "../relay/normalize.js";
import { formatRow } from "../relay/query.js";

const data = (o = {}) => ({ id: o.id ?? "100", channel_id: o.channel_id ?? "chan1", ...o });

describe("toEvent", () => {
  it("MESSAGE_CREATE → message.created AVEC le message complet (shape historique)", () => {
    // ⚠️ L'event DOIT porter `message` : un event squelette upserté côté front écrase le
    //    message affiché (perte content/author).
    const ev = toEvent("MESSAGE_CREATE", data({
      id: "1",
      guild_id: "g1",
      author: { id: "a1", username: "alice" },
      content: "salut",
      timestamp: "2026-06-11T10:00:00Z",
    }));
    expect(ev).toMatchObject({ type: "message.created", channel_id: "chan1", message_id: "1" });
    expect(ev.message).toEqual({
      message_id: "1",
      channel_id: "chan1",
      guild_id: "g1",
      author_id: "a1",
      author: "alice",
      content: "salut",
      created_at: "2026-06-11T10:00:00.000Z",
      edited_at: null,
    });
  });

  it("PARITÉ DE CONTRAT : event.message = formatRow(normalizeMessage(...)) — même cache front", () => {
    // ⚠️ L'historique GET (formatRow) et l'event socket alimentent le MÊME cache react-query
    //    (upsert par message_id). Un drift de shape (ex: author_username vs author) = messages
    //    dégradés à l'écran. Ce test croise les DEUX chemins sur le MÊME payload gateway.
    // Timestamp au format RÉEL gateway Discord (microsecondes + offset, PAS ISO-Z).
    const raw = {
      id: "1514702201581211831",
      channel_id: "chan1",
      guild_id: "g1",
      author: { id: "a1", username: "alice" },
      content: "parité",
      timestamp: "2026-06-11T10:00:00.272000+00:00",
      edited_timestamp: "2026-06-11T10:05:00.100000+00:00",
    };
    const viaEvent = toEvent("MESSAGE_CREATE", raw).message;
    const viaHistory = formatRow(normalizeMessage(raw, "echidna"));
    expect(viaEvent).toEqual(viaHistory);
  });

  it("timestamp absent → created_at dérivé du snowflake (jamais null : le tri du fil en dépend)", () => {
    // Snowflake réel (≈2026) — toEvent ne doit pas produire created_at:null (NaN au tri front).
    const ev = toEvent("MESSAGE_CREATE", data({ id: "1514702201581211831", author: { id: "a1" } }));
    expect(typeof ev.message.created_at).toBe("string");
    expect(new Date(ev.message.created_at).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("MESSAGE_UPDATE → message.updated avec message", () => {
    const ev = toEvent("MESSAGE_UPDATE", data({ id: "2", content: "édité" }));
    expect(ev.type).toBe("message.updated");
    expect(ev.message.content).toBe("édité");
  });

  it("MESSAGE_DELETE → message.deleted MINIMAL (l'id suffit à retirer)", () => {
    const ev = toEvent("MESSAGE_DELETE", data({ id: "3" }));
    expect(ev).toEqual({ type: "message.deleted", channel_id: "chan1", message_id: "3" });
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

describe("capEventSize", () => {
  it("event sous la limite → inchangé (référence identique)", () => {
    const ev = { type: "message.created", channel_id: "c1", message_id: "1", message: { content: "ok" } };
    expect(capEventSize(ev)).toBe(ev);
  });

  it("event trop gros → dégradé en minimal SANS message (pg_notify plafonne, sinon l'event est PERDU)", () => {
    const ev = {
      type: "message.created",
      channel_id: "c1",
      message_id: "1",
      message: { content: "x".repeat(MAX_NOTIFY_BYTES) },
    };
    expect(capEventSize(ev)).toEqual({ type: "message.created", channel_id: "c1", message_id: "1" });
  });

  it("null/undefined → passthrough (publish gère déjà l'absence)", () => {
    expect(capEventSize(null)).toBeNull();
  });
});
