# Spirit Idland Spec Pack

This folder specifies the round-based redesign of the prototype: a real-time survival round
with a permanent meta-progression shop, replacing the earlier turn-based slice.

**Status: implemented.** The round-based design described here is live. The turn-based
prototype it replaced (`app.js`) is deleted; the build is now `engine.js` (all rules, no
DOM) plus `ui.js` (all DOM, no rules), loaded as two classic scripts by `index.html`.

The loop is playable end to end — a round resolves itself, loses to Blight, hands off to
the shop, and starts again stronger. What is *not* settled is the balance: every number in
[04 Economy and Formulas](./04-economy-formulas.md) is still the placeholder pass — see
[Known Balance Problems](#known-balance-problems) below.

**`4.0.0` rebuilt the fight.** The Ravage phase is gone. Invaders now damage the land they
stand in continuously, everywhere at once, and both consequences — Blight rising and Dahan
falling — accrue as per-land bars rather than landing in whole points on a schedule. The
invader track is two slots (Build, Discover) and a wave deals no damage at all. Read
[02 Core Loop](./02-core-loop.md#the-fight) first; most of what changed follows from it.

Run it by opening `index.html` from disk; no server and no build step. Run the regression
suite by opening `tests.html`, or headlessly with `tests\headless.ps1`.

## Reading Order

1. [01 Product Intent](./01-product-intent.md)
2. [02 Core Loop](./02-core-loop.md)
3. [03 State Contract](./03-state-contract.md)
4. [04 Economy and Formulas](./04-economy-formulas.md)
5. [05 Progression](./05-progression.md)
6. [06 UI Contract](./06-ui-contract.md)
7. [07 Content Registry](./07-content-registry.md)
8. [08 Acceptance and Tests](./08-acceptance-tests.md)
9. [09 Island Board](./09-island-board.md)
10. [10 Power Cards](./10-power-cards.md)
11. [Implementation Microtasks](../tasks/implementation-microtasks.md)

## Concept Summary

- A round is a real-time survival attempt: invaders and Dahan fight continuously while
  Blight climbs, and the player intervenes with cooldown-gated abilities.
- The pace of that clock is a setting, not a rule: the player picks a speed (`1x`, `2x`, or
  `0x` to stop it) and whether each wave arrives unasked or waits to be called. Neither changes what the
  round costs — see [02-core-loop.md](./02-core-loop.md#pacing).
- A round always ends the same way: Blight reaches its threshold and the round is lost.
  There is no separate "win" state — how long you lasted is the score.
- Fear earned during a round survives the loss and buys permanent upgrades between rounds:
  shorter cooldowns, new abilities, more starting defense, and so on.
- A new round resets the island (invaders, Dahan, Blight) but keeps every permanent upgrade,
  so a stronger spirit should reach further next time.
- Presence-on-the-board, the two presence tracks, and per-land Essence generation are
  retired from the live loop. Essence's state fields stay in the schema as an inert
  placeholder for later; presence is dropped entirely since nothing reads it anymore.

## Retired From The Turn-Based Slice

- Player-clicked growth options and the two presence tracks.
- Multi-step card targeting. A push still takes one click for its source; where the units land
  is decided by rule, never by a second click.
- Manually resolving Ravage/Build/Discover phase by phase and hand-assigning the Dahan
  counterattack.
- Per-land Essence generation and presence placement range.
- **The Ravage phase itself**, as of `4.0.0`. Damage is not an event on a terrain any more;
  it is a rate in every land at once. See [02-core-loop.md](./02-core-loop.md#the-fight).

## Known Balance Problems

Both old findings — zero unattended Fear, a 64-beat round — were artefacts of the per-wave
Ravage model and are fixed. A round now runs 87-120 beats, earns 1.05-1.75 Fear unattended,
and costs the player 2-4 of their 6 Dahan. Full trace in
[04-economy-formulas.md](./04-economy-formulas.md#measured-behaviour).

A third was found and fixed during this pass: at the first cut's casualty rate, **no Dahan
ever died** — the casualty bar and its death spiral were dead code. Raising
`DAHAN_LOSS_PER_DAMAGE_SECOND` to 0.05 put them on screen. That constant is the one under
playtest.

What is left:

- **Dahan stacking was superlinear, and has been braked twice.** Casualty damage divided by
  the stack size gave a stack quadratic lifetime, and defence cancelling Blight outright gave
  it a cliff to zero — together, one fortified land beat six defended ones and `rivers_bounty`
  was the only ability worth casting. `BLIGHT_FLOOR_FRACTION` removes the cliff (a held land
  seeps), and `DAHAN_CONCENTRATION_CAP` makes a stack's lifetime linear in its size. Both
  constants are under playtest, and `dahan_reinforcement` and `rivers_bounty` still have not
  been repriced against them. See
  [04-economy-formulas.md](./04-economy-formulas.md#dahan-casualty-formula).
- **First Blight lands anywhere between 33 and 74 beats**, depending on whether the early
  Discover draws hit the two lands `roundStartDahan` leaves empty. The variance is the terrain
  draw rather than the rates, but it means two players' first rounds can read very differently.
- **The Dahan strike got stronger and has not been repriced.** Kill-first damage means two
  Dahan take a town where they used to scratch a city, across every land at once. That is the
  intended direction, but nothing has been re-measured against it.
- **Innate tier 3 costs 150, priced against a round-income guess that has since proven far too
  low.** Cut from 250 (tier 2 also cut, 50 → 40) because 250 was effectively unreachable inside
  a round. It still leans on round *length*, which `blight_resilience` buys, so it stays a
  late-progression sight rather than a mid-round one — but played runs clear 150 well before
  that, so the guess needs revisiting rather than trusting.
- **`rivers_bounty` no longer fails, and pushes no longer roll.** The Bounty falls back to the
  thinnest land on the board when nothing is contested, so it banks Dahan on a quiet island
  instead of refusing; and a push now always takes the lowest-numbered free neighbour. Both
  make the kit more reliable — and neither has been re-measured against the Blight rates.
- **`wash_away` was rebuilt and nothing downstream has been measured.** It was too weak for
  three reasons at once: a push into empty ground is Blight-neutral by construction (the same
  gross, a different land), it never produced a defeat so it earned no Fear and no Energy, and
  its two-land target rule made it uncastable exactly when the island filled up. It now pushes
  onto an occupied neighbour when there is no open ground, and from a coastal land it carries
  up to 2 units off the island outright, paying a defeat's Fear and Energy. Unlock stays 20,
  `auto_wash_away` 150 → 400, and the other two automations reranked under it (`auto_bounty`
  250 → 200, `auto_flash_floods` 350 → 300). Nothing here has been played: the open questions
  are whether coastal removal outclasses `flash_floods` outright, whether the occupied fallback
  hands the invaders too many Cities, and whether `auto_bounty` under the reinforcement
  ladder's last rung makes that rung dead content.

## Still Open

- The exact ability kit's effects and numbers (cooldowns, damage, reinforcement amounts) —
  implemented as specified, but never balanced.
- The permanent upgrade shop's cost curve. The three Fear ladders (`rising_dread`,
  `mounting_terror`, `high_water_mark`) are capped at tier 10, which closes the older open
  question about whether they should be — see
  [04-economy-formulas.md](./04-economy-formulas.md#the-ladders-are-capped-at-ten).
- **`PRESENCE_FEAR_DIVISOR` is the least-measured number in the game**, and the pacing of the
  whole ascension layer rides on it. 100 is a guess anchored to "a first Reclaim should pay
  about 5"; no cycle has been played to read the real figure. The measurement is one line in
  the playtest tally — see
  [04-economy-formulas.md](./04-economy-formulas.md#both-constants-are-placeholders-and-one-of-them-badly-so).
- **Whether shallow rounds out-earn deep ones per real minute.** The payout has no depth term,
  on the argument that Fear income already grows steeply with depth. If a player with
  `auto_start_round` earns faster farming wave 1–10 loops than by pushing, the fix is a wave
  floor on what banks toward the payout, not a depth term.
- **Every power card number is a first pass.** [10 Power Cards](./10-power-cards.md) is built —
  the Presence draw, the card handed to the round every 20 waves, and the two mechanics the
  first seven bring with them (Defense, and Blight that can fall) — but none of its figures has
  been played against. The ones most likely to move, in order: the four Fear-paying cards, which
  roughly quadruple a round's income; the Blight-removal cooldowns, since the hand cancels
  something like half the island's peak Blight output and round length may roughly double;
  `power_card_interval`, whose rungs are lumpy by construction; and the flat 10/20/30 Energy
  re-draw fee, which goes stale by the round's third draw on purpose.
- **Whether 10000 Fear is the right price for a full Dahan Remember**, and whether 100% haste
  is the right cap now that it is the only cooldown the shop touches. Both are first numbers,
  shipped to be played against — see
  [05-progression.md](./05-progression.md#the-dahan-remember).
- **An invader scaling curve.** Energy income is flat within a round while the kit's prices
  are not, so a long round has nothing to spend a late 250 on but time. The intended answer is
  invaders that grow stronger as the player does, which is not implemented.
- Whether a round in progress needs to survive a page reload. It currently does: a save
  resumes exactly as written, crediting nothing for the time the tab was closed.

## Playable Goals — Met

- A round resolves invaders and Dahan on its own clock, with no queue of turns. ✓
- That clock runs at the pace the player asks for, including stopped. ✓
- The player can trigger abilities against a live board and watch Blight climb. ✓
- Losing a round hands off into the shop with no acknowledge-the-loss click. ✓
- A save resumes without losing Fear, purchased upgrades, or round count. ✓
