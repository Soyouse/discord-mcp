/*
 * Test du hook temps réel avec un FAUX socket (zéro réseau). Prouve : abonnement, application des events
 * au cache react-query (created/updated/deleted), dédupe, désabonnement au démontage.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChannelRealtime } from "./useChannelRealtime.js";

// Faux socket : enregistre les handlers + permet de simuler un event serveur→client via trigger().
function fakeSocket() {
  const handlers = {};
  return {
    emit: vi.fn(),
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

describe("useChannelRealtime", () => {
  it("s'abonne au salon à l'effet — payload OBJET {channel_id} (contrat web/socket.js)", () => {
    // ⚠️ Une string nue → destructuring serveur = undefined → join ignoré en silence → zéro temps réel.
    //    Régression VÉCUE en prod (2026-06-11). NE JAMAIS repasser à une string.
    const { socket, channelId } = setup();
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { channel_id: channelId });
  });

  it("message.created → ajouté au cache", () => {
    const { socket, qc, channelId } = setup("c1", [m("a")]);
    socket.trigger("message.created", m("b"));
    expect(qc.getQueryData(["history", channelId]).map((x) => x.message_id)).toEqual(["a", "b"]);
  });

  it("écho d'un message déjà présent → pas de doublon (dédupe par id)", () => {
    const { socket, qc, channelId } = setup("c1", [m("a")]);
    socket.trigger("message.created", m("a", "édité"));
    const list = qc.getQueryData(["history", channelId]);
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("édité");
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
