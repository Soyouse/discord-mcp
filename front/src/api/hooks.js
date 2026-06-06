/*
 * Hooks react-query (server-state : cache, revalidation). Pas de state-management maison (PLAN §9).
 * ⚠️ Clés de query stables → cache/invalidation prévisibles. `enabled` coupe les fetchs sans cible.
 * Réconciliation optimiste de l'envoi (écho socket) = P5d ; ici l'envoi invalide l'historique (refetch).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints.js";

export const useGuilds = () => useQuery({ queryKey: ["guilds"], queryFn: api.listGuilds });

export const useChannels = (guildId) =>
  useQuery({ queryKey: ["channels", guildId], queryFn: () => api.listChannels(guildId), enabled: !!guildId });

export const useDMables = () => useQuery({ queryKey: ["dmables"], queryFn: api.listDMables });

export const useHistory = (channelId) =>
  useQuery({ queryKey: ["history", channelId], queryFn: () => api.getHistory(channelId), enabled: !!channelId });

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, content, bot }) => api.sendMessage(channelId, content, bot),
    // P5d remplacera par l'optimiste + dédupe via l'écho socket. Ici : refetch de l'historique.
    onSuccess: (_data, { channelId }) => qc.invalidateQueries({ queryKey: ["history", channelId] }),
  });
}
