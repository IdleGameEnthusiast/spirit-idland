# Spirit Idland Implementation Microtasks

This pack pivoted from a turn-based, presence-driven prototype to a round-based, real-time
survival loop (see [docs/spec/index.md](../spec/index.md)). **That pivot is done.** The
turn-based `app.js` is deleted; the build is `engine/` (rules, no DOM) plus `ui.js` (DOM,
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
- The targeting rules and tie-breaks the one-click model forced are documented in
  [04-economy-formulas.md](../spec/04-economy-formulas.md#ability-formulas).
- Covered by `tests/ability.test.js`. **The numbers are still placeholder.**

### Task R7: Upgrade Shop — *done*

- Three repeatable upgrades with a `1.6^tier` cost curve, applied at round setup, surviving
  any number of further rounds. Starting the next round is never blocked.
- `unlock_<ability_id>` machinery works but has nothing to unlock yet.
- Covered by `tests/shop.test.js` and `tests/setup.test.js`.

### Task R8: UI Retrofit — *done*

- Presence tracks, growth options, card hand and the Essence rail are gone from the markup,
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

- **`AUTO_CAST_UPGRADES`** (`engine/abilities.js`) is the only place the two id spaces are tied together:
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
than an idea.

**The card half of this is answered — see item 14 and
[10-power-cards.md](../spec/10-power-cards.md).** All three questions have answers now: a draw
happens on a wave schedule (first at 25, then every 20), the card sits in the existing ability
bar rather than anywhere new, and a card in hand simply dies with the round like the Energy
that would have bought an unlock. One assumption in the paragraph above did **not** survive the
design pass — a card is not bought with Presence *and then* re-earned each round, it is bought
once and kept forever; what a round earns is the right to *hold* it. The permanent-unlock half of
this item is still unbuilt and still the smaller lift.

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
once there is something worth spending Presence on past the first cycle or two.

Item 13's discount ladders are the sink that was missing — 1,795 Presence of catalogue where
there used to be 10. What they did **not** do is give spending a way to *beat* holding: a fixed
Fear discount cannot outrun an uncapped multiplier, and item 13 says so at length. So the
balance concern here is softened rather than closed. The row that would actually close it pays
in something scaling, and is still not designed.

### 12. Focus: spend Energy to shorten ability cooldowns mid-round — *built 2026-08-16*

From the Idea Inbox: "presence shop: buy an ability to lower a cooldown mid-round with Energy."
Landed as designed below. Covered by `tests/focus.test.js`; `tests/ascension.test.js` updated
for the third Presence row. Not yet run against a live playtest - the numbers below are a
first pass, not a measurement.

**What it is:** a per-ability, per-round purchase — "Focus" — that shortens one ability's
cooldown for the rest of the round, paid for out of the same Energy that buys unlocks and tier
upgrades. This is deliberately not the same mechanism as `cooldownReductionPct` /
`abilityCooldownMult` (`upgradeTotals` in `engine/upgrades.js`) — that stub is for a *permanent*,
Fear/Presence-bought, round-wide multiplier, frozen at round start (see the comment at
the round snapshot in `engine/round.js`). Focus is a *live*, mid-round, per-ability spend,
closer in shape to `upgradeAbility` (tier purchases, `engine/abilities.js`) than to the shop. Both can coexist later;
only Focus is designed here.

**Gate:** a new Presence-shop row, cost 5 Presence, flat, one-off. Unlike the two existing rows
(`presence_tide_returns`, `presence_river_knows`), it does not unlock a Fear-shop entry — it
flips `state.presenceUpgrades.purchased[id]` directly, and Focus purchases check that flag.
This is the first Presence row to touch the board rather than gate a Fear row, so the "Presence
never touches the board" framing above `PRESENCE_UPGRADES` in `engine/content.js` needs a
one-line update when this lands.

**Effect, per purchase, per ability:**

- Multiplies that ability's cooldown by a rate chosen from how much of the round-frozen
  baseline (`abilityCooldownSeconds` before Focus) remains:
  - above 70% remaining: ×0.95 (a 5% cut)
  - 70% down to 50% remaining: ×0.97
  - 50% down to the 30% floor: ×0.98
- Hard floor at 30% of the original cooldown (70% max reduction) — stronger than
  `dahan_remember`'s own 50% cap (`dahanHasteFraction` in `engine/upgrades.js`), confirmed
  intentional. Purchases past
  the floor are refused, same as `abilityUpgradeCost` at max tier.
- Reads the zone off the *current* multiplier before each purchase (same "read live" idiom as
  `DIFFICULTY_RUNGS`), so a purchase can overshoot slightly into the next zone rather than
  needing partial steps.
- Applies to every unlocked ability, Innate included — no special-casing needed, since
  `abilityRecord` already resolves the tiered case.

**Cost, per ability:** `(abilityUnlockCost(ability) || focusBaseCost || 3) * 1.5^purchasesSoFar`
Energy. Both `innate_power` and `boon_of_vigor` carry `unlockCost: 0`, but only
`boon_of_vigor` falls through to the flat `3`: the Innate keeps growing stronger after it is
bought (three tiers, each a bigger swing than the last), so its own `focusBaseCost: 25` keeps
Focus from being the cheap way into its strongest cooldown. The 1.5x growth is deliberately
gentler than the Fear shop's `UPGRADE_COST_GROWTH` (1.6x), since this is a same-round repeatable
rather than a permanent tier.

**Resets:** purchase count and multiplier both live in `state.round` and clear on
`startRound()`, same as Energy itself and `abilityTiers`.

**Why no wave-number scaling:** considered and dropped. Energy is round-scoped and earned from
kills, so the compounding per-purchase cost is already wave-gated in practice — a player can't
afford many Focus purchases before waves have produced the Energy for them, without a second
wave-indexed formula stacked on top. The hard 30% floor is the actual safety valve against
idle-game exponential Energy income, not a wave gate.

### 13. Presence discount ladders for the seven automations — *built 2026-08-18, **deleted 2026-08-19** — see item 17*

Seven repeatable Presence rows, one per automation, walking its Fear price down a shared ladder
**500 · 400 · 300 · 200 · 100 · 50 · 25 · 10**. Rungs cost **5 · 10 · 25 · 50 · 100 · 250 ·
500** Presence by how many have been taken; a row's rung count is read off where its automation
already sits, so the whole set is 1,795 Presence. **Reworked 2026-08-19** — see the amendment
at the end of this item. Full design in
[05-progression.md](../spec/05-progression.md#the-discount-ladders) and
[04-economy-formulas.md](../spec/04-economy-formulas.md#the-automation-discount-ladders); the
registry table is in
[07-content-registry.md](../spec/07-content-registry.md#the-rows-that-lower-a-price). Covered by
six new checks in `tests/ascension.test.js`.

This is the "automation discount" that item 5 and the *What Is Not Yet Progression* list had
been asking for, and it is the first repeatable Presence row of any kind. It answers the sink
problem directly: before it the entire Presence catalogue cost 10 points and everything a
player earned past that had nowhere to go.

**What it does not answer, and this is on the record deliberately:** it does not give spending
Presence a way to beat *holding* it. The hold bonus is +1% Fear generated per point, uncapped
and multiplicative; a discount saves a fixed number of Fear per cycle. Spending `P` to save `S`
wins only while `cycleFearGenerated < 100 * S / P`, which for the deepest rung is a cycle
generating under 3 Fear — while affording that rung implies cycles generating millions. So the
early rungs are a good buy and the late ones are a sink, by construction rather than by
accident. A row that genuinely competes with holding has to pay in something that *scales* — a
multiplier, or a permanence that removes the per-cycle Fear price entirely rather than lowering
it. That row is still not designed, and it is the honest successor to this item.

**Why the floor is 10 Fear and not 0:** a row still owed something is still re-bought every
cycle, so the automations stay purchases a cycle makes rather than switches a save carries. It
keeps the "play this cycle actively, or pay to idle it" trade intact at the bottom of every
ladder — what a fully-discounted run buys is that the toll stops being a *decision*, not that it
disappears.

**Amendment, 2026-08-19 — one ladder became two, and the set got much cheaper to finish.** The
single 500…10 descent made the top two rows far too long: `auto_start_round` owed seven rungs
and `auto_wash_away` six, and their last rungs were priced past the point where the Fear they
save is legible. There are now two ladders sharing a tail from 200 Fear down —
**500 · 300 · 200 · 100 · 50 · 25 · 10** and **400 · 200 · 100 · 50 · 25 · 10** — so each top
row skips a rung on its first step and finishes one rung sooner. `PRESENCE_DISCOUNT_COSTS` was
cut **at the end** to match (**5 · 10 · 25 · 50 · 100 · 250**), which means a shortened row
loses its *most expensive* rung: 940 → 440 and 440 → 190, and the whole set 1,795 → **1,045**.
Everything at 300 Fear and below is untouched, because below 300 the two ladders are the same
list.

Two things knowingly traded away, both recorded in
[04-economy-formulas.md](../spec/04-economy-formulas.md#the-automation-discount-ladders): rows of
similar length now tie on total (`auto_wash_away` and `auto_flash_floods` both finish at 190
while saving 390 and 290 Fear a cycle), which is unavoidable while rung counts are integers and
the cost list is positional and harmless while a run buys all seven anyway; and the late sink is
much smaller, with the power card draws of item 14 now carrying more of it than these do. The
option of also trimming the 300 row to 90 was considered and dropped — it would have made that
row the *best* value in the set, moving the same tie one step down rather than removing it.

### 14. Power cards — *designed and built 2026-08-18*

**Read [10-power-cards.md](../spec/10-power-cards.md) first.** It is the design and the source of
every number below; this item is the build order and the notes an implementer needed that a spec
should not carry. All ten tasks landed together, covered by `tests/cards.test.js` and
`tests/defense.test.js`. **Every number in it is still a first pass and none has been played
against** — see the flagged guesses below, which is the part of this item that is still live.

Three parts in one feature: cards bought with **Presence** (three offered, one kept, on a 1.6
ladder), handed to a round by **depth** (first at wave 25, then every 20), and cast like
abilities. They bring two new mechanics with them — **Defense**, and **Blight that can fall** —
and one new Fear row that shortens the drip.

#### Decisions already made — do not re-open these while building

- **Presence buys the board now.** "Presence never touches the board" is retired and replaced by
  *Presence buys possibility, the round buys the moment*. The drip is what justifies it. See
  [05-progression.md](../spec/05-progression.md#the-line-that-replaced-it).
- **Blight can fall.** The surviving invariant is only that the round ends in the tick the
  threshold is reached, so removal is preventive and never a rescue.
- **A card is an ability.** Reuse `state.abilities`, `pendingAbilityTarget`, `tickCooldowns`,
  `triggerAbility`, `resolveAbilityTarget`, Focus. Do not build a parallel runtime.
- **Cooldowns are authored in beats**, `beats * TIME_SCALE`, like everything else.
- **The draw offer is stored state**, not a render-time roll. A reload must not re-roll it.
- **Nothing waits for input.** The re-draw is a button on an already-castable card, and casting
  is accepting. No modal, no pause, no timer.
- **Defense: no cap, expires one wave interval after first use, any use spends the whole pool,
  total denial is measured against Defense alone and ignores `BLIGHT_FLOOR_FRACTION`.**
- **No auto-cast for cards, at any price.**

#### Numbers that are guesses, flagged as such

Every figure in the design is a first pass and none has been played. The ones most likely to
move, in order: the seven cards' Fear values (the four Fear-paying cards roughly quadruple a
round's income); the Blight-removal cooldowns (the hand cancels something like half the island's
peak Blight output, so round length may roughly double); `power_card_interval`'s ladder, whose
rungs are lumpy by construction; and the flat 10/20/30 Energy re-draw fee, which goes stale by
the round's third draw on purpose. Measure before re-tuning — `docs/spec/index.md` records that
nothing about round depth or cycle income has been measured yet either.

#### Where it lands

- `engine/` — a `POWER_CARDS` registry beside `ABILITIES`; an effect-step resolver; Defense in
  `landPressure` / `resolveLandCombat`; Blight removal; the draw and the drip; one Fear row in
  `UPGRADES`; one Presence row shape that is a draw rather than an upgrade; normalization.
- `ui.js` — cards in the ability bar, the re-draw button, Tsunami's switch, the draw shop panel,
  Defense on the board and in the pressure chip.
- `tests/` — new `cards.test.js` and `defense.test.js`, registered in `tests.html` and
  `tests/harness.js` the same way the existing suites are. `setRng` is what makes the draw
  testable; use it rather than asserting on distributions.

#### Build order — *all ten landed together*

Ten tasks, written to land one at a time with the two risky mechanics alone in their own steps.
They were built in one pass instead, which is worth naming honestly: T4 and T7 were meant to be
measured on their own before the rest arrived on top of them, and they were not. The measuring
still has to happen — see the flagged guesses above — it just has more moving at once now.

The task list is left below as written, because it is still the map of where each piece lives.

**T1 — The card framework, and one card.**
`POWER_CARDS` registry with `pull_beneath` only. The effect-step resolver (`fear_flat` and
`damage` kinds, plus the `terrain:` condition). `round.cards` state, `startRound` clearing it,
normalization. The drip: `resolveWave` checks `wavesResolved` against `round.cards.nextDrawWave`,
draws from `powerCards.owned`, adds a `state.abilities` slot at cooldown 0, advances
`nextDrawWave`. `unlockedAbilityIds` gains `round.cards.handIds`. Cards render in the bar.
No shop yet — grant a card through a test hook or the playtest bar.
*Done when:* a granted card arrives at wave 25, casts on a land click, cools down, and dies with
the round.

**T2 — The Presence draw.**
The draw row, `powerCardDrawCost` / `powerCardRerollCost`, the stored offer, the choose-one flow,
and the re-roll with its two-new-cards guarantee and its disabled state at three or fewer
unowned. `ascend` keeps `powerCards.owned`. This is where a card first becomes ownable in a real
game.
*Done when:* an offer survives a save/load round-trip unchanged, a paid re-roll returns at least
two cards the previous offer did not hold, and a re-roll is refused with three unowned.

**T3 — The re-draw on arrival.**
The Energy fee, the narrowing pool (neither in hand nor already rejected this draw), the button
on the card, and the rule that the first cast removes it.
*Done when:* there is no click order that casts a card and then swaps it.

**T4 — Blight removal, and `accelerated_rot`.**
The `remove_blight` step, both targeting rules (clicked land if it has Blight; most-blighted land
for an untargeted card), and the invariant that `blight` and `blightByLand` fall together while
`blightProgress` does not. Land this **alone** — it is the change most likely to move round
length, and it wants measuring before three more cards do the same thing.
*Done when:* a round's Blight can fall, and a removal in the tick the threshold is reached does
not save the round.

**T5 — `uncanny_melting`.** Adds `fear_per_invader` and the independent-clauses case.

**T6 — `song_of_sanctity`.** Adds `destroy_units` (through `creditDefeat`, so it pays Fear and
Energy) and `push_all` (the shared push rule with no count cap), plus the `else` condition.

**T7 — Defense, and `natures_resilience`.**
`round.defense` and `round.defenseExpiry`, the `defend` step, the reduction and the total-denial
case in `landPressure`, the expiry driven off `round.elapsedSeconds`, the whole-pool spend, and
the push-destination reranking. The second risky mechanic, alone in its own step for the same
reason T4 was.
*Done when:* a ward denies a land completely at or above its gross, reduces it below that, waits
indefinitely on a quiet land, and lapses exactly one wave interval after the first tick in which
it did anything.

**T8 — `encompassing_ward`.** Adds `scope: "all"`. Needs T7 settled first.

**T9 — `tsunami`.** Adds `destroy_dahan` (pays nothing; must reset `dahanProgress` when it
empties a land), coastal-only targeting, the secondary-lands pass in ascending land id, and
`ui.cardOptions.tsunami` as a sliding switch on the card.

**T10 — `power_card_interval`.** The Fear row. Reads through the round's upgrade snapshot like
every other tier, so buying it mid-round pays off next round.

#### The trap worth naming — *avoided*

Defense expiring at the **next wave boundary** rather than one interval after first use makes the
cast time against the visible wave clock decide whether a ward is worth twenty seconds or one.
That was the first draft and it was rejected: it is a rule a HUD countdown teaches good players to
exploit and never teaches anyone else at all. The deadline is stored in
`round.defenseExpiry[land]` off `elapsedSeconds` as planned, and the speed dial and the wave gate
did indeed need no special case.

#### Three things the build changed about the design

Each is a correction to [10-power-cards.md](../spec/10-power-cards.md), and each is now written
into it.

- **The Dahan-loss formula under Defense.** The design's pseudocode divided the attack by the
  survivors against a `DAHAN_CONCENTRATION_CAP` — the *concentrated* rate that
  [02](../spec/02-core-loop.md#the-fight) replaced with a flat one long before this feature was
  written. Defense reads `effective` in place of `gross` in whichever rate is live, and adds
  nothing of its own.
- **`terrain:desert,wetlands` needed splitting.** `terrainList` takes a list, and handing it the
  whole comma-joined string matched nothing and failed *silently* — the Desert bonus simply never
  fired. `conditionTerrains` splits it. Worth knowing because nothing about the failure was
  visible: the card cast, paid, and quietly skipped its second clause.
- **The offer rolls on first look, not at setup.** Rolling it in `createFreshGameState` costs an
  RNG draw, which shifts every roll the island makes after it — a given seed would land on a
  different board purely because power cards exist, and one existing test noticed. It is rolled
  the first time it is read instead, and the boot path in `ui.js` reads and **saves** it, which
  is what keeps a reload from being a free re-roll.

---

### 15. The Innate's auto-cast: rung lists reworked — *built 2026-08-19*

The complaint that started it: the auto-cast often did nothing when there were obviously good
options. The diagnosis was narrower than the symptom. Tier 3 has never idled — its
toughest-thing-standing floor fires whenever any invader is anywhere — and tier 2 falls through
to a Blight rung that is almost always satisfied. **Only tier 1 idles**, and it does so on a full
island, because two of its three rungs demanded open ground and the third demanded a coastal
neighbour that lands 7 and 8 do not have.

Six changes, and the cooldowns move with them to **8 / 15 / 22** beats (was 8/16/24).

- **Two shared top rungs.** *Deny a Discover* and *break a Build* are the only things in the kit
  that stop invaders arriving rather than rearranging ones already ashore, so every tier opens
  with both. Both are asked by simulating that tier's own cast, so one question serves three
  answers. The deny rung is new and reads `landAcceptsExplorer`: below wave 10 an inland land
  takes Explorers only while a neighbour holds a Town or City, so removing that Town cancels a
  whole seeding. It insists the set of gated lands *shrink*, because shoving the Town sideways
  can close one Discover land and open another.
- **Break-a-Build now checks the clock.** The strike and the wave run on independent timers, so
  "the Dahan would clear this land" was excusing casts on lands the Build reached first.
- **Route-to-cover means lethal cover.** It simulates the arrival *and* the destination's strike
  instead of asking whether any Dahan stands there, which had it sending Towns to lands holding
  one Dahan that could not kill them.
- **Consolidate onto more Dahan** replaces the retired protect-the-thin-stack rung at tier 1. It
  needs *strictly* more Dahan at the destination, which is monotone and so cannot ping-pong —
  the objection that killed the old version.
- **Stacking is allowed onto Explorers.** The open-ground gate was what silenced tier 1 exactly
  when the island was fullest. Another Explorer on a pile of Explorers does not change what Build
  raises there; a Town landing beside one turns that Build into a City, which is what
  `pushWorsensBuild` refuses. `pushDestinations` ranks cover, then Dahan count, then avoiding the
  Build track, then open ground, then the coast.
- **Blight replaces the lowest-id tie-break** inside every rung. Three lands can satisfy a rung;
  the smallest id says nothing about which is costing the round.

Tier 2 additionally gains *clear the land outright* above routing — certain where routing is a
bet — and gates its Blight fallback on the cast changing the land, so it stops scratching a land
holding only Cities. Tier 3 alone puts break-a-Build *above* the deny: with no push it pays for a
deny with its whole area hit, to stop a seeding of the weakest unit on the board. Its two middle
rungs, which counted bodies present and ranked Blight without checking that anything died, are
replaced by one measure — the Blight the kills actually remove.

#### What the build changed about the design

- **Build-avoidance cannot outrank cover.** Ranking it first made where the water runs depend on
  the invader track, which broke the promise that a push is plannable off the board alone, and
  made several push tests depend on a random draw they never meant to test. It sits below the
  cover terms, where it still closes the trap it exists for: the undefended-open-ground case,
  where every candidate ties and the old rule cheerfully picked the empty Build-terrain land.
- **A rung that kills its target need not avoid the Build.** Route-to-cover asks only the
  stacking half of the rule (`pushStacksSafely`), because what Build would raise on top of a unit
  that will not be standing there is not a cost the push pays.
- **Wash Away had to move with it.** Its rungs asked `pushHasOpenGround` — "is there open ground
  next to this land" — as a proxy for "will this push land on open ground". That was the same
  question only while open ground beat every other destination outright, so they now ask
  `pushLandsOnOpenGround` of the destination itself. Wash Away keeps the stricter rule
  deliberately: it moves a whole land at once, so a stack it concentrates is a much bigger one.

### 16. A Presence row that makes early Presence cheaper — *designed 2026-08-19, not built*

A hundred-tier repeatable Presence row, 1 Presence a tier, meant to be **strong while the
player is poor and to fade on its own as they get rich**. The design question was which shape
delivers that, and the answer is not the obvious one.

**The shape: a flat Fear credit, inside the root.**

```txt
credit = tier * 200                                    (20,000 at tier 100)
payout = floor( sqrt( (cycleFearGenerated + credit) / PRESENCE_FEAR_DIVISOR ) )
```

Read to the player as *every cycle begins as though you had already generated 20,000 Fear* —
which is also why it fades: 20,000 is a fortune against a 2,500-Fear cycle and a rounding
error against a million.

**Why not the two shapes that were tried first.** Both were discarded on arithmetic, and the
arithmetic is the whole content of this item:

| cycle pays | divisor x0.5 | **credit 20,000** | -2 Fear per Presence |
|---|---|---|---|
| 5 | 7 (+2) | **15 (+10)** | 6 (+1) |
| 10 | 14 (+4) | **17 (+7)** | 11 (+1) |
| 25 | 35 (+10) | **28 (+3)** | 26 (+1) |
| 50 | 70 (+20) | **51 (+1)** | 51 (+1) |
| 100 | 141 (+41) | **100 (+0)** | 101 (+1) |

- **Cutting `PRESENCE_FEAR_DIVISOR` cannot fade.** The payout is a square root, so scaling the
  divisor by `f` scales the payout by `1/sqrt(f)` at *every* cycle size - a flat x1.41 at half
  the divisor, which in absolute Presence means +2 early and +41 late. Exactly backwards, and
  no reshaping of the tier curve fixes it: the tier curve only controls the walk to an endpoint
  that is a flat multiplier by construction. It is also barely worth buying early - against
  `PRESENCE_FEAR_BONUS_PER_POINT`, converting a held point into a tier is a *loss* until the
  player holds about 100 Presence.
- **A discount priced per Presence earned cannot fade either.** "x Fear less per Presence" pays
  a constant `x/200` Presence at every scale. At the 2-Fear-a-tier figure it first suggested,
  that is +1 Presence forever for 100 Presence spent - a hundred cycles to repay.
- **A flat credit fades because the root crushes it:** gain is about `credit / (200 * payout)`,
  inversely proportional to how strong the player already is.

**The constant falls out of the target.** `credit = 200 * target_payout * gain_still_wanted`.
"Still worth +2 Presence at a payout of 50" gives 20,000, hence 200 Fear a tier over 100 tiers.

**Flat 1 Presence a tier is right here, and needs no cost ramp.** One more tier is worth
`1/payout` Presence a cycle - 0.2 at payout 5, so five cycles to repay; 0.02 at payout 50, so
never. The row prices *itself* out of relevance, which is the behaviour the rising
`PRESENCE_DISCOUNT_COSTS` ladder has to buy with money.

**The one guard, and it is not optional.** At a full credit the payout reads 14 at *zero* Fear,
and `ascensionUnlocked` reads the payout - so a fresh cycle already clears the 5-Presence gate
and Reclaim can be spammed for 14 Presence apiece, forever. **The gate must read the uncredited
payout while the payout reads the credited one.** Two functions, two numbers, deliberately: it
will look like a bug to whoever reads it next, so it has to be documented where it lands.

**Known risk, to watch rather than pre-solve.** The credit is a flat +10 on any cycle that
clears the gate, and the root already favours short cycles by design (see the note above
`PRESENCE_FEAR_DIVISOR` in `engine/constants.js`). If 2,500 Fear turns out to be a two-round errand, the
optimal play becomes gate-and-dump. Two answers if a playtest shows it: raise
`ASCENSION_UNLOCK_PRESENCE`, or clamp `credit = min(tier * 200, cycleFearGenerated)` so it can
at most double a cycle - which caps the row at +41% and costs it much of the early strength it
exists for. Ship without the clamp and watch.

Also moves with it: `fearToNextPresence` becomes `(payout + 1)^2 * PRESENCE_FEAR_DIVISOR -
credit - generated`, or the HUD overstates every gap by the credit. Nothing here has been
played - the numbers are a first pass like the rest of the layer.

---

### 17. Automations become permanent Presence grants — *built 2026-08-19*

Deletes item 13 outright and changes what a Presence purchase *is*. A Presence row no longer
opens a Fear row or marks one down: it **hands the automation over permanently**, on the far
side of every future Reclaim.

```txt
presence_tide_returns      2   grants auto_start_round                  (retires 500 Fear a cycle)
presence_river_knows       3   grants auto_buy_abilities                (retires 200)
presence_all_unbidden      5   grants the five ability auto-casts       (retires 1,025)
                          --
                          10   every automation in the game, forever
```

**Why item 13 had to go, in one line of arithmetic.** Walking all seven discount ladders to the
bottom cost **515 Presence** to save **975 Fear a cycle**. Holding those same 515 Presence is
**+515% Fear generated**, uncapped, forever. Break-even is a cycle generating **189 Fear** —
and `ASCENSION_UNLOCK_PRESENCE` forbids a Reclaim until the cycle has generated **2,500**. The
rows lost to doing nothing by 13× at the earliest moment they could be bought and by more every
cycle after: not a weak rung, a strictly dominated one, and seven rows of the Presence catalogue
that were never correct to buy. Item 13's own spec text admitted the trade and argued the rows
were an endgame sink worth having anyway; a sink nobody should ever buy is not a sink.

A grant clears the same bar the discount could not, and it is the shape
[04-economy-formulas.md](../spec/04-economy-formulas.md#what-a-grant-is-worth-against-holding-presence)
had already named as the only one that can: *a multiplier, or a permanence*. The discount was a
fixed Fear amount. A grant is the permanence.

**What else came out with it.** The `presenceUnlock` gate that made `auto_start_round` and
`auto_buy_abilities` unreachable without an ascension — and then charged their Fear again every
cycle after — is deleted too, because a row that a Presence purchase now *buys* has nothing left
to be locked behind. **No row in the Fear catalogue is locked any more**, so a first cycle that
saves 700 Fear can idle itself without ever ascending; what ascending buys is not having to do
it again. Gone with them: `AUTOMATION_PRICE_LADDERS`, `PRESENCE_DISCOUNT_COSTS`,
`automationLadder`, `automationPriceAtTier`, `PRESENCE_DISCOUNT_BY_UPGRADE`,
`upgradeNeedsPresence`, `upgradePresenceUnlock`, `presenceUpgradeStatusText`, the `discounts`
and `presenceUnlock` fields, the `upgradeLocked` / `presenceDiscounted` / `presenceMaxed`
strings and the ladder half of `presenceUpgradeText`.

**The mechanism is one branch in `upgradeTier`.** A row named by a Presence row's `grants` reads
as owned whatever `upgrades.purchased` says, so the grant is total for free: the shop shows it
sold out, `purchaseUpgrade` refuses it as maxed, `snapshotUpgradeTiers` carries it into the
round, and every auto-cast already reads through `activeUpgradeTier`. `rebuildSpentFear`
deliberately walks the saved object instead, so a granted row is never billed as Fear spent.

**Saves are paid back for item 13.** `normalizeState` drops the seven dead ids like any unknown
row, then prices their rungs at what they cost and returns the Presence — up to 515 of it,
against a replacement catalogue costing 10. Idempotent: paid on the load that drops the rows and
never again.

**The open number, deliberately left as asked for.** The two dearest automations in the Fear
shop (500 and 200) are the two cheapest in Presence, so the first Reclaim's ~5 Presence ends the
hand-played round loop outright and `presence_all_unbidden` waits for the second. Staging it the
other way round — first ascension smooths the round, second stops needing a hand on it — wants
roughly **5 / 8 / 15** in place of 2 / 3 / 5. Nothing here has been played; it is a three-number
edit when a cycle says which reads better.

### 18. The Innate's Focus: a ladder per tier, and the investment carries — *built 2026-08-20*

From the Balance questions below: "`innate_power` (one floor per tier, and its flat
`focusBaseCost: 25` anchor wants revisiting tier by tier)." Both halves landed, plus a third
that fell out of doing them properly. Covered by `tests/focus.test.js`.

**A ladder per tier.** One anchor cannot be right for three cooldowns — the same beat off the
clock is 12.5% of tier 1's throughput and 4.5% of tier 3's, and a flat 25 made tier 1's opening
rung the worst purchase in the game while making tier 3's the cheapest per point of throughput.
`abilityFocusBaseCost` and `abilityFocusCostGrowth` now read `abilityRecord` rather than the raw
catalogue entry, which is all the plumbing a per-tier ladder needs: a tier already replaces the
record wholesale. Tiers name 3 / 1.5, 8 / 1.5 and 25 / 1.25, and each names its own floor (3, 5,
8 — the derived third of its own cooldown, written out so a later cooldown change cannot move a
floor by accident). Tables in
[04-economy-formulas.md](../spec/04-economy-formulas.md#the-innates-three-ladders).

**The investment carries across an upgrade.** The round used to store a rung *count*, which made
a tier change either a windfall (five rungs of tier 1 became five much dearer rungs of tier 2,
free) or — had it been clamped — a confiscation. It now stores the **Energy invested**, and the
rung count is read back off it against whatever ladder is in front of it. Buying tier 1's whole
ladder (40) and then tier 2 grants three of tier 2's rungs outright and quotes its fourth at 25
instead of 27, the 2 left over credited against it. Nothing is lost, nothing is refunded, and
the arithmetic needs no special case in `upgradeAbility` at all — it is the same number read
twice. `round.abilityFocus` became `round.abilityFocusEnergy`; old saves are migrated by pricing
their counted rungs on the ladder their own tier puts in front of them.

**One number worth keeping:** tier 1's whole Focus ladder costs 40, which is exactly tier 2's
`upgradeCost`. The round's first real question about the Innate — run this one faster, or make
it something bigger — is asked at one price.

**And the pill is open at tier 1 again.** `abilityFocusMarkup` in `ui.js` used to hide it until
tier 2 was bought, on the reasoning that tier 1's cooldown is one players are about to outgrow.
The carry is exactly what makes that no longer true — a beat bought at tier 1 is credited into
tier 2's ladder — so the gate went with the change that killed its reason. Every unlocked
ability now shows a Focus pill on the same rule.

### 19. Auto-buy spends the leftovers on Focus, and gets a control panel — *built 2026-08-20*

From the Idea Inbox: "the upgrade to `presence_river_knows` needs its own row — auto-buy that
spends Energy on Focus, customizable." Landed close to as designed, with three things argued out
during the design pass and one changed after it. Covered by `tests/autobuy.test.js` (38 checks);
`tests/ascension.test.js`'s structural row check was rewritten to suit.

**A fifth Presence row, `presence_river_deepens` (5), granting nothing.** It opens auto-buy's top
rung, the way `presence_current_quickens` opens Focus, and `autoBuyFocusUnlocked` reads it
directly. Its gate is its depth — it wants both of the rows it sits between, so it is 13 Presence
deep and a third-Reclaim purchase — rather than its price.

**It is not the comfort layer the row it extends is, and the doc says so.** `auto_buy_abilities`
is defended at 200 Fear on the grounds that it spends Energy the round was going to spend
anyway. That defence fails here: Energy does not survive a round, so once the unlocks and the
tiers are bought, everything earned afterwards burns at the round's end. This row is the first
thing that converts that residue into throughput, and the Focus ladders are deep enough to
absorb any purse. **It buys power, not clicks** — which is also why "spend everything" is never
the wrong policy and the settings are about *order*, never about whether to hold.

**One cumulative dial, not a preset picker.** The design started as "buy all unlocks first, then
best focus rate" versus two alternative presets. What shipped is a four-rung ladder — `off`,
`unlocks`, `+ tiers`, `+ focus` — each rung including the ones above it, in the order the
resolver actually spends. "Spend nothing" and "unlocks only", asked for late, are simply its
bottom two rungs rather than controls of their own: a master switch plus a scope switch plus a
preset picker is three controls describing one decision, and three controls can disagree.
"Cheapest focus rung always" survived as one of two orders; "always cheapest overall" was cut,
because buying a 3-Energy Focus rung ahead of a 5-Energy unlock starves three automations the
player has already paid for.

**"Best focus rate" is not a percentage of cooldown.** That framing is exactly the one the
subtractive ladder rework threw out (item 18): under it the tail of every ladder reads as
worthless, when the tail is where a rung buys the most. `abilityFocusValuePerEnergy` ranks by
casts-per-beat gained per Energy, weighted by what one cast of that ability is worth — and that
weight is **recovered from the catalogue rather than tabled again**, by inverting the anchor rule
`anchor = worth * 100 / cooldownBeats` that the balance pass already priced every ladder by.
There is one statement in the game of what a cast is worth, and both readers of it agree by
construction. Which ability this puts first is a reading of the tuned ladders, so the test
asserts the argmax property rather than naming a winner.

**The Innate cap changes behaviour players already own**, so it defaults to the ladder's top and
binds `resolveAutoBuyAbilities` alone — the tier button on the card ignores it. Its reason is the
early cycle: a round that cannot reach tier 3 should not bank toward it while the Focus ladders
sit unbought.

**The reserve, added after review — and the bug it fixes was in the first cut.** Focus running
last in the tick reads like enough to keep it from starving the rungs above it. It is not, and
the reason is that a round is fed a few Energy at a time rather than in lumps: with no ceiling
and a floor price of 3, Focus held the purse between 0 and 2 for the whole round, so 5 / 10 / 20
and 40 / 150 were never once on the table. Ordering fixes what happens *inside* a tick; only a
reserve fixes what happens *across* them. Focus now spends down to **the cheapest thing auto-buy
still intends to buy that is not Focus**, and no further.

That is also what turns the Innate cap from a label into a decision: the cap is how much the
player is willing to have banked before the clock gets anything. At 3 the round saves toward 150
and Focus waits; at 1 nothing is saved toward and the first spare 3 Energy buys a beat. The
regression tests feed a round 2 Energy a tick — deliberately under the cheapest rung — because
that is the only shape of income that shows the failure at all.

**Automated Focus purchases are silent, and unlocks and tiers still log.** Not "automation is
quiet" — the rule is that bounded events log and repeating ones do not. A round buys three
unlocks and two tiers and then stops; Focus is bought again every time the purse refills, and at
a rung a second in a long round the log would hold nothing else.

**The sheet, and the one thing that changed after the design pass.** "Customize" sits in the
Energy purse and unfolds a drawer above the ability bar. It pushes the bar down the page, which
is harmless while it is being read and a misclick waiting to happen once waves are running — the
first answer was to allow opening it only between rounds, and the better one, taken instead, is
that **`startRound` folds it away**. So it may be opened at any time and simply cannot survive
into play. That collapse is in the engine rather than `ui.js` because `auto_start_round` begins
rounds that no click ever touches.

Four more ways out: the button again (it stays visibly pressed), **Done** at the foot, **Esc**,
and clicking away — the last bound to `click` and *not* `pointerdown`, because closing on
pointerdown shifts the layout between press and release and dispatches the click to whatever slid
into place, which is the very misclick the round's collapse exists to prevent.

**Not yet measured against a played round.** See the Balance questions below.

### 20. A Presence ladder that endows the next cycle with Fear — *built 2026-08-20*

`presence_fear_remains` — *Die Furcht bleibt* / The Fear Remains. Ten rungs at a
flat **1 Presence**, each putting **50 Fear** in the bank at the next Reclaim, 500 at the top.
The catalogue's first repeatable row.

**What it is for:** the shopping prologue of a cycle. A fresh catalogue means the first rounds
of an ascension die early because nothing has been bought yet, and 500 Fear at wave 0 is about
eight rungs of `rising_dread` (6 × 1.6ⁿ sums to 420) — those rounds bought instead of played.
**It skips no waves**: rounds always start at wave 0 and the difficulty ladder is per-round.

**Where the Fear lands.** `ascend` writes `ascensionStartFear(state)` into `meta.fear` *and*
`meta.cycleFearGranted`, leaving `cycleFearGenerated` at 0 — the column the playtest grant
already uses, for the same reason: a head start must not mint Presence of its own. The tally's
identity survives the wipe as `0 + n - 0 = n`. The indirect path is left open and documented:
the Fear buys ladders that multiply everything the cycle generates afterwards, and that is
generated Fear like any other.

**The balance argument, and what was accepted.** Holding 1 Presence is +1% Fear generated
forever, so a 1-Presence rung granting 50 Fear beats holding while a cycle generates under
5,000 — and because the price is flat, **every rung shares that one break-even**. Under 5,000
all ten are worth taking; above it none are. The row is therefore a deliberate late-game sink
with a single threshold rather than a curve, and its worth decays with every ascension because
50 is flat while cycles grow.

That was the design fork, and it was taken knowingly. The alternative costed was a grant reading
a **percentage of the cycle just finished**: with a grant of `p` percent the cycle size cancels
from both sides and a rung costing `C` beats holding exactly when `p > C` percent — which holds
at any depth, giving a row that never ages, at the price of a new meta field surviving the wipe
and a mild head-start feedback loop. Set aside in favour of the flat table as specified. **The
lever if it is ever revisited is the 50, or that change of shape — not the 1**, which is already
as low as a price goes.

**The name went through a collision.** The first draft was *Die Insel erinnert sich* / The
Island Remembers, which is already `power_card_interval`'s name in the Fear shop — two rows a
rail apart with the same name, and the Presence catalogue's whole naming rule is that a shared
name means a shared idea. Renamed to what the row actually does: the spirit withdraws, the
invaders' fear of it does not.

**What it cost the machinery.** Less than expected, which is why it was the right first
repeatable row: `presenceUpgradeMaxTier` reads `maxTier` instead of answering 1,
`presenceUpgradeCost` stays flat (no growth curve, and none wanted — even 1.35 puts the tenth
rung at 15 Presence, three whole rows of this catalogue for one rung of one row),
`presenceUpgradeStatusText` comes back for the tier chip, and the shop's row render grows the
same repeatable branch the Fear shop has always had. The structural test that every Presence row
grants or gates gained a third arm — rows that *endow* — still checked through the reader rather
than an id list.

Covered by six new blocks in `tests/ascension.test.js`. **Not yet played.** The 5,000 threshold
is arithmetic, not a measurement; what a played cycle would say is whether the prologue it
compresses is worth compressing at all.

---

### 21. The Innate's Energy split moves onto its card — *built 2026-08-20*

From the player: auto-buy should hold off on an Innate tier until it is actually worth taking.
Built first as a formula and then, on the evidence that formula produced, cut back to a control.
Covered by the new group in `tests/autobuy.test.js` (7 checks).

**The formula worked and still chose wrong, which is the finding.** The first cut compared what a
tier buys against what the same Energy buys in Focus, over the beats the round had left — a real
payback test, income rate and all. Run against a live save at wave 58 it declined tier 2 and was
*right on its own inputs*: it scored the upgrade at +25% throughput.

The inputs are what is wrong. `worth` for any cast is recovered by inverting its Focus anchor,
and that inversion is only valid where the anchor was derived from worth. The Innate's tier 1
anchor was not: it was picked so the ladder totals exactly 40, matching tier 2's `upgradeCost`
so the round faces a clean either/or (see `ABILITIES.innate_power`). Inverting it credits one
push at 0.24 — two-thirds of a Boon cast — for relocating a single unit that pays no Fear and no
Energy. A tier 1 ladder bought to its 3-beat floor then reads as nearly as good as a fresh tier 2,
and the bot declines the upgrade for the rest of the round. Killing outweighs moving by more than
the anchors say.

**The anchors were left alone.** Retuning anchor 1 down to 2 would fix the symptom by breaking a
deliberate design point — the ladder would cost 27 and no longer match the tier price. Giving a
record its own `worth` field would work, but it is a second balance surface, and
04-economy-formulas.md argues against exactly that by name. Neither is worth it when the decision
can simply be handed back.

**So the cap became a control instead of a calculation.** `ui.autoBuy.innateCap` already meant
"climb to here, then let Focus have the rest"; it moved from a select in the auto-buy sheet to a
segmented row on the Innate's card — *Energy to: Focus | Tier 2 | Tier 3* — showing only the
tiers still above the current one. No new state, and the sheet's copy was deleted rather than
mirrored, since two editable copies of one setting can disagree.

**The cap now binds only at the dial's top rung.** One rung down there is no Focus for the Energy
to go to, so a cap would leave the bot holding a purse it may not spend. `autoBuyTierWanted` steps
it aside there and the control is not drawn — the engine and the UI agreeing on one rule rather
than the UI hiding something the engine still enforces.

**What survived from the first cut**: `abilityFocusLadder`, which named the ladder as a thing with
fields so nine functions stopped each re-deriving anchor, growth, floor and length from the record
on their own. It went in to let the payback test read a tier the ability was not standing on, and
it is worth keeping without that caller.

### 22. The split moves into the purse, and the Innate's tiers stop being a rung — *built 2026-08-20*

The other half of 21, a day later. The split was on the Innate's card and the dial still carried
an `+ Innate tiers` rung, so one decision had two controls that could describe different plans.

**The rung is gone.** `AUTO_BUY_MODES` is `off` / `unlocks` / `focus`, and the tiers are bought at
the top rung under the split's cap. `unlocks` says what it leaves out on its own face —
*(except Innate)* replaces the price ladder that used to be its caption — because a rung that
quietly stopped covering something is how a removal reads as a bug. A save carrying the retired
`tiers` falls back to the default, which is the top rung, so nothing it asked for is lost.

**One consequence, deliberate:** the tiers now ride the same Presence gate Focus does. Between
buying `auto_buy_abilities` and buying `presence_river_deepens` (5 Presence) the bot buys the kit
and stops, and the Innate is climbed by hand. The alternative was a rung that buys tiers with no
split to govern it — which is the control-in-two-places the change exists to remove.

**The split moved to the Energy purse**, in the middle, between the label and the total: it
divides that number, and the purse is the one line on the page that is about nothing else. It
renders and patches on its own signature now (`energySplitSignature`) rather than riding the
ability bar's, which took the last auto-buy reading out of that signature. Its options are named
*Innate Tier 2* / *Innate Tier 3* — on the card the ability was the heading above them; in the
purse nothing else says what they are tiers of.

**It disappears at the top of the ladder.** With no tier above the current one there is no split
to make, so the row is hidden and emptied — `.tier-split[hidden]` is spelled out in the CSS,
because an author `display: flex` outranks the UA rule that hides `[hidden]` and the row would
otherwise stay drawn after tier 3 was bought.

### 23. The opening of a round runs at 20x — *built 2026-08-20, raised to 50x — see item 25*

From the Idea Inbox: "presence upgrade to play the first x waves in 20x speed". Landed as
`presence_deep_water_comes`, three rungs at **3 / 4 / 5 Presence** fast-forwarding the first
**10 / 15 / 20%** of `meta.bestWaveReached`, always floored — a record of 87 hurries 8 waves at
the first rung and not 9. Covered by `tests/fastforward.test.js`; `tests/ascension.test.js`
updated for a fourth shape of Presence row. Unplayed against a live cycle: the figures below are
a first pass, not a measurement.

**It is a fast-forward and not a skip, and that is the whole design.** `gameSpeed` multiplies
`dt` and reaches no rule, so every hurried wave builds, explores, blights and pays its Fear at
full value. The row buys the player's real seconds and never the game's Fear — which is what
lets it be priced as comfort, and what `tests/fastforward.test.js` asserts directly by playing
the same four waves hurried and unhurried and comparing the Fear, the Blight and the cards.

**What was asked for and what changed.** The ask was an eight-rung ladder at 1 / 2 / 3… Presence
a rung, 36 Presence for a 10% cap. Three things moved:

- **The ladder shape.** Cumulative 36 is nearly double the whole rest of the catalogue (20), and
  it is quadratic against income that is root-shaped and a benefit that is linear in the rung —
  the exact failure that deleted the seven discount rows. Three rungs at 3 / 4 / 5 keeps growth
  at 1.33 / 1.25, inside the 1.3–1.5 band the catalogue asks of a repeatable row.
- **The cap grows with the rung** rather than staying at 10%, because that is what the extra
  rungs are now selling. It ratchets on its own besides: `bestWaveReached` never falls, so the
  grant widens between purchases and three rungs can cover the whole game.
- **The price is not the gate.** Nothing can be hand-cast at 20x — cooldowns tick in game
  seconds — so the row is only free to a player already holding `presence_river_knows` and
  `presence_all_unbidden`. That is 8 Presence of depth underneath it, the same argument
  `presence_river_deepens` is priced on.

**Two behaviours beyond a bigger number on `dt`**, both of them the row's own:

- **The wave gate is released for the hurried waves and closes again after them**, via
  `waveProceedsUnattended`. `ui.autoProceed` is neither read nor written — a manual player's
  toggle keeps saying what they set, and they get their gate back at the wave the shop promised.
- **Card reveals are held back while it runs** (`markCardFx`). `CARD_FX_MS` is 2600 *real* ms
  against a wave arriving every real second, so each reveal would be overwritten before it could
  be read. The hand, the log and the drip's schedule are untouched.

**One piece of machinery it added:** `presenceUpgradeCost` now reads a `costs` array as well as a
flat `cost`, because this is the catalogue's first row priced per rung. Three prices written out,
not a curve.

**The figure to watch, and the lever.** At a record of 87 the top rung hands back roughly three
minutes of a fourteen-minute round — about 20% of the sitting-through. If a played cycle wants
more, **the lever is the share and never the speed**: a larger share hands back more of an
opening the player has already proven, while a faster speed only coarsens the tick already
resolving those waves and buys less real time per step past 20x than the step before it. The
share must stay well below where a round becomes a question, though — a row that hurried through
the part of a round that can be *lost* would be playing it.


### 24. A full Dahan pool can be started over for +1 damage — *built 2026-08-21*

From the Idea Inbox, by way of a design conversation: "presence upgrade unlocking Fear upgrades
that strengthen the Dahan — *The Dahan find their Strength*: Dahan deal 2 damage instead of 1."
Landed as a **claim on `dahan_remember`** rather than as a Fear row of its own, gated by a new
Presence row `presence_dahan_endure` at **8 Presence**. Covered by `tests/haste.test.js` (14 new
tests); `tests/ascension.test.js` updated for a fifth Presence row shape. Unplayed against a
live cycle.

**Held shut, 2026-08-21.** The Presence row now carries `locked: true` and is drawn but not
sold — `presenceUpgradeLocked` reads the flag, `purchasePresenceUpgrade` refuses on it ahead of
the maxed and price checks, and the shop draws a dead *Noch nicht* / *Not yet* button. Nothing
below the gate changed: the claim, the doubled pool, the doubled damage and the wipe on Reclaim
are all still wired and still tested, because the tests grant the row rather than buying it.
Re-opening it is deleting the flag. Three tests added in `tests/haste.test.js` for the lock
itself. See [05-progression.md](../spec/05-progression.md#the-row-is-currently-locked).

**Why it is not its own row.** Wounds persist — `applyDamage` accumulates into
`state.invaderDamage` and nothing clears it between strikes or waves — so two strikes at 1
damage kill exactly what one strike at 2 damage kills. `DAHAN_ATTACK_DAMAGE: 1→2` and
`interval ÷2` are the *same throughput*, and `dahan_remember` at a full pool already is the
÷2. A separate 10 000-Fear row for +1 damage would have been a second copy of an existing
axis. So it became the pool's continuation past its own cap instead: the pool is the fine knob,
the claim is the coarse one that takes over when the fine one runs out.

**The arithmetic, which is the design.** Throughput per Dahan is `damage × (1 + haste)`. The
claim trades a full pool's `1 × 2 = 2` for an empty pool's `2 × 1 = 2` — free in the moment it
is taken, and every Fear poured into the second pool is profit the first pool had no room left
to sell. `tests/haste.test.js` asserts that identity directly, and it is the test to read before
touching any of this.

**One claim, and the cap is load-bearing.** A second would trade `2 × 2 = 4` for `3 × 1 = 3`:
twenty thousand Fear spent to lose a quarter of the strike, because `+1` is a doubling only
while damage is 1. A third loses a third. **If a follow-up is ever wanted, the claim must start
doubling damage (2, 4, 8) rather than incrementing it, and the two changes have to land
together.** Written into `engine/constants.js` above `DAHAN_STRENGTH_DAMAGE` as well, because
that is where someone will be standing when they think of it.

**The second pool is 20 000 units at 1 Fear, not 10 000 at 2.** A Fear stays a unit and the row
stays the flat 1:1 sink its design rests on. What paid for that: `upgradeMaxTier` now takes a
`state` — the pool is the only row whose ceiling moves — and `dahanHasteFraction` divides by the
ceiling in play, so a full second pool reads 100% rather than 200% and `DAHAN_HASTE_MAX` still
means what it says.

**Three decisions worth naming:**

- **Between rounds only**, like `canAscend`. The claim empties a row the running round has
  already snapshotted and doubles a divisor it is still dividing by; `round.status === "ended"`
  removes the question instead of answering it. The claim also clears the finished round's
  snapshot entry, or the panel would print 50% haste on an empty pool until the next round.
- **A flag on `state.upgrades`, not a row in `purchased`.** A catalogue row would be orderable,
  priceable and buyable by any path that skips the shop render. The cost is that `ascend`'s wipe
  now has two lines where its comment promised one — which is correct, because this is board
  power and board power is re-earned every cycle.
- **The row does not sink while a claim is pending.** `upgradeIsSoldOut` answers the shop
  sort's question ("anything left here?") separately from the buy button's ("a rung to buy?"),
  so the one moment the row has something new to say is not the moment it drops to the bottom.

**It revives `presenceUnlock`, deliberately.** That mechanism was deleted because a Presence row
gating an *automation* asked for the Fear again every cycle and an outright grant beat it by an
order of magnitude. The argument does not reach a row that changes what the Dahan do. The rule
the two cases sit either side of is now written in
[05-progression.md](../spec/05-progression.md#what-presence-grants-and-what-it-gates):
**Presence grants automations and gates board power.**

**The figures to watch.** The 8 Presence, which is a guess against two 5s and no played cycle;
and whether 30 000 Fear across both pools is a sink a cycle can actually reach, given
`DAHAN_HASTE_FEAR_FOR_FULL`'s own note already says early cycles will not fill the first 10 000.
If it proves unreachable the lever is the ceiling, not the claim — the claim is neutral at any
depth, so moving the pool is free of the arithmetic above.

### 25. The fast-forwarded opening moves from 20x to 50x — *built 2026-08-21*

`FAST_FORWARD_SPEED` 20 → 50. One constant, and the wording that quoted it: the shop text and
the log line both read the number through `{speed}`, so `i18n.js` needed nothing.

**Why the speed and not the share, when item 23 says the lever is the share.** That note is
about making the row *stronger*, and this is not that. The share is untouched — the same waves
are hurried, they still pay exactly what they paid, and no rung hands the player a wave it did
not hand them yesterday. What moved is only how long the player sits through the waves the row
already bought them out of: at a record of 87 the top rung's 17 waves took about 17 real
seconds and now take about 7. The row is still comfort, and is still priced as comfort.

**What had to be checked rather than assumed.**

- **The tick cap still holds.** `MAX_TICK_SECONDS` is half a wave interval and is applied
  *after* the speed multiplication, so no tick resolves two waves at 50x any more than at 20x.
  What changes is where a dropped frame starts costing: a real step past 200 ms now clips
  instead of one past 500 ms, and clipping makes the round run **slow**, never skip. The
  fast-forward is lossy at the edges by design and always was.
- **`effectiveGameSpeed` still replaces rather than multiplies.** The `Math.max` guard exists
  for the playtest dial, and 8x is further below 50 than it was below 20 — no change in kind.
- **Card reveals were already held back** for the whole fast-forward, so a wave arriving every
  0.4 s instead of every 1 s does not make the reveal panel flicker; it makes the case for
  holding them back stronger.

**The one thing that did not survive the move unexamined: tick granularity.** The identity test
failed on the bump, and it was right to. A tick is atomic and `tickCooldowns` floors at zero, so
an ability whose cooldown lands mid-tick is cast at the end of that tick and the overshoot is
thrown away — the kit effectively waits its cooldown *rounded up to a whole tick*. A tick was
worth a third of a game second at 20x and is worth five sixths of one at 50x, so the rounding
got coarser.

Measured on a deliberately harsh fixture (tier 3, a record of 200, so the whole run is hurried),
against the same run stepped finely:

| waves | fine | 50x @ 60 fps | 50x @ 30 fps |
| --- | --- | --- | --- |
| 4 | 6 Fear | **5 Fear** | 6 Fear |
| 5 | 7 Fear | 7 Fear | 7 Fear |
| 6 | 8 Fear, 6 Blight | 8 Fear, **7 Blight** | 8 Fear, 6 Blight |
| 8+ | lost at wave 7 | lost at wave **6** | lost at wave 7 |

Lumpy rather than steady, and not monotonic in the tick size — 30 fps is a coarser tick than
60 fps and loses nothing, because what matters is how a cooldown divides into a tick, not how
big the tick is. Usually nothing; occasionally one cast in ten waves.

**It was left alone on purpose, and here is the argument.** It is a property of tick granularity
at every speed on the dial and not of this row — the same rounding is there at 1x, worth a
sixtieth of a second. The row's claim is that *speed reaches no rule*, and that is exactly true:
held at equal game-seconds-per-tick, the hurried and unhurried runs agree to the float. So the
identity test now holds the granularity equal on both sides and says why, rather than asserting
a rule and quietly testing a frame size.

**If it ever needs to be exact, the fix is not a lower speed.** It is for `startCooldown` to
carry the overshoot the way the wave timer and the Dahan attack already do a few lines below it
in the same `tick` — `+=` an interval rather than `=` one. That is two lines and it would make
the kit frame-rate independent at every speed, which it is not today. It is not done here
because it changes every ability cast in the game to buy back roughly one Fear in ten waves of
an opening that is 10–20% of a round, and that is a balance decision rather than a speed one.

**The figure to watch.** Whether 50x reads as *fast-forward* or as *cut to black*. The row's
promise is that the hurried waves visibly happened, and there is a speed past which the board
is a strobe and the player stops believing the waves were played. If it crosses that line the
answer is a step back toward 20x, not a smaller share.

---

## Idea Inbox

Unsorted and unargued. One line each, written down before it is thought about — the point is
that catching an idea costs nothing. Nothing here is a commitment.

An idea leaves this list in one of two ways: it earns a paragraph and moves up into
[What To Build Next](#what-to-build-next) as a numbered item, or it stops being interesting
and gets deleted. It should never exist in both places at once — if it is numbered above, it
is not a line down here.

### Mechanics

- **Dahan deeds**: the Dahan do things besides strike, on a clock of their own, chosen by a
  fixed priority over the board rather than at random - events without the dice. The skeleton is
  already there twice over: `dahanAttackRemaining` is a Dahan clock, and `abilities.js` is
  nothing but deterministic prio-ordered land pickers. First deed, straight from a Spirit Island
  event: *Tend the Land* - remove 1 Blight from a land holding at least 2 Dahan (`removeBlight`
  exists; the "preventive, never a rescue" invariant holds as long as it resolves on a tick).
  Two things settled before any code: **all met deeds fire on a tick**, or each new deed dilutes
  the ones already bought - the strictly-dominated rung the Presence discount ladder died of;
  and deeds should mostly *not* be "more Dahan" or "more kills", which feed the loop that is
  already strongest and duplicate the strike respectively. Tend the Land is the shape to copy:
  it converts a Dahan stack into Blight relief, a different axis, self-limiting via
  `BLIGHT_FLOOR_FRACTION`
- check if Wash Away works correctly when a land holds more than 3 invaders
- give tokens for casting abilities, spendable to upgrade them (or route that through the
  Presence shop instead)

### UI

- give the player better feedback: invader/Dahan deaths, end of round, Fear/Energy generated

### Balance questions

- the Focus pill reads `25 Energy - Cooldown -2 Sec` at 1x and `-1 Sec` at 2x, because a rung is
  a *beat* and the countdown beside it is drawn through the speed dial. If a playtest says the
  moving number confuses more than the matching one helps, the alternative is to quote beats on
  the pill and leave seconds to the countdown - not to hardcode a figure for one dial position
- the seven card Focus ladders are tuned but unplayed - see
  [04-economy-formulas.md](../spec/04-economy-formulas.md#the-seven-card-ladders). The figures to
  watch are the two past 6 000 (Accelerated Rot, Tsunami): both are priced as round-*length*
  purchases against an Energy pool nothing has measured, and if a deep round turns out to bank
  far more than that, the lever is the anchor band rather than the growth
- the Innate's three Focus ladders (item 18) are a first pass, unmeasured against a played
  round. The figure to watch is tier 3's opening rung at 25: it is the only rung in the game
  priced above an unlock, and it is only defensible because tier 2's investment usually pays it
- Innate tiers 2 and 3 cut 50/250 -> 40/150; still unmeasured against a played round
- Wash Away: cooldown cut 35 -> 30 beats; still 20 Energy to unlock, unchanged
- the auto-buy Focus loop (item 19) is unplayed. Two figures to watch: whether
  `presence_river_deepens` at 5 lands too close to `presence_current_quickens` — the pair should
  not arrive on the same Reclaim, and this row is the one to move if they do — and whether
  `value` order sends so much of every round into one ability's ladder that the per-ability
  opt-out becomes mandatory rather than optional
- general balancing pass

---

## Retired Foundation

Tasks 01–15 built the turn-based prototype. The code they describe was deleted with
`app.js` and lives in git history; the task log itself has been retired along with it.

What carried forward into the round-based build: the eight-land board with its adjacency and
rendering, the unit HP and damage model, fear-from-defeat, the per-land Dahan layer, the
Build/Discover rules, and the no-offline-catchup save pattern. What did not: presence
placement and the two presence tracks, growth options, the card draw/discard/hand, targeting
locks, the Ravage phase, and per-land Essence generation.

Where a retired system has a successor, the spec names it — see
[../spec/index.md](../spec/index.md#retired-from-the-turn-based-slice).
