import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, X } from 'lucide-react';
import { onSyncConflict } from '../utils/dataSync';

/** Показывается, когда сервер отклонил выгрузку локальных изменений, потому
 *  что данные там уже обновились с другой вкладки/устройства (см.
 *  pushSnapshotToServer в utils/dataSync.ts) — локальная база в этот момент
 *  уже заменена на свежую с сервера, но то, что правилось именно здесь с
 *  последней синхронизации, могло не сохраниться. Смонтирован один раз в
 *  App.tsx, поэтому виден на любой странице. */
export function SyncConflictBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => onSyncConflict(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="sync-conflict-banner" role="alert">
      <span className="sync-conflict-banner-icon" aria-hidden="true">
        <TriangleAlert size={16} strokeWidth={2.25} />
      </span>
      <span className="sync-conflict-banner-text">{t('sync.conflictMessage')}</span>
      <button type="button" className="icon-btn" onClick={() => setVisible(false)} aria-label={t('common.close')}>
        <X size={15} />
      </button>
    </div>
  );
}
