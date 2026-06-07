/**
 * Entrypoint de l'API web (conteneur `discord-web`). I/O pur → exclu mutation (prouvé par les
 * tests inject de build-app). Lit la config (refuse de booter si invalide), ouvre le repo PG (lecture),
 * construit l'app, écoute.
 * ⚠️ Façade SŒUR : LIT la base relais, n'ouvre PAS de gateway (seul le conteneur discord-relay écrit).
 */
import pg from "pg";
import { createPool, createPgRepository, migrate } from "../relay/pg-repository.js";
import { loadConfig } from "./config.js";
import { buildApp } from "./build-app.js";
import { attachSocket } from "./socket.js";
import { startPgListener } from "./realtime-bridge.js";
import { ensureRefreshSchema, createPgRefreshStore } from "./refresh-store-pg.js";

const config = loadConfig();
const pool = createPool(config.RELAY_DATABASE_URL);
await migrate(pool); // idempotent — garantit le schéma présent
await ensureRefreshSchema(pool); // idempotent — table refresh_tokens (OAuth)
const repo = createPgRepository(pool);
const refreshStore = createPgRefreshStore(pool);

const app = await buildApp({ repo, config, refreshStore });

// Doit écouter AVANT d'attacher Socket.IO (il a besoin du serveur HTTP réel : app.server).
await app.listen({ host: config.WEB_HOST, port: config.WEB_PORT });

const corsOrigin = config.WEB_CORS_ORIGIN
  ? config.WEB_CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : false;
const io = attachSocket(app.server, { verifyToken: (t) => app.jwt.verify(t), corsOrigin });

// Client PG DÉDIÉ pour LISTEN (connexion longue, hors pool) → diffuse les NOTIFY du relais.
const listenClient = new pg.Client({ connectionString: config.RELAY_DATABASE_URL });
await listenClient.connect();
await startPgListener(listenClient, io);

process.stderr.write(`[web] API + Socket.IO sur ${config.WEB_HOST}:${config.WEB_PORT}\n`);

const shutdown = async () => {
  try {
    await io.close();
    await listenClient.end();
    await app.close();
    await pool.end();
  } finally {
    process.exit(0);
  }
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
