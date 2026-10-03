const MONOGRAM_RE = /^[A-Za-zА-Яа-яЁё+]{1,3}$/;

/** Отличает буквенную монограмму (T2, Kp, iD...) от обычной эмодзи-иконки —
 *  чтобы применить более жирное и компактное начертание именно к тексту.
 *  Используется для иконок кредитов/рассрочек (см. BillRow, BillDetail,
 *  CreditPaymentSheet). */
export function isMonogramIcon(icon: string): boolean {
  return MONOGRAM_RE.test(icon);
}
