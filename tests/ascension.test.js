/* Ascension and the Presence layer - docs/spec/08-acceptance-tests.md#ascension-checks
 *
 * The whole layer rests on one sentence: Fear buys, and Presence decides what Fear is allowed
 * to buy. Most of what is checked here is that the two never learn about each other's storage -
 * the wipe clears `upgrades.purchased` whole and must never look at `presenceUpgrades`, and the
 * payout reads the cycle ledger and must never look at the bank. */

(function () {
  const { engine, test, assert, assertEqual, assertDeepEqual, newGame, grantUpgrade, grantPresence } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const UNLOCK_PRESENCE = engine.ASCENSION_UNLOCK_PRESENCE;
  // The same gate in the unit the ledger keeps. The payout is a root over the divisor, so the
  // smallest cycle that opens the door has generated UNLOCK_PRESENCE^2 divisors of Fear - 2500
  // at the constants as they stand.
  const UNLOCK_FEAR = UNLOCK_PRESENCE * UNLOCK_PRESENCE * engine.PRESENCE_FEAR_DIVISOR;
  // Deep, and nothing gates on it: the wave figures are here only so the checks on what a
  // Reclaim keeps and clears have something to watch.
  const DEEP_WAVE = 50;

  // A save standing where a Reclaim is legal: a cycle that has generated enough to pay the
  // unlock, and between rounds. `cycleFearGenerated` is written directly rather than played for
  // - every check below is about what happens to a cycle's total, not about how a round
  // produces one.
  function readyToAscend(generated) {
    const { state } = newGame();
    state.meta.bestWaveReached = DEEP_WAVE;
    state.meta.cycleBestWave = DEEP_WAVE;
    state.meta.cycleFearGenerated = generated === undefined ? UNLOCK_FEAR : generated;
    state.round.status = "ended";
    return state;
  }

  /* ---------- The unlock ---------- */

  test("ascension: a cycle short of the payout cannot reclaim, however deep the save is", () => {
    const { state } = newGame();
    state.round.status = "ended";
    state.meta.bestWaveReached = 500;
    state.meta.cycleFearGenerated = UNLOCK_FEAR - 1;

    assertEqual(engine.ascensionPayout(state), UNLOCK_PRESENCE - 1, "one Presence short");
    assert(!engine.ascensionUnlocked(state), "which is short");
    assert(!engine.canAscend(state), "and depth does not buy the way in");
    assert(!engine.ascend(state), "the call refuses");
    assertEqual(state.meta.presence, 0, "and pays nothing");
  });

  test("ascension: a running round cannot reclaim, however deep the save is", () => {
    const state = readyToAscend();
    state.round.status = "running";

    assert(engine.ascensionUnlocked(state), "the door is open");
    assert(!engine.canAscend(state), "but not mid-round");
    assert(!engine.ascend(state), "the call refuses");
    assertEqual(state.meta.ascensionCount, 0, "nothing happened");
  });

  // The gate is the payout, and the payout is per cycle - so every cycle earns its own way back
  // in. What that forbids is the free Reclaim at the top of a fresh cycle, which would hand back
  // a catalogue for nothing.
  test("ascension: the unlock is re-earned by every cycle", () => {
    const state = readyToAscend(UNLOCK_FEAR);
    assert(engine.ascend(state), "the first Reclaim lands");

    assertEqual(state.meta.cycleFearGenerated, 0, "the cycle's ledger is gone");
    assert(!engine.ascensionUnlocked(state), "and with it the way back in");

    state.round.status = "ended";
    assert(!engine.canAscend(state), "a cycle that has generated nothing may not Reclaim");

    state.meta.cycleFearGenerated = UNLOCK_FEAR;
    assert(engine.canAscend(state), "and the door opens again on a cycle worth as much");
  });

  /* ---------- The payout ---------- */

  test("ascension: the payout is the root of the cycle's generated Fear", () => {
    const cases = [[0, 0], [99, 0], [100, 1], [2500, 5], [10000, 10], [40000, 20]];
    for (const [generated, expected] of cases) {
      const state = readyToAscend(generated);
      assertEqual(engine.ascensionPayout(state), expected, `${generated} Fear should pay ${expected}`);
    }
  });

  /* The gap the panel prints under the payout. The property worth holding is that it is the
   * payout read forward and never disagrees with it: generating exactly what it asks for pays
   * one more Presence, and a single Fear less does not. The rungs grow apart as they go, which
   * is the whole reason the figure is printed at all.
   */
  test("ascension: the gap to the next Presence is what the payout still wants", () => {
    const cases = [[0, 100], [99, 1], [100, 300], [2500, 1100], [10000, 2100]];
    for (const [generated, expected] of cases) {
      const state = readyToAscend(generated);
      assertEqual(engine.fearToNextPresence(state), expected, `${generated} Fear is ${expected} short`);
    }

    const state = readyToAscend(2500);
    const short = engine.fearToNextPresence(state) - 1;
    state.meta.cycleFearGenerated += short;
    assertEqual(engine.ascensionPayout(state), 5, "one Fear short pays no more");
    state.meta.cycleFearGenerated += 1;
    assertEqual(engine.ascensionPayout(state), 6, "and the Fear it asked for pays one more");
  });

  // Spending must never cost Presence, or the shop and this panel would want opposite things
  // from the player and hoarding would be the optimal line.
  test("ascension: an empty bank pays exactly what a full one does", () => {
    const spent = readyToAscend(2500);
    spent.meta.fear = 0;
    const hoarded = readyToAscend(2500);
    hoarded.meta.fear = 2500;

    assertEqual(engine.ascensionPayout(spent), 5, "spent it all");
    assertEqual(engine.ascensionPayout(hoarded), 5, "spent none of it");
  });

  // The other half of why the ledger splits granted from generated: a tool for looking at the
  // game must not be a way of progressing through it.
  test("ascension: granted Fear mints no Presence, and opens no door", () => {
    const state = readyToAscend(0);
    state.meta.cycleFearGranted = 1e6;
    state.meta.fear = 1e6;

    assertEqual(engine.ascensionPayout(state), 0, "a purse full of grants is worth nothing here");
    // The unlock reads the payout, so the grant cannot buy its way past the gate either - which
    // it could when the gate read the best wave and the tool could carry a save to it.
    assert(!engine.ascensionUnlocked(state), "so it does not reach the unlock");
    assert(!engine.ascend(state), "and the Reclaim is refused");
    assertEqual(state.meta.presence, 0, "paying nothing");
  });

  /* ---------- What it clears, and what it does not ---------- */

  test("ascension: reclaiming clears the cycle and nothing above it", () => {
    const state = readyToAscend(2500);
    state.meta.fear = 900;
    state.meta.cycleFearGranted = 100;
    state.meta.cycleFearSpent = 1700;
    state.meta.presence = 4;
    state.meta.ascensionCount = 2;
    state.round.number = 37;
    grantUpgrade(state, "rising_dread", 6);
    grantUpgrade(state, "dahan_reinforcement", 3);
    grantPresence(state, "presence_tide_returns");

    assert(engine.ascend(state), "the Reclaim lands");

    assertEqual(state.meta.fear, 0, "the bank is emptied");
    assertDeepEqual(state.upgrades.purchased, {}, "and the catalogue with it");
    assertEqual(state.meta.cycleFearGenerated, 0, "generated resets");
    assertEqual(state.meta.cycleFearGranted, 0, "granted resets");
    assertEqual(state.meta.cycleFearSpent, 0, "spent resets");
    assertEqual(state.meta.cycleBestWave, 0, "and the cycle's depth resets");
    assertEqual(state.round.number, 1, "a new age counts from one");

    assertEqual(state.meta.presence, 9, "4 held plus the 5 it paid");
    assertEqual(state.meta.ascensionCount, 3, "one more Reclaim on the record");
    assertEqual(state.meta.bestWaveReached, DEEP_WAVE, "the all-time record is untouched");
    assertEqual(state.presenceUpgrades.purchased.presence_tide_returns, 1, "Presence keeps what it bought");
  });

  test("ascension: the new cycle opens on the baseline of an empty catalogue", () => {
    const state = readyToAscend(2500);
    grantUpgrade(state, "dahan_reinforcement", 8);
    grantUpgrade(state, "blight_resilience", 5);
    grantUpgrade(state, "headwaters", 9);

    engine.ascend(state);

    assertEqual(state.round.status, "running", "a round is already under way");
    assertEqual(state.round.blightThreshold, engine.BLIGHT_THRESHOLD_BASE, "no resilience left");
    assertEqual(state.resources.energy, 0, "and no headwaters");
    const dahan = Object.values(state.dahan).reduce((sum, n) => sum + n, 0);
    assertEqual(dahan, engine.DAHAN_PER_ROUND_START_BASE, "six Dahan, as at the very start");
  });

  // The closing move startNextRound makes too: the button just pressed is the click that
  // starts the round, so a player with auto-proceed off does not land on a held gate the
  // instant after a two-click confirm.
  test("ascension: the new cycle opens running, not behind a wave gate", () => {
    const state = readyToAscend(2500);
    state.ui.autoProceed = false;

    engine.ascend(state);

    assertEqual(state.round.awaitingWave, false, "no gate to click through");
    assertEqual(state.round.status, "running", "and the clock is live");
  });

  // Preferences are not something the player earned, so taking them away is not part of the
  // price. The auto-cast switches matter most: the automations they switch have just been
  // un-bought, and re-buying one next cycle must find it in the state last chosen.
  test("ascension: every preference survives a reclaim", () => {
    const state = readyToAscend(2500);
    state.ui.language = "en";
    state.ui.gameSpeed = 2;
    state.ui.autoProceed = true;
    state.ui.autoStartRound = false;
    state.ui.autoCast.wash_away = false;
    state.ui.playtest = true;

    engine.ascend(state);

    assertEqual(state.ui.language, "en", "language");
    assertEqual(state.ui.gameSpeed, 2, "speed");
    assertEqual(state.ui.autoProceed, true, "auto-proceed");
    assertEqual(state.ui.autoStartRound, false, "auto-round");
    assertEqual(state.ui.autoCast.wash_away, false, "and the switch on an un-bought automation");
    assertEqual(state.ui.playtest, true, "the redeemed code too");
  });

  /* ---------- The Presence catalogue ---------- */

  test("ascension: a Presence row costs Presence and nothing else", () => {
    const { state } = newGame();
    state.meta.presence = 2;
    state.meta.fear = 1e9;

    assert(engine.purchasePresenceUpgrade(state, "presence_tide_returns"), "two buys the Tide");
    assertEqual(state.meta.presence, 0, "and takes both");
    assertEqual(state.meta.fear, 1e9, "the Fear purse is not touched");
    assertEqual(state.presenceUpgrades.purchased.presence_tide_returns, 1, "written on the Presence side");
    assertEqual(state.upgrades.purchased.presence_tide_returns, undefined, "never on the Fear side");
  });

  test("ascension: a Presence row the purse cannot cover is refused", () => {
    const { state } = newGame();
    state.meta.presence = 2;

    assert(!engine.purchasePresenceUpgrade(state, "presence_river_knows"), "three is more than two");
    assertEqual(state.meta.presence, 2, "and nothing changed hands");
    assert(!engine.presenceUpgradeOwned(state, "presence_river_knows"), "still unowned");
  });

  test("ascension: a Presence row is bought once", () => {
    const { state } = newGame();
    state.meta.presence = 10;

    assert(engine.purchasePresenceUpgrade(state, "presence_tide_returns"), "the first buy lands");
    assert(!engine.purchasePresenceUpgrade(state, "presence_tide_returns"), "the second is refused");
    assertEqual(state.meta.presence, 8, "and only paid for once");
  });

  // Only the two original rows: see the "first ascension reads as an unambiguous win" comment
  // above PRESENCE_UPGRADES. Every row added since is meant to be a real dilemma rather than a
  // freebie the first Reclaim covers alongside these two, so the sum stays pinned to the two
  // ids rather than to PRESENCE_UPGRADE_IDS as a whole - see the row below for the row that
  // proves the dilemma actually holds.
  test("ascension: the first reclaim pays for exactly both starter rows", () => {
    const { state: fresh } = newGame();
    const total = ["presence_tide_returns", "presence_river_knows"]
      .reduce((sum, id) => sum + engine.presenceUpgradeCost(fresh, id), 0);
    assertEqual(total, 5, "two plus three");

    const state = readyToAscend(2500);
    engine.ascend(state);
    assertEqual(state.meta.presence, total, "and a first Reclaim at 2500 pays exactly that");
  });

  test("ascension: Focus is not part of that first-Reclaim freebie", () => {
    const { state: fresh } = newGame();
    const total = engine.PRESENCE_UPGRADE_IDS
      .reduce((sum, id) => sum + engine.presenceUpgradeCost(fresh, id), 0);
    assert(total > 5, "a third row on top of the first two's 5 raises the full catalogue's cost");

    const state = readyToAscend(2500);
    engine.ascend(state);
    assert(state.meta.presence < total, "the first Reclaim alone cannot buy the whole catalogue");
    assert(!engine.presenceUpgradeOwned(state, "presence_current_quickens"), "Focus is still unbought");
  });

  /* ---------- The discount ladders ---------- */

  // The example the design was written from, walked rung by rung: The Flood Unbidden at 300 Fear
  // comes down 200 / 100 / 50 / 25 / 10 for 5 / 10 / 25 / 50 / 100 Presence.
  test("ascension: a discount row walks its automation down the shared price ladder", () => {
    const { state } = newGame();
    state.meta.presence = 1000;
    assertEqual(engine.upgradeCost(state, "auto_flash_floods"), 300, "full price to start");

    const prices = [200, 100, 50, 25, 10];
    const costs = [5, 10, 25, 50, 100];
    let purse = 1000;
    for (let i = 0; i < prices.length; i += 1) {
      assertEqual(engine.presenceUpgradeCost(state, "presence_flood_remembered"), costs[i], `rung ${i + 1} is priced`);
      assert(engine.purchasePresenceUpgrade(state, "presence_flood_remembered"), `rung ${i + 1} is bought`);
      purse -= costs[i];
      assertEqual(state.meta.presence, purse, `rung ${i + 1} took its Presence`);
      assertEqual(engine.upgradeCost(state, "auto_flash_floods"), prices[i], `rung ${i + 1} lands on ${prices[i]}`);
    }

    assert(engine.presenceUpgradeMaxed(state, "presence_flood_remembered"), "and the ladder is finished");
    assert(!engine.purchasePresenceUpgrade(state, "presence_flood_remembered"), "a sixth rung is refused");
    assertEqual(engine.upgradeCost(state, "auto_flash_floods"), 10, "the floor is 10, not 0");
  });

  // The split itself, which is the only thing the two ladders do that one did not: the top two
  // rows skip a rung on their first step - 500 to 300 rather than 400, 400 to 200 rather than
  // 300 - and so finish one rung shallower. Because PRESENCE_DISCOUNT_COSTS was cut at the end,
  // the rung each loses is its most expensive, which is where the 940 -> 440 and 440 -> 190
  // totals come from.
  test("ascension: the top two rows skip a rung on their first step and finish a rung sooner", () => {
    const walks = {
      presence_tide_remembered: {
        automation: "auto_start_round",
        prices: [300, 200, 100, 50, 25, 10],
        costs: [5, 10, 25, 50, 100, 250]
      },
      presence_current_remembered: {
        automation: "auto_wash_away",
        prices: [200, 100, 50, 25, 10],
        costs: [5, 10, 25, 50, 100]
      }
    };

    for (const [presenceId, walk] of Object.entries(walks)) {
      const { state } = newGame();
      state.meta.presence = 1000;
      let spent = 0;
      for (let i = 0; i < walk.prices.length; i += 1) {
        assertEqual(engine.presenceUpgradeCost(state, presenceId), walk.costs[i], `${presenceId} rung ${i + 1} is priced`);
        assert(engine.purchasePresenceUpgrade(state, presenceId), `${presenceId} rung ${i + 1} is bought`);
        spent += walk.costs[i];
        assertEqual(engine.upgradeCost(state, walk.automation), walk.prices[i], `${walk.automation} lands on ${walk.prices[i]}`);
      }
      assert(engine.presenceUpgradeMaxed(state, presenceId), `${presenceId} is finished`);
      assertEqual(state.meta.presence, 1000 - spent, `${presenceId} cost ${spent} Presence in all`);
    }
  });

  // The number the softening is actually about: the whole set of seven, which the single ladder
  // priced at 1,795 Presence. Pinned here because it is the figure 04-economy-formulas.md quotes
  // and the one a re-balance is most likely to move without meaning to.
  test("ascension: the whole discount set costs 1,045 Presence", () => {
    let total = 0;
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      if (!engine.PRESENCE_UPGRADES[id].discounts) continue;
      const rungs = engine.presenceUpgradeMaxTier(id);
      for (let i = 0; i < rungs; i += 1) total += engine.PRESENCE_DISCOUNT_COSTS[i];
    }
    assertEqual(total, 1045, "all seven discount rows cost 1,045 Presence together");
  });

  // Where each ladder starts is read off the automation's own price, so the row count is the
  // Fear catalogue's business rather than a number written twice.
  test("ascension: every discount row has as many rungs as its automation has price left", () => {
    const expected = {
      presence_boon_remembered: 1,
      presence_instinct_remembered: 3,
      presence_bounty_remembered: 4,
      presence_flood_remembered: 5,
      presence_current_remembered: 5,
      presence_need_remembered: 4,
      presence_tide_remembered: 6
    };
    for (const [id, rungs] of Object.entries(expected)) {
      assertEqual(engine.presenceUpgradeMaxTier(id), rungs, `${id} has ${rungs} rungs`);
      assert(engine.PRESENCE_DISCOUNT_COSTS.length >= rungs, `${id} has a price for every rung`);
    }
  });

  // Structural, and the thing that breaks first if an automation is ever repriced: a discount row
  // whose target sits off both ladders would silently have no rungs at all.
  test("ascension: every discounted automation is priced on one of the two ladders", () => {
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      const target = engine.PRESENCE_UPGRADES[id].discounts;
      if (!target) continue;
      assert(engine.UPGRADES[target], `${id} discounts ${target}, which is not in the catalogue`);
      assert(
        engine.automationLadder(engine.UPGRADES[target].baseCost),
        `${target} costs ${engine.UPGRADES[target].baseCost}, which is a rung of neither ladder`
      );
      assertEqual(engine.PRESENCE_DISCOUNT_BY_UPGRADE[target], id, `${target} must map back to ${id}`);
    }
  });

  // The point of the row: the discount is bought once with Presence and the Fear price stays
  // lowered on the other side of a Reclaim, which is what makes it a meta purchase rather than a
  // cheaper checkout this cycle.
  test("ascension: a discount survives the reclaim that wipes the automation it discounts", () => {
    const state = readyToAscend(2500);
    grantPresence(state, "presence_tide_returns");
    grantPresence(state, "presence_tide_remembered", 3);
    assertEqual(engine.upgradeCost(state, "auto_start_round"), 100, "three rungs off 500");

    state.meta.fear = 100;
    assert(engine.purchaseUpgrade(state, "auto_start_round"), "and 100 Fear buys it this cycle");
    assertEqual(state.meta.fear, 0, "at the discounted price, not the catalogue one");

    engine.ascend(state);
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 0, "the automation is given back");
    assertEqual(engine.presenceUpgradeTier(state, "presence_tide_remembered"), 3, "the discount is not");
    assertEqual(engine.upgradeCost(state, "auto_start_round"), 100, "so next cycle re-buys it at 100");
  });

  // A discount is not permission. The Presence-locked rows stay locked at any price, which is the
  // two-key rule holding across a row that now has two Presence rows pointed at it.
  test("ascension: a discounted row is still locked until its unlock is bought", () => {
    const { state } = newGame();
    grantPresence(state, "presence_tide_remembered", 6);
    state.meta.fear = 1e6;

    assertEqual(engine.upgradeCost(state, "auto_start_round"), 10, "cheap as it goes");
    assert(!engine.purchaseUpgrade(state, "auto_start_round"), "and still refused");
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 0, "nothing bought");
    assertEqual(state.meta.fear, 1e6, "and nothing spent");
  });

  test("ascension: a save carrying a rung the ladder no longer has is clamped to the top", () => {
    const { state } = newGame();
    const loaded = engine.normalizeState({
      presenceUpgrades: { purchased: { presence_boon_remembered: 99, presence_tide_returns: 4 } }
    });
    assertEqual(engine.presenceUpgradeTier(loaded, "presence_boon_remembered"), 1, "one rung is all it has");
    assertEqual(engine.presenceUpgradeTier(loaded, "presence_tide_returns"), 1, "a flat row stays flat");
    assertEqual(engine.upgradeCost(loaded, "auto_boon"), 10, "and is priced as the rung it now is");
    assertEqual(engine.upgradeCost(state, "auto_boon"), 25, "an untouched save is unaffected");
  });

  /* ---------- The two-key rule, end to end ---------- */

  // The property the whole layer rests on, and the one that breaks first if the wipe ever
  // learns about `presenceUpgrades`: the permission survives, the purchase does not.
  test("ascension: the unlock survives a reclaim and the Fear purchase does not", () => {
    const state = readyToAscend(2500);
    grantPresence(state, "presence_tide_returns");
    state.meta.fear = 500;

    assert(engine.purchaseUpgrade(state, "auto_start_round"), "bought with Fear this cycle");
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 1, "and owned");

    engine.ascend(state);

    assertEqual(engine.upgradeTier(state, "auto_start_round"), 0, "the automation is gone");
    assert(engine.presenceUpgradeOwned(state, "presence_tide_returns"), "the permission is not");
    assert(!engine.upgradeNeedsPresence(state, "auto_start_round"), "so the row is still in the shop");

    state.meta.fear = 500;
    assert(engine.purchaseUpgrade(state, "auto_start_round"), "and owed its Fear price again");
  });

  /* ---------- The two high scores ---------- */

  test("ascension: one wave count writes two records, and only one is cleared", () => {
    const { state } = newGame();
    state.round.wavesResolved = 60;
    engine.endRound(state);

    assertEqual(state.meta.bestWaveReached, 60, "all-time");
    assertEqual(state.meta.cycleBestWave, 60, "and this cycle");

    state.meta.cycleFearGenerated = 2500;
    engine.ascend(state);
    assertEqual(state.meta.bestWaveReached, 60, "the run remembers");
    assertEqual(state.meta.cycleBestWave, 0, "the cycle does not");

    state.round.wavesResolved = 20;
    engine.endRound(state);
    assertEqual(state.meta.cycleBestWave, 20, "the new cycle's best is its own");
    assertEqual(state.meta.bestWaveReached, 60, "and the all-time record does not fall to it");
  });

  /* ---------- Normalization and grandfathering ---------- */

  test("ascension: a save from before the layer loads with none of it", () => {
    const loaded = engine.normalizeState({ schemaVersion: engine.VERSION, meta: { fear: 40 } });

    assertEqual(loaded.meta.presence, 0, "no Presence");
    assertEqual(loaded.meta.ascensionCount, 0, "no ascensions");
    assertEqual(loaded.meta.cycleBestWave, 0, "no cycle best");
    assertDeepEqual(loaded.presenceUpgrades.purchased, {}, "and an empty Presence catalogue");
  });

  // The change put two rows that were bought with Fear behind a currency the save has none of.
  // Taking the purchase back would be the change punishing the player for having made it.
  test("ascension: a save owning the old automations is granted their Presence rows", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      upgrades: { purchased: { auto_start_round: 1, auto_buy_abilities: 1 } }
    });

    assertEqual(loaded.presenceUpgrades.purchased.presence_tide_returns, 1, "the Tide is granted");
    assertEqual(loaded.presenceUpgrades.purchased.presence_river_knows, 1, "and the River");
    assertEqual(loaded.upgrades.purchased.auto_start_round, 1, "the Fear purchase is kept too");
  });

  test("ascension: the grandfather grant does not pay twice", () => {
    const once = engine.normalizeState({
      schemaVersion: engine.VERSION,
      upgrades: { purchased: { auto_start_round: 1 } }
    });
    const twice = engine.normalizeState(once);

    assertEqual(twice.presenceUpgrades.purchased.presence_tide_returns, 1, "a set, not an increment");
    assertEqual(twice.meta.presence, 0, "and no Presence was minted on the way past");
  });

  test("ascension: an unknown Presence id is dropped rather than carried", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      presenceUpgrades: { purchased: { presence_tide_returns: 1, presence_nonsense: 4 } }
    });

    assertEqual(loaded.presenceUpgrades.purchased.presence_tide_returns, 1, "the real one stays");
    assertEqual(loaded.presenceUpgrades.purchased.presence_nonsense, undefined, "the invented one goes");
  });

  test("ascension: every Presence row has a name and a text in both languages", () => {
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      for (const lang of ["de", "en"]) {
        assert(engine.I18N[lang].presenceNames[id], `${lang} is missing a name for ${id}`);
        assert(engine.I18N[lang].presenceTexts[id], `${lang} is missing a text for ${id}`);
      }
    }
  });

  // Structural: a Presence row that names a Fear row must have that row name it back, or it
  // would be a dead purchase the shop never reacts to. `presence_current_quickens` carries no
  // `unlocks` at all - see the block comment above PRESENCE_UPGRADES - so it is checked instead
  // for the thing a direct-unlock row must have in its place: something abilityFocusUnlocked
  // actually reads.
  test("ascension: every Presence row either unlocks a Fear row that names it back, or gates a capability directly", () => {
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      const unlocks = engine.PRESENCE_UPGRADES[id].unlocks;
      if (!unlocks) continue;
      assert(engine.UPGRADES[unlocks], `${id} unlocks ${unlocks}, which is not in the catalogue`);
      assertEqual(engine.upgradePresenceUnlock(unlocks), id, `${unlocks} must name ${id} back`);
    }

    assertEqual(engine.PRESENCE_UPGRADES.presence_current_quickens.unlocks, undefined, "no Fear row for Focus");
    const { state } = newGame();
    assert(!engine.abilityFocusUnlocked(state), "unbought, Focus reads as locked");
    grantPresence(state, "presence_current_quickens");
    assert(engine.abilityFocusUnlocked(state), "and bought, it reads as open");
  });
})();
