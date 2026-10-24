# Proposal — Export encrypted backup (`(app)/backup/export`) *

Status: **proposal, not built.** Approve or change, then it gets built in slice 9 screens.

## Purpose
Make one encrypted file the user can move to a new phone or keep safe. Always free (§20).

## Entry point
12 Settings → "Your data" → **Export encrypted backup** row ("Export" button). Back arrow returns to Settings.
Later (not this slice): the "You haven't backed up in 30 days" reminder (§9) opens the same screen.

## Layout (one screen, 20 padding, back-arrow header)
```
┌──────────────────────────────────┐
│ ←  Export backup                 │  screen header 20/700
│                                  │
│        [Mascot: watch, 96]       │
│  Save a copy of your data        │  section title 17/700
│  One file with all your debts,   │  body 15 muted
│  payments and settings, locked   │
│  with a password you choose.     │
│                                  │
│  Backup password                 │  TextField (secure, show/hide)
│  [••••••••••           ] Show    │
│  At least 8 characters           │  caption 12 muted
│  Type it again                   │  TextField (secure)
│  [••••••••••           ]         │
│                                  │
│ ┌ accentSoft box ──────────────┐ │
│ │ Write this password down.    │ │  accentText 13
│ │ Without it, nobody can open  │ │
│ │ the file — not even Kash.    │ │
│ └──────────────────────────────┘ │
│                                  │
│  This is a one-time transfer.    │  small 13 muted
│  Your devices will not stay in   │
│  sync.                           │
│                                  │
│ [      Create backup file      ] │  Button primary
│  Last backup: never              │  caption, centered
└──────────────────────────────────┘
```

## Copy
- Header: **Export backup**
- Title: **Save a copy of your data**
- Body: "One file with all your debts, payments and settings, locked with a password you choose."
- Fields: "Backup password" (hint "At least 8 characters"), "Type it again"
- Warning box: "Write this password down. Without it, nobody can open the file — not even Kash. There's no way to reset it."
- Sync line: "This is a one-time transfer. Your devices will not stay in sync."
- Button: **Create backup file**; busy label **Locking your file…**
- Footer: "Last backup: never" / "Last backup: 24 Oct 2026"
- Not saved here: lock settings (PIN, biometrics, auto-lock, screenshots) and Pro. Footnote: "Your PIN and lock settings stay on this phone. Pro is restored from Google Play."

## States
| State | What shows |
|---|---|
| Idle | Button disabled until password ≥ `MIN_PASSWORD_LENGTH` and both fields match |
| Mismatch | Under 2nd field (amber, accentText): "The passwords don't match." |
| Too short | Hint stays visible; button disabled (no red error while typing) |
| Busy (scrypt ~1–2 s) | Button disabled with "Locking your file…", fields read-only, back disabled. Mascot → think. |
| Share sheet open | OS sheet (Save to Files / Drive / send to self) |
| Success | Mascot → cheer, message "Backup saved. Keep the file and your password somewhere safe." Button becomes **Done** (secondary: "Share again"). |
| Cancelled sheet | Back to idle, no message, lastBackupAt unchanged (see open Q2) |
| Error (write/share fails) | accentSoft box: "Couldn't create the file. Nothing was changed. Try again." |

Password is cleared from state when leaving the screen. Never logged.

## What happens
1. `exportBackup(db, password)` → string.
2. Write to cache dir as `kash-backup-YYYY-MM-DD.json` (see open Q4 for name/extension).
3. Open share sheet.
4. Only after the sheet resolves without error: `updateSettings({ lastBackupAt: now })`.
5. Delete the cache file (it's encrypted anyway; just tidy).

## Components
Existing: `Button` (primary/secondary), `TextField` (passes `secureTextEntry`), `Mascot`, `IconButton` + `BackIcon`.
New: none required. Show/hide password = a `Button variant="link"` beside the field, or skip it (open Q5). Warning box = plain View with tokens (same as Privacy tip); if it repeats on 3+ screens, make an `InfoBox` later.

## Dependencies needed to build
| Package | Why | Network / telemetry | New dev build? |
|---|---|---|---|
| `expo-file-system` (~58.0.10) | write the temp file | none (has download APIs; we don't call them) | Probably **no** — already in the tree as a dependency of `expo` and autolinked; add as direct dep via `npx expo install` |
| `expo-sharing` | open the OS share sheet for a **file** (RN `Share` can't share files on Android) | none | **Yes** — new native module |

## Open questions
1. New-phone restore from onboarding — see `backup-import.md` Q1.
2. **When to set "Last backup"**: Android's share sheet can't tell us if the file was really saved or the sheet was just closed. Proposal: set it when the sheet closes without error. OK?
3. **Also offer "Save to phone"** (folder picker via `expo-file-system`, no share sheet)? Android's share sheet doesn't always show a "save to Files" target. Proposal: share sheet only in MVP; add if testers can't find where to save.
4. **File name / extension**: `kash-backup-2026-10-24.json` (opens in any picker) vs. a custom `.kash` (looks nicer, but Android pickers may grey it out). Proposal: `.json`.
5. **Show/hide password toggle**: add (link-style "Show") or skip? Proposal: add — typos in a password you can't reset are costly.
