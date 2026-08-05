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
- The shop replaces the board's action area only while `round.status` is `ended`; the board
  itself stays visible underneath as the frozen result of the round just lost.

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
  and Dahan pips
- On the land the pending invader phase (current wave, mid-resolution) is acting on: a
  colour-coded banner naming what's happening there
- On the land a pending ability target applies to: highlight it as a legal click
- A land detail panel for one selected land: invader counts with partial-HP hints, Dahan,
  and its neighbours

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
| `wave-active` | A land the wave currently resolving is acting on. |
| `selected` | Open in the detail panel. |
| `out` | Dimmed. Not a legal target for the armed ability, and not part of the active wave step. |

Dimming what isn't a legal target is what makes an ability's targeting rule teachable without
a rulebook.

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

## Acceptance

- A player can tell how close the round is to ending without opening any panel.
- Every ability's state (ready, on cooldown, armed) is visible without hovering.
- A player can tell what the current wave step is doing, and where, without it needing to be
  explained.
- The board is legible at a glance: which lands are under pressure, where Dahan still stand.
- The shop is reachable the instant a round ends, with no extra click to "acknowledge" the
  loss first.
