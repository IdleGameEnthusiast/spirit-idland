/* Fear and shop checks - docs/spec/08-acceptance-tests.md#fear-and-shop-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, advance, runUntilRoundEnds, clearBoard, setLand, unlockAllAbilities } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("shop: Fear earned mid-round is still there when the round ends", () => {
    const ctx = newGame();
    const { state } = ctx;
    unlockAllAbilities(state);

    // Earned by hand rather than played for: this check is about Fear surviving a lost
    // round, and an ability is the shortest way to put some on the books.
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    const earned = state.meta.fear;
    assert(earned > 0, "the ability should have earned Fear");

    runUntilRoundEnds(ctx);

    assertEqual(state.round.status, "ended", "round ended");
    assert(state.meta.fear >= earned, "Fear must survive the loss");
    assertClose(state.meta.fear, state.round.fearEarned, 0.0001, "all of it came from this round");
  });

  test("shop: Fear survives into the next round as well", () => {
    const ctx = newGame();
    const { state } = ctx;
    state.meta.fear = 9.45;
    runUntilRoundEnds(ctx);

    const banked = state.meta.fear;
    engine.startNextRound(state);

    assertClose(state.meta.fear, banked, 0.0001, "round setup must not touch meta.fear");
    assertEqual(state.round.fearEarned, 0, "the per-round counter does reset");
  });

  test("shop: Fear cannot be spent while a round is running", () => {
    const { state } = newGame();
    state.meta.fear = 100;

    const ok = engine.purchaseUpgrade(state, "dahan_reinforcement");
    assert(!ok, "purchase must be refused mid-round");
    assertEqual(state.meta.fear, 100, "no Fear deducted");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 0, "no tier gained");
  });

  test("shop: a purchase deducts its cost and increments the tier", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 100;

    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    const ok = engine.purchaseUpgrade(state, "dahan_reinforcement");

    assert(ok, "purchase should succeed");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 1, "tier 1");
    assertClose(state.meta.fear, 100 - cost, 0.0001, "cost deducted");
  });

  test("shop: an unaffordable purchase is refused and changes nothing", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1;

    const ok = engine.purchaseUpgrade(state, "blight_resilience");
    assert(!ok, "purchase must be refused");
    assertEqual(state.meta.fear, 1, "Fear untouched");
    assertEqual(engine.upgradeTier(state, "blight_resilience"), 0, "tier untouched");
  });

  test("shop: cost rises with each tier already owned", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 10000;

    const first = engine.upgradeCost(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "dahan_reinforcement");
    const second = engine.upgradeCost(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "dahan_reinforcement");
    const third = engine.upgradeCost(state, "dahan_reinforcement");

    assert(second > first, "second tier must cost more than the first");
    assert(third > second, "third tier must cost more than the second");
  });

  test("shop: a purchased upgrade still applies many rounds later", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.endRound(state);
    state.meta.fear = 500;
    engine.purchaseUpgrade(state, "blight_resilience");
    engine.purchaseUpgrade(state, "blight_resilience");

    for (let i = 0; i < 4; i += 1) {
      engine.startNextRound(state);
      assertEqual(
        state.round.blightThreshold,
        engine.BLIGHT_THRESHOLD_BASE + 2,
        `threshold in round ${state.round.number}`
      );
      engine.endRound(state);
    }

    assertEqual(engine.upgradeTier(state, "blight_resilience"), 2, "tier never decays");
  });

  test("shop: starting the next round is available regardless of remaining Fear", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 0;

    const ok = engine.startNextRound(state);
    assert(ok, "an empty purse must not block the next round");
    assertEqual(state.round.status, "running", "round is live again");
  });

  test("shop: the next round cannot be started while one is running", () => {
    const { state } = newGame();
    const numberBefore = state.round.number;

    const ok = engine.startNextRound(state);
    assert(!ok, "must refuse mid-round");
    assertEqual(state.round.number, numberBefore, "round number unchanged");
  });

  test("shop: totalRoundsPlayed increments once per round ended", () => {
    const { state } = newGame();
    assertEqual(state.meta.totalRoundsPlayed, 0, "nothing played yet");

    engine.endRound(state);
    assertEqual(state.meta.totalRoundsPlayed, 1, "after one round");

    // A second endRound on an already-ended round must not double count.
    engine.endRound(state);
    assertEqual(state.meta.totalRoundsPlayed, 1, "no double counting");

    engine.startNextRound(state);
    engine.endRound(state);
    assertEqual(state.meta.totalRoundsPlayed, 2, "after two rounds");
  });

  test("shop: bestRoundReached tracks the high-water mark and never decreases", () => {
    const { state } = newGame();
    engine.endRound(state);
    assertEqual(state.meta.bestRoundReached, 1, "round 1");

    engine.startNextRound(state);
    engine.endRound(state);
    assertEqual(state.meta.bestRoundReached, 2, "round 2");

    // Rewinding the round counter by hand must not rewind the record.
    state.round.number = 1;
    engine.startRound(state);
    engine.endRound(state);
    assertEqual(state.meta.bestRoundReached, 2, "record holds");
  });

  test("shop: blight_resilience stops at its max tier", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    const max = engine.upgradeMaxTier("blight_resilience");
    for (let i = 0; i < max + 3; i += 1) engine.purchaseUpgrade(state, "blight_resilience");

    assertEqual(engine.upgradeTier(state, "blight_resilience"), max, "tier caps");
  });

  test("shop: a one-off upgrade is bought once and then refuses", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assertEqual(engine.upgradeMaxTier("auto_boon"), 1, "a one-off has a single tier");
    assert(engine.purchaseUpgrade(state, "auto_boon"), "the first buy lands");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 1, "owned");

    assert(!engine.purchaseUpgrade(state, "auto_boon"), "the second buy is refused");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 1, "still one");
  });

  test("shop: auto_innate is a 100 Fear one-off, priced above auto_boon", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assertEqual(engine.upgradeCost(state, "auto_innate"), 100, "base cost is 100 Fear");
    assert(
      engine.upgradeCost(state, "auto_innate") > engine.upgradeCost(state, "auto_boon"),
      "it automates more, so it costs more"
    );
    assertEqual(engine.upgradeMaxTier("auto_innate"), 1, "a one-off has a single tier");

    assert(engine.purchaseUpgrade(state, "auto_innate"), "the first buy lands");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "owned");

    assert(!engine.purchaseUpgrade(state, "auto_innate"), "the second buy is refused");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "still one");
  });

  test("shop: orderedUpgradeIds sinks anything sold out below what is still buyable", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    // dahan_reinforcement is maxed out, auto_boon is bought (also maxed, being a one-off).
    // blight_resilience and auto_innate are left untouched.
    const max = engine.upgradeMaxTier("dahan_reinforcement");
    for (let i = 0; i < max; i += 1) engine.purchaseUpgrade(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "auto_boon");

    assertDeepEqual(
      engine.orderedUpgradeIds(state),
      ["blight_resilience", "auto_innate", "dahan_reinforcement", "auto_boon"],
      "the two sold-out upgrades sink to the bottom, catalogue order preserved on both sides"
    );
  });

  test("shop: an ability defeat during a round feeds the same purse the shop spends", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    clearBoard(state);
    state.meta.fear = 0;
    setLand(state, "3", { cities: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    engine.triggerAbility(state, "flash_floods");
    state.abilities.flash_floods.cooldownRemaining = 0;
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].cities, 0, "the city fell to two hits");
    assertEqual(state.meta.fear, 3 * engine.FEAR_PER_POWER, "a city is worth 3");

    engine.endRound(state);
    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    state.meta.fear = cost;
    assert(engine.purchaseUpgrade(state, "dahan_reinforcement"), "that Fear is spendable");
  });
})();
