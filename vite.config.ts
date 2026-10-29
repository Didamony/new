import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const demo = process.env.VITE_DEMO === "1";

export default defineConfig({
  base: "./",
  // The preview build is published as one page; its sandboxed frame can't load extra script files.
  build: demo ? { rolldownOptions: { output: { codeSplitting: false } } } : {},
  plugins: [
    react(),
    VitePWA({
      // the preview build runs inside a frame where service workers aren't allowed
      disable: demo,
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ذاكرلي — Zakerly",
        short_name: "ذاكرلي",
        description: "مساعدك الذكي للمذاكرة: لخّص، اسأل، واختبر نفسك من أي كتاب أو صورة.",
        lang: "ar",
        dir: "rtl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1020",
        theme_color: "#6d5efc",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,mjs,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
