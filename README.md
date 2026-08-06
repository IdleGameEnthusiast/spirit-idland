# Spirit Idland

A round-based survival prototype set on a Spirit Island-style board. A round runs in real
time: invaders and Dahan fight automatically while Blight climbs, and the player intervenes
with cooldown-gated abilities. Every round is eventually lost to Blight — how long you lasted
is the score, and the Fear you earned buys permanent upgrades for the next attempt.

## Running it

Open `index.html`. That is the whole procedure — no server, no build step, no dependencies.

| File | What it is |
| --- | --- |
| `index.html` | The page. Loads the two scripts and the stylesheet. |
| `engine.js` | Every rule. No DOM access anywhere in it. |
| `ui.js` | Every DOM call. No rules anywhere in it. |
| `app.css` | Styling, including the terrain hues mirrored from `engine.js`. |
| `vis.html` | Dev fixture: paints a mid-round board for layout work. `?ended` shows the shop. |
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

109 checks covering the board, round setup, wave timing, combat, Blight, abilities, the
shop, save/migration, and the land-state rules. The engine takes its clock and RNG by
injection, so the whole suite is deterministic and finishes instantly.

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
