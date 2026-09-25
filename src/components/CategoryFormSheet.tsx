import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { ConfirmDialog } from './ConfirmDialog';
import { createCategory, deleteCategory, updateCategory } from '../db/operations';
import { CATEGORICAL_LIGHT, NEUTRAL_COLOR } from '../styles/palette';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { categoryDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import type { Category, TransactionType } from '../types';

const ICONS = [
  '🛒', '🚌', '🏠', '☕', '💊', '👕', '🎮', '📱', '📚', '🎁',
  '💼', '💻', '📈', '🐾', '🚗', '✈️', '🍔', '🎬', '💡', '🧾',
  '👶', '🏋️', '🎵', '🛠️', '📦',
];

const SWATCHES = [...CATEGORICAL_LIGHT, NEUTRAL_COLOR.light];

interface CategoryFormSheetProps {
  onClose: () => void;
  type: TransactionType;
  category?: Category;
}

export function CategoryFormSheet({ onClose, type, category }: CategoryFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!category;
  const initialName = category ? categoryDisplayName(category, t) : '';
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(category?.icon ?? ICONS[0]);
  const [color, setColor] = useState(category?.color ?? SWATCHES[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = name.trim().length > 0;
  const fallbackId = type === 'income' ? SYSTEM_CATEGORY_IDS.otherIncome : SYSTEM_CATEGORY_IDS.otherExpense;

  const handleSave = async () => {
    if (!canSave) return;
    if (isEdit && category) {
      const clearNameKey = !!category.nameKey && name.trim() !== initialName;
      await updateCategory(category.id, { name, icon, color }, clearNameKey);
    } else {
      await createCategory({ name, icon, color, type });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (category) await deleteCategory(category.id, fallbackId);
    onClose();
  };

  return (
    <Sheet
      title={isEdit ? t('category.editTitle') : t('category.newTitle')}
      onClose={onClose}
      footer={
        <div className="sheet-footer-row">
          {isEdit && !category?.isSystem && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-grow" disabled={!canSave} onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      }
    >
      <label className="field-label" htmlFor="cat-name">
        {t('common.name')}
      </label>
      <input
        id="cat-name"
        type="text"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
      />

      <label className="field-label">{t('common.icon')}</label>
      <div className="icon-grid">
        {ICONS.map((i) => (
          <button
            key={i}
            type="button"
            className={`icon-swatch${icon === i ? ' selected' : ''}`}
            onClick={() => setIcon(i)}
            aria-label={i}
          >
            <EmojiIcon icon={i} size={19} />
          </button>
        ))}
      </div>

      <label className="field-label">{t('common.color')}</label>
      <div className="color-grid">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-swatch${color === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('category.deleteTitle')}
          message={t('category.deleteMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
