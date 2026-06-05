import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du client : aucun réseau, aucun fichier secrets.
const assertBot = vi.fn(async (id) => id);
const listBots = vi.fn(async () => ({ bots: ["echidna", "scout"], default: "echidna" }));
const discordCall = vi.fn();
vi.mock("../lib/core/client.js", () => ({ assertBot, listBots, discordCall }));

const { tool: switchBot } = await import("../handlers/switch.js");
const { tool: call } = await import("../handlers/call.js");

// ctx avec état de session PAR-SESSION (comme build-server le crée par session).
function fakeCtx() {
  const incidents = [];
  return {
    incidents: { add: (lvl, msg, meta) => incidents.push({ lvl, msg, meta }) },
    session: { bot: null },
    _i: incidents,
  };
}

beforeEach(() => {
  assertBot.mockClear();
  listBots.mockClear();
  discordCall.mockReset();
});

describe("discord_switch_bot", () => {
  it("sans arg : liste les bots + le bot de session courant, sans rien changer", async () => {
    const ctx = fakeCtx();
    ctx.session.bot = "echidna";
    const out = JSON.parse(await switchBot.handle({}, ctx));
    expect(out.bots).toEqual(["echidna", "scout"]);
    expect(out.default).toBe("echidna");
    expect(out.session).toBe("echidna"); // reflète CETTE session
    expect(assertBot).not.toHaveBeenCalled();
  });

  it("avec bot : confirme l'identité PUIS pose le bot SUR LA SESSION", async () => {
    discordCall.mockResolvedValueOnce({ username: "Scout", discriminator: "0", id: "777" });
    const ctx = fakeCtx();
    const out = await switchBot.handle({ bot: "scout" }, ctx);
    expect(assertBot).toHaveBeenCalledWith("scout");
    expect(discordCall).toHaveBeenCalledWith("GET", "/users/@me", undefined, { bot: "scout" });
    expect(ctx.session.bot).toBe("scout"); // committé SUR LA SESSION
    expect(out).toMatch(/Scout/);
    expect(out).toMatch(/777/);
  });

  it("si /users/@me échoue : NE committe PAS le switch (session inchangée) + incident", async () => {
    discordCall.mockRejectedValueOnce(Object.assign(new Error("403"), { status: 403 }));
    const ctx = fakeCtx();
    await expect(switchBot.handle({ bot: "scout" }, ctx)).rejects.toThrow(/403/);
    expect(ctx.session.bot).toBe(null); // ⚠️ pas de bascule sur échec d'identité
    expect(ctx._i).toHaveLength(1);
    expect(ctx._i[0].meta.status).toBe(403);
  });

  it("ISOLATION : un switch dans une session ne FUIT PAS dans une autre", async () => {
    discordCall.mockResolvedValue({ username: "Scout", discriminator: "0", id: "777" });
    const a = fakeCtx();
    const b = fakeCtx();
    await switchBot.handle({ bot: "scout" }, a);
    expect(a.session.bot).toBe("scout");
    expect(b.session.bot).toBe(null); // l'autre session reste intacte
  });
});

describe("discord_call — précédence du bot", () => {
  it("bot explicite de l'appel l'emporte", async () => {
    discordCall.mockResolvedValueOnce({ ok: true });
    const ctx = fakeCtx();
    ctx.session.bot = "echidna";
    await call.handle({ method: "GET", endpoint: "/users/@me", bot: "scout" }, ctx);
    expect(discordCall).toHaveBeenCalledWith("GET", "/users/@me", undefined, { bot: "scout" });
  });

  it("sans bot explicite : utilise le bot de SESSION", async () => {
    discordCall.mockResolvedValueOnce({ ok: true });
    const ctx = fakeCtx();
    ctx.session.bot = "scout";
    await call.handle({ method: "GET", endpoint: "/x" }, ctx);
    expect(discordCall).toHaveBeenCalledWith("GET", "/x", undefined, { bot: "scout" });
  });

  it("ni bot ni session : { bot: undefined } (→ défaut secrets côté client)", async () => {
    discordCall.mockResolvedValueOnce({ ok: true });
    await call.handle({ method: "GET", endpoint: "/x" }, fakeCtx());
    expect(discordCall).toHaveBeenCalledWith("GET", "/x", undefined, { bot: undefined });
  });
});
