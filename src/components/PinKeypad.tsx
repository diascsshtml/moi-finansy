import { useTranslation } from 'react-i18next';

interface PinKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Числовая клавиатура для ввода PIN-кода — крупные кнопки под палец. */
export function PinKeypad({ onDigit, onBackspace, disabled }: PinKeypadProps) {
  const { t } = useTranslation();
  return (
    <div className="pin-keypad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className="pin-key" disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <span aria-hidden="true" />
      <button type="button" className="pin-key" disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button
        type="button"
        className="pin-key pin-key--backspace"
        disabled={disabled}
        onClick={onBackspace}
        aria-label={t('lock.backspace')}
      >
        ⌫
      </button>
    </div>
  );
}
