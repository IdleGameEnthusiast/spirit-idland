/* Land state rules - docs/spec/06-ui-contract.md#land-state-rules
 *
 * The precedence is a rule, not styling, so it is asserted here rather than eyeballed. */

(function () {
  const { engine, test, assert, assertEqual, newGame, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("landstate: with nothing armed, the next wave's lands read as wave-active", () => {
    const { state } = newGame();
    state.invader = { ravage: "jungle", build: "desert", explore: "mountains" };
    state.ui.selectedLand = "1";

    const states = engine.landRenderStates(state);
    assertEqual(states["3"], "wave-active", "coastal jungle");
    assertEqual(states["5"], "wave-active", "inland jungle");
    assertEqual(states["1"], "selected", "the selected land");
    assertEqual(states["2"], "idle", "everything else");
  });

  test("landstate: nothing is dimmed while no ability is armed", () => {
    const { state } = newGame();
    state.invader = { ravage: "jungle", build: null, explore: "mountains" };

    const states = engine.landRenderStates(state);
    assert(!Object.values(states).includes("out"), "dimming only teaches a targeting rule");
  });

  test("landstate: an armed ability splits the board into legal and dimmed", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    setLand(state, "6", { explorers: 1 }, 0);
    state.invader = { ravage: "jungle", build: null, explore: null };
    state.ui.selectedLand = "1";

    engine.triggerAbility(state, "flash_floods");
    const states = engine.landRenderStates(state);

    assertEqual(states["3"], "legal", "holds invaders");
    assertEqual(states["6"], "legal", "holds invaders");
    assertEqual(states["1"], "out", "selected but not a legal target");
    assertEqual(states["5"], "out", "wave target but not a legal target");
  });

  test("landstate: an ability that takes any land marks every land legal", () => {
    const { state } = newGame();
    engine.triggerAbility(state, "rivers_bounty");

    const states = engine.landRenderStates(state);
    for (const landId of engine.LAND_IDS) {
      assertEqual(states[landId], "legal", `land ${landId}`);
    }
  });

  test("landstate: an ended round marks no land as a wave target", () => {
    const { state } = newGame();
    state.invader = { ravage: "jungle", build: null, explore: null };
    engine.endRound(state);

    const states = engine.landRenderStates(state);
    assert(!Object.values(states).includes("wave-active"), "a frozen board has no incoming wave");
  });

  test("landstate: selection falls back to a wave target, then to land 1", () => {
    const { state } = newGame();
    state.ui.selectedLand = null;
    state.invader = { ravage: "jungle", build: null, explore: null };
    assertEqual(engine.effectiveSelectedLand(state), "3", "first land of the ravage terrain");

    state.invader = { ravage: null, build: null, explore: "jungle" };
    assertEqual(engine.effectiveSelectedLand(state), "1", "nothing incoming yet");

    state.ui.selectedLand = "7";
    assertEqual(engine.effectiveSelectedLand(state), "7", "an explicit selection always wins");
  });
})();
