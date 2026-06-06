/*
 * Test d'INTÉGRATION de la couche API contre MSW (round-trip réseau réel, sans DOM).
 * Prouve les données ET la boucle d'envoi (POST message → GET history le reflète) que le fil
 * virtualisé ne peut pas montrer en jsdom.
 */
import { describe, it, expect } from "vitest";
import * as api from "./endpoints.js";
import { qs } from "./endpoints.js";

describe("qs (query-string)", () => {
  it("objet vide → chaîne vide (pas de '?')", () => {
    expect(qs({})).toBe("");
  });
  it("omet null / undefined / chaîne vide", () => {
    expect(qs({ a: null, b: undefined, c: "" })).toBe("");
  });
  it("garde les valeurs présentes, préfixe '?'", () => {
    expect(qs({ limit: 50 })).toBe("?limit=50");
  });
  it("mélange : ne garde que les présentes", () => {
    expect(qs({ before: "2026", after: "", limit: 10 })).toBe("?before=2026&limit=10");
  });
});

describe("endpoints + MSW", () => {
  it("listGuilds / listChannels / listDMables", async () => {
    expect((await api.listGuilds())[0]).toMatchObject({ guild_id: "g1" });
    expect((await api.listChannels("g1")).map((c) => c.name)).toEqual(["général", "automations"]);
    expect((await api.listDMables()).map((d) => d.username)).toContain("soyouse");
  });

  it("getHistory renvoie l'historique du salon", async () => {
    const msgs = await api.getHistory("c1");
    expect(msgs.map((m) => m.content)).toContain("Relais en ligne ✅");
  });

  it("sendMessage → 201 echo PUIS getHistory reflète le nouveau message", async () => {
    const before = (await api.getHistory("c1")).length;
    const sent = await api.sendMessage("c1", "round-trip P5c", "echidna");
    expect(sent).toMatchObject({ channel_id: "c1", content: "round-trip P5c" });
    const after = await api.getHistory("c1");
    expect(after.length).toBe(before + 1);
    expect(after.map((m) => m.content)).toContain("round-trip P5c");
  });

  it("openDM → channel_id ; sendDM → message dans le canal DM", async () => {
    const { channel_id } = await api.openDM("111111111111111111");
    expect(channel_id).toBe("dm-111111111111111111");
    const sent = await api.sendDM("111111111111111111", "coucou DM");
    expect(sent).toMatchObject({ content: "coucou DM" });
  });

  it("search filtre par contenu", async () => {
    const res = await api.search({ q: "relais" });
    expect(res.some((m) => m.content.includes("Relais"))).toBe(true);
  });
});
