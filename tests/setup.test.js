/* Round setup checks - docs/spec/08-acceptance-tests.md#round-setup-checks */

(function () {
  const { engine, test, assert, assertEqual, newGame, advance } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("setup: a fresh round is running, unblighted, with every ability ready", () => {
    const { state } = newGame();
    assertEqual(state.round.status, "running", "status");
    assertEqual(state.round.blight, 0, "blight");
    assertEqual(state.round.elapsedSeconds, 0, "elapsed");
    assertEqual(state.round.wavesResolved, 0, "waves");
    for (const abilityId of Object.keys(state.abilities)) {
      assertEqual(state.abilities[abilityId].cooldownRemaining, 0, `${abilityId} cooldown`);
    }
  });

  test("setup: Dahan seed from the spirit's roundStartDahan", () => {
    const { state } = newGame();
    const spirit = engine.activeSpirit(state);
    for (const landId of engine.LAND_IDS) {
      assertEqual(state.dahan[landId], spirit.roundStartDahan[landId] || 0, `land ${landId} dahan`);
    }
    const total = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(total, engine.DAHAN_PER_ROUND_START_BASE, "baseline total");
  });

  test("setup: dahan_reinforcement tiers add on top, capped per land", () => {
    const { state } = newGame();
    state.upgrades.purchased.dahan_reinforcement = 5;
    engine.startRound(state);

    const spirit = engine.activeSpirit(state);
    const total = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(total, engine.DAHAN_PER_ROUND_START_BASE + 5, "total with upgrades");

    for (const landId of engine.LAND_IDS) {
      const added = state.dahan[landId] - (spirit.roundStartDahan[landId] || 0);
      assert(added <= engine.DAHAN_MAX_ADD_PER_LAND, `land ${landId} took ${added}, cap is ${engine.DAHAN_MAX_ADD_PER_LAND}`);
    }
  });

  test("setup: reinforcement fills the emptiest lands first", () => {
    const { state } = newGame();
    state.upgrades.purchased.dahan_reinforcement = 2;
    engine.startRound(state);

    // Lands 3 and 8 start empty, so they are where the first two reinforcements land.
    assertEqual(state.dahan["3"], 1, "land 3");
    assertEqual(state.dahan["8"], 1, "land 8");
  });

  test("setup: blight threshold reads the blight_resilience tier", () => {
    const { state } = newGame();
    assertEqual(state.round.blightThreshold, engine.BLIGHT_THRESHOLD_BASE, "base threshold");

    state.upgrades.purchased.blight_resilience = 3;
    engine.startRound(state);
    assertEqual(state.round.blightThreshold, engine.BLIGHT_THRESHOLD_BASE + 3, "upgraded threshold");
  });

  test("setup: swift_currents shortens cooldowns, with diminishing returns", () => {
    const { state } = newGame();
    const base = engine.abilityCooldownSeconds(state, "flash_floods");
    assertEqual(base, engine.ABILITIES.flash_floods.cooldownSeconds, "unupgraded cooldown");

    state.upgrades.purchased.swift_currents = 1;
    engine.startRound(state);
    const oneTier = engine.abilityCooldownSeconds(state, "flash_floods");
    assert(oneTier < base, "one tier must be faster");

    state.upgrades.purchased.swift_currents = 2;
    engine.startRound(state);
    const twoTiers = engine.abilityCooldownSeconds(state, "flash_floods");
    assert(twoTiers < oneTier, "two tiers must be faster still");
    assert((base - oneTier) > (oneTier - twoTiers), "the second tier must be worth less than the first");
  });

  test("setup: the board and the invader track reset between rounds", () => {
    const ctx = newGame();
    const { state } = ctx;
    advance(ctx, 40);

    state.invaders["5"].cities = 3;
    state.invaderDamage["5"].cities = 2;
    engine.startRound(state);

    for (const landId of engine.LAND_IDS) {
      assertEqual(engine.invaderCountInLand(state.invaders[landId]), 0, `land ${landId} invaders`);
      for (const type of engine.INVADER_TYPES) {
        assertEqual(state.invaderDamage[landId][type], 0, `land ${landId} ${type} carried damage`);
      }
    }
    assertEqual(state.round.wavesResolved, 0, "wave counter");
    assertEqual(state.invader.ravage, null, "ravage slot starts empty");
    assertEqual(state.invader.build, null, "build slot starts empty");
    assert(engine.INVADER_TERRAINS.includes(state.invader.explore), "explore slot is drawn");
  });

  test("setup: a second round with upgrades starts stronger than the first", () => {
    const ctx = newGame();
    const { state } = ctx;

    const firstDahan = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    const firstThreshold = state.round.blightThreshold;

    engine.endRound(state);
    state.meta.fear = 500;
    engine.purchaseUpgrade(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "blight_resilience");
    engine.startNextRound(state);

    const secondDahan = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(secondDahan, firstDahan + 1, "dahan after upgrade");
    assertEqual(state.round.blightThreshold, firstThreshold + 1, "threshold after upgrade");
    assertEqual(state.round.number, 2, "round number");
  });
})();
