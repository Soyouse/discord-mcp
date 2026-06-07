/*
 * Client HTTP bas niveau (PUR, testable : fetch + token injectables).
 * ⚠️ Le front ne parle QU'À l'API web (chemins /api/*), JAMAIS à Discord direct. Token jamais en dur.
 * ⚠️ Erreur HTTP → ApiError{status} (pas un throw opaque) → react-query/UI peuvent réagir au code.
 * Le token JWT viendra de l'auth OAuth (P2b) via setTokenProvider ; aujourd'hui null (MSW ignore l'auth).
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let _getToken = () => null;
/** Branche la source du token (P2b OAuth). Seam : l'UI/tests injectent sans toucher au client. */
export function setTokenProvider(fn) {
  _getToken = fn;
}

export async function apiFetch(path, { method = "GET", body, fetchImpl = fetch, getToken = _getToken } = {}) {
  const headers = {};
  // ⚠️ content-type SEULEMENT s'il y a un body : Fastify rejette (400) un body vide quand
  //    content-type=application/json. Un POST sans corps (refresh/logout) ne doit donc PAS l'envoyer.
  if (body != null) headers["content-type"] = "application/json";
  const token = getToken?.();
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetchImpl(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error || res.statusText || "erreur API", res.status);
  }
  return data;
}
