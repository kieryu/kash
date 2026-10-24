# Proposal — Import a backup (`(app)/backup/import`) *

Status: **proposal, not built.** Approve or change, then it gets built in slice 9 screens.

## Purpose
Load a backup file and **replace all** data on this phone with it (§9: no merging in MVP).

## Entry point
12 Settings → "Your data" → **Import a backup** ("Replaces this phone's data"). Back arrow returns to Settings.
New-phone path from onboarding: see open Q1.

One route, three steps (same screen, no extra routes): **Pick file → Password → Preview & replace.**

## Step 1 — Pick a file
```
┌──────────────────────────────────┐
│ ←  Import backup                 │
│        [Mascot: think, 96]       │
│  Move your data to this phone    │  17/700
│  Pick the backup file you saved  │  body muted
│  from your other phone.          │
│ ┌ accentSoft ──────────────────┐ │
│ │ Importing replaces everything│ │
│ │ on this phone. It doesn't    │ │
│ │ merge.                       │ │
│ └──────────────────────────────┘ │
│ [         Choose file          ] │  primary
└──────────────────────────────────┘
```
- Picker cancelled → stay here, no message.
- File can't be read → "Couldn't open that file. Try picking it again."

## Step 2 — Password
```
│  kash-backup-2026-10-24.json     │  caption, file name
│  Backup password                 │  TextField secure
│  [••••••••••           ] Show    │
│ [            Unlock            ] │  primary
│  Choose a different file         │  link
```
- Busy (scrypt ~1–2 s, `readBackup`): button "Unlocking…", field read-only, mascot think.
- Errors from `readBackup` (amber text under the field, field stays filled):

| Error | Copy | Where it goes |
|---|---|---|
| `WrongPasswordError` | "That password didn't work. Check it and try again. Without the right password, this file can't be opened." | stay on step 2 |
| `NotABackupError` | "This file isn't a Kash backup." | back to step 1 |
| `BackupTooNewError` | "This backup is from a newer version of Kash. Update the app, then import again." | back to step 1 |
| anything else | "Something went wrong reading this file. Nothing was changed." | back to step 1 |

No retry limit: the file is offline and already scrypt-protected; a limit adds nothing.

## Step 3 — Preview
```
│  Backup from 24 Oct 2026         │  17/700 (exportedAt, local date)
│ ┌ surface card ────────────────┐ │
│ │ Debts            5 (1 paid off)│
│ │ Payments & updates        142│ │  transactions count
│ │ Total owed        ₱182,450.00│ │  per currency, one line each
│ │ Strategy            Snowball │ │
│ │ Monthly budget      ₱12,000  │ │
│ └──────────────────────────────┘ │
│  [mini DebtCard row, scrollable] │  DebtCard variant="mini", nickname + balance
│                                  │
│ ┌ accentSoft ──────────────────┐ │
│ │ This phone has 3 debts now.  │ │
│ │ They will be deleted and     │ │
│ │ replaced by this backup.     │ │
│ └──────────────────────────────┘ │
│  Your PIN and lock settings stay │  small muted
│  as they are on this phone.      │
│  This is a one-time transfer.    │
│  Your devices will not stay in   │
│  sync.                           │
│ [      Replace all my data     ] │  primary
│ [            Cancel            ] │  secondary
```
- Totals: balance = sum of each debt's transactions in the backup (same rule as D12), formatted per its currency. Archived/paid-off debts counted but marked.
- If this phone has no debts, the amber box reads: "This phone has no data yet. Nothing will be lost."
- If backup has more debts than the free limit and user isn't Pro: extra line "Debts after the 3rd will be read-only until you unlock Pro. Nothing is hidden or deleted." (slice 10 rule).

## Replace-all confirmation
Native `Alert` (two buttons, destructive style), only when this phone has data:
- Title: **Replace all data?**
- Body: "Your 3 debts and their history on this phone will be deleted. This can't be undone."
- Buttons: **Cancel** / **Replace** (destructive)

## After replace
1. `replaceAll(db, data)` (one DB transaction — all or nothing).
2. `rescheduleReminders(db)` (src/notifications) — new debts, new due/statement days.
3. Reload stores / re-derive plan.
4. Success screen: mascot cheer, "Your data is here. Kash is ready." Button **Go to my plan** → Dashboard (reset nav stack).
5. If `replaceAll` throws: "Couldn't import. Your data on this phone wasn't changed." (true: it rolls back).
- `lastBackupAt` is not touched by import (device setting).
- Lock, PIN, auto-lock, screenshot setting and Pro are untouched.

## Components
Existing: `Button`, `TextField`, `Mascot`, `DebtCard` (mini), `IconButton` + `BackIcon`.
New: none required. Preview card = rows like the Settings mockup (label left, value right, `divider` lines). Confirmation = RN `Alert`.

## Dependencies needed to build
| Package | Why | Network / telemetry | New dev build? |
|---|---|---|---|
| `expo-file-system` (~58.0.10) | `File.pickFileAsync()` (system file picker) + read text | none for these calls | Probably **no** (already in tree via `expo`; add as direct dep) |
| `expo-document-picker` | **not needed** — `expo-file-system`'s picker covers it | — | — |

## Open questions
1. **Restore during onboarding (new phone)**: today import is only in Settings, so a new-phone user must finish onboarding (add a debt, set a budget) first, then wipe it. Proposal: a link "Have a backup? Restore it" on 04 Strategy (after the lock is set, so data never lands unlocked) → this screen → Dashboard. Touches Agent A's onboarding; needs your OK.
2. **Confirmation**: native `Alert` (proposed, simple, accessible) or an in-app styled sheet?
3. **Preview detail**: counts + totals + mini cards (proposed), or counts only?
4. **Backup older than 60/90 days**: warn "This backup is from Mar 2026 — newer payments won't be in it"? Proposal: skip in MVP; the date is shown in the preview title.
