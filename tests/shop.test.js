/* Fear and shop checks - docs/spec/08-acceptance-tests.md#fear-and-shop-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, advance, runUntilRoundEnds, clearBoard, setLand, unlockAllAbilities, grantUpgrade, grantPresence, ownCards } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

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

    const max = engine.upgradeMaxTier(state, "blight_resilience");
    for (let i = 0; i < max + 3; i += 1) engine.purchaseUpgrade(state, "blight_resilience");

    assertEqual(engine.upgradeTier(state, "blight_resilience"), max, "tier caps");
  });

  test("shop: a one-off upgrade is bought once and then refuses", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assertEqual(engine.upgradeMaxTier(state, "auto_boon"), 1, "a one-off has a single tier");
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
    assertEqual(engine.upgradeMaxTier(state, "auto_innate"), 1, "a one-off has a single tier");

    assert(engine.purchaseUpgrade(state, "auto_innate"), "the first buy lands");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "owned");

    assert(!engine.purchaseUpgrade(state, "auto_innate"), "the second buy is refused");
    assertEqual(engine.upgradeTier(state, "auto_innate"), 1, "still one");
  });

  test("shop: orderedUpgradeIds sinks anything sold out below what is still buyable", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;
    // One card owned, which is what puts power_card_interval on the shelf at all - see the
    // reveal check below. Everything this test is about is unaffected by it.
    ownCards(state, "accelerated_rot");

    // dahan_reinforcement is maxed out, auto_boon is bought (also maxed, being a one-off).
    // blight_resilience and auto_innate are left untouched.
    const max = engine.upgradeMaxTier(state, "dahan_reinforcement");
    for (let i = 0; i < max; i += 1) engine.purchaseUpgrade(state, "dahan_reinforcement");
    engine.purchaseUpgrade(state, "auto_boon");

    assertDeepEqual(
      engine.orderedUpgradeIds(state),
      [
        // The wave group, in catalogue order: the Energy a round opens with, the Blight it
        // survives, and the ladder that shortens the wait for the next card. Ten tiers deep,
        // so the card row stays buyable here like the rest of them.
        "headwaters",
        "blight_resilience",
        "power_card_interval",
        // The Fear generators. The three ladders never sink here - ten tiers each, and this
        // state has bought none of them.
        "rising_dread",
        "mounting_terror",
        "high_water_mark",
        // The Dahan group is two rows and the ladder half of it is maxed below, so only the
        // pool is left in the buyable half. It sinks only once it is full - 10000 Fear, which
        // this state has but has not spent.
        "dahan_remember",
        "auto_innate",
        "auto_bounty",
        "auto_flash_floods",
        "auto_wash_away",
        "auto_buy_abilities",
        "auto_start_round",
        // The sold-out half, in catalogue order like the buyable one - a maxed ladder from the
        // Dahan group, then a bought automation. The fold is not grouped, so the two sit
        // together under one heading whatever groups they came from.
        "dahan_reinforcement",
        "auto_boon"
      ],
      "the two sold-out upgrades sink to the bottom, catalogue order preserved on both sides"
    );
  });

  test("shop: the card-interval row stays off the shelf until the first power card is owned", () => {
    const { state } = newGame();
    engine.endRound(state);
    state.meta.fear = 1e9;

    assert(!engine.upgradeRevealed(state, "power_card_interval"), "no card, no row");
    assert(
      !engine.orderedUpgradeIds(state).includes("power_card_interval"),
      "and the shop list does not carry it"
    );
    assert(engine.upgradeRevealed(state, "rising_dread"), "every other row is on the shelf");

    ownCards(state, "accelerated_rot");

    assert(engine.upgradeRevealed(state, "power_card_interval"), "the first card reveals it");
    assert(
      engine.orderedUpgradeIds(state).includes("power_card_interval"),
      "and it takes its catalogue place"
    );

    // A reveal is not a lock: what it hid was a row, never a purchase. Nothing about the
    // hidden state should have made the buy behave differently once it is visible.
    assert(engine.purchaseUpgrade(state, "power_card_interval"), "and it buys as any row does");
    assertEqual(engine.upgradeTier(state, "power_card_interval"), 1, "tier 1");
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
    const { state } = newGame();
    assertDeepEqual(
      engine.STARTING_ENERGY_BY_TIER,
      [0, 1, 2, 3, 5, 8, 13, 19, 26, 35],
      "the published ladder"
    );
    assertEqual(engine.upgradeMaxTier(state, "headwaters"), 9, "nine tiers, one per entry past zero");

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
   * The shelf, in four groups                                            *
   *                                                                      *
   * The shop heads each run of rows with the group they share and draws nothing else, so the
   * grouping is entirely a property of the catalogue's order. A row that drifted away from
   * its own kind would put its heading on the shelf twice, which is the thing these checks
   * are here to catch - the UI cannot notice it and a player would just see two.
   * ------------------------------------------------------------------ */

  test("shop: every row names a group the shelf knows", () => {
    for (const upgradeId of engine.UPGRADE_IDS) {
      const group = engine.upgradeGroup(upgradeId);
      assert(
        engine.UPGRADE_GROUP_IDS.includes(group),
        `${upgradeId} is in ${group}, which is not one of the shelf's groups`
      );
    }
  });

  test("shop: each group's rows are contiguous, and the groups run in shelf order", () => {
    const runs = [];
    for (const upgradeId of engine.UPGRADE_IDS) {
      const group = engine.upgradeGroup(upgradeId);
      if (runs[runs.length - 1] !== group) runs.push(group);
    }
    assertEqual(
      runs.join(","),
      engine.UPGRADE_GROUP_IDS.join(","),
      "one run per group, in the order UPGRADE_GROUP_IDS names"
    );
  });

  // The one-off half is the last group and nothing else, which is what lets the "Automation"
  // heading replace the "One-off" divider that used to split the shelf.
  test("shop: the automation group holds every one-off and only one-offs", () => {
    for (const upgradeId of engine.UPGRADE_IDS) {
      const oneOff = !engine.UPGRADES[upgradeId].repeatable;
      assertEqual(
        engine.upgradeGroup(upgradeId) === "automation",
        oneOff,
        `${upgradeId}: a one-off is an automation and an automation is a one-off`
      );
    }
  });

  test("i18n: every group is headed in both locales", () => {
    for (const lang of ["de", "en"]) {
      for (const group of engine.UPGRADE_GROUP_IDS) {
        assert(
          engine.I18N[lang].shopGroupLabels[group],
          `${lang} is missing a heading for ${group}`
        );
      }
    }
  });

  /* ------------------------------------------------------------------ *
   * The two rows Fear alone cannot reach                                 *
   *                                                                      *
   * They used to be behind a completion gate - refused until every other row in the catalogue
   * was maxed. They are behind Presence now, which is a question asked of a different
   * currency, and the checks below are the ones that break if the two ever get confused.
   * ------------------------------------------------------------------ */

  const AUTOMATIONS = [
    "auto_boon", "auto_innate", "auto_bounty", "auto_flash_floods",
    "auto_wash_away", "auto_buy_abilities", "auto_start_round"
  ];

  // The rule that replaced two gates: nothing in the catalogue is locked. `auto_start_round` and
  // `auto_buy_abilities` sat behind a Presence row - and before that behind maxing every other
  // row - and both gates are gone, so a first cycle that saves the Fear can buy anything in the
  // shop including the two that idle the game.
  test("shop: every row in the catalogue is buyable on a fresh save", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;

    for (const upgradeId of engine.UPGRADE_IDS) {
      assert(engine.purchaseUpgrade(state, upgradeId), `${upgradeId} sells for Fear alone`);
      assert(engine.upgradeTier(state, upgradeId) > 0, `${upgradeId} is owned`);
    }
  });

  test("shop: the two that idle the game cost their catalogue price, with no Presence in hand", () => {
    const { state } = newGame();
    state.meta.fear = 700;

    assertEqual(engine.upgradeCost(state, "auto_start_round"), 500, "the milestone price");
    assertEqual(engine.upgradeCost(state, "auto_buy_abilities"), 200, "and the cheaper one");
    assert(engine.purchaseUpgrade(state, "auto_start_round"), "bought");
    assert(engine.purchaseUpgrade(state, "auto_buy_abilities"), "and bought");
    assertEqual(state.meta.fear, 0, "for exactly the 700 between them");
    assertEqual(state.meta.presence, 0, "and no Presence was ever involved");
  });

  // The other half of the same change: a Presence row hands its automations over, so they read
  // as owned with no Fear spent and the shop has nothing left to sell on those rows.
  test("shop: a granted automation is owned outright and refuses to be bought again", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;
    grantPresence(state, "presence_all_unbidden");

    for (const upgradeId of ["auto_boon", "auto_innate", "auto_bounty", "auto_flash_floods", "auto_wash_away"]) {
      assertEqual(engine.upgradeTier(state, upgradeId), 1, `${upgradeId} is granted`);
      assert(engine.upgradeGrantedForever(state, upgradeId), "and knows it was granted");
      assert(!engine.purchaseUpgrade(state, upgradeId), "so the shop refuses it");
    }
    assertEqual(state.meta.fear, 1e9, "no Fear changed hands");
    assertEqual(state.upgrades.purchased.auto_boon, undefined, "and nothing was written to the cycle's ledger");
  });

  test("shop: the three grants reach only the rows they name", () => {
    const { state } = newGame();
    grantPresence(state, "presence_tide_returns");

    assertEqual(engine.upgradeTier(state, "auto_start_round"), 1, "the one it names");
    for (const upgradeId of AUTOMATIONS) {
      if (upgradeId === "auto_start_round") continue;
      assertEqual(engine.upgradeTier(state, upgradeId), 0, `${upgradeId} is untouched`);
    }

    grantPresence(state, "presence_river_knows");
    assertEqual(engine.upgradeTier(state, "auto_buy_abilities"), 1, "and the second names one more");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 0, "the five still wait on their own row");
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
