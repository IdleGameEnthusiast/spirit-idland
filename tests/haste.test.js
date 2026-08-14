/* The Dahan Remember: the Fear pool and the strike clock it shortens.
 *
 * Two halves that meet in one place. The pool is a shop row bought by the handful instead of
 * by the rung (docs/spec/04-economy-formulas.md), and the haste is a divisor on the Dahan's
 * own timer (docs/spec/02-core-loop.md). What joins them is that the invested Fear *is* the
 * tier, so everything the shop already knew how to do - save it, cap it, sink it into the
 * sold-out half - it does here unchanged. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, clearBoard, setLand, healthOf, grantUpgrade, memoryStorage } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const FULL = engine.DAHAN_HASTE_FEAR_FOR_FULL;
  const BASE = engine.DAHAN_ATTACK_INTERVAL_SECONDS;

  /* ---------- The formula ---------- */

  test("haste: an empty pool leaves the strike clock exactly where it was", () => {
    assertEqual(engine.dahanHasteFraction(0), 0, "no Fear, no haste");
    assertEqual(engine.dahanAttackIntervalFor(0), BASE, "and the base interval untouched");
  });

  test("haste: 100 Fear buys 1%, at the bottom of the pool and near the top of it", () => {
    assertClose(engine.dahanHasteFraction(100), 0.01, 1e-9, "the first hundred");
    assertClose(engine.dahanHasteFraction(9900), 0.99, 1e-9, "and the last hundred, at the same rate");
    // The whole point of a linear sink: the hundredth 100 Fear buys what the first one did.
    assertClose(
      engine.dahanHasteFraction(5000) - engine.dahanHasteFraction(4900),
      engine.dahanHasteFraction(100) - engine.dahanHasteFraction(0),
      1e-9,
      "no curve anywhere in it"
    );
  });

  test("haste: a full pool strikes twice as often, not infinitely often", () => {
    assertEqual(engine.dahanHasteFraction(FULL), engine.DAHAN_HASTE_MAX, "the cap is reached exactly at the full pool");
    assertClose(engine.dahanAttackIntervalFor(FULL), BASE / 2, 1e-9, "100% haste halves the interval");
    // Division, not subtraction - see the note above DAHAN_HASTE_FEAR_FOR_FULL. A subtractive
    // rule at 100% would be a zero-second clock and an infinite loop in the tick.
    assert(engine.dahanAttackIntervalFor(FULL) > 0, "and no amount of haste reaches zero");
  });

  test("haste: the cap holds above the full pool", () => {
    assertEqual(engine.dahanHasteFraction(FULL * 3), engine.DAHAN_HASTE_MAX, "a doctored save buys nothing extra");
    assertClose(engine.dahanAttackIntervalFor(FULL * 3), BASE / 2, 1e-9, "the interval stops at half");
  });

  test("haste: the pool cannot be bought past its cap", () => {
    assertEqual(engine.upgradeMaxTier("dahan_remember"), FULL, "the top tier is the full pool");
    const { state } = newGame();
    state.meta.fear = FULL * 2;

    assert(engine.purchaseUpgrade(state, "dahan_remember", FULL), "the whole pool in one go");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "and it lands full");
    assert(!engine.purchaseUpgrade(state, "dahan_remember", 1), "one Fear more is refused");
    assertEqual(state.meta.fear, FULL, "and nothing is taken for the refusal");
  });

  /* ---------- Buying into it ---------- */

  test("haste: every unit of the pool costs the same one Fear", () => {
    const { state } = newGame();
    assertEqual(engine.upgradeCostGrowth("dahan_remember"), 1, "a pool has no cost curve");
    assertEqual(engine.upgradeCost(state, "dahan_remember"), 1, "the first unit costs 1");

    grantUpgrade(state, "dahan_remember", 4000);
    assertEqual(engine.upgradeCost(state, "dahan_remember"), 1, "and so does the four-thousandth");
    assertEqual(engine.upgradeCostFor(state, "dahan_remember", 1000), 1000, "a thousand of them cost a thousand");
  });

  test("haste: a bulk buy spends exactly what the same clicks would have", () => {
    const { state } = newGame();
    state.meta.fear = 500;

    assert(engine.purchaseUpgrade(state, "dahan_remember", 100), "+100 goes through");
    assertEqual(state.meta.fear, 400, "and takes 100 Fear");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), 100, "for 100 units of pool");
    assertClose(engine.dahanHasteFraction(engine.upgradeTier(state, "dahan_remember")), 0.01, 1e-9, "which is the 1%");
  });

  test("haste: a bulk buy larger than the pool has room for takes only what is left", () => {
    const { state } = newGame();
    grantUpgrade(state, "dahan_remember", FULL - 400);
    state.meta.fear = 5000;

    assert(engine.purchaseUpgrade(state, "dahan_remember", 1000), "the last +1000 finishes the pool");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "which is full, not overfull");
    assertEqual(state.meta.fear, 4600, "and it was charged for 400, not for 1000");
  });

  test("haste: a bulk buy the purse cannot cover is refused whole, never part-paid", () => {
    const { state } = newGame();
    state.meta.fear = 99;

    assert(!engine.purchaseUpgrade(state, "dahan_remember", 100), "+100 on 99 Fear is refused");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), 0, "nothing bought");
    assertEqual(state.meta.fear, 99, "and nothing spent - the max button is how you say 'as much as I can'");
  });

  test("haste: the max button is capped by the purse and by what is left of the pool", () => {
    const { state } = newGame();
    state.meta.fear = 250;
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 250, "250 Fear buys 250 units");

    grantUpgrade(state, "dahan_remember", FULL - 30);
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 30, "with 30 left, the purse is not the limit");

    grantUpgrade(state, "dahan_remember", FULL);
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 0, "and a full pool takes nothing");
  });

  test("haste: the ladders still count what they cost, one rung at a time", () => {
    const { state } = newGame();
    // The bulk path is general, so the rows that never use it must still price as they did:
    // three rungs of a 1.6 curve are the three individual prices summed, not a rounded total.
    const one = engine.upgradeCost(state, "dahan_reinforcement");
    grantUpgrade(state, "dahan_reinforcement", 1);
    const two = engine.upgradeCost(state, "dahan_reinforcement");
    grantUpgrade(state, "dahan_reinforcement", 2);
    const three = engine.upgradeCost(state, "dahan_reinforcement");

    state.upgrades.purchased.dahan_reinforcement = 0;
    assertEqual(engine.upgradeCostFor(state, "dahan_reinforcement", 3), one + two + three, "no discount, no tax");
  });

  test("haste: purchaseUpgrade still buys exactly one rung when nobody asks for more", () => {
    const { state } = newGame();
    state.meta.fear = 1000;
    assert(engine.purchaseUpgrade(state, "dahan_reinforcement"), "the old call shape");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 1, "buys one, as it always did");
  });

  /* ---------- The gate ---------- */

  test("haste: the pool is not required for the gate", () => {
    assert(!engine.upgradeRequiredForGate("dahan_remember"), "10000 Fear is a wall, not a gate");

    const { state } = newGame();
    for (const id of engine.UPGRADE_IDS) {
      if (!engine.upgradeRequiredForGate(id)) continue;
      grantUpgrade(state, id, engine.upgradeMaxTier(id));
    }
    assert(engine.gatedUpgradesUnlocked(state), "an empty pool does not hold the last two purchases shut");
    for (const id of engine.GATED_UPGRADE_IDS) {
      assert(!engine.upgradeIsLocked(state, id), `${id} is for sale`);
    }
  });

  // The invariant the old `softCapped` flag was standing in for, now that the flag is about
  // the gate rather than about the shape of the ladder: a row with no top tier can never
  // satisfy the gate, so it must never be asked to.
  test("haste: no row without a top tier is required for the gate", () => {
    for (const id of engine.UPGRADE_IDS) {
      if (!engine.upgradeIsSoftCapped(id)) continue;
      assert(!engine.upgradeRequiredForGate(id), `${id} has no top tier and would seal the gate forever`);
    }
  });

  /* ---------- What it does to the round ---------- */

  test("haste: a hasted round arms its strike clock short", () => {
    const ctx = newGame();
    grantUpgrade(ctx.state, "dahan_remember", FULL);
    engine.startRound(ctx.state);

    assertClose(ctx.state.round.dahanAttackRemaining, BASE / 2, 1e-9, "armed at the hasted interval");
    assertClose(engine.roundDahanAttackInterval(ctx.state), BASE / 2, 1e-9, "and refills to the same");
  });

  test("haste: a full pool strikes twice in the time an empty one strikes once", () => {
    /* Counted off the clock rather than off the board: the strike timer refills by one whole
     * interval every time it fires, so a rise in `dahanAttackRemaining` is a strike and
     * nothing else can cause one. Reading damage instead would have the count depend on what
     * the waves happened to put on the island and on whether the Dahan lived through it,
     * neither of which is what this test is about. */
    function strikesIn(invested, seconds) {
      const ctx = newGame();
      grantUpgrade(ctx.state, "dahan_remember", invested);
      engine.startRound(ctx.state);
      clearBoard(ctx.state);

      const step = 0.25;
      let strikes = 0;
      let last = ctx.state.round.dahanAttackRemaining;
      for (let elapsed = 0; elapsed < seconds; elapsed += step) {
        advance(ctx, step, step);
        const now = ctx.state.round.dahanAttackRemaining;
        if (now > last) strikes += 1;
        last = now;
      }
      assertEqual(ctx.state.round.status, "running", "the round lasted the whole measurement");
      return strikes;
    }

    const slow = strikesIn(0, BASE * 2);
    const fast = strikesIn(FULL, BASE * 2);
    assertEqual(slow, 2, "two base intervals is two strikes");
    assertEqual(fast, slow * 2, "and a full pool fits exactly twice as many into the same time");
  });

  test("haste: the round in progress never benefits from Fear poured in during it", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.startRound(state);
    state.meta.fear = FULL;

    assert(engine.purchaseUpgrade(state, "dahan_remember", FULL), "the pool is filled mid-round");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "and it is owned");
    assertClose(engine.roundDahanAttackInterval(state), BASE, 1e-9, "but this round strikes at the old rate");

    engine.startRound(state);
    assertClose(engine.roundDahanAttackInterval(state), BASE / 2, 1e-9, "the next one takes the snapshot");
  });

  /* ---------- What the shop says about it ---------- */

  test("haste: the row shows a percentage where a ladder shows its tier", () => {
    const { state } = newGame({ language: "en" });
    grantUpgrade(state, "dahan_remember", 4271);

    const status = engine.upgradeStatusText(state, "dahan_remember");
    assert(/42\.71/.test(status), `the chip reads the haste, not the tier: ${status}`);
    assert(!/4271/.test(status), `and never the raw unit count: ${status}`);
    assert(/Tier/i.test(engine.upgradeStatusText(state, "dahan_reinforcement")), "a ladder still shows its tier");
    assertEqual(engine.upgradeStatusText(state, "auto_boon"), "", "a one-off shows nothing");
  });

  test("haste: two decimals, because one Fear is a hundredth of a percent", () => {
    const { state } = newGame({ language: "en" });
    grantUpgrade(state, "dahan_remember", 1);
    const one = engine.upgradeStatusText(state, "dahan_remember");
    grantUpgrade(state, "dahan_remember", 10);
    const ten = engine.upgradeStatusText(state, "dahan_remember");

    assert(one !== ten, `the smallest purchases must not print the same number: ${one} / ${ten}`);
    grantUpgrade(state, "dahan_remember", 5000);
    assert(/50%/.test(engine.upgradeStatusText(state, "dahan_remember")), "and a round percentage keeps no trailing zeros");
  });

  test("haste: the row text quotes the clock the player is watching", () => {
    const { state } = newGame({ language: "en" });
    state.ui.gameSpeed = 1;
    grantUpgrade(state, "dahan_remember", FULL);

    const text = engine.upgradeText(state, "dahan_remember");
    // At 1x the base is 20 real seconds, so a full pool reads as 10.
    assert(/10/.test(text), `the full pool quotes its 10s: ${text}`);
    assert(/20/.test(text), `against the 20s it started from: ${text}`);
  });

  test("haste: the buy is logged as Fear in and haste out, not as a tier", () => {
    const { state } = newGame({ language: "en" });
    state.meta.fear = 250;
    engine.purchaseUpgrade(state, "dahan_remember", 250);

    const line = state._log[0] || "";
    assert(/250/.test(line), `the Fear it took: ${line}`);
    assert(/2\.5%/.test(line), `and where that leaves the haste: ${line}`);
    assert(!/tier/i.test(line), `and no tier anywhere in it: ${line}`);
  });

  test("haste: both locales name the pool and its buttons", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert(t.upgradeNames.dahan_remember, `${lang} names it`);
      assert(t.upgradeTexts.dahan_remember, `${lang} describes it`);
      assert(t.upgradeNextTexts.dahan_remember, `${lang} says where the pool stands`);
      assert(t.upgradeMaxedTexts.dahan_remember, `${lang} says when it is full`);
      assert(t.shopHasteLabel && t.shopInvestBtn && t.shopInvestMaxBtn, `${lang} has the pool's chrome`);
      assert(t.upgradeInvested, `${lang} logs the investment`);
    }
  });

  /* ---------- Across a save ---------- */

  test("haste: the pool survives a save, and a save from before it loads unhasted", () => {
    const storage = memoryStorage();
    const { state } = newGame();
    grantUpgrade(state, "dahan_remember", 3300);
    engine.saveState(state, storage);

    const loaded = engine.loadState(storage);
    assertEqual(engine.upgradeTier(loaded, "dahan_remember"), 3300, "the pool came back");
    assertClose(engine.dahanHasteFraction(engine.upgradeTier(loaded, "dahan_remember")), 0.33, 1e-9, "at the haste it bought");

    // A save written before the pool existed: no row, no snapshot entry, and the strike clock
    // has to read exactly as it did when that save was written.
    const old = engine.normalizeState({ round: { dahanAttackRemaining: 999 } });
    assertEqual(engine.upgradeTier(old, "dahan_remember"), 0, "no pool in an old save");
    assertClose(engine.roundDahanAttackInterval(old), BASE, 1e-9, "so it strikes at the base interval");
    assert(old.round.dahanAttackRemaining <= BASE, "and a nonsense remaining is clamped back into the interval");
  });
})();
