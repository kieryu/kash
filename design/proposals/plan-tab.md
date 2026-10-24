# Proposal — Plan tab (slice 7)

Not built. The tab shows a placeholder.

## Layout (no charts in MVP)
| Part | Spec |
|---|---|
| Header | "Your plan" 20/700, right: link "Compare strategies" → 11 |
| Summary card | `primary` hero style: strategy name, "Debt-free by Month Year" (§17), "Total interest ≈ ₱X · estimate" |
| Payoff order | Section "Payoff order": numbered rows (1, 2, 3…) — color bar, nickname, "Paid off around Month Year", focus row has the amber outline |
| Month table | Section "Month by month": one row per month (Oct 2026, Nov 2026…), each expandable to per-debt payment / interest / ending balance. Lazy-render; first 12 months shown, "Show all N months" link |
| Footnote | "Estimates only. Real statements may differ." + "How was this calculated?" link (per row, via explainLine) |

## Behavior
- Same projection as the dashboard (`src/domain/dashboard.ts`), so numbers always match.
- Hide balances masks all amounts.
