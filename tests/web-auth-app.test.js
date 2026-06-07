/**
 * Routes OAuth via app.inject() — oauthIo faké, store mémoire (zéro réseau).
 * Couvre : login (302 + state cookie), callback (state CSRF, succès cookie refresh, 403 hors allowlist),
 *          refresh (401 sans cookie, 200 + rotation cookie), logout (204).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../web/build-app.js";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { createMemoryRefreshStore, hashToken } from "../web/refresh-store.js";

const config = {
  WEB_JWT_SECRET: "a".repeat(32),
  WEB_CORS_ORIGIN: "",
  WEB_RATE_MAX: 1000,
  WEB_RATE_WINDOW_MS: 60000,
  DISCORD_CLIENT_ID: "cid",
  DISCORD_CLIENT_SECRET: "sec",
  DISCORD_OAUTH_REDIRECT_URI: "https://x/cb",
  OAUTH_ALLOWED_USER_IDS: "123",
  WEB_ACCESS_TTL: "15m",
  WEB_REFRESH_TTL_DAYS: 30,
};

let app, store, userId;

beforeEach(async () => {
  store = createMemoryRefreshStore();
  userId = "123";
  const oauthIo = {
    exchangeCode: async (code) => (code === "good" ? { access_token: "at" } : null),
    fetchUser: async () => ({ id: userId, username: "soyouse", global_name: "Soyouse" }),
  };
  app = await buildApp({ repo: createMemoryRepository(), config, refreshStore: store, oauthIo });
});

/** Extrait "name=value" d'un Set-Cookie (à renvoyer tel quel comme header Cookie). */
function cookie(res, name) {
  const all = [].concat(res.headers["set-cookie"] || []);
  const hit = all.find((c) => c.startsWith(name + "="));
  return hit ? hit.split(";")[0] : null;
}

describe("GET /api/auth/login", () => {
  it("302 vers Discord + pose le state cookie signé", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/login" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("https://discord.com/oauth2/authorize");
    expect(cookie(res, "oauth_state")).toBeTruthy();
  });
});

describe("GET /api/auth/callback", () => {
  it("state absent/incohérent → redirige /login?error=state (anti-CSRF)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/callback?code=good&state=forged" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login?error=state");
  });

  it("succès (user autorisé) → pose refresh cookie + redirige /", async () => {
    const login = await app.inject({ method: "GET", url: "/api/auth/login" });
    const stateCookie = cookie(login, "oauth_state");
    const state = new URL(login.headers.location).searchParams.get("state");

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=good&state=${state}`,
      headers: { cookie: stateCookie },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(cookie(res, "refresh_token")).toBeTruthy();
  });

  it("user hors allowlist → /login?error=forbidden, aucun refresh posé", async () => {
    userId = "999"; // pas dans OAUTH_ALLOWED_USER_IDS
    const login = await app.inject({ method: "GET", url: "/api/auth/login" });
    const stateCookie = cookie(login, "oauth_state");
    const state = new URL(login.headers.location).searchParams.get("state");

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=good&state=${state}`,
      headers: { cookie: stateCookie },
    });
    expect(res.headers.location).toBe("/login?error=forbidden");
    expect(cookie(res, "refresh_token")).toBeNull();
  });
});

describe("POST /api/auth/refresh", () => {
  it("sans cookie → 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/refresh" });
    expect(res.statusCode).toBe(401);
  });

  it("refresh valide → 200 + accessToken + user + rotation du cookie", async () => {
    await store.create({ tokenHash: hashToken("R0"), userId: "123", username: "Soyouse", tenantId: "default", expiresAt: new Date(Date.now() + 1e9) });
    const res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: "refresh_token=R0" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(body.user).toEqual({ userId: "123", username: "Soyouse" });
    expect(cookie(res, "refresh_token")).toBeTruthy();
    expect(cookie(res, "refresh_token")).not.toContain("R0"); // tourné
    // le JWT renvoyé est vérifiable par l'app
    expect(app.jwt.verify(body.accessToken).sub).toBe("123");
  });
});

describe("POST /api/auth/logout", () => {
  it("204 + révoque le refresh", async () => {
    await store.create({ tokenHash: hashToken("R0"), userId: "123", tenantId: "default", expiresAt: new Date(Date.now() + 1e9) });
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: "refresh_token=R0" } });
    expect(res.statusCode).toBe(204);
    expect((await store.find(hashToken("R0"))).revoked).toBe(true);
  });
});
