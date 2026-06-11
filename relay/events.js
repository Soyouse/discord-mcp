/**
 * Modèle d'ÉVÉNEMENTS temps réel (bus interne relais → API web).
 * ⚠️ PUR (zéro I/O) → testable, MUTÉ. La publication réelle (PG NOTIFY) est dans publish-pg.js (I/O).
 * Un seul canal NOTIFY ; le routage fin (par salon) se fait côté API via la room Socket.IO.
 */

// ⚠️ Nom du canal PG NOTIFY (≤63 chars, ascii). PARTAGÉ avec l'API (web/realtime.js l'importe d'ici).
export const EVENT_CHANNEL = "discord_events";

import { snowflakeToDate } from "./normalize.js";

// Projection PUBLIQUE du message porté par l'event.
// ⚠️ MÊME SHAPE que formatRow (relay/query.js) — l'historique GET et l'event alimentent le MÊME cache
//    front (upsert par message_id) : clé `author` (PAS author_username), dates ISO strings. Parité
//    SCELLÉE par test (relay-events.test.js) — un drift de shape ici = messages dégradés à l'écran.
// ⚠️ L'event DOIT porter le message complet : un event squelette upserté côté front ÉCRASE le message
//    affiché (perte content/author — vécu en lecture de code, 2026-06-11).
// Discord émet "…272000+00:00" (microsecondes + offset) ; formatRow émet ISO-Z → on normalise pareil.
function iso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function publicMessage(data) {
  const author = data.author || {};
  return {
    message_id: data.id,
    channel_id: data.channel_id,
    guild_id: data.guild_id ?? null,
    author_id: author.id ?? null,
    author: author.username ?? null,
    content: data.content ?? null,
    created_at: iso(data.timestamp) ?? snowflakeToDate(data.id).toISOString(),
    edited_at: iso(data.edited_timestamp),
  };
}

/**
 * Mappe un dispatch gateway → événement domaine diffusable, ou null si rien à diffuser.
 * ⚠️ Seuls les messages sont diffusés en P3 (le chat). Annuaire/autres = pas d'event (null).
 * channel_id OBLIGATOIRE : c'est la clé de routage vers la room du salon.
 * created/updated portent `message` (payload complet) ; deleted = minimal (l'id suffit à retirer).
 */
export function toEvent(dispatchType, data) {
  if (!data || typeof data.id !== "string" || typeof data.channel_id !== "string") return null;
  switch (dispatchType) {
    case "MESSAGE_CREATE":
      return { type: "message.created", channel_id: data.channel_id, message_id: data.id, message: publicMessage(data) };
    case "MESSAGE_UPDATE":
      return { type: "message.updated", channel_id: data.channel_id, message_id: data.id, message: publicMessage(data) };
    case "MESSAGE_DELETE":
      return { type: "message.deleted", channel_id: data.channel_id, message_id: data.id };
    default:
      return null;
  }
}

// ⚠️ pg_notify plafonne le payload à ~8000 octets : au-delà, l'envoi THROW et l'event est perdu.
//    Garde PURE appliquée par publish-pg : event trop gros → version minimale SANS `message`
//    (le front détecte l'absence de `message` et refetch l'historique — dégradation, jamais une perte).
export const MAX_NOTIFY_BYTES = 7500;
export function capEventSize(event, max = MAX_NOTIFY_BYTES) {
  if (!event) return event;
  if (JSON.stringify(event).length <= max) return event;
  const { type, channel_id, message_id } = event;
  return { type, channel_id, message_id };
}
