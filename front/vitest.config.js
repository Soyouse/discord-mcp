import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests COMPOSANTS : environnement jsdom (DOM simulé) + @testing-library/react.
// ⚠️ Toolchain front ISOLÉE du backend (vitest racine reste node/pool threads).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
  },
});
