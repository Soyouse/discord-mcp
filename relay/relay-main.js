/**
 * Entrypoint du conteneur `discord-relay` (daemon d'ingestion 24/7).
 * ⚠️ CONTENEUR SÉPARÉ du MCP (doctrine Docker « 1 concern/conteneur ») : ce process N'EXPOSE rien,
 *    il ÉCRIT seulement dans Postgres depuis les gateways. Le MCP (autre conteneur) LIT la base.
 * ⚠️ 1 SEUL process multiplexant N bots → écritures en série → zéro concurrence d'écriture.
 * Couplage avec le MCP = UNIQUEMENT la base discord_relay. Aucun IPC.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSecrets } from "../lib/core/client.js";
import { createPool, createPgRepository, migrate } from "./pg-repository.js";
import { startListener } from "./listener.js";
import { makePgPublisher } from "./publish-pg.js";

const here = dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH = process.env.DISCORD_SECRETS_PATH || join(here, "..", ".secrets.json");
const DATABASE_URL = process.env.RELAY_DATABASE_URL;

async function main() {
  if (!DATABASE_URL) {
    process.stderr.write("FATAL: RELAY_DATABASE_URL manquant — refus de démarrer sans base.\n");
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(SECRETS_PATH, "utf8"));
  const { bots } = normalizeSecrets(raw);

  const pool = createPool(DATABASE_URL);
  await migrate(pool); // schéma idempotent
  const repo = createPgRepository(pool);
  // Bus temps réel : NOTIFY sur la même base (bridge interne vers l'API web). Seam → Redis/NATS plus tard.
  const publish = makePgPublisher(pool);

  const listeners = [];
  for (const [botId, { token }] of Object.entries(bots)) {
    listeners.push(await startListener({ token, botId, repo, publish }));
  }
  process.stderr.write(`[relay] ${listeners.length} bot(s) en écoute → discord_relay\n`);

  // Arrêt propre : ferme les gateways puis le pool.
  const shutdown = async (sig) => {
    process.stderr.write(`[relay] ${sig} — arrêt propre…\n`);
    for (const l of listeners) {
      try { await l.gateway.destroy(); } catch {}
    }
    await repo.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  process.stderr.write(`FATAL relay: ${err.stack || err.message}\n`);
  process.exit(1);
});
