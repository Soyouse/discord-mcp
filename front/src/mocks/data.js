/*
 * Jeu de données MOCK (dev + tests via MSW). Source UNIQUE — remplace les fixtures P5b.
 * ⚠️ Formes alignées sur les projections API réelles (read-service.js / query.js / action-service.js).
 * `reset()` rétablit l'état initial (appelé entre tests pour l'isolation).
 */
const initialGuilds = [{ guild_id: "g1", name: "WebZenon · Automations", icon: null }];

const initialChannels = [
  { channel_id: "c1", guild_id: "g1", type: 0, name: "général", position: 0 },
  { channel_id: "c2", guild_id: "g1", type: 0, name: "automations", position: 1 },
  // c3 = salon LONG (60 msgs > PAGE_SIZE 50) → prouve la pagination « charger plus » (e2e scroll haut).
  { channel_id: "c3", guild_id: "g1", type: 0, name: "archives", position: 2 },
];

// 60 messages chronologiques archive-1 (le plus ancien) … archive-60 (le plus récent).
const archiveHistory = () =>
  Array.from({ length: 60 }, (_, i) => ({
    message_id: `arch-${i + 1}`,
    channel_id: "c3",
    guild_id: "g1",
    author_id: i % 2 ? "1506439277121241158" : "111111111111111111",
    author: i % 2 ? "Echidna" : "soyouse",
    content: `archive-${i + 1}`,
    created_at: `2026-06-05T${String(8 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}:00.000Z`,
    edited_at: null,
  }));

const initialDMables = [
  { user_id: "111111111111111111", username: "soyouse", global_name: "Théo", avatar: null },
  { user_id: "222222222222222222", username: "waikoz", global_name: "waikoz", avatar: null },
];

// Annuaire COMPLET (bots inclus, ≠ dmables) — résout author_id → avatar dans le fil + DetailsPanel.
// Le bot a un avatar (hash factice) : prouve que le fil affiche l'avatar du BOT (trou UX vécu).
const initialMembers = [
  { guild_id: "g1", user_id: "1506439277121241158", username: "Echidna", global_name: null, avatar: "mockavatarhash", is_bot: true },
  { guild_id: "g1", user_id: "111111111111111111", username: "soyouse", global_name: "Théo", avatar: null, is_bot: false },
  { guild_id: "g1", user_id: "222222222222222222", username: "waikoz", global_name: "waikoz", avatar: null, is_bot: false },
];

const initialHistory = () => ({
  c1: [
    { message_id: "m1", channel_id: "c1", guild_id: "g1", author_id: "1506439277121241158", author: "Echidna", content: "Relais en ligne ✅", created_at: "2026-06-06T09:00:00.000Z", edited_at: null },
    { message_id: "m2", channel_id: "c1", guild_id: "g1", author_id: "111111111111111111", author: "soyouse", content: "Parfait, on enchaîne sur le cockpit.", created_at: "2026-06-06T09:01:00.000Z", edited_at: null },
    { message_id: "m4", channel_id: "c1", guild_id: "g1", author_id: "1506439277121241158", author: "Echidna", content: "Markdown OK : **gras**, *italique*, `code` et [un lien](https://webzenon.fr).", created_at: "2026-06-06T09:02:00.000Z", edited_at: null },
  ],
  c2: [
    { message_id: "m3", channel_id: "c2", guild_id: "g1", author_id: "1506439277121241158", author: "Echidna", content: "Déploiement #812e831 OK.", created_at: "2026-06-06T09:30:00.000Z", edited_at: null },
  ],
  c3: archiveHistory(),
});

export const db = {
  guilds: initialGuilds,
  channels: initialChannels,
  dmables: initialDMables,
  members: initialMembers,
  history: initialHistory(),
  seq: 100,
};

export function reset() {
  db.guilds = initialGuilds;
  db.channels = initialChannels;
  db.dmables = initialDMables;
  db.members = initialMembers;
  db.history = initialHistory();
  db.seq = 100;
}
