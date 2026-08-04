# Spirit Idland Spec Pack

This folder documents the current implemented prototype. The live build is a local-save, single-spirit, turn-based River slice with interactive card targeting, invader phase advancement, Dahan movement, and partial damage tracking.

## Reading Order

1. [01 Product Intent](./01-product-intent.md)
2. [02 Core Loop](./02-core-loop.md)
3. [03 State Contract](./03-state-contract.md)
4. [04 Economy and Formulas](./04-economy-formulas.md)
5. [05 Progression](./05-progression.md)
6. [06 UI Contract](./06-ui-contract.md)
7. [07 Content Registry](./07-content-registry.md)
8. [08 Acceptance and Tests](./08-acceptance-tests.md)
9. [Implementation Microtasks](../tasks/implementation-microtasks.md)

## Implemented Scope

- Single player only.
- One spirit only: River Surges in Sunlight.
- Four terrain panels only: Mountains, Desert, Jungle, Wetlands.
- Local save in browser `localStorage` only.
- One active turn loop with growth choice, card play, targeting effects, and end turn.
- Invader phase track with Ravage, Build, and Discover.
- Dahan spawning on fresh game and wipe-start only.
- Original UI wording and paraphrased mechanic text only.

## Not Yet Implemented

- Full presence placement effects.
- Gained power cards beyond turn counters.
- Terror/fear victory logic.
- Adversaries, blight, events, or win/loss conditions.
- Multi-spirit support.
- Automated test suite.

## Current Playable Goals

- First action should be choosing one growth option.
- First tactical sequence should come from playing one of the four River starter cards.
- Map state should stay legible in one screen, including invaders, Dahan, partial damage, and active targeting hints.
- A save can be resumed later without losing turn, deck, map, or pending effect state.
