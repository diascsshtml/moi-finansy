import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminUserData, fetchAdminUsers, type AdminDataSnapshot, type AdminUser } from '../utils/adminApi';
import { EmojiIcon } from '../utils/icons';

const KEY_STORAGE = 'mf_admin_key';

function formatRegisteredAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function num(n: number): string {
  return n.toLocaleString('ru-RU');
}

function computeBalances(snapshot: AdminDataSnapshot): Map<string, number> {
  const balances = new Map<string, number>();
  for (const a of snapshot.accounts) balances.set(a.id, 0);
  for (const tx of snapshot.transactions) {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    balances.set(tx.accountId, (balances.get(tx.accountId) ?? 0) + delta);
  }
  for (const tr of snapshot.transfers) {
    balances.set(tr.fromAccountId, (balances.get(tr.fromAccountId) ?? 0) - tr.amount);
    balances.set(tr.toAccountId, (balances.get(tr.toAccountId) ?? 0) + tr.amount);
  }
  return balances;
}

/** Финансовая сводка одного клиента — раскрывается прямо под его строкой в
 *  списке. Валюта у каждого клиента своя и в снимке не хранится (см.
 *  dataSync.ts — настройки, включая валюту, сознательно не синхронизируются),
 *  поэтому суммы здесь просто числа, без символа валюты. */
function ClientDataSummary({ snapshot }: { snapshot: AdminDataSnapshot }) {
  const balances = computeBalances(snapshot);
  const totalIncome = snapshot.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = snapshot.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const openDebts = snapshot.debts.filter((d) => d.status === 'open');
  const owedToMe = openDebts.filter((d) => d.direction === 'owed_to_me').reduce((s, d) => s + d.currentAmount, 0);
  const iOwe = openDebts.filter((d) => d.direction === 'i_owe').reduce((s, d) => s + d.currentAmount, 0);

  return (
    <div className="admin-user-detail">
      <p className="settings-hint" style={{ margin: '0 0 8px' }}>
        Валюта у каждого клиента своя — суммы ниже без символа.
      </p>

      <div className="admin-detail-grid">
        <div>
          <div className="admin-detail-label">Операций всего</div>
          <div className="admin-detail-value">{snapshot.transactions.length}</div>
        </div>
        <div>
          <div className="admin-detail-label">Доходы</div>
          <div className="admin-detail-value admin-detail-value--positive">+{num(totalIncome)}</div>
        </div>
        <div>
          <div className="admin-detail-label">Расходы</div>
          <div className="admin-detail-value admin-detail-value--negative">−{num(totalExpense)}</div>
        </div>
        {(owedToMe > 0 || iOwe > 0) && (
          <>
            <div>
              <div className="admin-detail-label">Должны клиенту</div>
              <div className="admin-detail-value">{num(owedToMe)}</div>
            </div>
            <div>
              <div className="admin-detail-label">Клиент должен</div>
              <div className="admin-detail-value">{num(iOwe)}</div>
            </div>
          </>
        )}
      </div>

      {snapshot.accounts.length > 0 && (
        <>
          <div className="admin-detail-subtitle">Счета</div>
          {snapshot.accounts.map((a) => (
            <div key={a.id} className="admin-detail-row">
              <span>
                <EmojiIcon icon={a.icon} size={14} className="inline-icon" /> {a.name}
              </span>
              <span>{num(balances.get(a.id) ?? 0)}</span>
            </div>
          ))}
        </>
      )}

      {snapshot.transactions.length === 0 && <p className="settings-hint">Операций пока нет.</p>}
    </div>
  );
}

/** Скрытая страница только для владельца приложения — список
 *  зарегистрированных клиентов и, по запросу, финансовый снимок каждого
 *  (операции, счета, долги — то же, что синхронизируется с его устройств).
 *  Не привязана к обычному входу пользователя и нигде в интерфейсе не
 *  упоминается — доступ по прямой ссылке /#/admin и отдельному секретному
 *  ключу (см. worker/accounts-api.ts, X-Admin-Key). Без i18n — это не часть
 *  обычного пользовательского интерфейса. */
export function Admin() {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, AdminDataSnapshot | null>>({});
  const [detailBusy, setDetailBusy] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async (candidateKey: string) => {
    setBusy(true);
    setError(null);
    try {
      const list = await fetchAdminUsers(candidateKey);
      setUsers(list);
      try {
        localStorage.setItem(KEY_STORAGE, candidateKey);
      } catch {
        // приватный режим — переживём, просто спросит ключ ещё раз в следующий заход
      }
    } catch (e) {
      setUsers(null);
      setError(e instanceof Error ? e.message : String(e));
      try {
        localStorage.removeItem(KEY_STORAGE);
      } catch {
        // см. выше
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY_STORAGE);
    } catch {
      // см. выше
    }
    if (stored) {
      setKey(stored);
      void load(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForget = () => {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      // см. выше
    }
    setUsers(null);
    setKey('');
  };

  const handleToggle = async (username: string) => {
    if (expanded === username) {
      setExpanded(null);
      return;
    }
    setExpanded(username);
    if (username in snapshots) return;
    setDetailBusy(username);
    setDetailError(null);
    try {
      const { snapshot } = await fetchAdminUserData(key, username);
      setSnapshots((prev) => ({ ...prev, [username]: snapshot }));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailBusy(null);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/')}>
          ← Назад
        </button>
        <h1>Клиенты</h1>
        <p className="page-subtitle">Список зарегистрированных аккаунтов — нажмите на клиента, чтобы увидеть его данные</p>
      </header>

      {users === null && (
        <section className="settings-section">
          <label className="field-label" htmlFor="admin-key">
            Секретный ключ
          </label>
          <input
            id="admin-key"
            type="password"
            className="text-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-block" disabled={busy || !key.trim()} onClick={() => load(key.trim())}>
            {busy ? 'Проверяем…' : 'Показать'}
          </button>
          {error && <p className="field-error">{error}</p>}
        </section>
      )}

      {users !== null && (
        <section className="settings-section">
          <p className="settings-hint">Всего клиентов: {users.length}</p>
          {users.map((u) => (
            <div key={u.username} className="admin-user-row">
              {/* Раскрытая карточка становится высокой и в основном состоит из
                  детальных данных — если вешать toggle на весь блок, клик по
                  контенту (а не по заголовку) не долистывает до строки и не
                  закрывает её. Поэтому кликабелен только заголовок. */}
              <div onClick={() => handleToggle(u.username)} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
                <div className="admin-user-name">{u.name}</div>
                <div className="admin-user-meta">
                  @{u.username} · {formatRegisteredAt(u.created_at)}
                  {u.email ? ` · ${u.email}` : ' · без почты'}
                </div>
              </div>

              {expanded === u.username && (
                <div>
                  {detailBusy === u.username && <p className="settings-hint">Загружаем…</p>}
                  {detailError && detailBusy !== u.username && <p className="field-error">{detailError}</p>}
                  {snapshots[u.username] === null && detailBusy !== u.username && <p className="settings-hint">Клиент ещё ничего не синхронизировал.</p>}
                  {snapshots[u.username] && <ClientDataSummary snapshot={snapshots[u.username]!} />}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="btn-link" onClick={handleForget}>
            Забыть ключ
          </button>
        </section>
      )}
    </div>
  );
}
