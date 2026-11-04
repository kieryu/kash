# Revisions from device testing

Feedback from trying the dev build on a real phone. Status: `done`, `in progress`, `todo`, or `needs build` (code is done, but it only shows up after a new EAS build because it changes native files).

| # | Revision | Status | Date filed | Date done | Notes |
|---|---|---|---|---|---|
| R1 | Privacy screen: "Your money stays on this phone" → "Your data stays on this phone" | done | 2026-11-04 | 2026-11-04 | `privacy.tsx` |
| R2 | Onboarding: allow going back | done | 2026-11-04 | 2026-11-04 | Every onboarding screen now has a back arrow beside the step bar whenever there's a screen to go back to (`ui/Onboarding.tsx`). |
| R3 | After setting a PIN it takes long with no loading shown | done | 2026-11-04 | 2026-11-04 | A spinner shows "Saving your PIN…" (and "Checking your PIN…" on the lock screen). The wait is the slow, deliberate PIN hashing (scrypt) that makes a stolen hash hard to crack, so it is kept. |
| R4 | Strategy screen ("How do you want to pay it off?"): add samples | done | 2026-11-04 | 2026-11-04 | Each card shows the same 3 sample debts (Shopping card ₱5,000 at 2%, Main card ₱20,000 at 3.5%, Phone loan ₱12,000 at 1%) in the order that strategy pays them. |
| R5 | Debt name: nickname optional; "Card name" for custom cards | done | 2026-11-04 | 2026-11-04 | Bank template: "Nickname (optional)", defaults to e.g. "BDO Visa". Custom: required "Card name" ("Name" for other types). DECISIONS D39. |
| R6 | Improve active state of tabs | done | 2026-11-04 | 2026-11-04 | Active tab icon sits in a soft green pill. |
| R7 | Compare strategies: show the computation from the user's data | done | 2026-11-04 | 2026-11-04 | "See the computation" on each strategy: payoff order with dates, this month's split (minimum + extra, focus debt), and the math (budget − minimums = extra, total interest = sum per debt, debt-free date). |
| R8 | Settings: fix the cramped Export button | done | 2026-11-04 | 2026-11-04 | Compact buttons got side padding (also improves "Log payment"). |
| R9 | Add a splash screen | needs build | 2026-11-04 | 2026-11-04 | Native splash now shows the Pom mascot (200 px) on green `#1E5B47`. Appears after the next EAS build. DECISIONS D40. |
| R10 | App icon: use option 1 (green Pom) from `assets/kash-icons` | needs build | 2026-11-04 | 2026-11-04 | Icon + Android adaptive icon replaced. Themed (monochrome) icon dropped until one is drawn. Appears after the next EAS build. DECISIONS D40. |
| R11 | Preview APK: no way to try Kash Pro (no purchases yet, dev switch hidden) | needs build | 2026-11-04 | 2026-11-04 | Settings → Tester tools → "Pro (test)" now shows in preview builds too, never in production. DECISIONS D41. |
