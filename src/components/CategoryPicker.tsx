import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { categoryDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import type { TransactionType } from '../types';

interface CategoryPickerProps {
  type: TransactionType;
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Категории, которые не нужно показывать (например, уже занятые под что-то
   *  другое, как бюджет — см. pages/Budgets.tsx) — сам список от этого не
   *  перезапрашивается, фильтрация чисто на отображение. */
  excludeIds?: string[];
}

export function CategoryPicker({ type, value, onChange, excludeIds }: CategoryPickerProps) {
  const { t } = useTranslation();
  const allCategories = useLiveQuery(
    () => db.categories.where({ type }).and((c) => !c.isDebtRelated).sortBy('order'),
    [type],
  );
  const categories = excludeIds ? allCategories?.filter((c) => !excludeIds.includes(c.id)) : allCategories;

  if (!categories) return null;

  return (
    <div className="category-grid" role="listbox" aria-label={t('transaction.category')}>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={value === c.id}
          className={`category-chip${value === c.id ? ' selected' : ''}`}
          onClick={() => onChange(c.id)}
        >
          <span className="category-chip-icon" style={{ background: `${c.color}26`, color: c.color }}>
            <EmojiIcon icon={c.icon} size={18} />
          </span>
          <span className="category-chip-name">{categoryDisplayName(c, t)}</span>
        </button>
      ))}
    </div>
  );
}
