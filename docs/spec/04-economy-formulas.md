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
VERSION = 3.0.0
WAVE_INTERVAL_SECONDS = 8
BLIGHT_THRESHOLD_BASE = 10          (placeholder)
BLIGHT_PER_RAVAGED_LAND = 1         (placeholder)
BLIGHT_BONUS_UNDEFENDED_LAND = 1    (placeholder)
DAHAN_PER_ROUND_START_BASE = 6
DAHAN_MAX_ADD_PER_LAND = 2
DEFEAT_FX_MS = 1200
MAX_TICK_SECONDS = 5
```

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

Unchanged from the turn-based build.

## Wave Timing

```txt
waveTimerRemaining -= dt, each tick
when waveTimerRemaining <= 0:
    resolve one wave (Ravage, Build, Discover, track shift)
    waveTimerRemaining = WAVE_INTERVAL_SECONDS
```

There is no player control over this timer. It runs whenever the round is `running`.

## Blight Formula

```txt
for each land ravaged this wave:
    if land had invaders this Ravage:
        blightGain = BLIGHT_PER_RAVAGED_LAND
        if land.dahanCount == 0 before this Ravage:
            blightGain += BLIGHT_BONUS_UNDEFENDED_LAND
        round.blight += blightGain

round.blight = min(round.blight, round.blightThreshold)
if round.blight >= round.blightThreshold:
    round ends
```

Blight never decreases in this slice. A land with 0 Dahan effectively degrades the round
twice as fast as a defended one — this is Dahan's actual mechanical payoff, on top of the
counterattack itself.

## Fear Formula

Fear is generated only from defeated invader power, whether the defeat came from a Ravage
counterattack or an ability:

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

## Ravage Combat

Unchanged mechanically from the turn-based build, except the counterattack is now
auto-assigned rather than player-assigned:

```txt
invaderDamage  = explorers*1 + towns*2 + cities*3

dahanDestroyed = min(dahanCount, floor(invaderDamage / 2))
damage below a full 2 is discarded, not carried

survivors      = dahanCount - dahanDestroyed
dahanCounter   = survivors * 2

dahanCounter is spent automatically, 1 damage per step, on the highest-tier
invader type present in the land (cities, then towns, then explorers),
until the pool or the invaders run out
```

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
                              (the same rule the Dahan counterattack already uses)
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
six Dahan across lands 1, 2, 4, 5, 6 and 7. Purchased reinforcement is then added to the
**emptiest lands first**, ties on the lowest id, capped at `DAHAN_MAX_ADD_PER_LAND` added to
any one land. Deterministic on purpose: a round setup that can be asserted in a test is
worth more than one that surprises.

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

From an unattended round at the numbers above, traced wave by wave:

```txt
waves to lose      8
round length       64 seconds
first Ravage       wave 3 (the track starts with both earlier slots empty)
Fear earned        0.00
```

The zero is the finding: at 1 Dahan per land against 3+ invader damage, no counterattack
ever fires. See [index.md](./index.md#known-balance-problems).
