# 03 State Contract

## Intent

Define the canonical save shape for the round-based redesign.

## Rules

- Field names in this document are the live shape, implemented in `engine.js`.
- Save files must carry `schemaVersion`.
- New fields must normalize safely when older saves are loaded.

## Canonical State Shape

```json
{
  "schemaVersion": "4.0.0",
  "time": {
    "totalSeconds": 0,
    "lastTickUnixMs": 0,
    "lastSaveUnixMs": 0
  },
  "meta": {
    "fear": 0,
    "bestRoundReached": 0
  },
  "spirit": {
    "activeSpiritId": "core_spirit_01",
    "unlockedSpiritIds": ["core_spirit_01"]
  },
  "upgrades": {
    "purchased": {}
  },
  "ui": {
    "language": "de",
    "gameSpeed": 1,
    "autoProceed": false,
    "playtest": false,
    "defeatFx": null,
    "blightFx": null,
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
  "essence": {
    "mountains": 0,
    "desert": 0,
    "jungle": 0,
    "wetlands": 0
  },
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

**Terrain keys** are `mountains`, `desert`, `jungle`, `wetlands`. They key `essence` and the
two `invader` track slots. The board registry mapping one to the other lives in
[09-island-board.md](./09-island-board.md).

## Retired Fields

Carried over from `2.0.0` but dropped here, since nothing in the round-based design reads
them:

- `presence`, `essenceProgress` — presence placement and its per-land Essence driver are
  gone. `essence` itself (the four terrain pools) stays as an inert placeholder; only its
  per-land generator is removed.
- `tracks` (the two presence tracks) — replaced by the permanent `upgrades` shop.
- `turn.*` — replaced by `round.*`.
- `cards` (draw/discard/hand) — replaced by `abilities`.
- `effects.*` (washAway, flashFloods, riversBounty, presencePlacement, ravageCounter) —
  replaced by the single `pendingAbilityTarget`, since abilities take at most one click.
- `progression` and `milestones` — folded into `meta`.

Dropped at `4.0.0`, when the Ravage phase was replaced by a continuous fight:

- `invader.ravage` — the track is two slots now. Invaders damage the land they stand in,
  everywhere, all the time, so no terrain is ever "the one being ravaged".

## `round` Fields

- `status` is `running` while a round is live, or `ended` once Blight has reached
  `blightThreshold`. No other values are valid.
- `blight` only increases during a round and is clamped to `blightThreshold` as its max.
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

Seven fields the first draft of this contract did not have. Each earns its place:

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
- **`ui.gameSpeed`** — the speed dial: how many game seconds one real second buys, one of
  `GAME_SPEEDS` (`0`, `1`, `2`), plus `PLAYTEST_GAME_SPEEDS` (`8`) while `ui.playtest` is set.
  It lives in `ui` rather than `round` because it is a preference like the language toggle,
  not a property of the round being played, and it survives a reset for the same reason.
- **`ui.autoProceed`** — whether a wave is allowed to arrive without being asked for. Also a
  preference, also outside `round`: it outlives every round it is read in.
- **`ui.playtest`** — whether the playtest code has been redeemed, and with it the only thing
  in the state no rule reads: it widens the speed dial and reveals two buttons that hand out
  currency, and nothing else in the engine branches on it. It is in `ui` with the other
  settings rather than in `meta` because it is not something the player has *earned* — see
  [06-ui-contract.md](./06-ui-contract.md#playtest-tools).
- **`round.awaitingWave`** — the gate itself, described above. It is in `round` and not `ui`
  precisely because it *is* round state: it dies with the round that raised it.

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
- `ui.playtest` normalizes to `false` unless it is exactly `true`. Like the language and the
  speed, it survives a migration reset — it is a setting rather than run state.
- `round.awaitingWave` normalizes to `false` unless it is exactly `true` **and**
  `round.status` is `running`. An ended round holds no gate: the shop is what the player is
  looking at, and a flag left set by a save written mid-gate would freeze the round it starts
  next.
- `essence` and `invaders`/`invaderDamage`/`dahan` must be filled for every terrain key or
  land ID respectively.
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
- `essence` remains present but has no writer in this design; it neither accrues nor resets.
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
