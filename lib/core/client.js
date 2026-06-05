/**
 * Client Discord — wrap @discordjs/rest (rate-limit par bucket + retries 429/5xx AUTO).
 *
 * ⚠️ Brique battle-tested (685k DL/sem, org discord.js) — NE PAS réinventer le rate-limit.
 * ⚠️ Token rechargé À CHAUD depuis .secrets.json (watch mtime) — aucun restart MCP au reset.
 * ⚠️ Token JAMAIS en dur, jamais committé (.secrets.json est gitignore).
 */
import { REST } from "@discordjs/rest";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH =
  process.env.DISCORD_SECRETS_PATH || join(here, "..", "..", ".secrets.json");

let rest = null;
let loadedToken = null;
let loadedMtime = 0;

async function loadToken() {
  const { mtimeMs } = await stat(SECRETS_PATH);
  if (mtimeMs !== loadedMtime) {
    // hot-reload : le fichier a changé → relire + ré-initialiser REST
    const { token } = JSON.parse(await readFile(SECRETS_PATH, "utf8"));
    if (!token) throw new Error(".secrets.json : champ `token` manquant");
    loadedToken = token;
    loadedMtime = mtimeMs;
    rest = null;
  }
  return loadedToken;
}

async function getRest() {
  const token = await loadToken();
  if (!rest) rest = new REST({ version: "10" }).setToken(token);
  return rest;
}

const METHODS = { GET: "get", POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete" };

/**
 * Appel brut à N'IMPORTE QUEL endpoint REST de Discord (couverture 100 %).
 * @param {string} method GET|POST|PUT|PATCH|DELETE
 * @param {string} endpoint ex: "/guilds/{id}/channels"
 * @param {object} [payload] corps JSON (POST/PATCH/PUT)
 */
export async function discordCall(method, endpoint, payload) {
  const verb = METHODS[String(method).toUpperCase()];
  if (!verb) throw new Error(`Méthode non supportée : ${method}`); // ⚠️ AVANT le token (testable offline)
  const route = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const client = await getRest();
  const opts = payload != null ? { body: payload } : undefined;
  return client[verb](route, opts);
}
