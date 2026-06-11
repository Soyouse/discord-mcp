/*
 * Test de useHistory : l'ordre d'AFFICHAGE du fil est ASC (ancien en haut) QUEL QUE SOIT l'ordre API.
 * ⚠️ L'API renvoie DESC (les N derniers) — sans le `select: sortByTime`, l'ordre dépendait de QUI
 *    avait peuplé le cache (GET brut = DESC, upsert socket = ASC) → fil inversé vécu en prod
 *    après un refetch gap-fill (2026-06-11). NE PAS retirer le select.
 */
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server.js";
import { useHistory, HISTORY_PAGE_SIZE } from "./hooks.js";

const m = (id, iso) => ({ message_id: id, channel_id: "c1", content: id, created_at: iso, edited_at: null });
const wrapperFor = (qc) => ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe("useHistory", () => {
  it("API DESC (récent d'abord) → données exposées ASC (ancien en haut, ordre du fil)", async () => {
    server.use(
      http.get("/api/channels/c1/history", () =>
        HttpResponse.json([m("récent", "2026-06-11T12:00:00Z"), m("ancien", "2026-06-11T10:00:00Z")])
      )
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHistory("c1"), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.map((x) => x.message_id)).toEqual(["ancien", "récent"]);
  });

  it("PAGINATION : page pleine → fetchNextPage demande `before` du plus ancien ; page courte → fin", async () => {
    // Page 1 PLEINE (PAGE_SIZE messages DESC) → hasNextPage ; le 2e GET doit porter before=<plus ancien>.
    const iso = (i) => `2026-06-11T10:${String(i).padStart(2, "0")}:00.000Z`;
    const page1 = Array.from({ length: HISTORY_PAGE_SIZE }, (_, i) =>
      m(`p1-${i}`, iso(59 - i)) // DESC : 10:59 → plus vieux
    );
    const seen = [];
    server.use(
      http.get("/api/channels/c1/history", ({ request }) => {
        const before = new URL(request.url).searchParams.get("before");
        seen.push(before);
        if (!before) return HttpResponse.json(page1);
        return HttpResponse.json([m("vieux", "2026-06-11T09:00:00.000Z")]); // page courte = fin
      })
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHistory("c1"), { wrapper: wrapperFor(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data).toHaveLength(HISTORY_PAGE_SIZE + 1));
    // le curseur envoyé = created_at du PLUS ANCIEN de la page 1
    expect(seen[1]).toBe(page1[page1.length - 1].created_at);
    // page courte → plus rien à charger ; le fil reste ASC (le plus vieux en tête)
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.data[0].message_id).toBe("vieux");
  });
});
