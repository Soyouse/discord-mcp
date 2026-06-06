/*
 * Test d'INTÉGRATION DOM du cockpit contre MSW — ce qui est RENDABLE en jsdom :
 * conversations (salons + DM), sélection, état du composer.
 * ⚠️ Le CONTENU du fil est virtualisé (mesures DOM nulles en jsdom) → prouvé par endpoints.test.js
 *    (round-trip réseau) + screenshot, JAMAIS asserté ici.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CockpitPage } from "./CockpitPage.jsx";

function renderCockpit() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CockpitPage />
    </QueryClientProvider>
  );
}

describe("CockpitPage + MSW (DOM rendable)", () => {
  it("charge salons et DMables depuis l'API", async () => {
    renderCockpit();
    expect(await screen.findByText("général")).toBeInTheDocument();
    expect(screen.getByText("automations")).toBeInTheDocument();
    expect(screen.getByText("waikoz")).toBeInTheDocument(); // dmable (global_name)
  });

  it("clic sur un salon → composer activé (conversation sélectionnée)", async () => {
    renderCockpit();
    expect(screen.getByLabelText("Message")).toBeDisabled(); // rien de sélectionné
    fireEvent.click(await screen.findByText("général"));
    expect(screen.getByLabelText("Message")).not.toBeDisabled();
  });

  it("DM sélectionné → composer désactivé (envoi DM = P5d)", async () => {
    renderCockpit();
    fireEvent.click(await screen.findByText("waikoz"));
    expect(screen.getByLabelText("Message")).toBeDisabled();
  });
});
