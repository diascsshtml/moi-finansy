export interface SubscriptionCatalogItem {
  id: string;
  name: string;
  /** 1-3-буквенная монограмма, как и в billCatalog.ts — настоящих логотипов
   *  нет, монограмма честно заменяет «стикер» сервиса. */
  icon: string;
  color: string;
}

/** Видеосервисы/стриминг — самые частые подписки. Остальное (спортзал,
 *  музыка и т.п.) заводится через «Другой сервис» вручную. */
export const SUBSCRIPTION_CATALOG: SubscriptionCatalogItem[] = [
  { id: 'netflix', name: 'Netflix', icon: 'N', color: '#E50914' },
  { id: 'youtubePremium', name: 'YouTube Premium', icon: 'YT', color: '#FF0000' },
  { id: 'kinopoisk', name: 'Кинопоиск', icon: 'K', color: '#FF5C00' },
  { id: 'ivi', name: 'Иви', icon: 'ivi', color: '#FF3D6E' },
  { id: 'okko', name: 'Okko', icon: 'O', color: '#7B2FF7' },
  { id: 'kion', name: 'KION', icon: 'K', color: '#E5004D' },
  { id: 'wink', name: 'Wink', icon: 'W', color: '#7B2FF7' },
  { id: 'start', name: 'START', icon: 'S', color: '#FF7A00' },
  { id: 'premier', name: 'PREMIER', icon: 'P', color: '#4A4A4A' },
  { id: 'spotify', name: 'Spotify', icon: 'S', color: '#1DB954' },
  { id: 'yandexPlus', name: 'Яндекс Плюс', icon: 'Я+', color: '#E8B923' },
  { id: 'icloud', name: 'iCloud', icon: 'iC', color: '#3693F3' },
  { id: 'gym', name: 'Спортзал', icon: '🏋️', color: '#1baf7a' },
];
