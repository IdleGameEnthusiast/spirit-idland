# 01 Product Intent

## Intent

Define the playable fantasy and scope for the round-based redesign.

## Rules

- The player acts as River Surges in Sunlight, defending an eight-land island through
  automatic combat, timed abilities, and a run-to-run meta-progression shop.
- The core loop is round-based and real-time: within a round, invaders and Dahan resolve
  automatically on a live clock; the player acts by triggering cooldown-gated abilities, not
  by taking discrete turns.
- A round always ends the same way: Blight reaches its threshold and the round is lost.
  Progress is measured by how far a round got, not by winning it.
- Fear earned in a round is the only thing that survives its loss. It buys permanent
  upgrades that make the next round start stronger.
- Every visible mechanic in the build should already be documented in this spec pack.

## Current Fantasy

"I am a river spirit holding back an endless invasion. I cannot stop the tide forever, but
every wave I turn back, and every Dahan I keep standing, buys the next attempt more ground."

## Current Session Promise

All four are live. The one asterisk is on the third, and it is a balance problem, not a
structural one — see [index.md](./index.md#known-balance-problems).

- In the first few seconds of a round: see invaders and Dahan already resolving
  automatically, and understand that the round is a countdown, not a queue of turns. ✓
- Within the first round: trigger at least one ability, see its cooldown start, and watch
  Blight visibly climb toward its threshold. ✓
- On losing a round: see the Fear earned, and spend it on at least one permanent upgrade
  before the next round starts. ✓ *— but a player who triggers no abilities earns no Fear at
  the current numbers, so there is nothing to spend.*
- On return after leaving the page: resume exactly as saved, including an in-progress round,
  which is credited nothing for the time the tab was closed. ✓

## Design Pillars

- Attrition matters: a round is unwinnable in the traditional sense — it is always lost to
  Blight eventually. The tension is how long that takes, not whether it happens.
- Timing matters: abilities are cooldown-gated, not resource-gated, for this slice, so
  choosing the moment to spend a ready ability is the primary skill during a round.
- Permanence matters: Fear and the upgrades it buys are the only state that survives a lost
  round. Everything else — invaders, Dahan, Blight — resets clean each round.
- Readability matters: the board must make clear which lands are under the most pressure
  without the player hunting for it. There is a pause now, and a wave the player can be asked
  to call, but a board that is only legible while stopped has failed — the controls exist to
  set the pace, not to make up for a board nobody can read in motion.

## Non-Goals For This Slice

- No presence placement, presence tracks, or spatial reach growth.
- No manually-resolved invader phases or hand-assigned Dahan strikes.
- No per-land Essence generation, and no terrain resource pools in the schema.
- No multi-spirit support yet.
- No AI opponent behavior beyond the automatic wave cycle.

## Acceptance

- A new reader can explain the round loop (active abilities, passive battle, Blight loss,
  Fear shop, reset) in under 60 seconds.
- The difference between this round-based design and the retired turn-based prototype is
  explicit.
- The docs match the shipped build, with remaining work tracked in
  [Implementation Microtasks](../tasks/implementation-microtasks.md#what-to-build-next).
