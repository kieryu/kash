# Network audit

Goal (CLAUDE.md §3): the app sends **no** user data over the network and works fully in airplane mode.
Audited 2026-10-25 against `package.json` / `package-lock.json` on branch `slice-11-hardening`.
This is a code and config review. It is **not** proof — the on-device capture at the bottom is.

## Result

- No code in `src/` calls `fetch`, `XMLHttpRequest`, `WebSocket` or any download API.
- No analytics, crash reporting, OTA update, backend or purchase-server SDK is installed (direct or transitive).
- `app.config.ts` has no `updates` block, no `googleServicesFile`, no network plugins. `expo-updates` is not installed (D9).
- Android OS backup is off (`allowBackup: false`, D15).
- EAS build profiles set `EXPO_NO_TELEMETRY=1` (stops Expo CLI telemetry on the build machine; nothing to do with the app on the phone).
- The only network traffic is Google Play Billing (phone ↔ Google Play, done by the Play Store app; see §20 and D43).

Guard: `src/config/__tests__/networkGuard.test.ts` fails `npm run check` if a known analytics / crash / OTA / Firebase / backend / RevenueCat SDK appears in `package.json` or `package-lock.json`, or if `app.config.ts` gains `updates`, a Firebase config file, or turns OS backup back on.

## Runtime dependencies

| Package | Could it contact the network? | Why it's fine |
|---|---|---|
| `expo` (core, modules API) | No by itself. | Runtime only. Expo CLI telemetry is build-machine side and turned off in `eas.json`. |
| `expo-router`, `expo-linking` | No. Linking opens a URL only when the app asks (it never does with a web URL). | Deep links are local (`kash://check-in/<id>` from notifications). |
| `expo-constants` | No. | Reads the app config baked into the build. |
| `expo-dev-client` | **Dev builds:** connects to the Metro dev server on your LAN and has a network inspector. | Dev only. Preview/production builds should open straight into the app — confirm in the capture. |
| `expo-font`, `@expo-google-fonts/dm-sans` | `loadAsync` can download a font from a URL. | We pass bundled font files only (`src/app/_layout.tsx`). No Google Fonts request at runtime. |
| `expo-splash-screen`, `expo-status-bar`, `expo-system-ui` | No. | UI only. |
| `expo-sqlite` (SQLCipher) | No. | Local encrypted file. |
| `drizzle-orm` | No. | Query builder over expo-sqlite. |
| `expo-secure-store` | No. | Keystore / Keychain on the phone. |
| `expo-crypto` | No. | Random bytes from the OS. |
| `@noble/hashes`, `@noble/ciphers`, `big.js` | No. | Pure JS math. |
| `expo-local-authentication` | No. | OS biometric / passcode prompt. |
| `expo-haptics` | No. | Vibration only (adds Android `VIBRATE` permission). Paid-off moment. |
| `expo-screen-capture` | No. | Sets FLAG_SECURE. |
| `expo-file-system` | Has download/upload APIs. | Unused. We only write a temp file to cache and use the OS file picker. |
| `expo-sharing` | No. Hands the file to the OS share sheet. | Where the user sends it (Drive, email) is their choice and happens outside Kash. |
| `expo-notifications` | **Push tokens would contact Expo/FCM.** Bundles `com.google.firebase:firebase-messaging` on Android. | We never call `getExpoPushTokenAsync` / `getDevicePushTokenAsync`; only local scheduled notifications. Without `google-services.json` Firebase can't initialise, so FCM and its helpers (installations, datatransport) stay inert. **Confirm in capture** (D22). |
| `expo-application` (transitive, via expo-notifications) | Includes the Play Install Referrer library. | IPC to the Play Store app, only if `getInstallReferrerAsync` is called. We never call it. |
| `expo-build-properties` | No. | Build-time config plugin. |
| `react`, `react-native` | RN has `fetch`/WebSocket built in; dev builds talk to Metro. | Nothing in `src/` uses them. Release builds have no dev-server connection. |
| `react-dom` | — | Web target only; not in the Android app. |
| `react-native-gesture-handler`, `-reanimated`, `-worklets`, `-screens`, `-safe-area-context` | No. | UI only. |
| `react-native-svg` | `SvgUri` can fetch a URL. | Unused; all SVGs are inline. |

Dev dependencies (`jest`, `eslint`, `typescript`, testing libs, `fast-check`, `@types/*`) never ship in the app.

## Google Play Billing (`expo-iap`, D43)

Added 2026-11-09: `expo-iap` 6.4.3 → native `io.github.hyochan.openiap:openiap-google` / `openiap-core` 4.0.10 → Google Play Billing 9.1.0. No JS dependencies of its own.
- What we call (`src/billing/playStore.ts`): `initConnection`, `fetchProducts`, `requestPurchase`, `getAvailablePurchases`, `finishTransaction` (acknowledge), the purchase listeners. All go through the Play Store app on the phone.
- What it also ships and we **never call**: `kitApi` / `verifyPurchaseWithProvider` (sends the purchase token to `kit.openiap.dev`), `verifyPurchase` (Google Android Publisher API, Meta Horizon), `verifyAppOwnership` (Play Integrity). Guarded by `src/billing/__tests__/billing.test.ts`.
- Native AARs checked: no HTTP client, no analytics; the only URLs are the verification helpers above and Play deep links. Manifest adds `com.android.vending.BILLING` and `INTERNET` (production already has INTERNET, D33; preview still strips it, D38).
- Pulls in `com.google.android.play:integrity` transitively. Unused unless `verifyAppOwnership` is called.
- When a purchase or restore happens, the Play Store app talks to Google. That is the only traffic, and it's Google's, not ours.

## Still needs an on-device network capture

Do this on a **preview** build (not a dev build — dev builds talk to Metro on purpose):

1. Fresh install, full onboarding (PIN + biometrics, 3 debts, budget, allow notifications).
2. Dashboard, log a payment, undo, check-in, compare, settings, hide balances.
3. Export a backup (cancel the share sheet), import it back.
4. Background → foreground past the auto-lock; let a scheduled reminder fire (set reminders "On the day only" on a debt due today, or wait).
5. Leave the app idle in the foreground ~10 min, then reboot the phone and open it again (checks FCM/Firebase on cold start).

How: Android Studio Network Inspector, or PCAPdroid (no root, per-app capture), or a proxy (mitmproxy) on the Wi-Fi.
Pass = **zero** connections from `com.kieruy.kash` (DNS lookups included). Also run the whole flow once in airplane mode.
Specifically watch for: `firebaseinstallations.googleapis.com`, `fcm.googleapis.com`, `firebaselogging-pa.googleapis.com`, `*.expo.dev` / `exp.host`, anything on port 8081.
