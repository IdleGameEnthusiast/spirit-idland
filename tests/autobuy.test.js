/* The auto-buy dial: how far a round spends its own Energy, and how it chooses once it gets
 * there - docs/spec/05-progression.md#auto-buy.
 *
 * `tests/automation.test.js` already covers what the resolver buys when nobody has touched a
 * setting; everything here is about the settings themselves. Four groups, in the order the
 * sheet draws them: the cumulative dial, the Innate cap, the Focus loop and the order it picks
 * in, and the per-ability opt-out.
 *
 * The one rule the whole layer hangs off, and the reason "spend it all" is never wrong: Energy
 * does not survive a round. `startRound` resets the purse and `round.abilityFocusEnergy` with
 * it, so Energy still banked when a round ends is Energy destroyed. There is no version of this
 * bot that should be saving. */

(function () {
  const {
    engine, test, assert, assertEqual, newGame,
    unlockAllAbilities, grantUpgrade, grantPresence, setAbilityTier, handCards
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  // Auto-buy owned and live this round, the kit already unlocked so the unlock step has nothing
  // to do, and both Presence rows Focus needs. What is left is the part under test.
  function autoFocusReady(energy) {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_current_quickens");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = energy === undefined ? 100 : energy;
    return state;
  }

  // Refuse Focus everywhere, so the purse after a tick says what the tier loop alone spent.
  // The tiers are bought at the top rung of the dial and nowhere else (see AUTO_BUY_MODES), so
  // a test about the cap has to run there - and at that rung Focus would otherwise drain
  // whatever the tiers left behind.
  const refuseAllFocus = (state) => {
    for (const id of engine.unlockedAbilityIds(state)) engine.setAutoBuyFocusAllowed(state, id, false);
  };

  const beats = (state, id) => engine.abilityCooldownSeconds(state, id) / engine.TIME_SCALE;
  const totalFocusSpent = (state) => engine.spiritAbilityIds(state)
    .reduce((sum, id) => sum + engine.abilityFocusEnergy(state, id), 0);

  /* ---------------------------------------------------------------- *
   * The cumulative dial                                                *
   * ---------------------------------------------------------------- */

  test("auto-buy dial: a fresh game spends as far as it is allowed to", () => {
    const { state } = newGame();
    // The stored default is the top rung, so nothing has to be switched on when the Presence
    // row is finally bought. What it *does* today is one rung lower, because the row is not
    // owned yet - which is the whole of the difference between the two readers.
    assertEqual(engine.autoBuyMode(state), "focus", "the preference opens at the top");
    assertEqual(
      engine.autoBuyModeRank(state),
      engine.AUTO_BUY_MODES.indexOf("unlocks"),
      "and behaves one rung down until the row is bought"
    );

    grantPresence(state, "presence_river_deepens");
    assertEqual(
      engine.autoBuyModeRank(state),
      engine.AUTO_BUY_MODES.indexOf("focus"),
      "buying the row turns it on with no second click"
    );
  });

  test("auto-buy dial: off spends nothing at all", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    state.resources.energy = 500;
    engine.setAutoBuyMode(state, "off");

    engine.resolveAutoBuyAbilities(state);

    assert(!engine.abilityIsUnlocked(state, "rivers_bounty"), "not even the 5");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "and no tier");
    assertEqual(state.resources.energy, 500, "the purse is untouched");
  });

  test("auto-buy dial: unlocks-only stops before the Innate", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    state.resources.energy = 500;
    engine.setAutoBuyMode(state, "unlocks");

    engine.resolveAutoBuyAbilities(state);

    for (const abilityId of ["rivers_bounty", "flash_floods", "wash_away"]) {
      assert(engine.abilityIsUnlocked(state, abilityId), `${abilityId} was still bought`);
    }
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "and the tier ladder is left alone");
    assertEqual(state.resources.energy, 500 - 35, "only the three unlocks were paid for");
  });

  test("auto-buy dial: the retired tiers rung is not a rung any more", () => {
    // It sat between the unlocks and Focus, and the split on the Energy purse replaced it: the
    // Innate is decided there now, so a rung for it would be the same choice twice.
    const { state } = newGame();
    assert(!engine.setAutoBuyMode(state, "tiers"), "the setter refuses it");

    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      ui: { autoBuy: { mode: "tiers" } }
    });
    // The top rung, which is where the tiers are bought now - so a save that asked for them
    // still gets them, under whatever the split says.
    assertEqual(engine.autoBuyMode(loaded), "focus", "and a save holding it opens at the top");
  });

  test("auto-buy dial: an unknown mode is refused rather than stored", () => {
    const { state } = newGame();
    assert(!engine.setAutoBuyMode(state, "everything"), "the setter says no");
    assertEqual(engine.autoBuyMode(state), "focus", "and the setting is unchanged");
  });

  test("auto-buy dial: the Presence gate holds even when the mode says focus", () => {
    // Focus itself unlocked, but not the row that lets the *bot* spend into it. The player can
    // still click the pill; the automation cannot.
    const { state } = newGame();
    unlockAllAbilities(state);
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_current_quickens");
    state.resources.energy = 1000;
    engine.setAutoBuyMode(state, "focus");

    engine.resolveAutoBuyAbilities(state);

    assertEqual(totalFocusSpent(state), 0, "the bot bought no rungs");
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"), "the player still can");
  });

  /* ---------------------------------------------------------------- *
   * The Innate cap                                                     *
   * ---------------------------------------------------------------- */

  test("auto-buy cap: it defaults to the top of the ladder, so nothing changes without it", () => {
    const { state } = newGame();
    assertEqual(engine.autoBuyTierCap(state), engine.abilityMaxTier("innate_power") + 1, "the top tier");
  });

  test("auto-buy cap: capped at 2, the Innate stops one rung short", () => {
    const state = autoFocusReady(1000);
    refuseAllFocus(state);
    engine.setAutoBuyTierCap(state, 2);

    // Two ticks, because the tier loop climbs one rung per tick by design.
    engine.resolveAutoBuyAbilities(state);
    engine.resolveAutoBuyAbilities(state);

    assertEqual(engine.abilityTier(state, "innate_power"), 1, "tier 2 on the card, and no further");
    assertEqual(state.resources.energy, 1000 - 40, "the 150 was never spent");
  });

  test("auto-buy cap: capped at 1, the Innate is never upgraded at all", () => {
    const state = autoFocusReady(1000);
    refuseAllFocus(state);
    engine.setAutoBuyTierCap(state, 1);

    engine.resolveAutoBuyAbilities(state);

    assertEqual(engine.abilityTier(state, "innate_power"), 0, "still tier 1");
    assertEqual(state.resources.energy, 1000, "and nothing spent");
  });

  test("auto-buy cap: what the cap refuses goes into Focus instead", () => {
    // The reason the cap exists. Early in a cycle a round cannot reach tier 3, and the Energy
    // that would have been banked toward it is worth more spent on the clock.
    const state = autoFocusReady(1000);
    engine.setAutoBuyTierCap(state, 1);

    engine.resolveAutoBuyAbilities(state);

    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the Innate was left where it was");
    assert(totalFocusSpent(state) > 0, "and the Energy went into cooldowns");
    assert(state.resources.energy < 40, "with too little left to have bought the tier anyway");
  });

  test("auto-buy cap: it binds the automation only, never the player's own click", () => {
    const state = autoFocusReady(1000);
    engine.setAutoBuyTierCap(state, 1);

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the bot obeyed the cap");

    state.resources.energy = 1000;
    assert(engine.upgradeAbility(state, "innate_power"), "the button still works");
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "and the tier is bought");
  });

  test("auto-buy cap: it is clamped to the ladder rather than trusted", () => {
    const { state } = newGame();
    engine.setAutoBuyTierCap(state, 99);
    assertEqual(engine.autoBuyTierCap(state), engine.abilityMaxTier("innate_power") + 1, "no higher than the top");
    engine.setAutoBuyTierCap(state, -4);
    assertEqual(engine.autoBuyTierCap(state), 1, "and no lower than the first tier");
  });

  /* ---------------------------------------------------------------- *
   * The split: Energy to Focus, or up the Innate's tiers               *
   * ---------------------------------------------------------------- */

  /* 05-progression.md#where-the-energy-goes.
   *
   * The cap divides the Energy between two claims, and both are only live at the top rung of
   * the dial: below it neither the tiers nor Focus are bought at all, so there is nothing there
   * for a split to divide. */

  test("auto-buy split: at the focus rung the cap decides how far the Innate climbs", () => {
    const state = autoFocusReady(0);
    engine.setAutoBuyMode(state, "focus");

    engine.setAutoBuyTierCap(state, 1);
    assert(!engine.autoBuyTierWanted(state, "innate_power"), "Energy to Focus: the Innate is left alone");
    assertEqual(engine.autoBuyReserve(state), 0, "so nothing is banked for it");

    engine.setAutoBuyTierCap(state, 2);
    assert(engine.autoBuyTierWanted(state, "innate_power"), "targeting Tier 2: the climb is wanted");
    assertEqual(engine.autoBuyReserve(state), 40, "and the price is banked");
  });

  test("auto-buy split: reaching the target hands the Energy back to Focus", () => {
    const state = autoFocusReady(0);
    engine.setAutoBuyTierCap(state, 2);
    setAbilityTier(state, "innate_power", 1);

    assert(!engine.autoBuyTierWanted(state, "innate_power"), "the target is where the Innate stands");
    assertEqual(engine.autoBuyReserve(state), 0, "so Focus may have everything again");
  });

  test("auto-buy split: a target above the next tier still climbs one rung at a time", () => {
    const state = autoFocusReady(190);
    refuseAllFocus(state);
    engine.setAutoBuyTierCap(state, 3);

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "one rung this tick, not two");
    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 2, "and the next on the tick after");
    assert(!engine.autoBuyTierWanted(state, "innate_power"), "then it stops at the target");
  });

  test("auto-buy split: below the focus rung there is no Innate to divide anything with", () => {
    // The unlocks rung says so on its face - "Unlocks (except Innate)". Nothing is banked for a
    // tier there, because nothing is going to buy one.
    const state = autoFocusReady(1000);
    engine.setAutoBuyMode(state, "unlocks");
    engine.setAutoBuyTierCap(state, 3);

    engine.resolveAutoBuyAbilities(state);

    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the Innate was left where it was");
    assertEqual(engine.autoBuyReserve(state), 0, "and nothing is banked toward it");
    assertEqual(state.resources.energy, 1000, "the kit was already bought, so nothing was spent");
  });

  test("auto-buy split: the top of the ladder stops it", () => {
    const state = autoFocusReady(0);
    engine.setAutoBuyTierCap(state, 3);
    setAbilityTier(state, "innate_power", engine.abilityMaxTier("innate_power"));

    assert(!engine.autoBuyTierWanted(state, "innate_power"), "there is no rung above the last");
    assertEqual(engine.autoBuyReserve(state), 0, "so Focus takes everything");
  });

  test("auto-buy split: it binds the automation only, never the player's own click", () => {
    const state = autoFocusReady(40);
    engine.setAutoBuyTierCap(state, 1);
    assert(!engine.autoBuyTierWanted(state, "innate_power"), "the bot declines");
    assert(engine.upgradeAbility(state, "innate_power"), "the hand still buys it");
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "at the tier the click asked for");
  });

  test("auto-buy split: what the cap refuses reaches Focus in the same tick", () => {
    const state = autoFocusReady(40);
    engine.setAutoBuyTierCap(state, 1);

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the Innate was not carried up");
    assert(totalFocusSpent(state) > 0, "and the Energy went into Focus instead");
  });



  /* ---------------------------------------------------------------- *
   * What a rung is worth, and the order it is bought in                *
   * ---------------------------------------------------------------- */

  /* The metric's shape, asserted rather than its arithmetic re-derived. Two properties matter,
   * and they are the two the subtractive ladder was built to have (see the ladder note in
   * engine/abilities.js): a rung is worth more the further down a ladder it sits, and it is
   * worth less the more it costs. */

  test("focus value: a later rung on the same ladder buys more throughput per Energy", () => {
    // Not the same as "is cheaper" - the later rung is dearer. It is worth more anyway, because
    // a beat off 5 is a bigger share of the cast rate than a beat off 12, and that is exactly
    // the property a percentage-of-cooldown metric would have got backwards.
    const state = autoFocusReady(1e6);
    const opening = engine.abilityFocusValuePerEnergy(state, "boon_of_vigor");

    // Walk to the last rung of the Boon's ladder.
    while (Number.isFinite(engine.abilityFocusCost(state, "boon_of_vigor"))) {
      const before = engine.abilityFocusValuePerEnergy(state, "boon_of_vigor");
      assert(before > 0, "every rung on the ladder is worth something");
      if (!engine.purchaseAbilityFocus(state, "boon_of_vigor", true)) break;
    }

    assertEqual(engine.abilityFocusValuePerEnergy(state, "boon_of_vigor"), 0, "past the floor it is worth nothing");
    assert(opening > 0, "and the ladder opened somewhere above zero");
  });

  test("focus value: it is read out of the catalogue's own anchor, not a second table", () => {
    // The inversion abilityFocusValuePerEnergy performs: anchor * cooldownBeats / 100 is what
    // the balance pass called one cast's worth. If this drifts, the ranking has grown a private
    // opinion about the kit that 04-economy-formulas.md does not know about.
    const state = autoFocusReady(1e6);
    const abilityId = "wash_away";
    const record = engine.abilityRecord(state, abilityId);
    const cooldownBeats = record.cooldownSeconds / engine.TIME_SCALE;
    const worth = engine.abilityFocusBaseCost(state, abilityId) * cooldownBeats / 100;

    const cost = engine.abilityFocusCost(state, abilityId);
    const now = engine.abilityFocusedCooldownSeconds(state, abilityId) / engine.TIME_SCALE;
    const next = now - engine.abilityFocusStepBeats(state, abilityId);
    const expected = worth * (1 / next - 1 / now) / cost;

    assertEqual(engine.abilityFocusValuePerEnergy(state, abilityId), expected, "the metric is that product");
  });

  test("focus order: best value picks the highest-scoring affordable rung on the board", () => {
    // Asserted as the property rather than as a named winner. Which ability leads is a reading
    // of the tuned ladders and moves whenever they are retuned - pinning it here would turn
    // every balance pass into a failing test in a file that is not about balance.
    const state = autoFocusReady(1000);
    engine.setAutoBuyFocusOrder(state, "value");

    const picked = engine.pickAutoBuyFocusTarget(state);
    assert(picked, "something was picked");

    const best = engine.abilityFocusValuePerEnergy(state, picked);
    for (const abilityId of engine.unlockedAbilityIds(state)) {
      const cost = engine.abilityFocusCost(state, abilityId);
      if (!Number.isFinite(cost) || cost > state.resources.energy) continue;
      assert(
        engine.abilityFocusValuePerEnergy(state, abilityId) <= best,
        `${abilityId} scores higher than the ability that was picked`
      );
    }
  });

  test("focus order: cheapest takes the lowest price on the board, whatever it is worth", () => {
    const state = autoFocusReady(1000);
    engine.setAutoBuyFocusOrder(state, "cheap");

    const picked = engine.pickAutoBuyFocusTarget(state);
    const cheapest = engine.unlockedAbilityIds(state)
      .map((id) => engine.abilityFocusCost(state, id))
      .filter((cost) => Number.isFinite(cost))
      .reduce((low, cost) => Math.min(low, cost), Infinity);
    assertEqual(engine.abilityFocusCost(state, picked), cheapest, "it picked a rung at that price");
  });

  test("focus order: nothing affordable means nothing picked, not the best unaffordable rung", () => {
    // A bot that saved for the finest rung it had ever seen would end the round with a full
    // purse, and a full purse at the end of a round is Energy set on fire.
    const state = autoFocusReady(0);
    // Cap at 1 so nothing is being saved toward: this is about affordability, not the reserve,
    // which has its own group below.
    engine.setAutoBuyTierCap(state, 1);
    assertEqual(engine.pickAutoBuyFocusTarget(state), null, "nothing is picked at zero Energy");

    state.resources.energy = 3;
    assert(engine.pickAutoBuyFocusTarget(state), "and the cheapest opening rung is taken at 3");
  });

  /* ---------------------------------------------------------------- *
   * The Focus loop                                                     *
   * ---------------------------------------------------------------- */

  test("auto-buy focus: it drains the purse rather than stepping once", () => {
    // The opposite of the tier loop, and deliberately: with the cap reached there is nothing
    // left to save for, so Focus is the last claim on the Energy and takes all of it.
    const state = autoFocusReady(60);
    engine.setAutoBuyTierCap(state, 1);

    engine.resolveAutoBuyFocus(state);

    assert(state.resources.energy < 3, "it spent down to what no ladder will sell");
    assert(totalFocusSpent(state) >= 55, "and nearly all of it landed on a ladder");
  });

  test("auto-buy focus: the cooldowns it buys are real, and stop at the floor", () => {
    const state = autoFocusReady(1e6);
    const before = beats(state, "boon_of_vigor");

    engine.resolveAutoBuyFocus(state);

    assert(beats(state, "boon_of_vigor") < before, "the Boon got faster");
    assertEqual(
      beats(state, "boon_of_vigor"),
      engine.abilityFocusFloorBeats(state, "boon_of_vigor"),
      "and stopped exactly on its floor"
    );
  });

  test("auto-buy focus: a huge purse terminates rather than spinning", () => {
    // Every ladder is finite, so the loop must run out of things to buy. The guard exists for
    // the case where that stops being true; this is the check that it has not.
    const state = autoFocusReady(1e9);

    engine.resolveAutoBuyFocus(state);

    assertEqual(engine.pickAutoBuyFocusTarget(state), null, "there is nothing left it could buy");
    for (const abilityId of engine.unlockedAbilityIds(state)) {
      assertEqual(
        engine.abilityFocusCost(state, abilityId),
        Infinity,
        `${abilityId} is on its floor with no price left to quote`
      );
    }
  });

  test("auto-buy focus: it stays out of the log, where the unlocks and tiers do not", () => {
    // Bounded events log, repeating ones do not - the same line auto-cast draws. A round buys
    // three unlocks and two tiers and then stops; Focus never stops.
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_current_quickens");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = 400;

    // Emptied rather than measured against: the log keeps only its newest 24 lines, so a count
    // taken across a spend this size could come back unchanged for the wrong reason.
    state._log = [];
    engine.resolveAutoBuyAbilities(state);
    assert(state._log.length > 0, "the unlocks and the tier said so");
    assert(totalFocusSpent(state) > 0, "and Focus was bought in the same call");

    state._log = [];
    state.resources.energy = 1e6;
    engine.resolveAutoBuyFocus(state);
    assertEqual(state._log.length, 0, "but not one line of it reached the log");
  });

  test("auto-buy focus: a clicked rung still logs", () => {
    const state = autoFocusReady(1000);
    state._log = [];
    assert(engine.purchaseAbilityFocus(state, "boon_of_vigor"), "bought by hand");
    assert(state._log.length > 0, "and said so");
  });

  test("auto-buy focus: it runs after the unlocks, never instead of them", () => {
    // The order that matters most. An unlock is what the three cast automations are waiting on,
    // and Focus is a sink with no bottom - putting it first would starve them for the round.
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_current_quickens");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = 35;

    engine.resolveAutoBuyAbilities(state);

    for (const abilityId of ["rivers_bounty", "flash_floods", "wash_away"]) {
      assert(engine.abilityIsUnlocked(state, abilityId), `${abilityId} was bought first`);
    }
    assertEqual(totalFocusSpent(state), 0, "and there was nothing left for Focus");
  });

  /* ---------------------------------------------------------------- *
   * The reserve: Focus must not eat what the other two rungs need      *
   * ---------------------------------------------------------------- */

  /* Energy arrives a few at a time across a whole round, not in one lump. Focus is the only
   * claim on it with no ceiling and a floor price of 3, so a resolver that drained the purse
   * every tick would hold it between 0 and 2 forever - and the 5 the cheapest unlock wants, or
   * the 150 the Innate's last tier wants, would never be reached. Spending order within a tick
   * does not fix that on its own; the reserve does.
   *
   * `drip` is what makes these honest: it feeds the round the way a round is actually fed. */
  function drip(state, perTick, ticks) {
    for (let i = 0; i < ticks; i += 1) {
      state.resources.energy += perTick;
      engine.resolveAutoBuyAbilities(state);
    }
  }

  test("auto-buy reserve: a trickle still buys the unlocks, and Focus does not eat them", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_current_quickens");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = 0;

    // 2 an tick, well under the cheapest Focus rung, for long enough to cover 5 + 10 + 20.
    drip(state, 2, 40);

    for (const abilityId of ["rivers_bounty", "flash_floods", "wash_away"]) {
      assert(engine.abilityIsUnlocked(state, abilityId), `${abilityId} was reached on a trickle`);
    }
  });

  test("auto-buy reserve: a trickle still reaches the Innate's capped tier", () => {
    // The case that names the bug: at the default cap the bot has to bank 40 and then 150 out
    // of an income that arrives 2 at a time, while a 3-Energy Focus rung sits there tempting it.
    const state = autoFocusReady(0);
    engine.setAutoBuyTierCap(state, 3);

    drip(state, 2, 200);

    assertEqual(engine.abilityTier(state, "innate_power"), 2, "tier 3, bought out of a trickle");
  });

  test("auto-buy reserve: once there is nothing left to save for, Focus takes it all", () => {
    const state = autoFocusReady(0);
    engine.setAutoBuyTierCap(state, 3);

    drip(state, 2, 400);

    assertEqual(engine.abilityTier(state, "innate_power"), 2, "the ladder is finished");
    assert(totalFocusSpent(state) > 0, "and the overflow went into Focus");
    assertEqual(engine.autoBuyReserve(state), 0, "with nothing left to save toward");
    // Not "the purse is near zero": Focus prices climb, so what is left over is legitimately
    // anything under the cheapest next rung on the board. The invariant is that nothing it
    // could have bought went unbought.
    assertEqual(engine.pickAutoBuyFocusTarget(state), null, "and nothing buyable left unbought");
  });

  test("auto-buy reserve: a cap of 1 reserves nothing, so Focus starts at once", () => {
    // The other half of what the cap is for. Nothing is being saved toward, so every Energy
    // above a rung's price goes into the clock from the first tick.
    const state = autoFocusReady(0);
    engine.setAutoBuyTierCap(state, 1);

    drip(state, 2, 10);

    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the Innate was never raised");
    assert(totalFocusSpent(state) > 0, "and the trickle went straight into Focus");
  });

  /* ---------------------------------------------------------------- *
   * The per-ability opt-out                                            *
   * ---------------------------------------------------------------- */

  test("auto-buy focus: everything is allowed until something is refused", () => {
    const { state } = newGame();
    assert(engine.autoBuyFocusAllowed(state, "wash_away"), "absent means allowed");
    engine.setAutoBuyFocusAllowed(state, "wash_away", false);
    assert(!engine.autoBuyFocusAllowed(state, "wash_away"), "and off means off");
    engine.setAutoBuyFocusAllowed(state, "wash_away", true);
    assert(engine.autoBuyFocusAllowed(state, "wash_away"), "back on again");
  });

  test("auto-buy focus: only the refusals are stored, so the save stays a list of exceptions", () => {
    const { state } = newGame();
    engine.setAutoBuyFocusAllowed(state, "wash_away", true);
    assertEqual(state.ui.autoBuy.focusAbilities.wash_away, undefined, "allowing writes nothing");
    engine.setAutoBuyFocusAllowed(state, "wash_away", false);
    assertEqual(state.ui.autoBuy.focusAbilities.wash_away, false, "refusing writes the exception");
  });

  test("auto-buy focus: a refused ability is skipped and its neighbours are not", () => {
    const state = autoFocusReady(1e6);
    engine.setAutoBuyFocusAllowed(state, "boon_of_vigor", false);

    engine.resolveAutoBuyFocus(state);

    assertEqual(engine.abilityFocusEnergy(state, "boon_of_vigor"), 0, "the Boon was left alone");
    assert(engine.abilityFocusEnergy(state, "wash_away") > 0, "and the rest were not");
  });

  test("auto-buy focus: refusing every ability spends nothing and does not hang", () => {
    const state = autoFocusReady(1e6);
    for (const abilityId of engine.unlockedAbilityIds(state)) {
      engine.setAutoBuyFocusAllowed(state, abilityId, false);
    }

    engine.resolveAutoBuyFocus(state);

    assertEqual(totalFocusSpent(state), 0, "nothing bought");
    assertEqual(state.resources.energy, 1e6, "and nothing spent");
  });

  test("auto-buy focus: a card in hand is focusable without being switched on first", () => {
    const state = autoFocusReady(1e6);
    const cardId = engine.POWER_CARD_IDS[0];
    handCards(state, [cardId]);

    assert(engine.autoBuyFocusAllowed(state, cardId), "a card the player has never seen is allowed");
    engine.resolveAutoBuyFocus(state);
    assert(engine.abilityFocusEnergy(state, cardId) > 0, "and the bot spent on it");
  });

  test("auto-buy focus: a refusal for an unknown ability is not stored", () => {
    const { state } = newGame();
    assert(!engine.setAutoBuyFocusAllowed(state, "nonsense_power", false), "the setter refuses it");
    assertEqual(state.ui.autoBuy.focusAbilities.nonsense_power, undefined, "and stores nothing");
  });

  /* ---------------------------------------------------------------- *
   * The tier ladder and the Focus ladder, together                     *
   * ---------------------------------------------------------------- */

  test("auto-buy: a tier bought under the cap re-prices the Innate's Focus without refunding", () => {
    // The Innate's Energy carries across a tier change rather than its rungs (see
    // abilityFocusEnergy). The bot has to be able to buy a tier on top of Focus it already
    // bought, and lose nothing doing it.
    const state = autoFocusReady(1e6);
    setAbilityTier(state, "innate_power", 0);
    engine.setAutoBuyFocusAllowed(state, "boon_of_vigor", false);
    engine.setAutoBuyFocusAllowed(state, "rivers_bounty", false);
    engine.setAutoBuyFocusAllowed(state, "flash_floods", false);
    engine.setAutoBuyFocusAllowed(state, "wash_away", false);

    engine.resolveAutoBuyFocus(state);
    const invested = engine.abilityFocusEnergy(state, "innate_power");
    assert(invested > 0, "tier 1's ladder was walked");

    state.resources.energy = 1000;
    assert(engine.upgradeAbility(state, "innate_power"), "and the tier bought on top of it");
    assertEqual(
      engine.abilityFocusEnergy(state, "innate_power"),
      invested,
      "the investment is still there, now read against tier 2's ladder"
    );
  });

  /* ---------------------------------------------------------------- *
   * The settings survive a save                                        *
   * ---------------------------------------------------------------- */

  test("auto-buy settings: they load back exactly as they were written", () => {
    const { state } = newGame();
    engine.setAutoBuyMode(state, "unlocks");
    engine.setAutoBuyTierCap(state, 2);
    engine.setAutoBuyFocusOrder(state, "cheap");
    engine.setAutoBuyFocusAllowed(state, "wash_away", false);

    const loaded = engine.normalizeState(JSON.parse(JSON.stringify(state)));

    assertEqual(engine.autoBuyMode(loaded), "unlocks", "the dial");
    assertEqual(engine.autoBuyTierCap(loaded), 2, "the cap");
    assertEqual(engine.autoBuyFocusOrder(loaded), "cheap", "the order");
    assert(!engine.autoBuyFocusAllowed(loaded, "wash_away"), "and the one refusal");
    assert(engine.autoBuyFocusAllowed(loaded, "boon_of_vigor"), "with everything else still allowed");
  });

  test("auto-buy settings: a save from before the dial loads at the defaults", () => {
    const loaded = engine.normalizeState({ schemaVersion: engine.VERSION, ui: { language: "de" } });

    assertEqual(engine.autoBuyMode(loaded), "focus", "the dial opens at the top");
    assertEqual(engine.autoBuyTierCap(loaded), engine.abilityMaxTier("innate_power") + 1, "the cap at the ladder's top");
    assertEqual(engine.autoBuyFocusOrder(loaded), "value", "and the order at best-value");
    // Which together mean: unlocks and nothing else until `presence_river_deepens` is bought,
    // since the top rung is gated by a Presence row such a save cannot own - and the tiers and
    // Focus both live on that rung.
    assertEqual(
      engine.autoBuyModeRank(loaded),
      engine.AUTO_BUY_MODES.indexOf("unlocks"),
      "so it spends on the kit and waits for the row"
    );
  });

  test("auto-buy settings: nonsense in the save is repaired rather than carried", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      ui: {
        autoBuy: {
          mode: "everything",
          innateCap: 99,
          focusOrder: "vibes",
          focusAbilities: { wash_away: false, invented_ability: false, boon_of_vigor: true }
        }
      }
    });

    assertEqual(engine.autoBuyMode(loaded), "focus", "the bad mode fell back");
    assertEqual(engine.autoBuyTierCap(loaded), engine.abilityMaxTier("innate_power") + 1, "the cap was clamped");
    assertEqual(engine.autoBuyFocusOrder(loaded), "value", "the bad order fell back");
    assertEqual(loaded.ui.autoBuy.focusAbilities.wash_away, false, "the real refusal stayed");
    assertEqual(loaded.ui.autoBuy.focusAbilities.invented_ability, undefined, "the invented one went");
    assertEqual(loaded.ui.autoBuy.focusAbilities.boon_of_vigor, undefined, "and a stored `true` is not a refusal");
  });

  test("auto-buy settings: they survive a Reclaim, like every other preference", () => {
    const { state } = newGame();
    engine.setAutoBuyTierCap(state, 2);
    engine.setAutoBuyFocusOrder(state, "cheap");

    state.meta.cycleFearGenerated = 2500;
    state.meta.fear = 2500;
    engine.endRound(state);
    assert(engine.ascend(state), "the Reclaim went through");

    assertEqual(engine.autoBuyTierCap(state), 2, "the cap is where it was left");
    assertEqual(engine.autoBuyFocusOrder(state), "cheap", "and so is the order");
  });

  /* ---------------------------------------------------------------- *
   * The sheet's own disclosure                                         *
   * ---------------------------------------------------------------- */

  test("auto-buy sheet: the round's start folds it away", () => {
    // The rule that lets it be opened at any time: it unfolds above the ability bar and pushes
    // it down the page, so it must never still be open once waves are running.
    const { state } = newGame();
    state.ui.autoBuyOpen = true;

    engine.endRound(state);
    assertEqual(state.ui.autoBuyOpen, true, "the shop between rounds leaves it alone");

    assert(engine.startNextRound(state), "the next round began");
    assertEqual(state.ui.autoBuyOpen, false, "and closed it on the way in");
  });

  test("auto-buy sheet: there is nothing to configure until auto-buy is owned", () => {
    const { state } = newGame();
    assert(!engine.autoBuyOwned(state), "no button on a fresh game");
    grantUpgrade(state, "auto_buy_abilities");
    assert(engine.autoBuyOwned(state), "and one the moment it is bought");
  });

  /* ---------------------------------------------------------------- *
   * Text                                                               *
   * ---------------------------------------------------------------- */

  test("auto-buy text: every string the sheet draws exists in both languages", () => {
    const keys = [
      "autoBuyBtn", "autoBuyBtnHint", "autoBuyTitle", "autoBuySub", "autoBuySpendLegend",
      "autoBuyModeOff", "autoBuyModeOffWhy", "autoBuyModeUnlocks", "autoBuyModeUnlocksWhy",
      "autoBuyModeFocus", "autoBuyModeFocusWhy", "autoBuyModeFocusLocked",
      "innateSplitLegend", "innateSplitFocus", "innateSplitTier", "innateSplitHint",
      "autoBuyOrderLegend", "autoBuyOrderValue", "autoBuyOrderValueWhy",
      "autoBuyOrderCheap", "autoBuyOrderCheapWhy",
      "autoBuyFocusLegend", "autoBuyFocusRange", "autoBuyFocusRangeHint",
      "autoBuyFoot", "autoBuyCloseHint", "autoBuyDone"
    ];
    for (const lang of ["de", "en"]) {
      for (const key of keys) {
        assert(engine.I18N[lang][key], `${lang} is missing ${key}`);
      }
    }
  });

  test("auto-buy text: the cooldown range says where the ability is and where its ladder ends", () => {
    const state = autoFocusReady(1e6);
    const before = engine.abilityFocusRangeParts(state, "boon_of_vigor");
    assert(Number(before.now) > Number(before.floor), "it opens above its floor");

    engine.resolveAutoBuyFocus(state);
    const after = engine.abilityFocusRangeParts(state, "boon_of_vigor");
    assertEqual(after.now, after.floor, "and reads as two equal numbers once it is spent out");
  });
})();
