/*
 * URLs CDN Discord (PUR, testé). Source : https://docs.discord.com/developers/reference#image-formatting
 * ⚠️ hash null/absent → null (l'UI affiche l'initiale en fallback, JAMAIS d'img cassée).
 * PNG volontaire (un hash animé "a_…" est aussi servi en png statique — pas de gif qui clignote).
 */
const CDN = "https://cdn.discordapp.com";

export function guildIconUrl(guildId, icon, size = 96) {
  if (!guildId || !icon) return null;
  return `${CDN}/icons/${guildId}/${icon}.png?size=${size}`;
}

export function userAvatarUrl(userId, avatar, size = 80) {
  if (!userId || !avatar) return null;
  return `${CDN}/avatars/${userId}/${avatar}.png?size=${size}`;
}
