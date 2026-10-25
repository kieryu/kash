# Status — lane A finished (2026-10-26)

All lane A slices (4, 5, 6, 7, 10, 11) and Agent B's 8 logic + 9 are merged on master. All approved proposals (debts tab, debt edit, plan tab, paid-off, quiz) built. `npm run check` passes (238 tests). Nothing has been run on a device.

## Needs you
- **Build setup:** `eas login`, `eas init`; add `extra.eas.projectId` to `app.config.ts` by hand (TS config). Commands in `docs/release.md`.
- **Final Android package name** (D16) before testers install anything that should later update from Play.
- **Play Console account** ($25) for internal/closed testing.
- **Paywall copy** lists unbuilt Pro features (D32).
- **INTERNET permission strip** (D33, open).
- Privacy policy draft needs a date and contact line.

## On-device checks owed
Every slice's look/behavior check, network capture (zero connections incl. after reboot), TalkBack + max font + remove animations, reminders firing and statement reminder → check-in, delete all data / erase-after-N → welcome, APK permissions vs Data safety (now incl. VIBRATE from expo-haptics), quiz → 04 return, paid-off navigation.
