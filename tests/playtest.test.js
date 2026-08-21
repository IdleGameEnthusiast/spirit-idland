/* Playtest tools - docs/spec/08-acceptance-tests.md#playtest-checks
 *
 * A redeemed code widens the speed dial and adds two buttons that hand out currency. None of
 * it may reach a rule: what these assert is that the tools are exactly as reversible as they
 * look, and that a state which has never seen the code cannot be handed one of their effects. */

(function () {
  const { engine, test, assert, assertEqual, newGame, advance, runUntilRoundEnds } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

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

  /* --- The cycle's Fear ledger ----------------------------------------- */

  test("cycle: a fresh game has generated, granted and spent nothing", () => {
    const { state } = newGame();
    const totals = engine.cycleFearTotals(state);
    assertEqual(totals.generated, 0, "nothing generated");
    assertEqual(totals.granted, 0, "nothing granted");
    assertEqual(totals.spent, 0, "nothing spent");
  });

  test("cycle: what a round banks is what the ledger counts as generated", () => {
    const ctx = newGame();
    const { state } = ctx;

    runUntilRoundEnds(ctx);
    const first = Math.floor(state.round.fearEarned);
    assert(first > 0, "the round should have earned something");
    assertEqual(engine.cycleFearTotals(state).generated, first, "one round's worth");

    engine.startNextRound(state);
    runUntilRoundEnds(ctx);
    assertEqual(
      engine.cycleFearTotals(state).generated,
      first + Math.floor(state.round.fearEarned),
      "and the second round adds to it rather than replacing it"
    );
  });

  test("cycle: the ledger does not reset between rounds, and spending does not lower it", () => {
    const ctx = newGame();
    const { state } = ctx;
    runUntilRoundEnds(ctx);

    const generated = engine.cycleFearTotals(state).generated;
    state.meta.fear = 500;
    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    assert(engine.purchaseUpgrade(state, "dahan_reinforcement"), "bought");

    const totals = engine.cycleFearTotals(state);
    assertEqual(totals.spent, cost, "the shop's price is what was spent");
    assertEqual(totals.generated, generated, "and generated is a total, not a balance");
  });

  test("cycle: a refused purchase spends nothing", () => {
    const { state } = newGame();
    assertEqual(engine.purchaseUpgrade(state, "dahan_reinforcement"), false, "no Fear to buy with");
    assertEqual(engine.cycleFearTotals(state).spent, 0, "so nothing is on the ledger");
  });

  test("cycle: a playtest grant is counted apart from what the game generated", () => {
    const { state } = newGame();
    engine.redeemCode(state, "playtester");
    engine.grantPlaytestFear(state);

    const totals = engine.cycleFearTotals(state);
    assertEqual(totals.granted, engine.PLAYTEST_GRANT, "granted");
    assertEqual(totals.generated, 0, "and never counted as income");
    assertEqual(totals.banked, engine.PLAYTEST_GRANT, "but spendable all the same");
  });

  test("cycle: generated plus granted, less spent, is the bank", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.redeemCode(state, "playtester");

    runUntilRoundEnds(ctx);
    engine.grantPlaytestFear(state);
    engine.purchaseUpgrade(state, "dahan_reinforcement");

    const totals = engine.cycleFearTotals(state);
    assert(totals.spent > 0, "something was bought");
    assertEqual(totals.generated + totals.granted - totals.spent, totals.banked, "the ledger balances");
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

  test("cycle: the ledger round-trips a save", () => {
    const { state } = newGame();
    state.meta.cycleFearGenerated = 400;
    state.meta.cycleFearGranted = 100;
    state.meta.cycleFearSpent = 250;
    state.meta.fear = 250;

    const loaded = engine.normalizeState(JSON.parse(JSON.stringify(state)));
    const totals = engine.cycleFearTotals(loaded);
    assertEqual(totals.generated, 400, "generated");
    assertEqual(totals.granted, 100, "granted");
    assertEqual(totals.spent, 250, "spent");
  });

  test("cycle: a save from before the ledger reads its bank as generated", () => {
    const loaded = engine.normalizeState({ meta: { fear: 320 } });
    const totals = engine.cycleFearTotals(loaded);
    assertEqual(totals.generated, 320, "the bank was earned somehow");
    assertEqual(totals.granted, 0, "nothing granted");
    assertEqual(totals.spent, 0, "nothing bought, so there is nothing to rebuild");
  });

  /* The half of that seed the bank cannot see. Fear leaves the bank only in the shop, so a
   * save's owned tiers are a receipt: priced back off the catalogue they say what was earned
   * and spent before the ledger existed. Without this the ascension payout would read a
   * long-played save as a nearly empty one. */
  test("cycle: a save from before the ledger rebuilds what its upgrades cost", () => {
    const rising = engine.upgradeCostFromTier("rising_dread", 0, 4);
    const boon = engine.upgradeCostFromTier("auto_boon", 0, 1);

    const loaded = engine.normalizeState({
      meta: { fear: 320 },
      upgrades: { purchased: { rising_dread: 4, auto_boon: 1 } }
    });
    const totals = engine.cycleFearTotals(loaded);

    assertEqual(totals.spent, rising + boon, "every owned rung is priced back off the catalogue");
    assertEqual(totals.generated, 320 + rising + boon, "and generated is the bank plus that");
    assertEqual(
      totals.generated + totals.granted - totals.spent,
      loaded.meta.fear,
      "the ledger identity still holds after the rebuild"
    );
  });

  // The rebuild is a seed, not a recomputation: it fires on the absent key and writes it. A
  // player who ascends holds upgrades bought in the cycle before, and recomputing on every load
  // would hand those back as generated Fear the current cycle never earned.
  test("cycle: a save that carries the ledger is never rebuilt from its upgrades", () => {
    const loaded = engine.normalizeState({
      meta: { fear: 100, cycleFearGenerated: 0, cycleFearGranted: 0, cycleFearSpent: 0 },
      upgrades: { purchased: { rising_dread: 4, auto_boon: 1 } }
    });
    const totals = engine.cycleFearTotals(loaded);
    assertEqual(totals.generated, 0, "a present zero is a real zero");
    assertEqual(totals.spent, 0, "and so is this one");
  });

  // Tiers are capped before they are priced, so a doctored ladder cannot mint generated Fear.
  test("cycle: the rebuild prices the tiers that survived normalization, not the ones claimed", () => {
    const capped = engine.upgradeCostFromTier("rising_dread", 0, engine.upgradeMaxTier(newGame().state, "rising_dread"));
    const loaded = engine.normalizeState({
      meta: { fear: 0 },
      upgrades: { purchased: { rising_dread: 40, not_an_upgrade: 9 } }
    });
    const totals = engine.cycleFearTotals(loaded);
    assertEqual(totals.spent, capped, "clamped to the ladder's end, and an unknown id is worth nothing");
  });

  test("cycle: nonsense on the ledger loads as whole, non-negative numbers", () => {
    const loaded = engine.normalizeState({
      meta: { fear: 10, cycleFearGenerated: 12.7, cycleFearGranted: -5, cycleFearSpent: "x" }
    });
    const totals = engine.cycleFearTotals(loaded);
    assertEqual(totals.generated, 12, "floored, and present means present even when fractional");
    assertEqual(totals.granted, 0, "clamped");
    assertEqual(totals.spent, 0, "and unreadable means zero");
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
