import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests COMPOSANTS : environnement jsdom (DOM simulé) + @testing-library/react.
// ⚠️ Toolchain front ISOLÉE du backend (vitest racine reste node/pool threads).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
    // ⚠️ EXCLURE e2e/ : ce sont des specs Playwright (API @playwright/test) — vitest globe .spec.js par
    //    défaut et planterait dessus. Les deux mondes ne se croisent jamais.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
