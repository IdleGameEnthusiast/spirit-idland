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
  shortens that interval or pulls a wave forward — the pacing controls added later (Task P1)
  stop the clock, they never skip ahead on it.
- The tick cap (`MAX_TICK_SECONDS = 5 * TIME_SCALE`) sits below one wave interval, so a
  machine waking from sleep resolves no waves at all rather than a burst. Asserted. It is
  written against the dial so it stays half an interval whatever the game's pace.
- Covered by `tests/wave.test.js`.

### Task R3: Automatic Dahan Strike — *done, reworked in Task C1*

- The `ravageCounter` targeting queue is gone with no successor object. The pool is computed
  and spent inside the same step, highest tier first, one damage at a time.
- Originally the survivors' counterattack at the end of a Ravage; now a periodic strike on
  its own timer. The spending rule is unchanged.
- Covered by `tests/combat.test.js`.

### Task R4: Blight — *done, reworked in Task C1*

- Clamped at the threshold, round ends the instant it is reached.
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

- Runnable in a browser (`tests.html`), headlessly (`tests\headless.ps1`), or under node if
  it is installed (`tests/run.js`).
- The engine takes its clock and RNG by injection, which is what makes a suite that plays
  dozens of rounds deterministic and instant.
- The board's original 62 checks were re-derived rather than trusted, per
  [09-island-board.md](../spec/09-island-board.md#verification).

---

## Continuous Combat Redesign — Complete

### Task C1: Replace the Ravage phase with a continuous fight — *done*

The `4.0.0` rework. Damage is no longer an event on a named terrain; it is a rate in every
land at once.

- **Blight** accrues per land at `net * BLIGHT_PER_DAMAGE_SECOND` per second, where `net` is
  gross invader damage minus 2 per Dahan standing there. A filled bar carries its remainder.
- **Dahan casualties** accrue per land at `(gross / dahanCount) * DAHAN_LOSS_PER_DAMAGE_SECOND`
  — gross, not net, and concentrated on the survivors so an under-defended land collapses
  rather than declining evenly.
- **The Dahan strike** moved onto `DAHAN_ATTACK_INTERVAL_SECONDS`, a constant of its own,
  dealing `DAHAN_ATTACK_DAMAGE` per Dahan. It starts equal to the wave interval by choice,
  not by derivation.
- **The invader track lost a slot.** `invader.ravage` is gone; a wave is Build, Discover,
  shift, and deals no damage.
- **Two new per-land floats**, `round.blightProgress` and `round.dahanProgress`, are the only
  fractional board state. They are deliberately excluded from the board's rebuild signature
  and patched in place, or the board would rebuild ten times a second.
- Covered by `tests/combat.test.js`; `tests/wave.test.js` and `tests/blight.test.js` were
  rewritten around it, and `tests/ravage.test.js` is deleted.

---

## Pacing Controls — Complete

### Task P1: Player-set speed, and a wave the player calls — *done*

Two settings over one thing: how fast the round reaches the player. Neither changes what the
round costs; both are spelled out in [02-core-loop.md](../spec/02-core-loop.md#pacing).

- **The speed dial** (`ui.gameSpeed`, one of `GAME_SPEEDS = [0, 1, 2]`, default `1`) is how
  many game seconds one real second buys: `1x` ships the twenty-second wave, `2x` halves it,
  `0x` stops the clock. It is a single multiplier on `dt` inside `tick()`, so nothing
  downstream of the tick knows a speed exists, and no constant is scaled twice.
- **The wave gate** (`ui.autoProceed`, off by default, and `round.awaitingWave`) stops every
  clock in the round at the end of a wave timer until the player calls the wave. A round also
  opens on a held gate, with the timer still full, so the opening call starts the clock
  without costing a wave; leaving the shop is itself that call.
- **Countdowns are drawn in real seconds** at the current speed — wave, Dahan strike, and
  every ability cooldown — or two clocks that run together stop reading as one.
- Both settings persist and survive a migration reset, like the language toggle.
- Covered by `tests/pacing.test.js`; `tests/harness.js` opts its fixture into auto-proceed,
  since every older suite is written against a clock that simply runs.

---

## What To Build Next

Ordered by what most changes the game. The first item is the one that matters.

### 1. Balance: settle the casualty rate

`DAHAN_LOSS_PER_DAMAGE_SECOND` was raised from 0.02 to 0.05 a beat during Task C1 and is
explicitly under playtest. (It reads `0.05 / TIME_SCALE` in the source; retune the beat rate,
not the quotient.) At 0.02 no Dahan ever died and the whole casualty system was dead code; at
0.05 a round costs 2-4 of the starting 6, which is what puts the death spiral on screen. That
is one measurement, not a tuned number — play it and see whether losing Dahan feels like
something the player can act against or just weather.

### 2. Balance: are Dahan too strong once they survive? (braked, needs playtest)

Casualty damage divided by the stack size gave a stack quadratic lifetime, and defence
cancelling Blight outright gave it a hard cliff to zero. Together, one fortified land beat six
defended ones and `rivers_bounty` was the only ability worth casting.

Two brakes are in, both in `landPressure`:

- `BLIGHT_FLOOR_FRACTION = 0.25` — a held land seeps a quarter of its gross instead of sitting
  at zero. Defence buys time, not immunity.
- `DAHAN_CONCENTRATION_CAP = 2` — concentration stops past two survivors, so a stack's
  lifetime is linear in its size rather than quadratic.

Both numbers are guesses. What to watch: whether holding a land still feels worth doing at all
(if not, the floor is too high), and whether `rivers_bounty` is now merely one option among
five rather than useless. `dahan_reinforcement` and `rivers_bounty` still have not been
repriced against the brakes — and `rivers_bounty` has since changed from a gather to a
creation, and then again to an ability that never fails at all (it falls back to the thinnest
land on the board when nothing is contested), which strengthens it twice over without any of
this having been re-measured.

### 3. Balance: the first Blight arrives on a wide spread

33 beats in one traced round, 74 in another, depending on whether the early Discover draws on
`3` and `8` — the two lands `roundStartDahan` leaves empty. The rates are not the variance;
the terrain draw is. Two players' first rounds can therefore read very differently, which is
the worst place for that to happen.

Partly addressed since: the opening Discover puts invaders ashore at second zero rather than
at wave 1, which removes the free first interval and the spread that came with it, and the
Blight floor means even a defended landing site contributes. Whether the remaining spread is
acceptable needs a fresh trace — the measured numbers in
[04-economy-formulas.md](../spec/04-economy-formulas.md#measured-behaviour) predate all of it.

### 4. Balance: the shop's first purchase

`dahan_reinforcement` costs 4 Fear against 1.05-1.75 earned per unattended round, so roughly
three rounds for the first tier. Whether that is the right pace depends on item 2 — a tier
that buys both defence and survival time may be worth more than three rounds even so.

### 5. A fifth ability, so `unlock_` has content

The unlock path is built and untested against real content. One new ability — something that
removes invaders from a land outright, since that is the lever the player actually has —
would exercise it and give the shop a non-numeric reward.

### 6. Invaders that scale with the player — *the next real feature*

Energy income is flat within a round while the kit's prices are not: the ladder tops out at
250 and a round earns roughly 20-40, so a long round has nothing left to spend on but time.
The intended answer is invaders that grow stronger as the player does, which turns a long
round into more income rather than only more waves. Nothing of it is implemented.

Until it exists, the Innate's third tier is effectively unreachable and `blight_resilience`
is the only thing that moves it — which is a progression gate by accident rather than design.

### 7. Keyboard shortcuts for the ability bar

Real-time and mouse-only is a bad combination. Digits 1-5 mapped to the bar, Escape to
cancel an armed ability. Small, and it changes how the round feels to play.

### 8. Make the click wiring a standing test

The arm / dim / illegal-click / legal-click / cancel path was verified end to end in a
headless browser, but as a throwaway probe. It should be a test file that builds the DOM it
needs, so a refactor of `ui.js` cannot break targeting silently. The per-land bars want the
same treatment: nothing currently asserts that they patch in place rather than rebuilding.

### 9. Price the Energy economy

**Answered, not tuned.** Energy has a writer (1 per point of defeated invader power) and five
readers: the unlock ladder at 5 / 10 / 20 and the Innate's tiers at 50 / 250. It is also
round-local now, so every one of those prices has to be payable inside a single round.

None of it has been checked against a played round. The ladder is shaped against an estimate —
20 to 40 Energy over 60 to 120 beats — not a measurement, so "the three unlocks are about one
early round's income" is an assertion rather than a finding. Measure a round's actual income
first; item 6 will move the number before any of it can be called tuned.

Related and unmeasured: the kill-first damage rule made the Dahan strike meaningfully stronger
across every land at once, which moves income and round length together.

### 10. Accessibility pass

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
  abilities with redesigned effects. The Innate Power, added later, has no card ancestor —
  it is the one entry in the kit that grows through tiers rather than being bought once.

### Task 05: Invader Phase Track — *partly reused; Ravage retired in Task C1*

- The Build/Discover rules and the terrain track reused directly; their trigger changed from
  a click to a timer in Task R2. The Ravage phase was removed entirely in Task C1.

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

### Task 11: Ravage Resolution — *retired by Task C1*

- The per-Ravage combat math survived Task R3 (only who assigned the counterattack changed)
  but not Task C1. Whole-point damage on a schedule has no successor: damage is a rate now,
  and the only thing carried over is how a damage pool is spent on invader types.

### Task 12: Automated Regression Harness — *superseded by Task R9*

### Task 13: Blight — *superseded by Task R4*

- The turn-based framing ("Blight slows Essence generation") is superseded: Blight is now the
  round's sole loss condition.

### Task 14: Presence Tracks — *retired*

- No equivalent in the round-based design; Task R7's permanent upgrade shop replaced it.

### Task 15: The Island Board — *reused*

- The eight-land board, adjacency, SVG rendering, and terrain colour rules all carried
  forward unchanged; see [09-island-board.md](../spec/09-island-board.md).
