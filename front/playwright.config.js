import { defineConfig, devices } from "@playwright/test";

/*
 * E2E = gate anti-régression sur les PARCOURS réels (assertions DOM, cross-env safe — pas de pixels).
 * ⚠️ webServer GÉRÉ par Playwright (démarre vite dev = MSW, arrête en fin) → ZÉRO process résiduel.
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
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
