/*
 * URL Discord d'un message (PUR, testé). Format officiel :
 *   salon → https://discord.com/channels/{guild_id}/{channel_id}/{message_id}
 *   DM    → https://discord.com/channels/@me/{channel_id}/{message_id}
 * ⚠️ guild_id absent/null = DM (contrat relay/query.js formatRow : guild_id ?? null).
 * channel_id/message_id absents → null (jamais de lien cassé).
 */
export function discordMessageUrl(guildId, channelId, messageId) {
  if (!channelId || !messageId) return null;
  const guildSegment = guildId || "@me";
  return `https://discord.com/channels/${guildSegment}/${channelId}/${messageId}`;
}
