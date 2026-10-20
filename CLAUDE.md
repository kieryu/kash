# Project Brief — Kash (Local-Only Debt Payoff Tracker)

> Working name: **Kash** (temporary — see "Naming" at the bottom). Use "Kash" in code, app config, and UI copy for now. Keep the name in one constant/config value (`app.config.ts` + a `APP_NAME` constant) so renaming later is a one-line change.
> Drop this file in the repo root as `CLAUDE.md` so Claude Code loads it every session.

---

## 1. Your role

Act as a combined team for this project:

- **Senior software engineer / senior frontend engineer** — React Native, Expo, EAS, TypeScript, clean architecture, testing.
- **Security engineer** — local data encryption, key management, threat modelling for a lost/stolen/shared phone.
- **Product Owner** — keep scope tight, ship an MVP first, push back on features that don't serve the goal.
- **UI / UX specialist** — calm, motivating, non-judgmental design; people using this are often stressed about money.
- **Accountant** — correct money math, rounding, interest accrual, auditability of every number shown.
- **Financial advisor (debt-focused)** — explain payoff strategies plainly, never shame the user, and never present projections as guarantees.

When these roles disagree (e.g. a nice UI idea vs. a security risk), say so explicitly, explain the trade-off, and recommend one option. Ask me before making irreversible architecture decisions.

---

## 2. Product goal

Help people with multiple credit cards and loans become **debt-free** by:

1. Tracking every debt in one place (like a card wallet, but for balances owed).
2. Applying a payoff strategy the user chooses.
3. Telling them, every month, **exactly what to pay on which account** and **when they'll be debt-free**.
4. Keeping them motivated with visible progress.

**Core principle: 100% local and private.** No accounts, no login with email, no SSO, no server, no cloud sync, no analytics that leave the device. The app must work fully in airplane mode.

Primary market: the Philippines (PHP ₱ default, local banks/issuers, common local debt types), but the code must stay currency/locale-agnostic.

---

## 3. Tech stack & constraints

| Area | Decision |
|---|---|
| Framework | React Native with **Expo** (latest stable SDK — check the current version before scaffolding), **TypeScript strict mode** |
| Builds | **EAS Build** (development, preview, production profiles) and **EAS Submit** |
| Navigation | Expo Router |
| Database | **SQLite with SQLCipher encryption** — use `expo-sqlite` with its SQLCipher option if supported in the current SDK; verify in docs before choosing. Fallback: `op-sqlite` with SQLCipher. |
| Migrations | Versioned, forward-only schema migrations run on app start |
| Data layer | A thin repository layer (optionally Drizzle ORM) — UI never runs raw SQL |
| Key storage | DB encryption key generated randomly on first launch, stored in `expo-secure-store` (iOS Keychain / Android Keystore) |
| Auth | `expo-local-authentication` (biometrics + device passcode) and an in-app PIN fallback |
| State | Zustand (or similar lightweight store) + selectors; derived values computed, not stored |
| Notifications | `expo-notifications` **local scheduled notifications only** (no push server) |
| Charts | A lightweight RN chart lib (e.g. victory-native / react-native-svg based) |
| Testing | Jest + React Native Testing Library; **the payoff engine must have exhaustive unit tests** |
| Backend | **None.** Do not add Firebase, Supabase, or any network SDK for app data. |

### Hard rules
- No network calls for user data. If any dependency phones home, flag it.
- No crash reporting / analytics SDKs by default. If we ever add one, it must be opt-in and send zero financial data.
- **Never store money as floats.** Store integer minor units (centavos). Use a decimal library for interest math and round only at defined points (see §7).
- Every computed figure shown to the user must be reproducible from stored data (no hidden state).

---

## 4. Security & privacy requirements

Threat model: someone picks up an unlocked/borrowed phone, a lost phone, a phone backup being extracted, or a shoulder-surfer.

- **Encryption at rest:** SQLCipher DB, key in SecureStore. Key is never logged, exported, or shown.
- **App lock:** on launch and after returning from background past a timeout (default 1 min, configurable: immediately / 1 / 5 / 15 min).
- **Unlock methods:** biometrics → device passcode fallback → in-app 4–6 digit PIN. PIN is stored only as a salted hash using a slow KDF (scrypt/Argon2 via a vetted lib), never plaintext.
- **Brute-force protection on PIN:** escalating delays after failed attempts. Optional setting: wipe data after N failed attempts (off by default, with a strong warning).
- **Screen privacy:** blur/obscure app content in the app switcher; optional "hide balances" toggle (tap to reveal) for use in public.
- **Screenshot blocking:** optional setting (Android FLAG_SECURE via `expo-screen-capture`).
- **No sensitive card data — ever.** Do not ask for card number, CVV, expiry, or online banking credentials. Validate that free-text fields don't look like a 16-digit card number and warn if they do.
- **Backups:** OS cloud backup of the DB should be excluded (or it's encrypted anyway — document the decision). The only way data leaves the device is a user-initiated encrypted export (§9).
- **Forgotten PIN:** be honest — if biometrics/device passcode also fail, data cannot be recovered without an export file. Say this clearly during onboarding.
- Write a short `SECURITY.md` describing all of the above in plain language.

---

## 5. Debt model (not just credit cards)

Support multiple debt types because many users carry more than cards. Each type adjusts the form fields and the interest math:

| Type | Notes |
|---|---|
| Credit card (revolving) | Monthly interest rate, minimum payment rule, statement & due day |
| Credit card installment / 0% installment | Fixed monthly amortization, remaining months, may be 0% or add-on rate |
| Personal / salary loan | Fixed amortization, term, rate |
| Government loan (e.g. SSS, Pag-IBIG) | Fixed amortization, often salary-deducted — allow "auto-deducted" flag |
| Buy-now-pay-later / e-wallet credit | Short-term installments |
| Informal / family loan | Optional rate (often 0%), flexible due date, private nickname |
| Other | Generic fields |

### Account fields
- **Nickname** (required), **type**, **issuer** (optional; from a preset list of common PH banks/issuers or "Other")
- **Card template**: pick an issuer + product template (e.g. "BDO Credit Card — Visa", "BDO Credit Card — Mastercard", "UnionBank — Visa") or "Custom". See §18 for the rules on bank names, logos, and network marks.
- **Card style**: the template sets default colors; the user can override with a color picker (hex input + swatches).
- **Currency** (defaults to the home currency; see §15)
- **Current balance**
- **Interest rate** — let the user enter monthly or annual; store one canonical form and show both
- **Minimum payment rule** — fixed amount, % of balance, or "% of balance or ₱X, whichever is higher"
- **Statement day** and **due day** (day of month)
- **Credit limit** (optional; enables utilization display)
- **Fixed amortization & remaining months** (for installment-type debts)
- **Late fee** (optional, for warnings)
- **Promo period** (optional: 0% until date, then rate X)
- Notes, archived flag, paid-off date

---

## 6. Payoff strategies

Present these as selectable cards in onboarding and allow switching later (the dashboard recalculates instantly and shows the difference).

1. **Debt Snowball** — pay minimums on everything, put all extra money on the **smallest balance** first. Fast early wins; best for motivation.
2. **Debt Avalanche** — extra money goes to the **highest interest rate** first. Mathematically lowest total interest. *(Note: my original idea called this "balloon method" — a balloon payment is actually a loan structure where a big lump sum is due at the end, not a payoff strategy. Use "Avalanche" in the app; you may optionally explain balloon loans in an "Understand your debt" help section.)*
3. **Highest monthly cost first** — target the debt costing the most interest in pesos this month (balance × rate). A practical middle ground.
4. **Hybrid / "Snowball then Avalanche"** — clear 1–2 small debts for momentum, then switch to avalanche.
5. **Custom order** — user drags accounts into their own priority order.
6. **Snowflake add-on** (not a standalone strategy) — log small windfalls (bonus, 13th month pay, side income, cashback) as one-off extra payments applied per the active strategy.

For each strategy, onboarding shows: a simple illustration, a one-sentence explanation, who it's best for, and — once accounts exist — a live comparison: **debt-free date and total interest paid** under each strategy, side by side. That comparison is the most persuasive screen in the app.

Also add an **educational "Should I consolidate?" note** (balance transfer / consolidation loan) as information only — never as a recommendation of a specific product.

---

## 7. The payoff engine (most important code in the app)

A pure, framework-free TypeScript module (`/src/engine`) with no React or DB imports, fully unit tested.

**Inputs:** list of debts (§5), monthly payoff budget (total the user can pay per month), strategy, start date, optional one-off extra payments.

**Algorithm (month-by-month simulation):**
1. For each month: accrue interest on each debt per its type (revolving: balance × monthly rate; installment: follow the amortization schedule; respect promo periods).
2. Pay the **minimum** (or fixed amortization) on every debt.
3. If budget < sum of minimums → flag "budget shortfall" state; do not silently fail. Show how much more is needed.
4. Apply remaining budget to the target debt per strategy.
5. When a debt hits zero, **roll its freed-up payment into the next target** (the "snowball/avalanche roll").
6. Stop when all balances are zero or after a safety cap (e.g. 600 months) → flag "never pays off at this budget" (minimums lower than interest).

**Outputs:** per-month schedule per account (payment, interest, principal, ending balance), debt-free date per account and overall, total interest, total paid, and "this month's plan".

**Accounting rules:**
- Integer centavos everywhere; decimal lib for rate math; round half-up to the centavo at the end of each interest accrual step; document this.
- Provide a "how was this calculated?" view per number (show the formula and inputs).
- Clearly label all results as **estimates** — real statements may differ (daily balance methods, fees, new purchases).

**Tests must cover:** single debt; many debts; zero-interest debts; budget shortfall; minimum < interest (never pays off); promo period expiry; installment debts mixed with revolving; strategy switch mid-plan; extra one-off payments; tie-breaking (same balance or same rate — define deterministic rules).

---

## 8. Keeping balances current (no bank connection)

Since the app is offline, balances update manually. Make it painless:

- **Log a payment** (amount, date, account) → balance decreases; payments become history.
- **Monthly "statement check-in"**: on each account's statement day, a local notification prompts "Update your [Nickname] balance". The user enters the new statement balance; the app records the difference as interest/fees/new charges so the projection self-corrects.
- **Log new charges** (optional, for people still using the card) — and gently show how new spending pushes back the debt-free date.
- **Due-date reminders** — local notification X days before due date (default 3), plus on the day.
- Every balance change is an append-only transaction row (payment, statement adjustment, charge, fee, manual correction) so history and charts are auditable.

---

## 9. Export / import (device transfer, not sync)

- **Export:** user-initiated, produces a single file encrypted with a **user-chosen export password** (AES-256-GCM, key derived via scrypt/Argon2). Shared via the OS share sheet (save to Files, send to self, etc.).
- Also offer an **unencrypted CSV export** of transactions/accounts for spreadsheet users, behind an explicit warning.
- **Import:** pick file → enter password → preview what will be imported → choose **replace all** (default) or cancel. No merging in MVP.
- Include a schema version in the export; importing from older versions runs migrations.
- Clearly state: "This is a one-time transfer. Your devices will not stay in sync."
- Optional reminder: "You haven't backed up in 30 days."

---

## 10. User flows

### Onboarding
1. **Splash** — app logo + a short rotating motivational line about becoming debt-free (write original lines; don't quote copyrighted sources).
2. **Privacy promise screen** — "Your data never leaves this phone. No account. No internet needed." with a simple lock/phone illustration.
3. **Secure your app** — enable biometrics/device passcode; set a PIN as fallback. Explain the forgotten-PIN reality.
4. **Choose your strategy** — horizontally swipeable, tappable cards (Snowball, Avalanche, Highest Cost, Hybrid, Custom), each with an illustration and plain explanation. Allow "Not sure — help me choose" → 2–3 quick questions (Do you need quick wins to stay motivated? Is saving the most money your priority?) → recommend one.
5. **Add your first debt** — an empty dashed-outline card with "+ Add debt". Form per §5. Encourage adding all debts ("The plan works best when everything is in it").
6. **Set your monthly payoff budget** — show the sum of minimums as the floor; slider/input for the total they can commit. Instantly show the debt-free date changing as they adjust — this is a key motivational moment.
7. **Your plan** — land on the dashboard.

### Dashboard (main screen)
- **Hero:** total debt remaining, projected **debt-free date** (month/year), progress ring/bar (% paid off since start). How the countdown is displayed follows §17.
- **Mascot** (§16) appears here with a contextual mood and short message.
- **"This month" card:** exactly what to pay on each account, highlighting the **focus debt** the extra money goes to. Checkboxes to mark each as paid (logs the payment).
- **Upcoming due dates** (next 14 days) with status: paid / due soon / overdue.
- **Debt cards carousel** (the wallet look): nickname, color, balance, rate, mini progress bar, payoff date.
- **Interest this month** estimate — a quiet, honest number showing what debt is costing them.
- **Milestones:** first debt paid off, 25/50/75%, ₱X paid — celebratory but tasteful moments (confetti/haptics), plus a "debt paid off" archive.

### Other screens
- Account detail (history, schedule, edit, archive)
- Plan / timeline (stacked chart of balances over time, month-by-month table)
- Strategy compare & switch
- "What if?" simulator (+₱X per month, one-time lump sum, stop using a card) — shows the new date and interest saved
- Settings: security, lock timeout, hide balances, notifications, currency, export/import, theme (light/dark), about & disclaimers, wipe all data

---

## 11. UX & UI principles

- Calm, encouraging, never shaming. Use "debt-free in 18 months" rather than "you owe ₱200,000".
- Large clear numbers; one primary action per screen; thumb-reachable controls.
- Light and dark mode; respect system font scaling; screen-reader labels on every control and chart summary.
- Language: English first; architect for i18n so Filipino/Tagalog can be added.
- Haptics for confirmations and milestones.
- Empty states that teach (dashed card + short hint).
- Disclaimers: "Not financial advice. Estimates only." — shown in onboarding and About, not nagging on every screen.

---

## 12. MVP scope vs. later

**MVP (v1):** onboarding, security/lock, encrypted DB, accounts (credit card + installment + generic loan), card templates (text + colors, no logos), home currency selection + relabel, snowball / avalanche / custom, payoff engine, dashboard with month/year debt-free date, log payments, statement check-in, local reminders, encrypted export/import, mascot static poses, settings.

**v1.1+:** multi-currency accounts with manual exchange rates, highest-cost & hybrid strategies, what-if simulator, snowflake windfalls, charts/timeline, milestones & achievements, mascot animations, CSV export, home-screen widget (debt-free countdown), Filipino translation, licensed logos (if permission obtained), iOS release.

Push back on me if I try to pull v1.1 features into the MVP.

---

## 13. Release plan

- **Development:** EAS development builds on my own device.
- **Internal testing:** EAS internal distribution (shareable install link) for quick builds to friends, and/or **Google Play Console Internal testing** track. Firebase App Distribution is optional and not needed — the app has no backend, so Firebase adds nothing except another SDK.
- **Play Store production:** if publishing from a **new personal** Play developer account, Google requires a **closed test with at least 12 opted-in testers for 14 continuous days** before production access. Recruit 15–20 testers to survive drop-outs. An organization account is exempt.
- **Play Data Safety form:** declare no data collected / no data shared (keep it true!).
- **iOS later:** TestFlight → App Store.

---

## 14. How to work with me

- Start by proposing the folder structure, DB schema, and the engine's TypeScript types. Wait for my approval before building screens.
- Build in small vertical slices; each slice ends with passing tests and a short summary of what changed.
- Prefer well-maintained Expo-compatible libraries; tell me when a library requires a custom dev client / config plugin.
- Before adding any dependency, check it doesn't make network calls or collect telemetry.
- When I ask "what do you think?", answer as the role most relevant and be direct.
- Keep a `DECISIONS.md` log of architecture decisions with the reasoning.

---

## 15. Currency support

Users must be able to choose and change currency.

- **Home currency**: chosen in onboarding (pre-selected from device locale; PHP for the Philippines). Changeable anytime in Settings. All dashboard totals show in the home currency.
- **Per-account currency**: each debt can have its own currency (e.g. a USD card for someone abroad or a freelancer paid in dollars). Default = home currency.
- **Money storage**: integer minor units **plus the ISO 4217 code** on every amount. Respect each currency's minor-unit digits (PHP/USD = 2, JPY = 0, KWD = 3) — never assume 2 decimals.
- **Formatting**: `Intl.NumberFormat` with the user's locale and currency (symbol position, separators). Polyfill Intl on Hermes if needed.
- **Exchange rates are manual (offline app)**: if any account's currency differs from the home currency, ask the user for the rate ("1 USD = ? PHP"), store it with its date, and label converted totals as approximate. Remind them to update rates periodically (e.g. at statement check-in). No live FX API in MVP — that would break the offline promise. If ever added, it must be opt-in and fetch only rates (no user data sent).
- **Changing the home currency** asks one question:
  - "I picked the wrong currency" → **relabel** all home-currency amounts, no conversion.
  - "I moved / want totals in a different currency" → **convert totals** using a user-entered rate; account balances keep their own currencies.
- The payoff engine runs **per currency**; totals and the debt-free date use converted values. Budget is entered in the home currency. Show a warning when a multi-currency plan depends on rates older than 60 days.
- MVP may ship single-currency-per-user (home currency only, changeable via relabel) if multi-currency threatens the timeline — but design the schema for per-account currency from day one.

---

## 16. Mascot

An **original tarsier character** — big round eyes, tiny body, holding on tight to a branch. The idea: *small but watchful — it keeps an eye on your money.*

- **Money tie-ins:** clutches a coin like a treasure, sits on a stack of coins, carries a tiny coin purse, eyes sparkle with a coin reflection on milestones.
- **Moods / states** (simple set, reused everywhere):
  - Neutral / watchful — default dashboard
  - Cheering — payment logged, milestone reached, debt paid off
  - Gently concerned — payment due soon / overdue (never angry or shaming)
  - **Covering its eyes with its hands — "hide balances" mode is on** (doubles as the privacy indicator)
  - Sleeping — app locked screen
  - Thinking — strategy picker / what-if simulator
- **Where it appears:** splash, onboarding helper, empty states, lock screen, milestones, app icon candidate.
- **Format:** SVG for static poses; Lottie or Rive for 2–4 short animations. Keep total animation assets small.
- **Design must be fully original.** Do not base it on, trace, or imitate any existing tarsier mascot, brand character, or cartoon. If generating placeholder art, keep it simple and clearly ours.
- Mascot name ideas (undecided): **Barya** ("coins"), **Sentimo**, **Tipid** ("frugal"), **Piso**.
- Accessibility: the mascot never carries information alone; its message always appears as text too. Users can turn off mascot animations (respect "reduce motion").

---

## 17. Debt-free countdown — how to display it

Decision: **do not lead with "X days until debt-free".** Large day counts (e.g. "1,247 days") feel discouraging, and the number jumps around every time a balance is updated, which erodes trust.

Rules:
- **Primary display:** the debt-free **month and year** ("Debt-free by **March 2028**") plus "in about 2 years 5 months".
- **Switch to a day countdown only in the final stretch** — when the projected date is ≤ 90 days away ("**47 days** to debt-free!"). This is where a countdown motivates.
- **Show movement, not just the target:** after a payment or statement update, show the change ("You moved your debt-free date **2 months closer**"). This is the most motivating number in the app. If the date slips, phrase it neutrally with one actionable tip.
- **Per-account countdowns** use the same rule (month/year, days only when close).
- Optional setting: "Show countdown in days" for users who prefer it.
- Additional motivators: % paid off, total paid so far, interest avoided vs. paying minimums only, and "months in a row on track".

---

## 18. Card templates, bank names & logos

The user should be able to pick a template that looks like their card (e.g. BDO Visa, BDO Mastercard, UnionBank Visa).

Implementation:
- A **template catalog** (local JSON) with: issuer name, product name, card network (Visa / Mastercard / JCB / Amex / none), default colors/gradient, and an **optional logo asset slot**.
- **Default rendering (no logos):** generic card shape, the issuer and product name as **plain text**, the network as a **plain-text label**, template colors, and the user's nickname. This ships in MVP.
- **Real bank and card-network logos are trademarks.** Only add a logo file to a template slot when we have permission or the brand's published guidelines allow that use. Until then the slot stays empty and the text rendering is used. Keep logo assets in a separate folder so they can be removed in one change if a takedown request arrives.
- Show a small "Not affiliated with any bank or card network" line in About and on the template picker.
- **Never** imitate full card artwork, and never ask for or display card numbers.
- Template catalog is data, not code, so new banks can be added without changing components. Start with common PH issuers (e.g. BDO, BPI, Metrobank, UnionBank, Security Bank, RCBC, EastWest, PNB, AUB, HSBC, Citi-legacy cards) plus generic loan templates (SSS, Pag-IBIG, BNPL, personal loan, family loan).

---

## 19. Estimated costs (Android-first MVP)

| Item | Cost | Notes |
|---|---|---|
| Expo / EAS **Free** plan | $0 | 15 Android + 15 iOS cloud builds/month, low-priority queue, OTA updates to 1,000 monthly active users. Enough for MVP. Local builds (`eas build --local`) don't use the quota. |
| EAS **Starter** (only if needed) | $19/month + usage | Faster queue, more build credit, 3,000 OTA MAUs. Upgrade only when free builds run out or the app grows. |
| Google Play developer account | **$25 one-time** | Covers unlimited apps. |
| Apple Developer Program (iOS later) | $99/year | Needed for TestFlight / App Store and for installing builds on physical iPhones. |
| Backend / Firebase | $0 | Not used. |
| Privacy policy page (required by store listings) | $0 | Host on GitHub Pages / a free static host. A custom domain is optional. |
| Closed-test testers (12+ for 14 days) | $0 | Friends, family, colleagues. Paid tester services exist but aren't necessary. |
| Fonts / icons | $0 | Open-licensed fonts and icon sets; check licenses. |
| Mascot design & animation | $0 – varies | DIY first; commission an illustrator later if the app gains traction. |

**Realistic minimum to launch on Android: about $25.** Adding iOS later: +$99/year.

**Revenue side (see §20):** Google keeps a 15% service fee on the first $1M/year, so ₱99 nets roughly ₱84 per sale before taxes. Selling apps is taxable income in the Philippines — register with the BIR and check how VAT on digital services applies before launch.

Keep this table updated in `DECISIONS.md` if any paid service is added — every paid or online service must be justified against the "local-only, private" promise.

---

## 20. Monetization — free app + ₱99 one-time "Pro" unlock

Decision: **free to download, with a one-time ₱99 Pro unlock** (no subscription, no ads). Not a ₱99 paid-upfront app — paid downloads get far fewer installs and reviews, and users can't see if the app fits them before paying.

**Ethical rule:** the people using this app are in debt. Everything needed to actually get out of debt stays **free**. Pro adds convenience and power, never the core plan.

| Free | Pro (₱99 one-time) |
|---|---|
| Up to **3 debts** (enough to try the full flow) | **Unlimited debts** |
| Snowball, Avalanche | + Highest-cost, Hybrid, Custom order |
| Full dashboard, payoff plan, debt-free date | What-if simulator |
| Payment logging, statement check-in, due-date reminders | Multi-currency with manual rates |
| App lock, encryption, hide balances | Charts / timeline view |
| **Encrypted export/import (always free — users must never be trapped)** | CSV export |
| Home currency selection | Extra mascot poses/themes, card styles, home-screen widget |

Implementation notes:
- **Google Play Billing**, one-time non-consumable product (`pro_unlock`). Use `react-native-iap` (or the current maintained Expo-compatible billing library — verify before choosing).
- **No RevenueCat or any third-party purchase server** — it would send data off-device and break the privacy promise. Purchase verification relies on Google Play on the device; the only network traffic is between the phone and Google Play during purchase/restore.
- Store the entitlement locally (encrypted DB) **and** re-check with Play on launch when online, so a restore works after reinstall or on a new phone ("Restore purchase" button in Settings).
- If the user exceeds 3 debts on free and then loses Pro (refund), **never delete or hide their data** — make extra debts read-only and keep them in totals.
- Build the entitlement flag (`isPro`) into the architecture from the MVP; enable billing at public launch. Closed testers get Pro free via a test license.
- Paywall screen: calm, one screen, list what Pro adds, one price, "Maybe later" clearly visible. No dark patterns, no countdown timers, no nagging more than once per week.
- Consider an introductory/launch price later via Play Console pricing; keep ₱99 as the anchor.
- Update the Play **Data safety** form: purchase handled by Google Play; the app itself still collects no data.

---

## Naming

**Current working name: Kash** (temporary). Before public launch, check the Play Store, trademarks, and domain availability. If "Kash" is taken or too close to an existing finance/lending app, pick a final name.

Other ideas to check for trademark/Play Store conflicts:
- **Laya** (Filipino: "free") — short, meaningful locally
- **Bayad Na** ("already paid") — playful, local
- **Zero Day** — the day you hit zero
- **Clearpath** — calm, plain English
- **Paydown**
- **Snowfall** — nods to snowball, light and positive
- **Hulog** ("installment") — very local, maybe less aspirational
