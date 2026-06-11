/**
 * enrich-profiles (REST profil → annuaire) — OFFLINE : fetchUser injecté, repo mémoire.
 * Edge cases scellés : garde 24h (pas de re-REST inutile), échec par-user non bloquant,
 * primary_guild désactivé → tag null (respect du masquage).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeMember, normalizeUserProfile } from "../relay/normalize-directory.js";
import { enrichProfiles } from "../relay/enrich-profiles.js";

const member = (userId) =>
  normalizeMember({ user: { id: userId, username: userId, bot: false } }, "echidna", "g1");

const userPayload = (id, extra = {}) => ({
  id,
  public_flags: 64,
  banner: "bh",
  accent_color: 7,
  primary_guild: { identity_guild_id: "428", identity_enabled: true, tag: "2077", badge: "bdg" },
  ...extra,
});

let repo;
beforeEach(() => {
  repo = createMemoryRepository();
});

describe("normalizeUserProfile", () => {
  it("mappe flags/banner/accent + tag serveur (primary_guild activé)", () => {
    expect(normalizeUserProfile(userPayload("u1"))).toEqual({
      user_id: "u1", public_flags: 64, banner: "bh", accent_color: 7,
      tag: "2077", tag_badge: "bdg", tag_guild_id: "428",
    });
  });

  it("primary_guild désactivé (identity_enabled=false) → tag null (masquage respecté)", () => {
    const p = normalizeUserProfile(userPayload("u1", { primary_guild: { identity_enabled: false, tag: "2077" } }));
    expect(p.tag).toBeNull();
    expect(p.tag_badge).toBeNull();
  });

  it("champs absents → null partout, id manquant → throw", () => {
    expect(normalizeUserProfile({ id: "u1" })).toEqual({
      user_id: "u1", public_flags: null, banner: null, accent_color: null, tag: null, tag_badge: null, tag_guild_id: null,
    });
    expect(() => normalizeUserProfile({})).toThrow();
  });
});

describe("enrichProfiles", () => {
  it("synchronise les profils manquants et stampe profile_synced_at", async () => {
    await repo.upsertMember(member("u1"));
    await repo.upsertMember(member("u2"));
    const fetchUser = vi.fn(async (id) => userPayload(id));
    const r = await enrichProfiles({ repo, fetchUser, now: () => new Date("2026-06-12T00:00:00Z") });
    expect(r).toEqual({ total: 2, synced: 2, failed: 0 });
    const [m1] = (await repo.listMembers({ guildId: "g1" })).filter((m) => m.user_id === "u1");
    expect(m1).toMatchObject({ public_flags: 64, tag: "2077", profile_synced_at: "2026-06-12T00:00:00.000Z" });
  });

  it("garde 24h : profil frais → AUCUN appel REST (re-chunk ≠ re-REST)", async () => {
    await repo.upsertMember(member("u1"));
    const fetchUser = vi.fn(async (id) => userPayload(id));
    const at = (iso) => ({ repo, fetchUser, now: () => new Date(iso) });
    await enrichProfiles(at("2026-06-12T00:00:00Z"));
    fetchUser.mockClear();
    const r = await enrichProfiles(at("2026-06-12T01:00:00Z")); // 1h plus tard < 24h
    expect(fetchUser).not.toHaveBeenCalled();
    expect(r.total).toBe(0);
  });

  it("périmé (>24h) → re-synchronisé", async () => {
    await repo.upsertMember(member("u1"));
    const fetchUser = vi.fn(async (id) => userPayload(id));
    await enrichProfiles({ repo, fetchUser, now: () => new Date("2026-06-10T00:00:00Z") });
    const r = await enrichProfiles({ repo, fetchUser, now: () => new Date("2026-06-12T00:00:00Z") });
    expect(r.synced).toBe(1);
  });

  it("un user en échec ne bloque PAS les autres et reste à re-synchroniser", async () => {
    await repo.upsertMember(member("u1"));
    await repo.upsertMember(member("u2"));
    const fetchUser = vi.fn(async (id) => {
      if (id === "u1") throw new Error("403");
      return userPayload(id);
    });
    const r = await enrichProfiles({ repo, fetchUser, now: () => new Date("2026-06-12T00:00:00Z") });
    expect(r).toEqual({ total: 2, synced: 1, failed: 1 });
    expect(await repo.listUserIdsNeedingProfileSync({})).toEqual(["u1"]);
  });
});
