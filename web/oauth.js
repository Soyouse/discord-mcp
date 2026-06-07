/**
 * OAuth2 Discord — helpers PURS (zéro I/O → mutation-testables).
 * ⚠️ La logique déterministe (URL d'autorisation, allowlist, mapping user, parse CSV) vit ICI ;
 *    les appels réseau (échange de code, /users/@me) sont des deps INJECTÉES dans oauth-service.js.
 *    Même doctrine que action-service (discordCall injecté) : on ne cache jamais de logique dans l'I/O.
 * ⚠️ Scope = `identify` SEUL : on a besoin de l'id + username pour l'allowlist et le principal.
 *    L'annuaire (serveurs/membres) vient déjà du relais — JAMAIS via l'OAuth utilisateur.
 */

const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";

/** Construit l'URL d'autorisation Discord (redirige l'utilisateur vers Discord). PUR. */
export function buildAuthorizeUrl({ clientId, redirectUri, state, scope = "identify" }) {
  if (!clientId) throw new Error("buildAuthorizeUrl: clientId requis");
  if (!redirectUri) throw new Error("buildAuthorizeUrl: redirectUri requis");
  if (!state) throw new Error("buildAuthorizeUrl: state requis (anti-CSRF)");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    state,
    redirect_uri: redirectUri,
    // prompt=none : pas de ré-autorisation si déjà accordé (UX) ; Discord redemande si scope change.
    prompt: "none",
  });
  return `${DISCORD_AUTHORIZE}?${q.toString()}`;
}

/** CSV d'IDs autorisés → tableau nettoyé. PUR. `""`/undefined → []. */
export function parseAllowedIds(csv) {
  if (typeof csv !== "string") return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Allowlist : l'utilisateur a-t-il le droit de se connecter ? PUR.
 * ⚠️ Liste VIDE = personne (refus par défaut), JAMAIS "tout le monde" (fail-closed sécurité).
 */
export function isAllowed(userId, allowedIds) {
  if (!userId || !Array.isArray(allowedIds) || allowedIds.length === 0) return false;
  return allowedIds.includes(userId);
}

/** user Discord (/users/@me) → principal applicatif. PUR. Throw si id absent. */
export function discordUserToPrincipal(user) {
  if (!user || typeof user.id !== "string" || !user.id) {
    throw new Error("réponse Discord invalide : id utilisateur manquant");
  }
  return {
    userId: user.id,
    // global_name (nouveau pseudo) sinon username (legacy). Jamais null silencieux côté affichage.
    username: (typeof user.global_name === "string" && user.global_name) || (typeof user.username === "string" ? user.username : null),
  };
}
