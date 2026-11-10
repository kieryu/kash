# Google Play Console checklist

What to do once the Play developer account is verified, in order. Tick items as you go.
Account created 2026-11-05 (personal account, waiting for identity verification).

Related: `docs/release.md` (builds), `docs/play-data-safety.md` (Data safety answers), `docs/privacy-policy.md` (policy text), `DECISIONS.md`.

> **Never commit Play or Google keys.** The service account key (step 8) is a password to your Play account. Upload it to EAS instead of keeping it in the repo; `.gitignore` blocks the usual file names as a backstop.

---

## 0. While you wait for verification
- [ ] **Final package name** in `app.config.ts` (`APP_ID`, currently `com.kieruy.kash`). It can never change after the first upload.
- [ ] **Recruit 15–20 testers** for the closed test (step 9): Gmail addresses of people with Android phones who will keep the app installed for 14+ days.
- [ ] **Host the privacy policy**: fill in the date and contact line in `docs/privacy-policy.md`, publish it (GitHub Pages or any free static host), note the URL.
- [ ] **Contact email** for the store listing (shown publicly). A separate address is fine.
- [ ] **Store assets** (step 4): 512×512 icon, 1024×500 feature graphic, 2–8 phone screenshots.
- [ ] **Do one full backup round trip** on your phone: Settings → Export, Delete all data, Import. Testers will rely on it.

## 1. Account setup (after verification)
- [ ] Finish the **developer profile** (developer name shown on the store, contact details).
- [ ] Create a **payments profile** (Setup → Payments profile). Needed before you can create the ₱99 `pro_unlock` product, even for testing. Free.
- [ ] Fill in **tax info** if asked. Selling apps is taxable income in the Philippines: register with the BIR and check VAT on digital services before public launch (brief §19).

## 2. Create the app
Play Console → **Create app**:
- [ ] App name: **Kash** (can change later; the package name can't)
- [ ] Default language: English
- [ ] App or game: **App**
- [ ] Free or paid: **Free** (Pro is an in-app purchase, brief §20). *Free can't be changed to paid later.*
- [ ] Accept the declarations.

## 3. App content (Policy → App content)
| Form | Answer |
|---|---|
| Privacy policy | The hosted URL from step 0 |
| App access | All functionality available without special access. Note for reviewers: "No account or login. Set a PIN or skip biometrics in onboarding." |
| Ads | No ads |
| Content rating | Fill the questionnaire: no violence, no user-generated content, no gambling, no sharing of location → expect "Everyone"/"3+" |
| Target audience | **18 and over** only (money app; avoids the Families policy) |
| News app | No |
| Data safety | Copy from `docs/play-data-safety.md` → **No data collected, no data shared** |
| Government app | No |
| Financial features | Select **budgeting / debt-management tool only**. Kash does **not** offer, arrange or facilitate loans. Don't tick any lending option: personal-loan apps have extra rules in the Philippines. |
| Health | No |

## 4. Store listing (Grow → Store presence → Main store listing)
- [ ] **App name** (≤ 30 chars): `Kash: Debt Payoff Planner` or similar
- [ ] **Short description** (≤ 80 chars), e.g. "Plan your way out of debt. Private, offline, no account needed."
- [ ] **Full description** (≤ 4000 chars): what it does, strategies, privacy promise, "Not financial advice. Estimates only.", "Not affiliated with any bank or card network."
- [ ] **App icon** 512×512 PNG: resize `assets/images/icon.png` (1024×1024)
- [ ] **Feature graphic** 1024×500 PNG/JPG
- [ ] **Phone screenshots** (2–8): onboarding strategy, dashboard, log payment, compare. Turn on **Hide balances** or use sample data; never real card details.
- [ ] **Category**: Finance · **Contact email**: from step 0

## 5. First build and app signing
- [ ] Make sure `npm run check` passes and everything is committed.
- [ ] Build the bundle: `npx eas-cli build --profile production --platform android` → download the `.aab`.
- [ ] **Play App Signing** (asked on the first release). Choose one:
  - **Google generates the key (default, simplest).** Your EAS key becomes the *upload key*. Anyone on a sideloaded/Firebase APK must Export → uninstall → install from Play → Import to move over.
  - **Use your EAS key as the app signing key.** Sideloaded/Firebase installs update in place from Play, no export needed. Export the key with `npx eas-cli credentials` → Android → keystore → download, then follow Play's "Use existing app signing key" steps. Keep the downloaded keystore out of the repo (`*.jks` is ignored).
- [ ] **Production internet permission (D33):** production builds keep INTERNET (Play Billing needs it). Decide and log before the closed test.

## 6. Internal testing (fast, up to 100 testers)
- [ ] Testing → **Internal testing** → Testers: create an email list, add your own Gmail + a few testers.
- [ ] **Create new release** → upload the `.aab` **by hand** (Play requires the first upload manually) → release notes → Save → Review → Roll out.
- [ ] Copy the **opt-in link** and send it to testers. They accept, then install from the Play Store.
- [ ] Your own phone: Export a backup from the sideloaded/dev Kash first if the signing keys differ (step 5).
- Updates: build again, upload to the same track (or `eas submit`, step 8). Testers' phones update through Play.

## 7. Purchases and license testing
Billing code is in (D43, `expo-iap`). Play only lets you create an in-app product after a build **with the BILLING permission** is uploaded, so upload a new production build first.
- [ ] Monetize → **Products → One-time products** → create **`pro_unlock`** (the ID must match exactly; it can't be reused if deleted), name "Kash Pro", price **₱99**, activate.
- [ ] Setup → **License testing** → add every tester's Gmail (separate from the track's tester list).
- [ ] Testers buy with **"Test card, always approves"**: no real money is charged.
- [ ] Test refunds/revokes in **Order management** (extra debts must turn read-only, never deleted), and Settings → Restore purchase after a reinstall.
- [ ] Test a **slow / pending** payment ("Slow test card, approves after a few minutes"): app says it's processing, then Pro unlocks on the next launch.
- Purchases only work on a build **installed from Play** (internal track is fine), not on a sideloaded APK or dev build.

## 8. Automatic uploads with `eas submit` (optional, after the first manual upload)
- [ ] Google Cloud Console → create a **service account** → create a **JSON key** → download.
- [ ] Play Console → Users and permissions → invite the service account email → give it release permissions for Kash.
- [ ] Upload the key to EAS: `npx eas-cli credentials` → Android → Google Service Account → upload. Then delete the local JSON file.
- [ ] From then on: `npx eas-cli submit --platform android --latest` (add `--track internal` or set the track in `eas.json` `submit.production`).

## 9. Closed testing (required before production for a new personal account)
- [ ] Testing → **Closed testing** → create a track, add the 15–20 testers, release the same `.aab`.
- [ ] Need **12+ testers opted in for 14 days in a row**. Drop-outs can reset the count, so over-recruit.
- [ ] Ask testers for feedback; log it in `docs/revisions.md`.
- [ ] Before the closed test ends, decide if code push (EAS Update) is testers-only or also production (not set up yet; privacy trade-off, see chat 2026-11-04).

## 10. Production
- [ ] Dashboard → **Apply for production access** (Play asks how testing went).
- [ ] Promote the release to Production. Consider a **staged rollout** (e.g. 20% → 100%).
- [ ] Review usually takes a few days for a first release.
- [ ] After launch: keep `docs/play-data-safety.md` true after every new dependency.
