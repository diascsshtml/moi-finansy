import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeftRight, ArrowUp, Handshake, Plus } from 'lucide-react';

// Страницы, где «Добавить операцию» не к месту (Настройки и их подстраницы,
// Статистика, админка, сами формы добавления) — раньше кнопка всё равно
// всплывала поверх контента на всех страницах и на некоторых (Настройки,
// Категории) перекрывала собой другие кнопки и текст.
const HIDDEN_PREFIXES = ['/settings', '/stats', '/admin', '/transactions/new', '/debts/new', '/transfers/new', '/bills/new'];

export function Fab() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const pick = (action: () => void) => {
    action();
    setOpen(false);
  };

  const hidden = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  if (hidden) return null;

  return (
    <div className="fab-wrap" ref={ref}>
      {open && (
        <div className="fab-menu" role="menu">
          <button type="button" className="fab-option" role="menuitem" onClick={() => pick(() => navigate('/transfers/new'))}>
            <span className="fab-option-icon fab-option-icon--transfer" aria-hidden="true">
              <ArrowLeftRight size={15} strokeWidth={2.25} />
            </span>
            {t('fab.transfer')}
          </button>
          <button type="button" className="fab-option" role="menuitem" onClick={() => pick(() => navigate('/debts/new/i_owe'))}>
            <span className="fab-option-icon fab-option-icon--debt" aria-hidden="true">
              <Handshake size={15} strokeWidth={2.25} />
            </span>
            {t('fab.debt')}
          </button>
          <button type="button" className="fab-option" role="menuitem" onClick={() => pick(() => navigate('/transactions/new/expense'))}>
            <span className="fab-option-icon fab-option-icon--expense" aria-hidden="true">
              <ArrowDown size={15} strokeWidth={2.25} />
            </span>
            {t('fab.expense')}
          </button>
          <button type="button" className="fab-option" role="menuitem" onClick={() => pick(() => navigate('/transactions/new/income'))}>
            <span className="fab-option-icon fab-option-icon--income" aria-hidden="true">
              <ArrowUp size={15} strokeWidth={2.25} />
            </span>
            {t('fab.income')}
          </button>
        </div>
      )}
      <button
        type="button"
        className={`fab${open ? ' fab-open' : ''}`}
        aria-label={open ? t('fab.closeLabel') : t('fab.openLabel')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
