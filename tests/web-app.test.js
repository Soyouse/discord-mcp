/**
 * Tests d'INTÉGRATION de l'API via app.inject() — zéro réseau, déterministe (pattern Fastify).
 * Vérifie : healthcheck public, 401 sans token, 200 avec token, scoping lecture, garde JWT.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../web/build-app.js";
import { createMemoryRepository } from "../relay/memory-repository.js";
import { normalizeGuild, normalizeChannel, normalizeMember } from "../relay/normalize-directory.js";

const config = {
  WEB_JWT_SECRET: "a".repeat(32),
  WEB_CORS_ORIGIN: "",
  WEB_RATE_MAX: 1000,
  WEB_RATE_WINDOW_MS: 60000,
};

let app, repo, token;

beforeEach(async () => {
  repo = createMemoryRepository();
  await repo.upsertGuild(normalizeGuild({ id: "g1", name: "WebZenon" }, "echidna"));
  await repo.upsertChannel(normalizeChannel({ id: "c1", name: "général", position: 0 }, "echidna", "g1"));
  await repo.upsertMember(normalizeMember({ user: { id: "u1", username: "alice", bot: false } }, "echidna", "g1"));
  await repo.upsertMember(normalizeMember({ user: { id: "b1", username: "bot", bot: true } }, "echidna", "g1"));
  app = await buildApp({ repo, config });
  token = app.jwt.sign({ sub: "op1", username: "operator", tenant: "default" });
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe("API web — auth & lecture", () => {
  it("GET /api/health = public, 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("GET /api/guilds SANS token → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/guilds avec token → 200 + données", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ guild_id: "g1", name: "WebZenon", icon: null }]);
  });

  it("token bidon → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds", headers: { authorization: "Bearer nope" } });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/guilds/:id/channels → 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds/g1/channels", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((c) => c.channel_id)).toEqual(["c1"]);
  });

  it("GET /api/dmables → 200, exclut les bots", async () => {
    const res = await app.inject({ method: "GET", url: "/api/dmables", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((m) => m.user_id)).toEqual(["u1"]);
  });

  it("GET /api/guilds/:id/members → 200, bots INCLUS (avatar du bot dans le fil)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds/g1/members", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((m) => m.user_id)).toEqual(["b1", "u1"]);
    expect(res.json().find((m) => m.user_id === "b1").is_bot).toBe(true);
  });

  it("GET /api/guilds/:id/members SANS token → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/guilds/g1/members" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/search sans q → 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/search", headers: auth() });
    expect(res.statusCode).toBe(400);
  });

  it("rate-limit actif (en-tête x-ratelimit-limit présent)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.headers).toHaveProperty("x-ratelimit-limit");
  });
});
