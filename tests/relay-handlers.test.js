/**
 * Handlers discord_history / discord_search : couvre les 2 branches (relais configuré ou non)
 * en mockant lib/relay-read.js → pas besoin de vraie base pour tester la délégation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeMessage } from "../relay/normalize.js";

let mockRepo = null;
vi.mock("../lib/relay-read.js", () => ({
  getReadRepo: () => mockRepo,
}));

const { tool: history } = await import("../handlers/history.js");
const { tool: search } = await import("../handlers/search.js");

beforeEach(() => {
  mockRepo = null;
});

describe("discord_history handler", () => {
  it("relais absent → erreur propre, pas de crash", async () => {
    const out = JSON.parse(await history.handle({ channel_id: "c" }));
    expect(out.error).toMatch(/relais non configuré/);
  });

  it("relais présent → délègue et renvoie l'historique formaté", async () => {
    mockRepo = createMemoryRepository();
    await mockRepo.upsertMessage(
      normalizeMessage(
        { id: "1", channel_id: "c", guild_id: "g", author: { id: "u", username: "alice" }, content: "salut", timestamp: "2026-01-01T00:00:00.000Z" },
        "echidna"
      )
    );
    const out = JSON.parse(await history.handle({ channel_id: "c" }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ message_id: "1", author: "alice", content: "salut" });
  });

  it("expose name/required attendus", () => {
    expect(history.name).toBe("discord_history");
    expect(history.inputSchema.required).toContain("channel_id");
  });
});

describe("discord_search handler", () => {
  it("relais absent → erreur propre", async () => {
    const out = JSON.parse(await search.handle({ query: "x" }));
    expect(out.error).toMatch(/relais non configuré/);
  });

  it("relais présent → délègue la recherche", async () => {
    mockRepo = createMemoryRepository();
    await mockRepo.upsertMessage(
      normalizeMessage(
        { id: "1", channel_id: "c", guild_id: "g", author: { id: "u", username: "alice" }, content: "facture payée", timestamp: "2026-01-01T00:00:00.000Z" },
        "echidna"
      )
    );
    const out = JSON.parse(await search.handle({ query: "facture" }));
    expect(out.map((r) => r.message_id)).toEqual(["1"]);
  });

  it("expose name/required attendus", () => {
    expect(search.name).toBe("discord_search");
    expect(search.inputSchema.required).toContain("query");
  });
});
