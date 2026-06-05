/**
 * Résolution nom → ID (snowflake) — règle l'opacité des IDs Discord.
 *
 * ⚠️ Chaque résolution = 1 appel GET puis lecture de l'ID réel, JAMAIS d'ID deviné.
 * (Anti-hallucination : un appel → lire l'ID → l'utiliser. Pas de rafale.)
 */
import { discordCall } from "./client.js";

const norm = (s) => String(s).replace(/^#/, "").trim().toLowerCase();

export async function resolveChannel(guildId, name) {
  const channels = await discordCall("GET", `/guilds/${guildId}/channels`);
  const hit = channels.find((c) => norm(c.name) === norm(name));
  if (!hit) throw new Error(`Salon introuvable : ${name}`);
  return hit.id;
}

export async function resolveRole(guildId, name) {
  const roles = await discordCall("GET", `/guilds/${guildId}/roles`);
  const hit = roles.find((r) => norm(r.name) === norm(name));
  if (!hit) throw new Error(`Rôle introuvable : ${name}`);
  return hit.id;
}

export async function resolveMember(guildId, query) {
  const q = encodeURIComponent(String(query));
  const members = await discordCall("GET", `/guilds/${guildId}/members/search?query=${q}&limit=1`);
  if (!members?.length) throw new Error(`Membre introuvable : ${query}`);
  return members[0].user.id;
}
