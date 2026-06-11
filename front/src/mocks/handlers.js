/*
 * Handlers MSW (Mock Service Worker) — interceptent /api/* au niveau RÉSEAU.
 * ⚠️ MÊME source de vérité pour dev (worker navigateur) ET tests (server node) → un seul mock à maintenir.
 * ⚠️ Mock RÉALISTE : POST message append dans db.history → un refetch GET le voit (boucle envoi prouvable).
 * Quand l'API réelle + OAuth (P2b) existent, on coupe les mocks ; les hooks/endpoints ne changent pas.
 */
import { http, HttpResponse } from "msw";
import { db } from "./data.js";

const echo = (channelId, content) => {
  const msg = {
    message_id: `srv-${db.seq++}`,
    channel_id: channelId,
    guild_id: null,
    author_id: "echidna",
    author: "Echidna",
    content,
    created_at: "2026-06-06T12:00:00.000Z",
    edited_at: null,
  };
  return msg;
};

export const handlers = [
  // Auth : en mock, /refresh "connecte" automatiquement (token + user factices) → le cockpit s'ouvre
  // sans vrai OAuth. En prod (MSW coupé) c'est le vrai backend OAuth qui répond. /logout = 204.
  http.post("/api/auth/refresh", () =>
    HttpResponse.json({ accessToken: "mock-access-token", user: { userId: "dev", username: "Dev" } })
  ),
  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/guilds", () => HttpResponse.json(db.guilds)),

  http.get("/api/guilds/:guildId/channels", ({ params }) =>
    HttpResponse.json(db.channels.filter((c) => c.guild_id === params.guildId))
  ),

  http.get("/api/dmables", () => HttpResponse.json(db.dmables)),

  // Comme la vraie API (relay/query.js) : DESC (récent d'abord) + curseurs before/limit (pagination).
  http.get("/api/channels/:channelId/history", ({ params, request }) => {
    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const limit = Number(url.searchParams.get("limit")) || 50;
    let rows = [...(db.history[params.channelId] ?? [])].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    if (before) rows = rows.filter((m) => new Date(m.created_at) < new Date(before));
    return HttpResponse.json(rows.slice(0, limit));
  }),

  http.get("/api/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const all = Object.values(db.history).flat();
    return HttpResponse.json(all.filter((m) => (m.content ?? "").toLowerCase().includes(q.toLowerCase())));
  }),

  http.post("/api/channels/:channelId/messages", async ({ params, request }) => {
    const { content } = await request.json();
    const msg = echo(params.channelId, content);
    (db.history[params.channelId] ??= []).push(msg);
    return HttpResponse.json(msg, { status: 201 });
  }),

  http.post("/api/dms", async ({ request }) => {
    const { recipientId } = await request.json();
    return HttpResponse.json({ channel_id: `dm-${recipientId}` }, { status: 201 });
  }),

  http.post("/api/dms/:recipientId/messages", async ({ params, request }) => {
    const { content } = await request.json();
    const channelId = `dm-${params.recipientId}`;
    const msg = echo(channelId, content);
    (db.history[channelId] ??= []).push(msg);
    return HttpResponse.json(msg, { status: 201 });
  }),
];
