/*
 * Test d'INTÉGRATION DOM du cockpit contre MSW — ce qui est RENDABLE en jsdom :
 * conversations (salons + DM), sélection, état du composer.
 * ⚠️ Le CONTENU du fil est virtualisé (mesures DOM nulles en jsdom) → prouvé par endpoints.test.js
 *    (round-trip réseau) + screenshot, JAMAIS asserté ici.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  it("vue serveur (défaut) = salons ; vue Home (logo) = Messages privés — Discord-like", async () => {
    renderCockpit();
    expect(await screen.findByText("général")).toBeInTheDocument();
    expect(screen.getByText("automations")).toBeInTheDocument();
    expect(screen.queryByText("bob")).toBeNull(); // les DM ne vivent PAS dans la vue serveur
    fireEvent.click(screen.getByTitle("Messages privés")); // bouton Home du rail
    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("général")).toBeNull(); // et inversement
  });

  it("clic sur un salon → composer activé (conversation sélectionnée)", async () => {
    renderCockpit();
    expect(screen.getByLabelText("Message")).toBeDisabled(); // rien de sélectionné
    fireEvent.click(await screen.findByText("général"));
    expect(screen.getByLabelText("Message")).not.toBeDisabled();
  });

  it("Home → clic sur un DM → openDM résout le canal → composer activé", async () => {
    renderCockpit();
    fireEvent.click(await screen.findByTitle("Messages privés"));
    fireEvent.click(await screen.findByText("bob"));
    await waitFor(() => expect(screen.getByLabelText("Message")).not.toBeDisabled());
  });
});
