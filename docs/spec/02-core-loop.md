# 02 Core Loop

## Intent

Specify the round loop: automatic invader/Dahan resolution on a live clock, player-triggered
cooldown abilities, Blight as the round's only loss condition, and the Fear-funded permanent
upgrade shop between rounds.

## Rules

- A round runs in real time. Nothing *inside* it waits for player input: no wave, no strike
  and no Blight ever stops to ask. The clock the round runs on is the player's, though — they
  set how fast it turns and whether it stops at each wave. See [Pacing](#pacing).
- Exactly one loss condition exists: Blight reaching `round.blightThreshold`. There is no
  other way for a round to end.
- Casting an ability is cooldown-gated, not resource-gated. Energy gates *access* to an
  ability rather than each use of it. See [Energy](#energy).
- Waves resolve on a fixed interval of *game* seconds, and always the whole interval: the
  player can change how fast those seconds pass, and can make the round wait at the end of one,
  but can never pull a wave forward or shorten the interval before it.
- Fear earned during a round is never lost, including when the round ends.
- Energy, and the abilities bought with it, die with the round that earned them — Fear does
  not. That is the whole difference between the two: Fear buys permanent upgrades and carries,
  Energy unlocks abilities inside the round it was earned in and is given back after. The one
  crossing between them is `headwaters`, a Fear upgrade that pays into what a round *opens*
  with; it never tops a round up once the round is running.
- A new round resets the island (invaders, Dahan, Blight, wave timer) to the spirit's
  current permanent-upgrade baseline. It does not reset Fear or purchased upgrades.

## Round Sequence

1. **Round setup.** Reset `invaders`, `dahan`, `blight`, and the invader track to the
   spirit's starting values, modified by any permanent upgrades purchased. Reset every
   ability's cooldown to ready. Set `round.status` to `running` and `round.elapsedSeconds`
   to 0. Then run the **opening Discover**: resolve one Discover phase on the drawn terrain
   and shift the track, so the round opens with explorers already ashore and the terrain
   they landed in sitting in the Build slot. It is not a wave — `wavesResolved` stays 0, and
   no timer is touched. Without it the island stands empty for the whole first wave interval
   and wave 1 has nothing to build on. The opening draw skips any terrain with no land that
   can accept an explorer on an empty board, which on this island means mountains.
2. **Live resolution**, repeating until the round ends:
   - Every tick, resolve the continuous fight in every land: Blight accrues, Dahan fall. See
     [The Fight](#the-fight).
   - The Dahan strike timer counts down. At 0, every land holding both Dahan and invaders
     strikes, and the timer resets.
   - The wave timer counts down. At 0, resolve one wave (Build, then Discover, then shift the
     invader track) and reset the timer — or, with auto-proceed off, hold the gate there and
     resolve nothing until the player calls it. See [Wave Resolution](#wave-resolution).
   - At any moment an ability is off cooldown, the player may trigger it. See
     [Abilities](#abilities).
   - After the fight resolves each tick, check `round.blight >= round.blightThreshold`. If
     true, the round ends immediately and nothing else in that tick resolves.
3. **Round end.** Set `round.status` to `ended`. Stop the wave timer and freeze all board
   state. Log the round number reached and the Fear earned.
4. **Upgrade shop.** The player spends any accumulated `meta.fear` on permanent upgrades.
   See [Between Rounds](#between-rounds).
5. **Next round.** Starting a new round returns to step 1 and `round.number` increments. The
   two best-wave records are written at step 3 rather than here, off `round.wavesResolved`:
   `meta.bestWaveReached` all-time, `meta.cycleBestWave` since the last ascension. The round
   number itself is not a record — nothing reads it, and every round starts at the bottom rung
   whatever number it wears.

## Abilities

Abilities replace the turn-based prototype's cards. Each has an id, a cooldown, and an
effect that either reinforces the island's defense (more Dahan, delayed Blight) or damages
invaders directly.

- An ability is usable whenever `abilities.<id>.cooldownRemaining <= 0`.
- Triggering an ability applies its effect immediately and resets
  `abilities.<id>.cooldownRemaining` to its full cooldown.
- Cooldowns tick down continuously in real time, independent of the wave timer.
- If an ability's effect needs a land, it takes exactly one click on the board — there is no
  multi-step targeting flow left in this design. An ability that needs no land resolves the
  instant it is triggered.
- The specific ability kit (which of the four River abilities do what, and their cooldown
  values) is placeholder content — see [07-content-registry.md](./07-content-registry.md) —
  and is expected to change during balancing.

### Energy

The turn-based prototype gated card plays on an Energy resource fed by the presence tracks.
Presence is retired; Energy is not. It is back, fed by the fight itself and spent on the
ability bar rather than on individual casts:

- **Income.** Every defeated invader pays Energy equal to its attack — an explorer 1, a town
  2, a city 3. The same power scale Fear reads, deliberately: a unit's threat is its worth,
  and a second scale would only be a second thing to learn. Whole numbers, unlike Fear.
- **Cost.** Casting is still free of everything but its cooldown. What Energy buys is
  *access*: the spirit opens every round with two abilities and the rest priced at 5, 10 and
  20, plus the Innate's own tier ladder at 40 and 150.
- **When.** Purchases are mid-round by nature. The Energy came from the fight and does not
  outlive it, so that fight is the only one it can pay for.
- **Persistence — none.** `resources.energy`, `round.purchasedAbilityIds` and
  `round.abilityTiers` are all cleared by `startRound`. Every round is built from the same
  opening hand, out of Energy earned in that round alone.
- **The opening figure.** The one thing the shop sets here is what the purse *starts* at:
  `headwaters` opens a round with 1 to 35 Energy already in hand, by tier. Nothing a round
  earned is carried by it — the figure is fixed before the round begins, like the Dahan
  placement, and a round that ends holding 40 Energy still opens the next one at the ladder's
  number.

That last point is what separates the two currencies. Fear carries and buys permanent
upgrades between rounds; Energy is spent inside a round and dies with it. So the shop decides
*how fast a round can be rebuilt* — more Dahan striking, longer before Blight ends it, and now
how much of the bar is already bought when the first wave lands — and the fight decides *how
far that round gets*. A round can never be won on a previous round's leftovers.

Answered against the alternative of a per-cast cost. A per-cast cost makes a good round
cheaper to play than a bad one — exactly backwards for a loop whose whole tension is that
pressure only rises — and it hands the player a second cooldown to read on every button.
Gating access instead means Energy changes what the bar *is* rather than how often it can be
pressed.

Ability *upgrades* (spending Energy to improve an ability already owned) are the intended
next use of the currency and are not implemented; the flat unlock price is a placeholder
until there is a curve to tune it against.

## Pacing

Two controls over one thing: how fast the round reaches the player. Neither changes what the
round *costs*. A wave still takes one whole wave interval, an ability still fires the same
number of times inside one, and a land under the same damage still takes exactly as many
waves to Blight — because only the map from real seconds to game seconds moves.

**The speed dial** (`ui.gameSpeed`, one of `GAME_SPEEDS`) is how many game seconds one real
second buys. `1x` is the game as it ships, at the twenty-second wave `TIME_SCALE` sets; `2x`
runs it at double speed for a ten-second wave; `0x` stops every clock in the round — the
fight, both timers, the cooldowns and `elapsedSeconds` alike. The engine only ever thinks in
the seconds it was authored in, so the whole of the dial is that one multiplication on `dt`,
and nothing downstream of the tick knows a speed exists. A redeemed playtest code appends `8x`
to the dial — far past what the round is balanced to be read at, and a tool for looking at a
late wave rather than a way of playing to one; see
[06-ui-contract.md](./06-ui-contract.md#playtest-tools).

**The wave gate** (`ui.autoProceed`, off by default) decides whether a wave may arrive
unasked. With it on, the loop is exactly as it was: the timer empties, the wave resolves, the
timer refills. With it off:

- The round opens on a held gate. The wave timer is already full there, so the first call
  starts the clock without costing a wave. Leaving the shop is itself that call, so only a
  round reached without the shop — the first of a new game — asks for it.
- When the bar empties, the wave comes due and *nothing* resolves it but the player. Every
  clock stops with it, not just the wave timer: no Blight accrues, no Dahan fall or strike,
  no cooldown runs. The round is a still frame until it is called.
- Calling it resolves exactly one wave and refills the timer to a whole interval. The
  overshoot past 0 is dropped rather than carried — the click buys the interval the refilled
  bar is promising.
- Switching auto-proceed on releases a gate that is already holding, without resolving
  anything itself: the next tick finds the timer at 0 and runs the wave down the same path
  every automatic wave takes.

**The auto-cast toggles** (`ui.autoCast`, all on by default) are the third preference of this
kind, and the same shape as the speed dial and the wave gate: they change what the player has
to press, never what the rules are. One switch per ability automation, on the ability's own
card, saying whether that automation still casts. Switching one off stops future casts and nothing
else — no cooldown is reset, shortened or lengthened, no cast is undone, nothing is refunded,
and the upgrade is never un-bought. It bites on the next tick rather than the next round,
because it is a setting and not a power the round runs on. What does wait for the next round is
*ownership*: an automation bought mid-round is idle until `startRound` takes its snapshot, so
the switch appears at once and on, and what it governs starts next round. See
`ui.autoCast` in [03-state-contract.md](./03-state-contract.md) and
[07-content-registry.md](./07-content-registry.md).

## Wave Resolution

A wave is the automatic unit of invader *reinforcement*. It deals no damage at all — damage
lives in [The Fight](#the-fight), which never stops. A wave self-triggers on
`WAVE_INTERVAL_SECONDS` and does two things:

1. **Build** every land of the current `invader.build` terrain.
2. **Discover** every eligible land of the current `invader.explore` terrain.
3. **Shift the track**: old `explore` becomes `build`, a new `explore` is drawn.
4. Reset the wave timer to `WAVE_INTERVAL_SECONDS`.

The track is two slots, not three. There is no Ravage slot, because ravaging is no longer
something that happens to a named terrain on a schedule — see [The Fight](#the-fight).

Build and Discover are unchanged from the turn-based design (see
[09-island-board.md](./09-island-board.md) for the per-land rules); only their trigger
changed, from a click to a timer.

## The Fight

Every land holding invaders is under attack every moment of the round. There is no phase, no
tick where damage lands in a lump, and no terrain the invaders pick — they ravage everywhere,
all the time. Two things accrue continuously from it, each as a fraction that only lands on a
whole number when its bar fills.

A land's **gross damage** is the sum of its invaders' damage values: explorers 1, towns 2,
cities 3. A Dahan **defends** for 2 of it.

### Blight rises

```txt
net             = max(grossDamage - dahanCount * 2, grossDamage * BLIGHT_FLOOR_FRACTION)
blight per sec  = net * BLIGHT_PER_DAMAGE_SECOND
```

Counted in **beats** — the design's unit of time, worth `TIME_SCALE` real seconds each. See
[04](./04-economy-formulas.md#beats-and-time_scale) for why every duration is written this way
and why turning the dial cannot move the balance.

At 2% per damage-beat, one point of net damage takes 50 beats to become a Blight. One
explorer, one town and one city in an undefended land is 6 damage, so 12% a beat, so a
Blight roughly every 8.3 beats. Put two Dahan in it and 4 of that 6 is cancelled: 2 net,
4% a beat, one Blight every 25 beats.

A land whose Dahan out-defend its invaders is **held**, which is not the same as safe: a
quarter of the gross always seeps through. The same land with four Dahan cancels all 6 on
paper but still takes 1.5 net, one Blight every 33 beats. Defence buys time, not immunity —
a stack parked on a land slows the loss down instead of ending it, so the land still has to
be cleared.

### Dahan fall

```txt
dahan per sec   = (grossDamage / min(dahanCount, DAHAN_CONCENTRATION_CAP))
                  * DAHAN_LOSS_PER_DAMAGE_SECOND
```

Dahan take the **gross** damage, not what got past their own defence: the invaders are
swinging at them, and a land can be held for Blight purposes while its defenders are still
dying.

The damage **concentrates** on whoever is left. Two Dahan against 6 damage each take 3, so the
first falls in about 16.7 seconds; the survivor then takes all 6 and falls in 8.3. That is
deliberate: losing a defender both speeds up the Blight behind it *and* shortens the life of
the next one, so an under-defended land collapses rather than declining evenly.

The spiral only runs **downward**. Past `DAHAN_CONCENTRATION_CAP` the concentration stops, so
a fourth Dahan does not make the first three harder to kill — it just adds one more body to
the queue. Uncapped, a stack's lifetime grew with the square of its size, which is what made
piling everything into one land beat defending six.

When the last Dahan in a land falls, that land's casualty bar resets to zero, so
reinforcements arrive at full strength rather than inheriting a nearly-full bar.

### Defense, when a ward is standing

A land can also carry **Defense**, laid on it by a power card. It is not a unit and not a
permanent stat: a pool that waits on the land, cancels invader attack when attack arrives, and
lapses one wave interval after it first does anything. Defense at or above the land's gross
stops that land's Blight and casualties **entirely**, floor included — which is the one thing no
number of Dahan can do — and below that it is read as a plain reduction of gross in both
formulas above. The full rule, and why it is the one exception to `BLIGHT_FLOOR_FRACTION`, is
in [10-power-cards.md](./10-power-cards.md#defense).

### Dahan strike back

On `DAHAN_ATTACK_INTERVAL_SECONDS`, every land holding both Dahan and invaders strikes at
once: `DAHAN_ATTACK_DAMAGE` per Dahan, spent on the highest-tier invader type present first
(cities, then towns, then explorers), 1 damage at a time, until the pool or the invaders run
out. Defeated invaders award Fear through the normal defeat path.

This timer is **not** the wave timer. It happens to start at the same value, so the two read
as one rhythm in round one, but it is its own constant and the shop does shorten it — see
*The Dahan Remember* below. Nothing should re-derive it from `WAVE_INTERVAL_SECONDS`.

The interval is read through `roundDahanAttackInterval` rather than off the constant:
`dahan_remember` divides it by `1 + haste`, up to twice as fast at a full pool. The tier comes
from the round's upgrade snapshot, so filling the pool mid-round speeds up the *next* round —
see [04-economy-formulas.md](./04-economy-formulas.md#the-interval-and-the-one-thing-that-shortens-it).

## Blight

Blight is the round's clock. Nothing **in the fight** ever takes it back: no rate, no defence
and no cleared land reduces a Blight already taken. What can is a power card, four of the first
seven of which remove 1 — specified in
[10-power-cards.md](./10-power-cards.md#blight-can-fall). Removal is preventive rather than a
rescue: the threshold check runs inside the tick that raised the bar, so there is no moment at
which a card can pull a round back from its end.

- `round.blight` is the round total; `round.blightByLand` is where it came from.
- `round.blightProgress[land]` is the fraction of the next Blight that land has accrued.
  A filled bar subtracts exactly 1 and **carries the remainder** rather than resetting, so no
  fraction of a damage-second is ever discarded.
- The round ends the instant `round.blight` reaches `round.blightThreshold`.
- These numbers are a first-pass placeholder; see
  [04-economy-formulas.md](./04-economy-formulas.md) for the current constants and
  [Implementation Microtasks](../tasks/implementation-microtasks.md) for balancing follow-up.

## Fear

Fear keeps its turn-based formula: defeating an invader awards `defeatedPower * 0.35` Fear,
whether the defeat came from a Dahan strike or an ability. Unlike the turn-based build,
Fear is no longer just tracked — it is the round's entire point:

- Fear accumulates in `meta.fear`, a persistent value that survives every round, won or lost.
- It is spent only between rounds, in the upgrade shop.
- There is no in-round spend for Fear in this slice.

## Between Rounds

When `round.status` is `ended`, the player can spend `meta.fear` on permanent upgrades
before starting the next round. Upgrades apply to the round-setup baseline in
[Round Sequence](#round-sequence) step 1 — shorter ability cooldowns, more starting Dahan, a
higher Blight threshold, or a new ability, depending on what's purchased. The exact
catalogue is content, not loop mechanics; see [05-progression.md](./05-progression.md).

Starting the next round is always available once in the shop; there's no requirement to
spend all Fear first.

### The other thing an ended round allows

Ascension is offered here too, once unlocked, and nowhere else. It is not a step in the round
sequence because it is not part of one: it ends the **cycle** the rounds belong to, hands back
every Fear purchase and pays out Presence, and starts a fresh round from an empty catalogue.
See [05-progression.md](./05-progression.md#ascension).

Restricting it to `round.status === "ended"` is the same rule the shop follows, and it buys one
thing beyond consistency: a round in progress has banked no Fear, so the question of whether a
part-finished round counts toward the payout never comes up.

## Dahan Rules

- Dahan are tracked per land, same as the turn-based build.
- Round setup seeds Dahan the same way fresh-game setup used to: a base count distributed
  across lands, at most 2 per land, modified upward by any permanent Dahan upgrade
  purchased.
- Dahan defend continuously and strike periodically; see [The Fight](#the-fight).
- `rivers_bounty` is the only ability that touches Dahan: it **creates** one, in the land with
  the fewest Dahan that is actually under attack — or, when no land is under attack, simply in
  the land with the fewest Dahan. Nothing else reinforces or relocates them. An earlier draft
  gathered a Dahan out of a neighbouring land instead, which made the ability a redistribution
  rather than a reinforcement — it bought one land defence at another's expense, and the island
  was no stronger for it. A later one refused outright on a quiet island, which punished the
  player for having cleared the map at exactly the moment to be building up for the next wave.

## Damage Rules

- Explorers have 1 health and 1 damage.
- Towns have 2 health and 2 damage.
- Cities have 3 health and 3 damage.
- Dahan have 2 health and 2 damage.
- `damage` is a **rate** now: what a unit deals every second it stands in a land. A Dahan's 2
  is what it cancels out of the invader total.
- `health` only governs invaders, who are still killed in whole points. Dahan are not killed
  by whole points of damage at all — they die to the per-land casualty bar, which is why
  their 2 health does not appear in any formula.
- Invader damage is tracked **per unit**, not per type: `invaderDamage[land][type]` holds one
  entry per living unit. Two cities in one land can therefore be wounded independently, which
  a single number per type could not express. It persists across waves within a round; there
  is no "end turn" to clear it against anymore, so it only clears on round reset.
- Damage kills if it can, and only wounds when it cannot. Every ability and the Dahan strike
  share that one routine; see
  [04-economy-formulas.md](./04-economy-formulas.md#applying-damage) for the exact rule and
  its tie-breaks.

## What The Player Actually Controls

Worth naming, because "Blight only goes up and the round always ends" reads at first like
the player has no lever at all. They have two, both indirect:

- **A land with no invaders generates no Blight.** Clearing a land outright — with
  `flash_floods`, or by pushing its occupants away with `wash_away` or the Innate — stops that
  land's bar dead. This is the main lever, and pushing is the cheaper half of it: a push moves
  the pressure to a land that was generating none, but it costs no damage to do.
- **Pressure moved is not pressure gone.** A push into open, undefended ground leaves the
  board's total exactly where it was — the same invaders seeping the same Blight, somewhere
  else. What makes a push pay is *where* it lands: on a land holding Dahan, whose 2-per-Dahan
  cancellation is what actually removes the damage. The one exception is the sea:
  `wash_away` cast on a coastal land carries its units off the island, and that gross is gone
  from every land's arithmetic for good.
- **Dahan cancel 2 damage each, and a land whose Dahan out-defend its invaders sits at zero.**
  Keeping Dahan alive, or reinforcing with `rivers_bounty`, is the difference between a land
  that costs the round nothing and one that costs it everything. `rivers_bounty` always lands
  on the thinnest contested land, so the reinforcement goes where the arithmetic is worst; with
  nothing contested it banks the Dahan in the thinnest land instead.

Neither stops the round; both buy time. How long you bought is the score.

## Acceptance

- Nothing in the fight reduces Blight. The only thing that ever takes one back is a power card,
  and a round still ends in the tick its threshold is reached.
- A round ends exactly when Blight reaches its threshold, never earlier or later.
- Blight accrues from every land holding invaders, with no terrain selected and no phase.
- A land whose Dahan defence meets or exceeds its invader damage is held, and still seeps
  `BLIGHT_FLOOR_FRACTION` of its gross: no land is ever permanently safe. A ward buys a land one
  wave of true immunity and is spent doing it, which is the same rule read at a shorter scale.
- Dahan take gross invader damage, concentrated on the survivors, so casualties accelerate —
  but the concentration stops at `DAHAN_CONCENTRATION_CAP`, so stacking cannot outrun it.
- The Dahan strike runs on its own timer, independent of the wave timer.
- Waves deal no damage; they only Build, Discover, and shift the track.
- Waves resolve on their own without any player input, at a fixed interval — unless the
  player has switched auto-proceed off, in which case the round stops at the end of the
  interval and every clock in it stops too, until the wave is called.
- The speed dial changes only how much real time a game second costs. At any scale the same
  wave interval buys the same wave, and the same damage buys the same Blight.
- A scale of 0 stops the round outright, and the round resumes exactly where it stopped.
- An ability is only usable when its cooldown has fully elapsed, and using it resets that
  cooldown immediately.
- Fear earned during a lost round is still spendable in the following shop.
- A new round starts every board value (invaders, Dahan, Blight) from the current permanent
  baseline, not from wherever the previous round left off.
- Permanent upgrades purchased in the shop are still in effect after any number of further
  rounds.
