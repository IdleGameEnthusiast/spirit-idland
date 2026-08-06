/* Blight checks - docs/spec/08-acceptance-tests.md#blight-checks
 *
 * Blight is still the round's only clock and still only goes up. What changed is how it
 * arrives: continuously, from wherever invaders are standing, rather than in whole points
 * from a terrain the track named. */

(function () {
  const { engine, test, assert, assertEqual, newGame, advance, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("blight: the per-land tally sums to the round total", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);
    setLand(state, "5", { towns: 1 }, 0);

    // Stopped at three rather than four: the city land takes its third Blight at the same
    // moment the town land takes its second, and a run halted on that tie is asking a float
    // race which land is ahead. Three lands the city 2, the town 1, and no tie decides it.
    for (let i = 0; i < 4000 * engine.TIME_SCALE && state.round.blight < 3; i += 1) {
      engine.resolveContinuousCombat(state, 0.05);
    }

    const summed = engine.LAND_IDS.reduce((total, id) => total + state.round.blightByLand[id], 0);
    assertEqual(summed, state.round.blight, "per-land tally must reconcile");
    assert(state.round.blightByLand["3"] > state.round.blightByLand["5"], "the city land blights faster");
  });

  test("blight: it never decreases during a round", () => {
    const ctx = newGame();
    let highWater = 0;
    for (let i = 0; i < 400 && ctx.state.round.status === "running"; i += 1) {
      advance(ctx, 1);
      assert(ctx.state.round.blight >= highWater, "blight went down");
      highWater = ctx.state.round.blight;
    }
    assert(highWater > 0, "the test never actually generated blight");
  });

  test("blight: reaching the threshold ends the round, and it clamps there", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.round.blight = state.round.blightThreshold - 1;
    setLand(state, "3", { cities: 1 }, 0);

    for (let i = 0; i < 2000 && state.round.status === "running"; i += 1) {
      engine.resolveContinuousCombat(state, 0.05);
    }

    assertEqual(state.round.status, "ended", "round must end");
    assertEqual(state.round.blight, state.round.blightThreshold, "blight clamps to the threshold");
  });

  test("blight: nothing resolves after the threshold is reached", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.round.blight = state.round.blightThreshold - 1;
    setLand(state, "3", { cities: 1 }, 0);

    for (let i = 0; i < 2000 && state.round.status === "running"; i += 1) {
      engine.resolveContinuousCombat(state, 0.05);
    }
    assertEqual(state.round.status, "ended", "round ended");

    const wavesAtEnd = state.round.wavesResolved;
    const blightAtEnd = state.round.blight;
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 5);
    assertEqual(state.round.wavesResolved, wavesAtEnd, "no further waves");
    assertEqual(state.round.blight, blightAtEnd, "no further blight");
  });

  test("blight: a round always ends by itself, with no player input at all", () => {
    const ctx = newGame();
    let seconds = 0;
    while (ctx.state.round.status === "running" && seconds < 600) {
      advance(ctx, 1);
      seconds += 1;
    }
    assertEqual(ctx.state.round.status, "ended", `round still running after ${seconds}s`);
  });

  test("blight: the round is lost on a clock a player can read off the board", () => {
    const ctx = newGame();
    let seconds = 0;
    while (ctx.state.round.status === "running" && seconds < 600) {
      advance(ctx, 1);
      seconds += 1;
    }
    // Not a balance assertion, a sanity one: a round that ends in 10 seconds or runs for ten
    // minutes means a rate constant moved without anyone noticing.
    assert(seconds > 30, `round ended after only ${seconds}s`);
    assert(seconds < 600, `round ran for ${seconds}s`);
  });
})();
