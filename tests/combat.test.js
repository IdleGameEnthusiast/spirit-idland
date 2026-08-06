/* Combat checks - docs/spec/08-acceptance-tests.md#combat-checks
 *
 * The fight is continuous now: no Ravage phase, no damage tick. Invaders grind every land
 * they stand in, every moment, and the two consequences - Blight rising and Dahan falling -
 * accrue as fractions. These checks pin the rates, because the rates are the whole design. */

(function () {
  const { engine, test, assert, assertEqual, assertClose, assertDeepEqual, newGame, clearBoard, setLand, healthOf } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* Runs the continuous fight for `seconds` in small slices, the way the real clock does.
   * Returns the elapsed time, so a test can assert when something landed rather than just
   * that it did. */
  function burn(state, seconds, stepSeconds) {
    const step = stepSeconds || 0.05;
    let elapsed = 0;
    while (elapsed < seconds - 1e-9) {
      const dt = Math.min(step, seconds - elapsed);
      engine.resolveContinuousCombat(state, dt);
      elapsed += dt;
    }
    return elapsed;
  }

  /* Burns until `done` reports true, or the cap trips. The cap is what turns "this never
   * happens" into a failing assertion instead of a hung suite. */
  function burnUntil(state, done, capSeconds, stepSeconds) {
    const step = stepSeconds || 0.05;
    const cap = capSeconds || 300;
    let elapsed = 0;
    while (!done() && elapsed < cap) {
      engine.resolveContinuousCombat(state, step);
      elapsed += step;
    }
    return elapsed;
  }

  /* ---------------------------------------------------------------- *
   * Blight, as a rate                                                  *
   * ---------------------------------------------------------------- */

  test("combat: invader damage is a per-second rate, explorer 1, town 2, city 3", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 0);

    const p = engine.landPressure(state, "3");
    assertEqual(p.gross, 6, "one of each is 6 damage per second");
    assertClose(p.blightPerSecond, 0.12 / engine.TIME_SCALE, 0.0001, "6 damage is 12% of a Blight a beat");
  });

  test("combat: an undefended land takes its first Blight after about 8.3 beats", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 0);

    // 6 damage at 2% each: 12% a beat, so a whole Blight lands 1 / 0.12 beats in. Written
    // against the beat rather than the second so the figure is the tuned one, and turning
    // TIME_SCALE moves the stopwatch here exactly as it moves it in the game.
    const at = burnUntil(state, () => state.round.blightByLand["3"] > 0, 30 * engine.TIME_SCALE, 0.01);
    assertClose(at, engine.TIME_SCALE / 0.12, 0.05, "first Blight timing");
    assertEqual(state.round.blight, 1, "exactly one Blight, not a burst of them");
  });

  test("combat: each Dahan cancels 2 damage before any Blight accrues", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 2);

    const p = engine.landPressure(state, "3");
    assertEqual(p.defence, 4, "two Dahan cancel four damage");
    assertEqual(p.net, 2, "six gross minus four defence");
    assertClose(p.blightPerSecond, 0.04 / engine.TIME_SCALE, 0.0001, "2 net damage is 4% a beat");
  });

  test("combat: Dahan that out-damage the invaders hold the land, but it still seeps", () => {
    const { state } = newGame();
    clearBoard(state);
    // 3 damage against 2 Dahan cancelling 4: the defence covers all of it, and the floor
    // still lets a quarter through. Defence buys time, never immunity.
    setLand(state, "3", { cities: 1 }, 2);

    const p = engine.landPressure(state, "3");
    assert(p.held, "the Dahan are cancelling everything they can");
    assertClose(p.net, 3 * engine.BLIGHT_FLOOR_FRACTION, 0.0001, "the floor sets the rate");
    assertClose(p.blightPerSecond, 0.015 / engine.TIME_SCALE, 0.0001, "0.75 damage is 1.5% a beat");

    burn(state, 20 * engine.TIME_SCALE);
    assertEqual(state.round.blight, 0, "no Blight yet, 20 beats in");
    const at = burnUntil(state, () => state.round.blight > 0, 200 * engine.TIME_SCALE, 0.05);
    assert(at > 0, "a held land blights eventually");
  });

  test("combat: the Blight floor scales with the invaders, not with a flat number", () => {
    const { state } = newGame();
    clearBoard(state);
    // Both lands are fully held. The one under heavier invaders seeps faster, so parking a
    // bigger stack on a bigger threat does not make the threat go away.
    setLand(state, "3", { cities: 1 }, 2);
    setLand(state, "5", { explorers: 1, towns: 1, cities: 1 }, 4);

    const light = engine.landPressure(state, "3");
    const heavy = engine.landPressure(state, "5");
    assert(light.held && heavy.held, "both lands are held");
    assert(heavy.blightPerSecond > light.blightPerSecond, "heavier invaders seep faster");
    assertClose(heavy.blightPerSecond / light.blightPerSecond, 2, 0.0001, "6 gross against 3 is twice the seepage");
  });

  test("combat: a land with no invaders never blights", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", null, 2);

    burn(state, 60);
    assertEqual(state.round.blight, 0, "empty land");
    assertEqual(state.dahan["3"], 2, "and its Dahan are never in danger");
  });

  test("combat: the bar carries its remainder rather than resetting", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);

    // 3 damage is 6% a beat. One beat past the first Blight, the bar must read the overshoot,
    // not zero - discarding it would lose a whole Blight over a long round.
    burnUntil(state, () => state.round.blightByLand["3"] > 0, 60 * engine.TIME_SCALE, 0.01);
    burn(state, engine.TIME_SCALE, 0.01);
    assertClose(state.round.blightProgress["3"], 0.06, 0.005, "carried remainder plus one beat");
  });

  test("combat: Blight accrues in every land at once, with no terrain picked", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "1", { cities: 1 }, 0);
    setLand(state, "3", { cities: 1 }, 0);
    setLand(state, "6", { cities: 1 }, 0);

    burnUntil(state, () => state.round.blight >= 3, 60 * engine.TIME_SCALE, 0.01);
    for (const landId of ["1", "3", "6"]) {
      assertEqual(state.round.blightByLand[landId], 1, `land ${landId} blighted on the same clock`);
    }
  });

  /* ---------------------------------------------------------------- *
   * Dahan casualties                                                   *
   * ---------------------------------------------------------------- */

  test("combat: Dahan take the gross damage, not what got past their defence", () => {
    const { state } = newGame();
    clearBoard(state);
    // Fully absorbed for Blight purposes, but the invaders are still swinging at them.
    setLand(state, "3", { cities: 1 }, 2);

    const p = engine.landPressure(state, "3");
    assert(p.held, "the defence covers the whole attack");
    assertClose(p.net, 3 * engine.BLIGHT_FLOOR_FRACTION, 0.0001, "only the floor gets through");
    assert(p.dahanPerSecond > 0, "the Dahan are still dying");
  });

  test("combat: casualties run at a flat rate, whatever the stack size", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 1);
    setLand(state, "5", { explorers: 1, towns: 1, cities: 1 }, 6);

    const one = engine.landPressure(state, "3");
    const many = engine.landPressure(state, "5");

    // A deep stack holds more Blight off, but its people fall at the same speed as a lone
    // defender's. No spiral downward and no discount for depth: lifetime is linear in size.
    assertClose(many.dahanPerSecond, one.dahanPerSecond, 0.0001, "same casualty rate");
    assertClose(one.dahanPerSecond, one.gross * engine.DAHAN_LOSS_PER_DAMAGE_SECOND, 0.0001, "rate is gross");
    assert(many.defence > one.defence, "the bigger stack still cancels more damage");
  });

  test("combat: a stack twice the size lasts exactly twice as long", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 2);
    const small = burnUntil(state, () => state.dahan["3"] === 0, 300, 0.01);

    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 4);
    const big = burnUntil(state, () => state.dahan["3"] === 0, 300, 0.01);

    // Strictly linear. Under the old concentrated rule this ratio was 3.33 and climbing with
    // every Dahan added, which is what let one reinforcement tier double a round's length.
    assertClose(big / small, 2, 0.05, `twice the Dahan bought ${(big / small).toFixed(2)}x the time`);
  });

  test("combat: every defender falls at the same rate, with no spiral", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 2);

    // 6 gross damage is 30% of a casualty a beat whatever is standing there, so both Dahan
    // take the same 1/0.30 beats to fall. Losing one no longer speeds up losing the next.
    const first = burnUntil(state, () => state.dahan["3"] < 2, 120 * engine.TIME_SCALE, 0.01);
    assertClose(first, engine.TIME_SCALE / 0.30, 0.05, "first casualty");

    const second = burnUntil(state, () => state.dahan["3"] < 1, 120 * engine.TIME_SCALE, 0.01);
    assertClose(second, engine.TIME_SCALE / 0.30, 0.05, "second casualty takes just as long");
  });

  test("combat: losing a Dahan speeds the Blight up behind it", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 1, cities: 1 }, 2);

    const before = engine.landPressure(state, "3").blightPerSecond;
    burnUntil(state, () => state.dahan["3"] < 2, 120 * engine.TIME_SCALE, 0.01);
    const after = engine.landPressure(state, "3").blightPerSecond;

    assertClose(before, 0.04 / engine.TIME_SCALE, 0.0001, "2 Dahan hold it to 4% a beat");
    assertClose(after, 0.08 / engine.TIME_SCALE, 0.0001, "1 Dahan lets 8% through");
  });

  test("combat: the casualty bar clears when the last Dahan falls", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 1);

    burnUntil(state, () => state.dahan["3"] === 0, 120, 0.01);
    assertEqual(state.round.dahanProgress["3"], 0, "reinforcements arrive at a full bar");
  });

  test("combat: Dahan in a land with no invaders take nothing", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", null, 2);

    burn(state, 120);
    assertEqual(state.dahan["3"], 2, "both still standing");
  });

  /* ---------------------------------------------------------------- *
   * The Dahan strike                                                   *
   * ---------------------------------------------------------------- */

  test("combat: the Dahan strike is on its own timer, not the wave's", () => {
    const ctx = newGame();
    const { state } = ctx;
    // Equal today by choice, but they are separate constants and the shop will move one of
    // them. A test that read WAVE_INTERVAL_SECONDS here would hide that.
    assert(engine.DAHAN_ATTACK_INTERVAL_SECONDS > 0, "the strike has an interval of its own");
    assertEqual(state.round.dahanAttackRemaining, engine.DAHAN_ATTACK_INTERVAL_SECONDS, "armed at round start");
  });

  test("combat: each Dahan deals 1 damage per strike", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 2);

    engine.resolveDahanAttack(state);
    // 2 Dahan for 1 each is 2 damage, which is exactly a town's health.
    assertEqual(state.invaders["3"].towns, 0, "the town falls to a two-Dahan strike");
  });

  test("combat: the strike buys the biggest kill it can afford", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, cities: 1 }, 0);

    engine.spendDahanAttack(state, "3", 3);
    assertEqual(state.invaders["3"].cities, 0, "3 damage is exactly a city, so it takes the city");
    assertEqual(state.invaders["3"].explorers, 1, "and the pool was spent before the explorer");
  });

  test("combat: the strike keeps killing while the pool lasts", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 1 }, 0);

    engine.spendDahanAttack(state, "3", 4);
    assertEqual(state.invaders["3"].towns, 0, "the town falls first, as the biggest kill 4 can buy");
    assertEqual(state.invaders["3"].explorers, 0, "then both explorers to the remaining 2");
  });

  test("combat: the strike takes a town over scratching a city", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1, cities: 1 }, 0);

    // The old rule spent this on the city and killed nothing. Killing is what pays Fear and
    // Energy, so damage that can buy a kill now does.
    engine.spendDahanAttack(state, "3", 2);
    assertEqual(state.invaders["3"].towns, 0, "the town died");
    assertDeepEqual(healthOf(state, "3", "cities"), [3], "the city was never touched");
  });

  test("combat: a land with no Dahan never strikes", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 2 }, 0);

    engine.resolveDahanAttack(state);
    assertEqual(state.invaders["3"].towns, 2, "the towns are untouched");
  });

  test("combat: the strike fires on schedule while the round runs", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    // A city outlasts one strike from two Dahan (2 of 3 health) and falls to the second, so
    // the count of strikes is readable off the board rather than the log.
    //
    // Three go in to leave two standing at the strike: a city is 3 damage a second, which is
    // 0.15 of a casualty a second whatever the stack size, so one of them falls at 6.7s.
    setLand(state, "3", { cities: 1 }, 3);

    const { advance } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;
    advance(ctx, engine.DAHAN_ATTACK_INTERVAL_SECONDS - 0.5, 0.1);
    assertEqual(state.invaders["3"].cities, 1, "nothing before the interval elapses");

    advance(ctx, 1, 0.1);
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "the first strike left the city at 1 health");
  });

  test("combat: a defeated invader awards Fear by its power", () => {
    const { state } = newGame();
    clearBoard(state);
    state.meta.fear = 0;
    setLand(state, "3", { towns: 1 }, 2);

    engine.resolveDahanAttack(state);
    assertEqual(state.invaders["3"].towns, 0, "the town fell");
    assertEqual(state.meta.fear, 2 * engine.FEAR_PER_POWER, "fear for one town");
  });

  test("combat: fear per unit is its power, in whole numbers", () => {
    const { state } = newGame();
    clearBoard(state);

    state.meta.fear = 0;
    setLand(state, "3", { explorers: 1 }, 0);
    engine.applyDamage(state, "3", 1);
    assertEqual(state.meta.fear, 1, "explorer");

    state.meta.fear = 0;
    setLand(state, "3", { towns: 1 }, 0);
    engine.applyDamage(state, "3", 2);
    assertEqual(state.meta.fear, 2, "town");

    state.meta.fear = 0;
    setLand(state, "3", { cities: 1 }, 0);
    engine.applyDamage(state, "3", 3);
    assertEqual(state.meta.fear, 3, "city");
  });

  test("combat: a wound on an invader persists across waves within a round", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);

    engine.applyDamage(state, "3", 2);
    assertEqual(state.invaders["3"].cities, 1, "the city survives 2 of its 3 health");
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "1 health left");

    state.invader = { build: "wetlands", explore: "desert" };
    engine.resolveWave(state);
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "still wounded a wave later");

    engine.applyDamage(state, "3", 1);
    assertEqual(state.invaders["3"].cities, 0, "and the last point finishes it");
  });

  test("combat: two units of a type carry their wounds separately", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { cities: 2 }, 0);

    // No kill is possible at 1 damage a time, so each point lands on the strongest thing
    // standing - and within the tier, on the one already closest to falling.
    engine.applyDamage(state, "3", 1);
    engine.applyDamage(state, "3", 1);
    assertDeepEqual(healthOf(state, "3", "cities"), [1, 3], "one city at 1, the other untouched");

    engine.applyDamage(state, "3", 1);
    assertEqual(state.invaders["3"].cities, 1, "the wounded one fell");
    assertDeepEqual(healthOf(state, "3", "cities"), [3], "leaving the healthy one whole");
  });

  test("combat: the wound list holds one entry per living unit, whatever happened", () => {
    const ctx = newGame();
    const { state } = ctx;
    const { advance, unlockAllAbilities } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;
    unlockAllAbilities(state);

    // Waves build and discover, the Dahan strike kills, and abilities push units between
    // lands. Every one of those has to keep the count and the wound list in step - a phase
    // that incremented the count alone would leave the board describing units that are not
    // there, and the health rings reading off the wrong unit.
    advance(ctx, 45, 0.5);

    for (const landId of engine.LAND_IDS) {
      for (const type of engine.INVADER_TYPES) {
        const wounds = state.invaderDamage[landId][type];
        assert(Array.isArray(wounds), `land ${landId} ${type} wound list is an array`);
        assertEqual(wounds.length, state.invaders[landId][type], `land ${landId} ${type} wound list length`);
        for (const damage of wounds) {
          assert(
            damage >= 0 && damage < engine.UNIT_STATS[type].health,
            `land ${landId} ${type} wound ${damage} is outside its unit's health`
          );
        }
      }
    }
  });

  test("combat: nothing is left pending after a strike", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 2 }, 3);

    engine.resolveDahanAttack(state);
    assertEqual(state.pendingAbilityTarget, null, "no pending target");
    assert(!("effects" in state), "the turn-based effects object must be gone");
  });
})();
