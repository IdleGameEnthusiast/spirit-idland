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
- The shop is always in the side rail, running round or not; the board stays visible beside
  it, and when the round has ended it is the frozen result of the round just lost. The shop
  no longer hides itself: Fear is banked at the round boundary rather than spendable the
  moment it is earned, so shutting the panel is not what keeps a round from buying its own
  way out — and once rounds can start themselves there would be no moment left to open it.
  What `round.status` changes is the summary line the panel opens with and which purchases
  are already in effect, not whether the panel is there.
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
- **The escalation ladder**, one row per rung: the wave it lands on and what it does, in
  climbing order, from `difficultyLadder`. The panel holds no wave numbers of its own — a rung
  that moves in `engine.js` moves here in the same edit
- The whole climb is shown at once, never scrolled or collapsed. It is a plan the player reads
  ahead on, and a rung hidden behind a toggle is a rung they meet by surprise
- Three readings, and they are deliberately not "done / not done". A rung the round has
  **passed is in force** — a rule the island is playing by right now — so it is drawn
  brightest. The **next** rung is boxed. Everything above it is dim, because it is not the
  player's problem yet
- The two repeating rungs print their **next firing**, not their first, with what they are
  worth so far in the text. A round at wave 150 reads `170 Invaders hit harder (now +3)`
- A line under the heading says the rungs are counted **per round**. Without it the ladder
  reads as run progress, which is the one thing it is not
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

  One *threat* bar and rings, rather than a second threat bar: two bars of equal weight read as
  two equal threats, and only Blight ends the round. The rule is kept by **weight, not by
  count** — the Dahan strike bar below is a second bar and is deliberately not a threat.
- On a land holding **both Dahan and invaders**: a **Dahan strike bar**, sitting in the allies
  row immediately **right of the Dahan count**, with a small axe past its right-hand end. It
  **fills** as the strike clock runs down and is full at the instant the Dahan swing. Health
  drains and an attack gathers, which puts it in the opposite direction from the wave bar in the
  HUD strip:
  that one is the invaders' and answers *how long do I still have*, this one is the player's
  and answers *how much have my people gathered*. On the chip itself the convention is
  consistent — the Blight bar beside it also fills.

  It is subordinate to the Blight bar by every means available: thinner (3px against 5px),
  shorter (a fixed track against the chip's full width), and in `--dahan-ink` rather than
  pressure red. It is the only thing on a chip that is good news and must not be mistaken at a
  glance for a fourth way to lose. It is **not** in the Blight bar's row, which is a flex row of
  equal-weight meters: a second meter dropped in there would split the width with Blight and
  produce exactly the two equal bars the rule above forbids.

  Where it *is* — tucked against the Dahan count — is doing work no label could. It is that
  count's clock and no other land reading, and standing beside the count says so with no ink
  spent. The axe goes past the far end of the track rather than in front of it, so a filling bar
  runs toward the blade and reaches it as the Dahan swing.
- **The last fifth of the swing lights the whole group up** — fill, track and axe together, in
  pale gold, with the axe breathing. The threshold is `STRIKE_IMMINENT_AT` in `ui.js` and is a
  **share of the clock, not a count of seconds**: `dahan_remember` halves the interval, so a
  fixed two seconds would be a quarter of the cycle unbought and half of it bought — the more
  Fear sunk into the strike, the longer the board would sit shouting. A fifth is a fifth at any
  haste.

  Pale gold rather than red, by the same rule that governs the bar's weight. Red on a chip means
  Blight and wounds; the strike landing is the good news, and flashing it in the threat colour
  would make it read as a fourth way to lose. The cue exists because a 3px bar in a mid-warm
  brown states its fraction honestly and announces nothing — a player watching the invaders
  never catches the one instant worth catching.

  One clock drives every lit bar, so they all light at the same instant. That is the point: the
  moment belongs to the island, not to a land.

  It is normalized against `roundDahanAttackInterval(state)`, never the base
  `DAHAN_ATTACK_INTERVAL_SECONDS`. `dahan_remember` halves the interval, and a bar divided by
  the base constant would top out near half-mast exactly for the player who paid to make the
  strike matter. That function reads the round's frozen upgrade snapshot, which is the number
  `tick` itself divides by, so the bar can never disagree with the clock it draws and a
  mid-round purchase does not re-scale a bar already in motion. A round that is not running
  reads 0%.
- **Two conditions, both required, for drawing the strike bar**: Dahan present *and* invaders
  present — exactly the land `resolveDahanAttack` would skip. So a bar means *these Dahan hit
  here when it fills*, never *somewhere on the island someone swings*. A land with Dahan and no
  invaders gets no bar, because the strike passes it by and would leave a gauge sitting full
  having done nothing, which is the one thing a gauge must never do.

  Note the deliberate contrast with the stopped Dahan ring below: the ring remembers when a
  land empties and the strike bar does not. They are different kinds of number — the ring's
  value is that land's own history, and the bar's is a global clock that says nothing whatever
  about a land the strike will skip.
- **There is one strike clock for the whole island**, so every strike bar on the board shows
  the same fraction and they are all full at the same instant. `resolveDahanAttack` walks every
  land on a single `round.dahanAttackRemaining`; there is no per-land timer and none is to be
  built. The repetition is the point: the clock goes where the eye already is, rather than
  telling eight lands eight different things.
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

4. The round controls — a bare row in the rail, above the shop panel
- The two controls that answer *when does the next round begin*: **a clear "Start Next Round"
  control, always available regardless of remaining Fear**, and the **auto-round toggle**
  beside it
- **Above the shop panel, and a sibling of it rather than its first child.** The upgrade
  catalogue is the tallest thing in the rail — repeatable ladders, one-offs, a sold-out block
  and a pool row with its strip of denominations — and it only ever grows. The control that
  ends the shopping must not sit behind everything the player has already decided not to buy,
  and nothing added inside the panel may push it back down there. A section whose primary
  action sat above its own heading would also have a heading that no longer headed anything
- **No panel chrome.** It is a row of two buttons, not a section of the page: both buttons
  carry their own border and fill, and the rail's own gap is the separation
- **Disabled while a round runs, never hidden**, the same choice the wave call button makes
  one level down. A row that vanished at every round boundary would jump the shop panel and
  the log up and down the rail
- The toggle sits beside the button it automates and travels with it, the same rule that puts
  the auto-wave toggle beside the wave countdown. It is drawn on ownership, so the row is a
  single centred button until the automation is bought

5. The shop (always in the rail; its summary is what changes with `round.status`)
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

6. Log and utility controls
- Event log
- Manual save button
- Export and import buttons, and the status line they answer on
- Wipe save button
- Language toggle

**Export and import move a run between machines, and both are one click.** Export downloads the
state as a file named for the wave it holds, so a folder of them can be read without opening
any. Import opens a file picker, never a box to paste into: a save is carried between a desktop
and a laptop, and what carries it is a file.

Two rules protect the run already in progress:
- **An import always asks first.** It replaces the run on screen, which makes it the second
  control on the page — after the wipe — that can end a round the player is in the middle of.
  A file from an older version says so in stronger terms, because loading it starts a fresh
  game rather than the run in the file
- **A file that fails is refused, not partially loaded.** The reasons are distinct and both are
  shown on the status line: a file that is not a save at all, and a save whose contents no
  longer match its checksum. Neither touches the current run

The file is base64 with a checksum rather than plain JSON, so a save is not editable by accident
or by curiosity. It is not a security measure and is not documented as one: engine.js is served
to the browser, so anyone who reads it can recompute both. It raises the cost of nudging a Fear
count from "open the file" to "read the engine" — the localStorage entry was always reachable
from the dev tools, and still is.

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
- **An ability whose automation is owned carries a checkbox in its card**, which is what says
  whether that automation still casts. It sits inside the card, beside the cast button it
  automates — the same rule that puts the auto-wave toggle beside the wave countdown and the
  auto-round toggle beside the round button. Not in the shop row where the upgrade was bought,
  and not collected into a settings panel. It is drawn on ownership (`autoCastOwned`), so it
  appears the instant the upgrade is bought — already ticked, because a player who just paid
  for an automation should not have to click a second time to get it — and never disappears
  again. All five ability automations get one, including the two whose abilities need no
  target: a control that appears on three cards and not the other two is a rule with an
  exception the player has to discover.
- **Three card shapes, not four.** A checkbox cannot live inside a button any more than a
  price button can, so the box forces the same container shape the tiered card already uses.

  | Ability state | Shape |
  | --- | --- |
  | Locked | card container, dimmed, with its price button |
  | Unlocked, automation unowned | a single button |
  | Unlocked, automation owned | container + cast button + a foot holding the checkbox |
  | Tiered (`innate_power`) | as above; the checkbox joins the foot the tier and its price share |

- **Under the Energy purse: where Energy comes from.** It is the one currency the player earns
  by fighting rather than by surviving, and the purse only ever shows a total. The note names
  the income (1/2/3 per Explorer/Town/City, plus Boon of Vigor) and — the part nothing else on
  the page says — that it and everything bought with it reset when a round starts. It names
  `headwaters` as the one thing that reset does not take to zero, since the shop row is
  otherwise the only place a player could learn that a round can open with Energy at all.

## Interaction Rules

- The board is otherwise read-only during a running round: there is no click that pauses,
  skips, or manually triggers a wave.
- Clicking a land always selects it into the detail panel.
- If an ability is armed and the clicked land is a legal target, the click also resolves
  that ability's effect.
- Lands are focusable and activate on Enter and Space. No drag, no hover-only affordance.
- Everything pressable in the ability bar goes dead while the round is not running — the
  Energy, the unlocks, the tiers and the casts are all bought and spent inside a round. The
  **auto-cast checkbox is the one exception and stays live**: it spends nothing, and the shop
  between rounds is exactly where a player decides how the next round should play.
- The checkbox wins the bar's delegated click outright, ahead of the cast surface, the same way
  the two price buttons do. Its new value is read off the box itself rather than derived from
  `autoCastOn`, which is `false` for an automation bought this round — deriving it would make
  the first click of a fresh purchase a no-op that appeared to un-tick itself.

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
- The two halves of the auto-cast checkbox split across that line, and must stay split.
  Whether an automation is **owned** changes a card's *shape*, so it belongs in the ability
  bar's rebuild signature or a purchase leaves the bar without its checkbox. Whether the box is
  **ticked** is patched per frame like every other value: folding it into the signature would
  rebuild the whole bar on every click of the box and destroy the running cooldown sweep, which
  is the exact failure the render/patch split exists to prevent.
- The Dahan strike bar's **fill** is patched per frame like the two bars above it, and the
  fraction is computed **once per frame rather than once per bar** — there is one clock for the
  whole island, so eight bars asking for it separately would be seven wasted answers. Its
  **presence** needs no signature work: whether a chip carries it depends on that land's Dahan
  count and its invader counts, and the board's signature already pushes both per land. The
  bar therefore appears and disappears as a land gains or loses its last invader without a
  click, which is the claim worth watching when this is changed.
- The strike bar carries `data-meter-land` only so the existing per-land patch selector picks
  it up. Nothing reads the id off it, because there is no per-land strike value to read.
- The round controls are patched every frame with the rest of the pacing controls, and the
  shop's rebuild signature does not carry them. It is not the panel they live in, and the
  catalogue reads nothing about them: whether the toggle is owned or on has no bearing on a
  single row of it. Ownership still reaches the signature through the upgrade tiers, which is
  the only part of that purchase the shop actually draws.

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
- **Rail**, four columns: ability bar, then the round controls, then the shop when a round
  has ended, then the log. A single flex column, so the shop appearing pushes the log down
  rather than displacing the board — and so the round controls keep their place whatever the
  catalogue below them grows to.
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
