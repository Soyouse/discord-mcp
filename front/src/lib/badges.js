/*
 * Badges Discord (PUR, mutation-testé) — décode le bitfield `public_flags` (GET /users/{id})
 * en liste affichable. Source : Discord API docs "User Flags". Flags inconnus = ignorés (forward-compat).
 * ⚠️ Les badges Nitro/Boost ne sont PAS dans public_flags (non exposés aux bots) — n'existe pas ici.
 */
const FLAGS = [
  [1 << 0, "staff", "Discord Staff"],
  [1 << 1, "partner", "Partenaire"],
  [1 << 2, "hypesquad_events", "HypeSquad Events"],
  [1 << 3, "bug_hunter", "Bug Hunter"],
  [1 << 6, "bravery", "HypeSquad Bravery"],
  [1 << 7, "brilliance", "HypeSquad Brilliance"],
  [1 << 8, "balance", "HypeSquad Balance"],
  [1 << 9, "early_supporter", "Early Supporter"],
  [1 << 14, "bug_hunter_gold", "Bug Hunter Gold"],
  [1 << 16, "verified_bot", "Bot vérifié"],
  [1 << 17, "early_verified_bot_dev", "Développeur de bot vérifié précoce"],
  [1 << 18, "certified_moderator", "Moderator Programs Alumni"],
  [1 << 22, "active_developer", "Développeur actif"],
];

/** public_flags → [{ key, label }]. null/0/invalide → []. */
export function decodeBadges(publicFlags) {
  if (typeof publicFlags !== "number" || publicFlags <= 0) return [];
  return FLAGS.filter(([bit]) => (publicFlags & bit) !== 0).map(([, key, label]) => ({ key, label }));
}
