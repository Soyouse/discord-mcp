/*
 * Hooks react-query (server-state : cache, revalidation). Pas de state-management maison (PLAN §9).
 * ⚠️ Clés de query stables → cache/invalidation prévisibles. `enabled` coupe les fetchs sans cible.
 * Réconciliation optimiste de l'envoi (écho socket) = P5d ; ici l'envoi invalide l'historique (refetch).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints.js";
import { addOptimistic, confirmOptimistic, rollbackOptimistic, sortByTime } from "../realtime/reconcile.js";

export const useGuilds = () => useQuery({ queryKey: ["guilds"], queryFn: api.listGuilds });

export const useChannels = (guildId) =>
  useQuery({ queryKey: ["channels", guildId], queryFn: () => api.listChannels(guildId), enabled: !!guildId });

export const useDMables = () => useQuery({ queryKey: ["dmables"], queryFn: api.listDMables });

export const useHistory = (channelId) =>
  useQuery({
    queryKey: ["history", channelId],
    queryFn: () => api.getHistory(channelId),
    enabled: !!channelId,
    // ⚠️ L'API renvoie DESC (les N derniers) ; le fil affiche ASC (ancien en haut). Trier ICI,
    //    systématiquement : sans ça l'ordre dépend de QUI a peuplé le cache (GET brut = DESC,
    //    upsert socket = ASC via sortByTime) — fil inversé vécu après un refetch gap-fill.
    select: sortByTime,
  });

/** Ouvre (ou récupère) le canal DM d'un utilisateur → { channel_id }. Idempotent côté Discord. */
export function useOpenDM() {
  return useMutation({ mutationFn: ({ recipientId, bot }) => api.openDM(recipientId, bot) });
}

/*
 * Envoi OPTIMISTE : le message apparaît immédiatement (pending), puis on confirme avec le message réel
 * renvoyé par le POST. L'écho socket (même message_id) est dédupé par reconcile (cf. useChannelRealtime).
 * ⚠️ Le caller fournit `nonce` (id de corrélation) + author/authorId (affichage optimiste).
 *    `createdAt` est stampé ici (app navigateur, pas un script workflow).
 */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, content, bot }) => api.sendMessage(channelId, content, bot),
    onMutate: async ({ channelId, content, nonce, author, authorId }) => {
      const key = ["history", channelId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old = []) =>
        addOptimistic(old, { nonce, content, author, authorId, channelId, createdAt: new Date().toISOString() })
      );
      return { prev, key, nonce };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, (old = []) => rollbackOptimistic(old, ctx.nonce));
    },
    onSuccess: (real, _vars, ctx) => {
      qc.setQueryData(ctx.key, (old = []) => confirmOptimistic(old, ctx.nonce, real));
    },
  });
}
