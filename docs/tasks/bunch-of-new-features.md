# Bunch of new features — implementation spec

**Temporary file.** It exists to carry a handful of features into an implementation session
with no context behind it. Everything in it either becomes code or becomes an edit to a
permanent spec file. **Delete it once every feature's checklist is complete** — nothing may
link to it from a permanent doc.

Line numbers below are from `master` at `7b5e652` for Features 1 and 2, and at `ccbb135` for
Feature 3. They will drift as the work lands, and the first two features' numbers have already
drifted by three commits. Names are the load-bearing part, not the numbers.

Four items. Features 1-3 are independent of each other and touch different parts of `ui.js`,
but they all touch `ui.js`, `app.css` and the docs, so they land **one at a time, in order**.
Feature 4 is a standing requirement rather than a feature and lands last, over the top of the
other three.

| # | Feature | Touches |
| --- | --- | --- |
| 1 | [Auto-cast toggle](#feature-1--auto-cast-toggle) | `engine.js`, `ui.js`, `app.css`, tests |
| 2 | [The round controls move above the shop](#feature-2--the-round-controls-move-above-the-shop) | `index.html`, `app.css`, one line pair in `ui.js` |
| 3 | [The Dahan strike bar on the chip](#feature-3--the-dahan-strike-bar-on-the-chip) | `index.html`, `ui.js`, `app.css`, locale |
| 4 | [Older save files keep working](#feature-4--older-save-files-keep-working) | `docs/spec/`, `README.md`, tests |

---

# Session bookkeeping — read this first

Each feature is implemented in its own session with no memory of the others. This section is
what carries between them. **Whoever finishes a feature ticks its box here before stopping.**

## Progress

- [x] Feature 1 — Auto-cast toggle (3 commits: engine, UI, docs). Suite at **383/383**, up from
      the 374 baseline: six new checks in `tests/automation.test.js` and three in
      `tests/save.test.js`. `README.md:43` and `08-acceptance-tests.md` now both say 383.
- [ ] Feature 2 — Round controls above the shop (1 commit)
- [ ] Feature 3 — Dahan strike bar on the chip (1 commit)
- [ ] Feature 4 — Older save files keep working (1 commit)
- [ ] Delete this file, in the last commit of the last feature

## Environment facts, already checked — do not re-derive them

- **There is no `node` on this machine.** Every instruction below that says
  `node tests/run.js` means, in practice:

  ```
  powershell -ExecutionPolicy Bypass -File tests\headless.ps1
  ```

  which runs the same suite in headless Edge and prints `N/N checks passed.` It takes about a
  minute. `tests/run.js` stays in the repo and stays correct; it is simply not runnable here.
- **Baseline at `ccbb135` is `374/374 checks passed`.** Anything less than that after a change
  is a regression, not a flaky browser.
- **Two check counts in the docs are already stale and disagree with each other and with the
  suite**: `README.md:43` says 301 and `docs/spec/08-acceptance-tests.md:352` says 372, against
  an actual 374. Whichever feature next touches a count writes **the number the suite actually
  printed on that commit**, in both places, and does not try to reconcile the history.
- **A new `*.test.js` file must be registered by hand in `tests.html`** (the list at `:50-65`).
  `tests/run.js` discovers files from the directory; the browser harness cannot, and the
  browser harness is the one that runs here. A test file added to only one of the two is a
  test that silently does not run.
- **`tests/fixtures/` is not scanned by either runner** (`run.js` filters on `.test.js` in the
  tests directory root), so a fixture there is loaded only by whatever `require`s or lists it.

## Rules that apply to every commit in this file

- **One commit per bullet in the split each feature names.** Every commit green on its own.
- **Do not push.** Committing is asked for; pushing is not.
- **Update the spec inside the implementation commit**, never in a follow-up. `README.md`
  under *The spec*: the spec is kept current with the code, not ahead of it.
- **Run the suite before committing.** Quote the printed count in the commit message.
- **Older save files must keep working.** This is Feature 4's subject and it is also a
  constraint on Features 1-3 while they are being written: see
  [Feature 4](#feature-4--older-save-files-keep-working) before adding any state field.

---

# Feature 1 — Auto-cast toggle

## What is being built

Every ability automation gets a checkbox **inside its ability card**. Ticked, the automation
casts as it does today. Unticked, it does not, and the ability goes back to being played by
hand.

Five automations are in scope, one per ability:

| Upgrade | Ability | Resolver |
| --- | --- | --- |
| `auto_boon` | `boon_of_vigor` | `resolveAutoBoon` (`engine.js:2974`) |
| `auto_bounty` | `rivers_bounty` | `resolveAutoBounty` (`engine.js:3292`) |
| `auto_innate` | `innate_power` | `resolveAutoInnate` (`engine.js:3272`) |
| `auto_wash_away` | `wash_away` | `resolveAutoWashAway` (`engine.js:3402`) |
| `auto_flash_floods` | `flash_floods` | `resolveAutoFlashFloods` (`engine.js:3484`) |

`auto_buy_abilities` and `auto_start_round` are **not** in scope. The first automates a
purchase rather than a cast, and the second already has its toggle.

## Why

Buying an ability automation is currently a one-way door. The resolver runs inside `tick`
before the fight and fires the instant the cooldown clears, so the card never spends a frame
in a state the player could click. Once `auto_wash_away` is bought, 400 Fear has permanently
removed an ability from active play, and there is no path back short of editing a save.

The rule this restores is already written down for the round gate, at `engine.js:4682`:

> buying the automation and wanting it on right now are two different things - a player who
> wants to stop and shop should not have to un-buy anything to get the pause back

This spec is that sentence applied one level down, to the cast instead of the round.

## Settled decisions

These were argued through and are closed. Do not re-open them during implementation.

**1. Unchecking stops future casts and nothing else.** From the moment the box is unticked
the automation does not cast; when it is re-ticked the automation resumes on the next ready
cooldown. No cooldown is reset, shortened, or lengthened. No cast is undone. Nothing is
refunded, and the upgrade is never un-bought.

**2. All five get the checkbox.** Including `auto_boon` and `auto_bounty`, whose abilities
take no target — the Boon is a flat no-target effect and `rivers_bounty` picks its own land
(`engine.js:3292`), so unticking those two can only make the player slower and never better.
They get the box anyway, because a control that appears on three cards and not the other two
is a rule with an exception the player has to discover. Know that this ships three switches
that matter and two that are ceremony, and do not balance anything around the ceremonial two.

**3. Ownership is permanent, the toggle is a preference.** These are two different questions
and they read two different places, exactly as `autoStartRoundOwned` and `autoStartRoundOn`
already do at `engine.js:4530-4545`:

- **Whether the checkbox is drawn at all** follows `upgradeTier` — what the player owns. Once
  bought, the box is on the card forever, including in the shop between rounds.
- **Whether the automation casts** follows `activeUpgradeTier` — the round's frozen snapshot
  (`startRound` writes it at `engine.js:4349`) — *and* the toggle.

Two consequences fall out of that split, both wanted:

- Unticking mid-round bites on the next tick. It is a preference, not a purchase, so it does
  not wait for the next round.
- Buying an automation mid-round still does nothing until the next round, unchanged from
  today. The checkbox appears immediately and ticked; what it governs starts next round.

**4. The checkbox sits inside the ability card.** Not beside it, not in the shop row where
the upgrade was bought, not collected into a settings panel. The two existing toggles each
sit with the control they automate — `autoWaveBtn` in the board HUD beside the wave countdown
(`index.html:118`), `autoRoundBtn` beside the round button (`index.html:219`, and Feature 2
moves the pair without separating them) — and the control this one automates is the cast
button on the card.

**5. Default ticked, and no grace window.** A player who just paid 400 Fear should not have
to click a second time to get what they bought. A delayed auto-cast that leaves the player a
window to pre-empt the automation was considered and **rejected** — do not implement it, do
not leave a hook for it.

## Engine changes

### The map and the two predicates

There is currently no connection anywhere in the code between an automation and the ability
it casts; each resolver knows both strings only because they sit in the same function. The
card needs that connection to exist for real, so write it down once, near the resolvers:

```js
// The five ability automations, by the ability each one casts. It is the only place the two
// id spaces are tied together: the resolvers below are keyed by upgrade, the ability bar is
// keyed by ability, and one map beats a second copy of the pairing in ui.js.
const AUTO_CAST_UPGRADES = {
  boon_of_vigor: "auto_boon",
  rivers_bounty: "auto_bounty",
  innate_power: "auto_innate",
  wash_away: "auto_wash_away",
  flash_floods: "auto_flash_floods"
};

// Whether the player owns this ability's automation - which is what decides whether the card
// draws a checkbox at all. Read off what is owned rather than off the round's snapshot: the
// purchase is permanent, so the control it comes with never disappears again.
function autoCastOwned(state, abilityId) {
  const upgradeId = AUTO_CAST_UPGRADES[abilityId];
  return Boolean(upgradeId) && upgradeTier(state, upgradeId) > 0;
}

// Whether it should actually cast this tick. Ownership through the round's snapshot, so a
// mid-round purchase still waits for the next round; the toggle live, so unticking it stops
// the next cast rather than the next round's casts.
function autoCastOn(state, abilityId) {
  const upgradeId = AUTO_CAST_UPGRADES[abilityId];
  if (!upgradeId || activeUpgradeTier(state, upgradeId) <= 0) return false;
  return state.ui.autoCast[abilityId] !== false;
}

function setAutoCast(state, abilityId, on) {
  if (!AUTO_CAST_UPGRADES[abilityId]) return false;
  state.ui.autoCast[abilityId] = on === true;
  return state.ui.autoCast[abilityId];
}
```

`!== false` rather than `=== true`: absent means on, which is what makes a save written
before this feature load with its automations still running. Same rule as
`merged.ui.autoStartRound !== false` at `engine.js:4779`.

### The five resolvers

Each resolver's first line is replaced, and nothing else in them changes:

```js
// before
if (activeUpgradeTier(state, "auto_wash_away") <= 0) return;
// after
if (!autoCastOn(state, "wash_away")) return;
```

The unlocked and ready guards under it stay exactly as they are. The call order inside `tick`
(`engine.js:4586-4602`) is unchanged — the comment there explains why the Innate goes last,
and a skipped automation must not reorder the four around it.

### Exports

`autoCastOwned`, `autoCastOn`, `setAutoCast` and `AUTO_CAST_UPGRADES` go out the same door
`autoStartRoundOwned` / `autoStartRoundOn` / `setAutoStartRound` use, so `ui.js` and the test
harness can read them.

## State contract

New field in `ui`, written explicitly by `createInitialState` rather than left to normalize,
because `03-state-contract.md` documents literal shapes:

```json
"autoCast": {
  "boon_of_vigor": true,
  "rivers_bounty": true,
  "innate_power": true,
  "wash_away": true,
  "flash_floods": true
}
```

It belongs in `ui` and not in `round` for the same reason `autoProceed` and `autoStartRound`
do: it outlives every round it is read in.

**Normalization.** Rebuild the map from `AUTO_CAST_UPGRADES` rather than trusting the save:
every known ability id gets `raw !== false`, and any key not in the map is dropped. A save
that predates the field therefore loads with all five on, and a save cannot smuggle in a
toggle for an ability the registry does not carry.

**Migration reset.** `migrateSave` (`engine.js:4908`) deliberately carries language,
playtest, speed and auto-proceed through a wipe. `autoCast` is **not** added to that list:
the reset takes every purchase with it, so no checkbox would exist to carry a preference for.
Say so in a comment, so the omission reads as a decision rather than an oversight.

## UI changes

### Markup: the plain card has to grow a container

`renderUnlockedAbility` (`ui.js:634`) currently returns a bare `<button class="ability">`.
A checkbox cannot live inside a button, which is the same wall `renderTieredAbility` already
hit — see its comment at `ui.js:674` and the matching rule in
`06-ui-contract.md` under **Ability Status Rules**.

So: an unlocked ability whose automation is owned renders in the container form the tiered
card already uses — a `div.ability` holding a `button.ability-cast` and an `.ability-foot`
beneath it. The checkbox lives in that foot. `innate_power` is the only tiered ability
(`ABILITIES.innate_power.tiers`, `engine.js:443`), and its foot already holds the tier label
and the upgrade price, so the checkbox joins them there; `.ability-foot` is already
`justify-content: space-between` (`app.css:829`), which puts the box opposite the tier row
without new layout.

An unlocked ability whose automation is **not** owned keeps the bare-button form it has
today. Three card shapes total, not four:

| Ability state | Shape |
| --- | --- |
| Locked | `div.ability.is-locked` + price button (unchanged) |
| Unlocked, automation unowned | `button.ability` (unchanged) |
| Unlocked, automation owned | `div.ability` + `button.ability-cast` + `.ability-foot` with the checkbox |
| Tiered (`innate_power`) | as today; checkbox joins the existing foot when owned |

### The signature trap

`abilityBarSignature` (`ui.js:626`) currently tracks language, unlocks and tiers. Whether an
automation is **owned** now changes a card's shape, so `autoCastOwned` per ability has to
join the signature or a purchase will not rebuild the bar.

The **ticked state** must *not* join the signature. It is patched in `patchAbilityBar` by
setting `.checked`, like every other per-frame value. Folding it into the signature would
rebuild the whole bar on every click of the box and destroy the running cooldown sweep, which
is the exact failure the render/patch split exists to prevent (`ui.js:614-620`, and
**Live Update Rules** in `06-ui-contract.md`).

### The checkbox stays live between rounds

`patchAbilityBar` deadens everything pressable in the bar when the round is not running
(`ui.js:729-731`), because everything in it spends Energy the ended round no longer has. The
checkbox is the one exception and stays enabled: it spends nothing, and the shop between
rounds is exactly where a player decides how the next round should play. Write the reason in
as a comment — it is a deliberate exception to a rule stated right above it.

### Handler

The bar's existing delegated click handler (`ui.js:1388`) already has to tell an unlock
button from an upgrade button from the cast surface. The checkbox joins that chain and must
win outright before the cast path, the same way the two price buttons do. Toggle, then
`updateUI(state)` and `persist()`, like `autoWaveBtn` and `autoRoundBtn`.

### Locale strings

Both tables in `engine.js` (`de` around `:856`, `en` around `:1164`), beside the existing
`autoRound*` entries. Needed: a short label for the box and a hint for its `title`. The
existing German strings in that table carry real umlauts, so new ones match their neighbours
rather than the transliteration rule in the README (see **Known wrinkles**).

### CSS

One small block in `app.css` beside the `.ability-foot` rules at `:829`. The box is a control
on a card that is otherwise all state and price — keep it quiet, and make sure it does not
inherit the cast button's pointer behaviour.

## Tests

Extend `tests/automation.test.js`, and `tests/save.test.js` for the load rules:

1. Unticked, the automation does not cast: run a tick with the ability unlocked, ready, and a
   legal target on the board, and assert the cooldown is untouched and the board unchanged.
2. Unticking mid-round does not touch a running cooldown, and does not undo the cast that
   already happened.
3. Re-ticking resumes on the next ready cooldown, with no cooldown reset in between.
4. Ticked but bought mid-round: the checkbox is owned and on, yet nothing casts until the
   next `startRound` takes its snapshot. This is the pair of decisions in **3** meeting, and
   it is the one that will break first if someone "simplifies" the two predicates into one.
5. A save with no `ui.autoCast` loads with all five on.
6. A save with `ui.autoCast` carrying an unknown ability id drops it; one carrying `false`
   for a known id keeps the `false`.
7. `setAutoCast` on an ability with no automation in the map is a no-op and returns `false`.
8. A migration reset leaves the fresh state's five defaults standing.

Run `node tests/run.js` and update the check count quoted in `README.md:43` and in
`08-acceptance-tests.md` under **Current Validation Status**.

## Documentation to update — do this inside the implementation commits

The spec is kept current with the code, not ahead of it (`README.md`, *The spec*), which is
why none of this is written yet.

- [ ] **`docs/spec/03-state-contract.md`** — add `ui.autoCast` to the JSON block around `:34`;
      add a bullet to the field notes around `:227` beside `ui.autoProceed`, stating why it
      lives in `ui`; add the normalization rule to the list at `:268`; note that the migration
      reset does not carry it, and why.
- [ ] **`docs/spec/06-ui-contract.md`** — under **Ability Status Rules**, the checkbox and the
      three card shapes; under **Live Update Rules**, that the ticked state is patched and
      owned-ness is in the signature; under **Interaction Rules**, that the box stays live
      while the round is not running.
- [ ] **`docs/spec/07-content-registry.md`** — the five automation entries at `:220-254` each
      gain a line saying the automation can be switched off without being un-bought.
- [ ] **`docs/spec/02-core-loop.md`** — the wave-gate paragraph at `:133` is where the two
      existing preferences are described; add the cast toggle as the third of that kind.
- [ ] **`docs/spec/08-acceptance-tests.md`** — the eight checks above, in the automation
      section; refresh **Current Validation Status**.
- [ ] **`docs/tasks/implementation-microtasks.md`** — a completed-task entry in the style of
      the `R*` / `P*` blocks, naming the files and the tests.
- [ ] **`README.md`** — the check count at `:43`. The intro paragraph mentions the pacing
      toggles; a clause there is optional and probably not worth it.

## Suggested commit split

Three, each one green on its own:

1. **Engine.** `AUTO_CAST_UPGRADES`, the three functions, the five resolver lines, the state
   field, normalization, exports. Tests 1-8. No UI.
2. **UI.** Card shapes, signature, patch, handler, locale strings, CSS.
3. **Docs.** The checklist above.

Do not push. The session this lands in carries Feature 2 as well; keep it in its own commit
rather than mixed into these.

## Known wrinkles, neither of them blocking

- **The README's ASCII rule is already stale.** `README.md:57` says German strings
  transliterate umlauts (`ae`, `oe`, `ue`), but 84 lines of `engine.js` carry real ones,
  including the neighbours of the strings this feature adds (`autoWaveHint` at `:875`,
  `autoRoundHint` at `:878`). New strings match their neighbours. Reconciling the README with
  the file is out of scope here — it is a separate decision about which of the two is wrong.
- **`migrateSave` does not carry `ui.autoStartRound`** through a reset, though it carries the
  other four preferences (`engine.js:4916-4930`). It defaults on, so the only thing lost is a
  deliberate *off*. Pre-existing, unrelated to this feature, and left alone deliberately —
  noted here only so it is not "fixed" by accident while the neighbouring lines are open.

---

# Feature 2 — The round controls move above the shop

## What is being built

The two buttons that answer *when does the next round begin* — `startNextRoundBtn` and the
`autoRoundBtn` toggle beside it — leave the shop panel and become a row of their own in the
rail, directly above it.

Rail order today, and after:

```
  before                          after
  ------                          -----
  panel.track                     panel.track
  panel.abilities                 panel.abilities
  panel.shop                      div.round-controls   <-- [ Naechste Runde starten ] [Auto-Runde]
    Zwischen den Runden           panel.shop
    Runde 4 verloren - 120 F.       Zwischen den Runden
    Verfuegbare Furcht 1240         Runde 4 verloren - 120 F.
    [ upgrade list ......... ]      Verfuegbare Furcht 1240
    [ Runde starten ] [Auto]        [ upgrade list ......... ]
  panel.log                       panel.log
```

Nothing about *when* a round may start changes. This is placement only.

## Why

The shop panel is never hidden any more (`ui.js:806-812`), and the upgrade catalogue is the
tallest thing in the rail: the repeatable ladders, the divider, the one-offs, the sold-out
block below its own second divider, and the pool row with its strip of denominations. The one
control that ends the shopping sits underneath all of it, so leaving the shop means scrolling
past everything the player has already decided not to buy. The catalogue only ever grows.

Starting the next round is not a purchase. It is what shopping ends with, and it should be
reachable in the same screenful as the panel it ends.

## Settled decisions

**1. Above the panel, not at the top of the panel.** The row is a **sibling** of
`section.panel.shop` in `.rail`, not its first child. Two reasons, and the first is the one
that matters: nothing inside the shop can ever push the row down again — not the upgrade list
today, not a row added to the catalogue later. The second is that a section whose primary
action sits above its own `<h2>` has a heading that no longer heads anything.

**2. The two travel together and stay adjacent.** The toggle sits beside the button it
automates, the same rule that puts `autoWaveBtn` beside `startNextWaveBtn` in the HUD
(`index.html:116-119`). It stays hidden until `autoStartRoundOwned` (`ui.js:1085-1086`) and
stays lit when on — none of that behaviour is touched.

**3. Still disabled while a round runs, never hidden.** `ui.js:1095-1097` disables it on
`state.round.status !== "ended"`, and that stays. The reason the wave button gives for the
same choice one level down (`ui.js:1073-1075` — "a button that came and went would move the
two beside it every wave") is stronger up here: a row that vanished at every round boundary
would jump the shop panel and the whole log up and down the rail.

**4. No panel chrome.** It is a bare `div` in the rail's flex column, not a fourth
`section.panel`. Both buttons already carry their own border and fill; a panel drawn around
two buttons would read as a section of the page, which a pair of controls is not. The rail's
`gap: 0.9rem` is the separation.

## Markup

`index.html`: move the `div.shop-controls` block at `:217-220` — and the comment above it at
`:215-216` — out of `section.panel.shop` (`:202`) and place it between the abilities section
and the shop section.

Rename the class to `round-controls`. It is not in the shop any more, and a class named for
the panel it no longer sits in is the next reader's wrong turn.

Both ids are unchanged — `startNextRoundBtn`, `autoRoundBtn` — which is what keeps `ui.js`
out of this feature.

The existing comment explains why the two buttons sit together. Extend it to say why they sit
above the shop rather than inside it: the catalogue is the tallest thing in the rail and the
control that leaves it must not be behind it.

## CSS

`app.css:1053-1064`, the `.shop-controls` block:

- Rename the selector to `.round-controls`, and rewrite the comment above it — it currently
  describes the row as the shop's.
- Keep `display: flex`, `align-items: stretch`, `gap: 0.4rem`, and
  `.round-controls .primary-btn { flex: 1; }`.
- **Drop** `.shop-controls .hud-btn { margin-top: 0.7rem; }` and **drop** the
  `margin-top: 0.7rem` from `.primary-btn` (`:1068`). `primary-btn` is worn by this one button
  and nothing else (`index.html:218`), and both margins existed only to lift the row off the
  upgrade list it used to follow. The rail's own gap does that now, and with the nudge gone
  `align-items: stretch` gives the two buttons equal height without it.

No media query mentions the row. Below 1180px the rail takes the full width and the row
widens with it, which is what should happen.

## JS

Expect **no change**. Both buttons are looked up by id (`ui.js:69-70`), and both are patched
by `patchPacingControls` (`ui.js:1083-1097`) on every frame, independent of `renderShop`.
Read those two functions to confirm it before assuming it.

One cleanup the move makes provable: `shopSignature` (`ui.js:785-802`) lists
`autoStartRoundOwned(state)` and `autoStartRoundOn(state)`, and `renderShop` reads neither.
Today that only buys a pointless rebuild of the whole catalogue on every click of the toggle;
once the buttons are not in the panel at all it is also plainly wrong. **Drop both lines.**
Ownership still reaches the signature through `tiers` — `auto_start_round` is in
`UPGRADE_IDS` — so no rebuild that matters is lost. If reading `renderShop` shows it does use
one of them after all, leave both alone and say so in the commit message.

## Locale

None. Both buttons keep the strings they have: `startNextRoundBtn`, `autoRoundOnBtn` /
`autoRoundOffBtn`, `autoRoundHint`.

## Verification

There are no DOM tests — the suite under `tests/` is engine-level, and `node tests/run.js`
proves nothing about this feature. The check count in `README.md:43` does **not** move for it.
Run the suite anyway to show nothing broke, then check by hand:

- `index.html?vis&ended` — the row sits above the shop panel, the button is live. The toggle
  is there if the fixture owns `auto_start_round`, and the row is a single centred button if
  it does not; both are correct.
- `index.html?vis` — a running round: the row is in the same place, the button is disabled,
  and nothing below it has moved.
- A real round boundary — the row does not shift when the shop summary changes length or a
  purchase adds or removes a catalogue row.
- Narrow the window past 1180px and past 720px.

## Documentation to update — inside the implementation commit

- [ ] **`docs/spec/06-ui-contract.md`** — the layout list at `:381` names the rail's contents
      ("ability bar, then the shop when a round has ended, then the log"); the row goes in at
      its place. The bullet *"A clear 'Start Next Round' control, always available regardless
      of remaining Fear"* at `:191` sits under **4. Between-round shop** and no longer belongs
      there — move it out, and say where the row sits and why the catalogue must not stand in
      front of it. Check **Interaction Rules** (`:253`) for anything naming where the round is
      started.
- [ ] **`docs/spec/02-core-loop.md`** — grep it for the round button before editing; at
      `7b5e652` it describes *when* a round may start and never *where* it is started from,
      so the expected answer is no change.
- [ ] **`docs/tasks/implementation-microtasks.md`** — a completed-task entry in the style of
      the `R*` / `P*` blocks.

## Commit split

**One commit** — markup, CSS, the `shopSignature` cleanup, docs. It is a move; splitting it
leaves a commit in which the button is in two places or in none. Do not push.

## Known wrinkle, not blocking

`06-ui-contract.md` says in two places that the shop is visible only while `round.status` is
`ended` (`:15` and the heading at `:160`). That stopped being true when the shop stopped
hiding itself (`ui.js:806-812`, *"Never hidden any more."*), and one of the doc edits above
lands directly on it. It is a pre-existing drift and a separate correction — fixing it in its
own commit is welcome, but do not let it slide into this feature's description as though the
move caused it.

---

# Feature 3 — The Dahan strike bar on the chip

## What is being built

A thin bar under the Dahan row on a land chip, with a small axe at its left. It **fills** as
the Dahan's strike clock runs down, and is full at the instant they swing. It is drawn only on
lands where the strike will actually land — Dahan present **and** invaders present.

## Why

The strike clock exists on screen in exactly one place: `dahanAttackValue` in the board HUD
strip (`ui.js:1035-1037`), a number of seconds among two other numbers of seconds, above the
island. The eye is on the board. Asking when the Dahan next swing currently means leaving the
thing being watched, finding the right one of three countdowns, and coming back.

The strike is also the only clock on the board that is *good news*, and it is the one with no
representation where the units it belongs to are standing.

## Settled decisions

**1. One clock, drawn several times.** `resolveDahanAttack` (`engine.js:3992-4014`) walks
every land and swings them all on a single `round.dahanAttackRemaining`. Every bar on the
board therefore shows the same fraction, always, and they are all full at the same instant.
This is a repetition on purpose: the point is putting the clock where the eye already is, not
telling eight lands eight different things. Do **not** build a per-land timer, do not look for
a per-land value to read, and compute the fraction once per frame rather than once per bar.

**2. Only where the strike lands.** The bar is drawn when `dahan > 0` **and** the land holds
invaders — which is exactly the skip condition at `engine.js:4002`. So the bar means *these
Dahan hit here when it fills*, never *somewhere on the island someone swings*. A land with
Dahan and no invaders gets no bar, because the strike would pass it by and log nothing; a bar
there would fill to full and then do nothing, which is the one thing a gauge must never do.

Note the deliberate contrast with the Dahan health ring, which is left **stopped rather than
cleared** when a land empties (`06-ui-contract.md:143-146`). The ring remembers and the strike
bar does not, and the reason is that they are different kinds of number: the ring's value is
this land's own history, and the bar's value is a global clock that says nothing whatever
about a land the strike will skip.

**3. A bar, not a ring.** The Dahan glyph already wears a ring — the casualty clock, fed by
`dahanProgress` (`ui.js:556-565`). A second sweep on the same token would be one dial
appearing to contradict itself, and would resize the glyph that the whole chip row is aligned
on.

**4. It fills. It does not drain.** Health drains; an attack gathers. This is written down
because it puts the new bar in the opposite direction from `waveFill`, which shows time
remaining and empties (`ui.js:1027-1029`), and the two are otherwise the same kind of clock.
The split is intentional and reads correctly: the wave bar is the invaders' and answers *how
long do I still have*, the strike bar is the player's and answers *how much have my people
gathered*. On the chip itself the convention is consistent — the Blight bar beside it also
fills.

**5. Normalized so it always ends at 100%.** Divide by `roundDahanAttackInterval(state)`
(`engine.js:2235`, already exported at `:5087`), never by `DAHAN_ATTACK_INTERVAL_SECONDS`.
`dahan_remember` halves the interval at full investment, so a bar measured against the base
constant would top out near 50% and the swing would land at half-mast — the bar would silently
stop meaning "full means now" exactly for the player who paid 10000 Fear to make it matter.

`roundDahanAttackInterval` reads `activeUpgradeTier`, so it is the round's frozen snapshot and
the very number `tick` divides by at `engine.js:4608`. Two things follow, both wanted: the bar
can never disagree with the clock it draws, and a mid-round purchase does not re-scale a bar
that is already moving.

**6. Subordinate to the Blight bar, and not in its row.** `06-ui-contract.md:134-135` states
the rule this feature bends:

> One bar and rings, rather than a second bar: two bars of equal weight read as two equal
> threats, and only Blight ends the round.

The rule is kept by **weight**, not by count. The strike bar is thinner than the Blight bar,
carries `--dahan-ink` rather than pressure red, and sits in **its own row** under the allies
row. It must not go inside `.chip-meters`: that row is `display: flex` with
`.chip-meter { flex: 1 1 auto }` (`app.css:1235-1250`), so a second meter dropped in there
would split the width with Blight and produce precisely the two equal bars the rule forbids.

The colour is doing real work here. The strike bar is the only thing on a chip that is good
news, and it must not be mistaken at a glance for a fourth way to lose.

## Engine changes

**None.** Every number this feature needs already exists and is already exported:
`state.round.dahanAttackRemaining`, `roundDahanAttackInterval` (`engine.js:5087`),
`invaderCountInLand` (`engine.js:5198`). If the implementation finds itself adding an engine
function, stop — it has drifted from decision **1** and is building a per-land clock.

No state contract change either. The bar is a second reading of a field that has been in
`round` since the strike existed.

## UI changes

### Sprite

New `si-axe` symbol in the defs at `index.html:19-55`. Four symbols today; this is the fifth
and the first that is not a unit. Same `viewBox="0 0 16 16"`, painting with `currentColor`
like its neighbours, so one CSS rule colours it. Keep it readable at roughly 9-10px — the chip
glyphs are tiny, and an axe with a detailed head becomes a smudge. Head and haft, nothing
else.

### Markup

A helper beside `chipMetersMarkup` (`ui.js:425`), called from `renderBoard` between the allies
row and the meters (`ui.js:530-531`) — under the Dahan, which is where it was asked for:

```js
// The Dahan's strike clock, on the chip instead of only in the HUD strip. There is one clock
// for the whole island - see resolveDahanAttack - so every bar this draws shows the same
// fraction as every other. It is drawn per land only because the board is where the player is
// looking, not because the lands are on separate timers.
//
// Only where the strike will actually land: resolveDahanAttack skips a land holding no
// invaders, and a bar there would fill to full and then do nothing.
function chipStrikeMarkup(state, landId) {
  if ((state.dahan[landId] || 0) <= 0) return "";
  if (invaderCountInLand(state.invaders[landId]) <= 0) return "";
  ...
}
```

Shape: a row holding the axe glyph and a track, with the fill carrying
`data-meter-land="${landId}" data-meter-kind="dahan-strike"` and a `title`. The fill's width is
written by `patchLandMeters` and is **not** baked in here — same rule as the Blight bar, for
the same reason (`ui.js:418-420`).

`data-meter-land` is on the element only so the existing `[data-meter-land]` selector picks it
up. The branch below does not read it. Say that in a comment, or the next reader will go
looking for the per-land value that does not exist.

### Patch

`patchLandMeters` (`ui.js:544-565`) has exactly two shapes today: `blight` is a width, and
**everything else falls through to the health-ring branch** and gets `--health-lost` plus
opacity gating. A third kind therefore needs its own branch *before* that fallback, or the new
bar is handed a ring's treatment and sits invisible at `opacity: 0`.

One clock means one number, computed above the loop rather than eight times inside it:

```js
// One clock for the whole island, so one number - computed here rather than in the loop, which
// would recompute the same fraction once per land on every frame.
//
// Against the round's interval, not the base constant: dahan_remember halves it, and a bar
// divided by the base would stop at half while the Dahan swing. It fills rather than drains -
// health drains, an attack gathers.
const strikeInterval = roundDahanAttackInterval(state);
const strikeFill = state.round.status === "running" && strikeInterval > 0
  ? clamp(1 - state.round.dahanAttackRemaining / strikeInterval, 0, 1)
  : 0;
```

A round that is not running reads 0%, matching `waveFill` (`ui.js:1027-1029`).

### Signature: nothing to do

Whether a chip carries the bar depends on that land's Dahan count and its invader counts, and
`boardSignature` already pushes both per land (`ui.js:1250-1262`). Verified, not assumed — no
signature change, unlike Feature 1. The **fill** must of course never reach the signature; it
is a per-frame value like every other.

### CSS

A new block beside `.chip-meters` (`app.css:1229-1262`):

- Own row: `display: flex; align-items: center;` with a small gap, axe then track.
- Track height **3px** against the Blight bar's 5px, and `--dahan-ink` (`app.css:14`) for the
  fill and the axe. `.unit-dahan` at `:1436` already carries that colour for the token — reuse
  the variable, not the hex.
- The chip text rule in `06-ui-contract.md:278-282` applies: anything new on a chip needs its
  own dark backing to survive bright desert terrain. The track's own background does that job
  for the bar; the axe needs it checked by eye.
- **Rewrite the comment above `.chip-meters` at `:1229`.** It currently says the Blight bar
  "is the only bar here" and explains why the Dahan clock is a ring instead. That stops being
  true with this feature, and the replacement should say what decision **6** says: one *threat*
  bar, and a lighter bar in the player's colour that is not a threat at all.
- The reduced-motion block at `:1594` lists `.chip-meter-fill`; the new fill joins it.

### Locale

One string in both tables — a label for the bar's `title`, beside `dahanAttackLabel`
(`de :1071`, `en :1347`). Real umlauts in the German, matching its neighbours rather than the
README's transliteration rule; see **Known wrinkles** under Feature 1.

## Verification

No engine change, so `node tests/run.js` proves nothing about this feature and the check count
in `README.md:43` does **not** move. Run the suite to show nothing broke, then check by hand:

- A land holding both Dahan and invaders: the bar is there, it fills smoothly, and it empties
  at the same instant the log prints `dahanAttackResolved` for that land.
- A land with Dahan and no invaders: **no bar**. A land with invaders and no Dahan: **no bar**.
- The bar appears and disappears as a land gains or loses its last invader, without a click —
  this is the signature claim above, and it is the one to actually watch.
- Invest in `dahan_remember` and start a round: the bar still reaches exactly 100% as they
  swing, just sooner. Then invest again *mid-round* and confirm the bar does not re-scale.
- End the round: every bar reads empty.
- The speed dial: the bar is a fraction, so it needs nothing from `displaySeconds` and should
  track game time at every speed. At 0 it should freeze rather than jump.
- Narrow the window; land 4 is the narrowest chip (`landChipWidthPercent`), so it is the one
  where a row with a glyph and a track will break first.

## Documentation to update — inside the implementation commit

- [ ] **`docs/spec/06-ui-contract.md`** — in the per-land list under **3. Island board panel**
      (`:115-150`), the strike bar: where it sits, that it fills, that it is normalized against
      the round's interval, and the two conditions for drawing it. Amend the "one bar and rings"
      sentence at `:134-135` rather than deleting it — it remains the rule for threat bars, and
      the new bar is explicitly not one. Note the contrast with the stopped-ring rule at `:143`.
- [ ] **`docs/spec/06-ui-contract.md`**, **Live Update Rules** (`:290`) — the fill is patched
      per frame; presence is already covered by the board signature.
- [ ] **`docs/spec/09-island-board.md`** — grep it for what a chip carries before editing; if
      it lists chip contents, the bar goes in there too.
- [ ] **`docs/spec/03-state-contract.md`** — expected **no change**. Say so in the commit
      message so the omission reads as checked rather than forgotten.
- [ ] **`docs/tasks/implementation-microtasks.md`** — a completed-task entry in the style of the
      `R*` / `P*` blocks.

## Commit split

**One commit** — sprite, markup, patch, CSS, locale, docs. There is no half of this that is
worth having on its own. Do not push.

## Known wrinkles, neither blocking

- **Every bar on the board is identical.** That is decision **1** working as intended, but it
  is worth knowing that if the board ever gets more crowded, the fallback is one bar in the land
  detail panel plus the HUD, not eight on the map. Not a reason to hold this.
- **A large step can fire more than one strike per tick.** The `while` at `engine.js:4607`
  loops up to 16 times. The bar just resets, which is correct, but at very low frame rates or
  very high speed a swing can pass without the bar ever being seen full. Nothing to fix — the
  log is the record of what happened, and the bar is a gauge.

---

# Feature 4 — Older save files keep working

## What is being built

Not a feature. A rule that already half-exists, written down properly and given a test that
can fail.

Three things:

1. A **spec section** in `03-state-contract.md` saying what "an older save still works" means
   here, and what an implementer must do when adding a field.
2. A **captured save file** from before Features 1-3 — already in the tree at
   `tests/fixtures/save-5.0.0-pre-autocast.js` — and a suite that loads it and asserts it comes
   back as a playable game rather than a wipe.
3. The same rule stated in the two places an implementer will actually be standing when they
   break it: `README.md`'s conventions list, and `08-acceptance-tests.md`.

## Why

The game has an export/import button (`7b5e652`), so save files leave the browser and come
back. Once a file is on the player's disk it outlives every build after it. The engine's only
compatibility mechanism is `schemaVersion`, and it is all-or-nothing: `migrateSave`
(`engine.js:4897`) returns the save untouched when the version matches exactly, and **wipes the
game** when it does not, carrying four preferences through and nothing else.

That means the whole burden of compatibility falls on normalization, which is exactly where a
new field is easiest to get wrong. `ui.autoStartRound` already got it right and left the
reason in a comment (`engine.js:4767-4769`); `ui.autoCast` in Feature 1 has to get it right for
five ids at once. Nothing currently fails if a future field defaults the wrong way — the save
simply loads with the player's automations silently off, or with `VERSION` bumped and every
player's Fear gone.

The failure this guards is not subtle and it is not recoverable: a player who exported a save
last month and imports it after an update either gets their run back or gets a fresh game.

## Settled decisions

**1. `VERSION` does not move for an additive change.** `engine.js:13` is `"5.0.0"`. A field
added to `ui`, `round` or `meta` that older saves simply lack is **not** a version bump, because
a bump is a wipe: `migrateSave` has one path for a mismatch and it is `createFreshGameState`.
The version moves only when a save's *existing* fields stop meaning what they meant — the
`2.0.0` → round-based change is the example, and it is why the reset path exists at all.

**2. The default for a missing field is whatever costs the player nothing.** Absent means "this
save predates the field", never "the player turned it off". `ui.autoStartRound !== false` and
Feature 1's `autoCast` map are both this rule; `ui.autoProceed === true` is the deliberate
exception, because its default is off for a new game too, so a save that lacks it and a new
game agree.

**3. Rebuild registry-keyed maps, never merge them.** For a field keyed by content ids
(`upgrades.purchased`, `abilities`, and now `ui.autoCast`), normalization walks the registry
and reads the save per key, dropping keys the registry does not carry. A save cannot then
smuggle in an id that no longer exists, and a save written before an id was added gets that
id's default without anyone listing it anywhere.

**4. The fixture is captured, not generated.** `tests/fixtures/save-5.0.0-pre-autocast.js` was
dumped out of the build at `ccbb135` and is a frozen artifact. It must never be regenerated
from `createFreshGameState`, which would make it agree with whatever the engine does today —
the one thing it exists not to do. The header comment in the file says so; leave it there.

**5. It is a fixture, not a golden file.** The test asserts the *properties* an old save must
still have — loads without a reset, keeps the Fear, keeps the purchases, gets sane defaults for
everything added since — not a byte-for-byte match against a snapshot. A golden file would fail
on every legitimate field addition and be re-blessed without being read, which is a test that
costs maintenance and catches nothing.

## Tests

New file `tests/compat.test.js`, and **add it to the list in `tests.html`** (see *Environment
facts*). It requires the fixture the way `harness.js` requires the engine — `require` under
node, `window.SpiritSaveFixtures.pre500AutoCast` in the browser.

Deep-clone the fixture in each test before handing it to the engine (`JSON.parse(JSON.stringify(...))`
is enough and matches what a real load does), so one test cannot mutate it for the next.

1. `migrateSave(fixture)` returns `reset: false`. This is the headline: an old file is **not**
   wiped.
2. It keeps what the player earned — `meta.fear` is 4820 and `meta.bestWaveReached` is 11.
3. It keeps every purchase, including `dahan_remember` at tier 2, and the round's frozen
   `upgradeTiers` snapshot still reads 2 for it.
4. It keeps the preferences it carries: `ui.language` is `en`, `ui.autoProceed` is `true`.
5. Every field added after the file was written is present and at its no-cost default. Written
   so that it covers `ui.autoCast`'s five ids (Feature 1) and does not need editing when the
   next field lands: assert against `createInitialState()`'s `ui` keys, and for each key the
   fixture does not carry, assert the loaded value equals the fresh default.
6. The loaded state is **playable**: `startRound` it, `advance` a wave's worth of time, and
   assert the round is still running and the log grew. A save that loads into a shape `tick`
   throws on is not compatible, and check 1 alone would not notice.
7. Round-trip through the disk path the player actually uses: `exportSave` the loaded state,
   `importSave` the text back, and assert `reset` is false and the Fear survived.
8. The guard that the other seven do not give: a save carrying an unknown `schemaVersion`
   **does** reset, and says which version it came from. Compatibility is not "never reset" — it
   is "reset only when the shape genuinely changed", and a test suite that only proves the
   first half would pass on an engine that had stopped resetting anything at all.

## Documentation to update — inside the implementation commit

- [ ] **`docs/spec/03-state-contract.md`** — a new section, `## Older save files keep working`,
      placed after **Normalization Requirements** and before **Migration from anything older**,
      since it is the rule that migration is the last resort of. State decisions 1-3 above as
      requirements on the implementer, name the export/import path as the reason files outlive
      builds, and link the fixture by path. Add a line to the **Rules** list at `:7-11` beside
      the existing *"New fields must normalize safely when older saves are loaded"* — that
      sentence is the rule already; it needs the teeth of a section and a test.
- [ ] **`docs/spec/03-state-contract.md`** — while in there: the canonical block at `:17` says
      `"schemaVersion": "4.0.0"`, which the file itself is the contract for. It is `5.0.0`
      (`engine.js:13`). Fix it. (The same block lists `meta.bestRoundReached`, which
      `normalizeState` deletes and **Retired Fields** covers — noted, deliberately left alone,
      not this commit's business.)
- [ ] **`docs/spec/08-acceptance-tests.md`** — the eight checks above, in the save/migration
      section beside the existing `schemaVersion` checks at `:313` and `:324`; refresh
      **Current Validation Status** with the count the suite prints.
- [ ] **`README.md`** — a bullet in **Conventions worth knowing before editing**: a save file
      outlives the build that wrote it, a missing field defaults to what costs the player
      nothing, and `VERSION` moves only when existing fields change meaning, because a bump is
      a wipe. Refresh the check count at `:43`.
- [ ] **`docs/spec/05-progression.md`** — `:146` already says progression fields are meant to be
      forward-compatible; point it at the new section rather than restating it.
- [ ] **`docs/tasks/implementation-microtasks.md`** — a completed-task entry in the style of the
      `R*` / `P*` blocks.

## Commit split

**One commit** — the test file, the `tests.html` registration, the docs. The fixture is already
committed to the tree by the session that set this file up; if `git status` shows it untracked,
it belongs in this commit. Do not push.

---

# When all four are done

- [ ] **Delete this file.** Nothing permanent may link to it. Fold the deletion into the last
      commit of whichever feature lands last — which is Feature 4, since it lands over the top
      of the other three.
- [ ] Confirm nothing links here: grep `docs/` and `README.md` for `bunch-of-new-features`.
- [ ] Run the suite one final time on the final commit and confirm the number in `README.md`
      and in `08-acceptance-tests.md` is the number it printed.
