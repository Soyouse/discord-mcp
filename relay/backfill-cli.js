/**
 * CLI backfill one-shot : `node relay/backfill-cli.js <channelId> [<channelId>...]`
 * ⚠️ Adaptateur I/O (REST via discordCall + pool PG) — exclu mutation ; la boucle est dans backfill.js.
 * ⚠️ Job ÉPHÉMÈRE (pas un daemon) : remonte l'historique passé une fois, puis sort. Reprenable (curseurs).
 *    Le rate-limit/429 est géré par @discordjs/rest. upsert idempotent → recouvrement live sans danger.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSecrets, discordCall } from "../lib/core/client.js";
import { createPool, createPgRepository, migrate } from "./pg-repository.js";
import { backfillChannel } from "./backfill.js";

const here = dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH = process.env.DISCORD_SECRETS_PATH || join(here, "..", ".secrets.json");

async function main() {
  const channels = process.argv.slice(2);
  if (!channels.length) {
    process.stderr.write("usage: node relay/backfill-cli.js <channelId> [<channelId>...]\n");
    process.exit(1);
  }
  if (!process.env.RELAY_DATABASE_URL) {
    process.stderr.write("FATAL: RELAY_DATABASE_URL manquant.\n");
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(SECRETS_PATH, "utf8"));
  const { defaultBot: botId } = normalizeSecrets(raw); // bot par défaut = provenance du backfill

  const pool = createPool(process.env.RELAY_DATABASE_URL);
  await migrate(pool);
  const repo = createPgRepository(pool);

  const fetchPage = async ({ channelId, before, limit }) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (before) qs.set("before", before);
    return await discordCall("GET", `/channels/${channelId}/messages?${qs.toString()}`, undefined, { bot: botId });
  };

  for (const channelId of channels) {
    const res = await backfillChannel({ channelId, repo, botId, fetchPage });
    process.stderr.write(`[backfill] ${channelId}: ${res.fetched} messages, complete=${res.complete}\n`);
  }
  await repo.close();
}

main().catch((err) => {
  process.stderr.write(`FATAL backfill: ${err.stack || err.message}\n`);
  process.exit(1);
});
