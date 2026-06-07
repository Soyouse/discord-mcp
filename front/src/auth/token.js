/*
 * Access token JWT — gardé EN MÉMOIRE (jamais localStorage : pattern SPA sûr, anti-XSS-persistant).
 * Le refresh token vit dans un cookie HttpOnly (inaccessible au JS). http.js (Bearer) et le socket
 * (handshake) lisent le token courant via getAccessToken ; useSession le met à jour après /refresh.
 */
let _token = null;
export const getAccessToken = () => _token;
export const setAccessToken = (t) => {
  _token = t ?? null;
};
