import { describe, it, expect, beforeEach } from "vitest";
import { loadRegistry } from "../lib/registry.js";
import { handleTool } from "../dispatch.js";
import { recordResult, snapshot, _reset } from "../lib/rate-monitor.js";

describe("registry — auto-enregistrement", () => {
  it("découvre les 4 outils, chacun avec un handle()", async () => {
    const reg = await loadRegistry();
    for (const n of ["discord_call", "discord_discover", "discord_switch_bot", "discord_health"]) {
      expect(reg.has(n)).toBe(true);
      expect(typeof reg.get(n).handle).toBe("function");
    }
  });

  it("met en cache : 2e appel = même instance Map", async () => {
    const a = await loadRegistry();
    const b = await loadRegistry();
    expect(a).toBe(b);
  });
});

describe("dispatch — chemin d'erreur", () => {
  it("append la section incidents au message d'erreur jeté", async () => {
    // discord_call avec méthode invalide : le handler logue 1 incident puis rethrow.
    await expect(handleTool("discord_call", { method: "FETCH", endpoint: "/x" })).rejects.toThrow(
      /Incidents \(1\)/
    );
  });

  it("succès : la sortie se termine par la section incidents", async () => {
    const out = await handleTool("discord_discover", {});
    expect(out).toMatch(/Aucun incident/);
  });
});

describe("rate-monitor — bornes de fenêtre", () => {
  beforeEach(() => _reset());

  it("event à EXACTEMENT la limite (ts === cutoff) est CONSERVÉ", () => {
    const WINDOW = 10 * 60 * 1000;
    recordResult("echidna", 403, () => 0);
    expect(snapshot(() => WINDOW).invalidTotal).toBe(1); // cutoff=0, ts=0 >= 0 → gardé
  });

  it("event juste au-delà (ts < cutoff) est OUBLIÉ", () => {
    const WINDOW = 10 * 60 * 1000;
    recordResult("echidna", 403, () => 0);
    expect(snapshot(() => WINDOW + 1).invalidTotal).toBe(0); // cutoff=1, ts=0 < 1 → purgé
  });

  it("warn à exactement 1999 = false (sous le seuil 2000)", () => {
    const now = () => 5000;
    for (let i = 0; i < 1999; i++) recordResult("echidna", 429, now);
    expect(snapshot(now).warn).toBe(false);
  });
});
