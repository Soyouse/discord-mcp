/*
 * Endpoints d'auth (P2b). Le front ne manipule JAMAIS le client_secret ni le refresh token (cookie HttpOnly).
 * - startLogin : navigation pleine page vers le backend → Discord (OAuth ne marche pas en fetch/XHR).
 * - refreshSession : échange le cookie refresh contre un access JWT (au démarrage + périodiquement).
 * - logout : révoque côté serveur + efface le cookie.
 */
import { apiFetch } from "./http.js";

export const startLogin = () => {
  window.location.href = "/api/auth/login";
};

export const refreshSession = () => apiFetch("/api/auth/refresh", { method: "POST" });

export const logout = () => apiFetch("/api/auth/logout", { method: "POST" });
