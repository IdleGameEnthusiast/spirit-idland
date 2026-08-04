# 04 Economy and Formulas

## Intent

Document the currently implemented numeric rules and constants.

## Rules

- This file describes the live prototype values, not target future balance.
- Any number listed here should map directly to a constant or formula in the current code.
- Planned systems that do not currently affect play must be called out as placeholders.

## Implemented Constants

```txt
VERSION = 1.5.0
STARTING_ENERGY = 20
ACTION_INTERVAL_SECONDS = 7
ACTION_MAX_CHARGES = 3
MAX_OFFLINE_HOURS = 12
DAHAN_PER_ROUND_START = 3
DAHAN_MAX_ADD_PER_AREA = 2
DEFEAT_FX_MS = 1200
```

## Unit Stats

```txt
Explorer: health 1, damage 1
Town: health 2, damage 2
City: health 3, damage 3
Dahan: health 2, damage 2
```

## Card Costs

```txt
Boon of Vigor = 0
Flash Floods = 2
River's Bounty = 0
Wash Away = 1
```

## Action Economy

```txt
playCard requires:
	selectedGrowthOption is not empty
	pendingEffect is null
	actions.charges > 0
	energy >= card.cost

successfulCardPlay:
	actions.charges -= 1
	resources.energy -= card.cost
	turn.powerCardsPlayed += 1
```

Action recharge is time-based and capped at `ACTION_MAX_CHARGES`.

## Fear Formula

Fear is currently generated only from defeated invader power value.

```txt
fearGain = defeatedPower * 0.35
```

Where `defeatedPower` is the defeated unit's damage value from `UNIT_STATS`.

Examples:

- Defeating 1 explorer gives `0.35` fear.
- Defeating 1 town gives `0.70` fear.
- Defeating 1 city gives `1.05` fear.

## Card Effect Formulas

### Boon of Vigor

```txt
energyGain = turn.powerCardsPlayed
```

Because the play counter increments before the card effect resolves, Boon of Vigor includes itself in the count.

### Flash Floods

```txt
damage = 2 if land == wetlands else 1
```

Damage is applied against one chosen invader type and may either defeat units or leave partial carry damage for the turn.

### River's Bounty

```txt
gatherLimit = 2 Dahan total
bonus triggers if destinationDahan >= 2 after gather
bonus = +1 Dahan at destination and +1 energy
```

### Wash Away

```txt
pushLimit = 3 total explorers and towns
```

Cities are not movable by Wash Away in the current implementation.

## Offline Handling

- Offline return currently advances action recharge and elapsed run time only.
- Offline return does not generate passive energy or fear because both rates are currently `0`.

## Placeholder Fields

- `rates.energyPerSecond` and `rates.fearPerSecond` exist but are currently always `0`.
- `turn.powerCardsGained` and `turn.presencesPlaced` are tracked but do not unlock new gameplay yet.

## Acceptance

- All constants here match the live implementation.
- No undocumented balance rule affects the current prototype.
- Placeholder systems are explicit so future work can extend them cleanly.
