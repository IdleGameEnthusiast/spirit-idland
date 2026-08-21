/* The Dahan Remember: the Fear pool and the strike clock it shortens.
 *
 * Two halves that meet in one place. The pool is a shop row bought by the handful instead of
 * by the rung (docs/spec/04-economy-formulas.md), and the haste is a divisor on the Dahan's
 * own timer (docs/spec/02-core-loop.md). What joins them is that the invested Fear *is* the
 * tier, so everything the shop already knew how to do - save it, cap it, sink it into the
 * sold-out half - it does here unchanged. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, clearBoard, setLand, healthOf, grantUpgrade, grantPresence, memoryStorage } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const FULL = engine.DAHAN_HASTE_FEAR_FOR_FULL;
  const BASE = engine.DAHAN_ATTACK_INTERVAL_SECONDS;

  /* ---------- The formula ---------- */

  test("haste: an empty pool leaves the strike clock exactly where it was", () => {
    assertEqual(engine.dahanHasteFraction(0), 0, "no Fear, no haste");
    assertEqual(engine.dahanAttackIntervalFor(0), BASE, "and the base interval untouched");
  });

  test("haste: 100 Fear buys 1%, at the bottom of the pool and near the top of it", () => {
    assertClose(engine.dahanHasteFraction(100), 0.01, 1e-9, "the first hundred");
    assertClose(engine.dahanHasteFraction(9900), 0.99, 1e-9, "and the last hundred, at the same rate");
    // The whole point of a linear sink: the hundredth 100 Fear buys what the first one did.
    assertClose(
      engine.dahanHasteFraction(5000) - engine.dahanHasteFraction(4900),
      engine.dahanHasteFraction(100) - engine.dahanHasteFraction(0),
      1e-9,
      "no curve anywhere in it"
    );
  });

  test("haste: a full pool strikes twice as often, not infinitely often", () => {
    assertEqual(engine.dahanHasteFraction(FULL), engine.DAHAN_HASTE_MAX, "the cap is reached exactly at the full pool");
    assertClose(engine.dahanAttackIntervalFor(FULL), BASE / 2, 1e-9, "100% haste halves the interval");
    // Division, not subtraction - see the note above DAHAN_HASTE_FEAR_FOR_FULL. A subtractive
    // rule at 100% would be a zero-second clock and an infinite loop in the tick.
    assert(engine.dahanAttackIntervalFor(FULL) > 0, "and no amount of haste reaches zero");
  });

  test("haste: the cap holds above the full pool", () => {
    assertEqual(engine.dahanHasteFraction(FULL * 3), engine.DAHAN_HASTE_MAX, "a doctored save buys nothing extra");
    assertClose(engine.dahanAttackIntervalFor(FULL * 3), BASE / 2, 1e-9, "the interval stops at half");
  });

  test("haste: the pool cannot be bought past its cap", () => {
    const { state } = newGame();
    assertEqual(engine.upgradeMaxTier(state, "dahan_remember"), FULL, "the top tier is the full pool");
    state.meta.fear = FULL * 2;

    assert(engine.purchaseUpgrade(state, "dahan_remember", FULL), "the whole pool in one go");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "and it lands full");
    assert(!engine.purchaseUpgrade(state, "dahan_remember", 1), "one Fear more is refused");
    assertEqual(state.meta.fear, FULL, "and nothing is taken for the refusal");
  });

  /* ---------- Buying into it ---------- */

  test("haste: every unit of the pool costs the same one Fear", () => {
    const { state } = newGame();
    assertEqual(engine.upgradeCostGrowth("dahan_remember"), 1, "a pool has no cost curve");
    assertEqual(engine.upgradeCost(state, "dahan_remember"), 1, "the first unit costs 1");

    grantUpgrade(state, "dahan_remember", 4000);
    assertEqual(engine.upgradeCost(state, "dahan_remember"), 1, "and so does the four-thousandth");
    assertEqual(engine.upgradeCostFor(state, "dahan_remember", 1000), 1000, "a thousand of them cost a thousand");
  });

  test("haste: a bulk buy spends exactly what the same clicks would have", () => {
    const { state } = newGame();
    state.meta.fear = 500;

    assert(engine.purchaseUpgrade(state, "dahan_remember", 100), "+100 goes through");
    assertEqual(state.meta.fear, 400, "and takes 100 Fear");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), 100, "for 100 units of pool");
    assertClose(engine.dahanHasteFraction(engine.upgradeTier(state, "dahan_remember")), 0.01, 1e-9, "which is the 1%");
  });

  test("haste: a bulk buy larger than the pool has room for takes only what is left", () => {
    const { state } = newGame();
    grantUpgrade(state, "dahan_remember", FULL - 400);
    state.meta.fear = 5000;

    assert(engine.purchaseUpgrade(state, "dahan_remember", 1000), "the last +1000 finishes the pool");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "which is full, not overfull");
    assertEqual(state.meta.fear, 4600, "and it was charged for 400, not for 1000");
  });

  test("haste: a bulk buy the purse cannot cover is refused whole, never part-paid", () => {
    const { state } = newGame();
    state.meta.fear = 99;

    assert(!engine.purchaseUpgrade(state, "dahan_remember", 100), "+100 on 99 Fear is refused");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), 0, "nothing bought");
    assertEqual(state.meta.fear, 99, "and nothing spent - the max button is how you say 'as much as I can'");
  });

  test("haste: the max button is capped by the purse and by what is left of the pool", () => {
    const { state } = newGame();
    state.meta.fear = 250;
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 250, "250 Fear buys 250 units");

    grantUpgrade(state, "dahan_remember", FULL - 30);
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 30, "with 30 left, the purse is not the limit");

    grantUpgrade(state, "dahan_remember", FULL);
    assertEqual(engine.upgradeTiersAffordable(state, "dahan_remember"), 0, "and a full pool takes nothing");
  });

  test("haste: the ladders still count what they cost, one rung at a time", () => {
    const { state } = newGame();
    // The bulk path is general, so the rows that never use it must still price as they did:
    // three rungs of a 1.6 curve are the three individual prices summed, not a rounded total.
    const one = engine.upgradeCost(state, "dahan_reinforcement");
    grantUpgrade(state, "dahan_reinforcement", 1);
    const two = engine.upgradeCost(state, "dahan_reinforcement");
    grantUpgrade(state, "dahan_reinforcement", 2);
    const three = engine.upgradeCost(state, "dahan_reinforcement");

    state.upgrades.purchased.dahan_reinforcement = 0;
    assertEqual(engine.upgradeCostFor(state, "dahan_reinforcement", 3), one + two + three, "no discount, no tax");
  });

  test("haste: purchaseUpgrade still buys exactly one rung when nobody asks for more", () => {
    const { state } = newGame();
    state.meta.fear = 1000;
    assert(engine.purchaseUpgrade(state, "dahan_reinforcement"), "the old call shape");
    assertEqual(engine.upgradeTier(state, "dahan_reinforcement"), 1, "buys one, as it always did");
  });

  /* ---------- The pool is behind nothing ---------- */

  // It used to carry `requiredForGate: false`, because 10000 Fear standing between the player
  // and the last two purchases was a wall rather than a gate. There is no gate of any kind now.
  // This is the check that an empty pool leaves the two rows exactly as reachable as a full one
  // - which is to say entirely, at their catalogue price, in either state.
  test("haste: the pool does not stand in front of anything", () => {
    const { state } = newGame();
    state.meta.fear = 1e9;

    for (const id of ["auto_start_round", "auto_buy_abilities"]) {
      assert(engine.purchaseUpgrade(state, id), `${id} is for sale with an empty pool`);
    }

    const other = newGame().state;
    other.meta.fear = 1e9;
    grantUpgrade(other, "dahan_remember", FULL);
    for (const id of ["auto_start_round", "auto_buy_abilities"]) {
      assertEqual(engine.upgradeCost(other, id), engine.UPGRADES[id].baseCost, `${id} is priced the same beside a full pool`);
      assert(engine.purchaseUpgrade(other, id), `${id} is no less for sale with a full one`);
    }
  });

  /* ---------- What it does to the round ---------- */

  test("haste: a hasted round arms its strike clock short", () => {
    const ctx = newGame();
    grantUpgrade(ctx.state, "dahan_remember", FULL);
    engine.startRound(ctx.state);

    assertClose(ctx.state.round.dahanAttackRemaining, BASE / 2, 1e-9, "armed at the hasted interval");
    assertClose(engine.roundDahanAttackInterval(ctx.state), BASE / 2, 1e-9, "and refills to the same");
  });

  test("haste: a full pool strikes twice in the time an empty one strikes once", () => {
    /* Counted off the clock rather than off the board: the strike timer refills by one whole
     * interval every time it fires, so a rise in `dahanAttackRemaining` is a strike and
     * nothing else can cause one. Reading damage instead would have the count depend on what
     * the waves happened to put on the island and on whether the Dahan lived through it,
     * neither of which is what this test is about. */
    function strikesIn(invested, seconds) {
      const ctx = newGame();
      grantUpgrade(ctx.state, "dahan_remember", invested);
      engine.startRound(ctx.state);
      clearBoard(ctx.state);

      const step = 0.25;
      let strikes = 0;
      let last = ctx.state.round.dahanAttackRemaining;
      for (let elapsed = 0; elapsed < seconds; elapsed += step) {
        advance(ctx, step, step);
        const now = ctx.state.round.dahanAttackRemaining;
        if (now > last) strikes += 1;
        last = now;
      }
      assertEqual(ctx.state.round.status, "running", "the round lasted the whole measurement");
      return strikes;
    }

    const slow = strikesIn(0, BASE * 2);
    const fast = strikesIn(FULL, BASE * 2);
    assertEqual(slow, 2, "two base intervals is two strikes");
    assertEqual(fast, slow * 2, "and a full pool fits exactly twice as many into the same time");
  });

  test("haste: the round in progress never benefits from Fear poured in during it", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.startRound(state);
    state.meta.fear = FULL;

    assert(engine.purchaseUpgrade(state, "dahan_remember", FULL), "the pool is filled mid-round");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "and it is owned");
    assertClose(engine.roundDahanAttackInterval(state), BASE, 1e-9, "but this round strikes at the old rate");

    engine.startRound(state);
    assertClose(engine.roundDahanAttackInterval(state), BASE / 2, 1e-9, "the next one takes the snapshot");
  });

  /* ---------- What the shop says about it ---------- */

  test("haste: the row shows a percentage where a ladder shows its tier", () => {
    const { state } = newGame({ language: "en" });
    grantUpgrade(state, "dahan_remember", 4271);

    const status = engine.upgradeStatusText(state, "dahan_remember");
    assert(/42\.71/.test(status), `the chip reads the haste, not the tier: ${status}`);
    assert(!/4271/.test(status), `and never the raw unit count: ${status}`);
    assert(/Tier/i.test(engine.upgradeStatusText(state, "dahan_reinforcement")), "a ladder still shows its tier");
    assertEqual(engine.upgradeStatusText(state, "auto_boon"), "", "a one-off shows nothing");
  });

  test("haste: two decimals, because one Fear is a hundredth of a percent", () => {
    const { state } = newGame({ language: "en" });
    grantUpgrade(state, "dahan_remember", 1);
    const one = engine.upgradeStatusText(state, "dahan_remember");
    grantUpgrade(state, "dahan_remember", 10);
    const ten = engine.upgradeStatusText(state, "dahan_remember");

    assert(one !== ten, `the smallest purchases must not print the same number: ${one} / ${ten}`);
    grantUpgrade(state, "dahan_remember", 5000);
    assert(/50%/.test(engine.upgradeStatusText(state, "dahan_remember")), "and a round percentage keeps no trailing zeros");
  });

  test("haste: the row text quotes the clock the player is watching", () => {
    const { state } = newGame({ language: "en" });
    state.ui.gameSpeed = 1;
    grantUpgrade(state, "dahan_remember", FULL);

    const text = engine.upgradeText(state, "dahan_remember");
    // At 1x the base is 20 real seconds, so a full pool reads as 10.
    assert(/10/.test(text), `the full pool quotes its 10s: ${text}`);
    assert(/20/.test(text), `against the 20s it started from: ${text}`);
  });

  test("haste: the buy is logged as Fear in and haste out, not as a tier", () => {
    const { state } = newGame({ language: "en" });
    state.meta.fear = 250;
    engine.purchaseUpgrade(state, "dahan_remember", 250);

    const line = state._log[0] || "";
    assert(/250/.test(line), `the Fear it took: ${line}`);
    assert(/2\.5%/.test(line), `and where that leaves the haste: ${line}`);
    assert(!/tier/i.test(line), `and no tier anywhere in it: ${line}`);
  });

  test("haste: both locales name the pool and its buttons", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert(t.upgradeNames.dahan_remember, `${lang} names it`);
      assert(t.upgradeTexts.dahan_remember, `${lang} describes it`);
      assert(t.upgradeNextTexts.dahan_remember, `${lang} says where the pool stands`);
      assert(t.upgradeMaxedTexts.dahan_remember, `${lang} says when it is full`);
      assert(t.shopHasteLabel && t.shopInvestBtn && t.shopInvestMaxBtn, `${lang} has the pool's chrome`);
      assert(t.upgradeInvested, `${lang} logs the investment`);
    }
  });

  /* ---------- Across a save ---------- */

  test("haste: the pool survives a save, and a save from before it loads unhasted", () => {
    const storage = memoryStorage();
    const { state } = newGame();
    grantUpgrade(state, "dahan_remember", 3300);
    engine.saveState(state, storage);

    const loaded = engine.loadState(storage);
    assertEqual(engine.upgradeTier(loaded, "dahan_remember"), 3300, "the pool came back");
    assertClose(engine.dahanHasteFraction(engine.upgradeTier(loaded, "dahan_remember")), 0.33, 1e-9, "at the haste it bought");

    // A save written before the pool existed: no row, no snapshot entry, and the strike clock
    // has to read exactly as it did when that save was written.
    const old = engine.normalizeState({ round: { dahanAttackRemaining: 999 } });
    assertEqual(engine.upgradeTier(old, "dahan_remember"), 0, "no pool in an old save");
    assertClose(engine.roundDahanAttackInterval(old), BASE, 1e-9, "so it strikes at the base interval");
    assert(old.round.dahanAttackRemaining <= BASE, "and a nonsense remaining is clamped back into the interval");
  });

  /* ---------- The Dahan Find Their Strength ---------- *
   *
   * The claim on the other side of a full pool: +1 damage, the pool emptied, its ceiling
   * doubled, once per cycle. The arithmetic it rests on is in the note above
   * DAHAN_STRENGTH_DAMAGE, and the test that guards it is "the trade is free" below - if that
   * one ever has to be loosened, the feature is wrong rather than the test.
   */

  const STRENGTH_FULL = engine.DAHAN_STRENGTH_FEAR_FOR_FULL;

  // Throughput per Dahan, in damage a second. The one number the whole design is about,
  // computed the way the round actually spends it: damage per strike over the interval
  // between strikes.
  function throughput(state) {
    return engine.dahanAttackDamage(state) / engine.roundDahanAttackInterval(state);
  }

  function readyGame() {
    const { state } = newGame();
    grantPresence(state, "presence_dahan_endure");
    grantUpgrade(state, "dahan_remember", FULL);
    engine.endRound(state);
    return state;
  }

  test("strength: the claim is refused without the Presence row, however full the pool", () => {
    const { state } = newGame();
    grantUpgrade(state, "dahan_remember", FULL);
    engine.endRound(state);

    assert(!engine.dahanStrengthUnlocked(state), "the row is not owned");
    assert(!engine.canClaimDahanStrength(state), "so the claim is not offered");
    assert(!engine.claimDahanStrength(state), "and taking it anyway is refused");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), FULL, "the pool is not touched by a refusal");
    assertEqual(engine.dahanAttackDamage(state), engine.DAHAN_ATTACK_DAMAGE, "and the Dahan strike as they did");
  });

  test("strength: the claim is refused until the pool is actually full", () => {
    const { state } = newGame();
    grantPresence(state, "presence_dahan_endure");
    grantUpgrade(state, "dahan_remember", FULL - 1);
    engine.endRound(state);

    assert(!engine.canClaimDahanStrength(state), "one Fear short is short");
    assert(!engine.claimDahanStrength(state), "and refused");

    grantUpgrade(state, "dahan_remember", FULL);
    assert(engine.canClaimDahanStrength(state), "the last Fear opens it");
  });

  /* Between rounds only, and the reason is the round snapshot: the claim empties a row the
   * running round has already frozen and doubles a divisor it is still dividing by. See
   * canClaimDahanStrength. */
  test("strength: the claim is refused while a round is running", () => {
    const { state } = newGame();
    grantPresence(state, "presence_dahan_endure");
    grantUpgrade(state, "dahan_remember", FULL);

    assertEqual(state.round.status, "running", "a fresh game is mid-round");
    assert(engine.dahanStrengthPending(state), "the pool is full and the row is owned");
    assert(!engine.canClaimDahanStrength(state), "but not while the round is on");
    assert(!engine.claimDahanStrength(state), "and it is refused rather than queued");

    engine.endRound(state);
    assert(engine.canClaimDahanStrength(state), "the round ending is what opens it");
  });

  test("strength: claiming empties the pool, doubles its ceiling and doubles the damage", () => {
    const state = readyGame();
    assert(engine.claimDahanStrength(state), "the claim lands");

    assert(engine.dahanStrengthClaimed(state), "the flag is set");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), 0, "the pool is empty again");
    assertEqual(engine.upgradeMaxTier(state, "dahan_remember"), STRENGTH_FULL, "and twice as deep");
    assertEqual(engine.dahanAttackDamage(state), engine.DAHAN_STRENGTH_DAMAGE, "the Dahan strike for two");
    assertClose(engine.roundDahanAttackInterval(state), BASE, 1e-9, "on the interval they started with");
  });

  /* **The identity the whole feature rests on.** Throughput per Dahan is `damage * (1 + haste)`,
   * so a full first pool (1 x 2) and an empty second pool (2 x 1) are the same number. The
   * player gives up nothing at the moment of the trade and gets a pool with room in it.
   *
   * This is also the test that pins the design to *one* claim. A second would trade 2 x 2 for
   * 3 x 1 and fail here by a quarter - see the note above DAHAN_STRENGTH_DAMAGE for what would
   * have to change first. */
  test("strength: the trade is free in the moment it is taken", () => {
    const state = readyGame();
    const before = throughput(state);

    assert(engine.claimDahanStrength(state), "claimed");
    engine.startNextRound(state);

    assertClose(throughput(state), before, 1e-9, "exactly the same damage a second, either side of the claim");
  });

  test("strength: the second pool fills to 100% and stops there", () => {
    const state = readyGame();
    engine.claimDahanStrength(state);

    state.meta.fear = STRENGTH_FULL * 2;
    assert(engine.purchaseUpgrade(state, "dahan_remember", STRENGTH_FULL), "the whole second pool");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), STRENGTH_FULL, "which is twice the first");

    // The percentage is against the ceiling in play, which is what keeps DAHAN_HASTE_MAX
    // meaning what it says: a full second pool is 100%, not 200%.
    const full = engine.dahanHasteFearForFull(state);
    assertEqual(engine.dahanHasteFraction(STRENGTH_FULL, full), engine.DAHAN_HASTE_MAX, "and reads as full");
    assertClose(engine.roundDahanAttackInterval(state), BASE / 2, 1e-9, "at half the interval again");

    assert(!engine.purchaseUpgrade(state, "dahan_remember", 1), "one Fear more is refused");
  });

  test("strength: it can be claimed once and only once", () => {
    const state = readyGame();
    assert(engine.claimDahanStrength(state), "the first claim lands");

    state.meta.fear = STRENGTH_FULL;
    engine.purchaseUpgrade(state, "dahan_remember", STRENGTH_FULL);
    engine.endRound(state);

    assert(!engine.dahanStrengthPending(state), "a full second pool offers nothing further");
    assert(!engine.canClaimDahanStrength(state), "there is no second claim");
    assert(!engine.claimDahanStrength(state), "and asking for one is refused");
    assertEqual(engine.upgradeTier(state, "dahan_remember"), STRENGTH_FULL, "the second pool is not emptied by the refusal");
    assertEqual(engine.dahanAttackDamage(state), engine.DAHAN_STRENGTH_DAMAGE, "and the damage does not climb again");
  });

  /* The row has no rung left to sell and still has the claim, so it must not sink into the
   * sold-out half at the one moment it has something new to say. */
  test("strength: a full pool with a claim pending does not read as sold out", () => {
    const state = readyGame();

    assert(engine.dahanStrengthPending(state), "the claim is waiting");
    assert(!engine.upgradeIsSoldOut(state, "dahan_remember"), "so the row is not finished");

    engine.claimDahanStrength(state);
    assert(!engine.upgradeIsSoldOut(state, "dahan_remember"), "an empty second pool has rungs to sell");

    state.meta.fear = STRENGTH_FULL;
    engine.purchaseUpgrade(state, "dahan_remember", STRENGTH_FULL);
    assert(engine.upgradeIsSoldOut(state, "dahan_remember"), "and a full second pool is genuinely done");
  });

  test("strength: the Dahan really do strike for two", () => {
    const state = readyGame();
    engine.claimDahanStrength(state);
    engine.startNextRound(state);

    clearBoard(state);
    setLand(state, 1, { towns: 1 }, 1);

    // One Dahan, one strike: two damage kills a base Town outright, where one would only
    // wound it. That threshold is the whole of what the claim buys on the board.
    engine.resolveDahanAttack(state);
    assertEqual(state.invaders[1].towns, 0, "a lone Dahan takes the Town off the board");
  });

  /* ---------- What a Reclaim does to it ---------- */

  /* Board power, not an automation: it is re-earned every cycle like everything else Fear
   * buys, and what survives is the Presence row that allows the claim. See the wipe in
   * `ascend` and the rule written above presence_dahan_endure. */
  test("strength: a Reclaim takes the damage back and leaves the row that opened it", () => {
    const state = readyGame();
    engine.claimDahanStrength(state);

    state.meta.cycleFearGenerated = 1e7;
    engine.endRound(state);
    assert(engine.ascend(state), "Reclaim");

    assert(!engine.dahanStrengthClaimed(state), "the claim did not survive the wipe");
    assertEqual(engine.dahanAttackDamage(state), engine.DAHAN_ATTACK_DAMAGE, "the Dahan strike for one again");
    assertEqual(engine.upgradeMaxTier(state, "dahan_remember"), FULL, "and the pool is back to its first depth");

    assert(engine.dahanStrengthUnlocked(state), "but the Presence row that opened it is still owned");
    grantUpgrade(state, "dahan_remember", FULL);
    engine.endRound(state);
    assert(engine.canClaimDahanStrength(state), "so the next cycle may claim it again");
  });

  /* ---------- Across a save ---------- */

  /* The clamp in normalizeState prices every owned tier against upgradeMaxTier, and the pool's
   * ceiling is the one that moves. Normalize the flag after the tiers and a claimed save loses
   * everything it poured in past the first ceiling on every single load, silently. */
  test("strength: a claimed save keeps a second pool deeper than the first one could hold", () => {
    const storage = memoryStorage();
    const state = readyGame();
    engine.claimDahanStrength(state);
    grantUpgrade(state, "dahan_remember", FULL + 5000);
    engine.saveState(state, storage);

    const loaded = engine.loadState(storage);
    assert(engine.dahanStrengthClaimed(loaded), "the claim came back");
    assertEqual(engine.upgradeTier(loaded, "dahan_remember"), FULL + 5000, "and every Fear of the pool with it");
    assertEqual(engine.dahanAttackDamage(loaded), engine.DAHAN_STRENGTH_DAMAGE, "the Dahan still strike for two");
  });

  test("strength: a save from before the claim existed loads unclaimed", () => {
    const old = engine.normalizeState({ upgrades: { purchased: { dahan_remember: 4000 } } });
    assert(!engine.dahanStrengthClaimed(old), "no flag, no claim");
    assertEqual(engine.dahanAttackDamage(old), engine.DAHAN_ATTACK_DAMAGE, "and the base damage");
    assertEqual(engine.upgradeTier(old, "dahan_remember"), 4000, "with the pool it was written with");
  });

  /* The three states the row's own text has to describe, in both languages, with every
   * placeholder filled. A key the handler does not pass survives templating as a literal
   * "{strength}" in the shop, which no test of the engine would ever notice. */
  test("strength: the row says the right thing in each of its three states, in both languages", () => {
    for (const lang of ["de", "en"]) {
      const filling = readyGame();
      filling.ui.language = lang;
      grantUpgrade(filling, "dahan_remember", 2500);
      const pending = readyGame();
      pending.ui.language = lang;
      const done = readyGame();
      done.ui.language = lang;
      engine.claimDahanStrength(done);
      done.meta.fear = STRENGTH_FULL;
      engine.purchaseUpgrade(done, "dahan_remember", STRENGTH_FULL);

      const texts = {
        filling: engine.upgradeText(filling, "dahan_remember"),
        pending: engine.upgradeText(pending, "dahan_remember"),
        done: engine.upgradeText(done, "dahan_remember")
      };

      for (const [which, text] of Object.entries(texts)) {
        assert(text.length > 0, lang + " has text for the " + which + " pool");
        assert(!/[{}]/.test(text), lang + " leaves no placeholder unfilled in the " + which + " pool: " + text);
      }
      assert(texts.pending !== texts.done, lang + " does not call a ready pool a finished one");
      assert(texts.pending !== texts.filling, lang + " does not call a ready pool a filling one");
    }
  });

  test("strength: both locales carry the row, its ready line and the button", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert((t.presenceNames || {}).presence_dahan_endure, lang + " names the Presence row");
      assert((t.presenceTexts || {}).presence_dahan_endure, lang + " explains it");
      assert((t.upgradeReadyTexts || {}).dahan_remember, lang + " has the ready line");
      assert(t.shopDahanStrengthBtn && t.shopDahanStrengthTitle && t.shopDahanStrengthWait, lang + " has the button");
      assert(t.dahanStrengthClaimed && t.dahanStrengthRefused, lang + " logs the claim");
      assert(t.presenceLocked && t.presenceLockedBtn, lang + " says the row is not selling");
    }
  });

  /* ---------- The row is held shut ----------
   *
   * `presence_dahan_endure` carries `locked` in the catalogue, so it is drawn and not sold.
   * What these check is that the lock is a refusal in the *engine* and not a disabled button:
   * a shop render is not a rule, and the row must refuse a direct purchase at any purse.
   *
   * Everything below the lock stays wired on purpose - the claim, the doubled pool, the
   * doubled damage - so that unlocking the row is one line in `content.js` and not a rebuild.
   * The tests above this one grant the row rather than buying it, which is why they still pass
   * and why they are the proof of that: the machinery is untouched, only the till is closed.
   */
  test("strength: the Presence row is locked and refuses a purchase at any price", () => {
    const { state } = newGame();

    assert(engine.presenceUpgradeLocked("presence_dahan_endure"), "the catalogue holds it shut");

    state.meta.presence = 999;
    assertEqual(
      engine.purchasePresenceUpgrade(state, "presence_dahan_endure"), false,
      "a purse that could pay ten times over still buys nothing"
    );
    assertEqual(state.meta.presence, 999, "and is not charged");
    assertEqual(engine.presenceUpgradeTier(state, "presence_dahan_endure"), 0, "the row stays unowned");
    assertEqual(engine.dahanStrengthUnlocked(state), false, "so the claim stays shut with it");
  });

  test("strength: no other Presence row is locked", () => {
    const locked = engine.PRESENCE_UPGRADE_IDS.filter((id) => engine.presenceUpgradeLocked(id));
    assertEqual(locked.join(","), "presence_dahan_endure", "exactly one row is held shut");
  });

  test("strength: a granted row keeps working, so unlocking costs one line", () => {
    const state = grantPresence(newGame().state, "presence_dahan_endure");

    // The lock is on the till, not on the wiring: a save that already owns the row - or the
    // catalogue dropping `locked` again - finds every rule below it intact.
    assert(engine.dahanStrengthUnlocked(state), "an owned row still opens the claim");
    assertEqual(engine.presenceUpgradeLocked("presence_dahan_endure"), true, "while the row stays unsellable");
  });
})();
