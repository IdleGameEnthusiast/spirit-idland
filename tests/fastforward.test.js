/* The fast-forwarded opening - docs/spec/08-acceptance-tests.md#the-fast-forwarded-opening
 *
 * `presence_deep_water_comes` is the third pacing control and the only one the player holds no
 * button for. What it must be is a *speed* and nothing else: the waves it hurries have to cost,
 * pay and blight exactly what the same waves cost, pay and blight at 1x. Most of what is
 * asserted below is that identity, because it is the whole defence of the row's price. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, grantPresence, ownCards } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const roundCardsOf = (state) => engine.roundCards(state);

  const ROW = "presence_deep_water_comes";

  /* Real seconds enough to resolve `waves` waves at `speed`, plus a frame of margin.
   *
   * The margin is not sloppiness, it is the only honest way to ask this question: `advance`
   * accumulates its steps, so a run of exactly N intervals lands a float's hair short of the
   * Nth boundary about as often as it lands on it. One frame at 20x is a third of a game
   * second against a twenty-second interval, so it can never buy a wave that was not due. */
  function realSecondsFor(waves, speed) {
    return (engine.WAVE_INTERVAL_SECONDS * waves) / speed + 1 / 60;
  }

  const FF = () => engine.FAST_FORWARD_SPEED;

  // The row grants a share of the all-time record, so a fixture needs both. `bestWaveReached`
  // is written straight rather than played to: what the record is worth is this suite's
  // subject, and how a record gets set is tests/shop.test.js's.
  function hurriedGame(tier, bestWave, options) {
    const ctx = newGame(options);
    ctx.state.meta.bestWaveReached = bestWave;
    // Only when there is a rung to grant: the harness's `grantPresence` floors at 1, so passing
    // it a 0 would quietly hand out the first rung - which is exactly the control case the
    // identity test below needs it not to do.
    if (tier > 0) grantPresence(ctx.state, ROW, tier);
    engine.startRound(ctx.state);
    if (!(options && options.manualWaves)) ctx.state.round.awaitingWave = false;
    return ctx;
  }

  /* --- How many waves ------------------------------------------------- */

  test("fast-forward: the row is unowned by default and hurries nothing", () => {
    const { state } = newGame();
    state.meta.bestWaveReached = 87;
    assertEqual(engine.presenceUpgradeTier(state, ROW), 0, "no rung at a fresh game");
    assertEqual(engine.fastForwardWaves(state), 0, "and no waves");
    assertEqual(engine.fastForwardActive(state), false, "so nothing is running fast");
    assertEqual(engine.effectiveGameSpeed(state), engine.gameSpeed(state), "the dial is the whole speed");
  });

  test("fast-forward: each rung is a share of the record, always floored", () => {
    const { state } = newGame();
    state.meta.bestWaveReached = 87;

    // The worked example the row was designed against: a record of 87 buys 8 waves at the
    // first rung, not 9. Every rung floors, and 87 is chosen because all three shares land on
    // a fraction - 8.7, 13.05 and 17.4 - so a rounding change breaks all three at once.
    grantPresence(state, ROW, 1);
    assertEqual(engine.fastForwardWaves(state), 8, "10% of 87 floors to 8");
    grantPresence(state, ROW, 2);
    assertEqual(engine.fastForwardWaves(state), 13, "15% of 87 floors to 13");
    grantPresence(state, ROW, 3);
    assertEqual(engine.fastForwardWaves(state), 17, "20% of 87 floors to 17");
  });

  test("fast-forward: a record too shallow to floor to a wave grants none", () => {
    const { state } = newGame();
    grantPresence(state, ROW, 1);

    assertEqual(state.meta.bestWaveReached, 0, "a fresh game has no record");
    assertEqual(engine.fastForwardWaves(state), 0, "and 10% of nothing is nothing");

    state.meta.bestWaveReached = 9;
    assertEqual(engine.fastForwardWaves(state), 0, "10% of 9 still floors to zero");
    state.meta.bestWaveReached = 10;
    assertEqual(engine.fastForwardWaves(state), 1, "and 10 is where the first wave arrives");
  });

  test("fast-forward: the row has three rungs at 3 / 4 / 5 Presence", () => {
    const { state } = newGame();
    assertEqual(engine.presenceUpgradeMaxTier(ROW), 3, "three rungs");
    assertEqual(engine.presenceUpgradeCost(state, ROW), 3, "the first is 3");
    grantPresence(state, ROW, 1);
    assertEqual(engine.presenceUpgradeCost(state, ROW), 4, "the second is 4");
    grantPresence(state, ROW, 2);
    assertEqual(engine.presenceUpgradeCost(state, ROW), 5, "the third is 5");
    grantPresence(state, ROW, 3);
    assertEqual(engine.presenceUpgradeCost(state, ROW), Infinity, "and there is no fourth");
    assert(engine.presenceUpgradeMaxed(state, ROW), "the ladder is topped out");
  });

  test("fast-forward: the ladder is bought a rung at a time out of the Presence purse", () => {
    const { state } = newGame();
    state.meta.presence = 7;

    assertEqual(engine.purchasePresenceUpgrade(state, ROW), true, "the first rung is affordable");
    assertEqual(state.meta.presence, 4, "3 Presence gone");
    assertEqual(engine.purchasePresenceUpgrade(state, ROW), true, "and the second");
    assertEqual(state.meta.presence, 0, "4 more");
    assertEqual(engine.purchasePresenceUpgrade(state, ROW), false, "the third is out of reach");
    assertEqual(engine.presenceUpgradeTier(state, ROW), 2, "so the ladder stands where it was");
  });

  /* --- The speed it applies ------------------------------------------- */

  test("fast-forward: the opening runs at 20x and hands the dial back after it", () => {
    const ctx = hurriedGame(1, 30);
    assertEqual(engine.fastForwardWaves(ctx.state), 3, "10% of 30");
    assertEqual(engine.effectiveGameSpeed(ctx.state), engine.FAST_FORWARD_SPEED, "20x at wave 0");

    // Three waves is 60 game seconds, which is 3 real seconds at 20x. Advanced in the tick
    // sizes a browser actually hands out rather than one long step, because MAX_TICK_SECONDS
    // is what makes a long step lossy - and at 20x it bites twenty times sooner.
    advance(ctx, realSecondsFor(3, FF()), 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 3, "three waves in three real seconds");
    assertEqual(engine.fastForwardActive(ctx.state), false, "and the fast-forward is behind us");
    assertEqual(engine.effectiveGameSpeed(ctx.state), 1, "the dial has the round back");
  });

  test("fast-forward: it is off the instant the last hurried wave resolves, not one later", () => {
    const ctx = hurriedGame(1, 20);
    assertEqual(engine.fastForwardWaves(ctx.state), 2, "two waves");

    advance(ctx, realSecondsFor(1, FF()), 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 1, "one down");
    assert(engine.fastForwardActive(ctx.state), "still running fast for the second");

    advance(ctx, realSecondsFor(1, FF()), 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 2, "and the second is in");
    assertEqual(engine.fastForwardActive(ctx.state), false, "which is where it stops");
  });

  test("fast-forward: 0x still stops everything", () => {
    // The dial stays the brake. A purchase is not allowed to overrule the player saying that
    // nothing moves - and it is the only way out of a fast-forward the player did not want.
    const ctx = hurriedGame(3, 100);
    engine.setGameSpeed(ctx.state, 0);
    assertEqual(engine.effectiveGameSpeed(ctx.state), 0, "a stopped clock stays stopped");

    advance(ctx, 5, 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 0, "no wave resolves");
    assertEqual(ctx.state.round.elapsedSeconds, 0, "and the round does not age");
  });

  test("fast-forward: it replaces the dial rather than multiplying it", () => {
    const ctx = hurriedGame(1, 30);
    engine.setGameSpeed(ctx.state, 2);
    assertEqual(engine.effectiveGameSpeed(ctx.state), engine.FAST_FORWARD_SPEED, "20x, not 40x");

    advance(ctx, realSecondsFor(3, FF()), 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 3, "three waves, the same three real seconds");
    assertEqual(engine.effectiveGameSpeed(ctx.state), 2, "and 2x comes back, not 1x");
  });

  /* --- The identity the price rests on --------------------------------- */

  test("fast-forward: a hurried wave pays exactly what an unhurried one pays", () => {
    // The row's whole defence: it buys real seconds and never Fear. Same seed, same board,
    // same waves - the only difference is how long the player sat through them.
    const play = (tier) => {
      const ctx = hurriedGame(tier, 40);
      // 4 waves at 10% of 40. Run both games the same number of *waves*, at whatever real
      // seconds each one takes, so the comparison is wave-for-wave rather than clock-for-clock.
      const speed = tier > 0 ? engine.FAST_FORWARD_SPEED : 1;
      advance(ctx, realSecondsFor(4, speed), 1 / 60);
      return ctx.state;
    };

    const slow = play(0);
    const fast = play(1);

    assertEqual(fast.round.wavesResolved, 4, "the hurried game resolved four waves");
    assertEqual(slow.round.wavesResolved, 4, "and so did the plain one");
    assertClose(fast.round.fearEarned, slow.round.fearEarned, 0.001, "for the same Fear");
    assertEqual(fast.round.blight, slow.round.blight, "the same Blight");
    assertEqual(fast.round.cards.drawsTaken, slow.round.cards.drawsTaken, "and the same cards drawn");
  });

  test("fast-forward: no tick may resolve two waves, even at 20x", () => {
    // MAX_TICK_SECONDS is half a wave interval, so the cap that stops a machine waking from
    // sleep bursting through waves has to keep holding twenty times further along the dial. A
    // dropped frame during the fast-forward must run the round *slow*, never skip it forward.
    const ctx = hurriedGame(3, 200);
    let last = 0;
    for (let i = 0; i < 40; i += 1) {
      advance(ctx, 2, 2);
      const resolved = ctx.state.round.wavesResolved;
      assert(resolved - last <= 1, `tick ${i} resolved ${resolved - last} waves`);
      last = resolved;
      if (ctx.state.round.status !== "running") break;
    }
  });

  /* --- The wave gate --------------------------------------------------- */

  test("fast-forward: a manual round opens moving and gets its gate back after", () => {
    const ctx = hurriedGame(1, 30, { manualWaves: true });
    assertEqual(ctx.state.ui.autoProceed, false, "the toggle is still off");
    assertEqual(ctx.state.round.awaitingWave, false, "but the round opens moving");
    assertEqual(engine.waveGateHeld(ctx.state), false, "with no gate holding it");

    advance(ctx, realSecondsFor(3, FF()), 1 / 60);
    assertEqual(ctx.state.round.wavesResolved, 3, "the three hurried waves went by unasked");

    // And the fourth does not. The gate closes again on the first wave past the cap, which is
    // what makes the row a fast-forward of the opening rather than a purchase of auto-proceed.
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    assertEqual(ctx.state.round.wavesResolved, 3, "no fourth wave arrives on its own");
    assert(engine.waveGateHeld(ctx.state), "the gate is holding again");
    assertEqual(ctx.state.ui.autoProceed, false, "and the toggle was never touched");
  });

  test("fast-forward: the toggle keeps saying what the player set", () => {
    const ctx = hurriedGame(1, 30, { manualWaves: true });
    assert(engine.fastForwardActive(ctx.state), "the opening is running fast");
    assertEqual(engine.autoProceedOn(ctx.state), false, "which is not auto-proceed");
    assert(engine.waveProceedsUnattended(ctx.state), "though the wave comes unasked all the same");
  });

  /* --- Card reveals ---------------------------------------------------- */

  /* The drip's first draw is POWER_CARD_FIRST_DRAW_WAVE deep, far past any opening this row
   * fast-forwards on a modest record. So both tests below move `nextDrawWave` rather than
   * playing to it: when the draw is due is tests/cards.test.js's subject, and what happens to
   * its announcement at 20x is this one's. */

  test("fast-forward: cards arrive but are not revealed while it runs", () => {
    const ctx = hurriedGame(1, 30);
    ownCards(ctx.state, ["pull_beneath", "tsunami"]);
    roundCardsOf(ctx.state).nextDrawWave = 1;

    advance(ctx, realSecondsFor(3, FF()), 1 / 60);
    assert(roundCardsOf(ctx.state).drawsTaken > 0, "the drip ran during the fast-forward");
    assertEqual(ctx.state.ui.cardFx, null, "and announced none of it");
    assert(ctx.state.round.cards.handIds.length > 0, "the cards themselves are in hand all the same");
  });

  test("fast-forward: reveals come back the moment the opening is behind", () => {
    const ctx = hurriedGame(1, 30);
    ownCards(ctx.state, ["pull_beneath", "tsunami"]);

    advance(ctx, realSecondsFor(3, FF()), 1 / 60);
    assertEqual(engine.fastForwardActive(ctx.state), false, "the fast-forward is over");

    // One more wave, at the dial's own speed, with a draw due on it.
    roundCardsOf(ctx.state).nextDrawWave = ctx.state.round.wavesResolved + 1;
    const before = roundCardsOf(ctx.state).drawsTaken;
    advance(ctx, realSecondsFor(1, 1));
    assert(roundCardsOf(ctx.state).drawsTaken > before, "the drip drew again");
    assert(ctx.state.ui.cardFx !== null, "and this one is announced");
  });

  /* --- Between rounds --------------------------------------------------- */

  test("fast-forward: every round gets the same opening, off the same record", () => {
    const ctx = hurriedGame(1, 50);
    assertEqual(engine.fastForwardWaves(ctx.state), 5, "the first round hurries five");

    // A deeper round raises the record, and the *next* round is what gets the wider opening -
    // the count is read live, but `bestWaveReached` only moves in endRound, so it cannot
    // change under a round that is running.
    advance(ctx, realSecondsFor(5, FF()), 1 / 60);
    const midRound = engine.fastForwardWaves(ctx.state);
    ctx.state.round.wavesResolved = 70;
    assertEqual(engine.fastForwardWaves(ctx.state), midRound, "a running round cannot widen its own opening");

    engine.endRound(ctx.state);
    assertEqual(ctx.state.meta.bestWaveReached, 70, "the record moved at round end");
    engine.startNextRound(ctx.state);
    assertEqual(engine.fastForwardWaves(ctx.state), 7, "and the next round hurries seven");
  });

  test("fast-forward: a round that has ended is not fast-forwarding anything", () => {
    const ctx = hurriedGame(3, 100);
    assert(engine.fastForwardActive(ctx.state), "running, and hurrying");
    engine.endRound(ctx.state);
    assertEqual(engine.fastForwardActive(ctx.state), false, "ended, and not");
    assertEqual(engine.effectiveGameSpeed(ctx.state), 1, "the shop is not run at 20x");
  });

  /* --- What the shop says ------------------------------------------------ */

  test("fast-forward: the row quotes the share the next rung buys", () => {
    const { state } = newGame();
    state.meta.bestWaveReached = 87;

    const unowned = engine.presenceUpgradeText(state, ROW);
    assert(unowned.includes("10%"), `an unowned row offers 10%: ${unowned}`);

    grantPresence(state, ROW, 1);
    const owned = engine.presenceUpgradeText(state, ROW);
    assert(owned.includes("15%"), `one rung up, the next is 15%: ${owned}`);

    grantPresence(state, ROW, 3);
    const maxed = engine.presenceUpgradeText(state, ROW);
    assert(maxed.includes("20%"), `at the top the row quotes what it has: ${maxed}`);
  });

  /* The chip carries what the row's sentence no longer does: the rung owned, and what that
   * rung is granting at this record. Both figures move - the tier when the row is bought, the
   * wave count every time the record does - so the chip is the shop's only live answer to
   * "what is this doing for me right now". */
  test("fast-forward: the tier chip counts rungs and names the waves they grant", () => {
    const { state } = newGame();
    state.meta.bestWaveReached = 87;

    const none = engine.presenceUpgradeStatusText(state, ROW);
    assert(none.includes("0") && none.includes("3"), `an unowned ladder still counts: ${none}`);

    grantPresence(state, ROW, 2);
    const chip = engine.presenceUpgradeStatusText(state, ROW);
    assert(chip.includes("2") && chip.includes("3"), `the chip counts rungs: ${chip}`);
    assert(chip.includes("13"), `and names the 13 waves the rung grants: ${chip}`);
    assert(chip.includes("15%"), `and the share those waves come from: ${chip}`);
  });

  test("fast-forward: both locales carry the chip's label", () => {
    for (const lang of ["de", "en"]) {
      const label = engine.I18N[lang].presenceTierFastForward;
      assert(label, `${lang} has the label`);
      for (const key of ["{tier}", "{max}", "{waves}", "{share}"]) {
        assert(label.includes(key), `${lang} label carries ${key}`);
      }
    }
  });
})();
