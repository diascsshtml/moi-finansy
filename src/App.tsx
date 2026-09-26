import { HashRouter, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { SheetProvider } from './context/SheetContext';
import { AccountProvider } from './context/AccountContext';
import { AccountGate } from './components/AccountGate';
import { AppLockGate } from './components/AppLockGate';
import { BottomNav } from './components/BottomNav';
import { Fab } from './components/Fab';
import { SheetHost } from './components/SheetHost';
import { Dashboard } from './pages/Dashboard';
import { Stats } from './pages/Stats';
import { History } from './pages/History';
import { DayDetail } from './pages/DayDetail';
import { Debts } from './pages/Debts';
import { DebtDetail } from './pages/DebtDetail';
import { Bills } from './pages/Bills';
import { BillDetail } from './pages/BillDetail';
import { SettingsPage } from './pages/Settings';
import { Categories } from './pages/Categories';
import { Accounts } from './pages/Accounts';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import { ProfileHub } from './pages/ProfileHub';
import { NewTransactionPage } from './pages/NewTransactionPage';
import { NewDebtPage } from './pages/NewDebtPage';
import { NewTransferPage } from './pages/NewTransferPage';
import { NewBillCatalogPage } from './pages/NewBillCatalogPage';
import { NewBillFormPage } from './pages/NewBillFormPage';

function App() {
  return (
    <SettingsProvider>
      <AccountProvider>
        <AccountGate>
          <AppLockGate>
            <SheetProvider>
              <HashRouter>
                <div className="app-shell">
                  <main className="app-main">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/history/day/:date" element={<DayDetail />} />
                      <Route path="/debts" element={<Debts />} />
                      <Route path="/debts/new/:direction" element={<NewDebtPage />} />
                      <Route path="/debts/:id" element={<DebtDetail />} />
                      <Route path="/bills" element={<Bills />} />
                      <Route path="/bills/new" element={<NewBillCatalogPage />} />
                      <Route path="/bills/new/form" element={<NewBillFormPage />} />
                      <Route path="/bills/:id" element={<BillDetail />} />
                      <Route path="/transactions/new/:type" element={<NewTransactionPage />} />
                      <Route path="/transfers/new" element={<NewTransferPage />} />
                      <Route path="/settings" element={<ProfileHub />} />
                      <Route path="/settings/preferences" element={<SettingsPage />} />
                      <Route path="/settings/categories" element={<Categories />} />
                      <Route path="/settings/accounts" element={<Accounts />} />
                      <Route path="/settings/profile" element={<Profile />} />
                      <Route path="/admin" element={<Admin />} />
                    </Routes>
                  </main>
                  <Fab />
                  <BottomNav />
                  <SheetHost />
                </div>
              </HashRouter>
            </SheetProvider>
          </AppLockGate>
        </AccountGate>
      </AccountProvider>
    </SettingsProvider>
  );
}

export default App;
