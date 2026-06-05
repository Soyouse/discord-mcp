import { describe, it, expect } from "vitest";
import { handleDispatch, INTENTS } from "../relay/ingest.js";
import { GatewayIntentBits } from "@discordjs/core";

function spyRepo() {
  const calls = { upsert: [], deleted: [] };
  return {
    calls,
    async upsertMessage(row) { calls.upsert.push(row); },
    async markDeleted(id, at) { calls.deleted.push({ id, at }); },
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
  it("inclut MessageContent (privilégié) et PAS Presence/GuildMembers", () => {
    expect(INTENTS & GatewayIntentBits.MessageContent).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.GuildMessages).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.DirectMessages).toBeTruthy();
    expect(INTENTS & GatewayIntentBits.GuildPresences).toBeFalsy();
    expect(INTENTS & GatewayIntentBits.GuildMembers).toBeFalsy();
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
