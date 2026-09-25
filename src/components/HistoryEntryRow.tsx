import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Account, HistoryEntry } from '../types';
import { formatMoney } from '../utils/format';
import { useSheet } from '../context/SheetContext';
import { toDisplayColor } from '../styles/palette';
import { deleteTransfer } from '../db/operations';
import { ConfirmDialog } from './ConfirmDialog';

interface HistoryEntryRowProps {
  entry: HistoryEntry;
  currency: string;
  isDark: boolean;
  /** Показывать бейдж счёта у каждой строки — только когда счетов больше одного. */
  accountsById?: Map<string, Account>;
}

export function HistoryEntryRow({ entry, currency, isDark, accountsById }: HistoryEntryRowProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { open } = useSheet();
  const [confirmDeleteTransfer, setConfirmDeleteTransfer] = useState(false);

  const time = new Date(entry.createdAt).toLocaleTimeString(i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Сумма в записях всегда хранится положительной — знак и цвет определяем
  // по смыслу операции, а не по числовому значению.
  let amountText = formatMoney(entry.amount, currency);
  let toneClass = 'tone-neutral';
  if (entry.kind === 'income') {
    amountText = `+ ${amountText}`;
    toneClass = 'tone-positive';
  } else if (entry.kind === 'expense') {
    amountText = `− ${amountText}`;
    toneClass = 'tone-negative';
  } else if (entry.kind === 'debt_written_off') {
    amountText = `− ${amountText}`;
  }

  const isDebtLinked = !!entry.transaction?.debtId;
  const isBillLinked = !!entry.transaction?.billId;
  const account = entry.accountId ? accountsById?.get(entry.accountId) : undefined;
  const showAccountBadge = !!account && !entry.transfer && (accountsById?.size ?? 0) > 1;

  const handleClick = () => {
    if (entry.transfer) {
      setConfirmDeleteTransfer(true);
      return;
    }
    if (entry.debt) {
      navigate(`/debts/${entry.debt.id}`);
      return;
    }
    if (isDebtLinked && entry.transaction) {
      navigate(`/debts/${entry.transaction.debtId}`);
      return;
    }
    if (isBillLinked && entry.transaction) {
      navigate(`/bills/${entry.transaction.billId}`);
      return;
    }
    if (entry.transaction) {
      open({ kind: 'view-transaction', transaction: entry.transaction });
    }
  };

  return (
    <>
      <button type="button" className="history-row" onClick={handleClick}>
        <span
          className="history-row-icon"
          style={{ background: `${toDisplayColor(entry.color, isDark)}26`, color: toDisplayColor(entry.color, isDark) }}
          aria-hidden="true"
        >
          {entry.icon}
        </span>
        <span className="history-row-text">
          <span className="history-row-title">{entry.title}</span>
          <span className="history-row-subtitle">
            {entry.subtitle ? `${entry.subtitle} · ` : ''}
            {time}
            {isDebtLinked ? t('history.debtTag') : ''}
            {isBillLinked ? t('historyText.billTag') : ''}
          </span>
        </span>
        {showAccountBadge && (
          <span className="account-badge">
            <span aria-hidden="true">{account!.icon}</span>
          </span>
        )}
        <span className={`history-row-amount ${toneClass}`}>{amountText}</span>
      </button>

      {confirmDeleteTransfer && entry.transfer && (
        <ConfirmDialog
          title={t('history.deleteTransferTitle')}
          message={t('history.deleteTransferMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={async () => {
            await deleteTransfer(entry.transfer!.id);
            setConfirmDeleteTransfer(false);
          }}
          onCancel={() => setConfirmDeleteTransfer(false)}
        />
      )}
    </>
  );
}
