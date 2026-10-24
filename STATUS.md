# Status — lane A paused (2026-10-24)

Slices 4, 5, 6, 7 merged on master (+ Agent B's 8 logic, 9). `npm run check` passes on master (200 tests).

## Blocked: slice 10 not merged

Slice 10 (Settings, currency, Pro) is built on branch `slice-10-settings-pro` (commit `1c16eba`, check passes, 220 tests) but **not merged**, because it changes the DB schema's money guard:

- **Migration v2 relaxes the append-only trigger on `transactions`** (D18) so the home-currency relabel can rewrite each transaction's `currency` code. All other columns stay locked. Migrations are forward-only, so once shipped this can't be undone.

Options:
1. **Accept** — merge as is (relabel rewrites currency codes in place).
2. **No trigger change** — relabel only while there are no transactions yet (onboarding / fresh start); after that, "wrong currency" means export → delete all data → re-enter.
3. **Move currency off transactions** — transactions inherit the debt's currency (breaking schema change, bigger).

Recommendation: 1. Relabel is metadata, not a balance change; amounts, dates and types stay locked, and there are no users yet.

## Also needs your call before billing goes live
- Paywall copy (from the mockup) lists Pro features that aren't built (what-if, charts, multi-currency, widget, Highest-cost/Hybrid). Buying Pro today unlocks nothing new.

## Next after unblocking
Merge slice 10, log D26–D32 (in the slice 10 commit/summary), then slice 11 (hardening).
