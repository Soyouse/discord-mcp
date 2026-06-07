import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { CockpitPage } from "./pages/CockpitPage.jsx";
import { useSession } from "./auth/useSession.js";

/*
 * Routage + GARDE de route (P2b). useSession échange le cookie refresh contre un access JWT au montage :
 *  - "loading" → écran d'attente (le temps du /refresh) ;
 *  - "authed"  → cockpit ;
 *  - "anon"    → redirection /login.
 * ⚠️ /login rend TOUJOURS la page (même non connecté) → point d'entrée du flow OAuth.
 * `socket` injecté depuis main.jsx → passé au cockpit. Tests : non fourni → pas de temps réel.
 */
export function App({ socket } = {}) {
  const { status, user } = useSession();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          status === "loading" ? (
            <div className="flex h-full items-center justify-center bg-base-900 text-text-muted">Chargement…</div>
          ) : status === "authed" ? (
            <CockpitPage socket={socket} user={user} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
