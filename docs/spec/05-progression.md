# 05 Progression

## Intent

Document what progression exists now and what is only scaffolded for later.

## Rules

- Only shipped progression behavior belongs in the implemented section.
- Counter fields that currently exist without downstream payoff must be listed as placeholders.
- Multi-run meta progression is not implemented yet.

## Implemented Progression

### Spirit Access

- The build is locked to one spirit: `core_spirit_01`.
- Save normalization forces single-spirit mode even when older data suggests otherwise.

### Run Tracking

- `progression.totalEnergySpent` increases whenever card energy is successfully spent.
- `progression.totalFearGenerated` increases whenever fear is awarded from defeated invaders.

### Turn Tracking

- `turn.powerCardsPlayed` tracks how many cards have resolved this turn.
- `turn.powerCardsGained` tracks growth choices that would grant a power card later.
- `turn.presencesPlaced` tracks growth choices that would place presence later.

### Minimal Spirit Metrics

- `spirit.growthLevel` exists and is displayed.
- `milestones.unlockedCount` and `milestones.lastNotice` exist for future expansion.

## What Is Not Yet Progression

- No additional spirit unlocks.
- No legacy currency.
- No reset loop.
- No fear tier gameplay consequences beyond tracked fear value and display copy.
- No presence track payoff from `presencesPlaced`.
- No content unlocks tied to `powerCardsGained`.

## Current Design Constraint

The prototype uses progression counters mainly as forward-compatible save fields so future work can add meaning without another schema reset.

## Acceptance

- A reader can tell which progression systems are functional today.
- Placeholder progression fields are documented so they are not mistaken for bugs.
- Future progression work can extend the existing tracked totals rather than rename them.
