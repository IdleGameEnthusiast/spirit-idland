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

  /* ---------- The automation grants ---------- */

  /* The mechanism that replaced the discount ladders: a Presence row hands its automations over
   * outright and forever, instead of walking their Fear price down a rung at a time.
   *
   * Why they went is a number rather than a taste. Walking all seven ladders to the bottom cost
   * 515 Presence and saved 975 Fear a cycle, while *holding* 515 Presence is +515% Fear
   * generated for the rest of the run - which is ahead of the discount above ~190 Fear a cycle,
   * and the ascension gate will not open under 2500. They were dominated from the first moment
   * they could be bought.
   */

  test("ascension: a grant hands over every automation it names, for no Fear at all", () => {
    const { state } = newGame();
    state.meta.presence = 5;
    state.meta.fear = 0;

    assert(engine.purchasePresenceUpgrade(state, "presence_all_unbidden"), "5 Presence buys the row");
    assertEqual(state.meta.presence, 0, "and costs exactly 5");

    for (const id of engine.PRESENCE_UPGRADES.presence_all_unbidden.grants) {
      assertEqual(engine.upgradeTier(state, id), 1, `${id} is owned`);
      assert(engine.upgradeGrantedForever(state, id), `${id} is owned by grant, not by purchase`);
    }
    assertEqual(Object.keys(state.upgrades.purchased).length, 0, "the cycle's ledger is untouched");
    assertEqual(state.meta.cycleFearSpent, 0, "and no Fear was spent to get there");
  });

  // The whole point of the change, and the property the discount rows only ever approximated:
  // the automation itself is on the other side of the Reclaim, not merely a cheaper price for it.
  test("ascension: a granted automation survives the reclaim that wipes the shop", () => {
    const state = readyToAscend(2500);
    grantPresence(state, "presence_all_unbidden");
    state.meta.fear = 500;
    assert(engine.purchaseUpgrade(state, "auto_start_round"), "and a Fear row is bought this cycle too");

    engine.ascend(state);

    assertEqual(engine.upgradeTier(state, "auto_start_round"), 0, "what Fear bought is given back");
    for (const id of engine.PRESENCE_UPGRADES.presence_all_unbidden.grants) {
      assertEqual(engine.upgradeTier(state, id), 1, `${id} is still owned on the far side`);
    }
    assertEqual(state.upgrades.purchased.auto_boon, undefined, "though the wipe emptied the ledger");
  });

  // What that buys the player, stated as the thing they actually feel: the new cycle's first
  // round opens already automated, because the round snapshot reads the granted tiers.
  test("ascension: the new cycle's opening round runs on the grants", () => {
    const state = readyToAscend(2500);
    grantPresence(state, "presence_all_unbidden");
    grantPresence(state, "presence_tide_returns");
    grantPresence(state, "presence_river_knows");

    engine.ascend(state);

    for (const id of ["auto_boon", "auto_innate", "auto_bounty", "auto_flash_floods",
                      "auto_wash_away", "auto_buy_abilities", "auto_start_round"]) {
      assertEqual(engine.activeUpgradeTier(state, id), 1, `${id} is live in the opening round`);
    }
  });

  // A Fear purchase and a grant of the same row must not stack into tier 2 - every automation is
  // a one-off, and `upgradeTier` answering 2 would put a rung on a ladder that has none.
  test("ascension: buying an automation the grant already covers changes nothing", () => {
    const { state } = newGame();
    grantPresence(state, "presence_all_unbidden");
    state.meta.fear = 1000;

    assert(!engine.purchaseUpgrade(state, "auto_boon"), "the shop has nothing to sell there");
    assertEqual(engine.upgradeTier(state, "auto_boon"), 1, "still exactly one");
    assertEqual(state.meta.fear, 1000, "and the purse is untouched");
  });

  // The total, pinned because it is the figure the docs quote and the one a retune moves without
  // meaning to. 2 + 3 + 5 buys every automation in the game, forever.
  test("ascension: every automation in the game costs 10 Presence between them", () => {
    let total = 0;
    const granted = [];
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      const grants = engine.PRESENCE_UPGRADES[id].grants;
      if (!grants) continue;
      total += engine.PRESENCE_UPGRADES[id].cost;
      granted.push(...grants);
    }
    assertEqual(total, 10, "the three grant rows cost 10 Presence together");
    assertEqual(granted.length, 7, "and cover all seven automations");
  });

  /* Structural, and the pair of checks that break first if a row is ever renamed or moved: every
   * id a `grants` list names must be a real, non-repeatable Fear row, no automation may be
   * granted by two rows, and the reverse map must agree with the forward one. `upgradeTier`
   * answers 1 for a granted row, so a `grants` entry pointing at a ladder would silently cap it.
   */
  test("ascension: every grant names a real one-off Fear row, and no row twice", () => {
    const seen = {};
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      for (const target of engine.PRESENCE_UPGRADES[id].grants || []) {
        assert(engine.UPGRADES[target], `${id} grants ${target}, which is not in the catalogue`);
        assert(!engine.UPGRADES[target].repeatable, `${target} is repeatable, so a grant cannot express it`);
        assertEqual(engine.upgradeMaxTier(target), 1, `${target} must have exactly one tier to grant`);
        assertEqual(seen[target], undefined, `${target} is granted by ${seen[target]} as well as ${id}`);
        seen[target] = id;
        assertEqual(engine.PRESENCE_GRANT_BY_UPGRADE[target], id, `${target} must map back to ${id}`);
      }
    }
    assertEqual(Object.keys(engine.PRESENCE_GRANT_BY_UPGRADE).length, Object.keys(seen).length, "the reverse map has no strays");
  });

  test("ascension: the row that grants nothing still buys its capability", () => {
    const { state } = newGame();
    assertEqual(engine.PRESENCE_UPGRADES.presence_current_quickens.grants, undefined, "no Fear row for Focus");
    assert(!engine.abilityFocusUnlocked(state), "unbought, Focus reads as locked");
    grantPresence(state, "presence_current_quickens");
    assert(engine.abilityFocusUnlocked(state), "and bought, it reads as open");
  });

  /* ---------- What a save carrying the deleted rows gets back ---------- */

  /* The seven discount rows are gone from the registry, so the loader drops them like any other
   * unknown id. Dropping them silently would pocket up to 515 Presence a player had spent, so
   * normalizeState prices the rungs at what they cost and pays them back into the purse.
   */
  test("ascension: a save loses the deleted discount rows and is paid back for them", () => {
    const loaded = engine.normalizeState({
      meta: { presence: 4 },
      presenceUpgrades: {
        purchased: {
          presence_flood_remembered: 5,
          presence_boon_remembered: 1,
          presence_tide_returns: 1
        }
      }
    });

    assertEqual(loaded.presenceUpgrades.purchased.presence_flood_remembered, undefined, "the dead row is gone");
    assertEqual(loaded.presenceUpgrades.purchased.presence_boon_remembered, undefined, "and so is the other");
    assertEqual(loaded.presenceUpgrades.purchased.presence_tide_returns, 1, "the live row is kept");
    // 5 + 10 + 25 + 50 + 100 for the five-rung row, 5 for the one-rung row, on top of the 4 held.
    assertEqual(loaded.meta.presence, 4 + 190 + 5, "and every Presence spent on them comes back");
  });

  test("ascension: the refund is not paid twice, and an untouched save is not paid at all", () => {
    const once = engine.normalizeState({
      meta: { presence: 0 },
      presenceUpgrades: { purchased: { presence_boon_remembered: 1 } }
    });
    assertEqual(once.meta.presence, 5, "paid on the load that drops the row");

    const twice = engine.normalizeState(once);
    assertEqual(twice.meta.presence, 5, "and not again on the next load");

    const clean = engine.normalizeState({ meta: { presence: 7 } });
    assertEqual(clean.meta.presence, 7, "a save that never had one is untouched");
  });

  test("ascension: a save carrying a rung no row has any more is clamped to one", () => {
    const loaded = engine.normalizeState({
      presenceUpgrades: { purchased: { presence_tide_returns: 4, presence_all_unbidden: 99 } }
    });
    assertEqual(engine.presenceUpgradeTier(loaded, "presence_tide_returns"), 1, "every row is one rung now");
    assertEqual(engine.presenceUpgradeTier(loaded, "presence_all_unbidden"), 1, "including the grant of five");
    assertEqual(engine.upgradeTier(loaded, "auto_boon"), 1, "which still grants exactly once");
  });

  /* ---------- The two-key rule, end to end ---------- */

  // The property the whole layer rests on, and the one that breaks first if the wipe ever
  // learns about `presenceUpgrades`: Fear buys for a cycle, Presence buys for the run.
  test("ascension: what Fear bought is given back and what Presence bought is not", () => {
    const state = readyToAscend(2500);
    state.meta.fear = 500;

    assert(engine.purchaseUpgrade(state, "auto_start_round"), "bought with Fear this cycle");
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 1, "and owned");

    engine.ascend(state);

    assertEqual(engine.upgradeTier(state, "auto_start_round"), 0, "the automation is gone");
    assertEqual(engine.upgradeCost(state, "auto_start_round"), 500, "at its full price again");

    // The same row, bought the other way, is on the far side of the next Reclaim.
    grantPresence(state, "presence_tide_returns");
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 1, "Presence owns it outright");
    state.meta.cycleFearGenerated = 2500;
    state.round.status = "ended";
    engine.ascend(state);
    assertEqual(engine.upgradeTier(state, "auto_start_round"), 1, "and keeps owning it through the wipe");
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

  /* The loader used to hand a save the Presence row that opened an automation it had already
   * bought with Fear, because putting the row behind Presence would otherwise have confiscated
   * the purchase. There is no lock left to grandfather around, so the save keeps its Fear
   * purchase and nothing is invented for it - and, in particular, an automation owned this
   * cycle must NOT be mistaken for one owned forever, or the next Reclaim would fail to take
   * back what Fear bought.
   */
  test("ascension: a save owning the old automations keeps them without gaining a Presence row", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      upgrades: { purchased: { auto_start_round: 1, auto_buy_abilities: 1 } }
    });

    assertEqual(loaded.upgrades.purchased.auto_start_round, 1, "the Fear purchase is kept");
    assertEqual(loaded.upgrades.purchased.auto_buy_abilities, 1, "both of them");
    assertDeepEqual(loaded.presenceUpgrades.purchased, {}, "and no Presence row is invented");
    assert(!engine.upgradeGrantedForever(loaded, "auto_start_round"), "so it is owned for the cycle, not the run");
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

  // Every Presence row must do one of the two things the catalogue knows how to do, or it is a
  // purchase nothing in the game reacts to. Granting is checked above ("every grant names a real
  // one-off Fear row"); this is the check that no row does neither.
  test("ascension: every Presence row either grants Fear rows or gates a capability", () => {
    for (const id of engine.PRESENCE_UPGRADE_IDS) {
      const grants = engine.PRESENCE_UPGRADES[id].grants;
      if (grants) {
        assert(grants.length > 0, `${id} carries an empty grant list`);
        continue;
      }
      assertEqual(id, "presence_current_quickens", `${id} grants nothing and gates nothing`);
    }
  });
})();
