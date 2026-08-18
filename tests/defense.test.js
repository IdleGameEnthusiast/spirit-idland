/* Defense checks - docs/spec/10-power-cards.md#defense
 *
 * A ward is the first thing in the game that stops invader damage rather than answering it,
 * so it is tested as a rule about the fight rather than as a thing a card does. Only the two
 * casts at the bottom go through a card at all.
 *
 * Five properties, each deliberate and each asserted here: total denial measured against
 * Defense alone, denial beating BLIGHT_FLOOR_FRACTION, a plain reduction below the threshold,
 * expiry one wave after first use rather than at a wave boundary, and any use spending the
 * whole pool. */

(function () {
  const {
    engine,
    test,
    assert,
    assertEqual,
    assertClose,
    newGame,
    advance,
    clearBoard,
    setLand,
    handCards
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* ------------------------------------------------------------------ *
   * What a ward does to the fight                                       *
   * ------------------------------------------------------------------ */

  test("defense: at or above a land's gross, nothing gets through at all", () => {
    const { state } = newGame();
    clearBoard(state);
    // One Explorer, one Town and one City: 1 + 2 + 3 = 6 gross.
    setLand(state, "5", { explorers: 1, towns: 1, cities: 1 }, 0);
    assertEqual(engine.landPressure(state, "5").gross, 6, "the saturated-land example, 6 gross");

    engine.addDefense(state, "5", 6);
    const p = engine.landPressure(state, "5");

    assert(p.denied, "Defend 6 covers a 6-attack land");
    assertEqual(p.effective, 0);
    assertEqual(p.blightPerSecond, 0, "no Blight");
    assertEqual(p.dahanPerSecond, 0, "and no Dahan lost");
  });

  test("defense: denial is measured against Defense alone, not Defense plus the Dahan", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { cities: 2 }, 3);
    // 6 gross against 3 Dahan cancelling 3. One point of Defense must not flip this land from
    // seeping to immune - or the number printed on the card would stop meaning anything.
    engine.addDefense(state, "5", 1);

    const p = engine.landPressure(state, "5");
    assert(!p.denied, "1 Defense against 6 gross denies nothing");
    assert(p.blightPerSecond > 0, "the land still seeps");
    assertEqual(p.effective, 5, "it is simply a 5-attack land now");
  });

  test("defense: denial beats the Blight floor, which no stack of Dahan can", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 20);

    // Twenty Dahan cancel far more than the 2 gross, and the land still seeps a quarter of it.
    const held = engine.landPressure(state, "5");
    assert(held.held, "the Dahan are cancelling everything they can");
    assertClose(
      held.net,
      2 * engine.BLIGHT_FLOOR_FRACTION,
      0.0001,
      "and a quarter of gross still gets through"
    );

    engine.addDefense(state, "5", 2);
    const warded = engine.landPressure(state, "5");
    assertEqual(warded.net, 0, "a ward stops the seep outright");
    assertEqual(warded.blightPerSecond, 0);
  });

  test("defense: below the threshold it is a plain reduction, in every formula", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { cities: 2 }, 1);

    const bare = engine.landPressure(state, "5");
    engine.addDefense(state, "5", 2);
    const warded = engine.landPressure(state, "5");

    assertEqual(bare.gross, 6);
    assertEqual(warded.gross, 6, "gross is what the invaders deal and does not move");
    assertEqual(warded.effective, 4, "what lands is 4");

    // Blight reads max(effective - dahanDefence, effective * floor): max(4 - 2, 1) = 2.
    assertEqual(warded.net, 2, "the Blight formula reads the reduced attack");
    // And so does the Dahan loss: 4 rather than 6 concentrated on them.
    assertClose(
      warded.dahanPerSecond,
      4 * engine.DAHAN_LOSS_PER_DAMAGE_SECOND,
      0.0001,
      "so Defense protects Dahan, which their own defence does not"
    );
    assert(warded.dahanPerSecond < bare.dahanPerSecond, "measurably fewer than without the ward");
  });

  test("defense: stacking is additive and uncapped", () => {
    const { state } = newGame();
    engine.addDefense(state, "4", 2);
    engine.addDefense(state, "4", 2);
    engine.addDefense(state, "4", 6);
    assertEqual(engine.defenseInLand(state, "4"), 10, "three casts, one pool");
  });

  /* ------------------------------------------------------------------ *
   * When it lapses                                                      *
   * ------------------------------------------------------------------ */

  test("defense: a quiet land holds its ward indefinitely", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    engine.addDefense(ctx.state, "7", 6);

    // Three whole wave intervals with nothing standing in the land.
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);

    assertEqual(engine.defenseInLand(ctx.state, "7"), 6, "unused, so unspent");
    assertEqual(ctx.state.round.defenseExpiry["7"], null, "and its clock has not started");
  });

  test("defense: the clock starts on the first tick it did anything, not on the cast", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    engine.addDefense(ctx.state, "5", 6);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(ctx.state.round.defenseExpiry["5"], null, "two waves of quiet cost it nothing");

    setLand(ctx.state, "5", { towns: 1 }, 0);
    // Called straight rather than through tick(), so `elapsedSeconds` is exactly the reading
    // the ward stamps itself against - which is the whole point of storing a deadline off that
    // clock rather than a countdown of its own.
    const startedAt = ctx.state.round.elapsedSeconds;
    engine.resolveContinuousCombat(ctx.state, 0.1);

    assertClose(
      ctx.state.round.defenseExpiry["5"],
      startedAt + engine.WAVE_INTERVAL_SECONDS,
      0.0001,
      "one full wave interval from the tick the attack arrived"
    );
  });

  test("defense: it lapses exactly one wave interval after that, and not before", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    setLand(ctx.state, "5", { towns: 1 }, 0);
    engine.addDefense(ctx.state, "5", 6);

    // First contact starts the clock.
    advance(ctx, 1);
    assert(ctx.state.round.defenseExpiry["5"] !== null, "the clock is running");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS - 2);
    assertEqual(engine.defenseInLand(ctx.state, "5"), 6, "still standing just short of the interval");
    assertEqual(engine.landPressure(ctx.state, "5").blightPerSecond, 0, "and still denying");

    advance(ctx, 3);
    assertEqual(engine.defenseInLand(ctx.state, "5"), 0, "and gone just past it");
    assertEqual(ctx.state.round.defenseExpiry["5"], null, "with its deadline cleared");
    assert(engine.landPressure(ctx.state, "5").blightPerSecond > 0, "so the land seeps again");
  });

  test("defense: any use spends the whole pool - Defend 6 that cancelled 2 is gone with the 4", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    setLand(ctx.state, "5", { towns: 1 }, 0);
    engine.addDefense(ctx.state, "5", 6);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS + 1);

    assertEqual(engine.defenseInLand(ctx.state, "5"), 0, "the unused 4 went with the used 2");
  });

  test("defense: the expiry rides elapsedSeconds, so the speed dial needs no special case", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    setLand(ctx.state, "5", { towns: 1 }, 0);
    engine.addDefense(ctx.state, "5", 6);
    advance(ctx, 1);

    const deadline = ctx.state.round.defenseExpiry["5"];
    engine.setGameSpeed(ctx.state, 2);
    advance(ctx, 1);

    assertEqual(ctx.state.round.defenseExpiry["5"], deadline, "the deadline is a game-clock reading");
    // At double speed the same wall-clock second moves twice the game time, so the ward
    // lapses in half the real seconds - which is the point of storing the deadline.
    advance(ctx, engine.WAVE_INTERVAL_SECONDS / 2);
    assertEqual(engine.defenseInLand(ctx.state, "5"), 0, "and the ward is spent at it either way");
  });

  test("defense: a ward stays with the land when the fight is pushed away", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 0);
    engine.addDefense(state, "5", 6);

    engine.applyPushFrom(state, "5", 3);

    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 0, "the Town has moved on");
    assertEqual(engine.defenseInLand(state, "5"), 6, "and the ward is still on the land it was laid on");
  });

  test("defense: a ward dies with the round", () => {
    const { state } = newGame();
    engine.addDefense(state, "5", 6);
    engine.endRound(state);
    engine.startNextRound(state);

    for (const land of engine.LAND_IDS) {
      assertEqual(engine.defenseInLand(state, land), 0, `land ${land} starts clean`);
      assertEqual(state.round.defenseExpiry[land], null);
    }
  });

  test("defense: Dahan strikes and Builds are untouched by a ward", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 2);
    engine.addDefense(state, "5", 20);

    // A ward stops what the invaders deal, not what the Dahan deal.
    engine.resolveDahanAttack(state);
    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 0, "the Dahan still take the Town");

    // And it stops damage, never reinforcement.
    setLand(state, "5", { towns: 1 }, 0);
    state.invader.build = [engine.landTerrain("5")];
    engine.resolveBuildPhase(state);
    assert(engine.invaderCountInLand(state.invaders["5"]) > 1, "the Build lands regardless");
  });

  /* ------------------------------------------------------------------ *
   * Where the water pushes now                                          *
   * ------------------------------------------------------------------ */

  test("defense: a push prefers Dahan and Defense together, then Dahan, then Defense", () => {
    const { state } = newGame();
    clearBoard(state);

    // Land 5 is the six-neighbour hub, so this is the land with the most destinations to rank.
    const neighbours = engine.adjacentLands("5");
    const [a, b, c] = neighbours;

    setLand(state, "5", { towns: 1 }, 0);
    state.dahan[c] = 1;
    engine.addDefense(state, b, 4);
    assertEqual(engine.pushDestination(state, "5"), c, "Dahan alone beat a ward alone");

    engine.addDefense(state, c, 4);
    assertEqual(engine.pushDestination(state, "5"), c, "and both together beat either");

    state.dahan[c] = 0;
    state.round.defense[c] = 0;
    assertEqual(engine.pushDestination(state, "5"), b, "a warded land beats bare open ground");

    state.round.defense[b] = 0;
    assertEqual(
      engine.pushDestination(state, "5"),
      neighbours.slice().sort((x, y) => Number(x) - Number(y))[0],
      "and with neither, the lowest id as ever"
    );
    assert(a, "the board still has the neighbours this test assumed");
  });

  /* ------------------------------------------------------------------ *
   * What the player reads                                               *
   * ------------------------------------------------------------------ */

  test("defense: the chip and the detail say which of the three stories is true", () => {
    const { state } = newGame({ language: "en" });
    clearBoard(state);
    setLand(state, "5", { cities: 2 }, 0);

    const bare = engine.pressureDetailText(state, "5");
    assert(bare.indexOf("Defend") < 0, "with no ward the reading is unchanged");

    engine.addDefense(state, "5", 2);
    assert(engine.pressureDetailText(state, "5").indexOf("Defend 2") >= 0, "a partial ward is spelled out");
    assert(engine.pressureChipText(state, "5").indexOf("/ s") >= 0, "and the chip still counts a rate");

    engine.addDefense(state, "5", 10);
    assert(engine.pressureChipText(state, "5").indexOf("warded") >= 0, "total denial says so instead");
    assert(
      engine.pressureDetailText(state, "5").indexOf("nothing gets through") >= 0,
      "rather than quoting a rate of nothing"
    );
  });

  /* ------------------------------------------------------------------ *
   * The two cards that lay one                                          *
   * ------------------------------------------------------------------ */

  test("defense: natures_resilience wards one land, encompassing_ward wards all eight", () => {
    const { state } = newGame();
    handCards(state, ["natures_resilience", "encompassing_ward"]);

    engine.triggerAbility(state, "natures_resilience");
    engine.resolveAbilityTarget(state, "4");
    assertEqual(engine.defenseInLand(state, "4"), 6, "Defend 6 on the clicked land");
    assertEqual(engine.defenseInLand(state, "5"), 0, "and nowhere else");

    engine.triggerAbility(state, "encompassing_ward");
    assertEqual(engine.defenseInLand(state, "4"), 8, "which stacks with the ward already there");
    for (const land of engine.LAND_IDS) {
      assert(engine.defenseInLand(state, land) >= 2, `land ${land} carries at least Defend 2`);
    }
  });

  test("defense: eight casts on a quiet land bank the ward, and it still pays out once", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    for (let i = 0; i < 8; i += 1) engine.addDefense(ctx.state, "5", 2);
    assertEqual(engine.defenseInLand(ctx.state, "5"), 16, "Defend 16 banked");

    setLand(ctx.state, "5", { cities: 2 }, 0);
    advance(ctx, 1);
    assertEqual(engine.landPressure(ctx.state, "5").blightPerSecond, 0, "and it denies while it lasts");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assertEqual(engine.defenseInLand(ctx.state, "5"), 0, "then pays out exactly once");
  });
})();
