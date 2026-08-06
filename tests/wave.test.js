/* Wave timing checks - docs/spec/08-acceptance-tests.md#wave-timing-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("wave: nothing resolves before the interval elapses", () => {
    const ctx = newGame();
    advance(ctx, engine.WAVE_INTERVAL_SECONDS - 1);
    assertEqual(ctx.state.round.wavesResolved, 0, "waves before the interval");
  });

  test("wave: one wave resolves at the interval, with no player input", () => {
    const ctx = newGame();
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assertEqual(ctx.state.round.wavesResolved, 1, "waves at the interval");
  });

  test("wave: the timer resets, so waves keep coming on schedule", () => {
    const ctx = newGame();
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 4);
    assertEqual(ctx.state.round.wavesResolved, 4, "four intervals, four waves");
    assertClose(ctx.state.round.waveTimerRemaining, engine.WAVE_INTERVAL_SECONDS, 0.01, "timer reset");
  });

  test("wave: wavesResolved increments exactly once per wave", () => {
    const ctx = newGame();
    for (let i = 1; i <= 5; i += 1) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
      if (ctx.state.round.status !== "running") break;
      assertEqual(ctx.state.round.wavesResolved, i, `wave ${i}`);
    }
  });

  test("wave: the track shifts build->ravage and explore->build", () => {
    const ctx = newGame();
    const { state } = ctx;
    const before = { ...state.invader };

    advance(ctx, engine.WAVE_INTERVAL_SECONDS);

    assertEqual(state.invader.ravage, before.build, "old build becomes ravage");
    assertEqual(state.invader.build, before.explore, "old explore becomes build");
    assert(engine.INVADER_TERRAINS.includes(state.invader.explore), "a new explore terrain is drawn");
  });

  test("wave: a drawn explore terrain never duplicates ravage or build", () => {
    const ctx = newGame();
    for (let i = 0; i < 8; i += 1) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
      if (ctx.state.round.status !== "running") break;
      const { ravage, build, explore } = ctx.state.invader;
      assert(explore !== build, "explore must differ from build");
      if (ravage) assert(explore !== ravage, "explore must differ from ravage");
    }
  });

  test("wave: the phases run ravage, then build, then discover", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);

    // Jungle sits in both the ravage and the build slot. Land 5 holds one town and two
    // Dahan: ravaging first deals 2 damage and kills one Dahan, while building first would
    // deal 4 and kill both. The surviving Dahan is the whole assertion.
    state.invader = { ravage: "jungle", build: "jungle", explore: "mountains" };
    setLand(state, "5", { towns: 1 }, 2);

    engine.resolveWave(state);

    assertEqual(state.dahan["5"], 1, "Ravage resolved before Build");
  });

  test("wave: one wave runs all three phases, each on its own terrain", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);

    state.invader = { ravage: "wetlands", build: "jungle", explore: "desert" };
    setLand(state, "1", { explorers: 1 }, 0);
    setLand(state, "5", { towns: 1 }, 0);

    engine.resolveWave(state);

    assert(state.round.blight > 0, "Ravage hit the wetlands");
    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 2, "Build added to the jungle");
    assertEqual(state.invaders["2"].explorers, 1, "Discover seeded the coastal desert");
  });

  test("wave: time does not pass once the round has ended", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.endRound(state);

    const wavesAtEnd = state.round.wavesResolved;
    const elapsedAtEnd = state.round.elapsedSeconds;
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);

    assertEqual(state.round.wavesResolved, wavesAtEnd, "no waves after the round ends");
    assertEqual(state.round.elapsedSeconds, elapsedAtEnd, "no round time after the round ends");
  });

  test("wave: a single oversized tick is capped rather than fast-forwarding the round", () => {
    const ctx = newGame();
    ctx.clock.advance(600);
    engine.tick(ctx.state, 600);

    // MAX_TICK_SECONDS is below one wave interval, so a machine waking from sleep resolves
    // no waves at all rather than a burst of them.
    assertEqual(ctx.state.round.wavesResolved, 0, "waves credited from a 10-minute gap");
    assertClose(ctx.state.round.elapsedSeconds, engine.MAX_TICK_SECONDS, 0.01, "round time credited");
  });
})();
