import { useMemo, useState } from 'react';

import { getAppDb } from '@/db/client';
import type { DebtRow } from '@/db/schema';
import { currencySymbol, type Snapshot } from '@/domain/dashboard';
import { parseMoney, today } from '@/domain/format';
import { purchaseImpact, purchasePreview, savePurchase } from '@/domain/purchase';
import { rescheduleReminders } from '@/notifications/reminders';
import { LogPaymentSheet } from '@/ui/Payments';

/** Log a purchase sheet (R24) on debt detail. `onChange` runs after the write. */
export function usePurchaseSheet(snap: Snapshot | null, onChange: () => void) {
  const [debt, setDebt] = useState<DebtRow | null>(null);
  const [text, setText] = useState('');

  const amount = debt ? parseMoney(text, debt.currency) : null;
  const on = today();
  const impact = useMemo(() => {
    if (!debt || !snap) return null;
    const { before, after } = purchasePreview(snap, debt.id, amount ?? 0, on);
    return purchaseImpact(before, after, amount);
  }, [snap, debt, amount, on]);

  const open = (d: DebtRow) => {
    setDebt(d);
    setText('');
  };

  let sheet = null;
  if (debt && impact) {
    const save = async () => {
      if (amount === null || amount <= 0) return;
      const db = await getAppDb();
      // A paid-off card in use again gets its reminders back.
      if (savePurchase(db, debt.id, amount, on)) rescheduleReminders(db).catch(() => {});
      setDebt(null);
      onChange();
    };
    sheet = (
      <LogPaymentSheet
        visible
        title={`Log a purchase · ${debt.nickname}`}
        hint="Used this card again? Add it so your plan stays right."
        dateLabel={`Today, ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date())}`}
        currencySymbol={currencySymbol(debt.currency)}
        amountText={text}
        onChangeAmount={setText}
        chips={[]}
        impact={impact}
        amountLabel="Amount you spent"
        saveLabel="Save purchase"
        onSave={save}
        onClose={() => setDebt(null)}
      />
    );
  }

  return { open, sheet };
}
