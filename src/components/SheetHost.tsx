import { useSheet } from '../context/SheetContext';
import { AddTransactionSheet } from './AddTransactionSheet';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { AddDebtPaymentSheet } from './AddDebtPaymentSheet';
import { CategoryFormSheet } from './CategoryFormSheet';
import { AccountFormSheet } from './AccountFormSheet';
import { PinSetupSheet } from './PinSetupSheet';
import { AddBillSheet } from './AddBillSheet';
import { MarkBillPaidSheet } from './MarkBillPaidSheet';

export function SheetHost() {
  const { sheet, close } = useSheet();

  switch (sheet.kind) {
    case 'view-transaction':
      return <TransactionDetailSheet onClose={close} transaction={sheet.transaction} />;
    case 'edit-transaction':
      return <AddTransactionSheet onClose={close} transaction={sheet.transaction} />;
    case 'add-payment':
      return <AddDebtPaymentSheet onClose={close} debt={sheet.debt} />;
    case 'edit-category':
      return <CategoryFormSheet onClose={close} type={sheet.type} category={sheet.category} />;
    case 'edit-account':
      return <AccountFormSheet onClose={close} account={sheet.account} />;
    case 'pin-setup':
      return <PinSetupSheet onClose={close} mode={sheet.mode} />;
    case 'edit-bill':
      return <AddBillSheet onClose={close} bill={sheet.bill} />;
    case 'mark-bill-paid':
      return <MarkBillPaidSheet onClose={close} bill={sheet.bill} />;
    default:
      return null;
  }
}
