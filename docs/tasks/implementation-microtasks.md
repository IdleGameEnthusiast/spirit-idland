# Spirit Idland Implementation Microtasks

This pack pivoted from a turn-based, presence-driven prototype to a round-based, real-time
survival loop (see [docs/spec/index.md](../spec/index.md)). **That pivot is done.** The
turn-based `app.js` is deleted; the build is `engine.js` (rules, no DOM) plus `ui.js` (DOM,
no rules), with a regression suite in `tests/`.

What remains is balance and content, not structure — see
[What To Build Next](#what-to-build-next) for the ranked queue, and
[Idea Inbox](#idea-inbox) for the unsorted pile that feeds it.

## Round-Based Redesign — Complete

### Task R1: Round State Model & Reset — *done*

- Landed the `3.0.0` shape: `meta`, `round`, `abilities`, `pendingAbilityTarget`,
  `upgrades.purchased`, and the hard-reset migration from `2.0.0`.
- Four fields were added beyond the original contract, each documented with its reason in
  [03-state-contract.md](../spec/03-state-contract.md#fields-added-during-implementation):
  `round.blightByLand`, `round.fearEarned`, `round.abilityCooldownMult`, `ui.blightFx`.
- Covered by `tests/save.test.js` and `tests/setup.test.js`.

### Task R2: Automatic Wave Resolution — *done*

- `tick()` drives the wave timer; at 0 a full wave resolves and the timer resets. No control
  shortens that interval or pulls a wave forward — the pacing controls added later (Task P1)
  stop the clock, they never skip ahead on it.
- The tick cap (`MAX_TICK_SECONDS = 5 * TIME_SCALE`) sits below one wave interval, so a
  machine waking from sleep resolves no waves at all rather than a burst. Asserted. It is
  written against the dial so it stays half an interval whatever the game's pace.
- Covered by `tests/wave.test.js`.

### Task R3: Automatic Dahan Strike — *done, reworked in Task C1*

- The `ravageCounter` targeting queue is gone with no successor object. The pool is computed
  and spent inside the same step, highest tier first, one damage at a time.
- Originally the survivors' counterattack at the end of a Ravage; now a periodic strike on
  its own timer. The spending rule is unchanged.
- Covered by `tests/combat.test.js`.

### Task R4: Blight — *done, reworked in Task C1*

- Clamped at the threshold, round ends the instant it is reached.
- The per-land tally added here is what makes `wash_away` targetable and what puts "which
  land just cost me the round" on the board.
- Covered by `tests/blight.test.js`.

### Task R5: Fear as Persistent Meta-Currency — *done*

- `meta.fear` survives round end and round setup; `round.fearEarned` tracks the round's own
  income for the shop's summary line.
- The Fear formula is `power * 0.35`, which is **not** what the turn-based build did — see
  the note in [04-economy-formulas.md](../spec/04-economy-formulas.md#fear-formula).
- Covered by `tests/shop.test.js`.

### Task R6: Ability Bar — *done*

- Four cooldown-gated abilities, single-click targeting, cancel-by-reclick, and the
  no-legal-target rule that leaves the cooldown unspent.
- Three tie-breaks the one-click model forced are documented in
  [04-economy-formulas.md](../spec/04-economy-formulas.md#tie-breaks-the-one-click-model-forced).
- Covered by `tests/ability.test.js`. **The numbers are still placeholder.**

### Task R7: Upgrade Shop — *done*

- Three repeatable upgrades with a `1.6^tier` cost curve, applied at round setup, surviving
  any number of further rounds. Starting the next round is never blocked.
- `unlock_<ability_id>` machinery works but has nothing to unlock yet.
- Covered by `tests/shop.test.js` and `tests/setup.test.js`.

### Task R8: UI Retrofit — *done*

- Presence tracks, growth options, card hand and the essence rail are gone from the markup,
  the stylesheet and the state.
- Added: the round HUD with a live Blight meter and wave timer, the ability bar with
  per-ability cooldown sweep, the between-round shop, per-land Blight on the board, and
  blight-gain feedback at the moment it happens.
- Live values patch in place; the board rebuilds only when its own signature changes.

### Task R9: Regression Harness — *done*

- Runnable in a browser (`tests.html`), headlessly (`tests\headless.ps1`), or under node if
  it is installed (`tests/run.js`).
- The engine takes its clock and RNG by injection, which is what makes a suite that plays
  dozens of rounds deterministic and instant.
- The board's original 62 checks were re-derived rather than trusted, per
  [09-island-board.md](../spec/09-island-board.md#verification).

---

## Continuous Combat Redesign — Complete

### Task C1: Replace the Ravage phase with a continuous fight — *done*

The `4.0.0` rework. Damage is no longer an event on a named terrain; it is a rate in every
land at once.

- **Blight** accrues per land at `net * BLIGHT_PER_DAMAGE_SECOND` per second, where `net` is
  gross invader damage minus 2 per Dahan standing there. A filled bar carries its remainder.
- **Dahan casualties** accrue per land at `(gross / dahanCount) * DAHAN_LOSS_PER_DAMAGE_SECOND`
  — gross, not net, and concentrated on the survivors so an under-defended land collapses
  rather than declining evenly.
- **The Dahan strike** moved onto `DAHAN_ATTACK_INTERVAL_SECONDS`, a constant of its own,
  dealing `DAHAN_ATTACK_DAMAGE` per Dahan. It starts equal to the wave interval by choice,
  not by derivation.
- **The invader track lost a slot.** `invader.ravage` is gone; a wave is Build, Discover,
  shift, and deals no damage.
- **Two new per-land floats**, `round.blightProgress` and `round.dahanProgress`, are the only
  fractional board state. They are deliberately excluded from the board's rebuild signature
  and patched in place, or the board would rebuild ten times a second.
- Covered by `tests/combat.test.js`; `tests/wave.test.js` and `tests/blight.test.js` were
  rewritten around it, and `tests/ravage.test.js` is deleted.

---

## Pacing Controls — Complete

### Task P1: Player-set speed, and a wave the player calls — *done*

Two settings over one thing: how fast the round reaches the player. Neither changes what the
round costs; both are spelled out in [02-core-loop.md](../spec/02-core-loop.md#pacing).

- **The speed dial** (`ui.gameSpeed`, one of `GAME_SPEEDS = [0, 1, 2]`, default `1`) is how
  many game seconds one real second buys: `1x` ships the twenty-second wave, `2x` halves it,
  `0x` stops the clock. It is a single multiplier on `dt` inside `tick()`, so nothing
  downstream of the tick knows a speed exists, and no constant is scaled twice.
- **The wave gate** (`ui.autoProceed`, off by default, and `round.awaitingWave`) stops every
  clock in the round at the end of a wave timer until the player calls the wave. A round also
  opens on a held gate, with the timer still full, so the opening call starts the clock
  without costing a wave; leaving the shop is itself that call.
- **Countdowns are drawn in real seconds** at the current speed — wave, Dahan strike, and
  every ability cooldown — or two clocks that run together stop reading as one.
- Both settings persist and survive a migration reset, like the language toggle.
- Covered by `tests/pacing.test.js`; `tests/harness.js` opts its fixture into auto-proceed,
  since every older suite is written against a clock that simply runs.

### Task P2: An ability automation can be switched off — *done*

Buying one was a one-way door. The resolvers run inside `tick` before the fight and fire the
instant the cooldown clears, so the card never spent a frame in a state the player could
click: once `auto_wash_away` was bought, 400 Fear had permanently removed an ability from
active play. The round gate had already answered this one level up — buying the automation and
wanting it on right now are two different things — and this is that sentence applied to the
cast instead of the round.

- **`AUTO_CAST_UPGRADES`** (`engine.js`) is the only place the two id spaces are tied together:
  the resolvers are keyed by upgrade, the ability bar by ability. `autoCastOwned` reads
  `upgradeTier` and decides whether the card draws a checkbox at all; `autoCastOn` reads
  `activeUpgradeTier` **and** the toggle and decides whether it casts this tick. Keeping them
  apart is what makes unticking bite on the next tick while a mid-round purchase still waits
  for the next round. Each of the five resolvers' first line became `autoCastOn`; nothing else
  in them moved, and the call order inside `tick` is unchanged.
- **`ui.autoCast`** (`03-state-contract.md`) is one flag per ability, in `ui` rather than
  `round` for the same reason `autoProceed` and `autoStartRound` are: it outlives every round
  it is read in. It is rebuilt from the registry on load rather than merged over, so a save
  written before the field loads with all five automations still running and cannot smuggle in
  a toggle for an ability the build no longer has. `VERSION` did not move — a bump is a wipe,
  and this is additive.
- **The card grew a container** (`ui.js`, `app.css`). An unlocked ability whose automation is
  owned takes the shape the tiered card already had — a checkbox cannot live inside a button
  any more than a price can — so three card shapes exist, not four. Owned-ness joins
  `abilityBarSignature`; the box's ticked state deliberately does not, and is patched per frame
  like every other value. The box is the one thing in the bar that stays live between rounds:
  it spends nothing, and the shop is where the next round gets decided.
- Covered by `tests/automation.test.js` (six checks: the four toggle behaviours, the unmapped
  no-op, and the map's contents) and `tests/save.test.js` (three: the absent field, the rebuild
  from the registry, and the migration reset). The card itself was driven by hand in headless
  Edge over the `?vis` fixture — see [08-acceptance-tests.md](../spec/08-acceptance-tests.md).

### Task P3: The round controls move above the shop — *done*

The shop panel stopped hiding itself, and the upgrade catalogue is the tallest thing in the
rail — the repeatable ladders, the one-offs, the sold-out block, the pool row and its strip of
denominations, and it only ever grows. The one control that ends the shopping sat underneath
all of it, so leaving the shop meant scrolling past everything the player had already decided
not to buy. Starting the next round is not a purchase; it is what shopping ends with.
Placement only — nothing about *when* a round may start changed.

- **`div.round-controls`** (`index.html`, `app.css`) holds `startNextRoundBtn` and the
  `autoRoundBtn` toggle, and is a **sibling** of `section.panel.shop` in `.rail` rather than
  its first child: nothing inside the shop can then ever push it back down, not the catalogue
  today and not a row added to it later. It carries no panel chrome — both buttons have their
  own border, and the rail's `gap` is the separation — and both `margin-top` nudges went with
  the move, since they only ever existed to lift the row off the upgrade list it used to
  follow. The class was renamed off `shop-controls` because it is not in the shop any more.
- **No JS change.** Both buttons are looked up by id and patched by `patchPacingControls`
  every frame, independent of `renderShop`; the toggle stays hidden until owned and the button
  stays disabled rather than hidden while a round runs, exactly as before.
- **`shopSignature` dropped `autoStartRoundOwned` and `autoStartRoundOn`.** `renderShop` reads
  neither — verified, not assumed — so they only ever bought a rebuild of the whole catalogue
  on every click of the toggle. Ownership still reaches the signature through the upgrade
  tiers, which is the only part of that purchase the shop draws.
- No engine change and no state change, so the suite is unmoved at 383 checks and proves
  nothing about this either way. Driven by hand in headless Edge over the `?vis` and
  `?vis&ended` fixtures — the row's place in the rail, the button's disabled state in both,
  and the layout at 1400px, 1100px and 700px.

### Task P4: The Dahan strike bar on the chip — *done*

The strike clock existed on screen in exactly one place: a number of seconds in the board HUD
strip, among two other numbers of seconds, above the island. The eye is on the board, so asking
when the Dahan next swing meant leaving the thing being watched, finding the right one of three
countdowns, and coming back. It is also the only clock on the board that is *good news*, and
the only one with no representation where the units it belongs to are standing.

- **`chipStrikeMarkup`** (`ui.js`) draws a short track followed by a new `si-axe` glyph
  (`index.html`, the fifth symbol in the defs and the first that is not a unit), emitted into
  the allies row immediately right of the Dahan count — it is that count's clock and nothing
  else's, and standing beside it says so with no ink spent. Drawn only where `dahan > 0` **and**
  the land holds invaders — exactly the land `resolveDahanAttack` would not skip, so a bar means
  *these Dahan hit here when it fills* rather than *somewhere on the island someone swings*. A
  bar on a land the strike passes by would fill to full and then do nothing, which is the one
  thing a gauge must never do.
- **One clock, drawn several times.** `resolveDahanAttack` swings every land on a single
  `round.dahanAttackRemaining`, so every bar on the board shows the same fraction and they are
  all full at the same instant. `patchLandMeters` computes it **once above its loop** rather
  than once per land per frame. There is no per-land timer and none was added.
- **Normalized against `roundDahanAttackInterval`**, never `DAHAN_ATTACK_INTERVAL_SECONDS`:
  `dahan_remember` halves the interval, and a bar measured against the base constant would top
  out near half-mast exactly for the player who paid 10000 Fear to make the strike matter. That
  function reads the round's frozen snapshot — the number `tick` itself divides by — so the bar
  cannot disagree with the clock it draws and a mid-round purchase does not re-scale a bar
  already moving. A round that is not running reads 0%.
- **It fills rather than drains**, opposite to the wave bar and matching the Blight bar beside
  it: health drains, an attack gathers. The wave bar is the invaders' and answers *how long do
  I still have*; this one is the player's and answers *how much have my people gathered*.
- **A third branch in `patchLandMeters`, ahead of the health-ring fallback.** That function had
  exactly two shapes — `blight` is a width and everything else falls through to the ring — so a
  third kind without its own branch would have been handed `--health-lost` and sat invisible at
  `opacity: 0`.
- **Subordinate by weight, not by count** (`app.css`). 3px against the Blight bar's 5px, a fixed
  track against Blight's full chip width, and in `--dahan-ink` rather than pressure red — and
  **out of `.chip-meters`**, where it would have split the width with Blight and produced the
  two equal bars that block's own comment forbids. The comment above `.chip-meters` was
  rewritten accordingly: one *threat* bar and rings, plus a lighter bar in the player's colour
  that is not a threat at all.
- **The last fifth lights up** (`STRIKE_IMMINENT_AT`, `.chip-strike.is-imminent`). A bar that
  states its fraction honestly still announces nothing, and the instant worth catching is the
  one a player watching the invaders misses. Fill, track and axe all light — hence the class on
  the group rather than on the fill, which CSS cannot reach up from. Pale gold, not red: red on
  a chip means Blight and wounds, and this is the good news. The threshold is a share of the
  clock rather than a count of seconds, so haste cannot stretch the shouting to half the cycle.
- **No engine change, no export, no state change** — every number already existed and was
  already exported (`round.dahanAttackRemaining`, `roundDahanAttackInterval`,
  `invaderCountInLand`). `03-state-contract.md` was checked and needs nothing. **No signature
  change either**: presence depends on the land's Dahan count and invader counts, and the
  board's signature already pushes both per land — verified in `mapSignature`, not assumed.
- Suite unmoved at 383 checks, which prove nothing about this either way. Driven by hand in
  headless Edge over `?vis`: the bar present on lands holding both, absent on a land with Dahan
  and no invaders and on a land with invaders and no Dahan, the patch writing 40% against the
  fixture's `dahanAttackRemaining`, and the row fitting land 4 — the narrowest chip — without
  wrapping.

### Task P5: Older save files keep working — *done*

Not a feature — a rule that already half-existed, given teeth and a test that can fail. The
game grew an export/import button, so save files leave the browser and sit on players' disks,
where no future change to this project can reach them. The engine's only compatibility
mechanism is `schemaVersion` and it is all-or-nothing: `migrateSave` returns the save untouched
on an exact match and **wipes the game** otherwise, carrying four preferences through and
nothing else. That puts the entire burden on normalization, which is where a new field is
easiest to get wrong — and until now nothing failed when it was.

- **`tests/fixtures/save-5.0.0-pre-autocast.js`** is a real save dumped out of the build at
  `ccbb135`, committed before any of the three features above landed so that it genuinely
  predates them. **Captured, not generated**: rebuilding it from `createFreshGameState` would
  make it agree with whatever the engine does today, which is the one thing a compatibility
  fixture must not do. Its header comment says so.
- **`tests/compat.test.js`**, nine checks, registered by hand in `tests.html` along with the
  fixture ahead of it. They assert *properties*, not a snapshot — a golden file would fail on
  every legitimate field addition and be re-blessed without being read. The load is not wiped;
  Fear, best wave, purchases and the round's frozen snapshot all survive; every `ui` field
  added since the file was written loads at its fresh default, asserted against
  `createInitialState()`'s own keys so the next field is covered the moment that function
  writes it; the five `ui.autoCast` toggles come back on; the save is **playable**, not merely
  loadable — it starts a round and resolves a wave, which a save loading into a shape `tick`
  throws on would not; and it survives export and re-import.
- **The ninth is the one that keeps the other eight honest**: a save from a genuinely older
  schema must still reset, and still name the version it came from. Compatibility is not "never
  reset" but "reset only when the shape really changed", and a suite proving only the first
  half would pass on an engine that had stopped resetting anything at all.
- **`03-state-contract.md`** gained the section the rule now lives in — `VERSION` does not move
  for an additive change because a bump is a wipe; a missing field defaults to what costs the
  player nothing; registry-keyed maps are rebuilt rather than merged. `README.md`'s conventions
  list and `05-progression.md` point at it rather than restating it. The canonical block still
  read `schemaVersion: "4.0.0"` against an engine at `5.0.0` and was corrected.
- Suite at 392 checks, up from 383. The mutation was checked rather than assumed: breaking the
  `autoCast` default assertion failed exactly one check, so the fixture really is being read.

---

## What To Build Next

Ordered by what most changes the game. The first item is the one that matters.

### 1. Balance: settle the casualty rate — *done, confirmed by playtest 2026-08-16*

`DAHAN_LOSS_PER_DAMAGE_SECOND` at `0.05 / TIME_SCALE` feels right: losing Dahan reads as
something the player can act against, not just weather. No further change.

### 2. Balance: are Dahan too strong once they survive? — *done, confirmed by playtest 2026-08-16*

The two brakes in `landPressure` (`BLIGHT_FLOOR_FRACTION = 0.25`, `DAHAN_CONCENTRATION_CAP =
2`) hold up under play. No further change.

### 3. Balance: the first Blight arrives on a wide spread

33 beats in one traced round, 74 in another, depending on whether the early Discover draws on
`3` and `8` — the two lands `roundStartDahan` leaves empty. The rates are not the variance;
the terrain draw is. Two players' first rounds can therefore read very differently, which is
the worst place for that to happen.

Partly addressed since: the opening Discover puts invaders ashore at second zero rather than
at wave 1, which removes the free first interval and the spread that came with it, and the
Blight floor means even a defended landing site contributes. Whether the remaining spread is
acceptable needs a fresh trace — the measured numbers in
[04-economy-formulas.md](../spec/04-economy-formulas.md#measured-behaviour) predate all of it.

### 4. Balance: the shop's first purchase

`dahan_reinforcement` costs 4 Fear against 1.05-1.75 earned per unattended round, so roughly
three rounds for the first tier. Whether that is the right pace depends on item 2 — a tier
that buys both defence and survival time may be worth more than three rounds even so.

### 5. A fifth ability, delivered through the Presence shop — *redirected 2026-08-16*

No longer just "one more `unlock_` row." The Presence shop is to grow two separate purchase
kinds:

- **Permanent unlocks** — same shape as the existing `unlock_<ability_id>` pattern, just
  bought with Presence instead of (or alongside) Fear.
- **Round-scoped ability cards** — bought with Presence, but what they buy is a card that can
  be *drawn* during a round and only lasts until the round ends, closer to how a hand of Power
  Cards works in the physical game. This is a new subsystem: a card pool, a draw trigger, a
  hand that resets every round, and however that hand interacts with the existing ability bar.

Permanent unlocks are the smaller lift — they reuse the shop and ability-bar plumbing that
already exists. The round-scoped card hand is the bigger, riskier piece: it needs its own
design pass (when does a draw happen, does it sit in the ability bar or somewhere new, what
happens to an undrawn/unplayed card at round end) before it's an implementation task rather
than an idea. Recommendation: build the permanent-unlock purchase first — it validates the
Presence shop taking a second purchase category at all — then design the card-hand subsystem
once that's landed, rather than starting both at once.

### 6. Invaders that scale with the player — *the next real feature*

Energy income is flat within a round while the kit's prices are not: the ladder tops out at
150 (cut from 250 - see item 9) and a round earns roughly 20-40, so a long round still has
little left to spend on but time. The intended answer is invaders that grow stronger as the
player does, which turns a long round into more income rather than only more waves. Nothing of
it is implemented.

Until it exists, the Innate's third tier stays a stretch goal and `blight_resilience` is the
only thing that reliably moves it — a progression gate by accident rather than design, even at
the lower price.

### 7. Keyboard shortcuts for the ability bar

Real-time and mouse-only is a bad combination. Digits 1-5 mapped to the bar, Escape to
cancel an armed ability. Small, and it changes how the round feels to play.

### 8. Make the click wiring a standing test

The arm / dim / illegal-click / legal-click / cancel path was verified end to end in a
headless browser, but as a throwaway probe. It should be a test file that builds the DOM it
needs, so a refactor of `ui.js` cannot break targeting silently. The per-land bars want the
same treatment: nothing currently asserts that they patch in place rather than rebuilding.

### 9. Price the Energy economy

**Answered, not tuned.** Energy has a writer (1 per point of defeated invader power) and five
readers: the unlock ladder at 5 / 10 / 20 and the Innate's tiers at 40 / 150 (cut from 50 / 250
- tier 3 was effectively unreachable against a round's income). It is also round-local now, so
every one of those prices has to be payable inside a single round.

None of it has been checked against a played round. The ladder is shaped against an estimate —
20 to 40 Energy over 60 to 120 beats — not a measurement, so "the three unlocks are about one
early round's income" is an assertion rather than a finding. Measure a round's actual income
first; item 6 will move the number before any of it can be called tuned.

Related and unmeasured: the kill-first damage rule made the Dahan strike meaningfully stronger
across every land at once, which moves income and round length together.

### 10. Accessibility pass

The board is focusable and activates on Enter and Space, but the ability bar has no live
region, the log is not announced, and the HUD's meters carry no text alternative beyond
their own numbers. Worth doing before the UI grows further.

### 11. Unspent Presence multiplies Fear generation — *done 2026-08-16*

Holding Presence now costs something to keep holding: +1% Fear from every source (kill, wave,
milestone) per point of `meta.presence` still unspent, read live and uncapped. See
[04-economy-formulas.md](../spec/04-economy-formulas.md#presence-multiplies-too-and-does-not-cap)
for the formula and [05-progression.md](../spec/05-progression.md#the-two-layers) for how it
sits against the "Presence never touches the board" framing. Shown in the ascension panel next
to the Presence total, only while it is nonzero.

This is deliberately uncapped, unlike the three Fear ladders it stacks with — the point is to
make *not* spending Presence a real, growing cost rather than a free stat. That only holds up
once there is something worth spending Presence on past the first cycle or two: today the
Presence shop is still just the two flat one-off unlocks (2 + 3 Presence, ever), so past that
every point of Presence a player earns has no in-system reason to be spent and the bonus only
grows. **Item 5's permanent-unlock Presence rows are now the balance fix, not just a feature
request** — build them before this compounds past a cycle or two of real play.

---

## Idea Inbox

Unsorted and unargued. One line each, written down before it is thought about — the point is
that catching an idea costs nothing. Nothing here is a commitment.

An idea leaves this list in one of two ways: it earns a paragraph and moves up into
[What To Build Next](#what-to-build-next) as a numbered item, or it stops being interesting
and gets deleted. It should never exist in both places at once — if it is numbered above, it
is not a line down here.

### Mechanics

- check if Wash Away works correctly when a land holds more than 3 invaders
- check if the Innate tier 1 push-rules automation should be reworked
- give tokens for casting abilities, spendable to upgrade them (or route that through the
  Presence shop instead)
- presence shop: buy an ability to lower a cooldown mid-round with Energy

### UI

- give the player better feedback: invader/Dahan deaths, end of round, Fear/Energy generated
- rework or toss the land info panel

### Balance questions

- Innate tiers 2 and 3 cut 50/250 -> 40/150; still unmeasured against a played round
- Wash Away: cooldown cut 35 -> 30 beats; still 20 Energy to unlock, unchanged
- general balancing pass

---

## Retired Foundation

These describe the turn-based prototype's build history, kept for provenance. Board geometry,
unit stats, and damage math (marked *reused*) carried forward into the round-based build;
presence, growth, and card-specific work (marked *retired*) did not. The code they describe
was deleted with `app.js`; it remains in git history.

### Task 01: Canonical State Model — *retired, superseded by Task R1*

- Was complete for the turn-based `2.0.0` shape: schema versioning, normalization,
  migration-safe defaults, local save structure.

### Task 02: Save and Load — *reused*

- localStorage save/load with no time-based or offline progress. The no-offline-catchup
  pattern carried forward to round time; see
  [04-economy-formulas.md](../spec/04-economy-formulas.md#offline-handling).

### Task 03: UI Shell and Four-Terrain Map — *reused (superseded layout, same board)*

- The eight-land board itself (Task 15) is what carried forward.

### Task 04: Starter River Cards — *retired, superseded by Task R6*

- Boon of Vigor, Flash Floods, River's Bounty and Wash Away carried forward by name only, as
  abilities with redesigned effects. The Innate Power, added later, has no card ancestor —
  it is the one entry in the kit that grows through tiers rather than being bought once.

### Task 05: Invader Phase Track — *partly reused; Ravage retired in Task C1*

- The Build/Discover rules and the terrain track reused directly; their trigger changed from
  a click to a timer in Task R2. The Ravage phase was removed entirely in Task C1.

### Task 06: Dahan Layer — *reused*

- Per-land Dahan counts carried forward. The setup distribution is now the spirit's fixed
  `roundStartDahan` map rather than a random spread, so a round setup can be asserted.

### Task 07: Targeting Locks — *retired*

- The turn-based growth-first / pending-effect lock model has no equivalent: nothing in a
  round blocks on player input.

### Task 08: Damage and Defeat Feedback — *reused*

- Unit HP model, partial damage carry, and fear-from-defeat all carried forward. The Fear
  *rate* changed; see Task R5.

### Task 09 / 09b / 09c: Presence, Power Gain, Essence — *retired*

- Presence placement and per-land Essence generation are gone. Essence's four terrain pools
  stay in the schema as inert placeholders; `essenceProgress` was dropped entirely.

### Task 10: Fear Threshold Effects — *superseded by Task R5*

- Superseded by Fear becoming the shop's currency outright, which is a stronger payoff than a
  threshold effect would have been.

### Task 11: Ravage Resolution — *retired by Task C1*

- The per-Ravage combat math survived Task R3 (only who assigned the counterattack changed)
  but not Task C1. Whole-point damage on a schedule has no successor: damage is a rate now,
  and the only thing carried over is how a damage pool is spent on invader types.

### Task 12: Automated Regression Harness — *superseded by Task R9*

### Task 13: Blight — *superseded by Task R4*

- The turn-based framing ("Blight slows Essence generation") is superseded: Blight is now the
  round's sole loss condition.

### Task 14: Presence Tracks — *retired*

- No equivalent in the round-based design; Task R7's permanent upgrade shop replaced it.

### Task 15: The Island Board — *reused*

- The eight-land board, adjacency, SVG rendering, and terrain colour rules all carried
  forward unchanged; see [09-island-board.md](../spec/09-island-board.md).
