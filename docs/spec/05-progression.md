# 05 Progression

## Intent

Document the permanent meta-progression loop: Fear as a persistent currency, the upgrade
shop it funds, and what carries across rounds versus what resets.

## Rules

- Progression in this design happens entirely between rounds. Nothing purchased mid-round
  exists, because the shop only opens once `round.status` is `ended`.
- A permanent upgrade, once purchased, applies to every round from then on. There is no
  respec and no way to lose a purchased upgrade short of a save wipe.
- `meta.fear` is the only currency. There is no second meta-currency in this slice.

## Meta State

### Fear

- `meta.fear` accumulates from every invader defeat, in every round, and is never reset by a
  round ending — win or lose, the Fear earned stays.
- It is spendable only in the between-round shop.
- See [04-economy-formulas.md](./04-economy-formulas.md) for the defeat-to-Fear formula.

### Round Tracking

- `meta.totalRoundsPlayed` increments every time a round ends.
- `meta.bestRoundReached` updates whenever `round.number` at round-end exceeds it. This is
  the run's headline score.

### Permanent Upgrades

- `upgrades.purchased` holds every upgrade bought, keyed by upgrade id, with whatever count
  or tier that upgrade tracks (a flat unlock is `true`; a repeatable upgrade tracks its
  purchased tier as a number).
- Applied at round setup — see [Round Reset Formula](./04-economy-formulas.md#round-reset-formula).

### Placeholder Upgrade Catalogue

First-draft shop entries, for internal consistency while the loop is being built. Costs and
magnitudes are not balanced yet.

| Upgrade id | Effect | Repeatable |
| --- | --- | --- |
| `dahan_reinforcement` | +1 starting Dahan | Yes, stacking |
| `blight_resilience` | +1 Blight threshold | Yes, stacking |
| `swift_currents` | -5% to all ability cooldowns | Yes, stacking, diminishing |
| `unlock_<ability_id>` | Unlocks a new ability for the ability bar | No, one-time |

Costs scale with the tier already purchased so the shop stays a real choice instead of a
flat checklist; the exact curve is a balancing task, not a loop mechanic.

## What Is Not Yet Progression

- No additional spirit unlocks.
- No second meta-currency (a prestige layer above Fear, if one is ever wanted).
- No content unlocks beyond the placeholder ability-unlock row above.
- No mid-round progression of any kind — everything in-round resets at round setup.

## Current Design Constraint

Every progression field is meant to be forward-compatible: `upgrades.purchased` can grow new
keys without a schema change, and `meta` can grow new tracked totals the same way the
turn-based build's `progression` object did.

## Acceptance

- A reader can tell which progression systems are functional today versus placeholder
  content, per [Implementation Microtasks](../tasks/implementation-microtasks.md).
- Fear earned in a round survives that round ending, regardless of outcome.
- A purchased upgrade is still in effect after any number of further rounds, without being
  re-purchased.
- `meta.bestRoundReached` never decreases.
