/*
 * Hook temps réel : abonne le socket au salon actif et applique les events au cache react-query.
 * ⚠️ Dédupe par message_id (reconcile.upsert) → l'écho d'un message envoyé (déjà mis par la réponse POST)
 *    ne crée pas de doublon. Désabonnement + retrait des listeners au changement de salon/démontage.
 * Socket absent (pas connecté / tests) → no-op silencieux (l'optimiste fonctionne quand même).
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { upsert, removeById } from "./reconcile.js";

export function useChannelRealtime(socket, channelId) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!socket || !channelId) return undefined;
    const key = ["history", channelId];
    socket.emit("subscribe", channelId);

    const onUpsert = (msg) => qc.setQueryData(key, (old = []) => upsert(old, msg));
    const onDeleted = (msg) => qc.setQueryData(key, (old = []) => removeById(old, msg.message_id));

    socket.on("message.created", onUpsert);
    socket.on("message.updated", onUpsert);
    socket.on("message.deleted", onDeleted);

    return () => {
      socket.emit("unsubscribe", channelId);
      socket.off("message.created", onUpsert);
      socket.off("message.updated", onUpsert);
      socket.off("message.deleted", onDeleted);
    };
  }, [socket, channelId, qc]);
}
