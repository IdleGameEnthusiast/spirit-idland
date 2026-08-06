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
  "schemaVersion": "3.0.0",
  "time": {
    "totalSeconds": 0,
    "lastTickUnixMs": 0,
    "lastSaveUnixMs": 0
  },
  "meta": {
    "fear": 0,
    "totalRoundsPlayed": 0,
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
    "blightThreshold": 10,
    "waveTimerRemaining": 8,
    "wavesResolved": 0,
    "fearEarned": 0,
    "abilityCooldownMult": 1
  },
  "invader": {
    "ravage": null,
    "build": null,
    "explore": "mountains"
  },
  "invaders": {
    "1": { "explorers": 0, "towns": 0, "cities": 0 },
    "2": { "explorers": 0, "towns": 0, "cities": 0 },
    "3": { "explorers": 0, "towns": 0, "cities": 0 },
    "4": { "explorers": 0, "towns": 0, "cities": 0 },
    "5": { "explorers": 0, "towns": 0, "cities": 0 },
    "6": { "explorers": 0, "towns": 0, "cities": 0 },
    "7": { "explorers": 0, "towns": 0, "cities": 0 },
    "8": { "explorers": 0, "towns": 0, "cities": 0 }
  },
  "invaderDamage": { "1": { "explorers": 0, "towns": 0, "cities": 0 }, "...": {}, "8": {} },
  "dahan": { "1": 0, "...": 0, "8": 0 },
  "abilities": {
    "boon_of_vigor": { "cooldownRemaining": 0 },
    "wash_away": { "cooldownRemaining": 0 },
    "flash_floods": { "cooldownRemaining": 0 },
    "rivers_bounty": { "cooldownRemaining": 0 }
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

## Keys

**Land IDs** are the strings `"1"` through `"8"`. They key `invaders`, `invaderDamage`,
`dahan`, and `ui.selectedLand`. They are always strings: JSON object keys are strings, so a
numeric id would stop matching itself after a save/load round-trip.

**Terrain keys** are `mountains`, `desert`, `jungle`, `wetlands`. They key `essence` and the
three `invader` track slots. The board registry mapping one to the other lives in
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

## `round` Fields

- `status` is `running` while a round is live, or `ended` once Blight has reached
  `blightThreshold`. No other values are valid.
- `blight` only increases during a round and is clamped to `blightThreshold` as its max.
- `blightThreshold` is copied from the current permanent-upgrade baseline at round setup, so
  a mid-round upgrade purchase (not currently possible; upgrades only apply between rounds)
  can't retroactively change an already-running round's threshold.
- `waveTimerRemaining` counts down in real seconds and is stored as a float; the HUD rounds
  it up for display. At 0 a wave resolves and it resets to `WAVE_INTERVAL_SECONDS`.
- `wavesResolved` is a display/debug counter, incremented once per wave.

### Fields added during implementation

Four fields the first draft of this contract did not have. Each earns its place:

- **`round.blightByLand`** — per-land Blight tally, summing to `round.blight`. The original
  contract said Blight was "a single value for the whole round, not tracked per land", but
  `wash_away` targets "the most-Blighted ravaged land", which that shape cannot answer. The
  tally is also what lets the board show *which* land cost the round, which
  [06-ui-contract.md](./06-ui-contract.md) asks for. `round.blight` stays the authoritative
  total; the tally is a breakdown of it, never a second source of truth.
- **`round.fearEarned`** — Fear earned in this round alone. `meta.fear` is the purse and
  never resets; the shop's "you earned N this round" line needs the delta, and recomputing
  it from a purse that the player also spends from is not possible.
- **`round.abilityCooldownMult`** — the cooldown multiplier copied from the upgrade baseline
  at round setup, for exactly the reason `blightThreshold` is copied: a purchase must not
  shorten a cooldown that is already ticking.
- **`ui.blightFx`** — the transient counterpart to `ui.defeatFx`, marking the lands that
  just took Blight. Same lifetime (`DEFEAT_FX_MS`), same normalize-to-null rule.

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
- `essence` and `invaders`/`invaderDamage`/`dahan` must be filled for every terrain key or
  land ID respectively.
- `round.status` must be `running` or `ended`, and normalizes to `running` otherwise.
- `round.blight` is clamped to `[0, round.blightThreshold]`.
- Invader damage cannot exceed the number of living invaders of each type in that land.
- `pendingAbilityTarget` must be a known ability id or `null`; an unknown id normalizes to
  `null`.
- `abilities` must contain an entry for every ability id the active spirit defines; missing
  entries normalize to `{ "cooldownRemaining": 0 }`.
- `ui.selectedLand` normalizes to `null` if it is not a valid land ID.
- Older saves must be migrated to single-spirit mode with `core_spirit_01` active.

### Migration from 2.0.0

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
- Anything that is not a `3.0.0` save takes this path — an older version, a corrupt file, a
  hand-edited one. There is no partial-recovery branch.

This is a one-time cost specific to this redesign, not a precedent — future schema bumps
within the round-based shape should still migrate field by field where a mapping exists.

## Derived Runtime Behavior

- `createFreshMetaState()` runs once, on first-ever load with no save: `meta.fear = 0`, no
  upgrades purchased, `round.number = 1`.
- `createFreshRoundState()` runs at the start of every round (see
  [02-core-loop.md](./02-core-loop.md) Round Sequence step 1), not just game start. It resets
  `invaders`, `dahan`, `round.blight`, `round.waveTimerRemaining`, `invader`, and every
  ability's `cooldownRemaining`, using the current permanent-upgrade baseline from
  `upgrades.purchased`.
- Loading a save does not simulate elapsed wall-clock time against a running round; a round
  resumes exactly as saved. See the open question on offline behavior in
  [index.md](./index.md).
- `essence` remains present but has no writer in this design; it neither accrues nor resets.

## Acceptance

- Save and load round-trip without losing `meta`, `upgrades.purchased`, round state, board
  state, or a pending ability target.
- A `2.0.0` save loads via the hard-reset migration path and logs why.
- New save fields can be added with defaults without breaking old saves.
- All other docs in this folder reference these exact top-level fields.
