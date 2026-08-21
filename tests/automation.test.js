/* The shop's automation half: the abilities that cast themselves, and the round that starts
 * itself - plus the rule that holds the whole of it together.
 *
 * That rule is one sentence: a round cannot spend or benefit from itself. Fear banks at the
 * round's end (see the two-pool note above FEAR_PER_POWER), and upgrades take effect at the
 * next round's start (see activeUpgradeTier). Both halves exist because Auto Start Round
 * removes the pause the shop used to live in, so neither can be enforced by the clock any
 * more. Most of what is checked below is that neither half leaks. */

(function () {
  const {
    engine, test, assert, assertEqual, assertClose, newGame, advance,
    clearBoard, setLand, unlockAllAbilities, grantUpgrade, grantPresence
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  function fullKit(options) {
    const ctx = newGame(options);
    unlockAllAbilities(ctx.state);
    return ctx;
  }

  /* ---------------------------------------------------------------- *
   * Auto River's Bounty                                                *
   * ---------------------------------------------------------------- */

  test("auto-bounty: does nothing until it is bought", () => {
    const { state } = fullKit();
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "no Dahan arrive unbought");
  });

  test("auto-bounty: casts itself and spends the same cooldown a click would", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_bounty");
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    engine.resolveAutoBounty(state);

    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before + engine.ABILITIES.rivers_bounty.amount, "a Dahan arrived");
    assertEqual(
      state.abilities.rivers_bounty.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "rivers_bounty"),
      "owning it changes who presses the button, not how often it can be pressed"
    );
  });

  test("auto-bounty: still needs the ability unlocked with Energy this round", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_bounty");
    // A fresh round owns only the spirit's starting kit - River's Bounty is not in it.
    assert(!engine.abilityIsUnlocked(state, "rivers_bounty"), "not unlocked at round start");

    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "the automation buys the click, not the ability");
  });

  test("auto-bounty: fires on its own through the tick", () => {
    const ctx = fullKit();
    const { state } = ctx;
    grantUpgrade(state, "auto_bounty");
    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    advance(ctx, engine.ABILITIES.rivers_bounty.cooldownSeconds * 2);

    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assert(after > before, "the Dahan arrive without a click");
  });

  /* ---------------------------------------------------------------- *
   * The order the automations resolve in                               *
   * ---------------------------------------------------------------- */

  test("tick order: the Innate goes last, so the heavier casts choose on an unstirred board", () => {
    const ctx = fullKit();
    const { state } = ctx;
    grantUpgrade(state, "auto_innate");
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);

    // Land 4 is inland mountains holding two towns, with the open coast at land 1 beside it.
    // Both automations are ready on the same tick and both want land 4. Wash Away resolves
    // first and empties the build threat whole; the Innate going first would have carried one
    // town off to the coast and left the wash a different, smaller board than the one its own
    // priority list was read off.
    state.invader = { build: ["mountains"], explore: [] };
    setLand(state, "4", { towns: 2 }, 0);

    advance(ctx, 1);

    assertEqual(engine.invaderCountInLand(state.invaders["4"]), 0, "the wash emptied the build threat");
    assertEqual(state.invaders["1"].towns, 2, "both towns went the same way, in one cast");
  });

  /* ---------------------------------------------------------------- *
   * Auto Wash Away                                                     *
   * ---------------------------------------------------------------- */

  test("auto-wash-away: does nothing until it is bought", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "1", { explorers: 2 }, 0);

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["1"].explorers, 2, "nothing moves unbought");
  });

  test("auto-wash-away prio 1: empties a land the next Build would thicken", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);

    // Wetlands is lands 1 and 7. Land 7 is inland, so this is the push half of the ability,
    // and it holds exactly what the push can clear out.
    state.invader = { build: ["wetlands"], explore: [] };
    setLand(state, "7", { explorers: 2 }, 0);

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["7"].explorers, 0, "the build threat was washed out");
  });

  test("auto-wash-away prio 2: takes the coast the sea empties hardest", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    state.round.fearEarned = 0;

    // Land 1 gives the water one unit to carry, land 3 gives it two. Nothing is on the build
    // track, so what the sea takes is the whole question.
    setLand(state, "1", { explorers: 1 }, 0);
    setLand(state, "3", { towns: 2 }, 0);

    assertEqual(engine.pickWashAwayAutoTarget(state), "3", "the fuller coast");

    engine.resolveAutoWashAway(state);
    assertEqual(engine.invaderCountInLand(state.invaders["3"]), 0, "both towns went out to sea");
    assertEqual(state.round.fearEarned, 4, "and a removal pays like a defeat, even unclicked");
  });

  test("auto-wash-away prio 2 outranks routing: a coast beats an inland shove into cover", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Land 8 is inland and undefended, and land 5 next door holds Dahan - the routing case.
    // Land 3 is a coast with one explorer on it, which is worth less on the board but is the
    // only cast that takes a unit off it.
    setLand(state, "8", { explorers: 2 }, 0);
    state.dahan["5"] = 3;
    setLand(state, "3", { explorers: 1 }, 0);

    assertEqual(engine.pickWashAwayAutoTarget(state), "3", "removal outranks relocation");
  });

  test("auto-wash-away prio 3: routes an undefended stack into Dahan cover", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Nothing to break and no coast holding anything, so the pick falls to the routing
    // priority. Land 8's neighbours include land 5, the only land holding Dahan.
    setLand(state, "8", { explorers: 1 }, 0);
    state.dahan["5"] = 3;

    const target = engine.pickWashAwayAutoTarget(state);
    assertEqual(target, "8", "the undefended land is the one to push off");

    engine.resolveAutoWashAway(state);
    assertEqual(state.invaders["8"].explorers, 0, "pushed off the undefended land");
    assertEqual(state.invaders["5"].explorers, 1, "and onto the defended one");
  });

  test("auto-wash-away: it will not stack invaders onto invaders to buy position", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Land 8 is inland, defended and thinning - the protect-thin case - but every neighbour
    // it has is already occupied, so the only push available concentrates a stack. A player
    // may make that trade with their eyes open; the automation declines it.
    setLand(state, "8", { towns: 1 }, 1);
    for (const id of ["5", "6", "7"]) setLand(state, id, { explorers: 1 }, 0);

    assert(engine.abilityLegalLand(state, "wash_away", "8"), "a player could still click it");
    assertEqual(engine.pickWashAwayAutoTarget(state), null, "the automation does not");
  });

  test("auto-wash-away: leaves the cooldown alone when no priority applies", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_wash_away");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    assertEqual(engine.pickWashAwayAutoTarget(state), null, "an empty board asks for nothing");
    engine.resolveAutoWashAway(state);
    assertEqual(state.abilities.wash_away.cooldownRemaining, 0, "a tick that does nothing costs nothing");
  });

  /* ---------------------------------------------------------------- *
   * Auto Flash Floods                                                  *
   * ---------------------------------------------------------------- */

  test("auto-flash-floods: does nothing until it is bought", () => {
    const { state } = fullKit();
    clearBoard(state);
    setLand(state, "1", { explorers: 1 }, 0);

    engine.resolveAutoFlashFloods(state);
    assertEqual(state.invaders["1"].explorers, 1, "nothing burns unbought");
  });

  test("auto-flash-floods prio 1: empties a land the next Build would thicken", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);

    // Wetlands is lands 1 and 7. Land 1 is coastal, so the flood lands for 2 there - enough
    // to take the explorer standing on the build threat.
    state.invader = { build: ["wetlands"], explore: [] };
    setLand(state, "1", { explorers: 1 }, 0);

    assertEqual(engine.pickFlashFloodsAutoTarget(state), "1", "the build threat is the target");
    engine.resolveAutoFlashFloods(state);
    assertEqual(state.invaders["1"].explorers, 0, "and it was washed off the board");
    assertEqual(
      state.abilities.flash_floods.cooldownRemaining,
      engine.abilityCooldownSeconds(state, "flash_floods"),
      "on the same cooldown a click would have spent"
    );
  });

  test("auto-flash-floods prio 2: strikes where the cast actually kills", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Land 6 is inland and holds a city the flood cannot dent; land 3 is coastal and holds an
    // explorer it takes outright. Nothing is on the track, so the kill is what decides.
    setLand(state, "6", { cities: 1 }, 0);
    setLand(state, "3", { explorers: 1 }, 0);

    assertEqual(engine.pickFlashFloodsAutoTarget(state), "3", "the land where something dies");
    engine.resolveAutoFlashFloods(state);
    assertEqual(state.invaders["3"].explorers, 0, "the explorer fell");
    assertEqual(state.invaders["6"].cities, 1, "the city was left alone");
  });

  test("auto-flash-floods: a coast beats an inland when both would kill", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    // Land 4 is inland, land 3 coastal, and both hold a lone explorer. The tie-break is the
    // coastal bonus, not the land id - land 4 would win a plain lowest-id sort.
    setLand(state, "3", { explorers: 1 }, 0);
    setLand(state, "4", { explorers: 1 }, 0);

    assertEqual(engine.flashFloodsDamageIn(state, "3"), 2, "the coast takes the bonus point");
    assertEqual(engine.flashFloodsDamageIn(state, "4"), 1, "the inland does not");
    assertEqual(engine.pickFlashFloodsAutoTarget(state), "3", "so the coast is where it strikes");
  });

  test("auto-flash-floods: leaves the cooldown alone when no priority applies", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    state.invader = { build: [], explore: [] };

    assertEqual(engine.pickFlashFloodsAutoTarget(state), null, "an empty board asks for nothing");
    engine.resolveAutoFlashFloods(state);
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "a tick that does nothing costs nothing");
  });

  test("auto-flash-floods: still needs the ability unlocked with Energy this round", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    setLand(state, "1", { explorers: 1 }, 0);
    assert(!engine.abilityIsUnlocked(state, "flash_floods"), "not in the opening kit");

    engine.resolveAutoFlashFloods(state);
    assertEqual(state.invaders["1"].explorers, 1, "the automation buys the click, not the ability");
  });

  test("auto-flash-floods: fires on its own through the tick", () => {
    const ctx = fullKit();
    const { state } = ctx;
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "3", { explorers: 1 }, 0);

    advance(ctx, engine.ABILITIES.flash_floods.cooldownSeconds);

    assertEqual(state.invaders["3"].explorers, 0, "the explorer went without a click");
  });

  /* ---------------------------------------------------------------- *
   * The auto-cast toggle                                               *
   *                                                                    *
   * Buying an automation used to be a one-way door: the resolver fires *
   * inside tick the instant the cooldown clears, so the card never     *
   * spends a frame a player could click. The checkbox on the card      *
   * splits the purchase from the preference, exactly as the round gate *
   * already splits autoStartRoundOwned from autoStartRoundOn.          *
   * ---------------------------------------------------------------- */

  test("auto-cast toggle: unticked, the automation does not cast and spends nothing", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "3", { explorers: 1 }, 0);

    // Unlocked, ready, and a land it would certainly have picked.
    assert(engine.abilityIsReady(state, "flash_floods"), "ready");
    assertEqual(engine.pickFlashFloodsAutoTarget(state), "3", "and a legal target it wants");

    engine.setAutoCast(state, "flash_floods", false);
    engine.resolveAutoFlashFloods(state);

    assertEqual(state.invaders["3"].explorers, 1, "the board is untouched");
    assertEqual(state.abilities.flash_floods.cooldownRemaining, 0, "and the cooldown is untouched");
    assert(engine.autoCastOwned(state, "flash_floods"), "the upgrade is still owned");
  });

  test("auto-cast toggle: unticking mid-round keeps the running cooldown and the cast already made", () => {
    const ctx = fullKit();
    const { state } = ctx;
    grantUpgrade(state, "auto_flash_floods");
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "3", { explorers: 1 }, 0);

    advance(ctx, 1);
    assertEqual(state.invaders["3"].explorers, 0, "it cast while the box was still ticked");
    const cooling = state.abilities.flash_floods.cooldownRemaining;
    assert(cooling > 0, "and spent a cooldown doing it");

    engine.setAutoCast(state, "flash_floods", false);
    advance(ctx, 1);

    assertEqual(state.invaders["3"].explorers, 0, "the cast that already happened is not undone");
    assertClose(
      state.abilities.flash_floods.cooldownRemaining,
      cooling - 1,
      0.0001,
      "and the cooldown runs on by exactly the second that passed - neither reset nor stretched"
    );
    assertEqual(state.upgrades.purchased.auto_flash_floods, 1, "nothing is refunded and nothing un-bought");
  });

  test("auto-cast toggle: re-ticking resumes on the next ready cooldown, with no reset in between", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_bounty");
    const total = () => engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);

    engine.resolveAutoBounty(state);
    const cooling = state.abilities.rivers_bounty.cooldownRemaining;
    assert(cooling > 0, "the first cast started a cooldown");

    engine.setAutoCast(state, "rivers_bounty", false);
    assertEqual(state.abilities.rivers_bounty.cooldownRemaining, cooling, "unticking does not shorten it");

    // The cooldown it was already carrying runs out on its own. Off, the ready ability simply
    // sits there: nothing casts, and nothing spends the cooldown a second time.
    state.abilities.rivers_bounty.cooldownRemaining = 0;
    const before = total();
    engine.resolveAutoBounty(state);
    assertEqual(total(), before, "no Dahan arrive while it is off");
    assertEqual(state.abilities.rivers_bounty.cooldownRemaining, 0, "and it is still ready, not re-cooled");

    engine.setAutoCast(state, "rivers_bounty", true);
    assertEqual(state.abilities.rivers_bounty.cooldownRemaining, 0, "re-ticking resets nothing either");

    engine.resolveAutoBounty(state);
    assertEqual(total(), before + engine.ABILITIES.rivers_bounty.amount, "it resumes on the next ready cooldown");
  });

  // The two predicates meeting: owned reads what is bought, on reads the round's snapshot. A
  // "simplification" that folds them into one is what this check exists to catch.
  test("auto-cast toggle: bought mid-round the box is there and ticked, and still casts nothing this round", () => {
    const { state } = fullKit();
    clearBoard(state);
    state.invader = { build: [], explore: [] };
    setLand(state, "3", { explorers: 1 }, 0);

    // The purchase alone, without the round snapshot grantUpgrade also writes.
    state.upgrades.purchased.auto_flash_floods = 1;

    assert(engine.autoCastOwned(state, "flash_floods"), "the card draws its checkbox at once");
    assertEqual(state.ui.autoCast.flash_floods, true, "ticked, because nobody unticked it");
    assert(!engine.autoCastOn(state, "flash_floods"), "but the round it was bought in never sees it");

    engine.resolveAutoFlashFloods(state);
    assertEqual(state.invaders["3"].explorers, 1, "so nothing casts before the next round");

    engine.startRound(state);
    assert(engine.autoCastOn(state, "flash_floods"), "the next round's snapshot is what switches it on");
  });

  test("auto-cast toggle: an ability with no automation cannot be toggled at all", () => {
    const { state } = newGame();

    assertEqual(engine.setAutoCast(state, "summon_kraken", true), false, "no automation, no toggle");
    assert(!("summon_kraken" in state.ui.autoCast), "and nothing is written into the map");
    assert(!engine.autoCastOwned(state, "summon_kraken"), "it is never owned");
    assert(!engine.autoCastOn(state, "summon_kraken"), "and never on");
  });

  test("auto-cast toggle: every ability automation in the shop is in the map, and only those", () => {
    const abilityIds = Object.keys(engine.AUTO_CAST_UPGRADES);
    assertEqual(abilityIds.length, 5, "five ability automations");
    for (const abilityId of abilityIds) {
      assert(engine.ABILITIES[abilityId], `${abilityId} is a real ability`);
      assert(engine.UPGRADES[engine.AUTO_CAST_UPGRADES[abilityId]], "and its automation is a real upgrade");
    }
    // The two automations that are deliberately out of scope: one buys a purchase rather than
    // a cast, and the other already has its own toggle.
    const upgradeIds = Object.values(engine.AUTO_CAST_UPGRADES);
    assert(!upgradeIds.includes("auto_buy_abilities"), "auto_buy_abilities casts nothing");
    assert(!upgradeIds.includes("auto_start_round"), "auto_start_round has its own toggle");
  });

  /* ---------------------------------------------------------------- *
   * Prices                                                             *
   * ---------------------------------------------------------------- */

  test("shop: the automation prices rank by what they hand over, not by kit order", () => {
    const { state } = newGame();
    const cost = (id) => engine.upgradeCost(state, id);

    assertEqual(cost("auto_boon"), 25, "Boon: a click every twelve beats");
    assertEqual(cost("auto_innate"), 100, "Innate: a click and a decision");
    assertEqual(cost("auto_bounty"), 200, "Bounty: a Dahan every cooldown, all round");
    assertEqual(cost("auto_flash_floods"), 300, "Flash Floods: damage, which the health ladder erodes");
    assertEqual(cost("auto_wash_away"), 400, "Wash Away: removal, which the health ladder cannot touch");
    assertEqual(cost("auto_start_round"), 500, "Auto Start Round: every round after it");

    // The three ability automations rank by what their ability does to the board: reinforce,
    // then kill, then remove outright. Each rung is a stronger claim on the round than the one
    // under it, and all three sit under the purchase that changes the game's shape.
    assert(cost("auto_flash_floods") > cost("auto_bounty"), "killing is dearer than accruing");
    assert(cost("auto_wash_away") > cost("auto_flash_floods"), "and removal is dearer than killing");
    assert(cost("auto_wash_away") < cost("auto_start_round"), "and all of it is cheaper than every round after it");

    // Deliberately under the last rung of the reinforcement ladder, which is what the Bounty
    // used to be priced against: the ladder sells one Dahan for the whole round and this sells
    // one every 15 beats, so the ladder is the early lever and this is what replaces it.
    const lastRung = Math.round(
      engine.UPGRADES.dahan_reinforcement.baseCost
      * Math.pow(engine.UPGRADE_COST_GROWTH, engine.upgradeMaxTier(newGame().state, "dahan_reinforcement") - 1)
    );
    assert(cost("auto_bounty") < lastRung, "the Bounty undercuts the ladder's last rung");
  });

  test("shop: every automation is a one-off", () => {
    const ids = [
      "auto_boon", "auto_innate", "auto_wash_away", "auto_bounty", "auto_flash_floods",
      "auto_buy_abilities", "auto_start_round"
    ];
    const { state } = newGame();
    for (const id of ids) {
      assertEqual(engine.upgradeMaxTier(state, id), 1, `${id} has a single tier`);
    }
  });

  /* ---------------------------------------------------------------- *
   * Auto-buy abilities                                                 *
   * ---------------------------------------------------------------- */

  test("auto-buy: does nothing until it is bought", () => {
    const { state } = newGame();
    state.resources.energy = 1000;

    engine.resolveAutoBuyAbilities(state);

    assert(!engine.abilityIsUnlocked(state, "rivers_bounty"), "the kit stays locked");
    assertEqual(state.resources.energy, 1000, "and the purse is untouched");
  });

  test("auto-buy: unlocks the kit with the round's own Energy, ready at once", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    state.resources.energy = 35;

    engine.resolveAutoBuyAbilities(state);

    for (const abilityId of ["rivers_bounty", "flash_floods", "wash_away"]) {
      assert(engine.abilityIsUnlocked(state, abilityId), `${abilityId} was bought`);
      assert(engine.abilityIsReady(state, abilityId), "and it arrives ready, as a click's would");
    }
    assertEqual(state.resources.energy, 0, "5 + 10 + 20, exactly what the ladder costs");
  });

  test("auto-buy: cheapest first, so a thin purse is not stalled by the dearest unlock", () => {
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    state.resources.energy = 15;

    engine.resolveAutoBuyAbilities(state);

    assert(engine.abilityIsUnlocked(state, "rivers_bounty"), "the 5 landed");
    assert(engine.abilityIsUnlocked(state, "flash_floods"), "and the 10");
    assert(!engine.abilityIsUnlocked(state, "wash_away"), "the 20 is still out of reach");
    assertEqual(state.resources.energy, 0, "nothing left over and nothing overspent");
  });

  test("auto-buy: unlocks come before tiers, whatever the purse could stretch to", () => {
    // 40 Energy is exactly one Innate tier. Spending it there would leave the three cast
    // automations idling all round on abilities that were never bought.
    const { state } = newGame();
    grantUpgrade(state, "auto_buy_abilities");
    state.resources.energy = 50;

    engine.resolveAutoBuyAbilities(state);

    assert(engine.abilityIsUnlocked(state, "wash_away"), "the kit came first");
    assertEqual(engine.abilityTier(state, "innate_power"), 0, "and the Innate waits its turn");
    assertEqual(state.resources.energy, 15, "35 spent on the three unlocks");
  });

  test("auto-buy: raises the Innate once the kit is bought and the Energy is there", () => {
    // The tiers are bought at the dial's top rung, which `presence_river_deepens` is the gate
    // on (see AUTO_BUY_MODES). Focus is the other half of that rung and stays asleep here:
    // it wants `presence_current_quickens` as well, and this state does not own it.
    const { state } = fullKit();
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = 40;

    engine.resolveAutoBuyAbilities(state);

    assertEqual(engine.abilityTier(state, "innate_power"), 1, "tier 2 on the card");
    assertEqual(state.resources.energy, 0, "paid for out of the round's Energy");
  });

  test("auto-buy: one rung per tick, never two", () => {
    const { state } = fullKit();
    grantUpgrade(state, "auto_buy_abilities");
    grantPresence(state, "presence_river_deepens");
    state.resources.energy = 1000;

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 1, "one rung this tick");

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 2, "the next one on the next tick");

    engine.resolveAutoBuyAbilities(state);
    assertEqual(engine.abilityTier(state, "innate_power"), 2, "and it stops at the top of the ladder");
    assertEqual(state.resources.energy, 1000 - 40 - 150, "spending only the two rungs it climbed");
  });

  test("auto-buy: the tick runs it, and what it buys can fire the same round", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_buy_abilities");
    grantUpgrade(state, "auto_bounty");
    clearBoard(state);
    state.resources.energy = 5;

    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    advance(ctx, 1);

    assert(engine.abilityIsUnlocked(state, "rivers_bounty"), "the tick bought it");
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assert(after > before, "and the automation waiting on it cast on the same tick");
  });

  test("auto-buy: bought mid-round, it leaves that round's Energy alone", () => {
    // The same rule as every other automation: a round cannot benefit from itself. Written
    // straight into the purchase list, without the round snapshot grantUpgrade also writes.
    const { state } = newGame();
    state.upgrades.purchased.auto_buy_abilities = 1;
    state.resources.energy = 100;

    engine.resolveAutoBuyAbilities(state);

    assert(!engine.abilityIsUnlocked(state, "rivers_bounty"), "nothing bought this round");
    assertEqual(state.resources.energy, 100, "and nothing spent");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(engine.activeUpgradeTier(state, "auto_buy_abilities"), 1, "live from the next round");
  });

  /* ---------------------------------------------------------------- *
   * A round cannot benefit from itself                                 *
   * ---------------------------------------------------------------- */

  test("deferral: an automation bought mid-round is owned but idle until the next one", () => {
    const { state } = fullKit();
    state.meta.fear = 1e9;

    assert(engine.purchaseUpgrade(state, "auto_bounty"), "the purchase lands mid-round");
    assertEqual(engine.upgradeTier(state, "auto_bounty"), 1, "owned at once");
    assertEqual(engine.activeUpgradeTier(state, "auto_bounty"), 0, "idle this round");

    const before = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    engine.resolveAutoBounty(state);
    const after = engine.LAND_IDS.reduce((sum, id) => sum + state.dahan[id], 0);
    assertEqual(after, before, "and it does not fire");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(engine.activeUpgradeTier(state, "auto_bounty"), 1, "live from the next round");
  });

  test("deferral: Blight Resilience bought at the brink cannot rescue the round", () => {
    // The reason the deferral rule exists at all. With the shop open all round, a live read
    // would make this an emergency button on a round already lost.
    const { state } = newGame();
    state.meta.fear = 1e9;
    const threshold = state.round.blightThreshold;

    engine.purchaseUpgrade(state, "blight_resilience");
    assertEqual(state.round.blightThreshold, threshold, "this round's threshold does not move");

    engine.endRound(state);
    engine.startNextRound(state);
    assert(state.round.blightThreshold > threshold, "the next round starts with the higher one");
  });

  /* ---------------------------------------------------------------- *
   * Auto Start Round                                                   *
   * ---------------------------------------------------------------- */

  test("auto-start: an ended round stands in the shop until the upgrade is owned", () => {
    const ctx = newGame();
    const { state } = ctx;
    engine.endRound(state);

    assert(!engine.autoStartRoundOwned(state), "not owned yet");
    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);
    assertEqual(state.round.status, "ended", "the round stays ended without it");
  });

  test("auto-start: once owned, the next round begins on its own", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    const number = state.round.number;
    engine.endRound(state);

    advance(ctx, 1);

    assertEqual(state.round.status, "running", "a new round is under way");
    assertEqual(state.round.number, number + 1, "and it is the next one");
  });

  test("auto-start: the toggle turns it off without un-buying it", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.setAutoStartRound(state, false);
    engine.endRound(state);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(state.round.status, "ended", "the shop stays open");
    assert(engine.autoStartRoundOwned(state), "and the upgrade is still owned");

    // Turning it back on needs no second purchase, and the next tick is what acts on it.
    engine.setAutoStartRound(state, true);
    advance(ctx, 1);
    assertEqual(state.round.status, "running", "it picks straight back up");
  });

  test("auto-start: a paused game does not start rounds behind the player's back", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.endRound(state);
    engine.setGameSpeed(state, 0);

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 2);
    assertEqual(state.round.status, "ended", "the speed dial stops this too");
  });

  test("auto-start: each round banks its own Fear as it rolls over", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    state.meta.fear = 0;
    state.round.fearEarned = 17;

    engine.endRound(state);
    assertEqual(state.meta.fear, 17, "banked at the boundary");

    advance(ctx, 1);
    assertEqual(state.round.status, "running", "and the next round is away");
    assertEqual(state.round.fearEarned, 0, "on a fresh tally");
    assertEqual(state.meta.fear, 17, "with the banked Fear untouched");
  });

  test("auto-start: the wave gate is still honoured by a round that started itself", () => {
    // Two independent controls. Auto Start Round says a round begins; auto-proceed says a
    // wave does. Owning one must not quietly grant the other.
    const ctx = newGame({ manualWaves: true });
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");
    engine.endRound(state);

    advance(ctx, 1);
    assertEqual(state.round.status, "running", "the round started");

    advance(ctx, engine.WAVE_INTERVAL_SECONDS * 3);
    assertEqual(state.round.wavesResolved, 0, "but no wave resolved behind the gate");
  });

  /* ---------------------------------------------------------------- *
   * The record                                                         *
   * ---------------------------------------------------------------- */

  test("auto-start: the wave record keeps up across rounds nobody watched", () => {
    const ctx = newGame();
    const { state } = ctx;
    grantUpgrade(state, "auto_start_round");

    state.round.wavesResolved = 9;
    engine.endRound(state);
    advance(ctx, 1);
    assertEqual(state.meta.bestWaveReached, 9, "the first round set it");

    state.round.wavesResolved = 4;
    engine.endRound(state);
    advance(ctx, 1);
    assertEqual(state.meta.bestWaveReached, 9, "a shorter one does not lower it");
  });
})();
