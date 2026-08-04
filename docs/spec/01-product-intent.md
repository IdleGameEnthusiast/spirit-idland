# 01 Product Intent

## Intent

Define the current playable fantasy and scope for the implemented browser prototype.

## Rules

- The player acts as River Surges in Sunlight protecting terrain types through positioning, attrition, and Dahan support.
- The prototype is turn-based first, even though save/resume and action recharge still exist in the background.
- The playable slice should emphasize readable tactical sequencing over breadth.
- Every visible mechanic in the build should already be documented in this spec pack.

## Current Fantasy

"I am a river spirit redirecting invaders, striking exposed targets, and gathering Dahan where the flow is strongest."

## Current Session Promise

- In the first minute: choose a growth option and understand that growth gates the whole turn.
- In the first few turns: play one of four River starter cards and see a visible map change.
- During a card sequence: finish the active targeting effect before doing anything else.
- On return after leaving the page: recover the saved board state and action recharge progress.

## Implemented Pillars

- Positioning matters: Wash Away and River's Bounty both manipulate map state directly.
- Damage matters: Flash Floods and future attacks use unit health instead of instant removal for every target.
- Turn discipline matters: growth-first and finish-the-effect-first locks are part of the design, not temporary constraints.
- Readability matters: terrain is shown as four stable panels with explicit invader, Dahan, and HP feedback.

## Non-Goals For This Slice

- No complete Spirit Island rules implementation.
- No hidden map adjacency model.
- No full power gain, presence growth payoff, or spirit unlock tree yet.
- No AI opponent beyond the invader phase track.

## Acceptance

- A new reader can explain the current prototype in under 60 seconds.
- The difference between implemented systems and planned systems is explicit.
- The docs match the live four-card River prototype rather than the older idle design.
