// Точка входа для портативной сборки — один HTML-файл, который можно
// открыть напрямую (file://), например после скачивания из Telegram.
// Без регистрации service worker: при открытии из файла (не с сервера
// по http/https) браузеры не разрешают его регистрировать, а само
// приложение при этом работает полностью — данные хранятся в IndexedDB.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/theme.css';
import './styles/app.css';
import App from './App.tsx';
import { ensureSeeded } from './db/seed';

async function bootstrap() {
  await ensureSeeded();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
