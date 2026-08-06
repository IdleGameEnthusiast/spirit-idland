# Spirit Idland Spec Pack

This folder specifies the round-based redesign of the prototype: a real-time survival round
with a permanent meta-progression shop, replacing the earlier turn-based slice.

**Status: implemented.** The round-based design described here is live. The turn-based
prototype it replaced (`app.js`) is deleted; the build is now `engine.js` (all rules, no
DOM) plus `ui.js` (all DOM, no rules), loaded as two classic scripts by `index.html`.

The loop is playable end to end — a round resolves itself, loses to Blight, hands off to
the shop, and starts again stronger. What is *not* settled is the balance: every number in
[04 Economy and Formulas](./04-economy-formulas.md) is still the placeholder pass — see
[Known Balance Problems](#known-balance-problems) below.

**`4.0.0` rebuilt the fight.** The Ravage phase is gone. Invaders now damage the land they
stand in continuously, everywhere at once, and both consequences — Blight rising and Dahan
falling — accrue as per-land bars rather than landing in whole points on a schedule. The
invader track is two slots (Build, Discover) and a wave deals no damage at all. Read
[02 Core Loop](./02-core-loop.md#the-fight) first; most of what changed follows from it.

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

- A round is a real-time survival attempt: invaders and Dahan fight continuously while
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
- **The Ravage phase itself**, as of `4.0.0`. Damage is not an event on a terrain any more;
  it is a rate in every land at once. See [02-core-loop.md](./02-core-loop.md#the-fight).

## Known Balance Problems

Both old findings — zero unattended Fear, a 64-second round — were artefacts of the per-wave
Ravage model and are fixed. A round now runs 87-120 seconds, earns 1.05-1.75 Fear unattended,
and costs the player 2-4 of their 6 Dahan. Full trace in
[04-economy-formulas.md](./04-economy-formulas.md#measured-behaviour).

A third was found and fixed during this pass: at the first cut's casualty rate, **no Dahan
ever died** — the casualty bar and its death spiral were dead code. Raising
`DAHAN_LOSS_PER_DAMAGE_SECOND` to 0.05 put them on screen. That constant is the one under
playtest.

What is left:

- **Dahan stacking was superlinear, and has been braked twice.** Casualty damage divided by
  the stack size gave a stack quadratic lifetime, and defence cancelling Blight outright gave
  it a cliff to zero — together, one fortified land beat six defended ones and `rivers_bounty`
  was the only ability worth casting. `BLIGHT_FLOOR_FRACTION` removes the cliff (a held land
  seeps), and `DAHAN_CONCENTRATION_CAP` makes a stack's lifetime linear in its size. Both
  constants are under playtest, and `dahan_reinforcement` and `rivers_bounty` still have not
  been repriced against them. See
  [04-economy-formulas.md](./04-economy-formulas.md#dahan-casualty-formula).
- **First Blight lands anywhere between 33 and 74 seconds**, depending on whether the early
  Discover draws hit the two lands `roundStartDahan` leaves empty. The variance is the terrain
  draw rather than the rates, but it means two players' first rounds can read very differently.

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
