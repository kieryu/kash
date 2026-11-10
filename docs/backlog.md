# Backlog: ideas to consider later

Things we want eventually but are **not building yet**. Each has a row with status `later` in `docs/revisions.md`.
To start one, say "let's do R20" (or whichever number); it then moves to `todo` there.
Push back on anything here that's really v1.1 scope (CLAUDE.md §12).

| # | Idea | Filed |
|---|---|---|
| R20 | Credit card with an ongoing installment on it | 2026-11-05 |

---

## R20 — installment running on a credit card
Common in the PH: a gadget bought "0% for 12 months" on a card shows on each statement as e.g. `INST 03/12 ₱2,500`.

**Proposed input** (on the card form, an "Has an ongoing installment?" toggle, can add more than one):
- **Monthly amount** (₱2,500)
- **Payments left** (number), with the hint "Your statement shows 3/12? That's 9 left." Statements show *paid/total*, but the plan only needs what's left, and one number is less to type. Optional **"out of"** total (12) only if we want a per-installment progress bar.
- Optional name ("Phone") and interest: default 0% / baked-in, like today's Installment type (D4).

**Built 2026-11-10 (DECISIONS D44). Decisions:**
- Form asks "Is there an ongoing installment on this card?" first, then per installment: optional name, monthly amount, "Your statement shows __ of __".
- Then the **total statement balance**, which already includes this month's installment. The app subtracts the billed installments to get the card's own (revolving) balance; users usually can't see that number without reading the statement closely.
- **Never show unbilled amounts.** Show only "Phone · ₱2,000/mo · 7 of 10 left". Remaining payments are tracked internally so the debt-free date stays right.
- **Strategy:** the card competes in snowball/avalanche/custom using its revolving balance (statement total − installments). Installments are listed under the card, never a target for extra money.
- **Payments:** cover the billed installment first, then the revolving part (labelled an estimate).
- **Free**, and an installment doesn't count toward the 3-debt free limit (it's part of the card). Rule in §20: plan accuracy is never Pro.

**Original questions (answers above):**
- **No double counting.** Does the card's statement balance the user enters already include the unbilled installment? On most PH cards only the month's installment is billed into the balance; the rest is unbilled but uses up the credit limit. Proposal: treat the installment as a child of the card (new `parent_debt_id`), keep its remaining total separate from the revolving balance, and add its monthly amount to the card's minimum due.
- **Extra payments:** installments usually can't be prepaid without a fee, so the plan sends extra money to the revolving part only (`acceptsExtra: false` on the child, as today).
- **Dashboard:** one card in the wallet, with the installment shown inside it ("Phone · 9 of 12 left") rather than as a separate card.
- **Statement check-in:** the expected balance must count only the billed installment, not the remaining total.
- Schema change → a migration and a backup-format upgrade (export/import must carry the link).
