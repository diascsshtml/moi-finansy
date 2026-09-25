import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { accountDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';

interface AccountPickerProps {
  value: string | null;
  onChange: (accountId: string) => void;
  exclude?: string;
}

/** Переключатель счёта (Личное/Бизнес/…) — сегментированные "таблетки",
 *  как правило их немного, поэтому список, а не выпадашка. */
export function AccountPicker({ value, onChange, exclude }: AccountPickerProps) {
  const { t } = useTranslation();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const list = accounts?.filter((a) => a.id !== exclude);

  if (!list) return null;

  return (
    <div className="account-picker" role="listbox" aria-label={t('transaction.account')}>
      {list.map((a) => (
        <button
          key={a.id}
          type="button"
          role="option"
          aria-selected={value === a.id}
          className={`account-chip${value === a.id ? ' selected' : ''}`}
          style={value === a.id ? { borderColor: a.color, background: `${a.color}1f`, color: a.color } : undefined}
          onClick={() => onChange(a.id)}
        >
          <EmojiIcon icon={a.icon} size={14} className="inline-icon" /> {accountDisplayName(a, t)}
        </button>
      ))}
    </div>
  );
}
