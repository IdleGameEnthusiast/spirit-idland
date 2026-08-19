/* Dev fixture: paints a mid-round board so the layout can be judged without playing to it.
 *
 * Loaded only by `index.html?vis`, after the engine modules and ui.js, by the loader at the
 * that page. It writes straight into the live state and re-renders once; nothing here is
 * part of the game, and nothing here runs unless the query string asks for it.
 *
 * The page it paints over is the real page, not a copy of it - which is the point. The
 * fixture used to live in its own vis.html carrying its own duplicate of the markup, and
 * that duplicate went stale the first time the layout moved.
 *
 * ui.js has already switched off the clock and every save for this mode, so the board below
 * is the board on screen and cannot reach localStorage. */

(function () {
  state.round.number = 4;
  state.round.blight = 7;
  state.round.blightThreshold = 11;
  state.round.blightByLand = { "1": 2, "2": 1, "3": 0, "4": 0, "5": 3, "6": 1, "7": 0, "8": 0 };
  // Part-filled bars, so the land meters can be judged at something other than empty.
  state.round.blightProgress = { "1": 0.4, "2": 0.72, "3": 0.1, "4": 0, "5": 0.25, "6": 0.88, "7": 0, "8": 0.55 };
  state.round.dahanProgress = { "1": 0.62, "2": 0, "3": 0.3, "4": 0, "5": 0.81, "6": 0, "7": 0, "8": 0 };
  // Written against the intervals rather than as seconds, so the fixture keeps showing a wave
  // most of the way in and a strike halfway however TIME_SCALE is set.
  state.round.waveTimerRemaining = WAVE_INTERVAL_SECONDS * 0.3;
  // The fixture paints a round in motion, so it opens the wave gate a fresh game closes: a
  // board frozen behind "waiting" is a different screen from the one being judged here.
  state.round.awaitingWave = false;
  state.round.dahanAttackRemaining = DAHAN_ATTACK_INTERVAL_SECONDS * 0.6;
  // Deep enough that the escalation ladder shows all three of its readings at once - rungs in
  // force, the one coming next, and the climb still ahead. At wave 9 the whole list was dim,
  // which is the one state that tells a layout nothing.
  state.round.wavesResolved = 45;
  state.round.fearEarned = 4.2;
  state.meta.fear = 12.6;
  state.meta.bestWaveReached = 62;
  // Past a Reclaim, so both high scores are on the strip and they disagree - which is the only
  // arrangement that says anything about how the pair reads. Before the first ascension the
  // cycle figure is not drawn at all.
  state.meta.cycleBestWave = 45;
  state.meta.ascensionCount = 1;
  // Enough to buy one Presence row and not the other, so the catalogue renders both an
  // affordable row and a dimmed one - the comparison that panel exists to make.
  state.meta.presence = 2;
  // The cycle ledger behind that bank, so the playtest tally has something other than zeroes
  // to be judged at once the code is redeemed in this mode. It balances against `meta.fear`
  // the way a real one does: generated + granted - spent.
  //
  // Generated is set just past 2500, which is where the payout reads 5 and the ascension panel
  // unlocks. The panel is the point: at anything less it draws its locked state, and the state
  // worth putting in front of a design eye is the live one - a real payout, a real gap to the
  // next Presence, and a Reclaim button held back only by the round still running.
  state.meta.cycleFearGenerated = 2512;
  state.meta.cycleFearGranted = 100;
  state.meta.cycleFearSpent = 2600;

  state.invaders = createInvaderCounts();
  state.invaders["1"] = { explorers: 2, towns: 1, cities: 0 };
  state.invaders["2"] = { explorers: 0, towns: 1, cities: 1 };
  state.invaders["3"] = { explorers: 1, towns: 1, cities: 0 };
  state.invaders["5"] = { explorers: 1, towns: 0, cities: 0 };
  state.invaders["6"] = { explorers: 3, towns: 2, cities: 1 };   // worst case: all three types
  state.invaders["8"] = { explorers: 1, towns: 0, cities: 0 };

  // Per-unit health, so the chip rings and the detail panel both have something to draw:
  // land 6 holds a city one hit from falling and a town at half, land 1 a wounded town. The
  // arrays run one entry per living unit, worst first.
  state.invaderDamage = createInvaderDamage();
  state.invaderDamage["6"].cities = [2];
  state.invaderDamage["6"].towns = [1, 0];
  state.invaderDamage["1"].towns = [1];

  state.dahan = createDahanCounts();
  state.dahan["1"] = 1; state.dahan["3"] = 2; state.dahan["4"] = 1; state.dahan["5"] = 1; state.dahan["7"] = 2;

  // Two wards, because the shield badge has two readings and only one of them was ever drawn
  // before: land 3 is partly covered and land 8 is covered outright, which is the pair the
  // pressure line and the badge have to stay consistent about. Land 6, the worst chip on the
  // board, is left bare so the head row can be judged with and without the badge.
  state.round.defense = { "1": 0, "2": 0, "3": 2, "4": 0, "5": 0, "6": 0, "7": 0, "8": 5 };

  state.invader.build = "desert";
  state.invader.explore = "mountains";

  // A mid-round bar with all three card kinds on it: the Innate sitting at tier 2 with a
  // price on its third, one ability bought on top of the starting kit, and two still locked.
  // Energy sits between the two locked prices, so one card renders affordable and one dimmed -
  // the comparison the bar exists to make.
  state.round.purchasedAbilityIds = ["rivers_bounty"];
  state.round.abilityTiers = { innate_power: 1 };
  state.resources.energy = 12;
  state.abilities = createAbilityState(state);
  state.abilities.rivers_bounty.cooldownRemaining = 7;

  // One card owned and none of it drawn yet, so the drip has somewhere to arrive and the
  // Abilities headline has a wave number to name. Without this the next-card line never paints
  // in fixture mode, which is the one place its size against the headline can be judged.
  state.powerCards = createPowerCardsState();
  state.powerCards.owned = [POWER_CARD_IDS[0]];
  state.round.cards = createRoundCardsState();
  state.round.cards.nextDrawWave = state.round.wavesResolved + 3;

  state.ui.selectedLand = "6";

  // index.html?vis&ended shows the between-round shop over the same frozen board, which is
  // the other half of the layout and otherwise needs a lost round to reach.
  if (location.search.indexOf("ended") >= 0) {
    state.round.blight = state.round.blightThreshold;
    endRound(state);
  }

  updateUI(state);
})();
