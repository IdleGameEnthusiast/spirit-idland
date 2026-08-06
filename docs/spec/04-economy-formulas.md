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
waveTimerRemaining -= dt, each tick
when waveTimerRemaining <= 0:
    resolve one wave (Build, Discover, track shift)
    waveTimerRemaining = WAVE_INTERVAL_SECONDS
```

There is no player control over this timer. It runs whenever the round is `running`, and it
deals no damage.

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
    dahanAttackRemaining = DAHAN_ATTACK_INTERVAL_SECONDS
```

Defeated invaders award Fear through the normal defeat path. Partial damage carries per land
and per type, exactly as it did for the old counterattack.

## Fear Formula

Fear is generated only from defeated invader power, whether the defeat came from a Dahan
strike or an ability:

```txt
fearGain = defeatedPower * FEAR_PER_POWER      FEAR_PER_POWER = 0.35
defeatedPower = the unit's damage value: explorer 1, town 2, city 3
```

Examples:

- Defeating 1 explorer gives `0.35` fear.
- Defeating 1 town gives `0.70` fear.
- Defeating 1 city gives `1.05` fear.

> This is **not** unchanged from the turn-based build, as an earlier draft of this file
> claimed. That build awarded a flat 1 Fear per town and 2 per city, and nothing at all for
> an explorer. The formula above is the one implemented, because it is the one this pack
> specifies and because it gives explorers a value — which matters now that clearing a land
> of every invader is how a player denies Blight.

Fear is fractional by nature and is stored as a float. The UI renders it to one decimal;
upgrade costs are whole numbers, so a purchase can leave a fraction behind.

Fear accumulates in `meta.fear`, which persists across rounds; nothing in this design resets
it. `round.fearEarned` tracks the same income for the current round only, for the shop's
summary line.

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

Energy accumulates in `resources.energy` and **dies with the round**. `startRound` zeroes the
purse, empties `round.purchasedAbilityIds`, and clears `round.abilityTiers`: everything bought
during a round is given back when the next one starts.

That is the sharp line between the two currencies. Fear carries and buys permanent upgrades,
only between rounds. Energy is earned inside a round, spent inside that round, and gone when
it ends. So the shop decides *how fast a round can be rebuilt* and the fight decides *how far
that round gets* — and the two never trade against each other. See
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

The three prices total 35, which is roughly one early round's whole income — so which two a
round can afford is its first real decision, and buying all three means a round that lasted.
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
wash_away       cooldown 35 beats   push up to 3 explorers/towns out of a clicked land
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
pushed where?       one adjacent land holding no invaders at all. A coastal one wins outright
                    when there is one; among equals the lowest land id
```

The destination is deterministic, like every other tie on this board: the water always runs the
same way, so a push can be planned rather than gambled on. An earlier draft picked randomly
among the equals to stop a player farming one land into a permanent sink; predictability turned
out to be worth more than that. Note that the coastal preference and the lowest-id tie-break
never disagree here — the three coastal lands are `1`, `2` and `3`, the lowest ids on the board
— so the rule reads simply as "the lowest-numbered adjacent land with no invaders".

A unit carries its own damage with it, exactly — which is what per-unit health bought. Under
the old per-type model the destination kept the worse of the two wounds and the rest was lost.

### Failure to find a target

```txt
boon_of_vigor    never fails: it needs nothing on the board
rivers_bounty    never fails: there is always a thinnest land to reinforce
flash_floods     fails when no land holds invaders
wash_away        fails when no land holds a pushable unit *and* an empty neighbour - the one
                 target rule that reads two lands
innate_power     tier 1 as wash_away; tiers 2 and 3 need only invaders present
```

Tier 2 is deliberately looser than tier 1: its damage stands on its own, so a boxed-in land is
still a legal target and the cast still counts. Refusing at that point would rewind damage
already dealt and already paid Fear for.

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
cost(nextTier) = round(baseCost * 1.6 ^ tiersAlreadyOwned)

dahan_reinforcement  baseCost 4    4, 6, 10, 16, 26, ...
blight_resilience    baseCost 6    6, 10, 15, 25, 39, ...
swift_currents       baseCost 5    5, 8, 13, 20, 33, ...   (max tier 12)

cooldownReductionPct = 1 - 0.95 ^ tier          multiplicative, so it never reaches zero
```

All placeholder. The growth rate is the only thing keeping the shop from being a flat
checklist, and it has not been checked against how much Fear a round actually earns.

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
