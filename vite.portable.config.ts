import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Отдельная сборка: один самодостаточный HTML-файл (JS и CSS встроены внутрь),
// который можно отправить как обычный файл (например, через Telegram) и
// открыть напрямую в браузере телефона без сервера и установки.
// Запуск: npm run build:portable  ->  dist-portable/portable.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-portable',
    rollupOptions: {
      input: 'portable.html',
    },
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
