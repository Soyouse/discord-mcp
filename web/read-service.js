/**
 * Service de LECTURE de l'API web — logique PURE, prend un `repo` → testable contre le repo mémoire
 * (même contrat que PG). Réutilise relay/query.js (history/search) : un seul chemin de lecture.
 * ⚠️ Formatte = expose les champs PUBLICS uniquement (jamais bot_id/tenant_id/updated_at internes).
 * ⚠️ Erreurs d'entrée = statusCode 400 (badRequest) → l'API répond 400, pas 500.
 */
import { runHistory, runSearch } from "../relay/query.js";

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

// ⚠️ Projection PUBLIQUE — les lignes sont déjà normalisées (champs absents = null garanti par
//    normalize-directory.js / le schéma PG), donc projection simple : on n'expose que ces clés,
//    jamais bot_id/tenant_id/updated_at internes. Pas de `?? null` redondant.
const formatGuild = (g) => ({ guild_id: g.guild_id, name: g.name, icon: g.icon });
const formatChannel = (c) => ({
  channel_id: c.channel_id,
  guild_id: c.guild_id,
  type: c.type,
  name: c.name,
  position: c.position,
});
const formatDMable = (m) => ({
  user_id: m.user_id,
  username: m.username,
  global_name: m.global_name,
  avatar: m.avatar,
});

export async function listGuilds(repo, { tenantId } = {}) {
  return (await repo.listGuilds({ tenantId })).map(formatGuild);
}

export async function listChannels(repo, { guildId, tenantId } = {}) {
  if (!guildId) throw badRequest("guildId requis");
  return (await repo.listChannels({ guildId, tenantId })).map(formatChannel);
}

export async function listDMables(repo, { tenantId } = {}) {
  return (await repo.listDMables({ tenantId })).map(formatDMable);
}

// history : channel_id obligatoire (vient du path). runHistory formatte déjà (sans raw/tsv).
export async function history(repo, args = {}) {
  if (!args.channel_id) throw badRequest("channel_id requis");
  return runHistory(repo, args);
}

// search : q obligatoire. ⚠️ messages PAS encore scopés tenant (table messages sans tenant_id) →
//          seam multi-tenant futur (ajouter tenant_id aux messages). Mono-tenant : OK.
export async function search(repo, args = {}) {
  if (!args.query || !String(args.query).trim()) throw badRequest("paramètre q requis");
  return runSearch(repo, args);
}
