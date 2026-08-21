/* ------------------------------------------------------------------ *
 * Content registry: spirits, abilities, cards, upgrades
 * ------------------------------------------------------------------ *
 *
 * The catalogues, as data. What exists in the game and what it costs -
 * Spec: docs/spec/07-content-registry.md, docs/spec/05-progression.md, docs/spec/10-power-cards.md
 */

/* ------------------------------------------------------------------ *
 * Content registry (07-content-registry.md)                            *
 * ------------------------------------------------------------------ */

const SPIRITS = {
  core_spirit_01: {
    id: "core_spirit_01",
    name: "Sonnengenährter Fluss",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Ströme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
    traitsEn: "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
    // The spirit's whole kit, in bar order: the Innate first because it is the only one that
    // grows, then the free faucet, then the three Energy unlocks in ascending price. The bar
    // reads top to bottom as the order a round is actually built in.
    abilityIds: ["innate_power", "boon_of_vigor", "rivers_bounty", "flash_floods", "wash_away"],
    // What every round opens with. The rest are locked behind Energy earned in that same
    // round, so round one is two abilities used well rather than five used at random.
    startingAbilityIds: ["innate_power", "boon_of_vigor"],
    // The baseline Dahan placement every round starts from, before upgrades. Six across
    // eight lands, skipping 3 and 8 - the two lands hardest to reinforce later.
    roundStartDahan: { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }
  }
};

// The spirit's kit. `unlockCost` is what the ability costs in Energy this round - 0 means it
// is in the opening hand. The ladder 5 / 10 / 20 is deliberately steep against a round's
// income: the three unlocks together are about one early round's worth, so which two you buy
// is the round's first real decision.
//
// The Innate is the one ability that grows rather than being bought once. Its `tiers` array
// replaces the record wholesale - text, cooldown, effect and all - so tier 2 is not tier 1
// with a modifier, it is a different ability standing in the same slot. Read one with
// abilityRecord(), never by reaching into ABILITIES directly, or a tiered ability will
// silently answer with its tier-1 self.
//
// Cooldowns rise with the tier on purpose. Throughput still improves at every step - tier 2
// is three pushes and 2 damage per 15 beats against tier 1's one push per 8 - so the longer
// wait buys a bigger swing rather than taxing the upgrade. Each tier carries its own Focus
// ladder for the same reason the cooldowns differ: see the tiers below.
//
// Every cooldown here is written as beats times TIME_SCALE, the same dial the wave interval
// turns on. That is what keeps a cast rate a cast rate: an ability that fired twice a wave at
// scale 1 fires twice a wave at any scale, because both clocks stretched together.
const ABILITIES = {
  innate_power: {
    id: "innate_power",
    unlockCost: 0,
    // Focus is priced per tier, not once for the ability - see the three `focusBaseCost` lines
    // below and 04-economy-formulas.md#the-innates-three-ladders. Nothing is named up here,
    // because a single anchor cannot be right for all three: the same beat is worth 12.5% of
    // tier 1's clock and 4.5% of tier 3's.
    //
    // The Energy carries across an upgrade rather than the rungs (abilityFocusPurchases reads
    // the *investment*, not a count), so a tier change never burns a Focus purchase - it
    // re-reads it against the new ladder and discounts the next rung by whatever is left over.
    tiers: [
      {
        cooldownSeconds: 8 * TIME_SCALE,
        needsTarget: true,
        effect: "push_invaders",
        pushCount: 1,
        // Five rungs at 3/5/7/10/15, 8 -> 3 beats. The Boon's ladder truncated, and on purpose:
        // one push is the cheapest cast in the kit, so its ladder is priced at the cheapest
        // rung the game has. The whole ladder costs 40 Energy, which is exactly `upgradeCost`
        // below - so the round's first real question about the Innate is "run this one faster,
        // or make it something bigger", at one price.
        focusBaseCost: 3,
        focusCostGrowth: 1.5,
        focusStepBeats: 1,
        focusFloorBeats: 3,
        upgradeCost: 40
      },
      {
        cooldownSeconds: 15 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_and_push",
        damage: 2,
        pushCount: 3,
        // Ten rungs at 8/12/18/27/41/61/91/137/205/308, 15 -> 5 beats. The same length and the
        // same 15-beat clock as rivers_bounty, priced at 1.6x it rung for rung: two damage and
        // three pushes is worth a good deal more than one Dahan, and unlike the Boon it pays
        // back in nothing Focus can be bought with.
        focusBaseCost: 8,
        focusCostGrowth: 1.5,
        focusStepBeats: 1,
        focusFloorBeats: 5,
        upgradeCost: 150
      },
      {
        cooldownSeconds: 22 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_each_invader",
        damage: 2,
        // Fourteen rungs at 25 growing 1.25, 22 -> 8 beats, 2173 Energy for the lot - a shade
        // over wash_away's 2058, on a cast that hits every invader in the land rather than one.
        // The gentler 1.25 is the long-ladder rule (see flash_floods): 1.5 over fourteen rungs
        // would end at 8400 and the tail would be decoration.
        //
        // This is the one opening rung in the game priced *above* an unlock, and deliberately:
        // the natural way to arrive here is with tier 2's Focus investment carried in, which
        // pays for the first several rungs outright. 25 is what the ladder costs the player who
        // banked everything into tiers instead - who has the Energy, and has bought nothing to
        // show for it yet.
        focusBaseCost: 25,
        focusCostGrowth: 1.25,
        focusStepBeats: 1,
        focusFloorBeats: 8,
        upgradeCost: Infinity
      }
    ]
  },
  boon_of_vigor: {
    id: "boon_of_vigor",
    unlockCost: 0,
    cooldownSeconds: 12 * TIME_SCALE,
    // Focus, in full: eight rungs at 3/5/7/10/15/23/34/51 Energy taking it 12 -> 4 beats, one
    // beat at a time. Both numbers are the derived defaults written out - a third of 12 is
    // exactly 4 - and they are stated here anyway, because this is the ability the ladder was
    // tuned on and a later change to its cooldown must not quietly move its floor with it.
    focusStepBeats: 1,
    focusFloorBeats: 4,
    needsTarget: false,
    effect: "gain_energy",
    amount: 1
  },
  // The one ability that picks its own land: the thinnest-held land under attack, or simply
  // the thinnest-held land when nothing is under attack. It needs no click because there is
  // only ever one answer to "where is this most needed", and asking would be asking the
  // player to re-derive it.
  rivers_bounty: {
    id: "rivers_bounty",
    unlockCost: 5,
    cooldownSeconds: 15 * TIME_SCALE,
    // Ten rungs at 5/8/11/17/25/38/57/85/128/192 Energy, 15 -> 5 beats. Its own unlock price
    // anchors the ladder, which is why it costs half again what the Boon's does at every rung:
    // the Boon pays Focus back in the currency Focus is bought with and this does not, so a
    // rung here competes with unlocking Wash Away rather than funding itself.
    focusStepBeats: 1,
    focusFloorBeats: 5,
    needsTarget: false,
    effect: "add_dahan",
    amount: 1
  },
  flash_floods: {
    id: "flash_floods",
    unlockCost: 10,
    cooldownSeconds: 25 * TIME_SCALE,
    // Sixteen rungs, 25 -> 9 beats. Two departures from the kit's defaults, both forced by the
    // length of that ladder. It opens at 5 rather than at its own 10 Energy unlock, because one
    // beat off 25 is a 4% gain and 10 Energy for 4% would be the worst purchase in the game;
    // and it grows at 1.3 rather than 1.5, which over sixteen rungs is the difference between a
    // 256 Energy last rung and a 2189 one nobody would ever see.
    focusStepBeats: 1,
    focusFloorBeats: 9,
    focusBaseCost: 5,
    focusCostGrowth: 1.3,
    needsTarget: true,
    effect: "flood_damage",
    damage: 1,
    coastalBonus: 1
  },
  // The one ability that can take a unit off the island without hurting it. Inland it is a
  // shove; from a coastal land the water keeps going and what it carries does not come back.
  // `seaCount` is under `pushCount` on purpose - a shove is cheap and a one-way trip is not.
  wash_away: {
    id: "wash_away",
    // Dearer than Flash Floods (10), because removal outlives damage: 2 points buy less at
    // every rung of the invader health ladder, and a drowning buys the same thing on wave 40
    // as it did on wave 1.
    unlockCost: 20,
    cooldownSeconds: 30 * TIME_SCALE,
    // The longest ladder in the kit: twenty rungs, 30 -> 10 beats, 2058 Energy end to end. It
    // opens at 6 for the same reason the Floods opens at 5 - a beat off 30 is only 3.4% - and
    // 6 is what parity with the Floods' opening rung costs once a Wash cast is counted at
    // roughly twice a Floods cast, which is what their unlock prices already say. The check on
    // 1.25 is cumulative-to-equal-rate: the Floods reaches 1.11 casts a wave for 1092, this
    // reaches 1.00 for 2058 - about twice the price for a slightly slower clock, on a cast
    // worth about twice as much.
    focusStepBeats: 1,
    focusFloorBeats: 10,
    focusBaseCost: 6,
    focusCostGrowth: 1.25,
    needsTarget: true,
    effect: "wash_invaders",
    pushCount: 3,
    seaCount: 2
  }
};

/* ------------------------------------------------------------------ *
 * Power cards (10-power-cards.md)                                      *
 *                                                                      *
 * A third source of power beside the kit and the two shops: bought      *
 * once with Presence, handed to a round by depth, and cast like an      *
 * ability. Presence buys possibility; the round buys the moment - a     *
 * card in `powerCards.owned` does nothing at all until a round has      *
 * survived to a draw wave and been handed it.                          *
 * ------------------------------------------------------------------ */

// Buying: the draw row in the Presence shop. Three offered, one kept, on the same 1.6 curve
// every ladder in the game uses. All seven cost 432 Presence together - a mid-cycle sink, and
// the first Presence row that out-earns simply holding the points.
const POWER_CARD_DRAW_BASE_COST = 10;
const POWER_CARD_DRAW_GROWTH = 1.6;
const POWER_CARD_REROLL_DIVISOR = 4;
const POWER_CARD_OFFER_SIZE = 3;
// What a paid re-roll guarantees: this many cards the current offer does not hold, whenever
// the unowned pool is large enough to promise them. Below that the button goes dead rather
// than taking Presence for an offer it cannot change - see rerollPowerCardOffer.
const POWER_CARD_REROLL_GUARANTEE = 2;

// Holding: the drip. 25 / 45 / 65 at tier 0, so the shallow rounds of a fresh cycle draw
// nothing and a round reaching wave 70 draws three.
const POWER_CARD_FIRST_DRAW_WAVE = 25;
const POWER_CARD_DRAW_INTERVAL_BASE = 20;
const POWER_CARD_INTERVAL_MAX_TIER = 10;
// The Energy fee for throwing a freshly drawn card back, times the draws taken this round.
// Flat where Energy income is not, deliberately: it is an early-round constraint, and by the
// third draw it is nothing. If it should bite all round the lever is the growth, not the base.
const POWER_CARD_REDRAW_BASE_ENERGY = 10;

/* The seven cards.
 *
 * Cooldowns are authored in beats times TIME_SCALE, exactly like the kit, so a card cast rate
 * is a cast rate at any speed.
 *
 * Every card names its whole Focus ladder, the same four figures the tuned kit abilities name.
 * The anchors are not the cooldown in beats they used to be - that read the dial backwards.
 * Divide each tuned kit anchor by the percentage of clock its first rung buys and one number
 * falls out, the same one in every case: what a cast is worth.
 *
 *     boon 3/8.3% = 0.36    bounty 5/6.7% = 0.75    innate t2 8/6.7% = 1.20
 *     floods 5/4.0% = 1.25  wash 6/3.3% = 1.80      innate t3 25/4.5% = 5.50
 *
 * So `anchor = worth * 100 / cooldownBeats`, and the cooldown enters only as a divisor. That is
 * why Wash Away, the strongest cast in the kit, opens at 6 while the Innate's tier 3 opens at
 * 25: a beat off 30 is 3.3% of a clock and a beat off 22 is 4.5%. Anchoring a card on its own
 * cooldown inverted that - it charged the most for the beat worth the least, putting Tsunami's
 * opening rung at 50 Energy for a 2% gain, the worst purchase in the game, and running its tail
 * out to a twenty-one-million-Energy rung no round could ever see. The worths below are stated
 * per card; the anchors they produce land in a 16-25 band, which is the honest result: every
 * card is a strong cast on a clock scaled to its strength, so they all price a beat alike.
 *
 * Growth follows the kit's length rule - up to ten rungs 1.5, thirteen to sixteen 1.3, twenty
 * 1.25 - extrapolated one notch for Tsunami's thirty-three. Floors stay a third of the
 * cooldown, so the invariant every ability holds to holds here too: three times the cast rate
 * the round started it at, however long the ladder.
 *
 * Where a kit ability carries one `effect` string, a card carries an ordered `effects` list -
 * every one of these is two to four clauses with conditions, and the five kit abilities are
 * left exactly as they are. See applyCardEffect for the resolver, and cardStepApplies for the
 * conditions.
 */
const POWER_CARDS = {
  pull_beneath: {
    id: "pull_beneath",
    cooldownSeconds: 10 * TIME_SCALE,
    // Worth 2.5: about twice a Flash Floods cast on the damage alone, plus 3 Fear. Six rungs at
    // 25/38/56/84/127/190, 10 -> 4 beats, 520 all told.
    focusBaseCost: 25,
    focusCostGrowth: 1.5,
    focusStepBeats: 1,
    focusFloorBeats: 4,
    needsTarget: true,
    target: "invaders",
    effects: [
      { kind: "fear_flat", amount: 3 },
      // The same shape flash_floods uses for `coastalBonus`, deliberately. The +1 is what
      // keeps it killing Towns past wave 110, where the health rung stops a flat 2.
      { kind: "damage", amount: 2, terrainBonus: 1, terrains: ["desert", "wetlands"] }
    ]
  },
  // Honestly a two-mode card rather than a conditional one: the `else` is player-controlled,
  // so targeting a land with no Explorers always takes the removal. Its shape drifts on its
  // own over a round - Explorers thin out as Builds turn them into Towns, so it starts as a
  // clearing tool and ends as a removal card without any rule saying so.
  song_of_sanctity: {
    id: "song_of_sanctity",
    cooldownSeconds: 10 * TIME_SCALE,
    // Worth 1.6, the cheapest ladder of the seven: Explorer removal is narrow, and it narrows
    // further as Builds turn the Explorers into Towns. Six rungs at 16/24/36/54/81/122, 333.
    focusBaseCost: 16,
    focusCostGrowth: 1.5,
    focusStepBeats: 1,
    focusFloorBeats: 4,
    needsTarget: true,
    target: "explorers_or_blight",
    effects: [
      { kind: "destroy_units", unitType: "explorers", amount: 1, when: "explorers_present" },
      { kind: "push_all", unitType: "explorers", when: "explorers_present" },
      { kind: "remove_blight", amount: 1, when: "else" }
    ]
  },
  // The two clauses are independent: a Desert land with no invaders still gets its removal,
  // and a Jungle land full of Cities still pays its Fear.
  uncanny_melting: {
    id: "uncanny_melting",
    cooldownSeconds: 12 * TIME_SCALE,
    // Worth 2.9, the highest of the four short cards: Fear *per invader* scales with the stack,
    // so a heavy land pays 15-30. Eight rungs at 24/36/54/81/122/182/273/410, 12 -> 4, 1182.
    focusBaseCost: 24,
    focusCostGrowth: 1.5,
    focusStepBeats: 1,
    focusFloorBeats: 4,
    needsTarget: true,
    target: "invaders_or_terrain_blight",
    blightTerrains: ["desert", "wetlands"],
    effects: [
      { kind: "fear_per_invader", amount: 3, when: "invaders_present" },
      { kind: "remove_blight", amount: 1, when: "terrain:desert,wetlands" }
    ]
  },
  // Never fails, since Defend always applies - so it takes any land at all.
  natures_resilience: {
    id: "natures_resilience",
    cooldownSeconds: 12 * TIME_SCALE,
    // Worth 2.4: Defend 6 is prevention and the Blight removal is durable, but neither scales
    // with the land the way melting's Fear does. Eight rungs at 20/30/45/68/101/152/228/342, 986.
    focusBaseCost: 20,
    focusCostGrowth: 1.5,
    focusStepBeats: 1,
    focusFloorBeats: 4,
    needsTarget: true,
    target: "any",
    effects: [
      { kind: "defend", amount: 6, scope: "target" },
      { kind: "remove_blight", amount: 1 }
    ]
  },
  // An early-board card the player cannot own before wave 25, and that is known rather than
  // overlooked: unused wards accumulate on quiet lands, so it banks value against the spread
  // of the invaders rather than against the current wave - and it is exactly the card the
  // Energy re-draw exists to throw back at wave 65.
  encompassing_ward: {
    id: "encompassing_ward",
    cooldownSeconds: 20 * TIME_SCALE,
    // Worth 3.4 - island-wide and needs no target, and unused wards bank on quiet lands - which
    // on a 20-beat clock still anchors under the short cards. Thirteen rungs, growth 1.3 by the
    // length rule: 17/22/29/37/49/63/82/107/139/180/234/305/396, 20 -> 7 beats, 1660.
    focusBaseCost: 17,
    focusCostGrowth: 1.3,
    focusStepBeats: 1,
    focusFloorBeats: 7,
    needsTarget: false,
    effects: [
      { kind: "defend", amount: 2, scope: "all" }
    ]
  },
  // The best-shaped card of the seven and the one to copy: it pays in all three currencies
  // the round cares about, on a cooldown that makes each payment a decision.
  accelerated_rot: {
    id: "accelerated_rot",
    cooldownSeconds: 30 * TIME_SCALE,
    // Worth 5.4, level with the Innate's tier 3 (5.5) - it pays in all three currencies the
    // round cares about. Twenty rungs at growth 1.25, the same shape as wash_away's ladder and
    // three times its price at every rung: 18 -> 1249, 6173 end to end, 30 -> 10 beats. The
    // dearest ladder in the game bar one, on the best-shaped card of the seven.
    focusBaseCost: 18,
    focusCostGrowth: 1.25,
    focusStepBeats: 1,
    focusFloorBeats: 10,
    needsTarget: true,
    target: "invaders_or_blight",
    effects: [
      { kind: "fear_flat", amount: 10 },
      { kind: "damage", amount: 5 },
      { kind: "remove_blight", amount: 1 }
    ]
  },
  // The longest cooldown in the game, and dead whenever the pressure has gone inland - only
  // lands 1, 2 and 3 are coastal. That is its weakness and it is the right kind: positional,
  // readable off the board, and answered by a kit whose pushes already walk stacks seaward.
  tsunami: {
    id: "tsunami",
    cooldownSeconds: 50 * TIME_SCALE,
    // Worth 8.5: the biggest cast in the game, discounted about 15% for being dead whenever the
    // pressure has gone inland. On a 50-beat clock that anchors at 20 - *below* pull_beneath's
    // 25, which is the whole correction: a beat off 50 is 2% of the clock and a beat off 10 is
    // 10%, so the slowest card buys the cheapest beat, exactly as wash_away does in the kit.
    //
    // Thirty-three rungs, the longest ladder in the game by half again, which is what forces
    // growth down to 1.12 - the long-ladder rule one notch past wash_away's 1.25. At 1.25 the
    // last rung would be 34 000 and thirty of the thirty-three would be decoration; at 1.12 it
    // is 752, and 6847 end to end puts it a shade over accelerated_rot, which is right.
    focusBaseCost: 20,
    focusCostGrowth: 1.12,
    focusStepBeats: 1,
    focusFloorBeats: 17,
    needsTarget: true,
    target: "coastal_invaders",
    effects: [
      { kind: "fear_flat", amount: 10 },
      { kind: "damage", amount: 8 },
      { kind: "destroy_dahan", amount: 2 }
    ],
    // The optional half, and it costs zero extra clicks: a sliding switch on the card, default
    // on, remembered across casts and rounds - the same control and the same reasoning as the
    // auto-cast switches. Two cast buttons would charge a click on every cast for a decision
    // the player changes twice a round.
    alsoEachOtherCoastal: [
      { kind: "fear_flat", amount: 5 },
      { kind: "damage", amount: 4 },
      { kind: "destroy_dahan", amount: 1 }
    ]
  }
};

const POWER_CARD_IDS = Object.keys(POWER_CARDS);

// Every card option the UI remembers, with its default. One key today; it is a map rather
// than a boolean so the second card wanting a switch is content, not code.
const POWER_CARD_OPTION_DEFAULTS = { tsunami: true };

// A card is an ability in every respect that matters, so everything in the ability runtime
// reads its record through here rather than out of ABILITIES directly. The kit wins a name
// clash, which cannot happen today and should stay harmless if it ever does.
function abilityBaseRecord(abilityId) {
  return ABILITIES[abilityId] || POWER_CARDS[abilityId] || null;
}

function isPowerCard(abilityId) {
  return Boolean(POWER_CARDS[abilityId]);
}

// Costs scale with the tier already owned, so the shop stays a choice rather than a
// checklist. 1.6x per tier outruns what a tier is worth: with attrition flat, a Dahan tier
// buys about 11% more income, so the price pulls away from the payoff instead of chasing it.
const UPGRADE_COST_GROWTH = 1.6;

/* ---------- Four groups, in this order ----------
 *
 * The shop draws a divider wherever `group` changes, so the order below *is* the order on the
 * shelf and a row's group is the only thing that decides which heading it lands under. Keep
 * each group's rows contiguous - a row that sorted away from its own kind would draw its
 * group's heading a second time (`tests/shop.test.js` checks this).
 *
 *   waves      - what buys a longer round: the Energy it opens with, the Blight it survives,
 *                how soon the island hands over the next card
 *   fear       - what buys a richer round: the three Fear ladders
 *   dahan      - what buys the Dahan: more of them, and a faster strike
 *   automation - the one-offs, and every one of them is an automation
 *
 * Repeatable tiers still come before the one-off unlocks, because `automation` is last and is
 * where every one-off lives.
 */
const UPGRADES = {

  /* ---------- Wave progression: the rows that buy a deeper round ---------- */
  headwaters: {
    id: "headwaters",
    group: "waves",
    repeatable: true,
    effect: "starting_energy_per_tier",
    // The gain per tier is not flat, so it lives in STARTING_ENERGY_BY_TIER rather than here -
    // see the note above that table for why this ladder is shaped against the grain of every
    // other one. `maxTier` is its length: the ladder ends where the unlock kit does.
    //
    // Priced from the same 8 the ladder needs to reach 344 at tier 9, which is 903 Fear for
    // the whole thing - the dearest row in the catalogue, above auto_start_round (500). It
    // should be: what it ends at is the full kit in hand before the first wave, every round,
    // forever. It is also the one upgrade whose worth *shrinks* with depth, the exact inverse
    // of high_water_mark - a run to wave 100 barely notices its first thirty seconds. This
    // pays for playing; the Mark pays for pushing.
    baseCost: 8,
    maxTier: STARTING_ENERGY_BY_TIER.length - 1
  },
  blight_resilience: {
    id: "blight_resilience",
    group: "waves",
    repeatable: true,
    effect: "blight_threshold_per_tier",
    // Cheap and capped on purpose. Invader power grows faster than linearly, so Blight
    // accrues faster than the threshold can be raised: ten tiers measured at +6% round
    // length. It is a small comfort for an early round, priced like one, and it is not the
    // shop's growth lever - reinforcement and the one-offs are.
    baseCost: 3,
    maxTier: 5
  },

  /* ---------- The row that shortens the drip ----------
   *
   * The one thing Fear should buy about power cards: how fast a round rebuilds itself. It buys
   * no card, multiplies no card, and casts no card - it only moves the wave the next one
   * arrives on, one wave a tier, from 20 down to 10.
   *
   * Its rungs are lumpy, deliberately and unavoidably. Draws land at 25, 25+I, 25+2I against a
   * round of integer waves, so a tier only pays when it moves a draw under the round ceiling:
   * at a 70-wave round tier 5 is the first purchase that adds a card and tier 10 is the second,
   * while at 150 waves nearly every rung is live. That is high_water_mark's shape exactly -
   * near-worthless to a player dying early, excellent to one pushing deep - and it is this
   * row's argument for existing. If the ladder reads dead in play the fallback is four tiers of
   * 20 -> 17 -> 14 -> 11, where every purchase visibly moves something.
   *
   * 5,448 Fear for the whole ladder, priced knowing it nearly doubles the catalogue's total.
   *
   * The one row in the catalogue that is not on the shelf from the start. It prices the gap
   * between cards to a player who has never seen one - its whole text is about a drip they
   * have no cards to receive - so it stays off the list until the first card is bought. That
   * is `revealedBy`, a reveal and not a lock: see the note above upgradeRevealed for why the
   * distinction is the whole point.
   */
  power_card_interval: {
    id: "power_card_interval",
    group: "waves",
    repeatable: true,
    maxTier: POWER_CARD_INTERVAL_MAX_TIER,
    effect: "power_card_interval_per_tier",
    revealedBy: "power_card_owned",
    baseCost: 30
  },

  /* ---------- Fear generators: the three Fear ladders ----------
   *
   * One shape read three times: ten tiers, +10% a tier, +100% at the top, on the 1.6 curve
   * every other repeatable uses. At 1.6 a tier costs 60% more than the one under it while
   * paying the same flat +10%, so the price pulls away from the payoff on its own: tier 1 pays
   * for itself in about two rounds, tier 10 in over a hundred.
   *
   * They used to carry no `maxTier` at all - soft-capped, stopped by the curve rather than by
   * a number - and the reason was structural rather than numeric. The Fear shop was the game's
   * only progression axis, so it had to keep absorbing income forever or the game ran out of
   * progression. Ascension is that axis now, and a catalogue whose size Presence grows does not
   * need a row with no top. Ten tiers is the whole matched set: +100% each, finishable, and
   * able to reach the shop's sold-out half like every other row.
   *
   * Tier 12 alone cost more than the whole ten-tier ladder, so the cap removes rungs nobody was
   * going to buy and turns "this never ends" into a number a player can plan against.
   */
  rising_dread: {
    id: "rising_dread",
    group: "fear",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_kill_bonus_per_tier",
    // The cheapest ladder in the shop and deliberately the strongest early buy: at 6 Fear it
    // pays back inside two rounds. It is priced under dahan_reinforcement (10) without being
    // strictly better than it - the Dahan tier buys survival as well as income, and this buys
    // only income - so the opening move becomes a choice rather than a script.
    baseCost: 6
  },
  mounting_terror: {
    id: "mounting_terror",
    group: "fear",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_wave_bonus_per_tier",
    // Same price as rising_dread on purpose, even though wave Fear is the smaller half of the
    // income and falls further behind at every damage rung of the ladder. What squares the two
    // is high_water_mark below: it multiplies the milestone payout too, which is the half of
    // wave income that grows with depth. Bought alone this is the weaker ladder; bought
    // alongside the Mark it is the multiplier on the fastest-growing number in the game.
    baseCost: 6
  },
  high_water_mark: {
    id: "high_water_mark",
    group: "fear",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_wave_milestone_per_tier",
    // Every tenth wave pays a bonus of `tier * 10%` of its own number. Wave 50 at tier 3 pays
    // 15. That makes the total quadratic in depth - a run to wave 10m collects
    // `tier * m(m+1)/2` - against the flat 1-per-wave the baseline pays, which is the one
    // thing in the shop whose worth grows faster than the invaders do.
    //
    // Twice the base of the other two because each tier is worth roughly 3-5x as much at
    // depth (about 55 Fear a run at wave 100 against a multiplier tier's 10-20). It is still
    // the weakest of the three for a player dying at wave 30, where a tier is worth about 6 a
    // run - which is the point: this is the ladder that pays for pushing rather than for
    // playing, and it should not be the obvious first buy.
    baseCost: 12
  },

  /* ---------- The Dahan: the two rows that buy the island's own defenders ---------- */
  dahan_reinforcement: {
    id: "dahan_reinforcement",
    group: "dahan",
    repeatable: true,
    effect: "dahan_bonus_per_tier",
    baseCost: 10,
    // Past eight the island runs out of room to spread them and the tiers stop paying.
    maxTier: 8
  },

  /* ---------- The Dahan Remember: a pool, not a ladder ----------
   *
   * Every other row in the shop asks the same question - is the next tier worth its price -
   * and the answer is a yes or a no. This one asks nothing. Fear goes in at one Fear a tier,
   * flat, forever, and what comes back out is haste on the Dahan's strike clock at exactly
   * the rate it went in. A tier here is not a rung; it is a unit of the pool, which is why
   * the row shows a percentage where every other repeatable shows "Tier n" - the tier number
   * is an implementation detail and 4271 of them is not a thing to tell a player.
   *
   * `costGrowth: 1` is the whole of what makes it a pool. The 1.6 curve everywhere else is
   * there to keep a ladder a decision; a sink is the opposite of a decision, and a sink whose
   * price climbed would just be another ladder with a worse name.
   *
   * Its 10000 was priced when the Fear shop was the only progression axis and the pool had to
   * absorb income forever. Ascension is that axis now, so this is a deep row that gets wiped
   * like every other - deep enough that early cycles will not fill it, which makes it scenery
   * for a while rather than a trap. The figure is left alone deliberately until a played cycle
   * says what a cycle actually generates.
   */
  dahan_remember: {
    id: "dahan_remember",
    group: "dahan",
    repeatable: true,
    effect: "dahan_attack_haste",
    // One Fear, one hundredth of a percent, and the cap is the whole pool - see
    // DAHAN_HASTE_FEAR_FOR_FULL for why the price is what it is.
    baseCost: 1,
    costGrowth: 1,
    maxTier: DAHAN_HASTE_FEAR_FOR_FULL,
    // What the row offers instead of a single Buy. A pool this deep cannot be filled a click
    // at a time, and the small denominations stay because the last few hundred Fear before
    // the cap should not have to be overpaid in thousands.
    bulkAmounts: [1, 10, 100, 1000]
  },

  /* ---------- Automation: the one-off half of the shelf ---------- */
  auto_boon: {
    id: "auto_boon",
    group: "automation",
    repeatable: false,
    effect: "auto_cast_boon",
    // Priced as comfort, not as power. Measured against a player who was already clicking the
    // Boon on cooldown it is worth 0-2% more Fear a round: it buys back a click every twelve
    // beats and nothing else. Roughly one round's income, which is what a convenience
    // should cost - the shop's power lives in the ladders above.
    baseCost: 25
  },
  auto_innate: {
    id: "auto_innate",
    group: "automation",
    repeatable: false,
    effect: "auto_cast_innate",
    // Priced well above auto_boon (25): the Innate fires more often at every tier (8/15/22
    // beats against the Boon's flat 12) and, unlike the Boon, its cast is a real decision -
    // which land - that this buys back rather than a fixed no-target effect. It stays a
    // one-time comfort purchase, just a pricier one.
    baseCost: 100
  },
  // The three ability automations below are ranked by what their ability puts on the board or
  // takes off it, not by how much clicking they save: the Bounty reinforces, the Floods kill,
  // and the sea removes. Each rung up is a stronger claim on the round than the one under it.
  auto_bounty: {
    id: "auto_bounty",
    group: "automation",
    repeatable: false,
    effect: "auto_cast_bounty",
    // The cheapest of the three, because it is the only one whose ability picks its own land -
    // there is no judgement here to buy back, only the click. What it sells is a Dahan every
    // 15 beats, all round, which is the same thing the reinforcement ladder sells and is worth
    // more than the ladder's last rung (10 * 1.6^7, about 268) charges for a single one. It is
    // priced under that rung deliberately: the ladder is the early game's lever and this is
    // the thing that eventually replaces it.
    baseCost: 200
  },
  auto_flash_floods: {
    id: "auto_flash_floods",
    group: "automation",
    repeatable: false,
    effect: "auto_cast_flash_floods",
    // Dearer than the Bounty because it kills, and a defeat pays Fear and Energy at once
    // where a Dahan only holds ground. Cheaper than the sea because what it kills with is
    // damage, and 2 points buy fewer bodies at every rung of the invader health ladder: this
    // is the one automation on this list whose worth thins out as the round climbs.
    baseCost: 300
  },
  auto_wash_away: {
    id: "auto_wash_away",
    group: "automation",
    repeatable: false,
    effect: "auto_cast_wash_away",
    // The dearest of the three, and the only automation whose worth *grows* with the round.
    // The sea takes a unit off the island whole, so it pays a defeat's Fear and Energy without
    // spending damage to do it - and it costs the same on the fortieth wave as on the first,
    // while every damage number in the kit is losing ground to invader health. It stays under
    // auto_start_round (500), which is still the only purchase that changes the shape of the
    // game rather than a number in it.
    baseCost: 400
  },

  /* ---------- The two rows that take the hand off the game ----------
   *
   * The last two automations, and the only ones that stop the player driving rather than stop
   * them clicking a particular button.
   *
   * Both used to be unreachable by Fear alone: each named a Presence row in `presenceUnlock`,
   * and the Fear price was owed again every cycle after it. Presence grants automations
   * outright now (see PRESENCE_UPGRADES), so the row that used to open these buys them, and
   * the lock has nothing left to do - deleted along with `presenceUnlock` itself and
   * `upgradeNeedsPresence`. What the price below buys is the cycles *before* that Presence row:
   * a first cycle that saves 500 Fear can idle itself, and every cycle after the grant gets it
   * for nothing.
   *
   * They were behind a completion gate before that - refused until every other row was maxed,
   * ~2674 Fear and something like ninety hand-played rounds before the game would play itself.
   * Both gates are gone for the same reason: a shop that finishes, and a row reachable only by
   * finishing it, are the same bad idea at two sizes.
   */
  auto_buy_abilities: {
    id: "auto_buy_abilities",
    group: "automation",
    repeatable: false,
    effect: "auto_buy_abilities",
    // Under the three ability automations it sits beside, because what it sells is less: it
    // spends Energy the round was already going to spend, in the order a settled player
    // already spends it, and buys back the clicks rather than any new power.
    baseCost: 200
  },
  auto_start_round: {
    id: "auto_start_round",
    group: "automation",
    repeatable: false,
    effect: "auto_start_round",
    // The most expensive one-off in the shop, and the only one that changes the shape of the
    // game rather than a number in it: rounds stop needing a hand on them. Priced as a
    // milestone - several rounds of income even once the ladders are deep - because what it
    // buys is every round after it, for the rest of the cycle.
    baseCost: 500
  }
};

/* ------------------------------------------------------------------ *
 * The Presence catalogue (05-progression.md, 07-content-registry.md)   *
 *                                                                      *
 * Fear buys. Presence decides what Fear is allowed to buy.             *
 *                                                                      *
 * Almost every row here hands over Fear rows and does nothing else. Presence barely touches
 * the board: it buys no Dahan, shortens no clock, adds no damage. That is what keeps the two
 * currencies from needing an exchange rate - a Presence row can make a Fear row free, but it
 * can never do a Fear row's *job* at a different price.
 *
 * Every row is flat, and every row but one is a one-off. `presence_fear_remains` is that
 * one - the ladder the note below on the discount rows said would want "something nearer
 * 1.3-1.5 growth, or none at all", and it took the "none at all" branch: ten rungs at a flat 1
 * Presence each. Presence income is root-shaped and grows slowly, so the Fear catalogue's 1.6
 * curve would kill a Presence ladder inside three tiers, and even 1.35 puts the tenth rung at
 * 15 Presence - three whole rows of this catalogue for one rung of one row. A flat price is
 * what lets a ten-rung Presence ladder exist at all.
 *
 * The names are the ones the Fear rows already carried, kept rather than invented. The
 * Presence row and the Fear row it grants are the same idea at two prices, and separate names
 * would make the player learn the pairing. `presence_all_unbidden` names five rows at once and
 * takes the German half of what they share - "von selbst" - as its own.
 *
 * `presence_current_quickens` is the exception: it has no Fear-shop row to name itself after,
 * because it unlocks Focus (see abilityFocusUnlocked below) rather than granting a shop entry.
 * That makes it the one Presence row to touch the board directly - "buys no Dahan, shortens no
 * clock" above is true of every row but that one.
 * ------------------------------------------------------------------ */

/* ---------- What a Presence row does to the Fear catalogue ----------
 *
 * It buys an automation outright, forever. That is the whole of the mechanism now, and it
 * replaced two others.
 *
 * The first was an unlock: a Presence row put a Fear row in the shop and the Fear price was
 * owed again every cycle. The second was a discount ladder - seven repeatable rows walking
 * seven Fear prices down a shared 500..10 descent, at 5, 10, 25, 50, 100 and 250 Presence a
 * rung.
 *
 * Both are deleted, and the ladder is why. Walking all seven automations to the bottom cost
 * 515 Presence and saved 975 Fear a cycle - against which *holding* those 515 Presence is
 * +515% Fear generated (PRESENCE_FEAR_BONUS_PER_POINT), uncapped and forever. Those break even
 * at ~190 Fear generated in a cycle, and ASCENSION_UNLOCK_PRESENCE will not let a player
 * Reclaim until they have generated 2500. So the rows lost to doing nothing by 13x at the
 * earliest moment they could exist, and by more every cycle after: not a weak rung but a
 * strictly dominated one, and seven rows of the Presence catalogue that were never correct to
 * buy. Deleted with them: AUTOMATION_PRICE_LADDERS, PRESENCE_DISCOUNT_COSTS, automationLadder,
 * automationPriceAtTier and PRESENCE_DISCOUNT_BY_UPGRADE.
 *
 * What replaces both is one flat purchase per group. It is priced against holding the same way
 * the ladder failed to be: a grant is worth its automation's Fear price *every cycle for the
 * rest of the game*, so it beats the generation bonus for as long as the game lasts rather
 * than for two hundred Fear.
 *
 * The consequence to keep in view: an automation is now a switch a save carries rather than a
 * purchase a cycle makes. The old ladders bottomed out at 10 instead of 0 specifically to stop
 * that happening. That argument is gone with the rows it was defending - what it was really
 * protecting was a per-cycle chore, and a prestige layer whose reward is "do the shopping
 * again, cheaper" is the thing this change exists to remove.
 */

const PRESENCE_UPGRADES = {
  /* ---------- The three automation grants ----------
   *
   * Each hands its Fear rows over permanently: they survive the wipe in `ascend`, because what
   * is read is this catalogue and not `upgrades.purchased`. The Fear rows stay in UPGRADES at
   * their full prices and stay buyable, which is what the first cycle - and any cycle before
   * the grant - actually shops from. A grant does not change a price; it stops the price being
   * a question.
   *
   * 2 and 3 against a first payout of about 5, so the first Reclaim buys both. Deliberate: the
   * first ascension should read as an unambiguous win rather than a dilemma.
   *
   * Note what that means for the ordering, because it is the one thing here worth retuning
   * once a cycle has been played: the two dearest automations in the Fear shop (500 and 200)
   * are the two cheapest in Presence, so the first Reclaim ends the hand-played round loop
   * outright and `presence_all_unbidden` - 5 Presence for five rows worth 1025 Fear a cycle -
   * waits for the second. Staging them the other way round wants roughly 5 / 8 / 15 rather
   * than 2 / 3 / 5. The figures below are the ones asked for; the alternative is written down
   * here so retuning it is a three-number edit rather than a rediscovery.
   */
  presence_tide_returns: {
    id: "presence_tide_returns",
    grants: ["auto_start_round"],
    cost: 2
  },
  presence_river_knows: {
    id: "presence_river_knows",
    grants: ["auto_buy_abilities"],
    cost: 3
  },

  /* The five ability auto-casts as one purchase rather than five.
   *
   * One row because the layer's problem was dead rows, not too few of them, and because
   * "which ability do I automate first" is a decision worth nobody's second Reclaim - the five
   * are comfort, and comfort bought in installments is just the chore again. 5 Presence
   * against 1025 Fear a cycle, which is roughly what the whole group cost to re-buy.
   *
   * The Fear rows underneath it keep their prices and their spread (25 / 100 / 200 / 300 /
   * 400) because the first cycle still shops from them, and `auto_boon` at 25 is plausibly the
   * first purchase a new player ever makes - the cheapest row that visibly does something.
   */
  presence_all_unbidden: {
    id: "presence_all_unbidden",
    grants: ["auto_boon", "auto_innate", "auto_bounty", "auto_flash_floods", "auto_wash_away"],
    cost: 5
  },

  // No `grants` - this one unlocks Focus rather than a shop row, and `abilityFocusUnlocked`
  // reads its owned-ness straight off `presenceUpgradeOwned`. It is why "Presence buys no
  // Dahan, shortens no clock, adds no damage" is no longer true of the whole catalogue.
  presence_current_quickens: {
    id: "presence_current_quickens",
    cost: 5
  },

  /* The fourth rung on auto-buy's ladder: the round's leftover Energy goes into Focus.
   *
   * No `grants`, like the row above it - `autoBuyFocusUnlocked` reads it straight off
   * `presenceUpgradeOwned`. It needs both of the rows it sits between to mean anything
   * (`presence_river_knows` for the resolver, `presence_current_quickens` for the ladders it
   * spends into), which puts it 13 Presence deep and makes it a third-Reclaim row. That depth
   * is the gate; the price is not asked to be one.
   *
   * **It is not the comfort layer `auto_buy_abilities` is, and it must not be priced as one.**
   * That row's defence - "it spends Energy the round was already going to spend" - is exactly
   * what is untrue here. Energy does not survive a round (startRound resets the purse and
   * `abilityFocusEnergy` with it), so once the unlocks and the tiers are bought, every Energy
   * the round earns afterwards is burned at its end. This row is the first thing that turns
   * that residue into throughput, and the Focus ladders are deep enough to absorb any purse.
   * It buys power, not clicks.
   *
   * 5 all the same, matching `presence_current_quickens` rather than undercutting it: the row
   * that opens Focus and the row that spends it automatically are worth the same, and a
   * player who has bought the first has already said what they think of the second. If a
   * played cycle shows the pair arriving too easily together, the lever is this row rather
   * than the one below - Focus by hand must stay reachable before Focus by itself.
   */
  presence_river_deepens: {
    id: "presence_river_deepens",
    cost: 5
  },

  /* The Dahan Find Their Strength: what a full `dahan_remember` is allowed to become.
   *
   * No `grants`, like the two rows above it - `dahanStrengthUnlocked` reads it straight off
   * `presenceUpgradeOwned`, and what it opens is a claim on an existing row rather than a new
   * one. That makes it the third Presence row to touch the board, and the first to do it by
   * changing a number the invaders are measured against: Dahan damage 1 -> 2, permanently for
   * the cycle, in exchange for the pool starting over at twice the depth.
   *
   * This is also the row that brings back something the catalogue deleted. `presenceUnlock`
   * died because a Presence row that gated an *automation* asked for the Fear again every
   * cycle and the grant beat it outright (see the long note above). That argument does not
   * reach here: re-earning power every cycle is the Fear shop's entire job, and a grant would
   * have nothing to hand over - there is no row to own, only a claim to be allowed to make.
   * The rule the two cases sit either side of, written down so the next one is not decided by
   * whichever note gets read first: **Presence grants automations and gates board power.** A
   * row that saves clicks is handed over for good; a row that changes what the Dahan do is
   * unlocked and then paid for in Fear, every cycle, like everything else on the board.
   *
   * 8 rather than the 5 the two rows above it cost. It sits above them because it is the only
   * Presence row that makes the player stronger *in the fight* rather than opening a place to
   * spend - and 8 puts it past the first three Reclaims, which is where a 30 000-Fear sink
   * wants to arrive anyway. It is a first pass and unplayed, like every figure in this
   * catalogue; the note above `presence_river_deepens` is the one to read before moving it.
   *
   * `locked` holds the row shut for now: the price above is unplayed and the claim it opens
   * is the only Presence buy that changes a number the invaders are measured against, so the
   * row stays visible and stays unsellable until the cycle it belongs to has been played. The
   * flag is read by `presenceUpgradeLocked`, which `purchasePresenceUpgrade` refuses on and
   * the shop draws as a dead button - the row is not deleted, because everything it wires up
   * still works and re-opening it is meant to cost one line. Nothing else in the catalogue
   * uses the flag; it is not a tier gate and must not grow into one - that was `presenceUnlock`.
   */
  presence_dahan_endure: {
    id: "presence_dahan_endure",
    cost: 8,
    locked: true
  },

  /* ---------- The one repeatable row: a cycle that does not start from nothing ----------
   *
   * Ten rungs, 1 Presence each, and every rung puts 50 more Fear in the bank at the moment of
   * the next Reclaim - 500 at the top. See ASCENSION_START_FEAR_PER_TIER for what that is
   * worth against simply holding the Presence, and for why the flat 50 makes this a late-game
   * sink rather than a competitive buy. The short version: under a 5,000-Fear cycle every rung
   * beats holding, above it none do, and the cost being flat is what makes that one threshold
   * instead of ten.
   *
   * It grants no Fear row and touches no board, which puts it with `presence_current_quickens`
   * and `presence_river_deepens` rather than with the three automation grants - but unlike
   * those two it unlocks nothing either. `ascend` reads its tier directly through
   * `ascensionStartFear`, which is the whole of the wiring.
   *
   * Flat cost is also why `presenceUpgradeCost` needs no growth curve: it answers `cost` for
   * every rung and Infinity once `maxTier` is reached. The first repeatable row in this
   * catalogue is deliberately the one that asks least of the machinery around it.
   */
  presence_fear_remains: {
    id: "presence_fear_remains",
    repeatable: true,
    maxTier: ASCENSION_START_FEAR_MAX_TIER,
    cost: 1
  },

  /* ---------- The second repeatable row: the opening runs itself, fast ----------
   *
   * Three rungs at 3 / 4 / 5 Presence, fast-forwarding the first 10 / 15 / 20% of
   * `meta.bestWaveReached` at FAST_FORWARD_SPEED. See the note above FAST_FORWARD_SPEED for
   * the mechanic and above FAST_FORWARD_SHARE_PER_TIER for why the cap is keyed to the record.
   *
   * It is the catalogue's first row priced *per rung* rather than flat, which is what `costs`
   * is for - see presenceUpgradeCost. Three named prices, not a curve: the objection to a
   * growth curve on a Presence ladder is that it compounds against root-shaped income, and 3 /
   * 4 / 5 does not compound. Written out because three prices a reader can see beat a
   * multiplier they have to evaluate.
   *
   * Priced as comfort, and it must stay priced as comfort. What it buys is real seconds - the
   * fast-forwarded waves pay exactly what they would have paid at 1x, so no rung of this row
   * makes a round worth more Fear than the round before it. That is the line that separates it
   * from `presence_river_deepens` next door, which does buy power and says so. If a played
   * cycle wants this row to be *stronger*, the lever is the share and never the speed: a
   * larger share hands back more of an opening the player has already proven, while a faster
   * speed only coarsens the tick that is already resolving those waves.
   *
   * Deliberately named for what it gets you to rather than what it skips - the deep part of
   * the round is the part worth playing, and the row's whole promise is arriving there sooner.
   * "Deep water" is new to both name lists: tide, river, current, headwaters and the island's
   * memory are all spoken for elsewhere in the two shops.
   */
  presence_deep_water_comes: {
    id: "presence_deep_water_comes",
    repeatable: true,
    maxTier: FAST_FORWARD_MAX_TIER,
    costs: FAST_FORWARD_COSTS
  }
};

const PRESENCE_UPGRADE_IDS = Object.keys(PRESENCE_UPGRADES);

/* The reverse of every `grants` entry, built once: which Presence row, if any, hands an
 * automation over. `upgradeTier` asks this for every row in the catalogue on every shop
 * render and every round snapshot, so it is a lookup rather than a scan.
 *
 * An automation named by two Presence rows would be a content bug rather than a mechanic -
 * the structural test in tests/ascension.test.js is what keeps the two tables agreeing.
 */
const PRESENCE_GRANT_BY_UPGRADE = {};
for (const id of PRESENCE_UPGRADE_IDS) {
  for (const granted of PRESENCE_UPGRADES[id].grants || []) PRESENCE_GRANT_BY_UPGRADE[granted] = id;
}

const UPGRADE_IDS = Object.keys(UPGRADES);

/* The group headings, in shelf order - see the note above UPGRADES for what each one holds.
 *
 * The list exists so the shop can draw its dividers without knowing the catalogue: it walks
 * the rows in catalogue order and heads each run with the group it names, which is why the
 * rows of a group have to stay contiguous above. The order here is the order the groups
 * appear in, and it is only a check on that - a group missing from this list would still be
 * drawn, headless.
 */
const UPGRADE_GROUP_IDS = ["waves", "fear", "dahan", "automation"];

// Which group a row belongs to. Defaulted rather than required: a row added without one lands
// in `automation`, which is where the one-offs are and where a new row is least likely to lie.
function upgradeGroup(upgradeId) {
  return (UPGRADES[upgradeId] || {}).group || "automation";
}

