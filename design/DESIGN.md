# Kash — Design Spec

Source of truth for the UI. Built from the Claude Design canvas "Kash — App Flow & Screens".
`design/mockups/*.dc.html` are the mockup sources (HTML with exact colors, sizes and copy) — read them for reference, **do not copy them as code**; rebuild each screen as React Native components using the tokens below.
`design/screens/*.png` (if present) are exported screenshots of each artboard.

---

## 1. Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F3F5EF` | App background |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `ink` | `#142019` | Primary text |
| `muted` | `#4E5C54` | Secondary text, captions |
| `line` | `#DDE3DA` | Dividers, tab bar border |
| `lineStrong` | `#C9D6CD` | Input & secondary-button borders |
| `divider` | `#ECEFE9` | Row separators inside cards |
| `primary` | `#1E5B47` | Primary buttons, hero card, selected states |
| `primarySoft` | `#E2EEE7` | Success/paid pills, info boxes |
| `onPrimaryMuted` | `#CFE3D8` | Secondary text on `primary` |
| `primaryTrack` | `#2F7660` | Progress track on hero card |
| `accent` | `#E9A23B` | Coin amber: focus-debt outline, progress fill, Pro button |
| `onAccent` | `#2E1C04` | Text on `accent` |
| `accentSoft` | `#FCF3E3` | Tips, warnings, Pro tints |
| `accentText` | `#5E3D08` | Text on `accentSoft` |
| `accentLabel` | `#8A5A12` | Amber labels ("FOCUS DEBT") |
| `proChipBg` / `proChipText` | `#FCEBCB` / `#6E430A` | "PRO" / "FOCUS" chips |
| `danger` | `#A3361C` | Destructive text (Delete all data) |
| `segmentBg` | `#E3E9E1` | Segmented control background |

Card template colors: BDO Visa `#1C3D73`, BDO Mastercard `#22314F`, BPI Visa `#8E1B2C`, UnionBank Mastercard `#B24E1A`, Metrobank Visa `#2A4C9B`, Custom `#4E5C54`. Swatches: `#1C3D73 #1E5B47 #8E1B2C #B24E1A #5B3A8C #2B2B2B` + custom color picker. Sample debt colors: family loan `#5B3A8C`, SSS `#2B2B2B`.

Dark mode: not designed yet — derive from tokens later.

### Typography — DM Sans only (400 / 500 / 700)
| Style | Size / weight |
|---|---|
| Wordmark (splash) | 44 / 700, letter-spacing −1 |
| H1 (onboarding, paywall) | 26 / 700, line-height 1.15, letter-spacing −0.4 |
| Screen header (back-arrow screens) | 20 / 700 |
| Hero number (debt-free date) | 26 / 700 |
| Section title | 17 / 700 |
| Body | 15 / 400 (line-height 1.5) |
| Row title | 14–15 / 700 |
| Small | 13 |
| Caption | 12 |
| Button | 16 / 700 |
| Big amounts | 20–32 / 700 |

### Shape & spacing
- Screen padding: 24 (onboarding), 20 (main app). Section gap 16–24.
- Radius: cards 16–22, buttons 16, inputs 12–14, chips/pills 999.
- Primary button: height 56, full width, `primary` bg, white text. Secondary: height 52, white bg, 1.5px `lineStrong` border, `primary` text.
- Inputs: height 48, radius 12, 1.5px `lineStrong`; label 13/700 `muted` above.
- Minimum touch target 44×44 (the segmented control is 30px visually — give it a 44px hit area).
- No visible scrollbars on horizontal carousels.

---

## 2. Components
- **DebtCard** — wallet-style card: issuer (plain text, no logos), type label, small generic chip, nickname, balance, network name as italic text. Full width, 168 tall in the form; 148×92 mini version in the dashboard carousel; 150 tall on lists.
- **ProgressBar** — 8px, rounded; amber fill on green track (hero), white on translucent (cards).
- **FocusDebtCard** — amber 2px outline, "FOCUS DEBT · PAY EXTRA HERE" label, amount with "₱850 min + ₱4,685 extra" split, "Log payment" button → after saving shows "Paid ₱X · ₱Y extra" + Undo.
- **PaymentRow** — color bar, name, due date + amount, right side: "Log" pill / "✓ Paid" pill / "Auto-deducted" text.
- **LogPaymentSheet** (bottom sheet) — title, planned/minimum hint, date, amount input (prefilled with planned), quick chips (Planned / +₱500 / +₱1,000 / Pay in full), live impact message (green = good, amber = below plan/minimum), Save. Same sheet in "Extra payment" mode (windfalls → focus debt).
- **SegmentedControl** — 4 equal segments (Card · Installment · Loan · Other), single line.
- **StrategyCard** — illustration, name, how it works, "best for", selected = 3px `primary` border + check; Pro ones show a PRO chip. Page dots below.
- **Switch** — 52×32, `primary` when on, `#B7C2BB` off; real accessible switch.
- **Mascot** — original cartoon Pomeranian (peach fur `#F0C391`, cream face `#FBE6C8`, round face, pointed ears, black eyes and nose, pink tongue, pink collar `#E85D8A`) holding a ₱ coin. Moods: watch (default), cheer, concern, hide (paws over eyes = balances hidden), sleep (lock screen), think. SVG; source in `mockups/Mascot.dc.html`. Mascot text is always also shown as real text.

---

## 3. Screens (MVP)
| # | Screen | Key content & behavior |
|---|---|---|
| 01 | Splash | Green bg, mascot, "Kash", motivational line, "Get started", "No account needed · Works offline" |
| 02 | Privacy promise | Step 1/5 bar, lock illustration, 3 promises, backup tip, Continue |
| 03 | Secure the app | Turn on biometric lock / Set a 6-digit PIN; warning that there's no password reset |
| 04 | Choose a strategy | Swipeable cards (Snowball, Avalanche, My own order, Highest cost PRO, Hybrid PRO), dots, "Help me choose", "Use {strategy}" |
| 05 | Add your debts | Added debt cards + dashed "Add a card or loan", mascot tip, "Continue · N debts added" |
| 06 | Add a debt | Segmented type, full-width card preview, 3×2 template grid, color swatches + custom picker, nickname, balance, interest/month, minimum, due day; "never asks for card number"; not-affiliated line |
| 07 | Monthly budget | Minimums floor, amount with −/+ and slider, live debt-free date, "+₱1,000 → N months sooner" |
| 08 | Dashboard | Hero (debt-free month/year, progress, movement chip), October payments (focus card + minimum rows + "Log an extra payment"), debts carousel, interest estimate, tab bar (Home · Plan · Debts · Settings), hide-balances toggle |
| 09 | Debt detail | Card, balance/progress, countdown (days only when ≤ 90 days away), stats grid, Log a payment / Update balance, history |
| 10 | Statement check-in | Expected vs statement balance, difference reason (Interest & fees / New purchases), impact on debt-free date |
| 11 | Compare strategies | Snowball vs Avalanche: debt-free date, total interest, first debt gone; trade-off sentence; Pro rows |
| 12 | Settings | Pro banner, privacy & security switches, auto-lock, PIN, currency, reminders, export/import backup, delete all data, disclaimers |
| 13 | Kash Pro | ₱99 one-time, feature list, "Always free" promise, Unlock / Maybe later / Restore purchase |
| 14 | Lock screen | Sleeping mascot, fingerprint button, Use PIN |

**Not designed yet — design these in code following the same tokens (or ask me first):**
Plan tab (timeline, balance chart, payoff order), Debts tab (list of all debts, totals, paid-off section), PIN setup/entry, "Help me choose" quiz, export/import backup flow, debt-paid-off celebration, edit/archive/delete debt.

---

## 4. Flow
```
FIRST LAUNCH
01 Splash --Get started--> 02 Privacy --Continue--> 03 Secure --Turn on lock--> 04 Strategy
  --Choose--> 05 Add your debts <--(+ Add a debt / Save debt)--> 06 Add a debt
05 --Continue--> 07 Budget --See my plan--> 08 Dashboard

EVERYDAY USE (from 08 Dashboard)
--Tap a debt--> 09 Debt detail --Update balance--> 10 Check-in --Save--> 08
--Compare strategies / Plan tab--> 11 Compare --Pro strategy--> 13 Kash Pro
--Settings tab--> 12 Settings --Unlock Pro--> 13 Kash Pro
--Log payment / Log / Log an extra payment--> LogPaymentSheet --Save--> 08

TRIGGERS
App opened or back after auto-lock timeout --> 14 Lock --Unlock--> 08
Statement-day notification --> 10 Check-in
```
