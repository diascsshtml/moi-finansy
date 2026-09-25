import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  hint?: string;
  emphasis?: boolean;
  action?: ReactNode;
}

export function StatCard({ label, value, tone = 'neutral', hint, emphasis, action }: StatCardProps) {
  return (
    <div className={`stat-card${emphasis ? ' stat-card--hero' : ''}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {action}
      </div>
      <div className={`stat-card-value tone-${tone}`}>{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}
