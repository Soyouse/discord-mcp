import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { CockpitPage } from "./pages/CockpitPage.jsx";

/*
 * Routage. La GARDE de route réelle (JWT) viendra avec l'auth (P2b).
 * `socket` injecté depuis l'entrée (main.jsx) → passé au cockpit. Tests : non fourni → pas de temps réel.
 */
export function App({ socket } = {}) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<CockpitPage socket={socket} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
