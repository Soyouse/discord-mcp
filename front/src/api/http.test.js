/*
 * Tests du client HTTP (PUR) — fetch + token injectés (zéro réseau, déterministe).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiError, setTokenProvider } from "./http.js";

afterEach(() => setTokenProvider(() => null)); // ne pas fuir le provider entre tests

const okResp = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  text: async () => (data === undefined ? "" : JSON.stringify(data)),
});

describe("apiFetch", () => {
  it("GET → parse le JSON, pas de body", async () => {
    const fetchImpl = vi.fn(async () => okResp([{ a: 1 }]));
    const out = await apiFetch("/api/guilds", { fetchImpl });
    expect(out).toEqual([{ a: 1 }]);
    const [, opts] = fetchImpl.mock.calls[0];
    expect(opts.method).toBe("GET");
    expect(opts.body).toBeUndefined();
  });

  it("POST → sérialise le body + content-type JSON", async () => {
    const fetchImpl = vi.fn(async () => okResp({ ok: true }, 201));
    await apiFetch("/api/x", { method: "POST", body: { content: "hi" }, fetchImpl });
    const [, opts] = fetchImpl.mock.calls[0];
    expect(opts.body).toBe('{"content":"hi"}');
    expect(opts.headers["content-type"]).toBe("application/json");
  });

  it("ajoute le Bearer si un token est fourni", async () => {
    const fetchImpl = vi.fn(async () => okResp({}));
    await apiFetch("/api/x", { fetchImpl, getToken: () => "tok" });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer tok");
  });

  it("pas de header authorization sans token", async () => {
    const fetchImpl = vi.fn(async () => okResp({}));
    await apiFetch("/api/x", { fetchImpl, getToken: () => null });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it("réponse !ok → ApiError avec le status et le message d'erreur", async () => {
    const fetchImpl = vi.fn(async () => okResp({ error: "channel_id requis" }, 400));
    await expect(apiFetch("/api/x", { fetchImpl })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "channel_id requis",
    });
  });

  it("corps vide → renvoie null sans crash", async () => {
    const fetchImpl = vi.fn(async () => okResp(undefined, 204));
    expect(await apiFetch("/api/x", { fetchImpl })).toBeNull();
  });

  it("ApiError est bien une Error", () => {
    expect(new ApiError("x", 500)).toBeInstanceOf(Error);
  });

  it("setTokenProvider : le token global est utilisé quand getToken n'est pas passé", async () => {
    const fetchImpl = vi.fn(async () => okResp({}));
    setTokenProvider(() => "GLOBAL");
    await apiFetch("/api/x", { fetchImpl });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer GLOBAL");
  });

  it("provider par défaut (aucun token) → pas de header authorization", async () => {
    const fetchImpl = vi.fn(async () => okResp({}));
    await apiFetch("/api/x", { fetchImpl }); // _getToken défaut = () => null
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBeUndefined();
  });
});
