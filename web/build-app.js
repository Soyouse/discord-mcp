/**
 * Construction de l'app Fastify — PARTAGÉE (entrypoint réel ET tests via app.inject(), zéro réseau).
 * ⚠️ Façade SŒUR du MCP : réutilise le repository relais (lecture). N'ouvre PAS de gateway.
 * ⚠️ Ordre des plugins volontaire : sécurité (helmet/cors/rate-limit/jwt) AVANT les routes.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { makeAuthGuard } from "./auth.js";
import { readRoutes } from "./routes-read.js";
import { actionRoutes } from "./routes-action.js";
import { discordCall as realDiscordCall } from "../lib/core/client.js";

// ⚠️ `discordCall` injectable : défaut = lib/core réel (REST Discord) ; les tests passent un fake
//    (zéro réseau). C'est la SEULE porte d'écriture de l'API — elle AGIT via lib/core, jamais de gateway.
export async function buildApp({ repo, config, discordCall = realDiscordCall }) {
  const app = Fastify({ logger: false });

  await app.register(helmet);
  await app.register(cors, {
    // origines front autorisées (CSV) ; '' → aucune cross-origin (défaut sûr).
    origin: config.WEB_CORS_ORIGIN
      ? config.WEB_CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : false,
    credentials: true,
  });
  // ⚠️ Store rate-limit = MÉMOIRE (1 instance). >1 pod → option `redis` (ioredis, atomique) — PLAN §9.
  await app.register(rateLimit, {
    max: config.WEB_RATE_MAX,
    timeWindow: config.WEB_RATE_WINDOW_MS,
  });
  await app.register(jwt, { secret: config.WEB_JWT_SECRET });

  // Healthcheck PUBLIC (LB / uptime) — pas d'auth.
  app.get("/api/health", async () => ({ ok: true }));

  // Routes protégées : guard JWT en preHandler sur un contexte encapsulé.
  const guard = makeAuthGuard();
  await app.register(async (scoped) => {
    scoped.addHook("preHandler", guard);
    await scoped.register(readRoutes(repo));
    await scoped.register(actionRoutes({ discordCall }));
  });

  // Erreurs : statusCode explicite (400 validation) sinon 500. Pas de fuite de stack.
  app.setErrorHandler((err, _req, reply) => {
    const code = err.statusCode ?? 500;
    reply.code(code).send({ error: err.message || "internal error" });
  });

  return app;
}
