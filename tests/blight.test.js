/* Blight checks - docs/spec/08-acceptance-tests.md#blight-checks */

(function () {
  const { engine, test, assert, assertEqual, newGame, advance, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  function ravageOnly(state, terrain) {
    state.invader = { ravage: terrain, build: null, explore: null };
    engine.resolveRavagePhase(state);
  }

  test("blight: a ravaged land with Dahan adds the base amount", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 2);
    setLand(state, "5", null, 0);

    ravageOnly(state, "jungle");
    assertEqual(state.round.blight, engine.BLIGHT_PER_RAVAGED_LAND, "defended land blight");
  });

  test("blight: an undefended ravaged land adds the bonus on top", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);

    ravageOnly(state, "jungle");
    assertEqual(
      state.round.blight,
      engine.BLIGHT_PER_RAVAGED_LAND + engine.BLIGHT_BONUS_UNDEFENDED_LAND,
      "undefended land blight"
    );
  });

  test("blight: a land with no invaders adds nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    ravageOnly(state, "jungle");
    assertEqual(state.round.blight, 0, "empty terrain blight");
  });

  test("blight: Dahan that die during the Ravage still count as a defence", () => {
    const { state } = newGame();
    clearBoard(state);
    // One city deals 3, which kills the single Dahan. The land was defended going in, so it
    // takes the base amount only - the bonus is about walking into an empty land.
    setLand(state, "3", { cities: 1 }, 1);

    ravageOnly(state, "jungle");
    assertEqual(state.dahan["3"], 0, "the Dahan died");
    assertEqual(state.round.blight, engine.BLIGHT_PER_RAVAGED_LAND, "still only base blight");
  });

  test("blight: both lands of a terrain contribute", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 1);
    setLand(state, "5", { explorers: 1 }, 0);

    ravageOnly(state, "jungle");
    assertEqual(state.round.blight, 1 + 2, "defended land plus undefended land");
  });

  test("blight: the per-land tally sums to the round total", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 1);
    setLand(state, "5", { towns: 1 }, 0);

    ravageOnly(state, "jungle");
    const summed = engine.LAND_IDS.reduce((total, id) => total + state.round.blightByLand[id], 0);
    assertEqual(summed, state.round.blight, "per-land tally must reconcile");
    assertEqual(state.round.blightByLand["5"], 2, "land 5 took the undefended bonus");
  });

  test("blight: it never decreases during a round", () => {
    const ctx = newGame();
    let highWater = 0;
    for (let i = 0; i < 40 && ctx.state.round.status === "running"; i += 1) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
      assert(ctx.state.round.blight >= highWater, "blight went down");
      highWater = ctx.state.round.blight;
    }
    assert(highWater > 0, "the test never actually generated blight");
  });

  test("blight: reaching the threshold ends the round, and it clamps there", () => {
    const { state } = newGame();
    clearBoard(state);
    state.round.blight = state.round.blightThreshold - 1;
    setLand(state, "3", { explorers: 1 }, 0);

    state.invader = { ravage: "jungle", build: null, explore: null };
    engine.resolveWave(state);

    assertEqual(state.round.status, "ended", "round must end");
    assertEqual(state.round.blight, state.round.blightThreshold, "blight clamps to the threshold");
  });

  test("blight: no wave resolves after the threshold is reached", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.round.blight = state.round.blightThreshold - 2;
    setLand(state, "3", { explorers: 1 }, 0);
    state.invader = { ravage: "jungle", build: null, explore: null };

    engine.resolveWave(state);
    const wavesAtEnd = state.round.wavesResolved;
    assertEqual(state.round.status, "ended", "round ended");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 5);
    assertEqual(state.round.wavesResolved, wavesAtEnd, "no further waves");
  });

  test("blight: a round always ends by itself, with no player input at all", () => {
    const ctx = newGame();
    let waves = 0;
    while (ctx.state.round.status === "running" && waves < 60) {
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
      waves += 1;
    }
    assertEqual(ctx.state.round.status, "ended", `round still running after ${waves} waves`);
  });
})();
