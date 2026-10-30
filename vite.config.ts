import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const demo = process.env.VITE_DEMO === "1";

/** The app page lives in /app/, but the web manifest sits at the site root. */
const appManifestLink: Plugin = {
  name: "app-manifest-link",
  apply: "build",
  writeBundle(options) {
    const file = resolve(options.dir ?? "dist", "app/index.html");
    if (!existsSync(file)) return;
    writeFileSync(file, readFileSync(file, "utf8").replace('href="./manifest.webmanifest"', 'href="../manifest.webmanifest"'));
  },
};

export default defineConfig({
  base: "./",
  // The preview build is published as one page; its sandboxed frame can't load extra script files.
  // Two pages: the website at the root and the app under /app/. The demo build is the app alone.
  build: demo
    ? { rolldownOptions: { input: resolve(__dirname, "app/index.html"), output: { codeSplitting: false } } }
    : { rolldownOptions: { input: { site: resolve(__dirname, "index.html"), app: resolve(__dirname, "app/index.html") } } },
  plugins: [
    react(),
    appManifestLink,
    VitePWA({
      // registered by hand in main.tsx: the worker lives at the site root, one level above the app
      injectRegister: false,
      // the preview build runs inside a frame where service workers aren't allowed
      disable: demo,
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "ذاكرلي — Zakerly",
        short_name: "ذاكرلي",
        description: "مساعدك الذكي للمذاكرة: لخّص، اسأل، واختبر نفسك من أي كتاب أو صورة.",
        lang: "ar",
        dir: "rtl",
        // an installed app opens straight into the app, not the website
        start_url: "./app/",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1020",
        theme_color: "#6d5efc",
        icons: [
          { src: "icon-192.png?v=3", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png?v=3", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // each page is precached on its own; don't serve the website for app URLs offline
        navigateFallback: null,
        // home-screen icons are fetched straight from the network, never from the offline cache
        globIgnores: ["**/apple-touch-icon.png", "**/icon-*.png"],
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
