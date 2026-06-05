import { describe, it, expect, beforeEach, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ⚠️ env AVANT l'import (SECRETS_PATH lu à l'évaluation du module).
const here = dirname(fileURLToPath(import.meta.url));
process.env.DISCORD_SECRETS_PATH = join(here, "fixtures", "secrets.multibot.json");

// Mock @discordjs/rest : capture verbe/route/body/token, compte les constructions.
const state = vi.hoisted(() => ({ calls: [], ctor: 0 }));
vi.mock("@discordjs/rest", () => {
  class REST {
    constructor() {
      state.ctor++;
      this.token = null;
    }
    setToken(t) {
      this.token = t;
      return this;
    }
    _rec(verb, route, opts) {
      state.calls.push({ verb, route, opts, token: this.token });
      return { ok: true, verb, route };
    }
    get(r, o) { return this._rec("get", r, o); }
    post(r, o) { return this._rec("post", r, o); }
    put(r, o) { return this._rec("put", r, o); }
    patch(r, o) { return this._rec("patch", r, o); }
    delete(r, o) { return this._rec("delete", r, o); }
  }
  return { REST };
});

const { discordCall, _resetClient } = await import("../lib/core/client.js");

beforeEach(() => {
  state.calls = [];
  state.ctor = 0;
  _resetClient(); // cache REST vierge à chaque test
});

describe("discordCall — mapping & routage (REST mocké)", () => {
  it("préfixe '/' si endpoint sans slash", async () => {
    await discordCall("GET", "users/@me");
    expect(state.calls[0].route).toBe("/users/@me");
  });

  it("garde le '/' si déjà présent", async () => {
    await discordCall("GET", "/guilds/1");
    expect(state.calls[0].route).toBe("/guilds/1");
  });

  it("mappe chaque méthode vers le bon verbe REST", async () => {
    await discordCall("GET", "/a");
    await discordCall("POST", "/b", { x: 1 });
    await discordCall("PUT", "/c", { x: 1 });
    await discordCall("PATCH", "/d", { x: 1 });
    await discordCall("DELETE", "/e");
    expect(state.calls.map((c) => c.verb)).toEqual(["get", "post", "put", "patch", "delete"]);
  });

  it("méthode en minuscules acceptée (toUpperCase)", async () => {
    await discordCall("get", "/x");
    expect(state.calls[0].verb).toBe("get");
  });

  it("payload → passé en { body }", async () => {
    await discordCall("POST", "/channels/1/messages", { content: "hi" });
    expect(state.calls[0].verb).toBe("post");
    expect(state.calls[0].opts).toEqual({ body: { content: "hi" } });
  });

  it("sans payload → opts undefined", async () => {
    await discordCall("GET", "/x");
    expect(state.calls[0].opts).toBeUndefined();
  });

  it("payload null traité comme absent", async () => {
    await discordCall("GET", "/x", null);
    expect(state.calls[0].opts).toBeUndefined();
  });

  it("méthode invalide → throw AVANT toute construction REST", async () => {
    await expect(discordCall("FETCH", "/x")).rejects.toThrow(/non supportée/i);
    expect(state.ctor).toBe(0);
    expect(state.calls).toHaveLength(0);
  });

  it("token = celui du bot ciblé", async () => {
    await discordCall("GET", "/x", undefined, { bot: "scout" });
    expect(state.calls[0].token).toBe("FAKE_TOKEN_SCOUT");
  });

  it("défaut secrets = echidna", async () => {
    await discordCall("GET", "/x");
    expect(state.calls[0].token).toBe("FAKE_TOKEN_ECHIDNA");
  });

  it("bot inconnu → throw (pas d'appel réseau)", async () => {
    await expect(discordCall("GET", "/x", undefined, { bot: "ghost" })).rejects.toThrow(/inconnu/i);
    expect(state.calls).toHaveLength(0);
  });

  it("cache REST par bot : 2 appels même bot = 1 seule construction", async () => {
    await discordCall("GET", "/a", undefined, { bot: "echidna" });
    await discordCall("GET", "/b", undefined, { bot: "echidna" });
    expect(state.ctor).toBe(1);
  });

  it("bots distincts = constructions distinctes", async () => {
    await discordCall("GET", "/a", undefined, { bot: "echidna" });
    await discordCall("GET", "/b", undefined, { bot: "scout" });
    expect(state.ctor).toBe(2);
  });
});
