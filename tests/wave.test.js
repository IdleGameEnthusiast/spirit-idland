/* Wave timing checks - docs/spec/08-acceptance-tests.md#wave-timing-checks
 *
 * A wave is reinforcement only now: Build, then Discover, then the track shifts. It deals no
 * damage at all - that lives in the continuous fight, in combat.test.js. */

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

  test("wave: the track is two slots, and explore shifts into build", () => {
    const ctx = newGame();
    const { state } = ctx;
    assert(!("ravage" in state.invader), "the Ravage slot is gone");

    const before = { ...state.invader };
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);

    assertEqual(state.invader.build.join(","), before.explore.join(","), "old explore becomes build");
    assertEqual(state.invader.explore.length, 1, "one explore terrain is drawn this low on the ladder");
    assert(engine.INVADER_TERRAINS.includes(state.invader.explore[0]), "a new explore terrain is drawn");
  });

  test("wave: a drawn explore terrain never duplicates build", () => {
    const ctx = newGame();
    for (let i = 0; i < 8; i += 1) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
      if (ctx.state.round.status !== "running") break;
      for (const terrain of ctx.state.invader.explore) {
        assert(!ctx.state.invader.build.includes(terrain), "explore must differ from build");
      }
    }
  });

  test("wave: a wave deals no damage of its own", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 2);
    state.invader = { build: "mountains", explore: "mountains" };

    engine.resolveWave(state);

    assertEqual(state.dahan["5"], 2, "no Dahan lost to the wave itself");
    assertEqual(state.round.blight, 0, "no Blight from the wave itself");
  });

  test("wave: one wave runs Build then Discover, each on its own terrain", () => {
    const { state } = newGame();
    clearBoard(state);

    state.invader = { build: "jungle", explore: "desert" };
    setLand(state, "5", { towns: 1 }, 0);

    engine.resolveWave(state);

    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 2, "Build added to the jungle");
    assertEqual(state.invaders["2"].explorers, 1, "Discover seeded the coastal desert");
  });

  test("wave: surviving a wave pays Fear into the round tally, and not into the purse", () => {
    const { state } = newGame();
    clearBoard(state);
    state.meta.fear = 0;
    state.round.fearEarned = 0;
    state.invader = { build: "jungle", explore: "desert" };

    engine.resolveWave(state);
    assertEqual(state.round.fearEarned, engine.FEAR_PER_WAVE, "one wave, one payment");
    assertEqual(state.meta.fear, 0, "nothing is spendable until the round ends");

    engine.resolveWave(state);
    assertEqual(state.round.fearEarned, 2 * engine.FEAR_PER_WAVE, "two waves, two payments");
    assertEqual(state.meta.fear, 0, "still nothing spendable");

    // The round boundary is the only place the two pools meet.
    engine.endRound(state);
    assertEqual(state.meta.fear, 2 * engine.FEAR_PER_WAVE, "banked in one payment at the end");
  });

  test("wave: Fear stays whole through a full round", () => {
    const ctx = newGame();
    for (let i = 0; i < 12 && ctx.state.round.status === "running"; i += 1) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    }
    assertEqual(ctx.state.meta.fear, Math.floor(ctx.state.meta.fear), "no fraction in the purse");
    assertEqual(ctx.state.round.fearEarned, Math.floor(ctx.state.round.fearEarned), "none in the tally");
    engine.endRound(ctx.state);
    assertEqual(ctx.state.meta.fear, Math.floor(ctx.state.meta.fear), "none after banking either");
  });

  /* ---------------------------------------------------------------- *
   * The wave 10 escalation                                             *
   * ---------------------------------------------------------------- */

  test("wave: before wave 10, Discover still refuses an unreachable land", () => {
    const { state } = newGame();
    clearBoard(state);
    // Mountains is lands 4 and 6, neither coastal, with no town or city beside them.
    state.round.wavesResolved = engine.EXPLORE_UNRESTRICTED_FROM_WAVE - 2;
    state.invader = { build: "jungle", explore: "mountains" };

    engine.resolveWave(state);
    assertEqual(state.invaders["4"].explorers, 0, "land 4 stays empty");
    assertEqual(state.invaders["6"].explorers, 0, "land 6 stays empty");
  });

  test("wave: from wave 10, Discover seeds both lands regardless of reach", () => {
    const { state } = newGame();
    clearBoard(state);
    // One short, so the wave this call resolves is the tenth.
    state.round.wavesResolved = engine.EXPLORE_UNRESTRICTED_FROM_WAVE - 1;
    state.invader = { build: "jungle", explore: "mountains" };

    engine.resolveWave(state);
    assertEqual(state.round.wavesResolved, engine.EXPLORE_UNRESTRICTED_FROM_WAVE, "the tenth wave");
    assertEqual(state.invaders["4"].explorers, 1, "landlocked mountains seeded anyway");
    assertEqual(state.invaders["6"].explorers, 1, "and the other one too");
  });

  test("wave: the escalation is per round, so a new round starts gated again", () => {
    const { state } = newGame();
    state.round.wavesResolved = engine.EXPLORE_UNRESTRICTED_FROM_WAVE + 5;
    assert(engine.landAcceptsExplorer(state, "4"), "unrestricted late in the round");

    engine.endRound(state);
    engine.startNextRound(state);
    clearBoard(state);

    assertEqual(state.round.wavesResolved, 0, "the counter resets with the round");
    assert(!engine.landAcceptsExplorer(state, "4"), "gated again from wave one");
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

  /* ---------------------------------------------------------------- *
   * Build and Discover, unchanged by the redesign                      *
   * ---------------------------------------------------------------- */

  test("build: towns outnumbering cities builds a city, otherwise a town", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 2, cities: 1 }, 0);
    setLand(state, "5", { towns: 1, cities: 1 }, 0);
    state.invader = { build: "jungle", explore: null };

    engine.resolveBuildPhase(state);
    assertEqual(state.invaders["3"].cities, 2, "towns outnumber cities: a city is built");
    assertEqual(state.invaders["5"].towns, 2, "otherwise a town is built");
  });

  test("build: an empty land builds nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: "jungle", explore: null };

    engine.resolveBuildPhase(state);
    assertEqual(engine.invaderCountInLand(state.invaders["3"]), 0, "land 3 stays empty");
    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 0, "land 5 stays empty");
  });

  test("build: the chip names what the next wave would put here", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 2, cities: 1 }, 0);
    setLand(state, "5", { towns: 1, cities: 1 }, 0);

    assertEqual(engine.buildOutcomeInLand(state, "3"), "cities", "a city is next here");
    assertEqual(engine.buildOutcomeInLand(state, "5"), "towns", "a town is next here");
    assertEqual(engine.buildOutcomeInLand(state, "1"), null, "nothing to build on in an empty land");
  });

  test("discover: seeds the coastal land and skips the unreachable inland one", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: null, explore: "jungle" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["3"].explorers, 1, "coastal jungle takes an explorer");
    assertEqual(state.invaders["5"].explorers, 0, "inland jungle has no way in yet");
  });

  test("discover: a town next to the inland land opens it up", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "1", { towns: 1 }, 0);
    state.invader = { build: null, explore: "jungle" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["5"].explorers, 1, "land 5 is adjacent to the town in land 1");
  });

  test("discover: mountains stays shut until invaders are inland", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: null, explore: "mountains" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["4"].explorers, 0, "land 4 shut");
    assertEqual(state.invaders["6"].explorers, 0, "land 6 shut");

    // Land 6 borders coastal lands 2 and 3, so it is the first mountain land to open.
    setLand(state, "2", { towns: 1 }, 0);
    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["6"].explorers, 1, "land 6 opens first");
    assertEqual(state.invaders["4"].explorers, 0, "land 4 is still interior");
  });
})();
