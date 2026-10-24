# Play Console — Data safety answers

For Play Console → App content → Data safety. Keep these true: re-check after adding any dependency (see `docs/network-audit.md`).
"Collected" in Google's terms means data sent off the device. Data that stays only on the phone is not collected.

## Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not asked once you answer "No" above. (If the form still asks: nothing is transmitted.) |
| Do you provide a way for users to request that their data is deleted? | Not asked once you answer "No". In the app: Settings → Delete all data, or uninstall. |

Result shown on the store listing: **"No data collected"** and **"No data shared with third parties"**.

## Why "No" is honest

- Everything (debts, payments, settings) is stored only on the phone in an encrypted SQLCipher database. No server, no account, no analytics, no crash reporting.
- **Encrypted backup export** is started by the user and sent where *they* choose through the Android share sheet. Google treats user-initiated transfers like this as not collected by the app.
- **Notifications** are local, scheduled on the phone. No push service is used.
- **Purchases (at public launch):** the ₱99 Pro unlock is handled entirely by Google Play Billing. Payment details go to Google, not to us; the app only stores "Pro: yes/no" on the phone. Google's handling of payment data is covered by Google, not declared by the app.
- Biometric unlock uses Android's own prompt; Kash never receives fingerprint or face data.

## Other App content forms

| Form | Answer |
|---|---|
| Privacy policy | URL of the hosted `docs/privacy-policy.md` (GitHub Pages or any static host). Required even with no data collected. |
| Ads | No ads. |
| App access | No login needed. Note for reviewers: "No account. Set a PIN or skip biometrics during onboarding." |
| Target audience | 18+ (financial app). |
| Financial features | Declare as a personal finance / budgeting tool. Not a lender, no loans offered, no money moved. |
| Government app | No. |
| Health | No. |

## Permissions to expect in the manifest

Explain if Play asks: notifications (`POST_NOTIFICATIONS`, reminders), exact alarms if added by expo-notifications (scheduled reminders), biometric (`USE_BIOMETRIC`), vibrate. `INTERNET` comes from React Native's template; the app makes no network calls (see the audit). Billing adds `com.android.vending.BILLING` at launch.
Check the final list with `aapt dump permissions <apk>` on the preview build.
