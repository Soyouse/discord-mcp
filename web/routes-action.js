/**
 * Routes REST d'ACTION (écriture) — envoyer message / ouvrir DM / envoyer DM. Plugin Fastify.
 * ⚠️ Protégées par le guard JWT (preHandler posé dans build-app). `discordCall` INJECTÉ (testable, fake en test).
 * ⚠️ Mapping HTTP fin : la validation/logique vit dans action-service.js (pur, muté). Ici = HTTP→service.
 * ⚠️ 201 Created : l'action a produit une ressource côté Discord (message/canal).
 * ⚠️ `bot` = optionnel (rail multi-bot du front) ; absent → bot par défaut des secrets.
 *    Seam SaaS : demain `tenant→bot` viendra du principal (SecretStore), pas du body. Mono : body OK.
 */
import * as action from "./action-service.js";

export function actionRoutes(deps) {
  return async function (app) {
    app.post("/api/channels/:channelId/messages", async (req, reply) => {
      const msg = await action.sendMessage(deps, {
        channelId: req.params.channelId,
        content: req.body?.content,
        bot: req.body?.bot,
      });
      return reply.code(201).send(msg);
    });

    app.post("/api/dms", async (req, reply) => {
      const dm = await action.openDM(deps, {
        recipientId: req.body?.recipientId,
        bot: req.body?.bot,
      });
      return reply.code(201).send(dm);
    });

    app.post("/api/dms/:recipientId/messages", async (req, reply) => {
      const msg = await action.sendDM(deps, {
        recipientId: req.params.recipientId,
        content: req.body?.content,
        bot: req.body?.bot,
      });
      return reply.code(201).send(msg);
    });
  };
}
