# Spirit Idland Spec Pack

This folder specifies the round-based redesign of the prototype: a real-time survival round
with a permanent meta-progression shop, replacing the earlier turn-based slice.

**Status: implemented.** The round-based design described here is live. The turn-based
prototype it replaced (`app.js`) is deleted; the build is now `engine.js` (all rules, no
DOM) plus `ui.js` (all DOM, no rules), loaded as two classic scripts by `index.html`.

The loop is playable end to end — a round resolves itself, loses to Blight, hands off to
the shop, and starts again stronger. What is *not* settled is the balance: every number in
[04 Economy and Formulas](./04-economy-formulas.md) is still the placeholder pass, and one
of them is known to be wrong — see [Known Balance Problems](#known-balance-problems) below.

Run it by opening `index.html` from disk; no server and no build step. Run the regression
suite by opening `tests.html`, or headlessly with `tests\headless.ps1`.

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

## Known Balance Problems

Found by playing the implemented loop, not by reading it. Both are numbers, not structure.

- **An unattended round earns zero Fear.** Every land starts with at most 1 Dahan (2 health),
  and by the time a land is Ravaged it holds enough invaders to deal 3+ damage, so the Dahan
  die before they can counterattack — every round, in every land. Fear therefore only ever
  comes from abilities. The meta loop still works, but only for a player who acts; an idle
  first round buys nothing at all.
- **A round lasts about 64 seconds** (8 waves at the default threshold of 10). That is short
  enough that the shop arrives before the board is legible.

Neither is a design flaw in the loop; both are the placeholder numbers meeting each other.
See [Implementation Microtasks](../tasks/implementation-microtasks.md#what-to-build-next)
for the shortlist of fixes.

## Still Open

- The exact ability kit's effects and numbers (cooldowns, damage, reinforcement amounts) —
  implemented as specified, but never balanced.
- The permanent upgrade shop's catalogue beyond the three placeholder entries, and its cost
  curve.
- Whether a spent resource (Energy or otherwise) ever returns alongside ability cooldowns.
  `resources.energy` stays parked in the schema until this is answered.
- Whether a round in progress needs to survive a page reload. It currently does: a save
  resumes exactly as written, crediting nothing for the time the tab was closed.

## Playable Goals — Met

- A round resolves invaders and Dahan on its own clock, with no queue of turns. ✓
- The player can trigger abilities against a live board and watch Blight climb. ✓
- Losing a round hands off into the shop with no acknowledge-the-loss click. ✓
- A save resumes without losing Fear, purchased upgrades, or round count. ✓
