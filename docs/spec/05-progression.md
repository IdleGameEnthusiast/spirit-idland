# 05 Progression

## Intent

Document the two meta-progression loops: Fear as a per-cycle currency and the upgrade shop it
funds, and Presence as the permanent layer above it that ascension pays out in. What carries
across rounds, what carries across ascensions, and what resets at each boundary.

## Rules

- Progression happens between rounds. Nothing purchased mid-round takes effect mid-round —
  the shop is open all the time, but what a round runs on is frozen at its start.
- A Fear upgrade, once purchased, applies to every round in that **cycle**. There is no
  respec; the one thing that takes it away is ascension, which takes all of them at once.
- **There are two currencies and they are not interchangeable.** Fear buys. Presence decides
  what Fear is allowed to buy. See [The two layers](#the-two-layers).

## The two layers

> **Fear buys. Presence decides what Fear is allowed to buy.**

That single line was the whole of the two-currency design, and everything below is a consequence
of it. It is no longer literally true and has a successor — see
[The line that replaced it](#the-line-that-replaced-it) at the end of this section — but read it
first, because every row in the catalogue except the last two was built against it.

Presence never touches the board directly. It buys no Dahan, shortens no clock, and adds no
damage. What its *shop* purchases buy is **an automation, permanently** — a row the Fear
catalogue already has, handed over for the rest of the run instead of rented for a cycle. So
the two currencies are still not the same kind of thing: Fear buys power for one cycle, and
Presence buys the right to stop paying for it.

**A grant does not change what a row does, only who owes for it.** A granted automation is the
same automation at the same strength — Presence still buys nothing the board can see that Fear
could not have bought. What it introduces is an exchange rate of a kind, since a grant is
measurable in Fear saved per cycle, and that rate is priced out honestly in
[04-economy-formulas.md](./04-economy-formulas.md#what-a-grant-is-worth-against-holding-presence).

It also means the Fear shop is the only place power is bought *through spending*, which keeps
one catalogue to balance rather than two. A Presence purchase changes who pays a row's price,
never the numbers inside it.

**Holding Presence is the one exception.** Presence still sitting unspent multiplies every Fear
source by 1% a point — see [Presence multiplies Fear generation, and does not
cap](./04-economy-formulas.md#presence-multiplies-too-and-does-not-cap). That bonus comes from
*not* spending, which is the opposite of everything else Presence does: every Presence
purchase both removes a row's lock and removes that Presence from the multiplier. Spending is
still never a Fear-catalogue interaction — the two currencies still cannot buy each other's
rows — but it is no longer true that Presence "touches nothing but permission." What a player
holds now costs something to keep holding, on purpose, so that spending it is a real trade-off
and not a pure unlock with no downside to delaying.

**Focus is the second exception, and it is a bigger one.** `presence_current_quickens` (5
Presence) does not open a Fear row at all — it flips `abilityFocusUnlocked` straight on, and
once it is bought the player spends **Energy**, mid-round, to shorten an ability's own cooldown
(see [Focus](./04-economy-formulas.md#focus-spending-energy-mid-round-to-shorten-a-cooldown)).
That is Presence buying a *capability* rather than permission to spend Fear, and once bought it
is the board a click away from being touched by a currency that was never supposed to touch it
directly. The two-currency separation still holds in the sense that matters — Presence itself
never buys a stat, a purchase always costs Energy, not Presence, at the point it actually
shortens something — but "Presence touches the board never" is no longer literally true of the
whole catalogue, only of the two rows that came before this one.

### The line that replaced it

**Power cards end the old rule outright.** A card is bought with Presence and it deals damage,
pays Fear and removes Blight — no Fear row stands between the purchase and the board. Two
exceptions were survivable; a third that sells the board directly is a different rule, so the
rule is rewritten rather than defended:

> **Presence buys possibility. The round buys the moment.**

A card sitting in `powerCards.owned` does nothing at all. It reaches a land only through the
drip, which is paid for in waves survived — first at wave 25, then one every twenty. So Presence
still never puts a number on a land directly: what it buys is something a round has to earn the
right to hold, and a round that dies at wave 20 holds none of it however much Presence paid.

That is what keeps the currencies from collapsing into one. There is still no exchange rate —
Presence cannot be spent to make a round deeper, and Fear cannot be spent to own a card. Each
buys the other's precondition and neither buys the other's effect. See
[10-power-cards.md](./10-power-cards.md).

| | Fear | Presence |
| --- | --- | --- |
| earned by | rounds, continuously | ascending, once per cycle |
| spent on | the upgrade catalogue | which rows the catalogue has, and power cards |
| survives a round | yes | yes |
| survives an ascension | **no** | yes (cards included) |
| touches the board | yes | via Focus, and via a card a deep round draws |
| held (not spent) does something | no | yes — +1% Fear a point, uncapped |

## Meta State

### Fear

- `meta.fear` accumulates from every invader defeat and every wave survived, in every round,
  and is never reset by a round ending — win or lose, the Fear earned stays.
- It is spendable only in the between-round shop.
- It is **wiped by ascension**, along with every upgrade it bought. Fear is a cycle's
  currency, not the run's.
- **`meta.fear` is always a whole number.** `round.fearEarned` accumulates as a float — the
  three Fear ladders multiply it — and `endRound` floors the total once on the way into the
  bank, always downward. See
  [04-economy-formulas.md](./04-economy-formulas.md#where-the-rounding-happens) for why the
  rounding lives at the bank and not at each award.

### Presence

- `meta.presence` is the ascension currency. It is paid out once per ascension, on a curve
  read off the cycle's Fear income — see [Ascension](#ascension).
- It is spent in the **Presence shop**, whose rows unlock Fear-catalogue rows. Nothing else
  spends it and nothing else pays it.
- Whatever is not spent multiplies Fear generation, 1% per point, read live off
  `meta.presence` rather than off a round snapshot and uncapped — see
  [04-economy-formulas.md](./04-economy-formulas.md#presence-multiplies-too-and-does-not-cap).
- `presenceUpgrades.purchased` holds what it bought, in its own object rather than beside
  `upgrades.purchased`. That separation is what makes the wipe one line instead of a filter
  with exceptions in it: ascension clears `upgrades.purchased` whole and never looks at this.
- `meta.ascensionCount` counts ascensions. Unlike the round tally below it, this one is read —
  the ascension panel shows it, and it is the only number saying how deep a *run* is rather
  than how deep a cycle got.

### Round Tracking, and the two high scores

- Rounds are not tallied. Nothing in the rules or the UI reads a count of attempts, so a save
  that carries a `meta.totalRoundsPlayed` from an older build drops it on load.
- **`meta.bestWaveReached` is the run's headline score and is never cleared** — not by a round
  ending, not by ascending. It is what the whole save has ever reached.
- **`meta.cycleBestWave` is the same measure since the last ascension**, and ascension clears
  it.

Two scores rather than one, because after an ascension they answer different questions. The
all-time figure says how far this player has ever got; the cycle figure says how the current
climb is going, which is the only one that moves in the first rounds after a Reclaim. One
number cannot do both: cleared, it forgets the run; kept, it says nothing about the cycle.

The naming follows the one rule the state has: **a `cycle*` field is wiped by ascension and
everything else is not.** `meta.cycleFearGenerated`, `cycleFearGranted` and `cycleFearSpent`
were named first and set the convention; `cycleBestWave` joins them.

### Permanent Upgrades

- `upgrades.purchased` holds every upgrade bought, keyed by upgrade id, with whatever count
  or tier that upgrade tracks (a flat unlock is `true`; a repeatable upgrade tracks its
  purchased tier as a number).
- Applied at round setup — see [Round Reset Formula](./04-economy-formulas.md#round-reset-formula).
- "Permanent" means *for the cycle*. Ascension clears the object; nothing else does.

### Placeholder Upgrade Catalogue

First-draft shop entries, for internal consistency while the loop is being built. Costs and
magnitudes are not balanced yet.

| Upgrade id | Effect | Repeatable | Base cost |
| --- | --- | --- | --- |
| `dahan_reinforcement` | +1 starting Dahan | Yes, max tier 8 | 10 |
| `blight_resilience` | +1 Blight threshold | Yes, max tier 5 | 3 |
| `headwaters` | Every round opens with Energy in hand, 1 up to 35 by tier | Yes, max tier 9 | 8 |
| `rising_dread` | +10% Fear from defeated invaders | Yes, max tier 10 | 6 |
| `mounting_terror` | +10% Fear from surviving waves | Yes, max tier 10 | 6 |
| `high_water_mark` | Every 10th wave pays 10% of its own number as Fear | Yes, max tier 10 | 12 |
| `dahan_remember` | Fear invested shortens the Dahan strike clock, to half at 10000 | Yes, a pool: max tier 10000 | 1 (flat) |
| `unlock_<ability_id>` | Unlocks a new ability for the ability bar | No, one-time | — |
| `auto_buy_abilities` | Energy spends itself on the bar | No, one-time | 200 |
| `auto_start_round` | An ended round starts the next one | No, one-time | 500 |

**No row here is locked.** The last two shed a completion gate and then a Presence unlock, and
both are gone: a first cycle that saves 700 Fear can buy them and idle itself without ever
ascending. What a Presence row does to these seven automations is hand them over permanently,
so the price above stops being owed at all — see
[The Presence catalogue](#the-presence-catalogue).

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
- **Its cap is the thing it buys, not the curve.** 35 is exactly the unlock kit (5 + 10 + 20),
  so tier 9 with `auto_buy_abilities` opens a round with the whole kit bought and nothing
  spare. Every other capped ladder stops at a round number; this one stops where what it buys
  runs out.

At 903 Fear cumulative it is the dearest single row in the catalogue, above `auto_start_round`
(500). It is also the only upgrade whose worth *shrinks* with depth: a run to wave 100
barely notices its first thirty seconds. It is the exact inverse of `high_water_mark`, and the
two are the shop's clearest pair of opposites — this pays for playing, the Mark pays for
pushing.

### The three Fear ladders

One shape read three times: ten tiers, +10% a tier on the 1.6 curve, +100% at the top,
differing only in which half of the income they multiply.

They were soft-capped — no `maxTier` at all — for as long as the Fear shop was the game's only
progression axis and had to absorb income forever. Ascension is that axis now, so they are
finishable: ten tiers each, and a cycle that maxes all three is a cycle that has bought
everything the multiplier ladders have. See
[04-economy-formulas.md](./04-economy-formulas.md#the-ladders-are-capped-at-ten).

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
are in [04-economy-formulas.md](./04-economy-formulas.md#fear-formula).

All three feed the ascension payout, because the payout reads banked Fear rather than base
Fear. That compounding is deliberate and is what the square root exists to tame — see
[The payout](#the-payout).

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
- **It is nothing but a sink.** Every other row eventually runs out of rungs worth buying; this
  one takes whatever is left over at whatever rate the player is earning.
- **Its price now outlives its cycle rather than the catalogue.** 10000 Fear was set when the
  Fear shop was the only progression axis and the pool had to absorb income forever. Ascension
  is that axis now, so the pool is just a deep row that gets wiped like every other — deep
  enough that early cycles will not fill it, which makes it scenery for a while rather than a
  trap. The figure is deliberately left where it is until a played cycle says what a cycle
  actually generates. See [Known Gap](#known-gap).

Spending here costs nothing at ascension time, because the payout reads what the cycle
**generated** rather than what is left in the bank. There is no reason to hoard before a
Reclaim and no reason to hold back from the pool — see [The payout](#the-payout).

Costs scale with the tier already purchased so the shop stays a real choice instead of a
flat checklist; the curve is `baseCost * 1.6 ^ tier`, rounded to whole Fear. It is a
placeholder — see
[04-economy-formulas.md](./04-economy-formulas.md#upgrade-cost-curve).

`unlock_<ability_id>` has no row in the shop today, because all four abilities ship in the
starter kit and there is nothing to unlock. The path that reads these keys is implemented
and normalization accepts them, so adding a fifth ability is content work.

## Ascension

The spirit withdraws from the island and returns greater. Everything Fear bought is given
back; what the cycle *generated* is paid out in Presence, which buys rows the Fear catalogue
did not have.

### When it is available

```txt
unlocked when   ascensionPayout(state) >= ASCENSION_UNLOCK_PRESENCE   (5)
offered when    round.status === "ended"
```

Two separate conditions, and both are deliberate.

The unlock reads **what Reclaiming would pay**, so the gate and the reward are the same number.
There is no cycle in which Reclaiming is legal and worthless, and none in which it is worth
taking and refused. In generated Fear the gate is `5^2 * 100 = 2500`, but it is written in
Presence: the threshold belongs in the unit the panel shows the player.

It is therefore **re-earned by every cycle**, which the all-time wave gate it replaces was not.
That is not the wall a per-cycle *depth* gate would have been. What it forbids is a Reclaim that
hands back a whole catalogue for four Presence or fewer — the trade the panel should never
offer — and what it costs is the free Reclaim at the top of a fresh cycle, which paid nothing
anyway. The decision the layer exists to pose is still untouched: everything above 5 is the
player's call.

It is offered **only between rounds**, the same rule the whole of progression follows. That
also removes the question of whether the running round's Fear counts: it has not been banked,
so there is nothing to ask.

Beyond those two, nothing forces it and nothing recommends it. The Fear catalogue is never
finished — see [The shop no longer terminates](#the-shop-no-longer-terminates) — so the player
never runs out of things to buy and is never pushed into ascending by an empty shop. **When to
Reclaim is the decision the layer exists to pose**, and the payout curve is the only thing
that argues either way.

### The payout

```txt
presence = floor( sqrt( meta.cycleFearGenerated / PRESENCE_FEAR_DIVISOR ) )
```

`PRESENCE_FEAR_DIVISOR` is 100. See
[04-economy-formulas.md](./04-economy-formulas.md#the-ascension-payout) for the curve and why
the root is the shape.

Three properties of that one line, each load-bearing:

- **It reads `cycleFearGenerated`, not `meta.fear`.** Spending Fear never costs Presence.
  There is no incentive to hoard before Reclaiming, no reason to leave the pool unfed, and no
  moment where the shop and the ascension panel want opposite things from the player.
- **Granted Fear never counts.** `meta.cycleFearGranted` is a separate field precisely so the
  playtest grant cannot mint Presence. A tool for looking at the game must not be a way of
  progressing through it.
- **It reads banked Fear, which the three ladders multiply.** Deeper ladders make a bigger
  payout, so the Fear layer compounds into the Presence layer. The square root is what keeps
  that from running away.

The panel prints one more figure beside it, `fearToNextPresence`: how much further this cycle
has to run before the payout reads one higher. The root is why it is worth printing — the
payout alone cannot say whether the next Presence is a round away or six, and the rungs grow
apart the whole way up. See
[04-economy-formulas.md](./04-economy-formulas.md#the-gap-to-the-next-presence).

### What Reclaiming does

```txt
cleared:  meta.fear
          meta.cycleFearGenerated, cycleFearGranted, cycleFearSpent
          meta.cycleBestWave
          upgrades.purchased
          round.number  -> 1

kept:     meta.bestWaveReached
          meta.presence (plus the payout), meta.ascensionCount (plus one)
          presenceUpgrades.purchased
          powerCards.owned                (once built - a card is a Presence purchase)
          ui.*      every preference and every toggle
          spirit.*

then:     startRound()
```

`ui.*` surviving is the same rule that carries the language across a save migration: a
preference is not something the player earned, so taking it away is not part of the price. The
auto-cast switches in particular stay where they were set, even though the automations they
switch have just been un-bought — a player who re-buys `auto_wash_away` next cycle gets it back
in the state they last chose, not reset.

`round.number` going back to 1 is flavour rather than mechanics: nothing in the rules reads it
(the difficulty ladder is keyed to the wave, per
[04-economy-formulas.md](./04-economy-formulas.md#unit-stats)), and a new age counting from one
reads better than a run that remembers every attempt.

### The Presence catalogue

Two shapes of row. Three of them **grant** Fear rows outright and forever; the fourth unlocks a
capability directly, with no Fear row behind it.

| Presence id | Grants | Fear price it retires | Presence cost |
| --- | --- | --- | --- |
| `presence_tide_returns` | `auto_start_round` | 500 a cycle | 2 |
| `presence_river_knows` | `auto_buy_abilities` | 200 a cycle | 3 |
| `presence_all_unbidden` | all five ability auto-casts | 1,025 a cycle | 5 |
| `presence_current_quickens` | Focus, directly — see [04-economy-formulas.md](./04-economy-formulas.md#focus-spending-energy-mid-round-to-shorten-a-cooldown) | — | 5 |

**Ten Presence buys every automation in the game, for the rest of the run.** A granted row is
owned on the far side of a Reclaim: `ascend` empties `upgrades.purchased`, and `upgradeTier`
reads the grant out of the Presence catalogue instead, so the new cycle's first round already
runs itself.

A first Reclaim pays about 5, so it buys the first two with nothing left over — deliberate, and
the reason the other two rows are priced at exactly that payout rather than inside it: the
first ascension should read as an unambiguous win, and the second is where the catalogue starts
asking questions.

**A note on the ordering, which is the one figure here most worth retuning after a played
cycle.** The two dearest automations in the Fear shop are the two cheapest in Presence, so the
first Reclaim ends the hand-played round loop outright and `presence_all_unbidden` — five rows
worth 1,025 Fear a cycle for 5 Presence — waits for the second. Staging it the other way round,
so the first ascension smooths the round and the second stops needing a hand on it, wants
roughly **5 / 8 / 15** in place of 2 / 3 / 5.

**Nothing in the Fear catalogue is locked.** Before the grants, `auto_start_round` and
`auto_buy_abilities` sat behind a Presence row and owed their Fear price again every cycle
after it. Both halves are gone: every row is buyable at its listed price from the first round
of the first cycle, and what Presence sells is not permission but the end of the bill. A first
cycle that saves 500 Fear can idle itself without ever ascending; what ascending buys is not
having to do it again.

### Why the discount ladders were deleted

Seven repeatable rows used to sit here, one per automation, each walking its automation's Fear
price down a shared ladder at 5 · 10 · 25 · 50 · 100 · 250 Presence a rung. They are gone, and
the reason is arithmetic rather than taste.

Walking all seven to the bottom cost **515 Presence** and saved **975 Fear a cycle**. Holding
those same 515 Presence instead is **+515% Fear generated**, uncapped, for the rest of the run
(see [Presence](#presence)). Those two break even at about **190 Fear generated in a cycle** —
and the ascension gate will not let a player Reclaim at all until they have generated 2,500. So
the rows lost to *doing nothing with the Presence* by a factor of thirteen at the earliest
moment they could be bought, and by more every cycle after. They were not a weak rung on a good
ladder; they were seven rows that were never correct to buy, which is a worse thing for a
prestige catalogue to contain than no rows at all.

The old design defended a property that went with them: the ladders bottomed out at **10 Fear
rather than 0**, so that an automation stayed "a purchase a cycle makes rather than a switch a
save carries." That is now false by design. What the property was really protecting was a
per-cycle chore, and a prestige layer whose reward is *do the shopping again, slightly cheaper*
is the thing the grants exist to remove.

**Saves are paid back.** `normalizeState` drops the seven dead ids like any other unknown row,
then prices the rungs a save had bought and returns the Presence to the purse — up to 515 of
it, against a replacement catalogue that costs 10. See
[08-acceptance-tests.md](./08-acceptance-tests.md#ascension-and-presence).

## What Is Not Yet Progression

- No additional spirit unlocks.
- No Presence rows beyond the five now implemented. The fifth is the **power card draw**
  in [10-power-cards.md](./10-power-cards.md#buying-the-draw), a repeatable row on the same 1.6
  curve, three cards offered and one kept, 432 Presence for all seven.
- That row is also an answer to the gap this list has been carrying, and the grants are the
  other. A fixed Fear *discount* could not beat the passive +1%-a-point bonus unspent Presence
  returns (see [Presence](#presence)) — which is why the seven that tried are deleted. A grant
  can, because it is worth its rows' price every cycle for the rest of the run rather than once.
  A card does too: 432 Presence
  held is worth about +1.5 Fear/s at a typical income, the four Fear-paying cards produce
  roughly the same **and** lengthen the round earning it. Spending wins by a factor of two or
  three — enough to be the obvious buy, not enough to make holding foolish. See
  [04-economy-formulas.md](./04-economy-formulas.md#these-rows-do-not-out-earn-holding-presence-and-are-not-meant-to)
  for the arithmetic that row was measured against.
- No cap extension, and no row that pays in a *scaling* quantity. The card ladder ends when
  every card is owned; its designed successor — a repeat draw that upgrades a card already held
  — is named in [10](./10-power-cards.md#what-is-deliberately-not-designed) and is not designed.
- No content unlocks beyond the placeholder ability-unlock row above.
- Focus (`round.abilityFocus`, gated by `presence_current_quickens`) is the one exception to
  "everything in-round resets at round setup" — see
  [04-economy-formulas.md](./04-economy-formulas.md#focus-spending-energy-mid-round-to-shorten-a-cooldown).
  It is still round-scoped, though: what it buys is gone at the next `startRound` exactly like
  every unlock and tier Energy pays for, it is the *unlock* of the capability that is
  permanent, not any purchase made with it.

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
  re-purchased — and stops being in effect the moment the player Reclaims. ✓
- `meta.bestWaveReached` never decreases, not even across an ascension.
  `meta.cycleBestWave` decreases exactly once per ascension, to 0. ✓
- Presence is never earned except by ascending, and never spent except in the Presence
  shop. ✓

The first four are asserted in `tests/shop.test.js`, including the case that matters most for
a meta loop: a tier bought after round 1 still applies in round 5. The ascension half lives in
`tests/ascension.test.js`.

## The shop no longer terminates

The structural problem this design carried for a long time, and what finally answers it.

The catalogue *ended*: every ladder maxed, every one-off bought, nothing left to buy ever
again. Because the difficulty ladder is keyed to the wave rather than the round (see
[04](./04-economy-formulas.md), and note that nothing reads `round.number`), every round after
that point was identical to the last. The shop was the game's only progression axis, so an
empty shop meant no axis at all. Soft-capping the three Fear ladders postponed it without
fixing the shape, and `dahan_remember` bought time rather than an answer.

Ascension is the answer, and it works by making the catalogue's *size* something the player
buys rather than something the design fixes. A cycle's shop is bounded — every ladder has a
top, and 7,031 Fear finishes the lot — but the bound moves every time Presence buys a row into
it. So the shop is always readable to the end and never actually ends.

Two consequences, both intended:

- **The three ladders could be capped at ten.** They were uncapped for exactly the reason this
  section describes, and the reason is gone. See
  [04](./04-economy-formulas.md#the-ladders-are-capped-at-ten).
- **Nothing tests whether the shop is finished, and nothing should.** The old
  `gatedUpgradesUnlocked` asked that question in order to release the last two rows, and it is
  deleted. A shop that is never finished has no such moment to detect, and a design that
  pushed the player to ascend by running out of things to sell would be taking back the
  decision the layer exists to pose.

Today the Presence catalogue has two rows and neither grows the Fear catalogue by much. The
claim above is about the mechanism, not about the amount of content behind it.

## Known Gap

Progression only turns over if a round produces Fear. It now does unattended: the Dahan
strike fires on its own timer whether or not a land is under attack, so a defended land earns
Fear without the player acting. What is untested is whether it earns *enough*, and whether
`dahan_reinforcement` is priced correctly now that the Blight floor and the concentration cap
have taken the superlinear returns out of a Dahan. See
[index.md](./index.md#known-balance-problems).

Ascension adds a second unmeasured number on top of that one, and it is the more important of
the two: **nobody has played a cycle and read what it generates.** `PRESENCE_FEAR_DIVISOR`
(100) is a guess anchored to "a first Reclaim should pay about 5", and the whole pacing of the
layer rides on it — the unlock included, since `ASCENSION_UNLOCK_PRESENCE` is priced in the
same 5. The playtest tally in the redeem bar
([06-ui-contract.md](./06-ui-contract.md#playtest-tools)) reports `cycleFearGenerated`
directly, which is exactly the measurement needed: play a cycle to the point where a Reclaim
feels earned, read the figure, and the divisor is that figure over 25.

Two related unknowns that the same measurement would settle:

- **Whether shallow rounds out-earn deep ones per real minute.** The payout has no depth term,
  on the argument that Fear income already grows steeply with depth. If it turns out a player
  with `auto_start_round` earns faster by farming wave 1–10 loops than by pushing, the fix is
  to bank only Fear from past some wave floor, not to add a depth term back.
- **Whether `dahan_remember`'s 10000 is now wrong.** It gets wiped like everything else, and
  10000 inside one cycle may be unreachable for a long time. Left alone deliberately until a
  played cycle says what a cycle is worth.
