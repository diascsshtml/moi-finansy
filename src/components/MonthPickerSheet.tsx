import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { kk, ru } from 'date-fns/locale';
import i18n from '../i18n';
import { Sheet } from './Sheet';

interface MonthPickerSheetProps {
  onClose: () => void;
  selected: Date;
  onSelect: (date: Date) => void;
}

function dateFnsLocale() {
  return i18n.language === 'kk' ? kk : ru;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Выбор конкретного месяца — открывается по тапу на подпись месяца в
 *  Истории (см. History.tsx). Заменяет постраничное «‹ / ›» на прямой
 *  переход, но сама история остаётся помесячной, поэтому это выбор
 *  месяца+года, а не конкретного дня. */
export function MonthPickerSheet({ onClose, selected, onSelect }: MonthPickerSheetProps) {
  const { t } = useTranslation();
  const [year, setYear] = useState(selected.getFullYear());
  const now = new Date();

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <Sheet title={t('history.pickMonthTitle')} onClose={onClose}>
      <div className="month-picker-year-row">
        <button type="button" className="icon-btn" onClick={() => setYear((y) => y - 1)} aria-label={t('history.prevYear')}>
          <ChevronLeft size={18} />
        </button>
        <span className="month-picker-year">{year}</span>
        <button
          type="button"
          className="icon-btn"
          disabled={year >= now.getFullYear()}
          onClick={() => setYear((y) => y + 1)}
          aria-label={t('history.nextYear')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="month-picker-grid">
        {months.map((m) => {
          const disabled = m > startOfMonth(now);
          const isSelected = m.getFullYear() === selected.getFullYear() && m.getMonth() === selected.getMonth();
          return (
            <button
              key={m.getMonth()}
              type="button"
              className={`month-picker-cell${isSelected ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => {
                onSelect(m);
                onClose();
              }}
            >
              {capitalize(format(m, 'LLL', { locale: dateFnsLocale() }))}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
