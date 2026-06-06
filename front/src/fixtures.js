/*
 * ⚠️ FIXTURES TEMPORAIRES (P5b) — remplacées par les hooks react-query (données API réelles) en P5c,
 *    et par le mock MSW pour les tests/dev. NE PAS bâtir de logique durable dessus.
 * Formes alignées sur les projections API (read-service.js / query.js).
 */
export const FIXTURE_BOTS = [{ id: "echidna", name: "Echidna" }];

export const FIXTURE_CONVERSATIONS = [
  { id: "c1", name: "général", kind: "channel" },
  { id: "c2", name: "automations", kind: "channel" },
  { id: "dm1", name: "soyouse", kind: "dm", user_id: "111111111111111111" },
  { id: "dm2", name: "waikoz", kind: "dm", user_id: "222222222222222222" },
];

export const FIXTURE_MESSAGES = {
  c1: [
    { message_id: "m1", channel_id: "c1", author_id: "u1", author: "Echidna", content: "Relais en ligne ✅", created_at: "2026-06-06T09:00:00.000Z", edited_at: null },
    { message_id: "m2", channel_id: "c1", author_id: "u2", author: "soyouse", content: "Parfait, on enchaîne sur le cockpit.", created_at: "2026-06-06T09:01:00.000Z", edited_at: null },
  ],
  dm1: [
    { message_id: "m3", channel_id: "dm1", author_id: "111111111111111111", author: "soyouse", content: "Salut, t'es là ?", created_at: "2026-06-06T10:15:00.000Z", edited_at: null },
  ],
};
