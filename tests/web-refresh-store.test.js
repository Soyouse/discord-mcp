/** Store refresh PUR/mémoire (refresh-store.js) — hash, usabilité (expiry/revoke), CRUD mémoire. */
import { describe, it, expect } from "vitest";
import { hashToken, isUsable, createMemoryRefreshStore } from "../web/refresh-store.js";

describe("hashToken", () => {
  it("déterministe + ne renvoie JAMAIS le brut", () => {
    const h = hashToken("secret-raw");
    expect(h).toBe(hashToken("secret-raw"));
    expect(h).not.toContain("secret-raw");
    expect(h).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
  });
  it("entrées différentes → hash différents", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
  it("throw si brut vide", () => {
    expect(() => hashToken("")).toThrow();
  });
});

describe("isUsable", () => {
  const now = 1_000_000;
  it("true si non révoqué et non expiré", () => {
    expect(isUsable({ revoked: false, expiresAt: new Date(now + 1000) }, now)).toBe(true);
  });
  it("false si révoqué", () => {
    expect(isUsable({ revoked: true, expiresAt: new Date(now + 1000) }, now)).toBe(false);
  });
  it("false si expiré", () => {
    expect(isUsable({ revoked: false, expiresAt: new Date(now - 1) }, now)).toBe(false);
  });
  it("false si record absent", () => {
    expect(isUsable(null, now)).toBe(false);
  });
});

describe("createMemoryRefreshStore", () => {
  it("create → find renvoie l'enregistrement (avec username)", async () => {
    const s = createMemoryRefreshStore();
    await s.create({ tokenHash: "h1", userId: "u1", username: "operator", tenantId: "t", expiresAt: new Date(5) });
    expect(await s.find("h1")).toMatchObject({ tokenHash: "h1", userId: "u1", username: "operator", revoked: false });
  });
  it("find inconnu → null", async () => {
    expect(await createMemoryRefreshStore().find("nope")).toBeNull();
  });
  it("revoke marque révoqué", async () => {
    const s = createMemoryRefreshStore();
    await s.create({ tokenHash: "h", userId: "u", tenantId: "t", expiresAt: new Date(5) });
    await s.revoke("h");
    expect((await s.find("h")).revoked).toBe(true);
  });
  it("revoke inconnu = no-op (pas de throw)", async () => {
    await expect(createMemoryRefreshStore().revoke("ghost")).resolves.toBeUndefined();
  });
  it("revokeAllForUser révoque tous les tokens de l'utilisateur seulement", async () => {
    const s = createMemoryRefreshStore();
    await s.create({ tokenHash: "a", userId: "u1", tenantId: "t", expiresAt: new Date(5) });
    await s.create({ tokenHash: "b", userId: "u1", tenantId: "t", expiresAt: new Date(5) });
    await s.create({ tokenHash: "c", userId: "u2", tenantId: "t", expiresAt: new Date(5) });
    await s.revokeAllForUser("u1");
    expect((await s.find("a")).revoked).toBe(true);
    expect((await s.find("b")).revoked).toBe(true);
    expect((await s.find("c")).revoked).toBe(false);
  });
  it("username par défaut null", async () => {
    const s = createMemoryRefreshStore();
    await s.create({ tokenHash: "h", userId: "u", tenantId: "t", expiresAt: new Date(5) });
    expect((await s.find("h")).username).toBeNull();
  });
});
