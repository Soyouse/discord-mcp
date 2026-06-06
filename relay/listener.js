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
import { Client, GatewayDispatchEvents } from "@discordjs/core";
import { INTENTS, handleDispatch } from "./ingest.js";

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
];

/** Démarre le listener d'un bot. @returns {Promise<{gateway:WebSocketManager}>} */
export async function startListener({ token, botId, repo }) {
  const rest = new REST({ version: "10" }).setToken(token);
  const gateway = new WebSocketManager({ token, intents: INTENTS, rest });
  const client = new Client({ rest, gateway });

  for (const ev of ROUTED_EVENTS) {
    client.on(ev, async ({ data }) => {
      try {
        await handleDispatch(ev, data, { repo, botId });
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
