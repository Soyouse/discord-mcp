import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

/*
 * 2 PROJETS (perf mesurée : jsdom+setup = ~80% du wall time, inutile pour la logique pure) :
 *  - "pure" : *.test.js  → env node, ZÉRO setup global (endpoints.test.js installe MSW lui-même).
 *  - "dom"  : *.test.jsx → jsdom + @testing-library (setup test-setup.js).
 * ⚠️ CONVENTION DURE : test de composant/hook React = .test.jsx ; logique pure = .test.js.
 *    Un test .js qui touche le DOM plantera (voulu : force le bon classement).
 *    Exception ponctuelle (fetch relatif → besoin de location) = docblock @vitest-environment jsdom
 *    en tête de fichier (cf endpoints.test.js).
 * ⚠️ Toolchain front ISOLÉE du backend (vitest racine reste node/pool threads).
 * ⚠️ EXCLURE e2e/ : specs Playwright (API @playwright/test) — vitest globe .spec.js par défaut.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // threads (PAS forks, défaut vitest 4) : −39% wall MESURÉ sur Windows (spawn process coûteux).
    // isolate:true CONSERVÉ : isolate:false mesuré = gain nul → risque d'état partagé refusé.
    pool: "threads",
    exclude: [...configDefaults.exclude, "e2e/**"],
    projects: [
      {
        extends: true,
        test: { name: "pure", environment: "node", include: ["src/**/*.test.js"] },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./src/test-setup.js"],
          include: ["src/**/*.test.jsx"],
        },
      },
    ],
  },
});
