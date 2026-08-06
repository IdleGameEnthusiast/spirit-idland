/* Fear and shop checks - docs/spec/08-acceptance-tests.md#fear-and-shop-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, runUntilRoundEnds, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("shop: Fear earned mid-round is still there when the round ends", () => {
    const ctx = newGame();
    const { state } = ctx;

    // Earned by hand, because at the current placeholder numbers an unattended round earns
    // none: one Dahan per land dies to the 3 damage a land holds by the time it is ravaged,
    // so the counterattack never fires. See the balance note in docs/tasks.
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

  test("shop: swift_currents stops at its max tier", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    const max = engine.upgradeMaxTier("swift_currents");
    for (let i = 0; i < max + 3; i += 1) engine.purchaseUpgrade(state, "swift_currents");

    assertEqual(engine.upgradeTier(state, "swift_currents"), max, "tier caps");
  });

  test("shop: an ability defeat during a round feeds the same purse the shop spends", () => {
    const { state } = newGame();
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
    assertClose(state.meta.fear, 3 * engine.FEAR_PER_POWER, 0.0001, "a city is worth 1.05");

    engine.endRound(state);
    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    state.meta.fear = cost;
    assert(engine.purchaseUpgrade(state, "dahan_reinforcement"), "that Fear is spendable");
  });
})();
