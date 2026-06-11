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
    // ⚠️ CONTRAT serveur (web/socket.js) : payload = OBJET { channel_id }, JAMAIS une string nue.
    //    Une string → destructuring serveur = undefined → join silencieusement ignoré (ack {ok:true}
    //    quand même) → ZÉRO événement temps réel. Bug vécu en prod (2026-06-11).
    // GAP-FILL : à l'ack du join, refetch l'historique — tout event émis AVANT que le join soit
    // effectif (course connexion/abonnement, vécue en prod : optimiste jamais enrichi) est rattrapé
    // par le GET. Subscribe-then-fetch = pattern standard anti-trou temps réel.
    const subscribe = () =>
      socket.emit("subscribe", { channel_id: channelId }, () => {
        qc.invalidateQueries({ queryKey: key });
      });
    subscribe();
    // ⚠️ RE-SUBSCRIBE sur chaque (re)connexion : les rooms vivent côté serveur et MEURENT avec la
    //    session socket (redéploiement API, coupure réseau). Sans ça, temps réel mort en silence
    //    jusqu'au prochain changement de salon — vécu en prod pendant un recreate (2026-06-11).
    socket.on("connect", subscribe);

    // L'event porte `message` (payload complet, même shape que l'historique) → upsert direct.
    // Event DÉGRADÉ sans `message` (trop gros pour pg_notify, cf relay/events.js capEventSize)
    // → refetch de l'historique. JAMAIS upsert l'event nu : il écraserait le message affiché.
    const onUpsert = (ev) => {
      if (ev?.message) qc.setQueryData(key, (old = []) => upsert(old, ev.message));
      else qc.invalidateQueries({ queryKey: key });
    };
    const onDeleted = (ev) => qc.setQueryData(key, (old = []) => removeById(old, ev.message_id));

    socket.on("message.created", onUpsert);
    socket.on("message.updated", onUpsert);
    socket.on("message.deleted", onDeleted);

    return () => {
      socket.emit("unsubscribe", { channel_id: channelId });
      socket.off("connect", subscribe);
      socket.off("message.created", onUpsert);
      socket.off("message.updated", onUpsert);
      socket.off("message.deleted", onDeleted);
    };
  }, [socket, channelId, qc]);
}
