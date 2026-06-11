/*
 * Test du hook temps réel avec un FAUX socket (zéro réseau). Prouve : abonnement, application des events
 * au cache react-query (created/updated/deleted), dédupe, désabonnement au démontage.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChannelRealtime } from "./useChannelRealtime.js";

// Faux socket : enregistre les handlers + permet de simuler un event serveur→client via trigger().
// emit : si le dernier arg est une fonction (ack callback), elle est appelée (comme Socket.IO).
function fakeSocket() {
  const handlers = {};
  return {
    emit: vi.fn((...args) => {
      const last = args[args.length - 1];
      if (typeof last === "function") last({ ok: true });
    }),
    on: (ev, fn) => ((handlers[ev] ??= []).push(fn)),
    off: (ev, fn) => (handlers[ev] = (handlers[ev] ?? []).filter((f) => f !== fn)),
    trigger: (ev, payload) => (handlers[ev] ?? []).forEach((f) => f(payload)),
    handlers,
  };
}

function setup(channelId = "c1", seed = []) {
  const qc = new QueryClient();
  qc.setQueryData(["history", channelId], seed);
  const socket = fakeSocket();
  const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const view = renderHook(() => useChannelRealtime(socket, channelId), { wrapper });
  return { qc, socket, channelId, ...view };
}

const m = (id, content = id) => ({ message_id: id, channel_id: "c1", content, created_at: "2026-06-06T09:00:00Z", edited_at: null });
// Event serveur (relay/events.js) : enveloppe {type, channel_id, message_id, message} — `message` = payload complet.
const ev = (type, msg) => ({ type, channel_id: msg.channel_id, message_id: msg.message_id, message: msg });

describe("useChannelRealtime", () => {
  it("s'abonne au salon à l'effet — payload OBJET {channel_id} (contrat web/socket.js)", () => {
    // ⚠️ Une string nue → destructuring serveur = undefined → join ignoré en silence → zéro temps réel.
    //    Régression VÉCUE en prod (2026-06-11). NE JAMAIS repasser à une string.
    const { socket, channelId } = setup();
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { channel_id: channelId }, expect.any(Function));
  });

  it("GAP-FILL : l'ack du subscribe → invalidate de l'historique (rattrape les events d'avant le join)", () => {
    // ⚠️ Un event émis AVANT que le join soit effectif est PERDU (course vécue en prod : optimiste
    //    jamais enrichi). Le refetch à l'ack comble le trou. NE PAS retirer.
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const socket = fakeSocket();
    const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    renderHook(() => useChannelRealtime(socket, "c1"), { wrapper });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["history", "c1"] });
  });

  it("message.created → le `message` PORTÉ par l'event est ajouté au cache", () => {
    const { socket, qc, channelId } = setup("c1", [m("a")]);
    socket.trigger("message.created", ev("message.created", m("b")));
    expect(qc.getQueryData(["history", channelId]).map((x) => x.message_id)).toEqual(["a", "b"]);
  });

  it("écho d'un message déjà présent → pas de doublon (dédupe par id)", () => {
    const { socket, qc, channelId } = setup("c1", [m("a")]);
    socket.trigger("message.created", ev("message.created", m("a", "édité")));
    const list = qc.getQueryData(["history", channelId]);
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("édité");
  });

  it("event DÉGRADÉ (sans `message`) → invalidate (refetch), JAMAIS upsert de l'enveloppe nue", () => {
    // ⚠️ Upserter l'enveloppe {type, channel_id, message_id} écraserait le message affiché
    //    (perte content/author). Le serveur dégrade quand le payload dépasse la limite pg_notify.
    const { socket, qc, channelId } = setup("c1", [m("a")]);
    const spy = vi.spyOn(qc, "invalidateQueries");
    socket.trigger("message.created", { type: "message.created", channel_id: "c1", message_id: "a" });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["history", channelId] });
    expect(qc.getQueryData(["history", channelId])[0].content).toBe("a"); // intact
  });

  it("re-subscribe sur (re)connexion — les rooms serveur meurent avec la session socket", () => {
    // ⚠️ Sans ça, après un redéploiement API / coupure réseau, temps réel mort en silence
    //    jusqu'au changement de salon. Vécu en prod (2026-06-11).
    const { socket, channelId } = setup();
    socket.emit.mockClear();
    socket.trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { channel_id: channelId }, expect.any(Function));
  });

  it("message.deleted → retiré du cache", () => {
    const { socket, qc, channelId } = setup("c1", [m("a"), m("b")]);
    socket.trigger("message.deleted", { message_id: "a" });
    expect(qc.getQueryData(["history", channelId]).map((x) => x.message_id)).toEqual(["b"]);
  });

  it("démontage → désabonnement + retrait des listeners", () => {
    const { socket, channelId, unmount } = setup();
    unmount();
    expect(socket.emit).toHaveBeenCalledWith("unsubscribe", { channel_id: channelId });
    expect(socket.handlers["message.created"]).toHaveLength(0);
  });
});
