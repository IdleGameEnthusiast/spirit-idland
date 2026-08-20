/* Focus: spending Energy mid-round to shorten one ability's cooldown -
 * docs/tasks/implementation-microtasks.md#12.
 *
 * Two halves, tested separately. The ladder itself is a table - a price and a whole number of
 * beats per rung, per ability - and the tuned ones are asserted rung by rung against the
 * figures the balance pass set, rather than against a re-derivation of the formula that
 * produced them. `purchaseAbilityFocus` is the stateful half: the Presence gate, the Energy
 * spend, and the round-state write. */

(function () {
  const {
    engine, test, assert, assertEqual, assertClose,
    newGame, grantPresence, unlockAllAbilities, handCards
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const beats = (state, id) => engine.abilityCooldownSeconds(state, id) / engine.TIME_SCALE;

  // A round with Focus open, every ability unlocked, and more Energy than any ladder costs.
  function focusReady(energy) {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = energy === undefined ? 1000 : energy;
    return state;
  }

  // Walks a whole ladder rung by rung: the price quoted before the purchase, the cooldown left
  // after it, then the refusal at the top. Both tuned abilities are checked this way, so a
  // change to either table breaks here with the rung it moved rather than with a total.
  function assertLadder(abilityId, rungs) {
    const state = focusReady(1e6);
    // A card is walked exactly like a kit ability, but it has to be in hand first: `unlockAllAbilities`
    // hands out the kit, and what puts a card in the bar is a draw.
    if (engine.POWER_CARDS[abilityId]) handCards(state, [abilityId]);
    const base = engine.abilityRecord(state, abilityId).cooldownSeconds / engine.TIME_SCALE;
    assertEqual(beats(state, abilityId), base, `${abilityId} starts at its catalogue cooldown`);
    assertEqual(engine.abilityFocusMaxPurchases(state, abilityId), rungs.length, `${abilityId} ladder length`);

    rungs.forEach(([price, left], i) => {
      assertEqual(engine.abilityFocusCost(state, abilityId), price, `${abilityId} rung ${i + 1} price`);
      assert(engine.purchaseAbilityFocus(state, abilityId), `${abilityId} rung ${i + 1} is affordable`);
      assertEqual(beats(state, abilityId), left, `${abilityId} rung ${i + 1} cooldown`);
    });

    assertEqual(engine.abilityFocusCost(state, abilityId), Infinity, `${abilityId} quotes no price past the floor`);
    assert(!engine.purchaseAbilityFocus(state, abilityId), `${abilityId} refuses a purchase past the floor`);
    assertEqual(beats(state, abilityId), rungs[rungs.length - 1][1], `${abilityId} rests on its floor`);
  }

  /* ---------- The ladders ---------- */

  // The tables the balance pass set, exactly as they are written in 04-economy-formulas.md.
  // Prices are the ability's own anchor times 1.5 per rung already bought, rounded; cooldowns
  // come off one whole beat at a time.
  const BOON_LADDER = [[3, 11], [5, 10], [7, 9], [10, 8], [15, 7], [23, 6], [34, 5], [51, 4]];
  const BOUNTY_LADDER = [
    [5, 14], [8, 13], [11, 12], [17, 11], [25, 10],
    [38, 9], [57, 8], [85, 7], [128, 6], [192, 5]
  ];
  const FLOODS_LADDER = [
    [5, 24], [7, 23], [8, 22], [11, 21], [14, 20], [19, 19], [24, 18], [31, 17],
    [41, 16], [53, 15], [69, 14], [90, 13], [116, 12], [151, 11], [197, 10], [256, 9]
  ];
  const WASH_LADDER = [
    [6, 29], [8, 28], [9, 27], [12, 26], [15, 25], [18, 24], [23, 23], [29, 22], [36, 21], [45, 20],
    [56, 19], [70, 18], [87, 17], [109, 16], [136, 15], [171, 14], [213, 13], [266, 12], [333, 11], [416, 10]
  ];

  test("focus: boon_of_vigor runs eight rungs of one beat, 12 down to 4", () => {
    assertLadder("boon_of_vigor", BOON_LADDER);
  });

  test("focus: rivers_bounty runs ten rungs of one beat, 15 down to 5", () => {
    assertLadder("rivers_bounty", BOUNTY_LADDER);
  });

  test("focus: flash_floods runs sixteen rungs of one beat, 25 down to 9", () => {
    assertLadder("flash_floods", FLOODS_LADDER);
  });

  test("focus: wash_away runs twenty rungs of one beat, 30 down to 10", () => {
    assertLadder("wash_away", WASH_LADDER);
  });

  /* ---------- The seven cards ----------
   *
   * Same tables, same walk. The anchors are what a cast is worth divided by the clock it sits
   * on, which is the rule the kit already followed and the cards did not: they used to anchor on
   * their own cooldown in beats, so the slowest card charged the most for the beat worth the
   * least - Tsunami's opening rung was 50 Energy for 2% of its clock, and its thirty-third was
   * 21.6 million. See POWER_CARDS in engine/content.js for the worth behind each anchor. */

  const CARD_LADDERS = {
    pull_beneath: [[25, 9], [38, 8], [56, 7], [84, 6], [127, 5], [190, 4]],
    song_of_sanctity: [[16, 9], [24, 8], [36, 7], [54, 6], [81, 5], [122, 4]],
    uncanny_melting: [
      [24, 11], [36, 10], [54, 9], [81, 8], [122, 7], [182, 6], [273, 5], [410, 4]
    ],
    natures_resilience: [
      [20, 11], [30, 10], [45, 9], [68, 8], [101, 7], [152, 6], [228, 5], [342, 4]
    ],
    encompassing_ward: [
      [17, 19], [22, 18], [29, 17], [37, 16], [49, 15], [63, 14], [82, 13],
      [107, 12], [139, 11], [180, 10], [234, 9], [305, 8], [396, 7]
    ],
    accelerated_rot: [
      [18, 29], [23, 28], [28, 27], [35, 26], [44, 25], [55, 24], [69, 23], [86, 22], [107, 21], [134, 20],
      [168, 19], [210, 18], [262, 17], [327, 16], [409, 15], [512, 14], [639, 13], [799, 12], [999, 11], [1249, 10]
    ],
    tsunami: [
      [20, 49], [22, 48], [25, 47], [28, 46], [31, 45], [35, 44], [39, 43], [44, 42], [50, 41],
      [55, 40], [62, 39], [70, 38], [78, 37], [87, 36], [98, 35], [109, 34], [123, 33], [137, 32],
      [154, 31], [172, 30], [193, 29], [216, 28], [242, 27], [271, 26], [304, 25], [340, 24],
      [381, 23], [426, 22], [478, 21], [535, 20], [599, 19], [671, 18], [752, 17]
    ]
  };

  for (const cardId of Object.keys(CARD_LADDERS)) {
    const rungs = CARD_LADDERS[cardId];
    test(`focus: ${cardId} runs ${rungs.length} rungs of one beat, down to ${rungs[rungs.length - 1][1]}`, () => {
      assertLadder(cardId, rungs);
    });
  }

  // The correction stated as the thing a player can see. Tsunami is the biggest cast in the game
  // and Pull Beneath among the smallest, and Tsunami's first beat is the cheaper of the two -
  // because it is 2% of a 50-beat clock against 10% of a 10-beat one. The kit says the same
  // thing between wash_away (6) and the Innate's tier 3 (25); the cards used to say the reverse.
  test("focus: a card's anchor falls as its clock lengthens, exactly as the kit's does", () => {
    const state = focusReady();
    handCards(state, Object.keys(engine.POWER_CARDS));

    const anchors = Object.keys(engine.POWER_CARDS).map((id) => engine.abilityFocusBaseCost(state, id));
    for (const anchor of anchors) {
      assert(anchor >= 16 && anchor <= 25, `every card opens inside the 16-25 band, got ${anchor}`);
    }

    assert(
      engine.abilityFocusBaseCost(state, "tsunami") < engine.abilityFocusBaseCost(state, "pull_beneath"),
      "the 50-beat card opens under the 10-beat one"
    );
    // The kit's own pair, for the same reason: Wash Away is a 30-beat clock and the Innate's
    // tier 3 a 22-beat one, and the longer clock opens at 6 against the shorter one's 25.
    state.round.abilityTiers.innate_power = 2;
    assert(
      engine.abilityFocusBaseCost(state, "wash_away") < engine.abilityFocusBaseCost(state, "innate_power"),
      "which is the same way round the kit already had it"
    );
  });

  /* ---------- The Innate's three ladders ----------
   *
   * One ability, three ladders, because one anchor cannot be right for all three cooldowns:
   * a beat is 12.5% of tier 1's clock and 4.5% of tier 3's. Each is walked rung by rung the
   * same way the four kit ladders above are, standing at the tier it belongs to. */

  const INNATE_LADDERS = [
    [[3, 7], [5, 6], [7, 5], [10, 4], [15, 3]],
    [
      [8, 14], [12, 13], [18, 12], [27, 11], [41, 10],
      [61, 9], [91, 8], [137, 7], [205, 6], [308, 5]
    ],
    [
      [25, 21], [31, 20], [39, 19], [49, 18], [61, 17], [76, 16], [95, 15],
      [119, 14], [149, 13], [186, 12], [233, 11], [291, 10], [364, 9], [455, 8]
    ]
  ];

  // The kit's assertLadder reads a cooldown straight off the catalogue entry, which a tiered
  // ability has none of - so this one stands the Innate at a tier first and reads the record.
  function assertInnateLadder(tier, rungs) {
    const state = focusReady(1e6);
    state.round.abilityTiers.innate_power = tier;
    const base = engine.ABILITIES.innate_power.tiers[tier].cooldownSeconds / engine.TIME_SCALE;

    assertEqual(beats(state, "innate_power"), base, `tier ${tier + 1} starts at its catalogue cooldown`);
    assertEqual(engine.abilityFocusMaxPurchases(state, "innate_power"), rungs.length, `tier ${tier + 1} ladder length`);

    rungs.forEach(([price, left], i) => {
      assertEqual(engine.abilityFocusCost(state, "innate_power"), price, `tier ${tier + 1} rung ${i + 1} price`);
      assert(engine.purchaseAbilityFocus(state, "innate_power"), `tier ${tier + 1} rung ${i + 1} is affordable`);
      assertEqual(beats(state, "innate_power"), left, `tier ${tier + 1} rung ${i + 1} cooldown`);
    });

    assertEqual(engine.abilityFocusCost(state, "innate_power"), Infinity, `tier ${tier + 1} quotes no price past the floor`);
    assert(!engine.purchaseAbilityFocus(state, "innate_power"), `tier ${tier + 1} refuses a purchase past the floor`);
  }

  test("focus: innate tier 1 runs five rungs, 8 down to 3", () => {
    assertInnateLadder(0, INNATE_LADDERS[0]);
  });

  test("focus: innate tier 2 runs ten rungs, 15 down to 5", () => {
    assertInnateLadder(1, INNATE_LADDERS[1]);
  });

  test("focus: innate tier 3 runs fourteen rungs, 22 down to 8", () => {
    assertInnateLadder(2, INNATE_LADDERS[2]);
  });

  test("focus: the three innate ladders climb at their own rates", () => {
    const state = focusReady();
    [1.5, 1.5, 1.25].forEach((growth, tier) => {
      state.round.abilityTiers.innate_power = tier;
      assertEqual(engine.abilityFocusCostGrowth(state, "innate_power"), growth, `tier ${tier + 1} growth`);
    });
  });

  // The one balance figure worth pinning on its own: buying tier 1's Focus out costs exactly
  // what tier 2 costs, so the round's first question about the Innate - run this faster, or
  // make it something bigger - is asked at one price.
  test("focus: tier 1's whole ladder costs exactly what tier 2 costs to buy", () => {
    const state = focusReady(1e6);
    const whole = INNATE_LADDERS[0].reduce((sum, [price]) => sum + price, 0);

    assertEqual(whole, 40, "3 + 5 + 7 + 10 + 15");
    assertEqual(engine.abilityFocusLadderTotal(state, "innate_power", 5), whole, "and the engine agrees");
    assertEqual(engine.abilityUpgradeCost(state, "innate_power"), whole, "which is tier 2's price");
  });

  /* ---------- What an upgrade does to the investment ----------
   *
   * Nothing, is the answer, and that is the point: the round stores Energy, not rungs, so a
   * tier change re-reads the same investment against a different ladder. Rungs it covers are
   * granted outright and the remainder discounts the next one. No Energy is lost, and none is
   * refunded either - it was never spent on a rung, it was spent on the ability. */

  test("focus: a tier upgrade carries the whole investment onto the new ladder", () => {
    const state = focusReady(1e6);
    for (let i = 0; i < 5; i += 1) assert(engine.purchaseAbilityFocus(state, "innate_power"), `tier 1 rung ${i + 1}`);

    assertEqual(engine.abilityFocusEnergy(state, "innate_power"), 40, "tier 1's whole ladder, paid");
    assertEqual(beats(state, "innate_power"), 3, "and standing on tier 1's floor");

    assert(engine.upgradeAbility(state, "innate_power"), "buy tier 2");

    assertEqual(engine.abilityFocusEnergy(state, "innate_power"), 40, "the investment is untouched by the upgrade");
    // Tier 2's ladder is cumulatively 8 / 20 / 38 / 65: 40 covers three rungs with 2 to spare.
    assertEqual(engine.abilityFocusPurchases(state, "innate_power"), 3, "three of tier 2's rungs, granted outright");
    assertEqual(beats(state, "innate_power"), 12, "15 beats less three");
    assertEqual(engine.abilityFocusCost(state, "innate_power"), 65 - 40, "and the fourth is discounted by the change");
  });

  // The user-facing promise stated as an equation, over every rung of every tier: what the bar
  // has taken out of the purse is always exactly what standing here costs, plus what the next
  // rung still wants. A discount is the ladder crediting a spend, never the game handing back
  // Energy it did not take.
  test("focus: no Energy is lost or conjured anywhere across the two upgrades", () => {
    const state = focusReady(1e6);
    let spent = 0;

    for (let tier = 0; tier < 3; tier += 1) {
      if (tier > 0) {
        const upgrade = engine.abilityUpgradeCost(state, "innate_power");
        assert(engine.upgradeAbility(state, "innate_power"), `buy tier ${tier + 1}`);
        spent += upgrade;
      }

      // Two rungs at each tier is enough to cross the seam and land back on the ladder proper.
      for (let i = 0; i < 2; i += 1) {
        const bought = engine.abilityFocusPurchases(state, "innate_power");
        const quoted = engine.abilityFocusCost(state, "innate_power");
        const owed = engine.abilityFocusLadderTotal(state, "innate_power", bought + 1);

        assertEqual(quoted, owed - engine.abilityFocusEnergy(state, "innate_power"), `tier ${tier + 1} quotes the rest of the way up`);
        assert(quoted > 0, "and never quotes a free rung");
        assert(engine.purchaseAbilityFocus(state, "innate_power"));
        spent += quoted;

        assertEqual(engine.abilityFocusPurchases(state, "innate_power"), bought + 1, "one rung per purchase, always");
        assertEqual(engine.abilityFocusEnergy(state, "innate_power"), owed, "and the running total lands on the rung");
      }
    }

    assertEqual(state.resources.energy, 1e6 - spent, "the purse only ever moved by what was quoted");
  });

  // The other half of "nothing is lost": an upgrade may not hand out more haste than the
  // Energy paid for. Tier 3's ladder is dearer than tier 2's at every cumulative point, so the
  // rung count can only ever hold or fall across the seam - never climb for free.
  test("focus: an upgrade never grants more rungs than the investment already stood on", () => {
    for (let rungs = 1; rungs <= INNATE_LADDERS[1].length; rungs += 1) {
      const state = focusReady(1e6);
      state.round.abilityTiers.innate_power = 1;
      for (let i = 0; i < rungs; i += 1) assert(engine.purchaseAbilityFocus(state, "innate_power"));

      const invested = engine.abilityFocusEnergy(state, "innate_power");
      assertEqual(engine.abilityFocusPurchases(state, "innate_power"), rungs, `${rungs} rungs of tier 2`);

      assert(engine.upgradeAbility(state, "innate_power"), "buy tier 3");
      assertEqual(engine.abilityFocusEnergy(state, "innate_power"), invested, "the investment survives");
      assert(
        engine.abilityFocusPurchases(state, "innate_power") <= rungs,
        `tier 3 grants no more than the ${rungs} rungs already paid for`
      );
    }
  });

  test("focus: an upgrade with nothing invested opens the new ladder at its own anchor", () => {
    const state = focusReady(1e6);
    assert(engine.upgradeAbility(state, "innate_power"), "buy tier 2, having focused nothing");

    assertEqual(engine.abilityFocusEnergy(state, "innate_power"), 0, "nothing to carry");
    assertEqual(engine.abilityFocusPurchases(state, "innate_power"), 0, "nothing granted");
    assertEqual(engine.abilityFocusCost(state, "innate_power"), 8, "tier 2's opening rung, undiscounted");
  });

  // The two long ladders opted out of the 1.5 growth every short one keeps. This is the reason
  // in one assertion: at 1.5 their last rungs would cost more than any round could ever hold.
  test("focus: the long ladders grow gently enough to be finishable", () => {
    const state = focusReady();
    assertEqual(engine.abilityFocusCostGrowth(state, "boon_of_vigor"), 1.5, "the default");
    assertEqual(engine.abilityFocusCostGrowth(state, "rivers_bounty"), 1.5, "the default");
    assertEqual(engine.abilityFocusCostGrowth(state, "flash_floods"), 1.3);
    assertEqual(engine.abilityFocusCostGrowth(state, "wash_away"), 1.25);

    const floodsTop = FLOODS_LADDER[FLOODS_LADDER.length - 1][0];
    assert(floodsTop < Math.round(5 * Math.pow(1.5, 15)) / 4, "1.3 keeps the last rung inside a played round");
  });

  test("focus: no purchases leaves the cooldown at the catalogue figure", () => {
    const state = focusReady();
    assertEqual(engine.abilityFocusPurchases(state, "boon_of_vigor"), 0);
    assertEqual(beats(state, "boon_of_vigor"), 12, "untouched is untouched");
  });

  // Every ladder in the game is tuned now - the kit, the Innate's three tiers and the seven
  // cards - so every one of them names its floor rather than deriving it. What each names is
  // still its own third: the invariant is that no ability outruns three times the cast rate it
  // started the round at, and stating the floor per ability is what stops a later cooldown
  // change moving one silently.
  test("focus: every card names its whole ladder, and its floor is its own third", () => {
    const state = focusReady();

    for (const id of Object.keys(engine.POWER_CARDS)) {
      const record = engine.POWER_CARDS[id];
      const cardBeats = record.cooldownSeconds / engine.TIME_SCALE;
      assertEqual(record.focusFloorBeats, Math.ceil(cardBeats / 3), `${id} names its own third`);
      assertEqual(engine.abilityFocusFloorBeats(state, id), Math.ceil(cardBeats / 3), `${id} floor`);
      assertEqual(engine.abilityFocusStepBeats(state, id), 1, `${id} step`);
      assert(record.focusBaseCost > 0, `${id} names an anchor`);
      assert(record.focusCostGrowth > 1, `${id} names a growth`);
    }
  });

  // The derived rule is still the rule, and still has to hold - nothing in the catalogue leans
  // on it today, so it is exercised against a record of the test's own rather than deleted with
  // its last caller.
  test("focus: an ability that names no floor falls to a third of its cooldown, rounded up", () => {
    const state = focusReady();
    const record = { id: "derived", cooldownSeconds: 20 * engine.TIME_SCALE };

    engine.POWER_CARDS.derived_probe = record;
    try {
      assertEqual(engine.abilityFocusFloorBeats(state, "derived_probe"), 7, "a third of 20, rounded up");
      assertEqual(engine.abilityFocusStepBeats(state, "derived_probe"), 1, "one beat a rung");
      assertEqual(engine.abilityFocusCostGrowth(state, "derived_probe"), 1.5, "the default growth");
    } finally {
      delete engine.POWER_CARDS.derived_probe;
    }
  });

  test("focus: a named floor wins over the derived one", () => {
    const state = focusReady();
    assertEqual(engine.ABILITIES.boon_of_vigor.focusFloorBeats, 4, "written in the catalogue");
    assertEqual(engine.abilityFocusFloorBeats(state, "boon_of_vigor"), 4);
    assertEqual(engine.abilityFocusFloorBeats(state, "rivers_bounty"), 5);
    assertEqual(engine.abilityFocusFloorBeats(state, "flash_floods"), 9);
    assertEqual(engine.abilityFocusFloorBeats(state, "wash_away"), 10);
  });

  // Every tier of the Innate names its own floor, and each is the derived third of that tier's
  // own cooldown written out - stated so a later cooldown change cannot quietly move a floor.
  test("focus: each Innate tier names a floor, and each is its own third", () => {
    const state = focusReady();
    [[8, 3], [15, 5], [22, 8]].forEach(([cooldown, floor], tier) => {
      const record = engine.ABILITIES.innate_power.tiers[tier];
      assertEqual(record.cooldownSeconds / engine.TIME_SCALE, cooldown, `tier ${tier + 1} cooldown`);
      assertEqual(record.focusFloorBeats, floor, `tier ${tier + 1} names its floor`);
      assertEqual(floor, Math.ceil(cooldown / 3), `tier ${tier + 1} floor is its own third`);
      state.round.abilityTiers.innate_power = tier;
      assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), floor);
    });
  });

  // The Innate is the one ability whose record changes under it mid-round, and the floor is
  // read off the tier standing in the slot rather than off the one the round opened with.
  test("focus: a tiered ability's floor moves with the tier it is standing at", () => {
    const state = focusReady(1000);
    assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), 3, "tier 1 is 8 beats");
    assert(engine.upgradeAbility(state, "innate_power"), "buy tier 2");
    assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), 5, "tier 2 is 15 beats");
  });

  // The investment outlives a tier change, so a shorter ladder has to hold it rather than let
  // a carried-in sum push the cooldown under the new tier's floor.
  test("focus: Energy past a shorter ladder's end is held at its floor, never below it", () => {
    const state = focusReady(1e6);
    for (let i = 0; i < 5; i += 1) assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));
    state.round.abilityFocusEnergy.boon_of_vigor = 99999;
    assertEqual(beats(state, "boon_of_vigor"), 4, "pinned at the floor, not driven negative");
    assertEqual(engine.abilityFocusPurchases(state, "boon_of_vigor"), 8, "capped at the ladder's length");
    assertEqual(engine.abilityFocusCost(state, "boon_of_vigor"), Infinity, "and nothing left to sell");
  });

  /* ---------- What it costs ---------- */

  test("focus: the unlock price anchors the ladder for any ability naming no anchor of its own", () => {
    const state = focusReady();

    assertEqual(engine.ABILITIES.rivers_bounty.focusBaseCost, undefined, "names none");
    assertEqual(engine.abilityFocusCost(state, "rivers_bounty"), engine.abilityUnlockCost(state, "rivers_bounty"));
  });

  // The two long ladders open below their own unlock price, which no short ladder does: a beat
  // off 25 or 30 is a 4% and a 3% gain, and the unlock price would make the opening rung of
  // each the worst purchase in the game.
  test("focus: a named anchor wins over the unlock price", () => {
    const state = focusReady();

    assertEqual(engine.abilityFocusBaseCost(state, "flash_floods"), 5, "under its own 10 unlock");
    assertEqual(engine.abilityFocusBaseCost(state, "wash_away"), 6, "well under its own 20");
    assertEqual(engine.abilityFocusCost(state, "flash_floods"), 5);
    assertEqual(engine.abilityFocusCost(state, "wash_away"), 6);
  });

  test("focus: boon_of_vigor falls back to the flat floor cost, unlockCost 0 and all", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");

    assertEqual(engine.abilityUnlockCost(state, "boon_of_vigor"), 0, "in the opening hand");
    assertEqual(engine.abilityFocusCost(state, "boon_of_vigor"), 3, "the flat floor, not a free purchase");
  });

  // The Innate is also unlockCost 0 - also in the opening hand - but it names its anchor per
  // tier rather than once, because the same beat is worth 12.5% of tier 1's clock and 4.5% of
  // tier 3's. Tier 1 lands on the flat fallback's figure by choice, not by falling through.
  test("focus: innate_power names its own anchor on every tier, and they differ", () => {
    const state = focusReady(1e6);

    assertEqual(engine.abilityUnlockCost(state, "innate_power"), 0, "in the opening hand");
    assertEqual(engine.ABILITIES.innate_power.focusBaseCost, undefined, "nothing named for the ability as a whole");

    const anchors = [3, 8, 25];
    anchors.forEach((anchor, tier) => {
      state.round.abilityTiers.innate_power = tier;
      assertEqual(engine.abilityTier(state, "innate_power"), tier, `standing at tier ${tier + 1}`);
      assertEqual(engine.abilityFocusBaseCost(state, "innate_power"), anchor, `tier ${tier + 1} anchor`);
      assertEqual(engine.abilityFocusCost(state, "innate_power"), anchor, `tier ${tier + 1} opening rung`);
    });
  });

  test("focus: cost grows 1.5x, compounding, with every purchase already made", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    const first = engine.abilityFocusCost(state, "boon_of_vigor");
    assertEqual(first, 3, "base floor cost");
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));

    const second = engine.abilityFocusCost(state, "boon_of_vigor");
    assertEqual(second, Math.round(3 * 1.5), "1.5x the first");
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));

    const third = engine.abilityFocusCost(state, "boon_of_vigor");
    assertEqual(third, Math.round(3 * 1.5 * 1.5), "1.5x the second");
  });

  test("focus: cost climbs at the ability it was bought for, and nowhere else", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));
    assertEqual(engine.abilityFocusCost(state, "rivers_bounty"), engine.abilityUnlockCost(state, "rivers_bounty"), "untouched");
  });

  test("focus: past the floor, the cost is refused as Infinity, the same shape as a maxed tier", () => {
    // Deliberately absurd: the point of the floor is that no amount of Energy buys past it, so
    // the test has to actually try to spend past it rather than stop just short.
    const state = focusReady(1e18);

    let bought = 0;
    for (let i = 0; i < 500; i += 1) {
      if (!engine.purchaseAbilityFocus(state, "boon_of_vigor")) break;
      bought += 1;
    }
    assertEqual(bought, BOON_LADDER.length, "the ladder ends where the table says");
    assertEqual(beats(state, "boon_of_vigor"), 4, "bottomed out on the floor");
    assertEqual(engine.abilityFocusSecondsPerStep(state, "boon_of_vigor"), 0, "and no rung left to price");
    assertEqual(engine.abilityFocusCost(state, "boon_of_vigor"), Infinity, "no price left to quote");
    const spentAtFloor = state.resources.energy;
    assert(!engine.purchaseAbilityFocus(state, "boon_of_vigor"), "a further purchase is refused");
    assertEqual(state.resources.energy, spentAtFloor, "and nothing more is spent for the refusal");
  });

  /* ---------- The gate ---------- */

  test("focus: refused without the Presence row, however much Energy is on hand", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    state.resources.energy = 1000;

    assert(!engine.abilityFocusUnlocked(state), "unbought");
    assert(!engine.purchaseAbilityFocus(state, "boon_of_vigor"), "refused");
    assertEqual(engine.abilityFocusPurchases(state, "boon_of_vigor"), 0, "nothing recorded");
    assertEqual(state.resources.energy, 1000, "and nothing spent");
  });

  test("focus: refused for an ability that is not unlocked yet", () => {
    const { state } = newGame();
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    assert(!engine.abilityIsUnlocked(state, "wash_away"), "locked on a fresh round");
    assert(!engine.purchaseAbilityFocus(state, "wash_away"), "refused");
  });

  test("focus: refused between rounds, the same rule every Energy spend follows", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;
    state.round.status = "ended";

    assert(!engine.purchaseAbilityFocus(state, "boon_of_vigor"), "refused");
  });

  test("focus: refused for insufficient Energy, and it says why", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1;
    const before = (state._log || []).length;

    assert(!engine.purchaseAbilityFocus(state, "rivers_bounty"), "5 costs more than 1");
    assertEqual(state.resources.energy, 1, "nothing taken for the refusal");
    assert((state._log || []).length > before, "and it logs why");
  });

  /* ---------- A successful purchase ---------- */

  test("focus: a purchase spends Energy, records itself, and shortens the round's cooldown", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 100;

    const before = engine.abilityCooldownSeconds(state, "wash_away");
    const cost = engine.abilityFocusCost(state, "wash_away");
    assert(engine.purchaseAbilityFocus(state, "wash_away"));

    assertEqual(state.resources.energy, 100 - cost, "Energy spent");
    assertEqual(engine.abilityFocusPurchases(state, "wash_away"), 1, "one purchase on record");
    assertClose(engine.abilityCooldownSeconds(state, "wash_away"), before - engine.TIME_SCALE, 1e-9, "one beat shorter");
  });

  test("focus: a purchase made mid-cooldown clamps the ability's remaining wait down with it", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    const full = engine.abilityCooldownSeconds(state, "wash_away");
    state.abilities.wash_away.cooldownRemaining = full;

    assert(engine.purchaseAbilityFocus(state, "wash_away"));
    const shortened = engine.abilityCooldownSeconds(state, "wash_away");
    assert(shortened < full, "the baseline actually moved");
    assertClose(state.abilities.wash_away.cooldownRemaining, shortened, 1e-9, "clamped down with it, not left stranded above the new maximum");
  });

  test("focus: does not touch an ability already sitting below the new maximum", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    state.abilities.wash_away.cooldownRemaining = 1;
    assert(engine.purchaseAbilityFocus(state, "wash_away"));
    assertEqual(state.abilities.wash_away.cooldownRemaining, 1, "already under the new maximum, left alone");
  });

  test("focus: an untouched ability's cooldown is unaffected - the fast path stays fast", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");

    const record = engine.ABILITIES.flash_floods;
    assertClose(engine.abilityCooldownSeconds(state, "flash_floods"), record.cooldownSeconds, 1e-9);
  });

  test("focus: purchases are per ability, independent of one another", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    assert(engine.purchaseAbilityFocus(state, "rivers_bounty"));
    assertEqual(engine.abilityFocusPurchases(state, "rivers_bounty"), 1);
    assertEqual(engine.abilityFocusPurchases(state, "flash_floods"), 0, "untouched");
  });

  test("focus: applies to the tiered Innate exactly as it does to any other ability", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    const before = engine.abilityCooldownSeconds(state, "innate_power");
    assert(engine.purchaseAbilityFocus(state, "innate_power"));
    assertClose(engine.abilityCooldownSeconds(state, "innate_power"), before - engine.TIME_SCALE, 1e-9);
  });

  test("focus: resets with the round, same as the Energy that bought it", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;

    assert(engine.purchaseAbilityFocus(state, "rivers_bounty"));
    assertEqual(engine.abilityFocusPurchases(state, "rivers_bounty"), 1);

    engine.startRound(state);
    assertEqual(engine.abilityFocusPurchases(state, "rivers_bounty"), 0, "cleared");
    assertEqual(engine.abilityCooldownSeconds(state, "rivers_bounty") / engine.TIME_SCALE, 15, "back to full cooldown");
  });

  test("focus: the Presence unlock itself survives a round boundary - only the purchases die", () => {
    const { state } = newGame();
    grantPresence(state, "presence_current_quickens");
    engine.startRound(state);
    assert(engine.abilityFocusUnlocked(state), "the capability is permanent");
  });

  /* ---------- Across a save ---------- */

  test("focus: the invested Energy survives a save, and an unknown ability id is dropped", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      round: { abilityFocusEnergy: { rivers_bounty: 24, made_up_ability: 9, flash_floods: -1 } }
    });

    assertEqual(loaded.round.abilityFocusEnergy.rivers_bounty, 24, "the real one survives");
    assertEqual(engine.abilityFocusPurchases(loaded, "rivers_bounty"), 3, "and reads back as the rungs it bought");
    assertEqual(loaded.round.abilityFocusEnergy.made_up_ability, undefined, "the invented one is dropped");
    assertEqual(loaded.round.abilityFocusEnergy.flash_floods, undefined, "a negative sum floors to 0 and is dropped like any other zero");
  });

  // Saves written while Focus counted rungs are read back as the Energy those rungs cost, on
  // the ladder the save's own tier puts in front of them - so a migrated save stands exactly
  // where it stood, and carries the same credit forward as one written yesterday.
  test("focus: a save holding the old rung counts migrates to the Energy they cost", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      round: {
        abilityTiers: { innate_power: 1 },
        abilityFocus: { rivers_bounty: 3, innate_power: 2, made_up_ability: 4 }
      }
    });

    assertEqual(loaded.round.abilityFocus, undefined, "the old field is gone, not left to disagree");
    assertEqual(loaded.round.abilityFocusEnergy.rivers_bounty, 5 + 8 + 11, "priced on its own ladder");
    assertEqual(loaded.round.abilityFocusEnergy.innate_power, 8 + 12, "and the Innate's on tier 2's");
    assertEqual(engine.abilityFocusPurchases(loaded, "rivers_bounty"), 3, "standing exactly where it stood");
    assertEqual(engine.abilityFocusPurchases(loaded, "innate_power"), 2);
    assertEqual(loaded.round.abilityFocusEnergy.made_up_ability, undefined, "the invented one is still dropped");
  });

  /* ---------- Locale ---------- */

  test("focus: both locales name the Presence row and its purchase button", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert(t.presenceNames.presence_current_quickens, `${lang} names the row`);
      assert(t.presenceTexts.presence_current_quickens, `${lang} describes the row`);
      assert(t.abilityFocusBtn, `${lang} has the button label`);
      assert(t.abilityFocusHint, `${lang} has the button's hint`);
      assert(t.abilityFocused, `${lang} logs a successful purchase`);
      assert(t.abilityFocusTooExpensive, `${lang} logs a refusal`);
    }
  });

  /* ---------- What the pill says ----------
   *
   * The ladder's one rule is that every rung takes the same fixed time off at a rising price, and
   * a player reading only the price reads that backwards - the rungs get dearer and the seconds
   * do not. So the pill says the seconds, and the log line says them too: the percentage it used
   * to quote was the last survivor of the multiplicative design and it hid the rule outright. */

  test("focus: every string that talks about the ladder quotes seconds, never a percentage", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      for (const key of ["abilityFocusBtn", "abilityFocusHint", "abilityFocused"]) {
        assert(t[key].indexOf("{seconds}") >= 0, `${lang}.${key} names the seconds a rung buys`);
        assertEqual(t[key].indexOf("{pct}"), -1, `${lang}.${key} quotes no percentage`);
      }
      assert(t.abilityFocusHint.indexOf("{floor}") >= 0, `${lang} hint names where the ladder stops`);
      assert(t.abilityFocusHint.indexOf("Fok") >= 0 || t.abilityFocusHint.indexOf("Foc") >= 0,
        `${lang} hint names the mechanic, which the label no longer has room for`);
      assert(t.abilityFocused.indexOf("{cooldown}") >= 0, `${lang} log names the cooldown it landed on`);
      // The two blurbs about Focus in general take the step too - the Presence row that sells it
      // and the cooldown hint on a card in the offer.
      assert(t.presenceTexts.presence_current_quickens.indexOf("{seconds}") >= 0, `${lang} sells it in seconds`);
      assert(t.cardOfferCooldownHint.indexOf("{seconds}") >= 0, `${lang} offer hint names the step`);
    }
  });

  // One beat, in the game seconds the engine holds the clock in - and *after* the round's
  // permanent haste, because that is the clock the bar draws. Quoting the beat instead would
  // promise a drop that does not arrive once `abilityCooldownMult` is bought. The speed dial is
  // applied on top of this, in the text layer, not here - see the pill test below.
  test("focus: a rung is priced in the seconds the bar actually loses", () => {
    const state = focusReady();
    assertEqual(engine.abilityFocusSecondsPerStep(state, "boon_of_vigor"), engine.TIME_SCALE, "one whole beat");

    state.round.abilityCooldownMult = 0.5;
    assertEqual(engine.abilityFocusSecondsPerStep(state, "boon_of_vigor"), engine.TIME_SCALE / 2,
      "halved along with the clock it comes off");

    const before = engine.abilityCooldownSeconds(state, "boon_of_vigor");
    const step = engine.abilityFocusSecondsPerStep(state, "boon_of_vigor");
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"), "buy the rung it just priced");
    assertClose(engine.abilityCooldownSeconds(state, "boon_of_vigor"), before - step, 1e-9,
      "and the bar loses exactly what the pill quoted");
  });

  /* A rung is always one beat. What a beat is *worth in seconds* is not fixed - the countdown is
   * drawn through the speed dial (`displaySeconds` in ui.js), so the same beat reads 2s at 1x, 1s
   * at 2x and a quarter at the playtest speed. The pill has to move with it or it promises a drop
   * the player is not watching. */
  test("focus: the pill's seconds follow the speed dial, like every countdown on screen", () => {
    const state = focusReady(1e6);

    state.ui.gameSpeed = 1;
    const at1x = engine.abilityFocusPillParts(state, "boon_of_vigor");
    assertEqual(at1x.cost, 3, "the opening rung's price");
    assertEqual(at1x.seconds, "2", "one beat is two seconds at 1x");
    assertEqual(at1x.floor, "8", "and the ladder stops at four beats");

    state.ui.gameSpeed = 2;
    const at2x = engine.abilityFocusPillParts(state, "boon_of_vigor");
    assertEqual(at2x.cost, 3, "the price is Energy and does not move with the dial");
    assertEqual(at2x.seconds, "1", "the same beat is one second at 2x");
    assertEqual(at2x.floor, "4", "and so is the floor it counts down to");

    // The general blurbs quote the same step, through the same dial.
    state.ui.gameSpeed = 1;
    assertEqual(engine.focusStepSecondsText(state), "2", "the Presence row at 1x");
    state.ui.gameSpeed = 2;
    assertEqual(engine.focusStepSecondsText(state), "1", "and at 2x");
  });

  test("focus: the pill's numbers vanish at the floor", () => {
    const state = focusReady(1e6);

    for (let i = 0; i < 8; i += 1) assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));
    const maxed = engine.abilityFocusPillParts(state, "boon_of_vigor");
    assertEqual(maxed.cost, Infinity, "no price left to quote");
    assertEqual(maxed.seconds, "0", "and no seconds left to promise");
  });

  // Both numerals read the same in either locale, so this asserts on the rendered line rather
  // than on one language's wording. The Boon opens at 12 beats; one rung leaves 11.
  test("focus: the log line names the seconds and the cooldown it landed on", () => {
    const state = focusReady();
    state.ui.gameSpeed = 1;
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));

    const line = state._log[0];
    assert(line.indexOf("-2 ") >= 0, `the step is in the line: ${line}`);
    assert(line.indexOf("22 ") >= 0, `and so is the cooldown it landed on: ${line}`);
    assertEqual(line.indexOf("%"), -1, "and no percentage anywhere in it");

    // The rung that lands *on* the floor still reports the beat it bought. The step is read
    // before the investment is written for exactly this line: read afterwards it would price the
    // rung that no longer exists, and the last purchase of every ladder would claim 0.
    state.resources.energy = 1e6;
    for (let i = 0; i < 7; i += 1) assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));
    assertEqual(beats(state, "boon_of_vigor"), 4, "resting on the floor");

    const last = state._log[0];
    assert(last.indexOf("-2 ") >= 0, `the last rung still names its beat: ${last}`);
    assert(last.indexOf("8 ") >= 0, `and the floor it landed on: ${last}`);
  });

  // A log line is a record of a moment, and the dial can be turned after it is written. It says
  // what the player watched happen, which is the same choice the pill makes - the alternative is
  // a pill reading -1 Sec and a log reading -2 Sec about the same click.
  test("focus: the log line is written through the dial the purchase was made at", () => {
    const state = focusReady();
    state.ui.gameSpeed = 2;
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));

    const line = state._log[0];
    assert(line.indexOf("-1 ") >= 0, `a beat is one second at 2x: ${line}`);
    assert(line.indexOf("11 ") >= 0, `and 22 game seconds are drawn as 11: ${line}`);
  });
})();
