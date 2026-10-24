# Proposal — Edit, archive and delete a debt

Not built. 09 Debt detail has no Edit button until this is approved.

## Entry
09 Debt detail header, right: "Edit" pill (as in the Account mockup) → `debt/[id]/edit`.

## Edit screen (reuses 06 Add a debt)
| Part | Spec |
|---|---|
| Header | Back arrow + "Edit debt" 20/700 |
| Form | Same fields and validation as 06, prefilled. Type segment locked (changing revolving ↔ installment changes the math; delete and re-add instead) |
| Balance field | Not shown. Balance changes go through "Update balance" (check-in) or a payment, so history stays append-only. Caption: "To change the balance, use Update balance." |
| Footer | Primary "Save changes" |
| Danger zone | Below the form, divider, then two text buttons: "Archive debt" (`primary`) and "Delete debt" (`danger`) |

## Archive
- Native Alert: "Archive {nickname}? It leaves your plan and dashboard. History is kept and you can restore it from the Debts tab." → Archive / Cancel.
- Sets `archived_at`; reminders rescheduled. Restore from Debts tab → "Archived" → detail → "Restore".

## Delete
- Native Alert, destructive: "Delete {nickname} and its history? This can't be undone." → Delete / Cancel.
- Deletes the debt row; its transactions and check-ins go with it (`ON DELETE CASCADE`, already in the schema). New repository function `deleteDebt`.
- Back to the dashboard, reminders rescheduled.

## Paid-off debts
Zero-balance debts get `paid_off_on` automatically when a payment clears them (slice 6). They stay visible until archived.
