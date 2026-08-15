# 05 Progression

## Intent

Document the permanent meta-progression loop: Fear as a persistent currency, the upgrade
shop it funds, and what carries across rounds versus what resets.

## Rules

- Progression in this design happens entirely between rounds. Nothing purchased mid-round
  exists, because the shop only opens once `round.status` is `ended`.
- A permanent upgrade, once purchased, applies to every round from then on. There is no
  respec and no way to lose a purchased upgrade short of a save wipe.
- `meta.fear` is the only currency. There is no second meta-currency in this slice.

## Meta State

### Fear

- `meta.fear` accumulates from every invader defeat and every wave survived, in every round,
  and is never reset by a round ending — win or lose, the Fear earned stays.
- It is spendable only in the between-round shop.
- **`meta.fear` is always a whole number.** `round.fearEarned` accumulates as a float — the
  three Fear ladders multiply it — and `endRound` floors the total once on the way into the
  bank, always downward. See
  [04-economy-formulas.md](./04-economy-formulas.md#where-the-rounding-happens) for why the
  rounding lives at the bank and not at each award.

### Round Tracking

- Rounds are not tallied. Nothing in the rules or the UI reads a count of attempts, so a save
  that carries a `meta.totalRoundsPlayed` from an older build drops it on load.
- `meta.bestRoundReached` updates whenever `round.number` at round-end exceeds it. This is
  the run's headline score.

### Permanent Upgrades

- `upgrades.purchased` holds every upgrade bought, keyed by upgrade id, with whatever count
  or tier that upgrade tracks (a flat unlock is `true`; a repeatable upgrade tracks its
  purchased tier as a number).
- Applied at round setup — see [Round Reset Formula](./04-economy-formulas.md#round-reset-formula).

### Placeholder Upgrade Catalogue

First-draft shop entries, for internal consistency while the loop is being built. Costs and
magnitudes are not balanced yet.

| Upgrade id | Effect | Repeatable | Base cost |
| --- | --- | --- | --- |
| `dahan_reinforcement` | +1 starting Dahan | Yes, max tier 8 | 10 |
| `blight_resilience` | +1 Blight threshold | Yes, max tier 5 | 3 |
| `headwaters` | Every round opens with Energy in hand, 1 up to 35 by tier | Yes, max tier 9 | 8 |
| `rising_dread` | +10% Fear from defeated invaders | Yes, soft-capped | 6 |
| `mounting_terror` | +10% Fear from surviving waves | Yes, soft-capped | 6 |
| `high_water_mark` | Every 10th wave pays 10% of its own number as Fear | Yes, soft-capped | 12 |
| `dahan_remember` | Fear invested shortens the Dahan strike clock, to half at 10000 | Yes, a pool: max tier 10000 | 1 (flat) |
| `unlock_<ability_id>` | Unlocks a new ability for the ability bar | No, one-time | — |

### headwaters

The only row that spends Fear and pays out in Energy. Every round opens with the tier's figure
already in the purse — 1 at tier 1, 5 at tier 4, 35 at tier 9 — and nothing else about the
round reset changes: what a round *earned* still dies with it, and every unlock it bought is
still given back.

It is the exception to the shop's usual shape in two ways, both deliberate:

- **Its gain is a table, not a step.** 1 / 2 / 3 / 5 / 8 / 13 / 19 / 26 / 35 by tier, climbing
  with the price rather than staying flat. Over nine tiers the 1.6 curve makes the last rung
  cost 43× the first, so a flat gain would leave most of the ladder dead. The first three tiers
  are weak by design — 3 Energy crosses none of the unlock prices — and are the entry fee on a
  ladder whose top is very strong. Table, per-tier costs and the Fear-per-Energy curve are in
  [04-economy-formulas.md](./04-economy-formulas.md#headwaters-and-the-shape-of-a-gain).
- **It is capped where the Fear ladders are not.** 35 is exactly the unlock kit (5 + 10 + 20),
  so tier 9 with `auto_buy_abilities` opens a round with the whole kit bought and nothing
  spare. What it buys genuinely runs out, which a soft cap would only obscure.

At 903 Fear cumulative it is the dearest row in the catalogue, above `auto_start_round` (500),
and being finishable it counts toward the gate — so the last two purchases now sit that much
further out. It is also the only upgrade whose worth *shrinks* with depth: a run to wave 100
barely notices its first thirty seconds. It is the exact inverse of `high_water_mark`, and the
two are the shop's clearest pair of opposites — this pays for playing, the Mark pays for
pushing.

### The three Fear ladders

One shape read three times: +10% a tier on the 1.6 curve, differing only in which half of the
income they multiply. Together they are the shop's answer to a catalogue that used to
terminate — see [Known Gap](#known-gap).

- **`rising_dread`** multiplies kill Fear. The cheapest ladder in the shop and deliberately the
  strongest early buy, at a payback of about two rounds. It is priced under
  `dahan_reinforcement` without being strictly better: the Dahan tier buys survival as well as
  income, this buys only income, so the opening move is a choice rather than a script.
- **`mounting_terror`** multiplies wave Fear. Same price as `rising_dread` even though wave
  Fear is the smaller half and falls further behind at every damage rung — because
  `high_water_mark` is what squares the two.
- **`high_water_mark`** pays a bonus on every tenth wave worth `tier * 10%` of the wave number,
  and `mounting_terror` multiplies it. Twice the base cost of the other two, because each tier
  is worth 3–5× as much at depth — and near-worthless to a player dying at wave 30, which is
  the point. This is the ladder that pays for pushing rather than for playing.

Their totals are quadratic in depth where every other income in the game is linear. Formulas
and the soft-cap rationale are in
[04-economy-formulas.md](./04-economy-formulas.md#fear-formula).

### The Dahan Remember

The one row that is a **pool** rather than a ladder, and the first thing in the shop to touch
a clock. Fear goes in at 1 Fear a unit, flat and forever; 100 Fear is 1% of haste on the Dahan
strike; 10000 Fear is the cap, at which the Dahan strike twice as often. It is bought in
denominations — 1, 10, 100, 1000, or everything the purse holds — because a pool this deep
cannot be filled a click at a time.

Three things about it are deliberate and worth keeping straight:

- **It asks nothing.** Every other row is a decision about whether the next tier is worth its
  price. This one has no next tier, only more of the same at the same rate, which is what a
  sink is for. Its row shows a percentage where the others show `Tier n`.
- **It does not count toward the gate.** 10000 Fear is several times the rest of the catalogue
  put together, so requiring it would turn the gate on the last two purchases into a wall. See
  [04](./04-economy-formulas.md#which-rows-the-gate-counts).
- **It is priced against income the shop cannot absorb.** This is the sink meant to outlive
  the catalogue, not another rung in it — which is the same problem the section below is
  about, approached from the other side. It does not solve that problem; it buys time against
  it, and it does so without adding a row that eventually empties.

Costs scale with the tier already purchased so the shop stays a real choice instead of a
flat checklist; the curve is `baseCost * 1.6 ^ tier`, rounded to whole Fear. It is a
placeholder — see
[04-economy-formulas.md](./04-economy-formulas.md#upgrade-cost-curve).

`unlock_<ability_id>` has no row in the shop today, because all four abilities ship in the
starter kit and there is nothing to unlock. The path that reads these keys is implemented
and normalization accepts them, so adding a fifth ability is content work.

## What Is Not Yet Progression

- No additional spirit unlocks.
- No second meta-currency (a prestige layer above Fear, if one is ever wanted).
- No content unlocks beyond the placeholder ability-unlock row above.
- No mid-round progression of any kind — everything in-round resets at round setup.

## Current Design Constraint

Every progression field is meant to be forward-compatible: `upgrades.purchased` can grow new
keys without a schema change, and `meta` can grow new tracked totals the same way the
turn-based build's `progression` object did. What "forward-compatible" obliges an implementer
to do — and the suite that checks it against a save captured from an earlier build — is in
[03-state-contract.md](./03-state-contract.md#older-save-files-keep-working). The short of it:
a schema change is a wipe, so an additive field must not be one.

## Acceptance

- A reader can tell which progression systems are functional today versus placeholder
  content, per [Implementation Microtasks](../tasks/implementation-microtasks.md). ✓
- Fear earned in a round survives that round ending, regardless of outcome. ✓
- A purchased upgrade is still in effect after any number of further rounds, without being
  re-purchased. ✓
- `meta.bestRoundReached` never decreases. ✓

All four are asserted in `tests/shop.test.js`, including the case that matters most for a
meta loop: a tier bought after round 1 still applies in round 5.

## The Shop Still Terminates

Worth naming, because it is the structural problem the three Fear ladders were added against
and only half-solve.

Before them the catalogue cost about 2,470 Fear in total, and it *ended*: every ladder maxed,
every one-off bought, nothing left to buy ever again. At 20–40 Fear a round that is 60–120
rounds to a permanently empty shop — and because the difficulty ladder is keyed to the wave
rather than the round (see [04](./04-economy-formulas.md), and note that nothing reads
`round.number`), every round after that is identical to the last. The shop is the game's only
progression axis, so when it empties there is no axis at all.

The three soft-capped ladders mean the shop no longer runs out of *rows*, and
`dahan_remember` adds 10000 Fear of somewhere to put income after they stop being worth
buying. Neither fixes the underlying shape: income is still bounded, the difficulty curve is
still fixed, a player deep enough will still find the curve outrunning what any tier can buy —
and the pool, unlike the ladders, does eventually fill.

The intended answer is an **ascension layer** — a reset of Fear and upgrades in exchange for a
currency that buys what the Fear shop cannot. It is not designed and not implemented. When it
is, the soft caps become the open question: a prestige layer and a soft cap solve the same
problem, and building both is redundant. See
[04](./04-economy-formulas.md#soft-caps) for what capping them at tier 10 would take.

## Known Gap

Progression only turns over if a round produces Fear. It now does unattended: the Dahan
strike fires on its own timer whether or not a land is under attack, so a defended land earns
Fear without the player acting. What is untested is whether it earns *enough*, and whether
`dahan_reinforcement` is priced correctly now that the Blight floor and the concentration cap
have taken the superlinear returns out of a Dahan. See
[index.md](./index.md#known-balance-problems).
