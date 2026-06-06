import { defineConfig, devices } from "@playwright/test";

/*
 * E2E = gate anti-régression sur les PARCOURS réels (assertions DOM, cross-env safe — pas de pixels).
 * ⚠️ webServer = `preview` (build statique `--mode e2e` AVEC MSW), PAS `vite dev` : pratique Big Tech
 *    (serveur production-ish, pas le watcher HMR). Le watcher dev s'orphelinait sur Windows (SIGTERM ignoré)
 *    → fuites accumulées entre sessions. preview = cycle de vie simple, géré+arrêté par Playwright.
 *    ⚠️ Windows ignore SIGTERM → garantie DURE de non-fuite = l'éphémère CI ; en local on réduit le risque.
 * ⚠️ `--mode e2e` (cf .env.e2e + main.jsx) embarque MSW dans le build (sinon le front taperait le vrai /api).
 * Port dédié + strictPort → échec net si occupé (pas de dérive silencieuse de port).
 * Visual regression pixel (toHaveScreenshot) = P6 avec rendu Docker épinglé (sinon flaky Windows↔CI).
 */
const PORT = 4399;
const base = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: base, trace: "on-first-retry" },
  webServer: {
    // build:e2e (mode e2e = MSW embarqué) PUIS preview du statique sur le port dédié.
    command: `npm run build:e2e && npm run preview -- --port ${PORT} --strictPort`,
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // build + preview au 1er lancement → marge (le watcher dev démarrait plus vite)
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
