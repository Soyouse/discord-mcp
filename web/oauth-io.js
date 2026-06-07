/**
 * I/O réseau OAuth Discord (échange de code + /users/@me). SÉPARÉ de la logique (oauth-service.js)
 * → injecté comme dep, exclu mutation (comme lib/core est injecté dans action-service). `fetch` global (Node 22).
 * ⚠️ Le client_secret ne sort QUE d'ici (POST serveur→serveur), JAMAIS vers le navigateur.
 */
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";

export function makeOauthIo({ clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  return {
    /** code d'autorisation → tokens Discord (ou null si refus/échec). */
    async exchangeCode(code) {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      });
      const res = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) return null;
      return res.json();
    },
    /** access token Discord → objet user (/users/@me). Throw si l'appel échoue. */
    async fetchUser(accessToken) {
      const res = await fetchImpl(USER_URL, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Discord /users/@me a échoué");
      return res.json();
    },
  };
}
