/**
 * Outil `discord_history` — historique d'un salon depuis la base du relais (ZÉRO appel REST).
 * ⚠️ Lit la base discord_relay (alimentée par le conteneur discord-relay). Logique testée dans relay/query.js.
 */
import { getReadRepo } from "../lib/relay-read.js";
import { runHistory } from "../relay/query.js";

// Stryker disable all : métadonnée déclarative (description/schema) — aucun contrat comportemental.
export const tool = {
  name: "discord_history",
  description:
    "Historique des messages d'un salon, le plus récent d'abord, depuis la base du relais (aucun appel " +
    "API Discord). Pagination par curseurs ISO before/after. Nécessite le relais (RELAY_DATABASE_URL).",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: { type: "string", description: "Snowflake du salon" },
      limit: { type: "number", description: "Défaut 50, max 200" },
      before: { type: "string", description: "ISO 8601 — messages avant cette date" },
      after: { type: "string", description: "ISO 8601 — messages après cette date" },
    },
    required: ["channel_id"],
  },
  // Stryker restore all
  async handle(args) {
    const repo = getReadRepo();
    if (!repo) {
      return JSON.stringify({ error: "relais non configuré (RELAY_DATABASE_URL absent)" });
    }
    return JSON.stringify(await runHistory(repo, args), null, 2);
  },
};
