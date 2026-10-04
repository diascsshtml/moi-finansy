import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { Sheet } from './Sheet';

interface HowItWorksButtonProps {
  title: string;
  body: string;
}

/** Маленькая кнопка-подсказка в шапке страницы — открывает шторку с коротким
 *  объяснением, что на этой странице и как им пользоваться. */
export function HowItWorksButton({ title, body }: HowItWorksButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={t('common.howItWorks')}>
        <CircleHelp size={18} strokeWidth={2.25} />
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <p className="settings-hint">{body}</p>
        </Sheet>
      )}
    </>
  );
}
