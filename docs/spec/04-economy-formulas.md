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
WAVE_INTERVAL_SECONDS = 10
BLIGHT_THRESHOLD_BASE = 10             (placeholder)
BLIGHT_PER_DAMAGE_SECOND = 0.02
DAHAN_LOSS_PER_DAMAGE_SECOND = 0.05      (under playtest)
BLIGHT_FLOOR_FRACTION = 0.25             (anti-stacking, under playtest)
DAHAN_CONCENTRATION_CAP = 2              (anti-stacking, under playtest)
DAHAN_ATTACK_INTERVAL_SECONDS = 10     (placeholder)
DAHAN_ATTACK_DAMAGE = 1                (placeholder)
DAHAN_PER_ROUND_START_BASE = 6
DAHAN_MAX_SPREAD = 2
DEFEAT_FX_MS = 1200
MAX_TICK_SECONDS = 5
```

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

## The Damage-Second

The whole fight runs on one currency. One point of damage sustained for one second is a
**damage-second**. 50 of them buy one Blight; 20 buy one Dahan casualty.

The two rates were equal at 0.02 in the first cut — one clock, read two ways — but Dahan
outlasted the pressure that was supposed to grind them down, so the casualty rate is raised
to 0.05 and under playtest. Blight stays at 0.02. If the casualty clock settles somewhere
else, only this constant moves; nothing is derived from the two being equal.

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

Worked examples, at the constants above:

```txt
1 explorer + 1 town + 1 city, 0 Dahan   6.0 net   12.0% / s   1 Blight every  8.3s
1 explorer + 1 town + 1 city, 2 Dahan   2.0 net    4.0% / s   1 Blight every 25.0s
1 explorer + 1 town + 1 city, 4 Dahan   1.5 net    3.0% / s   held, 1 every 33.3s
1 city, 2 Dahan                         0.75 net   1.5% / s   held, 1 every 66.7s
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

## Ability Formulas (placeholder kit)

First-draft cooldowns and effects for the four River abilities, carried over by name from
the turn-based starter cards. None of these numbers are tuned; see
[Implementation Microtasks](../tasks/implementation-microtasks.md) for the balancing task.

```txt
boon_of_vigor   cooldown 20s   effect: -5s to every other ability's current cooldown
wash_away       cooldown 15s   effect: push all explorers/towns out of the most-Blighted
                                        land into an adjacent land
flash_floods    cooldown 12s   effect: 2 damage to one invader type in a clicked land
rivers_bounty   cooldown 18s   effect: +2 Dahan in a clicked land
```

`flash_floods` and `rivers_bounty` need a land click (`pendingAbilityTarget`); `boon_of_vigor`
and `wash_away` resolve without one, per their placeholder effects above.

### Tie-breaks the one-click model forced

A single click cannot answer a follow-up question, so three "which one" decisions the draft
left open are resolved by rule instead. Each is deterministic, which is also what makes them
testable:

```txt
flash_floods, which type?     the highest tier present: cities, then towns, then explorers
                              (the same rule the Dahan strike already uses)
wash_away, which land?        the land with the highest round.blightByLand that still holds
                              an explorer or a town; ties break on the lowest land id
wash_away, pushed where?      the adjacent land holding the fewest invaders, so the push
                              relieves pressure rather than stacking it; ties on lowest id
```

`wash_away` has no legal source until some land has taken Blight, which is not before the
third wave. Triggered earlier it logs "no valid target" and keeps its cooldown, per
[09-island-board.md](./09-island-board.md#failure-to-find-a-target).

### Cooldown scaling

```txt
abilityCooldownSeconds(id) = max(1, ABILITIES[id].cooldownSeconds * round.abilityCooldownMult)
```

Deliberately not rounded to whole seconds: one `swift_currents` tier is worth 5% of 12s,
about 0.6s, and rounding would flatten the diminishing curve into equal steps. The ability
bar rounds up for display.

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
- `resources.energy` is present in the schema but has no writer or reader in this design.

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
> quoting any of it.

Five unattended rounds at the constants above, on an injected clock:

```txt
round length       87 - 120 seconds   (was 64 under the per-wave Ravage model)
waves to lose      8 - 11
first Blight       33 - 74 seconds    (was wave 3, about 24 seconds)
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

Raising the casualty clock to 0.05 (20 damage-seconds per casualty rather than 50) costs the
player 2-4 of their 6 Dahan per round without shortening the round much, which is what puts
the spiral on screen. Fear came down slightly with it — dead Dahan stop striking — but not
enough to matter against the shop's curve.

The remaining oddity is the spread on first Blight: 33s to 74s across five runs, driven by
whether the early Discover draws land on the two undefended lands. Worth watching, but the
variance is the terrain draw, not the rates. See
[index.md](./index.md#known-balance-problems).
