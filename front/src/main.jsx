import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.jsx";
import { createSocket } from "./realtime/socket-client.js";
import { setTokenProvider } from "./api/http.js";
import { getAccessToken } from "./auth/token.js";
import "./theme.css";

// Le Bearer des appels API ET le handshake socket lisent le MÊME token courant (posé par useSession après /refresh).
setTokenProvider(getAccessToken);

// react-query = server-state (cache/revalidation) — supprime tout state-management maison (PLAN §9).
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ⚠️ MSW : actif en DEV (confort local) OU si VITE_ENABLE_MSW=1 (build e2e `--mode e2e`, cf .env.e2e).
//    Flag EXPLICITE > « actif si dev » : permet de servir les mocks dans un build `preview` (e2e bigtech =
//    serveur production-ish, pas le watcher dev → cycle de vie simple, pas d'orphelin). Le build prod RÉEL
//    (mode production, sans le flag) n'embarque JAMAIS MSW → le front tape le vrai backend. Démarré AVANT
//    le render pour intercepter le 1er fetch.
if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_MSW === "1") {
  const { worker } = await import("./mocks/browser.js");
  await worker.start({ onUnhandledRequest: "bypass" });
}

// Socket temps réel : token JWT dans le handshake (même token que les appels API). Même origine (nginx) en prod.
const socket = createSocket({ getToken: getAccessToken });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App socket={socket} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
