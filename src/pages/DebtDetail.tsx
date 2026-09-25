import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { formatDateShort, formatMoney } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';
import { deleteDebt, deleteDebtPayment, reopenDebt, setDebtLinkedToBalance, writeOffDebt } from '../db/operations';

export function DebtDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { open } = useSheet();
  const [confirmAction, setConfirmAction] = useState<'delete' | 'writeoff' | null>(null);

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

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/debts')}>
          {t('debtDetail.back')}
        </button>
      </header>

      <div className="debt-detail-card">
        <span className="debt-detail-badge">{isOwedToMe ? t('debtDetail.owedToMe') : t('debtDetail.iOwe')}</span>
        <h1 className="debt-detail-name">{person?.name}</h1>
        <div className={`debt-detail-amount tone-${isOwedToMe ? 'positive' : 'negative'}`}>
          {formatMoney(debt.currentAmount, settings.currency)}
        </div>
        {debt.currentAmount !== debt.initialAmount && (
          <>
            <div className="debt-progress-track">
              <div className="debt-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="debt-detail-hint">
              {t('debtDetail.progressHint', {
                initial: formatMoney(debt.initialAmount, settings.currency),
                pct: Math.round(progress * 100),
              })}
            </p>
          </>
        )}

        <dl className="debt-detail-meta">
          <div>
            <dt>{t('debtDetail.dateCreated')}</dt>
            <dd>{formatDateShort(debt.date)}</dd>
          </div>
          {debt.dueDate && (
            <div>
              <dt>{t('debtDetail.dueDate')}</dt>
              <dd>{formatDateShort(debt.dueDate)}</dd>
            </div>
          )}
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
                {account.icon} {accountDisplayName(account, t)}
              </dd>
            </div>
          )}
          <div>
            <dt>{t('debtDetail.status')}</dt>
            <dd>
              {debt.status === 'open'
                ? t('debtDetail.statusOpen')
                : debt.writtenOff
                  ? t('debtDetail.statusWrittenOff')
                  : t('debtDetail.statusClosed')}
            </dd>
          </div>
        </dl>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={debt.linkedToBalance}
            onChange={(e) => handleToggleLinked(e.target.checked)}
          />
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

        {debt.status === 'open' ? (
          <div className="debt-detail-actions">
            <button type="button" className="btn btn-primary btn-grow" onClick={() => open({ kind: 'add-payment', debt })}>
              {isOwedToMe ? t('debtDetail.recordRepayment') : t('debtDetail.recordPayment')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmAction('writeoff')}>
              {t('debtDetail.writeOff')}
            </button>
          </div>
        ) : (
          debt.writtenOff && (
            <button type="button" className="btn btn-ghost" onClick={() => reopenDebt(debt.id)}>
              {t('debtDetail.reopen')}
            </button>
          )
        )}
      </div>

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

      <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmAction('delete')}>
        {t('debtDetail.deleteDebtButton')}
      </button>

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
