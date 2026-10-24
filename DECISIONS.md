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

## Costs
No paid services so far. See brief §19.
