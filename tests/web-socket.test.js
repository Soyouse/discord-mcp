/**
 * Test d'INTÉGRATION Socket.IO — vrai serveur sur port éphémère + vrai client.
 * Vérifie : rejet sans/avec mauvais JWT, connexion OK avec JWT, abonnement par room, réception d'un emit.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { io as ioClient } from "socket.io-client";
import { attachSocket } from "../web/socket.js";

const SECRET = "s".repeat(32);
let app, io, url;

beforeEach(async () => {
  app = Fastify({ logger: false });
  await app.register(jwt, { secret: SECRET });
  await app.listen({ host: "127.0.0.1", port: 0 });
  io = attachSocket(app.server, { verifyToken: (t) => app.jwt.verify(t) });
  const { port } = app.server.address();
  url = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await io.close();
  await app.close();
});

function connect(token) {
  return ioClient(url, { auth: { token }, transports: ["websocket"], reconnection: false });
}

function token() {
  return app.jwt.sign({ sub: "op1", username: "operator", tenant: "default" });
}

describe("Socket.IO — auth", () => {
  it("rejette une connexion sans token", async () => {
    const sock = connect(undefined);
    const err = await new Promise((res) => sock.on("connect_error", res));
    expect(err.message).toMatch(/unauthorized/);
    sock.close();
  });

  it("rejette un token bidon", async () => {
    const sock = connect("pas-un-jwt");
    const err = await new Promise((res) => sock.on("connect_error", res));
    expect(err.message).toMatch(/unauthorized/);
    sock.close();
  });

  it("accepte un JWT valide", async () => {
    const sock = connect(token());
    await new Promise((res) => sock.on("connect", res));
    expect(sock.connected).toBe(true);
    sock.close();
  });
});

describe("Socket.IO — diffusion par salon (room)", () => {
  it("un client abonné au salon reçoit l'event émis dans sa room", async () => {
    const sock = connect(token());
    await new Promise((res) => sock.on("connect", res));

    // S'abonner au salon c1 (ack → join garanti AVANT l'emit → test déterministe).
    await sock.emitWithAck("subscribe", { channel_id: "c1" });

    const payload = { type: "message.created", channel_id: "c1", message_id: "42" };
    const received = new Promise((res) => sock.on("message.created", res));
    io.to("channel:c1").emit("message.created", payload);

    expect(await received).toEqual(payload);
    sock.close();
  });

  it("un client NON abonné au salon ne reçoit PAS l'event", async () => {
    const sock = connect(token());
    await new Promise((res) => sock.on("connect", res));
    await sock.emitWithAck("subscribe", { channel_id: "autre" });

    let got = false;
    sock.on("message.created", () => { got = true; });
    io.to("channel:c1").emit("message.created", { type: "message.created", channel_id: "c1", message_id: "1" });

    // laisse le temps à un éventuel (mauvais) message d'arriver
    await new Promise((res) => setTimeout(res, 80));
    expect(got).toBe(false);
    sock.close();
  });

  it("subscribe avec une STRING nue (drift de contrat) → ack {ok:false}, pas de join", async () => {
    // ⚠️ Régression VÉCUE (2026-06-11) : le front envoyait une string, l'ack répondait {ok:true}
    //    sans join → zéro temps réel en prod, en silence. L'ack DOIT dire la vérité.
    const sock = connect(token());
    await new Promise((res) => sock.on("connect", res));

    const ack = await sock.emitWithAck("subscribe", "c1");
    expect(ack.ok).toBe(false);

    let got = false;
    sock.on("message.created", () => { got = true; });
    io.to("channel:c1").emit("message.created", { type: "message.created", channel_id: "c1", message_id: "1" });
    await new Promise((res) => setTimeout(res, 80));
    expect(got).toBe(false);
    sock.close();
  });

  it("subscribe sans channel_id → ack {ok:false}", async () => {
    const sock = connect(token());
    await new Promise((res) => sock.on("connect", res));
    const ack = await sock.emitWithAck("subscribe", {});
    expect(ack.ok).toBe(false);
    sock.close();
  });
});
