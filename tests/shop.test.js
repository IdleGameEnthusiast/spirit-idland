/* Fear and shop checks - docs/spec/08-acceptance-tests.md#fear-and-shop-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, advance, runUntilRoundEnds, clearBoard, setLand, unlockAllAbilities } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("shop: Fear earned mid-round is still there when the round ends", () => {
    const ctx = newGame();
    const { state } = ctx;
    unlockAllAbilities(state);

    // Earned by hand rather than played for: this check is about Fear surviving a lost
    // round, and an ability is the shortest way to put some on the books.
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    const earned = state.round.fearEarned;
    assert(earned > 0, "the ability should have earned Fear");
    assertEqual(state.meta.fear, 0, "and none of it is spendable yet");

    runUntilRoundEnds(ctx);

    assertEqual(state.round.status, "ended", "round ended");
    assert(state.meta.fear >= earned, "Fear must survive the loss");
    assertClose(state.meta.fear, state.round.fearEarned, 0.0001, "all of it came from this round");
  });

  test("shop: Fear survives into the next round as well", () => {
    const ctx = newGame();
    const { state } = ctx;
    state.meta.fear = 9.45;
    runUntilRoundEnds(ctx);

    const banked = state.meta.fear;
    engine.startNextRound(state);

    assertClose(state.meta.fear, banked, 0.0001, "round setup must not touch meta.fear");
    assertEqual(state.round.fearEarned, 0, "the per-round counter does reset");
  });

  // The shop stays open now that rounds can start themselves. What keeps a round from buying
  // its own way out is the pool the Fear sits in and the snapshot the round runs on - not a
  // closed shop.
  test("shop: banked Fear can be spent during a round, but takes effect only next round", () => {
    const { state } = newGame();
    state.meta.fear = 100;

    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    const ok = engine.purchaseUpgrade(state, "dahan_reinforcement");

    assert(ok, "a purchase mid-round is allowed");
    assertClose(state.meta.fear, 100 - cost, 0.0001, "cost deducted");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 1, "owned immediately");
    assertEqual(engine.activeUpgradeTier(state, "dahan_reinforcement"), 0, "but idle this round");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(engine.activeUpgradeTier(state, "dahan_reinforcement"), 1, "live from the next round");
  });

  test("shop: Fear earned this round cannot be spent on this round", () => {
    const { state } = newGame();
    state.meta.fear = 0;
    state.round.fearEarned = 1000;

    const ok = engine.purchaseUpgrade(state, "dahan_reinforcement");
    assert(!ok, "an unbanked round tally buys nothing");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 0, "no tier gained");
    assertEqual(state.round.fearEarned, 1000, "and the tally is untouched");
  });

  test("shop: a purchase deducts its cost and increments the tier", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 100;

    const cost = engine.upgradeCost(state, "dahan_reinforcement");
    const ok = engine.purchaseUpgrade(state, "dahan_reinforcement");

    assert(ok, "purchase should succeed");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 1, "tier 1");
    assertClose(state.meta.fear, 100 - cost, 0.0001, "cost deducted");
  });

  test("shop: an unaffordable purchase is refused and changes nothing", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1;

    const ok = engine.purchaseUpgrade(state, "blight_resilience");
    assert(!ok, "purchase must be refused");
    assertEqual(state.meta.fear, 1, "Fear untouched");
    assertEqual(engine.upgradeTier(state, "blight_resilience"), 0, "tier untouched");
  });

  test("shop: cost rises with each tier already owned", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 10000;

    const first = engine.upgradeCost(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "dahan_reinforcement");
    const second = engine.upgradeCost(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "dahan_reinforcement");
    const third = engine.upgradeCost(state, "dahan_reinforcement");

    assert(second > first, "second tier must cost more than the first");
    assert(third > second, "third tier must cost more than the second");
  });

  test("shop: a purchased upgrade still applies many rounds later", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.endRound(state);
    state.meta.fear = 500;
    engine.purchaseUpgrade(state, "blight_resilience");
    engine.purchaseUpgrade(state, "blight_resilience");

    for (let i = 0; i < 4; i += 1) {
      engine.startNextRound(state);
      assertEqual(
        state.round.blightThreshold,
        engine.BLIGHT_THRESHOLD_BASE + 2,
        `threshold in round ${state.round.number}`
      );
      engine.endRound(state);
    }

    assertEqual(engine.upgradeTier(state, "blight_resilience"), 2, "tier never decays");
  });

  test("shop: starting the next round is available regardless of remaining Fear", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 0;

    const ok = engine.startNextRound(state);
    assert(ok, "an empty purse must not block the next round");
    assertEqual(state.round.status, "running", "round is live again");
  });

  test("shop: the next round cannot be started while one is running", () => {
    const { state } = newGame();
    const numberBefore = state.round.number;

    const ok = engine.startNextRound(state);
    assert(!ok, "must refuse mid-round");
    assertEqual(state.round.number, numberBefore, "round number unchanged");
  });

  // Rounds are no longer tallied at all: a fresh game has no counter, and a save that carries
  // one from before loses it on load.
  test("shop: rounds played is not counted", () => {
    const { state } = newGame();
    assertEqual("totalRoundsPlayed" in state.meta, false, "no counter on a fresh game");

    engine.endRound(state);
    assertEqual("totalRoundsPlayed" in state.meta, false, "and none after a round ends");

    const carried = engine.migrateSave({
      schemaVersion: engine.VERSION,
      meta: { fear: 5, totalRoundsPlayed: 7 }
    });
    assertEqual("totalRoundsPlayed" in carried.state.meta, false, "an old save drops it");
  });

  // The record is the deepest wave any round reached, not how many rounds were played. The
  // ladder is keyed to the wave, so the wave is what says how far the run actually got.
  test("shop: bestWaveReached tracks the high-water mark and never decreases", () => {
    const { state } = newGame();
    state.round.wavesResolved = 7;
    engine.endRound(state);
    assertEqual(state.meta.bestWaveReached, 7, "first record");

    engine.startNextRound(state);
    state.round.wavesResolved = 12;
    engine.endRound(state);
    assertEqual(state.meta.bestWaveReached, 12, "a deeper round raises it");

    // A shorter round afterwards must not rewind the record.
    engine.startNextRound(state);
    state.round.wavesResolved = 3;
    engine.endRound(state);
    assertEqual(state.meta.bestWaveReached, 12, "record holds");
  });

  test("shop: blight_resilience stops at its max tier", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    const max = engine.upgradeMaxTier("blight_resilience");
    for (let i = 0; i < max + 3; i += 1) engine.purchaseUpgrade(state, "blight_resilience");

    assertEqual(engine.upgradeTier(state, "blight_resilience"), max, "tier caps");
  });

  test("shop: a one-off upgrade is bought once and then refuses", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assertEqual(engine.upgradeMaxTier("auto_boon"), 1, "a one-off has a single tier");
    assert(engine.purchaseUpgrade(state, "auto_boon"), "the first buy lands");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 1, "owned");

    assert(!engine.purchaseUpgrade(state, "auto_boon"), "the second buy is refused");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 1, "still one");
  });

  test("shop: auto_innate is a 100 Fear one-off, priced above auto_boon", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assertEqual(engine.upgradeCost(state, "auto_innate"), 100, "base cost is 100 Fear");
    assert(
      engine.upgradeCost(state, "auto_innate") > engine.upgradeCost(state, "auto_boon"),
      "it automates more, so it costs more"
    );
    assertEqual(engine.upgradeMaxTier("auto_innate"), 1, "a one-off has a single tier");

    assert(engine.purchaseUpgrade(state, "auto_innate"), "the first buy lands");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "owned");

    assert(!engine.purchaseUpgrade(state, "auto_innate"), "the second buy is refused");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "still one");
  });

  test("shop: orderedUpgradeIds sinks anything sold out below what is still buyable", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    // dahan_reinforcement is maxed out, auto_boon is bought (also maxed, being a one-off).
    // blight_resilience and auto_innate are left untouched.
    const max = engine.upgradeMaxTier("dahan_reinforcement");
    for (let i = 0; i < max; i += 1) engine.purchaseUpgrade(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "auto_boon");

    assertDeepEqual(
      engine.orderedUpgradeIds(state),
      [
        "blight_resilience",
        "auto_innate",
        "auto_bounty",
        "auto_flash_floods",
        "auto_wash_away",
        "auto_buy_abilities",
        "auto_start_round",
        "dahan_reinforcement",
        "auto_boon"
      ],
      "the two sold-out upgrades sink to the bottom, catalogue order preserved on both sides"
    );
  });

  /* ------------------------------------------------------------------ *
   * The gate on the last two purchases                                   *
   * ------------------------------------------------------------------ */

  // Buys out the whole catalogue except the two behind the gate. Fear is granted rather than
  // played for: what these checks are about is the gate, not the grind up to it.
  function buyEverythingButTheGated(state) {
    state.meta.fear = 1e9;
    for (const id of engine.UPGRADE_IDS) {
      if (engine.GATED_UPGRADE_IDS.includes(id)) continue;
      while (engine.upgradeTier(state, id) < engine.upgradeMaxTier(id)) {
        if (!engine.purchaseUpgrade(state, id)) throw new Error(`could not buy ${id}`);
      }
    }
    return state;
  }

  test("shop: the last two purchases are sealed while anything else is still for sale", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;

    for (const id of engine.GATED_UPGRADE_IDS) {
      assert(engine.upgradeIsLocked(state, id), `${id} is locked on a fresh save`);
      assert(!engine.purchaseUpgrade(state, id), "and all the Fear in the world does not buy it");
      assertEqual(engine.upgradeTier(state, id), 0, "still unowned");
    }

    assert(!engine.upgradeIsLocked(state, "auto_boon"), "nothing else in the shop is gated");
    assert(engine.purchaseUpgrade(state, "auto_boon"), "and the rest sells as it always did");
  });

  test("shop: one unbought ladder rung is enough to keep the gate shut", () => {
    const state = buyEverythingButTheGated(newGame().state);
    assert(engine.gatedUpgradesUnlocked(state), "the catalogue is finished");

    // One rung handed back. The gate reads what is owned, so it shuts again.
    state.upgrades.purchased.blight_resilience = engine.upgradeMaxTier("blight_resilience") - 1;
    assert(!engine.gatedUpgradesUnlocked(state), "a single missing tier closes it");
    assert(!engine.purchaseUpgrade(state, "auto_start_round"), "and the purchase is refused again");
  });

  test("shop: finishing the catalogue opens both of them", () => {
    const state = buyEverythingButTheGated(newGame().state);

    for (const id of engine.GATED_UPGRADE_IDS) {
      assert(!engine.upgradeIsLocked(state, id), `${id} is for sale now`);
      assert(engine.purchaseUpgrade(state, id), "and it sells");
      assertEqual(engine.upgradeTier(state, id), 1, "owned");
    }
  });

  test("shop: the gated pair does not gate itself", () => {
    // The rule reads "everything else", and the pair is excluded from it on purpose: read the
    // other way each would be waiting on the other and neither would ever open.
    const state = buyEverythingButTheGated(newGame().state);

    assert(engine.purchaseUpgrade(state, "auto_buy_abilities"), "one of the pair lands");
    assert(!engine.upgradeIsLocked(state, "auto_start_round"), "the other did not lock behind it");
  });

  test("shop: a locked row is refused for being locked, not for being unaffordable", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;
    const before = (state._log || []).length;

    assert(!engine.purchaseUpgrade(state, "auto_buy_abilities"), "refused");
    assert((state._log || []).length > before, "and it says why");
    assertEqual(state.meta.fear, 1e9, "no Fear changed hands");
  });

  test("shop: an ability defeat during a round feeds the purse the shop spends, once banked", () => {
    const { state } = newGame();
    unlockAllAbilities(state);
    clearBoard(state);
    state.meta.fear = 0;
    state.round.fearEarned = 0;
    setLand(state, "3", { cities: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    engine.triggerAbility(state, "flash_floods");
    state.abilities.flash_floods.cooldownRemaining = 0;
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].cities, 0, "the city fell to two hits");
    assertEqual(state.round.fearEarned, 3 * engine.FEAR_PER_POWER, "a city is worth 3");
    assertEqual(state.meta.fear, 0, "not spendable while the round runs");

    engine.endRound(state);
    assertEqual(state.meta.fear, 3 * engine.FEAR_PER_POWER, "banked when the round ends");
  });
})();
