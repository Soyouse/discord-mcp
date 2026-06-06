import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { CockpitPage } from "./pages/CockpitPage.jsx";

/*
 * Squelette de routage (P5a). La GARDE de route réelle (JWT) viendra avec l'auth (P2b/P5).
 * Pour l'instant : /login (entrée) + / (cockpit) + catch-all → /.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<CockpitPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
