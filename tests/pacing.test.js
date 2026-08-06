/* Pacing checks - docs/spec/08-acceptance-tests.md#pacing-checks
 *
 * Two player-facing controls over one thing: how fast the round reaches the player. Neither
 * is allowed to change what the round costs, which is what most of these assert - the speed
 * dial buys the same waves in less real time, and the wave gate buys time without a wave. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* --- The speed dial ------------------------------------------------ */

  test("speed: a fresh game runs at 1x, where a real second is a game second", () => {
    const { state } = newGame();
    assertEqual(state.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "default speed");
    assertEqual(engine.gameSpeed(state), 1, "one real second buys one game second");
  });

  test("speed: 2x runs the same wave in half the real seconds", () => {
    const ctx = newGame();
    engine.setGameSpeed(ctx.state, 2);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS / 2 - 1);
    assertEqual(ctx.state.round.wavesResolved, 0, "no wave before half the interval");

    advance(ctx, 1);
    assertEqual(ctx.state.round.wavesResolved, 1, "one wave at half the interval");
  });

  test("speed: 0x stops every clock the round has", () => {
    const ctx = newGame();
    clearBoard(ctx.state);
    setLand(ctx.state, "5", { cities: 1 }, 1);
    advance(ctx, 2);

    const before = {
      blight: ctx.state.round.blightProgress["5"],
      wave: ctx.state.round.waveTimerRemaining,
      dahan: ctx.state.round.dahanAttackRemaining,
      elapsed: ctx.state.round.elapsedSeconds
    };
    assert(before.blight > 0, "the fight was running before the pause");

    engine.setGameSpeed(ctx.state, 0);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);

    assertEqual(ctx.state.round.blightProgress["5"], before.blight, "no Blight accrues");
    assertEqual(ctx.state.round.waveTimerRemaining, before.wave, "the wave timer is frozen");
    assertEqual(ctx.state.round.dahanAttackRemaining, before.dahan, "the Dahan clock is frozen");
    assertEqual(ctx.state.round.elapsedSeconds, before.elapsed, "the round does not age");
    assertEqual(ctx.state.round.wavesResolved, 0, "and no wave resolves");
  });

  test("speed: a paused round runs again at the speed it is set back to", () => {
    const ctx = newGame();
    engine.setGameSpeed(ctx.state, 0);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    engine.setGameSpeed(ctx.state, 1);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assertEqual(ctx.state.round.wavesResolved, 1, "the wave the pause was holding");
  });

  test("speed: a speed outside the dial is refused, leaving the old one", () => {
    const { state } = newGame();
    assertEqual(engine.setGameSpeed(state, 5), false, "5x is not on the dial");
    assertEqual(engine.setGameSpeed(state, "fast"), false, "nor is a word");
    assertEqual(state.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "the speed is untouched");
  });

  test("speed: the fight costs the same damage-seconds at every speed", () => {
    // The one invariant the dial must not break: a land under one city takes exactly as long
    // to Blight in *game* seconds however fast those seconds are being handed out.
    const progressAfter = (speed) => {
      const ctx = newGame();
      engine.setGameSpeed(ctx.state, speed);
      clearBoard(ctx.state);
      setLand(ctx.state, "5", { cities: 1 }, 0);
      advance(ctx, 8 / speed);
      return ctx.state.round.blightProgress["5"];
    };

    assertClose(progressAfter(1), progressAfter(2), 0.001, "same Blight for the same game time");
  });

  /* --- The wave gate ------------------------------------------------- */

  test("gate: a fresh game holds before the first wave, clock and all", () => {
    const ctx = newGame({ manualWaves: true });
    assertEqual(ctx.state.ui.autoProceed, false, "auto-proceed ships off");
    assert(engine.waveGateHeld(ctx.state), "the gate holds at setup");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(ctx.state.round.wavesResolved, 0, "no wave arrives unasked");
    assertClose(ctx.state.round.waveTimerRemaining, engine.WAVE_INTERVAL_SECONDS, 0.001, "the timer never started");
    assertEqual(ctx.state.round.elapsedSeconds, 0, "and neither did the round");
  });

  test("gate: the opening click starts the clock without spending a wave", () => {
    const ctx = newGame({ manualWaves: true });
    assertEqual(engine.startNextWave(ctx.state), true, "the gate opens");
    assertEqual(ctx.state.round.wavesResolved, 0, "the first click is not a wave");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS - 1);
    assertEqual(ctx.state.round.wavesResolved, 0, "the interval is still running");
    assert(!engine.waveGateHeld(ctx.state), "and the gate is open while it does");
  });

  test("gate: time stops again when the bar empties", () => {
    const ctx = newGame({ manualWaves: true });
    engine.startNextWave(ctx.state);
    clearBoard(ctx.state);
    setLand(ctx.state, "5", { cities: 1 }, 0);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assert(engine.waveGateHeld(ctx.state), "the gate closes on the empty bar");
    assertEqual(ctx.state.round.wavesResolved, 0, "the wave is due, not resolved");
    assertEqual(ctx.state.round.waveTimerRemaining, 0, "the bar sits at zero");

    const blight = ctx.state.round.blightProgress["5"];
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);
    assertEqual(ctx.state.round.blightProgress["5"], blight, "the fight is frozen too");
  });

  test("gate: the click at an empty bar resolves the wave and refills it", () => {
    const ctx = newGame({ manualWaves: true });
    engine.startNextWave(ctx.state);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);

    assertEqual(engine.startNextWave(ctx.state), true, "the wave is called");
    assertEqual(ctx.state.round.wavesResolved, 1, "exactly one wave");
    assertClose(ctx.state.round.waveTimerRemaining, engine.WAVE_INTERVAL_SECONDS, 0.001, "a whole fresh interval");
    assert(!engine.waveGateHeld(ctx.state), "and the round is running again");
  });

  test("gate: nothing to call while the timer is still running", () => {
    const ctx = newGame({ manualWaves: true });
    engine.startNextWave(ctx.state);
    advance(ctx, 1);
    assertEqual(engine.startNextWave(ctx.state), false, "no second click mid-interval");
    assertEqual(ctx.state.round.wavesResolved, 0, "and no wave pulled forward");
  });

  test("gate: switching auto-proceed on releases a gate already holding", () => {
    const ctx = newGame({ manualWaves: true });
    engine.startNextWave(ctx.state);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assert(engine.waveGateHeld(ctx.state), "held before the switch");

    engine.setAutoProceed(ctx.state, true);
    assert(!engine.waveGateHeld(ctx.state), "released by the switch alone");

    advance(ctx, 1);
    assertEqual(ctx.state.round.wavesResolved, 1, "and the waiting wave resolves on the next tick");
  });

  test("gate: switching auto-proceed off stops the round at the next bar", () => {
    const ctx = newGame();
    engine.setAutoProceed(ctx.state, false);
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);

    assert(engine.waveGateHeld(ctx.state), "the first empty bar holds");
    assertEqual(ctx.state.round.wavesResolved, 0, "and holds instead of resolving");
  });

  test("gate: leaving the shop is the click, so the next round runs", () => {
    const ctx = newGame({ manualWaves: true });
    ctx.state.round.blight = ctx.state.round.blightThreshold;
    engine.endRound(ctx.state);
    assert(!engine.waveGateHeld(ctx.state), "an ended round holds no gate");

    engine.startNextRound(ctx.state);
    assert(!engine.waveGateHeld(ctx.state), "and neither does the round it starts");

    // The clock runs from that click, unlike a fresh game's - and then stops at the first
    // empty bar, because auto-proceed is still off. Only the opening gate was spent.
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assertClose(ctx.state.round.elapsedSeconds, engine.WAVE_INTERVAL_SECONDS, 0.001, "the round ran");
    assert(engine.waveGateHeld(ctx.state), "and stops at the bar like any other wave");
  });

  /* --- Both, through a save ------------------------------------------ */

  test("pacing: the two settings survive a save, the gate with them", () => {
    const ctx = newGame({ manualWaves: true });
    engine.setGameSpeed(ctx.state, 2);
    const loaded = engine.normalizeState(JSON.parse(JSON.stringify(ctx.state)));

    assertEqual(loaded.ui.gameSpeed, 2, "the speed");
    assertEqual(loaded.ui.autoProceed, false, "the toggle");
    assertEqual(loaded.round.awaitingWave, true, "and the gate it was standing at");
  });

  test("pacing: a save written with a nonsense speed loads at the shipped one", () => {
    const loaded = engine.normalizeState({ ui: { gameSpeed: 9 } });
    assertEqual(loaded.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "fallback speed");
  });

  test("pacing: an ended round never loads behind a gate", () => {
    const loaded = engine.normalizeState({ round: { status: "ended", awaitingWave: true } });
    assertEqual(loaded.round.awaitingWave, false, "the shop is not a gate");
  });
})();
