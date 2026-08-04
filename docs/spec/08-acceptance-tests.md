# 08 Acceptance and Tests

## Intent

Define the regression checks for the current implemented prototype.

## Rules

- Each shipped mechanic must have at least one concrete verification step.
- Manual smoke tests are acceptable until an automated test harness exists.
- Save/load and state normalization remain mandatory regression checks.

## Functional Checks

1. A fresh game starts with 20 energy, 1 action charge, a full 4-card hand, and 3 Dahan spread across terrains with no more than 2 newly added to one terrain.
2. The player cannot play a card before choosing growth.
3. The player cannot end the turn before choosing growth.
4. Playing a card spends 1 action charge and its energy cost.
5. `reclaim_and_power` returns all starter cards to hand and grants 1 energy.
6. End turn advances invader phases and adds the expected invaders to explore/build terrains.
7. End turn clears all partial invader damage.

## Targeting Effect Checks

### Wash Away

1. Playing Wash Away starts a source-selection state.
2. Only explorers and towns can be selected.
3. No more than 3 total units can be selected.
4. Destination must be different from source.
5. Other cards and End Turn stay locked until the push completes.
6. After destination selection, the lock is removed.

### Flash Floods

1. Playing Flash Floods starts land selection only when at least one invader exists.
2. The second step offers only invader types present in the chosen terrain.
3. Wetlands deals 2 damage; other terrains deal 1 damage.
4. Defeated units grant fear and show defeat feedback.
5. Nonlethal damage persists as HP hints until end turn.

### River's Bounty

1. Playing River's Bounty starts destination selection only when at least one Dahan exists.
2. After destination selection, one or more source terrains can be clicked.
3. Each source click moves exactly 1 Dahan into the destination.
4. No more than 2 Dahan can be gathered.
5. Cards and End Turn remain locked until Finish Gather is clicked.
6. Finishing the effect applies the +1 Dahan and +1 energy bonus when the destination has at least 2 Dahan.

## Save and Migration Checks

1. Save and reload preserve the current turn number, growth choice, deck zones, invader counts, Dahan counts, fear, and energy.
2. Save and reload preserve a pending effect if the page is refreshed mid-targeting.
3. Older saves missing `invaderDamage`, `dahan`, or `riversBounty` fields normalize safely.
4. Invalid effect states normalize to `null` instead of corrupting the UI.

## UI Checks

1. The map always shows four terrain panels.
2. Dahan are visually separated from invaders.
3. Card status text explains why an unplayable card is blocked.
4. The map hint text changes to match the active targeting step.
5. Defeat feedback appears briefly and then disappears.

## Current Validation Status

- Code-level validation currently relies on editor error checks plus manual browser smoke testing.
- No automated browser or unit test suite is implemented yet.

## Acceptance

- A contributor can manually verify every shipped mechanic from this file.
- The tests reflect the current River prototype, not the retired pressure-reset design.
- New mechanic work should extend this checklist before expanding scope.
