/**
 * Contrat de résilience du client LISTEN dédié (web/realtime-bridge.js).
 * ⚠️ Incident réel 2026-07-09 : `listenClient` (pg.Client dédié LISTEN) n'avait AUCUN
 * handler d'erreur → toute coupure Postgres levait une exception non interceptée qui
 * tuait le process. Avec restart automatique, boucle de plantage → 4 conteneurs bloqués
 * en restart:no pendant 7 semaines. Ce test PROUVE la reconnexion avant le fix (ROUGE),
 * puis après (VERT).
 * I/O → exclu mutation (cf stryker.conf.json) : ce fichier teste le CONTRAT via un client
 * PG fake (EventEmitter), pas un vrai Postgres — c'est le rôle de la preuve EN RÉEL (VPS).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { createResilientListener } from "../web/realtime-bridge.js";
import { EVENT_CHANNEL } from "../web/realtime.js";

function makeFakeClient({ failConnect = false } = {}) {
  const client = new EventEmitter();
  client.queries = [];
  client.connectCalls = 0;
  client.ended = false;
  client.connect = vi.fn(async () => {
    client.connectCalls += 1;
    if (failConnect) throw new Error("connexion refusée (simulée)");
  });
  client.query = vi.fn(async (sql) => {
    client.queries.push(sql);
  });
  client.end = vi.fn(async () => {
    client.ended = true;
  });
  return client;
}

function fakeIo() {
  return { to: vi.fn(() => ({ emit: vi.fn() })) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createResilientListener", () => {
  it("connecte et pose LISTEN sur le canal partagé au démarrage", async () => {
    const client1 = makeFakeClient();
    const makeClient = vi.fn(() => client1);
    const io = fakeIo();

    const handle = await createResilientListener({ makeClient, io, baseDelayMs: 10, maxDelayMs: 100 });

    expect(client1.connectCalls).toBe(1);
    expect(client1.queries).toEqual([`LISTEN ${EVENT_CHANNEL}`]);
    await handle.stop();
  });

  it("une erreur sur la connexion active déclenche une RECONNEXION (jamais un crash silencieux)", async () => {
    const client1 = makeFakeClient();
    const client2 = makeFakeClient();
    const makeClient = vi.fn().mockReturnValueOnce(client1).mockReturnValueOnce(client2);
    const io = fakeIo();
    const log = vi.fn();

    const handle = await createResilientListener({ makeClient, io, baseDelayMs: 10, maxDelayMs: 100, log });

    // Coupure simulée (ex: redémarrage du conteneur Postgres) — AUCUN handler = crash process (comportement pré-fix).
    client1.emit("error", new Error("connexion terminée de façon inattendue"));

    await vi.advanceTimersByTimeAsync(50);

    expect(makeClient).toHaveBeenCalledTimes(2);
    expect(client2.connectCalls).toBe(1);
    expect(client2.queries).toEqual([`LISTEN ${EVENT_CHANNEL}`]); // re-LISTEN obligatoire après reconnexion
    expect(log).toHaveBeenCalled(); // crie — ne l'avale jamais en silence
    await handle.stop();
  });

  it("après reconnexion, les notifications sont TOUJOURS routées vers Socket.IO (via le nouveau client)", async () => {
    const client1 = makeFakeClient();
    const client2 = makeFakeClient();
    const makeClient = vi.fn().mockReturnValueOnce(client1).mockReturnValueOnce(client2);
    const room = { emit: vi.fn() };
    const io = { to: vi.fn(() => room) };

    const handle = await createResilientListener({ makeClient, io, baseDelayMs: 10, maxDelayMs: 100 });
    client1.emit("error", new Error("boom"));
    await vi.advanceTimersByTimeAsync(50);

    const payload = JSON.stringify({ type: "message.created", channel_id: "c1", message_id: "1" });
    client2.emit("notification", { payload });

    expect(io.to).toHaveBeenCalledWith("channel:c1");
    expect(room.emit).toHaveBeenCalledWith("message.created", expect.objectContaining({ channel_id: "c1" }));
    await handle.stop();
  });

  it("le délai de reconnexion est BORNÉ (backoff exponentiel plafonné, jamais d'attente illimitée)", async () => {
    const failing1 = makeFakeClient({ failConnect: true });
    const failing2 = makeFakeClient({ failConnect: true });
    const ok = makeFakeClient();
    const makeClient = vi.fn().mockReturnValueOnce(failing1).mockReturnValueOnce(failing2).mockReturnValueOnce(ok);
    const io = fakeIo();

    const handle = await createResilientListener({ makeClient, io, baseDelayMs: 10, maxDelayMs: 25 });

    // 1er échec de connexion planifie une retry ; on avance largement au-delà du plafond déclaré.
    await vi.advanceTimersByTimeAsync(200);

    expect(makeClient).toHaveBeenCalledTimes(3);
    expect(ok.connectCalls).toBe(1);
    await handle.stop();
  });

  it("stop() arrête proprement : ferme le client courant et ne reconnecte plus jamais après", async () => {
    const client1 = makeFakeClient();
    const makeClient = vi.fn(() => client1);
    const io = fakeIo();

    const handle = await createResilientListener({ makeClient, io, baseDelayMs: 10, maxDelayMs: 100 });
    await handle.stop();

    expect(client1.ended).toBe(true);

    client1.emit("error", new Error("après arrêt, ne doit rien déclencher"));
    await vi.advanceTimersByTimeAsync(200);

    expect(makeClient).toHaveBeenCalledTimes(1); // aucune reconnexion post-stop
  });
});
