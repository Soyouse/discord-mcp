/**
 * COUTURE SaaS multi-tenant — un seul tenant aujourd'hui (constante), demain peuplé depuis le JWT.
 * ⚠️ Toute lecture/écriture scopée passe par ici. NE JAMAIS éparpiller la constante en dur ailleurs.
 */
export const DEFAULT_TENANT = "default";

/**
 * Résout le tenant d'une requête à partir du principal (claims JWT).
 * Mono-tenant : claim `tenantId` s'il existe, sinon la constante.
 * ⚠️ Multi-tenant futur : exiger le claim (pas de fallback silencieux qui mélangerait les tenants).
 */
export function resolveTenant(principal) {
  return principal?.tenantId || DEFAULT_TENANT;
}
