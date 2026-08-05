(function () {
  state.presence = createPresenceCounts();
  state.presence["1"] = 2; state.presence["4"] = 1; state.presence["7"] = 3;
  state.invaders = createInvaderCounts();
  state.invaders["1"] = { explorers: 2, towns: 1, cities: 0 };
  state.invaders["2"] = { explorers: 0, towns: 1, cities: 1 };
  state.invaders["3"] = { explorers: 1, towns: 1, cities: 0 };
  state.invaders["5"] = { explorers: 1, towns: 0, cities: 0 };
  state.invaders["6"] = { explorers: 3, towns: 2, cities: 1 };   // worst case: all three types
  state.invaders["8"] = { explorers: 1, towns: 0, cities: 0 };
  state.invaderDamage = createInvaderDamage();
  state.dahan = createDahanCounts();
  state.dahan["1"] = 1; state.dahan["3"] = 2; state.dahan["4"] = 1; state.dahan["5"] = 1; state.dahan["7"] = 2;
  state.essence = { wetlands: 4, desert: 0, jungle: 1, mountains: 1 };
  state.turn.number = 6;
  state.turn.selectedGrowthOption = "power_and_presence";
  state.invader.ravage = "jungle"; state.invader.build = "desert"; state.invader.explore = "mountains";
  state.turn.invaderStep = "ravage";
  state.ui.selectedLand = "6";
  updateUI(state);
})();
