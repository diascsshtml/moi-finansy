import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { MonthPoint } from '../../utils/stats';
import { formatCompact, formatMoney } from '../../utils/format';
import { getPalette } from '../../styles/palette';

interface IncomeExpenseBarsProps {
  data: MonthPoint[];
  currency: string;
  isDark: boolean;
}

export function IncomeExpenseBars({ data, currency, isDark }: IncomeExpenseBarsProps) {
  const { t } = useTranslation();
  const palette = getPalette(isDark);
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  return (
    <div className="chart-card">
      <div className="chart-title-row">
        <h3 className="chart-title">{t('charts.incomeExpenseByMonth')}</h3>
        <div className="chart-legend-inline">
          <span>
            <i style={{ background: palette.income }} /> {t('charts.incomePlural')}
          </span>
          <span>
            <i style={{ background: palette.expense }} /> {t('charts.expensePlural')}
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="empty-hint">{t('charts.notEnoughData')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={palette.chrome.grid} strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: palette.chrome.baseline }}
              tick={{ fill: palette.chrome.textMuted, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: palette.chrome.textMuted, fontSize: 11 }}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ fill: palette.chrome.grid, opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="chart-tooltip">
                    <strong>{label}</strong>
                    {payload.map((p) => (
                      <span key={p.dataKey as string} style={{ color: p.color }}>
                        {p.dataKey === 'income' ? t('charts.income') : t('charts.expense')}: {formatMoney(Number(p.value), currency)}
                      </span>
                    ))}
                  </div>
                );
              }}
            />
            <Bar dataKey="income" name={t('charts.incomePlural')} fill={palette.income} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="expense" name={t('charts.expensePlural')} fill={palette.expense} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
