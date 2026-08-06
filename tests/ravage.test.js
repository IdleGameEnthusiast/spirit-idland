/* Ravage checks - docs/spec/08-acceptance-tests.md#ravage-checks
 *
 * The combat math carries over from the turn-based build unchanged; what is new is that
 * the counterattack assigns itself. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  function ravage(state, terrain) {
    state.invader = { ravage: terrain, build: null, explore: null };
    engine.resolveRavagePhase(state);
  }

  test("ravage: a land with no invaders costs no Dahan", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", null, 2);

    ravage(state, "jungle");
    assertEqual(state.dahan["3"], 2, "Dahan untouched");
    assertEqual(state.round.blight, 0, "no blight from an empty land");
  });

  test("ravage: invader damage is explorer 1, town 2, city 3", () => {
    assertEqual(engine.invaderDamageInLand({ explorers: 1, towns: 0, cities: 0 }), 1, "explorer");
    assertEqual(engine.invaderDamageInLand({ explorers: 0, towns: 1, cities: 0 }), 2, "town");
    assertEqual(engine.invaderDamageInLand({ explorers: 0, towns: 0, cities: 1 }), 3, "city");
    assertEqual(engine.invaderDamageInLand({ explorers: 2, towns: 1, cities: 1 }), 7, "mixed");
  });

  test("ravage: two damage kills one Dahan and a leftover point kills nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    // 3 damage: one Dahan dies, the spare point is discarded rather than carried.
    setLand(state, "3", { cities: 1 }, 2);

    ravage(state, "jungle");
    assertEqual(state.dahan["3"], 1, "exactly one Dahan lost");
  });

  test("ravage: a single point of damage kills nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 1);

    ravage(state, "jungle");
    assertEqual(state.dahan["3"], 1, "one explorer cannot kill a Dahan");
  });

  test("ravage: Dahan destroyed this Ravage deal no counterattack", () => {
    const { state } = newGame();
    clearBoard(state);
    // 2 towns deal 4: both Dahan die before they can swing.
    setLand(state, "3", { towns: 2 }, 2);

    ravage(state, "jungle");
    assertEqual(state.dahan["3"], 0, "both Dahan died");
    assertEqual(state.invaders["3"].towns, 2, "the towns are untouched");
  });

  test("ravage: the counterattack spends on the highest tier first", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, cities: 1 }, 0);

    // Exactly enough to fell the city, and nothing spare. A pool that picked the cheapest
    // kill would take the explorer instead and leave the city at full health.
    engine.spendCounterattack(state, "3", 3);

    assertEqual(state.invaders["3"].cities, 0, "the city took the whole pool and fell");
    assertEqual(state.invaders["3"].explorers, 1, "the explorer is untouched");
    assertEqual(state.invaderDamage["3"].cities, 0, "no carried damage on a defeated type");
  });

  test("ravage: the counterattack drops to the next tier once one falls", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 1 }, 0);

    engine.spendCounterattack(state, "3", 4);

    assertEqual(state.invaders["3"].towns, 0, "the town falls first");
    assertEqual(state.invaders["3"].explorers, 0, "then both explorers");
  });

  test("ravage: a surviving Dahan's counterattack reaches the invaders", () => {
    const { state } = newGame();
    clearBoard(state);
    // One town deals 2 and kills one Dahan; the other two answer with 4, which is more than
    // the town's 2 health.
    setLand(state, "3", { towns: 1 }, 3);

    ravage(state, "jungle");
    assertEqual(state.dahan["3"], 2, "one Dahan lost");
    assertEqual(state.invaders["3"].towns, 0, "the town fell to the counterattack");
  });

  test("ravage: partial damage persists across waves within a round", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);

    engine.applyDamageToInvaderType(state, "3", "cities", 2);
    assertEqual(state.invaders["3"].cities, 1, "the city survives 2 of its 3 health");
    assertEqual(state.invaderDamage["3"].cities, 2, "two points carried");

    // A full wave passes over the land without ravaging it. There is no end-of-turn left to
    // clear carried damage against, so it has to still be there afterwards.
    state.invader = { ravage: "wetlands", build: "jungle", explore: "desert" };
    engine.resolveWave(state);
    assertEqual(state.invaderDamage["3"].cities, 2, "still carried a wave later");

    engine.applyDamageToInvaderType(state, "3", "cities", 1);
    assertEqual(state.invaders["3"].cities, 0, "the city falls to the carried damage");
  });

  test("ravage: the counterattack awards Fear by defeated power", () => {
    const { state } = newGame();
    clearBoard(state);
    state.meta.fear = 0;
    // 2 Dahan, 4 counterattack damage, against two towns of 2 health each: both fall.
    setLand(state, "3", { towns: 2 }, 2);
    state.dahan["3"] = 4;

    ravage(state, "jungle");
    assertEqual(state.invaders["3"].towns, 0, "both towns defeated");
    assertClose(state.meta.fear, 2 * 2 * engine.FEAR_PER_POWER, 0.0001, "fear for two towns");
  });

  test("ravage: fear per unit follows power * 0.35", () => {
    const { state } = newGame();
    clearBoard(state);

    state.meta.fear = 0;
    setLand(state, "3", { explorers: 1 }, 0);
    engine.applyDamageToInvaderType(state, "3", "explorers", 1);
    assertClose(state.meta.fear, 0.35, 0.0001, "explorer");

    state.meta.fear = 0;
    setLand(state, "3", { towns: 1 }, 0);
    engine.applyDamageToInvaderType(state, "3", "towns", 2);
    assertClose(state.meta.fear, 0.7, 0.0001, "town");

    state.meta.fear = 0;
    setLand(state, "3", { cities: 1 }, 0);
    engine.applyDamageToInvaderType(state, "3", "cities", 3);
    assertClose(state.meta.fear, 1.05, 0.0001, "city");
  });

  test("ravage: both lands of the terrain resolve, lowest id first", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);
    setLand(state, "5", { explorers: 1 }, 0);

    ravage(state, "jungle");

    const log = state._log.join("\n");
    const idx3 = log.indexOf("Gebiet 3");
    const idx5 = log.indexOf("Gebiet 5");
    assert(idx3 >= 0 && idx5 >= 0, "both lands must appear in the log");
    // The log is newest-first, so the land resolved first sits later in the array.
    assert(idx5 < idx3, "land 3 must resolve before land 5");
  });

  test("ravage: nothing is left pending after a counterattack", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 2 }, 3);

    ravage(state, "jungle");
    assertEqual(state.pendingAbilityTarget, null, "no pending target");
    assert(!("effects" in state), "the turn-based effects object must be gone");
  });

  test("build: towns outnumbering cities builds a city, otherwise a town", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 2, cities: 1 }, 0);
    setLand(state, "5", { towns: 1, cities: 1 }, 0);
    state.invader = { ravage: null, build: "jungle", explore: null };

    engine.resolveBuildPhase(state);
    assertEqual(state.invaders["3"].cities, 2, "towns outnumber cities: a city is built");
    assertEqual(state.invaders["5"].towns, 2, "otherwise a town is built");
  });

  test("build: an empty land builds nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { ravage: null, build: "jungle", explore: null };

    engine.resolveBuildPhase(state);
    assertEqual(engine.invaderCountInLand(state.invaders["3"]), 0, "land 3 stays empty");
    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 0, "land 5 stays empty");
  });

  test("discover: seeds the coastal land and skips the unreachable inland one", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { ravage: null, build: null, explore: "jungle" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["3"].explorers, 1, "coastal jungle takes an explorer");
    assertEqual(state.invaders["5"].explorers, 0, "inland jungle has no way in yet");
  });

  test("discover: a town next to the inland land opens it up", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "1", { towns: 1 }, 0);
    state.invader = { ravage: null, build: null, explore: "jungle" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["5"].explorers, 1, "land 5 is adjacent to the town in land 1");
  });

  test("discover: mountains stays shut until invaders are inland", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { ravage: null, build: null, explore: "mountains" };

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["4"].explorers, 0, "land 4 shut");
    assertEqual(state.invaders["6"].explorers, 0, "land 6 shut");

    // Land 6 borders coastal lands 2 and 3, so it is the first mountain land to open.
    setLand(state, "2", { towns: 1 }, 0);
    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["6"].explorers, 1, "land 6 opens first");
    assertEqual(state.invaders["4"].explorers, 0, "land 4 is still interior");
  });
})();
