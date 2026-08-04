# Spirit Idland Implementation Microtasks

Use this sequence for the current River prototype. Completed items describe work already in the build; future items describe the next useful slices.

## Completed Foundation

### Task 01: Canonical State Model

- Status: complete
- Output in build: schema versioning, normalization, migration-safe defaults, local save structure
- Acceptance met: state serializes and loads with current fields intact

### Task 02: Save, Load, and Offline Resume

- Status: complete
- Output in build: localStorage save/load and offline action recharge handling
- Acceptance met: resumed state preserves board and deck state

### Task 03: UI Shell and Four-Terrain Map

- Status: complete
- Output in build: fixed panel layout, hand UI, invader track, event log, map interactions
- Acceptance met: all critical controls visible on one screen

### Task 04: Starter River Cards

- Status: complete
- Output in build: Boon of Vigor, Flash Floods, River's Bounty, Wash Away
- Acceptance met: each card resolves or starts its effect flow correctly

### Task 05: Invader Phase Track

- Status: complete
- Output in build: Ravage, Build, Discover lanes with terrain advancement and invader spawning
- Acceptance met: end turn advances phases and updates counts

### Task 06: Dahan Layer

- Status: complete
- Output in build: separate Dahan counts, start-of-run distribution, River's Bounty interaction support
- Acceptance met: Dahan are not mixed into invader counters

### Task 07: Targeting Locks

- Status: complete
- Output in build: growth-first lock, pending-effect lock, end-turn lock, post-resolution unlock behavior
- Acceptance met: cards and turn flow cannot bypass active targeting sequences

### Task 08: Damage and Defeat Feedback

- Status: complete
- Output in build: unit HP model, partial invader damage carry, fear-from-defeat, HP hints, defeat animation
- Acceptance met: nonlethal and lethal damage are both visible to the player

## Next Recommended Tasks

### Task 09: Presence and Power Gain Payoff

- Goal: make `powerCardsGained` and `presencesPlaced` do something visible.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md), [05-progression.md](../spec/05-progression.md)
- Acceptance: each growth option produces a real gameplay payoff beyond counters.

### Task 10: Fear Threshold Effects

- Goal: turn fear from a tracked number into a functional system.
- Inputs: [04-economy-formulas.md](../spec/04-economy-formulas.md), [05-progression.md](../spec/05-progression.md)
- Acceptance: fear thresholds trigger at least one live rules change or reward.

### Task 11: Ravage Resolution

- Goal: make the Ravage phase affect invaders, Dahan, or the board instead of being display-only.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md), [03-state-contract.md](../spec/03-state-contract.md)
- Acceptance: end turn creates a visible ravage consequence according to documented rules.

### Task 12: Automated Regression Harness

- Goal: replace manual-only verification with runnable tests.
- Inputs: [08-acceptance-tests.md](../spec/08-acceptance-tests.md)
- Acceptance: core turn flow and targeting effects can be regression-tested automatically.
