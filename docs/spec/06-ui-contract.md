# 06 UI Contract

## Intent

Keep the round loop legible on one screen: the live Blight countdown, the ability bar, the
island board, and the between-round shop.

## Rules

- The page must keep all critical round information visible without navigation.
- The island is drawn as one board of eight lands; terrain is an attribute of a land, not a
  panel.
- A round in progress must communicate, at a glance and without opening any panel, how close
  Blight is to ending it.
- The shop appears in the side rail while `round.status` is `ended`; the board stays visible
  beside it as the frozen result of the round just lost.
- A stopped clock must always say why it stopped. There are two reasons — the speed dial at
  `0x`, and a wave gate waiting to be called — and the wave tile names whichever holds, with
  the gate named first because it is the one with a button waiting to be pressed.

## Required Screen Sections

1. Round HUD — laid over the island's top edge, not in a panel of its own
- Every vital is read against the board, so it sits on the board. A panel above the map put
  the two halves of one judgement — how fast a land is losing, and how close Blight is to
  ending the round — on separate screens, and made the player scroll between them
- The strip must not take pointer events: the lands beneath it stay clickable
- Round number, and best round reached
- Blight meter: current value against `round.blightThreshold`, always visible, not hidden
  in a panel
- Wave timer: seconds remaining until the next wave, in **real** seconds rather than game
  seconds. At `2x` a twenty-second interval really is ten seconds away, and a tile still
  reading twenty would be counting down twice a second in front of the player. Every other
  countdown on the page — the Dahan strike, every ability cooldown — converts the same way,
  or two clocks that run together stop reading as one
- Wave controls, in the wave tile because they answer the question the bar above them asks:
  the **auto-proceed toggle**, and the **call button** that opens a held gate. They are the
  only part of the strip that takes pointer events; the row around them stays inert, so the
  island keeps every pixel it is not actually covering. The call button stays on the strip
  while it is dead rather than being hidden — it is the one control the manual mode is played
  through, and a button that came and went would move the two beside it every wave
- Dahan strike timer: seconds remaining until the next Dahan attack, shown separately from
  the wave timer because the two are separate clocks and will drift apart
- Fear, as **three readings of one purse**, each answering a different question:

  ```txt
  FEAR
  157 (+8 this round)
  +7 base (+1 from upgrades)
  ```

  - the **value** is `meta.fear`, the banked pool and the only one the shop can spend
  - **beside it on the same line**, what the round has added so far and will bank at round end.
    They share a line because they are one sentence — what you have, and what is coming — and
    the size difference is what says which of the two is spendable
  - **below**, how that round total splits between what the round earned on its own and what
    the Fear ladders added. The two figures always sum to exactly the number on the line above

  The third line is drawn **only when a ladder is actually contributing**. With none owned it
  would read `+8 base` under a line already saying `(+8 this round)` — the same number twice,
  and a standing reminder of an upgrade the player has not bought. See
  [03-state-contract.md](./03-state-contract.md) on `round.fearEarnedBase` for why the split is
  tracked rather than derived, and why the two halves are floored the way they are.
- The `high_water_mark` payout flashes over the Fear total on the wave that pays it, on the
  same `DEFEAT_FX_MS` clock as the defeat and Blight chips (`ui.fearFx`). It is the only Fear
  income that arrives as an event rather than as a rate, and a lump that showed up only as a
  slightly larger running total would be an event the player never saw happen. It is
  absolutely positioned so it cannot reflow a HUD that is patched ten times a second, and
  `prefers-reduced-motion` holds it visible instead of animating it

1a. Pacing controls — in the top bar, beside the language toggle
- Three buttons, `0x / 1x / 2x`, drawn as one segmented control with the chosen speed lit.
  Three equal buttons in a row would read as three separate commands rather than one dial.
  `1x` is the game as it ships, `2x` is double speed, `0x` stops it
- They belong beside the language toggle because they are the same kind of thing: settings
  for how the game is read, not moves inside it
- `0x` is a state the whole board is in rather than a preference like the other two, so the
  button holding it there wears the page's warning colour

1b. Invader track — in the side rail
- The Build and Discover terrains. There is no Ravage slot
- Active spirit name and trait text

2. Ability bar
- The **Energy purse** at the head of the panel: `resources.energy`, in its own colour. It
  lives here rather than in the round HUD because it is only ever read next to what it buys,
  and everything it buys is in this panel. It is patched per tick like the rest of the live
  readouts — Energy arrives mid-fight, on a kill, not on a round boundary
- One control per ability in the active spirit's **whole kit**, locked entries included
- An unlocked ability shows: name, ready/cooldown state, and — while on cooldown — a visible
  countdown or sweep, not just a disabled button with no indication of when it'll be ready
- A locked ability shows the same card, dimmed, with its price where its state would be. It
  is listed rather than hidden: what the spirit could still be doing is half of what makes
  Energy worth banking, and a bar that grows by surprise teaches nothing. Its border warms to
  the Energy colour the moment it becomes affordable, so "can I buy anything yet" is answered
  without reading a number twice
- The locked card itself is inert; only the price is pressable. Kit order is fixed and a
  purchase never reshuffles the bar — the player would lose the position they had learned
- An ability awaiting a land click (`pendingAbilityTarget` set) reads as active/armed, and
  the board shows which lands are valid targets for it

3. Island board panel
- The board itself: eight lands drawn as one island, ocean along the coast edge, cliffs on
  the others
- Per land, on the board: land number, terrain, invader glyphs with counts (nonzero only),
  Dahan pips, and the Blight already taken there when it is nonzero
- On every land holding invaders: a **Blight bar** showing `round.blightProgress` for that
  land, and a line naming the rate and the seconds to the next Blight. This is the primary
  read on the board — the fight is continuous, so a land's danger is a speed, not an event
- On **every wounded unit count**, Dahan and invader alike: a **health ring** around that
  count's **existing glyph** — not a second bar, and not a second token. It is red, and it
  drains: a full ring is full health, and the gap opens clockwise from twelve as health goes,
  so a unit down a third shows red from four o'clock round to twelve. An empty ring is the
  moment the count beside it drops.

  It reads as health rather than as damage on purpose. A filling damage bar says "something is
  accumulating"; a draining health ring says "this thing is nearly dead", which is the sentence
  the player needs at a glance. The behaviour is identical either way — this is a presentation
  decision, not a rules one.

  One bar and rings, rather than a second bar: two bars of equal weight read as two equal
  threats, and only Blight ends the round.
- **Nothing at full health wears a ring.** The rings on screen are exactly the units worth
  looking at. The Dahan ring is fed by `round.dahanProgress`, which is continuous; an invader
  ring is fed by whole points already taken.
- There is **one ring per type per land**, and it belongs to that type's worst-off unit. The
  chip has room for one number per type, not one per unit, and the unit about to die is the one
  worth watching. Exact per-unit health lives in the land detail panel, which is what per-unit
  damage tracking exists to make possible.
- A land with no invaders shows its Dahan ring **stopped, not cleared**. `dahanPerSecond` is 0
  there and `resolveLandCombat` leaves `dahanProgress` alone, so the ring holds whatever it
  reached: a land that nearly lost a defender still says how close it came, and says what the
  next wave resumes from. Rings are drawn while an ability is armed too — a ring is part of the
  count, and hiding it would resize the glyph and shift the row on every target selection
- The ring element is always in the markup and revealed by opacity, never inserted when the
  first damage lands: the board only rebuilds when its signature changes, and a ring that had
  to be added to the DOM to appear would lag the damage that caused it
- On a land the next wave will Build: a colour-coded banner naming the unit it will add. A
  land on the wave's list with nothing to build on wears a **quiet** variant of the same
  banner — neutral, not pressure-red. The loud frame means "this land gets worse"; wearing it
  to announce that nothing happens pulls the eye to the one land needing no attention
- On the land a pending ability target applies to: highlight it as a legal click
- A land detail panel for one selected land: the same fight readout in long form (gross
  damage, Dahan defence, net, rate, ETA), invader counts with partial-HP hints, Dahan,
  Blight taken here, and its neighbours

4. Between-round shop (visible only while `round.status` is `ended`)
- The round just lost: its number and the Fear it earned
- The upgrade catalogue: each entry's effect, its current tier if repeatable, and its cost
- **A row whose per-tier gain is not constant describes its next rung, not its whole shape.**
  That is `headwaters`, `high_water_mark` and `dahan_remember`: everywhere else "+1 Dahan, per
  tier" already answers what the next price buys, while a table of nine numbers and a percentage
  of a wave number do not. So those rows read as the next purchase — the Energy the next
  tier adds and what a round would then open with, the Fear the next tier adds to the milestone
  the player is heading for — with the tier chip beside the text saying which rung they are on.
  `headwaters` at its top tier states what it ends up paying instead; `high_water_mark` is
  soft-capped and so always has a next rung to describe. `dahan_remember` has no next rung at
  all, so it describes where it stands: Fear invested against the full pool, and the strike
  interval that buys — quoted in the same real seconds every countdown on the page uses, so it
  moves with the speed dial
- **The pool row is bought in denominations, not one rung at a time.** `dahan_remember` ends in
  a strip of buttons — one per `bulkAmounts` entry, then a **Max** that takes everything the
  purse can pay for — instead of a single Buy. Each button's tooltip names the Fear it will
  actually spend, which near the cap is less than the button says: a `+1000` with 400 units of
  pool left buys the 400 and charges for 400. A denomination the purse cannot cover is disabled
  rather than dropped, so the strip never reshuffles under the cursor. A bulk buy the purse
  cannot cover is refused whole and never part-paid — Max is how the player says "as much as I
  can afford"
- **A pool shows its effect where a ladder shows its tier.** `Tier 4271` is true and useless;
  the row reads `42.71% faster`, to two decimals, because one Fear is a hundredth of a percent
  and a readout that printed the same number for `+1` and `+10` would say a purchase did
  nothing (`upgradeStatusText`)
- A gated row (see [07-content-registry.md](./07-content-registry.md#permanent-upgrades)) stays
  on the list, fully readable, with its price shown and its button dead, and says that it opens
  once everything else is bought. It is not hidden: what is behind the gate is the reason to
  finish the catalogue, so hiding it would hide the goal. The row wears the lock instead of the
  "takes effect next round" note — a locked row cannot have been bought, so the two never
  collide
- A clear "Start Next Round" control, always available regardless of remaining Fear

5. Log and utility controls
- Event log
- Manual save button
- Wipe save button
- Language toggle

## Ability Status Rules

- An ability control shows one of: locked (with its price), ready, on cooldown (with
  remaining time), or armed (waiting for a land click).
- An armed ability can be cancelled by clicking it again, returning
  `pendingAbilityTarget` to `null` without spending the cooldown.
- A locked ability's price is disabled while `resources.energy` is under it. The card is
  never hidden and never reorders.
- Buying is allowed during a running round, not only between rounds — see
  [02-core-loop.md](./02-core-loop.md#energy). A bought ability appears in the bar ready, not
  cooling: the purchase was the cost. So does a bought tier.
- A **tiered** ability's card carries its current tier and the price of the next one. It is
  castable and buyable at once, so it cannot be the single button the others are — a button
  inside a button is not markup. The card becomes a container holding two: the cast surface,
  and the tier row beneath it. It keeps the same card styling either way, so the bar still
  reads as one column of equal things.
- **Under the Energy purse: where Energy comes from.** It is the one currency the player earns
  by fighting rather than by surviving, and the purse only ever shows a total. The note names
  the income (1/2/3 per Explorer/Town/City, plus Boon of Vigor) and — the part nothing else on
  the page says — that it and everything bought with it reset when a round starts. It names
  `headwaters` as the one thing that reset does not take to zero, since the shop row is
  otherwise the only place a player could learn that a round can open with Energy at all.

## Map Hint Rules

- Default hint names the board: eight lands, three of them coastal.
- While an ability is armed, the hint names which ability is waiting and what land property
  it needs: invaders present, or — for a push — something pushable. A push never asks about
  the neighbours any more; it always has somewhere to go.
- Otherwise, while a round runs, the hint names the terrain the next wave will Build in and
  the lands that means.

## Interaction Rules

- The board is otherwise read-only during a running round: there is no click that pauses,
  skips, or manually triggers a wave.
- Clicking a land always selects it into the detail panel.
- If an ability is armed and the clicked land is a legal target, the click also resolves
  that ability's effect.
- Lands are focusable and activate on Enter and Space. No drag, no hover-only affordance.

## Land State Rules

A land renders in at most one state, listed by precedence:

| State | Meaning |
| --- | --- |
| `legal` | A valid click for the currently armed ability. |
| `wave-active` | A land the next wave's Build will act on. |
| `selected` | Open in the detail panel. |
| `out` | Dimmed. Not a legal target for the armed ability. |
| `idle` | Nothing pending here. |

Dimming what isn't a legal target is what makes an ability's targeting rule teachable without
a rulebook.

Two clarifications the implementation forced:

- **`wave-active` means the *next* wave, not one mid-resolution.** A wave resolves
  atomically inside a single tick, so there is no interval during which the player could see
  a Build "in progress". What is worth showing is the wave being counted down to, which is
  also the only one the player can still act against.
- **`wave-active` is no longer where the damage is.** Under the old design it marked the two
  lands about to be hit; now every land with invaders is being hit, continuously, and the
  per-land bars carry that. The wave outline marks where the island is about to get *worse*,
  which is a different and lesser urgency — the bars are the primary read.
- **Chip text needs its own backing.** The chips float over terrain fills that run from slate
  to bright desert, so every line on a chip carries either a dark pill behind it or a
  `text-shadow`, and none sit below weight 700. The wave banner was the exception and read at
  roughly 3:1 over desert; its warning colour now rides on a dark base rather than washing
  straight over the land. Anything new on a chip inherits this rule — at 9px there is no
  terrain fill that near-white survives unaided.
- **Arming an ability is exclusive.** While `pendingAbilityTarget` is set, every land reads
  as either `legal` or `out` — a wave target that is not a legal click still dims. Legality
  is the only question on screen at that moment, and a second highlight competing with it
  would blunt exactly the teaching that dimming is for. The selection ring is drawn
  independently of the state, so the selected land never disappears.

## Live Update Rules

- Values that change every second (wave timer, Dahan strike timer, ability cooldowns, Blight)
  must be patched in place rather than triggering a map rebuild.
- The per-land bars change every *tick*, not every second, so they are patched hardest of
  all: the board's rebuild signature deliberately excludes `blightProgress` and
  `dahanProgress`, or the board would rebuild ten times a second and no bar could animate.
  Their fills and the countdown text beside them are written every frame by a patch pass that
  creates no nodes.
- The island's shapes are drawn once at startup. Only fills, outlines, and the overlay chips
  are repainted.
- Rebuilding the board on a per-second cadence would destroy in-progress hover/focus state
  and any cooldown sweep animation.

## Terrain Colour Rules

- Terrain hues live once in `TERRAIN_RGB` in `app.js`, mirrored in `app.css`, and are
  published per element as a `--terrain-rgb` custom property.
- A land's fill, its chip, and its detail panel all read that one property, so a terrain
  never carries two competing hues.
- Land fills sit at or above `0.42` opacity. Below roughly `0.4`, slate mountains and blue
  wetlands converge into the same blue-grey against a dark ocean and stop being tellable
  apart.
- Unit type is carried by **shape**, not hue, so Dahan can be told apart from invaders at a
  glance regardless of terrain.
- Terrain hues: mountains slate `171, 184, 196`, desert sand `242, 196, 90`, jungle leaf
  green `124, 198, 116`, wetlands blue `118, 179, 222`.

## Playtest Tools

A row at the foot of the page — below the save controls, below everything that is played
through — takes a redeem code. Typing `playtester` into it switches on a small set of tools
for looking at the game rather than playing it. They ship with the page and cost nothing to
carry: `ui.playtest` is the one flag in the state no rule reads.

- **The redeem bar** is a form, so Enter submits it: the code is typed, and a typist reaches
  for Enter rather than for the button beside the field. One line under it says what the last
  attempt did, and says it in three different ways — redeemed, already redeemed, unknown.
  "Already redeemed" is worth its own message: silence would look like a rejection
- A code that was accepted clears the field. A rejected one is left where it is, to be
  corrected — which is the only reason the message beside it is worth reading
- **`8x` on the speed dial**, appended after `2x` rather than mixed into the shipped speeds. A
  whole wave arrives in two and a half real seconds, which is far past what the round is
  balanced to be read at, and is exactly the point: it is for reaching wave twenty to look at
  something, not for playing there
- **A grant button inside each currency readout**: `+100` in the Energy purse and `+100` in the
  between-round shop's Fear purse. Each sits inside the number it moves rather than in a tray of
  its own — a playtest panel elsewhere on the page would be one more place to look, and these
  exist to be one click from the thing they change. The Fear grant lands in the **banked** pool,
  not in what the round has earned: its purpose is to buy something in the shop right now, which
  is also why it sits in the shop's purse rather than in the HUD's Fear tile. That tile shows
  what the running round has earned, a number the grant never touches, so pressing it there read
  as doing nothing
- **A "hide playtest tools" button** beside the redeem input, and only while the tools are on.
  It puts the page back the way it plays; typing the code again brings them back. It lives in
  the redeem bar rather than travelling to whichever panel it hides, because that bar is where
  they were switched on
- Hiding them takes the extra speed with it. A player sitting at `8x` when the tools go away
  would otherwise be left at a speed with no button to leave it by — so the dial snaps back to
  `1x`, while a normal speed they chose themselves is left alone
- Every one of these controls is in the markup at all times and revealed by `hidden`, never
  inserted. Which speeds the dial shows comes from the engine's `availableGameSpeeds`, so the
  rule about what `8x` needs is not written down twice

## Visual Feedback Rules

- Dahan must be visually separated from invader counts.
- Damaged invaders show remaining HP text in the land detail panel, one figure per wounded
  unit. Healthy units are not listed — a "3/3" beside every whole city would bury the one
  number that matters.
- Defeats should briefly animate with a pop-style hint.
- Blight gain should be visible at the moment it happens, not only reflected in the meter's
  end value — the player should see *which* land just cost them Blight.

## Layout

Implemented as a twelve-column grid over three regions:

- **Top bar**, full width: the spirit line, the speed dial, the language toggle.
- **HUD**, laid over the board: five tiles (Blight, next wave with its controls, Dahan
  strike, Fear, round).
- **Board**, eight columns: map hint, island, land detail panel.
- **Rail**, four columns: ability bar, then the shop when a round has ended, then the log.
  A single flex column, so the shop appearing pushes the log down rather than displacing
  the board.
- **Footer**, full width: the save controls, and under them the redeem bar. Nothing in the
  round is played through either, which is what puts them below everything that is.

Below 1180px the board and rail each take the full width; below 720px the HUD drops from
four tiles to two, because a Blight meter narrower than its own label stops being a meter.

## Acceptance

- A player can tell how close the round is to ending without opening any panel. ✓
- Every ability's state (ready, on cooldown, armed) is visible without hovering. ✓
- A player can tell what the next wave will do, and where, without it needing to be
  explained. ✓
- The board is legible at a glance: which lands are under pressure, where Dahan still
  stand, which lands have already cost Blight. ✓
- The shop is reachable the instant a round ends, with no extra click to "acknowledge" the
  loss first. ✓
- A player can slow the game down, speed it up, or stop it, without leaving the board or
  losing a second of the round. ✓
- A player who wants to think between waves can have the game wait for them, and can see at
  a glance that it is waiting rather than broken. ✓

## Implementation Notes

- `ui.js` holds every DOM call and no rules; `engine.js` holds every rule and no DOM. The
  land-state precedence above lives in `engine.js` precisely because it is a rule, which is
  what lets the suite assert it.
- Three render caches gate the expensive work: the board rebuilds only when its own
  signature changes, the ability bar only when the unlocked set or language changes, the shop
  only when Fear or a tier changes. The HUD, the map hint, the Energy purse, the ability
  countdowns and each locked card's affordability are patched in place on every tick instead
  — no node is created ten times a second. Affordability is deliberately *not* in the ability
  bar's signature: Energy moves on every kill, and putting it there would rebuild the bar
  mid-cooldown and kill the sweep it is meant to preserve.
- The dev fixture `index.html?vis` paints a mid-round board for layout work without playing
  to it; `index.html?vis&ended` does the same for the shop. It is a **mode of the real page**,
  not a page of its own: the fixture used to be a second HTML file carrying its own copy of
  this markup, and that copy silently stopped matching the layout the first time the HUD
  moved onto the board. One page means the drift cannot happen again.
- Fixture mode switches off the clock and every write to storage. A frozen board is what
  makes it a fixture — the state `vis.js` authored is the state on screen, not the state a
  second later — and a fixture that autosaved would overwrite a real save with a board nobody
  played. Every save in `ui.js` goes through one `persist()` helper for that reason, so a
  call site added later cannot leak around the guard.
