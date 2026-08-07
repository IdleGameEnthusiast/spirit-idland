# 07 Content Registry

## Intent

List the content records the round-based redesign needs: spirits, abilities, permanent
upgrades, terrain, board, and units.

## Rules

- Every ID in this file is live in `engine.js`.
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
  "abilityIds": ["innate_power", "boon_of_vigor", "rivers_bounty", "flash_floods", "wash_away"],
  "startingAbilityIds": ["innate_power", "boon_of_vigor"],
  "roundStartDahan": { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }
}
```

`abilityIds` is the spirit's whole kit — what the ability bar lists, locked entries included —
and its order is the bar's order: the Innate first because it is the only one that grows, then
the free faucet, then the three Energy unlocks in ascending price. The bar reads top to bottom
as the order a round is actually built in.

`startingAbilityIds` is the subset every round opens holding; the rest are bought with Energy
inside that round and recorded in `round.purchasedAbilityIds`. The two lists are separate
fields rather than one ordered list with a count, because the starting subset is a design
choice per spirit and need not be the first n of the kit.

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
  "unlockCost": 10,
  "cooldownSeconds": 50,
  "needsTarget": true,
  "effect": "flood_damage",
  "damage": 1,
  "coastalBonus": 1
}
```

`cooldownSeconds` is real seconds, and the source writes it as `25 * TIME_SCALE` rather than
as the 50 shown here: cooldowns are authored in beats so a change of game pace moves them in
step with the wave interval and leaves every cast rate where it was. See
[04](./04-economy-formulas.md#beats-and-time_scale). Everything downstream reads the field as
plain seconds — nothing scales it a second time.

A **tiered** ability carries a `tiers` array instead of the cooldown/effect fields, each entry
a whole record of its own:

```json
{
  "id": "innate_power",
  "unlockCost": 0,
  "tiers": [
    { "cooldownSeconds": 16, "needsTarget": true, "effect": "push_invaders", "pushCount": 1, "upgradeCost": 50 },
    { "cooldownSeconds": 32, "needsTarget": true, "effect": "damage_and_push", "damage": 2, "pushCount": 3, "upgradeCost": 250 },
    { "cooldownSeconds": 48, "needsTarget": true, "effect": "damage_each_invader", "damage": 2 }
  ]
}
```

A tier replaces the record wholesale rather than modifying the one below it, so tier 2 is a
different ability standing in the same slot and nothing has to reason about which fields a tier
may override. **Read a record through `abilityRecord(state, id)`, never straight out of
`ABILITIES`** — the raw entry for a tiered ability has no `cooldownSeconds` and no `effect` of
its own, and a caller reaching past it gets a record that quietly does nothing.

### The Ability Set

See [04-economy-formulas.md](./04-economy-formulas.md#ability-formulas) for the numbers, the
shared damage rule, and the shared push rule.

#### `innate_power`

- Unlock: free, in every round's opening hand
- Needs target: yes, at every tier
- Tier 1 (8 beats): push 1 explorer/town.
- Tier 2 (16 beats, 50 Energy): 2 damage, then push up to 3 explorers/towns. The two halves are
  independent — if the damage cleared the land, or every neighbour is occupied, the cast still
  counts.
- Tier 3 (24 beats, 250 Energy): 2 damage to **each** invader in the land, individually. This is the
  effect that per-unit health exists for: against 4 explorers, 2 towns and 2 cities it kills
  everything but the cities and leaves both of those at 1 health, which the old per-type damage
  model could not describe.

#### `boon_of_vigor`

- Unlock: free, in every round's opening hand
- Cooldown: 12 beats
- Needs target: no
- Effect: gain 1 Energy. It never fails — it needs nothing on the board.
- It is the round's only income that is not a kill, and at one Energy every 12 beats it is the floor
  under a round that is going badly.

#### `rivers_bounty`

- Unlock: 5 Energy
- Cooldown: 15 beats
- Needs target: no — it picks its own land
- Effect: +1 Dahan to the land with the fewest Dahan among those holding invaders; ties on the
  lowest land id. A contested land always outranks a quiet one however empty the quiet one is —
  the ability reinforces a fight first. When **no** land holds invaders it falls back to the
  land with the fewest Dahan on the board, same tie-break, so it never fails.
- The Dahan is **created**, not gathered. An earlier draft moved one out of the fullest
  neighbour, which made the ability a redistribution rather than a reinforcement.
- It picks its own land because "where is this most needed" has exactly one answer at any
  moment, and asking the player for it would be asking them to re-derive it under time pressure.

#### `flash_floods`

- Unlock: 10 Energy
- Cooldown: 25 beats
- Needs target: yes, one land holding at least one invader
- Effect: 1 damage, +1 more if the target land is coastal. Spent by the shared kill-first rule,
  so a point left over after a kill carries to the next target rather than being lost.

#### `wash_away`

- Unlock: 20 Energy
- Cooldown: 35 beats
- Needs target: yes — and it is the one target rule that reads two lands: the clicked land must
  hold a pushable unit *and* have a neighbour holding no invaders.
- Effect: push up to 3 explorers/towns into that neighbour. Towns first. Cities do not move,
  and each unit carries its own damage with it. With more than one free neighbour the units go
  to the lowest-numbered one — deterministic, not random.

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

- `dahan_reinforcement` — repeatable, +1 starting Dahan per tier. `baseCost` 4.
- `blight_resilience` — repeatable, +1 Blight threshold per tier. `baseCost` 6.
- `swift_currents` — repeatable, -5% ability cooldowns per tier, diminishing. `baseCost` 5,
  capped at tier 12.
- `unlock_<ability_id>` — one-time, adds an ability the active spirit's kit does not contain.
  **The machinery is implemented and no catalogue row uses it.** Unlocking a *kit* ability is
  now Energy's job and does not go through the shop at all; this key remains the path for a
  fifth ability from outside the kit. `unlockedAbilityIds()` still reads it, and normalization
  still accepts it, so that fifth ability is content work and not code work.
- `auto_boon` — one-time, `boon_of_vigor` casts itself once ready, no click needed. `baseCost`
  25 — priced as comfort, roughly one round's income, since the effect it buys back has no
  target and no decision in it.
- `auto_innate` — one-time, `innate_power` casts itself once ready, at whichever tier is
  currently owned; tiering up later never re-arms this. `baseCost` 100 — priced well above
  `auto_boon` because the Innate fires more often at every tier and, unlike the Boon, casting
  it is a real decision: which land. The auto-cast runs a per-tier priority list (see
  [08-acceptance-tests.md](./08-acceptance-tests.md#the-innate-power)) and skips the tick
  entirely, cooldown untouched, whenever no priority applies.

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

- `fear` (`meta.fear`) — earned per defeated invader, spent in the between-round shop on
  permanent upgrades. Fractional. Persistent across rounds.
- `energy` (`resources.energy`) — earned per defeated invader on the same power scale,
  spent at any time to unlock abilities. Whole-numbered. Persistent across rounds. See
  [02-core-loop.md](./02-core-loop.md#energy).

### Parked

- `essence` — four terrain pools kept as inert placeholders. No generator in this design;
  see [09-island-board.md](./09-island-board.md#essence) for what's retired versus kept.

## Localization Registry

- All visible player-facing strings are defined in the `I18N.de` and `I18N.en` tables in
  `engine.js` — including log lines, which the engine writes and the UI only displays.
- New content must provide both German and English display strings.
- German strings transliterate umlauts (`ae`, `oe`, `ue`) and the source stays ASCII-only.
  That is a deliberate robustness choice, not a stylistic one: this file has already been
  corrupted once by a tool that re-encoded it, and a table of display strings is the worst
  possible place for a silent mojibake.
- Lines that name exactly one unit use the singular labels (`townsOne`, `citiesOne`), so a
  build log reads "+1 Dorf" rather than "+1 Doerfer".

## Acceptance

- Every content ID in this file is either live or explicitly marked placeholder.
- A future contributor can add an ability or upgrade without renaming existing IDs.
- Content descriptions match the round-based design this pack specifies.
