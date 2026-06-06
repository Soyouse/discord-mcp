/*
 * Harnais de validation visuelle AUTONOME (réutilisé à chaque sous-phase P5).
 * Lance chromium headless contre un serveur déjà démarré (vite preview/dev) et capture
 * des écrans en PNG dans D:/Screenshots. AUCUNE intervention humaine.
 *
 * Usage : node scripts/shot.mjs [baseURL]   (défaut http://127.0.0.1:4173)
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:4173";
const OUT = "D:/Screenshots";
const routes = [
  { path: "/login", name: "front-login" },
  { path: "/", name: "front-cockpit" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const r of routes) {
  await page.goto(base + r.path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${r.name}.png` });
  process.stderr.write(`shot ${r.name} <- ${r.path}\n`);
}
await browser.close();
