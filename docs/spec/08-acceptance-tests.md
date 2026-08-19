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
handed out without the code, and that everything the code added can be taken back. The cycle's
Fear ledger is here too, though it is written by the economy rather than by the tools — it
exists to be read by them, and it is the one place a grant is allowed to leave a trace.

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
7. The cycle's Fear ledger counts what the bank was credited, not what the round carried in
   fractions, and adds round to round rather than resetting. Spending raises `spent` by the
   shop's own price and leaves `generated` where it is — it is a total, not a balance — while
   a refused purchase spends nothing.
8. A playtest grant lands in `granted` and never in `generated`, but is spendable all the same,
   so `generated + granted - spent` is the bank at every point.
9. The ledger round-trips a save. A save written before it existed reads its bank as generated,
   so the identity above holds across the upgrade; fractional, negative and unreadable values
   load as whole non-negative ones.
10. A save written before the ledger has its spend **rebuilt from what it owns**: every purchased
    tier priced back off the catalogue becomes `spent`, and `bank + spent` becomes `generated`,
    with the identity above still holding. The rebuild fires on the absent key only — a save
    carrying a genuine `0` is left at `0`, which is what keeps a post-ascension load from being
    handed the previous cycle's shopping — and it prices the tiers that survived normalization,
    so a doctored ladder is worth its cap and an unknown id is worth nothing.

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
17. The destination is ranked over every neighbour, one term at a time: cover first (a land
    holding Dahan, then Dahan and Defense together), then **how much** cover, then avoiding the
    Build track, then open ground, then the coast, and among equals the **lowest land id** — the
    same destination every time, never random.
18. Openness is a ranking term, not a gate: with no open ground left the push stacks onto an
    adjacent land that already holds invaders, and a defended occupied land can outrank open
    ground even when open ground exists. A push never fails for want of a destination.
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
28. Tier 2 (15 beats) deals 2 damage and pushes up to 3; the damage still lands when there is
    nothing to push — a land holding only cities — and the cast still counts.
29. Tier 3 (22 beats) deals 2 to **each** invader individually: against 4 explorers, 2 towns and 2
    cities it clears everything but the cities and leaves both of those at 1 health.
30. Buying a tier spends its Energy, swaps the ability wholesale, and hands it back **ready**.
31. The ladder is 40 then 150, and refuses past the top.
32. Once `auto_innate` is bought, the Innate casts itself on cooldown at whichever tier is
    currently owned - tiering up never needs a second purchase - picking its own land from
    that tier's priority list. A tick where no priority is satisfied spends nothing and leaves
    the cooldown untouched, so automation is never worse than a player who simply waits for a
    good target. Like the Boon's auto-cast, it writes no log line.
33. Every tier opens with the same two rungs, both asked by simulating that tier's own cast:
    **deny a Discover** its last foothold, then **break a Build**. The deny reads
    `landAcceptsExplorer` — below `EXPLORE_UNRESTRICTED_FROM_WAVE` an inland land takes
    Explorers only while a neighbour holds a Town or City — and requires the set of gated lands
    to *shrink*, so a push that closes one Discover land while opening another is declined. From
    wave 10 the rung is permanently quiet for that round. Break-a-Build now also checks the
    clock: the Dahan strike and the wave run on independent timers, so "the Dahan would clear
    this land" excuses the cast only when `dahanAttackRemaining <= waveTimerRemaining`.
34. Tier 1 continues with **route into cover**, **consolidate onto more Dahan**, then **feed the
    sea**. Routing simulates the arrival *and* the destination's next Dahan strike and fires
    only where the Dahan finish what lands; it never sources from a land its own strike is
    about to clear, which is what stops it oscillating. Consolidating requires **strictly** more
    Dahan at the destination than at the source — monotone, so a unit can never be pushed back
    where it came from, which is what replaced the old protect-the-thin-stack rung. The seaward
    rung still fires only from an inland, **undefended** land onto genuinely open coast.
34a. Tier 2 inserts **clear the land outright** above routing, and gates its Blight fallback on
    the cast actually changing the land — a land holding only Cities takes the 2 damage, keeps
    every unit and cannot be pushed, so it is no longer a target. Tier 3 alone puts
    break-a-Build **above** the deny: with no push it pays for a deny with its whole area hit on
    a 22-beat clock, to stop a seeding of the weakest unit on the board. Tier 3 ranks its
    remaining rungs by the Blight its kills actually remove, then by chip progress toward the
    next kill, then by the toughest thing standing — never by bodies present.
34b. Within every rung the tie-break is the land bleeding the most Blight, never the lowest land
    id.
34c. A push for position may stack onto a land holding **Explorers only**, but never onto one
    holding a Town or City, and never where the arrival would upgrade what the next Build
    raises — carrying a Town onto Explorers on a Build-terrain land turns that Build from a Town
    into a City. `pushDestinations` ranks cover first, then Dahan count, then avoiding the Build
    track, then open ground, then the coast: a push stays plannable off the board, and the Build
    term only ever separates landings the cover terms could not.
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
7. `meta.bestWaveReached` updates only when the ended round's `wavesResolved` exceeds it, and
   never decreases. `meta.cycleBestWave` follows the same rule and is additionally cleared by
   an ascension — see [Ascension Checks](#ascension-checks).
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
11. **No row in the catalogue is locked.** Every row, `auto_buy_abilities` (200) and
    `auto_start_round` (500) included, is buyable at its catalogue price on a fresh save with
    Fear alone and no Presence in hand — so a first cycle that saves 700 Fear can buy both and
    idle itself without ever ascending. Neither the completion gate nor the Presence unlock that
    replaced it exists any more.
11a. **A granted automation is owned outright and cannot be bought again.** With
    `presence_all_unbidden` owned, all five ability auto-casts read tier 1 through
    `upgradeTier`, `upgradeGrantedForever` is true of each, the shop refuses them as maxed, no
    Fear changes hands, and nothing is written to `upgrades.purchased`. Each grant reaches only
    the rows it names: `presence_tide_returns` leaves the other six automations at 0. A Fear
    purchase and a grant of the same row never stack past tier 1.
12. `headwaters` pays its tier's Energy into every round start and nothing else: without it a
    round still opens on an empty purse, and a round that ended holding 40 Energy still opens
    the next one at the ladder's figure rather than at 40. Its gain table climbs strictly
    (1 / 2 / 3 / 5 / 8 / 13 / 19 / 26 / 35), stops at nine tiers, and ends on exactly the sum
    of the three unlock prices. Costs run 8 / 13 / 20 / 33 / 52 / 84 / 134 / 215 / 344 and the
    tenth buy is refused. A tier bought mid-round leaves the running purse where it was and
    pays out only from the next round. A tier past the end of the table clamps to its top
    rather than reading `undefined`.
12a. The three Fear ladders are capped at tier 10 and the eleventh buy is refused, so every row
    in the catalogue has a top and every row can reach the sold-out half. A save carrying a
    tier above 10 from the soft-capped build clamps down to 10 on load rather than being
    stranded above the ladder's end.
13. `dahan_remember` is a pool, not a ladder. Every unit costs a flat 1 Fear at any depth, 100
    units buy 1% of haste, and the haste divides the strike interval by `1 + haste` — so a full
    10000-Fear pool halves it and no amount of haste reaches zero. The cap holds against a
    doctored save and the 10001st unit is refused. A bulk buy spends exactly what the same
    number of single clicks would have; one larger than the pool's remaining room buys only
    what is left and is charged for only that; one the purse cannot cover is refused whole
    rather than part-paid. The Max count is bounded by the purse and by the room left. The pool
    stands in front of nothing: an empty one and a full one leave `auto_start_round` and
    `auto_buy_abilities` exactly as reachable, and priced the same, as each other. Fear poured in mid-round leaves the
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

## Ascension Checks

1. **The unlock.** `canAscend` is false while `ascensionPayout` is under
   `ASCENSION_UNLOCK_PRESENCE` (5, i.e. 2500 generated) however deep the save is, and false
   during a running round however much the cycle has generated. It turns true once the payout
   reaches 5 **and** the round has ended, and it is re-earned by every cycle: the Reclaim that
   clears `cycleFearGenerated` closes the door behind it, and the next cycle opens it again by
   generating 2500 of its own. Granted Fear never opens it, because the gate reads the payout.
   `ascend()` itself refuses when `canAscend` is false and changes nothing when it does.
2. **The payout.** `ascensionPayout` is `floor(sqrt(cycleFearGenerated / 100))`: 0 at 99
   generated, 1 at 100, 5 at 2500, 10 at 10000. It reads generated rather than the bank, so
   spending every Fear in the shop first pays exactly the same, and it ignores
   `cycleFearGranted` entirely — a save that generated nothing and was granted 10000 pays 0.
2a. **The gap to the next Presence.** `fearToNextPresence` is what the payout still wants:
   100 at 0 generated, 1 at 99, 300 at 100, 1100 at 2500, 2100 at 10000. It agrees with the
   payout at the boundary — generating exactly the gap pays one more Presence, one Fear less
   pays no more — and it reads generated rather than the bank, like the payout beside it.
3. **What is cleared.** After `ascend()`: `meta.fear` is 0, `upgrades.purchased` is empty, all
   four `cycle*` fields are 0, and `round.number` is 1. The round is running again from
   `startRound`, on the baseline of an empty catalogue — six Dahan, threshold 10, empty purse.
4. **What survives.** `meta.bestWaveReached` is unchanged, `meta.presence` has grown by exactly
   the payout, `meta.ascensionCount` by exactly one, `presenceUpgrades.purchased` is untouched,
   and every `ui` preference — language, speed, auto-proceed, auto-round, all five auto-cast
   switches — reads exactly what it read before.
5. **The Presence catalogue.** A row costs its price in `meta.presence` and is refused when the
   Presence purse is short; a second buy of a one-time row is refused. Buying one writes into
   `presenceUpgrades.purchased` and never into `upgrades.purchased`. Fear is not spendable on
   it and Presence is not spendable in the Fear shop.
6. **The two-key rule end to end.** With `presence_tide_returns` bought and 500 Fear banked,
   `auto_start_round` is purchasable and takes effect. Ascending then leaves the Presence row
   owned and the Fear row un-bought, so the automation is off and the row is purchasable again
   at 500 — which is the property the whole layer rests on, and the one that breaks if the wipe
   ever learns about `presenceUpgrades`.
7. **The two high scores.** A round ending at wave 60 writes 60 into both `bestWaveReached` and
   `cycleBestWave`. Ascending clears the second and not the first. A later round ending at wave
   20 raises `cycleBestWave` to 20 and leaves `bestWaveReached` at 60; neither ever decreases
   except `cycleBestWave` at an ascension.
8. **A save owning an automation keeps it and gains nothing else.** A save carrying
   `auto_start_round` or `auto_buy_abilities` in `upgrades.purchased` loads with those rows
   still owned and an *empty* Presence catalogue — no row is invented for it, and
   `upgradeGrantedForever` is false, so the next Reclaim still takes back what Fear bought. (The
   loader used to hand out the matching Presence row; there is no lock left to grandfather
   around.)
9. **One Presence row grants nothing and gates a capability instead.**
   `presence_current_quickens` carries no `grants` field; buying it flips `abilityFocusUnlocked`
   straight on rather than handing over a Fear row. It is the only row allowed to do neither —
   see [Focus Checks](#focus-checks).
10. **A grant hands over every automation it names, for no Fear at all.** 5 Presence buys
    `presence_all_unbidden`, deducting exactly 5, after which all five rows it names read tier 1
    with `upgrades.purchased` still empty and `cycleFearSpent` still 0.
11. **A granted automation survives the Reclaim that wipes the shop.** After an ascension, a row
    bought with Fear is back at tier 0 and its full price, and every granted row is still at
    tier 1 — with the ledger emptied. The new cycle's opening round reads all seven automations
    live through `activeUpgradeTier`, so it runs itself from the first tick.
12. **The grants are structurally sound.** Every id a `grants` list names is a real,
    non-repeatable Fear row with exactly one tier; no automation is granted by two rows;
    `PRESENCE_GRANT_BY_UPGRADE` agrees with the forward map and carries no strays. The three
    grant rows cost 10 Presence between them and cover all seven automations.
13. **A save carrying the seven deleted discount rows loses them and is paid back.** The dead
    ids drop from `presenceUpgrades.purchased` like any unknown row, and the Presence their
    rungs cost — priced 5 / 10 / 25 / 50 / 100 / 250 by rung, up to 515 for the full set —
    is returned to `meta.presence`. The refund is paid on the load that drops the rows and never
    again; a save that never held one is untouched. A save claiming a rung no row has any more
    clamps to 1, the same rule the Fear tiers follow.

## Focus Checks

`tests/focus.test.js`. See
[04-economy-formulas.md](../spec/04-economy-formulas.md#focus-spending-energy-mid-round-to-shorten-a-cooldown)
for the formulas these checks hold.

1. **The curve.** `abilityFocusMultiplierForPurchases(0)` is 1. The first purchase is exactly
   `* 0.95`. The rate re-derived from each step's own previous value never exceeds `0.95` above
   70% remaining, `0.97` between 50% and 70%, or `0.98` below 50%, and the multiplier never
   drops under `FOCUS_FLOOR_MULT` (0.3) however many purchases are asked for — 400 in a row
   both cross both thresholds and still land pinned at the floor.
2. **Cost anchors to what the ability already costs.** The first Focus purchase on
   `rivers_bounty`, `flash_floods` or `wash_away` costs exactly that ability's own
   `abilityUnlockCost`. `boon_of_vigor` (`unlockCost: 0`) falls back to a flat 3. `innate_power`
   (also `unlockCost: 0`) does not share that fallback — it carries its own `focusBaseCost: 25`,
   because it is the one ability that keeps growing stronger after it is bought.
3. **Cost grows 1.5x per purchase, compounding, per ability.** Buying Focus for one ability
   never moves the price on any other. Past the floor, the cost reads `Infinity` — the same
   refusal shape `abilityUpgradeCost` uses at the top of a tier ladder — and a further purchase
   spends nothing.
4. **The gate.** A purchase is refused, however much Energy is on hand, until
   `presence_current_quickens` is bought. It is further refused for an ability that is not
   unlocked this round, and between rounds — the same `round.status === "running"` rule every
   other Energy spend follows.
5. **A successful purchase** spends the quoted Energy, records one more purchase in
   `round.abilityFocus[id]`, and shortens `abilityCooldownSeconds` for that ability by exactly
   the multiplier the curve says. Made while the ability is mid-cooldown, it clamps
   `cooldownRemaining` down to the new, shorter maximum rather than leaving it stranded above
   one; made while the ability sits comfortably under the new maximum already, it changes
   nothing. It applies to the tiered Innate exactly as it does to any other ability.
6. **Reset.** `round.abilityFocus` and its multiplier both return to their untouched state at
   the next `startRound`, same as the Energy that paid for them. `abilityFocusUnlocked` itself
   is not round-scoped — the Presence purchase survives every round boundary, only the
   purchases made with Energy die with the round.
7. **Save round-trip.** Purchase counts survive a save. An unknown ability id, or a
   non-positive count, is dropped on load rather than carried or clamped negative.
8. Both locales name `presence_current_quickens` and carry the Focus button label and its two
   log lines.

## Power Card Checks

`tests/cards.test.js` and `tests/defense.test.js`. The checks are the acceptance list in
[10-power-cards.md](./10-power-cards.md#acceptance); the ones worth naming here are the three a
careless implementation passes by accident:

1. **The offer is state.** Roll an offer, save, load, re-render — the same three ids. Only a paid
   re-roll changes them. A test that only reads the offer once cannot catch a render-time roll.
2. **A ward's clock starts on use, not on cast.** Lay Defend 6 on an empty land, run several wave
   intervals, then bring invaders in: the ward must still be there and must lapse one interval
   after *that* moment. Assert both halves — a ward that never expires passes the first half.
3. **Removal cannot rescue.** Bring `round.blight` to `threshold - 1`, let a tick take it to the
   threshold, and confirm the round has ended even though a removal was available in the same
   tick.

Use `setRng` for every draw assertion; nothing here should be tested against a distribution.

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
15b. Its **generated Fear counts what it already spent**. The fixture predates the ledger, so
    the figure is rebuilt on load: its five purchases priced off the catalogue are `spent`, and
    `meta.fear` plus that is `generated`. Read off the bank alone, a save that had been shopping
    would arrive at the Reclaim button short by everything it had bought.
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

**461 automated checks, all passing.** Coverage by file:

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
| `tests/focus.test.js` | Focus: the reduction curve, cost anchoring, the gate, save round-trip |
| `tests/ascension.test.js` | The Presence layer, the two-key rule, the Presence catalogue |
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
