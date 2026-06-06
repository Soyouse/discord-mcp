/**
 * Tests du service d'ACTIONS — logique PURE, `discordCall` faké (zéro réseau, déterministe).
 * Couvre : validation d'entrée (400 avant tout appel), projection publique, passage du `bot`,
 * et la chaîne DÉPENDANTE sendDM (openDM → channel_id réel → sendMessage), jamais batché.
 */
import { describe, it, expect } from "vitest";
import { sendMessage, openDM, sendDM } from "../web/action-service.js";

// Fake discordCall : enregistre chaque appel et renvoie une réponse scénarisée par route.
function makeFake(responder) {
  const calls = [];
  const discordCall = async (method, endpoint, payload, opts) => {
    calls.push({ method, endpoint, payload, opts });
    return responder({ method, endpoint, payload, opts });
  };
  return { deps: { discordCall }, calls };
}

const MSG = { id: "111", channel_id: "c1", author: { id: "bot1" }, content: "salut" };

describe("action-service · sendMessage", () => {
  it("POST le message et renvoie la projection publique", async () => {
    const { deps, calls } = makeFake(() => MSG);
    const out = await sendMessage(deps, { channelId: "c1", content: "salut", bot: "echidna" });
    expect(out).toEqual({ message_id: "111", channel_id: "c1", author_id: "bot1", content: "salut" });
    expect(calls).toEqual([
      { method: "POST", endpoint: "/channels/c1/messages", payload: { content: "salut" }, opts: { bot: "echidna" } },
    ]);
  });

  it("author/content absents → author_id null, content ''", async () => {
    const { deps } = makeFake(() => ({ id: "9", channel_id: "c1" }));
    const out = await sendMessage(deps, { channelId: "c1", content: "x" });
    expect(out).toEqual({ message_id: "9", channel_id: "c1", author_id: null, content: "" });
  });

  it("channelId manquant → 400, AUCUN appel", async () => {
    const { deps, calls } = makeFake(() => MSG);
    await expect(sendMessage(deps, { content: "salut" })).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(0);
  });

  it("content vide/espaces → 400, AUCUN appel", async () => {
    const { deps, calls } = makeFake(() => MSG);
    await expect(sendMessage(deps, { channelId: "c1", content: "   " })).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe("action-service · openDM", () => {
  it("ouvre le canal et renvoie channel_id", async () => {
    const { deps, calls } = makeFake(() => ({ id: "dm9" }));
    const out = await openDM(deps, { recipientId: "u1", bot: "echidna" });
    expect(out).toEqual({ channel_id: "dm9" });
    expect(calls).toEqual([
      { method: "POST", endpoint: "/users/@me/channels", payload: { recipient_id: "u1" }, opts: { bot: "echidna" } },
    ]);
  });

  it("recipientId manquant → 400, AUCUN appel", async () => {
    const { deps, calls } = makeFake(() => ({ id: "dm9" }));
    await expect(openDM(deps, {})).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe("action-service · sendDM (chaîne dépendante)", () => {
  it("ouvre le DM PUIS poste dans le channel_id RÉEL renvoyé (2 appels, ordre)", async () => {
    const { deps, calls } = makeFake(({ endpoint }) =>
      endpoint === "/users/@me/channels"
        ? { id: "dmReal" }
        : { id: "m1", channel_id: "dmReal", author: { id: "bot1" }, content: "yo" }
    );
    const out = await sendDM(deps, { recipientId: "u1", content: "yo", bot: "echidna" });
    expect(out).toEqual({ message_id: "m1", channel_id: "dmReal", author_id: "bot1", content: "yo" });
    expect(calls.map((c) => c.endpoint)).toEqual(["/users/@me/channels", "/channels/dmReal/messages"]);
    // ⚠️ le 2e appel utilise l'id RÉEL renvoyé par le 1er, jamais une supposition.
    expect(calls[1].payload).toEqual({ content: "yo" });
  });

  it("content manquant → 400 AVANT d'ouvrir le DM (aucun appel)", async () => {
    const { deps, calls } = makeFake(() => ({ id: "dm9" }));
    await expect(sendDM(deps, { recipientId: "u1" })).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(0);
  });
});
