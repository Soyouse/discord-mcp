/**
 * Tests d'INTÉGRATION des routes d'ACTION via app.inject() — `discordCall` faké (zéro réseau).
 * Vérifie : guard JWT (401 sans token), 201 + forward au bon endpoint, validation → 400, passage du bot.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../web/build-app.js";
import { createMemoryRepository } from "../relay/memory-repository.js";

const config = {
  WEB_JWT_SECRET: "a".repeat(32),
  WEB_CORS_ORIGIN: "",
  WEB_RATE_MAX: 1000,
  WEB_RATE_WINDOW_MS: 60000,
};

let app, token, calls;

beforeEach(async () => {
  calls = [];
  const discordCall = async (method, endpoint, payload, opts) => {
    calls.push({ method, endpoint, payload, opts });
    if (endpoint === "/users/@me/channels") return { id: "dmReal" };
    // endpoint = /channels/{id}/messages → le channel_id de l'écho = l'id du path.
    const channel_id = endpoint.split("/")[2];
    return { id: "m1", channel_id, author: { id: "bot1" }, content: payload?.content };
  };
  app = await buildApp({ repo: createMemoryRepository(), config, discordCall });
  token = app.jwt.sign({ sub: "op1", username: "operator" });
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe("routes d'action — guard & forward", () => {
  it("POST message SANS token → 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/channels/c1/messages", payload: { content: "hi" } });
    expect(res.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("POST message avec token → 201 + forward REST + projection", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/channels/c1/messages",
      headers: auth(),
      payload: { content: "hi", bot: "echidna" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ message_id: "m1", channel_id: "c1", author_id: "bot1", content: "hi" });
    expect(calls[0]).toEqual({
      method: "POST",
      endpoint: "/channels/c1/messages",
      payload: { content: "hi" },
      opts: { bot: "echidna" },
    });
  });

  it("POST message content vide → 400", async () => {
    const res = await app.inject({ method: "POST", url: "/api/channels/c1/messages", headers: auth(), payload: {} });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("POST /api/dms → 201 + channel_id", async () => {
    const res = await app.inject({ method: "POST", url: "/api/dms", headers: auth(), payload: { recipientId: "u1" } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ channel_id: "dmReal" });
  });

  it("POST /api/dms/:id/messages → ouvre DM puis poste (2 forwards)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/dms/u1/messages",
      headers: auth(),
      payload: { content: "yo" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().channel_id).toBe("dmReal");
    expect(calls.map((c) => c.endpoint)).toEqual(["/users/@me/channels", "/channels/dmReal/messages"]);
  });
});
