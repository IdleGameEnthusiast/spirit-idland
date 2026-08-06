/* Dev fixture: paints a mid-round board so the layout can be judged without playing to it.
 *
 * Loaded only by vis.html, after engine.js and ui.js. It writes straight into the live
 * state and re-renders; nothing here is part of the game. */

(function () {
  state.round.number = 4;
  state.round.blight = 7;
  state.round.blightThreshold = 11;
  state.round.blightByLand = { "1": 2, "2": 1, "3": 0, "4": 0, "5": 3, "6": 1, "7": 0, "8": 0 };
  state.round.waveTimerRemaining = 3;
  state.round.wavesResolved = 9;
  state.round.fearEarned = 4.2;
  state.meta.fear = 12.6;
  state.meta.bestRoundReached = 3;
  state.meta.totalRoundsPlayed = 3;

  state.invaders = createInvaderCounts();
  state.invaders["1"] = { explorers: 2, towns: 1, cities: 0 };
  state.invaders["2"] = { explorers: 0, towns: 1, cities: 1 };
  state.invaders["3"] = { explorers: 1, towns: 1, cities: 0 };
  state.invaders["5"] = { explorers: 1, towns: 0, cities: 0 };
  state.invaders["6"] = { explorers: 3, towns: 2, cities: 1 };   // worst case: all three types
  state.invaders["8"] = { explorers: 1, towns: 0, cities: 0 };

  state.invaderDamage = createInvaderDamage();
  state.invaderDamage["6"].cities = 2;                           // a city one hit from falling

  state.dahan = createDahanCounts();
  state.dahan["1"] = 1; state.dahan["3"] = 2; state.dahan["4"] = 1; state.dahan["5"] = 1; state.dahan["7"] = 2;

  state.invader.ravage = "jungle";
  state.invader.build = "desert";
  state.invader.explore = "mountains";

  state.abilities.flash_floods.cooldownRemaining = 7;
  state.abilities.wash_away.cooldownRemaining = 2;

  state.ui.selectedLand = "6";

  // vis.html?ended shows the between-round shop over the same frozen board, which is the
  // other half of the layout and otherwise needs a lost round to reach.
  if (location.search.indexOf("ended") >= 0) {
    state.round.blight = state.round.blightThreshold;
    endRound(state);
  }

  updateUI(state);
})();
