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
- Needs target: yes — one land holding at least one Explorer or Town. Where they go is never in
  doubt, so unlike an earlier draft this reads only the clicked land.
- Effect, **inland**: push up to 3 explorers/towns into an adjacent land. Towns first, each unit
  carrying its own damage with it, into open ground where there is any and onto an occupied
  neighbour where there is not. Deterministic, not random — see
  [04-economy-formulas.md](./04-economy-formulas.md#pushing).
- Effect, **coastal**: the water keeps going. Up to `seaCount` (2) explorers/towns are carried
  out to sea and removed from the island, healthiest first, paying Fear and Energy exactly as a
  defeat does. This is the kit's only removal that is not damage, and the reason the ability
  still earns its cooldown once the invader health ladder has outgrown 2 damage.
- Cities never move and never drown: a City is built into the land.

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

- `dahan_reinforcement` — repeatable, +1 starting Dahan per tier. `baseCost` 10, max tier 8.
- `blight_resilience` — repeatable, +1 Blight threshold per tier. `baseCost` 3, max tier 5.
- `headwaters` — repeatable, the Energy every round opens with. `baseCost` 8, max tier 9. The
  gain is a table rather than a per-tier step, `STARTING_ENERGY_BY_TIER` — 1 / 2 / 3 / 5 / 8 /
  13 / 19 / 26 / 35 — because it climbs with the price instead of staying flat; read it through
  `startingEnergyForTier`, which clamps a tier past the end of the table to its top rather than
  answering `undefined`. It is the only row that spends Fear and pays out in Energy, and the
  only one whose worth shrinks with depth. Its ceiling is exactly the unlock kit (5 + 10 + 20).
- `rising_dread` — repeatable, **soft-capped**, +10% Fear from defeated invaders per tier.
  `baseCost` 6.
- `mounting_terror` — repeatable, **soft-capped**, +10% Fear from surviving waves per tier.
  `baseCost` 6.
- `high_water_mark` — repeatable, **soft-capped**, every 10th wave pays a bonus of `tier * 10%`
  of its own wave number as Fear. `baseCost` 12. `mounting_terror` multiplies the payout, since
  the payout is wave income; that interaction is why the pair is priced as a pair. It is the
  only income in the game that is quadratic in depth, and the only one that arrives as an event
  rather than as a rate — which is why it is also the only one with a HUD flash.

- `dahan_remember` — *The Dahan Remember*, repeatable and the catalogue's one **pool**:
  `costGrowth: 1`, `baseCost` 1, `maxTier` 10000, `bulkAmounts: [1, 10, 100, 1000]`. Its tier
  is the Fear invested, and the Fear invested is haste on the Dahan strike clock —
  `interval / (1 + invested / 10000)`, capped at 100% haste, which halves it. Bought in
  denominations plus a Max button rather than one rung at a time, and its row shows the haste
  where a ladder shows its tier (`upgradeStatusText`). Carries `requiredForGate: false`. Read
  the formula in
  [04-economy-formulas.md](./04-economy-formulas.md#the-interval-and-the-one-thing-that-shortens-it).

A **soft-capped** row has no `maxTier`, which `upgradeIsSoftCapped` derives rather than the
record declaring twice. It is never "maxed", so it
never sinks into the shop's sold-out half and never shows a `Maximum` button — it shows a bare
tier number and a price, forever.

`requiredForGate: false` is a separate matter, and about the gate rather than about the shape
of the ladder: it takes a row out of the "everything else is bought" test. Every soft-capped
row must carry it, or the gate could never open; `dahan_remember` carries it because 10000
Fear is a wall. See
[04-economy-formulas.md](./04-economy-formulas.md#which-rows-the-gate-counts).
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
  Tier 1's list is written for what one push can actually buy — position, never a kill — and
  is deliberately the *last* automation to resolve each tick: it has the shortest cooldown and
  the weakest effect in the kit, so going first meant the automations that kill and remove
  chose their target on a board it had already stirred. Its rungs are break a Build, route an
  undefended unit into Dahan cover, then carry an inland unit onto an open coast where
  `wash_away` can reach it. There is no protect-the-thin-stack rung at tier 1 — it exists at
  tier 2 and on `wash_away`, where the push moves three units and shifts real pressure. At one
  unit it saved no stack and was the exact mirror of the routing rung above it, so on an
  8-beat clock against the 10-beat Dahan strike it only shuttled the same unit back and forth
  across the same border.
The three ability automations below are ranked by what their ability puts on the board or takes
off it, not by how much clicking they save: the Bounty reinforces, the Floods kill, and the sea
removes. Each rung up is a stronger claim on the round than the one under it.

- `auto_bounty` — one-time, `rivers_bounty` casts itself; the ability already picks its own
  land, so there is no judgement here to buy back. `baseCost` 200 — the cheapest of the three,
  and deliberately under the last rung of the `dahan_reinforcement` ladder (about 268), which
  is what it used to be priced against: the ladder sells one Dahan for a whole round and this
  sells one every 15 beats, so the ladder is the early lever and this is what replaces it.
- `auto_flash_floods` — one-time, `flash_floods` casts itself and picks its own land.
  `baseCost` 300 — dearer than the Bounty because it kills, and a defeat pays Fear and Energy
  at once where a Dahan only holds ground. Its priority list is read off kills rather than off
  position: a Build threat the flood would empty, then anywhere the cast defeats a unit, then
  the steepest live Blight source; ties go to the land the flood hits hardest, which is a coast
  before an inland. No priority means no cast and no cooldown.
- `auto_wash_away` — one-time, `wash_away` casts itself and picks its own land. `baseCost`
  400 — the dearest of the three, and the only automation whose worth *grows* with the round:
  the sea takes a unit off the island whole, so it pays a defeat's Fear and Energy without
  spending damage to do it, and it costs the same on the fortieth wave as on the first while
  every damage number in the kit is losing ground to invader health. Its priority list is split
  the way the ability is: a Build threat the cast would empty, then the coast the sea empties
  hardest, then an undefended land whose push lands on open ground holding Dahan, then the
  thinnest defended land. The last two require **open ground** — the occupied-neighbour
  fallback is a trade a player can see the cost of and an automation cannot.
The last two rows are behind a **gate** rather than behind a price (`GATED_UPGRADE_IDS`, read
through `upgradeIsLocked`). Neither is for sale until every other upgrade in the catalogue is
finished — every repeatable at its max tier, every one-off bought. Between them they hand over
the last two things still done by hand each round, so they are what finishing the shop pays for
rather than an alternative to finishing it. The pair does not gate *itself*: "everything else"
is defined by excluding the pair, because read the other way each would wait on the other and
neither would ever open. `purchaseUpgrade` refuses a locked row before it looks at the price,
so a player holding the Fear is told the real reason.

- `auto_buy_abilities` — one-time, gated. Each tick, this round's Energy spends itself on the
  ability bar: the locked kit abilities first, cheapest before dearest (5 / 10 / 20), then one
  rung of the Innate's tier ladder if the Energy is still there. `baseCost` 200 — cheap for
  where it sits, deliberately: the gate is what holds it back, and what it sells is less than
  the automations under it. It spends Energy the round was already going to spend, in the order
  a settled player already spends it, and buys back the clicks rather than any new power.
  Unlocks come before tiers for two reasons that point the same way: an unlock is the cheaper
  claim on the same Energy, and it is what the three cast automations are waiting on — each of
  them idles all round on an ability that was never bought. It resolves before every auto-cast
  in the tick, so an ability it buys (which arrives ready, exactly as a clicked unlock does)
  can fire on the same tick. Purchases go through `unlockAbility` / `upgradeAbility`, so an
  automated buy and a clicked one are the same buy: same refusals, same log line.
- `auto_start_round` — one-time, gated, an ended round starts the next one by itself, subject
  to a toggle the player can switch off. `baseCost` 500 — the most expensive thing in the shop
  and the only one that changes the shape of the game rather than a number in it.

Every automation except `auto_buy_abilities` buys the *click*, never the ability: the Energy
unlock is still owed every round, and an automation with nothing unlocked to fire does nothing.
`auto_buy_abilities` buys the unlock instead of the cast — and still owes it every round, out
of that round's own Energy.

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
- **German strings use real umlauts, and `engine.js` is UTF-8 without a BOM.**

  This reverses an earlier rule. The source used to be ASCII-only with umlauts transliterated
  (`ae`, `oe`, `ue`) because this file had been corrupted once by a tool that re-encoded it,
  and a table of display strings is the worst possible place for a silent mojibake. That
  reasoning was sound but it assumed the corruption would be *invisible*. It no longer is:
  `tests/fear.test.js` carries an encoding guard with both halves it needs —

  - a **negative** check that no German string contains `Â`, `Ã` or `U+FFFD`, which is what a
    UTF-8 file read as ANSI turns every umlaut into; and
  - a **positive** check that the table still contains umlauts at all, which catches the other
    direction — a well-meaning pass transliterating back to ASCII would sail straight through
    the negative check while quietly undoing the change.

  With a red test standing behind it, prevention stopped being worth what it cost: `Doerfer`
  and `Wueste` read visibly wrong to a German player, and the volume of German text is only
  going to grow.

  **Two hazards remain, and both are about tooling rather than the browser.** `index.html`
  already declares `<meta charset="utf-8">`, so display was never the problem. But this is a
  Windows project: PowerShell 5.1's `Set-Content`/`Add-Content` default to the system ANSI
  codepage, so one command written without `-Encoding utf8` silently rewrites the file and
  mojibakes every string in it. Write these files with a UTF-8-aware editor, or from
  PowerShell via `[System.IO.File]::WriteAllText($path, $text, (New-Object
  System.Text.UTF8Encoding $false))`. And a `.ps1` script that *contains* umlauts is itself
  read as ANSI when it has no BOM, so a script doing the rewriting must keep its own source
  ASCII and build the replacement characters from char codes.

  Git needs no configuration for this — it stores bytes verbatim and does no encoding
  conversion, so there is nothing in `.gitattributes` that would help.
- Lines that name exactly one unit use the singular labels (`townsOne`, `citiesOne`), so a
  build log reads "+1 Dorf" rather than "+1 Doerfer".

## Acceptance

- Every content ID in this file is either live or explicitly marked placeholder.
- A future contributor can add an ability or upgrade without renaming existing IDs.
- Content descriptions match the round-based design this pack specifies.
