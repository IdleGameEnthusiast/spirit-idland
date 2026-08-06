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

  test("setup: every dahan_reinforcement tier is placed, however many are bought", () => {
    const { state } = newGame();
    for (const tiers of [5, 40]) {
      state.upgrades.purchased.dahan_reinforcement = tiers;
      engine.startRound(state);

      const total = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
      assertEqual(total, engine.DAHAN_PER_ROUND_START_BASE + tiers, `total at ${tiers} tiers`);
    }
  });

  test("setup: no two lands finish more than DAHAN_MAX_SPREAD apart", () => {
    const { state } = newGame();

    // Walk the tiers one at a time: the invariant has to hold at every depth, not only at
    // the round numbers where the spread happens to come out even.
    for (let tiers = 0; tiers <= 24; tiers += 1) {
      state.upgrades.purchased.dahan_reinforcement = tiers;
      engine.startRound(state);

      const counts = engine.LAND_IDS.map((id) => state.dahan[id]);
      const spread = Math.max(...counts) - Math.min(...counts);
      assert(
        spread <= engine.DAHAN_MAX_SPREAD,
        `at ${tiers} tiers the spread is ${spread}, cap is ${engine.DAHAN_MAX_SPREAD} (${counts.join(",")})`
      );

      // The stated reading of the rule: nothing stands at 3 while a land is still empty.
      if (Math.max(...counts) >= 3) assert(Math.min(...counts) >= 1, `a land reached 3 with an empty land left (${counts.join(",")})`);
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

    // Everything the last round built is gone. What survives setup is the opening Discover's
    // explorers, which is the only thing that may stand on the board at second zero.
    for (const landId of engine.LAND_IDS) {
      const slot = state.invaders[landId];
      assertEqual(slot.towns, 0, `land ${landId} towns`);
      assertEqual(slot.cities, 0, `land ${landId} cities`);
      assert(slot.explorers <= 1, `land ${landId} holds ${slot.explorers} explorers`);
      for (const type of engine.INVADER_TYPES) {
        assertEqual(state.invaderDamage[landId][type], 0, `land ${landId} ${type} carried damage`);
      }
    }
    assertEqual(state.round.wavesResolved, 0, "wave counter");
    assert(engine.INVADER_TERRAINS.includes(state.invader.build), "build slot holds what was just discovered");
    assert(engine.INVADER_TERRAINS.includes(state.invader.explore), "explore slot is drawn");
    assert(state.invader.explore !== state.invader.build, "the two slots differ");
  });

  test("setup: an opening Discover puts the invaders ashore before wave 1", () => {
    const { state } = newGame();

    // The track shift at the end of setup moves what was just discovered into Build, so the
    // Build slot names the terrain the explorers landed in.
    const landed = engine.LAND_IDS.filter((id) => state.invaders[id].explorers > 0);
    assert(landed.length > 0, "the island must not start empty");

    for (const landId of landed) {
      assertEqual(engine.landTerrain(landId), state.invader.build, `land ${landId} matches the discovered terrain`);
      assertEqual(state.invaders[landId].explorers, 1, `land ${landId} took exactly one explorer`);
    }

    // Every coastal land of that terrain took one: on an empty board, coastal is the whole
    // of "reachable".
    for (const landId of engine.LAND_IDS) {
      if (engine.landTerrain(landId) !== state.invader.build) continue;
      const expected = engine.landIsCoastal(landId) ? 1 : 0;
      assertEqual(state.invaders[landId].explorers, expected, `land ${landId} explorers`);
    }
  });

  test("setup: the opening Discover is not a wave and does not touch the clock", () => {
    const { state } = newGame();
    assertEqual(state.round.wavesResolved, 0, "no wave has resolved");
    assertEqual(state.round.waveTimerRemaining, engine.WAVE_INTERVAL_SECONDS, "the wave timer is untouched");
    assertEqual(state.round.elapsedSeconds, 0, "no round time spent");
    assertEqual(state.round.blight, 0, "no Blight from coming ashore");
  });

  test("setup: the opening Discover never draws a terrain it cannot reach", () => {
    const ctx = newGame();
    const { state } = ctx;

    // Mountains has no coastal land, so on an empty board it can seed nothing. Run enough
    // rounds that a uniform draw would almost certainly have hit it.
    for (let i = 0; i < 40; i += 1) {
      engine.startRound(state);
      assert(state.invader.build !== "mountains", "mountains cannot be the opening Discover");
      const landed = engine.LAND_IDS.filter((id) => state.invaders[id].explorers > 0);
      assert(landed.length > 0, `round ${i}: the opening Discover seeded nothing`);
    }
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
