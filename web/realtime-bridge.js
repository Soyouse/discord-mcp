/**
 * Boucle PG LISTEN → Socket.IO : reçoit les NOTIFY du relais, diffuse aux clients du salon.
 * ⚠️ I/O → exclu mutation. La logique pure (parse + event→room) est dans realtime.js, testée.
 * ⚠️ `client` = un client PG DÉDIÉ et long-vécu (pas du pool : une connexion LISTEN reste ouverte).
 * EVENT_CHANNEL = constante interne (ascii, pas d'injection) → interpolable dans LISTEN.
 *
 * 🔴 INCIDENT 2026-07-09 : ce client n'avait AUCUN handler d'erreur → toute coupure Postgres
 *    (restart, maintenance, OOM) levait une exception non interceptée → process tué → boucle de
 *    plantage avec restart auto → 4 conteneurs bloqués en restart:no pendant 7 semaines.
 * ⚠️ NE JAMAIS recréer un `new pg.Client(...)` nu pour LISTEN sans passer par
 *    `createResilientListener` : node-postgres EXIGE un handler d'erreur explicite sur toute
 *    connexion dédiée, sans quoi une coupure tue le process (doc node-postgres).
 */
import { parseNotification, eventToEmit, EVENT_CHANNEL } from "./realtime.js";

/** @deprecated conservé pour compat/tests unitaires purs — la voie de service = createResilientListener. */
export async function startPgListener(client, io) {
  client.on("notification", (msg) => {
    const event = parseNotification(msg.payload);
    const emit = eventToEmit(event);
    if (emit) io.to(emit.room).emit(emit.name, emit.data);
  });
  await client.query(`LISTEN ${EVENT_CHANNEL}`);
}

const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000; // plafond déclaré — jamais d'attente illimitée

/**
 * Connexion LISTEN RÉSILIENTE : reconnecte sur toute erreur/coupure, avec backoff exponentiel
 * BORNÉ (jamais un délai illimité — plafond déclaré via maxDelayMs). Re-émet LISTEN à chaque
 * reconnexion (une nouvelle connexion PG ne porte aucun abonnement hérité). Crie (log) à chaque
 * tentative — jamais un échec avalé en silence.
 * @param {object} deps
 * @param {() => object} deps.makeClient - factory du client PG (duck-typed: on/connect/query/end) — testable.
 * @param {{to:(room:string)=>{emit:Function}}} deps.io
 * @param {number} [deps.baseDelayMs] - délai de la 1ère retry.
 * @param {number} [deps.maxDelayMs] - plafond du backoff exponentiel.
 * @param {(msg:string)=>void} [deps.log]
 * @returns {Promise<{stop: () => Promise<void>}>}
 */
export async function createResilientListener({
  makeClient,
  io,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  log = (msg) => process.stderr.write(`[realtime-bridge] ${msg}\n`),
}) {
  let stopped = false;
  let attempt = 0;
  let current = null;
  let timer = null;

  const wire = (client) => {
    // ⚠️ 'error' est le SEUL contrat node-postgres pour une coupure sur une connexion dédiée hors
    //    pool. Sans ce handler, l'erreur remonte non interceptée et tue le process (incident source).
    client.on("error", (err) => {
      log(`connexion LISTEN perdue (${err.message}) — reconnexion planifiée`);
      scheduleReconnect();
    });
    client.on("notification", (msg) => {
      const event = parseNotification(msg.payload);
      const emit = eventToEmit(event);
      if (emit) io.to(emit.room).emit(emit.name, emit.data);
    });
  };

  const connect = async () => {
    if (stopped) return;
    const client = makeClient();
    current = client;
    wire(client);
    try {
      await client.connect();
      await client.query(`LISTEN ${EVENT_CHANNEL}`);
      if (attempt > 0) log(`connexion LISTEN rétablie après ${attempt} tentative(s)`);
      attempt = 0; // succès → réinitialise le backoff
    } catch (err) {
      log(`échec de connexion LISTEN (${err.message})`);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (stopped || timer) return; // évite une double-planification (plusieurs 'error' peuvent fire)
    attempt += 1;
    const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
    log(`nouvelle tentative de connexion LISTEN dans ${delay}ms (essai ${attempt})`);
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, delay);
  };

  await connect();

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (current) {
        try {
          await current.end();
        } catch {
          // déjà déconnecté — rien à faire
        }
      }
    },
  };
}
