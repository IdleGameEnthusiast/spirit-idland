/* Board invariants - docs/spec/09-island-board.md.
 *
 * These held for the turn-based build and are asserted again here rather than assumed:
 * the redesign changed how the board is acted on, and a board table is exactly the kind of
 * data that gets edited by hand. */

(function () {
  const { engine, test, assert, assertEqual } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("board: eight lands", () => {
    assertEqual(engine.LAND_IDS.length, 8, "land count");
  });

  test("board: land ids are strings 1..8", () => {
    assert(engine.LAND_IDS.every((id) => typeof id === "string"), "ids must be strings");
    assertEqual(engine.LAND_IDS.join(","), "1,2,3,4,5,6,7,8", "id order");
  });

  test("board: exactly two lands per terrain", () => {
    for (const terrain of engine.INVADER_TERRAINS) {
      assertEqual(engine.landsOfTerrain(terrain).length, 2, `${terrain} land count`);
    }
  });

  test("board: exactly three coastal lands", () => {
    const coastal = engine.LAND_IDS.filter((id) => engine.landIsCoastal(id));
    assertEqual(coastal.length, 3, "coastal count");
  });

  test("board: mountains has no coastal land", () => {
    const coastalMountains = engine.landsOfTerrain("mountains").filter((id) => engine.landIsCoastal(id));
    assertEqual(coastalMountains.length, 0, "mountains must be landlocked");
  });

  test("board: adjacency is symmetric", () => {
    for (const landId of engine.LAND_IDS) {
      for (const neighbour of engine.adjacentLands(landId)) {
        assert(engine.areAdjacent(neighbour, landId), `${neighbour} must list ${landId} back`);
      }
    }
  });

  test("board: no land is adjacent to itself", () => {
    for (const landId of engine.LAND_IDS) {
      assert(!engine.adjacentLands(landId).includes(landId), `${landId} adjacent to itself`);
    }
  });

  test("board: the two lands of a terrain are never adjacent", () => {
    for (const terrain of engine.INVADER_TERRAINS) {
      const [a, b] = engine.landsOfTerrain(terrain);
      assert(!engine.areAdjacent(a, b), `${terrain} lands ${a}/${b} must not touch`);
    }
  });

  test("board: fourteen edges", () => {
    let ends = 0;
    for (const landId of engine.LAND_IDS) ends += engine.adjacentLands(landId).length;
    assertEqual(ends / 2, 14, "edge count");
  });

  test("board: land 5 is the six-neighbour hub and land 3 the corner", () => {
    assertEqual(engine.adjacentLands("5").length, 6, "land 5 degree");
    assertEqual(engine.adjacentLands("3").length, 2, "land 3 degree");
  });

  test("board: every terrain has a hue", () => {
    for (const terrain of engine.INVADER_TERRAINS) {
      assert(typeof engine.TERRAIN_RGB[terrain] === "string", `${terrain} needs a hue`);
    }
  });
})();
