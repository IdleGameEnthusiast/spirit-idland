# Spirit Idland Implementation Microtasks

This pack pivoted from a turn-based, presence-driven prototype to a round-based, real-time
survival loop (see [docs/spec/index.md](../spec/index.md)). **That pivot is done.** The
turn-based `app.js` is deleted; the build is `engine.js` (rules, no DOM) plus `ui.js` (DOM,
no rules), with a regression suite in `tests/`.

What remains is balance and content, not structure — see
[What To Build Next](#what-to-build-next).

## Round-Based Redesign — Complete

### Task R1: Round State Model & Reset — *done*

- Landed the `3.0.0` shape: `meta`, `round`, `abilities`, `pendingAbilityTarget`,
  `upgrades.purchased`, and the hard-reset migration from `2.0.0`.
- Four fields were added beyond the original contract, each documented with its reason in
  [03-state-contract.md](../spec/03-state-contract.md#fields-added-during-implementation):
  `round.blightByLand`, `round.fearEarned`, `round.abilityCooldownMult`, `ui.blightFx`.
- Covered by `tests/save.test.js` and `tests/setup.test.js`.

### Task R2: Automatic Wave Resolution — *done*

- `tick()` drives the wave timer; at 0 a full wave resolves and the timer resets. No control
  anywhere can pause, skip or trigger one.
- The tick cap (`MAX_TICK_SECONDS = 5`) sits below one wave interval, so a machine waking
  from sleep resolves no waves at all rather than a burst. Asserted.
- Covered by `tests/wave.test.js`.

### Task R3: Automatic Dahan Counterattack — *done*

- The `ravageCounter` targeting queue is gone with no successor object. The pool is computed
  and spent inside the same step, highest tier first, one damage at a time.
- Covered by `tests/ravage.test.js`.

### Task R4: Blight — *done*

- Gain per Ravaged land, the undefended bonus on top, clamped at the threshold, round ends
  the instant it is reached.
- The per-land tally added here is what makes `wash_away` targetable and what puts "which
  land just cost me the round" on the board.
- Covered by `tests/blight.test.js`.

### Task R5: Fear as Persistent Meta-Currency — *done*

- `meta.fear` survives round end and round setup; `round.fearEarned` tracks the round's own
  income for the shop's summary line.
- The Fear formula is `power * 0.35`, which is **not** what the turn-based build did — see
  the note in [04-economy-formulas.md](../spec/04-economy-formulas.md#fear-formula).
- Covered by `tests/shop.test.js`.

### Task R6: Ability Bar — *done*

- Four cooldown-gated abilities, single-click targeting, cancel-by-reclick, and the
  no-legal-target rule that leaves the cooldown unspent.
- Three tie-breaks the one-click model forced are documented in
  [04-economy-formulas.md](../spec/04-economy-formulas.md#tie-breaks-the-one-click-model-forced).
- Covered by `tests/ability.test.js`. **The numbers are still placeholder.**

### Task R7: Upgrade Shop — *done*

- Three repeatable upgrades with a `1.6^tier` cost curve, applied at round setup, surviving
  any number of further rounds. Starting the next round is never blocked.
- `unlock_<ability_id>` machinery works but has nothing to unlock yet.
- Covered by `tests/shop.test.js` and `tests/setup.test.js`.

### Task R8: UI Retrofit — *done*

- Presence tracks, growth options, card hand and the essence rail are gone from the markup,
  the stylesheet and the state.
- Added: the round HUD with a live Blight meter and wave timer, the ability bar with
  per-ability cooldown sweep, the between-round shop, per-land Blight on the board, and
  blight-gain feedback at the moment it happens.
- Live values patch in place; the board rebuilds only when its own signature changes.

### Task R9: Regression Harness — *done*

- 109 checks across nine files, runnable in a browser (`tests.html`), headlessly
  (`tests\headless.ps1`), or under node if it is installed (`tests/run.js`).
- The engine takes its clock and RNG by injection, which is what makes a suite that plays
  dozens of rounds deterministic and instant.
- The board's original 62 checks were re-derived rather than trusted, per
  [09-island-board.md](../spec/09-island-board.md#verification).

---

## What To Build Next

Ordered by what most changes the game. The first item is the one that matters.

### 1. Balance: make an unattended round earn something *(bug-shaped)*

An idle round currently earns **zero** Fear. One Dahan has 2 health; a land that is Ravaged
holds 3+ damage worth of invaders by then, so the Dahan die before they can counterattack —
reliably, in every land, every round. Fear only ever comes from abilities.

The meta loop technically works, but a player who does not act buys nothing, and the first
round is exactly when they do not yet know what to do. Options, cheapest first:

- Raise `roundStartDahan` to 2 in the coastal lands, so the first Ravage leaves a survivor.
- Lower the wave interval's ramp so the third wave hits with fewer units.
- Award a little Fear per wave survived, decoupling the meta loop from combat entirely.

The first is the smallest change and the most in keeping with Dahan being the point.

### 2. Balance: round length

Eight waves, about 64 seconds. Long enough to demonstrate the loop, short enough that the
shop arrives before the board is readable. Try `BLIGHT_THRESHOLD_BASE` at 14-16 and see
whether the round becomes legible or merely longer.

### 3. Balance: the shop's first purchase

`dahan_reinforcement` costs 4 Fear, which is a bit under six defeated explorers. Whether
that is one round's work or four is unknown until item 1 is fixed, because right now it is
infinite.

### 4. A fifth ability, so `unlock_` has content

The unlock path is built and untested against real content. One new ability — something that
removes invaders from a land outright, since that is the lever the player actually has —
would exercise it and give the shop a non-numeric reward.

### 5. `wash_away` is dead for the first two waves

It needs a Blighted land, and nothing is Blighted until the third wave. An ability that
cannot be used at the moment the player first reads the bar teaches the wrong thing about
the bar. Either give it an early-game fallback target or move it behind an unlock.

### 6. Keyboard shortcuts for the ability bar

Real-time and mouse-only is a bad combination. Digits 1-4 mapped to the bar, Escape to
cancel an armed ability. Small, and it changes how the round feels to play.

### 7. Make the click wiring a standing test

The arm / dim / illegal-click / legal-click / cancel path was verified end to end in a
headless browser, but as a throwaway probe. It should be a test file that builds the DOM it
needs, so a refactor of `ui.js` cannot break targeting silently.

### 8. Answer the Energy question

`resources.energy` is parked in the schema with no reader or writer. Either give abilities a
resource cost and something that feeds it, or delete the field. Leaving it is the only
option that costs something every time someone reads the state contract.

### 9. Accessibility pass

The board is focusable and activates on Enter and Space, but the ability bar has no live
region, the log is not announced, and the HUD's meters carry no text alternative beyond
their own numbers. Worth doing before the UI grows further.

---

## Retired Foundation

These describe the turn-based prototype's build history, kept for provenance. Board geometry,
unit stats, and damage math (marked *reused*) carried forward into the round-based build;
presence, growth, and card-specific work (marked *retired*) did not. The code they describe
was deleted with `app.js`; it remains in git history.

### Task 01: Canonical State Model — *retired, superseded by Task R1*

- Was complete for the turn-based `2.0.0` shape: schema versioning, normalization,
  migration-safe defaults, local save structure.

### Task 02: Save and Load — *reused*

- localStorage save/load with no time-based or offline progress. The no-offline-catchup
  pattern carried forward to round time; see
  [04-economy-formulas.md](../spec/04-economy-formulas.md#offline-handling).

### Task 03: UI Shell and Four-Terrain Map — *reused (superseded layout, same board)*

- The eight-land board itself (Task 15) is what carried forward.

### Task 04: Starter River Cards — *retired, superseded by Task R6*

- Boon of Vigor, Flash Floods, River's Bounty and Wash Away carried forward by name only, as
  abilities with redesigned effects.

### Task 05: Invader Phase Track — *reused, retrigger landed in Task R2*

- The Ravage/Build/Discover rules and the terrain track reused directly; only the trigger
  changed, from a click to a timer.

### Task 06: Dahan Layer — *reused*

- Per-land Dahan counts carried forward. The setup distribution is now the spirit's fixed
  `roundStartDahan` map rather than a random spread, so a round setup can be asserted.

### Task 07: Targeting Locks — *retired*

- The turn-based growth-first / pending-effect lock model has no equivalent: nothing in a
  round blocks on player input.

### Task 08: Damage and Defeat Feedback — *reused*

- Unit HP model, partial damage carry, and fear-from-defeat all carried forward. The Fear
  *rate* changed; see Task R5.

### Task 09 / 09b / 09c: Presence, Power Gain, Essence — *retired*

- Presence placement and per-land Essence generation are gone. Essence's four terrain pools
  stay in the schema as inert placeholders; `essenceProgress` was dropped entirely.

### Task 10: Fear Threshold Effects — *superseded by Task R5*

- Superseded by Fear becoming the shop's currency outright, which is a stronger payoff than a
  threshold effect would have been.

### Task 11: Ravage Resolution — *reused, auto-counterattack landed in Task R3*

- The combat math reused directly; only who assigns the counterattack changed.

### Task 12: Automated Regression Harness — *superseded by Task R9*

### Task 13: Blight — *superseded by Task R4*

- The turn-based framing ("Blight slows Essence generation") is superseded: Blight is now the
  round's sole loss condition.

### Task 14: Presence Tracks — *retired*

- No equivalent in the round-based design; Task R7's permanent upgrade shop replaced it.

### Task 15: The Island Board — *reused*

- The eight-land board, adjacency, SVG rendering, and terrain colour rules all carried
  forward unchanged; see [09-island-board.md](../spec/09-island-board.md).
