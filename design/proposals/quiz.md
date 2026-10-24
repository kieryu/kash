# Proposal — "Help me choose" quiz (04a)

Not built. Entry point on 04 Strategy ("Not sure? Help me choose") is left out until this is approved.

## Flow
```
04 Strategy --Not sure? Help me choose--> 04a Quiz (Q1 → Q2) --> 04 Strategy with the pick selected + "Recommended" chip
```
Two questions, one per page, inside the same screen (no new route per question). Back arrow goes to the previous question, then to 04.

## Layout (same tokens as 04)
| Part | Spec |
|---|---|
| Header | Back arrow (IconButton) + step bar stays at "Step 3 of 5" |
| Mascot | `think` mood, 96, centered; its line also shown as text |
| Question | H1 26/700, e.g. "What keeps you going?" |
| Answers | 2 full-width option cards (surface, radius 16, 1.5px `lineStrong`; selected = 3px `primary` + CheckBadge), title 15/700 + one-line caption 13 `muted` |
| Footer | Primary "Next" (Q1) / "See my match" (Q2), disabled until an answer is picked |

## Questions
1. **What keeps you going?**
   - "Seeing debts disappear fast" — *Quick wins keep me motivated*
   - "Knowing I'm saving money" — *I can stay patient*
2. **Is there a debt you want gone first, no matter what?** (e.g. money owed to family)
   - "Yes, I have my own order"
   - "No, let Kash decide"

## Result
- Q2 = Yes → **My own order**
- Q1 = quick wins → **Snowball**
- Q1 = saving money → **Avalanche**

Back on 04, the matching card is selected and scrolled into view, with a `primarySoft` "Recommended for you" chip above its name. Copy under the chip: "You can switch anytime." Only free strategies are recommended (MVP: Snowball / Avalanche / My own order).

## Accessibility
Answer cards are `radio` role within a `radiogroup`; the result is announced ("Recommended: Snowball").
