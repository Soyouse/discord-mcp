/*
 * Badges Discord (PUR, mutation-testé) — décode le bitfield `public_flags` (GET /users/{id})
 * en liste affichable. Source : Discord API docs "User Flags". Flags inconnus = ignorés (forward-compat).
 * `icon` = hash CDN /badge-icons/{hash}.png — les 12 hash VÉRIFIÉS EN LIVE (curl 200, 2026-06-12).
 * icon null (verified_bot) → l'UI affiche un chip texte en fallback, jamais d'img cassée.
 * ⚠️ Les badges Nitro/Boost ne sont PAS dans public_flags (non exposés aux bots) — n'existe pas ici.
 */
const FLAGS = [
  [1 << 0, "staff", "Discord Staff", "5e74e9b61934fc1f67c65515d1f7e60d"],
  [1 << 1, "partner", "Partenaire", "3f9748e53446a137a052f3454e2de41e"],
  [1 << 2, "hypesquad_events", "HypeSquad Events", "bf01d1073931f921909045f3a39fd264"],
  [1 << 3, "bug_hunter", "Bug Hunter", "2717692c7dca7289b35297368a940dd0"],
  [1 << 6, "bravery", "HypeSquad Bravery", "8a88d63823d8a71cd5e390baa45efa02"],
  [1 << 7, "brilliance", "HypeSquad Brilliance", "011940fd013da3f7fb926e4a1cd2e618"],
  [1 << 8, "balance", "HypeSquad Balance", "3aa41de486fa12454c3761e8e223442e"],
  [1 << 9, "early_supporter", "Early Supporter", "7060786766c9c840eb3019e725d2b358"],
  [1 << 14, "bug_hunter_gold", "Bug Hunter Gold", "848f79194d4be5ff5f81505cbd0ce1e6"],
  [1 << 16, "verified_bot", "Bot vérifié", null],
  [1 << 17, "early_verified_bot_dev", "Développeur de bot vérifié précoce", "6df5892e0f35b051f8b61eace34f4967"],
  [1 << 18, "certified_moderator", "Moderator Programs Alumni", "fee1624003e2fee35cb398e125dc479b"],
  [1 << 22, "active_developer", "Développeur actif", "6bdc42827a38498929a4920da12695d9"],
];

/** public_flags → [{ key, label, icon }]. null/0/invalide → []. */
export function decodeBadges(publicFlags) {
  if (typeof publicFlags !== "number" || publicFlags <= 0) return [];
  return FLAGS.filter(([bit]) => (publicFlags & bit) !== 0).map(([, key, label, icon]) => ({ key, label, icon }));
}
