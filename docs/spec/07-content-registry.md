# 07 Content Registry

## Intent

List the current shipped content and the record shapes already implied by the implementation.

## Rules

- IDs in this file must match the live code.
- Content documented here is limited to what is actually implemented.
- Future content templates may be added, but they must be labeled as future-facing.

## Spirits

### Implemented Spirit Record

```json
{
  "id": "core_spirit_01",
  "name": "Reissende Fluten im Sonnenlicht",
  "englishName": "River Surges in Sunlight",
  "traits": "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
  "traitsEn": "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
  "energyRateMult": 1.05,
  "fearRateMult": 1,
  "pushPowerMult": 1.2,
  "strikePowerMult": 0.9
}
```

Only `core_spirit_01` is available today.

## Growth Options

### Registry Shape

```json
{
  "id": "reclaim_and_power",
  "labelToken": "growthOptionReclaim"
}
```

### Implemented Growth IDs

- `reclaim_and_power`
- `double_presence`
- `power_and_presence`

## Starter Cards

### Card Record Shape

```json
{
  "id": "wash_away",
  "name": "Wash Away",
  "cost": 1,
  "speed": "slow",
  "range": "Presence 1",
  "target": "Any",
  "elements": ["Water", "Earth"],
  "text": "Push up to 3 Explorer/Town."
}
```

### Implemented Card Set

#### `boon_of_vigor`

- Cost: 0
- Speed: fast
- Effect: gain 1 energy per power card played this turn.

#### `flash_floods`

- Cost: 2
- Speed: fast
- Effect: choose a terrain, then an invader type; deal 1 damage, or 2 in wetlands.

#### `rivers_bounty`

- Cost: 0
- Speed: slow
- Effect: gather up to 2 Dahan into a chosen destination, then add 1 Dahan and gain 1 energy if the destination has at least 2 Dahan.

#### `wash_away`

- Cost: 1
- Speed: slow
- Effect: choose source, choose up to 3 explorers/towns, then choose destination.

## Terrain Registry

- `mountains`
- `desert`
- `jungle`
- `wetlands`

## Unit Registry

### Invaders

- `explorers`
- `towns`
- `cities`

### Local Allies

- `dahan`

## Localization Registry

- All visible player-facing strings are defined in the `I18N.de` and `I18N.en` tables.
- New content must provide both German and English display strings.

## Acceptance

- Every current content ID is documented here.
- A future contributor can add content without renaming existing IDs.
- Content descriptions match the current live behavior, including multi-step effects.
