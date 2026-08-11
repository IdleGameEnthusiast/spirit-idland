/* Playtest tools - docs/spec/08-acceptance-tests.md#playtest-checks
 *
 * A redeemed code widens the speed dial and adds two buttons that hand out currency. None of
 * it may reach a rule: what these assert is that the tools are exactly as reversible as they
 * look, and that a state which has never seen the code cannot be handed one of their effects. */

(function () {
  const { engine, test, assert, assertEqual, newGame, advance } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* --- Redeeming ------------------------------------------------------ */

  test("redeem: a fresh game has no playtest tools", () => {
    const { state } = newGame();
    assertEqual(state.ui.playtest, false, "the flag ships off");
    assertEqual(engine.playtestOn(state), false, "and reads off");
  });

  test("redeem: the code switches the tools on, whatever case it is typed in", () => {
    const { state } = newGame();
    assertEqual(engine.redeemCode(state, "  PlayTester "), "ok", "trimmed and lowercased");
    assert(engine.playtestOn(state), "the tools are on");
  });

  test("redeem: a second redemption says so instead of pretending to work", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");
    assertEqual(engine.redeemCode(state, "playtester"), "already", "already redeemed");
    assert(engine.playtestOn(state), "and the tools stay on");
  });

  test("redeem: an unknown code changes nothing", () => {
    const { state } = newGame();
    assertEqual(engine.redeemCode(state, "sekrit"), "unknown", "unknown code");
    assertEqual(engine.redeemCode(state, ""), "unknown", "and so is nothing at all");
    assertEqual(engine.playtestOn(state), false, "the tools stay off");
  });

  /* --- The extra speed ------------------------------------------------ */

  test("playtest: 8x is off the dial until the code is redeemed", () => {
    const { state } = newGame();
    assertEqual(engine.availableGameSpeeds(state).includes(8), false, "not offered");
    assertEqual(engine.setGameSpeed(state, 8), false, "and refused");
    assertEqual(engine.gameSpeed(state), engine.DEFAULT_GAME_SPEED, "the speed is untouched");
  });

  test("playtest: 8x joins the dial with the code, and runs the round eight times over", () => {
    const ctx = newGame();
    engine.redeemCode(ctx.state, "playtester");
    assertEqual(engine.setGameSpeed(ctx.state, 8), true, "8x is on the dial");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS / 8 - 0.5, 0.5);
    assertEqual(ctx.state.round.wavesResolved, 0, "no wave before an eighth of the interval");

    advance(ctx, 0.5, 0.5);
    assertEqual(ctx.state.round.wavesResolved, 1, "one wave at an eighth of the interval");
  });

  test("playtest: hiding the tools takes the extra speed with it", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");
    engine.setGameSpeed(state, 8);

    engine.setPlaytest(state, false);
    assertEqual(state.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "no one is left at a speed with no button");
    assertEqual(engine.setGameSpeed(state, 8), false, "and 8x is refused again");
  });

  test("playtest: hiding the tools leaves a chosen normal speed alone", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");
    engine.setGameSpeed(state, 2);
    engine.setPlaytest(state, false);
    assertEqual(state.ui.gameSpeed, 2, "2x is the player's own setting, not a playtest one");
  });

  /* --- The grants ----------------------------------------------------- */

  test("playtest: the grants refuse while the tools are off", () => {
    const { state } = newGame();
    assertEqual(engine.grantPlaytestEnergy(state), false, "no energy");
    assertEqual(engine.grantPlaytestFear(state), false, "no fear");
    assertEqual(state.resources.energy, 0, "the purse is untouched");
    assertEqual(state.meta.fear, 0, "and so is the bank");
  });

  test("playtest: the grants hand out one flat amount each, and stack", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");

    assertEqual(engine.grantPlaytestEnergy(state), true, "energy granted");
    assertEqual(state.resources.energy, engine.PLAYTEST_GRANT, "one grant of energy");
    engine.grantPlaytestEnergy(state);
    assertEqual(state.resources.energy, engine.PLAYTEST_GRANT * 2, "two grants");

    assertEqual(engine.grantPlaytestFear(state), true, "fear granted");
    assertEqual(state.meta.fear, engine.PLAYTEST_GRANT, "into the banked pool");
    assertEqual(state.round.fearEarned, 0, "not into what the round has earned");
  });

  /* --- Through a save ------------------------------------------------- */

  test("playtest: the code and its speed survive a save together", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");
    engine.setGameSpeed(state, 8);

    const loaded = engine.normalizeState(JSON.parse(JSON.stringify(state)));
    assertEqual(loaded.ui.playtest, true, "the code");
    assertEqual(loaded.ui.gameSpeed, 8, "and the speed it put on the dial");
  });

  test("playtest: a save at 8x without the code loads at the shipped speed", () => {
    const loaded = engine.normalizeState({ ui: { gameSpeed: 8 } });
    assertEqual(loaded.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "no button, no speed");
  });

  test("playtest: a migration reset carries the code, and the speed with it", () => {
    const migrated = engine.migrateSave({ schemaVersion: "2.0.0", ui: { playtest: true, gameSpeed: 8 } });
    assertEqual(migrated.reset, true, "the save itself is reset");
    assertEqual(migrated.state.ui.playtest, true, "but a redeemed code is not run state");
    assertEqual(migrated.state.ui.gameSpeed, 8, "and neither is the speed dial");
  });

  test("playtest: a migration reset without the code drops a playtest speed", () => {
    const migrated = engine.migrateSave({ schemaVersion: "2.0.0", ui: { gameSpeed: 8 } });
    assertEqual(migrated.state.ui.gameSpeed, engine.DEFAULT_GAME_SPEED, "fallback speed");
  });
})();
