/*
 * Smoke test de rendu (P5a/P5c) — l'app monte, route, et le cockpit charge les données via MSW.
 * Garantit la chaîne main→App→pages + react-query + router + couche API/MSW.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server.js";
import { App } from "./App.jsx";

function renderAt(path) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("App routing (P5a/P5c)", () => {
  it("/login affiche l'écran de connexion", () => {
    renderAt("/login");
    expect(screen.getByRole("button", { name: /se connecter avec discord/i })).toBeInTheDocument();
  });

  it("/ monte le cockpit APRÈS auth (garde de route + /refresh mocké MSW) + charge les salons", async () => {
    renderAt("/");
    // ⚠️ rendu ASYNC : la garde affiche d'abord "Chargement…" puis le cockpit une fois /refresh résolu.
    expect(await screen.findByTitle("Echidna")).toBeInTheDocument(); // rail bot (post-auth)
    expect(await screen.findByText("général")).toBeInTheDocument(); // salon chargé via MSW
  });

  it("route inconnue redirige vers le cockpit (post-auth)", async () => {
    renderAt("/n-existe-pas");
    expect(await screen.findByText("Conversations")).toBeInTheDocument();
  });

  it("NON authentifié (/refresh → 401) → la garde renvoie sur /login", async () => {
    server.use(http.post("/api/auth/refresh", () => new HttpResponse(null, { status: 401 })));
    renderAt("/");
    // garde : anon → redirige /login → bouton de connexion visible, JAMAIS le cockpit
    expect(await screen.findByRole("button", { name: /se connecter avec discord/i })).toBeInTheDocument();
    expect(screen.queryByText("Conversations")).not.toBeInTheDocument();
  });
});
