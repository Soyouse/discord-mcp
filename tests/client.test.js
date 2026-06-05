import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ⚠️ env AVANT l'import du module (SECRETS_PATH lu à l'évaluation).
const here = dirname(fileURLToPath(import.meta.url));
process.env.DISCORD_SECRETS_PATH = join(here, "fixtures", "secrets.multibot.json");

const { normalizeSecrets, listBots, resolveBotId, assertBot, _resetClient } = await import(
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

  it("listBots expose les ids + le défaut (PAS de session : c'est du ressort du ctx par-session)", async () => {
    const out = await listBots();
    expect(out.bots.sort()).toEqual(["echidna", "scout"]);
    expect(out.default).toBe("echidna");
    expect(out.session).toBeUndefined(); // ⚠️ plus d'état session global ici
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

  it("resolveBotId NE dépend PLUS d'un état de session global (anti-fuite inter-sessions)", () => {
    // Même après une résolution explicite, le défaut sans arg reste le défaut secrets : aucun
    // état n'a été mémorisé au niveau module (la session vit dans ctx, pas ici).
    resolveBotId("scout");
    expect(resolveBotId()).toBe("echidna");
  });

  it("assertBot(connu) → renvoie l'id ; assertBot(inconnu) → throw", async () => {
    expect(await assertBot("scout")).toBe("scout");
    await expect(assertBot("ghost")).rejects.toThrow(/inconnu/i);
  });
});
