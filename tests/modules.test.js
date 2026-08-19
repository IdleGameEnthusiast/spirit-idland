/* Checks on the engine's own arrangement, rather than on any rule it implements.
 *
 * The engine is split across engine/*.js plus i18n.js, loaded as classic scripts in an
 * order both index.html and tests.html spell out by hand. There is no build step to keep
 * those two lists in step, so the drift is checked here instead.
 *
 * The first check is the cheap one and it runs everywhere: the export shim is built from
 * bare identifiers, so if any module failed to load, `const ENGINE_EXPORTS = { ... }` has
 * already thrown a ReferenceError before this file runs. What is left to catch is a name
 * that survives as `undefined` - a rename that missed engine/exports.js.
 *
 * The second only runs under node, which is the only place a test can read index.html. */

(function () {
  const { engine, test, assert, assertDeepEqual } = typeof require === "function"
    ? require("./harness.js")
    : window.SpiritTests;

  test("every exported name resolves to a value", () => {
    const missing = Object.keys(engine).filter((name) => engine[name] === undefined);
    assert(
      missing.length === 0,
      `engine/exports.js lists names that are undefined: ${missing.join(", ")}`
    );
  });

  test("the export shim reaches every module", () => {
    // One name from each file in the load order. If a module is dropped from index.html
    // the shim throws before this runs; this states the intent so the reason is readable.
    const perModule = {
      "engine/constants.js": "VERSION",
      "engine/content.js": "ABILITIES",
      "engine/board.js": "LAND_IDS",
      "engine/text.js": "abilityName",
      "engine/state.js": "createInvaderDamage",
      "engine/upgrades.js": "upgradeCost",
      "engine/abilities.js": "triggerAbility",
      "engine/cards.js": "drawPowerCard",
      "engine/combat.js": "applyDamage",
      "engine/round.js": "tick",
      "engine/save.js": "createInitialState"
    };
    const absent = Object.entries(perModule)
      .filter(([, name]) => engine[name] === undefined)
      .map(([file, name]) => `${file} (${name})`);
    assert(absent.length === 0, `not exported, so possibly not loaded: ${absent.join(", ")}`);
  });

  if (typeof require === "function") {
    test("index.html and tests.html load the same engine modules in the same order", () => {
      const { engineScriptList } = require("./load-engine.js");
      assertDeepEqual(
        engineScriptList("tests.html"),
        engineScriptList("index.html"),
        "the engine script lists in tests.html and index.html have drifted apart"
      );
    });
  }
})();
