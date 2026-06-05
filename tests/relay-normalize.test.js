import { describe, it, expect } from "vitest";
import { normalizeMessage, snowflakeToDate } from "../relay/normalize.js";

const base = () => ({
  id: "1512266174434508904",
  channel_id: "chan1",
  guild_id: "guild1",
  author: { id: "user1", username: "alice" },
  content: "bonjour le monde",
  timestamp: "2026-01-01T12:00:00.000Z",
  edited_timestamp: null,
});

describe("normalizeMessage", () => {
  it("mappe les champs canoniques", () => {
    const r = normalizeMessage(base(), "echidna");
    expect(r.message_id).toBe("1512266174434508904");
    expect(r.channel_id).toBe("chan1");
    expect(r.guild_id).toBe("guild1");
    expect(r.author_id).toBe("user1");
    expect(r.author_username).toBe("alice");
    expect(r.bot_id).toBe("echidna");
    expect(r.content).toBe("bonjour le monde");
    expect(r.created_at.toISOString()).toBe("2026-01-01T12:00:00.000Z");
    expect(r.edited_at).toBeNull();
    expect(r.raw).toBeTypeOf("object");
  });

  it("guild_id NULL en DM", () => {
    const m = base();
    delete m.guild_id;
    expect(normalizeMessage(m, "echidna").guild_id).toBeNull();
  });

  it("content/username absents → null (pas undefined)", () => {
    const m = base();
    delete m.content;
    delete m.author.username;
    const r = normalizeMessage(m, "echidna");
    expect(r.content).toBeNull();
    expect(r.author_username).toBeNull();
  });

  it("edited_timestamp mappé sur edited_at", () => {
    const m = base();
    m.edited_timestamp = "2026-01-02T00:00:00.000Z";
    expect(normalizeMessage(m, "echidna").edited_at.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
  });

  it("timestamp manquant → fallback snowflake (ordre chrono préservé)", () => {
    const m = base();
    delete m.timestamp;
    const r = normalizeMessage(m, "echidna");
    expect(r.created_at).toEqual(snowflakeToDate("1512266174434508904"));
  });

  it("rejette id non-string", () => {
    expect(() => normalizeMessage({ ...base(), id: 123 }, "echidna")).toThrow(/snowflake/);
  });
  it("rejette botId manquant", () => {
    expect(() => normalizeMessage(base(), "")).toThrow(/botId/);
  });
  it("rejette channel_id manquant", () => {
    const m = base();
    delete m.channel_id;
    expect(() => normalizeMessage(m, "echidna")).toThrow(/channel_id/);
  });
  it("rejette author.id manquant", () => {
    const m = base();
    m.author = {};
    expect(() => normalizeMessage(m, "echidna")).toThrow(/author\.id/);
  });
});

describe("snowflakeToDate", () => {
  it("décode l'horodatage du snowflake (epoch Discord)", () => {
    // snowflake 0 → epoch Discord 2015-01-01
    expect(snowflakeToDate("0").toISOString()).toBe("2015-01-01T00:00:00.000Z");
  });
  it("plus grand snowflake = plus récent (ordre chrono)", () => {
    expect(snowflakeToDate("1512266174434508904") > snowflakeToDate("1")).toBe(true);
  });
});
