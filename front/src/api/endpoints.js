/*
 * Endpoints typés de l'API web — une fonction par route. Mappe 1:1 routes-read.js / routes-action.js.
 * ⚠️ Lecture = GET ; action = POST. Pas de logique ici : juste la forme d'URL + le verbe.
 */
import { apiFetch } from "./http.js";

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};

// Lecture
export const listGuilds = () => apiFetch("/api/guilds");
export const listChannels = (guildId) => apiFetch(`/api/guilds/${guildId}/channels`);
export const listDMables = () => apiFetch("/api/dmables");
export const getHistory = (channelId, params = {}) =>
  apiFetch(`/api/channels/${channelId}/history${qs(params)}`);
export const search = (params = {}) => apiFetch(`/api/search${qs(params)}`);

// Action (P4)
export const sendMessage = (channelId, content, bot) =>
  apiFetch(`/api/channels/${channelId}/messages`, { method: "POST", body: { content, bot } });
export const openDM = (recipientId, bot) =>
  apiFetch("/api/dms", { method: "POST", body: { recipientId, bot } });
export const sendDM = (recipientId, content, bot) =>
  apiFetch(`/api/dms/${recipientId}/messages`, { method: "POST", body: { content, bot } });
