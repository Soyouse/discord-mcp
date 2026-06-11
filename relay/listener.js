/**
 * Plomberie gateway @discordjs/ws — ouvre 1 connexion websocket pour UN bot et route les
 * dispatches messages vers handleDispatch (relay/ingest.js).
 * ⚠️ I/O pur (websocket) — exclu de la mutation : prouvé par le listener réel au déploiement,
 *    la LOGIQUE (quoi faire de chaque event) est dans ingest.js, testée à 100% hors réseau.
 * ⚠️ 1 REST + 1 WebSocketManager PAR bot (rate-limit @discordjs/rest = par-token). Jamais partagé.
 * ⚠️ NE PAS réinventer reconnect/resume/heartbeat : @discordjs/ws le gère (battle-tested).
 */
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { Client, GatewayDispatchEvents, GatewayOpcodes } from "@discordjs/core";
import { INTENTS, handleDispatch } from "./ingest.js";
import { enrichProfiles } from "./enrich-profiles.js";
import { toEvent } from "./events.js";

// ⚠️ Chaque valeur GatewayDispatchEvents.X = la string du dispatch ("MESSAGE_CREATE", "GUILD_CREATE"…)
//    → matche directement le switch de handleDispatch. Messages (historique) + annuaire (serveurs/membres).
const ROUTED_EVENTS = [
  GatewayDispatchEvents.MessageCreate,
  GatewayDispatchEvents.MessageUpdate,
  GatewayDispatchEvents.MessageDelete,
  GatewayDispatchEvents.GuildCreate,
  GatewayDispatchEvents.GuildUpdate,
  GatewayDispatchEvents.ChannelCreate,
  GatewayDispatchEvents.ChannelUpdate,
  GatewayDispatchEvents.ChannelDelete,
  GatewayDispatchEvents.GuildMemberAdd,
  GatewayDispatchEvents.GuildMemberUpdate,
  GatewayDispatchEvents.GuildMemberRemove,
  GatewayDispatchEvents.GuildMembersChunk,
];

/**
 * Démarre le listener d'un bot. @returns {Promise<{gateway:WebSocketManager}>}
 * @param publish - publie un événement temps réel après une écriture (défaut noop → ingestion seule).
 */
export async function startListener({ token, botId, repo, publish = async () => {} }) {
  const rest = new REST({ version: "10" }).setToken(token);
  const gateway = new WebSocketManager({ token, intents: INTENTS, rest });
  const client = new Client({ rest, gateway });

  for (const ev of ROUTED_EVENTS) {
    client.on(ev, async ({ data, shardId }) => {
      try {
        const action = await handleDispatch(ev, data, { repo, botId });
        // ⚠️ SANS GuildPresences, GUILD_CREATE.members = le bot seul → la liste complète DOIT être
        //    demandée (op 8, query:"" limit:0) → réponse en GUILD_MEMBERS_CHUNK (ingéré par handleDispatch).
        //    Sans cet envoi, l'annuaire « qui je peux DM » reste vide (vécu en prod 2026-06-11).
        if (action === "guild") {
          await gateway.send(shardId, {
            op: GatewayOpcodes.RequestGuildMembers,
            d: { guild_id: data.id, query: "", limit: 0 },
          });
        }
        // Enrichissement PROFIL (banner/flags/tag — absents du chunk) : REST en série, garde 24h
        // intégrée (re-chunk gateway ≠ re-REST). Un échec ne tue ni le listener ni les autres users.
        if (action === "members-chunk" || action === "member") {
          const r = await enrichProfiles({
            repo,
            fetchUser: (id) => rest.get(`/users/${id}`),
            log: (m) => process.stderr.write(`[relay:${botId}] ${m}\n`),
          });
          if (r.total) process.stderr.write(`[relay:${botId}] profils: ${r.synced}/${r.total} synchronisés\n`);
        }
        // Diffusion temps réel APRÈS une écriture réussie (message créé/édité/supprimé).
        if (action === "upsert" || action === "delete") {
          const event = toEvent(ev, data);
          if (event) await publish(event);
        }
      } catch (err) {
        // Un message qui plante NE DOIT PAS tuer le listener : on log, on continue.
        process.stderr.write(`[relay:${botId}] ${ev} échec: ${err.message}\n`);
      }
    });
  }

  await gateway.connect();
  process.stderr.write(`[relay:${botId}] gateway connecté (intents=${INTENTS})\n`);
  return { gateway };
}
