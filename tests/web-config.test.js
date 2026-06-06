import { describe, it, expect } from "vitest";
import { loadConfig } from "../web/config.js";

const base = {
  WEB_JWT_SECRET: "x".repeat(32),
  RELAY_DATABASE_URL: "postgres://u:p@h/db",
};

describe("loadConfig", () => {
  it("valide + applique les défauts", () => {
    const c = loadConfig({ ...base });
    expect(c.WEB_HOST).toBe("127.0.0.1");
    expect(c.WEB_PORT).toBe(8080);
    expect(c.WEB_RATE_MAX).toBe(100);
    expect(c.WEB_RATE_WINDOW_MS).toBe(60000);
    expect(c.WEB_CORS_ORIGIN).toBe("");
  });

  it("coerce les nombres (env = strings)", () => {
    const c = loadConfig({ ...base, WEB_PORT: "9000", WEB_RATE_MAX: "5" });
    expect(c.WEB_PORT).toBe(9000);
    expect(c.WEB_RATE_MAX).toBe(5);
  });

  it("throw si WEB_JWT_SECRET manquant", () => {
    expect(() => loadConfig({ RELAY_DATABASE_URL: base.RELAY_DATABASE_URL })).toThrow();
  });

  it("throw si secret trop court (<32)", () => {
    expect(() => loadConfig({ ...base, WEB_JWT_SECRET: "tropcourt" })).toThrow();
  });

  it("throw si RELAY_DATABASE_URL manquant", () => {
    expect(() => loadConfig({ WEB_JWT_SECRET: base.WEB_JWT_SECRET })).toThrow();
  });
});
