# Decisions

Architecture and product decisions, newest last. Each entry: decision, then why.

## 2026-10-20 — Initial architecture

### D1. Expo SDK 58 (React Native 0.88)
Latest stable at project start (released 2026-09-29), so we start on it rather than upgrading from 57 later.
Routes live in `src/app/` (current Expo Router default), not a root `app/` folder.

### D2. Interest timing: pay, then accrue
Each simulated month: the minimum is computed on the opening balance, payments are applied, then interest accrues on what remains: `next = (opening − payment) × (1 + monthlyRate)`, interest rounded half-up to the minor unit.
**Why:** users enter their latest *statement* balance, which already includes that cycle's interest. Accruing before paying would double-count a month of interest and diverge from real PH card statements.

### D3. Custom order ("My own order") is free
Free strategies: Snowball, Avalanche, Custom. Pro: Highest cost, Hybrid. Overrides brief §20.
**Why:** matches the approved Strategy mockup; it's cheap and it's part of the core "get out of debt" plan.

### D4. Installments don't take extra money by default
Installment-type debts get only their fixed amortization (`accepts_extra = false`, user can toggle per debt). When an installment finishes, its payment rolls into the plan. For 0% / add-on installments, balance = remaining total payable (amortization × months left).
**Why:** PH installments often charge pre-termination fees and don't shorten predictably with extra payments.

### D5. Security model A: device-bound key + app-level lock
The SQLCipher key is random (32 bytes), stored in SecureStore (Keychain / Keystore, this-device-only, excluded from backups). Biometrics / device passcode / PIN gate the UI; they don't wrap the key.
**Why:** covers the threat model (borrowed phone, lost locked phone, backup extraction). Wrapping the key with the PIN mainly helps on a rooted device, where a short PIN can be brute-forced offline anyway, and it complicates biometric re-enrolment. Documented in SECURITY.md.

### D6. PIN: 4 digits
Stored as a salted scrypt hash in SecureStore (along with the failed-attempt counter, so wiping or importing the DB can't reset it). Escalating delays after failed attempts. Mockup copy "Set a 6-digit PIN" will change to 4 digits.
**Why:** user preference. With only 10,000 combinations, the escalating delays carry the brute-force protection.

### D7. Light mode only in MVP
Tokens are structured so a dark palette can be added in v1.1.
**Why:** dark mode isn't designed yet.

### D8. Statement check-in has a third reason: "A payment I didn't log"
When the statement balance is lower than expected, recording the difference as a payment keeps history accurate.

### D9. No expo-updates (OTA) in MVP
**Why:** it contacts Expo's servers on every launch, which breaks the "no network" promise. Ship updates via the Play Store.

### D10. Data layer: Drizzle ORM over expo-sqlite (SQLCipher)
Tables are defined once in TypeScript; queries are type-checked. Drizzle is used only inside `src/db/repositories/` — screens never touch it. Migrations are versioned, forward-only, and run on app start.
**Why:** money correctness depends on data going in and out exactly right; compile-time checks on every query are worth one dependency. Drizzle makes no network calls.

### D11. Money and rates
Amounts: integer minor units + ISO 4217 code; respect each currency's minor-unit digits. Rates: decimal strings, canonical = monthly rate; annual shown as monthly × 12 (nominal). Decimal math via big.js, round half-up at each interest accrual.

### D12. Derived, not stored
Balances = sum of append-only transactions. Plan, "% paid off" and "moved N months closer" are recomputed by the engine from stored data (movement = plan with vs. without the latest transaction).

### D13. Crypto libraries
@noble/hashes (scrypt) + @noble/ciphers (AES-256-GCM): audited, pure JS, no network. If scrypt is too slow on a mid-range Android (> ~500 ms), switch to react-native-quick-crypto.

### D14. SQLCipher key is used in raw-key form, and opening fails closed
`PRAGMA key = "x'<64 hex>'"` — the key is already 256 random bits, so SQLCipher's password KDF is unnecessary. `openEncryptedDb` refuses to run if the build lacks SQLCipher (`PRAGMA cipher_version` empty), so a plaintext DB can never be created by accident. A missing/malformed stored key is an error, never silently replaced.

### D15. Android OS backup disabled
`android.allowBackup: false`. SecureStore entries can't be restored from a backup anyway (the Keystore key is lost on uninstall), so a restored DB would be unreadable. The encrypted export (§9) is the only way data leaves the phone.

### D16. Placeholder app ID `com.kieruy.kash`
The Android package name is permanent once uploaded to Play. Fine for dev builds; choose the final one before the first Play upload (ties into the final app name).

### D17. Engine types trimmed from the PLAN draft (2026-10-24)
- `tieBreak` → plain `createdSeq`; custom order comes only from `strategy.order` (no `customRank` copy to keep in sync).
- Installments drop `remainingMonths`: the engine runs on balance + payment. The data layer computes balance from months left (D4).
- `highestCost` / `hybrid` left out of `Strategy` until v1.1.
- `shortfall` carries the `month` it happens in (a growing balance can push minimums past the budget later, not just in month 1).
- Simulation stops early as `neverPaysOff` if total balance passes 10^15 minor units, before numbers lose precision.
**Why:** fewer fields that can disagree; nothing the MVP screens need is lost.

### D18. Data layer details (2026-10-24)
- **Hand-written SQL migrations**, not drizzle-kit: `src/db/migrations.ts`, one array per version, `PRAGMA user_version` tracks it, each version in one transaction. A DB from a newer app is refused. A test checks the Drizzle schema matches the real tables.
- **The DB guards the money rules**: amounts must be SQLite integers; payments negative, charges/fees positive; one reversal per transaction; `transactions` rejects UPDATE (append-only trigger); a debt is either revolving (min rule) or installment (amortization), never both.
- **Repository tests use Node's built-in SQLite** behind the real Drizzle expo-sqlite driver — no extra dependency, same query code as the app.
- Dropped from the v1 schema draft: `remaining_months` (goes stale; months left come from the engine), `settings.locale` (use the device locale), `fx_rates` (add with multi-currency in v1.1).
- Promo end date counts through the whole month it falls in (engine works in months).
- Repositories are synchronous (expo-sqlite sync API, same as Drizzle's driver). Fine at this data size.
**Why:** fewest moving parts that still make wrong money data impossible to write.

### D19. App lock details (2026-10-24)
- **Lock settings live in SecureStore, not the DB**: one record with PIN hash (scrypt N=2^14, r=8, p=1, params stored with the hash), biometrics on/off, miss count. Importing a backup from another phone can't change this phone's lock or reset the count. Auto-lock timeout stays in the DB settings.
- **Waits**: 5 free tries, then 30 s / 1 min / 5 min / 15 min / 1 h (cap). Tries during a wait aren't checked or counted. A biometric/passcode unlock clears the count. Wall clock (no monotonic clock in Expo).
- **Lock screen is an overlay over the app**, not a route: navigation state survives a lock, and it can't be popped by back. Underneath is hidden from screen readers.
- **Fail closed**: if the phone's screen lock is removed and there's no Kash PIN, the lock screen says to turn a screen lock back on — it doesn't let you in.
- **Wipe after N tries moved to slice 10**, with "Delete all data" (same code, and its on/off switch lives in Settings).
- Recents privacy on Android = the screenshot-blocking switch (FLAG_SECURE), as the Settings mockup says.
**Why:** smallest set that covers the threat model without letting a backup or a clock reset the lock.

### D20. UI kit is presentational (2026-10-24)
Kit components take formatted strings and callbacks; they never format money, read the DB or run the engine. Hide-balances masking, the payment sheet's chips and impact message, and strategy illustrations come from the screen.
**Why:** one place owns each number (the screen's selectors), and the kit stays testable without a DB.

### D21. Onboarding details (2026-10-24, slice 5)
- "My own order" = debts' `sort_order` (order added). No drag-to-reorder yet, though the card copy says "Drag".
- Installments/loans stored as baked-in interest: balance = payment × payments left (D4). Debt-free date is right for diminishing loans; their total interest shows as 0.
- Minimum field takes a fixed amount or a percent ("3%"); "% or ₱X, whichever is higher" not offered in the form yet.
- Budget step fixed at 500 home-currency units: buttons ±1 step, slider 1/5 step, nudge = 2 steps; starts at the floor rounded up to a step; slider max = max(4 × floor, floor + 10 steps).
- A nickname that looks like a card number **blocks** saving (brief §4 says "warn"; blocking is stricter).
- Pro strategies are shown but can't be picked until billing exists (slice 10).
- Rates entered per month only (as in the mockup); typed amounts use "." for decimals.
- PIN is 4 digits (D19); the Secure screen copy says 4-digit, not the mockup's 6.

### D22. Reminder scheduling (2026-10-24, slice 8 logic)
- One-shot DATE triggers for the next 3 months, soonest 60 kept (iOS caps pending at 64). Rescheduled on app start and after debt/settings changes; if the app isn't opened for ~3 months, reminders run out.
- Fire at 9:00 local. Day past month end clamps to the last day; "N days before" crosses month boundaries. `reminderDaysBefore = 0` = on the day only.
- Auto-deducted debts get no due-date reminders (statement reminders stay).
- Notification text shows the nickname, never amounts (visible on the lock screen).
- `cancelAllScheduledNotificationsAsync` before rescheduling: Kash is the only scheduler.
- expo-notifications makes no network calls without push tokens (unused). It bundles firebase-messaging on Android, inert without google-services.json — verify with a network capture in slice 11.

### D23. Backup screens (2026-10-24, slice 9 screens — built by Agent B)
Built from the proposals in `design/proposals/backup-export.md` and `backup-import.md`. Key points: export/import are single routes; export password asked twice, min 8 chars, show/hide, no-reset warning; file `kash-backup-YYYY-MM-DD.json` written to cache, shared via expo-sharing, then deleted; `lastBackupAt` set only after the share sheet closes without error; file picking via expo-file-system; replace-all confirmed with a native Alert only when the phone has data; after import → replaceAll, rescheduleReminders, reload, Dashboard; no retry limit on backup password. New deps when built: expo-sharing (new dev build).

Also: "Last backup" is set when the share sheet closes without error (Android can't tell a save from a dismiss); file is .json via share sheet only; import preview is a summary, no old-backup warning in MVP; a reminder-rescheduling failure after import doesn't fail the import; expo-sharing's config plugin not added (only needed to receive shares).

### D24. Dashboard & payments (2026-10-24, slice 6)
- This month's plan uses balances from before anything was logged this month, so it doesn't shift as you pay.
- Projection assumes the rest of this month's plan gets paid; anything above a debt's planned amount is a one-off extra this month, sent to the focus debt.
- Movement = projection with vs. without the latest change that hasn't been undone, shown in months (engine is monthly), not the mockup's "~days". Exactly-as-planned shows "right on plan".
- Undo reverses all of this month's regular payments on that debt (reversal rows). Extra payments have no undo yet.
- `paid_off_on` set when a balance hits zero, cleared on undo; reminders rescheduled.
- Due date shown = next occurrence of the due day (today or later), clamped to month end. Projected payoff day = due day in the payoff month, else month end (drives the ≤ 90-day countdown).
- Masked amounts keep the currency symbol ("₱ • • • •"), including sheet chips and impact text.
- Debts tab route is `(tabs)/wallet.tsx` (`/debts` is onboarding 05).
- Dashboard "in about N" counts months from now to the debt-free month; the Budget screen adds +1, so they can differ by a month — align in slice 7.
- Engine `createdSeq` ties (same-millisecond creation) break by `sort_order`, then id — fixes a flaky order.

### D25. Check-in, compare, explain, reminder wiring (2026-10-24, slice 7)
- A check-in is dated on the latest statement day on or before today (today if no statement day).
- A lower statement balance offers only "A payment I didn't log", preselected. That payment isn't tied to this month's plan, so the debt still shows as due on the dashboard.
- "In about N" = months from the current month to the debt-free month, one helper (`timeUntil`) for Budget and Dashboard; paying off this month reads "this month".
- Compare runs the dashboard's projection with only the strategy changed. Switching keeps you on Compare.
- Notification permission asked once, at the end of onboarding ("See my plan"). Reminders rescheduled on every app start after onboarding. Android "reminders" channel created before scheduling.
- Statement reminders deep-link to `/check-in/<id>`; due-date reminders open the app. A tapped notification navigates even while locked; the lock screen still covers it until unlock.
- No foreground notification handler: reminders don't show while the app is open.

### D26. Migration v2: currency code on transactions may change (2026-10-24, approved)
The append-only trigger (D18) now blocks UPDATE of every `transactions` column except `currency`, so the home-currency relabel (§15) can rewrite codes in place. Amounts, dates, types and links stay locked. Backup import gets a no-op upgrade step for v2.
**Why:** a relabel is metadata, not a balance change; forward-only, so this is permanent.

### D27. Relabel limits
Once debts exist, relabel only between currencies with the same minor-unit digits (PHP → USD ok, PHP → JPY refused). With no debts any currency works; a saved budget is cleared if digits differ. "Convert totals" shows "Not available yet" (MVP is single-currency).

### D28. Free-plan read-only debts
Debts after the first 3 by `sort_order` are read-only: shown, counted in plan and totals; Log / extra / check-in open the paywall. Undo still works on them.

### D29. Erase after wrong PINs
Fixed at 10 tries, off by default, only offered when a PIN is set. Stored in the SecureStore lock record (`wipeAfter`) so a backup import can't change it. Same code path as Delete all data; resumes on next launch if cut short.

### D30. Delete all data order
DB file → DB key → reminders → lock record. If the DB file can't be deleted, nothing else is touched (fail closed, D14). Pro entitlement isn't kept; Restore purchase brings it back.

### D31. Paywall and backup routes at root level
`/pro` and `/backup/*` live outside `(app)` so onboarding can reach them (restore link on 04). URLs unchanged.

### D32. Paywall only on tap
It opens only from a user tap on something Pro, so no weekly "last shown" counter is stored. Billing is a stub (`src/billing/billing.ts`) until expo-iap at launch.
**Open:** paywall copy lists Pro features not built yet — fix copy or ship them before billing goes live.

### D33. Hardening (2026-10-25, slice 11)
- `npm run check` includes a network guard test (`src/config/__tests__/networkGuard.test.ts`): fails on analytics/crash/OTA/backend SDKs, an `updates` block, a Firebase config file, or `allowBackup` ≠ false. Re-run `docs/network-audit.md` when adding a dependency.
- Large fonts: everything grows with the system font except PinPad digits (capped at 1.5×, fixed 72px keys) and debt-type segment labels (shrink to fit).
- Reduce motion: the payment sheet doesn't animate; native screen transitions follow the OS setting.
- Privacy policy hosted as a static page (GitHub Pages) from `docs/privacy-policy.md`.
- **Open (not adopted):** strip Android `INTERNET` permission from preview/production so the OS enforces zero network. Needs a device check that Play Billing still works (it talks to the Play Store app).

### D34. Debts tab and edit/archive/delete (2026-10-26, approved proposals)
- Installment edit shows Monthly payment and Payments left; changing either appends a `correction` row for the new balance (payment × months). History is never edited (D18).
- Edit leaves untouched fields as stored; never changes `acceptsExtra`, `autoDeducted`, interest method, statement day or currency.
- Read-only debts (D28): Edit opens the paywall, so they can't be archived or deleted on the free plan. Restore at the free limit opens the paywall.
- Delete removes the debt and, by ON DELETE CASCADE, its transactions and check-ins (explicit user action, strong confirm). Archive keeps history.
- Archive and delete land on Home; reminders rescheduled.

## Costs
No paid services so far. See brief §19.
