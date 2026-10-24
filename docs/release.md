# Release: preview builds for testers

None of this has been run yet. Needs an Expo account (free plan is enough) and, for Play, a Play Console account ($25 one-time).

## 0. Before the first build
- Pick the final Android package name in `app.config.ts` (`APP_ID`, D16). It can't change once uploaded to Play. Tester APKs with the placeholder can't be upgraded to the Play version later — testers would uninstall (and lose data unless they export a backup).
- `npm run check` passes.

## 1. Preview APK (EAS internal distribution)

`eas.json` → `preview`: internal distribution, Android APK, no dev client, `EXPO_NO_TELEMETRY=1`.

```sh
npm install -g eas-cli          # or use npx eas-cli
eas login
eas init                        # first time only: creates the EAS project
eas build --profile preview --platform android
```

- `app.config.ts` is dynamic, so `eas init` can't edit it: add the printed id as `extra: { eas: { projectId: '<id>' } }` and commit.
- First build asks to generate an Android keystore — let EAS create and keep it (`eas credentials` to back it up).
- `appVersionSource: remote`: EAS tracks the version code. `eas build:version:get -p android` to see it.
- Free plan: 15 Android builds/month, low-priority queue. `eas build --profile preview --platform android --local` builds on your own machine (needs Android SDK + JDK) and doesn't use quota.
- The build page gives an install link + QR code. Share that link with testers.

## 2. Tester steps (send this to them)

1. Open the link on your Android phone and download the APK.
2. Allow "Install unknown apps" for your browser when Android asks, then install.
3. Open Kash. It needs no account and no internet — try it in airplane mode.
4. Set a PIN or fingerprint lock, add your debts (nicknames only, never card numbers), set a budget.
5. Use it for a couple of weeks: log payments, update balances when statements come.
6. Before uninstalling or installing a newer build that won't update in place: Settings → Export encrypted backup.
7. Send feedback (screenshots welcome — turn off "Block screenshots" in Settings first; turn on "Hide balances" if you don't want amounts in them).

New builds: send the new link; it installs over the old one (same keystore), data stays.

## 3. On-device checks to do on the first preview build
- Everything in `docs/network-audit.md` → "Still needs an on-device network capture".
- Accessibility: TalkBack through onboarding, dashboard, payment sheet, settings; phone font size and display size at max; "Remove animations" on.
- SQLCipher: Settings → (dev builds only) Encrypted database check; on preview, confirm the app opens and data survives a restart.
- Reminders fire at 9:00 and tapping a statement reminder opens check-in.
- Permissions list: `aapt dump permissions <apk>` matches `docs/play-data-safety.md`.

## 4. Google Play: internal → closed → production

Production builds are app bundles: `eas build --profile production --platform android` (auto-increments the version code).

1. Create the app in Play Console, fill **App content**: privacy policy URL (`docs/privacy-policy.md` hosted), Data safety (`docs/play-data-safety.md`), ads = no, target audience 18+, financial features.
2. **Internal testing** track (up to 100 testers by email list, available within minutes): upload the first `.aab` manually in Play Console (Play requires the first upload by hand), or `eas submit --platform android --latest` after a Google service account key is set up for `submit.production`.
3. **Closed testing — required for a new personal developer account:** at least **12 testers opted in for 14 days in a row** before you can apply for production access. Recruit 15–20 so drop-outs don't reset the count. Testers must stay opted in for the full 14 days. Organisation accounts are exempt.
4. Apply for production access (Play asks about the test), then promote the release.

Billing (`pro_unlock`) is a stub until public launch: add the Play Billing library, create the in-app product in Play Console, give closed testers a license-test account (§20), re-run the network audit.

## Costs
Expo free plan $0 · Play developer account $25 one-time · privacy policy hosting $0 (GitHub Pages).
