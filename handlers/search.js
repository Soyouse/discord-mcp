/**
 * Outil `discord_search` — recherche full-text dans l'historique du relais (ZÉRO appel REST).
 * ⚠️ FTS Postgres (tsvector). Logique + validation testées dans relay/query.js.
 */
import { getReadRepo } from "../lib/relay-read.js";
import { runSearch } from "../relay/query.js";

// Stryker disable all : métadonnée déclarative (description/schema) — aucun contrat comportemental.
export const tool = {
  name: "discord_search",
  description:
    "Recherche full-text dans tout l'historique stocké par le relais (aucun appel API Discord). " +
    "Filtres optionnels guild_id/channel_id/author_id. Nécessite le relais (RELAY_DATABASE_URL).",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Termes recherchés (full-text)" },
      guild_id: { type: "string", description: "Restreindre à un serveur" },
      channel_id: { type: "string", description: "Restreindre à un salon" },
      author_id: { type: "string", description: "Restreindre à un auteur" },
      limit: { type: "number", description: "Défaut 25, max 200" },
    },
    required: ["query"],
  },
  // Stryker restore all
  async handle(args) {
    const repo = getReadRepo();
    if (!repo) {
      return JSON.stringify({ error: "relais non configuré (RELAY_DATABASE_URL absent)" });
    }
    return JSON.stringify(await runSearch(repo, args), null, 2);
  },
};
