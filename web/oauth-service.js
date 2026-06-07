/**
 * Flow OAuth — orchestration PURE (toutes les I/O sont des deps INJECTÉES : échange de code, /users/@me,
 * store des refresh, signature JWT, génération aléatoire, horloge). Testable sans réseau ni base ni vrai temps.
 * ⚠️ Erreurs portent `statusCode` (400/401/403) → la route renvoie le bon code, jamais de fuite de détail.
 * ⚠️ Fail-closed : un user hors allowlist = 403 APRÈS identification (on ne crée NI access NI refresh).
 * ⚠️ Rotation systématique au refresh (révoque l'ancien, crée un neuf) = détection de rejeu.
 */
import { discordUserToPrincipal, isAllowed } from "./oauth.js";
import { hashToken, isUsable } from "./refresh-store.js";

function err(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

/**
 * Callback OAuth : code Discord → access JWT + refresh token.
 * deps = { exchangeCode(code)→tokens, fetchUser(accessToken)→user, allowedIds, store,
 *          issueAccessToken(principal)→jwt, genRefreshRaw()→string, now()→ms, refreshTtlMs, tenantId }
 */
export async function login({ code }, deps) {
  const { exchangeCode, fetchUser, allowedIds, store, issueAccessToken, genRefreshRaw, now, refreshTtlMs, tenantId } = deps;
  if (!code) throw err("code OAuth manquant", 400);

  const tokens = await exchangeCode(code);
  if (!tokens || !tokens.access_token) throw err("échange OAuth échoué", 401);

  const principal = discordUserToPrincipal(await fetchUser(tokens.access_token)); // {userId, username}
  if (!isAllowed(principal.userId, allowedIds)) throw err("accès non autorisé", 403);

  const full = { userId: principal.userId, username: principal.username, tenantId };
  const refreshRaw = genRefreshRaw();
  const expiresAt = new Date(now() + refreshTtlMs);
  await store.create({ tokenHash: hashToken(refreshRaw), userId: full.userId, username: full.username, tenantId, expiresAt });

  return { accessToken: issueAccessToken(full), refreshRaw, refreshExpiresAt: expiresAt, principal: full };
}

/** Rotation : refresh token valide → nouvel access JWT + nouveau refresh (l'ancien est révoqué). */
export async function refresh({ refreshRaw }, deps) {
  const { store, issueAccessToken, genRefreshRaw, now, refreshTtlMs } = deps;
  if (!refreshRaw) throw err("refresh token manquant", 401);

  const oldHash = hashToken(refreshRaw);
  const rec = await store.find(oldHash);
  if (!isUsable(rec, now())) throw err("session expirée", 401);

  await store.revoke(oldHash); // rotation : l'ancien ne sert plus jamais
  const newRaw = genRefreshRaw();
  const expiresAt = new Date(now() + refreshTtlMs);
  await store.create({ tokenHash: hashToken(newRaw), userId: rec.userId, username: rec.username, tenantId: rec.tenantId, expiresAt });

  const full = { userId: rec.userId, username: rec.username ?? null, tenantId: rec.tenantId };
  return { accessToken: issueAccessToken(full), refreshRaw: newRaw, refreshExpiresAt: expiresAt, principal: full };
}

/** Déconnexion : révoque le refresh courant (best-effort, idempotent). */
export async function logout({ refreshRaw }, deps) {
  if (refreshRaw) await deps.store.revoke(hashToken(refreshRaw));
}
