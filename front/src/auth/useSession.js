/*
 * Session côté front : au montage, échange le cookie refresh contre un access JWT (refreshSession).
 * - succès → status "authed" + user, pose le token en mémoire, re-refresh AVANT expiry (access court).
 * - échec (401, pas de cookie) → status "anon" → la garde de route renvoie vers /login.
 * ⚠️ Le token ne touche jamais le disque (mémoire only) ; le refresh est un cookie HttpOnly géré par le serveur.
 */
import { useState, useEffect } from "react";
import { refreshSession } from "../api/auth.js";
import { setAccessToken } from "./token.js";

// Re-refresh bien avant l'expiry de l'access (15 min côté serveur) → marge confortable.
const REFRESH_EVERY_MS = 13 * 60 * 1000;

export function useSession() {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    let timer;
    async function run() {
      try {
        const { accessToken, user } = await refreshSession();
        if (!alive) return;
        setAccessToken(accessToken);
        setState({ status: "authed", user });
        timer = setTimeout(run, REFRESH_EVERY_MS); // rotation silencieuse
      } catch {
        if (!alive) return;
        setAccessToken(null);
        setState({ status: "anon", user: null });
      }
    }
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return state;
}
