import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.jsx";
import "./theme.css";

// react-query = server-state (cache/revalidation) — supprime tout state-management maison (PLAN §9).
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ⚠️ MSW en DEV uniquement (mock /api/* tant que l'API réelle + OAuth P2b n'existent pas).
//    JAMAIS en prod (le build sert le vrai backend). Démarré AVANT le render pour intercepter le 1er fetch.
if (import.meta.env.DEV) {
  const { worker } = await import("./mocks/browser.js");
  await worker.start({ onUnhandledRequest: "bypass" });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
