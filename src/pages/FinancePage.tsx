import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Settings2, TrendingDown, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { Sparkline } from '../components/Sparkline';
import { StatCard } from '../components/StatCard';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { formatMoney } from '../utils/format';
import { getCashBalance } from '../utils/stats';

interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
  quant: number;
  change: number;
}

interface CryptoRate {
  code: string; // id CoinGecko, напр. "bitcoin"
  symbol: string;
  name: string;
  priceKzt: number;
  changePct: number;
}

interface Asset {
  kind: 'currency' | 'crypto';
  code: string;
  symbol: string;
  name: string;
  priceKzt: number;
  changePct: number;
}

export const DEFAULT_FINANCE_FAVORITES = ['currency:USD', 'currency:EUR', 'currency:RUB', 'crypto:bitcoin', 'crypto:ethereum'];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function assetColor(code: string): string {
  return CATEGORICAL_LIGHT[Math.abs(hashCode(code)) % CATEGORICAL_LIGHT.length];
}

export function FinancePage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [currencies, setCurrencies] = useState<CurrencyRate[] | null>(null);
  const [cryptos, setCryptos] = useState<CryptoRate[] | null>(null);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const transactions = useLiveQuery(() => db.transactions.toArray(), []);

  const favorites = useMemo(
    () => (settings.financeFavorites ?? DEFAULT_FINANCE_FAVORITES).map((entry) => {
      const [kind, code] = entry.split(':');
      return { kind: kind as 'currency' | 'crypto', code };
    }),
    [settings.financeFavorites],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/rates', { credentials: 'same-origin' }).then((res) => res.json()),
      fetch('/api/rates/crypto', { credentials: 'same-origin' }).then((res) => res.json()),
    ])
      .then(([currencyBody, cryptoBody]) => {
        if (cancelled) return;
        if (currencyBody.error) throw new Error(currencyBody.error);
        setCurrencies(currencyBody.rates ?? []);
        setCryptos(cryptoBody.error ? [] : (cryptoBody.rates ?? []));
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

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      favorites.map((f) =>
        fetch(`/api/rates/history?kind=${f.kind}&code=${encodeURIComponent(f.code)}&range=1W`, { credentials: 'same-origin' })
          .then((res) => res.json())
          .then((body) => [`${f.kind}:${f.code}`, (body.points ?? []).map((p: { price: number }) => p.price)] as const)
          .catch(() => [`${f.kind}:${f.code}`, []] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setSparklines(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // favorites пересчитывается из settings.financeFavorites — реагируем на него, а не на новый массив favorites каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.financeFavorites]);

  const currencyByCode = useMemo(() => new Map((currencies ?? []).map((r) => [r.code, r])), [currencies]);
  const cryptoByCode = useMemo(() => new Map((cryptos ?? []).map((r) => [r.code, r])), [cryptos]);

  const toAsset = (kind: 'currency' | 'crypto', code: string): Asset | null => {
    if (kind === 'currency') {
      const r = currencyByCode.get(code);
      if (!r) return null;
      return { kind, code: r.code, symbol: r.code, name: r.name, priceKzt: r.rate / r.quant, changePct: r.change };
    }
    const r = cryptoByCode.get(code);
    if (!r) return null;
    return { kind, code: r.code, symbol: r.symbol, name: r.name, priceKzt: r.priceKzt, changePct: r.changePct };
  };

  const favoriteCurrencies = favorites.filter((f) => f.kind === 'currency').map((f) => toAsset('currency', f.code)).filter((a): a is Asset => !!a);
  const favoriteCryptos = favorites.filter((f) => f.kind === 'crypto').map((f) => toAsset('crypto', f.code)).filter((a): a is Asset => !!a);
  const favoriteCurrencyCodes = new Set(favoriteCurrencies.map((a) => a.code));
  const restCurrencies = (currencies ?? []).filter((r) => !favoriteCurrencyCodes.has(r.code));

  const moneyTotal = useMemo(() => (transactions ? getCashBalance(transactions) : 0), [transactions]);

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
          <p className="section-label">{t('finance.myAssetsTitle')}</p>
          <StatCard label={t('finance.assetsTotal')} value={formatMoney(moneyTotal, settings.currency)} emphasis />
          <div className="stat-row stat-row-3">
            <div className="stat-card overview-card">
              <span className="stat-card-label">{t('finance.assetsMoney')}</span>
              <div className="stat-card-value">{formatMoney(moneyTotal, settings.currency)}</div>
            </div>
            <div className="stat-card overview-card">
              <span className="stat-card-label">{t('finance.assetsInvestments')}</span>
              <div className="stat-card-value">{formatMoney(0, settings.currency)}</div>
            </div>
            <div className="stat-card overview-card">
              <span className="stat-card-label">{t('finance.assetsCash')}</span>
              <div className="stat-card-value">{formatMoney(0, settings.currency)}</div>
            </div>
          </div>

          <div className="section-header">
            <h2>{t('finance.favoritesTitle')}</h2>
            <Link to="/finance/customize" className="btn-link finance-customize-link">
              <Settings2 size={14} strokeWidth={2.25} /> {t('finance.customize')}
            </Link>
          </div>

          {favoriteCurrencies.length > 0 && (
            <>
              <p className="section-label finance-group-label">{t('finance.groupCurrencies')}</p>
              <div className="grouped-list">
                {favoriteCurrencies.map((a) => (
                  <AssetRow key={`${a.kind}:${a.code}`} asset={a} currency={settings.currency} sparkline={sparklines[`${a.kind}:${a.code}`]} />
                ))}
              </div>
            </>
          )}

          {favoriteCryptos.length > 0 && (
            <>
              <p className="section-label finance-group-label">{t('finance.groupCrypto')}</p>
              <div className="grouped-list">
                {favoriteCryptos.map((a) => (
                  <AssetRow key={`${a.kind}:${a.code}`} asset={a} currency={settings.currency} sparkline={sparklines[`${a.kind}:${a.code}`]} />
                ))}
              </div>
            </>
          )}

          {favoriteCurrencies.length === 0 && favoriteCryptos.length === 0 && (
            <p className="settings-hint">{t('finance.noFavorites')}</p>
          )}

          {restCurrencies.length > 0 && (
            <>
              <p className="section-label">{t('finance.otherCurrencies')}</p>
              <div className="grouped-list">
                {restCurrencies.map((r) => (
                  <AssetRow
                    key={r.code}
                    asset={{ kind: 'currency', code: r.code, symbol: r.code, name: r.name, priceKzt: r.rate / r.quant, changePct: r.change }}
                    currency={settings.currency}
                  />
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

function AssetRow({ asset, currency, sparkline }: { asset: Asset; currency: string; sparkline?: number[] }) {
  const color = assetColor(asset.code);
  const up = asset.changePct >= 0;
  const href = `/finance/${asset.kind}/${encodeURIComponent(asset.code)}`;

  return (
    <Link to={href} className="grouped-list-row rate-row">
      <span className={`grouped-list-icon${asset.symbol.length <= 4 ? ' icon-monogram' : ''}`} style={{ background: `${color}26`, color }}>
        {asset.symbol}
      </span>
      <span className="grouped-list-info">
        <span className="grouped-list-name">{asset.name}</span>
        <span className="grouped-list-hint">{asset.symbol} / {currency}</span>
      </span>
      {sparkline && sparkline.length >= 2 && <Sparkline points={sparkline} positive={up} />}
      <span className="rate-row-trailing">
        <span className="rate-row-price">{formatMoney(asset.priceKzt, currency)}</span>
        <span className={`rate-change-pill tone-${up ? 'positive' : 'negative'}`}>
          {up ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
          {Math.abs(asset.changePct).toFixed(2)}%
        </span>
      </span>
    </Link>
  );
}
