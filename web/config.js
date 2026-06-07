/**
 * Config de l'API web — VALIDÉE AU DÉMARRAGE (ajv).
 * ⚠️ L'app REFUSE de booter si une variable requise manque/est invalide → jamais d'échec
 *    mystérieux en pleine requête (échec au boot = visible en CI/staging, pas après ship).
 * ⚠️ On valide EXACTEMENT l'objet `data` fourni (ajv direct), PAS via env-schema qui FUSIONNE
 *    process.env (→ tests non isolés : une var d'env présente en CI faussait la validation).
 *    `data` injectable = déterministe et testable.
 */
import Ajv from "ajv";

// Stryker disable all : schéma = métadonnée DÉCLARATIVE (aucun contrat comportemental à muter ;
// la logique testée vit dans loadConfig). Même convention que les inputSchema des outils MCP.
const schema = {
  type: "object",
  required: ["WEB_JWT_SECRET", "RELAY_DATABASE_URL"],
  properties: {
    WEB_HOST: { type: "string", default: "127.0.0.1" },
    WEB_PORT: { type: "number", default: 8080 },
    // ⚠️ Secret JWT : min 32 chars. Un secret faible = signature cassable → refus de booter.
    WEB_JWT_SECRET: { type: "string", minLength: 32 },
    RELAY_DATABASE_URL: { type: "string" }, // base relais (lecture)
    WEB_CORS_ORIGIN: { type: "string", default: "" }, // CSV d'origines front autorisées ('' = aucune)
    WEB_RATE_MAX: { type: "number", default: 100 },
    WEB_RATE_WINDOW_MS: { type: "number", default: 60000 },
    // OAuth Discord (P2b) — OPTIONNELS : l'API lecture/health boote sans ; les routes /api/auth/* ne
    // fonctionnent que si client id/secret/redirect sont fournis (sinon login échoue à l'exécution, pas au boot).
    DISCORD_CLIENT_ID: { type: "string", default: "" },
    DISCORD_CLIENT_SECRET: { type: "string", default: "" },
    DISCORD_OAUTH_REDIRECT_URI: { type: "string", default: "" },
    OAUTH_ALLOWED_USER_IDS: { type: "string", default: "" }, // CSV d'IDs Discord ('' = personne, fail-closed)
    WEB_ACCESS_TTL: { type: "string", default: "15m" }, // durée de vie de l'access JWT (court)
    WEB_REFRESH_TTL_DAYS: { type: "number", default: 30 }, // durée de vie du refresh token (PG)
  },
};
// Stryker restore all

// coerceTypes : env = strings → "8080" devient 8080. useDefaults : applique les défauts.
const ajv = new Ajv({ coerceTypes: true, useDefaults: true, allErrors: true });
const validate = ajv.compile(schema);

/** Valide la config. Throw si invalide. Ne lit JAMAIS process.env implicitement (déterministe). */
export function loadConfig(data = process.env) {
  const cfg = { ...data }; // copie : ajv mute (coercition + défauts), on ne touche pas la source
  if (!validate(cfg)) {
    throw new Error(`config invalide : ${ajv.errorsText(validate.errors)}`);
  }
  return cfg;
}
