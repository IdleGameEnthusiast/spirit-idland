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

## Playtest Checks

The redeem code and the tools it switches on, in `tests/playtest.test.js`. The tools are
outside the game's economy entirely, so what these assert is the boundary: that nothing is
handed out without the code, and that everything the code added can be taken back.

1. A fresh game has no playtest tools, and the code switches them on however it is typed —
   the comparison trims and lowercases.
2. Redeeming a code already redeemed says so rather than silently doing nothing again; an
   unknown code, and an empty one, change nothing at all.
3. `8x` is off the dial until the code is redeemed: `setGameSpeed` refuses it and the current
   speed stands. With the code, it is offered, and the round really does resolve a wave in an
   eighth of the interval.
4. Hiding the tools takes `8x` with it — the speed snaps back to `DEFAULT_GAME_SPEED` and is
   refused again — while a normal speed the player chose is left where it is.
5. Both grants refuse while the tools are off, leaving purse and bank untouched. With the
   tools on they hand out `PLAYTEST_GRANT` each and stack; the Fear grant lands in `meta.fear`
   and never in `round.fearEarned`.
6. Through a save: the code and the speed it enabled load together. A save at `8x` **without**
   the code loads at `DEFAULT_GAME_SPEED`, and a migration reset carries the code — and only
   then the speed.

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
18. With no open ground left, the push stacks onto an adjacent land that already holds
    invaders, ranked the same way. A push never fails for want of a destination.
19. Each pushed unit carries its own wound with it, exactly.
20. A land with nothing pushable is not a legal push target; nothing else disqualifies one.

### Wash Away

21. Inland it pushes up to 3 by the rules above.
22. From a coastal land it instead carries up to 2 explorers/towns out to sea, removing them
    from the island: they arrive nowhere, and no neighbour is touched.
23. A drowning pays Fear and Energy exactly as a defeat of the same unit does.
24. It takes the **healthiest** unit of its type, leaving the wounded standing.
25. Cities neither move nor drown, so a land holding only cities is not a legal target.
26. A boxed-in coastal land is a legal target — the sea is always open.

### The Innate Power

27. It opens unlocked at tier 1, free, on an 8-beat cooldown.
28. Tier 2 (16 beats) deals 2 damage and pushes up to 3; the damage still lands when there is
    nothing to push — a land holding only cities — and the cast still counts.
29. Tier 3 (24 beats) deals 2 to **each** invader individually: against 4 explorers, 2 towns and 2
    cities it clears everything but the cities and leaves both of those at 1 health.
30. Buying a tier spends its Energy, swaps the ability wholesale, and hands it back **ready**.
31. The ladder is 50 then 250, and refuses past the top.
32. Once `auto_innate` is bought, the Innate casts itself on cooldown at whichever tier is
    currently owned - tiering up never needs a second purchase - picking its own land from
    that tier's priority list. A tick where no priority is satisfied spends nothing and leaves
    the cooldown untouched, so automation is never worse than a player who simply waits for a
    good target. Like the Boon's auto-cast, it writes no log line.
33. Tier 1's list is three rungs, all of them about position because one push kills nothing:
    break a Build by pushing the lone unit that would trigger it; route an undefended unit
    into a neighbour holding Dahan; carry an inland unit onto an **open** coast, where the sea
    can reach it. The seaward rung fires only from an inland, **undefended** land — a
    coast-to-coast shove buys nothing, and pulling a unit out from under Dahan trades a kill
    already happening for one that might. Those two conditions are also what stop it undoing
    the routing rung's own work.
34. Tier 1 has no protect-the-thin-stack rung; tier 2 and `wash_away` still do. One unit does
    not lift enough pressure to save a stack, and the rung was the routing rung's mirror, so
    on an 8-beat clock against the 10-beat Dahan strike it shuttled the same unit back and
    forth across one border all round.
35. The Innate resolves **last** among the automations each tick — after the Boon, the Bounty,
    Wash Away and Flash Floods. It has the shortest cooldown and the weakest effect, so the
    casts that kill and remove choose their target on a board it has not already stirred.

### Energy and the Ability Lock

36. A fresh round has exactly its `startingAbilityIds` unlocked; the rest of the kit is locked
    and listed in kit order.
37. A locked ability cannot be triggered and holds no cooldown slot.
38. Buying one spends that ability's own `unlockCost` — 5, 10, 20 — and hands it over **ready**.
39. Too little Energy buys nothing, and an ability already owned cannot be bought twice.
40. **A new round takes back the Energy, every unlock bought with it, and every Innate tier.**
    Fear is untouched by the same reset.
41. A defeated invader pays Energy equal to its attack: explorer 1, town 2, city 3.
42. Damage that defeats nothing pays nothing, and a Dahan casualty pays nothing.

### River's Bounty

43. It resolves on the trigger itself, with no `pendingAbilityTarget`, and **creates** a Dahan
    rather than moving one — no other land loses anything.
44. It picks the land with the fewest Dahan among those holding invaders; a contested land
    beats an emptier quiet one, and ties go to the lowest land id.
45. With no invaders anywhere it still resolves, into the land with the fewest Dahan on the
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
6. Rounds ended are not counted: no `meta.totalRoundsPlayed` on a fresh game, and a save
   carrying one from an older build loses it on load.
7. `meta.bestRoundReached` updates only when the ended round's number exceeds it, and never
   decreases.
8. `auto_innate` is a one-time 100 Fear purchase, priced above `auto_boon`'s 25 because it
   automates a higher-uptime ability with a real target to pick rather than a fixed no-target
   effect; the second buy is refused once owned, same as any one-off.
9. The shop list sinks anything sold out - a maxed repeatable or a bought one-off - below
   everything still purchasable, in both directions preserving the catalogue's own order
   within each half.
10. The three ability automations are priced by what their ability does to the board rather
    than by how much clicking they save: `auto_bounty` 200 (reinforces), `auto_flash_floods`
    300 (kills with damage, which the invader health ladder erodes), `auto_wash_away` 400
    (removes outright, which it does not). All three sit under `auto_start_round`'s 500, and
    the Bounty sits under the last rung of the `dahan_reinforcement` ladder.
11. `auto_buy_abilities` (200) and `auto_start_round` (500) are refused while any other upgrade
    in the catalogue is short of its max tier, however much Fear is banked, and the refusal
    names the gate rather than the price. Handing a single ladder rung back shuts the gate
    again. Once the rest of the catalogue is finished both are for sale, and buying one does
    not lock the other.
12. `headwaters` pays its tier's Energy into every round start and nothing else: without it a
    round still opens on an empty purse, and a round that ended holding 40 Energy still opens
    the next one at the ladder's figure rather than at 40. Its gain table climbs strictly
    (1 / 2 / 3 / 5 / 8 / 13 / 19 / 26 / 35), stops at nine tiers, and ends on exactly the sum
    of the three unlock prices. Costs run 8 / 13 / 20 / 33 / 52 / 84 / 134 / 215 / 344 and the
    tenth buy is refused. A tier bought mid-round leaves the running purse where it was and
    pays out only from the next round. A tier past the end of the table clamps to its top
    rather than reading `undefined`.
13. `dahan_remember` is a pool, not a ladder. Every unit costs a flat 1 Fear at any depth, 100
    units buy 1% of haste, and the haste divides the strike interval by `1 + haste` — so a full
    10000-Fear pool halves it and no amount of haste reaches zero. The cap holds against a
    doctored save and the 10001st unit is refused. A bulk buy spends exactly what the same
    number of single clicks would have; one larger than the pool's remaining room buys only
    what is left and is charged for only that; one the purse cannot cover is refused whole
    rather than part-paid. The Max count is bounded by the purse and by the room left. The row
    does not count toward the gate — an empty pool never seals the last two purchases — and no
    soft-capped row is required for the gate either. Fear poured in mid-round leaves the
    running round striking at its old rate and speeds up the next one. The row prints its haste
    to two decimals instead of a tier, quotes the strike interval in the speed dial's own
    seconds, and logs a purchase as Fear in and haste out.
14. `auto_buy_abilities` spends the round's Energy on the bar each tick: the locked kit first,
    cheapest before dearest, so a purse of 15 takes the 5 and the 10 and leaves the 20; then
    one Innate rung per tick, never two, and never before the kit is bought. Bought mid-round
    it spends nothing until the next round starts, like every other automation. What it buys
    arrives ready and can be cast by an automation on the same tick.
15. **The auto-cast toggle.** Each of the five ability automations can be switched off from its
    ability card without being un-bought (`ui.autoCast`, `autoCastOwned`, `autoCastOn`,
    `setAutoCast`):
    - Switched off, the automation does not cast even with the ability unlocked, ready, and a
      legal target on the board: the board is unchanged and the cooldown untouched.
    - Switching off mid-round does not touch a cooldown already running — it drains by exactly
      the time that passed — does not undo the cast that already happened, and refunds nothing.
    - Switching back on resumes on the next ready cooldown, with no cooldown reset in either
      direction.
    - Bought mid-round, the automation is owned and its switch is on, yet nothing casts until
      the next `startRound` takes its snapshot. This is the two predicates meeting, and it is
      the check that breaks first if someone folds them into one.
    - `setAutoCast` on an ability with no automation in `AUTO_CAST_UPGRADES` is a no-op that
      returns `false` and writes nothing into the map.
    - The map holds exactly the five ability automations: not `auto_buy_abilities`, which
      automates a purchase rather than a cast, and not `auto_start_round`, which has its own
      toggle.

## Save and Migration Checks

1. Save and reload preserve `meta`, `upgrades.purchased`, round state, board state, and any
   pending ability target.
2. Save and reload resume a running round exactly as saved, crediting no elapsed wall-clock
   time toward the wave timer or ability cooldowns.
3. Any save that is not the current `schemaVersion` loads via the hard-reset migration path,
   starts `meta.fear` at 0, and logs a notice explaining the reset.
4. Invalid `round.status` values normalize to `running` instead of corrupting the UI.
5. An unknown `pendingAbilityTarget` id normalizes to `null`.
6. An exported file re-imports as the run that wrote it: board, upgrades, Fear, language and
   log, with German text intact through the encoding.
7. An imported file gets no offline credit for the time it spent on disk, exactly as a stored
   save gets none for a closed tab.
8. A file whose contents no longer match its checksum is refused with reason `checksum`; junk,
   truncation, a missing magic word and a bare JSON save are refused with reason `format`.
   No refusal alters the run in progress.
9. A file from an older `schemaVersion` imports as `reset`, naming the version it came from, so
   the UI can ask before starting a fresh game rather than silently doing so.
10. A save with no `ui.autoCast` at all loads with all five automations **on**. Absent means
    "this save predates the field", never "the player turned it off".
11. `ui.autoCast` is rebuilt from the registry rather than merged over it: a key naming an
    ability the build does not carry is dropped, a `false` for a known id survives, and the
    loaded map holds exactly the registry's five ids.
12. A migration reset leaves the fresh state's five `ui.autoCast` defaults standing. Unlike the
    language beside it, the preference is not carried through — the reset takes every purchase
    with it, so no switch would exist to carry one for.

### Older save files keep working

Checks 1-12 above all run a save the current engine wrote. These run one an *earlier build*
wrote — `tests/fixtures/save-5.0.0-pre-autocast.js`, captured rather than generated, from
before the auto-cast toggle existed. The rule they enforce is in
[03-state-contract.md](./03-state-contract.md#older-save-files-keep-working).

13. A save from an earlier build of the current `schemaVersion` loads with `reset: false`. It
    is not wiped, and it comes back stamped as the current version.
14. It keeps what the player earned: `meta.fear` and `meta.bestWaveReached` both survive.
15. It keeps every purchase, including a laddered tier, and the round's frozen `upgradeTiers`
    snapshot agrees with `upgrades.purchased`.
16. It keeps the preferences it carries — language, auto-proceed, auto-start-round.
17. **Every `ui` field added since the file was written loads at its fresh default.** Asserted
    against `createInitialState()`'s own keys rather than a list, so the check covers the next
    field the moment that function writes it and needs no editing to do so.
18. In particular, the five `ui.autoCast` toggles all load **on** for a file that predates them.
19. The loaded save is **playable**, not merely loadable: it starts a round, resolves a wave,
    and stays running. A save that comes back in a shape `tick` throws on is not compatible,
    and check 13 alone would not notice.
20. It survives the disk path the player actually uses: exported and re-imported, it is still
    not reset and the Fear is still there.
21. A save from a **genuinely** older schema still resets, and still names the version it came
    from. Compatibility is not "never reset" but "reset only when the shape really changed",
    and a suite proving only the first half would pass on an engine that had stopped resetting
    anything at all.

## UI Checks

1. The Blight meter, wave timer, and Dahan strike timer are visible without opening any panel,
   at all times while a round is running.
2. Every ability's state (locked with its price, ready, on cooldown with remaining time, or
   armed) is visible without hovering.
2b. The Energy purse is visible in the ability panel, and a locked ability reads as
   affordable or not without the player comparing two numbers by hand.
3. A land under a legal ability target renders distinctly from a land that isn't.
4. The shop is on screen throughout, and turns over to the between-round summary the instant
   `round.status` becomes `ended`, with no extra acknowledge-the-loss click required.
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

**392 automated checks, all passing.** Coverage by file:

| File | Covers |
| --- | --- |
| `tests/board.test.js` | Board invariants and adjacency (09) |
| `tests/setup.test.js` | Round setup, upgrade baseline, round reset |
| `tests/wave.test.js` | Wave timing, Build, Discover, track shift, the tick cap |
| `tests/pacing.test.js` | The speed dial and the wave gate (02 Pacing) |
| `tests/playtest.test.js` | The redeem code and the playtest tools (06 Playtest Tools) |
| `tests/ladder.test.js` | The difficulty ladder as the waves climb, and the readout the track prints |
| `tests/automation.test.js` | The bought automations, their target picks, and the auto-cast toggle |
| `tests/combat.test.js` | Blight and casualty rates, concentration, the Dahan strike |
| `tests/blight.test.js` | Blight accrual, the per-land tally, round end |
| `tests/ability.test.js` | Cooldowns, arming, cancelling, each ability's effect |
| `tests/shop.test.js` | Fear persistence, purchases, tiers, next round |
| `tests/fear.test.js` | The three Fear ladders, the locale tables, the gate |
| `tests/haste.test.js` | The Dahan Remember: the Fear pool and the strike clock |
| `tests/save.test.js` | Round-trip, no offline credit, migration, normalization, export/import |
| `tests/compat.test.js` | A save from an earlier build still loads, still plays, still imports |
| `tests/landstate.test.js` | Land state precedence (06) |

`tests/compat.test.js` is the only suite that reads a fixture rather than building its state
from the engine. `tests/fixtures/` holds that one file; it is not scanned by either runner, so
the browser harness loads it by an explicit `<script>` tag ahead of the suite that reads it.

Not automated, and verified by hand instead:

- Rendering itself — that the island draws, that chips sit on their lands, that colours are
  tellable apart. Screenshots via headless Edge, not assertions.
- The click wiring was verified end to end by driving the real controls in a headless
  browser (arm, dim, illegal click, legal click, cancel; for the pacing controls: the
  gate at a fresh game, the call, each speed button, the auto toggle, and the labels in both
  languages; and for export/import: the download the button produces, that same file fed back
  through the picker, a declined confirm leaving the run untouched, and an edited file and a
  junk file each refused with their own message), but those probes were not kept as standing
  tests; they need a DOM the harness does not currently build.
- The auto-cast switch on the card, for the same reason. Driven in headless Edge over the
  `?vis` fixture with two automations owned and one of them off: the three card shapes render
  as specified, the switch reads its state from `ui.autoCast` rather than from the markup, a
  click on it writes through to the state, and with `?vis&ended` the cast buttons go disabled
  while the switches stay live.
- The card's own cast surface, for the same reason: a click on the foot of a card with one —
  the tier row, the empty space beside a price — casts the ability, and the same click on a
  cooling card, a card in an ended round, or a locked card casts nothing.
- The three auto switches rendering as one control, for the same reason: the wave and
  auto-cast tracks measure the same, the round one measures half again as much and stands at
  the round button's own height, and all three paint the same in both settings — in both
  languages, since the round label's line break comes out of the locale. Checked by paint
  rather than by computed style — a headless run advances no frame clock, so a transitioned
  property read after a click still reports the value it is transitioning *from*, and both
  colour and knob position on this switch are transitioned.
- The Dahan strike bar on the chip, for the same reason. Driven in headless Edge over `?vis`:
  the bar present exactly on the lands holding Dahan **and** invaders and absent on both
  one-sided cases, the per-frame patch writing the fixture's fraction, and the axe-plus-track
  row fitting land 4 — the narrowest chip — on one line.

## Acceptance

- A contributor can verify every shipped round-loop mechanic from this file. ✓
- The tests reflect the round-based design, not the retired turn-based prototype. ✓
- New mechanic work should extend this checklist before expanding scope.
