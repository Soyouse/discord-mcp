/**
 * Cœur d'ingestion — route un événement gateway vers le repository.
 * ⚠️ Logique PURE et testable (zéro websocket) : c'est la couture qui se teste sans réseau.
 *    La plomberie @discordjs/ws est dans listener.js (I/O, exclu mutation comme pg-repository).
 * Horloge injectable (`now`) → tests déterministes du timestamp de suppression.
 */
import { GatewayIntentBits } from "@discordjs/core";
import { normalizeMessage } from "./normalize.js";
import { normalizeGuild, normalizeChannel, normalizeMember } from "./normalize-directory.js";

// Intents : Guilds (serveurs/salons) + messages serveur + DM + CONTENU + MEMBRES.
// ⚠️ GuildMembers (privilégié, mur d'approbation à 100 serveurs) = REQUIS pour la liste « qui je peux DM »
//    (annuaire du client web). À activer dans le portail dev du bot (comme MessageContent).
// ⚠️ Moindre privilège conservé : on n'ajoute PAS GuildPresences (statut en ligne — inutile ici).
export const INTENTS =
  GatewayIntentBits.Guilds |
  GatewayIntentBits.GuildMessages |
  GatewayIntentBits.DirectMessages |
  GatewayIntentBits.MessageContent |
  GatewayIntentBits.GuildMembers;

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

    // ── ANNUAIRE (P1) — état COURANT (hard-delete OK, pas d'historique). ──
    // GUILD_CREATE livre le snapshot COMPLET (serveur + salons + membres) à chaque connexion
    // → pas de backfill REST annuaire (redondant). Seam gros serveurs (>~250 membres) = member chunking.
    case "GUILD_CREATE": {
      if (!data?.id) return "skip";
      await repo.upsertGuild(normalizeGuild(data, botId));
      for (const ch of data.channels ?? []) {
        await repo.upsertChannel(normalizeChannel(ch, botId, data.id));
      }
      for (const mem of data.members ?? []) {
        if (!mem?.user?.id) continue; // entrée membre incomplète → on saute, sans casser le batch
        await repo.upsertMember(normalizeMember(mem, botId, data.id));
      }
      return "guild";
    }
    case "GUILD_UPDATE": {
      if (!data?.id) return "skip";
      await repo.upsertGuild(normalizeGuild(data, botId));
      return "guild-update";
    }
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE": {
      if (!data?.id) return "skip";
      await repo.upsertChannel(normalizeChannel(data, botId, data.guild_id));
      return "channel";
    }
    case "CHANNEL_DELETE": {
      if (!data?.id) return "skip";
      await repo.removeChannel(data.id);
      return "channel-remove";
    }
    case "GUILD_MEMBER_ADD":
    case "GUILD_MEMBER_UPDATE": {
      if (!data?.guild_id || !data?.user?.id) return "skip";
      await repo.upsertMember(normalizeMember(data, botId, data.guild_id));
      return "member";
    }
    case "GUILD_MEMBER_REMOVE": {
      if (!data?.guild_id || !data?.user?.id) return "skip";
      await repo.removeMember(data.guild_id, data.user.id);
      return "member-remove";
    }
    // ⚠️ GUILD_DELETE NON géré volontairement : il fire aussi sur panne transitoire (unavailable=true)
    //    → purger serveur/salons/membres risquerait d'effacer sur un simple hoquet réseau. À raffiner plus tard.

    default:
      return "ignore";
  }
}
