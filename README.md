# Spirit Idland

A round-based survival prototype set on a Spirit Island-style board. A round runs in real
time: invaders and Dahan fight automatically while Blight climbs, and the player intervenes
with cooldown-gated abilities. Every round is eventually lost to Blight — how long you lasted
is the score, and the Fear you earned buys permanent upgrades for the next attempt.

The clock is the player's: a speed dial in the top bar runs the round at `1x`, doubles it to
`2x`, or stops it dead at `0x`, and an auto-proceed toggle beside the wave timer decides
whether the next wave arrives on its own or waits to be called. Neither changes what a round costs — see
[docs/spec/02-core-loop.md](docs/spec/02-core-loop.md#pacing).

Typing `playtester` into the redeem bar at the foot of the page switches on the playtest
tools: an `8x` button on the dial, and a `+100` button inside each of the two currency
readouts. A button beside the same input takes them away again. Nothing in the rules reads
the flag — see [docs/spec/06-ui-contract.md](docs/spec/06-ui-contract.md#playtest-tools).

## Running it

Open `index.html`. That is the whole procedure — no server, no build step, no dependencies.

| File | What it is |
| --- | --- |
| `index.html` | The page. Loads the two scripts and the stylesheet. |
| `engine.js` | Every rule. No DOM access anywhere in it. |
| `ui.js` | Every DOM call. No rules anywhere in it. |
| `app.css` | Styling, including the terrain hues mirrored from `engine.js`. |
| `vis.js` | Dev fixture, loaded only by `index.html?vis`: paints a mid-round board for layout work. `?vis&ended` shows the shop. |
| `tests.html` | The regression suite, in a browser. |

The split between `engine.js` and `ui.js` is the load-bearing one: it is what lets the suite
play hundreds of rounds without a DOM, and what keeps a rule from being accidentally
implemented twice.

## Running the tests

```
open tests.html                              in any browser
powershell -File tests\headless.ps1          headless Edge or Chrome; exits 1 on failure
node tests/run.js [filter]                   if node is installed
```

301 checks covering the board, round setup, wave timing, pacing, combat, Blight, abilities,
the shop, save/migration, the land-state rules, and the playtest tools. The engine takes its
clock and RNG by injection, so the whole suite is deterministic and finishes instantly.

## The spec

`docs/spec/` is the source of truth for design decisions, and it is kept current with the
code rather than ahead of it. Start at [docs/spec/index.md](docs/spec/index.md); it names
the two known balance problems up front. What to build next is at the top of
[docs/tasks/implementation-microtasks.md](docs/tasks/implementation-microtasks.md#what-to-build-next).

## Conventions worth knowing before editing

- **Land IDs are strings** `"1"` through `"8"`, never numbers. JSON object keys are strings,
  so a numeric id stops matching itself after a save/load round-trip.
- **Source stays ASCII.** German strings transliterate umlauts (`ae`, `oe`, `ue`). A display
  string table is the worst possible place for a silent encoding corruption, and this file
  has been bitten once already.
- **Rules live in `engine.js`,** including ones that look like presentation — which lands
  highlight, what the wave preview says. If it can be asserted, it belongs there.
- **The board rebuilds only when its signature changes.** Values that move every second are
  patched in place; rebuilding on a per-second cadence would destroy hover, focus, and any
  running animation.
- **Invader damage is per unit,** not per type: `invaderDamage[land][type]` is one entry per
  living unit, sorted worst-first. Anything that adds an invader goes through
  `addInvaderUnit`, or the count and the wound list drift apart.
- **Read a tiered ability through `abilityRecord(state, id)`,** never straight out of
  `ABILITIES`. The raw entry for a tiered ability carries no cooldown and no effect of its own.
- **Energy is round-local.** It, every unlock bought with it, and every Innate tier are cleared
  by `startRound`. Fear is the only currency that carries.
