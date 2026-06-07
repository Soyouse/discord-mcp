/** Helpers OAuth PURS (oauth.js) — URL d'autorisation, allowlist (fail-closed), mapping user, parse CSV. */
import { describe, it, expect } from "vitest";
import { buildAuthorizeUrl, parseAllowedIds, isAllowed, discordUserToPrincipal } from "../web/oauth.js";

describe("buildAuthorizeUrl", () => {
  it("construit l'URL Discord avec tous les paramètres", () => {
    const url = new URL(buildAuthorizeUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "s1" }));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("scope")).toBe("identify");
  });
  it("scope personnalisable", () => {
    const url = new URL(buildAuthorizeUrl({ clientId: "c", redirectUri: "r", state: "s", scope: "identify email" }));
    expect(url.searchParams.get("scope")).toBe("identify email");
  });
  it("throw si state manquant (anti-CSRF obligatoire)", () => {
    expect(() => buildAuthorizeUrl({ clientId: "c", redirectUri: "r" })).toThrow(/state/);
  });
  it("throw si clientId/redirectUri manquant", () => {
    expect(() => buildAuthorizeUrl({ redirectUri: "r", state: "s" })).toThrow(/clientId/);
    expect(() => buildAuthorizeUrl({ clientId: "c", state: "s" })).toThrow(/redirectUri/);
  });
});

describe("parseAllowedIds", () => {
  it("CSV → tableau nettoyé (trim, vides retirés)", () => {
    expect(parseAllowedIds("1, 2 ,,3")).toEqual(["1", "2", "3"]);
  });
  it("vide/non-string → []", () => {
    expect(parseAllowedIds("")).toEqual([]);
    expect(parseAllowedIds(undefined)).toEqual([]);
    expect(parseAllowedIds(null)).toEqual([]);
  });
});

describe("isAllowed (fail-closed)", () => {
  it("true si l'id est dans la liste", () => {
    expect(isAllowed("42", ["1", "42"])).toBe(true);
  });
  it("false si absent", () => {
    expect(isAllowed("99", ["1", "42"])).toBe(false);
  });
  it("liste VIDE → false (personne, jamais tout le monde)", () => {
    expect(isAllowed("42", [])).toBe(false);
  });
  it("id vide ou liste non-tableau → false", () => {
    expect(isAllowed("", ["1"])).toBe(false);
    expect(isAllowed("1", null)).toBe(false);
  });
});

describe("discordUserToPrincipal", () => {
  it("préfère global_name, sinon username", () => {
    expect(discordUserToPrincipal({ id: "1", global_name: "Soyouse", username: "soyouse" })).toEqual({ userId: "1", username: "Soyouse" });
    expect(discordUserToPrincipal({ id: "1", username: "soyouse" })).toEqual({ userId: "1", username: "soyouse" });
  });
  it("username null si aucun nom", () => {
    expect(discordUserToPrincipal({ id: "1" })).toEqual({ userId: "1", username: null });
  });
  it("throw si id manquant", () => {
    expect(() => discordUserToPrincipal({ username: "x" })).toThrow(/id/);
    expect(() => discordUserToPrincipal(null)).toThrow(/id/);
  });
});
