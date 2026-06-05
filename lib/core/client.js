/**
 * Client Discord MULTI-BOT — wrap @discordjs/rest (rate-limit par bucket + retries 429/5xx AUTO).
 *
 * ⚠️ Brique battle-tested (685k DL/sem, org discord.js) — NE PAS réinventer le rate-limit.
 * ⚠️ Rate-limit @discordjs/rest = PAR-TOKEN → 1 instance REST PAR bot (Map), jamais partagée.
 * ⚠️ Tokens rechargés À CHAUD depuis .secrets.json (watch mtime) — aucun restart au reset.
 * ⚠️ Tokens JAMAIS en dur, jamais committés (.secrets.json est gitignore).
 *
 * Schéma .secrets.json (multi-bot) :
 *   { "default": "echidna", "bots": { "echidna": { "token": "...", "application_id": "..." } } }
 * Rétrocompat (legacy mono-bot) : { "token": "...", "application_id": "..." } → bot "default".
 *
 * Résolution du bot pour un appel (ordre) : opts.bot explicite > défaut de session > défaut secrets.
 * ⚠️ Le « défaut de session » est un état module-global : SÛR uniquement en transport mono-session
 *    (stdio). En HTTP multi-tenant, TOUJOURS passer `bot` explicite par appel (ou scoper par session).
 */
import { REST } from "@discordjs/rest";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH =
  process.env.DISCORD_SECRETS_PATH || join(here, "..", "..", ".secrets.json");

const METHODS = { GET: "get", POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete" };

// État rechargé à chaud. restByBot = Map<botId, REST> — purgée à chaque changement de fichier.
let bots = null; // { [id]: { token, application_id } }
let defaultBot = null;
let loadedMtime = -1;
const restByBot = new Map();
// ⚠️ PAS d'état de session ICI. Le bot de session est PAR-SESSION (ctx.session.bot), pas un global
//    de process : sinon il FUIT entre sessions HTTP concurrentes (2 agents → l'un écrase l'autre).
//    Voir build-server.js (crée le holder par session) + handlers (le folent dans opts.bot).

/**
 * Normalise les deux schémas (multi-bot ET legacy mono-bot) vers une forme unique.
 * ⚠️ Exporté pour test offline — ne touche AUCUN réseau.
 */
export function normalizeSecrets(raw) {
  if (raw && typeof raw === "object" && raw.bots && typeof raw.bots === "object") {
    const ids = Object.keys(raw.bots);
    if (ids.length === 0) throw new Error(".secrets.json : `bots` est vide");
    for (const id of ids) {
      if (!raw.bots[id]?.token) throw new Error(`.secrets.json : bot \`${id}\` sans token`);
    }
    const def = raw.default || ids[0];
    if (!raw.bots[def]) throw new Error(`.secrets.json : default \`${def}\` absent de bots`);
    return { bots: raw.bots, defaultBot: def };
  }
  if (raw && typeof raw === "object" && raw.token) {
    // legacy mono-bot → bot "default"
    return {
      bots: { default: { token: raw.token, application_id: raw.application_id } },
      defaultBot: "default",
    };
  }
  throw new Error(".secrets.json : ni `bots` ni `token` — format invalide");
}

async function loadSecrets() {
  const { mtimeMs } = await stat(SECRETS_PATH);
  if (mtimeMs !== loadedMtime) {
    const raw = JSON.parse(await readFile(SECRETS_PATH, "utf8"));
    const norm = normalizeSecrets(raw);
    bots = norm.bots;
    defaultBot = norm.defaultBot;
    loadedMtime = mtimeMs;
    restByBot.clear(); // ⚠️ purge obligatoire : un token a pu changer
  }
}

/**
 * Résout l'id du bot à utiliser pour un appel (sans réseau).
 * Ordre : explicite > session > défaut secrets. Throw si l'id demandé n'existe pas.
 */
export function resolveBotId(requested) {
  // Précédence explicite > défaut. La couche session (ctx.session.bot) est foldée dans `requested`
  // par les handlers AVANT d'appeler ici → précédence finale : arg explicite > session > défaut.
  const id = requested || defaultBot;
  if (!bots[id]) {
    const known = Object.keys(bots).join(", ");
    throw new Error(`Bot inconnu : ${id} (disponibles : ${known})`);
  }
  return id;
}

function getRest(botId) {
  let rest = restByBot.get(botId);
  if (!rest) {
    rest = new REST({ version: "10" }).setToken(bots[botId].token);
    restByBot.set(botId, rest);
  }
  return rest;
}

/** Remet l'état à zéro (cache REST, mtime, session) — réservé aux tests. */
export function _resetClient() {
  bots = null;
  defaultBot = null;
  loadedMtime = -1;
  restByBot.clear();
}

/** Liste les ids de bots configurés (offline). Recharge à chaud. */
export async function listBots() {
  await loadSecrets();
  return { bots: Object.keys(bots), default: defaultBot };
}

/** Valide qu'un bot existe (throw sinon). Le STOCKAGE du choix est PAR-SESSION (ctx.session.bot),
 *  jamais un global de process — voir build-server.js. Utilisé par discord_switch_bot avant de committer. */
export async function assertBot(id) {
  await loadSecrets();
  if (!bots[id]) {
    const known = Object.keys(bots).join(", ");
    throw new Error(`Bot inconnu : ${id} (disponibles : ${known})`);
  }
  return id;
}

/**
 * Appel brut à N'IMPORTE QUEL endpoint REST de Discord (couverture 100 %).
 * @param {string} method GET|POST|PUT|PATCH|DELETE
 * @param {string} endpoint ex: "/guilds/{id}/channels"
 * @param {object} [payload] corps JSON (POST/PATCH/PUT)
 * @param {object} [opts] { bot } — id du bot ; défaut = session puis secrets.default
 */
export async function discordCall(method, endpoint, payload, opts = {}) {
  const verb = METHODS[String(method).toUpperCase()];
  if (!verb) throw new Error(`Méthode non supportée : ${method}`); // ⚠️ AVANT le token (testable offline)
  await loadSecrets();
  const botId = resolveBotId(opts.bot);
  const route = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const client = getRest(botId);
  const reqOpts = payload != null ? { body: payload } : undefined;
  return client[verb](route, reqOpts);
}
