import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addDays, format, isToday, isTomorrow, setHours, setMinutes } from 'date-fns';
import { kk, ru } from 'date-fns/locale';
import i18n from '../i18n';
import {
  getNotificationPrefs,
  isPushSupported,
  saveNotificationPrefs,
  sendTestReminder,
  type NotificationPrefs,
} from '../utils/pushNotifications';

const BILLS_DAY_OPTIONS = [7, 3, 2, 1, 0];

const DEFAULT_PREFS: NotificationPrefs = {
  timezone: 'Asia/Almaty',
  dailyEnabled: false,
  dailyTime: '20:00',
  billsEnabled: false,
  billsDaysBefore: [1],
  billsTime: '10:00',
};

function dateFnsLocale() {
  return i18n.language === 'kk' ? kk : ru;
}

/** Ближайший момент, когда наступит указанное время (HH:mm) — сегодня, если
 *  оно ещё впереди, иначе завтра. Только для превью на странице, сама
 *  отправка считается на сервере (см. worker/notifications.ts). */
function nextOccurrence(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  let next = setMinutes(setHours(now, h), m);
  if (next.getTime() <= now.getTime()) next = addDays(next, 1);
  return next;
}

function formatNextOccurrence(time: string, t: (key: string) => string): string {
  const next = nextOccurrence(time);
  if (isToday(next)) return `${t('notifications.today')}, ${time}`;
  if (isTomorrow(next)) return `${t('notifications.tomorrow')}, ${time}`;
  return format(next, 'd MMMM', { locale: dateFnsLocale() }) + `, ${time}`;
}

export function NotificationsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const supported = isPushSupported();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    getNotificationPrefs()
      .then(setPrefs)
      .catch(() => setError(t('notifications.loadError')))
      .finally(() => setLoading(false));
  }, [supported, t]);

  const save = async (next: NotificationPrefs) => {
    setPrefs(next);
    setError(null);
    try {
      await saveNotificationPrefs(next);
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'permission-denied'
          ? t('notifications.permissionDenied')
          : t('notifications.saveError'),
      );
    }
  };

  const toggleDay = (day: number) => {
    const has = prefs.billsDaysBefore.includes(day);
    const nextDays = has ? prefs.billsDaysBefore.filter((d) => d !== day) : [...prefs.billsDaysBefore, day].sort((a, b) => b - a);
    void save({ ...prefs, billsDaysBefore: nextDays });
  };

  const handleTest = async () => {
    setTestStatus(null);
    try {
      await sendTestReminder();
      setTestStatus(t('notifications.testSent'));
    } catch (e) {
      setTestStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const previewItems = useMemo(() => {
    const items: { title: string; hint: string }[] = [];
    if (prefs.dailyEnabled) {
      items.push({ title: t('notifications.dailyTitle'), hint: `${t('notifications.dailyFrequency')}, ${formatNextOccurrence(prefs.dailyTime, t)}` });
    }
    if (prefs.billsEnabled && prefs.billsDaysBefore.length > 0) {
      items.push({ title: t('notifications.billsTitle'), hint: formatNextOccurrence(prefs.billsTime, t) });
    }
    return items;
  }, [prefs, t]);

  if (loading) return null;

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('notifications.title')}</h1>
      </header>

      {!supported ? (
        <p className="settings-status">{t('notifications.unsupported')}</p>
      ) : (
        <>
          <div className="notif-card">
            <label className="notif-toggle-row">
              <span>{t('notifications.dailyTitle')}</span>
              <input
                type="checkbox"
                className="toggle-switch"
                checked={prefs.dailyEnabled}
                onChange={(e) => save({ ...prefs, dailyEnabled: e.target.checked })}
              />
            </label>
            {prefs.dailyEnabled && (
              <>
                <div className="notif-row">
                  <span>{t('notifications.frequency')}</span>
                  <span className="notif-row-value">{t('notifications.dailyFrequency')}</span>
                </div>
                <div className="notif-row">
                  <span>{t('notifications.time')}</span>
                  <input
                    type="time"
                    className="text-input notif-time-input"
                    value={prefs.dailyTime}
                    onChange={(e) => save({ ...prefs, dailyTime: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <div className="notif-card">
            <label className="notif-toggle-row">
              <span>{t('notifications.billsTitle')}</span>
              <input
                type="checkbox"
                className="toggle-switch"
                checked={prefs.billsEnabled}
                onChange={(e) => save({ ...prefs, billsEnabled: e.target.checked })}
              />
            </label>
            {prefs.billsEnabled && (
              <>
                <div className="chip-scroll-row">
                  {BILLS_DAY_OPTIONS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`filter-chip${prefs.billsDaysBefore.includes(day) ? ' active' : ''}`}
                      onClick={() => toggleDay(day)}
                    >
                      {t(day === 0 ? 'notifications.dayOf' : 'notifications.daysBefore', { count: day })}
                    </button>
                  ))}
                </div>
                <div className="notif-row">
                  <span>{t('notifications.time')}</span>
                  <input
                    type="time"
                    className="text-input notif-time-input"
                    value={prefs.billsTime}
                    onChange={(e) => save({ ...prefs, billsTime: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          {error && <p className="field-error">{error}</p>}

          {previewItems.length > 0 && (
            <>
              <p className="section-label">{t('notifications.previewSection')}</p>
              <div className="grouped-list">
                {previewItems.map((item) => (
                  <div key={item.title} className="grouped-list-row">
                    <span className="grouped-list-info">
                      <span className="grouped-list-name">{item.title}</span>
                      <span className="grouped-list-hint">{item.hint}</span>
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-link" onClick={handleTest}>
                {t('notifications.testButton')}
              </button>
              {testStatus && <p className="settings-status">{testStatus}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
