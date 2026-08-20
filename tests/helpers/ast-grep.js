// ─────────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE de l'INVOCATION d'ast-grep par les gates (outil de test, jamais du prod).
//
// ⚠️ Ce code est un NID À PIÈGES (code de sortie NON-ZÉRO **normal** quand la règle trouve,
//    shell Windows, binaire local `node_modules/.bin`, cache par règle). Toute 2ᵉ copie
//    divergerait au premier piège corrigé d'un seul côté.
//
// ⚠️ Ce module est un OUTIL DE TEST : ni importé par du code de production, ni muté par
//    Stryker (aucune décision dedans — il transporte, il ne juge pas).
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ⚠️ PÉRIMÈTRE = tout le code qui TOURNE, y compris le front (`front/src` : un rendu de
//    MILLIERS de messages est exactement là où un O(N²) ferme un contrat).
//    JAMAIS `tests/` : un test a le droit de boucler, il ne prend aucune décision de prod.
//    Élargir cette liste est un CLIQUET : un dossier exécutable absent est un ANGLE MORT.
export const PERIMETRE_CODE = [
  "server.js",
  "http.js",
  "dispatch.js",
  "incidents.js",
  "handlers",
  "lib",
  "relay",
  "web",
  "scripts",
  "front/src",
];

// ⚠️ Les tests du front sont COLOCALISÉS avec le code (`*.test.jsx`) : il n'existe donc AUCUN
//    dossier à retirer du périmètre, seulement des fichiers. Même raison que l'exclusion de
//    `tests/` — et `mocks/` est du double de test (msw), pas du code qui sert un client.
//    🛑 NE JAMAIS y ajouter d'exclusion pour faire taire un rouge : la politique vit dans le
//    budget (tests/quadratique-gate.test.js), JAMAIS ici.
export const GLOBS_HORS_PERIMETRE = ["!**/*.test.*", "!**/mocks/**"];

// ⚠️ CACHE PAR (règle × racine × périmètre) — obligatoire. Le source ne change pas PENDANT le
//    run ; sans cache chaque volet relancerait un scan. Un gate ne doit jamais coûter assez
//    cher pour faire rougir un AUTRE test : une suite qui rougit au hasard cesse d'être lue.
const _cache = new Map();

/** Vide le cache — À APPELER dès qu'un leurre est écrit ou retiré, sinon un test suivant
 *  lirait un cache CONTAMINÉ. */
export function invaliderCacheAstGrep() {
  _cache.clear();
}

function binAstGrep(racine) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  const local = path.join(racine, "node_modules", ".bin", `ast-grep${ext}`);
  // ⚠️ FAIL-CLOSED : binaire manquant ⇒ on LÈVE. Rendre un résultat vide passerait pour
  //    « aucune occurrence » — un gate muet est un gate mort, la pire panne possible ici.
  if (!fs.existsSync(local)) {
    throw new Error(
      "ast-grep introuvable dans node_modules/.bin — `npm install`. " +
        "⚠️ NE PAS neutraliser ce gate : sans lui, la détection AST redevient invisible."
    );
  }
  return local;
}

/**
 * Scanne le périmètre avec une règle et rend { "chemin/relatif.js": nombre d'occurrences }.
 * ⚠️ CLÉ = LE CHEMIN RELATIF, jamais le basename : ce dépôt porte plusieurs `server.js`,
 *    `config.js`, `lib/` — deux fichiers homonymes fondus en une ligne rendraient le budget
 *    ininterprétable ET un rouge non actionnable.
 * @param {string} nom nom de la règle dans `rules/` (sans `.yml`)
 * @param {string} racine racine du dépôt
 * @param {string[]} [perimetre]
 * @param {string[]} [globs]
 */
export function scanRegle(nom, racine, perimetre = PERIMETRE_CODE, globs = GLOBS_HORS_PERIMETRE) {
  const cle = `${nom} ${racine} ${perimetre.join(",")} ${globs.join(",")}`;
  if (_cache.has(cle)) return _cache.get(cle);
  const res = scanRegleSansCache(nom, racine, perimetre, globs);
  _cache.set(cle, res);
  return res;
}

/** Même chose, sans cache (usage : negative-check qui vient d'écrire un leurre). */
export function scanRegleSansCache(nom, racine, perimetre = PERIMETRE_CODE, globs = GLOBS_HORS_PERIMETRE) {
  const bin = binAstGrep(racine);
  const args = ["scan", "-r", path.join(racine, "rules", `${nom}.yml`), ...perimetre];
  for (const g of globs) args.push("--globs", g);
  args.push("--json=compact");
  let out;
  try {
    // ⚠️ Règle passée par FICHIER YAML, jamais un motif en argv : sur Windows l'invocation
    //    passe par cmd.exe, qui découperait le motif à chaque espace.
    out = execFileSync(bin, args, {
      cwd: racine,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    });
  } catch (err) {
    // ⚠️ ast-grep sort en code NON-ZÉRO dès qu'il TROUVE une occurrence (comportement normal
    //    d'un linter en `severity: error`). NE PAS traiter ça comme un échec : le JSON attendu
    //    est dans `err.stdout`. Sans ce catch, le gate échouerait TOUJOURS, y compris au vert.
    if (typeof err.stdout !== "string") throw err; // vrai échec (règle invalide, binaire cassé)
    out = err.stdout;
  }
  const par = {};
  for (const m of JSON.parse(out || "[]")) {
    const f = String(m.file).split("\\").join("/");
    par[f] = (par[f] || 0) + 1;
  }
  return par;
}
