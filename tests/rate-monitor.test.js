import { describe, it, expect, beforeEach } from "vitest";
import { recordResult, snapshot, _reset } from "../lib/rate-monitor.js";
import { monitorInvalidResponses } from "../dispatch.js";

beforeEach(() => _reset());

describe("rate-monitor — comptage des réponses invalides", () => {
  it("ignore les status non-invalides (200, 404, 500)", () => {
    const now = () => 1000;
    recordResult("echidna", 200, now);
    recordResult("echidna", 404, now);
    recordResult("echidna", 500, now);
    expect(snapshot(now).invalidTotal).toBe(0);
  });

  it("compte 401/403/429 par bot", () => {
    const now = () => 1000;
    recordResult("echidna", 401, now);
    recordResult("echidna", 429, now);
    recordResult("scout", 403, now);
    const s = snapshot(now);
    expect(s.invalidTotal).toBe(3);
    expect(s.perBot.echidna).toBe(2);
    expect(s.perBot.scout).toBe(1);
  });

  it("bot absent → '(défaut)'", () => {
    const now = () => 1000;
    recordResult(undefined, 403, now);
    expect(snapshot(now).perBot["(défaut)"]).toBe(1);
  });

  it("fenêtre glissante : oublie les events > 10 min", () => {
    recordResult("echidna", 403, () => 0);
    // 11 min plus tard
    const later = () => 11 * 60 * 1000;
    expect(snapshot(later).invalidTotal).toBe(0);
  });

  it("warn=true au-delà de 20% du hard limit (2000/10min)", () => {
    const now = () => 5000;
    for (let i = 0; i < 2000; i++) recordResult("echidna", 429, now);
    const s = snapshot(now);
    expect(s.warn).toBe(true);
    expect(s.invalidTotal).toBe(2000);
  });

  it("warn=false sous le seuil", () => {
    const now = () => 5000;
    recordResult("echidna", 429, now);
    expect(snapshot(now).warn).toBe(false);
  });
});

describe("middleware monitorInvalidResponses", () => {
  it("enregistre le status sur throw, puis ré-émet l'erreur", async () => {
    const wrapped = monitorInvalidResponses(async () => {
      throw Object.assign(new Error("forbidden"), { status: 403 });
    });
    await expect(wrapped({ bot: "scout" }, {})).rejects.toThrow(/forbidden/);
    expect(snapshot().perBot.scout).toBe(1);
  });

  it("n'altère pas le flux nominal (pas d'enregistrement sur succès)", async () => {
    const wrapped = monitorInvalidResponses(async () => "ok");
    expect(await wrapped({ bot: "scout" }, {})).toBe("ok");
    expect(snapshot().invalidTotal).toBe(0);
  });

  it("ignore une erreur sans status numérique", async () => {
    const wrapped = monitorInvalidResponses(async () => {
      throw new Error("ENOENT");
    });
    await expect(wrapped({}, {})).rejects.toThrow(/ENOENT/);
    expect(snapshot().invalidTotal).toBe(0);
  });
});
