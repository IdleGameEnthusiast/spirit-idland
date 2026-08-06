/* Ability checks - docs/spec/08-acceptance-tests.md#ability-checks */

(function () {
  const { engine, test, assert, assertEqual, assertClose, newGame, advance, clearBoard, setLand } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  test("ability: every ability starts ready", () => {
    const { state } = newGame();
    for (const abilityId of engine.unlockedAbilityIds(state)) {
      assert(engine.abilityIsReady(state, abilityId), `${abilityId} should start ready`);
    }
  });

  test("ability: triggering a no-target ability resolves immediately and spends the cooldown", () => {
    const { state } = newGame();
    state.abilities.flash_floods.cooldownRemaining = 8;

    const ok = engine.triggerAbility(state, "boon_of_vigor");
    assert(ok, "trigger should succeed");
    assertEqual(state.pendingAbilityTarget, null, "no target is armed");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 3, "boon cut 5s off the other cooldown");
    assertEqual(
      state.abilities.boon_of_vigor.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "boon_of_vigor"),
      "boon went on cooldown"
    );
  });

  test("ability: an ability on cooldown cannot be triggered", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    const spent = state.abilities.flash_floods.cooldownRemaining;
    assert(spent > 0, "cooldown should be running");

    const again = engine.triggerAbility(state, "flash_floods");
    assert(!again, "a cooling ability must refuse");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, spent, "cooldown untouched by the refusal");
  });

  test("ability: cooldowns tick down in real time, independently of the wave timer", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    const full = engine.abilityCooldownSeconds(state, "flash_floods");

    advance(ctx, 4);
    assertClose(state.abilities.flash_floods.cooldownRemaining, full - 4, 0.01, "after 4 seconds");
    assert(state.round.wavesResolved === 0, "no wave has resolved yet, so the two clocks are independent");

    advance(ctx, full);
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown bottoms out at zero");
    assert(engine.abilityIsReady(state, "flash_floods"), "ready again");
  });

  test("ability: a targeted ability arms rather than resolving", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    assertEqual(state.pendingAbilityTarget, "flash_floods", "armed");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "arming must not spend the cooldown");
    assertEqual(state.invaders["3"].towns, 1, "nothing has happened to the board yet");
  });

  test("ability: clicking an armed ability again cancels it without spending the cooldown", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.triggerAbility(state, "flash_floods");

    assertEqual(state.pendingAbilityTarget, null, "disarmed");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: an armed ability resolves on a legal land click", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "resolve should succeed");
    assertEqual(state.pendingAbilityTarget, null, "disarmed after resolving");
    assertEqual(state.invaders["3"].towns, 0, "the town took 2 damage and fell");
    assert(state.abilities.flash_floods.cooldownRemaining > 0, "cooldown spent");
  });

  test("ability: an illegal land click does not resolve and does not disarm", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    const ok = engine.resolveAbilityTarget(state, "5");

    assert(!ok, "an empty land is not a legal Flash Floods target");
    assertEqual(state.pendingAbilityTarget, "flash_floods", "still armed, so the player can try again");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: triggering with no legal target logs and leaves the cooldown unspent", () => {
    const { state } = newGame();
    clearBoard(state);

    const ok = engine.triggerAbility(state, "flash_floods");
    assert(!ok, "there is nothing to hit");
    assertEqual(state.pendingAbilityTarget, null, "must not arm");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: flash floods hits the strongest type present", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 1, cities: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].cities, 1, "the city survives 2 of its 3 health");
    assertEqual(state.invaderDamage["3"].cities, 2, "and carries the damage");
    assertEqual(state.invaders["3"].explorers, 2, "explorers untouched");
  });

  test("ability: river's bounty accepts any land and adds Dahan", () => {
    const { state } = newGame();
    clearBoard(state);

    assertEqual(engine.abilityLegalLands(state, "rivers_bounty").length, 8, "every land is legal");

    engine.triggerAbility(state, "rivers_bounty");
    engine.resolveAbilityTarget(state, "7");
    assertEqual(state.dahan["7"], 2, "+2 Dahan");
  });

  test("ability: wash away moves units out of the most-Blighted land", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { explorers: 2, towns: 1, cities: 1 }, 0);
    setLand(state, "3", { explorers: 1 }, 0);
    state.round.blightByLand["5"] = 3;
    state.round.blightByLand["3"] = 1;
    state.round.blight = 4;

    const ok = engine.triggerAbility(state, "wash_away");
    assert(ok, "wash away should resolve");
    assertEqual(state.invaders["5"].explorers, 0, "explorers pushed out");
    assertEqual(state.invaders["5"].towns, 0, "towns pushed out");
    assertEqual(state.invaders["5"].cities, 1, "the city stays put");

    const moved = engine.LAND_IDS
      .filter((id) => id !== "5")
      .reduce((sum, id) => sum + state.invaders[id].explorers + state.invaders[id].towns, 0);
    assertEqual(moved, 4, "three pushed units plus the explorer already in land 3");
  });

  test("ability: wash away only ever pushes into an adjacent land", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { explorers: 2 }, 0);
    state.round.blightByLand["3"] = 2;
    state.round.blight = 2;

    engine.triggerAbility(state, "wash_away");

    const receivers = engine.LAND_IDS.filter((id) => id !== "3" && state.invaders[id].explorers > 0);
    assertEqual(receivers.length, 1, "exactly one destination");
    assert(engine.areAdjacent("3", receivers[0]), `${receivers[0]} must border land 3`);
  });

  test("ability: wash away finds no target when nothing is Blighted yet", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "5", { explorers: 3 }, 0);

    const ok = engine.triggerAbility(state, "wash_away");
    assert(!ok, "no Blighted land means no target");
    assertEqual(state.abilities.wash_away.cooldownRemaining, 0, "cooldown unspent");
    assertEqual(state.invaders["5"].explorers, 3, "board untouched");
  });

  test("ability: nothing can be triggered once the round has ended", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    engine.endRound(state);

    assert(!engine.triggerAbility(state, "flash_floods"), "trigger must refuse");
    assert(!engine.triggerAbility(state, "boon_of_vigor"), "no-target trigger must refuse too");
  });

  test("ability: a defeat by an ability awards Fear the same as a Dahan strike", () => {
    const { state } = newGame();
    clearBoard(state);
    state.meta.fear = 0;
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertClose(state.meta.fear, 2 * engine.FEAR_PER_POWER, 0.0001, "a town is worth 0.7 either way");
  });
})();
