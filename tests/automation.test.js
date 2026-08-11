/* The shop's automation half: the abilities that cast themselves, and the round that starts
 * itself - plus the rule that holds the whole of it together.
 *
 * That rule is one sentence: a round cannot spend or benefit from itself. Fear banks at the
 * round's end (see the two-pool note above FEAR_PER_POWER), and upgrades take effect at the
 * next round's start (see activeUpgradeTier). Both halves exist because Auto Start Round
 * removes the pause the shop used to live in, so neither can be enforced by the clock any
 * more. Most of what is checked below is that neither half leaks. */

(function () {
  const {
    engine, test, assert, assertEqual, newGame, advance,
    clearBoard, setLand, unlockAllAbilities, grantUpgrade
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  function fullKit(options) {
    const ctx = newGame(options);
    unlockAllAbilities(ctx.state);
    return ctx;
  }

  /* ---------------------------------------------------------------- *
   * Auto River's Bounty                                                *
   * ---------------------------------------------------------------- */

  test("auto-bounty: does nothing until it is bought", () => {
    const { state } = fullKit();
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "no Dahan arrive unbought");
  });

  test("auto-bounty: casts itself and spends the same cooldown a click would", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_bounty");
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    engine.resolveAutoBounty(state);

    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before + engine.ABILITIES.rivers_bounty.amount, "a Dahan arrived");
    assertEqual(
      state.abilities.rivers_bounty.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "rivers_bounty"),
      "owning it changes who presses the button, not how often it can be pressed"
    );
  });

  test("auto-bounty: still needs the ability unlocked with Energy this round", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_bounty");
    // A fresh round owns only the spirit's starting kit - River's Bounty is not in it.
    assert(!engine.abilityIsUnlocked(state, "rivers_bounty"), "not unlocked at round start");

    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "the automation buys the click, not the ability");
  });

  test("auto-bounty: fires on its own through the tick", () => {
    const ctx = fullKit();
    const { state } = ctx;
    grantUpgrade(state, "auto_bounty");
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    advance(ctx, engine.ABILITIES.rivers_bounty.cooldownSeconds * 2);

    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assert(after > before, "the Dahan arrive without a click");
  });

  /* ---------------------------------------------------------------- *
   * Auto Wash Away                                                     *
   * ---------------------------------------------------------------- */

  test("auto-wash-away: does nothing until it is bought", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "1", { explorers: 2 }, 0);

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["1"].explorers, 2, "nothing moves unbought");
  });

  test("auto-wash-away prio 1: empties a land the next Build would thicken", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);

    // Wetlands is lands 1 and 7, and land 1 holds exactly what the push can clear out.
    state.invader = { build: ["wetlands"], explore: [] };
    setLand(state, "1", { explorers: 2 }, 0);

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["1"].explorers, 0, "the build threat was washed out");
  });

  test("auto-wash-away prio 2: routes an undefended stack into Dahan cover", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Nothing to break, so the pick falls to the routing priority. Land 1's neighbours
    // include land 2, which is the only land holding Dahan.
    setLand(state, "1", { explorers: 1 }, 0);
    state.dahan["2"] = 3;

    const target = engine.pickWashAwayAutoTarget(state);
    assertEqual(target, "1", "the undefended land is the one to push off");

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["1"].explorers, 0, "pushed off the undefended land");
    assertEqual(state.invaders["2"].explorers, 1, "and onto the defended one");
  });

  test("auto-wash-away: leaves the cooldown alone when no priority applies", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    assertEqual(engine.pickWashAwayAutoTarget(state), null, "an empty board asks for nothing");
    engine.resolveAutoWashAway(state);
    assertEqual(state.abilities.wash_away.cooldownRemaining, 0, "a tick that does nothing costs nothing");
  });

  /* ---------------------------------------------------------------- *
   * Prices                                                             *
   * ---------------------------------------------------------------- */

  test("shop: the automation prices rank by what they hand over, not by kit order", () => {
    const { state } = newGame();
    const cost = (id) => engine.upgradeCost(state, id);

    assertEqual(cost("auto_boon"), 25, "Boon: a click every twelve beats");
    assertEqual(cost("auto_innate"), 100, "Innate: a click and a decision");
    assertEqual(cost("auto_wash_away"), 150, "Wash Away: a decision, but the push never kills");
    assertEqual(cost("auto_bounty"), 250, "Bounty: a Dahan every cooldown, all round");
    assertEqual(cost("auto_start_round"), 500, "Auto Start Round: every round after it");

    // Bounty is priced against the reinforcement ladder's last rung rather than against the
    // other automations, because more Dahan is what it actually sells.
    const lastRung = Math.round(
      engine.UPGRADES.dahan_reinforcement.baseCost
      * Math.pow(engine.UPGRADE_COST_GROWTH, engine.upgradeMaxTier("dahan_reinforcement") - 1)
    );
    assert(Math.abs(cost("auto_bounty") - lastRung) < 30, "Bounty sits in the same band as the last Dahan tier");
  });

  test("shop: every automation is a one-off", () => {
    for (const id of ["auto_boon", "auto_innate", "auto_wash_away", "auto_bounty", "auto_start_round"]) {
      assertEqual(engine.upgradeMaxTier(id), 1, `${id} has a single tier`);
    }
  });

  /* ---------------------------------------------------------------- *
   * A round cannot benefit from itself                                 *
   * ---------------------------------------------------------------- */

  test("deferral: an automation bought mid-round is owned but idle until the next one", () => {
    const { state } = fullKit();
    state.meta.fear = 1e9;

    assert(engine.purchaseUpgrade(state, "auto_bounty"), "the purchase lands mid-round");
    assertEqual(engine.upgradeTier(state, "auto_bounty"), 1, "owned at once");
    assertEqual(engine.activeUpgradeTier(state, "auto_bounty"), 0, "idle this round");

    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "and it does not fire");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(engine.activeUpgradeTier(state, "auto_bounty"), 1, "live from the next round");
  });

  test("deferral: Blight Resilience bought at the brink cannot rescue the round", () => {
    // The reason the deferral rule exists at all. With the shop open all round, a live read
    // would make this an emergency button on a round already lost.
    const { state } = newGame();
    state.meta.fear = 1e9;
    const threshold = state.round.blightThreshold;

    engine.purchaseUpgrade(state, "blight_resilience");
    assertEqual(state.round.blightThreshold, threshold, "this round's threshold does not move");

    engine.endRound(state);
    engine.startNextRound(state);
    assert(state.round.blightThreshold > threshold, "the next round starts with the higher one");
  });

  /* ---------------------------------------------------------------- *
   * Auto Start Round                                                   *
   * ---------------------------------------------------------------- */

  test("auto-start: an ended round stands in the shop until the upgrade is owned", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.endRound(state);

    assert(!engine.autoStartRoundOwned(state), "not owned yet");
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);
    assertEqual(state.round.status, "ended", "the round stays ended without it");
  });

  test("auto-start: once owned, the next round begins on its own", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    const number = state.round.number;
    engine.endRound(state);

    advance(ctx, 1);

    assertEqual(state.round.status, "running", "a new round is under way");
    assertEqual(state.round.number, number + 1, "and it is the next one");
  });

  test("auto-start: the toggle turns it off without un-buying it", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.setAutoStartRound(state, false);
    engine.endRound(state);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(state.round.status, "ended", "the shop stays open");
    assert(engine.autoStartRoundOwned(state), "and the upgrade is still owned");

    // Turning it back on needs no second purchase, and the next tick is what acts on it.
    engine.setAutoStartRound(state, true);
    advance(ctx, 1);
    assertEqual(state.round.status, "running", "it picks straight back up");
  });

  test("auto-start: a paused game does not start rounds behind the player's back", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.endRound(state);
    engine.setGameSpeed(state, 0);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(state.round.status, "ended", "the speed dial stops this too");
  });

  test("auto-start: each round banks its own Fear as it rolls over", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    state.meta.fear = 0;
    state.round.fearEarned = 17;

    engine.endRound(state);
    assertEqual(state.meta.fear, 17, "banked at the boundary");

    advance(ctx, 1);
    assertEqual(state.round.status, "running", "and the next round is away");
    assertEqual(state.round.fearEarned, 0, "on a fresh tally");
    assertEqual(state.meta.fear, 17, "with the banked Fear untouched");
  });

  test("auto-start: the wave gate is still honoured by a round that started itself", () => {
    // Two independent controls. Auto Start Round says a round begins; auto-proceed says a
    // wave does. Owning one must not quietly grant the other.
    const ctx = newGame({ manualWaves: true });
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.endRound(state);

    advance(ctx, 1);
    assertEqual(state.round.status, "running", "the round started");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);
    assertEqual(state.round.wavesResolved, 0, "but no wave resolved behind the gate");
  });

  /* ---------------------------------------------------------------- *
   * The record                                                         *
   * ---------------------------------------------------------------- */

  test("auto-start: the wave record keeps up across rounds nobody watched", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");

    state.round.wavesResolved = 9;
    engine.endRound(state);
    advance(ctx, 1);
    assertEqual(state.meta.bestWaveReached, 9, "the first round set it");

    state.round.wavesResolved = 4;
    engine.endRound(state);
    advance(ctx, 1);
    assertEqual(state.meta.bestWaveReached, 9, "a shorter one does not lower it");
  });
})();
