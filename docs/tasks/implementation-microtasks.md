# Spirit Idland Implementation Microtasks

This pack pivoted from a turn-based, presence-driven prototype to a round-based, real-time
survival loop (see [docs/spec/index.md](../spec/index.md)). The live code still implements
the turn-based version described in the "Retired Foundation" section below. The "Round-Based
Redesign" section is the build order for catching the code up to the current spec.

## Round-Based Redesign

### Task R1: Round State Model & Reset

- Goal: land the new `03-state-contract.md` shape — `meta`, `round`, `abilities`,
  `pendingAbilityTarget`, `upgrades.purchased` — and the hard-reset migration from a
  `2.0.0` save.
- Inputs: [03-state-contract.md](../spec/03-state-contract.md)
- Acceptance: a fresh save produces the canonical shape; a `2.0.0` save loads via hard reset
  and logs why; save/load round-trips the new fields without loss.

### Task R2: Automatic Wave Resolution

- Goal: replace click-driven Ravage/Build/Discover with the timer-driven wave cycle —
  `WAVE_INTERVAL_SECONDS` countdown, auto-resolve, auto-shift the invader track.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md#wave-resolution),
  [09-island-board.md](../spec/09-island-board.md#invader-phases)
- Acceptance: with no player input, waves resolve on schedule and keep resolving until the
  round ends; Build and Discover keep their existing per-land rules from the turn-based
  build, only their trigger changes.

### Task R3: Automatic Dahan Counterattack

- Goal: replace the player-assigned `ravageCounter` targeting queue with the auto-spend rule
  (highest invader tier present first).
- Inputs: [02-core-loop.md](../spec/02-core-loop.md#ravage-now-automatic)
- Acceptance: a Ravage with surviving Dahan resolves its counterattack in the same step,
  with nothing left pending afterward.

### Task R4: Blight

- Goal: implement Blight as the round's sole loss condition — gain per Ravaged land, bonus
  for an undefended land, round ends at threshold.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md#blight),
  [04-economy-formulas.md](../spec/04-economy-formulas.md#blight-formula)
- Acceptance: Blight only increases within a round; the round ends the instant it reaches
  `blightThreshold` and not before.

### Task R5: Fear as Persistent Meta-Currency

- Goal: move Fear from a tracked-only value to `meta.fear`, persistent across rounds and
  spendable only in the shop.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md#fear),
  [05-progression.md](../spec/05-progression.md)
- Acceptance: Fear earned in a lost round is still spendable afterward; nothing resets it
  except a save wipe.

### Task R6: Ability Bar

- Goal: replace the card hand with four cooldown-gated abilities, including the
  single-click land-targeting model for abilities that need one.
- Inputs: [02-core-loop.md](../spec/02-core-loop.md#abilities),
  [07-content-registry.md](../spec/07-content-registry.md#abilities)
- Acceptance: each ability is usable exactly when its cooldown is 0; triggering it resets
  the cooldown and, if it needs a target, arms `pendingAbilityTarget` until a legal land is
  clicked.
- Open question carried in: exact ability effects/numbers are placeholder: see
  [04-economy-formulas.md](../spec/04-economy-formulas.md#ability-formulas-placeholder-kit).
  Treat this task as "wire the cooldown/targeting machinery," with a follow-up balancing
  pass expected once it's playable.

### Task R7: Upgrade Shop

- Goal: the between-round screen — spend `meta.fear` on the placeholder upgrade catalogue,
  applied to the next round's setup baseline.
- Inputs: [05-progression.md](../spec/05-progression.md#placeholder-upgrade-catalogue),
  [04-economy-formulas.md](../spec/04-economy-formulas.md#round-reset-formula)
- Acceptance: a purchased upgrade is still in effect after any number of further rounds; the
  shop never blocks starting the next round.

### Task R8: UI Retrofit

- Goal: drop the presence-track, growth-option, and card-hand UI; add the round HUD (Blight
  meter, wave timer, Fear total), the ability bar with cooldown display, and the shop screen.
- Inputs: [06-ui-contract.md](../spec/06-ui-contract.md)
- Acceptance: Blight and the wave timer are visible without opening a panel; every ability's
  state is visible without hovering; the shop appears the instant a round ends.

### Task R9: Regression Harness for the Round Loop

- Goal: automate the checklist in [08-acceptance-tests.md](../spec/08-acceptance-tests.md),
  covering wave timing, Blight, ability cooldowns, and the shop.
- Inputs: [08-acceptance-tests.md](../spec/08-acceptance-tests.md)
- Acceptance: core round flow (setup, waves, Blight loss, shop, next round) is
  regression-tested automatically, not only by manual smoke test.

## Retired Foundation

These describe the turn-based prototype's build history. Board geometry, unit stats, and
damage math (marked *reused*) carry forward into the round-based redesign; presence, growth,
and card-specific work (marked *retired*) does not and needs no further investment.

### Task 01: Canonical State Model — *retired, superseded by Task R1*

- Status: complete for the turn-based `2.0.0` shape.
- Output in build: schema versioning, normalization, migration-safe defaults, local save
  structure.

### Task 02: Save and Load — *reused*

- Status: complete.
- Output in build: localStorage save/load with no time-based or offline progress. The
  no-offline-catchup pattern carries forward to round time; see
  [04-economy-formulas.md](../spec/04-economy-formulas.md#offline-handling).

### Task 03: UI Shell and Four-Terrain Map — *reused (superseded layout, same board)*

- Status: complete for the turn-based layout; the eight-land board itself (Task 15) is what
  carries forward.

### Task 04: Starter River Cards — *retired, superseded by Task R6*

- Status: complete as cards. Boon of Vigor, Flash Floods, River's Bounty, Wash Away carry
  forward by name only, as abilities with redesigned effects.

### Task 05: Invader Phase Track — *reused, retrigger changes in Task R2*

- Status: complete for click-driven resolution. The Ravage/Build/Discover rules and terrain
  track reuse directly; only the trigger (click → timer) changes.

### Task 06: Dahan Layer — *reused*

- Status: complete. Per-land Dahan counts and the setup distribution carry forward into
  round setup (Task R1).

### Task 07: Targeting Locks — *retired*

- Status: complete for the turn-based growth-first / pending-effect lock model. No
  equivalent exists in the round-based design — nothing in a round blocks on player input.

### Task 08: Damage and Defeat Feedback — *reused*

- Status: complete. Unit HP model, partial damage carry, and fear-from-defeat all carry
  forward unchanged.

### Task 09 / 09b / 09c: Presence, Power Gain, Essence — *retired*

- Status: presence placement and per-land Essence generation were completed for the
  turn-based build. Both are retired in the round-based design; Essence's pools stay in the
  schema as inert placeholders (see [09-island-board.md](../spec/09-island-board.md#essence)).
  Essence sinks are no longer an open question worth pursuing until Essence itself returns.

### Task 10: Fear Threshold Effects — *superseded by Task R5*

- The turn-based goal ("fear thresholds trigger a rules change") is superseded by Fear
  becoming the round-based shop's currency outright, which is a stronger payoff than a
  threshold effect would have been.

### Task 11: Ravage Resolution — *reused, auto-counterattack in Task R3*

- Status: complete for player-driven resolution. The combat math (invader damage, Dahan
  destruction, counterattack pool) reuses directly; only who assigns the counterattack
  changes.

### Task 12: Automated Regression Harness — *superseded by Task R9*

### Task 13: Blight — *superseded by Task R4*

- The turn-based framing ("Blight slows Essence generation") is superseded: Blight is now
  the round's sole loss condition, not an Essence malus.

### Task 14: Presence Tracks — *retired*

- Status: complete for the turn-based build. No equivalent in the round-based design; see
  Task R7 for its replacement, the permanent upgrade shop.

### Task 15: The Island Board — *reused*

- Status: complete. The eight-land board, adjacency, SVG rendering, and terrain colour rules
  all carry forward unchanged; see [09-island-board.md](../spec/09-island-board.md).
