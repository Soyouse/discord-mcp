/*
 * Hooks react-query (server-state : cache, revalidation). Pas de state-management maison (PLAN §9).
 * ⚠️ Clés de query stables → cache/invalidation prévisibles. `enabled` coupe les fetchs sans cible.
 * Réconciliation optimiste de l'envoi (écho socket) = P5d ; ici l'envoi invalide l'historique (refetch).
 */
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints.js";
import {
  addOptimisticPages,
  confirmOptimisticPages,
  rollbackOptimisticPages,
  flattenPages,
} from "../realtime/reconcile-pages.js";

export const useGuilds = () => useQuery({ queryKey: ["guilds"], queryFn: api.listGuilds });

export const useChannels = (guildId) =>
  useQuery({ queryKey: ["channels", guildId], queryFn: () => api.listChannels(guildId), enabled: !!guildId });

export const useDMables = () => useQuery({ queryKey: ["dmables"], queryFn: api.listDMables });

// Taille de page du fil — alignée sur le défaut serveur (relay/query.js clampLimit).
export const HISTORY_PAGE_SIZE = 50;

/*
 * Historique PAGINÉ (useInfiniteQuery) — « charger plus » = fetchNextPage (scroll haut, MessageList).
 * ⚠️ L'API renvoie DESC (les N derniers) ; la page suivante = `before` le created_at du PLUS ANCIEN
 *    de la dernière page. Page incomplète (< PAGE_SIZE) → fin de l'historique (pas de next).
 * ⚠️ Le cache est en forme InfiniteData {pages, pageParams} → TOUTE écriture cache (optimiste, écho
 *    socket) passe par reconcile-pages.js, JAMAIS reconcile.js plat directement.
 * ⚠️ select = flattenPages : dédupe par message_id (recouvrement de pages possible) + tri ASC
 *    systématique — sans ça l'ordre dépend de QUI a peuplé le cache (fil inversé vécu post-gap-fill).
 */
export const useHistory = (channelId) =>
  useInfiniteQuery({
    queryKey: ["history", channelId],
    queryFn: ({ pageParam }) =>
      api.getHistory(channelId, {
        limit: HISTORY_PAGE_SIZE,
        ...(pageParam ? { before: pageParam } : {}),
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.length === HISTORY_PAGE_SIZE ? lastPage[lastPage.length - 1].created_at : undefined,
    enabled: !!channelId,
    select: flattenPages,
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
      // ⚠️ Cache PAGINÉ (InfiniteData) → helpers reconcile-pages, jamais le plat.
      qc.setQueryData(key, (old) =>
        addOptimisticPages(old, { nonce, content, author, authorId, channelId, createdAt: new Date().toISOString() })
      );
      return { prev, key, nonce };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, (old) => rollbackOptimisticPages(old, ctx.nonce));
    },
    onSuccess: (real, _vars, ctx) => {
      qc.setQueryData(ctx.key, (old) => confirmOptimisticPages(old, ctx.nonce, real));
    },
  });
}
