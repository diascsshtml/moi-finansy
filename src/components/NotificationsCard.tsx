import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';

/** Карточка статуса уведомлений о платежах — честно показывает, что реально
 *  происходит: браузер не поддерживает, заблокировано пользователем/ОС,
 *  включено, или можно включить сейчас. */
export function NotificationsCard() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState(getNotificationPermission());

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  return (
    <section className="settings-section">
      <h2>{t('bills.notificationsSection')}</h2>
      <p className="settings-hint">{t('bills.notificationsHint')}</p>
      {permission === 'unsupported' && <p className="settings-hint">{t('bills.notificationsUnsupported')}</p>}
      {permission === 'denied' && <p className="field-error">{t('bills.notificationsBlocked')}</p>}
      {permission === 'granted' && <p className="settings-status settings-status--positive">{t('bills.notificationsEnabled')}</p>}
      {permission === 'default' && (
        <button type="button" className="btn btn-secondary btn-block" onClick={handleEnable}>
          {t('bills.enableNotifications')}
        </button>
      )}
    </section>
  );
}
