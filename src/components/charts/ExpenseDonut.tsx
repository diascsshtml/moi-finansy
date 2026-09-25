import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { CategoryBreakdownRow } from '../../utils/stats';
import { formatMoney } from '../../utils/format';
import { NEUTRAL_COLOR, toDisplayColor } from '../../styles/palette';
import { EmojiIcon } from '../../utils/icons';

interface ExpenseDonutProps {
  rows: CategoryBreakdownRow[];
  currency: string;
  isDark: boolean;
  title: string;
}

const MAX_SEGMENTS = 6;

export function ExpenseDonut({ rows, currency, isDark, title }: ExpenseDonutProps) {
  const { t } = useTranslation();
  const total = rows.reduce((s, r) => s + r.amount, 0);

  if (rows.length === 0 || total <= 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">{title}</h3>
        <p className="empty-hint">{t('charts.noExpensesThisPeriod')}</p>
      </div>
    );
  }

  const top = rows.slice(0, MAX_SEGMENTS);
  const restTotal = rows.slice(MAX_SEGMENTS).reduce((s, r) => s + r.amount, 0);
  const display = restTotal > 0
    ? [...top, { categoryId: '__other__', name: t('charts.other'), icon: '📦', color: NEUTRAL_COLOR.light, amount: restTotal }]
    : top;

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={display}
              dataKey="amount"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="var(--surface-1)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {display.map((row) => (
                <Cell key={row.categoryId} fill={toDisplayColor(row.color, isDark)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof display)[number];
                const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
                return (
                  <div className="chart-tooltip">
                    <strong>
                      <EmojiIcon icon={row.icon} size={14} className="inline-icon" /> {row.name}
                    </strong>
                    <span>{formatMoney(row.amount, currency)}</span>
                    <span className="chart-tooltip-muted">{pct}%</span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden="true">
          <span className="donut-center-value">{formatMoney(total, currency)}</span>
          <span className="donut-center-label">{t('charts.total')}</span>
        </div>
      </div>

      <ul className="chart-legend-list" aria-label={t('charts.breakdownTableLabel')}>
        {display.map((row) => {
          const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
          return (
            <li key={row.categoryId}>
              <span className="legend-dot" style={{ background: toDisplayColor(row.color, isDark) }} aria-hidden="true" />
              <span className="legend-name">
                <EmojiIcon icon={row.icon} size={14} className="inline-icon" /> {row.name}
              </span>
              <span className="legend-pct">{pct}%</span>
              <span className="legend-amount">{formatMoney(row.amount, currency)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
