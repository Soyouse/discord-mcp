/*
 * E2E (Playwright) — gate anti-régression sur les PARCOURS réels du cockpit, données MSW (déterministes).
 * Assertions DOM/comportement (cross-env safe). Le serveur est géré par playwright.config (webServer).
 */
import { test, expect } from "@playwright/test";

test("login : écran de connexion Discord", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /se connecter avec discord/i })).toBeVisible();
});

test("cockpit : vue serveur = salons, bouton Home = Messages privés (Discord-like)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("général")).toBeVisible();
  // exact : "automations" (salon) matcherait aussi le titre "WebZenon · Automations" (substring insensible).
  await expect(page.getByText("automations", { exact: true })).toBeVisible();
  await page.getByTitle("Messages privés").click();
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

test("pagination : salon long → scroll haut charge les messages plus anciens (page 2)", async ({ page }) => {
  // c3 « archives » = 60 messages > PAGE_SIZE 50 → la page 1 NE contient PAS archive-1 (le plus ancien).
  await page.goto("/");
  await page.getByText("archives", { exact: true }).click();
  await expect(page.getByText("archive-60", { exact: true })).toBeVisible(); // bas du fil (autoscroll)
  // Le plus ancien n'est pas encore chargé (page 1 = les 50 derniers).
  await expect(page.getByText("archive-1", { exact: true })).toHaveCount(0);
  // Scroll haut (répété : virtualisation + compensation d'ancre) → fetchNextPage → archive-1 apparaît.
  const scroller = page.getByTestId("message-scroll");
  await expect(async () => {
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await expect(page.getByText("archive-1", { exact: true })).toBeVisible({ timeout: 700 });
  }).toPass({ timeout: 15000 });
});

test("avatar : le message du BOT affiche son image d'avatar (annuaire members, pas l'initiale)", async ({ page }) => {
  // db.members donne au bot l'avatar "mockavatarhash" → le fil doit rendre une <img> CDN, pas le fallback.
  await page.goto("/");
  await page.getByText("général", { exact: true }).click();
  await expect(page.getByText("Relais en ligne ✅")).toBeVisible(); // message du bot rendu
  await expect(page.locator('img[src*="mockavatarhash"]').first()).toBeVisible();
});

test("détails : DM → fiche du correspondant avec @username et date de création", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("Messages privés").click();
  await page.getByText("waikoz", { exact: true }).click();
  const details = page.getByLabel("Détails");
  await expect(details.getByText("@waikoz")).toBeVisible();
  await expect(details.getByText("Compte créé le", { exact: false })).toBeVisible();
});

test("détails : profil enrichi → badges (Bravery) + tag serveur (2077)", async ({ page }) => {
  // Seeds : Théo = public_flags 64 + tag "2077" avec badge (mêmes formes que le live).
  await page.goto("/");
  await page.getByTitle("Messages privés").click();
  await page.getByText("Théo", { exact: true }).click();
  const details = page.getByLabel("Détails");
  await expect(details.getByAltText("HypeSquad Bravery")).toBeVisible(); // icône officielle, tooltip = nom
  await expect(details.getByText("2077")).toBeVisible();
});

test("fil : le tag serveur de l'auteur s'affiche à côté du pseudo (comme Discord)", async ({ page }) => {
  // Seeds : soyouse (tag 2077) a écrit m2 dans #général.
  await page.goto("/");
  await page.getByText("général", { exact: true }).click();
  await expect(page.getByText("Parfait, on enchaîne sur le cockpit.")).toBeVisible();
  await expect(page.getByTestId("message-scroll").getByText("2077").first()).toBeVisible();
});

test("⌘K : la command palette s'ouvre et liste les conversations", async ({ page }) => {
  await page.goto("/");
  await page.getByText("WebZenon · Automations").click(); // focus page (titre liste = serveur actif) avant le raccourci
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByPlaceholder(/aller à une conversation/i)).toBeVisible();
});

test("DM : Home → clic ouvre le canal → composer activé", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("Messages privés").click();
  await page.getByText("waikoz", { exact: true }).click();
  await expect(page.getByLabel("Message")).toBeEnabled();
});
