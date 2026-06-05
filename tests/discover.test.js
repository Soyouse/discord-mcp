import { describe, it, expect } from "vitest";
import { tool as discover } from "../handlers/discover.js";
import { tool as call } from "../handlers/call.js";
import { discordCall } from "../lib/core/client.js";

describe("discord_discover", () => {
  it("sans filtre : résumé des catégories", async () => {
    const out = JSON.parse(await discover.handle({}));
    expect(out.categories).toHaveProperty("guild");
    expect(out.categories).toHaveProperty("channel");
  });

  it("sans filtre : chaque valeur = 'N endpoints' + un hint", async () => {
    const out = JSON.parse(await discover.handle({}));
    expect(out.categories.guild).toMatch(/^\d+ endpoints$/);
    expect(out.hint).toMatch(/category/i);
  });

  it("avec catégorie : détail des endpoints", async () => {
    const out = JSON.parse(await discover.handle({ category: "role" }));
    expect(Array.isArray(out.role)).toBe(true);
    expect(out.role[0]).toHaveProperty("endpoint");
    expect(out.role[0]).toHaveProperty("method");
  });

  it("catégorie inconnue : message d'aide", async () => {
    const out = await discover.handle({ category: "xxx" });
    expect(out).toMatch(/inconnue/i);
  });
});

describe("discord_call (offline)", () => {
  it("rejette une méthode HTTP invalide AVANT tout réseau/token", async () => {
    await expect(discordCall("FETCH", "/guilds/1")).rejects.toThrow(/non supportée/i);
  });

  it("le handler logue un incident sur erreur", async () => {
    const incidents = [];
    const ctx = { incidents: { add: (lvl, msg) => incidents.push(msg) } };
    await expect(call.handle({ method: "FETCH", endpoint: "/x" }, ctx)).rejects.toThrow();
    expect(incidents.length).toBe(1);
  });
});
