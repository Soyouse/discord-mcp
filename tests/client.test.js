import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ⚠️ env AVANT l'import du module (SECRETS_PATH lu à l'évaluation).
const here = dirname(fileURLToPath(import.meta.url));
process.env.DISCORD_SECRETS_PATH = join(here, "fixtures", "secrets.multibot.json");

const { normalizeSecrets, listBots, resolveBotId, setSessionBot, _resetClient } = await import(
  "../lib/core/client.js"
);

describe("normalizeSecrets — schéma multi-bot", () => {
  it("garde bots + default explicite", () => {
    const out = normalizeSecrets({
      default: "b",
      bots: { a: { token: "x" }, b: { token: "y" } },
    });
    expect(out.defaultBot).toBe("b");
    expect(Object.keys(out.bots)).toEqual(["a", "b"]);
  });

  it("default implicite = premier bot si absent", () => {
    const out = normalizeSecrets({ bots: { a: { token: "x" }, b: { token: "y" } } });
    expect(out.defaultBot).toBe("a");
  });

  it("throw si bots vide", () => {
    expect(() => normalizeSecrets({ bots: {} })).toThrow(/vide/i);
  });

  it("throw si un bot n'a pas de token", () => {
    expect(() => normalizeSecrets({ bots: { a: { application_id: "1" } } })).toThrow(/sans token/i);
  });

  it("throw si default pointe un bot absent", () => {
    expect(() => normalizeSecrets({ default: "zzz", bots: { a: { token: "x" } } })).toThrow(
      /absent/i
    );
  });
});

describe("normalizeSecrets — rétrocompat legacy mono-bot", () => {
  it("{token} → bot 'default'", () => {
    const out = normalizeSecrets({ token: "leg", application_id: "999" });
    expect(out.defaultBot).toBe("default");
    expect(out.bots.default.token).toBe("leg");
    expect(out.bots.default.application_id).toBe("999");
  });

  it("throw si ni bots ni token", () => {
    expect(() => normalizeSecrets({ nope: 1 })).toThrow(/format invalide/i);
  });

  it("throw si entrée null", () => {
    expect(() => normalizeSecrets(null)).toThrow(/format invalide/i);
  });
});

describe("résolution du bot (fixture multibot)", () => {
  beforeEach(async () => {
    _resetClient();
    await listBots(); // peuple l'état depuis le fichier
  });

  it("listBots expose les ids + le défaut + la session", async () => {
    const out = await listBots();
    expect(out.bots.sort()).toEqual(["echidna", "scout"]);
    expect(out.default).toBe("echidna");
    expect(out.session).toBe(null);
  });

  it("resolveBotId() sans arg → défaut secrets", () => {
    expect(resolveBotId()).toBe("echidna");
  });

  it("resolveBotId(explicite) → ce bot", () => {
    expect(resolveBotId("scout")).toBe("scout");
  });

  it("resolveBotId(inconnu) → throw avec la liste", () => {
    expect(() => resolveBotId("ghost")).toThrow(/echidna, scout/);
  });

  it("setSessionBot change le défaut résolu + apparaît dans listBots", async () => {
    await setSessionBot("scout");
    expect(resolveBotId()).toBe("scout");
    expect((await listBots()).session).toBe("scout");
  });

  it("explicite l'emporte sur la session", async () => {
    await setSessionBot("scout");
    expect(resolveBotId("echidna")).toBe("echidna");
  });

  it("setSessionBot(inconnu) → throw", async () => {
    await expect(setSessionBot("ghost")).rejects.toThrow(/inconnu/i);
  });
});
