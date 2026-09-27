import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { dateToISO, formatDateShort, formatMoney } from '../utils/format';
import { accountDisplayName, categoryDisplayName } from '../utils/displayName';
import { getBillStatus } from '../utils/bills';
import { deleteBill, updateBill } from '../db/operations';
import { isMonogramIcon } from '../data/billCatalog';
import { toDisplayColor } from '../styles/palette';
import { EmojiIcon } from '../utils/icons';

export function SubscriptionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, isDark } = useSettings();
  const { open } = useSheet();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bill = useLiveQuery(() => (id ? db.bills.get(id) : undefined), [id]);
  const category = useLiveQuery(() => (bill ? db.categories.get(bill.categoryId) : undefined), [bill?.categoryId]);
  const account = useLiveQuery(() => (bill ? db.accounts.get(bill.accountId) : undefined), [bill?.accountId]);
  const payments = useLiveQuery(() => (id ? db.transactions.where({ billId: id }).sortBy('date') : []), [id]);

  const status = useMemo(() => (bill && payments ? getBillStatus(bill, payments) : null), [bill, payments]);
  const totalPaid = useMemo(() => (payments ? payments.reduce((s, p) => s + p.amount, 0) : 0), [payments]);

  if (bill === undefined || payments === undefined) return null;
  if (!bill || !status) {
    return <EmptyState icon="🤷" title={t('bills.detail.notFoundTitle')} />;
  }

  const handleDelete = async () => {
    await deleteBill(bill.id);
    navigate('/subscriptions', { replace: true });
  };

  const toggleActive = async () => {
    await updateBill(bill.id, { isActive: !bill.isActive });
  };

  const icon = isMonogramIcon(bill.icon) ? bill.icon : <EmojiIcon icon={bill.icon} size={22} />;
  const color = toDisplayColor(bill.color, isDark);

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={() => navigate(`/bills/${bill.id}/edit`)} aria-label={t('bills.detail.editButton')}>
          <Pencil size={18} />
        </button>
      </header>

      <div className="debt-detail-card">
        <div className="debt-detail-header-row">
          <span className={`debt-detail-icon${isMonogramIcon(bill.icon) ? ' icon-monogram' : ''}`} style={{ background: `${color}26`, color }} aria-hidden="true">
            {icon}
          </span>
          <div className="debt-detail-name-col">
            <h1 className="debt-detail-name">{formatMoney(bill.amount, settings.currency)}/{t('subscriptions.perMonthSuffix')}</h1>
            <span className="debt-detail-badge">
              {t('subscriptions.frequencyMonthly')} · {account ? accountDisplayName(account, t) : ''}
              {category ? ` · ${categoryDisplayName(category, t)}` : ''}
            </span>
          </div>
        </div>

        {status.status !== 'paused' && (
          <div className="subscription-next-charge">
            <Calendar size={16} strokeWidth={2.25} />
            {t('subscriptions.nextChargeInline', { date: formatDateShort(dateToISO(status.dueDate)) })}
            <span className="subscription-next-charge-badge">{formatDateShort(dateToISO(status.dueDate))}</span>
          </div>
        )}

        <div className="mini-stat-row" style={{ marginTop: 12 }}>
          <div className="mini-stat-box">
            <span className="mini-stat-label">{t('subscriptions.paidLabel')}</span>
            <span className="mini-stat-value">{formatMoney(totalPaid, settings.currency)}</span>
          </div>
          <div className="mini-stat-box">
            <span className="mini-stat-label">{t('subscriptions.chargesLabel')}</span>
            <span className="mini-stat-value">{payments.length}</span>
          </div>
          <div className="mini-stat-box">
            <span className="mini-stat-label">{t('subscriptions.perMonth')}</span>
            <span className="mini-stat-value">{formatMoney(bill.amount, settings.currency)}</span>
          </div>
        </div>
      </div>

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('subscriptions.historyTitle')}</h2>
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

      {status.status !== 'paid' && bill.isActive && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'mark-bill-paid', bill })}>
          {t('bills.markPaidButton')}
        </button>
      )}

      <button type="button" className="btn btn-secondary btn-block" onClick={toggleActive}>
        {bill.isActive ? <Pause size={16} strokeWidth={2.25} className="inline-icon" /> : <Play size={16} strokeWidth={2.25} className="inline-icon" />}{' '}
        {bill.isActive ? t('subscriptions.cancelButton') : t('bills.detail.resumeButton')}
      </button>

      <button type="button" className="btn-link" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }} onClick={() => setConfirmDelete(true)}>
        <Trash2 size={15} /> {t('common.delete')}
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
