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
- Kash locks when opened, and when you come back after the auto-lock time (default 1 minute; can be "immediately").
- Unlock with fingerprint/face (your phone's passcode works as backup) or a 4-digit Kash PIN.
- The PIN is stored only as a salted, slow hash (scrypt) in the phone's secure storage — never as the PIN itself.
- 5 free tries, then waits that grow: 30 s, 1 min, 5 min, 15 min, then 1 hour each. The count lives in secure storage, so deleting or importing data doesn't reset it. Known gap: changing the phone's clock can shorten a wait.
- While locked, the app underneath is hidden from screen readers and the back button.
- The lock protects the app's screens. The encryption key itself is protected by the phone's secure storage (see DECISIONS.md D5 for why).
- Planned: optional "erase data after N wrong PINs" (off by default).

## If you forget your PIN
If biometrics and the device passcode also fail, your data cannot be recovered without an exported backup file. There is no reset, because there is no server.

## Screen privacy
- Optional screenshot blocking — built. On Android it also hides Kash in the recent-apps view. With it off, Android's recent-apps view can show the last screen.
- Hide balances (tap to reveal) — planned.

## No card details, ever
Kash never asks for card numbers, CVV, expiry dates or online banking logins.
