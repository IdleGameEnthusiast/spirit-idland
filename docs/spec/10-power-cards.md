# 10 Power Cards

## Intent

A third source of power, sitting beside the ability kit and the two shops: **cards bought with
Presence, handed to a round by depth, and cast like abilities**. This document is the whole
feature — what a card costs, how it reaches a round, what it does, and the two mechanics the
first seven bring with them: **Defense**, and **Blight that can fall**.

It is cross-cutting by nature, so it lives in one file rather than being scattered across five.
Where an existing document said something this feature makes false, that document is corrected
and points here.

## Rules

- A power card is bought once with Presence and kept forever, **ascension included**.
- Buying a card puts nothing on the board. A round only holds a card once it has **survived to
  a draw wave**.
- A card in hand is an ability in every respect that matters: a cooldown, at most one land
  click, and Focus. It has no unlock cost — the Presence was the cost.
- Cards die with the round that drew them, exactly like Energy and everything Energy bought.
- Nothing about a card is random except **which** one arrives, and the player can pay to
  re-roll that.

## The two rules this changes

### Presence touches the board now, through what the round earns

The old rule was absolute: *Fear buys, Presence decides what Fear is allowed to buy.* It was
already cracked by `presence_current_quickens`, which sells Focus directly. Power cards break
the letter of it outright — Presence buys damage, Fear and Blight removal.

**The replacement rule: Presence buys possibility; the round buys the moment.** A card sitting
in `powerCards.owned` does nothing at all. It reaches the board only through the drip, which is
paid for in waves survived — so Presence still never puts a number on a land directly. What it
buys is something the round has to earn the right to hold, and a round that dies at wave 20
holds none of it however much Presence paid.

That framing is what keeps the two currencies from becoming interchangeable. There is still no
exchange rate: Presence cannot be spent to make a round deeper, and Fear cannot be spent to own
a card. Each buys the other's precondition and neither buys the other's effect.

### Blight can fall

[02-core-loop.md](./02-core-loop.md#blight) said Blight only ever goes up and that nothing in
the design removes it. Four of the first seven cards remove it. The invariant that survives is
narrower and is the one that actually mattered: **the round still ends the instant
`round.blight` reaches `round.blightThreshold`, and removal is preventive, never a rescue.**
The threshold check runs inside the same tick that raised the bar, so there is no window in
which a card can pull a round back from the end.

Worth knowing what removal is worth, because it reads small and is not. A threshold of 10 (15
fully upgraded) means **one removal is 7–10% of the round's whole life**. A card removing 1
every 10 beats outputs, over a 70-wave round, several times the threshold. The per-cast feel is
small; the throughput is the balance risk. Cooldowns are set against the throughput.

## Buying: the draw

The Presence shop grows a row that is not an upgrade at all. It **draws three cards and the
player keeps one**. Owning a card is permanent and survives ascension, like every Presence
purchase.

```txt
powerCardDrawCost(n)   = round(POWER_CARD_DRAW_BASE_COST * POWER_CARD_DRAW_GROWTH ^ n)
                         n = cards already owned
POWER_CARD_DRAW_BASE_COST = 10
POWER_CARD_DRAW_GROWTH    = 1.6
powerCardRerollCost(n) = ceil(powerCardDrawCost(n) / POWER_CARD_REROLL_DIVISOR)
POWER_CARD_REROLL_DIVISOR = 4
```

| draw | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Presence | 10 | 16 | 26 | 41 | 66 | 105 | 168 |
| cumulative | 10 | 26 | 52 | 93 | 159 | 264 | **432** |
| re-roll | 3 | 4 | 7 | 11 | 17 | 27 | 42 |

432 Presence for all seven, against a first Reclaim paying about 5 and the whole automation
catalogue costing 10. It is now by a wide margin the largest Presence sink in the game — the
discount ladders that used to carry 1,045 of it are deleted (see
[04-economy-formulas.md](./04-economy-formulas.md#what-a-grant-is-worth-against-holding-presence)),
so it is
the larger half of what a late purse has to spend on.

**This is the first Presence row that out-earns holding, and that is the point.** Unspent
Presence multiplies Fear generation by 1% a point, uncapped
([04](./04-economy-formulas.md#presence-multiplies-too-and-does-not-cap)), and
[04](./04-economy-formulas.md#these-rows-do-not-out-earn-holding-presence-and-are-not-meant-to)
records honestly that no existing row beats simply keeping the points. 432 Presence held is
+432% on a roughly 0.35 Fear/s baseline, about +1.5 Fear/s. The four Fear-paying cards produce
roughly the same figure **and** lengthen the round they earn it in. So spending wins, by a
factor of two or three rather than fifty — the gap the catalogue was missing, closed at a size
that does not make holding foolish.

### The offer, and the re-roll

- The offer is `min(3, unowned)` cards drawn at random from the cards not yet owned.
- **The offer is stored in state** (`powerCards.draw.offerIds`) the moment it is rolled. It is
  not regenerated on load, on re-render, or on reopening the panel. Without that, a reload is a
  free re-roll and the price is decoration.
- **It is rolled on the first look, not at setup**, and the boot path saves it immediately.
  Rolling it in `createFreshGameState` would cost an RNG draw before the opening Discover, so a
  given seed would land on a different island purely because this feature exists. `ensure` is
  therefore the read path — `powerCards.draw.offerIds` can be legitimately empty on a game that
  has never opened the Presence panel, and reading the raw field is the one way to see an offer
  that is not there yet.
- A re-roll costs `powerCardRerollCost` and replaces the offer under one guarantee: **at least
  two cards the current offer does not contain, when that many exist.**
- **Each card on offer shows its cooldown**, under the name, in the real seconds the rest of the
  HUD counts in. The offer is a choice between three throughputs more than between three
  effects — 10 beats against 50 is the difference between a card leaned on and a card aimed —
  and the effect text says nothing about that. It is the authored cooldown, before Focus; see
  [06](./06-ui-contract.md#power-cards) for why not the effective one.

```txt
unowned    U            fresh = U \ currentOffer
allowed    |U| >= 4     (with 3 or fewer unowned, every card is already on show)

new offer  take min(2, |fresh|) at random from fresh
           fill the remaining slots at random from U minus what is already taken
```

| unowned | fresh | new offer |
| --- | --- | --- |
| 6 or more | 3+ | 2 guaranteed new, 1 random |
| 5 | 2 | 2 new, 1 old |
| 4 | 1 | 1 new, 2 old |
| 3 or fewer | 0 | **re-roll disabled** |

The guarantee is what makes the price honest: paying for a re-roll that could return the same
three cards is paying for nothing. Once the pool is down to the last three there is nothing left
to guarantee, so the button goes dead rather than taking the Presence.

## Holding: the drip

A round hands the player one owned card at a time, on a wave schedule.

```txt
first draw     wave 25
then every     POWER_CARD_DRAW_INTERVAL_BASE - tier(power_card_interval)   waves
               = 20 at tier 0, 10 at tier 10
which card     uniformly at random from owned cards not already in this round's hand
none owned     nothing happens, silently
```

25 / 45 / 65 at tier 0. A round reaching wave 70 draws three cards; the shallow rounds of a
fresh cycle draw none, which is deliberate — the drip is what makes Presence pay for
*possibility* rather than for power, and a card that arrived at wave 1 would be a stat bought
with the wrong currency.

The schedule also gives the late round something it does not have today. The difficulty rungs
start at wave 100 and repeat every 20
([04](./04-economy-formulas.md#unit-stats)); the drip is the player's counter-rung, and the two
ladders climbing against each other is what a deep round is *for*.

### The arrival, and why it is staged

A card is the one thing a round gives rather than sells, and it used to arrive in silence — an
entry appearing in a panel off to the side, with a log line for anyone who thought to look. The
drip's whole argument is that **the round earned this**, and an event nobody notices cannot make
that argument.

So the draw is staged rather than merely applied: a countdown on the wave tile for the waves
before it, a reveal over the island at the moment itself, an entrance as the card lands in the
bar, and a glow on the card that holds until it is first cast. The engine's part is one fx —
`ui.cardFx`, carrying the card and the wave that earned it, written by both draw paths — and the
rest is the view layer's; the surfaces are specified in
[06](./06-ui-contract.md#the-card-arrival).

The countdown is the half that matters most and is the least obvious. The draw wave is known in
advance to the exact number, and until it was shown, the deepest part of a round had nothing to
look forward to. **A reward with no anticipation in front of it reads as noise.** With four waves
of countdown it reads as what the design says it is: the counter-rung to the difficulty ladder,
arriving because the round survived long enough to deserve it.

None of it stops the round. The reveal takes no pointer events, has no button and no timer, and
expires on its own — the same rule the re-draw below follows, and for the same reason.

### The re-draw, and why it does not stop the round

[02-core-loop.md](./02-core-loop.md) is firm that nothing inside a round waits for player
input. A "take it or re-draw?" prompt would be exactly that, so it is not one:

- The card **lands in hand ready and immediately castable**.
- A **Re-draw** button sits on its card, priced in Energy.
- **Casting the card is accepting it.** The button disappears on the first cast, and on the
  next draw.

Non-blocking, no timer, and no exploit — there is no order of clicks that casts a card and then
swaps it for another.

```txt
redrawCost = POWER_CARD_REDRAW_BASE_ENERGY * (draws taken this round)
POWER_CARD_REDRAW_BASE_ENERGY = 10
                            -> 10 for the round's first card, 20 for the second, 30 for the third
```

The new card is drawn from the owned cards that are **neither already in hand nor already
rejected in this same draw**, so every re-draw narrows the pool and the fee is bounded by it.
When the pool empties, the button goes dead and the last card stands.

**Known and accepted:** the fee is flat where Energy income is not. 10 Energy at wave 25 is the
price of Flash Floods and a real decision; 30 Energy at wave 65 is nothing, so the third
re-draw is free in practice. The fee is an early-round constraint by design. If playtest says it
should bite all round, the lever is the growth (`10 * 2^n`), not the base.

## Casting: a card is an ability

Cards reuse the ability runtime whole rather than growing a parallel one:

- A card in hand gets a slot in `state.abilities`, so `tickCooldowns`, `abilityIsReady`,
  `triggerAbility`, `resolveAbilityTarget` and `pendingAbilityTarget` all work untouched.
- `unlockedAbilityIds()` gains a third source beside the spirit kit and `unlock_<id>`:
  `round.cards.handIds`.
- **Cooldowns are authored in beats**, `beats * TIME_SCALE`, like every duration in the game
  ([04](./04-economy-formulas.md#beats-and-time_scale)). Nothing scales them a second time.
- **Focus works on cards**, once `presence_current_quickens` is owned. A card carries no
  `unlockCost`, so `focusBaseCost(id)` falls through — each card record carries its own
  `focusBaseCost`, set to its cooldown in beats, so a slow card costs more to hasten.
- **No auto-cast.** The five automations are Fear rows bought against named kit abilities;
  nothing bought a card's cast. Cards are played by hand, and that is the counterweight to their
  strength.
- A card arrives **ready**, not cooling — the same rule a bought unlock follows.

### Fear a card pays

Card Fear is a **third source**, beside kill Fear and wave Fear:

```txt
cardFear = amount * presenceMult
```

Multiplied by `presenceMult` only — not by `rising_dread` (which multiplies kills) and not by
`mounting_terror` (which multiplies waves). Folding it into either would make that ladder's
tuning do two jobs, and both are already capped at ten tiers against a fixed income shape.
It accumulates into `round.fearEarned` and therefore into `meta.cycleFearGenerated`, so cards
feed the ascension payout like everything else.

`fear_per_invader` is deliberately a flat rate per body rather than per point of power, which
makes it the one place in the economy that does not read the power scale. Accepted as written;
if it goes stale against the wave-100 damage rungs, the fix is `power * k` and the card text
changes with it.

## Defense

The first mechanic a card brings that the fight did not have. **A ward laid on a land**: it
waits, unspent, for as long as it takes, cancels invader attack when the attack arrives, and is
gone one wave later.

```txt
effective = max(0, gross - defense)

if effective == 0:                        # Defense alone covered the attack
    blightPerSecond = 0                   # no floor, nothing at all
    dahanPerSecond  = 0
else:
    net             = max(effective - dahanCount * 2, effective * BLIGHT_FLOOR_FRACTION)
    blightPerSecond = net * BLIGHT_PER_DAMAGE_SECOND
    dahanPerSecond  = effective * DAHAN_LOSS_PER_DAMAGE_SECOND
```

The Dahan line reads `effective` in place of `gross` and nothing else. The first draft of this
document divided it by the survivors against a `DAHAN_CONCENTRATION_CAP`, which is the
concentrated rate [02](./02-core-loop.md#the-fight) replaced with a flat one before this
feature was written — it measured as the opposite of what it read as, and the cap never bound.
Defense inherits whichever rate is live rather than reintroducing the old one.

Five properties, each deliberate:

- **Total denial is measured against Defense alone**, not against Defense plus the Dahan's own
  cancellation. Otherwise one point of Defense would flip a Dahan-held land from seeping to
  immune, and the number printed on the card would stop meaning anything. Defend 6 covers a
  6-attack land whatever else stands in it.
- **Total denial ignores `BLIGHT_FLOOR_FRACTION`.** A held land seeps a quarter of its gross and
  no stack of Dahan can ever stop that ([02](./02-core-loop.md#blight-rises)); a ward can. The
  acceptance rule that no land is ever permanently safe survives intact, because a ward is spent
  after one wave — safety is now purchasable by the wave and still never by the round.
- **Below the threshold it is a plain reduction.** 6 attack against Defend 2 is read as a
  4-attack land in every formula: `max(4 - dahanDefence, 1)` for Blight, and 4 rather than 6
  concentrated on the Dahan. So Defense protects Dahan, which their own defence does not — the
  price of that is that it runs out.
- **It expires one full wave interval after it first does anything**, not at the next wave
  boundary. Boundary consumption made the *cast time against the visible wave clock* decide
  whether a ward was worth twenty seconds or one, which is a trap a HUD countdown teaches good
  players to exploit and never teaches new ones at all. A duration started on first use gives
  every cast the same value.
- **Any use spends the whole pool.** Defend 6 that cancelled 2 is gone with the 4 unused. That
  is what stops a ward from being a stat, and it is why stockpiling needs no cap: casting
  Encompassing Ward eight times on a quiet land does bank Defend 16 there, but it pays out
  exactly once.

Everything else about it:

```txt
scope           per land. `round.defense[land]`, cleared by startRound
stacking        additive, no cap
quiet land      no invaders means no use, so a ward waits indefinitely
pushed away     the ward stays; it is on the land, not on the fight
Dahan strike    unaffected. Defense cancels what invaders deal, not what Dahan deal
Build/Discover  unaffected. A ward stops damage, never reinforcement
```

**Push destinations** now read Defense. The open-ground ranking in
[04](./04-economy-formulas.md#pushing) becomes: a land holding **Dahan and Defense**, then
Dahan, then Defense, then coastal, then the lowest land id. Shoving a unit onto a warded land is
strictly good for the player, so the water should prefer it — and it stays behind the Dahan
preference, because Dahan kill what arrives and a ward only absorbs it.

## Removing Blight

```txt
targeted card    remove from the clicked land, if it has any; otherwise the clause does nothing
untargeted card  remove from the board's most-blighted land; ties on the lowest land id
either way       round.blight -= n and round.blightByLand[land] -= n, together
```

Every one of the first seven cards that removes Blight also does something else that needs a
land, so all seven resolve through the first rule. The second exists for the card shape that has
not been written yet — Fear plus removal, with nothing to click.

This turns `round.blightByLand` from a display tally into a targeting rule, which is the first
thing that has ever read it for a decision. `round.blightProgress[land]` is **not** touched: a
removal takes whole Blight off the round's clock and leaves the land's part-filled bar where it
stands.

## The seven cards

Cooldowns in **beats** (`beats * TIME_SCALE`, so double for real seconds at the shipped
`TIME_SCALE = 2`). The kit for comparison: Innate 8/15/22, Boon 12, Bounty 15, Floods 25,
Wash 30.

| id | name | beats | needs target | brings |
| --- | --- | --- | --- | --- |
| `pull_beneath` | Pull Beneath the Hungry Earth | 10 | land with invaders | Fear, terrain bonus |
| `song_of_sanctity` | Song of Sanctity | 10 | see below | destroy, push-all, removal |
| `uncanny_melting` | Uncanny Melting | 12 | see below | Fear per invader |
| `natures_resilience` | Nature's Resilience | 12 | any land | **Defense** |
| `encompassing_ward` | Encompassing Ward | 20 | no | Defense, all lands |
| `accelerated_rot` | Accelerated Rot | 30 | land with invaders or Blight | — |
| `tsunami` | Tsunami | 50 | coastal land with invaders | Dahan destruction, multi-land |

### Effect steps

A kit ability carries one `effect` string. Every card here is two to four clauses with
conditions, so cards carry an ordered **step list** instead. The five kit abilities are left
exactly as they are.

```js
effects: [
  { kind: "fear_per_invader", amount: 3, when: "invaders_present" },
  { kind: "remove_blight",    amount: 1, when: "terrain:desert,wetlands" }
]
```

Steps resolve in order against one snapshot of the target land taken before the first step, so a
clause cannot be defeated by an earlier clause's kill. Kinds and conditions:

```txt
kinds   fear_flat        { amount }
        fear_per_invader { amount }                  counts bodies, not power
        damage           { amount, terrainBonus?, terrains? }   shared kill-first rule
        remove_blight    { amount }
        defend           { amount, scope: "target" | "all" }
        push_all         { unitType }                shared push rule, no count cap
        destroy_units    { unitType, amount }        removal, pays Fear and Energy
        destroy_dahan    { amount }                  a cost; pays nothing

when    invaders_present | explorers_present | coastal
        terrain:<a>,<b>  | else                     `else` pairs with the step above it
```

`terrain:<a>,<b>` names its terrains in one comma-joined string and is split before it is
matched (`conditionTerrains`). Handing the whole string to `terrainList`, which takes a list,
matches nothing and fails *silently* — the card casts, pays, and skips the clause.

`else` reads the **condition** of the step above it rather than whether that step found anything
to do. A Destroy that fizzled on a land whose Explorer was already gone is still the Explorer
mode of the card having been chosen, and the removal must not fire behind it.

`destroy_units` goes through `creditDefeat`, exactly like the sea in `wash_away`, so a removal
pays Fear and Energy without spending damage. `destroy_dahan` does not pay anything — the Dahan
are allies — and must reset `round.dahanProgress[land]` when it empties a land, holding the
invariant that reinforcements arrive at a full bar.

### The records

#### `pull_beneath` — Pull Beneath the Hungry Earth

> *3 Fear and 2 Damage. If the target land is Desert or Wetlands, +1 Damage.*

10 beats. Target: a land holding at least one invader.

```js
effects: [
  { kind: "fear_flat", amount: 3 },
  { kind: "damage", amount: 2, terrainBonus: 1, terrains: ["desert", "wetlands"] }
]
```

The `terrainBonus` field is the same shape `flash_floods` uses for `coastalBonus`, deliberately.
Note it does 2–3 damage every 10 beats against the Floods' 1–2 every 25, roughly three times the
kit's damage rate — acceptable for a card that costs Presence and cannot arrive before wave 25,
but it is a reason the kit will look shabby at the next balance pass. The +1 also keeps it
killing Towns past wave 110, where the health rung stops a flat 2.

#### `song_of_sanctity` — Song of Sanctity

> *Destroy 1 Explorer, then Push all other Explorers. Otherwise, Remove 1 Blight.*

10 beats. Target: a land holding an Explorer, **or** a land holding Blight.

```js
effects: [
  { kind: "destroy_units", unitType: "explorers", amount: 1, when: "explorers_present" },
  { kind: "push_all",      unitType: "explorers", when: "explorers_present" },
  { kind: "remove_blight", amount: 1, when: "else" }
]
```

The `else` is player-controlled: targeting a land with no Explorers always takes the removal. So
this is honestly a two-mode card rather than a conditional one, and it is priced as its stronger
mode. Its shape drifts on its own over a round — Explorers thin out as Builds turn them into
Towns, so it starts as a clearing tool and ends as a removal card without any rule saying so.

#### `uncanny_melting` — Uncanny Melting

> *If Invaders are present, 3 Fear per Invader. If the target land is Desert or Wetlands,
> Remove 1 Blight.*

12 beats. Target: a land holding invaders, **or** a Desert/Wetlands land holding Blight.

```js
effects: [
  { kind: "fear_per_invader", amount: 3, when: "invaders_present" },
  { kind: "remove_blight",    amount: 1, when: "terrain:desert,wetlands" }
]
```

The two clauses are independent — a Desert land with no invaders still gets its removal, and a
Jungle land full of Cities still pays its Fear. Desert `2`/`8` and Wetlands `1`/`7` is four of
the eight lands, one coastal pair and one inland pair each, so the bonus is a positional
question rather than a lucky one.

#### `natures_resilience` — Nature's Resilience

> *Defend 6. Remove 1 Blight.*

12 beats. Target: any land — it never fails, since Defend always applies.

```js
effects: [
  { kind: "defend", amount: 6, scope: "target" },
  { kind: "remove_blight", amount: 1 }
]
```

Defend 6 covers one Explorer, one Town and one City together — the worked example
[02](./02-core-loop.md#blight-rises) uses for a saturated land. Against a 10-beat wave a 12-beat
cooldown is roughly one fully warded land per wave, which is strong and bounded: it is one land,
and it costs a whole hand slot.

#### `encompassing_ward` — Encompassing Ward

> *Defend 2 in each land.*

20 beats. No target.

```js
effects: [ { kind: "defend", amount: 2, scope: "all" } ]
```

Its value runs backwards to the drip that delivers it, and this is known rather than overlooked.
Defend 2 fully denies a land holding two Explorers or one Town — most of the board early — but
against a 6-attack land it shaves a third of one wave and then vanishes from all eight lands at
once. So it is an early-board card the player cannot own before wave 25. Two things soften that:
unused wards on quiet lands accumulate, so it banks value against the invaders' spread rather
than against the current wave; and it is exactly the card the Energy re-draw exists to throw
back at wave 65. If playtest says that is not enough, the lever is spending the pool
proportionally rather than whole — not a cap, and not a bigger number.

#### `accelerated_rot` — Accelerated Rot

> *10 Fear. 5 Damage. Remove 1 Blight.*

30 beats. Target: a land holding invaders or Blight.

```js
effects: [
  { kind: "fear_flat", amount: 10 },
  { kind: "damage", amount: 5 },
  { kind: "remove_blight", amount: 1 }
]
```

The best-shaped card of the seven and the one to copy: it pays in all three currencies the round
cares about, on a cooldown that makes each payment a decision. 5 damage under the kill-first
rule takes a City and a Town, or a Town and three Explorers.

#### `tsunami` — Tsunami

> *Only in a coastal land: 10 Fear. 8 Damage. Destroy 2 Dahan.*
> *Optional: in each other coastal land, 5 Fear, 4 Damage, Destroy 1 Dahan.*

50 beats — the longest cooldown in the game. Target: a **coastal** land holding invaders.

```js
effects: [
  { kind: "fear_flat", amount: 10 },
  { kind: "damage", amount: 8 },
  { kind: "destroy_dahan", amount: 2 }
],
alsoEachOtherCoastal: [
  { kind: "fear_flat", amount: 5 },
  { kind: "damage", amount: 4 },
  { kind: "destroy_dahan", amount: 1 }
]
```

**The optional half costs zero extra clicks.** It is a **sliding switch on the card**, default
on, remembered across casts and across rounds — the same control and the same reasoning as the
auto-cast switches ([06](./06-ui-contract.md#ability-status-rules)): a setting that stays where
it is put. Two cast buttons would charge a click on every cast for a decision the player changes
twice a round, and a modifier key would be undiscoverable.

The secondary lands resolve **in ascending land id** after the primary land is fully resolved,
and each is independent — a coast with no invaders still loses its Dahan, which is the cost the
switch exists to let the player refuse.

Only lands `1`, `2` and `3` are coastal, so Tsunami is dead whenever the pressure has gone
inland. That is its weakness and it is the right kind: positional, readable off the board, and
answered by the rest of the kit, whose pushes already walk stacks toward the water.

### Localization

Both languages are required ([07](./07-content-registry.md#localization-registry)), real
umlauts, UTF-8 without a BOM. **The German names below are placeholders** written for this pack,
not the published German card names — replace them if the official ones are to hand.

| id | English | German (placeholder) |
| --- | --- | --- |
| `pull_beneath` | Pull Beneath the Hungry Earth | Hinab in die hungrige Erde |
| `song_of_sanctity` | Song of Sanctity | Lied der Unverletzlichkeit |
| `uncanny_melting` | Uncanny Melting | Unheimliches Schmelzen |
| `natures_resilience` | Nature's Resilience | Widerstandskraft der Natur |
| `encompassing_ward` | Encompassing Ward | Umfassender Schutzwall |
| `accelerated_rot` | Accelerated Rot | Beschleunigte Fäulnis |
| `tsunami` | Tsunami | Tsunami |

## The Fear row

One new repeatable upgrade, `power_card_interval` — *The Island Remembers Sooner*. Each tier
shortens the gap between draws by one wave.

```txt
interval  = POWER_CARD_DRAW_INTERVAL_BASE - tier      20 waves at tier 0, 10 at tier 10
baseCost  = 30, costGrowth 1.6, maxTier 10
```

| tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cost | 30 | 48 | 77 | 123 | 197 | 315 | 503 | 805 | 1288 | 2062 |
| cumulative | 30 | 78 | 155 | 278 | 475 | 790 | 1293 | 2098 | 3386 | **5448** |

It is the Fear catalogue's shape applied to the one thing Fear should buy here — *how fast a
round rebuilds itself* — and it is priced knowing it nearly doubles the catalogue's 7,031 total.

**Its rungs are lumpy, deliberately and unavoidably.** Draws land at 25, 25+I, 25+2I against a
round of integer waves, so a tier only pays when it moves a draw under the round's ceiling:

| interval | 20 | 19 | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cards by wave 70 | 3 | 3 | 3 | 3 | 3 | **4** | 4 | 4 | 4 | 4 | **5** |
| cards by wave 150 | 7 | 7 | 7 | 8 | 8 | 9 | 9 | 10 | 11 | 12 | 13 |

So at a 70-wave round, tier 5 (475 Fear cumulative) is the first purchase that adds a card and
tier 10 is the second. At 150 waves nearly every rung is live. That is `high_water_mark`'s shape
exactly — near-worthless to a player dying early, excellent to one pushing deep — and it is the
row's argument for existing. The alternative, four tiers of 20 → 17 → 14 → 11, makes every
purchase visibly move something and is the fallback if the ladder reads dead in play.

### It is not on the shelf until the first card is bought

The row carries `revealedBy: "power_card_owned"`, and the shop prints it only once
`powerCards.owned` is non-empty. Its whole text prices the gap between two cards, and to a
player who has never held one that is a price on a mechanic they have not met — noise in the
one list the shop expects them to read.

**A reveal is not a lock.** `upgradeRevealed(state, id)` decides whether the row is *printed*
and nothing else: no price moves, and `purchaseUpgrade` does not consult it, because a reveal
that can refuse a buy is one of the three dead gates
([05-progression.md](./05-progression.md)) wearing a new name. The condition is passed by
playing rather than by shopping, and owned cards survive Reclaim — `ascend` wipes
`upgrades.purchased` and never touches `powerCards.owned` — so a row revealed once stays
revealed. An unknown `revealedBy` key reveals rather than hides, so a catalogue typo shows a
row that meant to wait instead of deleting one from the shop.

## State

All additive, so the save migration stays a no-op — see
[03-state-contract.md](./03-state-contract.md#older-save-files-keep-working).

```json
{
  "powerCards": {
    "owned": [],
    "draw": { "offerIds": [], "rerollCount": 0 }
  },
  "round": {
    "defense": { "1": 0, "...": 0, "8": 0 },
    "defenseExpiry": { "1": null, "...": null, "8": null },
    "cards": {
      "handIds": [],
      "drawsTaken": 0,
      "nextDrawWave": 25,
      "pendingRedrawId": null,
      "rejectedIds": []
    }
  },
  "ui": { "cardOptions": { "tsunami": true } }
}
```

- `powerCards.owned` is permanent and **survives ascension**, listed under *kept* beside
  `presenceUpgrades.purchased`. `powerCards.draw` is cleared when a draw is taken.
- Everything under `round` is cleared by `startRound`, cards and wards alike.
- `round.defenseExpiry[land]` holds the `round.elapsedSeconds` at which the ward lapses, or
  `null` while it is still unused. Storing the deadline rather than a countdown means the
  speed dial and the wave gate need no special case: both already move `elapsedSeconds`.
- `ui.cardOptions` is a preference and survives ascension with the rest of `ui.*`.
- Normalization drops unknown card ids, collapses duplicates in `owned` and `handIds`, clamps
  `nextDrawWave` to at least 1, and drops a `handIds` entry naming a card not in `owned`.

## What is deliberately not designed

- **A card upgrade path.** Once every card is owned the draw ladder has nothing left to sell.
  The intended successor is a repeat draw offering a **duplicate that improves a card already
  owned** — a cooldown cut, or +1 to its numbers — which makes the ladder endless and gives the
  Presence economy a sink that scales. Not designed, not priced.
- **Choosing a card outright.** The Energy re-draw is the whole of the randomness valve, and it
  is deliberately a cost rather than a guarantee.
- **A Fear row that multiplies card output.** Easy to add as a fourth ladder in the existing
  shape, and held back until the card numbers have been played against.
- **Automations.** No card casts itself, at any price.
- **More cards.** The seven here are the first pass; the draw ladder and the effect-step list
  are both built to take more without a schema change.

## Acceptance

- Buying a card costs Presence, is permanent, and survives an ascension.
- A stored offer is identical after a save, a load and a re-render; only paying re-rolls it.
- A re-roll returns at least two cards the previous offer did not hold, whenever four or more
  cards are unowned, and is refused otherwise.
- A round draws its first card at wave 25 and one more every `20 - tier` waves after, drawing
  nothing when the player owns nothing and never drawing a card already in hand.
- A drawn card is castable on the tick it arrives, and its re-draw button is gone the moment it
  is cast.
- A card's cooldown, targeting, Focus and cancel-by-reclick behave identically to a kit
  ability's.
- Defense at or above a land's gross damage stops that land's Blight and Dahan losses entirely;
  below it, the land resolves as though its gross were reduced by that much.
- A ward lapses exactly one wave interval after the first tick in which it did anything, and
  never before it has done anything.
- `round.blight` falls by exactly the amount removed, `round.blightByLand` falls with it, and
  the round still ends in the tick the threshold is reached.
- Nothing in a round waits for player input, the draw included.
