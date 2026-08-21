# 09 Island Board

## Intent

The island is eight numbered lands, each with a terrain, a coast flag, and named
neighbours. Adjacency is a rule the player plays around, not a hidden model.

The board geometry, adjacency, and rendering in this document are **unchanged by the
round-based redesign** (see [index.md](./index.md)). What changed is *how* the board is
acted on: invader phases now resolve on the automatic wave timer instead of player clicks,
the Dahan strike is auto-assigned instead of a player-driven queue, and presence —
placement, range, and the Essence rate it drove — is retired. Those sections below are
rewritten; the rest of this document (board table, SVG rendering, colour) still applies as
written.

## Rules

- Land identity is the primary key for board state. Terrain becomes an attribute of a land.
- Every land-targeting rule resolves through adjacency; the presence-range model is retired.
- Terrain keys survive unchanged as terrain: the invader track stays terrain-keyed. Only
  per-land board state is rekeyed.
- The board is fixed. There is no board generation, rotation, or multi-board support.

---

## Source Fidelity

This board is built to the published structure of a standard Spirit Island island board,
not invented. The following are verified facts, not design choices:

- Each board has **eight numbered lands**.
- Each board has **exactly two of each terrain** — Jungle, Mountain, Sands, Wetland.
- Each standard board has **three Coastal lands**. The rest are Inland. Coastal means
  adjacent to the board's Ocean swath; the board's other borders are rocky cliffs and do
  **not** make a land coastal.
- Two lands are adjacent when they touch, **even if they meet only at a corner**.

**What could not be verified:** the exact per-land terrain and adjacency table of Board A.
The table below is therefore an **original board built to the real spec** — it satisfies
every invariant above — rather than a copy of Board A. The board is pure data; swapping in
real numbers later touches one table and nothing else.

Terminology: this pack uses `desert` where Spirit Island says *Sands*. That stays, to avoid
a rename across every locale string for no player-visible gain.

---

## Board Definition

Eight lands. **Three coastal, five inland.** Each terrain appears exactly twice, and the
two lands of a terrain are never adjacent to each other.

| Land | Terrain | Coast | Adjacent |
| --- | --- | --- | --- |
| `1` | wetlands | coastal | 2, 4, 5 |
| `2` | desert | coastal | 1, 3, 5, 6 |
| `3` | jungle | coastal | 2, 6 |
| `4` | mountains | inland | 1, 5, 7 |
| `5` | jungle | inland | 1, 2, 4, 6, 7, 8 |
| `6` | mountains | inland | 2, 3, 5, 8 |
| `7` | wetlands | inland | 4, 5, 8 |
| `8` | desert | inland | 5, 6, 7 |

Fourteen edges, adjacency fully symmetric. Degrees are deliberately uneven: `3` is a
two-neighbour corner, `5` is a six-neighbour hub.

Terrain pairs: wetlands `1`/`7`, desert `2`/`8`, jungle `3`/`5`, mountains `4`/`6`.

### Consequences worth naming

Three coastal lands over four terrains means **one terrain has no coastal land at all**.
Here that is **mountains** — thematically the interior highlands, and mechanically the
board's back country:

- Discover on mountains does **nothing** until a town or city stands adjacent to land `4`
  or land `6`. Mountains is the safe interior early, and opens up as the coast falls.
- Land `6` borders coastal lands `2` and `3`, so it is the first mountain land to become
  reachable. Land `4` only opens once the invaders are already well inland.
- That is an escalation curve rather than a flat one within a single round: the interior
  stays quiet exactly as long as the coast is kept clear.

Land `5` touches six of the other seven lands. It is the board's hub: what stands there is
one Build away from reaching most of the island. Land `3` touches only `2` and `6` — a corner
that is easy to have cut off, and also easy to stop watching, which now costs more than it
used to: an unwatched land is not waiting for its turn to be ravaged, it is losing Dahan and
gaining Blight the whole time.

### Land IDs

Land IDs are the **strings** `"1"` through `"8"`, never numbers. JSON object keys are
strings, so a numeric id would silently mismatch itself after a save/load round-trip.

---

## Adjacency

One primitive, derived from the table above:

- `adjacent(land)` — the land's neighbours. Between 2 and 6 of them; never assume four.

A land is a legal ability target only if it satisfies the ability's own requirement. For most
that is "holds invaders"; for a push it also reads the neighbours, since a land with nothing
adjacent to push into is not a legal click however many explorers stand in it. See
[07-content-registry.md](./07-content-registry.md) for what each ability actually requires,
and [06-ui-contract.md](./06-ui-contract.md) for how a legal target is shown on the board.

Presence-based range (`landsInRange`, and placement's range-1 rule) is retired along with
presence itself — there is nothing left in this design that reads a presence range.

### Failure to find a target

If an ability is triggered and no land satisfies its requirement, it does not arm: log a
"no valid target" line and leave the ability's cooldown unspent.

---

## Invader Phases

The invader track stays **terrain-keyed**, but it is now **two slots, not three**.
`invader.build` and `invader.explore` hold terrain keys; there is no `invader.ravage`. A
phase resolves in **every land of that terrain**, in ascending land-id order (coastal land
first, since coastal ids are the lower ones) — unchanged from the turn-based build.

What changed: a Build/Discover/track-shift cycle (a "wave") fires automatically on
`WAVE_INTERVAL_SECONDS` rather than on End Turn, and it deals **no damage**. See
[02-core-loop.md](./02-core-loop.md#wave-resolution) for the full sequence.

### Ravaging, which is no longer a phase

Invaders damage the land they stand in, continuously, in every land at once. No terrain is
selected for it and no tick delivers it in a lump. Because it is not keyed to a terrain, it
is not an invader phase at all and does not appear on the track — see
[02-core-loop.md](./02-core-loop.md#the-fight) for the rates and
[04-economy-formulas.md](./04-economy-formulas.md#blight-formula) for the arithmetic.

The board consequence is worth naming: under the old design a terrain's two lands took
damage together and everywhere else was safe. Now the terrain track says nothing about where
the damage is, only where the island is about to get *more* of it. Land `5`'s six-neighbour
hub position matters for the same reason it always did, but pressure there is now constant
rather than periodic.

### The Dahan strike

On its own timer, every land holding both Dahan and invaders strikes at once, spending
`dahanAttackDamage(state)` per Dahan on the highest-tier invader type present (cities, then towns,
then explorers) until the pool or the invaders run out. This is not keyed to a terrain either,
and it is not part of a wave.

### Build

Each land of the terrain builds independently. A land with no invaders builds nothing and
logs so. Per land: if towns outnumber cities add 1 city, otherwise add 1 town. The two
lands can therefore build different unit types in the same wave.

### Discover

A land of the terrain gains 1 explorer only if it is **coastal**, or **adjacent to a land
containing at least one town or city**. This is the real Spirit Island Explore rule.

On this board:

- **Wetlands, desert, and jungle** each have one coastal land, so Discover always seeds at
  least 1 explorer, and 2 once a town or city stands next to the inland land.
- **Mountains has no coastal land.** Discover on mountains adds **nothing** until a town or
  city stands adjacent to land `4` or land `6`, and logs that it found no way in.

That last case is not an edge case to defend against — it is a third of every round's early
waves. Land `6` borders coastal lands `2` and `3`, so it opens first; land `4` only opens
once the invaders are already well inland.

### Track shift

Old explore becomes build, and a new explore terrain is drawn excluding it. This happens
automatically as the last step of every wave. With only two slots, a terrain is announced one
wave before it thickens rather than two.

---

## Essence

Retired, and gone from the schema. It was driven by a per-land presence rate, and nothing
survives to drive it. If a terrain resource returns it will need a new generation source of
its own design — the old presence-driven rate table is history, not a target to restore.

---

## Round Setup

Presence is gone: no starting presence, no placement, no range. What a round puts on the
board instead:

- **Dahan**: round setup seeds Dahan from `roundStartDahan` (baseline 6, same distribution
  density the turn-based build used), plus every purchased `dahan_reinforcement` upgrade
  tier, each dropped into the emptiest land so no two lands finish more than
  `DAHAN_MAX_SPREAD` apart. This now happens at the start of **every** round, not just
  fresh-game creation.
- **Invaders**: cleared to 0 everywhere at round setup, then the opening Discover puts one
  explorer in every reachable land of the drawn terrain — on an empty board that means its
  coastal lands. The draw skips terrains with no reachable land, so mountains is never the
  opening Discover: lands 4 and 6 are both interior.

---

## State Contract

The full canonical shape, including how board state is keyed, lives in
[03-state-contract.md](./03-state-contract.md). Board-relevant summary:

- `invaders`, `invaderDamage`, and `dahan` are keyed by land ID, `"1"` through `"8"`.
- `invader` stays keyed by terrain.
- There is no board-specific effect state left: an armed ability's pending land click is the
  single `pendingAbilityTarget` field, not a per-effect object.

### Migration

Anything older than the current `schemaVersion` hard-resets rather than translating field by
field. See [03-state-contract.md](./03-state-contract.md#migration-from-anything-older).

---

## UI: Board Rendering

The full UI contract (round HUD, ability bar, shop) is in
[06-ui-contract.md](./06-ui-contract.md). This section covers only the board's own rendering,
which is unchanged by the redesign.

### Rendering approach

An inline SVG island on an ocean background, with an HTML overlay carrying the per-land
readouts. The SVG paths own hit-testing and terrain fill; the overlay chips are
`pointer-events: none` so a click always reaches the land underneath.

Each land carries a `rect` footprint in board space `(u, v)`: `u` runs left to right, `v`
runs from the back of the board to the ocean edge. **Every adjacency in the table above
falls out of these rectangles overlapping**, so the drawing and the rules come from one
source and cannot drift apart.

The projection widens the board toward the coast, which gives it a wedge silhouette rather
than a rectangle. On top of that:

- Every boundary point is a **pure function of `(u, v)`**, and edges are sampled on a fixed
  global grid. Two lands sharing an edge therefore compute the identical point and the seam
  is exact.
- The warp is a **fixed sum of sines**, not random jitter: the island is the same island on
  every load.
- The ocean runs along the coast edge only. The other three borders are cliffs.

### Per-land chip

On the board, for every land, kept deliberately short:

- Land number and terrain.
- Invader summary — explorer/town/city glyphs with counts, **nonzero only**.
- Dahan pips.
- While the land holds invaders: a Blight bar, and a line naming the Blight rate and the
  seconds until the next one. These are the board's primary readout now — the fight never
  stops, so a land's danger is a speed. The casualty clock is a **ring** on the Dahan count
  rather than a second bar here; see the health rings in
  [06-ui-contract.md](./06-ui-contract.md).
- While the land holds **both Dahan and invaders**: a short, thin Dahan strike bar with an axe
  past its right-hand end, sitting in the allies row right of the Dahan count. It fills as the
  strike clock runs down, lights pale gold for the last fifth of it, and is full when the Dahan
  swing. Both conditions are required, because they are exactly the land
  the strike would not skip. One clock drives every bar on the board — see
  [06-ui-contract.md](./06-ui-contract.md).
- While the next wave will Build here: a banner naming the unit it will add.
- While an ability is armed and this land is a legal target: a highlight, per
  [06-ui-contract.md](./06-ui-contract.md).

Presence pips, the Essence rate, and the Essence rail are dropped from the board along with
the systems they represented.

### Land detail panel

For the selected land: number, terrain, coastal or inland, its neighbours, invader counts
with partial-HP hints, and Dahan. The Essence rate, live countdown, and presence threshold
are dropped along with presence and Essence generation.

Selection resolves as `ui.selectedLand`, falling back to the first land the current wave is
acting on, falling back to land `1`. The panel is never empty.

### Colour

Terrain hues stay exactly as they are: mountains `171, 184, 196`, desert `242, 196, 90`,
jungle `124, 198, 116`, wetlands `118, 179, 222`, each published as `--terrain-rgb`. Land
fills sit at or above `0.42` opacity, below which slate mountains and blue wetlands converge
against the dark ocean. Unit type is carried by shape, not hue.

---

## Acceptance

- Every land names its neighbours, and every adjacency is symmetric in both directions.
- A wave Builds in both lands of its terrain automatically, with no player input.
- Blight and Dahan casualties accrue in every land holding invaders, with no terrain selected.
- Discover adds 1 explorer while only the coastal land qualifies, and 2 once a town or city
  sits next to the inland land.
- An ability triggered with no land satisfying its requirement logs a no-target line and
  leaves its cooldown unspent.
- A push cannot move a unit to a non-adjacent land, or into one that already holds invaders,
  and among the lands it *can* reach it always takes the lowest-numbered one.
- The board is legible at a glance: which lands are under Blight pressure, where invaders
  are, where Dahan still stand.
- The island reads as an island, not as a pie chart.

---

## Implementation Notes

Worth knowing before changing any of this.

- Land fills sit at or above `0.42` opacity. Below roughly `0.4` slate mountains and blue
  wetlands converge into the same blue-grey against the dark ocean.
- Unit type is carried by shape, not hue.
- The turn-based build's `ravageCounter` effect (a player-assigned counterattack queue) has
  no successor object in this design — the Dahan strike is computed and applied in one step
  on its own timer, with nothing left pending afterward.
- `invader.ravage` is gone as of `4.0.0`. Anything reaching for "the terrain being ravaged"
  is reaching for a concept this design does not have.

## Verification

The board, phases, adjacency, and colour rules were originally verified against the
turn-based build (62 headless checks). That verification covered click-driven phase
resolution and player-assigned counterattacks, so it was **not** carried over on trust.

The board invariants are now re-asserted from scratch in `tests/board.test.js` — eight
lands, two per terrain, three coastal, mountains landlocked, fourteen edges, symmetric
adjacency, no terrain pair touching — and the phase rules in `tests/wave.test.js`, including
the Discover cases this board's landlocked mountains make into a third of every early round.
The continuous fight is covered separately in `tests/combat.test.js`. See
[08-acceptance-tests.md](./08-acceptance-tests.md) for how to run them.
