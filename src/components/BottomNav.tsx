import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, CreditCard, Handshake, Home, User } from 'lucide-react';
import { db } from '../db/db';
import { getBillsNeedingAttention } from '../utils/bills';

const TABS = [
  { to: '/', key: 'nav.dashboard', Icon: Home, end: true },
  { to: '/history', key: 'nav.history', Icon: ClipboardList, end: false },
  { to: '/debts', key: 'nav.debts', Icon: Handshake, end: false },
  { to: '/bills', key: 'nav.bills', Icon: CreditCard, end: false },
  { to: '/settings', key: 'nav.profile', Icon: User, end: false },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const attentionCount =
    bills && transactions ? getBillsNeedingAttention(bills, transactions).length : 0;

  return (
    <nav className="bottom-nav" aria-label={t('nav.ariaLabel')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon-wrap">
            <span className="bottom-nav-icon">
              <tab.Icon size={20} strokeWidth={2.25} aria-hidden="true" />
            </span>
            {tab.to === '/bills' && attentionCount > 0 && (
              <span className="bottom-nav-badge">{attentionCount > 9 ? '9+' : attentionCount}</span>
            )}
          </span>
          <span className="bottom-nav-label">{t(tab.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
