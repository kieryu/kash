import { testDb } from '@/db/__tests__/testDb';
import { createDebt, listDebts, type NewDebt } from '@/db/repositories/debts';
import { getSettings, setEntitlement, updateSettings } from '@/db/repositories/settings';
import { addTransaction, balanceOf, listTransactions } from '@/db/repositories/transactions';
import { transactions } from '@/db/schema';

import { relabelHomeCurrency } from '../currency';
import { loadSnapshot, progress } from '../dashboard';
import { readOnlyIds } from '../plan';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const card: NewDebt = {
  nickname: 'Card',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minFixedMinor: 50_000,
  acceptsExtra: true,
  autoDeducted: false,
};

function withDebts(n: number) {
  const db = testDb();
  const ids = Array.from({ length: n }, (_, i) =>
    createDebt(db, { ...card, nickname: `Card ${i + 1}` }, { balanceMinor: 100_000 * (i + 1), on: '2026-10-01' }),
  );
  return { db, ids };
}

describe('free limit: read-only debts', () => {
  it('free: debts past the first 3 (by order added) are read-only, never hidden or left out of totals', () => {
    const { db, ids } = withDebts(5);
    const snap = loadSnapshot(db);
    expect([...snap.readOnly]).toEqual([ids[3], ids[4]]);
    expect(snap.rows).toHaveLength(5);
    expect(progress(snap.txs).remaining).toBe(1_500_000);
  });

  it('Pro: nothing is read-only; losing Pro makes the extras read-only again', () => {
    const { db, ids } = withDebts(4);
    setEntitlement(db, { isPro: true, source: 'test', checkedAt: null });
    expect(loadSnapshot(db).readOnly.size).toBe(0);
    setEntitlement(db, { isPro: false, source: null, checkedAt: null });
    expect([...loadSnapshot(db).readOnly]).toEqual([ids[3]]);
  });

  it('3 or fewer: nothing is read-only', () => {
    expect(readOnlyIds(listDebts(withDebts(3).db), false).size).toBe(0);
  });
});

describe('home currency relabel', () => {
  it('changes only the currency code on settings, debts and transactions; amounts stay', () => {
    const { db, ids } = withDebts(2);
    addTransaction(db, { debtId: ids[0], type: 'payment', amountMinor: -20_000, occurredOn: '2026-10-05' });
    updateSettings(db, { budgetMinor: 300_000 });

    expect(relabelHomeCurrency(db, 'USD')).toBe('done');
    expect(getSettings(db)).toMatchObject({ homeCurrency: 'USD', budgetMinor: 300_000 });
    expect(listDebts(db).map((d) => d.currency)).toEqual(['USD', 'USD']);
    expect(listTransactions(db, ids[0]).map((t) => t.currency)).toEqual(['USD', 'USD']);
    expect(balanceOf(db, ids[0])).toBe(80_000);
    expect(relabelHomeCurrency(db, 'USD')).toBe('same');
  });

  it('refuses a currency with different decimals once debts exist, changing nothing', () => {
    const { db, ids } = withDebts(1);
    expect(relabelHomeCurrency(db, 'JPY')).toBe('different_decimals');
    expect(getSettings(db).homeCurrency).toBe('PHP');
    expect(listTransactions(db, ids[0])[0].currency).toBe('PHP');
  });

  it('with no debts, any currency is fine; a saved budget is cleared when decimals differ', () => {
    const db = testDb();
    updateSettings(db, { budgetMinor: 500_000 });
    expect(relabelHomeCurrency(db, 'JPY')).toBe('done');
    expect(getSettings(db)).toMatchObject({ homeCurrency: 'JPY', budgetMinor: null });
  });

  it('transactions stay append-only for everything but the currency code', () => {
    const { db } = withDebts(1);
    expect(() => db.update(transactions).set({ amountMinor: 1 }).run()).toThrow(/append-only/);
    expect(() => db.update(transactions).set({ note: 'x' }).run()).toThrow(/append-only/);
  });
});
