/**
 * Tests de CONTRAT du repository : la MÊME suite tourne contre l'impl mémoire (toujours)
 * et contre le Postgres réel (si RELAY_DATABASE_URL est défini — CI avec service postgres).
 * → garantit que les deux implémentations se comportent à l'identique (le pattern repository tient).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeMessage } from "../relay/normalize.js";

const raw = (o = {}) => ({
  id: o.id ?? "100",
  channel_id: o.channel_id ?? "chan1",
  guild_id: o.guild_id ?? "guild1",
  author: { id: o.author_id ?? "user1", username: o.username ?? "alice" },
  content: o.content ?? "hello world",
  timestamp: o.timestamp ?? "2026-01-01T00:00:00.000Z",
  edited_timestamp: o.edited_timestamp ?? null,
});
const row = (o = {}) => normalizeMessage(raw(o), o.bot ?? "echidna");

function contract(name, makeRepo) {
  describe(name, () => {
    let repo;
    beforeEach(async () => {
      repo = await makeRepo();
    });

    it("upsert puis getHistory retourne le message", async () => {
      await repo.upsertMessage(row({ id: "1", content: "salut" }));
      const h = await repo.getHistory({ channelId: "chan1" });
      expect(h).toHaveLength(1);
      expect(h[0].message_id).toBe("1");
      expect(h[0].content).toBe("salut");
    });

    it("upsert idempotent : même id 2× → 1 ligne, contenu mis à jour", async () => {
      await repo.upsertMessage(row({ id: "1", content: "v1" }));
      await repo.upsertMessage(row({ id: "1", content: "v2" }));
      const h = await repo.getHistory({ channelId: "chan1" });
      expect(h).toHaveLength(1);
      expect(h[0].content).toBe("v2");
    });

    it("getHistory : plus récent d'abord + limit", async () => {
      await repo.upsertMessage(row({ id: "1", timestamp: "2026-01-01T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "2", timestamp: "2026-01-02T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "3", timestamp: "2026-01-03T00:00:00.000Z" }));
      const h = await repo.getHistory({ channelId: "chan1", limit: 2 });
      expect(h.map((r) => r.message_id)).toEqual(["3", "2"]);
    });

    it("getHistory : curseur before/after", async () => {
      await repo.upsertMessage(row({ id: "1", timestamp: "2026-01-01T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "2", timestamp: "2026-01-02T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "3", timestamp: "2026-01-03T00:00:00.000Z" }));
      const before = new Date("2026-01-03T00:00:00.000Z");
      const after = new Date("2026-01-01T00:00:00.000Z");
      const h = await repo.getHistory({ channelId: "chan1", before, after });
      expect(h.map((r) => r.message_id)).toEqual(["2"]);
    });

    it("getHistory : curseur before seul", async () => {
      await repo.upsertMessage(row({ id: "1", timestamp: "2026-01-01T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "2", timestamp: "2026-01-03T00:00:00.000Z" }));
      const h = await repo.getHistory({
        channelId: "chan1",
        before: new Date("2026-01-02T00:00:00.000Z"),
      });
      expect(h.map((r) => r.message_id)).toEqual(["1"]);
    });

    it("getHistory : curseur after seul", async () => {
      await repo.upsertMessage(row({ id: "1", timestamp: "2026-01-01T00:00:00.000Z" }));
      await repo.upsertMessage(row({ id: "2", timestamp: "2026-01-03T00:00:00.000Z" }));
      const h = await repo.getHistory({
        channelId: "chan1",
        after: new Date("2026-01-02T00:00:00.000Z"),
      });
      expect(h.map((r) => r.message_id)).toEqual(["2"]);
    });

    it("getHistory : isole par channel_id", async () => {
      await repo.upsertMessage(row({ id: "1", channel_id: "chanA" }));
      await repo.upsertMessage(row({ id: "2", channel_id: "chanB" }));
      const h = await repo.getHistory({ channelId: "chanA" });
      expect(h.map((r) => r.message_id)).toEqual(["1"]);
    });

    it("search ignore les messages sans contenu", async () => {
      await repo.upsertMessage(row({ id: "1", content: null }));
      expect(await repo.search({ query: "facture" })).toEqual([]);
    });

    it("search : filtre channel seul", async () => {
      await repo.upsertMessage(row({ id: "1", content: "rdv", channel_id: "chanA" }));
      await repo.upsertMessage(row({ id: "2", content: "rdv", channel_id: "chanB" }));
      const hits = await repo.search({ query: "rdv", channelId: "chanB" });
      expect(hits.map((r) => r.message_id)).toEqual(["2"]);
    });

    it("markDeleted exclut de getHistory (soft-delete)", async () => {
      await repo.upsertMessage(row({ id: "1" }));
      await repo.markDeleted("1", new Date("2026-02-01T00:00:00.000Z"));
      expect(await repo.getHistory({ channelId: "chan1" })).toHaveLength(0);
    });

    it("un re-upsert NE ressuscite PAS un message supprimé", async () => {
      await repo.upsertMessage(row({ id: "1", content: "v1" }));
      await repo.markDeleted("1", new Date("2026-02-01T00:00:00.000Z"));
      await repo.upsertMessage(row({ id: "1", content: "v2" })); // backfill repasse dessus
      expect(await repo.getHistory({ channelId: "chan1" })).toHaveLength(0);
    });

    it("search trouve par token, requête vide → []", async () => {
      await repo.upsertMessage(row({ id: "1", content: "le devis Sylvia est signé" }));
      await repo.upsertMessage(row({ id: "2", content: "rien à voir" }));
      const hits = await repo.search({ query: "devis" });
      expect(hits.map((r) => r.message_id)).toEqual(["1"]);
      expect(await repo.search({ query: "" })).toEqual([]);
    });

    it("search respecte les filtres guild/channel/author + exclut supprimés", async () => {
      await repo.upsertMessage(row({ id: "1", content: "facture", guild_id: "gA", author_id: "uA" }));
      await repo.upsertMessage(row({ id: "2", content: "facture", guild_id: "gB", author_id: "uB" }));
      await repo.upsertMessage(row({ id: "3", content: "facture", guild_id: "gA", author_id: "uA" }));
      await repo.markDeleted("3", new Date("2026-02-01T00:00:00.000Z"));
      const hits = await repo.search({ query: "facture", guildId: "gA", authorId: "uA" });
      expect(hits.map((r) => r.message_id)).toEqual(["1"]);
    });

    it("getHistory/search n'exposent JAMAIS raw ni tsv (projection lecture)", async () => {
      await repo.upsertMessage(
        row({ id: "1", content: "projection" })
      );
      const [h] = await repo.getHistory({ channelId: "chan1" });
      const [s] = await repo.search({ query: "projection" });
      for (const r of [h, s]) {
        expect(r).not.toHaveProperty("raw");
        expect(r).not.toHaveProperty("tsv");
        // les champs publics restent là (formatRow en dépend)
        expect(r.message_id).toBe("1");
        expect(r.author_username).toBe("alice");
      }
    });

    it("curseur backfill : set puis get (upsert on conflict)", async () => {
      expect(await repo.getBackfillCursor("chan1")).toBeNull();
      await repo.setBackfillCursor({ channelId: "chan1", oldestSeenId: "50" });
      expect((await repo.getBackfillCursor("chan1")).oldest_seen_id).toBe("50");
      await repo.setBackfillCursor({ channelId: "chan1", oldestSeenId: "10", complete: true });
      const c = await repo.getBackfillCursor("chan1");
      expect(c.oldest_seen_id).toBe("10");
      expect(c.complete).toBe(true);
    });
  });
}

// --- Impl mémoire : toujours ---
contract("MemoryRepository", async () => createMemoryRepository());

// --- Impl Postgres : seulement si RELAY_DATABASE_URL (CI / VPS) ---
const URL = process.env.RELAY_DATABASE_URL;
if (URL) {
  const { createPool, createPgRepository, migrate } = await import("../relay/pg-repository.js");
  const pool = createPool(URL);
  await migrate(pool);
  const pgRepo = createPgRepository(pool);
  afterAll(async () => {
    await pool.end();
  });
  contract("PgRepository", async () => {
    await pool.query("TRUNCATE messages, backfill_cursor");
    return pgRepo;
  });
} else {
  describe.skip("PgRepository (RELAY_DATABASE_URL absent)", () => {
    it("skip", () => {});
  });
}
