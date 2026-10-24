export type Minor = number; // integer minor units (Number.isSafeInteger)
export type Currency = string; // ISO 4217
export type DecimalStr = string; // '0.03'
export type YearMonth = string; // 'YYYY-MM'
export type DebtId = string;

export type MinimumRule =
  | { kind: 'fixed'; amount: Minor }
  | { kind: 'percent'; percent: DecimalStr }
  | { kind: 'percentOrFixed'; percent: DecimalStr; floor: Minor }; // higher of the two, capped at balance

export type EngineDebt = {
  id: DebtId;
  currency: Currency;
  balance: Minor;
  monthlyRate: DecimalStr;
  promo?: { monthlyRate: DecimalStr; until: YearMonth }; // promo rate applies through `until` inclusive
  acceptsExtra: boolean;
  createdSeq: number; // last tie-break
} & (
  | { kind: 'revolving'; minimum: MinimumRule }
  // bakedIn: balance = payments left × amortization, no further interest. diminishing: rate accrues on the balance.
  | { kind: 'installment'; payment: Minor; interest: 'bakedIn' | 'diminishing' }
);

export type Strategy = { kind: 'snowball' } | { kind: 'avalanche' } | { kind: 'custom'; order: DebtId[] };

export type OneOffExtra = { month: YearMonth; amount: Minor };

export type PlanInput = {
  debts: EngineDebt[];
  budget: Minor;
  currency: Currency;
  strategy: Strategy;
  start: YearMonth;
  extras?: OneOffExtra[];
  maxMonths?: number; // default 600
};

export type DebtMonth = {
  debtId: DebtId;
  opening: Minor;
  minimumDue: Minor;
  paidMinimum: Minor;
  paidExtra: Minor;
  interest: Minor;
  principal: Minor; // paid − interest; negative when interest outgrows the payment
  closing: Minor;
  rateUsed: DecimalStr;
  isTarget: boolean;
};

export type PlanMonth = { month: YearMonth; lines: DebtMonth[]; unspent: Minor };

export type Shortfall = { status: 'shortfall'; month: YearMonth; minimumsTotal: Minor; shortBy: Minor };

export type PlanResult =
  | {
      status: 'ok';
      months: PlanMonth[];
      debtFree: YearMonth;
      perDebt: Record<DebtId, { payoff: YearMonth; interest: Minor; paid: Minor }>;
      totals: { interest: Minor; paid: Minor };
    }
  | Shortfall
  | { status: 'neverPaysOff'; debtIds: DebtId[]; monthsSimulated: number };
