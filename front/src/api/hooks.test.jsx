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
import { useHistory } from "./hooks.js";

const m = (id, iso) => ({ message_id: id, channel_id: "c1", content: id, created_at: iso, edited_at: null });

describe("useHistory", () => {
  it("API DESC (récent d'abord) → données exposées ASC (ancien en haut, ordre du fil)", async () => {
    server.use(
      http.get("/api/channels/c1/history", () =>
        HttpResponse.json([m("récent", "2026-06-11T12:00:00Z"), m("ancien", "2026-06-11T10:00:00Z")])
      )
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useHistory("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.map((x) => x.message_id)).toEqual(["ancien", "récent"]);
  });
});
