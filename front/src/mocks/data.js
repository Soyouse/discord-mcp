/*
 * Jeu de données MOCK (dev + tests via MSW). Source UNIQUE — remplace les fixtures P5b.
 * ⚠️ Formes alignées sur les projections API réelles (read-service.js / query.js / action-service.js).
 * `reset()` rétablit l'état initial (appelé entre tests pour l'isolation).
 */
const initialGuilds = [{ guild_id: "g1", name: "WebZenon · Automations", icon: null }];

const initialChannels = [
  { channel_id: "c1", guild_id: "g1", type: 0, name: "général", position: 0 },
  { channel_id: "c2", guild_id: "g1", type: 0, name: "automations", position: 1 },
];

const initialDMables = [
  { user_id: "111111111111111111", username: "soyouse", global_name: "Théo", avatar: null },
  { user_id: "222222222222222222", username: "waikoz", global_name: "waikoz", avatar: null },
];

const initialHistory = () => ({
  c1: [
    { message_id: "m1", channel_id: "c1", guild_id: "g1", author_id: "u1", author: "Echidna", content: "Relais en ligne ✅", created_at: "2026-06-06T09:00:00.000Z", edited_at: null },
    { message_id: "m2", channel_id: "c1", guild_id: "g1", author_id: "u2", author: "soyouse", content: "Parfait, on enchaîne sur le cockpit.", created_at: "2026-06-06T09:01:00.000Z", edited_at: null },
    { message_id: "m4", channel_id: "c1", guild_id: "g1", author_id: "u1", author: "Echidna", content: "Markdown OK : **gras**, *italique*, `code` et [un lien](https://webzenon.fr).", created_at: "2026-06-06T09:02:00.000Z", edited_at: null },
  ],
  c2: [
    { message_id: "m3", channel_id: "c2", guild_id: "g1", author_id: "u1", author: "Echidna", content: "Déploiement #812e831 OK.", created_at: "2026-06-06T09:30:00.000Z", edited_at: null },
  ],
});

export const db = {
  guilds: initialGuilds,
  channels: initialChannels,
  dmables: initialDMables,
  history: initialHistory(),
  seq: 100,
};

export function reset() {
  db.guilds = initialGuilds;
  db.channels = initialChannels;
  db.dmables = initialDMables;
  db.history = initialHistory();
  db.seq = 100;
}
