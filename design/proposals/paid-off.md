# Proposal — Debt paid-off moment (slice 7)

Not built. Today a debt that hits zero just shows "Paid off" on 09 Debt detail and drops out of the plan.

## When it shows
- Right after a save that sets `paid_off_on` (Log payment sheet, or a check-in with "A payment I didn't log"), once per debt.
- Route `(app)/paid-off/[id]`, pushed over the dashboard. Not shown again on undo + re-pay in the same month.
- Last debt paid off → same screen with the "Debt-free!" copy.

## Layout
| Part | Spec |
|---|---|
| Background | `primary` full screen, like 01 Splash |
| Mascot | cheering, 160, with sparkles (static SVG; animation is v1.1) |
| Title | H1 26/700 white: "{Nickname} is paid off!" / last debt: "You're debt-free!" |
| Body | 15/400 `onPrimaryMuted`: "That's ₱X paid on this one since you started." |
| Movement card | white 16-radius card: "Your extra money now goes to **{next focus}**" + "Debt-free by Month Year" (§17). Hidden for the last debt |
| Stats row | Paid off: Month Year · Debts left: N · Total paid: ₱X |
| Primary button | accent (amber) "Keep going" → Dashboard. Last debt: "See what I did" → Dashboard |
| Secondary link | "Keep this card in my wallet" (default) / it already moves to the paid-off section of the Debts tab* |

## Behavior
- Haptic success on open; no confetti library (keep deps zero). Respect reduce motion.
- Hide balances on: amounts show as "₱ • • • •", mascot still cheers (text is the message, not the mascot).
- Numbers come from stored data (`progress`, `projection`), nothing new is stored.
- Copy stays calm: no "finally", no comparison to others.

## Open questions
1. Show it for an installment that ends on schedule (no user action), or only after a logged payment?
2. Keep the "Keep going" button amber, or primary-white to match the splash?
