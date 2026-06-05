/**
 * Cœur d'ingestion — route un événement gateway vers le repository.
 * ⚠️ Logique PURE et testable (zéro websocket) : c'est la couture qui se teste sans réseau.
 *    La plomberie @discordjs/ws est dans listener.js (I/O, exclu mutation comme pg-repository).
 * Horloge injectable (`now`) → tests déterministes du timestamp de suppression.
 */
import { GatewayIntentBits } from "@discordjs/core";
import { normalizeMessage } from "./normalize.js";

// Intents minimaux : Guilds (catalogue salons) + messages serveur + DM + CONTENU (privilégié).
// ⚠️ Moindre privilège : on n'ajoute PAS Presence/GuildMembers (inutiles, mur d'approbation à 100 serveurs).
export const INTENTS =
  GatewayIntentBits.Guilds |
  GatewayIntentBits.GuildMessages |
  GatewayIntentBits.DirectMessages |
  GatewayIntentBits.MessageContent;

/**
 * @param {string} type  type de dispatch ("MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE")
 * @param {object} data  payload `d` de l'événement
 * @param {{repo:object, botId:string, now?:()=>Date}} ctx
 * @returns {Promise<"upsert"|"delete"|"skip"|"ignore">}  ce qui a été fait (observabilité/tests)
 */
export async function handleDispatch(type, data, { repo, botId, now = () => new Date() }) {
  switch (type) {
    case "MESSAGE_CREATE":
    case "MESSAGE_UPDATE": {
      // MESSAGE_UPDATE peut être PARTIEL (ex: unfurl de lien → ni author ni content) : on saute proprement.
      if (!data || !data.id || !data.channel_id || !data.author?.id) return "skip";
      await repo.upsertMessage(normalizeMessage(data, botId));
      return "upsert";
    }
    case "MESSAGE_DELETE": {
      if (!data?.id) return "skip";
      await repo.markDeleted(data.id, now()); // soft-delete : on garde l'historique
      return "delete";
    }
    default:
      return "ignore";
  }
}
