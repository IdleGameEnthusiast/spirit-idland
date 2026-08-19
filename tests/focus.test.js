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
    newGame, grantPresence, unlockAllAbilities
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
    const base = engine.ABILITIES[abilityId].cooldownSeconds / engine.TIME_SCALE;
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

  // All four kit ladders are tuned now; the Innate and the seven cards are what is left on the
  // derived rule, and this is where their ladders stop until their own pass moves them.
  test("focus: an ability that names no floor falls to a third of its cooldown, rounded up", () => {
    const state = focusReady();
    assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), 3, "tier 1 is 8 beats");
    assertEqual(engine.abilityFocusStepBeats(state, "innate_power"), 1);
    assertEqual(engine.abilityFocusMaxPurchases(state, "innate_power"), 5);

    // A card is on the same derived rule, off its own cooldown - 10 beats down to 4 here.
    for (const id of Object.keys(engine.POWER_CARDS)) {
      const cardBeats = engine.POWER_CARDS[id].cooldownSeconds / engine.TIME_SCALE;
      assertEqual(engine.abilityFocusFloorBeats(state, id), Math.ceil(cardBeats / 3), `${id} floor`);
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

  // The Innate is the one ability whose record changes under it mid-round, and the floor is
  // read off the tier standing in the slot rather than off the one the round opened with.
  test("focus: a tiered ability's floor moves with the tier it is standing at", () => {
    const state = focusReady(1000);
    assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), 3, "tier 1 is 8 beats");
    assert(engine.upgradeAbility(state, "innate_power"), "buy tier 2");
    assertEqual(engine.abilityFocusFloorBeats(state, "innate_power"), 5, "tier 2 is 15 beats");
  });

  // Purchases outlive a tier change, so a shorter ladder has to hold them rather than let a
  // stale count push the cooldown under the new tier's floor.
  test("focus: purchases past a shorter ladder's end are held at its floor, never below it", () => {
    const state = focusReady(1e6);
    for (let i = 0; i < 5; i += 1) assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"));
    state.round.abilityFocus.boon_of_vigor = 500;
    assertEqual(beats(state, "boon_of_vigor"), 4, "pinned at the floor, not driven negative");
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

  // The Innate is also unlockCost 0 - also in the opening hand - but it does not fall through
  // to the same flat floor: it is the one ability that keeps growing stronger after it is
  // bought, so its own focusBaseCost keeps Focus from being the cheap way into its strongest
  // tier.
  test("focus: innate_power overrides the flat floor with its own, higher base cost", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");

    assertEqual(engine.abilityUnlockCost(state, "innate_power"), 0, "in the opening hand");
    assertEqual(engine.ABILITIES.innate_power.focusBaseCost, 25, "its own price, not the flat floor");
    assertEqual(engine.abilityFocusCost(state, "innate_power"), 25, "and the cost function actually charges it");
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
    assertClose(engine.abilityFocusMultiplier(state, "boon_of_vigor"), 4 / 12, 1e-9, "which the log reads as a third");
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

  test("focus: purchase counts survive a save, and an unknown ability id is dropped", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      round: { abilityFocus: { rivers_bounty: 3, made_up_ability: 9, flash_floods: -1 } }
    });

    assertEqual(loaded.round.abilityFocus.rivers_bounty, 3, "the real one survives");
    assertEqual(loaded.round.abilityFocus.made_up_ability, undefined, "the invented one is dropped");
    assertEqual(loaded.round.abilityFocus.flash_floods, undefined, "a negative count floors to 0 and is dropped like any other zero");
  });

  /* ---------- Locale ---------- */

  test("focus: both locales name the Presence row and its purchase button", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert(t.presenceNames.presence_current_quickens, `${lang} names the row`);
      assert(t.presenceTexts.presence_current_quickens, `${lang} describes the row`);
      assert(t.abilityFocusBtn, `${lang} has the button label`);
      assert(t.abilityFocused, `${lang} logs a successful purchase`);
      assert(t.abilityFocusTooExpensive, `${lang} logs a refusal`);
    }
  });
})();
