# 02 Core Loop

## Intent

Specify the implemented turn loop, action gating, invader advancement, and interactive card resolution.

## Rules

- Exactly one growth option must be chosen each turn before any card play or end turn.
- A pending targeting effect locks other cards, growth changes, and end turn until resolved.
- Card play spends one action charge and the card's energy cost.
- End turn advances invader phases and clears all partial invader damage.

## Core Resources

- Energy: spent to play cards, increased by some growth and card effects.
- Fear: gained from defeating invader health/damage worth. Currently tracked and displayed only.
- Action charges: regenerated over time, capped, and consumed on each card play attempt.

## Turn Sequence

1. Start turn with the current map, hand, action charges, and energy.
2. Choose one growth option.
3. Play zero or more cards while actions and energy allow.
4. Resolve any multi-step targeting effect fully before any other play.
5. End turn.
6. Advance invader phases from Discover to Build to Ravage and draw a new Discover terrain.
7. Reset `turn.powerCardsPlayed` and clear `invaderDamage` carry for the next turn.

## Growth Rules

### `reclaim_and_power`

- Rebuild the deck by shuffling all draw, discard, and hand cards back into hand.
- Gain 1 energy.
- Increment `turn.powerCardsGained` by 1.

### `double_presence`

- Increment `turn.presencesPlaced` by 2.
- No other map effect is implemented yet.

### `power_and_presence`

- Increment `turn.powerCardsGained` by 1.
- Increment `turn.presencesPlaced` by 1.
- No card gain or presence placement effect is implemented yet.

## Invader Loop

- The active lands are `mountains`, `desert`, `jungle`, and `wetlands`.
- `explore` is always drawn from a terrain not already used by `ravage` or `build` when possible.
- On phase advance:
	- the old `build` becomes `ravage`
	- the old `explore` becomes `build`
	- a new `explore` is drawn
- The new `explore` land gains 1 explorer.
- The new `build` land gains a town or city if invaders are already present there.
	- If towns outnumber cities, add 1 city.
	- Otherwise add 1 town.

## Dahan Rules

- Dahan are tracked separately from invaders.
- 3 Dahan are added only on fresh game creation or save wipe restart.
- No more than 2 of those newly added Dahan may be placed in the same terrain during that setup distribution.
- Dahan are currently moved only by River's Bounty.

## Interactive Card Flows

### Wash Away

1. Choose a source terrain with explorers and/or towns.
2. Select up to 3 total explorers and towns.
3. Choose a different destination terrain.
4. Move the selected invaders and clear the pending effect.

### Flash Floods

1. Choose a terrain containing invaders.
2. Choose one target type: explorers, towns, or cities.
3. Deal 1 damage, or 2 damage if the terrain is wetlands.
4. Apply defeat, fear gain, partial damage carry, and clear the pending effect.

### River's Bounty

1. Choose a destination terrain.
2. Choose one or more source terrains.
3. Each source click moves 1 Dahan into the destination, up to 2 total.
4. Press Finish Gather to resolve the effect.
5. If the destination then has at least 2 Dahan, add 1 Dahan there and gain 1 energy.

## Damage Rules

- Explorers have 1 health and 1 damage.
- Towns have 2 health and 2 damage.
- Cities have 3 health and 3 damage.
- Dahan have 2 health and 2 damage.
- Partial invader damage is tracked per terrain and per invader type within the turn.
- Partial invader damage is cleared on end turn.

## Acceptance

- The user cannot play cards before choosing growth.
- The user cannot play another card or end the turn while Wash Away, Flash Floods, or River's Bounty is pending.
- Push, gather, and damage outcomes all produce visible map or log feedback.
