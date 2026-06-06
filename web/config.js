/**
 * Config de l'API web — VALIDÉE AU DÉMARRAGE (env-schema/ajv).
 * ⚠️ L'app REFUSE de booter si une variable requise manque/est invalide → jamais d'échec
 *    mystérieux en pleine requête (échec au boot = visible en CI/staging, pas après ship).
 * ⚠️ `data` injectable → testable sans toucher process.env.
 */
import envSchema from "env-schema";

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
  },
};

/** Charge + valide la config. Throw si invalide. `dotenv:false` → l'env vient du conteneur. */
export function loadConfig(data = process.env) {
  return envSchema({ schema, data, dotenv: false });
}
