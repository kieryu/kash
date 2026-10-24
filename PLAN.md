# Build plan

The approved plan for the MVP. Read with `CLAUDE.md` (brief), `design/DESIGN.md` (UI) and `DECISIONS.md` (why).
Update the slice status table as work lands.

## Slice status

| # | Slice | Status |
|---|---|---|
| 0 | Scaffold & guardrails | **Done** except on-device check (EAS dev build → "Run check" on home screen) |
| 1 | Payoff engine | **Done** |
| 2 | Data layer | **Done** except on-device check ("Run check" now also runs migrations + repos) |
| 3 | Security & lock | **Done** except on-device check (new dev build needed: native modules added) |
| 4 | UI kit + mascot poses | **Done** except on-device look check |
| 5 | Onboarding | **Done** except on-device check. Quiz* proposed (`design/proposals/quiz.md`), not built |
| 6 | Dashboard & payments | **Done** except on-device check. Debts tab*, edit/archive/delete* proposed (`design/proposals/debts-tab.md`, `debt-edit.md`), not built |
| 7 | Check-in, compare, Plan tab | In progress (lane A). Plan tab* proposed (`design/proposals/plan-tab.md`) |
| 8 | Notifications | Logic **done** (`src/notifications`). Not wired: no caller of `rescheduleReminders`, permission request, Android channel; deep link in slice 7; network check in slice 11. New dev build needed |
| 9 | Encrypted backup | **Done** except on-device check (new dev build needed: expo-sharing). Entry points not wired: Settings rows (slice 10), restore link on 04 Strategy |
| 10 | Settings, currency, Pro | — |
| 11 | Hardening & release prep | — |

Each slice ends with `npm run check` passing (typecheck + lint + tests) and a short summary.
Screens marked * are **not designed** — propose a layout in the DESIGN.md style and get approval before building.

## Parallel work (2 agents)

Two agents run at once, each in its own git worktree and branch. Only run slices in parallel when they don't touch the same files.

| Wave | Agent A (main folder `kash`) | Agent B (worktree `kash-b`) |
|---|---|---|
| 1 | Slice 4: UI kit + mascot poses. Move `LockScreen` and `PinPad` onto kit components. | Slice 9 logic: backup format + AES-256-GCM/scrypt crypto in `src/backup`, import/replace-all against the repos. No screens. |
| 2 | Slice 5: Onboarding | Slice 8 logic: notification scheduling in `src/notifications` (deep link wired in Slice 7) |
| 3 | Slice 6: Dashboard & payments | Slice 9 screens (export/import flow*) using the UI kit |
| 4+ | Slices 7, 10, 11 in order, one agent | — |

Rules for parallel agents:
- Stay inside your slice's folders. If you need to change a shared file (`src/app/_layout.tsx`, `src/theme/`, `src/i18n/en.ts`, `package.json`), keep the change small and mention it in your summary.
- Only Agent A updates the slice status table in PLAN.md and adds entries to DECISIONS.md. Agent B lists proposed decisions in its summary instead.
- Each agent commits on its own branch with `npm run check` passing. Merge B into main, then re-run `npm run check` before the next wave.

### 0. Scaffold & guardrails — done
Expo SDK 58, TS strict, Expo Router (`src/app/`), EAS profiles, dev client, DM Sans, theme tokens, lint rules (no hex/raw font values outside `src/theme`; `src/engine` may only import relative files + big.js), Jest (projects `logic` = node env for engine/domain/theme, `app` = RN), `APP_NAME` in `src/config/app.json`, DB key manager, `openEncryptedDb` (fails closed), dev-only SQLCipher self-check, DECISIONS.md, SECURITY.md.

### 1. Payoff engine (`src/engine`, pure TS, no UI) — done
Install `big.js` (+ `@types/big.js`) and dev `fast-check`. Build money/rates/minimums/yearMonth, `simulate`, snowball / avalanche / custom, shortfall & never-pays-off, `thisMonthPlan`, `explainLine`. Tests: every case in CLAUDE.md §7 plus fast-check properties (paid = principal + interest; balances never negative; total paid ≤ budget × months).

### 2. Data layer — done
Drizzle ORM (expo-sqlite driver) + versioned forward-only migrations on start; repositories in `src/db/repositories/`; balance derivation from transactions; `debt → EngineDebt` mapping (`src/domain`); card-number detector; card template catalog JSON (`src/data`).

### 3. Security & lock — done
Built: `src/security/pin.ts` (scrypt PIN, escalating waits), `src/ui/LockGate.tsx` (lock on launch + after timeout, overlay), `LockScreen`, `PinPad`, `app/pin-setup.tsx`, screenshot blocking from settings. Moved to slice 10: wipe after N tries (lands with "Delete all data").
PIN (4 digits, scrypt via @noble/hashes, benchmark ≤ ~500 ms else react-native-quick-crypto), escalating delays, optional wipe after N attempts; expo-local-authentication; lock gate + auto-lock timeout; 14 Lock screen; screen privacy (expo-screen-capture). PIN setup/entry screens*.

### 4. UI kit — done
Built in `src/ui/`: `Button` (primary / secondary / compact / link), `IconButton`, `Chip`, `Controls` (Switch, SegmentedControl, ProgressBar, TextField), `DebtCard` (full / list / mini), `Payments` (FocusDebtCard, PaymentRow, LogPaymentSheet), `StrategyCard` + `PageDots`, `Mascot` (6 moods). All presentational (D20). LockScreen shows the sleeping mascot; LockScreen/PinPad use Button + IconButton.
All DESIGN.md §2 components + static mascot poses (react-native-svg, ported from `design/mockups/Mascot.dc.html`). Also move Slice 3's `LockScreen` and `PinPad` onto the kit components.

### 5. Onboarding
Screens 01–07; "Help me choose" quiz*; Budget screen runs the live engine.

### 6. Dashboard & payments
08 Dashboard, LogPaymentSheet (planned / extra / undo via reversal row), hide balances, 09 Debt detail, Debts tab*, edit/archive/delete*.

### 7. Check-in, compare, Plan tab
10 Check-in (3 reasons incl. "A payment I didn't log"), 11 Compare, Plan tab* (payoff order + month table, no charts), "How was this calculated?", paid-off moment*.

### 8. Notifications — logic done
Built: `src/notifications/reminders.ts` — `planReminders` (pure dates, month-end clamp, skips archived/paid-off, no due reminders for auto-deducted) and `rescheduleReminders` (cancel all, schedule one-time reminders 3 months ahead, max 60, 9:00 local; nickname only, never amounts). To do: call it on app start + after debt/settings changes, permission request, Android channel, deep link (slice 7).
expo-notifications local only: due-date (default 3 days before + on the day) and statement-day reminders; deep link to check-in. Verify FCM stays inert (network capture).

### 9. Encrypted backup — done
Built: `src/backup/backup.ts` (envelope JSON, AES-256-GCM, scrypt N=2^15, replace-all in one DB transaction, keeps this phone's lock settings / last backup / Pro), `src/backup/preview.ts`, routes `(app)/backup/export` and `(app)/backup/import` (approved proposals in `design/proposals/backup-*.md`), `src/ui/Backup.tsx`. To do: Settings rows (slice 10), "Have a backup? Restore it" link on 04 Strategy, swap the import preview's stand-in `money()` for `src/domain/format.ts`.
Export (AES-256-GCM, scrypt from user password, @noble/ciphers) via share sheet; import → password → preview → replace all; schema version + migrations. Flow screens*.

### 10. Settings, currency, Pro
12 Settings, home currency + relabel, delete all data (+ optional wipe after N PIN tries, moved from slice 3), 13 Paywall, `isPro` gating (free = 3 debts; over-limit debts become read-only, never hidden), billing stubbed (expo-iap at launch).

### 11. Hardening
Accessibility + font scaling pass, network audit (zero requests), Play Data safety notes, preview build for testers.

---

## Folder structure

```
src/
  app/            Expo Router routes only (thin screens)
    _layout.tsx   fonts, providers, DB open, lock gate
    lock.tsx
    (onboarding)/ splash, privacy, secure, pin-setup*, strategy, quiz*, debts, debt-form, budget
    (app)/(tabs)/ index (dashboard), plan*, debts*, settings
    (app)/        debt/[id], debt/[id]/edit*, check-in/[id], compare, pro, backup/export*, backup/import*, paid-off/[id]*
  engine/         pure TS payoff engine + __tests__
  domain/         rules between DB and engine (balances, mapping, countdown §17, card-number detector, free-tier limits)
  db/             client.ts, migrations/, schema.ts (Drizzle), repositories/
  security/       keyManager, pin, lockSession, screenPrivacy
  backup/         export/import format + crypto
  notifications/  local scheduling
  billing/        entitlement + store adapter
  state/          Zustand stores + selectors (plan is derived, never stored)
  ui/             shared components + Mascot/
  theme/          tokens.ts, typography.ts, index.ts (useTheme)
  i18n/           en.ts typed strings, t()
  data/           cardTemplates.json, issuers.json, currencies.ts
  config/         app.json (name/slug) + app.ts
  dev/            dev-only tools (dbSelfCheck)
assets/ fonts/ · mascot/ · logos/ (kept empty & separate — removable in one change)
```

## DB schema (v1)

Conventions: amounts `INTEGER` minor units + ISO 4217 `currency`; rates `TEXT` decimal strings; dates `TEXT 'YYYY-MM-DD'`; timestamps ISO UTC; ids UUID; version via `PRAGMA user_version`.

```
debts
  id, nickname, kind            -- credit_card | card_installment | personal_loan | government_loan | bnpl | informal | other
  issuer?, template_id?, color, currency
  monthly_rate TEXT              -- canonical; annual shown = ×12
  rate_entered_as                -- 'monthly' | 'annual'
  min_rule                       -- fixed | percent | percent_or_fixed
  min_percent TEXT?, min_fixed_minor?
  amortization_minor?, interest_method?   -- 'baked_in' | 'diminishing'; set ⇔ installment (D18)
  accepts_extra INTEGER          -- default 0 for installments (D4)
  statement_day?, due_day?, credit_limit_minor?, late_fee_minor?
  promo_rate TEXT?, promo_ends_on?
  auto_deducted, sort_order, notes?
  created_at, updated_at, archived_at?, paid_off_on?

transactions                     -- append-only; balance = SUM(amount_minor)
  id, debt_id, type              -- opening | payment | charge | interest_fee | statement_adjustment | correction | reversal
  amount_minor                   -- signed: + increases debt, − reduces
  currency, occurred_on, plan_month?, is_extra, reverses_id?, note?, created_at

statement_checkins
  id, debt_id, statement_date, expected_minor, statement_minor, reason, transaction_id, created_at

settings (single row)            -- home_currency, strategy, budget_minor, plan_start_month, lock_timeout_sec,
                                 -- hide_balances, block_screenshots, reminder_days_before, last_backup_at, onboarding_done
entitlement (single row)         -- is_pro, source ('play'|'test'), checked_at
```
PIN hash/salt/KDF params/failed-attempt counter live in SecureStore, not the DB.
Real DDL (CHECKs, append-only trigger): `src/db/migrations.ts`. Not yet created: `fx_rates` (v1.1).
Not stored (derived): plan, "% paid off" (paid ÷ (paid + remaining)), movement (engine with vs. without latest transaction).

## Engine types (`src/engine/types.ts`)

See `src/engine/types.ts` (source of truth). Changes from the approved draft are in DECISIONS.md D17.

Engine rules:
- Monthly order: minimum from opening balance → pay → accrue interest on the remainder (D2). Interest = `roundHalfUp(balance × rate)` to the minor unit, big.js.
- Installments get only their fixed payment unless `acceptsExtra` (D4); when finished, their payment rolls into the plan.
- Extra money goes to the strategy's target; leftover rolls to the next target **in the same month**.
- Tie-break — snowball: smaller balance → higher rate → lower `createdSeq`. Avalanche: higher rate → smaller balance → lower `createdSeq`. Custom: position in `strategy.order` (unlisted last), then `createdSeq`.
- All debts in one run share one currency (asserted); multi-currency = one run per currency (v1.1).
- Every result is an estimate; UI labels it so.
