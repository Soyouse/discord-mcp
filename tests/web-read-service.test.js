import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeGuild, normalizeChannel, normalizeMember } from "../relay/normalize-directory.js";
import { normalizeMessage } from "../relay/normalize.js";
import * as read from "../web/read-service.js";

let repo;
beforeEach(async () => {
  repo = createMemoryRepository();
});

const withTenant = (row, t) => ({ ...row, tenant_id: t });

describe("read-service — annuaire", () => {
  it("listGuilds expose les champs PUBLICS uniquement (pas bot_id/tenant_id/updated_at)", async () => {
    await repo.upsertGuild(normalizeGuild({ id: "g1", name: "WebZenon", icon: "ic" }, "echidna"));
    const gs = await read.listGuilds(repo, {});
    expect(gs).toEqual([{ guild_id: "g1", name: "WebZenon", icon: "ic" }]);
    expect(gs[0]).not.toHaveProperty("bot_id");
    expect(gs[0]).not.toHaveProperty("tenant_id");
  });

  it("listGuilds filtre par tenant", async () => {
    await repo.upsertGuild(withTenant(normalizeGuild({ id: "g1" }, "echidna"), "default"));
    await repo.upsertGuild(withTenant(normalizeGuild({ id: "g2" }, "echidna"), "clientX"));
    const gs = await read.listGuilds(repo, { tenantId: "default" });
    expect(gs.map((g) => g.guild_id)).toEqual(["g1"]);
  });

  it("listChannels exige guildId (400)", async () => {
    await expect(read.listChannels(repo, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("listChannels formaté + isolé par serveur", async () => {
    await repo.upsertChannel(normalizeChannel({ id: "c1", type: 0, name: "n", position: 0 }, "echidna", "g1"));
    const cs = await read.listChannels(repo, { guildId: "g1" });
    expect(cs[0]).toEqual({ channel_id: "c1", guild_id: "g1", type: 0, name: "n", position: 0 });
  });

  it("listDMables exclut les bots + champs publics", async () => {
    await repo.upsertMember(normalizeMember({ user: { id: "u1", username: "alice", bot: false } }, "echidna", "g1"));
    await repo.upsertMember(normalizeMember({ user: { id: "u2", username: "bot", bot: true } }, "echidna", "g1"));
    const d = await read.listDMables(repo, {});
    expect(d.map((m) => m.user_id)).toEqual(["u1"]);
    expect(d[0]).not.toHaveProperty("is_bot");
    expect(d[0]).not.toHaveProperty("bot_id");
  });
});

describe("read-service — formatters exposent null sur champs absents", () => {
  it("guild sans name/icon → null", async () => {
    await repo.upsertGuild(normalizeGuild({ id: "g1" }, "echidna"));
    const [g] = await read.listGuilds(repo, {});
    expect(g).toEqual({ guild_id: "g1", name: null, icon: null });
  });

  it("channel sans type/name/position → null", async () => {
    await repo.upsertChannel(normalizeChannel({ id: "c1" }, "echidna", "g1"));
    const [c] = await read.listChannels(repo, { guildId: "g1" });
    expect(c).toEqual({ channel_id: "c1", guild_id: "g1", type: null, name: null, position: null });
  });

  it("DMable sans username/global_name/avatar → null", async () => {
    await repo.upsertMember(normalizeMember({ user: { id: "u1" } }, "echidna", "g1"));
    const [m] = await read.listDMables(repo, {});
    expect(m).toEqual({ user_id: "u1", username: null, global_name: null, avatar: null });
  });
});

describe("read-service — historique / recherche", () => {
  const msg = (o) => normalizeMessage({
    id: o.id, channel_id: o.channel_id ?? "chan1", guild_id: "g1",
    author: { id: "u1", username: "alice" }, content: o.content ?? "hello",
    timestamp: o.ts ?? "2026-01-01T00:00:00.000Z",
  }, "echidna");

  it("history exige channel_id (400)", async () => {
    await expect(read.history(repo, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("history renvoie les messages du salon", async () => {
    await repo.upsertMessage(msg({ id: "1", content: "salut" }));
    const h = await read.history(repo, { channel_id: "chan1" });
    expect(h.map((r) => r.message_id)).toEqual(["1"]);
    expect(h[0]).not.toHaveProperty("tsv");
    expect(h[0]).not.toHaveProperty("raw");
  });

  it("search exige q (400)", async () => {
    await expect(read.search(repo, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(read.search(repo, { query: "  " })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("search trouve par token", async () => {
    await repo.upsertMessage(msg({ id: "1", content: "le devis est signé" }));
    await repo.upsertMessage(msg({ id: "2", content: "rien" }));
    const hits = await read.search(repo, { query: "devis" });
    expect(hits.map((r) => r.message_id)).toEqual(["1"]);
  });
});
