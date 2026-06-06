/**
 * Côté API web : transforme une notification du bus (PG NOTIFY) → instruction d'émission Socket.IO.
 * ⚠️ PUR (zéro I/O) → testable, MUTÉ. L'écoute PG + le serveur Socket.IO (I/O) = P3b (build-app).
 * ⚠️ EVENT_CHANNEL importé du relais = source unique (le canal doit matcher des 2 côtés du bridge).
 */
import { EVENT_CHANNEL } from "../relay/events.js";

export { EVENT_CHANNEL };

/** Payload string d'un NOTIFY → événement domaine, ou null si JSON invalide / champs manquants. */
export function parseNotification(payload) {
  let ev;
  try {
    ev = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!ev || typeof ev.type !== "string" || typeof ev.channel_id !== "string") return null;
  return ev;
}

/**
 * Événement domaine → instruction Socket.IO {room, name, data}.
 * Routage par SALON : une room `channel:<id>` → seuls les clients qui regardent ce salon reçoivent.
 */
export function eventToEmit(event) {
  if (!event || typeof event.channel_id !== "string") return null;
  return { room: `channel:${event.channel_id}`, name: event.type, data: event };
}
