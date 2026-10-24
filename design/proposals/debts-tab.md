# Proposal — Debts tab

Not built. The tab shows a placeholder; debts open from the dashboard carousel for now.
Route file is `(tabs)/wallet.tsx` because `/debts` is onboarding step 05.

## Layout (same tokens as 08 / 09)
| Part | Spec |
|---|---|
| Header | "Your debts" 20/700, right: "+ Add" pill (same style as the Hide pill: 40 tall, 1.5px `lineStrong`, `primary` text). Hidden at the free limit → tap shows the Pro line instead |
| Totals card | `surface`, radius 20: "Total left" 13 `muted` + amount 26/700; below, "N debts · ₱X minimums a month" 13 `muted`. Masked when balances are hidden |
| List | DebtCard `list` variant (150 tall), one per active debt, in plan order (focus first, "FOCUS" chip `proChipBg`). Under each card: one line 12 `muted` "Paid off around March 2028" (§17 rule) |
| Paid off | Section title "Paid off" 17/700 + compact rows (color bar, nickname, "Paid off Oct 2026", ✓ pill `primarySoft`). Collapsed if more than 3 |
| Archived | Link "Show archived (N)" at the bottom → same compact rows, muted |
| Empty | Dashed "Add a card or loan" card from 05 + mascot `think` tip |

## Behavior
- Tap a card → 09 Debt detail. "+ Add" → 06 Add a debt (same form as onboarding).
- Free tier (§20): over-limit debts (after a Pro refund) show a small "Read-only" chip; still counted in totals.
- Screen reader: each card reads "nickname, balance, paid off around Month Year".
