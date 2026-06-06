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

// Interaction : sélectionner une conversation → fil + composer actifs (état peuplé).
await page.goto(base + "/", { waitUntil: "networkidle" });
const conv = page.getByText("général", { exact: true }).first();
if (await conv.count()) {
  await conv.click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/front-cockpit-active.png` });
  process.stderr.write("shot front-cockpit-active <- clic #général\n");

  // Envoi optimiste : taper + envoyer → le message apparaît (confirmé par la réponse mock).
  await page.getByLabel("Message").fill("Message envoyé depuis le cockpit ✨");
  await page.getByRole("button", { name: /envoyer/i }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/front-cockpit-sent.png` });
  process.stderr.write("shot front-cockpit-sent <- envoi message\n");
}
await browser.close();
