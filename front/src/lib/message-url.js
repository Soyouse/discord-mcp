/**
 * Construit le permalien Discord d'un message confirmé.
 * Les identifiants synthétiques des messages optimistes sont volontairement ignorés.
 */
export function messageUrl({ guildId = null, channelId, messageId } = {}) {
  const snowflake = /^\d+$/;
  if (!snowflake.test(channelId ?? "") || !snowflake.test(messageId ?? "")) return null;
  const scope = guildId == null || guildId === "@me" || snowflake.test(guildId) ? guildId || "@me" : null;
  if (!scope) return null;
  return `https://discord.com/channels/${scope}/${channelId}/${messageId}`;
}
