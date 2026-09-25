import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { useSheet } from '../context/SheetContext';
import { categoryDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import type { TransactionType } from '../types';

export function Categories() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { open } = useSheet();
  const [type, setType] = useState<TransactionType>('expense');
  // Служебные категории долгов (Выдача/Получение/Погашение долга) не показываем здесь —
  // они создаются и управляются автоматически логикой долгов, а не пользователем.
  const categories = useLiveQuery(
    () => db.categories.where({ type }).and((c) => !c.isDebtRelated).sortBy('order'),
    [type],
  );

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings/preferences')}>
          {t('categoriesPage.back')}
        </button>
        <h1>{t('categoriesPage.title')}</h1>
      </header>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={type === 'expense'}
          className={type === 'expense' ? 'active' : ''}
          onClick={() => setType('expense')}
        >
          {t('categoriesPage.expenses')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={type === 'income'}
          className={type === 'income' ? 'active' : ''}
          onClick={() => setType('income')}
        >
          {t('categoriesPage.incomes')}
        </button>
      </div>

      <div className="categories-list">
        {categories?.map((c) => (
          <button
            key={c.id}
            type="button"
            className="category-list-row"
            onClick={() => open({ kind: 'edit-category', type, category: c })}
          >
            <span className="category-chip-icon" style={{ background: `${c.color}26`, color: c.color }}>
              <EmojiIcon icon={c.icon} size={17} />
            </span>
            <span className="category-list-name">{categoryDisplayName(c, t)}</span>
            {c.isSystem && <span className="category-list-tag">{t('categoriesPage.systemTag')}</span>}
            <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
          </button>
        ))}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'edit-category', type })}>
        {t('categoriesPage.addButton')}
      </button>
    </div>
  );
}
