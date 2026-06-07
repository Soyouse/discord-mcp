/**
 * Routes OAuth (PUBLIQUES — hors guard JWT) : login → callback → refresh → logout.
 * ⚠️ I/O fine (cookies, redirections, signature JWT, aléatoire) ; toute la LOGIQUE est dans oauth-service.js.
 * ⚠️ Cookies : refresh token en cookie HttpOnly+Secure+SameSite=Lax, path /api/auth (jamais envoyé aux
 *    routes de données → surface minimale). L'ACCESS token n'est JAMAIS en cookie ni en URL : il est rendu
 *    en JSON par /refresh et gardé EN MÉMOIRE côté front (pattern SPA : refresh httpOnly + access en RAM).
 * ⚠️ state anti-CSRF : cookie signé comparé au paramètre `state` du retour Discord.
 */
import crypto from "node:crypto";
import { buildAuthorizeUrl } from "./oauth.js";
import * as oauthService from "./oauth-service.js";

const COOKIE_PATH = "/api/auth";
const STATE_TTL_S = 600; // 10 min pour finir le round-trip Discord

export function authRoutes({ config, store, oauthIo }) {
  const { clientId, redirectUri, allowedIds, accessTtl, refreshTtlMs, tenantId, scope } = config;

  return async function (fastify) {
    const issueAccessToken = (p) =>
      fastify.jwt.sign({ sub: p.userId, username: p.username ?? null, tenant: p.tenantId }, { expiresIn: accessTtl });
    const genRaw = () => crypto.randomBytes(32).toString("hex");
    const deps = {
      ...oauthIo,
      allowedIds,
      store,
      issueAccessToken,
      genRefreshRaw: genRaw,
      now: () => Date.now(),
      refreshTtlMs,
      tenantId,
    };
    const refreshOpts = { httpOnly: true, secure: true, sameSite: "lax", path: COOKIE_PATH, maxAge: Math.floor(refreshTtlMs / 1000) };

    // 1) Démarre le flow : pose le state anti-CSRF et redirige vers Discord.
    fastify.get("/api/auth/login", async (_req, reply) => {
      const state = genRaw();
      reply.setCookie("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: COOKIE_PATH, signed: true, maxAge: STATE_TTL_S });
      return reply.redirect(buildAuthorizeUrl({ clientId, redirectUri, state, scope }));
    });

    // 2) Retour Discord : vérifie le state, échange le code, pose le refresh cookie, renvoie au front.
    fastify.get("/api/auth/callback", async (req, reply) => {
      const { code, state } = req.query ?? {};
      const raw = req.cookies?.oauth_state;
      const unsigned = raw ? fastify.unsignCookie(raw) : { valid: false, value: null };
      reply.clearCookie("oauth_state", { path: COOKIE_PATH });
      if (!state || !unsigned.valid || unsigned.value !== state) {
        return reply.redirect("/login?error=state");
      }
      try {
        const { refreshRaw } = await oauthService.login({ code }, deps);
        reply.setCookie("refresh_token", refreshRaw, refreshOpts);
        return reply.redirect("/");
      } catch (e) {
        return reply.redirect(`/login?error=${e.statusCode === 403 ? "forbidden" : "login"}`);
      }
    });

    // 3) Échange le refresh cookie contre un access JWT frais (rotation du refresh au passage).
    fastify.post("/api/auth/refresh", async (req, reply) => {
      try {
        const out = await oauthService.refresh({ refreshRaw: req.cookies?.refresh_token }, deps);
        reply.setCookie("refresh_token", out.refreshRaw, refreshOpts);
        return reply.send({ accessToken: out.accessToken, user: { userId: out.principal.userId, username: out.principal.username } });
      } catch (e) {
        reply.clearCookie("refresh_token", { path: COOKIE_PATH });
        return reply.code(e.statusCode ?? 401).send({ error: "unauthorized" });
      }
    });

    // 4) Déconnexion : révoque le refresh + efface le cookie.
    fastify.post("/api/auth/logout", async (req, reply) => {
      await oauthService.logout({ refreshRaw: req.cookies?.refresh_token }, deps);
      reply.clearCookie("refresh_token", { path: COOKIE_PATH });
      return reply.code(204).send();
    });
  };
}
