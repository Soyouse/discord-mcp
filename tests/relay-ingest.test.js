import { describe, it, expect } from "vitest";
import { handleDispatch, INTENTS } from "../relay/ingest.js";
import { GatewayIntentBits } from "@discordjs/core";

function spyRepo() {
  const calls = { upsert: [], deleted: [], guilds: [], channels: [], members: [], rmChannel: [], rmMember: [] };
  return {
    calls,
    async upsertMessage(row) { calls.upsert.push(row); },
    async markDeleted(id, at) { calls.deleted.push({ id, at }); },
    async upsertGuild(row) { calls.guilds.push(row); },
    async upsertChannel(row) { calls.channels.push(row); },
    async upsertMember(row) { calls.members.push(row); },
    async removeChannel(id) { calls.rmChannel.push(id); },
    async removeMember(g, u) { calls.rmMember.push({ g, u }); },
  };
}

const msg = (o = {}) => ({
  id: o.id ?? "100",
  channel_id: o.channel_id ?? "chan1",
  guild_id: "guild1",
  author: o.author === null ? undefined : { id: "user1", username: "alice" },
  content: o.content ?? "coucou",
  timestamp: "2026-01-01T00:00:00.000Z",
});

describe("INTENTS", () => {
  it("inclut MessageContent + GuildMembers (privilégiés) et PAS Presence", () => {
    expect(INTENTS & GatewayIntentBits.MessageContent).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.GuildMessages).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.DirectMessages).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.Guilds).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.GuildMembers).toBeTruthy(); // annuaire « qui je peux DM »
    expect(INTENTS & GatewayIntentBits.GuildPresences).toBeFalsy(); // moindre privilège conservé
  });
});

describe("handleDispatch", () => {
  it("MESSAGE_CREATE → upsert normalisé", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("MESSAGE_CREATE", msg({ id: "1" }), { repo, botId: "echidna" });
    expect(res).toBe("upsert");
    expect(repo.calls.upsert).toHaveLength(1);
    expect(repo.calls.upsert[0]).toMatchObject({ message_id: "1", bot_id: "echidna", content: "coucou" });
  });

  it("MESSAGE_UPDATE complet → upsert", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("MESSAGE_UPDATE", msg({ id: "1", content: "édité" }), { repo, botId: "echidna" });
    expect(res).toBe("upsert");
    expect(repo.calls.upsert[0].content).toBe("édité");
  });

  it("MESSAGE_UPDATE partiel (sans author) → skip, aucun upsert", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("MESSAGE_UPDATE", { id: "1", channel_id: "chan1" }, { repo, botId: "echidna" });
    expect(res).toBe("skip");
    expect(repo.calls.upsert).toHaveLength(0);
  });

  it("MESSAGE_CREATE sans channel_id → skip", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("MESSAGE_CREATE", { id: "1", author: { id: "u" } }, { repo, botId: "echidna" });
    expect(res).toBe("skip");
    expect(repo.calls.upsert).toHaveLength(0);
  });

  it("MESSAGE_DELETE → markDeleted avec horloge injectée", async () => {
    const repo = spyRepo();
    const at = new Date("2026-03-03T03:03:03.000Z");
    const res = await handleDispatch("MESSAGE_DELETE", { id: "9" }, { repo, botId: "echidna", now: () => at });
    expect(res).toBe("delete");
    expect(repo.calls.deleted).toEqual([{ id: "9", at }]);
  });

  it("MESSAGE_DELETE sans id → skip", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("MESSAGE_DELETE", {}, { repo, botId: "echidna" });
    expect(res).toBe("skip");
    expect(repo.calls.deleted).toHaveLength(0);
  });

  it("type inconnu → ignore", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("TYPING_START", { id: "1" }, { repo, botId: "echidna" });
    expect(res).toBe("ignore");
    expect(repo.calls.upsert).toHaveLength(0);
    expect(repo.calls.deleted).toHaveLength(0);
  });
});

describe("handleDispatch — annuaire (P1)", () => {
  it("GUILD_CREATE hydrate serveur + salons (guild_id injecté) + membres", async () => {
    const repo = spyRepo();
    const data = {
      id: "g1",
      name: "WebZenon",
      channels: [{ id: "c1", type: 0, name: "général", position: 0 }],
      members: [{ user: { id: "u1", username: "alice" } }],
    };
    const res = await handleDispatch("GUILD_CREATE", data, { repo, botId: "echidna" });
    expect(res).toBe("guild");
    expect(repo.calls.guilds[0]).toMatchObject({ guild_id: "g1", name: "WebZenon", bot_id: "echidna" });
    expect(repo.calls.channels[0]).toMatchObject({ channel_id: "c1", guild_id: "g1" }); // injecté
    expect(repo.calls.members[0]).toMatchObject({ guild_id: "g1", user_id: "u1", is_bot: false });
  });

  it("GUILD_CREATE sans channels/members → upsert serveur seul, aucun crash", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("GUILD_CREATE", { id: "g1", name: "X" }, { repo, botId: "echidna" });
    expect(res).toBe("guild");
    expect(repo.calls.guilds).toHaveLength(1);
    expect(repo.calls.channels).toHaveLength(0);
    expect(repo.calls.members).toHaveLength(0);
  });

  it("GUILD_CREATE saute une entrée membre sans user, garde les valides", async () => {
    const repo = spyRepo();
    const data = { id: "g1", members: [{ roles: [] }, { user: { id: "u2" } }] };
    await handleDispatch("GUILD_CREATE", data, { repo, botId: "echidna" });
    expect(repo.calls.members.map((m) => m.user_id)).toEqual(["u2"]);
  });

  it("GUILD_CREATE sans id → skip", async () => {
    const repo = spyRepo();
    expect(await handleDispatch("GUILD_CREATE", {}, { repo, botId: "echidna" })).toBe("skip");
    expect(repo.calls.guilds).toHaveLength(0);
  });

  it("GUILD_UPDATE → upsert serveur", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("GUILD_UPDATE", { id: "g1", name: "v2" }, { repo, botId: "echidna" });
    expect(res).toBe("guild-update");
    expect(repo.calls.guilds[0]).toMatchObject({ guild_id: "g1", name: "v2" });
  });

  it("CHANNEL_CREATE / CHANNEL_UPDATE → upsert salon", async () => {
    const repo = spyRepo();
    expect(await handleDispatch("CHANNEL_CREATE", { id: "c1", guild_id: "g1", name: "n" }, { repo, botId: "echidna" })).toBe("channel");
    expect(await handleDispatch("CHANNEL_UPDATE", { id: "c1", guild_id: "g1", name: "n2" }, { repo, botId: "echidna" })).toBe("channel");
    expect(repo.calls.channels.map((c) => c.name)).toEqual(["n", "n2"]);
  });

  it("CHANNEL_DELETE → removeChannel", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("CHANNEL_DELETE", { id: "c1" }, { repo, botId: "echidna" });
    expect(res).toBe("channel-remove");
    expect(repo.calls.rmChannel).toEqual(["c1"]);
  });

  it("GUILD_MEMBER_ADD / UPDATE → upsert membre", async () => {
    const repo = spyRepo();
    const m = { guild_id: "g1", user: { id: "u1", username: "alice", bot: false } };
    expect(await handleDispatch("GUILD_MEMBER_ADD", m, { repo, botId: "echidna" })).toBe("member");
    expect(await handleDispatch("GUILD_MEMBER_UPDATE", m, { repo, botId: "echidna" })).toBe("member");
    expect(repo.calls.members).toHaveLength(2);
    expect(repo.calls.members[0]).toMatchObject({ guild_id: "g1", user_id: "u1" });
  });

  it("GUILD_MEMBER_REMOVE → removeMember", async () => {
    const repo = spyRepo();
    const res = await handleDispatch("GUILD_MEMBER_REMOVE", { guild_id: "g1", user: { id: "u1" } }, { repo, botId: "echidna" });
    expect(res).toBe("member-remove");
    expect(repo.calls.rmMember).toEqual([{ g: "g1", u: "u1" }]);
  });

  it("events membre/salon incomplets → skip (aucune écriture)", async () => {
    const repo = spyRepo();
    expect(await handleDispatch("GUILD_MEMBER_ADD", { guild_id: "g1" }, { repo, botId: "echidna" })).toBe("skip");
    expect(await handleDispatch("GUILD_MEMBER_REMOVE", { user: { id: "u1" } }, { repo, botId: "echidna" })).toBe("skip");
    expect(await handleDispatch("CHANNEL_CREATE", {}, { repo, botId: "echidna" })).toBe("skip");
    expect(await handleDispatch("CHANNEL_DELETE", {}, { repo, botId: "echidna" })).toBe("skip");
    expect(await handleDispatch("GUILD_UPDATE", {}, { repo, botId: "echidna" })).toBe("skip");
    expect(repo.calls.members).toHaveLength(0);
    expect(repo.calls.rmMember).toHaveLength(0);
    expect(repo.calls.channels).toHaveLength(0);
    expect(repo.calls.rmChannel).toHaveLength(0);
    expect(repo.calls.guilds).toHaveLength(0);
  });
});
