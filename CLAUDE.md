# Spirit Idland — working notes

A round-based survival prototype on a Spirit Island-style board. Plain HTML/CSS/JS.

## The one rule that shapes everything: no build step

No bundler, no package.json, no dependencies. The game is **classic `<script>` tags a
browser opens straight off disk**. Open `index.html` — that is the whole procedure.

Do not introduce ES modules, `import`/`export`, TypeScript, JSX, or a bundler. `type="module"`
breaks `file://` loading outright, which would end the "just open it" property the project is
built around.

## Running it

| What | How |
| --- | --- |
| The game | Open `index.html` |
| Layout fixture | `index.html?vis` (mid-round board), `index.html?vis&ended` (the shop) |
| The tests | Open `tests.html` |
| Tests, headless | `powershell -ExecutionPolicy Bypass -File tests\headless.ps1` — exits 1 on failure |
| Tests, node | `node tests/run.js [filter]` — **node is not installed on this machine**, so use the headless route |

Headless directly, if the script is not what you want:

```
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
  --virtual-time-budget=20000 --dump-dom "file:///c:/Users/poemma/Documents/Spirit Idland/tests.html"
```

Then read `<div id="summary" data-passed=... data-total=...>` and grep for `<li class="fail">`.

## Layout

`engine/` holds every rule and **touches no DOM**. `ui.js` holds every DOM call and
**decides no rule**. That split is load-bearing: it is what lets the suite play hundreds of
rounds headless, and what stops a rule being implemented twice.

| File | What it is |
| --- | --- |
| `engine/constants.js` | Balance numbers, difficulty rungs, injectable clock/RNG, `clamp` |
| `engine/content.js` | The catalogues: `SPIRITS`, `ABILITIES`, `POWER_CARDS`, `UPGRADES`, `PRESENCE_UPGRADES` |
| `engine/board.js` | Land ids, terrain, adjacency, coastline |
| `i18n.js` | Every player-visible string, German + English. Data only |
| `engine/text.js` | State → the words the UI shows. Reads `I18N`, holds no rules |
| `engine/state.js` | State factories, normalizers, transient fx markers |
| `engine/upgrades.js` | The Fear shop, the Presence ladder, Reclaim |
| `engine/abilities.js` | Unlock/tier economy, legal targets, auto-cast target pickers |
| `engine/cards.js` | Power card pool, offer, hand, and the cast step machine |
| `engine/combat.js` | Damage, defeats, Fear/Energy income, Blight, build/explore phases |
| `engine/round.js` | Round start/end, speed dial, wave gate, the tick |
| `engine/save.js` | Fresh games, migration, persistence, export/import |
| `engine/exports.js` | The shim handing the engine to tests. **Last** in load order |
| `ui.js` | Every DOM call, no rules |
| `app.css` | Styling, including terrain hues mirrored from the engine |
| `vis.js` | Dev fixture for `?vis`; never loaded by the game itself |

## How the engine files see each other

They share **one global scope**. A top-level `const` or `function` in
`engine/constants.js` is visible from `engine/combat.js` with no import, in either
direction — function bodies resolve lazily, so a function may call something declared in a
file that loads later. Only top-level *initializer* order matters.

Consequences when editing:

- **Never add `import`/`export`/`require` to `engine/` or `ui.js`.** Just call the name.
- **Do not reshuffle the load order** in `index.html` without a reason.
- The load order is spelled out **twice**, between the `engine:start` / `engine:end` markers
  in `index.html` and in `tests.html`. **Adding an engine file means editing both.**
  `tests/modules.test.js` catches drift when node is available; `engine/exports.js` throws a
  `ReferenceError` at load if a module is missing, so the browser suite catches it too.
- `tests/load-engine.js` reads the list out of `index.html` and concatenates the files into
  one vm script, so node sees the same scope the browser gives them.

## Adding a function to the engine

Put it in the module that owns the concern. If anything **outside `engine/`** calls it —
`ui.js`, `vis.js`, or a test — add its name to `engine/exports.js`. If nothing outside does,
leave it out; that file is only for the test harness and it rots when padded.

## Docs are part of the change

`docs/spec/` is the source of truth for mechanics, and a mechanic change updates it **in the
same edit**. Section comments in the engine point at the doc that owns the rule.

- `01-product-intent` · `02-core-loop` · `03-state-contract` · `04-economy-formulas`
- `05-progression` · `06-ui-contract` · `07-content-registry` · `08-acceptance-tests`
- `09-island-board` · `10-power-cards` · `11-tutorial` (design only, not built)

New ideas go in the **Idea Inbox** section of `docs/tasks/implementation-microtasks.md` —
not a new file, not a new board.

## Text and encoding

All player-visible strings live in `i18n.js`, German and English side by side. German uses
**real umlauts**, and the file is **UTF-8 without a BOM** — keep it that way. The engine
writes log lines; the UI only displays them.

## Testing habits

- The suite is the safety net for anything structural — run it before and after, and compare
  the counts rather than just checking it says "pass".
- The engine takes its clock and RNG by injection (`setNowSource`, `setRng`), which is why a
  round can be played to its end in a millisecond and be the same round every run. Pin the RNG
  in tests; never assert on a distribution.
- `?vis` renders are **not** deterministic — the card offer is drawn at random. Exclude it
  when diffing DOM output.
