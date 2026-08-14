# 04 Economy and Formulas

## Intent

Document the numeric rules and constants for the round-based redesign.

## Rules

- Every number in this file maps to a named constant or formula in `engine.js`.
- Numbers marked placeholder are a first pass for internal consistency, not a balancing
  decision. The loop is now playable, so they are due — see
  [index.md](./index.md#known-balance-problems).

## Implemented Constants

```txt
VERSION = 4.0.0
TIME_SCALE = 2                         (real seconds per beat)
WAVE_INTERVAL_SECONDS = 10 * TIME_SCALE  = 20
BLIGHT_THRESHOLD_BASE = 10             (placeholder)
BLIGHT_PER_DAMAGE_SECOND = 0.02 / TIME_SCALE  = 0.01
DAHAN_LOSS_PER_DAMAGE_SECOND = 0.05 / TIME_SCALE  = 0.025  (under playtest)
BLIGHT_FLOOR_FRACTION = 0.25             (anti-stacking, under playtest)
DAHAN_CONCENTRATION_CAP = 2              (anti-stacking, under playtest)
DAHAN_ATTACK_INTERVAL_SECONDS = 10 * TIME_SCALE  = 20  (placeholder)
DAHAN_ATTACK_DAMAGE = 1                (placeholder)
DAHAN_PER_ROUND_START_BASE = 6
DAHAN_MAX_SPREAD = 2
DEFEAT_FX_MS = 1200
MAX_TICK_SECONDS = 5 * TIME_SCALE  = 10
```

## Beats and TIME_SCALE

Every duration in the game is authored in **beats** and rendered in seconds by one dial. A
beat is the design's own unit of time; `TIME_SCALE` says how many real seconds one costs.
Durations are `beats * TIME_SCALE`, per-second rates are `beatRate / TIME_SCALE`, and the
cooldown of every ability in [07](./07-content-registry.md) is written the same way.

Turning the dial changes how much real time the player has to read a board and answer it, and
changes nothing else. A wave still costs one wave interval; an ability still fires the same
number of times inside one; a land under the same damage still takes the same number of waves
to Blight. The guarantee is not empirical but arithmetic: the fight only ever spends
damage-seconds, and a doubled clock against a halved rate is the same product at every instant
of the round, not merely at its end. `TIME_SCALE` was raised from 1 to 2 for reaction time
alone, and no balance figure was touched with it.

The player has a dial of their own (`ui.gameSpeed`, see
[02-core-loop.md](./02-core-loop.md#pacing)), and it is deliberately *not* a second copy of
these constants: the engine keeps thinking in the seconds it was authored in, and the setting
becomes one multiplier on `dt` — game seconds per real second, `0` while paused. Nothing
downstream of `tick` knows the difference, which is what makes the guarantee above hold for
the player's dial exactly as it holds for this one. Only the display converts back: a
countdown is drawn in real seconds, or two clocks that run together would stop reading as
one.

Verified rather than assumed: an unattended round traced at scale 1 and at scale 2, sampled
every beat, is identical at every mark — same waves, same Blight, same board, same Fear, same
ending beat — as long as both are stepped the same number of times per beat.

The one real difference is **resolution**, and it is not a rate. `ui.js` ticks on a fixed
100 ms interval, so at scale 2 a beat is integrated in twenty steps instead of ten. That is
strictly closer to the continuous fight this document specifies, but the round is knife-edged
in places — a casualty landing just before rather than just after a Dahan strike changes what
that strike can kill — so an individual round can still come out a wave longer or shorter than
the same seed did at scale 1. Stepping scale 1 twice as often reproduces the scale 2 round
exactly, which is what identifies the effect as the tick rate rather than the dial. It sits
well inside the spread the terrain draw already produces.

Two consequences worth stating, because both are easy to break:

- **Every constant above is real seconds.** Nothing may scale a duration a second time on its
  way to the screen — the HUD prints `waveTimerRemaining` as it stands.
- **Retune against the beat, not the second.** `BLIGHT_PER_DAMAGE_SECOND` reads 0.01 today
  but the tuned figure is 0.02 a beat; a rebalance moves the numerator and leaves the divisor
  alone. The prose in this document counts in beats for that reason.

`DEFEAT_FX_MS` is deliberately outside the dial. It is measured against how fast an eye
catches a highlight, which no change of game pace moves.

`DAHAN_ATTACK_INTERVAL_SECONDS` equals `WAVE_INTERVAL_SECONDS` today by choice, not by
derivation, so that round one reads as a single rhythm. They are separate constants and the
shop is expected to move one of them; nothing may re-couple them.

`MAX_TICK_SECONDS` still caps how much elapsed time a single tick may credit toward wave and
ability cooldown timers, for the same reason it capped Essence in the turn-based build: it
has to stay above the roughly one-second throttle browsers apply to background tabs, while
preventing a large jump after the machine sleeps.

## Unit Stats

```txt
Explorer: health 1, damage 1
Town: health 2, damage 2
City: health 3, damage 3
Dahan: health 2, damage 2
```

The numbers are unchanged from the turn-based build, but `damage` now means **damage per
second**, not damage per Ravage. `health` still governs invaders only; Dahan die to the
casualty bar below, so their 2 health appears in no formula.

A unit's `damage` is a rate and is *not* scaled by `TIME_SCALE`. It is also the unit's power,
which is what a defeat pays in Fear and Energy, so scaling it would move the economy. The two
damage-second constants carry the whole of the scaling instead — see below.

## The Damage-Second

The whole fight runs on one currency. One point of damage sustained for one second is a
**damage-second**. 50 damage-*beats* buy one Blight; 20 buy one Dahan casualty. At
`TIME_SCALE = 2` that is 100 and 40 damage-seconds, which is the same purchase read on a
slower stopwatch.

The two rates were equal at 0.02 a beat in the first cut — one clock, read two ways — but
Dahan outlasted the pressure that was supposed to grind them down, so the casualty rate is
raised to 0.05 a beat and under playtest. Blight stays at 0.02 a beat. If the casualty clock
settles somewhere else, only this constant moves; nothing is derived from the two being equal.

## Wave Timing

```txt
step = min(MAX_TICK_SECONDS, dt * ui.gameSpeed)                (0 while paused)

waveTimerRemaining -= step, each tick
when waveTimerRemaining <= 0:
    with auto-proceed on:
        resolve one wave (Build, Discover, track shift)
        waveTimerRemaining += WAVE_INTERVAL_SECONDS     (the overshoot is carried)
    with auto-proceed off:
        waveTimerRemaining = 0                          (the overshoot is dropped)
        awaitingWave = true, and no clock advances until the player calls the wave
```

The interval itself is not a player control: nothing shortens it and nothing pulls a wave
forward. What the player sets is how fast its seconds are handed out, and whether the round
carries on past the end of one — see [02-core-loop.md](./02-core-loop.md#pacing). The timer
runs whenever the round is `running` and no gate is held, and it deals no damage.

## Blight Formula

Continuous, per land, every tick. No terrain is selected and no phase is involved.

```txt
gross           = explorers*1 + towns*2 + cities*3
defence         = dahanCount * 2
held            = gross > 0 and defence >= gross
net             = max(gross - defence, gross * BLIGHT_FLOOR_FRACTION)

blightProgress[land] += net * BLIGHT_PER_DAMAGE_SECOND * dt

while blightProgress[land] >= 1:
    blightProgress[land] -= 1              # carries the remainder, never resets to 0
    round.blight += 1
    round.blightByLand[land] += 1

round.blight = min(round.blight, round.blightThreshold)
if round.blight >= round.blightThreshold:
    round ends
```

Worked examples, per beat, so they hold at any `TIME_SCALE`. Seconds are the beat column
times the dial; at 2 an undefended land of one of each blights every 16.7s.

```txt
1 explorer + 1 town + 1 city, 0 Dahan   6.0 net   12.0% / beat   1 Blight every  8.3 beats
1 explorer + 1 town + 1 city, 2 Dahan   2.0 net    4.0% / beat   1 Blight every 25.0 beats
1 explorer + 1 town + 1 city, 4 Dahan   1.5 net    3.0% / beat   held, 1 every 33.3 beats
1 city, 2 Dahan                         0.75 net   1.5% / beat   held, 1 every 66.7 beats
```

Blight never decreases in this slice, and it never stops. `BLIGHT_FLOOR_FRACTION` is the
share of gross damage no amount of defence can cancel: a land whose Dahan out-defend its
invaders is `held`, which means it seeps rather than sits at zero. Defence buys time, never
immunity — a stack parked on a land is a delaying tactic that has to be paid for again.

The floor scales with gross, not with a flat number, so a bigger stack parked on a bigger
threat does not make the threat go away. `held` is its own flag rather than a `net == 0`
test, because `net` is never 0 while invaders stand there.

## Dahan Casualty Formula

Also continuous, also per land, on the same clock.

```txt
concentration = min(dahanCount, DAHAN_CONCENTRATION_CAP)
dahanProgress[land] += (gross / concentration) * DAHAN_LOSS_PER_DAMAGE_SECOND * dt

while dahanProgress[land] >= 1 and dahanCount > 0:
    dahanProgress[land] -= 1
    dahanCount -= 1

if dahanCount == 0: dahanProgress[land] = 0
```

Three things to notice, all deliberate:

- The numerator is **gross**, not net. Dahan absorbing damage on the island's behalf are
  still being hit, so a land can be perfectly held for Blight and still be losing defenders.
- Dividing by the count **concentrates** the damage on the survivors. Two Dahan against 6
  damage take 3 each, so the first falls at 6.7s; the survivor then eats all 6 and falls at
  3.3s. Losing a defender both accelerates the Blight and shortens the next defender's life.
- The divisor is **capped**, so that spiral only runs downward. Past
  `DAHAN_CONCENTRATION_CAP` a stack's people fall at a fixed rate no matter how deep it is.

The cap is what keeps a stack's total lifetime linear in its size. Uncapped it was
`10 * D * (D+1) / gross` — quadratic, because every Dahan added slowed attrition for every
Dahan behind it. Stacked with the zero-Blight cliff the floor now removes, that made one
fortified land beat six defended ones outright, and made `rivers_bounty` the only ability
worth casting. At `gross = 6`:

```txt
              uncapped lifetime    capped (DAHAN_CONCENTRATION_CAP = 2)
2 Dahan            10.0s                      10.0s
4 Dahan            33.3s                      23.3s
6 Dahan            70.0s                      36.7s
```

## Dahan Strike Formula

```txt
dahanAttackRemaining -= dt, each tick
when dahanAttackRemaining <= 0:
    for each land holding both Dahan and invaders:
        pool = dahanCount * DAHAN_ATTACK_DAMAGE
        spend the pool 1 damage at a time on the highest tier present
        (cities, then towns, then explorers) until the pool or the invaders run out
    dahanAttackRemaining = roundDahanAttackInterval(state)
```

Defeated invaders award Fear through the normal defeat path. Partial damage carries per land
and per type, exactly as it did for the old counterattack.

### The interval, and the one thing that shortens it

```txt
haste            = min(DAHAN_HASTE_MAX, investedFear / DAHAN_HASTE_FEAR_FOR_FULL)
strikeInterval   = DAHAN_ATTACK_INTERVAL_SECONDS / (1 + haste)
```

`investedFear` is the tier of `dahan_remember` — *The Dahan Remember*, the shop's one pool
(see [The Fear pool](#the-fear-pool)). 10000 Fear fills it, 100 Fear buys 1%, and the cap is
100%: `20s → 10s` at the 1x speed dial, twice as many strikes in the same round.

Haste **divides** rather than subtracting, for two reasons that are not arithmetic taste. The
percentage then means what it says — 100% haste is 100% more strikes, not "100% off" a
cooldown that would then be zero — and division composes. A second cooldown source multiplies
its divisor in beside this one without either knowing the other exists, and no combination of
them can reach zero. A subtractive rule would need a floor bolted on the moment a second
source arrived, and the floor would be the real rule while the percentages were decoration.

The interval is read through `roundDahanAttackInterval`, which takes the tier from the round's
**upgrade snapshot** rather than from what is owned. Fear poured into the pool at 9/10 Blight
buys the *next* round a faster strike, never the one being lost — the same rule, by the same
mechanism, as every other row in the shop (see [Round Reset Formula](#round-reset-formula)).

## Fear Formula

Fear has two sources. Killing pays for what you clear; the wave pays for what you outlast.
Without the second, a round that holds its line perfectly and kills little would earn almost
nothing.

```txt
killFear = defeatedPower * FEAR_PER_POWER * (1 + tier(rising_dread) * 0.10)
waveFear = FEAR_PER_WAVE * (1 + tier(mounting_terror) * 0.10)

FEAR_PER_POWER = 1        defeatedPower = the unit's damage value, which rides
FEAR_PER_WAVE  = 1        the difficulty ladder: see Unit Stats
```

Every tenth wave pays a third source on top, if `high_water_mark` is owned:

```txt
milestone = wave * tier(high_water_mark) * 0.10 * (1 + tier(mounting_terror) * 0.10)
            ... on waves where wave % 10 == 0, and 0 otherwise
```

`mounting_terror` multiplies the milestone because the milestone *is* wave income. That is
what makes the two worth owning together: alone, `mounting_terror` multiplies a flat 1 per
wave and falls further behind kill income at every damage rung of the ladder; with the Mark it
multiplies the one number in the game that grows faster than the invaders do.

A run reaching wave `10m` collects `tier * m(m+1)/2` in milestones against `10m` in flat wave
Fear — **quadratic in depth against linear**. At tier 5 a run to wave 100 collects 275 from
milestones and 100 from waves.

### Where the rounding happens

`round.fearEarned` accumulates as a **float** for the whole round. `meta.fear` — the only pool
the shop can spend — is a whole number, and `endRound` floors the round's total exactly once
on the way in. Down, never up: a part-earned Fear is not a Fear.

Flooring each award instead would round the ladders away to nothing. An explorer pays 1, and
`floor(1 * 1.1)` is 1, so the first four tiers of `rising_dread` would buy a number the player
watched not move. The bank is where fractions stop mattering, so it is where they are dropped.

Every readout goes through `formatFear`, which floors, so nothing ever displays a fraction —
including `round.fearEarned`, which is shown as the whole Fear it would bank.

### The two pools

Fear accumulates in `meta.fear`, which persists across rounds; nothing in this design resets
it. `round.fearEarned` tracks the current round only and banks at round end.

All three ladders are read through `activeUpgradeTier`, not `upgradeTier` — they are read
every time Fear is earned, which makes them exactly the class the round snapshot exists for.
A tier bought mid-round is owned immediately and pays nothing until the next round starts.
See [02-core-loop.md](./02-core-loop.md#between-rounds).

## Energy Formula

```txt
energyGain = defeatedPower * ENERGY_PER_POWER   ENERGY_PER_POWER = 1
defeatedPower = the unit's damage value: explorer 1, town 2, city 3
```

The same defeat pays both currencies, off the same power value: an explorer pays 1 Energy, a
town 2, a city 3. One scale rather than two, so a player who has learned what a city is worth
has learned it once.

Energy is whole-numbered where Fear is fractional — it is spent on flat integer prices, and a
purse reading `7.35` would be three decimal places of noise on a number nothing can use them
for. Only an invader defeat pays it: a Dahan casualty is a loss, not an income.

Energy accumulates in `resources.energy` and **dies with the round**. `startRound` resets the
purse, empties `round.purchasedAbilityIds`, and clears `round.abilityTiers`: everything bought
during a round is given back when the next one starts.

The purse resets to `upgrades.startingEnergy` rather than to zero — 0 until `headwaters` is
bought, and whatever its tier pays after that. Nothing else about the line moves: the Energy a
round *earned* is still gone, and every unlock it bought is still given back. What carries is
a figure the shop set before the round began, which is the same thing `dahan_reinforcement`
carries.

That is the sharp line between the two currencies. Fear carries and buys permanent upgrades,
only between rounds. Energy is earned inside a round, spent inside that round, and gone when
it ends. `headwaters` is the one place a Fear purchase pays out in Energy, and it pays only
into the opening — it can never top a round up once the round is running. See
[02-core-loop.md](./02-core-loop.md#energy).

## Ability Unlock Cost

Per ability, not one flat price:

```txt
innate_power    0 Energy    (opening hand)
boon_of_vigor   0 Energy    (opening hand)
rivers_bounty   5 Energy
flash_floods   10 Energy
wash_away      20 Energy
```

The three prices total 35, which is more than one early round's whole income — so which of
them a round can afford is its first real decision, and buying all three means a round that
lasted. `wash_away` is twice the Floods because what it buys outlives them: 2 damage
buys fewer bodies at every rung of the invader health ladder, and a drowning always buys one.
The active spirit opens with `startingAbilityIds` unlocked and the rest at these prices; see
[07-content-registry.md](./07-content-registry.md#spirits).

### Innate tiers

`innate_power` is the one ability that grows rather than being bought once. Its tiers are
whole records — cooldown, effect and text each — so a tier is a different ability standing in
the same slot rather than the previous one with a modifier:

```txt
tier 1   free       cooldown  8 beats   push 1 explorer/town
tier 2    50 Energy cooldown 16 beats   2 damage, then push up to 3 explorers/towns
tier 3   250 Energy cooldown 24 beats   2 damage to each invader in the land
```

Cooldowns rise with the tier deliberately. Throughput still improves at every step — tier 2 is
three pushes and 2 damage per 16 beats against tier 1's one push per 8 — so the longer wait buys a
bigger swing rather than taxing the upgrade. The tier is held in `round.abilityTiers` and, like
every other purchase, resets when the round does.

250 is knowingly out of reach of an early round. It is gated on round *length*, which is what
`blight_resilience` buys — so the third tier is a late-progression sight rather than a
mid-round one.

## Ability Formulas

```txt
innate_power    see the tier table above     needs a land click
boon_of_vigor   cooldown 12 beats   +1 Energy
rivers_bounty   cooldown 15 beats   +1 Dahan to the land with the fewest Dahan and invaders if
                                    possible - the thinnest land outright when nothing is contested
flash_floods    cooldown 25 beats   1 damage in a clicked land, +1 more if that land is coastal
wash_away       cooldown 35 beats   push up to 3 explorers/towns out of a clicked land - or,
                                    from a coastal land, carry up to 2 of them out to sea,
                                    removing them from the island outright
```

`boon_of_vigor` and `rivers_bounty` resolve on the trigger itself. The other three take a land
click (`pendingAbilityTarget`).

### Applying damage

One rule, shared by every ability and by the Dahan strike: **damage kills if it can, and only
wounds when it cannot.**

```txt
while damage remains:
  if any unit can be killed outright by what is left:
      kill the toughest of them
        ties -> the higher tier (a wounded city at 2 HP before a fresh town at 2 HP)
        ties -> the lowest index
      subtract its remaining health and continue with the rest
  else:
      spend everything left on the strongest thing standing
        highest tier first, and within a tier the one already closest to falling
      stop
```

So 2 damage into a land of 4 explorers, 2 towns and 2 cities takes a town — not two explorers,
and not a scratch on a city. If one of those cities were already down to 2 health, the same 2
damage would take the city instead. 1 damage into that land takes an explorer.

The predecessor rule always spent on the biggest thing standing, which let a Dahan strike
scratch a city for a whole round while four explorers stood beside it. Killing is what pays
Fear and Energy, so damage that could have bought a kill and did not was damage the round
threw away. The change makes the Dahan meaningfully stronger, which is intended.

`innate_power` at tier 3 is the exception: it deals its damage to each invader *individually*,
with no pooling and no carry, so a unit that survives is wounded by exactly 2 whatever its
neighbours did.

### Pushing

`wash_away` and `innate_power`'s first two tiers push. Cities are never pushed — they are built
into the land, and a spirit of rivers moves what water can carry.

```txt
which land?         the player's click
which units?        towns before explorers, up to the ability's push count. A town is worth
                    two of an explorer everywhere else in the engine, so a push with a budget
                    smaller than the land spends it on the heavier thing
pushed where?       open ground first: one adjacent land holding no invaders at all. A land
                    already holding Dahan wins outright when there is one - the push throws the
                    unit at a defender instead of leaving it free to seep Blight; failing that,
                    a coastal one wins; among equals the lowest land id
no open ground?     an adjacent land that already holds invaders, ranked the same way. Every
                    land on this board has at least two neighbours, so a push never fails for
                    want of a destination
```

The destination is deterministic, like every other tie on this board: the water always runs the
same way, so a push can be planned rather than gambled on. An earlier draft picked randomly
among the equals to stop a player farming one land into a permanent sink; predictability turned
out to be worth more than that. The Dahan preference is why "lowest land id" is no longer the
whole story: the three coastal lands are `1`, `2` and `3`, the lowest ids on the board, but a
Dahan-held land with a higher id now outranks them - defence matters more than geography.

The occupied fallback is what the board game has always allowed and what an earlier draft of
this engine refused. Refusing it made the push the one effect that stopped working as the round
went on: a full island is exactly when the pressure most needs moving and exactly when every
neighbour was disqualified. It is not free — shoving a Town onto a land that already holds one
is what turns the next Build there into a City — which is why it is the last resort, and why
the auto-casts that push for *position* (`innate_power` tier 1's routing and seaward rungs and
tier 2's routing, `wash_away` routing and protect-thin) require open ground instead. Emptying a
land is different: anywhere off it will do, so the break-build rungs take the fallback happily.

The Dahan-before-coastal order in that table is also why the Innate's tier-1 list ranks routing
*above* the seaward rung rather than below it. A land with both an open defended neighbour and
an open coastal one pushes into the defended one whatever the priority list says, so a seaward
rung placed above routing would be a claim the destination rule immediately overrides. The list
follows this table instead of arguing with it — one rule for where the water runs, and the
rungs describe what that rule would achieve.

### The sea

`wash_away` is the one ability that can take a unit off the island without hurting it. From a
**coastal** land the water does not stop at the next land over:

```txt
which units?        towns before explorers, up to `seaCount` (2) — the same order the push
                    uses, on a smaller budget, because a shove is cheap and a one-way trip
                    is not
which unit of its   the healthiest one. Removal ignores health, so spending it on the unit
type?               that would have been hardest to kill is what makes it worth more than
                    the damage it replaces — and it leaves the wounded standing for the rest
                    of the kit to finish
cities?             never. A city is built into the land, the same rule that keeps one from
                    being pushed
pays?               Fear and Energy exactly as a defeat does, on the same power scale — it
                    goes through the same `creditDefeat` the damage path calls
```

Three of the eight lands are coastal, so which half of the ability a cast gets is a question
about position rather than luck — and the rest of the kit already answers it, since the
Innate's push and the push destination ranking both walk stacks toward the water.

This is the only removal in the kit that is not damage, which is what keeps the ability worth
casting late: 2 damage buys fewer bodies at every rung of the invader health ladder, and a
drowning buys the same thing on the fortieth wave as it did on the first.

A unit carries its own damage with it, exactly — which is what per-unit health bought. Under
the old per-type model the destination kept the worse of the two wounds and the rest was lost.

### Failure to find a target

```txt
boon_of_vigor    never fails: it needs nothing on the board
rivers_bounty    never fails: there is always a thinnest land to reinforce
flash_floods     fails when no land holds invaders
wash_away        fails when no land holds a pushable unit. Where it goes is never in doubt -
                 open ground, an occupied neighbour, or the sea - so this reads one land
innate_power     tier 1 as wash_away; tiers 2 and 3 need only invaders present
```

Tier 2 is deliberately looser than tier 1: its damage stands on its own, so a land holding
nothing but Cities is still a legal target and the cast still counts. Refusing at that point
would rewind damage already dealt and already paid Fear for.

A failure logs "no valid target" and leaves the cooldown unspent, per
[09-island-board.md](./09-island-board.md#failure-to-find-a-target).

### Cooldown scaling

```txt
abilityCooldownSeconds(id) = max(1, ABILITIES[id].cooldownSeconds * round.abilityCooldownMult)
```

`ABILITIES[id].cooldownSeconds` is already `beats * TIME_SCALE`, so this returns real seconds
and the multiplier is a pure percentage on top of it. Nothing here scales again.

Deliberately not rounded to whole seconds: one `swift_currents` tier is worth 5% of the Boon's
12 beats, a bit over half a beat, and rounding would flatten the diminishing curve into equal
steps. The ability bar rounds up for display.

## Round Reset Formula

```txt
roundStart.dahanTotal        = DAHAN_PER_ROUND_START_BASE + upgrades.dahanBonus
roundStart.blightThreshold   = BLIGHT_THRESHOLD_BASE + upgrades.blightThresholdBonus
roundStart.abilityCooldownMult = 1 - upgrades.cooldownReductionPct
roundStart.energy            = upgrades.startingEnergy
```

Applied at [Round Sequence](./02-core-loop.md#round-sequence) step 1. `upgrades.*` values
come from `upgrades.purchased`; see [05-progression.md](./05-progression.md) for the shop
catalogue those totals are drawn from.

The base Dahan placement is the spirit's fixed `roundStartDahan` map, not a random spread —
six Dahan across lands 1, 2, 4, 5, 6 and 7. Purchased reinforcement is then added one at a
time to the **emptiest land**, ties on the lowest id, with no per-land cap: every purchased
tier is placed however deep the shop is pushed. Deterministic on purpose: a round setup that
can be asserted in a test is worth more than one that surprises.

What the placement guarantees is the **spread**, not a per-land ceiling:

```txt
max(dahan[land]) - min(dahan[land]) <= DAHAN_MAX_SPREAD
```

No land may stand more than two Dahan above another — nothing reaches 3 while a land is
still empty. Filling the emptiest land is what enforces this: a land can only rise to `n+1`
once every land has reached `n`, so the spread the baseline starts with (1, from the two
lands `roundStartDahan` skips) never widens. The earlier `DAHAN_MAX_ADD_PER_LAND` cap is
gone; it silently discarded every tier past the sixteenth, which the current shop can reach.

## Upgrade Cost Curve

```txt
cost(nextTier) = round(baseCost * growth ^ tiersAlreadyOwned)     growth = 1.6 unless the row names its own

dahan_reinforcement  baseCost 10   10, 16, 26, 41, 66, ...    (max tier 8)
blight_resilience    baseCost 3     3,  5,  8, 12, 20         (max tier 5)
headwaters           baseCost 8     8, 13, 20, 33, 52, ...    (max tier 9)
rising_dread         baseCost 6     6, 10, 15, 25, 39, ...    (soft-capped)
mounting_terror      baseCost 6     6, 10, 15, 25, 39, ...    (soft-capped)
high_water_mark      baseCost 12   12, 19, 31, 49, 79, ...    (soft-capped)
dahan_remember       baseCost 1     1,  1,  1,  1,  1, ...    (growth 1, max tier 10000)
```

Buying more than one rung at a time goes through `upgradeCostFor(state, id, count)`, which
sums the individual rounded prices rather than rounding a sum: what a bulk button spends must
equal what the same number of clicks would have spent, or it is a discount or a tax nobody
asked for. `upgradeTiersAffordable` is the same walk against the purse, and is what the pool's
**Max** button buys.

### The Fear pool

`dahan_remember` is the one row that is not a ladder. `costGrowth: 1` makes every unit cost
the same 1 Fear forever, which is the whole of what makes it a pool: the 1.6 curve everywhere
else exists to keep a ladder a decision, and a sink is the opposite of a decision. Its tier
*is* the Fear invested, which is why it could be a catalogue row at all — saving, capping,
ordering and the sold-out half all work on it unchanged.

10000 Fear for the full 100% is several times the price of the rest of the catalogue put
together (`headwaters` alone, the dearest ladder, is 903). That is deliberate: it is the sink
that outlives the shop, priced against income the shop can no longer absorb rather than
against the shop. Its value is front-loaded in the way that matters — the first 1000 Fear buys
+10% strike rate, the last 1000 buys +2.6% off the interval — so the early clicks are felt and
the tail is where the money goes.

The pool is also mildly self-reinforcing: more strikes are more defeats, and a defeat pays
Fear. The flat price is what holds that in check.

### headwaters and the shape of a gain

Every other ladder here pays a flat gain against a rising price, which is what makes its top
rungs deliberately bad buys. `headwaters` inverts that, and the curve is why: over nine tiers
the last one costs 43× the first, so a flat gain would leave most of the ladder dead. Its gain
is a table rather than a step, and it climbs with the price:

| tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Energy at round start | 1 | 2 | 3 | 5 | 8 | 13 | 19 | 26 | 35 |
| cost | 8 | 13 | 20 | 33 | 52 | 84 | 134 | 215 | 344 |
| Fear per Energy | 8 | 13 | 20 | 16.5 | 17.3 | 16.8 | 22.3 | 30.7 | 38.2 |

The price still pulls away from the payoff, from 8 per Energy to 38 — just gently enough that
no rung is dead weight. Tiers 1–3 are weak by design and not an oversight: 3 Energy crosses
none of the unlock prices, so it is worth about three Boon ticks off the opening. They are the
entry fee on a ladder whose top is very strong.

The ceiling is exactly `5 + 10 + 20`, the whole unlock kit. A tier 9 round paired with
`auto_buy_abilities` opens with the entire kit bought and no Energy spare. That is why this
ladder is capped where the three Fear ladders are not: what it buys genuinely runs out, and
past 35 it would only be pre-banking toward the Innate's 50.

Cumulative cost is **903 Fear**, the dearest row in the catalogue — above `auto_start_round`
(500). It is also the only upgrade whose worth *shrinks* with depth, the exact inverse of
`high_water_mark`: a run to wave 100 barely notices its first thirty seconds. This one pays
for playing; the Mark pays for pushing. Because it is finishable it counts toward the gate
below, so the catalogue's last two purchases now sit 903 Fear further out.

### Soft caps

A **soft-capped** ladder carries no `maxTier`, so `upgradeMaxTier` reports `Infinity` and it
is never "maxed" — `upgradeIsSoftCapped` derives the fact from the record rather than the
record declaring it twice. Nothing stops it but the curve — and the curve is
enough. Each tier costs 60% more than the one under it while paying the same flat +10%, so the
price pulls away from the payoff on its own:

| tier | 1 | 5 | 10 | 12 |
| --- | --- | --- | --- | --- |
| `rising_dread` cost | 6 | 39 | 412 | 1056 |
| payback, at ~30 Fear/round | ~2 rounds | ~13 | ~137 | ~350 |

Reaching +100% costs about 1090 cumulative; tier 12 alone costs more than that. The ceiling
also **floats**: payback is measured against the current Fear rate, so tiers that were absurd
at wave 40 come back into range at wave 150 instead of sitting maxed and dead.

This is a playtest decision, not a settled one. If the uncapped tail reads as noise rather
than as depth, a `maxTier: 10` on each of the three turns them into finishable ladders — the
matched set would then be ten tiers, +10% each, +100% at the top — and nothing else has to
move except the gate below.

### Which rows the gate counts

`gatedUpgradesUnlocked` asks whether every other row is finished, and the row itself says
whether it is one of those — `requiredForGate: false` opts out, and the default is in.

Two kinds of row opt out, for two different reasons:

- **Soft-capped ladders**, which can never finish. One would hold the gate shut forever,
  taking `auto_buy_abilities` and `auto_start_round` off the table permanently while the shop
  displayed a price the player could afford and a refusal that never lifted.
- **`dahan_remember`**, which *can* finish, but only after 10000 Fear. That is a wall rather
  than a gate, and what stands behind it was meant to be what finishing the shop pays for.

So "you have finished the shop" means every row the gate counts. The flag used to be
`softCapped`, which was the shape of a ladder standing in for a decision about the gate — fine
while the two coincided, wrong the moment a capped row needed the same exemption. Asserted in
`tests/fear.test.js` and `tests/haste.test.js`, including the structural check that no
soft-capped row is ever required for the gate.

The growth rate is what keeps the shop from being a flat checklist, and it has not been
checked against how much Fear a round actually earns at depth.

## Offline Handling

- No offline catch-up exists for round time, wave resolution, or ability cooldowns, matching
  the turn-based build's Essence behavior: a save resumes exactly as it was written, crediting
  no elapsed wall-clock time for the gap.
- Fear and purchased upgrades are unaffected by this, since they only change on explicit
  in-round or in-shop actions, never from elapsed time.
- Whether this should change later (a round ticking down while the tab is closed) is an open
  question — see [index.md](./index.md).

## Placeholder Fields

- `essence` accumulates nothing and has no reader; it is inert scaffolding for a possible
  future system, not active economy.
- The unlock ladder (5 / 10 / 20) and the Innate's tier prices (50 / 250) are shaped against a
  rough estimate of a round's income — 20 to 40 Energy over 60 to 120 beats — not against a
  played measurement. `ENERGY_PER_POWER` is a placeholder on the same footing.

## Acceptance

- All constants here match the live implementation. ✓
- No undocumented balance rule affects the round loop. ✓
- Placeholder systems and placeholder numbers are both called out explicitly, and are
  distinguished from each other. ✓

## Measured Behaviour

> **Stale.** These numbers predate three changes that all move them: the opening Discover
> (invaders are ashore from second zero, so the first ~10 seconds are no longer free),
> `BLIGHT_FLOOR_FRACTION` (held lands seep, so rounds should shorten), and
> `DAHAN_CONCENTRATION_CAP` (stacks die faster, so Dahan lost should rise). Re-measure before
> quoting any of it. They were also taken at `TIME_SCALE = 1`, so every figure below is beats;
> the wall-clock length of a round has since doubled while the beats did not move.

Five unattended rounds at the constants above, on an injected clock:

```txt
round length       87 - 120 beats     (was 64 under the per-wave Ravage model)
waves to lose      8 - 11
first Blight       33 - 74 beats      (was wave 3, about 24 beats)
Fear earned        1.05 - 1.75        (was 0.00)
Dahan lost         2 - 4 of 6
```

All three of the old findings are gone. The round is about half again as long, so the shop no
longer arrives before the board is readable. Fear is no longer structurally zero — the Dahan
strike fires on its own timer whether or not a land is under attack, so a defended land earns
unattended, enough for a first `dahan_reinforcement` (4 Fear) in three rounds or so.

### Why the casualty rate is 0.05 and not 0.02

The first cut set both rates equal, for the symmetry. It measured **zero Dahan lost across
every run**: one Dahan cancels 2 damage, which is more than a freshly-discovered explorer
deals, and the strike cleared explorers about as fast as Discover seeded them. Every land that
started with a Dahan sat at zero Blight and full strength for the whole round, and the round
was lost entirely in lands `3` and `8` — the two `roundStartDahan` skips. The casualty bar,
the concentration rule, and the death spiral they exist for were all dead code in practice.

Raising the casualty clock to 0.05 (20 damage-beats per casualty rather than 50) costs the
player 2-4 of their 6 Dahan per round without shortening the round much, which is what puts
the spiral on screen. Fear came down slightly with it — dead Dahan stop striking — but not
enough to matter against the shop's curve.

The remaining oddity is the spread on first Blight: 33 to 74 beats across five runs, driven by
whether the early Discover draws land on the two undefended lands. Worth watching, but the
variance is the terrain draw, not the rates. See
[index.md](./index.md#known-balance-problems).
