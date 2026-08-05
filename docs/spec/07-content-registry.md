# 07 Content Registry

## Intent

List the content records the round-based redesign needs: spirits, abilities, permanent
upgrades, terrain, board, and units.

## Rules

- IDs in this file are the target IDs for the round-based design; they are not all live in
  code yet (see [index.md](./index.md)).
- Content documented here is limited to what this pack actually specifies.
- Content marked placeholder is for internal consistency while the loop is built, not a
  balancing decision.

## Spirits

### Spirit Record

```json
{
  "id": "core_spirit_01",
  "name": "Reissende Fluten im Sonnenlicht",
  "englishName": "River Surges in Sunlight",
  "traits": "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
  "traitsEn": "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
  "abilityIds": ["boon_of_vigor", "wash_away", "flash_floods", "rivers_bounty"],
  "roundStartDahan": { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }
}
```

Only `core_spirit_01` is planned for this slice. `roundStartDahan` replaces the old
`startingPresence` map: it's the per-land Dahan distribution round setup applies before any
permanent `dahan_reinforcement` upgrades are added on top. `pushPowerMult` and
`strikePowerMult` from the turn-based record have no consumer yet and are dropped rather than
carried forward unused; they can return once an ability actually reads them.

## Abilities

Abilities replace both the turn-based starter cards and the growth options — there is no
separate growth-choice content anymore, since round setup applies the permanent-upgrade
baseline automatically rather than the player choosing among options each cycle.

### Ability Record Shape

```json
{
  "id": "flash_floods",
  "name": "Flash Floods",
  "cooldownSeconds": 12,
  "needsTarget": true,
  "effect": "damage_one_type"
}
```

### Placeholder Ability Set

Carried over by name from the turn-based starter cards; effects redesigned for the
cooldown model. See [04-economy-formulas.md](./04-economy-formulas.md#ability-formulas-placeholder-kit)
for the numbers.

#### `boon_of_vigor`

- Cooldown: 20s
- Needs target: no
- Effect: reduce every other ability's current cooldown by 5s.

#### `wash_away`

- Cooldown: 15s
- Needs target: no
- Effect: push all explorers/towns out of the most-Blighted ravaged land into an adjacent
  land.

#### `flash_floods`

- Cooldown: 12s
- Needs target: yes, one land holding at least one invader
- Effect: 2 damage to one invader type in the clicked land. (The turn-based wetlands damage
  bonus is dropped for now — pending a decision on whether terrain should still matter to
  abilities.)

#### `rivers_bounty`

- Cooldown: 18s
- Needs target: yes, any land
- Effect: +2 Dahan in the clicked land.

## Permanent Upgrades

### Upgrade Record Shape

```json
{
  "id": "dahan_reinforcement",
  "repeatable": true,
  "effect": "dahan_bonus_per_tier",
  "baseCost": 5
}
```

### Placeholder Upgrade Set

See [05-progression.md](./05-progression.md#placeholder-upgrade-catalogue) for the full
table and cost-curve note.

- `dahan_reinforcement` — repeatable, +1 starting Dahan per tier.
- `blight_resilience` — repeatable, +1 Blight threshold per tier.
- `swift_currents` — repeatable, -5% ability cooldowns per tier, diminishing.
- `unlock_<ability_id>` — one-time, adds an ability to the active spirit's `abilityIds`.

## Terrain Registry

- `mountains`
- `desert`
- `jungle`
- `wetlands`

This pack says `desert` where Spirit Island says *Sands*. The rename is deliberate and
stays.

## Board Registry

One fixed board, defined in `BOARD_LANDS`, unchanged by the round-based redesign. Eight
lands, exactly two of each terrain, three coastal lands, and adjacency that counts even a
corner touch. See [09-island-board.md](./09-island-board.md) for the full table and its
consequences.

## Unit Registry

### Invaders

- `explorers`
- `towns`
- `cities`

### Local Allies

- `dahan`

`presence` is retired as a unit — nothing places or reads it in this design.

## Resource Registry

### Active

- `fear` (`meta.fear`) — the sole spendable currency, persistent across rounds.

### Parked

- `energy` (`resources.energy`) — schema field kept, no writer or reader. See the Energy
  open question in [02-core-loop.md](./02-core-loop.md#open-question-energy).
- `essence` — four terrain pools kept as inert placeholders. No generator in this design;
  see [09-island-board.md](./09-island-board.md#essence) for what's retired versus kept.

## Localization Registry

- All visible player-facing strings are defined in the `I18N.de` and `I18N.en` tables.
- New content must provide both German and English display strings.

## Acceptance

- Every content ID in this file is either live or explicitly marked placeholder.
- A future contributor can add an ability or upgrade without renaming existing IDs.
- Content descriptions match the round-based design this pack specifies.
