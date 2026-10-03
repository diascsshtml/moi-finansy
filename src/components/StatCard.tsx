import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  hint?: string;
  emphasis?: boolean;
  action?: ReactNode;
  icon?: ReactNode;
}

export function StatCard({ label, value, tone = 'neutral', hint, emphasis, action, icon }: StatCardProps) {
  return (
    <div className={`stat-card${emphasis ? ' stat-card--hero' : ''}${icon ? ' overview-card' : ''}`}>
      {icon && (
        <span className={`overview-icon overview-icon--${tone === 'neutral' ? 'danger' : tone}`} aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {action}
      </div>
      <div className={`stat-card-value tone-${tone}`}>{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}
