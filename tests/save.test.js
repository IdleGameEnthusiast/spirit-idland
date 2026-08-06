/* Save and migration checks - docs/spec/08-acceptance-tests.md#save-and-migration-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, advance, memoryStorage, clearBoard, setLand, unlockAllAbilities } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("save: a round-trip preserves meta, upgrades, round and board state", () => {
    const ctx = newGame();
    const { state } = ctx;
    const storage = memoryStorage();

    advance(ctx, 20);
    state.meta.fear = 12;
    state.upgrades.purchased.dahan_reinforcement = 3;
    state.ui.selectedLand = "6";
    state.invaders["5"] = { explorers: 2, towns: 1, cities: 0 };
    state.invaderDamage["5"].towns = [1];
    state.dahan["5"] = 2;

    engine.saveState(state, storage);
    const loaded = engine.loadState(storage);

    assertEqual(loaded.meta.fear, 12, "fear");
    assertEqual(loaded.upgrades.purchased.dahan_reinforcement, 3, "upgrade tier");
    assertEqual(loaded.round.number, state.round.number, "round number");
    assertEqual(loaded.round.blight, state.round.blight, "blight");
    assertEqual(loaded.round.wavesResolved, state.round.wavesResolved, "waves");
    assertEqual(loaded.ui.selectedLand, "6", "selected land");
    assertEqual(loaded.invaders["5"].explorers, 2, "invaders");
    assertDeepEqual(loaded.invaderDamage["5"].towns, [1], "the wounded town is still wounded");
    assertEqual(loaded.dahan["5"], 2, "dahan");
  });

  test("save: land keys survive the JSON round-trip as strings", () => {
    const ctx = newGame();
    const storage = memoryStorage();
    engine.saveState(ctx.state, storage);
    const loaded = engine.loadState(storage);

    for (const landId of engine.LAND_IDS) {
      assert(Object.prototype.hasOwnProperty.call(loaded.dahan, landId), `land ${landId} missing after reload`);
    }
  });

  test("save: a pending ability target survives a reload", () => {
    const { state } = newGame();
    const storage = memoryStorage();
    unlockAllAbilities(state);
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    engine.triggerAbility(state, "flash_floods");

    engine.saveState(state, storage);
    const loaded = engine.loadState(storage);
    assertEqual(loaded.pendingAbilityTarget, "flash_floods", "armed ability survives");
  });

  test("save: a running round resumes exactly as saved, crediting nothing for the gap", () => {
    const ctx = newGame();
    const storage = memoryStorage();
    advance(ctx, 5);

    engine.saveState(ctx.state, storage);
    const timerAtSave = ctx.state.round.waveTimerRemaining;
    const wavesAtSave = ctx.state.round.wavesResolved;

    // Two hours pass with the tab closed.
    ctx.clock.advance(7200);
    const loaded = engine.loadState(storage);

    assertClose(loaded.round.waveTimerRemaining, timerAtSave, 0.0001, "wave timer unchanged");
    assertEqual(loaded.round.wavesResolved, wavesAtSave, "no waves credited");
  });

  test("save: ability cooldowns get no offline credit either", () => {
    const ctx = newGame();
    const storage = memoryStorage();
    unlockAllAbilities(ctx.state);
    clearBoard(ctx.state);
    setLand(ctx.state, "3", { towns: 1 }, 0);
    engine.triggerAbility(ctx.state, "flash_floods");
    engine.resolveAbilityTarget(ctx.state, "3");

    const cooldownAtSave = ctx.state.abilities.flash_floods.cooldownRemaining;
    engine.saveState(ctx.state, storage);
    ctx.clock.advance(7200);

    const loaded = engine.loadState(storage);
    assertClose(loaded.abilities.flash_floods.cooldownRemaining, cooldownAtSave, 0.0001, "cooldown unchanged");
  });

  test("migration: a 2.0.0 save hard-resets, starts Fear at 0, and logs why", () => {
    newGame();
    const storage = memoryStorage();
    const legacy = {
      schemaVersion: "2.0.0",
      resources: { energy: 9, fear: 47 },
      presence: { "1": 3 },
      tracks: { energy: { revealed: 4 } },
      turn: { number: 12 },
      cards: { hand: ["wash_away"], drawPile: [], discardPile: [] },
      ui: { language: "en" }
    };
    storage.setItem(engine.SAVE_KEY, JSON.stringify(legacy));

    const loaded = engine.loadState(storage);

    assertEqual(loaded.schemaVersion, engine.VERSION, "version bumped");
    assertEqual(loaded.meta.fear, 0, "old tracked fear is not carried over");
    assertEqual(loaded.round.number, 1, "back to round 1");
    assert(!("presence" in loaded), "presence is gone");
    assert(!("tracks" in loaded), "tracks are gone");
    assert(!("cards" in loaded), "cards are gone");
    assert(!("turn" in loaded), "turn is gone");
    assert(loaded._log.some((line) => line.includes("2.0.0")), "the reset is logged with its version");
    assertEqual(loaded.ui.language, "en", "the language preference survives the reset");
  });

  test("migration: a corrupt save falls back to a fresh game instead of throwing", () => {
    newGame();
    const storage = memoryStorage();
    storage.setItem(engine.SAVE_KEY, "{not json");

    const loaded = engine.loadState(storage);
    assertEqual(loaded.schemaVersion, engine.VERSION, "fresh state");
    assertEqual(loaded.round.status, "running", "playable");
  });

  test("migration: no save at all produces a playable first round", () => {
    newGame();
    const loaded = engine.loadState(memoryStorage());
    assertEqual(loaded.round.number, 1, "round 1");
    assertEqual(loaded.meta.fear, 0, "no fear");
    const dahan = engine.LAND_IDS.reduce((sum, id) => sum + loaded.dahan[id], 0);
    assertEqual(dahan, engine.DAHAN_PER_ROUND_START_BASE, "dahan seeded");
  });

  test("normalize: an invalid round status falls back to running", () => {
    newGame();
    const state = engine.normalizeState({ schemaVersion: engine.VERSION, round: { status: "paused" } });
    assertEqual(state.round.status, "running", "status normalizes");
  });

  test("normalize: an unknown pending ability id becomes null", () => {
    newGame();
    const state = engine.normalizeState({ schemaVersion: engine.VERSION, pendingAbilityTarget: "summon_kraken" });
    assertEqual(state.pendingAbilityTarget, null, "unknown id dropped");
  });

  test("normalize: an ability that needs no target cannot be left armed", () => {
    newGame();
    const state = engine.normalizeState({ schemaVersion: engine.VERSION, pendingAbilityTarget: "boon_of_vigor" });
    assertEqual(state.pendingAbilityTarget, null, "a no-target ability can never be pending");
  });

  test("normalize: an unknown language falls back to German", () => {
    newGame();
    assertEqual(engine.normalizeState({ ui: { language: "fr" } }).ui.language, "de", "fallback");
    assertEqual(engine.normalizeState({ ui: { language: "en" } }).ui.language, "en", "english is kept");
  });

  test("normalize: blight clamps into range and per-land tallies are filled", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      round: { blight: 999, blightThreshold: 10 }
    });
    assertEqual(state.round.blight, 10, "clamped to the threshold");
    for (const landId of engine.LAND_IDS) {
      assertEqual(state.round.blightByLand[landId], 0, `land ${landId} tally present`);
    }
  });

  test("normalize: a wound can never exceed what its unit could absorb", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      invaders: { "3": { explorers: 1, towns: 2, cities: 0 } },
      invaderDamage: { "3": { explorers: [5], towns: [9, 1], cities: [4] } }
    });
    assertDeepEqual(state.invaderDamage["3"].towns, [1, 1], "a 2-health town can carry at most 1");
    assertDeepEqual(state.invaderDamage["3"].cities, [], "no cities means no city wounds");
    assertDeepEqual(state.invaderDamage["3"].explorers, [0], "a 1-health unit is never wounded, only dead");
  });

  test("normalize: the wound list is sized to the units and sorted worst-first", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      invaders: { "3": { explorers: 0, towns: 3, cities: 0 } },
      // Two entries for three towns, in the wrong order: the third is filled in healthy, and
      // the list is re-sorted so the board's ring always reads the worst-off unit at index 0.
      invaderDamage: { "3": { explorers: [], towns: [0, 1], cities: [] } }
    });
    assertDeepEqual(state.invaderDamage["3"].towns, [1, 0, 0], "one entry per living town, worst first");
  });

  test("normalize: a wound left behind by a dead unit is dropped", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      invaders: { "3": { explorers: 0, towns: 1, cities: 0 } },
      invaderDamage: { "3": { explorers: [], towns: [1, 1, 1], cities: [] } }
    });
    assertDeepEqual(state.invaderDamage["3"].towns, [1], "only the surviving town keeps a wound");
  });

  test("normalize: an unknown upgrade id is dropped and tiers clamp to their max", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      upgrades: { purchased: { made_up_upgrade: 4, blight_resilience: 999, dahan_reinforcement: -3 } }
    });
    assert(!("made_up_upgrade" in state.upgrades.purchased), "unknown id dropped");
    assertEqual(
      state.upgrades.purchased.blight_resilience,
      engine.upgradeMaxTier("blight_resilience"),
      "tier clamped"
    );
    assert(!("dahan_reinforcement" in state.upgrades.purchased), "a negative tier is not a purchase");
  });

  // swift_currents was cut from the registry. An old save still naming it must load, not
  // throw, and simply lose the entry the way any unknown id does.
  test("normalize: a save naming a retired upgrade drops it and keeps the rest", () => {
    newGame();
    const state = engine.normalizeState({
      schemaVersion: engine.VERSION,
      meta: { fear: 12.7 },
      upgrades: { purchased: { swift_currents: 4, dahan_reinforcement: 2 } }
    });
    assert(!("swift_currents" in state.upgrades.purchased), "retired id dropped");
    assertEqual(state.upgrades.purchased.dahan_reinforcement, 2, "the live upgrade survives");
    assertEqual(state.meta.fear, 12, "fractional Fear from an old save floors to whole");
  });

  test("normalize: every land key is present even when the save names none", () => {
    newGame();
    const state = engine.normalizeState({ schemaVersion: engine.VERSION, invaders: {}, dahan: {}, essence: {} });
    for (const landId of engine.LAND_IDS) {
      assert(state.invaders[landId], `invaders land ${landId}`);
      assertEqual(state.dahan[landId], 0, `dahan land ${landId}`);
    }
    for (const terrain of engine.INVADER_TERRAINS) {
      assertEqual(state.essence[terrain], 0, `essence ${terrain}`);
    }
  });

  test("normalize: a new field can be added with a default without breaking old saves", () => {
    const ctx = newGame();
    const storage = memoryStorage();
    engine.saveState(ctx.state, storage);

    const raw = JSON.parse(storage.getItem(engine.SAVE_KEY));
    delete raw.round.fearEarned;
    delete raw.essence;
    storage.setItem(engine.SAVE_KEY, JSON.stringify(raw));

    const loaded = engine.loadState(storage);
    assertEqual(loaded.round.fearEarned, 0, "missing field defaults");
    assertEqual(loaded.essence.jungle, 0, "missing pool defaults");
  });
})();
