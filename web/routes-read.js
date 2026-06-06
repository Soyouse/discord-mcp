/**
 * Routes REST de LECTURE (annuaire + historique + recherche). Plugin Fastify.
 * ⚠️ Toutes protégées par le guard JWT (posé en preHandler dans build-app). Le tenant vient du principal.
 * ⚠️ Câblage fin : la logique/validation vit dans read-service.js (pur, testé). Ici = mapping HTTP.
 */
import * as read from "./read-service.js";
import { resolveTenant } from "./tenant.js";

export function readRoutes(repo) {
  return async function (app) {
    app.get("/api/guilds", async (req) =>
      read.listGuilds(repo, { tenantId: resolveTenant(req.principal) })
    );

    app.get("/api/guilds/:guildId/channels", async (req) =>
      read.listChannels(repo, {
        guildId: req.params.guildId,
        tenantId: resolveTenant(req.principal),
      })
    );

    app.get("/api/dmables", async (req) =>
      read.listDMables(repo, { tenantId: resolveTenant(req.principal) })
    );

    app.get("/api/channels/:channelId/history", async (req) =>
      read.history(repo, {
        channel_id: req.params.channelId,
        before: req.query.before,
        after: req.query.after,
        limit: req.query.limit,
      })
    );

    app.get("/api/search", async (req) =>
      read.search(repo, {
        query: req.query.q,
        guild_id: req.query.guild_id,
        channel_id: req.query.channel_id,
        author_id: req.query.author_id,
        limit: req.query.limit,
      })
    );
  };
}
