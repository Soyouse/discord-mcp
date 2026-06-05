/**
 * Outil `discord_call` — passe-plat brut. Couverture API Discord 100 %.
 *
 * ⚠️ Aucun endpoint n'est "wrappé" → rien à oublier, rien ne plafonne.
 * Le rate-limit + retries sont gérés par @discordjs/rest sous le capot.
 */
import { discordCall } from "../lib/core/client.js";

export const tool = {
  name: "discord_call",
  description:
    "Appel brut à n'importe quel endpoint de l'API REST Discord (v10). Couverture 100 %. " +
    "Utiliser discord_discover pour le catalogue des endpoints. Les IDs sont des snowflakes — " +
    "résoudre nom→ID via un GET d'abord si besoin.",
  inputSchema: {
    type: "object",
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      endpoint: { type: "string", description: "Chemin API, ex: /guilds/123456789/channels" },
      payload: { type: "object", description: "Corps JSON optionnel (POST/PATCH/PUT)" },
    },
    required: ["method", "endpoint"],
  },
  async handle(args, ctx) {
    const { method, endpoint, payload } = args;
    try {
      const res = await discordCall(method, endpoint, payload);
      return JSON.stringify(res ?? { ok: true }, null, 2);
    } catch (e) {
      ctx.incidents.add("error", `${method} ${endpoint} → ${e.message}`, {
        status: e.status ?? null,
      });
      throw e;
    }
  },
};
