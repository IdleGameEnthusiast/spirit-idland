# 07 Content Registry

## Intent

List the content records the round-based redesign needs: spirits, abilities, permanent
upgrades, terrain, board, and units.

## Rules

- Every ID in this file is live in `engine/content.js`.
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
    { "cooldownSeconds": 16, "needsTarget": true, "effect": "push_invaders", "pushCount": 1, "upgradeCost": 40 },
    { "cooldownSeconds": 30, "needsTarget": true, "effect": "damage_and_push", "damage": 2, "pushCount": 3, "upgradeCost": 150 },
    { "cooldownSeconds": 44, "needsTarget": true, "effect": "damage_each_invader", "damage": 2 }
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
- Tier 2 (15 beats, 40 Energy): 2 damage, then push up to 3 explorers/towns. The two halves are
  independent — if the damage cleared the land, or every neighbour is occupied, the cast still
  counts.
- Tier 3 (22 beats, 150 Energy): 2 damage to **each** invader in the land, individually. This is the
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
- Cooldown: 30 beats
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
- `rising_dread` — repeatable, max tier 10, +10% Fear from defeated invaders per tier.
  `baseCost` 6.
- `mounting_terror` — repeatable, max tier 10, +10% Fear from surviving waves per tier.
  `baseCost` 6.
- `high_water_mark` — repeatable, max tier 10, every 10th wave pays a bonus of `tier * 10%`
  of its own wave number as Fear. `baseCost` 12. `mounting_terror` multiplies the payout, since
  the payout is wave income; that interaction is why the pair is priced as a pair. It is the
  only income in the game that is quadratic in depth, and the only one that arrives as an event
  rather than as a rate — which is why it is also the only one with a HUD flash.

- `dahan_remember` — *The Dahan Remember*, repeatable and the catalogue's one **pool**:
  `costGrowth: 1`, `baseCost` 1, `maxTier` 10000, `bulkAmounts: [1, 10, 100, 1000]`. Its tier
  is the Fear invested, and the Fear invested is haste on the Dahan strike clock —
  `interval / (1 + invested / 10000)`, capped at 100% haste, which halves it. Bought in
  denominations plus a Max button rather than one rung at a time, and its row shows the haste
  where a ladder shows its tier (`upgradeStatusText`). Read the formula in
  [04-economy-formulas.md](./04-economy-formulas.md#the-interval-and-the-one-thing-that-shortens-it).

**Every row in this catalogue has a `maxTier`.** The three Fear ladders used to carry none —
`upgradeIsSoftCapped` derived "no top" from the missing field — and both the ladders and the
predicate are gone: ten tiers each now, and a predicate with no `false` case left to report.
So every row can sink into the shop's sold-out half, and none shows a bare price forever. See
[04-economy-formulas.md](./04-economy-formulas.md#the-ladders-are-capped-at-ten).
- `power_card_interval` — *The Island Remembers Sooner*, repeatable, max tier 10, `baseCost` 30.
  Each tier shortens the gap between power-card draws by one wave, 20 at tier 0 down to 10 at
  tier 10; the first draw stays at wave 25. See
  [10-power-cards.md](./10-power-cards.md#the-fear-row) for the cost table and the honest note
  that its rungs are lumpy against a 70-wave round.
- `unlock_<ability_id>` — one-time, adds an ability the active spirit's kit does not contain.
  **The machinery is implemented and no catalogue row uses it.** Unlocking a *kit* ability is
  now Energy's job and does not go through the shop at all; this key remains the path for a
  fifth ability from outside the kit. `unlockedAbilityIds()` still reads it, and normalization
  still accepts it, so that fifth ability is content work and not code work.
All five ability automations below carry a **switch on the ability's own card**, drawn from
the moment the upgrade is bought. Switching it off stops future casts and nothing else: no cooldown
is reset, shortened or lengthened, no cast is undone, nothing is refunded, and the upgrade is
never un-bought. Buying an automation is therefore not a one-way door — the ability goes back to
being played by hand for as long as the switch is off. See `ui.autoCast` in
[03-state-contract.md](./03-state-contract.md) and the card shapes in
[06-ui-contract.md](./06-ui-contract.md#ability-status-rules). `auto_buy_abilities` and
`auto_start_round` are not in this set: the first automates a purchase rather than a cast, and
the second already has its own toggle.

- `auto_boon` — one-time, `boon_of_vigor` casts itself once ready, no click needed. `baseCost`
  25 — priced as comfort, roughly one round's income, since the effect it buys back has no
  target and no decision in it. Switchable off from the card without being un-bought, though
  the Boon has no target and no decision, so unticking it can only make the player slower.
- `auto_innate` — one-time, `innate_power` casts itself once ready, at whichever tier is
  currently owned; tiering up later never re-arms this. `baseCost` 100 — priced well above
  `auto_boon` because the Innate fires more often at every tier and, unlike the Boon, casting
  it is a real decision: which land. The auto-cast runs a per-tier priority list (see
  [08-acceptance-tests.md](./08-acceptance-tests.md#the-innate-power)) and skips the tick
  entirely, cooldown untouched, whenever no priority applies.
  Every tier opens with the same two rungs, because they are the only two in the kit that stop
  invaders *arriving* rather than rearranging ones already ashore: **deny a Discover** its last
  foothold, and **break a Build**. Both are asked by simulating the tier's own cast against a
  scratch board, so the three tiers ask one question and only their answers differ. The deny
  rung reads `landAcceptsExplorer` — below `EXPLORE_UNRESTRICTED_FROM_WAVE` an inland land takes
  Explorers only while a neighbour holds a Town or City, so removing that Town cancels a whole
  seeding. It requires the set of gated lands to *shrink*: shoving the Town one land sideways
  can close one Discover land and open another, which is a cast for nothing. From wave 10 the
  rung goes quiet for the rest of the round.
  Tier 1 continues with **route into cover**, **consolidate onto more Dahan**, then **feed the
  sea**. Routing now simulates the arrival *and* the destination's next Dahan strike, so it
  fires only where the Dahan actually finish what lands — the old rung asked merely whether a
  Dahan stood there and happily sent Towns to lands that could not kill them. Consolidating
  requires *strictly* more Dahan at the destination than at the source, which is what makes it
  safe on an 8-beat clock: the move is monotone, so a unit can never be pushed back where it
  came from. That strictness is what replaced the old protect-the-thin-stack rung, which was
  the routing rung's exact mirror and shuttled one unit across one border all round.
  Tier 2 inserts **clear the land outright** above routing — certain where routing is a bet,
  and it removes a Blight source, a Build target and a Discover foothold at once — and gates
  its Blight fallback on the cast actually changing the land, so it no longer spends a cooldown
  scratching a land that holds nothing but Cities. Tier 3 alone puts break-a-Build *above* the
  deny: it has no push, so it pays for a deny with its whole area hit on a 22-beat clock, to
  stop a seeding of the weakest unit on the board.
  Within every rung the tie-break is the land bleeding the most Blight, never the lowest land
  id. The id order is arbitrary; where the island is actually hurting is not.
  The Innate is deliberately the *last* automation to resolve each tick: it has the shortest
  cooldown and the weakest effect in the kit, so going first meant the automations that kill
  and remove chose their target on a board it had already stirred.
  Switchable off from the card without being un-bought, and one of the three where that
  matters: the Innate picks a land, and a player may want that decision back.
The three ability automations below are ranked by what their ability puts on the board or takes
off it, not by how much clicking they save: the Bounty reinforces, the Floods kill, and the sea
removes. Each rung up is a stronger claim on the round than the one under it.

- `auto_bounty` — one-time, `rivers_bounty` casts itself; the ability already picks its own
  land, so there is no judgement here to buy back. `baseCost` 200 — the cheapest of the three,
  and deliberately under the last rung of the `dahan_reinforcement` ladder (about 268), which
  is what it used to be priced against: the ladder sells one Dahan for a whole round and this
  sells one every 15 beats, so the ladder is the early lever and this is what replaces it.
  Switchable off from the card without being un-bought, though like the Boon it picks its own
  land, so unticking it only costs the player clicks.
- `auto_flash_floods` — one-time, `flash_floods` casts itself and picks its own land.
  `baseCost` 300 — dearer than the Bounty because it kills, and a defeat pays Fear and Energy
  at once where a Dahan only holds ground. Its priority list is read off kills rather than off
  position: a Build threat the flood would empty, then anywhere the cast defeats a unit, then
  the steepest live Blight source; ties go to the land the flood hits hardest, which is a coast
  before an inland. No priority means no cast and no cooldown. Switchable off from the card
  without being un-bought.
- `auto_wash_away` — one-time, `wash_away` casts itself and picks its own land. `baseCost`
  400 — the dearest of the three, and the only automation whose worth *grows* with the round:
  the sea takes a unit off the island whole, so it pays a defeat's Fear and Energy without
  spending damage to do it, and it costs the same on the fortieth wave as on the first while
  every damage number in the kit is losing ground to invader health. Its priority list is split
  the way the ability is: a Build threat the cast would empty, then the coast the sea empties
  hardest, then an undefended land whose push lands on open ground holding Dahan, then the
  thinnest defended land. The last two require the push to **land on open ground** — asked of
  the destination itself, since cover now outranks openness in the destination rule. Wash Away
  keeps that stricter test where the Innate has relaxed it: it moves a whole land at once, so a
  stack it concentrates is a much bigger one, and the trade is one a player can see the cost of
  and an automation cannot. Switchable off
  from the card without being un-bought — the reason the toggle exists at all, since 400 Fear
  used to remove the ability from active play permanently.
The last two rows are behind **Presence** rather than behind Fear alone (`upgradeNeedsPresence`,
read from the Presence catalogue below). Each names a Presence row in `presenceUnlock`, and
until that row is bought the Fear row is locked whatever the purse holds. Between them they
hand over the last two things still done by hand each round.

They were behind a completion gate until the ascension layer landed — refused until every
other row in the catalogue was maxed, which was ~2,674 Fear and roughly ninety hand-played
rounds. That gate is deleted along with the idea it rested on, that the shop is a thing which
finishes; see
[05-progression.md](./05-progression.md#the-shop-no-longer-terminates). `purchaseUpgrade` still
refuses a locked row **before** it looks at the price: the unlock is the reason, never the
purse.

The shop **does not draw a locked row at all** — see
[06-ui-contract.md](./06-ui-contract.md#required-screen-sections). The two rows below therefore describe
what the player sees *after* the matching Presence purchase; before it, the only place either is
named is the ascension panel's catalogue, which is where the decision to open them is made.

**The Fear price is still owed, and owed again every cycle.** A Presence unlock puts the row in
the shop; it does not buy the row. So each cycle opens hand-played and 500 Fear is a live
decision against the five tiers of `rising_dread` it would otherwise buy — play this cycle
actively, or pay to idle it.

- `auto_buy_abilities` — one-time, Presence-locked behind `presence_river_knows`. Each tick,
  this round's Energy spends itself on the
  ability bar: the locked kit abilities first, cheapest before dearest (5 / 10 / 20), then one
  rung of the Innate's tier ladder if the Energy is still there. `baseCost` 200 — cheap for
  where it sits, deliberately: Presence is what holds it back, and what it sells is less than
  the automations under it. It spends Energy the round was already going to spend, in the order
  a settled player already spends it, and buys back the clicks rather than any new power.
  Unlocks come before tiers for two reasons that point the same way: an unlock is the cheaper
  claim on the same Energy, and it is what the three cast automations are waiting on — each of
  them idles all round on an ability that was never bought. It resolves before every auto-cast
  in the tick, so an ability it buys (which arrives ready, exactly as a clicked unlock does)
  can fire on the same tick. Purchases go through `unlockAbility` / `upgradeAbility`, so an
  automated buy and a clicked one are the same buy: same refusals, same log line.
- `auto_start_round` — one-time, Presence-locked behind `presence_tide_returns`, an ended round
  starts the next one by itself, subject to a toggle the player can switch off. `baseCost` 500
  — the most expensive one-off in the shop and the only one that changes the shape of the game
  rather than a number in it.

Every automation except `auto_buy_abilities` buys the *click*, never the ability: the Energy
unlock is still owed every round, and an automation with nothing unlocked to fire does nothing.
`auto_buy_abilities` buys the unlock instead of the cast — and still owes it every round, out
of that round's own Energy.

## Presence Catalogue

The ascension layer's shop, in `PRESENCE_UPGRADES`, keyed into `presenceUpgrades.purchased`.
Bought with `meta.presence`, which only `ascend()` pays out, and never lost to an ascension.

**Presence never touches the board.** It buys no Dahan, shortens no clock, adds no damage. That
is the rule the whole two-currency design rests on, and it is what makes the two impossible to
price against each other — see [05-progression.md](./05-progression.md#the-two-layers). What a
row buys instead is one of three things: permission for a Fear row to exist, a capability
directly, or a lower price on a Fear row.

### The rows that open something

| id | opens | cost |
| --- | --- | --- |
| `presence_tide_returns` — *Die Flut kehrt wieder* / The Tide Returns | `auto_start_round` in the Fear shop | 2 |
| `presence_river_knows` — *Der Fluss weiß, was er braucht* / The River Knows Its Own Need | `auto_buy_abilities` in the Fear shop | 3 |
| `presence_current_quickens` — *Die Strömung eilt* / The Current Quickens | Focus, directly — no Fear row, `abilityFocusUnlocked` reads it | 5 |

The first two names are the ones the Fear rows already carried in the I18N table, kept rather
than invented: the Presence row and the Fear row it opens are the same idea at two prices, and
giving them separate names would make a player learn the pairing. `presence_current_quickens`
has no Fear row to name itself after, carries no `unlocks`, and is the first row in the
catalogue to touch the board through what it opens.

The first two together cost exactly what a first Reclaim is shaped to pay (about 5), so the
first ascension buys both. That is deliberate — the first one should read as an unambiguous
win. Focus is priced past that first payout on purpose, as the catalogue's first real dilemma.

### The rows that lower a price

Seven repeatable ladders, one per automation, each carrying `discounts` instead of `unlocks`.
A rung walks its automation one step down whichever of the two Fear ladders its price sits on —
**500 · 300 · 200 · 100 · 50 · 25 · 10** or **400 · 200 · 100 · 50 · 25 · 10** — which share a
tail from 200 down and differ only in that each top row skips a rung on its first step. Rungs
cost **5 · 10 · 25 · 50 · 100 · 250** Presence by how many have already been taken.

| id | discounts | Fear price | rungs | Presence for all |
| --- | --- | --- | --- | --- |
| `presence_boon_remembered` — *Der Segen bleibt in Erinnerung* / The Boon Remembered | `auto_boon` | 25 | 1 | 5 |
| `presence_instinct_remembered` — *Der Instinkt bleibt in Erinnerung* / The Instinct Remembered | `auto_innate` | 100 | 3 | 40 |
| `presence_bounty_remembered` — *Die Gabe bleibt in Erinnerung* / The Bounty Remembered | `auto_bounty` | 200 | 4 | 90 |
| `presence_flood_remembered` — *Die Sturzflut bleibt in Erinnerung* / The Flood Remembered | `auto_flash_floods` | 300 | 5 | 190 |
| `presence_current_remembered` — *Die Strömung bleibt in Erinnerung* / The Current Remembered | `auto_wash_away` | 400 | 5 | 190 |
| `presence_need_remembered` — *Der Bedarf bleibt in Erinnerung* / The Need Remembered | `auto_buy_abilities` | 200 | 4 | 90 |
| `presence_tide_remembered` — *Die Flut bleibt in Erinnerung* / The Tide Remembered | `auto_start_round` | 500 | 6 | 440 |

One naming family, because it is one mechanism: the island remembers what was already paid for
and asks less the next time. Each names the Fear row it walks down, so the pairing is readable
off the two shops without a mapping to learn.

**A rung count is never written here or in the catalogue** — `presenceUpgradeMaxTier` reads it
off where the automation's own `baseCost` sits on its ladder, so repricing an automation resizes
its descent. An automation priced off both ladders gets no rungs and keeps its full price, which
a structural test in `tests/ascension.test.js` catches.

Two further properties worth keeping straight:

- **A discount is not permission.** `auto_start_round` at 10 Fear is still refused until
  `presence_tide_returns` is bought. Two Presence rows now point at the same Fear row — one for
  the lock, one for the price — and neither knows about the other.
- **The floor is 10 Fear, not 0**, so an automation is still re-bought every cycle and the Fear
  catalogue keeps its shape. See
  [05-progression.md](./05-progression.md#the-discount-ladders).

### The row that is not an upgrade

**The power card draw.** A repeatable Presence row that is not an upgrade at all: it offers three
cards and the player keeps one, at `10 * 1.6^owned` Presence with a re-roll at a quarter of that.
Cards are cast like abilities, reach a round only through a wave-25 drip, and survive ascension
like every Presence purchase. The whole feature — records, Defense, Blight removal, the Fear row
that shortens the drip — is in [10-power-cards.md](./10-power-cards.md).

It is also the catalogue's first row that out-earns *holding* Presence, which is the gap the
ladders above deliberately do not close.

### What the catalogue still has no row for

No cap extension, and nothing that pays in a *scaling* quantity. Unspent Presence multiplies Fear
generation 1% a point, uncapped, so a fixed Fear discount cannot beat holding at any serious
income. The ladders above are a sink and an early investment, not an answer to that — see
[04-economy-formulas.md](./04-economy-formulas.md#these-rows-do-not-out-earn-holding-presence-and-are-not-meant-to).
The card draw beats holding, but it terminates: seven draws and the row is finished. Its
designed successor, a repeat draw that upgrades a card already owned, would be the first row
that neither terminates nor loses to holding — see
[10-power-cards.md](./10-power-cards.md#what-is-deliberately-not-designed).

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

## Localization Registry

- All visible player-facing strings are defined in the `I18N.de` and `I18N.en` tables in
  `i18n.js` — including log lines, which the engine writes and the UI only displays.
- New content must provide both German and English display strings.
- **German strings use real umlauts, and `i18n.js` is UTF-8 without a BOM.**

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
