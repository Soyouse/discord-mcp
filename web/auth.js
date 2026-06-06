/**
 * Auth — transforme les claims d'un JWT VÉRIFIÉ en principal applicatif, + guard Fastify.
 * ⚠️ claimsToPrincipal = PUR (testable). La vérification crypto du token est faite par @fastify/jwt
 *    (request.jwtVerify) ; ici on ne fait QUE mapper/valider les claims d'un payload déjà vérifié.
 * ⚠️ JWT = access token COURT. Révocation/logout = refresh token en PG (voir PLAN §3), pas ici.
 */
import { DEFAULT_TENANT } from "./tenant.js";

/** Payload JWT vérifié → principal {userId, username, tenantId}. Throw si claims invalides. */
export function claimsToPrincipal(payload) {
  if (!payload || typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("JWT invalide : claim `sub` (utilisateur) manquant");
  }
  return {
    userId: payload.sub,
    username: typeof payload.username === "string" ? payload.username : null,
    // ⚠️ tenant : claim string non vide, sinon tenant par défaut (mono-tenant). Couture SaaS.
    tenantId: typeof payload.tenant === "string" && payload.tenant ? payload.tenant : DEFAULT_TENANT,
  };
}

/**
 * preHandler Fastify : vérifie le Bearer JWT, pose `request.principal`. 401 sinon.
 * ⚠️ request.jwtVerify est décoré par @fastify/jwt (enregistré dans build-app).
 */
export function makeAuthGuard() {
  return async function authGuard(request, reply) {
    try {
      const payload = await request.jwtVerify();
      request.principal = claimsToPrincipal(payload);
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };
}
