import { describe, it, expect } from "vitest";
import {
  normalizeGuild,
  normalizeChannel,
  normalizeMember,
  DEFAULT_TENANT,
} from "../relay/normalize-directory.js";

describe("normalizeGuild", () => {
  it("mappe les champs + provenance + tenant par défaut", () => {
    const g = normalizeGuild({ id: "g1", name: "WebZenon", icon: "abc" }, "echidna");
    expect(g).toEqual({
      guild_id: "g1",
      name: "WebZenon",
      icon: "abc",
      bot_id: "echidna",
      tenant_id: DEFAULT_TENANT,
    });
  });

  it("name/icon absents → null", () => {
    const g = normalizeGuild({ id: "g1" }, "echidna");
    expect(g.name).toBeNull();
    expect(g.icon).toBeNull();
  });

  it("throw sans botId", () => {
    expect(() => normalizeGuild({ id: "g1" })).toThrow(/botId/);
  });

  it("throw si id manquant ou non-string", () => {
    expect(() => normalizeGuild({}, "echidna")).toThrow(/id/);
    expect(() => normalizeGuild({ id: 123 }, "echidna")).toThrow(/id/);
  });
});

describe("normalizeChannel", () => {
  it("mappe les champs + injecte guild_id du contexte si absent", () => {
    const c = normalizeChannel({ id: "c1", type: 0, name: "général", position: 2 }, "echidna", "g1");
    expect(c).toEqual({
      channel_id: "c1",
      guild_id: "g1",
      type: 0,
      name: "général",
      position: 2,
      bot_id: "echidna",
      tenant_id: DEFAULT_TENANT,
    });
  });

  it("guild_id du payload PRIME sur le contexte", () => {
    const c = normalizeChannel({ id: "c1", guild_id: "gPayload" }, "echidna", "gCtx");
    expect(c.guild_id).toBe("gPayload");
  });

  it("sans guild_id ni contexte → null (DM)", () => {
    const c = normalizeChannel({ id: "c1" }, "echidna");
    expect(c.guild_id).toBeNull();
  });

  it("type/position non-numériques → null", () => {
    const c = normalizeChannel({ id: "c1", type: "x", position: null }, "echidna", "g1");
    expect(c.type).toBeNull();
    expect(c.position).toBeNull();
  });

  it("throw sans botId / sans id", () => {
    expect(() => normalizeChannel({ id: "c1" }, null, "g1")).toThrow(/botId/);
    expect(() => normalizeChannel({}, "echidna", "g1")).toThrow(/id/);
  });
});

describe("normalizeMember", () => {
  const member = (o = {}) => ({
    user: { id: o.id ?? "u1", username: o.username ?? "alice", global_name: o.global_name ?? "Alice", avatar: o.avatar ?? "av", bot: o.bot },
  });

  it("mappe l'utilisateur + rattache au serveur", () => {
    const m = normalizeMember(member(), "echidna", "g1");
    expect(m).toEqual({
      guild_id: "g1",
      user_id: "u1",
      username: "alice",
      global_name: "Alice",
      avatar: "av",
      is_bot: false,
      bot_id: "echidna",
      tenant_id: DEFAULT_TENANT,
    });
  });

  it("is_bot STRICTEMENT true (bot:true → true, absent/falsy → false)", () => {
    expect(normalizeMember(member({ bot: true }), "echidna", "g1").is_bot).toBe(true);
    expect(normalizeMember(member({ bot: undefined }), "echidna", "g1").is_bot).toBe(false);
    expect(normalizeMember(member({ bot: "yes" }), "echidna", "g1").is_bot).toBe(false);
  });

  it("champs user absents → null", () => {
    const m = normalizeMember({ user: { id: "u1" } }, "echidna", "g1");
    expect(m.username).toBeNull();
    expect(m.global_name).toBeNull();
    expect(m.avatar).toBeNull();
  });

  it("throw sans botId / sans guildId / sans user.id", () => {
    expect(() => normalizeMember(member(), null, "g1")).toThrow(/botId/);
    expect(() => normalizeMember(member(), "echidna", null)).toThrow(/guildId/);
    expect(() => normalizeMember({ user: {} }, "echidna", "g1")).toThrow(/user\.id/);
    expect(() => normalizeMember({}, "echidna", "g1")).toThrow(/user\.id/);
  });
});
