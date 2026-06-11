/*
 * Snowflake Discord (PUR, mutation-testé) — l'ID encode son timestamp de création :
 * bits 22+ = millisecondes depuis l'epoch Discord (2015-01-01T00:00:00Z).
 * → date de création de N'IMPORTE QUEL user/canal/serveur SANS appel API (gratuit, zéro REST).
 */
const DISCORD_EPOCH_MS = 1420070400000n;

/** Date de création encodée dans un snowflake. Entrée invalide → null (jamais de throw côté UI). */
export function snowflakeToDate(id) {
  if (!id || !/^\d{17,20}$/.test(String(id))) return null;
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH_MS));
}
