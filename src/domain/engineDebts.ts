import type { DebtRow } from '@/db/schema';
import type { EngineDebt, MinimumRule, Minor } from '@/engine/types';

/** Baked-in installments: what's left to pay is the amortization × months left (D4). */
export function installmentBalance(amortization: Minor, monthsLeft: number): Minor {
  return amortization * monthsLeft;
}

/**
 * Maps stored debts + derived balances to engine input. Overpaid (negative) balances count as 0.
 * createdSeq follows creation order, the engine's last tie-break.
 */
export function toEngineDebts(rows: DebtRow[], balances: Map<string, Minor>): EngineDebt[] {
  const byCreation = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return byCreation.map((r, createdSeq) => {
    const base = {
      id: r.id,
      currency: r.currency,
      balance: Math.max(0, balances.get(r.id) ?? 0),
      monthlyRate: r.monthlyRate,
      // ponytail: promo counts through the month it ends in; split mid-month if statements disagree.
      promo: r.promoRate && r.promoEndsOn ? { monthlyRate: r.promoRate, until: r.promoEndsOn.slice(0, 7) } : undefined,
      acceptsExtra: r.acceptsExtra,
      createdSeq,
    };
    if (r.amortizationMinor != null) {
      return {
        ...base,
        kind: 'installment',
        payment: r.amortizationMinor,
        interest: r.interestMethod === 'diminishing' ? 'diminishing' : 'bakedIn',
      };
    }
    return { ...base, kind: 'revolving', minimum: minimumRule(r) };
  });
}

function minimumRule(r: DebtRow): MinimumRule {
  if (r.minRule === 'fixed' && r.minFixedMinor != null) return { kind: 'fixed', amount: r.minFixedMinor };
  if (r.minRule === 'percent' && r.minPercent) return { kind: 'percent', percent: r.minPercent };
  if (r.minRule === 'percent_or_fixed' && r.minPercent && r.minFixedMinor != null) {
    return { kind: 'percentOrFixed', percent: r.minPercent, floor: r.minFixedMinor };
  }
  throw new Error(`Debt ${r.id} has an incomplete minimum payment rule`);
}
