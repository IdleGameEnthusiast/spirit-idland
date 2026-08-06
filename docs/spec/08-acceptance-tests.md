# 08 Acceptance and Tests

## Intent

Define the regression checks for the round-based redesign, and say how to run them.

## Rules

- Each shipped mechanic must have at least one concrete verification step.
- Save/load and state normalization remain mandatory regression checks.
- This checklist targets the round-based design; the retired turn-based checklist is
  superseded, not merged with this one.

## Running The Suite

The checks below are automated. There is no build step and no package manager, for the same
reason the game has neither: a browser is the one runtime this project is guaranteed to
have.

```txt
open tests.html                                     in any browser
powershell -File tests\headless.ps1                 headless Edge or Chrome, exits 1 on failure
node tests/run.js [name-filter]                     if node happens to be installed
```

`tests/harness.js` injects the engine's clock and RNG, which is why a suite that plays
dozens of whole rounds finishes in milliseconds and produces the same board every run. Test
files are listed by hand in `tests.html`; adding one means adding a `<script>` line.

## Round Setup Checks

1. A fresh round starts with `round.status = "running"`, `round.blight = 0`,
   `round.elapsedSeconds = 0`, and every ability's `cooldownRemaining` at 0.
2. Round setup seeds Dahan per `roundStartDahan` plus every purchased `dahan_reinforcement`
   tier — none are dropped, however many are bought.
3. However deep reinforcement is bought, no two lands end round setup more than
   `DAHAN_MAX_SPREAD` Dahan apart: no land reaches 3 while another is still empty.
4. Round setup seeds `round.blightThreshold` from `BLIGHT_THRESHOLD_BASE` plus any purchased
   `blight_resilience` tiers.
5. Round setup clears `invaders` and `invaderDamage` to zero everywhere and resets the
   invader track, then runs the opening Discover: at least one land holds an explorer at
   second zero, every seeded land is of the terrain now in the Build slot, and nothing but
   explorers stands on the board.
6. The opening Discover is not a wave: `wavesResolved` is 0, `waveTimerRemaining` is a full
   `WAVE_INTERVAL_SECONDS`, and no Blight has accrued.
7. The opening Discover never draws a terrain it cannot seed — over many rounds it never
   draws mountains, and it never seeds nothing.
8. A second round after purchasing an upgrade starts stronger than the first, without
   re-purchasing anything.

## Wave Timing Checks

1. With no player input, a wave resolves automatically after `WAVE_INTERVAL_SECONDS`.
2. A resolved wave runs Build, then Discover, then shifts the invader track, in that fixed
   order.
3. A wave deals no damage of its own: no Dahan lost, no Blight gained, from the wave itself.
4. The invader track has two slots; `invader.ravage` does not exist.
5. `round.wavesResolved` increments exactly once per wave.
6. The wave timer cannot be paused, skipped, or manually triggered by any control.

## Blight Checks

1. `round.blightByLand` sums to `round.blight` at all times.
2. `round.blight` never decreases within a round.
3. The instant `round.blight` reaches `round.blightThreshold`, the round ends and nothing
   further resolves — no wave, and no more Blight.
4. A round always ends by itself, with no player input, in a plausible span of time.

## Combat Checks

The fight is continuous. Every check here is about a *rate*, because the rates are the design.

1. A land's gross damage is the sum of explorer 1, town 2, city 3, per second.
2. An undefended land holding one of each (6 damage) takes its first Blight after `1 / 0.12`
   seconds, and takes exactly one — not a burst.
3. Each Dahan cancels 2 damage before any Blight accrues; 6 gross against 2 Dahan is 2 net.
4. A land whose Dahan defence meets or exceeds its gross damage is `held`, and still seeps
   `BLIGHT_FLOOR_FRACTION` of its gross: it takes no Blight quickly, but it does take one.
   The seepage scales with gross, so a held land under heavier invaders blights sooner.
5. A land with no invaders never blights and never loses a Dahan.
6. A filled Blight bar carries its remainder rather than resetting to zero.
7. Blight accrues in every land at once, with no terrain selected.
8. Dahan take gross damage, not net: a held land still loses defenders.
9. Damage concentrates on the survivors — the second casualty in a two-Dahan land arrives in
   half the time the first did.
10. Concentration stops at `DAHAN_CONCENTRATION_CAP`: a stack well past the cap loses Dahan
    at the same rate as one at it, so doubling a stack does not quadruple its lifetime.
11. Losing a Dahan raises that land's Blight rate immediately.
12. A land's casualty bar clears when its last Dahan falls.
13. The Dahan strike runs on `DAHAN_ATTACK_INTERVAL_SECONDS`, a constant of its own, and is
    armed at round start.
14. Each Dahan deals `DAHAN_ATTACK_DAMAGE` per strike, spent on the highest-tier invader type
    present first (cities, then towns, then explorers) until it or the invaders run out.
15. A land with no Dahan never strikes; a land with no invaders is skipped.
16. Invaders defeated by a strike award Fear per the defeat formula.
17. Partial damage on an invader persists across waves within a round.

## Ability Checks

1. An ability is usable only when its `cooldownRemaining` is 0.
2. Triggering an ability applies its effect immediately and sets `cooldownRemaining` to its
   full cooldown.
3. Cooldowns tick down continuously and independently of the wave timer.
4. An ability that needs a land sets `pendingAbilityTarget` and applies its effect only once
   a legal land is clicked.
5. Clicking an armed ability's own control again cancels the pending target without spending
   the cooldown.
6. An ability that needs no land applies immediately on trigger with no `pendingAbilityTarget`
   change.

## Fear and Shop Checks

1. Fear earned during a round is present in `meta.fear` when the round ends, whether the
   round was "won" (it wasn't — see below) or lost.
2. A round only ever ends by Blight reaching its threshold; there is no other end condition
   to test.
3. `meta.fear` is spendable only while `round.status = "ended"`.
4. Purchasing an upgrade increments its tier in `upgrades.purchased` and deducts its cost
   from `meta.fear`; an insufficient-Fear purchase is refused.
5. Starting the next round is available immediately once in the shop, regardless of
   remaining Fear.
6. `meta.totalRoundsPlayed` increments once per round ended.
7. `meta.bestRoundReached` updates only when the ended round's number exceeds it, and never
   decreases.

## Save and Migration Checks

1. Save and reload preserve `meta`, `upgrades.purchased`, round state, board state, and any
   pending ability target.
2. Save and reload resume a running round exactly as saved, crediting no elapsed wall-clock
   time toward the wave timer or ability cooldowns.
3. Any save that is not the current `schemaVersion` loads via the hard-reset migration path,
   starts `meta.fear` at 0, and logs a notice explaining the reset.
4. Invalid `round.status` values normalize to `running` instead of corrupting the UI.
5. An unknown `pendingAbilityTarget` id normalizes to `null`.

## UI Checks

1. The Blight meter, wave timer, and Dahan strike timer are visible without opening any panel,
   at all times while a round is running.
2. Every ability's state (ready, on cooldown with remaining time, or armed) is visible
   without hovering.
3. A land under a legal ability target renders distinctly from a land that isn't.
4. The shop appears the instant `round.status` becomes `ended`, with no extra
   acknowledge-the-loss click required.
5. Defeat feedback appears briefly and then disappears.
6. Values that change every second (wave timer, strike timer, cooldowns, Blight) patch in
   place without rebuilding the board.
7. The per-land bars are excluded from the board's rebuild signature, so they patch in place
   every tick rather than rebuilding the board ten times a second.
8. The board always shows eight lands, three of them coastal, two per terrain (unchanged
   from the turn-based build; see [09-island-board.md](./09-island-board.md)).

## Current Validation Status

**115 automated checks, all passing.** Coverage by file:

| File | Covers |
| --- | --- |
| `tests/board.test.js` | Board invariants and adjacency (09) |
| `tests/setup.test.js` | Round setup, upgrade baseline, round reset |
| `tests/wave.test.js` | Wave timing, Build, Discover, track shift, the tick cap |
| `tests/combat.test.js` | Blight and casualty rates, concentration, the Dahan strike |
| `tests/blight.test.js` | Blight accrual, the per-land tally, round end |
| `tests/ability.test.js` | Cooldowns, arming, cancelling, each ability's effect |
| `tests/shop.test.js` | Fear persistence, purchases, tiers, next round |
| `tests/save.test.js` | Round-trip, no offline credit, migration, normalization |
| `tests/landstate.test.js` | Land state precedence (06) |

Not automated, and verified by hand instead:

- Rendering itself — that the island draws, that chips sit on their lands, that colours are
  tellable apart. Screenshots via headless Edge, not assertions.
- The click wiring was verified end to end by driving the real controls in a headless
  browser (arm, dim, illegal click, legal click, cancel), but that probe was not kept as a
  standing test; it needs a DOM the harness does not currently build.

## Acceptance

- A contributor can verify every shipped round-loop mechanic from this file. ✓
- The tests reflect the round-based design, not the retired turn-based prototype. ✓
- New mechanic work should extend this checklist before expanding scope.
