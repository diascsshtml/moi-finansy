import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { Sheet } from '../components/Sheet';
import { EmptyState } from '../components/EmptyState';
import { setBudget, deleteBudget } from '../db/operations';
import { getBudgetProgress, type BudgetProgress } from '../utils/stats';
import { formatMoney } from '../utils/format';
import { categoryDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';

type SheetState = { mode: 'add' } | { mode: 'edit'; progress: BudgetProgress } | null;

const STATUS_COLOR: Record<BudgetProgress['status'], string> = {
  ok: 'var(--accent)',
  warning: '#f59e0b',
  over: 'var(--danger)',
};

export function Budgets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const [sheet, setSheet] = useState<SheetState>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const progress = budgets && transactions && categories ? getBudgetProgress(budgets, transactions, categories) : [];
  const budgetedCategoryIds = progress.map((p) => p.budget.categoryId);
  const allBudgeted = (categories ?? [])
    .filter((c) => c.type === 'expense' && !c.isDebtRelated)
    .every((c) => budgetedCategoryIds.includes(c.id));

  const openAdd = () => {
    setCategoryId(null);
    setAmount('');
    setError(null);
    setSheet({ mode: 'add' });
  };

  const openEdit = (p: BudgetProgress) => {
    setAmount(String(p.budget.amount));
    setError(null);
    setSheet({ mode: 'edit', progress: p });
  };

  const handleSave = async () => {
    const numericAmount = Number(amount);
    if (!(numericAmount > 0)) {
      setError(t('budgets.amountError'));
      return;
    }
    if (sheet?.mode === 'add') {
      if (!categoryId) {
        setError(t('budgets.categoryError'));
        return;
      }
      await setBudget(categoryId, numericAmount);
    } else if (sheet?.mode === 'edit') {
      await setBudget(sheet.progress.budget.categoryId, numericAmount);
    }
    setSheet(null);
  };

  const handleDelete = async () => {
    if (sheet?.mode !== 'edit') return;
    await deleteBudget(sheet.progress.budget.id);
    setSheet(null);
  };

  if (!budgets || !transactions || !categories) return null;

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('budgets.back')}
        </button>
        <h1>{t('budgets.title')}</h1>
        <p className="page-subtitle">{t('budgets.subtitle')}</p>
      </header>

      {progress.length === 0 ? (
        <EmptyState icon="🐖" title={t('budgets.emptyTitle')} hint={t('budgets.emptyHint')} />
      ) : (
        <div className="budgets-list">
          {progress.map((p) => (
            <button key={p.budget.id} type="button" className="budget-row" onClick={() => openEdit(p)}>
              <div className="budget-row-top">
                <span
                  className="category-chip-icon"
                  style={{ background: `${p.category?.color ?? '#898781'}26`, color: p.category?.color ?? '#898781' }}
                >
                  <EmojiIcon icon={p.category?.icon ?? '❓'} size={17} />
                </span>
                <span className="budget-row-name">{p.category ? categoryDisplayName(p.category, t) : t('historyText.noCategory')}</span>
                <span className="budget-row-amount" style={{ color: STATUS_COLOR[p.status] }}>
                  {formatMoney(p.spent, settings.currency)} / {formatMoney(p.budget.amount, settings.currency)}
                </span>
              </div>
              <div className="debt-progress-track">
                <div className="debt-progress-fill" style={{ width: `${Math.min(100, p.pct)}%`, background: STATUS_COLOR[p.status] }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={allBudgeted} onClick={openAdd}>
        {t('budgets.addButton')}
      </button>
      {allBudgeted && progress.length > 0 && <p className="settings-hint">{t('budgets.allCategoriesBudgeted')}</p>}

      {sheet && (
        <Sheet title={sheet.mode === 'add' ? t('budgets.addTitle') : t('budgets.editTitle')} onClose={() => setSheet(null)}>
          {sheet.mode === 'add' ? (
            <CategoryPicker type="expense" value={categoryId} onChange={setCategoryId} excludeIds={budgetedCategoryIds} />
          ) : (
            <div className="budget-edit-category">
              <span
                className="category-chip-icon"
                style={{
                  background: `${sheet.progress.category?.color ?? '#898781'}26`,
                  color: sheet.progress.category?.color ?? '#898781',
                }}
              >
                <EmojiIcon icon={sheet.progress.category?.icon ?? '❓'} size={18} />
              </span>
              <span>{sheet.progress.category ? categoryDisplayName(sheet.progress.category, t) : ''}</span>
            </div>
          )}

          <label className="field-label" htmlFor="budget-amount">
            {t('budgets.amountLabel')}
          </label>
          <AmountInput id="budget-amount" value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

          {error && <p className="field-error">{error}</p>}

          <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
            {t('common.save')}
          </button>
          {sheet.mode === 'edit' && (
            <button type="button" className="btn btn-danger btn-block" onClick={handleDelete}>
              {t('budgets.deleteButton')}
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
