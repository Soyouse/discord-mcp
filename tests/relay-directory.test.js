/**
 * Tests de CONTRAT de l'annuaire (guilds/channels/members) : MÊME suite contre l'impl mémoire
 * (toujours) et le Postgres réel (si RELAY_DATABASE_URL — CI). Garantit que les deux impls
 * se comportent à l'identique (le repository pattern tient pour le client web).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createMemoryRepository } from "../relay/memory-repository.js";
import {
  normalizeGuild,
  normalizeChannel,
  normalizeMember,
} from "../relay/normalize-directory.js";

const guild = (o = {}) => normalizeGuild({ id: o.id ?? "g1", name: o.name ?? "G1", icon: o.icon ?? null }, o.bot ?? "echidna");
const channel = (o = {}) =>
  normalizeChannel({ id: o.id ?? "c1", type: o.type ?? 0, name: o.name ?? "salon", position: o.position ?? 0 }, o.bot ?? "echidna", o.guildId ?? "g1");
const member = (o = {}) =>
  normalizeMember({ user: { id: o.userId ?? "u1", username: o.username ?? "alice", global_name: null, avatar: null, bot: o.bot } }, o.botId ?? "echidna", o.guildId ?? "g1");

// tenant injecté après normalisation (la couture SaaS sera peuplée plus tard ; ici on teste le filtre).
const withTenant = (row, tenant) => ({ ...row, tenant_id: tenant });

function contract(name, makeRepo) {
  describe(name, () => {
    let repo;
    beforeEach(async () => {
      repo = await makeRepo();
    });

    // ── GUILDS ──
    it("upsertGuild puis listGuilds", async () => {
      await repo.upsertGuild(guild({ id: "g1", name: "WebZenon" }));
      const gs = await repo.listGuilds();
      expect(gs).toHaveLength(1);
      expect(gs[0].guild_id).toBe("g1");
      expect(gs[0].name).toBe("WebZenon");
    });

    it("upsertGuild idempotent : même id 2× → 1 ligne, name mis à jour", async () => {
      await repo.upsertGuild(guild({ id: "g1", name: "v1" }));
      await repo.upsertGuild(guild({ id: "g1", name: "v2" }));
      const gs = await repo.listGuilds();
      expect(gs).toHaveLength(1);
      expect(gs[0].name).toBe("v2");
    });

    it("listGuilds trié par guild_id", async () => {
      await repo.upsertGuild(guild({ id: "g3" }));
      await repo.upsertGuild(guild({ id: "g1" }));
      await repo.upsertGuild(guild({ id: "g2" }));
      expect((await repo.listGuilds()).map((g) => g.guild_id)).toEqual(["g1", "g2", "g3"]);
    });

    it("listGuilds filtre par tenant", async () => {
      await repo.upsertGuild(withTenant(guild({ id: "g1" }), "default"));
      await repo.upsertGuild(withTenant(guild({ id: "g2" }), "clientX"));
      const def = await repo.listGuilds({ tenantId: "default" });
      expect(def.map((g) => g.guild_id)).toEqual(["g1"]);
    });

    // ── CHANNELS ──
    it("listChannels : isole par guild + trié par position", async () => {
      await repo.upsertChannel(channel({ id: "c2", guildId: "g1", position: 2 }));
      await repo.upsertChannel(channel({ id: "c1", guildId: "g1", position: 1 }));
      await repo.upsertChannel(channel({ id: "cX", guildId: "g2", position: 0 }));
      const cs = await repo.listChannels({ guildId: "g1" });
      expect(cs.map((c) => c.channel_id)).toEqual(["c1", "c2"]);
    });

    it("upsertChannel idempotent", async () => {
      await repo.upsertChannel(channel({ id: "c1", name: "v1" }));
      await repo.upsertChannel(channel({ id: "c1", name: "v2" }));
      const cs = await repo.listChannels({ guildId: "g1" });
      expect(cs).toHaveLength(1);
      expect(cs[0].name).toBe("v2");
    });

    // ── MEMBERS / DMables ──
    it("listDMables exclut les bots", async () => {
      await repo.upsertMember(member({ userId: "u1", bot: false }));
      await repo.upsertMember(member({ userId: "u2", bot: true }));
      const d = await repo.listDMables();
      expect(d.map((m) => m.user_id)).toEqual(["u1"]);
    });

    it("listDMables déduplique un user présent dans 2 serveurs communs", async () => {
      await repo.upsertMember(member({ userId: "u1", guildId: "g1" }));
      await repo.upsertMember(member({ userId: "u1", guildId: "g2" }));
      await repo.upsertMember(member({ userId: "u2", guildId: "g1" }));
      const d = await repo.listDMables();
      expect(d.map((m) => m.user_id)).toEqual(["u1", "u2"]);
    });

    it("listDMables filtre par tenant", async () => {
      await repo.upsertMember(withTenant(member({ userId: "u1" }), "default"));
      await repo.upsertMember(withTenant(member({ userId: "u2", guildId: "g9" }), "clientX"));
      const d = await repo.listDMables({ tenantId: "default" });
      expect(d.map((m) => m.user_id)).toEqual(["u1"]);
    });
  });
}

// --- Impl mémoire : toujours ---
contract("MemoryRepository (annuaire)", async () => createMemoryRepository());

// --- Impl Postgres : seulement si RELAY_DATABASE_URL ---
const URL = process.env.RELAY_DATABASE_URL;
if (URL) {
  const { createPool, createPgRepository, migrate } = await import("../relay/pg-repository.js");
  const pool = createPool(URL);
  await migrate(pool);
  const pgRepo = createPgRepository(pool);
  afterAll(async () => {
    await pool.end();
  });
  contract("PgRepository (annuaire)", async () => {
    await pool.query("TRUNCATE guilds, channels, members");
    return pgRepo;
  });
} else {
  describe.skip("PgRepository annuaire (RELAY_DATABASE_URL absent)", () => {
    it("skip", () => {});
  });
}
