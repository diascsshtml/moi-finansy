import type { ReactNode } from 'react';
import { EmojiIcon } from '../utils/icons';

interface EmptyStateProps {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <EmojiIcon icon={icon} size={28} strokeWidth={1.75} />
      </span>
      <p className="empty-state-title">{title}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
