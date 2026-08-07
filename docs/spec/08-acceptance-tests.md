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
   `round.elapsedSeconds = 0`, and every *unlocked* ability's `cooldownRemaining` at 0. The
   `abilities` map holds one slot per unlocked ability and no slot for a locked one.
2. Round setup seeds Dahan per `roundStartDahan` plus every purchased `dahan_reinforcement`
   tier — none are dropped, however many are bought.
3. However deep reinforcement is bought, no two lands end round setup more than
   `DAHAN_MAX_SPREAD` Dahan apart: no land reaches 3 while another is still empty.
4. Round setup seeds `round.blightThreshold` from `BLIGHT_THRESHOLD_BASE` plus any purchased
   `blight_resilience` tiers.
5. Round setup clears `invaders` and `invaderDamage` everywhere and resets the invader track,
   then runs the opening Discover: at least one land holds an explorer at second zero, every
   seeded land is of the terrain now in the Build slot, nothing but explorers stands on the
   board, and every one of them arrives at full health.
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
6. The wave timer cannot be skipped or pulled forward: no control resolves a wave before its
   interval has run. It can be stopped — see [Pacing Checks](#pacing-checks) — but only in
   place, never past a wave.

## Pacing Checks

The speed dial and the wave gate, in `tests/pacing.test.js`. Most of these are one assertion:
neither control may change what the round costs.

1. A fresh game runs at `1x`, where one real second buys one game second.
2. At `2x` the same wave resolves in half the real seconds, and at `0x` no clock in the round
   moves at all — not the fight, not either timer, not `elapsedSeconds`.
3. A paused round resumes exactly where it stopped when a speed is set back.
4. A speed outside `GAME_SPEEDS` is refused, leaving the previous one standing.
5. The fight costs the same damage-seconds at every speed: the same game time under the same
   invaders accrues the same Blight, however fast those seconds were handed out.
6. A fresh game holds the wave gate: no wave arrives, the wave timer never starts, and the
   round does not age.
7. The opening call starts the clock without spending a wave; the call at an empty bar
   resolves exactly one and refills the timer to a whole interval.
8. While the gate holds, the fight is frozen with it — no Blight accrues.
9. Calling a wave mid-interval does nothing: no wave is pulled forward.
10. Switching auto-proceed on releases a gate already holding, and the waiting wave resolves
    on the next tick rather than at the switch.
11. Switching it off stops the round at the next empty bar rather than immediately.
12. Leaving the shop is itself the opening call: the next round's clock runs without one.
13. Both settings survive a save with the gate they were standing at; a nonsense speed loads
    at `DEFAULT_GAME_SPEED`, and an ended round never loads behind a gate.

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
7. An ability that finds nothing to act on returns false and leaves its cooldown unspent.

### Applying Damage

The kill-first rule, shared by every ability and by the Dahan strike.

8. 2 damage into 4 explorers, 2 towns and 2 cities takes a **town** — the biggest kill it can
   afford — not two explorers and not a scratch on a city.
9. With one of those cities already at 2 health, the same 2 damage takes the **city**: a tie
   on health goes to the higher tier.
10. 1 damage into that land takes an explorer.
11. With no kill available, all of it lands on the strongest thing standing — and within a
    tier, on the one already closest to falling.
12. Damage left over after a kill carries to the next target.
13. Damage the land cannot absorb is left unspent, and pays nothing for what it did not kill.
14. Two units of one type carry their wounds independently.
15. `invaderDamage[land][type]` always holds one entry per living unit, each in
    `[0, health-1]`, sorted worst-first — after waves, strikes, pushes and abilities alike.

### Pushing

16. Towns are pushed before explorers; cities are never pushed.
17. The destination is an adjacent land holding no invaders, preferring one already holding
    Dahan, then a coastal one, and among equals the **lowest land id** — the same destination
    every time, never random.
18. Each pushed unit carries its own wound with it, exactly.
19. A land with nothing pushable, or with no empty neighbour, is not a legal push target.

### The Innate Power

20. It opens unlocked at tier 1, free, on an 8-beat cooldown.
21. Tier 2 (16 beats) deals 2 damage and pushes up to 3; the damage still lands when there is
    nowhere to push, and the cast still counts.
22. Tier 3 (24 beats) deals 2 to **each** invader individually: against 4 explorers, 2 towns and 2
    cities it clears everything but the cities and leaves both of those at 1 health.
23. Buying a tier spends its Energy, swaps the ability wholesale, and hands it back **ready**.
24. The ladder is 50 then 250, and refuses past the top.
25. Once `auto_innate` is bought, the Innate casts itself on cooldown at whichever tier is
    currently owned - tiering up never needs a second purchase - picking its own land from
    that tier's priority list. A tick where no priority is satisfied spends nothing and leaves
    the cooldown untouched, so automation is never worse than a player who simply waits for a
    good target. Like the Boon's auto-cast, it writes no log line.

### Energy and the Ability Lock

26. A fresh round has exactly its `startingAbilityIds` unlocked; the rest of the kit is locked
    and listed in kit order.
27. A locked ability cannot be triggered and holds no cooldown slot.
28. Buying one spends that ability's own `unlockCost` — 5, 10, 20 — and hands it over **ready**.
29. Too little Energy buys nothing, and an ability already owned cannot be bought twice.
30. **A new round takes back the Energy, every unlock bought with it, and every Innate tier.**
    Fear is untouched by the same reset.
31. A defeated invader pays Energy equal to its attack: explorer 1, town 2, city 3.
32. Damage that defeats nothing pays nothing, and a Dahan casualty pays nothing.

### River's Bounty

33. It resolves on the trigger itself, with no `pendingAbilityTarget`, and **creates** a Dahan
    rather than moving one — no other land loses anything.
34. It picks the land with the fewest Dahan among those holding invaders; a contested land
    beats an emptier quiet one, and ties go to the lowest land id.
35. With no invaders anywhere it still resolves, into the land with the fewest Dahan on the
    board. It is, with `boon_of_vigor`, one of the two abilities that never fail.

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
8. `auto_innate` is a one-time 100 Fear purchase, priced above `auto_boon`'s 25 because it
   automates a higher-uptime ability with a real target to pick rather than a fixed no-target
   effect; the second buy is refused once owned, same as any one-off.
9. The shop list sinks anything sold out - a maxed repeatable or a bought one-off - below
   everything still purchasable, in both directions preserving the catalogue's own order
   within each half.

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
2. Every ability's state (locked with its price, ready, on cooldown with remaining time, or
   armed) is visible without hovering.
2b. The Energy purse is visible in the ability panel, and a locked ability reads as
   affordable or not without the player comparing two numbers by hand.
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
9. Every countdown on the page is shown in real seconds at the current speed, so two clocks
   that run together read as one.
10. A stopped clock says which of the two things stopped it, and the call button is live
    exactly when the gate holds.

## Current Validation Status

**200 automated checks, all passing.** Coverage by file:

| File | Covers |
| --- | --- |
| `tests/board.test.js` | Board invariants and adjacency (09) |
| `tests/setup.test.js` | Round setup, upgrade baseline, round reset |
| `tests/wave.test.js` | Wave timing, Build, Discover, track shift, the tick cap |
| `tests/pacing.test.js` | The speed dial and the wave gate (02 Pacing) |
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
  browser (arm, dim, illegal click, legal click, cancel; and for the pacing controls: the
  gate at a fresh game, the call, each speed button, the auto toggle, and the labels in both
  languages), but those probes were not kept as standing tests; they need a DOM the harness
  does not currently build.

## Acceptance

- A contributor can verify every shipped round-loop mechanic from this file. ✓
- The tests reflect the round-based design, not the retired turn-based prototype. ✓
- New mechanic work should extend this checklist before expanding scope.
