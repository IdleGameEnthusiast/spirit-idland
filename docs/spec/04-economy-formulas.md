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
ASCENSION_UNLOCK_PRESENCE = 5          (what a Reclaim must pay before it is offered)
PRESENCE_FEAR_DIVISOR = 100            (placeholder, and the least measured number here)
```

Power cards add the block below. Every figure in it is a first pass and none has been played
against — see [10-power-cards.md](./10-power-cards.md) for what each one buys and the
arithmetic behind it.

```txt
POWER_CARD_DRAW_BASE_COST     = 10       Presence, first draw
POWER_CARD_DRAW_GROWTH        = 1.6      the shop's own curve, reused
POWER_CARD_REROLL_DIVISOR     = 4        a re-roll is a quarter of the draw it re-rolls
POWER_CARD_DRAW_FIRST_WAVE    = 25       the round's first card
POWER_CARD_DRAW_INTERVAL_BASE = 20       waves between draws at tier 0, 10 at tier 10
POWER_CARD_REDRAW_BASE_ENERGY = 10       x the round's draw number: 10, 20, 30
DEFENSE_DURATION_SECONDS      = WAVE_INTERVAL_SECONDS   (from a ward's first use, not from cast)
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

Those are the numbers a unit *ships* with. What it fights with is read through `unitStats`,
which adds the two repeating rungs of the difficulty ladder — invader damage from wave 100,
invader health from wave 110, each +1 again every 20 waves after. The rungs are keyed to
`round.wavesResolved`, so they are per round like the rest of the ladder, and Dahan never ride
them. Because power is read off `damage`, a damage rung raises what an invader is worth in the
same stroke as what it threatens; a health rung does not, which is why removal outprices damage
in the shop. The full rung table lives above `EXPLORE_UNRESTRICTED_FROM_WAVE` in `engine.js`,
and the track panel prints it — see [06-ui-contract.md](./06-ui-contract.md).

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

Power cards add one term in front of this: a land carrying **Defense** has its
`gross` reduced by the ward before any of the below runs, and a ward covering the whole of
`gross` zeroes the land outright — the one exception to `BLIGHT_FLOOR_FRACTION` there is.
See [10-power-cards.md](./10-power-cards.md#defense).

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
killFear = defeatedPower * FEAR_PER_POWER * (1 + tier(rising_dread) * 0.10) * presenceMult
waveFear = FEAR_PER_WAVE * (1 + tier(mounting_terror) * 0.10) * presenceMult

FEAR_PER_POWER = 1        defeatedPower = the unit's damage value, which rides
FEAR_PER_WAVE  = 1        the difficulty ladder: see Unit Stats
```

Every tenth wave pays a third source on top, if `high_water_mark` is owned:

```txt
milestone = wave * tier(high_water_mark) * 0.10 * (1 + tier(mounting_terror) * 0.10) * presenceMult
            ... on waves where wave % 10 == 0, and 0 otherwise
```

`mounting_terror` multiplies the milestone because the milestone *is* wave income. That is
what makes the two worth owning together: alone, `mounting_terror` multiplies a flat 1 per
wave and falls further behind kill income at every damage rung of the ladder; with the Mark it
multiplies the one number in the game that grows faster than the invaders do.

A run reaching wave `10m` collects `tier * m(m+1)/2` in milestones against `10m` in flat wave
Fear — **quadratic in depth against linear**. At tier 5 a run to wave 100 collects 275 from
milestones and 100 from waves.

### Presence multiplies too, and does not cap

```txt
presenceMult = 1 + meta.presence * PRESENCE_FEAR_BONUS_PER_POINT

PRESENCE_FEAR_BONUS_PER_POINT = 0.01   (1% Fear per unspent Presence)
```

Unlike the three ladders above, `presenceMult` is read live off `state.meta.presence`, not off
a round snapshot, and has no `FEAR_LADDER_MAX_TIER` to stop it. It applies to all three Fear
sources identically, which is why it is a separate factor rather than folded into the two
per-source ladder multipliers.

The three ladders were deliberately capped at tier 10 after an earlier, uncapped version of
this same shop stopped terminating (see [05-progression.md](./05-progression.md) on the Fear
ladder cap). Presence reopens that door on purpose: holding Presence instead of spending it is
meant to be a live trade-off, which requires the number sitting in the purse to actually be
worth something, growing without limit as long as it goes unspent. What keeps this from being
the same runaway problem the ladder cap fixed is not a ceiling on the bonus but a floor on the
spending side — the Presence shop needs enough to spend it on that leaving a stack unspent is a
real cost and not just a free multiplier no one has a reason to touch. At the two flat, one-off
unlocks the catalogue holds today, that floor does not exist yet: see [Presence prices, and why
they are not on this curve](#presence-prices-and-why-they-are-not-on-this-curve).

Because the ascension payout ([below](#the-ascension-payout)) is itself a function of generated
Fear, a larger `presenceMult` also means a larger Presence payout next cycle — Presence earned
compounds into Presence earned faster. The payout's square root keeps that compounding
sub-linear (doubling generated Fear only ever pays 1.41× the Presence), the same way it already
tempers the three ladders' own compounding; it does not undo it. A repeatable Presence sink is
what turns "unspent Presence" back into a choice instead of a number that only ever grows.

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

Fear accumulates in `meta.fear`, which persists across rounds. One thing resets it, and only
one: ascension. `round.fearEarned` tracks the current round only and banks at round end.

All three ladders are read through `activeUpgradeTier`, not `upgradeTier` — they are read
every time Fear is earned, which makes them exactly the class the round snapshot exists for.
A tier bought mid-round is owned immediately and pays nothing until the next round starts.
See [02-core-loop.md](./02-core-loop.md#between-rounds).

## The Ascension Payout

```txt
presence = floor( sqrt( meta.cycleFearGenerated / PRESENCE_FEAR_DIVISOR ) )

PRESENCE_FEAR_DIVISOR = 100
```

| cycle Fear generated | 2,500 | 10,000 | 40,000 | 250,000 | 1,000,000 |
| --- | --- | --- | --- | --- | --- |
| Presence paid | 5 | 10 | 20 | 50 | 100 |

### The gap to the next Presence

```txt
gap = (presence + 1)^2 * PRESENCE_FEAR_DIVISOR - meta.cycleFearGenerated
```

`fearToNextPresence` inverts the payout exactly: the division comes before the root and the
floor only ever rounds down, so `(presence + 1)^2 * PRESENCE_FEAR_DIVISOR` is the smallest
generated total that pays one more. Generating the gap raises the payout by one; one Fear less
does not.

It exists because the payout figure alone cannot say how close the next rung is, and under the
root the rungs get further apart the whole way up: the first Presence wants 100 Fear, the
sixth 1,100, the twenty-first 4,100. That is the number the "should I Reclaim now?" decision
actually turns on, so the ascension panel prints it under the payout
([06-ui-contract.md](./06-ui-contract.md#required-screen-sections)). Like the payout it reads
`cycleFearGenerated`, so a round still in progress counts for neither.

### Why a square root

The root is the whole mechanism, and a linear payout would break the layer outright. At
`fear / 100` a cycle twice as long pays exactly twice as much, so waiting is never worse than
Reclaiming and the answer to "should I ascend now?" is *no, later*, forever — which is a
decision the player is asked to make and can only get wrong.

Under the root, doubling a cycle's Fear pays 1.41×. **Two short cycles beat one long one**,
which is what makes ascending early a real strategy rather than a mistake, and what stops the
optimal line from being a single cycle that never ends.

It also absorbs the compounding. The payout reads *banked* Fear, which the three Fear ladders
multiply — a maxed `rising_dread` and `mounting_terror` are +100% each on their half of the
income, and `high_water_mark` is quadratic in depth on top. A linear payout on top of that
would be quadratic-on-quadratic. The root pulls the whole thing back to something a fixed
Presence price list can stand in front of.

### What the input is, exactly

`meta.cycleFearGenerated` — the ledger described in
[03-state-contract.md](./03-state-contract.md), incremented in `endRound` by the same floored
figure that lands in `meta.fear`. Three things follow, all of them properties the
implementation must not lose:

- **Spending does not reduce it.** It counts income, not balance, so a player who spent
  everything and one who spent nothing get the same payout. There is no hoarding incentive,
  and the shop and the ascension panel never want opposite things from the player.
- **Granted Fear is not in it.** The playtest grant increments `cycleFearGranted` instead. The
  tools must not be a way of progressing, and keeping the two apart is what guarantees it —
  see [06-ui-contract.md](./06-ui-contract.md#playtest-tools).
- **A round in progress is not in it.** Fear enters the ledger at the bank, and ascension is
  offered only between rounds, so the question of a part-finished round never arises.

### No depth term, and the measurement that would change that

There is no wave term in the payout. Depth is already priced in: kill Fear rides the invader
damage ladder, and `high_water_mark` pays `tier * m(m+1)/2` over a run to wave `10m`, so a
deep cycle generates far more Fear than a shallow one without anyone having to say so twice.
Depth does not enter the design a second time: the unlock is priced in Presence, not waves, so
the only thing the layer ever asks of the player is the payout itself.

The risk that argument carries: if Fear *per real minute* is higher at wave 5 than at wave 50,
a player with `auto_start_round` maximises Presence by farming short rounds and never pushing.
Nobody has measured it. If it turns out that way the fix is to count only Fear banked past
some wave floor — not to add a depth multiplier back, which would pay for depth twice.

### One constant is a placeholder, and the other is derived from it

`ASCENSION_UNLOCK_PRESENCE = 5` is the figure `PRESENCE_FEAR_DIVISOR` was anchored to, used as
the gate: Reclaiming is offered from the moment it would pay what a first Reclaim was always
meant to pay. In generated Fear that is `5^2 * 100 = 2500`, but the constant is written in
Presence on purpose — retuning the divisor moves the Fear cost of the gate and leaves what the
player is promised alone.

`PRESENCE_FEAR_DIVISOR = 100` is a **guess**, anchored only to "a first Reclaim should pay
about 5". The pacing of the entire layer rides on it and no cycle has been played to read the
real figure. The measurement is one line in the playtest tally: play a cycle to the point where
a Reclaim feels earned, read `cycleFearGenerated`, and the divisor is that number over 25.

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
tier 2    40 Energy cooldown 16 beats   2 damage, then push up to 3 explorers/towns
tier 3   150 Energy cooldown 24 beats   2 damage to each invader in the land
```

Cooldowns rise with the tier deliberately. Throughput still improves at every step — tier 2 is
three pushes and 2 damage per 16 beats against tier 1's one push per 8 — so the longer wait buys a
bigger swing rather than taxing the upgrade. The tier is held in `round.abilityTiers` and, like
every other purchase, resets when the round does.

150 sits above a single round's baseline income (roughly 20-40 Energy), so it still leans on
round *length*, which is what `blight_resilience` buys — the third tier stays a late-progression
sight rather than a mid-round one, just no longer an effectively unreachable one.

## Ability Formulas

```txt
innate_power    see the tier table above     needs a land click
boon_of_vigor   cooldown 12 beats   +1 Energy
rivers_bounty   cooldown 15 beats   +1 Dahan to the land with the fewest Dahan and invaders if
                                    possible - the thinnest land outright when nothing is contested
flash_floods    cooldown 25 beats   1 damage in a clicked land, +1 more if that land is coastal
wash_away       cooldown 30 beats   push up to 3 explorers/towns out of a clicked land - or,
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

Power cards extend that ranking without changing its shape: a land holding
**Dahan and Defense** outranks one holding Dahan, which outranks one
holding Defense alone, which outranks a bare coastal land. Shoving a unit onto a warded land is
strictly good for the player, so the water prefers it — and it stays under the Dahan preference,
because Dahan kill what arrives where a ward only absorbs it. See
[10-power-cards.md](./10-power-cards.md#defense).

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
abilityCooldownSeconds(id) = max(1, ABILITIES[id].cooldownSeconds
                                     * round.abilityCooldownMult
                                     * abilityFocusMultiplier(id))
```

`ABILITIES[id].cooldownSeconds` is already `beats * TIME_SCALE`, so this returns real seconds
and each multiplier is a pure percentage on top of it. Nothing here scales again.

Deliberately not rounded to whole seconds: at a 5% cut, one Boon-of-Vigor purchase is worth a
bit over half of its 12 beats' first second, and rounding would flatten the diminishing curve
into equal steps. The ability bar rounds up for display.

`round.abilityCooldownMult` is the permanent, shop-bought half — frozen at round setup, see
[Round Reset Formula](#round-reset-formula) below. `abilityFocusMultiplier` is the live,
mid-round half, bought with Energy while the round is running — see
[Focus](#focus-spending-energy-mid-round-to-shorten-a-cooldown) just below. Nothing today buys
the first one (`cooldownReductionPct` is a stub read as `0`); the second is fully wired.

### Focus: spending Energy mid-round to shorten a cooldown

```txt
purchases            = round.abilityFocus[id] or 0
rate(mult)            = 0.95 if mult > 0.70
                       = 0.97 if 0.50 < mult <= 0.70
                       = 0.98 if FOCUS_FLOOR_MULT < mult <= 0.50
abilityFocusMultiplier(id) =
    fold `purchases` applications of `mult *= rate(mult)` over an initial mult of 1,
    each result clamped to at least FOCUS_FLOOR_MULT (0.3)

focusBaseCost(id)     = ABILITIES[id].unlockCost, if nonzero
                       = ABILITIES[id].focusBaseCost, if the record carries one (only
                         innate_power: 25 — see below)
                       = FOCUS_BASE_COST_FALLBACK (3), otherwise (only boon_of_vigor)
abilityFocusCost(id)  = round(focusBaseCost(id) * FOCUS_COST_GROWTH^purchases)
                       = Infinity once abilityFocusMultiplier(id) has reached the floor
```

A purchase is a live, mid-round spend against the ability's own cooldown — not the same
mechanism as `round.abilityCooldownMult` above, which is a shop purchase frozen at round setup.
Focus is closer in shape to buying an Innate tier: it spends the round's own Energy, while the
round is running, and the result is visible immediately.

The rate a purchase buys depends on where the multiplier **already stands**, not on how many
purchases came before it — read live off the current value each time, the same "read live"
idiom `DIFFICULTY_RUNGS` uses for the wave ladder, rather than a fixed table indexed by count. A
purchase made exactly at a threshold (say, at 0.70 precisely) uses the cheaper zone's rate for
that one purchase and can land past the next threshold — the zone is decided once, on entry,
never split into a partial step.

The three rates soften as the multiplier falls, so the cut is felt hardest at the very first
purchases and tapers on its own approaching `FOCUS_FLOOR_MULT` — no cooldown Focus buys can ever
fall under 30% of what the round froze it at, however much Energy a deep, idle-scaled round
produces. That cap is deliberately **tighter** than `dahan_remember`'s own 50% haste ceiling
(the only other cooldown-shortening mechanic in the game, [above](#the-interval-and-the-one-thing-that-shortens-it)):
Focus is a per-ability, per-round toy the player can lean on hard early, not a second permanent
haste source, and the floor is what keeps it from becoming one.

Cost anchors to what the ability already costs to reach: `abilityUnlockCost`, when the ability
has one, so a dearer ability's Focus costs more from the first purchase. Two abilities carry no
unlock price at all (`unlockCost: 0`, both in the opening hand) and need a base of their own.
`boon_of_vigor` falls through to the flat `FOCUS_BASE_COST_FALLBACK`. `innate_power` does not:
it is the one ability that keeps growing stronger *after* it is bought — three tiers, each a
bigger swing than the last — so a flat floor would make it the cheapest ability in the kit to
Focus despite being the strongest, and its catalogue record carries its own `focusBaseCost: 25`
instead. Growth per purchase (`FOCUS_COST_GROWTH`, 1.5x) is deliberately gentler than the Fear
shop's `UPGRADE_COST_GROWTH` (1.6x): this is a same-round repeatable spend, not a permanent
tier, and it resets to nothing every round along with the Energy that bought it.

`presence_current_quickens` (5 Presence) is what makes any of this purchasable at all — see
[Presence prices, and why they are not on this curve](#presence-prices-and-why-they-are-not-on-this-curve).

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
rising_dread         baseCost 6     6, 10, 15, 25, 39, ...    (max tier 10, 1089 total)
mounting_terror      baseCost 6     6, 10, 15, 25, 39, ...    (max tier 10, 1089 total)
high_water_mark      baseCost 12   12, 19, 31, 49, 79, ...    (max tier 10, 2179 total)
dahan_remember       baseCost 1     1,  1,  1,  1,  1, ...    (growth 1, max tier 10000)
auto_boon            baseCost 25   one-off
auto_innate          baseCost 100  one-off
auto_bounty          baseCost 200  one-off
auto_flash_floods    baseCost 300  one-off
auto_wash_away       baseCost 400  one-off
auto_buy_abilities   baseCost 200  one-off, Presence-locked
auto_start_round     baseCost 500  one-off, Presence-locked
```

A cycle's whole catalogue, pool aside, is **7,031 Fear**: 699 + 47 + 903 for the three capped
ladders, 1089 + 1089 + 2179 for the Fear ladders, and 1,025 + 700 for the seven automations.
That figure is worth knowing because it is what a cycle is measured against — and because
every Fear purchase in it is given back at the next ascension.

Buying more than one rung at a time goes through `upgradeCostFor(state, id, count)`, which
sums the individual rounded prices rather than rounding a sum: what a bulk button spends must
equal what the same number of clicks would have spent, or it is a discount or a tax nobody
asked for. `upgradeTiersAffordable` is the same walk against the purse, and is what the pool's
**Max** button buys.

Both are one function: `upgradeCostFromTier(id, from, count)` is the sum itself, and
`upgradeCostFor` is it with `from` filled in from what the player owns. The other end of it —
rungs `0..n-1`, what a set of owned tiers has *already* cost — is read on load to rebuild the
Fear ledger of a save written before it existed, which is the one caller that has no state to
ask (see [03-state-contract.md](./03-state-contract.md#fields-added-during-implementation)).

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
`auto_buy_abilities` opens with the entire kit bought and no Energy spare. Every other capped
ladder stops at a round number; this one stops where what it buys runs out, and past 35 it
would only be pre-banking toward the Innate's 40.

Cumulative cost is **903 Fear**, the dearest single row in the catalogue — above
`auto_start_round` (500). It is also the only upgrade whose worth *shrinks* with depth, the
exact inverse of `high_water_mark`: a run to wave 100 barely notices its first thirty seconds.
This one pays for playing; the Mark pays for pushing.

### The ladders are capped at ten

`rising_dread`, `mounting_terror` and `high_water_mark` each stop at `maxTier: 10` — ten tiers,
+10% a tier, +100% at the top. One matched set, one number, three rows.

They were **soft-capped** before: no `maxTier` at all, so `upgradeMaxTier` reported `Infinity`
and they were never "maxed". The reason was structural rather than numeric — the Fear shop was
the game's only progression axis, so it had to keep absorbing income forever or the game ran
out of progression (see
[05-progression.md](./05-progression.md#the-shop-no-longer-terminates)). Ascension is that
axis now, and a Fear catalogue whose size Presence grows does not need a row with no top.

What capping buys is that a cycle's shop is a **readable, finite thing**. The curve alone was
already the real limit — each tier costs 60% more while paying the same flat +10%, so the
price pulls away from the payoff on its own:

| tier | 1 | 5 | 10 | 12 |
| --- | --- | --- | --- | --- |
| `rising_dread` cost | 6 | 39 | 412 | 1056 |
| payback, at ~30 Fear/round | ~2 rounds | ~13 | ~137 | ~350 |

Tier 12 alone costs more than the whole ten-tier ladder (1089). So the cap removes rungs
nobody was going to buy and turns "this ladder has no end" into "this ladder ends at +100%",
which is a sentence a player can plan against.

`upgradeIsSoftCapped` is gone with them. Every row in the catalogue now has a `maxTier` —
including the pool, whose top is 10000 — so the predicate had no callers left, and a predicate
that can only answer `false` is a rule that no longer exists.

### There is no gate

`GATED_UPGRADE_IDS`, `gatedUpgradesUnlocked`, `upgradeIsLocked` and the `requiredForGate` field
are all **deleted**. `auto_buy_abilities` and `auto_start_round` used to be refused until every
other row in the catalogue was finished; they are now refused until the matching Presence row
is bought, which is a different question asked of a different currency.

The old gate was the answer to "what does finishing the shop pay for", and the shop is not
finished any more — that is the point of
[05-progression.md](./05-progression.md#the-shop-no-longer-terminates). A test for a state
that never arrives is not a gate, it is a wall, and the two rows behind it would have been
unreachable rather than merely late.

What replaces it is one predicate, `upgradeNeedsPresence(state, id)`, and it reads the
Presence catalogue rather than the Fear one. A row is locked when its Presence unlock is
unbought, and nothing about the Fear purse changes that — the same shape the old lock had, and
`purchaseUpgrade` still refuses before it looks at the price. The shop reads the same predicate
to decide the row is not drawn at all, so the refusal is a guard on the engine side rather than
something a player can walk into.

The growth rate is what keeps the shop from being a flat checklist, and it has not been
checked against how much Fear a round actually earns at depth.

### Presence prices, and why they are not on this curve

```txt
presence_tide_returns      2 Presence   unlocks auto_start_round   (500 Fear, still owed)
presence_river_knows       3 Presence   unlocks auto_buy_abilities (200 Fear, still owed)
presence_current_quickens  5 Presence   unlocks Focus directly - no Fear row to still owe
```

Flat prices, no curve, because none of the three rows is repeatable and there is nothing to
shape. The seven discount ladders below are the repeatable ones, and they are priced by their
own table rather than by any growth rate.

`presence_current_quickens` breaks the pattern the first two set: it does not open a row in the
Fear shop, it flips `abilityFocusUnlocked` directly (see
[Focus](#focus-spending-energy-mid-round-to-shorten-a-cooldown) above). There is no second price
still owed after buying it — the Energy Focus spends afterward is priced per purchase, not as a
lump the Presence row unlocked. This is also the first Presence row to touch the board rather
than gate a Fear row; see [05-progression.md](./05-progression.md#the-two-layers) for how that
sits against "Presence never touches the board."

### The automation discount ladders

```txt
AUTOMATION_PRICE_LADDER    500  400  300  200  100  50  25  10     (Fear)
PRESENCE_DISCOUNT_COSTS      5   10   25   50  100  250  500       (Presence, by rung taken)
```

Every automation's Fear price is a rung of the first line, and each Presence rung bought walks
it one step to the right. How many rungs a row has is read off where its automation already
sits, never written twice:

```txt
auto_start_round     500 Fear   7 rungs    940 Presence for all of them
auto_wash_away       400 Fear   6 rungs    440
auto_flash_floods    300 Fear   5 rungs    190
auto_bounty          200 Fear   4 rungs     90
auto_buy_abilities   200 Fear   4 rungs     90
auto_innate          100 Fear   3 rungs     40
auto_boon             25 Fear   1 rung       5
                                          ----
                                          1,795 Presence for the whole set
```

It bottoms out at 10 rather than 0 so the automations stay purchases a cycle makes rather than
switches a save carries — see [05-progression.md](./05-progression.md#the-discount-ladders).

**The value per Presence spent falls off a cliff, and that is the design.** Take the 500 Fear
row rung by rung:

| rung | Presence | Fear saved a cycle | Fear per Presence |
| --- | --- | --- | --- |
| 1 | 5 | 100 | 20 |
| 2 | 10 | 100 | 10 |
| 3 | 25 | 100 | 4 |
| 4 | 50 | 100 | 2 |
| 5 | 100 | 50 | 0.5 |
| 6 | 250 | 25 | 0.1 |
| 7 | 500 | 15 | 0.03 |

The cost climbs 100× while what a rung saves falls from 100 Fear to 15, so the last rung is
some 700× worse than the first. **The early rungs are the investment and the late ones are a
sink**, and they are meant to be read that way rather than as a ladder a player climbs evenly.

### These rows do not out-earn holding Presence, and are not meant to

The comparison that matters is not rung against rung, it is any rung against *not spending*.
Presence held pays [1% more Fear generated per point](#presence-multiplies-too-and-does-not-cap),
uncapped, so spending `P` Presence to save `S` Fear a cycle wins only while

```txt
cycleFearGenerated  <  100 * S / P
```

which for the seven rungs above is 2,000 / 1,000 / 400 / 200 / 50 / 10 / 3 Fear a cycle. And a
purse holding 500 Presence implies cycles generating millions (the payout is a root — see [The
ascension payout](#the-ascension-payout)). So a fixed Fear discount is a losing trade against
the hold bonus at almost any income, and the deep rungs lose by orders of magnitude.

That is known and accepted rather than an oversight. What these rows are for:

- **Early, they are a genuinely good buy.** A cycle generating a couple of thousand Fear is one
  where 100 Fear off a 500 Fear row is real money, and 5 Presence is a rung the second or third
  Reclaim can reach.
- **Late, they are somewhere to put Presence.** Before them the catalogue held 10 Presence
  total and every point past that had no in-system use at all. 1,795 is a floor under that
  problem without capping the hold bonus, which stays uncapped on purpose.

The thing to get right if a *differently shaped* repeatable Presence row is added: **Presence
income is root-shaped and therefore grows slowly.** The Fear catalogue's 1.6 growth would
outrun it inside three tiers and every rung past the third would be dead. The ladders above
sidestep that with a hand-written table rather than a growth rate, and a new row wants either
the same treatment or something nearer 1.3–1.5. A row meant to actually beat holding Presence
has to pay in something that *scales* — a multiplier, or a permanence — because a fixed Fear
amount provably cannot.

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
- The unlock ladder (5 / 10 / 20) and the Innate's tier prices (40 / 150) were shaped against a
  rough, unplayed guess at a round's income — one that played runs have since shown undershoots
  actual income by a wide margin. `ENERGY_PER_POWER` is a placeholder on the same footing.

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
