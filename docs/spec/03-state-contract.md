# 03 State Contract

## Intent

Define the canonical save shape for the round-based redesign.

## Rules

- Field names in this document are the live shape, implemented in `engine/state.js` and `engine/save.js`.
- Save files must carry `schemaVersion`.
- New fields must normalize safely when older saves are loaded. This is a hard requirement with
  a suite behind it, not an aspiration — see
  [Older save files keep working](#older-save-files-keep-working) before adding a field.

## Canonical State Shape

```json
{
  "schemaVersion": "5.0.0",
  "time": {
    "totalSeconds": 0,
    "lastTickUnixMs": 0,
    "lastSaveUnixMs": 0
  },
  "meta": {
    "fear": 0,
    "bestWaveReached": 0,
    "presence": 0,
    "ascensionCount": 0,
    "cycleBestWave": 0,
    "cycleFearGenerated": 0,
    "cycleFearGranted": 0,
    "cycleFearSpent": 0
  },
  "spirit": {
    "activeSpiritId": "core_spirit_01",
    "unlockedSpiritIds": ["core_spirit_01"]
  },
  "upgrades": {
    "purchased": {}
  },
  "presenceUpgrades": {
    "purchased": {}
  },
  "ui": {
    "language": "de",
    "gameSpeed": 1,
    "autoProceed": false,
    "autoStartRound": true,
    "autoCast": {
      "boon_of_vigor": true,
      "rivers_bounty": true,
      "innate_power": true,
      "wash_away": true,
      "flash_floods": true
    },
    "autoBuy": {
      "mode": "focus",
      "innateCap": 3,
      "focusOrder": "value",
      "focusAbilities": {}
    },
    "autoBuyOpen": false,
    "playtest": false,
    "defeatFx": null,
    "blightFx": null,
    "fearFx": null,
    "roundEndFx": null,
    "cardFx": null,
    "selectedLand": null
  },
  "round": {
    "number": 1,
    "status": "running",
    "elapsedSeconds": 0,
    "blight": 0,
    "blightByLand": { "1": 0, "...": 0, "8": 0 },
    "blightProgress": { "1": 0, "...": 0, "8": 0 },
    "dahanProgress": { "1": 0, "...": 0, "8": 0 },
    "blightThreshold": 10,
    "waveTimerRemaining": 20,
    "dahanAttackRemaining": 20,
    "awaitingWave": false,
    "wavesResolved": 0,
    "fearEarned": 0,
    "fearEarnedBase": 0,
    "abilityCooldownMult": 1,
    "purchasedAbilityIds": [],
    "abilityTiers": {}
  },
  "invader": {
    "build": "jungle",
    "explore": "mountains"
  },
  "invaders": {
    "1": { "explorers": 0, "towns": 0, "cities": 0 },
    "2": { "explorers": 0, "towns": 0, "cities": 0 },
    "3": { "explorers": 1, "towns": 0, "cities": 0 },
    "4": { "explorers": 0, "towns": 0, "cities": 0 },
    "5": { "explorers": 0, "towns": 0, "cities": 0 },
    "6": { "explorers": 0, "towns": 0, "cities": 0 },
    "7": { "explorers": 0, "towns": 0, "cities": 0 },
    "8": { "explorers": 0, "towns": 0, "cities": 0 }
  },
  "invaderDamage": { "1": { "explorers": [], "towns": [], "cities": [] }, "...": {}, "8": {} },
  "dahan": { "1": 0, "...": 0, "8": 0 },
  "abilities": {
    "innate_power": { "cooldownRemaining": 0 },
    "boon_of_vigor": { "cooldownRemaining": 0 }
  },
  "pendingAbilityTarget": null,
  "resources": { "energy": 0 },
  "_log": []
}
```

`abilities` holds one slot per **unlocked** ability, not one per ability in the spirit's kit.
A fresh round shows two entries because `core_spirit_01` opens with two unlocked and the other
three behind an Energy price; `round.purchasedAbilityIds` is the record of what has been bought
since, and `unlockedAbilityIds()` is `startingAbilityIds` plus that list (plus the `unlock_`
upgrade path, which no catalogue row uses today). A locked ability having no cooldown slot is
what makes `triggerAbility` refuse it — the lock is one rule, not two.

`round.purchasedAbilityIds` and `round.abilityTiers` sit under `round` rather than under
`spirit` because both die with the round, exactly like the Energy that bought them.
`startRound` empties both alongside the purse. `purchasedAbilityIds` deliberately does not list
the starting kit — those were never bought, so keeping them out means the array is exactly the
record of what this round spent. Normalization drops unknown ids and collapses duplicates, so a
double-write cannot make one purchase look like two; `abilityTiers` is clamped to the tiers the
catalogue actually defines, so shortening a ladder cannot strand a save above its top rung.

`invaderDamage[land][type]` is **one entry per living unit**, holding how much that individual
has taken — not one number per type. The invariant, held by `normalizeInvaderDamage`: length
equals the matching count in `invaders`, every entry is in `[0, health-1]`, and the list is
sorted most-wounded first so index 0 is always the unit the board draws a health ring for.

The earlier model kept a single number per type per land, which meant a land could hold only
one wounded city — "two cities, both at one damage" was not a state it could describe. Every
effect that spreads damage over a whole land needs it to be, and so does showing a health bar
per invader. Every place that adds a unit goes through `addInvaderUnit`, which pushes the
matching entry; a phase that incremented the count alone would leave the board describing units
that are not there.

The shape above is a round as it stands at second zero, not an empty board: the opening
Discover has already run, so the coastal jungle (land 3) holds an explorer and the terrain it
landed in has shifted into `invader.build`. `build` is only `null` between the reset and that
Discover, which is a state no save ever observes.

## Keys

**Land IDs** are the strings `"1"` through `"8"`. They key `invaders`, `invaderDamage`,
`dahan`, `round.blightByLand`, `round.blightProgress`, `round.dahanProgress`, and
`ui.selectedLand`. They are always strings: JSON object keys are strings, so a numeric id
would stop matching itself after a save/load round-trip.

**Terrain keys** are `mountains`, `desert`, `jungle`, `wetlands`. They key the two `invader`
track slots. The board registry mapping one to the other lives in
[09-island-board.md](./09-island-board.md).

## Fields power cards add

Specified in [10-power-cards.md](./10-power-cards.md#state). Listed here so the contract does
not have to be read in two places to know what a save may hold: a top-level `powerCards`
(`owned`, and the stored `draw` offer), `round.defense` and `round.defenseExpiry` keyed by land
id, `round.cards`, and `ui.cardOptions`.

Every one of them is additive, which is the property that matters: a new field is not a schema
change and must not trigger the wipe — see
[Older save files keep working](#older-save-files-keep-working). `powerCards.owned` is bought
with Presence and therefore survives ascension; everything under `round` is cleared by
`startRound`; `ui.cardOptions` is a preference and survives with the rest of `ui.*`.

## Retired Fields

The turn-based `2.0.0` shape carried fields this design has no reader for — presence
placement and its tracks, `turn.*`, a card draw/discard/hand, per-effect `effects.*` state,
`progression`/`milestones`, and the terrain-keyed `essence` pools. The Ravage phase's
`invader.ravage` slot went the same way at `4.0.0`, when a continuous fight replaced it.

None of them survive, and none are read on load: a save older than the current
`schemaVersion` hard-resets rather than being translated, so there is nothing to migrate.
The field-by-field list is in git history.

## `round` Fields

- `status` is `running` while a round is live, or `ended` once Blight has reached
  `blightThreshold`. No other values are valid.
- `blight` is clamped to `blightThreshold` as its max. Nothing in the fight lowers it; the one
  thing that can is a power card's removal clause, which decrements `blight` and
  `blightByLand[land]` together and leaves `blightProgress[land]` alone. See
  [10-power-cards.md](./10-power-cards.md#removing-blight).
- `blightThreshold` is copied from the current permanent-upgrade baseline at round setup, so
  a mid-round upgrade purchase (not currently possible; upgrades only apply between rounds)
  can't retroactively change an already-running round's threshold.
- `waveTimerRemaining` counts down in real seconds and is stored as a float; the HUD rounds
  it up for display and must not scale it — `WAVE_INTERVAL_SECONDS` already carries
  `TIME_SCALE`. At 0 a wave resolves and it resets to `WAVE_INTERVAL_SECONDS`.
- `dahanAttackRemaining` is the same idea on its own clock. At 0 every land holding both
  Dahan and invaders strikes, and it resets to `roundDahanAttackInterval(state)` — the base
  constant divided by the haste `dahan_remember` bought, read off `round.upgradeTiers` so a
  running round keeps the clock it started with. It is a
  separate field from `waveTimerRemaining` on purpose — see
  [04-economy-formulas.md](./04-economy-formulas.md#implemented-constants). There is no stored
  interval beside it: the snapshot is the only frozen copy, so the two can never disagree.
- `blightProgress` and `dahanProgress` are per-land floats in `[0, 1]`: the fraction of the
  next Blight, and of the next Dahan casualty, that land has accrued. They are the only
  fractional board state, and they are what makes the fight continuous rather than ticked.
  A filled bar subtracts exactly 1 and carries the remainder; it never resets to 0, except
  `dahanProgress` when a land's last Dahan falls.
- `wavesResolved` is a display/debug counter, incremented once per wave.
- `awaitingWave` is the wave gate: `true` while the round is standing still because the
  player has not called the next wave. It is a flag rather than a third `status`, because
  everything else about the round is still true while it holds — the board, the timers and
  the cooldowns are exactly where they were, and only the clock is not moving. It is set at
  round setup when `ui.autoProceed` is off, and again whenever `waveTimerRemaining` hits 0
  with auto-proceed off. See [02-core-loop.md](./02-core-loop.md#pacing).

### Fields added during implementation

Fields the first draft of this contract did not have. Each earns its place:

- **`round.blightByLand`** — per-land Blight tally, summing to `round.blight`. The original
  contract said Blight was "a single value for the whole round, not tracked per land"; the
  tally is what lets the board show *which* land cost the round, which
  [06-ui-contract.md](./06-ui-contract.md) asks for. (An earlier `wash_away` also targeted the
  most-Blighted land automatically; it takes a click now, but the tally kept its other job.)
  `round.blight` stays the authoritative total; the tally is a breakdown of it, never a second
  source of truth.
- **`round.fearEarned`** — Fear earned in this round alone, kept as a **float**. `meta.fear` is
  the purse and never resets; the shop's "you earned N this round" line needs the delta, and
  recomputing it from a purse that the player also spends from is not possible. It is the only
  fractional Fear in the schema — `endRound` floors it once on the way into `meta.fear`, which
  is always whole. See
  [04-economy-formulas.md](./04-economy-formulas.md#where-the-rounding-happens).
- **`round.fearEarnedBase`** — the same income with none of the three Fear ladders applied, so
  the HUD can show what the round earned on its own beside what the upgrades added. Tracked
  rather than derived, because it cannot be derived: kill Fear, wave Fear and the milestone
  each carry a different multiplier, so one total has no unique decomposition. The milestone
  contributes nothing here — without `high_water_mark` there is no milestone at all, so every
  point of it is upgrade income by construction.

  `fearBreakdown()` is the only supported reader. It floors both and takes the bonus as
  `floor(total) - floor(base)` rather than flooring the difference, so the two halves always
  sum to exactly the figure the round banks. **On load, an absent field means "all base"**, not
  zero: the deep merge fills a missing key from the fresh-state defaults, so presence is tested
  against the raw save, and a save from a build without the Fear ladders shows no bonus rather
  than claiming its whole round was upgrade income.
- **`round.abilityCooldownMult`** — the cooldown multiplier copied from the upgrade baseline
  at round setup, for exactly the reason `blightThreshold` is copied: a purchase must not
  shorten a cooldown that is already ticking.
- **`ui.blightFx`** — the transient counterpart to `ui.defeatFx`, marking the lands that
  just took Blight. Same lifetime (`DEFEAT_FX_MS`), same normalize-to-null rule.
- **`ui.roundEndFx`** — set by `endRound` to mark the *instant* the round ended, so the board
  can flash rather than only appearing already frozen. Same lifetime and normalize-to-null
  rule as the two above, but it carries no payload beyond `at`: what it announces is the
  boundary itself, not a land or a number. The lasting "round is over" reading is
  `round.status`, which the view wears as `.round-ended`; this is only the beat at the crossing.
- **`ui.cardFx`** — the fourth transient mark, set by both power-card draw paths (the drip and
  the re-draw) so the board can announce a card arriving and the bar can light the one that
  came. It carries `{ cardId, wave, at }`: both readers have to name the card, and the wave is
  the sentence the reveal makes — this is what wave 45 was worth. Same normalize-to-null rule as
  the three above, but **its own lifetime, `CARD_FX_MS`**, roughly twice theirs: they flag a
  number that moved, this one carries text to read. An unknown `cardId` normalizes to null
  rather than to a reveal with an empty face. See
  [06](./06-ui-contract.md#the-card-arrival).
- **`ui.gameSpeed`** — the speed dial: how many game seconds one real second buys, one of
  `GAME_SPEEDS` (`0`, `1`, `2`), plus `PLAYTEST_GAME_SPEEDS` (`8`) while `ui.playtest` is set.
  It lives in `ui` rather than `round` because it is a preference like the language toggle,
  not a property of the round being played, and it survives a reset for the same reason.
- **`ui.autoProceed`** — whether a wave is allowed to arrive without being asked for. Also a
  preference, also outside `round`: it outlives every round it is read in.
- **`ui.autoCast`** — one switch per ability automation, keyed by the **ability** each one
  casts (`AUTO_CAST_UPGRADES` in `engine/abilities.js` is the only place that pairing is written down).
  It is in `ui` for exactly the reason `ui.autoProceed` and `ui.autoStartRound` are: it
  outlives every round it is read in. It is a *preference*, not a purchase — whether the
  switch is drawn at all follows `upgradeTier` (`autoCastOwned`), whether the automation
  casts follows `activeUpgradeTier` **and** this map (`autoCastOn`). Two consequences fall out
  of that split, both wanted: switching one off mid-round bites on the next tick rather than the
  next round, and buying an automation mid-round still does nothing until the next round takes
  its snapshot. Switching off stops future casts and nothing else — no cooldown is reset, shortened or
  lengthened, no cast is undone, nothing is refunded, and the upgrade is never un-bought.
- **`ui.autoBuy`** — how far `auto_buy_abilities` spends the round's Energy, and how it chooses
  once it gets there. See [05-progression.md](./05-progression.md#auto-buy) for the dial itself.
  A preference like the switches above it, and it survives a Reclaim with the rest of `ui.*`.
  Four fields:
  - `mode` — one of `off` / `unlocks` / `focus`, cumulative in that order. It is
    stored at the **top** rung by default and gated below it: `autoBuyModeRank` clamps the
    stored value to what is owned, so a save may carry `focus` without owning
    `presence_river_deepens` and start acting on it the instant the row is bought, with no
    second click. `autoBuyMode` returns the stored preference and `autoBuyModeRank` what it
    actually does — the two differ on exactly that one save, and the UI draws the rank.
    A save from before the Energy split may hold the retired `tiers`; it is not a mode any
    more and falls back to the default like any other unknown string, which is the top rung —
    where the tiers are bought now.
  - `innateCap` — a tier **as the card counts it**, so `3` is Tier 3 and `1` is "never upgrade
    it". It is the split of the round's Energy between the tier ladder and Focus, and it is set
    in the Energy purse rather than in the auto-buy sheet — see
    [05-progression.md](./05-progression.md#where-the-energy-goes). It is only ever read at the
    dial's top rung, because that is where the tiers are bought: below it the bot buys neither
    tiers nor Focus, so there is nothing for a split to divide. It binds the resolver
    only in any case; `upgradeAbility` ignores it, and capping the automation never takes a
    purchase away from the player's own hand.
  - `focusOrder` — `value` or `cheap`.
  - `focusAbilities` — the per-ability opt-out, stored as **refusals only**. Absent means
    allowed, the same `!== false` reading `ui.autoCast` takes, which is what makes a newly
    drawn power card focusable without a click. Unlike `ui.autoCast` it is *not* rebuilt from a
    registry: Focus applies to the kit and to every card, and cards arrive across a cycle, so
    rebuilding would write a settled `true` for a card the player has never seen. Unknown ids
    are dropped on load.
- **`ui.autoBuyOpen`** — whether the auto-buy sheet is unfolded. Disclosure rather than a rule,
  but it lives in the state because the **engine** closes it: `startRound` sets it false, so a
  round begun by `auto_start_round` — which no click ever touches — folds it away too. See
  [06-ui-contract.md](./06-ui-contract.md#the-auto-buy-sheet).
- **`ui.playtest`** — whether the playtest code has been redeemed, and with it the only thing
  in the state no rule reads: it widens the speed dial, reveals two buttons that hand out
  currency and one readout of the cycle's Fear, and nothing else in the engine branches on it.
  It is in `ui` with the other settings rather than in `meta` because it is not something the
  player has *earned* — see [06-ui-contract.md](./06-ui-contract.md#playtest-tools).
- **`meta.cycleFearGenerated`, `meta.cycleFearGranted`, `meta.cycleFearSpent`** — the cycle's
  Fear ledger, whole numbers that only ever grow. `meta.fear` is a balance and says nothing
  about throughput: a player who earned ten thousand and spent it all reads identically to one
  who earned nothing, which is exactly the question a balance pass asks. `endRound` adds what
  it banked (the floored figure, never the fractional total), `purchaseUpgrade` adds what it
  charged, and the playtest grant adds to **granted** rather than generated — it is not income,
  and counting it as such would corrupt the one number the ledger exists to report. Granted is
  still counted, because it is still spendable: `generated + granted - spent` is `meta.fear`,
  and that identity is what makes the readout self-checking. A *cycle* is the span between
  ascensions, and `ascend()` is what zeroes all three — except that `granted` opens the new
  cycle at `ascensionStartFear(state)` rather than at 0, matched by the same figure in
  `meta.fear`, so the identity holds on the new cycle's first tick as `0 + n - 0 = n`. That is
  `presence_fear_remains`, and it lands in **granted** for exactly the reason the playtest
  button does: a head start is not income, and counting it as such would let it mint Presence
  of its own. See
  [07-content-registry.md](./07-content-registry.md#the-row-that-endows-a-cycle). Read through `cycleFearTotals()`.
  **On load, an absent `cycleFearGenerated` means "the bank was earned, and so was what it has
  already bought"**, not zero — and not `meta.fear` either, which was the first answer and was
  wrong by exactly the size of the player's shopping. Fear leaves the bank in one place only
  (`purchaseUpgrade`), so a save's owned tiers are a receipt: `normalizeState` prices them back
  off the catalogue with `upgradeCostFromTier(id, 0, tier)`, seeds `cycleFearSpent` with that
  sum and `cycleFearGenerated` with `meta.fear + sum`. The identity holds across the upgrade,
  the same way an absent `round.fearEarnedBase` means "all base". Absent `granted` is honestly
  zero.

  Four properties of that rebuild are load-bearing, and
  [08-acceptance-tests.md](./08-acceptance-tests.md#older-save-files-keep-working) holds each:

  - **One-time.** It fires on the *absent key* and writes the key, so it is a seed rather than
    a recomputation. A save written after the change carries its own figure and is never
    touched again — which is what stops a post-ascension load from handing back Fear the
    previous cycle spent.
  - **Post-normalization.** It reads the rebuilt `upgrades.purchased` — known ids, tiers
    already capped to the ladder — never the raw save, so a doctored row cannot mint Fear.
  - **Priced today.** A save bought its rungs at whatever the prices were then; a retune moves
    what the rebuild reads back. Accepted deliberately: the alternative is a price history no
    other part of the game needs, and it only ever affects the one load that seeds the field.
  - **Exact where it matters.** A save old enough to be missing the field predates the playtest
    grant (the two landed together), so `granted` is genuinely 0 and `bank + spent` is the
    whole of what was generated.

  `cycleFearGenerated` has a second reader now, and it is the important one: the ascension
  payout is a function of it alone (see
  [04-economy-formulas.md](./04-economy-formulas.md#the-ascension-payout)). That is what makes
  the granted/generated split load-bearing rather than tidy — folding the playtest grant into
  generated would turn a tool for looking at the game into a way of progressing through it.
- **`meta.presence`, `meta.ascensionCount`, `presenceUpgrades.purchased`** — the ascension
  layer, and the three fields ascension does **not** clear. Presence is paid out by `ascend()`
  and spent only in the Presence catalogue; `presenceUpgrades.purchased` is keyed by Presence
  id exactly the way `upgrades.purchased` is keyed by upgrade id, and is normalized by the same
  rebuild-from-the-registry rule.

  It is a **separate object** rather than more keys in `upgrades.purchased`, and that is the
  single decision that keeps ascension simple: the wipe is `upgrades.purchased = {}` whole,
  with no filter and no exception list. Two objects with one rule each beats one object with a
  rule and an exception, and the exception is what a later reader would get wrong.
- **`meta.cycleBestWave`** — the best wave since the last ascension, against
  `meta.bestWaveReached`'s all-time figure. Both are written in `endRound` from the same
  `round.wavesResolved`; `ascend()` clears one and never touches the other. Two scores because
  after a Reclaim they answer different questions — how far this player has ever got, and how
  the current climb is going. Neither is read by the ascension unlock, which is priced in
  Presence.

  `cycleBestWave` is score and only score. **`bestWaveReached` no longer is**: it is the input
  `fastForwardWaves` takes a share of, so the all-time record now decides how much of every
  round `presence_deep_water_comes` hurries. That makes the never-cleared rule load-bearing
  rather than cosmetic — a Reclaim that reset it would take the row's grant back with it — and
  it makes the ratchet a mechanic: the record only ever rises, so what the row grants widens on
  its own between purchases. Read live rather than snapshotted, which is safe for exactly one
  reason: `endRound` is the only writer, so it cannot move under a round that is running.

  The prefix is the rule: **a `cycle*` field is wiped by ascension and everything else is
  not.** Anything added later that should survive a Reclaim must not be called `cycle*`, and
  anything that should not survive one must be.
- **`round.awaitingWave`** — the gate itself, described above. It is in `round` and not `ui`
  precisely because it *is* round state: it dies with the round that raised it.
- **`round.abilityFocusEnergy`** — Energy invested in Focus, keyed by ability id (`{
  [abilityId]: energy }`, absent or 0 dropped). Round-scoped exactly like `round.abilityTiers`
  and `round.purchasedAbilityIds` beside it: it is bought with the round's own Energy, so it is
  wiped by the same `startRound` that wipes them.

  **What is stored is the spend, not the rungs it bought.** Both the rung count
  (`abilityFocusPurchases(id)`) and the cooldown (`abilityFocusedCooldownSeconds(id)`) are read
  back off it against the ability's *current* record, so no two of the three can disagree. That
  is what makes an Innate tier change lossless: each tier names its own ladder, and the same
  investment re-read against a longer, dearer one buys however many of its rungs it covers,
  leaving the remainder as a discount on the next. A sum above the current ladder's whole price
  is kept as spent and simply rests on the floor — it is still owed the rungs of whatever tier
  the ability lands on next. See
  [04-economy-formulas.md](./04-economy-formulas.md#focus-spending-energy-mid-round-to-shorten-a-cooldown).

  A save written while Focus counted rungs (`round.abilityFocus`) is migrated on load: each
  count is priced on the ladder that save's own `abilityTiers` puts in front of it, and the
  total is carried as Energy. The old field is deleted rather than left to disagree.

## `abilities` Shape

Each key is an ability id (see [07-content-registry.md](./07-content-registry.md) for the
current set). Each value:

```json
{ "cooldownRemaining": 0 }
```

`cooldownRemaining` is seconds, clamped to `[0, ability.cooldownSeconds]`. An ability is
usable exactly when this is `0`.

## `pendingAbilityTarget`

```json
"flash_floods"
```

Either `null`, or the id of an ability currently waiting for a single land click. Set when
an ability that needs a land target is triggered; cleared the instant that land is clicked
and the effect applies. No other card/effect state exists in this design — there is nothing
to resume mid-effect beyond "which ability is waiting for a click."

## Normalization Requirements

- Unknown language values must normalize to `de` unless explicitly `en`.
- `ui.gameSpeed` must be one of the speeds the dial currently offers; anything else normalizes
  to `DEFAULT_GAME_SPEED` (`1`), the speed the game ships at. Which speeds those are depends on
  `ui.playtest`, so `ui.playtest` is normalized **first**: a save written at `8x` loads at `8x`
  only if it also carries the redeemed code, and never leaves a player at a speed the dial
  draws no button for.
- `ui.autoProceed` normalizes to `false` unless it is exactly `true`.
- `ui.autoStartRound` normalizes to `true` unless it is exactly `false` — the opposite default
  to auto-proceed, and deliberately so: a save that predates the toggle has no value to read,
  and the only player it can affect is one who has already bought the automation.
- `ui.autoCast` is **rebuilt from the registry**, not merged over, the same way
  `upgrades.purchased` and `abilities` are. Every ability id in `AUTO_CAST_UPGRADES` gets
  `raw !== false`, and any key the map does not carry is dropped. So a save written before the
  field existed loads with all five automations still running, and a save cannot smuggle in a
  toggle for an ability the registry no longer has.
- `ui.playtest` normalizes to `false` unless it is exactly `true`. Like the language and the
  speed, it survives a migration reset — it is a setting rather than run state.
- `round.awaitingWave` normalizes to `false` unless it is exactly `true` **and**
  `round.status` is `running`. An ended round holds no gate: the shop is what the player is
  looking at, and a flag left set by a save written mid-gate would freeze the round it starts
  next.
- `meta.presence`, `meta.ascensionCount` and `meta.cycleBestWave` are whole and never
  negative, like every other counter in `meta`. An absent value is honestly `0`: a save from
  before the layer existed has ascended zero times, and seeding any of them from something else
  would be inventing progress.
- `presenceUpgrades.purchased` is **rebuilt from the Presence registry**, not merged over it —
  the same rule `upgrades.purchased` follows, for the same reasons. An unknown id is dropped,
  a bad value clamps to `0`, and a tier is capped at the row's max.
- **A save owning `auto_start_round` or `auto_buy_abilities` is granted the matching Presence
  unlock on load.** Both were bought with Fear under the old gate, and the change that put
  them behind Presence must not take back a purchase already made. This is the only place
  normalization writes a Presence row rather than reading one, and it is deliberately
  idempotent: the grant is a set to `1`, so loading the same save twice cannot pay twice.
  Asserted in `tests/compat.test.js`.
- `invaders`, `invaderDamage`, and `dahan` must be filled for every land ID.
- `round.status` must be `running` or `ended`, and normalizes to `running` otherwise.
- `round.blight` is clamped to `[0, round.blightThreshold]`.
- `round.blightProgress` and `round.dahanProgress` are clamped to `[0, 1]` per land, and are
  filled for every land ID. A non-finite value normalizes to `0`.
- `round.dahanAttackRemaining` is clamped to `[0, DAHAN_ATTACK_INTERVAL_SECONDS]` — against the
  base interval, not the round's hasted one, because the haste is derived from the upgrade
  snapshot and that is normalized further down. Every legal value is under the base anyway, so
  the worst a doctored save buys itself is one late first strike.
- `invader` has exactly two slots; a save carrying a `ravage` slot drops it silently.
- Invader damage cannot exceed the number of living invaders of each type in that land.
- `pendingAbilityTarget` must be a known ability id or `null`; an unknown id normalizes to
  `null`.
- `abilities` must contain an entry for every ability id the active spirit defines; missing
  entries normalize to `{ "cooldownRemaining": 0 }`.
- `ui.selectedLand` normalizes to `null` if it is not a valid land ID.
- Older saves must be migrated to single-spirit mode with `core_spirit_01` active.

## Older save files keep working

A save file outlives the build that wrote it. The game has an export and an import button, so
a file leaves the browser, sits on a player's disk, and comes back weeks and several builds
later — and once it is on disk, no future change to this project can reach it. Whether that
player gets their run back or a fresh game is decided entirely here.

The engine's only compatibility mechanism is `schemaVersion`, and it is all-or-nothing:
`migrateSave` returns the save untouched when the version matches exactly, and **wipes the
game** when it does not, carrying a handful of preferences through and nothing else. There is
no field-by-field translation layer and none is planned. That puts the whole burden of
compatibility on normalization, which is exactly where a new field is easiest to get wrong.

Four requirements on anyone adding a field:

1. **`VERSION` does not move for an additive change.** A field added to `ui`, `round` or `meta`
   that older saves simply lack is not a version bump, because a bump is a wipe — `migrateSave`
   has one path for a mismatch and it is `createFreshGameState`. The version moves only when a
   save's *existing* fields stop meaning what they meant. The `2.0.0` → round-based change
   below is that case, and it is why the reset path exists at all.
2. **A missing field defaults to whatever costs the player nothing.** Absent means "this save
   predates the field", never "the player switched it off". `ui.autoStartRound !== false` and
   the `ui.autoCast` map are both this rule. `ui.autoProceed === true` is the deliberate
   exception: its default is off for a new game too, so a save that lacks it and a new game
   agree, which is the whole test.
3. **Rebuild registry-keyed maps; never merge them.** For a field keyed by content ids —
   `upgrades.purchased`, `abilities`, `ui.autoCast` — normalization walks the registry and
   reads the save per key, dropping keys the registry does not carry. A save then cannot
   smuggle in an id that no longer exists, and a save written before an id was added gets that
   id's default without anyone having to list it a second time.
4. **A field that is a *history* is reconstructed from what the save still shows, not defaulted
   away.** Rule 2 covers preferences, where absent honestly means "no answer". A total is
   different: a save from before `cycleFearGenerated` existed did earn Fear, and defaulting the
   field to `0` — or to the leftover bank — hands the player a wrong number rather than no
   number, which the ascension payout then pays out on. Look for the record the history left
   behind. Fear leaves the bank only in the shop, so owned tiers priced off the catalogue *are*
   the spend, and `bank + spend` is the earnings. Three rules keep such a rebuild honest: run it
   on the **absent key** and write the key, so it seeds once rather than recomputing on every
   load; read the **already-normalized** copy of whatever it derives from, so a doctored save
   cannot mint currency through it; and say in the code what the reconstruction is exact about
   and what it only approximates.

This is tested rather than asserted. `tests/compat.test.js` runs against
`tests/fixtures/save-5.0.0-pre-autocast.js`, a real save **captured** out of an earlier build
rather than generated by the current one — regenerating it from `createFreshGameState` would
make it agree with whatever the engine does today, which is the one thing a compatibility
fixture must not do. The checks assert properties, not a snapshot: a golden file would fail on
every legitimate field addition and be re-blessed without being read.

Note what the suite deliberately also proves: that a save from a **genuinely** older schema
still resets. Compatibility here is not "never reset" — it is "reset only when the shape really
changed" — and a suite proving only the first half would pass on an engine that had stopped
resetting anything at all.

### Migration from anything older

A `2.0.0` save is turn-based and presence-driven — structurally incompatible with the
round-based shape, not just a rekeying. Rather than attempt a field-by-field translation
(there is no meaningful mapping from a presence track to an ability cooldown, or from a
mid-turn card hand to a mid-round ability target), migration is a **hard reset**:

- `meta.fear` starts at `0` — the old build's tracked `resources.fear` is not carried over,
  since it was never spendable there and porting an arbitrary head start would distort the
  new shop's early balance.
- Everything else initializes from `createFreshGameState()` as if no save existed, with one
  exception: **`ui.language` survives**. It is a display preference, not run state, and
  coming back to a wiped run in the wrong language would read as a second bug on top of the
  first.
- `ui.autoCast` is **not** among the preferences carried through, and the omission is a
  decision rather than an oversight: the reset takes every purchase with it, so there is no
  automation left to switch off and no switch on any card to carry a preference for. The
  fresh state's five defaults are the right answer.
- The migration logs a one-line notice naming the old version, so a returning player
  understands why their old run is gone rather than assuming data loss is a bug.
- Anything that is not a current-version save takes this path — an older version, a corrupt
  file, a hand-edited one. There is no partial-recovery branch.

`3.0.0` saves take the same path at `4.0.0`. A mid-round `3.0.0` save describes a board whose
Blight arrived in whole points from a Ravage phase that no longer exists, and whose Dahan
counts assume they had been absorbing damage in units of 2 rather than filling a casualty
bar. There is no honest mapping for either, and a reset costs the player one round.

## Derived Runtime Behavior

- `createFreshMetaState()` runs once, on first-ever load with no save: `meta.fear = 0`, no
  upgrades purchased, `round.number = 1`.
- `createFreshRoundState()` runs at the start of every round (see
  [02-core-loop.md](./02-core-loop.md) Round Sequence step 1), not just game start. It resets
  `invaders`, `dahan`, `round.blight`, `round.waveTimerRemaining`, `invader`, and every
  ability's `cooldownRemaining`, using the current permanent-upgrade baseline from
  `upgrades.purchased`. The opening Discover then writes to `invaders` and `invader` again,
  which is why a fresh round is *not* an empty board: `invader.build` holds a terrain rather
  than `null`, and its reachable lands hold one explorer each.
- Loading a save does not simulate elapsed wall-clock time against a running round; a round
  resumes exactly as saved. See the open question on offline behavior in
  [index.md](./index.md).
- `ascend()` is the only thing that clears `meta.fear`, `upgrades.purchased`, and the four
  `cycle*` fields; it pays `meta.presence`, increments `meta.ascensionCount`, resets
  `round.number` to 1, and calls `startRound`. It touches `presenceUpgrades.purchased`,
  `meta.bestWaveReached`, `ui.*` and `spirit.*` not at all. See
  [05-progression.md](./05-progression.md#what-reclaiming-does).
- `resources.energy`, `round.purchasedAbilityIds` and `round.abilityTiers` are all cleared by
  `startRound`. Energy is a round-local currency: it is earned inside a round, spent inside
  that round, and given back with everything it bought when the next one begins. `startRound`
  then rebuilds `abilities` from the unlocked set, which after the reset is the spirit's
  opening hand again.
- `resources.energy` is reset rather than zeroed: `startRound` sets it to what `headwaters` was
  bought up to, 0 until the ladder is owned. The figure comes from `upgradeTotals`, which reads
  owned tiers rather than the round snapshot — the line runs before the round it is setting up
  exists, so there is no round for a mid-round purchase to rescue. Everything the *last* round
  earned is still gone.

  So every round starts from the same kit and is built up from nothing, and the only thing
  that carries is Fear and the shop tiers it buys. That is the whole division: the shop decides
  how fast a round can be rebuilt, the fight decides how far that round gets, and neither can
  be traded for the other.

## Acceptance

- Save and load round-trip without losing `meta`, `upgrades.purchased`, round state, board
  state, or a pending ability target.
- A `2.0.0` save loads via the hard-reset migration path and logs why.
- New save fields can be added with defaults without breaking old saves.
- All other docs in this folder reference these exact top-level fields.
