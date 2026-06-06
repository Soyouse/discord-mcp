/*
 * Harnais de validation visuelle AUTONOME et AUTO-SUFFISANT (réutilisé à chaque sous-phase).
 * ⚠️ Démarre LUI-MÊME le serveur vite (dev = MSW actif), attend le port avec un TIMEOUT BORNÉ,
 *    capture, puis TUE le serveur dans un `finally` GARANTI (arbre de process inclus sur Windows).
 *    → un seul `node scripts/shot.mjs`, ZÉRO tâche/serveur résiduel. JAMAIS d'`until` infini.
 *
 * Usage : node scripts/shot.mjs            (lance vite dev + screenshots + teardown)
 *         node scripts/shot.mjs <baseURL>  (serveur déjà lancé : capture seulement, pas de teardown)
 */
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import process from "node:process";

const OUT = "D:/Screenshots";
const externalBase = process.argv[2] || null; // si fourni, on NE gère PAS le serveur
const READY_TIMEOUT_MS = 30_000;

/** Tue un process ET son arbre (vite spawn des enfants ; sur Windows il faut /T). */
function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
    /* déjà mort */
  }
}

/** Démarre vite dev et résout l'URL (http://localhost:PORT) dès qu'elle apparaît, sinon throw (timeout). */
function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      shell: process.platform === "win32", // npm.cmd sur Windows
      detached: process.platform !== "win32", // groupe de process tuable côté Unix
    });
    const timer = setTimeout(() => {
      killTree(child.pid);
      reject(new Error(`serveur non prêt après ${READY_TIMEOUT_MS}ms`));
    }, READY_TIMEOUT_MS);

    const onData = (buf) => {
      // ⚠️ vite colore le port en ANSI (localhost:\x1b[1m5173) → STRIP l'ANSI avant de matcher.
      const clean = String(buf).replace(/\x1b\[[0-9;]*m/g, "");
      const m = clean.match(/localhost:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, url: `http://localhost:${m[1]}` });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`vite a quitté (code ${code}) avant d'être prêt`));
    });
  });
}

async function capture(base) {
  const routes = [
    { path: "/login", name: "front-login" },
    { path: "/", name: "front-cockpit" },
  ];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    for (const r of routes) {
      await page.goto(base + r.path, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${OUT}/${r.name}.png` });
      process.stderr.write(`shot ${r.name} <- ${r.path}\n`);
    }

    await page.goto(base + "/", { waitUntil: "networkidle" });
    const conv = page.getByText("général", { exact: true }).first();
    if (await conv.count()) {
      await conv.click();
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/front-cockpit-active.png` });
      process.stderr.write("shot front-cockpit-active <- clic #général\n");

      await page.getByLabel("Message").fill("Message envoyé depuis le cockpit ✨");
      await page.getByRole("button", { name: /envoyer/i }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/front-cockpit-sent.png` });
      process.stderr.write("shot front-cockpit-sent <- envoi message\n");

      await page.keyboard.press("Control+k");
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/front-cmdk.png` });
      process.stderr.write("shot front-cmdk <- Ctrl+K\n");
    }
  } finally {
    await browser.close();
  }
}

// --- Orchestration : teardown GARANTI même en cas d'erreur. ---
if (externalBase) {
  await capture(externalBase);
} else {
  const { child, url } = await startServer();
  try {
    await capture(url);
  } finally {
    killTree(child.pid); // ⚠️ le serveur ne survit JAMAIS à ce script
  }
}
