import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du client : aucun réseau, aucun fichier secrets.
const setSessionBot = vi.fn(async (id) => id);
const listBots = vi.fn(async () => ({ bots: ["echidna", "scout"], default: "echidna", session: null }));
const discordCall = vi.fn();
vi.mock("../lib/core/client.js", () => ({ setSessionBot, listBots, discordCall }));

const { tool: switchBot } = await import("../handlers/switch.js");
const { tool: call } = await import("../handlers/call.js");

function fakeCtx() {
  const incidents = [];
  return { incidents: { add: (lvl, msg, meta) => incidents.push({ lvl, msg, meta }) }, _i: incidents };
}

beforeEach(() => {
  setSessionBot.mockClear();
  listBots.mockClear();
  discordCall.mockReset();
});

describe("discord_switch_bot", () => {
  it("sans arg : liste les bots sans rien changer", async () => {
    const out = JSON.parse(await switchBot.handle({}, fakeCtx()));
    expect(out.bots).toEqual(["echidna", "scout"]);
    expect(out.default).toBe("echidna");
    expect(setSessionBot).not.toHaveBeenCalled();
  });

  it("avec bot : bascule + confirme l'identité réelle via /users/@me", async () => {
    discordCall.mockResolvedValueOnce({ username: "Scout", discriminator: "0", id: "777" });
    const out = await switchBot.handle({ bot: "scout" }, fakeCtx());
    expect(setSessionBot).toHaveBeenCalledWith("scout");
    expect(discordCall).toHaveBeenCalledWith("GET", "/users/@me", undefined, { bot: "scout" });
    expect(out).toMatch(/Scout/);
    expect(out).toMatch(/scout/);
    expect(out).toMatch(/777/);
  });

  it("si /users/@me échoue : incident + rethrow", async () => {
    discordCall.mockRejectedValueOnce(Object.assign(new Error("403"), { status: 403 }));
    const ctx = fakeCtx();
    await expect(switchBot.handle({ bot: "scout" }, ctx)).rejects.toThrow(/403/);
    expect(ctx._i).toHaveLength(1);
    expect(ctx._i[0].meta.status).toBe(403);
  });
});

describe("discord_call — passthrough du param bot", () => {
  it("transmet { bot } à discordCall", async () => {
    discordCall.mockResolvedValueOnce({ ok: true });
    await call.handle({ method: "GET", endpoint: "/users/@me", bot: "scout" }, fakeCtx());
    expect(discordCall).toHaveBeenCalledWith("GET", "/users/@me", undefined, { bot: "scout" });
  });

  it("sans bot : 4e arg { bot: undefined }", async () => {
    discordCall.mockResolvedValueOnce({ ok: true });
    await call.handle({ method: "GET", endpoint: "/x" }, fakeCtx());
    expect(discordCall).toHaveBeenCalledWith("GET", "/x", undefined, { bot: undefined });
  });
});
