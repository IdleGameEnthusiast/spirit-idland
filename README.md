# Spirit Idland

A round-based survival prototype set on a Spirit Island-style board. A round runs in real
time: invaders and Dahan fight automatically while Blight climbs, and the player intervenes
with cooldown-gated abilities. Every round is eventually lost to Blight — how long you lasted
is the score, and the Fear you earned buys permanent upgrades for the next attempt.

Above that sits a second loop. Once a cycle has earned its way to 5 Presence, the spirit can
**Reclaim**: hand back every Fear purchase and the Fear itself, and take the cycle's whole
income back as Presence. Presence buys nothing on the board — it decides which rows the Fear shop has at all.
Fear buys; Presence decides what Fear is allowed to buy.

The clock is the player's: a speed dial in the top bar runs the round at `1x`, doubles it to
`2x`, or stops it dead at `0x`, and an auto-proceed toggle beside the wave timer decides
whether the next wave arrives on its own or waits to be called. Neither changes what a round costs — see
[docs/spec/02-core-loop.md](docs/spec/02-core-loop.md#pacing).

Typing `playtester` into the redeem bar at the foot of the page switches on the playtest
tools: an `8x` button on the dial, a `+100` button inside each of the two currency readouts,
and a line in the redeem bar counting what the cycle has generated and spent in Fear. A button
beside the same input takes them away again. Nothing in the rules reads the flag — see
[docs/spec/06-ui-contract.md](docs/spec/06-ui-contract.md#playtest-tools).

## Running it

Open `index.html`. That is the whole procedure — no server, no build step, no dependencies.

| File | What it is |
| --- | --- |
| `index.html` | The page. Loads the engine modules, `ui.js`, and the stylesheet. |
| `engine/` | Every rule, across twelve modules plus an export shim. No DOM access anywhere in it. |
| `i18n.js` | Every player-visible string, German and English. Data only. |
| `ui.js` | Every DOM call. No rules anywhere in it. |
| `app.css` | Styling, including the terrain hues mirrored from the engine. |
| `vis.js` | Dev fixture, loaded only by `index.html?vis`: paints a mid-round board for layout work. `?vis&ended` shows the shop. |
| `tests.html` | The regression suite, in a browser. |

The split between `engine/` and `ui.js` is the load-bearing one: it is what lets the suite
play hundreds of rounds without a DOM, and what keeps a rule from being accidentally
implemented twice.

The engine files are classic scripts sharing one global scope, so they call each other by
name with no imports. Their load order is spelled out between the `engine:start` and
`engine:end` markers in both `index.html` and `tests.html`, and adding a module means
editing both lists. `CLAUDE.md` has the module map and the rest of the working notes.

## Running the tests

```
open tests.html                              in any browser
powershell -File tests\headless.ps1          headless Edge or Chrome; exits 1 on failure
node tests/run.js [filter]                   if node is installed
```

553 checks covering the board, round setup, wave timing, pacing, combat, Blight, abilities,
the shop, save/migration, backward compatibility with older save files, the land-state rules,
the engine's own module wiring, and the playtest tools. The engine takes its clock and RNG by injection, so the whole suite is
deterministic and finishes instantly.

## The spec

`docs/spec/` is the source of truth for design decisions, and it is kept current with the
code rather than ahead of it. Start at [docs/spec/index.md](docs/spec/index.md); it names
the two known balance problems up front. What to build next is at the top of
[docs/tasks/implementation-microtasks.md](docs/tasks/implementation-microtasks.md#what-to-build-next).

## Conventions worth knowing before editing

- **Land IDs are strings** `"1"` through `"8"`, never numbers. JSON object keys are strings,
  so a numeric id stops matching itself after a save/load round-trip.
- **German strings use real umlauts, and the sources are UTF-8 without a BOM.** This
  reverses an earlier ASCII-only rule; see
  [docs/spec/07-content-registry.md](docs/spec/07-content-registry.md).
- **Rules live in `engine/`,** including ones that look like presentation — which lands
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
  by `startRound`. Fear carries across rounds; Presence carries across everything.
- **A `cycle*` field is wiped by ascension and everything else is not.** That is the whole rule
  for what `ascend()` clears, and it is why `presenceUpgrades.purchased` is its own object
  rather than more keys in `upgrades.purchased` — the wipe is one assignment with no exception
  list to get wrong. Anything added later that should survive a Reclaim must not be named
  `cycle*`, and anything that should not survive one must be.
- **A save file outlives the build that wrote it.** There is an export button, so saves sit on
  players' disks and come back several builds later. A field older saves simply lack defaults
  to whatever costs the player nothing — absent means "predates the field", never "switched it
  off" — and a map keyed by content ids is rebuilt from the registry rather than merged over.
  `VERSION` moves only when existing fields change meaning, because a bump is a wipe rather
  than a translation. `tests/compat.test.js` holds the line against a captured save from an
  earlier build; the rule is in
  [docs/spec/03-state-contract.md](docs/spec/03-state-contract.md#older-save-files-keep-working).
