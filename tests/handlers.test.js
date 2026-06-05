import { describe, it, expect, vi, beforeEach } from "vitest";

const discordCall = vi.fn();
const listBots = vi.fn(async () => ({ bots: ["echidna"], default: "echidna" }));
const snapshot = vi.fn(() => ({ invalidTotal: 0, perBot: {}, warn: false }));
vi.mock("../lib/core/client.js", () => ({ discordCall, listBots, assertBot: vi.fn() }));
vi.mock("../lib/rate-monitor.js", () => ({ snapshot, recordResult: vi.fn() }));

const { tool: call } = await import("../handlers/call.js");
const { tool: health } = await import("../handlers/health.js");

function ctx() {
  const i = [];
  return { incidents: { add: (lvl, msg, meta) => i.push({ lvl, msg, meta }) }, session: { bot: null }, _i: i };
}

beforeEach(() => {
  discordCall.mockReset();
  listBots.mockClear();
  snapshot.mockClear();
});

describe("discord_call", () => {
  it("succès : renvoie le JSON du résultat Discord", async () => {
    discordCall.mockResolvedValueOnce({ id: "42", name: "salon" });
    const out = await call.handle({ method: "GET", endpoint: "/x" }, ctx());
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe("42");
    expect(parsed.name).toBe("salon");
  });

  it("résultat null → { ok: true } (pas de crash)", async () => {
    discordCall.mockResolvedValueOnce(null);
    const out = JSON.parse(await call.handle({ method: "DELETE", endpoint: "/x" }, ctx()));
    expect(out.ok).toBe(true);
  });

  it("erreur : logue un incident avec le status puis rethrow", async () => {
    discordCall.mockRejectedValueOnce(Object.assign(new Error("403"), { status: 403 }));
    const c = ctx();
    await expect(call.handle({ method: "GET", endpoint: "/x" }, c)).rejects.toThrow(/403/);
    expect(c._i).toHaveLength(1);
    expect(c._i[0].meta.status).toBe(403);
    expect(c._i[0].msg).toMatch(/GET \/x/);
  });

  it("status absent → meta.status = null", async () => {
    discordCall.mockRejectedValueOnce(new Error("boom"));
    const c = ctx();
    await expect(call.handle({ method: "GET", endpoint: "/x" }, c)).rejects.toThrow();
    expect(c._i[0].meta.status).toBe(null);
  });
});

describe("discord_health", () => {
  it("renvoie ok + bots + rateLimit + bot de session", async () => {
    const c = ctx();
    c.session.bot = "echidna";
    const out = JSON.parse(await health.handle({}, c));
    expect(out.ok).toBe(true);
    expect(out.bots.bots).toEqual(["echidna"]);
    expect(out.sessionBot).toBe("echidna"); // reflète la session
    expect(out.rateLimit).toHaveProperty("warn", false);
    expect(listBots).toHaveBeenCalled();
    expect(snapshot).toHaveBeenCalled();
  });

  it("sans ctx (appel hors session) → sessionBot null, pas de crash", async () => {
    const out = JSON.parse(await health.handle({}));
    expect(out.sessionBot).toBe(null);
  });
});
