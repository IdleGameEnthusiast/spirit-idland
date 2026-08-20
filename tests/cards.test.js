/* Power card checks - docs/spec/10-power-cards.md#acceptance
 *
 * Three things in one feature, and this suite is in that order: buying a card with Presence,
 * being handed one by a round deep enough to have earned it, and casting it. Defense has its
 * own suite next door, because it is a rule about the fight rather than about cards.
 *
 * Every draw here is pinned through setRng - the fixture seeds it - so a failing assertion is
 * a real failure and never a re-roll. Nothing below asserts on a distribution. */

(function () {
  const {
    engine,
    test,
    assert,
    assertEqual,
    assertDeepEqual,
    newGame,
    advance,
    clearBoard,
    setLand,
    grantUpgrade,
    ownCards,
    handCards,
    memoryStorage
  } = typeof require === "function" ? require("./harness.js") : window.SpiritTests;

  const ALL_CARDS = engine.POWER_CARD_IDS;

  /* ------------------------------------------------------------------ *
   * Buying: the Presence draw                                           *
   * ------------------------------------------------------------------ */

  test("cards: the draw ladder is 10 / 16 / 26 and the re-roll is a quarter of it", () => {
    const { state } = newGame();

    assertEqual(engine.powerCardDrawCost(state), 10, "the first card costs 10 Presence");
    assertEqual(engine.powerCardRerollCost(state), 3, "and a re-roll a quarter of that, rounded up");

    ownCards(state, ["pull_beneath"]);
    assertEqual(engine.powerCardDrawCost(state), 16, "the second climbs on the 1.6 curve");
    assertEqual(engine.powerCardRerollCost(state), 4);

    ownCards(state, ["pull_beneath", "tsunami"]);
    assertEqual(engine.powerCardDrawCost(state), 26, "and the third");
    assertEqual(engine.powerCardRerollCost(state), 7);

    // The whole ladder, against the table in the spec: 432 Presence for all seven.
    let total = 0;
    const running = newGame().state;
    for (let n = 0; n < ALL_CARDS.length; n += 1) {
      ownCards(running, ALL_CARDS.slice(0, n));
      total += engine.powerCardDrawCost(running);
    }
    assertEqual(total, 432, "all seven cards cost 432 Presence together");
  });

  test("cards: a fresh game offers three of the seven, and none of them is owned", () => {
    const { state } = newGame();
    // A fresh game has not rolled one yet - the roll happens on the first look, which is what
    // the shop does and what this stands in for.
    assertEqual(state.powerCards.draw.offerIds.length, 0, "nothing rolled before it is looked at");
    const offer = engine.ensurePowerCardOffer(state);

    assertEqual(offer.length, 3, "three on show");
    assertEqual(new Set(offer).size, 3, "and no card offered twice");
    for (const id of offer) assert(engine.POWER_CARDS[id], `${id} is a real card`);
  });

  test("cards: the offer survives a save, a load and a re-render unchanged", () => {
    const { state } = newGame();
    const before = engine.ensurePowerCardOffer(state);

    const storage = memoryStorage();
    engine.saveState(state, storage);
    const loaded = engine.loadState(storage);

    assertDeepEqual(engine.powerCardOfferIds(loaded), before, "a reload is not a free re-roll");
    // Re-reading it is not a roll either: the offer is state, and only paying moves it.
    assertDeepEqual(engine.powerCardOfferIds(loaded), before);
    assertDeepEqual(engine.ensurePowerCardOffer(loaded), before, "and neither is a re-render");
  });

  test("cards: buying spends Presence, is permanent, and rolls a fresh offer", () => {
    const { state } = newGame();
    state.meta.presence = 50;
    const wanted = engine.ensurePowerCardOffer(state)[0];

    assert(engine.drawPowerCard(state, wanted), "the card is bought");
    assertEqual(state.meta.presence, 40, "10 Presence spent");
    assert(engine.ownedPowerCardIds(state).includes(wanted), "and owned");

    const offer = engine.powerCardOfferIds(state);
    assertEqual(offer.length, 3, "a fresh three is on show for the next draw");
    assert(!offer.includes(wanted), "and it never offers what is already owned");
    assertEqual(engine.powerCardDrawCost(state), 16, "the ladder has moved up a rung");
  });

  test("cards: a card the offer does not hold cannot be bought, and neither can one too dear", () => {
    const { state } = newGame();
    state.meta.presence = 1000;
    const offer = engine.ensurePowerCardOffer(state);
    const notOffered = ALL_CARDS.find((id) => !offer.includes(id));

    assert(!engine.drawPowerCard(state, notOffered), "only the three on show are for sale");
    assertEqual(state.meta.presence, 1000, "and nothing was spent trying");

    state.meta.presence = 9;
    assert(!engine.drawPowerCard(state, offer[0]), "9 Presence does not buy a 10 Presence card");
    assertEqual(engine.ownedPowerCardIds(state).length, 0);
  });

  test("cards: owning survives an ascension, which is what Presence buys", () => {
    const { state } = newGame();
    ownCards(state, ["accelerated_rot", "tsunami"]);
    // Enough of a cycle behind it that the Reclaim is allowed at all.
    state.meta.cycleFearGenerated = 100000;
    state.meta.fear = 100000;
    engine.endRound(state);

    assert(engine.canAscend(state), "the cycle is worth reclaiming");
    engine.ascend(state);

    assertDeepEqual(
      engine.ownedPowerCardIds(state).slice().sort(),
      ["accelerated_rot", "tsunami"],
      "cards are kept, like every other Presence purchase"
    );
    assertEqual(state.upgrades.purchased.power_card_interval, undefined, "the Fear row is not");
    assertDeepEqual(state.round.cards.handIds, [], "but the hand is gone with the round");
  });

  /* ---------- The re-roll and its guarantee ---------- */

  test("cards: a paid re-roll returns at least two cards the old offer did not hold", () => {
    // Every unowned count from 7 down to 4, because the guarantee shrinks with the pool and
    // the interesting rungs are the last two.
    for (let owned = 0; owned <= ALL_CARDS.length - 4; owned += 1) {
      const { state } = newGame({ seed: 7 + owned });
      ownCards(state, ALL_CARDS.slice(0, owned));
      state.meta.presence = 1000;

      const before = engine.powerCardOfferIds(state);
      const unowned = engine.unownedPowerCardIds(state);
      const cost = engine.powerCardRerollCost(state);

      assert(engine.powerCardRerollAllowed(state), `${unowned.length} unowned still allows a re-roll`);
      assert(engine.rerollPowerCardOffer(state), "the re-roll is taken");
      assertEqual(state.meta.presence, 1000 - cost, "and paid for");

      const after = engine.powerCardOfferIds(state);
      const fresh = after.filter((id) => !before.includes(id));
      const promised = Math.min(
        engine.POWER_CARD_REROLL_GUARANTEE,
        unowned.filter((id) => !before.includes(id)).length
      );

      assertEqual(after.length, Math.min(3, unowned.length), "the offer stays full");
      assertEqual(new Set(after).size, after.length, "with no card on show twice");
      assert(fresh.length >= promised, `${fresh.length} new cards, at least ${promised} promised`);
      for (const id of after) assert(!engine.ownedPowerCardIds(state).includes(id), "and none of them owned");
    }
  });

  test("cards: with three or fewer unowned the re-roll is refused rather than sold", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice(0, 4));
    state.meta.presence = 1000;

    assertEqual(engine.unownedPowerCardIds(state).length, 3);
    assert(!engine.powerCardRerollAllowed(state), "there is nothing left to guarantee");

    const before = engine.powerCardOfferIds(state);
    assert(!engine.rerollPowerCardOffer(state), "so the button is dead");
    assertEqual(state.meta.presence, 1000, "and takes no Presence");
    assertDeepEqual(engine.powerCardOfferIds(state), before, "the offer stands");
  });

  test("cards: a re-roll with too little Presence changes nothing", () => {
    const { state } = newGame();
    state.meta.presence = 2;
    const before = engine.ensurePowerCardOffer(state);

    assert(!engine.rerollPowerCardOffer(state), "3 Presence is the price and 2 is not it");
    assertEqual(state.meta.presence, 2);
    assertDeepEqual(engine.powerCardOfferIds(state), before);
  });

  /* ------------------------------------------------------------------ *
   * Holding: the drip                                                   *
   * ------------------------------------------------------------------ */

  test("cards: the first draw is wave 25, then one every 20", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());

    for (let wave = 1; wave < 25; wave += 1) {
      state.round.wavesResolved = wave;
      engine.resolveCardDraw(state);
    }
    assertEqual(engine.cardsInHand(state).length, 0, "nothing before wave 25, however much is owned");

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);
    assertEqual(engine.cardsInHand(state).length, 1, "the first card at wave 25");
    assertEqual(state.round.cards.nextDrawWave, 45, "and the next is due at 45");

    state.round.wavesResolved = 45;
    engine.resolveCardDraw(state);
    state.round.wavesResolved = 65;
    engine.resolveCardDraw(state);
    assertEqual(engine.cardsInHand(state).length, 3, "three cards by wave 65");
    assertEqual(new Set(engine.cardsInHand(state)).size, 3, "and never the same card twice");
  });

  test("cards: power_card_interval shortens the gap, read off the round snapshot", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());
    grantUpgrade(state, "power_card_interval", 5);

    assertEqual(engine.powerCardDrawInterval(state), 15, "20 - tier");

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);
    assertEqual(state.round.cards.nextDrawWave, 40, "so the second card is due at 40, not 45");

    // Owned but not yet in the round's snapshot: bought mid-round, so it pays off next round.
    const later = newGame().state;
    ownCards(later, ALL_CARDS.slice());
    later.upgrades.purchased.power_card_interval = 10;
    assertEqual(engine.powerCardDrawInterval(later), 20, "a mid-round purchase does not shorten this round");
  });

  test("cards: a round owning nothing draws nothing, and banks no draws for later", () => {
    const { state } = newGame();

    state.round.wavesResolved = 25;
    assertEqual(engine.resolveCardDraw(state), null, "nothing owned, nothing happens");
    assertEqual(state.round.cards.nextDrawWave, 45, "and the wave is spent rather than saved");

    ownCards(state, ["accelerated_rot"]);
    state.round.wavesResolved = 30;
    assertEqual(engine.resolveCardDraw(state), null, "buying mid-round does not hand it over early");
    assertEqual(engine.cardsInHand(state).length, 0);
  });

  test("cards: a drawn card lands ready, castable on the tick it arrives", () => {
    const { state } = newGame();
    ownCards(state, ["accelerated_rot"]);
    clearBoard(state);
    setLand(state, "5", { towns: 2 }, 0);

    state.round.wavesResolved = 25;
    const drawn = engine.resolveCardDraw(state);
    assertEqual(drawn, "accelerated_rot");

    assert(engine.unlockedAbilityIds(state).includes(drawn), "the bar shows it");
    assert(engine.abilityIsReady(state, drawn), "and it is ready, not cooling");
    assert(engine.triggerAbility(state, drawn), "so it arms on the same tick");
    assert(engine.resolveAbilityTarget(state, "5"), "and casts");
  });

  test("cards: a card dies with the round that drew it", () => {
    const { state } = newGame();
    handCards(state, ["accelerated_rot"]);
    state.round.cards.drawsTaken = 1;
    assert(state.abilities.accelerated_rot, "in hand, with a slot in the bar");

    engine.endRound(state);
    engine.startNextRound(state);

    assertDeepEqual(state.round.cards.handIds, [], "the hand is empty again");
    assertEqual(state.abilities.accelerated_rot, undefined, "and the bar slot is gone");
    assertEqual(state.round.cards.drawsTaken, 0, "the drip starts over");
    assertEqual(state.round.cards.nextDrawWave, engine.POWER_CARD_FIRST_DRAW_WAVE);
    assert(engine.ownedPowerCardIds(state).includes("accelerated_rot"), "but the card is still owned");
  });

  /* ---------- The arrival, and how the player is told ---------- *
   *
   * A card reaching the hand is the one thing in a round that is given rather than spent, and
   * the engine's whole part in announcing it is the fx below. What the board and the bar make
   * of it is the view layer's business - see 06-ui-contract.md#the-card-arrival - but the fx
   * being written, carrying the right card and the right wave, and dying with the round, is
   * a rule and belongs here.
   */

  test("cards: a draw leaves an fx naming the card and the wave that earned it", () => {
    const { state } = newGame();
    ownCards(state, ["accelerated_rot"]);

    assertEqual(engine.activeCardFx(state), null, "nothing to announce before the first draw");

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);

    const fx = engine.activeCardFx(state);
    assert(fx, "the draw should leave an fx behind");
    assertEqual(fx.cardId, "accelerated_rot", "naming the card that arrived");
    assertEqual(fx.wave, 25, "and the wave that paid for it");
  });

  test("cards: a draw that hands over nothing announces nothing", () => {
    const { state } = newGame();

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);
    assertEqual(engine.activeCardFx(state), null, "nothing owned, so nothing to show");

    // Everything owned is already in hand: the wave is spent silently, and a reveal here would
    // be announcing a card the player has been holding for twenty waves.
    handCards(state, ["accelerated_rot"]);
    state.powerCards.owned = ["accelerated_rot"];
    state.round.wavesResolved = 45;
    engine.resolveCardDraw(state);
    assertEqual(engine.activeCardFx(state), null, "and nothing drawable is just as silent");
  });

  test("cards: a re-draw announces the card it swapped to, not the one thrown back", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());
    state.resources.energy = 100;

    state.round.wavesResolved = 25;
    const first = engine.resolveCardDraw(state);
    assert(engine.redrawPowerCard(state, first), "thrown back");

    const fx = engine.activeCardFx(state);
    assert(fx, "the swap is an arrival too - it is what the Energy was spent to see");
    assertEqual(fx.cardId, engine.cardsInHand(state)[0], "and it names what is in hand now");
    assert(fx.cardId !== first, "not the card that was returned");
  });

  test("cards: the arrival fx expires on its own clock, longer than the others", () => {
    const ctx = newGame();
    const { state, clock } = ctx;
    ownCards(state, ["accelerated_rot"]);

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);

    // Past the flash the defeat and Blight chips run on, and the reveal is still up: it carries
    // text to read, not a number that moved.
    clock.advance(engine.DEFEAT_FX_MS / 1000 + 0.1);
    assert(engine.activeCardFx(state), "still fresh where a defeat chip would already be gone");

    clock.advance(engine.CARD_FX_MS / 1000);
    assertEqual(engine.activeCardFx(state), null, "and gone once its own window closes");
  });

  test("cards: the arrival fx does not survive the round that drew it", () => {
    const { state } = newGame();
    ownCards(state, ["accelerated_rot"]);

    state.round.wavesResolved = 25;
    engine.resolveCardDraw(state);
    assert(engine.activeCardFx(state), "up during the round");

    engine.endRound(state);
    engine.startNextRound(state);
    assertEqual(state.ui.cardFx, null, "and cleared with the hand it announced");
  });

  test("cards: a junk fx is dropped rather than drawn as an empty face", () => {
    assertEqual(engine.normalizeCardFx(null), null, "nothing at all");
    assertEqual(engine.normalizeCardFx({ cardId: "not_a_card", at: 1 }), null, "an id no card answers to");
    assertEqual(engine.normalizeCardFx({ cardId: "accelerated_rot" }), null, "no timestamp, no freshness");

    assertDeepEqual(
      engine.normalizeCardFx({ cardId: "accelerated_rot", wave: 25.7, at: 5, junk: 1 }),
      { cardId: "accelerated_rot", wave: 25, at: 5 },
      "and a good one is floored and stripped to the three fields the view reads"
    );
  });

  /* ---------- The re-draw ---------- */

  test("cards: the re-draw fee is 10 per draw taken, and swaps the card", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());
    state.resources.energy = 100;

    state.round.wavesResolved = 25;
    const first = engine.resolveCardDraw(state);
    assertEqual(engine.powerCardRedrawCost(state), 10, "10 for the round's first card");
    assert(engine.powerCardRedrawOffered(state, first), "and the button is on that card");

    assert(engine.redrawPowerCard(state, first), "thrown back");
    assertEqual(state.resources.energy, 90, "10 Energy spent");

    const hand = engine.cardsInHand(state);
    assertEqual(hand.length, 1, "one card in hand either way");
    assert(hand[0] !== first, "and it is a different one");
    assert(state.round.cards.rejectedIds.includes(first), "the old one is out of this draw's pool");
    assertEqual(state.abilities[first], undefined, "and out of the bar");

    state.round.wavesResolved = 45;
    engine.resolveCardDraw(state);
    assertEqual(engine.powerCardRedrawCost(state), 20, "20 for the second card");
  });

  test("cards: casting is accepting - the re-draw is gone from the first cast on", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());
    state.resources.energy = 100;
    clearBoard(state);
    for (const land of engine.LAND_IDS) setLand(state, land, { towns: 2 }, 1);

    state.round.wavesResolved = 25;
    const card = engine.resolveCardDraw(state);
    assert(engine.powerCardRedrawOffered(state, card), "offered before the cast");

    const record = engine.POWER_CARDS[card];
    engine.triggerAbility(state, card);
    if (record.needsTarget) {
      const land = engine.abilityLegalLands(state, card)[0];
      engine.resolveAbilityTarget(state, land);
    }

    assert(!engine.powerCardRedrawOffered(state, card), "and gone after it");
    assertEqual(state.round.cards.pendingRedrawId, null);
    assert(!engine.redrawPowerCard(state, card), "there is no click order that casts then swaps");
    assert(engine.cardsInHand(state).includes(card), "the card stays in hand");
  });

  test("cards: the re-draw pool narrows, and the button dies when it empties", () => {
    const { state } = newGame();
    ownCards(state, ["pull_beneath", "accelerated_rot", "tsunami"]);
    state.resources.energy = 1000;

    state.round.wavesResolved = 25;
    const first = engine.resolveCardDraw(state);
    assertEqual(engine.powerCardRedrawPool(state).length, 2, "two others to swap to");

    const second = engine.cardsInHand(state)[0] === first ? first : first;
    assert(engine.redrawPowerCard(state, second));
    assertEqual(engine.powerCardRedrawPool(state).length, 1, "one left after the first swap");

    assert(engine.redrawPowerCard(state, engine.cardsInHand(state)[0]));
    assertEqual(engine.powerCardRedrawPool(state).length, 0, "and none after the second");
    assert(!engine.powerCardRedrawOffered(state, engine.cardsInHand(state)[0]), "so the last card stands");
  });

  test("cards: a re-draw with too little Energy leaves the hand alone", () => {
    const { state } = newGame();
    ownCards(state, ALL_CARDS.slice());
    state.resources.energy = 4;

    state.round.wavesResolved = 25;
    const card = engine.resolveCardDraw(state);
    assert(!engine.redrawPowerCard(state, card), "10 Energy is the price and 4 is not it");
    assertEqual(state.resources.energy, 4);
    assertDeepEqual(engine.cardsInHand(state), [card]);
  });

  /* ------------------------------------------------------------------ *
   * Casting: a card is an ability                                       *
   * ------------------------------------------------------------------ */

  test("cards: cooldowns are authored in beats, exactly like the kit", () => {
    const { state } = newGame();
    handCards(state, ALL_CARDS.slice());

    const beats = {
      pull_beneath: 10,
      song_of_sanctity: 10,
      uncanny_melting: 12,
      natures_resilience: 12,
      encompassing_ward: 20,
      accelerated_rot: 30,
      tsunami: 50
    };
    for (const [id, want] of Object.entries(beats)) {
      assertEqual(
        engine.abilityCooldownSeconds(state, id),
        want * engine.TIME_SCALE,
        `${id} runs ${want} beats`
      );
    }
  });

  /* The number the Presence shop prints beside each offer - docs/spec/06-ui-contract.md#power-cards.
   * The row draws it off the record rather than off abilityCooldownSeconds, so what is pinned
   * here is that the record is the *stable* figure: a round's frozen multiplier and a Focus
   * purchase both move the effective cooldown and neither may move what the offer quotes. */
  test("cards: the figure the offer quotes is the authored one, which nothing in a round moves", () => {
    const { state } = newGame();
    handCards(state, ["tsunami"]);
    state.presenceUpgrades.purchased.presence_current_quickens = 1;
    state.resources.energy = 500;

    const authored = engine.abilityRecord(state, "tsunami").cooldownSeconds;
    assertEqual(authored, 50 * engine.TIME_SCALE, "50 beats, straight off the card");

    state.round.abilityCooldownMult = 0.5;
    assert(engine.purchaseAbilityFocus(state, "tsunami"), "and Focus is bought on top");
    assert(
      engine.abilityCooldownSeconds(state, "tsunami") < authored,
      "both shorten what a cast really costs"
    );
    assertEqual(
      engine.abilityRecord(state, "tsunami").cooldownSeconds,
      authored,
      "and neither touches the number the offer prints"
    );
  });

  test("cards: both locales print a cooldown on the offer and explain it", () => {
    for (const lang of ["de", "en"]) {
      const t = engine.I18N[lang];
      assert(/\{seconds\}/.test(t.cardOfferCooldownLabel || ""), `${lang} has no cooldown label`);
      assert(t.cardOfferCooldownHint, `${lang} does not explain what the number is`);
    }
  });

  test("cards: cancel-by-reclick and the cooldown behave like a kit ability's", () => {
    const ctx = newGame();
    const { state } = ctx;
    handCards(state, ["pull_beneath"]);
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 0);

    assert(engine.triggerAbility(state, "pull_beneath"), "armed");
    assertEqual(state.pendingAbilityTarget, "pull_beneath");
    assert(!engine.triggerAbility(state, "pull_beneath"), "a second click disarms it");
    assertEqual(state.pendingAbilityTarget, null);
    assert(engine.abilityIsReady(state, "pull_beneath"), "and spends no cooldown");

    engine.triggerAbility(state, "pull_beneath");
    engine.resolveAbilityTarget(state, "5");
    assert(!engine.abilityIsReady(state, "pull_beneath"), "a real cast does spend it");

    // Ten beats is the card's whole clock, run down through the real tick rather than by
    // writing cooldownRemaining by hand - what is being checked is that a card's cooldown is
    // on the same clock the kit's is, which is a claim about the tick and about nothing else.
    advance(ctx, 10 * engine.TIME_SCALE);
    assert(engine.abilityIsReady(state, "pull_beneath"), "and it comes back");
  });

  test("cards: no card casts itself, at any price", () => {
    const { state } = newGame();
    handCards(state, ALL_CARDS.slice());
    for (const id of ALL_CARDS) {
      assert(!engine.autoCastOwned(state, id), `${id} has no automation to own`);
      assertEqual(engine.AUTO_CAST_UPGRADES[id], undefined, "and no Fear row that would sell one");
    }
  });

  /* ---------- The seven, one at a time ---------- */

  test("card pull_beneath: 3 Fear and 2 damage, 3 in Desert or Wetlands", () => {
    const { state } = newGame();
    handCards(state, ["pull_beneath"]);
    clearBoard(state);

    // Land 4 is Jungle - no terrain bonus - and land 2 is Desert.
    setLand(state, "4", { towns: 2 }, 0);
    state.round.fearEarned = 0;
    engine.triggerAbility(state, "pull_beneath");
    engine.resolveAbilityTarget(state, "4");
    assert(state.round.fearEarned >= 3, "the Fear clause always pays");
    assertEqual(engine.invaderCountInLand(state.invaders["4"]), 1, "2 damage kills one 2-HP town");

    state.abilities.pull_beneath.cooldownRemaining = 0;
    setLand(state, "2", { towns: 1, explorers: 1 }, 0);
    assertEqual(engine.landTerrain("2"), "desert", "land 2 is Desert");
    engine.triggerAbility(state, "pull_beneath");
    engine.resolveAbilityTarget(state, "2");
    assertEqual(engine.invaderCountInLand(state.invaders["2"]), 0, "3 damage takes the town and the explorer");
  });

  test("card pull_beneath: it needs a land with invaders", () => {
    const { state } = newGame();
    handCards(state, ["pull_beneath"]);
    clearBoard(state);
    setLand(state, "5", { towns: 1 }, 0);

    assert(engine.abilityLegalLand(state, "pull_beneath", "5"), "invaders make it legal");
    assert(!engine.abilityLegalLand(state, "pull_beneath", "4"), "an empty land does not");
  });

  test("card song_of_sanctity: Explorers make it a clearing tool, no Explorers a removal", () => {
    const { state } = newGame();
    handCards(state, ["song_of_sanctity"]);
    clearBoard(state);

    // Explorer mode: one destroyed, the rest pushed, and no Blight touched.
    setLand(state, "5", { explorers: 3 }, 0);
    state.round.blight = 4;
    state.round.blightByLand["5"] = 4;
    engine.triggerAbility(state, "song_of_sanctity");
    engine.resolveAbilityTarget(state, "5");

    assertEqual(state.invaders["5"].explorers, 0, "one destroyed, two pushed out");
    assertEqual(state.round.blight, 4, "and the removal did not also fire");

    // Removal mode: the same card on a land with Blight and no Explorers.
    state.abilities.song_of_sanctity.cooldownRemaining = 0;
    setLand(state, "4", { towns: 1 }, 0);
    state.round.blightByLand["4"] = 2;
    state.round.blight = 6;
    engine.triggerAbility(state, "song_of_sanctity");
    engine.resolveAbilityTarget(state, "4");

    assertEqual(state.round.blight, 5, "one Blight off the round's clock");
    assertEqual(state.round.blightByLand["4"], 1, "and off the land, together");
    assertEqual(state.invaders["4"].towns, 1, "the Town is untouched - it destroys Explorers only");
  });

  test("card song_of_sanctity: a land with Blight and no Explorer is a legal target", () => {
    const { state } = newGame();
    handCards(state, ["song_of_sanctity"]);
    clearBoard(state);
    state.round.blight = 1;
    state.round.blightByLand["6"] = 1;

    assert(engine.abilityLegalLand(state, "song_of_sanctity", "6"), "Blight alone is enough");
    assert(!engine.abilityLegalLand(state, "song_of_sanctity", "7"), "an empty, clean land is not");
  });

  test("card uncanny_melting: the two clauses are independent", () => {
    const { state } = newGame();
    handCards(state, ["uncanny_melting"]);
    clearBoard(state);

    // Jungle, full of invaders, no Blight: Fear only.
    setLand(state, "4", { cities: 2, explorers: 1 }, 0);
    state.round.fearEarned = 0;
    engine.triggerAbility(state, "uncanny_melting");
    engine.resolveAbilityTarget(state, "4");
    assertEqual(Math.floor(state.round.fearEarned), 9, "3 Fear per body, counting bodies not power");

    // Desert, no invaders, Blight standing: removal only.
    state.abilities.uncanny_melting.cooldownRemaining = 0;
    state.round.blight = 3;
    state.round.blightByLand["2"] = 3;
    state.round.fearEarned = 0;
    engine.triggerAbility(state, "uncanny_melting");
    engine.resolveAbilityTarget(state, "2");
    assertEqual(state.round.blight, 2, "the Desert land still gets its removal");
    assertEqual(Math.floor(state.round.fearEarned), 0, "with no invaders to pay for");
  });

  test("card natures_resilience: it never fails, because Defend always applies", () => {
    const { state } = newGame();
    handCards(state, ["natures_resilience"]);
    clearBoard(state);

    for (const land of engine.LAND_IDS) {
      assert(engine.abilityLegalLand(state, "natures_resilience", land), `${land} is a legal target`);
    }

    engine.triggerAbility(state, "natures_resilience");
    assert(engine.resolveAbilityTarget(state, "7"), "an empty, clean land still takes the cast");
    assertEqual(engine.defenseInLand(state, "7"), 6, "Defend 6 laid down");
  });

  test("card encompassing_ward: Defend 2 in every land, and no target asked for", () => {
    const { state } = newGame();
    handCards(state, ["encompassing_ward"]);

    assertEqual(engine.POWER_CARDS.encompassing_ward.needsTarget, false);
    assert(engine.triggerAbility(state, "encompassing_ward"), "it resolves on the click itself");
    assertEqual(state.pendingAbilityTarget, null, "nothing is left armed");

    for (const land of engine.LAND_IDS) {
      assertEqual(engine.defenseInLand(state, land), 2, `land ${land} is warded`);
    }
  });

  test("card accelerated_rot: 10 Fear, 5 damage and a Blight, all three in one cast", () => {
    const { state } = newGame();
    handCards(state, ["accelerated_rot"]);
    clearBoard(state);
    setLand(state, "5", { cities: 1, towns: 1 }, 0);
    state.round.blight = 4;
    state.round.blightByLand["5"] = 2;
    state.round.fearEarned = 0;

    engine.triggerAbility(state, "accelerated_rot");
    engine.resolveAbilityTarget(state, "5");

    assertEqual(engine.invaderCountInLand(state.invaders["5"]), 0, "5 damage takes a City and a Town");
    assertEqual(state.round.blight, 3, "one Blight removed");
    assertEqual(state.round.blightByLand["5"], 1, "from the clicked land");
    // 10 flat, plus what the two kills paid on their own.
    assert(state.round.fearEarned >= 10, "the flat 10 Fear is paid");
  });

  test("card tsunami: coastal only, and the switch decides the other coasts", () => {
    const { state } = newGame();
    handCards(state, ["tsunami"]);
    clearBoard(state);
    // Lands 1, 2 and 3 are the coast.
    setLand(state, "1", { cities: 2 }, 3);
    setLand(state, "2", { towns: 1 }, 2);
    setLand(state, "3", { towns: 1 }, 2);
    setLand(state, "5", { cities: 1 }, 1);

    assert(engine.abilityLegalLand(state, "tsunami", "1"), "a coastal land with invaders");
    assert(!engine.abilityLegalLand(state, "tsunami", "5"), "and never an inland one");

    engine.triggerAbility(state, "tsunami");
    engine.resolveAbilityTarget(state, "1");

    assertEqual(state.dahan["1"], 1, "the target loses 2 Dahan");
    assertEqual(state.dahan["2"], 1, "and each other coast loses 1");
    assertEqual(state.dahan["3"], 1);
    assertEqual(state.dahan["5"], 1, "inland is untouched");
    assertEqual(engine.invaderCountInLand(state.invaders["2"]), 0, "4 damage clears the 2-HP town");
  });

  test("card tsunami: with the switch off it is the one land only", () => {
    const { state } = newGame();
    handCards(state, ["tsunami"]);
    engine.setPowerCardOption(state, "tsunami", false);
    clearBoard(state);
    setLand(state, "1", { cities: 2 }, 3);
    setLand(state, "2", { towns: 1 }, 2);
    setLand(state, "3", { towns: 1 }, 2);

    engine.triggerAbility(state, "tsunami");
    engine.resolveAbilityTarget(state, "1");

    assertEqual(state.dahan["1"], 1, "the target still pays its 2 Dahan");
    assertEqual(state.dahan["2"], 2, "and the other coasts pay nothing");
    assertEqual(state.dahan["3"], 2);
    assertEqual(engine.invaderCountInLand(state.invaders["2"]), 1, "nor take any damage");
  });

  test("card tsunami: emptying a land of Dahan resets its progress bar", () => {
    const { state } = newGame();
    handCards(state, ["tsunami"]);
    clearBoard(state);
    setLand(state, "1", { cities: 1 }, 2);
    state.round.dahanProgress["1"] = 0.8;

    engine.triggerAbility(state, "tsunami");
    engine.resolveAbilityTarget(state, "1");

    assertEqual(state.dahan["1"], 0, "both Dahan destroyed");
    assertEqual(state.round.dahanProgress["1"], 0, "so reinforcements arrive at a full bar");
  });

  /* ---------- Blight removal, as a rule rather than as a card ---------- */

  test("cards: a removal in the tick the threshold is reached does not save the round", () => {
    const { state } = newGame();
    handCards(state, ["accelerated_rot"]);
    clearBoard(state);
    setLand(state, "5", { cities: 3 }, 0);

    state.round.blight = state.round.blightThreshold - 1;
    state.round.blightByLand["5"] = state.round.blight;
    state.round.blightProgress["5"] = 0.999;

    engine.resolveContinuousCombat(state, 5);
    assertEqual(state.round.status, "ended", "the round ends in the tick the bar filled");

    // And the card cannot reach back past that: the round is over, so the cast is refused.
    assert(!engine.triggerAbility(state, "accelerated_rot"), "no cast lands after the end");
  });

  test("cards: removal takes it off the round clock and the land together", () => {
    const { state } = newGame();
    handCards(state, ["natures_resilience"]);
    state.round.blight = 5;
    state.round.blightByLand["3"] = 5;
    state.round.blightProgress["3"] = 0.4;

    engine.triggerAbility(state, "natures_resilience");
    engine.resolveAbilityTarget(state, "3");

    assertEqual(state.round.blight, 4);
    assertEqual(state.round.blightByLand["3"], 4);
    assertEqual(state.round.blightProgress["3"], 0.4, "the part-filled bar is left where it stands");
  });

  test("cards: a targeted removal on a clean land removes nothing at all", () => {
    const { state } = newGame();
    handCards(state, ["natures_resilience"]);
    state.round.blight = 5;
    state.round.blightByLand["3"] = 5;

    engine.triggerAbility(state, "natures_resilience");
    engine.resolveAbilityTarget(state, "6");

    assertEqual(state.round.blight, 5, "the clicked land had none, so the clause did nothing");
    assertEqual(engine.defenseInLand(state, "6"), 6, "but the Defend half still landed");
  });

  test("cards: the untargeted removal takes the worst land, ties on the lowest id", () => {
    const { state } = newGame();
    state.round.blight = 7;
    state.round.blightByLand["6"] = 3;
    state.round.blightByLand["2"] = 4;
    assertEqual(engine.mostBlightedLand(state), "2", "the most blighted wins");

    state.round.blightByLand["6"] = 4;
    assertEqual(engine.mostBlightedLand(state), "2", "and a tie goes to the lowest id");

    state.round.blightByLand["2"] = 0;
    state.round.blightByLand["6"] = 0;
    assertEqual(engine.mostBlightedLand(state), null, "a clean board names no land");
  });

  test("cards: card Fear is its own source - Presence multiplies it, the Fear ladders do not", () => {
    const { state } = newGame();
    handCards(state, ["accelerated_rot"]);
    clearBoard(state);
    grantUpgrade(state, "rising_dread", 10);
    grantUpgrade(state, "mounting_terror", 10);
    state.meta.presence = 100;
    state.round.fearEarned = 0;
    state.round.fearEarnedBase = 0;

    // An empty land so nothing but the flat clause pays: no kills, so no kill Fear to muddy it.
    state.round.blightByLand["7"] = 1;
    state.round.blight = 1;
    engine.triggerAbility(state, "accelerated_rot");
    engine.resolveAbilityTarget(state, "7");

    // 10 Fear at +100% Presence and nothing else: 20, not 10 * 2 * 2 * 2.
    assertEqual(Math.round(state.round.fearEarned), 20, "Presence doubles it and the ladders do not touch it");
    assertEqual(state.round.fearEarnedBase, 10, "the base tally is the card's own number");
  });

  test("cards: destroy_units pays Fear and Energy, the way the sea does", () => {
    const { state } = newGame();
    handCards(state, ["song_of_sanctity"]);
    clearBoard(state);
    setLand(state, "5", { explorers: 2 }, 0);
    state.resources.energy = 0;
    state.round.fearEarned = 0;

    engine.triggerAbility(state, "song_of_sanctity");
    engine.resolveAbilityTarget(state, "5");

    assertEqual(state.resources.energy, 1, "a destroyed Explorer pays its Energy");
    assert(state.round.fearEarned > 0, "and its Fear");
  });

  /* ------------------------------------------------------------------ *
   * State and saves                                                     *
   * ------------------------------------------------------------------ */

  test("cards: normalization drops what the build no longer has and collapses duplicates", () => {
    const normalized = engine.normalizeState({
      powerCards: {
        owned: ["accelerated_rot", "accelerated_rot", "a_card_that_never_was"],
        draw: { offerIds: ["accelerated_rot", "nonsense"], rerollCount: -4 }
      },
      round: {
        cards: {
          handIds: ["accelerated_rot", "accelerated_rot", "tsunami"],
          drawsTaken: -2,
          nextDrawWave: 0,
          pendingRedrawId: "tsunami",
          rejectedIds: ["nonsense"]
        }
      }
    });

    assertDeepEqual(normalized.powerCards.owned, ["accelerated_rot"], "unknown out, duplicate collapsed");
    assertEqual(normalized.powerCards.draw.rerollCount, 0, "a negative tally floors at zero");
    assert(
      !normalized.powerCards.draw.offerIds.includes("accelerated_rot"),
      "an offer naming a card since bought drops it"
    );
    assertEqual(normalized.powerCards.draw.offerIds.length, 3, "and is topped back up");

    assertDeepEqual(normalized.round.cards.handIds, ["accelerated_rot"], "tsunami is not owned, so not held");
    assertEqual(normalized.round.cards.drawsTaken, 0);
    assertEqual(normalized.round.cards.nextDrawWave, 1, "clamped to at least 1");
    assertEqual(normalized.round.cards.pendingRedrawId, null, "and a pending id nothing holds is dropped");
    assertDeepEqual(normalized.round.cards.rejectedIds, []);
  });

  test("cards: a save from before any of this loads as a game that owns nothing", () => {
    const normalized = engine.normalizeState({ meta: { fear: 40 } });

    assertDeepEqual(normalized.powerCards.owned, [], "nothing owned");
    assertDeepEqual(normalized.round.cards.handIds, [], "nothing in hand");
    assertEqual(normalized.round.cards.nextDrawWave, 25, "and the drip starts where it always does");
    assertEqual(normalized.powerCards.draw.offerIds.length, 3, "with an offer rolled on the spot");
    assertEqual(normalized.ui.cardOptions.tsunami, true, "the switch defaults on");
  });

  test("cards: a hand and its wards survive a save/load round trip", () => {
    const { state } = newGame();
    handCards(state, ["natures_resilience"]);
    state.abilities.natures_resilience.cooldownRemaining = 5;
    engine.addDefense(state, "4", 6);

    const storage = memoryStorage();
    engine.saveState(state, storage);
    const loaded = engine.loadState(storage);

    assertDeepEqual(engine.cardsInHand(loaded), ["natures_resilience"], "still in hand");
    assertEqual(loaded.abilities.natures_resilience.cooldownRemaining, 5, "mid-cooldown and still so");
    assertEqual(engine.defenseInLand(loaded, "4"), 6, "and the ward is still standing");
  });

  test("cards: ui.cardOptions is a preference, and only known keys survive", () => {
    const { state } = newGame();
    assertEqual(engine.powerCardOptionOn(state, "tsunami"), true, "on by default");

    engine.setPowerCardOption(state, "tsunami", false);
    assertEqual(engine.powerCardOptionOn(state, "tsunami"), false);
    assert(!engine.setPowerCardOption(state, "pull_beneath", false), "a card with no switch has none to set");

    const normalized = engine.normalizeState({ ui: { cardOptions: { tsunami: false, invented: true } } });
    assertEqual(normalized.ui.cardOptions.tsunami, false, "the setting is kept");
    assertEqual(normalized.ui.cardOptions.invented, undefined, "and a key the registry has no card for is not");
  });

  test("cards: the drip runs through a real round, on the real clock", () => {
    const ctx = newGame();
    ownCards(ctx.state, ["encompassing_ward"]);
    // The board is cleared and the threshold lifted so the round survives to wave 25 - this is
    // about the schedule, not about how long an unattended island lasts.
    ctx.state.round.blightThreshold = 100000;

    for (let wave = 0; wave < 25; wave += 1) {
      clearBoard(ctx.state);
      advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    }

    assertEqual(ctx.state.round.wavesResolved, 25, "twenty-five waves resolved");
    assertDeepEqual(engine.cardsInHand(ctx.state), ["encompassing_ward"], "and the card arrived on its wave");
    assert(engine.abilityIsReady(ctx.state, "encompassing_ward"), "ready to cast");
  });
})();
