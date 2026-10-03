import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Landmark, Pencil } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { CircularProgress } from '../components/CircularProgress';
import { dateToISO, formatDateShort, formatMoney } from '../utils/format';
import { categoryDisplayName, accountDisplayName } from '../utils/displayName';
import { getBillStatus, getCreditProgress, getDueRelativeLabel, isLoanKind } from '../utils/bills';
import { deleteBill, updateBill } from '../db/operations';
import { isMonogramIcon } from '../data/billCatalog';
import { toDisplayColor } from '../styles/palette';
import { EmojiIcon } from '../utils/icons';

export function BillDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, isDark } = useSettings();
  const { open } = useSheet();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bill = useLiveQuery(() => (id ? db.bills.get(id) : undefined), [id]);
  const category = useLiveQuery(() => (bill ? db.categories.get(bill.categoryId) : undefined), [bill?.categoryId]);
  const account = useLiveQuery(() => (bill ? db.accounts.get(bill.accountId) : undefined), [bill?.accountId]);
  const accountCount = useLiveQuery(() => db.accounts.count(), []);
  const payments = useLiveQuery(
    () => (id ? db.transactions.where({ billId: id }).sortBy('date') : []),
    [id],
  );

  const status = useMemo(() => (bill && payments ? getBillStatus(bill, payments) : null), [bill, payments]);
  const creditProgress = useMemo(
    () => (bill && payments && isLoanKind(bill.kind ?? 'subscription') ? getCreditProgress(bill, payments) : null),
    [bill, payments],
  );

  if (bill === undefined || payments === undefined) return null;
  if (!bill || !status) {
    return <EmptyState icon="🤷" title={t('bills.detail.notFoundTitle')} />;
  }

  const handleDelete = async () => {
    await deleteBill(bill.id);
    navigate('/bills', { replace: true });
  };

  const toggleActive = async () => {
    await updateBill(bill.id, { isActive: !bill.isActive });
  };

  const isCredit = isLoanKind(bill.kind ?? 'subscription');
  const billIcon = isMonogramIcon(bill.icon) ? bill.icon : <EmojiIcon icon={bill.icon} size={22} />;
  const billColor = toDisplayColor(bill.color, isDark);

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/bills')}>
          {t('bills.detail.back')}
        </button>
      </header>

      {isCredit && (
        <div className="debt-detail-header-row">
          <span className="debt-detail-icon" style={{ background: `${billColor}26`, color: billColor }} aria-hidden="true">
            {billIcon}
          </span>
          <div className="debt-detail-name-col">
            <h1 className="debt-detail-name">{bill.name}</h1>
            <span className="debt-detail-badge">{bill.kind === 'installment' ? t('bills.kindInstallment') : t('bills.kindCredit')}</span>
          </div>
        </div>
      )}

      <div className="debt-detail-card">
        {!isCredit && (
          <span className="debt-detail-badge">
            {isMonogramIcon(bill.icon) ? bill.icon : <EmojiIcon icon={bill.icon} size={16} className="inline-icon" />} {bill.name}
          </span>
        )}

        {isCredit && creditProgress ? (
          <>
            <div className="debt-detail-summary-row">
              <div>
                <p className="debt-detail-summary-label">{t('bills.detail.remainingLabel')}</p>
                <div className="debt-detail-amount tone-negative">{formatMoney(creditProgress.remaining, settings.currency)}</div>
                {creditProgress.totalAmount > 0 && (
                  <p className="debt-detail-hint">{t('bills.detail.outOf', { amount: formatMoney(creditProgress.totalAmount, settings.currency) })}</p>
                )}
              </div>
              <CircularProgress percent={creditProgress.progressPct} />
            </div>

            <div className="debt-detail-divider" />

            <div className="debt-detail-meta-grid">
              <div>
                <span className="debt-detail-meta-label">{t('bills.detail.monthlyPayment')}</span>
                <span className="debt-detail-meta-value">{formatMoney(bill.amount, settings.currency)}</span>
              </div>
              <div>
                <span className="debt-detail-meta-label">{t('bills.detail.nextDue')}</span>
                <span className="debt-detail-meta-value">
                  {formatDateShort(dateToISO(status.dueDate))}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('bills.detail.editButton')}
                    onClick={() => navigate(`/bills/${bill.id}/edit`)}
                  >
                    <Pencil size={13} />
                  </button>
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="debt-detail-amount tone-negative">{formatMoney(bill.amount, settings.currency)}</div>
        )}

        <dl className="debt-detail-meta">
          {bill.termMonths && (
            <div>
              <dt>{t('bills.detail.termMonths')}</dt>
              <dd>{t('bills.detail.termMonthsValue', { count: bill.termMonths })}</dd>
            </div>
          )}
          {bill.interestRate && (
            <div>
              <dt>{t('bills.detail.interestRate')}</dt>
              <dd>{bill.interestRate.toFixed(1)}%</dd>
            </div>
          )}
          {!isCredit && (
            <div>
              <dt>{t('bills.detail.nextDue')}</dt>
              <dd>{formatDateShort(dateToISO(status.dueDate))}</dd>
            </div>
          )}
          {status.status !== 'paid' && status.status !== 'paused' && (
            <div>
              <dt>{t('bills.detail.daysLeft')}</dt>
              <dd className={status.status === 'overdue' || status.daysUntilDue === 0 ? 'tone-negative' : undefined}>
                {getDueRelativeLabel(status, t)}
              </dd>
            </div>
          )}
          <div>
            <dt>{t('bills.detail.dayOfMonth')}</dt>
            <dd>{bill.dayOfMonth}</dd>
          </div>
          {category && (
            <div>
              <dt>{t('transaction.category')}</dt>
              <dd>
                <EmojiIcon icon={category.icon} size={14} className="inline-icon" /> {categoryDisplayName(category, t)}
              </dd>
            </div>
          )}
          {account && (accountCount ?? 0) > 1 && (
            <div>
              <dt>{t('bills.detail.account')}</dt>
              <dd>
                <EmojiIcon icon={account.icon} size={14} className="inline-icon" /> {accountDisplayName(account, t)}
              </dd>
            </div>
          )}
          {bill.note && (
            <div>
              <dt>{t('common.noteOptional')}</dt>
              <dd>{bill.note}</dd>
            </div>
          )}
        </dl>

        <div className="debt-detail-actions">
          {status.status !== 'paid' && bill.isActive && (
            <button
              type="button"
              className="btn btn-primary btn-grow"
              onClick={() => open(isCredit ? { kind: 'credit-payment', bill } : { kind: 'mark-bill-paid', bill })}
            >
              {isCredit && <Landmark size={16} strokeWidth={2.25} className="inline-icon" />} {isCredit ? t('bills.payment.title') : t('bills.markPaidButton')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/bills/${bill.id}/edit`)}>
            {t('bills.detail.editButton')}
          </button>
        </div>
        <div className="debt-detail-actions">
          <button type="button" className="btn btn-ghost btn-grow" onClick={toggleActive}>
            {bill.isActive ? t('bills.detail.pauseButton') : t('bills.detail.resumeButton')}
          </button>
        </div>
      </div>

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('bills.detail.history')}</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState icon="💳" title={t('bills.detail.historyEmpty')} />
        ) : (
          <div className="payments-list">
            {payments
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="payment-row">
                  <div>
                    <div className="payment-row-amount">{formatMoney(p.amount, settings.currency)}</div>
                    <div className="payment-row-date">{formatDateShort(p.date)}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
        {t('bills.detail.deleteButton')}
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title={t('bills.form.deleteTitle')}
          message={t('bills.form.deleteMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
