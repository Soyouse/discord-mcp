/**
 * Serveur Socket.IO attaché au serveur HTTP Fastify — temps réel côté API.
 * ⚠️ I/O (websocket) → exclu mutation. La LOGIQUE pure (event→room) est dans realtime.js, testée.
 *    Ici = câblage + AUTH à la connexion + abonnement par salon. Testé en intégration (port éphémère).
 * ⚠️ Auth OBLIGATOIRE à la poignée de main : un socket sans JWT valide est REJETÉ (jamais de flux anonyme).
 * ⚠️ Multi-nœuds → io.adapter(@socket.io/redis-adapter) (seam, PLAN §9). 1 instance aujourd'hui.
 */
import { Server } from "socket.io";
import { claimsToPrincipal } from "./auth.js";

/**
 * @param httpServer  serveur HTTP sous-jacent (app.server de Fastify, après listen).
 * @param verifyToken fonction SYNCHRONE qui vérifie un JWT et renvoie son payload (throw si invalide).
 *                    En prod = app.jwt.verify (décoré par @fastify/jwt).
 * @param corsOrigin  origines front autorisées (array) ou false.
 */
export function attachSocket(httpServer, { verifyToken, corsOrigin = false }) {
  const io = new Server(httpServer, {
    cors: corsOrigin ? { origin: corsOrigin, credentials: true } : undefined,
  });

  // Middleware d'auth : rejette toute connexion sans JWT valide. Pose le principal sur le socket.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyToken(token); // throw si invalide/absent
      socket.data.principal = claimsToPrincipal(payload);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // S'abonner à un salon = rejoindre sa room → ne recevoir QUE les events de ce salon.
    // ⚠️ CONTRAT : payload = OBJET { channel_id } (le front DOIT envoyer ça — useChannelRealtime).
    //    Payload invalide = ack {ok:false}, JAMAIS {ok:true} silencieux : un join raté repeint en vert
    //    a déjà masqué un drift front (string nue) → zéro temps réel en prod (2026-06-11).
    socket.on("subscribe", (payload, ack) => {
      const channel_id = payload?.channel_id;
      const ok = typeof channel_id === "string" && channel_id.length > 0;
      if (ok) socket.join(`channel:${channel_id}`);
      if (typeof ack === "function") ack(ok ? { ok: true } : { ok: false, error: "channel_id requis (objet {channel_id})" });
    });
    socket.on("unsubscribe", (payload, ack) => {
      const channel_id = payload?.channel_id;
      const ok = typeof channel_id === "string" && channel_id.length > 0;
      if (ok) socket.leave(`channel:${channel_id}`);
      if (typeof ack === "function") ack(ok ? { ok: true } : { ok: false, error: "channel_id requis (objet {channel_id})" });
    });
  });

  return io;
}
