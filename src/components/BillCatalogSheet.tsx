import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { useSheet } from '../context/SheetContext';
import { BILL_CATALOG, isMonogramIcon, type BillCatalogItem } from '../data/billCatalog';
import { EmojiIcon } from '../utils/icons';
import type { BillPreset } from '../types';

interface BillCatalogSheetProps {
  onClose: () => void;
}

export function BillCatalogSheet({ onClose }: BillCatalogSheetProps) {
  const { t } = useTranslation();
  const { open } = useSheet();
  const [search, setSearch] = useState('');

  const named = useMemo(
    () => BILL_CATALOG.map((group) => ({ ...group, items: group.items.map((item) => ({ item, name: t(`billCatalog.items.${item.id}`) })) })),
    [t],
  );

  const query = search.trim().toLowerCase();
  const filtered = query ? named.flatMap((g) => g.items).filter(({ name }) => name.toLowerCase().includes(query)) : null;

  const selectItem = (item: BillCatalogItem, name: string) => {
    const preset: BillPreset = { name, icon: item.icon, color: item.color, categoryNameKey: item.categoryNameKey };
    open({ kind: 'edit-bill', preset });
  };

  const renderItem = (item: BillCatalogItem, name: string) => (
    <button key={item.id} type="button" className="category-chip" onClick={() => selectItem(item, name)}>
      <span
        className={`category-chip-icon${isMonogramIcon(item.icon) ? ' icon-monogram' : ''}`}
        style={{ background: `${item.color}26`, color: item.color }}
      >
        {isMonogramIcon(item.icon) ? item.icon : <EmojiIcon icon={item.icon} size={18} />}
      </span>
      <span className="category-chip-name">{name}</span>
    </button>
  );

  return (
    <Sheet title={t('billCatalog.title')} onClose={onClose}>
      <input
        type="search"
        className="text-input search-input"
        placeholder={t('billCatalog.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <button type="button" className="btn btn-secondary btn-block bill-catalog-custom" onClick={() => open({ kind: 'edit-bill' })}>
        {t('billCatalog.customButton')}
      </button>

      {filtered ? (
        filtered.length === 0 ? (
          <p className="settings-hint">{t('billCatalog.noResults')}</p>
        ) : (
          <div className="category-grid">{filtered.map(({ item, name }) => renderItem(item, name))}</div>
        )
      ) : (
        named.map((group) => (
          <div key={group.key} className="bill-catalog-group">
            <h3 className="history-group-date">{t(`billCatalog.groups.${group.key}`)}</h3>
            <div className="category-grid">{group.items.map(({ item, name }) => renderItem(item, name))}</div>
          </div>
        ))
      )}
    </Sheet>
  );
}
