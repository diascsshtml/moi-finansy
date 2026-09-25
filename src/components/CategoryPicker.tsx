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
}

export function CategoryPicker({ type, value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation();
  const categories = useLiveQuery(
    () => db.categories.where({ type }).and((c) => !c.isDebtRelated).sortBy('order'),
    [type],
  );

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
