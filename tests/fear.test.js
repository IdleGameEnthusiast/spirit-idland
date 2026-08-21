/* The three Fear ladders and the encoding guard - docs/spec/05-progression.md */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, clearBoard, setLand, grantUpgrade, unlockAllAbilities, memoryStorage } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* ---------- The encoding guard ----------
   *
   * The German table carries real umlauts now. It used to transliterate them, after this file
   * was corrupted once by a tool that re-encoded it - prevention was the old answer and this
   * is the new one. It needs both halves. The negative check catches a re-encode: a UTF-8 file
   * read as ANSI turns every "ö" into "Ã¶". The positive check catches the other direction, a
   * well-meaning pass that transliterates back to ASCII, which would sail straight through the
   * negative check while quietly undoing the whole change.
   */
  function allStrings(node, out) {
    const acc = out || [];
    if (typeof node === "string") acc.push(node);
    else if (Array.isArray(node)) node.forEach((n) => allStrings(n, acc));
    else if (node && typeof node === "object") Object.values(node).forEach((n) => allStrings(n, acc));
    return acc;
  }

  test("i18n: no German string is mojibake", () => {
    const strings = allStrings(engine.I18N.de);
    assert(strings.length > 50, "the German table should have plenty of strings in it");

    for (const value of strings) {
      assert(!/[ÂÃ]|�/.test(value), `re-encoded German string: ${JSON.stringify(value)}`);
    }
  });

  test("i18n: the German table actually contains umlauts", () => {
    const joined = allStrings(engine.I18N.de).join("");
    assert(/[äöüßÄÖÜ]/.test(joined), "umlauts were transliterated away");
  });

  test("i18n: every upgrade is named and described in both locales", () => {
    for (const id of engine.UPGRADE_IDS) {
      for (const lang of ["de", "en"]) {
        assert(engine.I18N[lang].upgradeNames[id], `${lang} is missing a name for ${id}`);
        assert(engine.I18N[lang].upgradeTexts[id], `${lang} is missing a text for ${id}`);
      }
    }
  });

  /* ---------- The three ladders, and their cap ---------- */

  const FEAR_LADDERS = ["rising_dread", "mounting_terror", "high_water_mark"];

  // They were soft-capped - no maxTier at all - for as long as the Fear shop was the game's
  // only progression axis and had to absorb income forever. Ascension is that axis now, so all
  // three are finishable, and the matched set is the point: one number, three rows.
  test("fear: the three ladders stop at ten tiers", () => {
    const { state } = newGame();
    for (const id of FEAR_LADDERS) {
      assertEqual(engine.upgradeMaxTier(state, id), 10, `${id} should stop at ten`);
      assertEqual(engine.upgradeMaxTier(state, id), engine.FEAR_LADDER_MAX_TIER, `${id} reads the shared constant`);
    }
  });

  // The structural claim the cap buys, and the one worth guarding: every row in the catalogue
  // now has a top, so every row can reach the shop's sold-out half. A row with no maxTier would
  // sit in the buyable list showing a price forever.
  test("fear: every row in the catalogue is finishable", () => {
    const { state } = newGame();
    for (const id of engine.UPGRADE_IDS) {
      assert(Number.isFinite(engine.upgradeMaxTier(state, id)), `${id} has no top tier`);
    }
  });

  test("fear: the eleventh tier of a ladder is refused", () => {
    const { state } = newGame();
    grantUpgrade(state, "rising_dread", 10);
    state.meta.fear = Number.MAX_SAFE_INTEGER;

    assert(!engine.purchaseUpgrade(state, "rising_dread"), "tier 11 is past the top");
    assertEqual(engine.upgradeTier(state, "rising_dread"), 10, "and the tier does not move");
  });

  // Free by construction rather than by migration code: normalizeState already clamps every
  // tier to upgradeMaxTier, so shortening a ladder cannot strand a save above its end.
  test("fear: a save above the new cap clamps down to it", () => {
    const loaded = engine.normalizeState({
      schemaVersion: engine.VERSION,
      upgrades: { purchased: { rising_dread: 14, mounting_terror: 40 } }
    });

    assertEqual(loaded.upgrades.purchased.rising_dread, 10, "clamped, not stranded");
    assertEqual(loaded.upgrades.purchased.mounting_terror, 10, "however far above it was");
  });

  /* ---------- rising_dread ---------- */

  // Land 3 is coastal, so Flash Floods deals its 1 + 1 there: exactly enough to kill one Town
  // outright at the bottom of the ladder. unlockAllAbilities also clears every cooldown, which
  // is what lets this run twice against the same state.
  function killOneTown(state) {
    unlockAllAbilities(state);
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    state.round.fearEarned = 0;
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    return state.round.fearEarned;
  }

  test("fear: rising_dread multiplies kill Fear by 10% a tier", () => {
    const plain = killOneTown(newGame().state);
    assert(plain > 0, "the kill should have paid something");

    const boosted = newGame().state;
    grantUpgrade(boosted, "rising_dread", 5);

    assertClose(killOneTown(boosted), plain * 1.5, 0.0001, "tier 5 is +50%");
  });

  // Why the multiplier is not applied per award: floor(1 * 1.1) is 1, so flooring each kill
  // would make the first four tiers of this ladder buy a number that never moves.
  test("fear: a small multiplier is not rounded away on a 1-power kill", () => {
    const { state } = newGame();
    grantUpgrade(state, "rising_dread", 1);

    unlockAllAbilities(state);
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);
    state.round.fearEarned = 0;
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertClose(state.round.fearEarned, 1.1, 0.0001, "an explorer at +10% is 1.1, not 1");
  });

  /* ---------- mounting_terror and high_water_mark ---------- */

  test("fear: mounting_terror multiplies wave Fear by 10% a tier", () => {
    const { state } = newGame();
    grantUpgrade(state, "mounting_terror", 10);

    state.round.fearEarned = 0;
    engine.resolveWave(state);

    assertClose(state.round.fearEarned, engine.FEAR_PER_WAVE * 2, 0.0001, "tier 10 doubles a wave");
  });

  test("fear: high_water_mark pays on the tenth wave and not on the ninth", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 3);

    state.round.wavesResolved = 8;
    state.round.fearEarned = 0;
    engine.resolveWave(state);
    assertEqual(state.round.wavesResolved, 9, "wave 9");
    assertClose(state.round.fearEarned, engine.FEAR_PER_WAVE, 0.0001, "which pays no milestone");

    state.round.fearEarned = 0;
    engine.resolveWave(state);
    assertEqual(state.round.wavesResolved, 10, "wave 10");
    assertClose(
      state.round.fearEarned,
      engine.FEAR_PER_WAVE + 3,
      0.0001,
      "10 * 3 * 10% = 3, on top of the wave's own Fear"
    );
  });

  // The property the whole upgrade exists for: the payout scales with depth, so its total over
  // a run is quadratic where the flat per-wave Fear is linear.
  test("fear: the milestone scales with the wave, not with a flat number", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 5);

    state.round.wavesResolved = 49;
    state.round.fearEarned = 0;
    engine.resolveWave(state);

    assertClose(state.round.fearEarned, engine.FEAR_PER_WAVE + 25, 0.0001, "50 * 5 * 10% = 25");
  });

  test("fear: mounting_terror multiplies the milestone too", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 5);
    grantUpgrade(state, "mounting_terror", 10);

    state.round.wavesResolved = 49;
    state.round.fearEarned = 0;
    engine.resolveWave(state);

    // The wave's own 1 and the milestone's 25, both doubled. This interaction is what makes
    // the pair worth owning together rather than instead of each other.
    assertClose(state.round.fearEarned, (engine.FEAR_PER_WAVE + 25) * 2, 0.0001, "both halves doubled");
  });

  test("fear: the milestone leaves an fx for the HUD to flash", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 4);

    state.round.wavesResolved = 19;
    engine.resolveWave(state);

    const fx = engine.activeFearFx(state);
    assert(fx, "a milestone should leave an fx behind");
    assertEqual(fx.wave, 20, "carrying the wave that paid");
    assertEqual(fx.amount, 8, "and what it paid: 20 * 4 * 10%");
  });

  test("fear: nothing flashes when the upgrade is not owned", () => {
    const { state } = newGame();
    state.round.wavesResolved = 29;
    engine.resolveWave(state);

    assertEqual(engine.activeFearFx(state), null, "tier 0 pays nothing, so nothing flashes");
  });

  /* ---------- The bank ---------- */

  test("fear: the bank floors, and never in the player's favour", () => {
    const { state } = newGame();
    state.round.fearEarned = 7.99;
    state.meta.fear = 0;
    engine.endRound(state);

    assertEqual(state.meta.fear, 7, "7.99 banks as 7, not 8");
  });

  test("fear: fractions survive the round and only the total is rounded", () => {
    const { state } = newGame();
    grantUpgrade(state, "rising_dread", 3);

    // Three kills at 1.3 each is 3.9 - which floors to 3, where flooring each award would
    // have floored three 1.3s to three 1s and banked the same 3 by accident. The fractional
    // total is the thing being asserted, not the banked one.
    unlockAllAbilities(state);
    clearBoard(state);
    state.round.fearEarned = 0;
    for (const land of ["1", "2", "3"]) setLand(state, land, { explorers: 1 }, 0);
    for (const land of ["1", "2", "3"]) {
      unlockAllAbilities(state);
      engine.triggerAbility(state, "flash_floods");
      engine.resolveAbilityTarget(state, land);
    }

    assertClose(state.round.fearEarned, 3.9, 0.0001, "1.3 three times, kept whole in fractions");
    state.meta.fear = 0;
    engine.endRound(state);
    assertEqual(state.meta.fear, 3, "and floored once, at the bank");
  });

  /* ---------- The HUD's base/bonus split ---------- */

  test("fear: with no ladders owned, the whole round is base and the bonus is zero", () => {
    const { state } = newGame();
    killOneTown(state);

    const split = engine.fearBreakdown(state);
    assertEqual(split.bonus, 0, "nothing was added");
    assertEqual(split.base, split.total, "so all of it is base");
    assert(split.total > 0, "and there is something there to split");
  });

  test("fear: the split reports the base unmultiplied and the ladder's share beside it", () => {
    const { state } = newGame();
    grantUpgrade(state, "rising_dread", 10);
    killOneTown(state);

    // A town is 2 power. At tier 10 that pays 4, of which 2 is the ladder's.
    const split = engine.fearBreakdown(state);
    assertEqual(split.base, 2, "the kill's own worth");
    assertEqual(split.bonus, 2, "and what the ladder added");
  });

  // The property that matters: the player reads two numbers and banks their sum, so the two
  // must add up to the banked figure exactly - never one Fear off from two separate floors.
  test("fear: base and bonus always sum to exactly what the round banks", () => {
    for (const tier of [0, 1, 3, 7]) {
      const { state } = newGame();
      grantUpgrade(state, "rising_dread", tier);
      grantUpgrade(state, "mounting_terror", tier);
      grantUpgrade(state, "high_water_mark", tier);

      state.round.wavesResolved = 19;
      engine.resolveWave(state);
      killOneTown(state);
      engine.resolveWave(state);

      const split = engine.fearBreakdown(state);
      assertEqual(
        split.base + split.bonus,
        split.total,
        `tier ${tier}: the two halves must reconstruct the total`
      );

      state.meta.fear = 0;
      engine.endRound(state);
      assertEqual(
        split.base + split.bonus,
        state.meta.fear,
        `tier ${tier}: and the total must be what actually banked`
      );
    }
  });

  test("fear: the milestone counts entirely as bonus", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 5);

    state.round.wavesResolved = 49;
    state.round.fearEarned = 0;
    state.round.fearEarnedBase = 0;
    engine.resolveWave(state);

    // Without the upgrade there would be no milestone at all, so only the wave's own Fear is
    // base and the whole 25 belongs to the ladder.
    const split = engine.fearBreakdown(state);
    assertEqual(split.base, engine.FEAR_PER_WAVE, "just the wave itself");
    assertEqual(split.bonus, 25, "all of the milestone");
  });

  test("fear: a save with no base recorded reports no bonus rather than all bonus", () => {
    const ctx = newGame();
    const { state } = ctx;
    const storage = memoryStorage();

    state.round.fearEarned = 20;
    state.round.fearEarnedBase = 20;
    engine.saveState(state, storage);

    // Exactly what a save from a build without the Fear ladders looks like.
    const raw = JSON.parse(storage.getItem(Object.keys(storage._dump())[0]));
    delete raw.round.fearEarnedBase;
    storage.setItem(Object.keys(storage._dump())[0], JSON.stringify(raw));

    const loaded = engine.loadState(storage);
    const split = engine.fearBreakdown(loaded);

    assertEqual(split.total, 20, "the total survives");
    assertEqual(split.bonus, 0, "and none of it is claimed as upgrade income");
    assertEqual(split.base, 20, "it is all base");
  });

  test("fear: a base above its own total cannot produce a negative bonus", () => {
    const { state } = newGame();
    state.round.fearEarned = 5;
    state.round.fearEarnedBase = 99;

    const split = engine.fearBreakdown(state);
    assertEqual(split.bonus, 0, "clamped rather than rendered as +-94");
    assertEqual(split.base, 5, "and the base cannot exceed the total");
  });

  /* ---------- The two-pool rule ---------- */

  // Writes state.upgrades.purchased by hand rather than using grantUpgrade, which deliberately
  // also writes the round snapshot. The gap between the two is exactly what this asserts.
  test("fear: a ladder bought mid-round does not pay out until the next one", () => {
    const { state } = newGame();
    const plain = killOneTown(state);

    state.upgrades.purchased.rising_dread = 10;
    assertEqual(engine.upgradeTier(state, "rising_dread"), 10, "owned immediately");
    assertClose(killOneTown(state), plain, 0.0001, "but this round still pays the old rate");

    state.round.blight = state.round.blightThreshold;
    engine.endRound(state);
    assert(engine.startNextRound(state), "into the next round");

    assertClose(killOneTown(state), plain * 2, 0.0001, "which pays the new rate");
  });

  /* ---------- Presence: 1% Fear a point, unspent and uncapped ---------- */

  test("fear: presenceFearMultiplier is 1 at zero and grows 1% a point, uncapped", () => {
    const { state } = newGame();
    assertEqual(engine.presenceFearMultiplier(state), 1, "nothing held, nothing added");

    state.meta.presence = 37;
    assertClose(engine.presenceFearMultiplier(state), 1.37, 0.0001, "37 points is +37%");

    // No FEAR_LADDER_MAX_TIER here on purpose - see the note above
    // PRESENCE_FEAR_BONUS_PER_POINT in engine/constants.js.
    state.meta.presence = 1000;
    assertClose(engine.presenceFearMultiplier(state), 11, 0.0001, "and it never tops out");
  });

  test("fear: unspent Presence multiplies kill Fear", () => {
    const plain = killOneTown(newGame().state);

    const boosted = newGame().state;
    boosted.meta.presence = 50;

    assertClose(killOneTown(boosted), plain * 1.5, 0.0001, "50 held Presence is +50%");
  });

  test("fear: unspent Presence multiplies wave Fear", () => {
    const { state } = newGame();
    state.meta.presence = 50;

    state.round.fearEarned = 0;
    engine.resolveWave(state);

    assertClose(state.round.fearEarned, engine.FEAR_PER_WAVE * 1.5, 0.0001, "+50% on the wave too");
  });

  test("fear: unspent Presence multiplies the high_water_mark milestone", () => {
    const { state } = newGame();
    grantUpgrade(state, "high_water_mark", 5);
    state.meta.presence = 50;

    state.round.wavesResolved = 49;
    state.round.fearEarned = 0;
    engine.resolveWave(state);

    // Wave 50: 1 (wave) + 25 (milestone, 50*5*10%), all at +50% Presence.
    assertClose(state.round.fearEarned, (engine.FEAR_PER_WAVE + 25) * 1.5, 0.0001, "the milestone too");
  });

  test("fear: Presence stacks with a Fear ladder rather than replacing it", () => {
    const { state } = newGame();
    grantUpgrade(state, "rising_dread", 5);
    state.meta.presence = 50;

    // Tier 5 is +50% on its own (see the rising_dread test above); +50% Presence on top of
    // that is two independent multipliers, not one added rate.
    assertClose(killOneTown(state), killOneTown(newGame().state) * 1.5 * 1.5, 0.0001, "1.5 x 1.5");
  });

  // Unlike the three ladders, which read activeUpgradeTier off the round's own snapshot,
  // Presence is read live: it never moves from combat, only from Reclaiming (which ends the
  // round outright) or a Presence purchase, so there is no same-round loop for a snapshot to
  // guard against - see the note above PRESENCE_FEAR_BONUS_PER_POINT.
  test("fear: the Presence bonus is read live, not frozen for the round", () => {
    const { state } = newGame();
    state.meta.presence = 100;

    const boosted = killOneTown(state);

    state.meta.presence = 0;
    const unboosted = killOneTown(state);

    assertClose(boosted, unboosted * 2, 0.0001, "100 Presence pays double");
    assert(unboosted < boosted, "and dropping it mid-round takes effect immediately");
  });
})();
