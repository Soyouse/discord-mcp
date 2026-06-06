/**
 * Publication d'événements sur le bus interne = PG NOTIFY (bridge relais → API web).
 * ⚠️ I/O pur → EXCLU mutation (la LOGIQUE de l'event est dans events.js, testée hors réseau).
 * ⚠️ Couche d'abstraction = SEAM : remplaçable par Redis/NATS plus tard sans toucher l'ingestion
 *    (le relais appelle juste publish(event)). Voir relay/SCALING.md.
 * pg_notify : payload < 8000 octets — nos events = quelques ids, largement OK.
 */
import { EVENT_CHANNEL } from "./events.js";

export function makePgPublisher(pool) {
  return async function publish(event) {
    if (!event) return;
    await pool.query("SELECT pg_notify($1, $2)", [EVENT_CHANNEL, JSON.stringify(event)]);
  };
}
