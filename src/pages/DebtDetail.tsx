import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, MoreHorizontal, Pencil, PiggyBank } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Sheet } from '../components/Sheet';
import { CircularProgress } from '../components/CircularProgress';
import { formatDateShort, formatMoney } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';
import { deleteDebt, deleteDebtPayment, reopenDebt, setDebtLinkedToBalance, updateDebtDetails, writeOffDebt } from '../db/operations';
import { EmojiIcon } from '../utils/icons';

export function DebtDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { open } = useSheet();
  const [confirmAction, setConfirmAction] = useState<'delete' | 'writeoff' | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');

  const debt = useLiveQuery(() => (id ? db.debts.get(id) : undefined), [id]);
  const person = useLiveQuery(() => (debt ? db.people.get(debt.personId) : undefined), [debt?.personId]);
  const account = useLiveQuery(() => (debt ? db.accounts.get(debt.accountId) : undefined), [debt?.accountId]);
  const accountCount = useLiveQuery(() => db.accounts.count(), []);
  const payments = useLiveQuery(
    () => (id ? db.debtPayments.where({ debtId: id }).sortBy('date') : []),
    [id],
  );

  if (debt === undefined || payments === undefined) return null;
  if (!debt) {
    return <EmptyState icon="🤷" title={t('debtDetail.notFoundTitle')} hint={t('debtDetail.notFoundHint')} />;
  }

  const progress = debt.initialAmount > 0 ? 1 - debt.currentAmount / debt.initialAmount : 0;
  const progressPct = Math.round(progress * 100);
  const isOwedToMe = debt.direction === 'owed_to_me';

  const handleDelete = async () => {
    await deleteDebt(debt.id);
    navigate('/debts', { replace: true });
  };

  const handleWriteOff = async () => {
    await writeOffDebt(debt.id);
    setConfirmAction(null);
  };

  const handleToggleLinked = async (checked: boolean) => {
    await setDebtLinkedToBalance(debt.id, checked);
  };

  const handleStartEditDueDate = () => {
    setDueDateInput(debt.dueDate ?? '');
    setEditingDueDate(true);
  };

  const handleSaveDueDate = async () => {
    await updateDebtDetails(debt.id, { dueDate: dueDateInput || undefined });
    setEditingDueDate(false);
  };

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <button type="button" className="icon-btn" onClick={() => navigate('/debts')} aria-label={t('debtDetail.back')}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setShowActions(true)} aria-label={t('debtDetail.actionsMenuTitle')}>
          <MoreHorizontal size={20} />
        </button>
      </header>

      <div className="debt-detail-header-row">
        <span className="debt-detail-icon" aria-hidden="true">
          <PiggyBank size={24} strokeWidth={1.75} />
        </span>
        <div className="debt-detail-name-col">
          <h1 className="debt-detail-name">{person?.name}</h1>
          <span className="debt-detail-badge">{isOwedToMe ? t('debtDetail.owedToMe') : t('debtDetail.iOwe')}</span>
        </div>
      </div>

      <div className="debt-detail-card">
        <div className="debt-detail-summary-row">
          <div>
            <p className="debt-detail-summary-label">{isOwedToMe ? t('debtDetail.remainingOwedToMe') : t('debtDetail.remainingIOwe')}</p>
            <div className={`debt-detail-amount tone-${isOwedToMe ? 'positive' : 'negative'}`}>
              {formatMoney(debt.currentAmount, settings.currency)}
            </div>
          </div>
          <CircularProgress percent={progressPct} />
        </div>

        <div className="debt-detail-divider" />

        <div className="debt-detail-meta-grid">
          <div>
            <span className="debt-detail-meta-label">{t('debtDetail.initialAmountLabel')}</span>
            <span className="debt-detail-meta-value">{formatMoney(debt.initialAmount, settings.currency)}</span>
          </div>
          <div>
            <span className="debt-detail-meta-label">{t('debtDetail.dueDateLabel')}</span>
            {editingDueDate ? (
              <input
                type="date"
                className="text-input"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                onBlur={handleSaveDueDate}
                autoFocus
              />
            ) : (
              <span className="debt-detail-meta-value">
                {debt.dueDate ? formatDateShort(debt.dueDate) : t('debtDetail.noDueDateValue')}
                <button type="button" className="icon-btn" aria-label={t('debtDetail.editDueDateAria')} onClick={handleStartEditDueDate}>
                  <Pencil size={13} />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {(debt.note || (account && (accountCount ?? 0) > 1)) && (
        <div className="debt-detail-card">
          <dl className="debt-detail-meta">
            {debt.note && (
              <div>
                <dt>{t('debtDetail.note')}</dt>
                <dd>{debt.note}</dd>
              </div>
            )}
            {account && (accountCount ?? 0) > 1 && (
              <div>
                <dt>{t('debtDetail.account')}</dt>
                <dd>
                  <EmojiIcon icon={account.icon} size={14} className="inline-icon" /> {accountDisplayName(account, t)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <label className="checkbox-row checkbox-row--compact">
        <input type="checkbox" checked={debt.linkedToBalance} onChange={(e) => handleToggleLinked(e.target.checked)} />
        <span>
          {t('debtDetail.linkedToBalance')}
          <small>
            {debt.linkedToBalance
              ? isOwedToMe
                ? t('debtForm.linkHintOwedToMe')
                : t('debtForm.linkHintIOwe')
              : t('debtDetail.linkedToBalanceOffHint')}
          </small>
        </span>
      </label>

      {debt.status === 'open' && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'add-payment', debt })}>
          {isOwedToMe ? t('debtDetail.recordRepayment') : t('debtDetail.recordPayment')}
        </button>
      )}

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('debtDetail.paymentsTitle')}</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState icon="💳" title={t('debtDetail.paymentsEmpty')} />
        ) : (
          <div className="payments-list">
            {payments
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="payment-row">
                  <div>
                    <div className="payment-row-amount">{formatMoney(p.amount, settings.currency)}</div>
                    <div className="payment-row-date">
                      {formatDateShort(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('debtDetail.deletePaymentAria')}
                    onClick={() => deleteDebtPayment(p.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {showActions && (
        <Sheet title={t('debtDetail.actionsMenuTitle')} onClose={() => setShowActions(false)}>
          {debt.status === 'open' && (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setShowActions(false);
                setConfirmAction('writeoff');
              }}
            >
              {t('debtDetail.writeOff')}
            </button>
          )}
          {debt.status === 'closed' && debt.writtenOff && (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                void reopenDebt(debt.id);
                setShowActions(false);
              }}
            >
              {t('debtDetail.reopen')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              setShowActions(false);
              setConfirmAction('delete');
            }}
          >
            {t('debtDetail.deleteDebtButton')}
          </button>
        </Sheet>
      )}

      {confirmAction === 'delete' && (
        <ConfirmDialog
          title={t('debtDetail.deleteTitle')}
          message={t('debtDetail.deleteMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'writeoff' && (
        <ConfirmDialog
          title={t('debtDetail.writeOffTitle')}
          message={t('debtDetail.writeOffMessage', { amount: formatMoney(debt.currentAmount, settings.currency) })}
          confirmLabel={t('debtDetail.writeOffConfirm')}
          danger
          onConfirm={handleWriteOff}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
