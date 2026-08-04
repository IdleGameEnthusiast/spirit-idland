# 06 UI Contract

## Intent

Keep the current one-screen browser UI stable while card interactions expand.

## Rules

- The page must keep all critical turn information visible without navigation.
- Terrain is represented as four fixed panels, not a freeform map.
- Active targeting effects must communicate both the current step and the allowed clicks.

## Required Screen Sections

1. Core metrics
- Energy value
- Fear value
- Runtime minutes
- Active spirit name and trait text

2. Turn and card flow
- Current turn number
- Chosen growth label
- Growth option buttons
- Draw, discard, and hand counts
- Hand card list with cost, status, and play button

3. Invader phase track
- Ravage terrain
- Build terrain
- Discover terrain

4. Area type map panel
- One panel each for mountains, desert, jungle, and wetlands
- Invader counts for explorers, towns, cities
- Dahan count separated visually from invaders
- Context actions for Wash Away, Flash Floods, and River's Bounty
- Partial HP hints for damaged invaders
- Temporary defeat animation hint

5. Log and utility controls
- Event log
- Manual save button
- Wipe save button
- Language toggle

## Card Status Rules

- Cards in hand show playable or blocked state.
- Cards in discard show used-until-reclaim state.
- Unplayable reasons must resolve to one of:
	- growth not chosen
	- pending targeting effect
	- no action charges
	- insufficient energy

## Map Hint Rules

- Default hint explains the four terrain panels.
- While Wash Away is pending, the hint reflects source, unit selection, or destination step.
- While Flash Floods is pending, the hint reflects land selection or target selection.
- While River's Bounty is pending, the hint reflects destination or source selection.

## Interaction Rules

- End Turn is disabled until growth is chosen.
- End Turn is also disabled while any targeting effect is pending.
- Map actions are button-driven; no drag or hidden gesture is required.
- River's Bounty destination shows progress and a finish action in the destination panel.
- Wash Away unit selection uses explicit plus and minus controls.

## Visual Feedback Rules

- Dahan must be visually separated from invader counts.
- Damaged invaders with health greater than 1 should show remaining HP text.
- Defeats should briefly animate with a pop-style hint.

## Acceptance

- A player can identify the current turn lock reason without opening dev tools.
- Every multi-step card effect is actionable from the map panels alone.
- The map remains readable after Dahan, damage hints, and action buttons are present.
