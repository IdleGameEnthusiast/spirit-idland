# Spirit Idland Spec Pack

This folder specifies the round-based redesign of the prototype: a real-time survival round
with a permanent meta-progression shop, replacing the earlier turn-based slice.

**Status: spec-first.** This pack now describes the *target* design. The live code
(`app.js`, `index.html`) still runs the older turn-based, presence-driven prototype;
it has not caught up yet. Implementation follows this spec incrementally — see
[Implementation Microtasks](../tasks/implementation-microtasks.md) for the build plan.
Anything a doc calls "implemented" is aspirational until its microtask is marked complete.

## Reading Order

1. [01 Product Intent](./01-product-intent.md)
2. [02 Core Loop](./02-core-loop.md)
3. [03 State Contract](./03-state-contract.md)
4. [04 Economy and Formulas](./04-economy-formulas.md)
5. [05 Progression](./05-progression.md)
6. [06 UI Contract](./06-ui-contract.md)
7. [07 Content Registry](./07-content-registry.md)
8. [08 Acceptance and Tests](./08-acceptance-tests.md)
9. [09 Island Board](./09-island-board.md)
10. [Implementation Microtasks](../tasks/implementation-microtasks.md)

## Concept Summary

- A round is a real-time survival attempt: invaders and Dahan fight automatically while
  Blight climbs, and the player intervenes with cooldown-gated abilities.
- A round always ends the same way: Blight reaches its threshold and the round is lost.
  There is no separate "win" state — how long you lasted is the score.
- Fear earned during a round survives the loss and buys permanent upgrades between rounds:
  shorter cooldowns, new abilities, more starting defense, and so on.
- A new round resets the island (invaders, Dahan, Blight) but keeps every permanent upgrade,
  so a stronger spirit should reach further next time.
- Presence-on-the-board, the two presence tracks, and per-land Essence generation are
  retired from the live loop. Essence's state fields stay in the schema as an inert
  placeholder for later; presence is dropped entirely since nothing reads it anymore.

## Retired From The Turn-Based Slice

- Player-clicked growth options and the two presence tracks.
- Multi-step card targeting (Wash Away's three-click push, River's Bounty's gather-then-finish).
- Manually resolving Ravage/Build/Discover phase by phase and hand-assigning the Dahan
  counterattack.
- Per-land Essence generation and presence placement range.

## Not Yet Decided

- The exact ability kit's effects and numbers (cooldowns, damage, reinforcement amounts).
- The permanent upgrade shop's full catalogue and costs.
- Blight's exact gain formula and threshold value, beyond the first placeholder pass.
- Whether a spent resource (Energy or otherwise) ever returns alongside ability cooldowns.
- Whether a round in progress needs to survive a page reload, or only meta-state between
  rounds does.

## Current Playable Goals

- First few seconds of a round should show invaders and Dahan already resolving
  automatically, so the round reads as a countdown, not a queue of turns.
- First round should let the player trigger at least one ability and watch Blight climb.
- Losing a round should hand off cleanly into spending Fear in the upgrade shop.
- A save can be resumed later without losing Fear, purchased upgrades, or round count.
