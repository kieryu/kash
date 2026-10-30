# On-device checks (dev build)

One dev build covers every slice's "except on-device check" in PLAN.md. Tests can't cover native modules (SQLCipher, Keystore, biometrics, notifications, share sheet, haptics, FLAG_SECURE), so this is the only proof they work.

```sh
eas build --profile development --platform android   # or add --local (no quota; needs Android SDK + JDK)
npx expo start --dev-client
```

Tick each line; note anything that looks off (screenshot with "Block screenshots" off).

## 1. First launch (slices 0, 3, 5)
- [ ] Splash → Privacy → Secure: fingerprint/face unlock turns on; PIN setup asks twice, rejects a mismatch.
- [ ] 04 Strategy: swipe cards, Pro cards show the "later update" note, "Help me choose" quiz recommends and preselects a card.
- [ ] 05/06 Add debts: a credit card, an installment, a loan. Typing a 16-digit number in nickname/notes warns.
- [ ] 07 Budget: debt-free date moves as you drag; below the minimums shows the shortfall.
- [ ] "See my plan" asks for notification permission once.

## 2. Storage & lock (slices 0, 2, 3)
- [ ] Settings → (dev) Encrypted database check passes.
- [ ] Kill and reopen the app: lock screen with sleeping mascot; data still there.
- [ ] Background past the lock timeout → locks. Under the timeout → doesn't.
- [ ] App switcher shows content hidden. Screenshot is blocked (FLAG_SECURE on by default); turning it off in Settings allows it.
- [ ] Wrong PIN 3+ times → wait grows. (Don't turn on "Erase after 10 wrong PINs" unless you've exported a backup.)

## 3. Everyday use (slices 4, 6, 7)
- [ ] Dashboard looks like `design/screens/` (fonts = DM Sans, colors, card carousel, mascot).
- [ ] Log payment sheet: prefilled amount, chips, live impact line; Save → "moved N months closer"; Undo works.
- [ ] Log an extra payment goes to the focus debt.
- [ ] Hide balances: amounts masked, mascot covers its eyes, tap to reveal.
- [ ] Debt detail → Update balance (check-in): higher balance offers 3 reasons; lower offers "A payment I didn't log".
- [ ] Compare strategies: switch and see the dashboard change. Plan tab: month table, "How was this calculated?".
- [ ] Pay a debt to zero → paid-off moment with one haptic buzz; only once.
- [ ] Debts tab: edit, archive, restore, delete (strong confirm).
- [ ] Phone font size at max: nothing clipped on dashboard, sheet, settings.

## 4. Reminders (slice 8)
- [ ] Set a debt's due day to tomorrow, reminders "3 days before" → a reminder shows at 9:00 (or temporarily change the phone clock).
- [ ] Statement-day reminder tapped while locked → unlock → lands on that debt's check-in.
- [ ] Notification text has the nickname only, no amounts.

## 5. Backup & settings (slices 9, 10)
- [ ] Export encrypted backup → share sheet → save to Files.
- [ ] Settings → Delete all data → back to splash. Onboarding 04 → "Have a backup? Restore it" → wrong password refused, right one shows preview → Replace all → data back.
- [ ] Free plan: a 4th debt is read-only and opens Kash Pro; Pro (test) switch in dev tools unlocks it.
- [ ] Paywall: "Unlock" says purchases open at launch; "Coming in free updates" list shows.
- [ ] Home currency relabel PHP → USD changes symbols, not amounts.

## 6. Preview build only
See `docs/release.md` §3 (network capture, permissions, TalkBack). Preview builds have **no INTERNET permission** (D38): the app should work exactly the same.
