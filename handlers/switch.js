/**
 * Outil `discord_switch_bot` — multiplexeur multi-bot (façon pw-mcp-proxy switch_profile).
 *
 * ⚠️ Sans `bot` : liste les profils disponibles + le bot actif (ne change rien).
 * ⚠️ Avec `bot` : pose le défaut de session PUIS vérifie par GET /users/@me → renvoie le NOM
 *    RÉEL du bot (anti-hallucination : on prouve l'identité, on ne la suppose pas).
 * ⚠️ Le défaut de session est mono-session (stdio). En HTTP multi-tenant, passer `bot` par appel.
 */
import { listBots, setSessionBot, discordCall } from "../lib/core/client.js";

// Stryker disable all : métadonnée déclarative (description/schema) — aucun contrat comportemental.
export const tool = {
  name: "discord_switch_bot",
  description:
    "Sélectionne le bot actif (profil) pour les appels suivants. Sans argument : liste les bots " +
    "disponibles. Avec {bot} : bascule + confirme l'identité réelle (GET /users/@me).",
  inputSchema: {
    type: "object",
    properties: {
      bot: { type: "string", description: "Id du profil bot à activer (ex: echidna)" },
    },
  },
  // Stryker restore all
  async handle(args, ctx) {
    const { bot } = args;
    if (!bot) {
      const state = await listBots();
      return JSON.stringify(
        { bots: state.bots, default: state.default, session: state.session },
        null,
        2
      );
    }
    await setSessionBot(bot);
    try {
      const me = await discordCall("GET", "/users/@me", undefined, { bot });
      return `Bot actif : ${me.username}#${me.discriminator} (profil « ${bot} », id ${me.id})`;
    } catch (e) {
      // bascule faite mais identité non vérifiable → incident, on remonte
      ctx.incidents.add("warn", `switch ${bot} : /users/@me a échoué → ${e.message}`, {
        status: e.status ?? null,
      });
      throw e;
    }
  },
};
