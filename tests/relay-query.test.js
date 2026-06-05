import { describe, it, expect } from "vitest";
import { clampLimit, parseDate, formatRow, runHistory, runSearch } from "../relay/query.js";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeMessage } from "../relay/normalize.js";

const seed = async (repo, msgs) => {
  for (const m of msgs) {
    await repo.upsertMessage(
      normalizeMessage(
        {
          id: m.id,
          channel_id: m.channel_id ?? "chan1",
          guild_id: m.guild_id ?? "guild1",
          author: { id: m.author_id ?? "user1", username: m.username ?? "alice" },
          content: m.content ?? "hello",
          timestamp: m.timestamp ?? "2026-01-01T00:00:00.000Z",
        },
        "echidna"
      )
    );
  }
};

describe("clampLimit", () => {
  it("défaut quand absent/invalide/négatif", () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit("abc")).toBe(50);
    expect(clampLimit(-3)).toBe(50);
    expect(clampLimit(0)).toBe(50);
  });
  it("borne au max et plancher les flottants", () => {
    expect(clampLimit(999)).toBe(200);
    expect(clampLimit(10.9)).toBe(10);
  });
  it("défaut paramétrable", () => {
    expect(clampLimit(undefined, 25)).toBe(25);
  });
});

describe("parseDate", () => {
  it("vide → undefined", () => {
    expect(parseDate(undefined)).toBeUndefined();
    expect(parseDate("")).toBeUndefined();
    expect(parseDate(null)).toBeUndefined();
  });
  it("ISO valide → Date", () => {
    expect(parseDate("2026-01-01T00:00:00.000Z").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it("invalide → throw (pas de filtre silencieux)", () => {
    expect(() => parseDate("pas-une-date")).toThrow(/invalide/);
  });
});

describe("formatRow", () => {
  it("Date → ISO, nulls propres, pas de champs internes", () => {
    const out = formatRow({
      message_id: "1", channel_id: "c", guild_id: null, author_id: "u",
      author_username: null, content: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"), edited_at: null,
      raw: { secret: 1 }, tsv: "x", rank: 0.5,
    });
    expect(out).toEqual({
      message_id: "1", channel_id: "c", guild_id: null, author_id: "u",
      author: null, content: null,
      created_at: "2026-01-01T00:00:00.000Z", edited_at: null,
    });
    expect(out.raw).toBeUndefined();
    expect(out.tsv).toBeUndefined();
  });
});

describe("runHistory", () => {
  it("exige channel_id", async () => {
    await expect(runHistory(createMemoryRepository(), {})).rejects.toThrow(/channel_id/);
  });
  it("formate, plus récent d'abord", async () => {
    const repo = createMemoryRepository();
    await seed(repo, [
      { id: "1", timestamp: "2026-01-01T00:00:00.000Z" },
      { id: "2", timestamp: "2026-01-02T00:00:00.000Z" },
    ]);
    const out = await runHistory(repo, { channel_id: "chan1" });
    expect(out.map((r) => r.message_id)).toEqual(["2", "1"]);
    expect(out[0].created_at).toBe("2026-01-02T00:00:00.000Z");
  });
  it("respecte limit + curseurs", async () => {
    const repo = createMemoryRepository();
    await seed(repo, [
      { id: "1", timestamp: "2026-01-01T00:00:00.000Z" },
      { id: "2", timestamp: "2026-01-02T00:00:00.000Z" },
      { id: "3", timestamp: "2026-01-03T00:00:00.000Z" },
    ]);
    expect((await runHistory(repo, { channel_id: "chan1", limit: 1 })).map((r) => r.message_id)).toEqual(["3"]);
    const mid = await runHistory(repo, {
      channel_id: "chan1",
      before: "2026-01-03T00:00:00.000Z",
      after: "2026-01-01T00:00:00.000Z",
    });
    expect(mid.map((r) => r.message_id)).toEqual(["2"]);
  });
});

describe("runSearch", () => {
  it("exige query non vide", async () => {
    await expect(runSearch(createMemoryRepository(), {})).rejects.toThrow(/query/);
    await expect(runSearch(createMemoryRepository(), { query: "   " })).rejects.toThrow(/query/);
  });
  it("trouve + filtre author", async () => {
    const repo = createMemoryRepository();
    await seed(repo, [
      { id: "1", content: "le devis est signé", author_id: "uA" },
      { id: "2", content: "le devis attend", author_id: "uB" },
    ]);
    const out = await runSearch(repo, { query: "devis", author_id: "uA" });
    expect(out.map((r) => r.message_id)).toEqual(["1"]);
    expect(out[0].author).toBe("alice");
  });
});
