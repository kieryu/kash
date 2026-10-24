# Security & privacy

Plain-language summary of how Kash protects your data. Updated as each part is built.

## What we protect against
- Someone picks up your unlocked or borrowed phone.
- A lost or stolen phone.
- Someone extracting a phone backup.
- Someone looking over your shoulder.

## Your data never leaves the phone
Kash has no account, no server, no cloud sync and no analytics. It works fully offline. The only way data leaves the phone is when **you** export an encrypted backup file.

## Encryption at rest — built
- All data is stored in a database encrypted with SQLCipher (AES-256).
- The database key is 256 random bits, created on first launch and kept only in the phone's secure hardware storage (Android Keystore / iOS Keychain). It is never shown, logged or exported, and it can't move to another device.
- If the app was ever built without encryption support, it refuses to open the database instead of saving data unencrypted.
- Android cloud backup of app data is turned off. A backup would be unreadable anyway, because the key can't be restored.

## App lock — built
- Kash locks when opened, and when you come back after the auto-lock time (default 1 minute; choose immediately, 1, 5 or 15 minutes in Settings).
- Unlock with fingerprint/face (your phone's passcode works as backup) or a 4-digit Kash PIN.
- The PIN is stored only as a salted, slow hash (scrypt) in the phone's secure storage — never as the PIN itself.
- 5 free tries, then waits that grow: 30 s, 1 min, 5 min, 15 min, then 1 hour each. The count lives in secure storage, so deleting or importing data doesn't reset it. Known gap: changing the phone's clock can shorten a wait.
- While locked, the app underneath is hidden from screen readers and the back button.
- The lock protects the app's screens. The encryption key itself is protected by the phone's secure storage (see DECISIONS.md D5 for why).
- Optional: erase all data after 10 wrong PINs in a row — built, off by default. Turning it on shows a warning: it can't be undone, and anyone holding your phone could trigger it on purpose. Tries during a wait don't count. If the app is closed in the middle of erasing, it finishes erasing the next time it opens.

## Delete all data — built
- Settings → Delete all data asks twice, then removes the encrypted database file, its key, your Kash PIN and lock settings, and all scheduled reminders. The app starts over as new.
- The database file is deleted first. If that fails, nothing else is touched, so your data still opens. Once the key is gone, any leftover copy of the file can't be read.
- "Erase after 10 wrong PINs" uses exactly the same steps.
- A Kash Pro purchase isn't lost: use Restore purchase after setting up again.

## If you forget your PIN
If biometrics and the device passcode also fail, your data cannot be recovered without an exported backup file. There is no reset, because there is no server.

## Screen privacy
- Optional screenshot blocking — built. On Android it also hides Kash in the recent-apps view. With it off, Android's recent-apps view can show the last screen.
- Hide balances — built. The Hide button on Home (or the Settings switch) replaces every amount with "₱ • • • •" on the dashboard, debt pages, payment sheet, check-in and compare; the "how it's calculated" page shows no numbers. The mascot covers its eyes while it's on. Tap Show to reveal.
- Reminder notifications show only the debt's nickname, never amounts, because they can appear on the lock screen.

## Encrypted backup — built
- Settings → Export encrypted backup makes one file locked with a password you choose (at least 8 characters). AES-256-GCM, key from your password via scrypt. Without the password nobody can open it, and it can't be reset.
- You decide where the file goes (share sheet). Kash deletes its own temporary copy right after.
- Import replaces everything on this phone after you confirm. Your PIN and lock settings on this phone stay as they are.

## No card details, ever
Kash never asks for card numbers, CVV, expiry dates or online banking logins. A nickname that looks like a card number can't be saved.
