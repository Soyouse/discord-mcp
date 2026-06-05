/**
 * Outil `discord_switch_bot` — multiplexeur multi-bot (façon pw-mcp-proxy switch_profile).
 *
 * ⚠️ Sans `bot` : liste les profils disponibles + le bot actif de CETTE session (ne change rien).
 * ⚠️ Avec `bot` : vérifie par GET /users/@me PUIS, sur succès, pose le défaut de SESSION (ctx.session.bot)
 *    → renvoie le NOM RÉEL du bot (anti-hallucination : on prouve l'identité, on ne la suppose pas).
 * ⚠️ État de session PAR-SESSION (ctx.session) — JAMAIS global : sinon il fuit entre agents HTTP concurrents.
 */
import { listBots, assertBot, discordCall } from "../lib/core/client.js";

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
        { bots: state.bots, default: state.default, session: ctx.session?.bot ?? null },
        null,
        2
      );
    }
    await assertBot(bot); // existe ? (throw AVANT réseau si inconnu)
    try {
      const me = await discordCall("GET", "/users/@me", undefined, { bot });
      // Identité PROUVÉE → on committe le bot SUR LA SESSION (jamais sur un global).
      if (ctx.session) ctx.session.bot = bot;
      return `Bot actif : ${me.username}#${me.discriminator} (profil « ${bot} », id ${me.id})`;
    } catch (e) {
      // identité non vérifiable → on NE committe PAS le switch → incident, on remonte
      ctx.incidents.add("warn", `switch ${bot} : /users/@me a échoué → ${e.message}`, {
        status: e.status ?? null,
      });
      throw e;
    }
  },
};
