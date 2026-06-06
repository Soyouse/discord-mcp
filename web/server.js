/**
 * Entrypoint de l'API web (conteneur `discord-web`). I/O pur → exclu mutation (prouvé par les
 * tests inject de build-app). Lit la config (refuse de booter si invalide), ouvre le repo PG (lecture),
 * construit l'app, écoute.
 * ⚠️ Façade SŒUR : LIT la base relais, n'ouvre PAS de gateway (seul le conteneur discord-relay écrit).
 */
import { createPool, createPgRepository, migrate } from "../relay/pg-repository.js";
import { loadConfig } from "./config.js";
import { buildApp } from "./build-app.js";

const config = loadConfig();
const pool = createPool(config.RELAY_DATABASE_URL);
await migrate(pool); // idempotent — garantit le schéma présent
const repo = createPgRepository(pool);

const app = await buildApp({ repo, config });

const shutdown = async () => {
  try {
    await app.close();
    await pool.end();
  } finally {
    process.exit(0);
  }
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
process.stderr.write(`[web] API sur ${config.WEB_HOST}:${config.WEB_PORT}\n`);
