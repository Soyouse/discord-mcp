/**
 * Accès LECTURE à la base du relais pour les outils MCP (discord_history/discord_search).
 * ⚠️ Lazy singleton : pool PG créé au 1er usage, seulement si RELAY_DATABASE_URL est défini.
 *    Sans relais configuré → null (les outils répondent proprement « relais non configuré »).
 * ⚠️ Le MCP ne fait que LIRE ici. L'écriture appartient au conteneur discord-relay (séparation stricte).
 */
import { createPool, createPgRepository } from "../relay/pg-repository.js";

let repo = null;

export function getReadRepo() {
  const url = process.env.RELAY_DATABASE_URL;
  if (!url) return null;
  if (!repo) repo = createPgRepository(createPool(url));
  return repo;
}

// tests uniquement
export function _resetReadRepo() {
  repo = null;
}
