import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  // Разрешаем любой Host-заголовок — нужно, чтобы сервер был доступен через
  // временные туннели (cloudflared и т.п.) с постоянно меняющимся доменом.
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    // Свой service worker (src/sw.ts) вместо автогенерируемого — нужен для
    // обработки push-событий (часовые напоминания). skipWaiting/clientsClaim
    // там настроены вручную — тот же эффект, что раньше давали
    // workbox.skipWaiting/clientsClaim в generateSW-режиме.
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    },
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Мои финансы',
      short_name: 'Финансы',
      description: 'Личный учёт доходов, расходов, долгов и баланса',
      theme_color: '#2a78d6',
      background_color: '#f9f9f7',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'ru',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  }), cloudflare()],
});