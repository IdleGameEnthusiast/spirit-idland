# 11 Tutorial

## Intent

Teach the first round. Not the whole game — the **loop**: that damage is continuous and waits
for no phase, that Blight is the only clock, that the wooden pieces are the player's, that the
invader track slides, and that losing the round is how progress is made.

This document is the design. **Nothing in it is implemented.** The one piece already built is
the legend (`legendRows`, [06-ui-contract.md](./06-ui-contract.md#the-legend)), which is the
reference half of the job and is deliberately not part of the sequence described here.

## Rules

- The tutorial runs on the **real first round**, not a sandbox. No second board, no fabricated
  state, no code path the rest of the game does not already take.
- It stops the clock by the same seam the fast-forward speeds it up: `effectiveGameSpeed`.
  It never adds a pause of its own, and never writes `ui.gameSpeed`.
- A step that is about doing something advances on the player **actually doing it**, read off
  real state. A step that is about noticing something advances on a click.
- The tutorial is a **registry of steps with triggers**, not a linear script. The first round
  is simply its first ten entries.
- Every string is in `i18n.js`, German and English, like everything else the player reads.
- Nothing in `engine/` touches the DOM. A step names a **semantic anchor**, never a selector.

## Why a tutorial at all

Three of this game's rules are invisible on the board and cannot be deduced from watching it.
A player can stare at the island for ten minutes and infer none of them:

1. **There is no attack phase.** Every land holding invaders is under attack every moment
   ([02-core-loop.md](./02-core-loop.md#the-fight)). Anyone arriving from the printed game is
   waiting for a Ravage that never comes; anyone arriving fresh sees numbers move with no
   visible cause. Worse, both consequences accrue as *fractions* — the board looks calm, and
   then a whole Blight lands at once.
2. **A land the Dahan fully hold still seeps.** `BLIGHT_FLOOR_FRACTION` means defence buys
   time and never immunity. Stacking Dahan into a land and walking away is the most natural
   first strategy a player will invent, and it is wrong.
3. **The invader track slides.** Build resolves, then Discover, and *then* what was discovered
   becomes the next wave's Build terrain (`resolveWave`, `shiftInvaderTrack`). A player reading
   only the Build slot cannot see where the next Build lands.

The legend states all three as reference. The tutorial's job is different: it makes the player
*watch each one happen* on the board in front of them, once, in the right order.

## The clock hold

`effectiveGameSpeed(state)` ([engine/round.js](../../engine/round.js)) is already the single
line every clock in the game runs through — the tick, the wave meter, every cooldown, the Dahan
strike. The fast-forward row proves the pattern the tutorial needs: the *effective* speed may
differ from the dial while the dial keeps drawing the player's own choice.

The tutorial hold is that with the sign flipped, and it goes **ahead of the fast-forward
maximum**, so a Presence-hurried opening cannot run out from under a step:

```txt
tutorialHoldsClock(state) ? 0
  : fastForwardActive(state) ? Math.max(dial, FAST_FORWARD_SPEED)
  : dial
```

This is the whole of the engine change. It is also why the tutorial does not violate
[02-core-loop.md](./02-core-loop.md#pacing)'s rule that nothing inside a round waits for player
input: the pacing controls are already the player's, `0x` is already legal, and the round is
not being asked to wait for a decision — it is being read.

### It must say why it stopped

[06-ui-contract.md](./06-ui-contract.md) requires that a stopped clock always names its reason,
and today has three answers: the dial at `0x`, a held wave gate, and the fast-forward. **The
tutorial hold is a fourth**, and it needs no new wave-tile reading: the coach card is on screen,
over the board, saying so in words. But the tile must not claim a countdown is running. It takes
the same treatment `0x` gets.

## What the opening actually looks like

Worth stating, because it is not what one would assume and it shapes the first three steps.

A fresh save is built by `createFreshGameState()`, which calls `startRound()` immediately — so
there is no title screen and `round.status` is already `running` on the first frame. But
`ui.autoProceed` ships **off**, so `startRound` sets `awaitingWave = true`, and `tick()` returns
before resolving anything while `waveGateHeld(state)` is true.

The consequences:

- The board opens **populated** — the opening Discover has already put explorers ashore.
- The board opens **frozen**, and not by the tutorial's doing. Nothing moves, including the
  continuous fight, until the player calls the first wave.
- So the tutorial's opening steps need no hold at all. The game hands them a free pause, and
  the first thing the player must be told is what the button they have not found yet does.

This also means step 4 — "damage is continuous" — cannot come before the gate is opened, because
until then it demonstrably is not.

## The step machine

### State

```js
state.tutorial = {
  // Every step already retired, by id. A map rather than a list: steps are added between
  // versions, and a save must never re-teach one it has seen because a later one was inserted.
  seenStepIds: {},
  // The step on screen, or null. Held in state rather than in ui.js so a reload mid-step
  // resumes on it - the round it is explaining resumed too.
  currentStepId: null,
  // The player pressed Skip. Distinct from having seen everything: it also silences every
  // deferred beat that has not fired yet.
  dismissed: false
};
```

It lives at the top level beside `ui` rather than inside it. `ui.*` is preferences — things the
player set and that survive a wipe. This is progress through content, which is closer to
`meta.*`, but it is not earned and not spent, so it gets its own key rather than diluting either.

### A step

```js
{
  id: "continuous",
  when: (state) => state.round.wavesResolved >= 1,   // may this step appear yet
  until: (state) => false,                            // advances on a click when false
  holdsClock: true,
  anchor: (state) => ({ kind: "land", id: worstPressureLand(state) })
}
```

- `when` gates appearance. Steps fire in registry order among those whose `when` is true.
- `until` is the completion predicate. Where it is meaningful, it is what advances the step —
  never a Next button standing in for the thing itself.
- `anchor` returns `{ kind, id }` where `kind` is `hud`, `panel`, `bar`, or `land`. **`id` is a
  semantic name — `blightTile`, `abilityBar`, `trackPanel` — or a land id.** `ui.js` owns the
  map from those names to elements. Nothing in `engine/` knows a selector.

### Functions

`activeTutorialStep(state)`, `advanceTutorial(state)`, `dismissTutorial(state)`,
`restartTutorial(state)`, `tutorialHoldsClock(state)`. All in a new `engine/tutorial.js`,
loaded before `engine/save.js`; adding it means editing the load list in **both** `index.html`
and `tests.html`, and adding the names to `engine/exports.js`.

## The first round script

Ten steps. The `holds` column is whether that step stops the clock while it is on screen.

| # | id | holds | anchor | What it says | Advances on |
| --- | --- | --- | --- | --- | --- |
| 1 | `welcome` | gate | board | The island, and eight lands. The invaders are already ashore — the round opened by landing them | click |
| 2 | `pieces` | gate | `panel:landDetail` | Points at the legend already standing there. Explorer, Town, City — and the wooden pieces are **yours** | click |
| 3 | `call_wave` | gate | `hud:waveTile` | Nothing has moved yet, because the wave is waiting for you. Press it | `wavesResolved >= 1` |
| 4 | `continuous` | yes | `land:` worst pressure | **There is no attack phase.** This land is under attack right now, and has been since the wave landed. Watch the bar | click |
| 5 | `bars` | yes | `land:` same land | The bar fills, and only a full bar costs a piece. That is why the board looks calm and then suddenly is not | click |
| 6 | `blight` | yes | `hud:blightTile` | This is the only way the round ends. It will end. That is the game | click |
| 7 | `dahan` | yes | `land:` a land where `landPressure().held` | Your Dahan are cancelling everything they can here — and it **still** seeps. Defence buys time, never immunity | click |
| 8 | `strike` | released | `hud:dahanTile` | Their other job, on their own clock. Watch the axe bar fill | `dahanAttackRemaining` wraps |
| 9 | `track` | yes | `panel:trackPanel` | Build resolves, then Discover, then the track **slides** — the Discover slot is where the next Build lands | click |
| 10 | `ability` | yes | `bar:abilityBar` | Cast one. It costs nothing but its cooldown | any ability's `cooldownRemaining > 0` |

Notes on the ones that are not obvious:

- **Step 4 must not be reachable before a wave has resolved.** Its `when` is the same predicate
  step 3 advances on. Before that the board really is still, and the step would be a lie.
- **Step 7 needs a land that is actually held**, which the opening board may not have. Its
  `when` is `LAND_IDS.some((l) => landPressure(state, l).held)`. If wave 1 produces none, the
  step simply waits for a wave that does — this is exactly what the registry-with-triggers
  shape buys, and it is why it is not a linear script.
- **Step 8 releases the clock rather than holding it.** It is the one step whose subject is a
  countdown, and a frozen countdown teaches nothing. It is safe to release: the strike interval
  is 20 game seconds and Blight cannot end a round from wave 1 in that time.
- **Step 10 waits for a real cast.** A Next button here would let the player finish the tutorial
  without ever having found the bar. The card points directly at it, and the board's own dimming
  of illegal targets does the targeting half.

## The deferred beats

Same registry, `when` predicates that may not come true for an hour. These are the layers a
first round cannot reach and that are more confusing than the fight is:

| id | fires when | teaches |
| --- | --- | --- |
| `round_lost` | `round.status === "ended"`, first time | The Fear survived the loss. That is the progression. Spend some |
| `energy_dies` | second round starts | Energy and everything it bought are gone. Fear is not. That is the whole difference |
| `first_card` | first power card reaches a hand | A card is an ability that had to be survived to |
| `reclaim` | `canAscend(state)` first true | What Reclaim takes and what it pays |

`round_lost` is the one the product intent leans on hardest
([01-product-intent.md](./01-product-intent.md#current-session-promise)) and the one a player is
least likely to work out unaided, because every other game has trained them to read a loss as a
failure rather than as the payout.

## Division of labour with the legend

Two surfaces, and the split is strict:

| | Legend | Tutorial |
| --- | --- | --- |
| Answers | "what is this symbol, what is this number" | "what just happened, and in what order" |
| Lives | land panel, resting face, always reachable | over the board, once |
| Lifetime | forever | until seen |
| Owns | the arithmetic | the sequence |

A step may **point at** the legend — step 2 does — but must not restate it. The moment a
tutorial card quotes a figure the legend also quotes, there are two copies of one number and
one of them will be wrong later.

## Skip, replay, and the veteran save

- **Skip** is on every card. It sets `dismissed` and silences the deferred beats too; a player
  who does not want to be taught the first round does not want to be taught Reclaim either.
- **Replay** sits in the footer beside the save controls — the row that already holds the
  things that are about the save rather than about the round. It clears `seenStepIds` and
  `dismissed`. It does **not** start a new round: the deferred beats will find their own
  triggers again, and the first-round steps will wait for the next round honestly.
- **The veteran save is an open question.** `normalizeState` merges the base over the input, so
  a save written before `state.tutorial` existed loads with the fresh default — meaning every
  existing player is taught the game on their next load. See [Open decisions](#open-decisions).

## Text

A `tutorial` group in `i18n.js`, keyed by step id, German and English. Two strings per step
(`title`, `body`) plus the three controls (`next`, `skip`, `replay`).

House rules apply unchanged: real umlauts, UTF-8 without a BOM, and **no number written into a
string that the engine also knows**. A tutorial step that hardcodes "25%" is the same bug the
legend was built to avoid — if a step needs a figure, it is substituted through `template()`
from the same helper the board reads.

## Acceptance tests

A new `tests/tutorial.test.js`. The machine is pure state, so all of this runs headless:

- A fresh game's first step is `welcome`, and `tutorialHoldsClock` is false while the wave gate
  already holds it (the tutorial must not claim credit for a stop it did not cause).
- Advancing through the ten steps in order retires each id exactly once.
- `tick()` credits **zero** game seconds while a holding step is on screen, at every dial
  position including a fast-forwarded opening.
- Releasing the hold resumes the round with the same board it froze — no wave resolved, no
  Blight gained, no cooldown ticked.
- A step whose `when` is false is skipped and stays available; step 7 fires on the first wave
  that produces a held land, not on wave 1 regardless.
- `dismissTutorial` silences the deferred beats as well as the script.
- Every step id has non-empty `title` and `body` in **both** languages — the check that catches
  a step added in German only.
- A save round-trips `tutorial` intact, and a save without the key loads to the agreed default.

## Open decisions

Three, and they want answering before the first line of code:

1. **Do existing saves get taught?** `normalizeState` will hand every current player the
   tutorial on their next load. The recommendation is to seed `dismissed: true` when
   `meta.bestWaveReached > 0` — someone who has finished a round does not need step 1 — and to
   let the deferred beats fire regardless, since a veteran who has never seen Reclaim explained
   still benefits. This is a product call, not a technical one.
2. **Hard hold, or advisory?** The recommendation is hard for steps 1-10, because the round is
   real and would be lost while the player reads, and advisory (dismissable, clock running) for
   the deferred beats, which arrive in the middle of a round the player is already playing.
3. **Does step 10 wait for a real cast?** Waiting teaches better and risks stranding a player
   who does not find the bar. The recommendation is to wait, with the card anchored on the bar
   itself — but a timeout that falls back to a Next button after, say, 30 real seconds would
   remove the risk at the cost of some of the teaching.

## Milestones

- **M0** — the machine, one step, and `tests/tutorial.test.js`. No art, no spotlight. Proves the
  hold, the predicates, and persistence headless.
- **M1** — the ten first-round steps, plain card, no cutout.
- **M2** — the deferred beats.
- **M3** — the spotlight cutout, Skip, and the footer's Replay.

The legend was M1's other half and is already built.
