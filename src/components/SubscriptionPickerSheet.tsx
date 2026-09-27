import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { Sheet } from './Sheet';
import { isMonogramIcon } from '../data/billCatalog';
import { SUBSCRIPTION_CATALOG, type SubscriptionCatalogItem } from '../data/subscriptionCatalog';
import { EmojiIcon } from '../utils/icons';

interface SubscriptionPickerSheetProps {
  onClose: () => void;
  onPick: (item: SubscriptionCatalogItem | null) => void;
}

/** Выбор сервиса при создании подписки — небольшой лист поверх формы (см.
 *  NewSubscriptionPage), а не отдельная страница: это вспомогательный
 *  выбор одного поля формы, а не самостоятельный переход. */
export function SubscriptionPickerSheet({ onClose, onPick }: SubscriptionPickerSheetProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const filtered = query ? SUBSCRIPTION_CATALOG.filter((item) => item.name.toLowerCase().includes(query)) : SUBSCRIPTION_CATALOG;

  return (
    <Sheet title={t('subscriptions.pickerTitle')} onClose={onClose}>
      <input
        type="search"
        className="text-input search-input"
        placeholder={t('subscriptions.pickerSearchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <div className="grouped-list">
        <button type="button" className="grouped-list-row" onClick={() => onPick(null)}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Pencil size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('subscriptions.customService')}</span>
            <span className="grouped-list-hint">{t('subscriptions.customServiceHint')}</span>
          </span>
        </button>

        {filtered.map((item) => (
          <button key={item.id} type="button" className="grouped-list-row" onClick={() => onPick(item)}>
            <span
              className={`grouped-list-icon${isMonogramIcon(item.icon) ? ' icon-monogram' : ''}`}
              style={{ background: `${item.color}26`, color: item.color }}
              aria-hidden="true"
            >
              {isMonogramIcon(item.icon) ? item.icon : <EmojiIcon icon={item.icon} size={16} />}
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{item.name}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
