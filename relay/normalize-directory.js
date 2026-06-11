/**
 * Normalisation des entités ANNUAIRE (serveurs / salons / membres) — payload Discord → ligne repo.
 * ⚠️ PUR (zéro réseau) → testable hors base, MUTÉ par Stryker. Même rôle que normalize.js (messages).
 * ⚠️ Strict : throw plutôt que d'écrire une ligne invalide (un id manquant = bug en amont, pas un null
 *    silencieux). Mêmes garde-fous que normalizeMessage.
 */

// ⚠️ COUTURE SaaS : tenant unique en mono-tenant. NE JAMAIS éparpiller la constante en dur ailleurs —
//    toute écriture passe par ces normaliseurs. Multi-tenant = remplacer la source de cette valeur.
export const DEFAULT_TENANT = "default";

/** GUILD payload (gateway GUILD_CREATE ou REST /users/@me/guilds) → ligne guilds. */
export function normalizeGuild(raw, botId) {
  if (!botId) throw new Error("normalizeGuild: botId requis (provenance)");
  if (!raw || typeof raw.id !== "string") throw new Error("normalizeGuild: id (snowflake) manquant");
  return {
    guild_id: raw.id,
    name: raw.name ?? null,
    icon: raw.icon ?? null,
    bot_id: botId,
    tenant_id: DEFAULT_TENANT,
  };
}

/**
 * CHANNEL payload → ligne channels.
 * ⚠️ Comme pour les messages, le payload REST d'un salon n'inclut PAS toujours guild_id → on l'injecte
 *    depuis le contexte (guildId du GUILD_CREATE). Une valeur présente dans le payload prime.
 */
export function normalizeChannel(raw, botId, guildId) {
  if (!botId) throw new Error("normalizeChannel: botId requis");
  if (!raw || typeof raw.id !== "string") throw new Error("normalizeChannel: id (snowflake) manquant");
  return {
    channel_id: raw.id,
    guild_id: raw.guild_id ?? guildId ?? null, // NULL = DM
    type: typeof raw.type === "number" ? raw.type : null,
    name: raw.name ?? null,
    position: typeof raw.position === "number" ? raw.position : null,
    bot_id: botId,
    tenant_id: DEFAULT_TENANT,
  };
}

/**
 * MEMBER payload (a une sous-clé `user`) → ligne members.
 * ⚠️ guildId OBLIGATOIRE : un membre n'a de sens que rattaché à un serveur (PK = guild_id + user_id).
 */
/**
 * USER payload REST (GET /users/{id}) → champs PROFIL global (enrich-profiles.js).
 * ⚠️ Le gateway member-chunk ne donne PAS banner/primary_guild → ces champs viennent du REST SEUL.
 * primary_guild absent/désactivé → tag null (l'utilisateur a masqué son tag, on respecte).
 */
export function normalizeUserProfile(raw) {
  if (!raw || typeof raw.id !== "string") throw new Error("normalizeUserProfile: id manquant");
  const pg = raw.primary_guild && raw.primary_guild.identity_enabled ? raw.primary_guild : null;
  return {
    user_id: raw.id,
    public_flags: typeof raw.public_flags === "number" ? raw.public_flags : null,
    banner: raw.banner ?? null,
    accent_color: typeof raw.accent_color === "number" ? raw.accent_color : null,
    tag: pg?.tag ?? null,
    tag_badge: pg?.badge ?? null,
    tag_guild_id: pg?.identity_guild_id ?? null,
  };
}

export function normalizeMember(raw, botId, guildId) {
  if (!botId) throw new Error("normalizeMember: botId requis");
  if (!guildId) throw new Error("normalizeMember: guildId requis (clé de rattachement)");
  const u = raw?.user;
  if (!u || typeof u.id !== "string") throw new Error("normalizeMember: user.id manquant");
  return {
    guild_id: guildId,
    user_id: u.id,
    username: u.username ?? null,
    global_name: u.global_name ?? null,
    avatar: u.avatar ?? null,
    is_bot: u.bot === true, // ⚠️ strictement true → exclusion fiable des bots de la liste DMable
    bot_id: botId,
    tenant_id: DEFAULT_TENANT,
  };
}
