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

## Required Screen Sections

1. Round HUD
- Round number, and best round reached
- Blight meter: current value against `round.blightThreshold`, always visible, not hidden
  in a panel
- Wave timer: seconds remaining until the next automatic wave
- Fear total (`meta.fear`)
- Active spirit name and trait text

2. Ability bar
- One control per ability the active spirit has unlocked
- Each shows: name, ready/cooldown state, and — while on cooldown — a visible countdown or
  sweep, not just a disabled button with no indication of when it'll be ready
- An ability awaiting a land click (`pendingAbilityTarget` set) reads as active/armed, and
  the board shows which lands are valid targets for it

3. Island board panel
- The board itself: eight lands drawn as one island, ocean along the coast edge, cliffs on
  the others
- Per land, on the board: land number, terrain, invader glyphs with counts (nonzero only),
  Dahan pips, and the Blight already taken there when it is nonzero
- On a land the next wave will Ravage: a colour-coded banner naming the damage it will take,
  the Dahan it will cost, and the counterattack that would answer
- On the land a pending ability target applies to: highlight it as a legal click
- A land detail panel for one selected land: invader counts with partial-HP hints, Dahan,
  Blight taken here, and its neighbours

4. Between-round shop (visible only while `round.status` is `ended`)
- The round just lost: its number and the Fear it earned
- The upgrade catalogue: each entry's effect, its current tier if repeatable, and its cost
- A clear "Start Next Round" control, always available regardless of remaining Fear

5. Log and utility controls
- Event log
- Manual save button
- Wipe save button
- Language toggle

## Ability Status Rules

- An ability control shows one of: ready, on cooldown (with remaining time), or armed
  (waiting for a land click).
- An armed ability can be cancelled by clicking it again, returning
  `pendingAbilityTarget` to `null` without spending the cooldown.

## Map Hint Rules

- Default hint names the board: eight lands, three of them coastal.
- While an ability is armed, the hint names which ability is waiting and what land property
  it needs (holds invaders, is the most-Blighted, etc.).
- While a wave is actively resolving (Ravage/Build/Discover for that tick), the hint names
  the current step and which lands it's acting on.

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
| `wave-active` | A land the next wave's Ravage will act on. |
| `selected` | Open in the detail panel. |
| `out` | Dimmed. Not a legal target for the armed ability. |
| `idle` | Nothing pending here. |

Dimming what isn't a legal target is what makes an ability's targeting rule teachable without
a rulebook.

Two clarifications the implementation forced:

- **`wave-active` means the *next* wave, not one mid-resolution.** A wave resolves
  atomically inside a single tick, so there is no interval during which the player could see
  a Ravage "in progress". What is worth showing is the wave being counted down to, which is
  also the only one the player can still act against.
- **Arming an ability is exclusive.** While `pendingAbilityTarget` is set, every land reads
  as either `legal` or `out` — a wave target that is not a legal click still dims. Legality
  is the only question on screen at that moment, and a second highlight competing with it
  would blunt exactly the teaching that dimming is for. The selection ring is drawn
  independently of the state, so the selected land never disappears.

## Live Update Rules

- Values that change every second (wave timer, ability cooldowns, Blight) must be patched in
  place rather than triggering a map rebuild.
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

## Visual Feedback Rules

- Dahan must be visually separated from invader counts.
- Damaged invaders with health greater than 1 should show remaining HP text.
- Defeats should briefly animate with a pop-style hint.
- Blight gain should be visible at the moment it happens, not only reflected in the meter's
  end value — the player should see *which* land just cost them Blight.

## Layout

Implemented as a twelve-column grid over three regions:

- **HUD**, full width: four tiles (Blight, next wave, Fear, round) plus the invader track
  and the spirit's trait line.
- **Board**, eight columns: map hint, island, land detail panel.
- **Rail**, four columns: ability bar, then the shop when a round has ended, then the log.
  A single flex column, so the shop appearing pushes the log down rather than displacing
  the board.

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

## Implementation Notes

- `ui.js` holds every DOM call and no rules; `engine.js` holds every rule and no DOM. The
  land-state precedence above lives in `engine.js` precisely because it is a rule, which is
  what lets the suite assert it.
- Three render caches gate the expensive work: the board rebuilds only when its own
  signature changes, the ability bar only when the ability set or language changes, the shop
  only when Fear or a tier changes. The HUD, the map hint and the ability countdowns are
  patched in place on every tick instead — no node is created ten times a second.
- The dev fixture `vis.html` paints a mid-round board for layout work without playing to it;
  `vis.html?ended` does the same for the shop.
