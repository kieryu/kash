import * as fc from 'fast-check';

import { addMonths, times } from '../money';
import { explainLine, minimumDue, simulate, thisMonthPlan } from '../simulate';
import type { EngineDebt, PlanInput, PlanResult } from '../types';

let seq = 0;
function card(id: string, balance: number, monthlyRate: string, min = 0, extra: Partial<EngineDebt> = {}): EngineDebt {
  return {
    id,
    currency: 'PHP',
    balance,
    monthlyRate,
    acceptsExtra: true,
    createdSeq: seq++,
    kind: 'revolving',
    minimum: { kind: 'fixed', amount: min },
    ...extra,
  } as EngineDebt;
}

function installment(id: string, balance: number, payment: number, extra: Partial<EngineDebt> = {}): EngineDebt {
  return {
    id,
    currency: 'PHP',
    balance,
    monthlyRate: '0',
    acceptsExtra: false,
    createdSeq: seq++,
    kind: 'installment',
    payment,
    interest: 'bakedIn',
    ...extra,
  } as EngineDebt;
}

function plan(debts: EngineDebt[], budget: number, more: Partial<PlanInput> = {}): PlanInput {
  return { debts, budget, currency: 'PHP', strategy: { kind: 'snowball' }, start: '2026-11', ...more };
}

function ok(r: PlanResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
}

const line = (r: ReturnType<typeof ok>, m: number, id: string) => r.months[m].lines.find((l) => l.debtId === id)!;

describe('money', () => {
  it('rounds half-up to the minor unit', () => {
    expect(times(5, '0.1')).toBe(1); // 0.5
    expect(times(14, '0.025')).toBe(0); // 0.35
    expect(times(15, '0.03')).toBe(0); // 0.45
    expect(times(25, '0.1')).toBe(3); // 2.5
    expect(times(1_000_000, '0.035')).toBe(35_000);
  });

  it('adds months across years', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-11', 26)).toBe('2029-01');
  });
});

describe('minimumDue', () => {
  const d = (minimum: object) => card('a', 0, '0.03', 0, { minimum } as Partial<EngineDebt>);
  it('fixed, capped at balance', () => {
    expect(minimumDue(d({ kind: 'fixed', amount: 50_000 }), 1_000_000)).toBe(50_000);
    expect(minimumDue(d({ kind: 'fixed', amount: 50_000 }), 30_000)).toBe(30_000);
  });
  it('percent of balance', () => {
    expect(minimumDue(d({ kind: 'percent', percent: '0.03' }), 1_000_050)).toBe(30_002); // 30001.5 → 30002
  });
  it('percent or fixed, whichever is higher, capped at balance', () => {
    const rule = { kind: 'percentOrFixed', percent: '0.03', floor: 50_000 };
    expect(minimumDue(d(rule), 1_000_000)).toBe(50_000);
    expect(minimumDue(d(rule), 3_000_000)).toBe(90_000);
    expect(minimumDue(d(rule), 20_000)).toBe(20_000);
  });
  it('installment pays its amortization, capped at balance', () => {
    expect(minimumDue(installment('i', 30_000, 10_000), 30_000)).toBe(10_000);
    expect(minimumDue(installment('i', 5_000, 10_000), 5_000)).toBe(5_000);
  });
});

describe('simulate', () => {
  it('single debt: pay, then accrue interest on the rest (D2)', () => {
    const r = ok(simulate(plan([card('a', 1_000, '0.1', 100)], 600)));
    expect(r.months[0].lines[0]).toEqual({
      debtId: 'a',
      opening: 1_000,
      minimumDue: 100,
      paidMinimum: 100,
      paidExtra: 500,
      interest: 40, // (1000 − 600) × 0.1
      principal: 560,
      closing: 440,
      rateUsed: '0.1',
      isTarget: true,
    });
    expect(line(r, 1, 'a')).toMatchObject({ paidMinimum: 100, paidExtra: 340, interest: 0, closing: 0 });
    expect(r.months[1].unspent).toBe(160);
    expect(r.debtFree).toBe('2026-12');
    expect(r.perDebt.a).toEqual({ payoff: '2026-12', interest: 40, paid: 1_040 });
    expect(r.totals).toEqual({ interest: 40, paid: 1_040 });
  });

  it('realistic card: ₱50,000 at 3%/mo, ₱5,000 a month', () => {
    const r = ok(simulate(plan([card('a', 5_000_000, '0.03', 250_000)], 500_000)));
    expect(line(r, 0, 'a')).toMatchObject({ interest: 135_000, closing: 4_635_000 });
    expect(r.months).toHaveLength(12);
    expect(r.debtFree).toBe('2027-10');
    expect(r.totals.paid).toBe(5_000_000 + r.totals.interest);
  });

  it('zero-interest debts cost exactly their balance', () => {
    const r = ok(simulate(plan([card('a', 10_000, '0', 1_000), card('b', 25_000, '0', 1_000)], 7_000)));
    expect(r.totals).toEqual({ interest: 0, paid: 35_000 });
    expect(r.months).toHaveLength(5);
  });

  it('no debts, or all zero: debt-free at start', () => {
    expect(ok(simulate(plan([], 0)))).toMatchObject({ debtFree: '2026-11', months: [], totals: { paid: 0 } });
    expect(ok(simulate(plan([card('a', 0, '0.03')], 0))).perDebt.a.payoff).toBe('2026-11');
  });

  it('flags a budget shortfall with how much more is needed', () => {
    const r = simulate(plan([card('a', 100_000, '0.03', 5_000), card('b', 100_000, '0.03', 7_000)], 10_000));
    expect(r).toEqual({ status: 'shortfall', month: '2026-11', minimumsTotal: 12_000, shortBy: 2_000 });
    expect(thisMonthPlan(plan([card('a', 100_000, '0.03', 5_000)], 4_000))).toMatchObject({ status: 'shortfall' });
  });

  it('flags never-pays-off when payments don’t cover interest', () => {
    const r = simulate(plan([card('a', 1_000_000, '0.01', 5_000), card('b', 1_000, '0', 100)], 5_100));
    expect(r).toEqual({ status: 'neverPaysOff', debtIds: ['a'], monthsSimulated: 600 });
  });

  it('stops early when interest runs away', () => {
    const r = simulate(plan([card('a', 1e14, '0.5', 0)], 0));
    expect(r).toMatchObject({ status: 'neverPaysOff', debtIds: ['a'] });
    if (r.status === 'neverPaysOff') expect(r.monthsSimulated).toBeLessThan(600);
  });

  it('respects maxMonths', () => {
    expect(simulate(plan([card('a', 10_000, '0', 100)], 100, { maxMonths: 12 }))).toMatchObject({
      status: 'neverPaysOff',
      monthsSimulated: 12,
    });
  });

  it('promo rate applies through its last month, then the normal rate', () => {
    const d = card('a', 100_000, '0.03', 10_000, { promo: { monthlyRate: '0', until: '2026-12' } });
    const r = ok(simulate(plan([d], 10_000)));
    expect(r.months.slice(0, 3).map((m) => [m.lines[0].rateUsed, m.lines[0].interest])).toEqual([
      ['0', 0],
      ['0', 0],
      ['0.03', 2_100], // (80000 − 10000) × 0.03
    ]);
  });

  describe('snowball', () => {
    it('puts extra on the smallest balance and rolls freed money to the next', () => {
      const debts = [card('big', 50_000, '0.05', 1_000), card('small', 3_000, '0.01', 1_000)];
      const r = ok(simulate(plan(debts, 5_000)));
      expect(line(r, 0, 'small')).toMatchObject({ isTarget: true, paidExtra: 2_000, closing: 0 });
      expect(line(r, 0, 'big')).toMatchObject({ isTarget: false, paidExtra: 1_000 }); // leftover rolls on
      // month 2: small is gone; the whole budget goes to big
      expect(r.months[1].lines).toHaveLength(1);
      expect(line(r, 1, 'big')).toMatchObject({ paidMinimum: 1_000, paidExtra: 4_000, isTarget: true });
    });

    it('leftover after clearing a target goes to the next target the same month', () => {
      const debts = [card('a', 1_500, '0', 500), card('b', 2_000, '0', 500), card('c', 9_000, '0', 500)];
      const r = ok(simulate(plan(debts, 4_000)));
      // pool = 2500: a takes 1000, b takes the remaining 1500 → done; c gets nothing extra
      expect(r.months[0].lines.map((l) => [l.debtId, l.paidExtra, l.closing])).toEqual([
        ['a', 1_000, 0],
        ['b', 1_500, 0],
        ['c', 0, 8_500],
      ]);
    });

    it('ties: smaller balance → higher rate → created first', () => {
      const debts = [card('low', 5_000, '0.02', 0), card('high', 5_000, '0.03', 0), card('first', 9_000, '0.03', 0)];
      expect(ok(simulate(plan(debts, 1_000))).months[0].lines.find((l) => l.isTarget)!.debtId).toBe('high');
      const same = [card('x', 5_000, '0.03', 0), card('y', 5_000, '0.03', 0)];
      expect(line(ok(simulate(plan(same, 1_000))), 0, 'x').isTarget).toBe(true);
    });
  });

  describe('avalanche', () => {
    const avalanche = { strategy: { kind: 'avalanche' } as const };

    it('puts extra on the highest rate and costs less interest than snowball', () => {
      const debts = [card('big', 50_000, '0.05', 1_000), card('small', 3_000, '0.01', 1_000)];
      const av = ok(simulate(plan(debts, 5_000, avalanche)));
      const sb = ok(simulate(plan(debts, 5_000)));
      expect(line(av, 0, 'big').isTarget).toBe(true);
      expect(av.totals.interest).toBeLessThan(sb.totals.interest);
    });

    it('ties: higher rate → smaller balance → created first', () => {
      const debts = [card('bigger', 9_000, '0.03', 0), card('smaller', 5_000, '0.03', 0), card('low', 1_000, '0.01', 0)];
      expect(line(ok(simulate(plan(debts, 1_000, avalanche))), 0, 'smaller').isTarget).toBe(true);
      const same = [card('x', 5_000, '0.03', 0), card('y', 5_000, '0.03', 0)];
      expect(line(ok(simulate(plan(same, 1_000, avalanche))), 0, 'x').isTarget).toBe(true);
    });

    it('uses the promo rate while it lasts', () => {
      const promo = card('promo', 9_000, '0.05', 0, { promo: { monthlyRate: '0', until: '2026-11' } });
      const r = ok(simulate(plan([promo, card('other', 9_000, '0.02', 0)], 1_000, avalanche)));
      expect(line(r, 0, 'other').isTarget).toBe(true);
      expect(line(r, 1, 'promo').isTarget).toBe(true);
    });
  });

  describe('custom order', () => {
    it('follows the given order; unlisted debts go last by creation', () => {
      const debts = [card('a', 1_000, '0.01', 0), card('b', 2_000, '0.02', 0), card('c', 3_000, '0.03', 0)];
      const r = ok(simulate(plan(debts, 500, { strategy: { kind: 'custom', order: ['c'] } })));
      expect(line(r, 0, 'c').isTarget).toBe(true);
      const afterC = r.months.find((m) => !m.lines.some((l) => l.debtId === 'c'))!;
      expect(afterC.lines.find((l) => l.isTarget)!.debtId).toBe('a');
    });
  });

  describe('installments mixed with revolving (D4)', () => {
    it('installments get only their amortization; when done, it rolls into the plan', () => {
      const debts = [installment('inst', 3_000, 1_000), card('cc', 100_000, '0.03', 2_000)];
      const r = ok(simulate(plan(debts, 10_000, { strategy: { kind: 'snowball' } })));
      // snowball would target inst (smaller) but it doesn't accept extra
      expect(line(r, 0, 'inst')).toMatchObject({ paidMinimum: 1_000, paidExtra: 0, interest: 0, isTarget: false });
      expect(line(r, 0, 'cc')).toMatchObject({ paidExtra: 7_000, isTarget: true });
      expect(r.perDebt.inst).toMatchObject({ payoff: '2027-01', interest: 0, paid: 3_000 });
      expect(line(r, 3, 'cc').paidMinimum + line(r, 3, 'cc').paidExtra).toBe(10_000);
    });

    it('acceptsExtra installments can be targeted', () => {
      const debts = [installment('inst', 3_000, 1_000, { acceptsExtra: true }), card('cc', 100_000, '0.03', 2_000)];
      const r = ok(simulate(plan(debts, 10_000)));
      expect(line(r, 0, 'inst')).toMatchObject({ paidExtra: 2_000, closing: 0, isTarget: true });
    });

    it('diminishing installments accrue interest on the remainder', () => {
      const loan = installment('loan', 100_000, 10_000, { interest: 'diminishing', monthlyRate: '0.01' });
      const r = ok(simulate(plan([loan], 10_000)));
      expect(line(r, 0, 'loan')).toMatchObject({ interest: 900, closing: 90_900, rateUsed: '0.01' });
    });

    it('leaves money unspent when nothing can take extra', () => {
      const r = ok(simulate(plan([installment('i', 3_000, 1_000)], 1_500)));
      expect(r.months.map((m) => m.unspent)).toEqual([500, 500, 500]);
    });
  });

  it('strategy switch mid-plan: continue from the current balances', () => {
    const debts = [card('big', 50_000, '0.05', 1_000), card('small', 20_000, '0.01', 1_000)];
    const before = ok(simulate(plan(debts, 5_000)));
    const resumed = debts.map((d) => ({ ...d, balance: line(before, 2, d.id).closing }));
    const after = ok(simulate(plan(resumed, 5_000, { start: '2027-02', strategy: { kind: 'avalanche' } })));
    expect(line(before, 2, 'small').isTarget).toBe(true);
    expect(line(after, 0, 'big').isTarget).toBe(true);
    const stayed = ok(simulate(plan(resumed, 5_000, { start: '2027-02' })));
    expect(after.totals.interest).toBeLessThan(stayed.totals.interest);
  });

  it('one-off extras go to the target in their month and shorten the plan', () => {
    const debts = [card('a', 10_000, '0.02', 500), card('b', 50_000, '0.03', 500)];
    const base = ok(simulate(plan(debts, 2_000)));
    const r = ok(simulate(plan(debts, 2_000, { extras: [{ month: '2026-12', amount: 20_000 }] })));
    expect(line(r, 0, 'a').paidExtra).toBe(line(base, 0, 'a').paidExtra);
    expect(line(r, 1, 'a').closing).toBe(0);
    expect(r.months.length).toBeLessThan(base.months.length);
    expect(r.totals.interest).toBeLessThan(base.totals.interest);
  });

  it('rejects invalid input', () => {
    expect(() => simulate(plan([card('a', 1.5, '0.03')], 100))).toThrow(/integer/);
    expect(() => simulate(plan([card('a', 100, '-0.01')], 100))).toThrow(/[Rr]ate/);
    expect(() => simulate(plan([card('a', 100, 'abc')], 100))).toThrow(/[Rr]ate/);
    expect(() => simulate(plan([card('a', 100, '0', 0, { currency: 'USD' })], 100))).toThrow(/USD/);
    expect(() => simulate(plan([card('a', 100, '0'), card('a', 100, '0')], 100))).toThrow(/duplicate/);
    expect(() => simulate(plan([], 100, { start: '2026-13' }))).toThrow(/YYYY-MM/);
    expect(() => simulate(plan([], -1))).toThrow(/budget/);
  });
});

describe('thisMonthPlan', () => {
  it('equals the first month of the full plan', () => {
    const input = plan([card('a', 10_000, '0.02', 500), card('b', 50_000, '0.03', 500)], 2_000);
    expect(thisMonthPlan(input)).toEqual(ok(simulate(input)).months[0]);
  });

  it('still answers when the plan never pays off', () => {
    const input = plan([card('a', 1_000_000, '0.05', 40_000)], 40_000);
    expect(thisMonthPlan(input)).toMatchObject({ lines: [{ paidMinimum: 40_000 }] });
  });
});

describe('explainLine', () => {
  it('reproduces the line from its inputs', () => {
    const d = card('a', 1_005, '0.1', 100);
    const l = ok(simulate(plan([d], 600))).months[0].lines[0];
    expect(explainLine(d, l)).toEqual({
      minimum: { rule: { kind: 'fixed', amount: 100 }, balance: 1_005, result: 100 },
      payment: { minimum: 100, extra: 500, total: 600 },
      interest: { balance: 405, rate: '0.1', exact: '40.5', result: 41 },
      closing: { opening: 1_005, paid: 600, interest: 41, result: 446 },
    });
  });
});

describe('properties', () => {
  const rate = fc.integer({ min: 0, max: 600 }).map((n) => (n / 10_000).toFixed(4));
  const debt = fc.oneof(
    fc.record({
      kind: fc.constant('revolving' as const),
      balance: fc.integer({ min: 0, max: 50_000_000 }),
      monthlyRate: rate,
      minimum: fc.oneof(
        fc.record({ kind: fc.constant('fixed' as const), amount: fc.integer({ min: 0, max: 500_000 }) }),
        fc.record({ kind: fc.constant('percent' as const), percent: rate }),
        fc.record({
          kind: fc.constant('percentOrFixed' as const),
          percent: rate,
          floor: fc.integer({ min: 0, max: 100_000 }),
        }),
      ),
      acceptsExtra: fc.constant(true),
    }),
    fc.record({
      kind: fc.constant('installment' as const),
      balance: fc.integer({ min: 0, max: 5_000_000 }),
      monthlyRate: rate,
      payment: fc.integer({ min: 1, max: 500_000 }),
      interest: fc.constantFrom('bakedIn' as const, 'diminishing' as const),
      acceptsExtra: fc.boolean(),
    }),
  );
  const input = fc
    .record({
      debts: fc.array(debt, { maxLength: 6 }),
      budget: fc.integer({ min: 0, max: 5_000_000 }),
      strategy: fc.constantFrom({ kind: 'snowball' } as const, { kind: 'avalanche' } as const),
      extras: fc.array(fc.record({ month: fc.integer({ min: 0, max: 24 }), amount: fc.integer({ min: 0, max: 1_000_000 }) }), {
        maxLength: 3,
      }),
    })
    .map(
      ({ debts, budget, strategy, extras }): PlanInput => ({
        debts: debts.map((d, i) => ({ ...d, id: `d${i}`, currency: 'PHP', createdSeq: i }) as EngineDebt),
        budget,
        currency: 'PHP',
        strategy,
        start: '2026-11',
        extras: extras.map((e) => ({ month: addMonths('2026-11', e.month), amount: e.amount })),
        maxMonths: 240,
      }),
    );

  it('money is conserved and balances never go negative', () => {
    fc.assert(
      fc.property(input, (p) => {
        const r = simulate(p);
        if (r.status !== 'ok') return;
        const extrasTotal = (p.extras ?? []).reduce((t, e) => t + e.amount, 0);
        let paid = 0;
        for (const m of r.months) {
          let paidThisMonth = 0;
          for (const l of m.lines) {
            const linePaid = l.paidMinimum + l.paidExtra;
            expect(l.closing).toBeGreaterThanOrEqual(0);
            expect(l.paidExtra).toBeGreaterThanOrEqual(0);
            expect(linePaid).toBe(l.principal + l.interest);
            expect(l.closing).toBe(l.opening - l.principal);
            paidThisMonth += linePaid;
          }
          expect(m.unspent).toBeGreaterThanOrEqual(0);
          expect(paidThisMonth).toBeLessThanOrEqual(p.budget + extrasTotal);
          paid += paidThisMonth;
        }
        const startTotal = p.debts.reduce((t, d) => t + d.balance, 0);
        expect(r.totals.paid).toBe(paid);
        expect(r.totals.paid).toBe(startTotal + r.totals.interest);
        expect(r.totals.paid).toBeLessThanOrEqual(p.budget * r.months.length + extrasTotal);
      }),
      { numRuns: 300 },
    );
  });

  it('never targets a debt that refuses extra, and only pays extra after minimums', () => {
    fc.assert(
      fc.property(input, (p) => {
        const r = simulate(p);
        if (r.status !== 'ok') return;
        const byId = new Map(p.debts.map((d) => [d.id, d]));
        for (const m of r.months)
          for (const l of m.lines) {
            if (!byId.get(l.debtId)!.acceptsExtra) expect(l.paidExtra).toBe(0);
            if (l.paidExtra > 0) expect(l.paidMinimum).toBe(l.minimumDue);
          }
      }),
      { numRuns: 200 },
    );
  });
});
