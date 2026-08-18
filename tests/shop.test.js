/* Fear and shop checks - docs/spec/08-acceptance-tests.md#fear-and-shop-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, advance, runUntilRoundEnds, clearBoard, setLand, unlockAllAbilities, grantUpgrade, grantPresence } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

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
        "headwaters",
        // The soft-capped ladders never sink, because they can never sell out. They hold their
        // place in the buyable half however deep the player has taken them.
        "rising_dread",
        "mounting_terror",
        "high_water_mark",
        // The power cards' own ladder, in catalogue order right after the three Fear ones and
        // ahead of the pool. Ten tiers deep, so it stays buyable here like the rest of them.
        "power_card_interval",
        // The pool sits with the repeatables and only sinks once it is full - 10000 Fear,
        // which this state has but has not spent.
        "dahan_remember",
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
   * headwaters - the Energy a round opens with                           *
   * ------------------------------------------------------------------ */

  test("shop: without headwaters a round still opens on an empty purse", () => {
    const { state } = newGame();
    assertEqual(state.resources.energy, 0, "a fresh game starts at nothing");

    state.resources.energy = 40;
    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(state.resources.energy, 0, "and the next round clears what the last one held");
  });

  test("shop: headwaters pays its tier's Energy into every round start", () => {
    const { state } = newGame();
    grantUpgrade(state, "headwaters", 4);

    for (let i = 0; i < 3; i += 1) {
      state.resources.energy = 99;
      engine.endRound(state);
      engine.startNextRound(state);
      assertEqual(state.resources.energy, 5, `round ${state.round.number} opens on tier 4's 5`);
    }
  });

  // The ladder is a table, not a step, so the shape is the thing worth asserting: it climbs
  // with the price rather than staying flat, and it ends exactly on the unlock kit.
  test("shop: the headwaters table climbs and stops at the whole unlock kit", () => {
    assertDeepEqual(
      engine.STARTING_ENERGY_BY_TIER,
      [0, 1, 2, 3, 5, 8, 13, 19, 26, 35],
      "the published ladder"
    );
    assertEqual(engine.upgradeMaxTier("headwaters"), 9, "nine tiers, one per entry past zero");

    // 5 + 10 + 20: River's Bounty, Flash Floods and Wash Away, and nothing spare.
    const kit = ["rivers_bounty", "flash_floods", "wash_away"]
      .reduce((sum, id) => sum + engine.ABILITIES[id].unlockCost, 0);
    assertEqual(engine.startingEnergyForTier(9), kit, "the top tier is exactly the unlock kit");

    for (let tier = 1; tier <= 9; tier += 1) {
      assert(
        engine.startingEnergyForTier(tier) > engine.startingEnergyForTier(tier - 1),
        `tier ${tier} must be worth more than the one under it`
      );
    }
  });

  test("shop: headwaters costs 8 and rides the same 1.6 curve as everything else", () => {
    const { state } = newGame();
    const expected = [8, 13, 20, 33, 52, 84, 134, 215, 344];

    for (const cost of expected) {
      assertEqual(engine.upgradeCost(state, "headwaters"), cost, `next tier costs ${cost}`);
      state.meta.fear = cost;
      assert(engine.purchaseUpgrade(state, "headwaters"), "and it sells at that price");
      assertEqual(state.meta.fear, 0, "for exactly that much");
    }

    assertEqual(engine.upgradeTier(state, "headwaters"), 9, "nine tiers bought");
    state.meta.fear = 1e9;
    assert(!engine.purchaseUpgrade(state, "headwaters"), "and the tenth is refused");
  });

  // Same two-pool rule as every other upgrade: bought mid-round, live from the next one. It
  // matters more here than elsewhere - startRound is the only line that reads this, so a round
  // already under way has no way to pay out a tier bought during it anyway.
  test("shop: a headwaters tier bought mid-round does not refill the running round", () => {
    const { state } = newGame();
    state.meta.fear = 100;
    state.resources.energy = 0;

    assert(engine.purchaseUpgrade(state, "headwaters"), "bought while the round runs");
    assertEqual(state.resources.energy, 0, "the purse stays where it was");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(state.resources.energy, 1, "the next round opens on it");
  });

  // A save carrying a tier past the end of the table - a longer ladder in some later build, or
  // a hand-edited save - must answer with the top of the ladder that exists, not undefined.
  test("shop: a tier past the end of the headwaters table clamps to its top", () => {
    assertEqual(engine.startingEnergyForTier(50), 35, "clamped to the last entry");
    assertEqual(engine.startingEnergyForTier(0), 0, "and tier 0 pays nothing");
    assertEqual(engine.startingEnergyForTier(-3), 0, "as does a nonsense tier");
  });

  /* ------------------------------------------------------------------ *
   * The two rows that describe their next rung (06-ui-contract.md)       *
   *                                                                      *
   * Asserted in both locales and by the numbers rather than by the        *
   * wording: what the contract promises is that the row prices the next   *
   * purchase, and a translation that dropped the figures would keep every *
   * word of the sentence and none of the promise.                        *
   * ------------------------------------------------------------------ */

  function rowText(state, upgradeId, lang) {
    state.ui.language = lang;
    return engine.upgradeText(state, upgradeId);
  }

  test("shop: the headwaters row prices the next tier, not the whole table", () => {
    const { state } = newGame();
    grantUpgrade(state, "headwaters", 4);

    for (const lang of ["de", "en"]) {
      const text = rowText(state, "headwaters", lang);
      assert(/(^|\D)3(\D|$)/.test(text), `${lang}: the 3 the next tier adds to tier 4's 5`);
      assert(/(^|\D)8(\D|$)/.test(text), `${lang}: and the 8 a round would then open with`);
      assert(!/13/.test(text), `${lang}: and nothing about the rungs past it: ${text}`);
    }
  });

  test("shop: a maxed headwaters row states what it ends up paying instead", () => {
    const { state } = newGame();
    grantUpgrade(state, "headwaters", 9);

    for (const lang of ["de", "en"]) {
      const text = rowText(state, "headwaters", lang);
      assert(/35/.test(text), `${lang}: the top of the ladder`);
      assert(!/(^|\D)26(\D|$)/.test(text), `${lang}: with no next tier quoted: ${text}`);
    }
  });

  test("shop: the High-Water Mark row prices its next tier against the milestone ahead", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 2);
    state.round.wavesResolved = 34;

    for (const lang of ["de", "en"]) {
      const text = rowText(state, "high_water_mark", lang);
      assert(/(^|\D)40(\D|$)/.test(text), `${lang}: wave 40 is the next milestone: ${text}`);
      assert(/(^|\D)12(\D|$)/.test(text), `${lang}: 40 * 3 * 10%, what tier 3 would pay there`);
      assert(/(^|\D)8(\D|$)/.test(text), `${lang}: against the 8 tier 2 pays there now`);
    }
  });

  // The wave it quotes has to follow the player rather than sit on a fixed example, and depth
  // lives in two places: the round in progress, and the record a finished round left behind.
  test("shop: the milestone the Mark quotes follows the deepest wave reached", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 4);
    const quotes = (wave) => (wave * 5 * 0.1);

    // A fresh game looks at wave 10, and the payout it quotes there is what pins the wave down:
    // 10 itself also appears in the sentence as the per-tier percentage.
    let text = rowText(state, "high_water_mark", "en");
    assert(new RegExp(`(^|\\D)${quotes(10)}(\\D|$)`).test(text), `wave 10's 5: ${text}`);

    state.meta.bestWaveReached = 97;
    text = rowText(state, "high_water_mark", "en");
    assert(/(^|\D)100(\D|$)/.test(text), `a record of 97 looks at wave 100: ${text}`);
    assert(new RegExp(`(^|\\D)${quotes(100)}(\\D|$)`).test(text), `and quotes its 50: ${text}`);

    state.round.wavesResolved = 143;
    text = rowText(state, "high_water_mark", "en");
    assert(/(^|\D)150(\D|$)/.test(text), `a run already past the record looks at 150: ${text}`);
    assert(new RegExp(`(^|\\D)${quotes(150)}(\\D|$)`).test(text), `and quotes its 75: ${text}`);
  });

  /* ------------------------------------------------------------------ *
   * The two rows Fear alone cannot reach                                 *
   *                                                                      *
   * They used to be behind a completion gate - refused until every other row in the catalogue
   * was maxed. They are behind Presence now, which is a question asked of a different
   * currency, and the checks below are the ones that break if the two ever get confused.
   * ------------------------------------------------------------------ */

  const PRESENCE_LOCKED = [
    ["auto_start_round", "presence_tide_returns"],
    ["auto_buy_abilities", "presence_river_knows"]
  ];

  test("shop: the two automations are sealed until Presence opens them", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;

    for (const [upgradeId] of PRESENCE_LOCKED) {
      assert(engine.upgradeNeedsPresence(state, upgradeId), `${upgradeId} is locked on a fresh save`);
      assert(!engine.purchaseUpgrade(state, upgradeId), "and all the Fear in the world does not buy it");
      assertEqual(engine.upgradeTier(state, upgradeId), 0, "still unowned");
    }

    assert(!engine.upgradeNeedsPresence(state, "auto_boon"), "nothing else in the shop is locked");
    assert(engine.purchaseUpgrade(state, "auto_boon"), "and the rest sells as it always did");
  });

  // The regression the deleted gate would have caused if it had been left in: finishing the
  // catalogue used to be the thing that opened these two, and now it means nothing at all.
  test("shop: maxing the whole catalogue does not open them", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;

    for (const id of engine.UPGRADE_IDS) {
      if (engine.upgradePresenceUnlock(id)) continue;
      state.upgrades.purchased[id] = engine.upgradeMaxTier(id);
    }

    for (const [upgradeId] of PRESENCE_LOCKED) {
      assert(engine.upgradeNeedsPresence(state, upgradeId), `${upgradeId} is still Presence's to open`);
    }
  });

  test("shop: the two locks are independent of each other", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;
    grantPresence(state, "presence_tide_returns");

    assert(!engine.upgradeNeedsPresence(state, "auto_start_round"), "the one it opened is open");
    assert(engine.purchaseUpgrade(state, "auto_start_round"), "and it sells");
    assert(engine.upgradeNeedsPresence(state, "auto_buy_abilities"), "the other is untouched");
    assert(!engine.purchaseUpgrade(state, "auto_buy_abilities"), "and still refused");
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
