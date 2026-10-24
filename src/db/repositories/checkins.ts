import { randomUUID } from 'expo-crypto';

import { CHECKIN_REASONS, statementCheckins, type Db } from '../schema';
import { addTransaction, balanceOf, type NewTransaction } from './transactions';

type Reason = (typeof CHECKIN_REASONS)[number];

const TX_TYPE: Record<Reason, NewTransaction['type']> = {
  interest_fees: 'interest_fee',
  new_charges: 'charge',
  unlogged_payment: 'payment', // D8
};

/**
 * Records a statement balance. The difference from Kash's expected balance is saved as one transaction
 * so the balance matches the statement. A reason is required when there is a difference; the DB rejects
 * a reason whose sign doesn't fit (e.g. "unlogged payment" for a higher balance).
 */
export function recordCheckIn(
  db: Db,
  c: { debtId: string; statementDate: string; statementMinor: number; reason?: Reason },
): { expectedMinor: number; differenceMinor: number } {
  return db.transaction((tx) => {
    const expectedMinor = balanceOf(tx, c.debtId);
    const differenceMinor = c.statementMinor - expectedMinor;
    if (differenceMinor !== 0 && !c.reason) throw new Error('A reason is required when the balance changed');
    const reason = differenceMinor === 0 ? null : c.reason!;
    const transactionId = reason
      ? addTransaction(tx, {
          debtId: c.debtId,
          type: TX_TYPE[reason],
          amountMinor: differenceMinor,
          occurredOn: c.statementDate,
          note: 'Statement check-in',
        })
      : null;
    tx.insert(statementCheckins)
      .values({
        id: randomUUID(),
        debtId: c.debtId,
        statementDate: c.statementDate,
        expectedMinor,
        statementMinor: c.statementMinor,
        reason,
        transactionId,
        createdAt: new Date().toISOString(),
      })
      .run();
    return { expectedMinor, differenceMinor };
  });
}
