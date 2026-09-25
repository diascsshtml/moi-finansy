import { useTranslation } from 'react-i18next';

interface AmountInputProps {
  value: string;
  onChange: (v: string) => void;
  currency: string;
  autoFocus?: boolean;
  id?: string;
}

/** Крупное поле ввода суммы: разрешает только цифры и одну десятичную точку/запятую. */
export function AmountInput({ value, onChange, currency, autoFocus, id }: AmountInputProps) {
  const { t } = useTranslation();
  const handle = (raw: string) => {
    const normalized = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = normalized.split('.');
    const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
    onChange(cleaned);
  };

  return (
    <div className="amount-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => handle(e.target.value)}
        aria-label={t('common.amount')}
      />
      <span className="amount-input-currency">{currency}</span>
    </div>
  );
}
