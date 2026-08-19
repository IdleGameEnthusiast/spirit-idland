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
    name: "Reißende Fluten im Sonnenlicht",
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
// is three pushes and 2 damage per 8 beats against tier 1's one push per 4 - so the longer
// wait buys a bigger swing rather than taxing the upgrade.
//
// Every cooldown here is written as beats times TIME_SCALE, the same dial the wave interval
// turns on. That is what keeps a cast rate a cast rate: an ability that fired twice a wave at
// scale 1 fires twice a wave at any scale, because both clocks stretched together.
const ABILITIES = {
  innate_power: {
    id: "innate_power",
    unlockCost: 0,
    // Focus's own base price (see FOCUS_BASE_COST_FALLBACK) - the Innate outgrows the flat
    // fallback because it outgrows every other ability, tier over tier, and Focus should not
    // be the cheap way into the strongest cooldown in the kit.
    focusBaseCost: 25,
    tiers: [
      {
        cooldownSeconds: 8 * TIME_SCALE,
        needsTarget: true,
        effect: "push_invaders",
        pushCount: 1,
        upgradeCost: 40
      },
      {
        cooldownSeconds: 15 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_and_push",
        damage: 2,
        pushCount: 3,
        upgradeCost: 150
      },
      {
        cooldownSeconds: 22 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_each_invader",
        damage: 2,
        upgradeCost: Infinity
      }
    ]
  },
  boon_of_vigor: {
    id: "boon_of_vigor",
    unlockCost: 0,
    cooldownSeconds: 12 * TIME_SCALE,
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
    needsTarget: false,
    effect: "add_dahan",
    amount: 1
  },
  flash_floods: {
    id: "flash_floods",
    unlockCost: 10,
    cooldownSeconds: 25 * TIME_SCALE,
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
 * is a cast rate at any speed. `focusBaseCost` is each card cooldown in beats: a card carries
 * no unlockCost for abilityFocusCost to anchor to, and a slow card should cost more to hasten
 * than a fast one.
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
    focusBaseCost: 10,
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
    focusBaseCost: 10,
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
    focusBaseCost: 12,
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
    focusBaseCost: 12,
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
    focusBaseCost: 20,
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
    focusBaseCost: 30,
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
    focusBaseCost: 50,
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

// Repeatable tiers first, then the one-off unlocks. The shop renders them in this order and
// draws the line between the two halves where `repeatable` stops.
const UPGRADES = {
  dahan_reinforcement: {
    id: "dahan_reinforcement",
    repeatable: true,
    effect: "dahan_bonus_per_tier",
    baseCost: 10,
    // Past eight the island runs out of room to spread them and the tiers stop paying.
    maxTier: 8
  },
  blight_resilience: {
    id: "blight_resilience",
    repeatable: true,
    effect: "blight_threshold_per_tier",
    // Cheap and capped on purpose. Invader power grows faster than linearly, so Blight
    // accrues faster than the threshold can be raised: ten tiers measured at +6% round
    // length. It is a small comfort for an early round, priced like one, and it is not the
    // shop's growth lever - reinforcement and the one-offs are.
    baseCost: 3,
    maxTier: 5
  },
  headwaters: {
    id: "headwaters",
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

  /* ---------- The three Fear ladders ----------
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
   */
  power_card_interval: {
    id: "power_card_interval",
    repeatable: true,
    maxTier: POWER_CARD_INTERVAL_MAX_TIER,
    effect: "power_card_interval_per_tier",
    baseCost: 30
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

  auto_boon: {
    id: "auto_boon",
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

  /* ---------- The two rows Presence unlocks ----------
   *
   * The only rows in this catalogue that Fear alone cannot reach. Each names a Presence row in
   * `presenceUnlock`, and until that row is bought the Fear row is locked whatever the purse
   * holds (see upgradeNeedsPresence).
   *
   * They were behind a completion gate until the ascension layer landed: refused until every
   * other row was maxed, which is ~2674 Fear and something like ninety hand-played rounds
   * before the game would play itself. The gate is deleted along with the idea it rested on -
   * that the shop is a thing which finishes.
   *
   * The Fear price is still owed, and owed again every cycle: a Presence unlock puts the row in
   * the shop, it does not buy the row. So every cycle opens hand-played and 500 Fear is a live
   * decision against the five tiers of rising_dread it would otherwise buy. That trade - play
   * this cycle actively, or pay to idle it - is the point of leaving the price where it is.
   */
  auto_buy_abilities: {
    id: "auto_buy_abilities",
    repeatable: false,
    effect: "auto_buy_abilities",
    presenceUnlock: "presence_river_knows",
    // Cheap for where it sits, and deliberately so: Presence is what holds it back, not the
    // price. What it sells is also less than the automations under it - it spends Energy the
    // round was already going to spend, in the order a settled player already spends it, and
    // buys back the clicks rather than any new power.
    baseCost: 200
  },
  auto_start_round: {
    id: "auto_start_round",
    repeatable: false,
    effect: "auto_start_round",
    presenceUnlock: "presence_tide_returns",
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
 * Every row here unlocks a Fear row and does nothing else. Presence never touches the board:
 * it buys no Dahan, shortens no clock, adds no damage. That is what makes the two currencies
 * impossible to price against each other - there is no exchange rate to get wrong, and no
 * future Presence row can quietly do a Fear row's job at a different price.
 *
 * Prices are flat because neither row is repeatable. A repeatable row added later wants
 * something nearer 1.3-1.5 growth, or none at all: Presence income is root-shaped and grows
 * slowly, so the Fear catalogue's 1.6 curve would kill a Presence ladder inside three tiers.
 *
 * The names are the ones the Fear rows already carried, kept rather than invented. The
 * Presence row and the Fear row it opens are the same idea at two prices, and separate names
 * would make the player learn the pairing.
 *
 * `presence_current_quickens` breaks that rule on purpose: it has no Fear-shop row to name
 * itself after, because it unlocks Focus (see abilityFocusUnlocked below) rather than a shop
 * entry. That makes it the first Presence row to touch the board directly - "buys no Dahan,
 * shortens no clock" above is no longer true of the whole catalogue, only of the two older rows.
 * ------------------------------------------------------------------ */

/* ---------- The two discount ladders the seven automations come down ----------
 *
 * Every automation's Fear price is one rung of one of these, and a `discounts` row below moves
 * its automation down a rung. Prices are a shared descent rather than seven private curves so
 * that the shop has a shape to learn instead of seven, and so a row's remaining rungs are
 * readable off where its price already sits.
 *
 * There are two of them rather than one because a single 500..10 ladder made the top rows far
 * too long: the 500 automation owed seven rungs and the 400 owed six, and their last rungs were
 * priced past the point where the Fear they save means anything (see PRESENCE_DISCOUNT_COSTS).
 * Splitting the descent in two drops the first step of each top row onto a bigger saving - 500
 * goes straight to 300, 400 straight to 200 - and takes a rung off both. Below 300 the two
 * ladders share the same tail, so every other automation is untouched by the split and it costs
 * the player no extra shape to learn: the rows they already know still descend the way they did.
 *
 * Both bottom out at 10 rather than at 0. A row still owed something is still re-bought every
 * cycle, which keeps the shape of the Fear catalogue intact - the automations stay purchases a
 * cycle makes rather than switches a save carries. 10 is small enough not to be a decision and
 * large enough not to be free.
 */
const AUTOMATION_PRICE_LADDERS = [
  [500, 300, 200, 100, 50, 25, 10],
  [400, 200, 100, 50, 25, 10]
];

/* The ladder an automation descends, which is simply the one its own price sits on. The shared
 * tail means 200 and below appear on both; either answers the same, because from 200 down the
 * two ladders are the same list.
 *
 * A price on neither gets no ladder rather than a nearby rung - see automationPriceAtTier for
 * why that is the safe direction, and the structural test in tests/ascension.test.js for what
 * keeps it from happening quietly.
 */
function automationLadder(baseCost) {
  for (const ladder of AUTOMATION_PRICE_LADDERS) {
    if (ladder.indexOf(baseCost) >= 0) return ladder;
  }
  return null;
}

/* What each rung of a descent costs in Presence, by how many rungs have already been taken. One
 * list for both ladders: a row pays by how deep it is, not by which ladder it is on.
 *
 * It climbs 50x across six steps while what a step saves falls from 200 Fear to 15, so the value
 * per Presence spent drops by something like 650x from the first rung to the last. That is
 * deliberate and it is the whole shape of these rows: **the early rungs are the investment and
 * the late ones are an endgame sink.** 5 Presence for 200 Fear a cycle is a good buy the first
 * Reclaim after Focus can nearly make; 250 Presence for the last 15 Fear is something a run
 * arrives at long after the Fear it saves has stopped mattering.
 *
 * The list ends at 250 rather than 500 because the ladders above are a rung shorter than they
 * were, and it was cut from the *end* - the rungs a row loses are its most expensive ones, so
 * the top two rows drop from 940 and 440 Presence to 440 and 190. Finishing the whole set costs
 * 1,045 rather than 1,795. That is a deliberate softening: the deep rungs were a sink long past
 * the point where the Fear they saved was legible, and the set now completes inside a cycle a
 * player is still paying attention to.
 *
 * They are also priced against the thing Presence does when it is *not* spent - 1% more Fear
 * generated per point held, uncapped (PRESENCE_FEAR_BONUS_PER_POINT). Against that, a fixed Fear
 * discount is a losing trade at any income above a few thousand a cycle, and the deep rungs lose
 * by orders of magnitude. That is known and intended: these rows are not meant to out-earn
 * holding. They are meant to be worth taking early, when a cycle's income is small enough that
 * 200 Fear off a 500 Fear row is real money, and to still have somewhere to put Presence much
 * later when nothing else does.
 */
const PRESENCE_DISCOUNT_COSTS = [5, 10, 25, 50, 100, 250];

/* Where an automation's price sits after `tier` rungs of discount, and the one piece of ladder
 * arithmetic in the file - both the live price and the "next rung" the shop row advertises come
 * through here, so they cannot drift apart.
 *
 * An automation whose `baseCost` is on neither ladder keeps its price untouched rather than being
 * snapped to a nearby rung. That is the safe direction: a mispriced row costs full price instead
 * of silently becoming cheap.
 */
function automationPriceAtTier(upgradeId, tier) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const ladder = automationLadder(record.baseCost);
  if (!ladder) return record.baseCost;
  const rung = ladder.indexOf(record.baseCost);
  const steps = Math.max(0, Math.floor(Number(tier) || 0));
  return ladder[Math.min(rung + steps, ladder.length - 1)];
}

const PRESENCE_UPGRADES = {
  // 2 and 3 against a first payout of about 5, so the first Reclaim buys both. Deliberate: the
  // first ascension should read as an unambiguous win rather than a dilemma. Dilemmas belong
  // to rows that do not exist yet.
  presence_tide_returns: {
    id: "presence_tide_returns",
    unlocks: "auto_start_round",
    cost: 2
  },
  presence_river_knows: {
    id: "presence_river_knows",
    unlocks: "auto_buy_abilities",
    cost: 3
  },
  // No `unlocks` - see the block comment above. `abilityFocusUnlocked` reads this row's own
  // owned-ness straight off `presenceUpgradeOwned` rather than going through a Fear row.
  presence_current_quickens: {
    id: "presence_current_quickens",
    cost: 5
  },

  /* ---------- The seven discount rows ----------
   *
   * A third shape of Presence row, after "opens a Fear row" and "opens a capability": these
   * change a price in the Fear catalogue without touching what it buys. That keeps them inside
   * the two-currency rule in the way that matters - Presence still buys no Dahan, shortens no
   * clock, adds no damage - while making them the first repeatable rows the layer has.
   *
   * `discounts` names the automation, and its rung count is read off where that automation's
   * price already sits on its ladder rather than written here: a row priced at 300 has five
   * rungs down to 10 whether or not anybody counted. Move an automation's `baseCost` to another
   * rung - or onto the other ladder - and its descent resizes itself.
   *
   * Listed in the same order as the automations in UPGRADES, so the two shops read down in the
   * same sequence and a player can find a row's discount where they expect it.
   */
  presence_boon_remembered: {
    id: "presence_boon_remembered",
    discounts: "auto_boon"
  },
  presence_instinct_remembered: {
    id: "presence_instinct_remembered",
    discounts: "auto_innate"
  },
  presence_bounty_remembered: {
    id: "presence_bounty_remembered",
    discounts: "auto_bounty"
  },
  presence_flood_remembered: {
    id: "presence_flood_remembered",
    discounts: "auto_flash_floods"
  },
  presence_current_remembered: {
    id: "presence_current_remembered",
    discounts: "auto_wash_away"
  },
  presence_need_remembered: {
    id: "presence_need_remembered",
    discounts: "auto_buy_abilities"
  },
  presence_tide_remembered: {
    id: "presence_tide_remembered",
    discounts: "auto_start_round"
  }
};

const PRESENCE_UPGRADE_IDS = Object.keys(PRESENCE_UPGRADES);

// The reverse of every `discounts` key, built once. upgradeBaseCost asks this on every price
// lookup in the shop, which is every row every frame the catalogue changes.
const PRESENCE_DISCOUNT_BY_UPGRADE = {};
for (const id of PRESENCE_UPGRADE_IDS) {
  const discounts = PRESENCE_UPGRADES[id].discounts;
  if (discounts) PRESENCE_DISCOUNT_BY_UPGRADE[discounts] = id;
}

const UPGRADE_IDS = Object.keys(UPGRADES);

