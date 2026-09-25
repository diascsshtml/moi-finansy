import { useSheet } from '../context/SheetContext';
import { AddTransactionSheet } from './AddTransactionSheet';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { AddDebtSheet } from './AddDebtSheet';
import { AddDebtPaymentSheet } from './AddDebtPaymentSheet';
import { CategoryFormSheet } from './CategoryFormSheet';
import { AddTransferSheet } from './AddTransferSheet';
import { AccountFormSheet } from './AccountFormSheet';
import { PinSetupSheet } from './PinSetupSheet';
import { AddBillSheet } from './AddBillSheet';
import { MarkBillPaidSheet } from './MarkBillPaidSheet';
import { BillCatalogSheet } from './BillCatalogSheet';

export function SheetHost() {
  const { sheet, close } = useSheet();

  switch (sheet.kind) {
    case 'add-transaction':
      return <AddTransactionSheet onClose={close} type={sheet.type} />;
    case 'view-transaction':
      return <TransactionDetailSheet onClose={close} transaction={sheet.transaction} />;
    case 'edit-transaction':
      return <AddTransactionSheet onClose={close} transaction={sheet.transaction} />;
    case 'add-debt':
      return <AddDebtSheet onClose={close} direction={sheet.direction} />;
    case 'add-payment':
      return <AddDebtPaymentSheet onClose={close} debt={sheet.debt} />;
    case 'edit-category':
      return <CategoryFormSheet onClose={close} type={sheet.type} category={sheet.category} />;
    case 'add-transfer':
      return <AddTransferSheet onClose={close} />;
    case 'edit-account':
      return <AccountFormSheet onClose={close} account={sheet.account} />;
    case 'pin-setup':
      return <PinSetupSheet onClose={close} mode={sheet.mode} />;
    case 'bill-catalog':
      return <BillCatalogSheet onClose={close} />;
    case 'edit-bill':
      return <AddBillSheet onClose={close} bill={sheet.bill} preset={sheet.preset} />;
    case 'mark-bill-paid':
      return <MarkBillPaidSheet onClose={close} bill={sheet.bill} />;
    default:
      return null;
  }
}
