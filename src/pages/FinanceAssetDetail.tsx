import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getPalette } from '../styles/palette';
import { formatDateShort, formatMoney } from '../utils/format';
import { EmptyState } from '../components/EmptyState';

interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
  quant: number;
  change: number;
}

interface CryptoRate {
  code: string;
  symbol: string;
  name: string;
  priceKzt: number;
  changePct: number;
}

interface HistoryPoint {
  date: string;
  price: number;
}

const RANGES = ['1W', '1M', '3M', '1Y'] as const;
type Range = (typeof RANGES)[number];

export function FinanceAssetDetail() {
  const { kind, code } = useParams<{ kind: 'currency' | 'crypto'; code: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const palette = getPalette(isDark);

  const [asset, setAsset] = useState<{ name: string; symbol: string; priceKzt: number; changePct: number } | null>(null);
  const [assetError, setAssetError] = useState(false);
  const [range, setRange] = useState<Range>('1M');
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  useEffect(() => {
    if (!kind || !code) return;
    let cancelled = false;
    const url = kind === 'currency' ? '/api/rates' : '/api/rates/crypto';
    fetch(url, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) throw new Error(body.error);
        if (kind === 'currency') {
          const r = (body.rates as CurrencyRate[]).find((x) => x.code === code);
          if (!r) throw new Error('not found');
          setAsset({ name: r.name, symbol: r.code, priceKzt: r.rate / r.quant, changePct: r.change });
          setUpdatedAt(body.date);
        } else {
          const r = (body.rates as CryptoRate[]).find((x) => x.code === code);
          if (!r) throw new Error('not found');
          setAsset({ name: r.name, symbol: r.symbol, priceKzt: r.priceKzt, changePct: r.changePct });
          setUpdatedAt(body.date);
        }
      })
      .catch(() => {
        if (!cancelled) setAssetError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, code]);

  useEffect(() => {
    if (!kind || !code) return;
    let cancelled = false;
    fetch(`/api/rates/history?kind=${kind}&code=${encodeURIComponent(code)}&range=${range}`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPoints(body.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, code, range]);

  const chartData = useMemo(() => (points ?? []).map((p) => ({ date: p.date, price: p.price })), [points]);
  const trendPositive = chartData.length >= 2 ? chartData[chartData.length - 1].price >= chartData[0].price : (asset?.changePct ?? 0) >= 0;
  const lineColor = trendPositive ? palette.chrome.moneyPositive : palette.chrome.moneyNegative;

  if (assetError) {
    return <EmptyState icon="🤷" title={t('finance.assetNotFound')} />;
  }

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} />
        </button>
        <h1>{asset ? `${asset.symbol} / ${settings.currency}` : '…'}</h1>
      </header>

      {!asset ? (
        <p className="settings-hint">{t('finance.loading')}</p>
      ) : (
        <>
          <div className="debt-detail-card">
            <span className="debt-detail-badge">{asset.name}</span>
            <h1 className="debt-detail-name">{formatMoney(asset.priceKzt, settings.currency)}</h1>
            <span className={`rate-change-pill tone-${asset.changePct >= 0 ? 'positive' : 'negative'}`}>
              {asset.changePct >= 0 ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
              {Math.abs(asset.changePct).toFixed(2)}%
            </span>
          </div>

          <p className="settings-hint">{t('finance.updatedAt', { date: updatedAt })}</p>

          <div className="chip-scroll-row finance-range-tabs">
            {RANGES.map((r) => (
              <button key={r} type="button" className={`filter-chip${range === r ? ' active' : ''}`} onClick={() => setRange(r)}>
                {t(`finance.range.${r}`)}
              </button>
            ))}
          </div>

          <div className="chart-card">
            {points === null ? (
              <p className="empty-hint">{t('finance.loading')}</p>
            ) : chartData.length < 2 ? (
              <p className="empty-hint">{t('finance.historyGrowing')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="assetDetailFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    cursor={{ stroke: palette.chrome.baseline, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { date: string; price: number };
                      return (
                        <div className="chart-tooltip">
                          <strong>{formatDateShort(p.date)}</strong>
                          <span>{formatMoney(p.price, settings.currency)}</span>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={2}
                    fill="url(#assetDetailFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
