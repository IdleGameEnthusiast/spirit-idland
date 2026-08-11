/* The difficulty ladder - see the rung table above EXPLORE_UNRESTRICTED_FROM_WAVE.
 *
 * Every rung is keyed to the wave count, which is per round. So each test here sets
 * `wavesResolved` by hand and resolves one phase: that is the whole of what a rung reads, and
 * playing forty waves to reach one would only be a slower way of writing the same number.
 *
 * What these tests are really guarding is that a rung stays off until its wave. A rung that
 * fires early is the kind of bug that only shows up as "round 3 got hard for no reason". */

(function () {
  const { engine, test, assert, assertEqual, newGame, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  // A board with nothing on it and the track pointed at one terrain, so a phase's output is
  // exactly what the phase put there.
  function boardAt(wave, invader) {
    const { state } = newGame();
    clearBoard(state);
    state.round.wavesResolved = wave;
    state.invader = invader;
    return state;
  }

  function explorersOn(state, landIds) {
    return landIds.map((id) => state.invaders[id].explorers);
  }

  /* ---------------------------------------------------------------- *
   * Wave 20 - two Explorers per discovered land                        *
   * ---------------------------------------------------------------- */

  test("ladder: Discover seeds one explorer per land below wave 20", () => {
    const state = boardAt(19, { build: [], explore: ["wetlands"] });
    engine.resolveExplorePhase(state);
    // Wetlands is lands 1 and 7; both are reachable this late (wave 10 opened everything).
    assert(explorersOn(state, ["1", "7"]).every((n) => n === 1), "one each below the rung");
  });

  test("ladder: Discover seeds two explorers per land from wave 20", () => {
    const state = boardAt(20, { build: [], explore: ["wetlands"] });
    engine.resolveExplorePhase(state);
    assert(explorersOn(state, ["1", "7"]).every((n) => n === 2), "two each from the rung on");
  });

  /* ---------------------------------------------------------------- *
   * Wave 30 - a Town appears where there is none                       *
   * ---------------------------------------------------------------- */

  test("ladder: no bonus town below wave 30", () => {
    const state = boardAt(29, { build: [], explore: ["wetlands"] });
    engine.resolveExplorePhase(state);
    const towns = engine.LAND_IDS.reduce((sum, id) => sum + state.invaders[id].towns, 0);
    assertEqual(towns, 0, "nothing builds a town this early");
  });

  test("ladder: a bonus town appears each wave from 30, only where there is none", () => {
    const state = boardAt(30, { build: [], explore: ["wetlands"] });

    // Every land but one already holds a town, so the random pick has exactly one answer and
    // the test does not depend on which way the RNG fell.
    for (const landId of engine.LAND_IDS) {
      if (landId === "5") continue;
      setLand(state, landId, { towns: 1 }, 0);
    }

    engine.resolveExplorePhase(state);
    assertEqual(state.invaders["5"].towns, 1, "the one land without a town took it");
    for (const landId of engine.LAND_IDS) {
      if (landId === "5") continue;
      assertEqual(state.invaders[landId].towns, 1, `land ${landId} was not doubled up`);
    }
  });

  test("ladder: the bonus town does nothing when every land already holds one", () => {
    const state = boardAt(30, { build: [], explore: [] });
    for (const landId of engine.LAND_IDS) setLand(state, landId, { towns: 1 }, 0);

    engine.resolveExplorePhase(state);
    const towns = engine.LAND_IDS.reduce((sum, id) => sum + state.invaders[id].towns, 0);
    assertEqual(towns, engine.LAND_IDS.length, "no land takes a second");
  });

  /* ---------------------------------------------------------------- *
   * Wave 40 - one extra land, off-terrain                              *
   * ---------------------------------------------------------------- */

  test("ladder: Discover takes exactly one off-terrain land from wave 40", () => {
    const below = boardAt(39, { build: [], explore: ["wetlands"] });
    engine.resolveExplorePhase(below);
    const seededBelow = engine.LAND_IDS.filter((id) => below.invaders[id].explorers > 0);
    assertEqual(seededBelow.length, 2, "just the terrain's own two lands");

    const at = boardAt(40, { build: [], explore: ["wetlands"] });
    engine.resolveExplorePhase(at);
    const seededAt = engine.LAND_IDS.filter((id) => at.invaders[id].explorers > 0);
    assertEqual(seededAt.length, 3, "the terrain's two, plus one more");

    // The extra land is drawn from lands this Discover did not already seed, so wetlands'
    // own lands can never be the one that was added.
    const extra = seededAt.filter((id) => !["1", "7"].includes(id));
    assertEqual(extra.length, 1, "the extra land sits outside the drawn terrain");
  });

  /* ---------------------------------------------------------------- *
   * Waves 50 / 70 / 80 - Discover widens to 2, 3, then every terrain   *
   * ---------------------------------------------------------------- */

  test("ladder: the Discover terrain count climbs 1 -> 2 -> 3 -> all", () => {
    const counts = [
      [0, 1], [49, 1],
      [50, 2], [69, 2],
      [70, 3], [79, 3],
      [80, engine.INVADER_TERRAINS.length], [200, engine.INVADER_TERRAINS.length]
    ];
    for (const [wave, expected] of counts) {
      const state = boardAt(wave, { build: [], explore: [] });
      assertEqual(engine.exploreTerrainCount(state), expected, `wave ${wave}`);
    }
  });

  test("ladder: a widened Discover actually draws that many distinct terrains", () => {
    const state = boardAt(70, { build: [], explore: ["wetlands"] });
    engine.shiftInvaderTrack(state);
    assertEqual(state.invader.explore.length, 3, "three terrains drawn");
    assertEqual(new Set(state.invader.explore).size, 3, "and no duplicates among them");
  });

  test("ladder: at wave 80 Discover holds every terrain, and Build inherits it next wave", () => {
    const state = boardAt(80, { build: [], explore: ["wetlands"] });
    engine.shiftInvaderTrack(state);
    assertEqual(state.invader.explore.length, engine.INVADER_TERRAINS.length, "all terrains");

    // The track promise: what was discovered this wave is what builds next.
    const discovered = state.invader.explore.slice();
    engine.shiftInvaderTrack(state);
    assertEqual(state.invader.build.join(","), discovered.join(","), "build inherits the whole list");
  });

  /* ---------------------------------------------------------------- *
   * Wave 60 - Build runs twice                                         *
   * ---------------------------------------------------------------- */

  test("ladder: Build adds one unit per land below wave 60", () => {
    const state = boardAt(59, { build: ["wetlands"], explore: [] });
    setLand(state, "1", { explorers: 1 }, 0);

    engine.resolveBuildPhase(state);
    assertEqual(state.invaders["1"].towns, 1, "one town built");
    assertEqual(state.invaders["1"].cities, 0, "and nothing above it");
  });

  test("ladder: from wave 60 Build runs twice, and the second pass reads the first", () => {
    const state = boardAt(60, { build: ["wetlands"], explore: [] });
    setLand(state, "1", { explorers: 1 }, 0);

    engine.resolveBuildPhase(state);
    // Pass one sees towns 0 / cities 0 and builds a Town. Pass two sees towns 1 > cities 0
    // and builds a City - which is the whole reason it is a second pass and not a doubled
    // count.
    assertEqual(state.invaders["1"].towns, 1, "a town from the first pass");
    assertEqual(state.invaders["1"].cities, 1, "and a city from the second");
  });

  test("ladder: a doubled Build still builds nothing in an empty land", () => {
    const state = boardAt(60, { build: ["wetlands"], explore: [] });
    engine.resolveBuildPhase(state);
    assertEqual(state.invaders["1"].towns, 0, "Build needs something to build on");
    assertEqual(state.invaders["7"].towns, 0, "in both lands of the terrain");
  });

  /* ---------------------------------------------------------------- *
   * Waves 90 / 100 and up - Invaders hit harder, then get tougher      *
   * ---------------------------------------------------------------- */

  test("ladder: invader damage rises at 90 and every 20 waves after", () => {
    const damageAt = (wave) => engine.unitStats(boardAt(wave, { build: [], explore: [] }), "explorers").damage;
    assertEqual(damageAt(89), 1, "wave 89");
    assertEqual(damageAt(90), 2, "wave 90");
    assertEqual(damageAt(109), 2, "wave 109");
    assertEqual(damageAt(110), 3, "wave 110");
    assertEqual(damageAt(130), 4, "wave 130");
  });

  test("ladder: invader health rises at 100 and every 20 waves after", () => {
    const healthAt = (wave) => engine.unitStats(boardAt(wave, { build: [], explore: [] }), "explorers").health;
    assertEqual(healthAt(99), 1, "wave 99");
    assertEqual(healthAt(100), 2, "wave 100");
    assertEqual(healthAt(119), 2, "wave 119");
    assertEqual(healthAt(120), 3, "wave 120");
  });

  test("ladder: the two stat rungs alternate every ten waves once both are live", () => {
    const at = (wave) => {
      const state = boardAt(wave, { build: [], explore: [] });
      const s = engine.unitStats(state, "cities");
      return `${s.damage}/${s.health}`;
    };
    assertEqual(at(90), "4/3", "damage only");
    assertEqual(at(100), "4/4", "health catches up");
    assertEqual(at(110), "5/4", "damage again");
    assertEqual(at(120), "5/5", "health again");
  });

  test("ladder: the Dahan never ride the ladder", () => {
    const state = boardAt(200, { build: [], explore: [] });
    const dahan = engine.unitStats(state, "dahan");
    assertEqual(dahan.damage, engine.UNIT_STATS.dahan.damage, "damage unchanged");
    assertEqual(dahan.health, engine.UNIT_STATS.dahan.health, "health unchanged");
  });

  test("ladder: a tougher invader is worth proportionally more to kill", () => {
    // Power is read off damage, so a damage rung raises Fear and Energy in the same stroke -
    // an invader that hits twice as hard is not simply worse news.
    const state = boardAt(90, { build: [], explore: [] });
    clearBoard(state);
    state.round.fearEarned = 0;
    state.resources.energy = 0;
    setLand(state, "3", { explorers: 1 }, 0);

    engine.applyDamage(state, "3", engine.unitStats(state, "explorers").health);
    assertEqual(state.invaders["3"].explorers, 0, "the explorer fell");
    assertEqual(state.round.fearEarned, 2 * engine.FEAR_PER_POWER, "worth 2 at the first damage rung");
    assertEqual(state.resources.energy, 2 * engine.ENERGY_PER_POWER, "and 2 Energy alongside");
  });

  test("ladder: a scaled invader takes its extra hit point to kill", () => {
    const state = boardAt(100, { build: [], explore: [] });
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);

    engine.applyDamage(state, "3", 1);
    assertEqual(state.invaders["3"].explorers, 1, "one damage only wounds it now");

    engine.applyDamage(state, "3", 1);
    assertEqual(state.invaders["3"].explorers, 0, "the second finishes it");
  });

  test("ladder: normalizing a scaled board does not heal it", () => {
    // The wound cap is the unit's *current* health. Normalizing against the shipped health
    // would clamp a wound the extra hit point allowed straight back down to zero.
    const state = boardAt(100, { build: [], explore: [] });
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);
    engine.applyDamage(state, "3", 1);

    assertEqual(state.invaderDamage["3"].explorers[0], 1, "the wound is on the books");
    state.invaderDamage = engine.normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);
    assertEqual(state.invaderDamage["3"].explorers[0], 1, "and survives normalization");
  });

  /* ---------------------------------------------------------------- *
   * The rungs are per round, not per run                               *
   * ---------------------------------------------------------------- */

  test("ladder: the auto-caster's scratch board fights the same invaders the real one does", () => {
    // cloneCombatState carries the wave count for exactly this reason: a scratch board that
    // dropped it would rate a land as clearable against wave-1 invaders and spend a real
    // cooldown on a cast that leaves the land standing.
    const state = boardAt(100, { build: [], explore: [] });
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);

    const scratch = engine.cloneCombatState(state);
    assertEqual(
      engine.unitStats(scratch, "explorers").health,
      engine.unitStats(state, "explorers").health,
      "the copy is as tough as the original"
    );

    // One damage wounds but does not kill at this rung, on either board.
    engine.applyDamage(scratch, "3", 1);
    assertEqual(scratch.invaders["3"].explorers, 1, "the scratch explorer survived, as it should");
  });

  test("ladder: a new round starts back at the bottom rung", () => {
    const { state } = newGame();
    state.round.wavesResolved = 120;
    assertEqual(engine.exploreTerrainCount(state), engine.INVADER_TERRAINS.length, "deep in the round");

    state.round.number = 40;
    engine.startRound(state);

    assertEqual(state.round.wavesResolved, 0, "the wave counter resets");
    assertEqual(engine.exploreTerrainCount(state), 1, "and so does the ladder");
    assertEqual(engine.unitStats(state, "explorers").damage, 1, "invaders are back to base damage");
    assertEqual(engine.unitStats(state, "explorers").health, 1, "and base health");
  });
})();
