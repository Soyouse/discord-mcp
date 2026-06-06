import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// SPA statique (servie par nginx en prod). Tailwind v4 = plugin Vite (CSS-first, zéro postcss).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En dev, l'API web (Fastify) tourne ailleurs → proxy /api et /socket.io vers elle.
    // ⚠️ Le front ne parle JAMAIS à Discord direct : il tape SEULEMENT l'API web (token jamais ici).
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/socket.io": { target: "http://127.0.0.1:8080", ws: true, changeOrigin: true },
    },
  },
});
