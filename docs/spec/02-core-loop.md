# 02 Core Loop

## Intent

Specify the round loop: automatic invader/Dahan resolution on a live clock, player-triggered
cooldown abilities, Blight as the round's only loss condition, and the Fear-funded permanent
upgrade shop between rounds.

## Rules

- A round runs in real time. Nothing in it waits for player input; the clock keeps moving
  regardless of whether the player acts.
- Exactly one loss condition exists: Blight reaching `round.blightThreshold`. There is no
  other way for a round to end.
- Abilities are cooldown-gated, not resource-gated, for this slice. See
  [Open Question: Energy](#open-question-energy).
- Waves resolve automatically on a fixed interval; the player cannot speed them up, pause
  them, or resolve them early.
- Fear earned during a round is never lost, including when the round ends. It is the only
  state that survives a round.
- A new round resets the island (invaders, Dahan, Blight, wave timer) to the spirit's
  current permanent-upgrade baseline. It does not reset Fear or purchased upgrades.

## Round Sequence

1. **Round setup.** Reset `invaders`, `dahan`, `blight`, and the invader track to the
   spirit's starting values, modified by any permanent upgrades purchased. Reset every
   ability's cooldown to ready. Set `round.status` to `running` and `round.elapsedSeconds`
   to 0.
2. **Live resolution**, repeating until the round ends:
   - The wave timer counts down. At 0, resolve one full wave (Ravage, then Build, then
     Discover, then shift the invader track) and reset the timer. See
     [Wave Resolution](#wave-resolution).
   - At any moment an ability is off cooldown, the player may trigger it. See
     [Abilities](#abilities).
   - After every wave, check `round.blight >= round.blightThreshold`. If true, the round
     ends immediately; the wave that pushed Blight over the line is the last one that
     resolves.
3. **Round end.** Set `round.status` to `ended`. Stop the wave timer and freeze all board
   state. Log the round number reached and the Fear earned.
4. **Upgrade shop.** The player spends any accumulated `meta.fear` on permanent upgrades.
   See [Between Rounds](#between-rounds).
5. **Next round.** Starting a new round returns to step 1. `round.number` increments;
   `meta.bestRoundReached` updates if beaten.

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

### Open Question: Energy

The turn-based prototype gated card plays on an Energy resource fed by the presence tracks.
Both are retired along with presence. For now, abilities cost only their cooldown. Whether a
resource cost returns, and what would feed it without presence, is deliberately left open;
treat `resources.energy` as parked, not deleted, until that's decided.

## Wave Resolution

A wave is the automatic unit of invader advancement: the same Ravage / Build / Discover
sequence the turn-based prototype resolved on End Turn, now self-triggering on
`WAVE_INTERVAL_SECONDS` instead of waiting for a click.

1. **Ravage** every land of the current `invader.ravage` terrain, lowest land id first.
2. **Build** every land of the current `invader.build` terrain.
3. **Discover** every eligible land of the current `invader.explore` terrain.
4. **Shift the track**: old `build` becomes `ravage`, old `explore` becomes `build`, a new
   `explore` is drawn.
5. Reset the wave timer to `WAVE_INTERVAL_SECONDS`.

Build and Discover are unchanged from the turn-based design (see
[09-island-board.md](./09-island-board.md) for the per-land rules); only their trigger
changed, from a click to a timer.

### Ravage, Now Automatic

Within a land, resolution is still sequential:

1. Invader damage is the sum of each unit's damage value: explorers 1, towns 2, cities 3.
2. That damage destroys Dahan at 2 health each; damage below a full 2 is discarded.
3. Surviving Dahan counterattack for 2 damage each — automatically now. The counterattack
   pool is spent on the highest-tier invader type present first (cities, then towns, then
   explorers), 1 damage at a time, until the pool or the invaders run out. Defeated invaders
   award Fear through the normal defeat path.
4. The land gains Blight. See [Blight](#blight).

Because Dahan die before they swing, a land can still be wiped with no counterattack — that
part of the old rule is unchanged. Only who assigns the counterattack changed.

## Blight

Blight is the round's clock. It only goes up; nothing in this slice removes it once gained.

- `round.blight` is a single value for the whole round, not tracked per land in this pass.
- Each land Ravaged this wave adds Blight:
  - `+1` base, for any land with at least one invader that Ravages.
  - `+1` more if that land held 0 Dahan going into the Ravage — an undefended land degrades
    faster, which is Dahan's actual payoff for staying alive, beyond the counterattack.
- The round ends the instant `round.blight` reaches `round.blightThreshold`.
- These numbers are a first-pass placeholder; see
  [04-economy-formulas.md](./04-economy-formulas.md) for the current constants and
  [Implementation Microtasks](../tasks/implementation-microtasks.md) for balancing follow-up.

## Fear

Fear keeps its turn-based formula: defeating an invader awards `defeatedPower * 0.35` Fear,
whether the defeat came from a counterattack or an ability. Unlike the turn-based build,
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

## Dahan Rules

- Dahan are tracked per land, same as the turn-based build.
- Round setup seeds Dahan the same way fresh-game setup used to: a base count distributed
  across lands, at most 2 per land, modified upward by any permanent Dahan upgrade
  purchased.
- Dahan counterattack automatically now; see [Ravage, Now Automatic](#ravage-now-automatic).
- Dahan are not currently moved or reinforced by any ability. That is expected placeholder
  content, not a design decision to leave them static forever.

## Damage Rules

Unchanged from the turn-based build:

- Explorers have 1 health and 1 damage.
- Towns have 2 health and 2 damage.
- Cities have 3 health and 3 damage.
- Dahan have 2 health and 2 damage.
- Partial invader damage is tracked per land and per invader type, and persists across
  waves within a round. There is no "end turn" to clear it against anymore — it only clears
  on round reset.

## What The Player Actually Controls

Worth naming, because "Blight only goes up and the round always ends" reads at first like
the player has no lever at all. They have two, both indirect:

- **A land with no invaders adds no Blight when its terrain Ravages.** Clearing a land
  outright — with `flash_floods`, or by pushing its occupants away with `wash_away` — denies
  the Blight that land would have cost. This is the main lever.
- **A land with Dahan in it adds 1 Blight instead of 2.** Keeping Dahan alive, or seeding
  more with `rivers_bounty`, halves what an undefended land costs.

Neither stops the round; both buy waves. How many waves you bought is the score.

## Acceptance

- A round's Blight only increases; nothing in this slice reduces it.
- A round ends exactly when Blight reaches its threshold, never earlier or later.
- Waves resolve on their own without any player input, at a fixed interval.
- An ability is only usable when its cooldown has fully elapsed, and using it resets that
  cooldown immediately.
- Fear earned during a lost round is still spendable in the following shop.
- A new round starts every board value (invaders, Dahan, Blight) from the current permanent
  baseline, not from wherever the previous round left off.
- Permanent upgrades purchased in the shop are still in effect after any number of further
  rounds.
