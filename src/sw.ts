/// <reference lib="webworker" />
// Собственный service worker (injectManifest) вместо автогенерированного —
// он нужен, чтобы обрабатывать push-события (напоминания раз в час), чего
// generateSW-режим workbox не умеет. Кеширование/офлайн остаются прежними.

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

interface ReminderPayload {
  title?: string;
  body?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: ReminderPayload = {};
  try {
    data = event.data ? (event.data.json() as ReminderPayload) : {};
  } catch {
    // не JSON — покажем как есть с текстом по умолчанию
  }
  const title = data.title || 'Мои финансы';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag || 'reminder',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      const existing = clientsList.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    }),
  );
});
