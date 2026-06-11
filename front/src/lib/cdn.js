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

export function userBannerUrl(userId, banner, size = 480) {
  if (!userId || !banner) return null;
  return `${CDN}/banners/${userId}/${banner}.png?size=${size}`;
}

// Icône OFFICIELLE d'un badge profil (hash de lib/badges.js) : route CDN /badge-icons (pas par-user).
export function badgeIconUrl(icon) {
  if (!icon) return null;
  return `${CDN}/badge-icons/${icon}.png`;
}

// Badge du TAG serveur (primary_guild) : route CDN dédiée clan-badges (≠ icons).
export function clanBadgeUrl(guildId, badge, size = 32) {
  if (!guildId || !badge) return null;
  return `${CDN}/clan-badges/${guildId}/${badge}.png?size=${size}`;
}
