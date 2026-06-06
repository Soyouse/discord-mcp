/**
 * Modèle d'ÉVÉNEMENTS temps réel (bus interne relais → API web).
 * ⚠️ PUR (zéro I/O) → testable, MUTÉ. La publication réelle (PG NOTIFY) est dans publish-pg.js (I/O).
 * Un seul canal NOTIFY ; le routage fin (par salon) se fait côté API via la room Socket.IO.
 */

// ⚠️ Nom du canal PG NOTIFY (≤63 chars, ascii). PARTAGÉ avec l'API (web/realtime.js l'importe d'ici).
export const EVENT_CHANNEL = "discord_events";

/**
 * Mappe un dispatch gateway → événement domaine diffusable, ou null si rien à diffuser.
 * ⚠️ Seuls les messages sont diffusés en P3 (le chat). Annuaire/autres = pas d'event (null).
 * channel_id OBLIGATOIRE : c'est la clé de routage vers la room du salon.
 */
export function toEvent(dispatchType, data) {
  if (!data || typeof data.id !== "string" || typeof data.channel_id !== "string") return null;
  switch (dispatchType) {
    case "MESSAGE_CREATE":
      return { type: "message.created", channel_id: data.channel_id, message_id: data.id };
    case "MESSAGE_UPDATE":
      return { type: "message.updated", channel_id: data.channel_id, message_id: data.id };
    case "MESSAGE_DELETE":
      return { type: "message.deleted", channel_id: data.channel_id, message_id: data.id };
    default:
      return null;
  }
}
