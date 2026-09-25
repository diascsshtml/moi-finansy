import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './styles/theme.css';
import './styles/app.css';
import App from './App.tsx';
import { ensureSeeded } from './db/seed';

// immediate — регистрируем SW сразу; onRegisteredSW — сами периодически
// проверяем сервер на новую версию (раз в час), а не полагаемся только на
// проверку при обычной навигации — на телефоне вкладка/PWA может неделями
// не перезагружаться сама по себе.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

async function bootstrap() {
  await ensureSeeded();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
