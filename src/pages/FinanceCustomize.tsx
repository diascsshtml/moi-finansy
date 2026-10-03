import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronUp, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_FINANCE_FAVORITES } from './FinancePage';

interface CurrencyRate {
  code: string;
  name: string;
}

interface CryptoRate {
  code: string;
  symbol: string;
  name: string;
}

export function FinanceCustomize() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { settings, setFinanceFavorites } = useSettings();
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [cryptos, setCryptos] = useState<CryptoRate[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/rates', { credentials: 'same-origin' }).then((res) => res.json()),
      fetch('/api/rates/crypto', { credentials: 'same-origin' }).then((res) => res.json()),
    ]).then(([currencyBody, cryptoBody]) => {
      if (cancelled) return;
      setCurrencies(currencyBody.rates ?? []);
      setCryptos(cryptoBody.rates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const favorites = settings.financeFavorites ?? DEFAULT_FINANCE_FAVORITES;
  const currencyByCode = new Map(currencies.map((c) => [c.code, c]));
  const cryptoByCode = new Map(cryptos.map((c) => [c.code, c]));

  const toggle = (entry: string) => {
    const next = favorites.includes(entry) ? favorites.filter((f) => f !== entry) : [...favorites, entry];
    void setFinanceFavorites(next);
  };

  const move = (entry: string, dir: -1 | 1) => {
    const idx = favorites.indexOf(entry);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= favorites.length) return;
    const next = [...favorites];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    void setFinanceFavorites(next);
  };

  const labelFor = (entry: string): { name: string; hint: string } => {
    const [kind, code] = entry.split(':');
    if (kind === 'currency') {
      const c = currencyByCode.get(code);
      return { name: c?.name ?? code, hint: code };
    }
    const c = cryptoByCode.get(code);
    return { name: c?.name ?? code, hint: c?.symbol ?? code };
  };

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} />
        </button>
        <h1>{t('finance.customizeTitle')}</h1>
      </header>
      <p className="settings-hint">{t('finance.customizeHint')}</p>

      <p className="section-label">{t('finance.favoritesTitle')}</p>
      {favorites.length === 0 ? (
        <p className="settings-hint">{t('finance.noFavorites')}</p>
      ) : (
        <div className="grouped-list">
          {favorites.map((entry, i) => {
            const { name, hint } = labelFor(entry);
            return (
              <div key={entry} className="grouped-list-row finance-customize-row">
                <span className="grouped-list-info">
                  <span className="grouped-list-name">{name}</span>
                  <span className="grouped-list-hint">{hint}</span>
                </span>
                <div className="finance-customize-actions">
                  <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(entry, -1)} aria-label={t('finance.moveUp')}>
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={i === favorites.length - 1}
                    onClick={() => move(entry, 1)}
                    aria-label={t('finance.moveDown')}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => toggle(entry)} aria-label={t('finance.removeFavorite')}>
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="section-label">{t('finance.groupCurrencies')}</p>
      <div className="grouped-list">
        {currencies.map((c) => {
          const entry = `currency:${c.code}`;
          return (
            <label key={entry} className="grouped-list-row finance-customize-row">
              <span className="grouped-list-info">
                <span className="grouped-list-name">{c.name}</span>
                <span className="grouped-list-hint">{c.code}</span>
              </span>
              <input type="checkbox" className="toggle-switch" checked={favorites.includes(entry)} onChange={() => toggle(entry)} />
            </label>
          );
        })}
      </div>

      <p className="section-label">{t('finance.groupCrypto')}</p>
      <div className="grouped-list">
        {cryptos.map((c) => {
          const entry = `crypto:${c.code}`;
          return (
            <label key={entry} className="grouped-list-row finance-customize-row">
              <span className="grouped-list-info">
                <span className="grouped-list-name">{c.name}</span>
                <span className="grouped-list-hint">{c.symbol}</span>
              </span>
              <input type="checkbox" className="toggle-switch" checked={favorites.includes(entry)} onChange={() => toggle(entry)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}
