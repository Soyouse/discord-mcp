/**
 * Le Pool créé par createPool() DOIT porter un handler d'erreur.
 * ⚠️ node-postgres (doc officielle) : un Pool sans listener 'error' fait planter le process
 * Node dès qu'un client IDLE du pool tombe en erreur réseau (coupure/restart Postgres) — le
 * MÊME défaut que le listenClient dédié (incident 2026-07-09), et il touche à la fois
 * discord-web (server.js) ET discord-relay (relay-main.js) qui partagent createPool().
 * Test = contrat EventEmitter : émettre 'error' sur un Pool SANS listener additionnel lève
 * une exception non interceptée (comportement Node natif) → reproduit le crash avant fix.
 */
import { describe, it, expect } from "vitest";
import { createPool } from "../relay/pg-repository.js";

describe("createPool — résilience", () => {
  it("porte un handler d'erreur (une coupure PG ne tue jamais le process)", async () => {
    const pool = createPool("postgres://user:pass@localhost:5432/discord_relay_test");
    try {
      expect(pool.listenerCount("error")).toBeGreaterThan(0);
      // Preuve directe : émettre 'error' ne doit PAS lever (un EventEmitter sans listener
      // 'error' relève l'exception de façon synchrone — c'est exactement ce qui tuait le process).
      expect(() => pool.emit("error", new Error("connexion PG coupée (simulée)"))).not.toThrow();
    } finally {
      await pool.end();
    }
  });
});
