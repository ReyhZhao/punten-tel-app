import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Lokaal: /api naar de Django-backend (cd backend && manage.py runserver).
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Puntenteller',
        short_name: 'Puntenteller',
        description: 'Punten bijhouden voor bordspellen',
        theme_color: '#FF5A3C',
        background_color: '#FAF6EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // De backend draait op hetzelfde domein: /api en /admin niet door de
        // service worker laten afvangen (anders toont /admin de PWA).
        // Ook de statische pagina's (privacybeleid, support) niet als app tonen.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/healthz$/, /^\/privacy/, /^\/support/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
