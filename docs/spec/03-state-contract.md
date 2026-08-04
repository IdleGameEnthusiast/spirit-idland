# 03 State Contract

## Intent

Define the canonical save shape used by the current browser build.

## Rules

- Field names in this document match the live implementation.
- Save files must carry `schemaVersion`.
- New fields must normalize safely when older saves are loaded.

## Canonical State Shape

```json
{
  "schemaVersion": "1.5.0",
  "time": {
    "totalSeconds": 0,
    "lastTickUnixMs": 0,
    "lastSaveUnixMs": 0
  },
  "resources": {
    "energy": 20,
    "fear": 0
  },
  "rates": {
    "energyPerSecond": 0,
    "fearPerSecond": 0
  },
  "spirit": {
    "activeSpiritId": "core_spirit_01",
    "unlockedSpiritIds": ["core_spirit_01"],
    "growthLevel": 0
  },
  "actions": {
    "charges": 1,
    "maxCharges": 3,
    "nextChargeInSeconds": 7,
    "intervalSeconds": 7
  },
  "ui": {
    "language": "de",
    "defeatFx": null
  },
  "turn": {
    "number": 1,
    "selectedGrowthOption": "",
    "powerCardsGained": 0,
    "presencesPlaced": 0,
    "powerCardsPlayed": 0
  },
  "invader": {
    "ravage": null,
    "build": null,
    "explore": "mountains"
  },
  "invaders": {
    "mountains": { "explorers": 0, "towns": 0, "cities": 0 },
    "desert": { "explorers": 0, "towns": 0, "cities": 0 },
    "jungle": { "explorers": 0, "towns": 0, "cities": 0 },
    "wetlands": { "explorers": 0, "towns": 0, "cities": 0 }
  },
  "invaderDamage": {
    "mountains": { "explorers": 0, "towns": 0, "cities": 0 },
    "desert": { "explorers": 0, "towns": 0, "cities": 0 },
    "jungle": { "explorers": 0, "towns": 0, "cities": 0 },
    "wetlands": { "explorers": 0, "towns": 0, "cities": 0 }
  },
  "dahan": {
    "mountains": 0,
    "desert": 0,
    "jungle": 0,
    "wetlands": 0
  },
  "effects": {
    "washAway": null,
    "flashFloods": null,
    "riversBounty": null
  },
  "progression": {
    "totalEnergySpent": 0,
    "totalFearGenerated": 0
  },
  "cards": {
    "drawPile": [],
    "discardPile": [],
    "hand": [],
    "maxHandSize": 4
  },
  "milestones": {
    "unlockedCount": 0,
    "lastNotice": ""
  },
  "_log": []
}
```

## Terrain Keys

- `mountains`
- `desert`
- `jungle`
- `wetlands`

## Effect Shapes

### `effects.washAway`

```json
{
  "step": "choose-source",
  "source": null,
  "explorers": 0,
  "towns": 0
}
```

Valid steps:

- `choose-source`
- `choose-units`
- `choose-destination`

### `effects.flashFloods`

```json
{
  "step": "choose-land",
  "land": null
}
```

Valid steps:

- `choose-land`
- `choose-target`

### `effects.riversBounty`

```json
{
  "step": "choose-destination",
  "destination": null,
  "moved": 0,
  "pulledFrom": {
    "mountains": 0,
    "desert": 0,
    "jungle": 0,
    "wetlands": 0
  }
}
```

Valid steps:

- `choose-destination`
- `choose-sources`

## Normalization Requirements

- Unknown language values must normalize to `de` unless explicitly `en`.
- All terrain maps must be filled for every terrain key.
- Invader damage cannot exceed the number of living invaders of each type in that terrain.
- All effect objects must be validated by step and terrain key and reset to `null` if invalid.
- Older saves must be migrated to a single-spirit mode with `core_spirit_01` active.

## Derived Runtime Behavior

- `createFreshGameState()` adds the initial Dahan distribution after base state creation.
- Loading a save may apply offline action recharge and elapsed run time before returning the normalized state.
- `endTurn()` clears `invaderDamage` but does not remove living invaders or Dahan.

## Acceptance

- Save and load round-trip without losing map counts, damage carry, deck state, or pending effects.
- New save fields can be added with defaults without breaking old saves.
- All other docs in this folder reference these exact top-level fields.
