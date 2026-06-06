import { describe, it, expect } from "vitest";
import { claimsToPrincipal } from "../web/auth.js";
import { resolveTenant, DEFAULT_TENANT } from "../web/tenant.js";

describe("claimsToPrincipal", () => {
  it("mappe un payload valide", () => {
    const p = claimsToPrincipal({ sub: "u1", username: "alice", tenant: "clientX" });
    expect(p).toEqual({ userId: "u1", username: "alice", tenantId: "clientX" });
  });

  it("sans tenant → tenant par défaut", () => {
    expect(claimsToPrincipal({ sub: "u1" }).tenantId).toBe(DEFAULT_TENANT);
  });

  it("username non-string → null", () => {
    expect(claimsToPrincipal({ sub: "u1", username: 42 }).username).toBeNull();
  });

  it("throw si sub manquant ou non-string", () => {
    expect(() => claimsToPrincipal({})).toThrow(/sub/);
    expect(() => claimsToPrincipal({ sub: 123 })).toThrow(/sub/);
    expect(() => claimsToPrincipal(null)).toThrow(/sub/);
  });
});

describe("resolveTenant", () => {
  it("principal avec tenantId → ce tenant", () => {
    expect(resolveTenant({ tenantId: "clientX" })).toBe("clientX");
  });
  it("principal sans tenantId / absent → défaut", () => {
    expect(resolveTenant({})).toBe(DEFAULT_TENANT);
    expect(resolveTenant(undefined)).toBe(DEFAULT_TENANT);
  });
});
