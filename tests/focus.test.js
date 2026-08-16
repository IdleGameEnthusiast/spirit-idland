/* Focus: spending Energy mid-round to shorten one ability's cooldown -
 * docs/tasks/implementation-microtasks.md#12.
 *
 * Two halves, tested separately. `abilityFocusMultiplierForPurchases` is a pure function of a
 * purchase count - three thresholds, each gentler than the last, pinned at a hard floor - and
 * is checked against its own rule directly, the same way haste.test.js checks
 * dahanHasteFraction before it ever touches a purchase. `purchaseAbilityFocus` is the stateful
 * half: the Presence gate, the Energy spend, and the round-state write. */

(function () {
  const {
    engine, test, assert, assertEqual, assertClose,
    newGame, grantPresence, unlockAllAbilities
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const FLOOR = engine.FOCUS_FLOOR_MULT;

  /* ---------- The pure curve ---------- */

  test("focus: no purchases leaves the multiplier at 1", () => {
    assertEqual(engine.abilityFocusMultiplierForPurchases(0), 1, "an untouched ability is untouched");
  });

  test("focus: the first purchase is a flat 5% cut", () => {
    assertClose(engine.abilityFocusMultiplierForPurchases(1), 0.95, 1e-9);
  });

  test("focus: the floor is 30% of the original, not 30% off it", () => {
    assertEqual(FLOOR, 0.3, "70% max reduction, not 30%");
    assertClose(engine.abilityFocusMultiplierForPurchases(1000), FLOOR, 1e-9, "a doctored count still stops at the floor");
  });

  // Re-derives the rule from the multiplier's own previous step rather than restating fixed
  // purchase counts, so this breaks on a wrong rate or a wrong threshold rather than only on a
  // wrong step count - and confirms both thresholds and the floor are actually reached within
  // a realistic number of purchases.
  test("focus: the rate softens at 70% and again at 50%, and never breaches the floor", () => {
    let prevMult = 1;
    let sawZone2 = false;
    let sawZone3 = false;
    for (let n = 1; n <= 400; n += 1) {
      const mult = engine.abilityFocusMultiplierForPurchases(n);
      assert(mult <= prevMult + 1e-9, `purchase ${n} must not raise the multiplier`);
      assert(mult >= FLOOR - 1e-9, `purchase ${n} must not breach the floor`);

      if (prevMult > 0.7) {
        assertClose(mult, prevMult * 0.95, 1e-9, `zone 1 (>70%) step at purchase ${n}`);
      } else if (prevMult > 0.5) {
        assertClose(mult, prevMult * 0.97, 1e-9, `zone 2 (50-70%) step at purchase ${n}`);
        sawZone2 = true;
      } else if (prevMult > FLOOR) {
        assertClose(mult, Math.max(FLOOR, prevMult * 0.98), 1e-9, `zone 3 (30-50%) step at purchase ${n}`);
        sawZone3 = true;
      } else {
        assertEqual(mult, FLOOR, `pinned at the floor by purchase ${n}`);
      }
      prevMult = mult;
    }
    assert(sawZone2, "400 purchases should cross the 70% threshold");
    assert(sawZone3, "400 purchases should cross the 50% threshold");
    assertEqual(prevMult, FLOOR, "400 purchases is enough to bottom out");
  });

  /* ---------- What it costs ---------- */

  test("focus: the first purchase costs exactly the ability's own unlock price", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");

    assertEqual(engine.abilityFocusCost(state, "rivers_bounty"), engine.abilityUnlockCost(state, "rivers_bounty"));
    assertEqual(engine.abilityFocusCost(state, "flash_floods"), engine.abilityUnlockCost(state, "flash_floods"));
    assertEqual(engine.abilityFocusCost(state, "wash_away"), engine.abilityUnlockCost(state, "wash_away"));
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
    const { state } = newGame();
    unlockAllAbilities(state);
    grantPresence(state, "presence_current_quickens");
    // Deliberately absurd: the point of the floor is that no amount of Energy buys past it, so
    // the test has to actually try to spend past it rather than stop just short.
    state.resources.energy = 1e18;

    for (let i = 0; i < 500; i += 1) {
      if (!engine.purchaseAbilityFocus(state, "boon_of_vigor")) break;
    }
    assertClose(engine.abilityFocusMultiplier(state, "boon_of_vigor"), FLOOR, 1e-9, "bottomed out");
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
    assertClose(engine.abilityCooldownSeconds(state, "wash_away"), before * 0.95, 1e-9, "5% shorter");
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
    assertClose(engine.abilityCooldownSeconds(state, "innate_power"), before * 0.95, 1e-9);
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
    assertClose(engine.abilityFocusMultiplier(state, "rivers_bounty"), 1, 1e-9, "back to full cooldown");
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
