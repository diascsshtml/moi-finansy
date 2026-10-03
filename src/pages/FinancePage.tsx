import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { useSettings } from '../context/SettingsContext';

interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
  quant: number;
  change: number;
}

interface RatesResponse {
  date: string;
  rates: CurrencyRate[];
}

// Основные валюты для клиентов в Казахстане — полный список НацБанка РК
// содержит 70+ валют, большинство из них пользователю не нужны.
const FEATURED_CODES = ['USD', 'EUR', 'RUB', 'CNY', 'GBP', 'TRY', 'KGS', 'UZS', 'AED', 'CHF'];

export function FinancePage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [data, setData] = useState<RatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/rates', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body: RatesResponse & { error?: string }) => {
        if (cancelled) return;
        if (body.error) throw new Error(body.error);
        setData(body);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('finance.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const featured = FEATURED_CODES.map((code) => data?.rates.find((r) => r.code === code)).filter(
    (r): r is CurrencyRate => !!r,
  );
  const rest = (data?.rates ?? []).filter((r) => !FEATURED_CODES.includes(r.code));

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('finance.title')}</h1>
        <p className="page-subtitle">{t('finance.subtitle')}</p>
      </header>

      {loading ? (
        <p className="settings-hint">{t('finance.loading')}</p>
      ) : error ? (
        <p className="field-error">{error}</p>
      ) : (
        <>
          {data?.date && <p className="section-label">{t('finance.asOf', { date: data.date })}</p>}

          <div className="grouped-list">
            {featured.map((rate) => (
              <RateRow key={rate.code} rate={rate} currency={settings.currency} />
            ))}
          </div>

          {rest.length > 0 && (
            <>
              <p className="section-label">{t('finance.otherCurrencies')}</p>
              <div className="grouped-list">
                {rest.map((rate) => (
                  <RateRow key={rate.code} rate={rate} currency={settings.currency} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="settings-hint">{t('finance.sourceHint')}</p>
    </div>
  );
}

function RateRow({ rate, currency }: { rate: CurrencyRate; currency: string }) {
  const perUnit = rate.rate / rate.quant;
  const color = CATEGORICAL_LIGHT[Math.abs(hashCode(rate.code)) % CATEGORICAL_LIGHT.length];
  const up = rate.change >= 0;

  return (
    <div className="grouped-list-row rate-row">
      <span className={`grouped-list-icon${rate.code.length <= 3 ? ' icon-monogram' : ''}`} style={{ background: `${color}26`, color }}>
        {rate.code}
      </span>
      <span className="grouped-list-info">
        <span className="grouped-list-name">{rate.name}</span>
        <span className="grouped-list-hint">
          1 {rate.code} = {perUnit.toFixed(2)} {currency}
        </span>
      </span>
      <span className={`rate-row-change tone-${up ? 'positive' : 'negative'}`}>
        {up ? <TrendingUp size={14} strokeWidth={2.25} /> : <TrendingDown size={14} strokeWidth={2.25} />}
        {Math.abs(rate.change).toFixed(2)}
      </span>
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
