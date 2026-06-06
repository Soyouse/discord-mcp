/*
 * Smoke test de rendu (P5a/P5c) — l'app monte, route, et le cockpit charge les données via MSW.
 * Garantit la chaîne main→App→pages + react-query + router + couche API/MSW.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

  it("/ monte le cockpit (rail statique) + charge les salons via l'API", async () => {
    renderAt("/");
    expect(screen.getByTitle("Echidna")).toBeInTheDocument(); // rail bot statique (immédiat)
    expect(await screen.findByText("général")).toBeInTheDocument(); // salon chargé via MSW (async)
  });

  it("route inconnue redirige vers le cockpit", () => {
    renderAt("/n-existe-pas");
    expect(screen.getByText("Conversations")).toBeInTheDocument();
  });
});
