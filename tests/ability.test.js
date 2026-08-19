/* Ability checks - docs/spec/08-acceptance-tests.md#ability-checks */

(function () {
  const {
    engine, test, assert, assertEqual, assertClose, assertDeepEqual,
    newGame, advance, clearBoard, setLand, woundUnit, healthOf,
    unlockAllAbilities, setAbilityTier, grantUpgrade
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  /* A game with the spirit's whole kit granted. Most of what follows is about what an
   * ability does, not about what it cost, so the Energy lock is paid off up front. The
   * lock itself is asserted in its own block at the end. */
  function fullKit(options) {
    const ctx = newGame(options);
    unlockAllAbilities(ctx.state);
    return ctx;
  }

  test("ability: every unlocked ability starts ready", () => {
    const { state } = fullKit();
    for (const abilityId of engine.unlockedAbilityIds(state)) {
      assert(engine.abilityIsReady(state, abilityId), `${abilityId} should start ready`);
    }
  });

  test("ability: triggering a no-target ability resolves immediately and spends the cooldown", () => {
    const { state } = fullKit();
    state.resources.energy = 0;

    const ok = engine.triggerAbility(state, "boon_of_vigor");
    assert(ok, "trigger should succeed");
    assertEqual(state.pendingAbilityTarget, null, "no target is armed");
    assertEqual(state.resources.energy, 1, "Boon of Vigor is a faucet now: +1 Energy");
    assertEqual(
      state.abilities.boon_of_vigor.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "boon_of_vigor"),
      "boon went on cooldown"
    );
  });

  test("ability: an ability on cooldown cannot be triggered", () => {
    const { state } = fullKit();
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
    const ctx = fullKit();
    const { state } = ctx;
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    const full = engine.abilityCooldownSeconds(state, "flash_floods");

    advance(ctx, 4);
    assertClose(state.abilities.flash_floods.cooldownRemaining, full - 4, 0.01, "after 4 seconds");

    advance(ctx, full);
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown bottoms out at zero");
    assert(engine.abilityIsReady(state, "flash_floods"), "ready again");
  });

  test("ability: a targeted ability arms rather than resolving", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    assertEqual(state.pendingAbilityTarget, "flash_floods", "armed");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "arming must not spend the cooldown");
    assertEqual(state.invaders["3"].towns, 1, "nothing has happened to the board yet");
  });

  test("ability: clicking an armed ability again cancels it without spending the cooldown", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.triggerAbility(state, "flash_floods");

    assertEqual(state.pendingAbilityTarget, null, "disarmed");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: an armed ability resolves on a legal land click", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);   // land 3 is coastal, so Flash Floods deals 2

    engine.triggerAbility(state, "flash_floods");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "resolve should succeed");
    assertEqual(state.pendingAbilityTarget, null, "disarmed after resolving");
    assertEqual(state.invaders["3"].towns, 0, "the town took 2 damage and fell");
    assert(state.abilities.flash_floods.cooldownRemaining > 0, "cooldown spent");
  });

  test("ability: an illegal land click does not resolve and does not disarm", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    const ok = engine.resolveAbilityTarget(state, "5");

    assert(!ok, "an empty land is not a legal Flash Floods target");
    assertEqual(state.pendingAbilityTarget, "flash_floods", "still armed, so the player can try again");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: triggering with no legal target logs and leaves the cooldown unspent", () => {
    const { state } = fullKit();
    clearBoard(state);

    const ok = engine.triggerAbility(state, "flash_floods");
    assert(!ok, "there is nothing to hit");
    assertEqual(state.pendingAbilityTarget, null, "must not arm");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "cooldown unspent");
  });

  test("ability: nothing can be triggered once the round has ended", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);
    engine.endRound(state);

    assert(!engine.triggerAbility(state, "flash_floods"), "trigger must refuse");
    assert(!engine.triggerAbility(state, "boon_of_vigor"), "no-target trigger must refuse too");
  });

  test("ability: a defeat by an ability awards Fear the same as a Dahan strike", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.round.fearEarned = 0;
    setLand(state, "3", { towns: 1 }, 0);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.round.fearEarned, 2 * engine.FEAR_PER_POWER, "a town is worth 2 either way");
  });

  /* ---------------------------------------------------------------- *
   * Boon of Vigor                                                      *
   * ---------------------------------------------------------------- */

  test("boon: it pays an Energy and needs nothing on the board", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.resources.energy = 4;

    const ok = engine.triggerAbility(state, "boon_of_vigor");

    assert(ok, "an empty island does not stop the faucet");
    assertEqual(state.resources.energy, 5, "+1 Energy");
    assertEqual(engine.abilityCooldownSeconds(state, "boon_of_vigor"), 12 * engine.TIME_SCALE, "on a 12-beat clock");
  });

  test("boon: without the upgrade it never fires on its own", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.resources.energy = 0;

    advance(ctx, 30 * engine.TIME_SCALE);
    assertEqual(state.resources.energy, 0, "an unbought faucet stays shut");
  });

  test("boon: once auto_boon is owned it casts itself on its cooldown", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    grantUpgrade(state, "auto_boon");
    state.resources.energy = 0;

    // The ability starts ready, so the first tick casts; each one after waits the full 12
    // beats. Counted off the cooldown itself rather than off a literal, because the cadence
    // is the assertion and TIME_SCALE is allowed to move what a beat costs in seconds.
    const cooldown = engine.abilityCooldownSeconds(state, "boon_of_vigor");

    advance(ctx, 1);
    assertEqual(state.resources.energy, 1, "it fires without a click");

    advance(ctx, cooldown - 1);
    assertEqual(state.resources.energy, 1, "and not again while the cooldown runs");

    advance(ctx, 1);
    assertEqual(state.resources.energy, 2, "the next one lands when the clock does");

    advance(ctx, cooldown);
    assertEqual(state.resources.energy, 3, "and keeps to that pace");
  });

  test("boon: the auto-cast spends the same cooldown a click would", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    grantUpgrade(state, "auto_boon");

    advance(ctx, 1);
    assertClose(
      state.abilities.boon_of_vigor.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "boon_of_vigor"),
      0.01,
      "owning it changes who presses the button, not how often it can be pressed"
    );
  });

  test("boon: the auto-cast writes no log line", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    grantUpgrade(state, "auto_boon");

    advance(ctx, 40 * engine.TIME_SCALE);
    const boonLines = (state._log || []).filter((line) => line.includes("Boon of Vigor"));
    assertEqual(boonLines.length, 0, "a faucet the shop opened does not narrate itself");
  });

  /* ---------------------------------------------------------------- *
   * River's Bounty                                                     *
   * ---------------------------------------------------------------- */

  test("rivers bounty: it needs no land click and picks the thinnest contested land", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "1", { explorers: 1 }, 3);
    setLand(state, "5", { explorers: 1 }, 1);   // fewest Dahan of the two under attack
    state.dahan["7"] = 4;                       // deepest land on the board, but no invaders

    assertEqual(engine.abilityRecord(state, "rivers_bounty").needsTarget, false, "no click to give");
    assertEqual(engine.riversBountyLand(state), "5", "the thinnest land holding invaders");

    const ok = engine.triggerAbility(state, "rivers_bounty");
    assert(ok, "it resolves on the trigger itself");
    assertEqual(state.dahan["5"], 2, "+1 Dahan where it was thinnest");
    assertEqual(state.dahan["1"], 3, "and nothing was taken from anywhere else");
    assertEqual(state.pendingAbilityTarget, null, "nothing is left armed");
    assert(state.abilities.rivers_bounty.cooldownRemaining > 0, "cooldown spent");
  });

  test("rivers bounty: the Dahan is created, not gathered from a neighbour", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "5", { explorers: 1 }, 0);
    state.dahan["1"] = 2;   // adjacent to 5, and must stay where it is

    engine.triggerAbility(state, "rivers_bounty");

    assertEqual(state.dahan["5"], 1, "one arrived");
    assertEqual(state.dahan["1"], 2, "the neighbour is untouched");
  });

  test("rivers bounty: a contested land outranks an emptier quiet one", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "5", { explorers: 1 }, 2);
    // Land 7 has no Dahan at all, but no invaders either - a fight comes first while there
    // is one to reinforce.

    engine.triggerAbility(state, "rivers_bounty");

    assertEqual(state.dahan["5"], 3, "the contested land took it");
    assertEqual(state.dahan["7"], 0, "the empty one did not");
  });

  test("rivers bounty: with no invaders anywhere it still lands, in the thinnest land", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.dahan["1"] = 3;
    state.dahan["4"] = 1;   // thinnest of the lands actually holding anyone
    state.dahan["7"] = 2;
    assertEqual(engine.riversBountyLand(state), "2", "land 2 is empty, and the lowest such id");

    const ok = engine.triggerAbility(state, "rivers_bounty");

    assert(ok, "a quiet island is the moment to build up, not to refuse");
    assertEqual(state.dahan["2"], 1, "the Dahan arrived where the board was thinnest");
    assertEqual(state.dahan["1"], 3, "and nothing moved out of anywhere else");
    assert(state.abilities.rivers_bounty.cooldownRemaining > 0, "cooldown spent");
  });

  test("rivers bounty: it never fails, so its cooldown is always spent", () => {
    const { state } = fullKit();
    clearBoard(state);   // no invaders, no Dahan, nothing at all

    const ok = engine.triggerAbility(state, "rivers_bounty");
    assert(ok, "there is always a thinnest land");
    assertEqual(state.dahan["1"], 1, "ties go to the lowest land id");
    assert(state.abilities.rivers_bounty.cooldownRemaining > 0, "cooldown spent");
  });

  /* ---------------------------------------------------------------- *
   * Flash Floods                                                       *
   * ---------------------------------------------------------------- */

  test("flash floods: 1 damage inland, 2 on the coast", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "5", { cities: 1 }, 0);   // land 5 is inland
    setLand(state, "3", { cities: 1 }, 0);   // land 3 is coastal

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "5");
    assertDeepEqual(healthOf(state, "5", "cities"), [2], "inland: the city is down 1");

    state.abilities.flash_floods.cooldownRemaining = 0;
    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "coastal: the same city would be down 2");
  });

  test("flash floods: leftover damage from a kill carries to the next target", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 3 is coastal, so this is 2 damage. The city is one hit from falling, so it dies
    // to the first point and the second has to find something else - the user's own example.
    setLand(state, "3", { explorers: 1, cities: 1 }, 0);
    woundUnit(state, "3", "cities", 0, 2);

    engine.triggerAbility(state, "flash_floods");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].cities, 0, "the city fell to the first point");
    assertEqual(state.invaders["3"].explorers, 0, "and the spare point took the explorer");
  });

  /* ---------------------------------------------------------------- *
   * Kill-first damage (the rule every ability and the Dahan share)     *
   * ---------------------------------------------------------------- */

  test("damage: 2 damage buys the town it can kill, not the city it cannot", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 4, towns: 2, cities: 2 }, 0);

    engine.applyDamage(state, "3", 2);

    assertEqual(state.invaders["3"].towns, 1, "a town fell");
    assertEqual(state.invaders["3"].explorers, 4, "no explorer was touched");
    assertDeepEqual(healthOf(state, "3", "cities"), [3, 3], "and both cities are untouched");
  });

  test("damage: a wounded city outranks a healthy town at the same health", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 4, towns: 2, cities: 2 }, 0);
    woundUnit(state, "3", "cities", 0, 1);   // one city down to 2 health

    engine.applyDamage(state, "3", 2);

    assertEqual(state.invaders["3"].cities, 1, "the wounded city died");
    assertEqual(state.invaders["3"].towns, 2, "both towns still stand");
    assertDeepEqual(healthOf(state, "3", "cities"), [3], "the untouched city is the survivor");
  });

  test("damage: 1 damage takes an explorer rather than scratching a city", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 4, towns: 2, cities: 2 }, 0);

    engine.applyDamage(state, "3", 1);

    assertEqual(state.invaders["3"].explorers, 3, "an explorer fell");
    assertDeepEqual(healthOf(state, "3", "cities"), [3, 3], "the cities are untouched");
  });

  test("damage: with no kill available it lands on the strongest thing standing", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 1, cities: 1 }, 0);

    engine.applyDamage(state, "3", 1);

    assertDeepEqual(healthOf(state, "3", "cities"), [2], "the city took it");
    assertDeepEqual(healthOf(state, "3", "towns"), [2], "the town is untouched");
  });

  test("damage: with no kill available it finishes the city it already started", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { cities: 2 }, 0);
    woundUnit(state, "3", "cities", 0, 1);   // one at 2 health, one at 3

    engine.applyDamage(state, "3", 1);

    assertDeepEqual(healthOf(state, "3", "cities"), [1, 3], "the wounded one took it, not the fresh one");
  });

  test("damage: a pool spends itself down through kill after kill", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 1 }, 0);

    const result = engine.applyDamage(state, "3", 4);

    assertEqual(result.totalDefeated, 3, "town then both explorers");
    assertEqual(engine.invaderCountInLand(state.invaders["3"]), 0, "the land is clear");
    assertEqual(result.spent, 4, "every point found a target");
  });

  test("damage: more damage than the land can absorb leaves the surplus unspent", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 1 }, 0);

    const result = engine.applyDamage(state, "3", 5);

    assertEqual(result.spent, 1, "one point killed the explorer, four had nothing to hit");
    assertEqual(result.totalDefeated, 1, "one defeat");
  });

  test("damage: wounds survive between hits within a round", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);

    engine.applyDamage(state, "3", 1);
    assertDeepEqual(healthOf(state, "3", "cities"), [2], "down one");

    engine.applyDamage(state, "3", 1);
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "down two");

    engine.applyDamage(state, "3", 1);
    assertEqual(state.invaders["3"].cities, 0, "the third point finished it");
  });

  /* ---------------------------------------------------------------- *
   * Pushing (Wash Away, and the Innate's first two tiers)              *
   * ---------------------------------------------------------------- */

  test("push: a coastal neighbour without invaders wins over an inland one", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 2 borders 1 and 3 (both coastal, both empty) and 5 and 6 (inland).
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "5", { explorers: 0 }, 0);

    const destinations = engine.pushDestinations(state, "2");
    assert(destinations.length > 0, "there is somewhere to go");
    for (const landId of destinations) {
      assert(engine.landIsCoastal(landId), `${landId} should be coastal while a coast is free`);
    }
  });

  test("push: a Dahan-held neighbour wins over an empty coastal one", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 2 borders coastal 1 and 3 (both empty, no Dahan) and inland 5 and 6.
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "6", null, 1);   // inland, undefended coast loses to this

    assertDeepEqual(engine.pushDestinations(state, "2"), ["6"], "Dahan beats coastal");
    assertEqual(engine.pushDestination(state, "2"), "6");
  });

  test("push: among several Dahan-held neighbours a coastal one still wins", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 2 borders coastal 1 and 3 and inland 5 and 6; give three of them Dahan.
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "1", null, 1);   // coastal, defended
    setLand(state, "5", null, 1);   // inland, defended
    setLand(state, "6", null, 1);   // inland, defended

    assertDeepEqual(engine.pushDestinations(state, "2"), ["1"], "defended and coastal beats defended alone");
  });

  test("push: an occupied neighbour loses to open ground", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 2 }, 0);
    setLand(state, "2", { explorers: 1 }, 0);   // 3's only other neighbour is 6

    assertDeepEqual(engine.pushDestinations(state, "3"), ["6"], "the empty neighbour, while there is one");
  });

  test("push: with no open ground left the push stacks onto a neighbour rather than failing", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 3 borders only 2 and 6. Fill both, and open ground has run out.
    setLand(state, "3", { explorers: 2 }, 0);
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "6", { explorers: 1 }, 0);

    assert(!engine.pushHasOpenGround(state, "3"), "nowhere open");
    assertDeepEqual(engine.pushDestinations(state, "3"), ["2"], "the coastal one of the two, occupied or not");

    const pushed = engine.applyPushFrom(state, "3", 2);
    assertEqual(pushed.destination, "2", "the push still goes somewhere");
    assertEqual(state.invaders["2"].explorers, 3, "stacked onto what was already standing there");
  });

  test("push: among occupied neighbours the ranking still holds - Dahan first, then the coast", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 5 borders 1, 2, 4, 6, 7 and 8. Occupy every one of them, and defend one inland.
    setLand(state, "5", { explorers: 1 }, 0);
    for (const id of ["1", "2", "4", "6", "7", "8"]) setLand(state, id, { explorers: 1 }, 0);
    setLand(state, "7", { explorers: 1 }, 1);   // inland, defended

    assertDeepEqual(
      engine.pushDestinations(state, "5"),
      ["7"],
      "a defended stack beats an undefended coast, the same order open ground uses"
    );
  });

  test("push: among free neighbours the water takes the lowest land id, never a roll", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 2 borders coastal 1 and 3 and inland 5 and 6, all of them empty.
    setLand(state, "2", { explorers: 1 }, 0);

    assertEqual(engine.pushDestination(state, "2"), "1", "the lowest free neighbour");
  });

  test("push: the RNG no longer has a say in where the water goes", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "2", { explorers: 1 }, 0);

    // An RNG pinned to the top of its range used to pick the last of the free coastal lands.
    engine.setRng(() => 0.999999);
    const pushed = engine.applyPushFrom(state, "2", 1);

    assertEqual(pushed.destination, "1", "still the lowest id - a push can be planned now");
    assertEqual(state.invaders["3"].explorers, 0, "and land 3 never saw it");
  });

  test("push: with no coast free it is still the lowest id, not the nearest coast", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 8 borders only inland lands: 5, 6 and 7.
    setLand(state, "8", { explorers: 1 }, 0);

    assertEqual(engine.pushDestination(state, "8"), "5", "lowest of the three inland neighbours");
  });

  test("push: towns go before explorers when the budget is short", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 3, towns: 2 }, 0);

    engine.applyPushFrom(state, "3", 3);

    assertEqual(state.invaders["3"].towns, 0, "both towns left");
    assertEqual(state.invaders["3"].explorers, 2, "and one explorer went with them");
  });

  test("push: cities never move", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, cities: 2 }, 0);

    const pushed = engine.applyPushFrom(state, "3", 3);

    assertEqual(state.invaders["3"].cities, 2, "the cities are built in");
    assertEqual(pushed.moved, 1, "only the explorer travelled");
  });

  test("push: a unit carries its own wound with it", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 2 }, 0);
    woundUnit(state, "3", "towns", 0, 1);   // one town at 1 health, one at 2

    const pushed = engine.applyPushFrom(state, "3", 1);

    assertDeepEqual(healthOf(state, pushed.destination, "towns"), [1], "the wounded one travelled, still wounded");
    assertDeepEqual(healthOf(state, "3", "towns"), [2], "the healthy one stayed, still healthy");
  });

  test("push: two wounded units arriving together both keep their own health", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { towns: 2 }, 0);
    woundUnit(state, "3", "towns", 0, 1);

    const pushed = engine.applyPushFrom(state, "3", 2);

    assertDeepEqual(
      healthOf(state, pushed.destination, "towns"),
      [1, 2],
      "one at 1 health and one at 2 - the old per-type model could only have described one of them"
    );
  });

  test("wash away: inland it pushes up to 3 from the land the player picked", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 6 is inland, so this is the push half of the ability.
    setLand(state, "6", { explorers: 3, towns: 2, cities: 1 }, 0);

    engine.triggerAbility(state, "wash_away");
    const ok = engine.resolveAbilityTarget(state, "6");

    assert(ok, "wash away should resolve");
    assertEqual(state.invaders["6"].towns, 0, "both towns pushed");
    assertEqual(state.invaders["6"].explorers, 2, "one explorer went with them, two stayed");
    assertEqual(state.invaders["6"].cities, 1, "the city stays put");
  });

  test("wash away: the push destination is adjacent and was empty", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Nothing on the Build track, so this measures the coastal preference alone - a push now
    // steps around a land the next Build would thicken, which has its own test below.
    state.invader = { build: [], explore: [] };
    setLand(state, "6", { explorers: 2 }, 0);   // borders 2, 3, 5 and 8

    engine.triggerAbility(state, "wash_away");
    engine.resolveAbilityTarget(state, "6");

    const receivers = engine.LAND_IDS.filter((id) => id !== "6" && state.invaders[id].explorers > 0);
    assertEqual(receivers.length, 1, "exactly one destination");
    assert(engine.areAdjacent("6", receivers[0]), `${receivers[0]} must border land 6`);
    assertEqual(receivers[0], "2", "the lowest of its free coastal neighbours");
  });

  test("wash away: from a coastal land the water takes them off the island instead", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 1, towns: 2, cities: 1 }, 0);

    engine.triggerAbility(state, "wash_away");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "a coast always has the sea to push into");
    assertEqual(state.invaders["3"].towns, 0, "both towns went, towns first as always");
    assertEqual(state.invaders["3"].explorers, 1, "the sea budget is 2, so the explorer stayed");
    assertEqual(state.invaders["3"].cities, 1, "a city is built in - the water cannot carry it");

    const elsewhere = engine.LAND_IDS.filter((id) => id !== "3" && engine.invaderCountInLand(state.invaders[id]) > 0);
    assertDeepEqual(elsewhere, [], "and they did not land anywhere - they are off the board");
  });

  test("wash away: a drowning pays the same Fear and Energy a kill does", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.resources.energy = 0;
    state.round.fearEarned = 0;
    setLand(state, "1", { towns: 2 }, 0);

    engine.triggerAbility(state, "wash_away");
    engine.resolveAbilityTarget(state, "1");

    // A town's power is 2, and Fear and Energy are both paid on that scale.
    assertEqual(state.round.fearEarned, 4, "two towns at power 2");
    assertEqual(state.resources.energy, 4, "and the same again in Energy");
  });

  test("wash away: the sea takes the healthiest and leaves the wounded standing", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "1", { towns: 3 }, 0);
    woundUnit(state, "1", "towns", 0, 1);   // one town at 1 health, two at 2

    engine.triggerAbility(state, "wash_away");
    engine.resolveAbilityTarget(state, "1");

    assertDeepEqual(
      healthOf(state, "1", "towns"),
      [1],
      "the two whole towns drowned; the hurt one is left for something that spends damage"
    );
  });

  test("wash away: a coastal land ignores its neighbours entirely", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 3 borders only 2 and 6. Fill both: boxed in used to mean uncastable.
    setLand(state, "3", { towns: 1 }, 0);
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "6", { explorers: 1 }, 0);

    assert(engine.abilityLegalLand(state, "wash_away", "3"), "the sea is always open");

    engine.triggerAbility(state, "wash_away");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(engine.invaderCountInLand(state.invaders["3"]), 0, "washed off the island");
    assertEqual(state.invaders["2"].explorers, 1, "and nothing was shoved next door");
  });

  test("wash away: an inland land with no open ground is still a legal target", () => {
    const { state } = fullKit();
    clearBoard(state);
    // Land 8 borders 5, 6 and 7 and has no coast of its own.
    setLand(state, "8", { towns: 1 }, 0);
    for (const id of ["5", "6", "7"]) setLand(state, id, { explorers: 1 }, 0);

    assert(engine.abilityLegalLand(state, "wash_away", "8"), "a shove onto a stack still beats nothing");

    engine.triggerAbility(state, "wash_away");
    assert(engine.resolveAbilityTarget(state, "8"), "and it resolves");
    assertEqual(state.invaders["8"].towns, 0, "the town left");
  });

  test("wash away: a land holding only cities is not a legal target", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { cities: 2 }, 0);

    assert(!engine.abilityLegalLand(state, "wash_away", "3"), "nothing there the water can carry");
  });

  test("wash away: nothing pushable anywhere leaves the cooldown unspent", () => {
    const { state } = fullKit();
    clearBoard(state);

    const ok = engine.triggerAbility(state, "wash_away");
    assert(!ok, "an empty island has nothing to push");
    assertEqual(state.abilities.wash_away.cooldownRemaining, 0, "cooldown unspent");
  });

  /* ---------------------------------------------------------------- *
   * The Innate Power                                                   *
   * ---------------------------------------------------------------- */

  test("innate: it opens at tier 1, unlocked and free", () => {
    const { state } = newGame();

    assert(engine.abilityIsUnlocked(state, "innate_power"), "in the opening hand");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "at its first tier");
    assertEqual(engine.abilityUnlockCost(state, "innate_power"), 0, "and it cost nothing");
    assertEqual(engine.abilityCooldownSeconds(state, "innate_power"), 8 * engine.TIME_SCALE, "8 beats at tier 1");
  });

  test("innate tier 1: it pushes exactly one unit", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 2 }, 0);

    engine.triggerAbility(state, "innate_power");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "resolve should succeed");
    assertEqual(state.invaders["3"].towns, 1, "one town left");
    assertEqual(state.invaders["3"].explorers, 2, "and nothing else moved");
  });

  test("innate tier 2: 2 damage and up to 3 pushed, on a 15-beat clock", () => {
    const { state } = fullKit();
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    setLand(state, "3", { explorers: 2, towns: 2, cities: 1 }, 0);

    assertEqual(engine.abilityCooldownSeconds(state, "innate_power"), 15 * engine.TIME_SCALE, "15 beats at tier 2");

    engine.triggerAbility(state, "innate_power");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "resolve should succeed");
    // 2 damage kills a town, then 3 of what is left is pushed - the surviving town first.
    assertEqual(state.invaders["3"].towns, 0, "one town died, the other was pushed");
    assertEqual(state.invaders["3"].explorers, 0, "and both explorers went with it");
    assertEqual(state.invaders["3"].cities, 1, "the city neither died nor moved");
  });

  test("innate tier 2: the damage still lands when there is nothing to push", () => {
    const { state } = fullKit();
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    setLand(state, "3", { cities: 1 }, 0);   // a city is the one thing a push cannot move

    assert(engine.abilityLegalLand(state, "innate_power", "3"), "damage alone makes it a legal target");

    engine.triggerAbility(state, "innate_power");
    const ok = engine.resolveAbilityTarget(state, "3");

    assert(ok, "the cast counts on its damage alone");
    assertDeepEqual(healthOf(state, "3", "cities"), [1], "the city took the 2 damage and stayed");
  });

  test("innate tier 2: with no open ground the survivor is still shoved somewhere", () => {
    const { state } = fullKit();
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "3", { towns: 2 }, 0);
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "6", { explorers: 1 }, 0);   // land 3 has no open ground left

    engine.triggerAbility(state, "innate_power");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].towns, 0, "one town fell to the 2 damage and the other left");
    assertEqual(state.invaders["2"].towns, 1, "onto the stack next door, which is the price of it");
  });

  test("innate tier 3: every invader takes 2, individually", () => {
    const { state } = fullKit();
    setAbilityTier(state, "innate_power", 2);
    clearBoard(state);
    setLand(state, "3", { explorers: 4, towns: 2, cities: 2 }, 0);

    assertEqual(engine.abilityCooldownSeconds(state, "innate_power"), 22 * engine.TIME_SCALE, "22 beats at tier 3");

    engine.triggerAbility(state, "innate_power");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.invaders["3"].explorers, 0, "every explorer died to its own 2");
    assertEqual(state.invaders["3"].towns, 0, "and every town");
    assertDeepEqual(
      healthOf(state, "3", "cities"),
      [1, 1],
      "both cities survive at 1 health each - the state the per-type damage model could not hold"
    );
  });

  test("innate tier 3: it pays for every kill separately", () => {
    const { state } = fullKit();
    setAbilityTier(state, "innate_power", 2);
    clearBoard(state);
    state.resources.energy = 0;
    setLand(state, "3", { explorers: 2, towns: 1 }, 0);

    engine.triggerAbility(state, "innate_power");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.resources.energy, 4, "two explorers at 1 and a town at 2");
  });

  test("innate: buying a tier spends Energy, swaps the ability, and hands it back ready", () => {
    const { state } = fullKit();
    state.resources.energy = 60;
    state.abilities.innate_power.cooldownRemaining = 5;

    const ok = engine.upgradeAbility(state, "innate_power");

    assert(ok, "the upgrade should succeed");
    assertEqual(state.resources.energy, 20, "40 spent");
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "now at tier 2");
    assertEqual(engine.abilityRecord(state, "innate_power").effect, "damage_and_push", "a different ability entirely");
    assert(engine.abilityIsReady(state, "innate_power"), "and ready, not still cooling");
  });

  test("innate: the tier ladder is 40 then 150, and stops there", () => {
    const { state } = fullKit();

    assertEqual(engine.abilityUpgradeCost(state, "innate_power"), 40, "tier 2 costs 40");
    setAbilityTier(state, "innate_power", 1);
    assertEqual(engine.abilityUpgradeCost(state, "innate_power"), 150, "tier 3 costs 150");
    setAbilityTier(state, "innate_power", 2);
    assert(!Number.isFinite(engine.abilityUpgradeCost(state, "innate_power")), "and there is no tier 4");
    assert(!engine.upgradeAbility(state, "innate_power"), "the top of the ladder refuses");
  });

  test("innate: too little Energy buys no tier", () => {
    const { state } = fullKit();
    state.resources.energy = 39;

    assert(!engine.upgradeAbility(state, "innate_power"), "the upgrade must refuse");
    assertEqual(state.resources.energy, 39, "Energy untouched");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "still tier 1");
  });

  /* ---------------------------------------------------------------- *
   * Auto-cast: the Innate's own judgement (auto_innate)                 *
   * ---------------------------------------------------------------- */

  test("auto-innate tier 1: breaks a build by pushing the lone unit that would trigger it", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader.build = "wetlands";           // lands 1 and 7
    setLand(state, "7", { explorers: 1 }, 0);    // undefended, alone - Build would thicken it
    grantUpgrade(state, "auto_innate");

    advance(ctx, 1);

    assertEqual(state.invaders["7"].explorers, 0, "the lone unit was pushed out before Build");
    assertEqual(state.invaders["4"].explorers, 1, "landed on 7's lowest free, undefended neighbour");
    assert(state.abilities.innate_power.cooldownRemaining > 0, "the real cooldown was spent");

    const innateLines = (state._log || []).filter((line) => line.includes(engine.abilityName(state, "innate_power")));
    assertEqual(innateLines.length, 0, "the auto-cast does not narrate itself, same as the Boon's");
  });

  test("auto-innate tier 1: a lone city cannot be broken, so it waits rather than wasting the cast", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader.build = "wetlands";
    setLand(state, "7", { cities: 1 }, 0);       // nothing pushable, no Dahan anywhere either
    grantUpgrade(state, "auto_innate");

    const cooldown = engine.abilityCooldownSeconds(state, "innate_power");
    // Held past the window below, so no wave resolves and Discover cannot seed a fresh,
    // genuinely pushable explorer onto some other, empty land - this is about the lone city
    // and nothing else, so the rest of the board has to stay inert for the whole test.
    state.round.waveTimerRemaining = cooldown * 3 + 1;
    advance(ctx, cooldown * 3);

    assertEqual(state.invaders["7"].cities, 1, "the city never moved, never could");
    assertEqual(state.abilities.innate_power.cooldownRemaining, 0, "never fired, so still ready");
  });

  test("auto-innate tier 1: routes an undefended stack into Dahan cover when nothing needs breaking", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    // Land 5 (hub) is undefended; its neighbour 8 holds no invaders but does hold a Dahan.
    setLand(state, "5", { explorers: 1 }, 0);
    setLand(state, "8", null, 1);
    grantUpgrade(state, "auto_innate");

    advance(ctx, 1);

    assertEqual(state.invaders["5"].explorers, 0, "pushed off the undefended land");
    assertEqual(state.invaders["8"].explorers, 1, "and landed in front of the Dahan already there");
    assertEqual(state.dahan["8"], 1, "the defender itself did not move");
  });

  test("auto-innate tier 1: carries an inland unit onto an open coast when there is no cover", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 4 is inland with no Dahan anywhere to route into. Its neighbours are 1, 5 and 7,
    // and only land 1 is coastal - so the one thing a spare push buys is a unit the sea can
    // reach, which is what Wash Away is for.
    setLand(state, "4", { towns: 1 }, 0);
    grantUpgrade(state, "auto_innate");

    advance(ctx, 1);

    assertEqual(state.invaders["4"].towns, 0, "carried off the inland land");
    assertEqual(state.invaders["1"].towns, 1, "and onto the coast, in reach of the water");
  });

  test("auto-innate tier 1: cover outranks the sea, because pushDestination says so", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 5 has an open coast (1) and an open defended neighbour (4) beside it. The push
    // rule puts defended above coastal on its own, so the cast routes into cover whatever
    // order the rungs are written in - and the rung order matches it rather than arguing.
    setLand(state, "5", { explorers: 1 }, 0);
    setLand(state, "4", null, 1);

    assertEqual(engine.pushDestination(state, "5"), "4", "the defended neighbour wins the push");
    assert(engine.innateRouteToCoverLands(state, engine.abilityRecord(state, "innate_power")).includes("5"), "so the routing rung claims it");
    assertEqual(engine.innateT1FeedTheSeaLands(state).length, 0, "and the sea rung never sees it");
  });

  test("auto-innate tier 1: a coast-to-coast shove is not a reason to cast", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 3 is already coastal, so the water can already reach what stands there. Moving it
    // to land 2 buys the board nothing it did not already have.
    setLand(state, "3", { explorers: 1 }, 0);
    grantUpgrade(state, "auto_innate");

    assertEqual(engine.pickInnateAutoTarget(state), null, "already in reach of the sea");
    advance(ctx, 1);
    assertEqual(state.invaders["3"].explorers, 1, "so nothing moved");
  });

  test("auto-innate tier 1: it will not pull a unit out from under the Dahan", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // The retired protect-the-thin-stack rung fired here, shoving the explorer off land 4 and
    // out of the strike's reach. One unit never lifted enough pressure to save a stack, and
    // the rung was the exact mirror of the routing rung above it - onto Dahan, then off Dahan
    // - so on an 8-beat clock against a 10-beat strike the same unit crossed the same border
    // all round without ever standing still long enough to be struck.
    setLand(state, "4", { explorers: 1 }, 1);
    grantUpgrade(state, "auto_innate");

    assert(engine.abilityLegalLand(state, "innate_power", "4"), "a player could still click it");
    assertEqual(engine.pickInnateAutoTarget(state), null, "the automation leaves the fight alone");

    advance(ctx, 1);
    assertEqual(state.invaders["4"].explorers, 1, "the explorer stays where the Dahan can reach it");
    assertEqual(state.abilities.innate_power.cooldownRemaining, 0, "and the cast was never spent");
  });

  test("auto-innate keeps working at tier 2 without a second purchase", () => {
    const ctx = newGame();
    const { state } = ctx;
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    state.invader.build = "wetlands";
    setLand(state, "7", { towns: 1 }, 0);        // 2 damage kills a town outright
    grantUpgrade(state, "auto_innate");

    advance(ctx, 1);

    assertEqual(state.invaders["7"].towns, 0, "the tier 2 damage half cleared it alone");
  });

  test("auto-innate keeps working at tier 3 without a second purchase", () => {
    const ctx = newGame();
    const { state } = ctx;
    setAbilityTier(state, "innate_power", 2);
    clearBoard(state);
    state.invader.build = "wetlands";
    setLand(state, "7", { explorers: 2 }, 0);    // 2 damage each kills both outright
    grantUpgrade(state, "auto_innate");

    advance(ctx, 1);

    assertEqual(state.invaders["7"].explorers, 0, "the AoE cleared the build threat");
  });

  test("auto-innate: with auto_innate not owned, the Innate never fires on its own", () => {
    const ctx = newGame();
    const { state } = ctx;
    clearBoard(state);
    state.invader.build = "wetlands";
    setLand(state, "7", { explorers: 1 }, 0);

    advance(ctx, engine.abilityCooldownSeconds(state, "innate_power") * 2);

    assertEqual(state.invaders["7"].explorers, 1, "nothing automated without the upgrade");
  });

  /* ---------------------------------------------------------------- *
   * The Innate's auto-cast: the rungs shared by every tier              *
   * ---------------------------------------------------------------- */

  test("auto-innate tier 1: denying a Discover its last foothold outranks everything else", () => {
    const { state } = newGame();
    clearBoard(state);
    state.round.wavesResolved = 1;
    state.invader = { build: [], explore: ["mountains"] };
    // Mountains is the one terrain with no coast, so lands 4 and 6 take Explorers only while a
    // neighbour holds a Town. Land 7's Town is land 4's only foothold, and land 6 has none.
    setLand(state, "7", { towns: 1 }, 0);

    const record = engine.abilityRecord(state, "innate_power");
    assertDeepEqual(engine.exploreFootholdLands(state), ["4"], "land 4 is reachable only through land 7");
    assert(engine.innateDenyExploreLands(state, record).includes("7"), "so the Town is what the cast moves");
    assertEqual(engine.pickInnateAutoTarget(state), "7", "and it outranks every other rung");
  });

  test("auto-innate tier 1: a deny that only moves the foothold is declined", () => {
    const { state } = newGame();
    clearBoard(state);
    state.round.wavesResolved = 1;
    state.invader = { build: [], explore: ["mountains"] };
    // The Dahan on land 8 win the push, and land 8 borders land 6 - so the Town would stop
    // land 4 accepting Explorers and start land 6 accepting them instead. A cast for nothing.
    setLand(state, "7", { towns: 1 }, 0);
    state.dahan["8"] = 1;

    const record = engine.abilityRecord(state, "innate_power");
    assertEqual(engine.pushDestination(state, "7"), "8", "the defended neighbour wins the push");
    assertDeepEqual(engine.exploreFootholdLands(state), ["4"], "land 4 is the only one gated open");
    assertEqual(engine.innateDenyExploreLands(state, record).length, 0, "so the rung declines it");
  });

  test("auto-innate: the deny rung goes quiet from wave 10", () => {
    const { state } = newGame();
    clearBoard(state);
    state.round.wavesResolved = engine.EXPLORE_UNRESTRICTED_FROM_WAVE;
    state.invader = { build: [], explore: ["mountains"] };
    setLand(state, "7", { towns: 1 }, 0);

    const record = engine.abilityRecord(state, "innate_power");
    assertEqual(engine.exploreFootholdLands(state).length, 0, "Discover stops asking for a foothold");
    assertEqual(engine.innateDenyExploreLands(state, record).length, 0, "so there is nothing to deny");
  });

  test("auto-innate: the tie-break inside a rung is the land bleeding most, not the lowest id", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: ["desert"], explore: [] };
    // Both desert lands hold exactly one pushable unit, so both break their Build. The id order
    // would take land 2; what the round is actually paying for is the Town on land 8.
    setLand(state, "2", { explorers: 1 }, 0);
    setLand(state, "8", { towns: 1 }, 0);

    const record = engine.abilityRecord(state, "innate_power");
    assertDeepEqual(engine.innateBreakBuildLands(state, record), ["2", "8"], "both break a Build");
    assertEqual(engine.pickInnateAutoTarget(state), "8", "the Town bleeds faster than the Explorer");
  });

  test("auto-innate tier 1: routing to cover needs the destination to actually kill what arrives", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "5", { towns: 1 }, 0);
    state.dahan["8"] = 1;   // one Dahan deals 1, and a Town has 2 health

    const record = engine.abilityRecord(state, "innate_power");
    assertEqual(engine.pushDestination(state, "5"), "8", "the push would land there either way");
    assertEqual(engine.innateRouteToCoverLands(state, record).length, 0, "but one Dahan cannot finish a Town");

    state.dahan["8"] = 2;
    assert(engine.innateRouteToCoverLands(state, record).includes("5"), "two can, so now the rung claims it");
  });

  test("auto-innate tier 1: consolidates onto a strictly better defended stack", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 8 holds more Dahan than land 5, but its strike is already spoken for by the two
    // Explorers standing there - so the arriving Town survives and the routing rung passes.
    setLand(state, "5", { towns: 1 }, 1);
    setLand(state, "8", { explorers: 2 }, 2);

    const record = engine.abilityRecord(state, "innate_power");
    assertEqual(engine.innateRouteToCoverLands(state, record).length, 0, "nothing dies on arrival");
    assert(engine.innateDefendWithMoreDahanLands(state, record).includes("5"), "so it consolidates instead");
    assertEqual(engine.pickInnateAutoTarget(state), "5", "and that is the cast");
  });

  test("auto-innate tier 1: on a full island it stacks onto Explorers but never onto a Town", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 8 has no open ground at all - the case that used to silence every positional rung.
    setLand(state, "8", { explorers: 1 }, 0);
    setLand(state, "5", { explorers: 1 }, 3);
    setLand(state, "6", { towns: 1 }, 0);
    setLand(state, "7", { explorers: 1 }, 0);

    assert(!engine.pushHasOpenGround(state, "8"), "nowhere open to go");
    assertEqual(engine.pushDestination(state, "8"), "5", "the defended stack still wins the push");
    assert(engine.pushStacksSafely(state, "8"), "Explorers can be stacked onto");

    state.dahan["5"] = 0;
    state.dahan["6"] = 5;
    assertEqual(engine.pushDestination(state, "8"), "6", "now the Town land wins the push");
    assert(!engine.pushStacksSafely(state, "8"), "and a Town is never stacked onto");
  });

  test("push: a Town is not stacked onto Explorers the next Build would raise into a City", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: ["desert"], explore: [] };
    // Land 8 is desert and on the Build track. Holding Explorers alone it builds a Town; with a
    // Town standing on it, towns outnumber cities and it builds a City instead.
    setLand(state, "7", { towns: 1 }, 0);
    setLand(state, "8", { explorers: 1 }, 0);

    assertEqual(engine.landBuildsNext(state, "8"), "towns", "Explorers alone build a Town");
    assert(engine.pushWorsensBuild(state, "7", "8"), "a Town arriving upgrades that to a City");
    assertEqual(engine.pushDestination(state, "7"), "4", "so the water goes the other way");
  });

  test("push: among otherwise equal destinations the water steps around the Build track", () => {
    const { state } = newGame();
    clearBoard(state);
    state.invader = { build: ["mountains"], explore: [] };
    // Land 7 borders 4 (mountains, on the track), 5 and 8. All three are empty and undefended,
    // so the only thing separating them is that Build skips an empty land until something
    // stands in it - a push into land 4 creates a target that did not exist.
    setLand(state, "7", { explorers: 1 }, 0);

    assertEqual(engine.pushDestination(state, "7"), "5", "not land 4, though its id is lower");
  });

  test("auto-innate tier 2: clearing a land outright outranks routing it into cover", () => {
    const { state } = newGame();
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // Land 3 holds one Town: the damage half empties it. Land 5 keeps its City whatever the
    // cast does, so the best it can offer is a Town routed onto the Dahan on land 8.
    setLand(state, "3", { towns: 1 }, 0);
    setLand(state, "5", { cities: 1, towns: 2 }, 0);
    state.dahan["8"] = 2;

    const record = engine.abilityRecord(state, "innate_power");
    assert(engine.innateT2ClearOutrightLands(state, record).includes("3"), "land 3 empties outright");
    assert(engine.innateRouteToCoverLands(state, record).includes("5"), "land 5 can only route");
    assertEqual(engine.pickInnateAutoTarget(state), "3", "and the certain clear wins");
  });

  test("auto-innate tier 2: a land holding only Cities is not worth the cast", () => {
    const { state } = newGame();
    setAbilityTier(state, "innate_power", 1);
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    // The steepest Blight source on the board, and the cast cannot touch it: 2 damage does not
    // kill a City and the water cannot carry one.
    setLand(state, "6", { cities: 2 }, 0);

    assertEqual(engine.worstBlightLand(state), "6", "it is the worst land there is");
    assertEqual(engine.pickInnateAutoTarget(state), null, "and the cooldown is left unspent");
  });

  test("auto-innate tier 3: it ranks by the Blight its kills remove, not by bodies present", () => {
    const { state } = newGame();
    setAbilityTier(state, "innate_power", 2);
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "6", { cities: 3 }, 0);      // the most bodies, and 2 damage kills none
    setLand(state, "3", { explorers: 2 }, 0);   // fewer bodies, both of them die

    const record = engine.abilityRecord(state, "innate_power");
    assert(engine.innateT3BlightRelieved(state, record, "6") <= 0, "chipping Cities relieves nothing");
    assert(engine.innateT3BlightRelieved(state, record, "3") > 0, "killing the Explorers does");
    assertEqual(engine.pickInnateAutoTarget(state), "3", "so the Explorers are the target");
  });

  test("auto-innate tier 3: breaking a Build outranks denying a Discover", () => {
    const { state } = newGame();
    setAbilityTier(state, "innate_power", 2);
    clearBoard(state);
    state.round.wavesResolved = 1;
    state.invader = { build: ["jungle"], explore: ["mountains"] };
    // Land 3 is jungle and the area hit empties it. Land 7's Town is land 4's only foothold and
    // 2 damage kills it - but tier 3 pays for a deny with its whole cast, so Build comes first.
    setLand(state, "3", { explorers: 2 }, 0);
    setLand(state, "7", { towns: 1 }, 0);

    const record = engine.abilityRecord(state, "innate_power");
    assert(engine.innateBreakBuildLands(state, record).includes("3"), "land 3 breaks its Build");
    assert(engine.innateDenyExploreLands(state, record).includes("7"), "land 7 denies a Discover");
    assertEqual(engine.pickInnateAutoTarget(state), "3", "Build outranks Discover at tier 3");
  });
  /* ---------------------------------------------------------------- *
   * Energy, the ability lock, and the round reset                      *
   * ---------------------------------------------------------------- */

  test("unlock: a fresh spirit holds its opening hand, and the rest are locked", () => {
    const { state } = newGame();

    assertEqual(
      engine.unlockedAbilityIds(state).join(","),
      "innate_power,boon_of_vigor",
      "two abilities to open with"
    );
    assertEqual(
      engine.lockedAbilityIds(state).join(","),
      "rivers_bounty,flash_floods,wash_away",
      "the rest are behind a price, in kit order"
    );
    assertEqual(engine.spiritAbilityIds(state).length, 5, "the bar still lists the whole kit");
  });

  test("unlock: the price ladder runs 5, 10, 20", () => {
    const { state } = newGame();

    assertEqual(engine.abilityUnlockCost(state, "rivers_bounty"), 5, "River's Bounty");
    assertEqual(engine.abilityUnlockCost(state, "flash_floods"), 10, "Flash Floods");
    // Twice the Floods, because what it buys outlives them: 2 damage buys fewer bodies
    // at every rung of the health ladder and a drowning always buys one.
    assertEqual(engine.abilityUnlockCost(state, "wash_away"), 20, "Wash Away");
  });

  test("unlock: a locked ability refuses to be cast at all", () => {
    const { state } = newGame();
    clearBoard(state);
    setLand(state, "3", { towns: 1 }, 0);

    assert(!engine.triggerAbility(state, "flash_floods"), "locked, so it cannot fire");
    assertEqual(state.invaders["3"].towns, 1, "board untouched");
    assertEqual(state.abilities.flash_floods, undefined, "a locked ability carries no cooldown slot");
  });

  test("unlock: buying an ability spends Energy and hands it over ready", () => {
    const { state } = newGame();
    state.resources.energy = 12;

    const ok = engine.unlockAbility(state, "flash_floods");
    assert(ok, "the purchase should succeed");
    assertEqual(state.resources.energy, 2, "10 spent");
    assert(engine.abilityIsUnlocked(state, "flash_floods"), "unlocked");
    assert(engine.abilityIsReady(state, "flash_floods"), "and usable at once, not cooling");
  });

  test("unlock: too little Energy buys nothing", () => {
    const { state } = newGame();
    state.resources.energy = 9;

    assert(!engine.unlockAbility(state, "flash_floods"), "the purchase must refuse");
    assertEqual(state.resources.energy, 9, "Energy untouched");
    assert(!engine.abilityIsUnlocked(state, "flash_floods"), "still locked");
  });

  test("unlock: an ability already owned cannot be bought twice", () => {
    const { state } = newGame();
    state.resources.energy = 40;

    engine.unlockAbility(state, "flash_floods");
    const again = engine.unlockAbility(state, "flash_floods");

    assert(!again, "the second purchase must refuse");
    assertEqual(state.resources.energy, 30, "charged exactly once");
    assert(!engine.unlockAbility(state, "boon_of_vigor"), "the opening hand is not for sale either");
  });

  test("unlock: an ended round cannot spend the Energy it has left", () => {
    // Energy and every unlock made with it die at startRound, so a purchase in the shop would
    // be a button that spends a currency for nothing. The bar stays on screen between rounds -
    // it is the spirit's kit, not a control panel - so the refusal has to live in the engine.
    const { state } = newGame();
    state.resources.energy = 40;
    engine.endRound(state);

    assert(!engine.unlockAbility(state, "flash_floods"), "the unlock refuses once the round is over");
    assert(!engine.abilityIsUnlocked(state, "flash_floods"), "still locked");
    assert(!engine.upgradeAbility(state, "innate_power"), "and so does the tier");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "the Innate stands where it stood");
    assertEqual(state.resources.energy, 40, "nothing was spent");
  });

  test("reset: a new round takes back the Energy and everything bought with it", () => {
    const { state } = newGame();
    state.resources.energy = 300;
    engine.unlockAbility(state, "wash_away");
    engine.upgradeAbility(state, "innate_power");

    assert(engine.abilityIsUnlocked(state, "wash_away"), "owned during the round");
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "and upgraded during it");

    engine.endRound(state);
    engine.startNextRound(state);

    assertEqual(state.resources.energy, 0, "the purse is empty again");
    assert(!engine.abilityIsUnlocked(state, "wash_away"), "the unlock is gone with it");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "and the Innate is back at tier 1");
    assertEqual(
      engine.unlockedAbilityIds(state).join(","),
      "innate_power,boon_of_vigor",
      "every round opens on the same two"
    );
  });

  test("reset: Fear is not touched by the round reset", () => {
    const { state } = newGame();
    state.meta.fear = 14;
    state.resources.energy = 30;

    engine.endRound(state);
    engine.startNextRound(state);

    assertEqual(state.meta.fear, 14, "Fear is the currency that carries");
    assertEqual(state.resources.energy, 0, "Energy is the one that does not");
  });

  test("energy: a defeated invader pays Energy equal to its attack", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.resources.energy = 0;

    setLand(state, "3", { explorers: 1 }, 0);
    engine.applyDamage(state, "3", 1);
    assertEqual(state.resources.energy, 1, "an explorer attacks for 1");

    setLand(state, "3", { towns: 1 }, 0);
    engine.applyDamage(state, "3", 2);
    assertEqual(state.resources.energy, 3, "a town attacks for 2");

    setLand(state, "3", { cities: 1 }, 0);
    engine.applyDamage(state, "3", 3);
    assertEqual(state.resources.energy, 6, "a city attacks for 3");
  });

  test("energy: damage that defeats nothing pays nothing", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.resources.energy = 0;
    setLand(state, "3", { cities: 1 }, 0);

    engine.applyDamage(state, "3", 2);

    assertEqual(state.invaders["3"].cities, 1, "the city is still standing");
    assertEqual(state.resources.energy, 0, "Energy is paid on the kill, not on the hit");
  });

  test("energy: a Dahan casualty pays the player nothing", () => {
    const ctx = fullKit();
    const { state } = ctx;
    clearBoard(state);
    state.resources.energy = 0;
    setLand(state, "3", { cities: 2 }, 1);

    // 6 gross damage is 30% of a casualty a beat, so 6 beats is comfortably past the one it
    // takes to lose the defender.
    advance(ctx, 6 * engine.TIME_SCALE);

    assertEqual(state.dahan["3"], 0, "the lone Dahan fell to the two cities");
    assertEqual(state.resources.energy, 0, "losing a Dahan is not an income");
  });
})();
