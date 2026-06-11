/*
 * E2E (Playwright) — gate anti-régression sur les PARCOURS réels du cockpit, données MSW (déterministes).
 * Assertions DOM/comportement (cross-env safe). Le serveur est géré par playwright.config (webServer).
 */
import { test, expect } from "@playwright/test";

test("login : écran de connexion Discord", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /se connecter avec discord/i })).toBeVisible();
});

test("cockpit : charge salons + DMables via l'API (MSW)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("général")).toBeVisible();
  // exact : "automations" (salon) matcherait aussi le titre "WebZenon · Automations" (substring insensible).
  await expect(page.getByText("automations", { exact: true })).toBeVisible();
  await expect(page.getByText("waikoz")).toBeVisible();
});

test("salon : clic → header + historique rendu (fil virtualisé)", async ({ page }) => {
  await page.goto("/");
  await page.getByText("général", { exact: true }).click();
  await expect(page.getByText("# général")).toBeVisible();
  await expect(page.getByText("Relais en ligne ✅")).toBeVisible();
  await expect(page.getByText("Markdown OK :", { exact: false })).toBeVisible();
});

test("envoi : message optimiste apparaît dans le fil", async ({ page }) => {
  await page.goto("/");
  await page.getByText("général", { exact: true }).click();
  await page.getByLabel("Message").fill("E2E ping");
  await page.getByRole("button", { name: /envoyer/i }).click();
  await expect(page.getByText("E2E ping")).toBeVisible();
});

test("⌘K : la command palette s'ouvre et liste les conversations", async ({ page }) => {
  await page.goto("/");
  await page.getByText("WebZenon · Automations").click(); // focus page (titre liste = serveur actif) avant le raccourci
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByPlaceholder(/aller à une conversation/i)).toBeVisible();
});

test("DM : clic ouvre le canal → composer activé", async ({ page }) => {
  await page.goto("/");
  await page.getByText("waikoz", { exact: true }).click();
  await expect(page.getByLabel("Message")).toBeEnabled();
});
