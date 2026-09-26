import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Account, Category, Debt, RecurringBill, Transaction, TransactionType } from '../types';
import type { PinSetupMode } from '../components/PinSetupSheet';

export type SheetState =
  | { kind: 'none' }
  | { kind: 'view-transaction'; transaction: Transaction }
  | { kind: 'edit-transaction'; transaction: Transaction }
  | { kind: 'add-payment'; debt: Debt }
  | { kind: 'edit-category'; type: TransactionType; category?: Category }
  | { kind: 'edit-account'; account?: Account }
  | { kind: 'pin-setup'; mode: PinSetupMode }
  | { kind: 'edit-bill'; bill: RecurringBill }
  | { kind: 'mark-bill-paid'; bill: RecurringBill };

interface SheetContextValue {
  sheet: SheetState;
  open: (s: SheetState) => void;
  close: () => void;
}

const SheetContext = createContext<SheetContextValue | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  return (
    <SheetContext.Provider value={{ sheet, open: setSheet, close: () => setSheet({ kind: 'none' }) }}>
      {children}
    </SheetContext.Provider>
  );
}

export function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet должен использоваться внутри SheetProvider');
  return ctx;
}
