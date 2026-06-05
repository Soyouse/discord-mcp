/**
 * Outil `discord_health` — observabilité du service (healthcheck systemd + drapeau orange).
 *
 * ⚠️ Zéro réseau : renvoie les bots configurés + la fenêtre glissante des réponses invalides
 *    (401/403/429) par bot. `warn:true` = on grimpe vers l'invalid-request limit PAR-IP de Discord.
 */
import { listBots } from "../lib/core/client.js";
import { snapshot } from "../lib/rate-monitor.js";

// Stryker disable all : métadonnée déclarative (description/schema) — aucun contrat comportemental.
export const tool = {
  name: "discord_health",
  description:
    "État du service : bots configurés, bot actif, et compteur glissant des réponses invalides " +
    "(401/403/429) par bot. warn=true signale un risque de ban-IP (invalid-request limit Discord).",
  inputSchema: { type: "object", properties: {} },
  // Stryker restore all
  async handle() {
    const bots = await listBots();
    return JSON.stringify({ ok: true, bots, rateLimit: snapshot() }, null, 2);
  },
};
