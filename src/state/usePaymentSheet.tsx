import { router } from 'expo-router';
import { useState } from 'react';

import { getAppDb } from '@/db/client';
import { currencySymbol, moneyText } from '@/domain/dashboard';
import { currentYearMonth, parseMoney, today } from '@/domain/format';
import { amountInputText, firstPayoff, savePayment, sheetChips, sheetImpact, sheetTitle, undoPayment, type SheetTarget } from '@/domain/payments';
import { rescheduleReminders } from '@/notifications/reminders';
import { LogPaymentSheet } from '@/ui/Payments';

/** Log Payment sheet wiring shared by the dashboard and debt detail. `onChange` runs after every write. */
export function usePaymentSheet(onChange: () => void, hide: boolean) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [text, setText] = useState('');

  const open = (t: SheetTarget) => {
    setTarget(t);
    setText(t.planned > 0 ? amountInputText(t.planned, t.currency) : '');
  };

  const afterWrite = (paidOffChanged: boolean, db: Awaited<ReturnType<typeof getAppDb>>) => {
    // Paid-off debts get no reminders.
    if (paidOffChanged) rescheduleReminders(db).catch(() => {});
    onChange();
  };

  const undo = async (debtId: string) => {
    const db = await getAppDb();
    afterWrite(undoPayment(db, debtId, currentYearMonth(), today()), db);
  };

  let sheet = null;
  if (target) {
    const money = (n: number) => moneyText(n, target.currency, hide);
    const amount = parseMoney(text, target.currency);
    const save = async () => {
      if (amount === null || amount <= 0) return;
      const db = await getAppDb();
      const changed = savePayment(db, target, amount, currentYearMonth(), today());
      setTarget(null);
      afterWrite(changed, db);
      if (changed && firstPayoff(db, target.debtId)) router.push({ pathname: '/paid-off/[id]', params: { id: target.debtId } });
    };
    sheet = (
      <LogPaymentSheet
        visible
        title={sheetTitle(target)}
        hint={target.hint}
        dateLabel={`Today, ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date())}`}
        currencySymbol={currencySymbol(target.currency)}
        amountText={text}
        onChangeAmount={setText}
        chips={sheetChips(target, money).map((c) => ({
          label: c.label,
          selected: c.amount === amount,
          onPress: () => setText(amountInputText(c.amount, target.currency)),
        }))}
        impact={sheetImpact(target, amount, money)}
        onSave={save}
        onClose={() => setTarget(null)}
      />
    );
  }

  return { open, undo, sheet };
}
