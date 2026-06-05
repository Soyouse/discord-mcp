/**
 * Monitor des réponses invalides (401/403/429) — DRAPEAU ORANGE de la recherche.
 *
 * ⚠️ POURQUOI : l'« invalid request limit » de Discord (10 000 réponses 401/403/429 / 10 min) est
 *    PAR-IP, pas par-token. Un seul bot fautif sur le VPS peut faire bannir TOUS les bots de l'IP.
 *    On compte donc en fenêtre glissante, global ET par bot, pour repérer le coupable AVANT le ban.
 * ⚠️ État module-global ASSUMÉ ICI : ce sont des métriques agrégées (par nature globales au process),
 *    PAS de l'état par-appel (cf incidents.js qui, lui, DOIT rester scopé). Ne pas confondre.
 * ⚠️ Horloge injectable (now) → tests déterministes, jamais de flake temporel.
 */
const INVALID = new Set([401, 403, 429]);
const WINDOW_MS = 10 * 60 * 1000; // fenêtre Discord = 10 min
const HARD_LIMIT = 10000; // seuil de ban Discord (par IP)
const WARN_RATIO = 0.2; // alerte bien avant (runaway loop) → 2000 / 10 min

let events = []; // [{ ts, bot, status }]

/** Enregistre une réponse SI elle est invalide (401/403/429). No-op sinon. */
export function recordResult(bot, status, now = Date.now) {
  if (!INVALID.has(status)) return;
  events.push({ ts: now(), bot: bot || "(défaut)", status });
}

function prune(t) {
  const cutoff = t - WINDOW_MS;
  if (events.length && events[0].ts < cutoff) {
    events = events.filter((e) => e.ts >= cutoff);
  }
}

/** Photo de la fenêtre glissante : total, par bot, et alerte si on grimpe vers le ban-IP. */
export function snapshot(now = Date.now) {
  const t = now();
  prune(t);
  const perBot = {};
  for (const e of events) perBot[e.bot] = (perBot[e.bot] || 0) + 1;
  const total = events.length;
  return {
    windowMinutes: WINDOW_MS / 60000,
    invalidTotal: total,
    perBot,
    hardLimit: HARD_LIMIT,
    warn: total >= HARD_LIMIT * WARN_RATIO,
  };
}

/** Remise à zéro — réservé aux tests. */
export function _reset() {
  events = [];
}
