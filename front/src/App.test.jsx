/*
 * Smoke test de rendu (P5a) — l'app monte et route sans crash, sur les vrais providers.
 * Garantit que la chaîne main→App→pages + react-query + router tient debout.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.jsx";

function renderAt(path) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("App routing (P5a)", () => {
  it("/login affiche l'écran de connexion", () => {
    renderAt("/login");
    expect(screen.getByRole("button", { name: /se connecter avec discord/i })).toBeInTheDocument();
  });

  it("/ affiche la coquille du cockpit (3 colonnes)", () => {
    renderAt("/");
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Sélectionne une conversation")).toBeInTheDocument();
  });

  it("route inconnue redirige vers le cockpit", () => {
    renderAt("/n-existe-pas");
    expect(screen.getByText("Conversations")).toBeInTheDocument();
  });
});
