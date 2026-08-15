/* A real save file, written by the build at ccbb135 - before the auto-cast toggle, the
 * round-controls move and the Dahan strike bar existed.
 *
 * Captured, not generated. That is the whole point of it: nothing in the current engine had
 * a hand in producing this object, so it can still disagree with what the engine expects.
 * Rebuilding it from createFreshGameState would quietly make it agree with whatever today's
 * code does, which is the one thing a compatibility fixture must never do.
 *
 * See docs/spec/03-state-contract.md#older-save-files-keep-working. Do not edit it to make a
 * test pass - a test that fails against this file is telling you a released save just broke.
 */

const SAVE_5_0_0_PRE_AUTOCAST = {
  "schemaVersion": "5.0.0",
  "time": {
    "totalSeconds": 0,
    "lastTickUnixMs": 1700000000000,
    "lastSaveUnixMs": 1700000000000
  },
  "meta": {
    "fear": 4820,
    "bestWaveReached": 11
  },
  "spirit": {
    "activeSpiritId": "core_spirit_01",
    "unlockedSpiritIds": [
      "core_spirit_01"
    ]
  },
  "upgrades": {
    "purchased": {
      "auto_boon": 1,
      "auto_wash_away": 1,
      "auto_innate": 1,
      "auto_start_round": 1,
      "dahan_remember": 2
    }
  },
  "ui": {
    "language": "en",
    "gameSpeed": 1,
    "autoProceed": true,
    "autoStartRound": true,
    "playtest": false,
    "defeatFx": null,
    "blightFx": null,
    "fearFx": null,
    "selectedLand": null
  },
  "round": {
    "number": 1,
    "status": "running",
    "elapsedSeconds": 0,
    "blight": 0,
    "blightByLand": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0 },
    "blightProgress": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0 },
    "dahanProgress": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0 },
    "blightThreshold": 10,
    "waveTimerRemaining": 20,
    "dahanAttackRemaining": 19.996000799840033,
    "awaitingWave": false,
    "wavesResolved": 0,
    "fearEarned": 0,
    "fearEarnedBase": 0,
    "abilityCooldownMult": 1,
    "upgradeTiers": {
      "dahan_reinforcement": 0,
      "blight_resilience": 0,
      "headwaters": 0,
      "rising_dread": 0,
      "mounting_terror": 0,
      "high_water_mark": 0,
      "dahan_remember": 2,
      "auto_boon": 1,
      "auto_innate": 1,
      "auto_bounty": 0,
      "auto_flash_floods": 0,
      "auto_wash_away": 1,
      "auto_buy_abilities": 0,
      "auto_start_round": 1
    },
    "purchasedAbilityIds": [],
    "abilityTiers": {}
  },
  "invader": {
    "build": ["desert"],
    "explore": ["wetlands"]
  },
  "invaders": {
    "1": { "explorers": 0, "towns": 0, "cities": 0 },
    "2": { "explorers": 1, "towns": 0, "cities": 0 },
    "3": { "explorers": 0, "towns": 0, "cities": 0 },
    "4": { "explorers": 0, "towns": 0, "cities": 0 },
    "5": { "explorers": 0, "towns": 0, "cities": 0 },
    "6": { "explorers": 0, "towns": 0, "cities": 0 },
    "7": { "explorers": 0, "towns": 0, "cities": 0 },
    "8": { "explorers": 0, "towns": 0, "cities": 0 }
  },
  "invaderDamage": {
    "1": { "explorers": [], "towns": [], "cities": [] },
    "2": { "explorers": [0], "towns": [], "cities": [] },
    "3": { "explorers": [], "towns": [], "cities": [] },
    "4": { "explorers": [], "towns": [], "cities": [] },
    "5": { "explorers": [], "towns": [], "cities": [] },
    "6": { "explorers": [], "towns": [], "cities": [] },
    "7": { "explorers": [], "towns": [], "cities": [] },
    "8": { "explorers": [], "towns": [], "cities": [] }
  },
  "dahan": { "1": 1, "2": 1, "3": 0, "4": 1, "5": 1, "6": 1, "7": 1, "8": 0 },
  "abilities": {
    "innate_power": { "cooldownRemaining": 0 },
    "boon_of_vigor": { "cooldownRemaining": 0 }
  },
  "pendingAbilityTarget": null,
  "resources": { "energy": 0 },
  "essence": { "mountains": 0, "desert": 0, "jungle": 0, "wetlands": 0 },
  "_log": [
    "23:13:20 - Invader track - Build: Desert, Discover: Wetlands.",
    "23:13:20 - Discover in Land 2 - Desert: +1 explorers.",
    "23:13:20 - Discover in Land 8 - Desert: no way in, not coastal and no town or city adjacent.",
    "23:13:20 - The invaders come ashore.",
    "23:13:20 - The Dahan gather: Land 1 1, Land 2 1, Land 4 1, Land 5 1, Land 6 1, Land 7 1.",
    "23:13:20 - Round 1 begins. Blight threshold 10."
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SAVE_5_0_0_PRE_AUTOCAST;
} else if (typeof window !== "undefined") {
  window.SpiritSaveFixtures = window.SpiritSaveFixtures || {};
  window.SpiritSaveFixtures.pre500AutoCast = SAVE_5_0_0_PRE_AUTOCAST;
}
