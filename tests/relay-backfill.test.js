import { describe, it, expect } from "vitest";
import { backfillChannel } from "../relay/backfill.js";
import { createMemoryRepository } from "../relay/memory-repository.js";

// Fabrique un faux fetchPage : `total` messages (ids décroissants), pages newest→oldest.
function fakeFetch(total, pageLimit = 100) {
  // ids: total, total-1, ... 1 (du plus récent au plus ancien)
  const all = Array.from({ length: total }, (_, i) => ({
    id: String(total - i),
    channel_id: "chan1",
    guild_id: "g",
    author: { id: "u", username: "alice" },
    content: `msg ${total - i}`,
    timestamp: new Date(1700000000000 + (total - i) * 1000).toISOString(),
  }));
  let calls = 0;
  const fn = async ({ before, limit }) => {
    calls++;
    let pool = all;
    if (before !== undefined) pool = all.filter((m) => BigInt(m.id) < BigInt(before));
    return pool.slice(0, limit);
  };
  fn.callCount = () => calls;
  return fn;
}

describe("backfillChannel", () => {
  it("rapatrie tout en plusieurs pages, marque complete", async () => {
    const repo = createMemoryRepository();
    const fetchPage = fakeFetch(250, 100);
    const res = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage, pageLimit: 100 });
    expect(res.complete).toBe(true);
    expect(res.fetched).toBe(250);
    const all = await repo.getHistory({ channelId: "chan1", limit: 1000 });
    expect(all).toHaveLength(250);
    const cur = await repo.getBackfillCursor("chan1");
    expect(cur.complete).toBe(true);
  });

  it("salon vide → complete immédiat", async () => {
    const repo = createMemoryRepository();
    const res = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage: fakeFetch(0) });
    expect(res).toMatchObject({ fetched: 0, complete: true });
  });

  it("ne refait rien si curseur déjà complete", async () => {
    const repo = createMemoryRepository();
    await repo.setBackfillCursor({ channelId: "chan1", oldestSeenId: "1", complete: true });
    const fetchPage = fakeFetch(100);
    const res = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage });
    expect(res.fetched).toBe(0);
    expect(fetchPage.callCount()).toBe(0); // n'a même pas appelé l'API
  });

  it("reprenable : maxPages coupe, rerun continue sans doublon", async () => {
    const repo = createMemoryRepository();
    const fetchPage = fakeFetch(250, 100);
    const r1 = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage, pageLimit: 100, maxPages: 1 });
    expect(r1.complete).toBe(false);
    expect(r1.fetched).toBe(100);
    // rerun reprend sous le curseur
    const r2 = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage, pageLimit: 100 });
    expect(r2.complete).toBe(true);
    const all = await repo.getHistory({ channelId: "chan1", limit: 1000 });
    expect(all).toHaveLength(250); // 250 distincts, pas 350 → idempotent
  });

  it("page incomplète = fond du salon → complete", async () => {
    const repo = createMemoryRepository();
    const fetchPage = fakeFetch(40, 100); // 1 seule page partielle
    const res = await backfillChannel({ channelId: "chan1", repo, botId: "echidna", fetchPage, pageLimit: 100 });
    expect(res).toMatchObject({ fetched: 40, complete: true });
    expect(fetchPage.callCount()).toBe(1);
  });
});
