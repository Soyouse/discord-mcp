/**
 * Flow OAuth (oauth-service.js) — login/refresh/logout avec deps INJECTÉES (zéro réseau, temps faux).
 * Couvre : succès, fail-closed allowlist (403), échecs d'échange (401), rotation, expiry/révocation, rejeu.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as svc from "../web/oauth-service.js";
import { createMemoryRefreshStore, hashToken } from "../web/refresh-store.js";

let store, counter, deps, clock;

function makeDeps({ userId = "123", allowedIds = ["123"], exchangeOk = true } = {}) {
  return {
    exchangeCode: async (code) => (exchangeOk && code ? { access_token: "at-" + code } : null),
    fetchUser: async () => ({ id: userId, username: "soyouse", global_name: "Soyouse" }),
    allowedIds,
    store,
    issueAccessToken: (p) => `jwt:${p.userId}:${p.username}:${p.tenantId}`,
    genRefreshRaw: () => `R${++counter}`,
    now: () => clock,
    refreshTtlMs: 5000,
    tenantId: "default",
  };
}

beforeEach(() => {
  store = createMemoryRefreshStore();
  counter = 0;
  clock = 1_000_000;
  deps = makeDeps();
});

describe("login", () => {
  it("succès : access JWT + refresh créé + principal", async () => {
    const out = await svc.login({ code: "good" }, deps);
    expect(out.accessToken).toBe("jwt:123:Soyouse:default");
    expect(out.refreshRaw).toBe("R1");
    expect(out.principal).toEqual({ userId: "123", username: "Soyouse", tenantId: "default" });
    // le refresh est stocké HASHÉ, jamais en clair
    const rec = await store.find(hashToken("R1"));
    expect(rec).toMatchObject({ userId: "123", username: "Soyouse", tenantId: "default", revoked: false });
    expect(await store.find("R1")).toBeNull();
  });

  it("expiry = now + refreshTtlMs", async () => {
    const out = await svc.login({ code: "good" }, deps);
    expect(new Date(out.refreshExpiresAt).getTime()).toBe(clock + 5000);
  });

  it("sans code → 400", async () => {
    await expect(svc.login({}, deps)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("échange échoué → 401, aucun refresh créé", async () => {
    deps = makeDeps({ exchangeOk: false });
    await expect(svc.login({ code: "x" }, deps)).rejects.toMatchObject({ statusCode: 401 });
    expect(await store.find(hashToken("R1"))).toBeNull();
  });

  it("hors allowlist → 403, NI access NI refresh (fail-closed)", async () => {
    deps = makeDeps({ userId: "999", allowedIds: ["123"] });
    await expect(svc.login({ code: "good" }, deps)).rejects.toMatchObject({ statusCode: 403 });
    expect(await store.find(hashToken("R1"))).toBeNull();
  });
});

describe("refresh (rotation)", () => {
  it("token valide → nouvel access + nouveau refresh, ancien révoqué", async () => {
    const first = await svc.login({ code: "good" }, deps); // R1
    const out = await svc.refresh({ refreshRaw: first.refreshRaw }, deps); // R2
    expect(out.refreshRaw).toBe("R2");
    expect(out.accessToken).toBe("jwt:123:Soyouse:default");
    expect((await store.find(hashToken("R1"))).revoked).toBe(true); // ancien tué
    expect((await store.find(hashToken("R2"))).revoked).toBe(false);
  });

  it("rejeu d'un refresh déjà tourné → 401", async () => {
    const first = await svc.login({ code: "good" }, deps);
    await svc.refresh({ refreshRaw: first.refreshRaw }, deps); // R1 révoqué
    await expect(svc.refresh({ refreshRaw: first.refreshRaw }, deps)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("sans token → 401", async () => {
    await expect(svc.refresh({}, deps)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("token inconnu → 401", async () => {
    await expect(svc.refresh({ refreshRaw: "ghost" }, deps)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("token expiré → 401", async () => {
    const first = await svc.login({ code: "good" }, deps);
    clock += 6000; // dépasse refreshTtlMs (5000)
    await expect(svc.refresh({ refreshRaw: first.refreshRaw }, deps)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("logout", () => {
  it("révoque le refresh courant", async () => {
    const first = await svc.login({ code: "good" }, deps);
    await svc.logout({ refreshRaw: first.refreshRaw }, deps);
    expect((await store.find(hashToken(first.refreshRaw))).revoked).toBe(true);
  });
  it("sans token = no-op (idempotent)", async () => {
    await expect(svc.logout({}, deps)).resolves.toBeUndefined();
  });
});
