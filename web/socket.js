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
    socket.on("subscribe", ({ channel_id } = {}, ack) => {
      if (typeof channel_id === "string" && channel_id) socket.join(`channel:${channel_id}`);
      if (typeof ack === "function") ack({ ok: true });
    });
    socket.on("unsubscribe", ({ channel_id } = {}, ack) => {
      if (typeof channel_id === "string" && channel_id) socket.leave(`channel:${channel_id}`);
      if (typeof ack === "function") ack({ ok: true });
    });
  });

  return io;
}
