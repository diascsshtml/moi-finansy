import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { AccountPicker } from './AccountPicker';
import { createAccount, deleteAccount, updateAccount } from '../db/operations';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { accountDisplayName } from '../utils/displayName';
import { db } from '../db/db';
import type { Account } from '../types';

const ICONS = ['👤', '💼', '💰', '🏦', '💳', '👛', '🧾', '🏠', '🚗', '👨‍👩‍👧', '📦', '⭐'];
const SWATCHES = CATEGORICAL_LIGHT;
const BANK_PRESETS = ['Kaspi Bank', 'Halyk Bank', 'Freedom Bank', 'Jusan Bank', 'Bereke Bank', 'Forte Bank', 'Отбасы банк'];

interface AccountFormSheetProps {
  onClose: () => void;
  account?: Account;
}

export function AccountFormSheet({ onClose, account }: AccountFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!account;
  const initialName = account ? accountDisplayName(account, t) : '';
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(account?.icon ?? ICONS[0]);
  const [color, setColor] = useState(account?.color ?? SWATCHES[0]);
  const [bank, setBank] = useState(account?.bank ?? '');
  const [customBank, setCustomBank] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [fallbackId, setFallbackId] = useState<string | null>(null);

  const accountCount = useLiveQuery(() => db.accounts.count(), []);
  const canSave = name.trim().length > 0;
  const canDelete = isEdit && (accountCount ?? 0) > 1;

  const handleSave = async () => {
    if (!canSave) return;
    if (isEdit && account) {
      const clearNameKey = !!account.nameKey && name.trim() !== initialName;
      await updateAccount(account.id, { name, icon, color, bank }, clearNameKey);
    } else {
      await createAccount({ name, icon, color, bank });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (account && fallbackId) await deleteAccount(account.id, fallbackId);
    onClose();
  };

  if (deleting && account) {
    return (
      <Sheet
        title={t('account.deleteFlowTitle')}
        onClose={onClose}
        footer={
          <div className="sheet-footer-row">
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(false)}>
              {t('common.back')}
            </button>
            <button type="button" className="btn btn-danger btn-grow" disabled={!fallbackId} onClick={handleDelete}>
              {t('account.deleteAndMove')}
            </button>
          </div>
        }
      >
        <p className="sheet-subtitle">{t('account.deleteSubtitle', { name: initialName })}</p>
        <label className="field-label">{t('account.moveTo')}</label>
        <AccountPicker value={fallbackId} onChange={setFallbackId} exclude={account.id} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={isEdit ? t('account.editTitle') : t('account.newTitle')}
      onClose={onClose}
      footer={
        <div className="sheet-footer-row">
          {canDelete && (
            <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-grow" disabled={!canSave} onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      }
    >
      <label className="field-label" htmlFor="acc-name">
        {t('common.name')}
      </label>
      <input
        id="acc-name"
        type="text"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        autoFocus
        placeholder={t('account.namePlaceholder')}
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
            {i}
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

      <label className="field-label">{t('account.bankLabel')}</label>
      <p className="settings-hint">{t('account.bankHint')}</p>
      <div className="currency-grid">
        {BANK_PRESETS.map((b) => (
          <button
            key={b}
            type="button"
            className={`currency-chip${bank === b ? ' selected' : ''}`}
            onClick={() => setBank(bank === b ? '' : b)}
          >
            {b}
          </button>
        ))}
      </div>
      <div className="field-row field-row--inline">
        <input
          type="text"
          className="text-input"
          placeholder={t('account.bankCustomPlaceholder')}
          value={customBank}
          maxLength={30}
          onChange={(e) => setCustomBank(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!customBank.trim()}
          onClick={() => {
            setBank(customBank.trim());
            setCustomBank('');
          }}
        >
          {t('common.apply')}
        </button>
      </div>
      {bank && (
        <p className="settings-hint">
          {t('account.bankSelected', { bank })}{' '}
          <button type="button" className="btn-link" onClick={() => setBank('')}>
            {t('account.bankClear')}
          </button>
        </p>
      )}
    </Sheet>
  );
}
