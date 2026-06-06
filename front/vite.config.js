import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// SPA statique (servie par nginx en prod). Tailwind v4 = plugin Vite (CSS-first, zéro postcss).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Code-splitting (P6) : isole les gros vendors dans des chunks au hash STABLE → mis en cache
    // long séparément (cf nginx /assets immuable) et non re-téléchargés quand le code applicatif change.
    // ⚠️ N'affecte QUE le build prod ; vitest n'utilise pas cette config (toolchains séparées).
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "@tanstack/react-virtual"],
          markdown: ["react-markdown", "remark-gfm"],
          realtime: ["socket.io-client"],
        },
      },
    },
  },
  server: {
    // En dev, l'API web (Fastify) tourne ailleurs → proxy /api et /socket.io vers elle.
    // ⚠️ Le front ne parle JAMAIS à Discord direct : il tape SEULEMENT l'API web (token jamais ici).
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/socket.io": { target: "http://127.0.0.1:8080", ws: true, changeOrigin: true },
    },
  },
});
