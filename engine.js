/* ==================================================================== *
 * Spirit Idland - round engine                                          *
 *                                                                       *
 * Every rule the game has, and nothing that touches the DOM. The browser *
 * loads this before ui.js; the test harness loads the same file through  *
 * the export shim at the bottom.                                        *
 *                                                                       *
 * Spec: docs/spec/. Section numbers in comments point at the doc that    *
 * owns the rule, so a number here can always be traced to a decision.    *
 * ==================================================================== */

const SAVE_KEY = "spirit-idland-save-v1";
const VERSION = "4.0.0";

/* ------------------------------------------------------------------ *
 * Constants (04-economy-formulas.md)                                   *
 * ------------------------------------------------------------------ */

const WAVE_INTERVAL_SECONDS = 10;
const BLIGHT_THRESHOLD_BASE = 10;
const DAHAN_PER_ROUND_START_BASE = 6;
// Reinforcement is no longer capped per land - the shop can be pushed far past the sixteen
// a +2 cap allowed, and the extra tiers have to land somewhere. What is capped instead is
// the gap: no land may stand more than two Dahan above another, so nothing reaches 3 while
// a land is still empty.
const DAHAN_MAX_SPREAD = 2;
const DEFEAT_FX_MS = 1200;
const MAX_TICK_SECONDS = 5;

// The whole fight runs on one currency: a damage-second. One point of damage sustained for
// one second is 2% of a Blight, and 5% of a Dahan casualty - 50 damage-seconds buys a Blight,
// 20 buys a casualty. The two rates were equal until the Dahan proved too durable to pressure;
// they are now deliberately apart, and the casualty clock is the one under playtest.
const BLIGHT_PER_DAMAGE_SECOND = 0.02;
const DAHAN_LOSS_PER_DAMAGE_SECOND = 0.05;

// Two brakes on stacking Dahan into one land. Without them a stack's value grew with the
// square of its size (each Dahan slows attrition for every Dahan behind it) on top of a hard
// cliff to zero Blight, so one fortified land beat six defended ones by a wide margin.
//
// The floor: a land never cancels all of its Blight, only the share above this fraction of
// gross. Defence buys time, not immunity, so a stack has to be spent rather than parked.
const BLIGHT_FLOOR_FRACTION = 0.25;
// The concentration cap: casualties still concentrate on the survivors - the death spiral
// downward is the point - but only down to this many. Past it, attrition stops slowing, so
// a stack's lifetime grows linearly with its size instead of quadratically.
const DAHAN_CONCENTRATION_CAP = 2;

// The Dahan's periodic strike against the invaders, on its own clock rather than the wave's.
// It starts at the wave interval only so the two read as one rhythm at round one; the shop
// is expected to shorten this later, and nothing should re-couple it to WAVE_INTERVAL_SECONDS.
const DAHAN_ATTACK_INTERVAL_SECONDS = 10;
const DAHAN_ATTACK_DAMAGE = 1;

// Fear per point of defeated invader power. An explorer is worth 1 power, a town 2,
// a city 3 - the same numbers as their damage, so a unit's threat and its worth agree.
const FEAR_PER_POWER = 0.35;

// `damage` is now a rate: what the unit deals every second it stands in a land. A Dahan's 2
// is what it cancels out of the invader total, which is why one Dahan holds off two
// explorers exactly. `health` still only matters to invaders, who are killed in whole
// points; Dahan die to the casualty bar instead - see resolveContinuousCombat.
const UNIT_STATS = {
  explorers: { health: 1, damage: 1 },
  towns: { health: 2, damage: 2 },
  cities: { health: 3, damage: 3 },
  dahan: { health: 2, damage: 2 }
};

const INVADER_TYPES = ["explorers", "towns", "cities"];

// The Dahan strike and untargeted ability damage both spend on the biggest thing standing.
const INVADER_TYPES_BY_TIER = ["cities", "towns", "explorers"];

/* ------------------------------------------------------------------ *
 * Injectable clock and RNG                                             *
 *                                                                      *
 * Both exist so tests can run a whole round in a millisecond and get    *
 * the same board every time. Production passes nothing and gets         *
 * Date.now and Math.random.                                             *
 * ------------------------------------------------------------------ */

let nowSource = () => Date.now();
let rngSource = () => Math.random();

function nowMs() {
  return nowSource();
}

function rng() {
  return rngSource();
}

function setNowSource(fn) {
  nowSource = typeof fn === "function" ? fn : () => Date.now();
}

function setRng(fn) {
  rngSource = typeof fn === "function" ? fn : () => Math.random();
}

/* ------------------------------------------------------------------ *
 * Content registry (07-content-registry.md)                            *
 * ------------------------------------------------------------------ */

const SPIRITS = {
  core_spirit_01: {
    id: "core_spirit_01",
    name: "Reissende Fluten im Sonnenlicht",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
    traitsEn: "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
    abilityIds: ["boon_of_vigor", "wash_away", "flash_floods", "rivers_bounty"],
    // The baseline Dahan placement every round starts from, before upgrades. Six across
    // eight lands, skipping 3 and 8 - the two lands hardest to reinforce later.
    roundStartDahan: { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }
  }
};

// Cooldowns and effects are the placeholder kit from 04-economy-formulas.md. None of these
// numbers are balanced; they exist so the cooldown machinery has something to drive.
const ABILITIES = {
  boon_of_vigor: {
    id: "boon_of_vigor",
    cooldownSeconds: 20,
    needsTarget: false,
    effect: "reduce_cooldowns",
    amount: 5
  },
  wash_away: {
    id: "wash_away",
    cooldownSeconds: 15,
    needsTarget: false,
    effect: "push_from_blighted"
  },
  flash_floods: {
    id: "flash_floods",
    cooldownSeconds: 12,
    needsTarget: true,
    effect: "damage_one_type",
    amount: 2
  },
  rivers_bounty: {
    id: "rivers_bounty",
    cooldownSeconds: 18,
    needsTarget: true,
    effect: "add_dahan",
    amount: 2
  }
};

const ABILITY_IDS = Object.keys(ABILITIES);

// Costs scale with the tier already owned, so the shop stays a choice rather than a
// checklist. 1.6x per tier is a placeholder curve, not a balancing decision.
const UPGRADE_COST_GROWTH = 1.6;

const UPGRADES = {
  dahan_reinforcement: {
    id: "dahan_reinforcement",
    repeatable: true,
    effect: "dahan_bonus_per_tier",
    baseCost: 4
  },
  blight_resilience: {
    id: "blight_resilience",
    repeatable: true,
    effect: "blight_threshold_per_tier",
    baseCost: 6
  },
  swift_currents: {
    id: "swift_currents",
    repeatable: true,
    effect: "cooldown_reduction_per_tier",
    baseCost: 5,
    // Diminishing by construction: each tier multiplies, so tier 12 is about -46%, not -60%.
    maxTier: 12
  }
};

const UPGRADE_IDS = Object.keys(UPGRADES);

/* ------------------------------------------------------------------ *
 * The island (09-island-board.md)                                      *
 * ------------------------------------------------------------------ */

const INVADER_TERRAINS = ["mountains", "desert", "jungle", "wetlands"];

// Built to the published structure of a standard Spirit Island board: eight lands, exactly
// two of each terrain, and three coastal lands rather than four. Coastal means touching the
// board's ocean edge; the other borders are cliffs and do not count.
//
// Three coasts over four terrains means one terrain has no coast at all. That is mountains
// here, which is why Discover cannot seed explorers into lands 4 and 6 until the invaders
// have already worked inland.
//
// Adjacency is symmetric and deliberately uneven: land 5 is a six-neighbour hub, land 3 is
// a two-neighbour corner. Never assume a land has four neighbours.
// `rect` is the land's footprint in board space: u runs left to right, v runs from the back
// of the board (0) to the ocean edge (1). Every adjacency below falls out of these
// rectangles overlapping, so the drawing and the rules cannot drift apart.
const BOARD_LANDS = {
  "1": { terrain: "wetlands", coastal: true, adjacent: ["2", "4", "5"], rect: [0.00, 0.43, 0.65, 1.00] },
  "2": { terrain: "desert", coastal: true, adjacent: ["1", "3", "5", "6"], rect: [0.43, 0.72, 0.65, 1.00] },
  "3": { terrain: "jungle", coastal: true, adjacent: ["2", "6"], rect: [0.72, 1.00, 0.65, 1.00] },
  "4": { terrain: "mountains", coastal: false, adjacent: ["1", "5", "7"], rect: [0.00, 0.34, 0.30, 0.65] },
  "5": { terrain: "jungle", coastal: false, adjacent: ["1", "2", "4", "6", "7", "8"], rect: [0.34, 0.62, 0.30, 0.65] },
  "6": { terrain: "mountains", coastal: false, adjacent: ["2", "3", "5", "8"], rect: [0.62, 1.00, 0.30, 0.65] },
  "7": { terrain: "wetlands", coastal: false, adjacent: ["4", "5", "8"], rect: [0.00, 0.50, 0.00, 0.30] },
  "8": { terrain: "desert", coastal: false, adjacent: ["5", "6", "7"], rect: [0.50, 1.00, 0.00, 0.30] }
};

// Terrain hues, mirrored in app.css. One value per terrain so a land, its chip, and its
// detail panel can never disagree about what colour it is.
const TERRAIN_RGB = {
  mountains: "171, 184, 196",
  desert: "242, 196, 90",
  jungle: "124, 198, 116",
  wetlands: "118, 179, 222"
};

// Land IDs are strings, never numbers: JSON object keys are strings, so a numeric id would
// silently stop matching itself after a save/load round-trip.
const LAND_IDS = Object.keys(BOARD_LANDS);

/* ------------------------------------------------------------------ *
 * Board lookups                                                        *
 * ------------------------------------------------------------------ */

function isLandId(landId) {
  return typeof landId === "string" && Object.prototype.hasOwnProperty.call(BOARD_LANDS, landId);
}

function landTerrain(landId) {
  return isLandId(landId) ? BOARD_LANDS[landId].terrain : null;
}

function landIsCoastal(landId) {
  return isLandId(landId) && BOARD_LANDS[landId].coastal === true;
}

function adjacentLands(landId) {
  return isLandId(landId) ? BOARD_LANDS[landId].adjacent : [];
}

function areAdjacent(a, b) {
  return adjacentLands(a).includes(b);
}

// The lands a terrain-keyed invader phase acts on, in id order.
function landsOfTerrain(terrain) {
  return LAND_IDS.filter((landId) => BOARD_LANDS[landId].terrain === terrain);
}

// Builds a fresh land-keyed map. `factory` returns the value for one land.
function createLandMap(factory) {
  const out = {};
  for (const landId of LAND_IDS) out[landId] = factory(landId);
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* ------------------------------------------------------------------ *
 * Localization                                                         *
 * ------------------------------------------------------------------ */

const I18N = {
  de: {
    langToggle: "English",

    hudTitle: "Runde",
    roundLabel: "Runde",
    bestRoundLabel: "Beste Runde",
    blightLabel: "Verderbnis",
    waveLabel: "Naechste Welle",
    fearLabel: "Furcht",
    waveCountLabel: "Wellen",
    secondsShort: "{seconds}s",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Aktiver Geist:",

    abilitiesTitle: "Faehigkeiten",
    abilitiesHint: "Faehigkeiten haben nur eine Abklingzeit, keine Energiekosten.",
    abilityReady: "Bereit",
    abilityArmed: "Ziel waehlen",
    abilityCooldown: "{seconds}s",
    abilityNames: {
      boon_of_vigor: "Boon of Vigor",
      wash_away: "Wash Away",
      flash_floods: "Flash Floods",
      rivers_bounty: "River's Bounty"
    },
    abilityTexts: {
      boon_of_vigor: "Verkuerzt die Abklingzeit aller anderen Faehigkeiten um {amount}s.",
      wash_away: "Schiebt alle Entdecker und Doerfer aus dem am staerksten verderbten Gebiet in ein angrenzendes Gebiet.",
      flash_floods: "{amount} Schaden auf den staerksten Invasorentyp im gewaehlten Gebiet.",
      rivers_bounty: "+{amount} Dahan im gewaehlten Gebiet."
    },

    mapTitle: "Die Insel",
    mapPlanHint: "Acht Gebiete, drei an der Kueste. Waehle ein Gebiet fuer Details.",
    mapHintArmed: "{ability}: {requirement}",
    mapHintWave: "Naechste Welle baut in {terrain} ({lands}).",
    abilityNeedInvaders: "waehle ein Gebiet mit Invasoren.",
    abilityNeedAnyLand: "waehle ein beliebiges Gebiet.",

    shopTitle: "Zwischen den Runden",
    shopLostRound: "Runde {round} verloren. {fear} Furcht in dieser Runde erbeutet.",
    shopFearLabel: "Verfuegbare Furcht",
    shopTierLabel: "Stufe {tier}",
    shopCostLabel: "{cost} Furcht",
    shopBuyBtn: "Kaufen",
    shopMaxedBtn: "Maximum",
    startNextRoundBtn: "Naechste Runde starten",
    upgradeNames: {
      dahan_reinforcement: "Verstaerkung der Dahan",
      blight_resilience: "Widerstand gegen Verderbnis",
      swift_currents: "Schnelle Stroemungen"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 Dahan zu Rundenbeginn, pro Stufe.",
      blight_resilience: "+1 Verderbnisgrenze, pro Stufe.",
      swift_currents: "-5% Abklingzeit aller Faehigkeiten, pro Stufe."
    },

    logTitle: "Spielprotokoll",
    manualSaveBtn: "Jetzt speichern",
    wipeSaveBtn: "Spielstand loeschen",
    autosaveHint: "Autosave alle 10s.",

    explorersLabel: "Entdecker",
    townsLabel: "Doerfer",
    citiesLabel: "Staedte",
    // Build and defeat lines name one unit at a time, and "+1 Staedte" reads as a typo.
    explorersOne: "Entdecker",
    townsOne: "Dorf",
    citiesOne: "Stadt",
    dahanLabel: "Dahan",
    invadersLabel: "Invasoren",
    ownForcesLabel: "Eigene Kraefte",
    noInvadersHere: "Keine Invasoren.",
    neighboursLabel: "Angrenzend",
    coastalLabel: "Kueste",
    inlandLabel: "Binnenland",
    invaderHpHint: "HP {current}/{max}",
    landBlightLabel: "Verderbnis hier",
    defeatHint: "Besiegt: -{count} {unit}",
    blightHint: "+{amount} Verderbnis",

    etaNever: "nie",
    pressureNoInvaders: "keine Invasoren",
    pressureHeld: "gehalten - {line}",
    pressureChip: "+{rate}% / s - naechste in {eta}",
    pressureDetail: "{gross} Schaden - {defence} Dahan = {net}/s. +{rate}% Verderbnis pro Sekunde, naechste in {eta}.",
    pressureDetailHeld: "{gross} Schaden gegen {defence} Dahan-Abwehr: aufgehalten, aber {net}/s sickern durch. +{rate}% Verderbnis pro Sekunde, naechste in {eta}.",
    buildChip: "+1 {unit}",
    buildChipNone: "nichts hier",
    blightBarLabel: "Verderbnis",
    dahanBarLabel: "Dahan-Verluste",

    invaderTrackTitle: "Invasorenleiste",
    buildLabel: "Bauen:",
    discoverLabel: "Entdecken:",
    dahanAttackLabel: "Dahan-Angriff",
    buildWord: "Bauen",
    discoverWord: "Entdecken",
    invaderNone: "-",
    landDisplay: "Gebiet {id} - {terrain}",
    landShort: "Gebiet {id}",
    invaderLandNames: {
      mountains: "Berge",
      desert: "Wueste",
      jungle: "Dschungel",
      wetlands: "Suempfe"
    },

    roundStarted: "Runde {round} beginnt. Verderbnisgrenze {threshold}.",
    roundEnded: "Runde {round} verloren: Verderbnis {blight}/{threshold}. {fear} Furcht erbeutet.",
    waveResolved: "Welle {wave} aufgeloest.",
    waveIncoming: "Invasorenleiste - Bauen: {build}, Entdecken: {discover}.",
    dahanAttackResolved: "Dahan greifen in {land} an: {damage} Schaden, {defeated} Invasoren besiegt.",
    dahanAttackNoTargets: "Dahan-Angriff: kein Gebiet mit Invasoren und Dahan.",
    dahanFell: "{count} Dahan fallen in {land}. Noch {left} uebrig.",
    blightGained: "Verderbnis in {land}: +{amount}. Gesamt {total}/{threshold}.",
    buildNothing: "Bauen: noch kein Gebiet auf der Leiste.",
    buildNoInvaders: "Bauen in {land}: keine Invasoren, nichts wird gebaut.",
    buildResolved: "Bauen in {land}: +1 {unit}.",
    exploreNothing: "Entdecken: kein Gebiet gezogen.",
    exploreResolved: "Entdecken in {land}: +1 Entdecker.",
    exploreBlocked: "Entdecken in {land}: kein Zugang, keine Kueste und kein Dorf/keine Stadt daneben.",
    exploreNoneReachable: "Entdecken in {terrain}: kein Gebiet erreichbar.",
    setupExplore: "Die Invasoren gehen an Land.",
    dahanRoundLog: "Dahan versammeln sich: {summary}.",

    abilityOnCooldown: "{ability} klingt noch {seconds}s ab.",
    abilityArmedLog: "{ability}: waehle ein Ziel.",
    abilityCancelled: "{ability} abgebrochen.",
    abilityNoTarget: "{ability} findet kein gueltiges Ziel. Abklingzeit laeuft nicht.",
    abilityIllegalTarget: "{land} ist kein gueltiges Ziel fuer {ability}.",
    boonResolved: "Boon of Vigor: {count} Faehigkeiten um {amount}s beschleunigt.",
    washAwayResolved: "Wash Away: {total} Einheiten von {from} nach {to} geschoben.",
    flashFloodsResolved: "Flash Floods trifft {unit} in {land}: {damage} Schaden, {defeated} besiegt.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}.",

    roundStillRunning: "Die Runde laeuft noch.",
    upgradePurchased: "Gekauft: {upgrade} (Stufe {tier}) fuer {cost} Furcht.",
    upgradeTooExpensive: "{upgrade} kostet {cost} Furcht. Du hast {fear}.",
    upgradeMaxed: "{upgrade} ist bereits auf der hoechsten Stufe.",

    migrationReset: "Alter Spielstand (Version {version}) ist nicht mit dem Rundenmodus kompatibel und wurde zurueckgesetzt.",
    saveWiped: "Spielstand geloescht.",
    manualSaved: "Manuelles Speichern abgeschlossen.",
    spiritAwakens: "Der Geist erwacht."
  },

  en: {
    langToggle: "Deutsch",

    hudTitle: "Round",
    roundLabel: "Round",
    bestRoundLabel: "Best round",
    blightLabel: "Blight",
    waveLabel: "Next wave",
    fearLabel: "Fear",
    waveCountLabel: "Waves",
    secondsShort: "{seconds}s",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Active spirit:",

    abilitiesTitle: "Abilities",
    abilitiesHint: "Abilities cost only their cooldown, no energy.",
    abilityReady: "Ready",
    abilityArmed: "Pick a land",
    abilityCooldown: "{seconds}s",
    abilityNames: {
      boon_of_vigor: "Boon of Vigor",
      wash_away: "Wash Away",
      flash_floods: "Flash Floods",
      rivers_bounty: "River's Bounty"
    },
    abilityTexts: {
      boon_of_vigor: "Cuts {amount}s from every other ability's cooldown.",
      wash_away: "Pushes every explorer and town out of the most-Blighted land into an adjacent one.",
      flash_floods: "{amount} damage to the strongest invader type in the chosen land.",
      rivers_bounty: "+{amount} Dahan in the chosen land."
    },

    mapTitle: "The Island",
    mapPlanHint: "Eight lands, three of them coastal. Pick a land for details.",
    mapHintArmed: "{ability}: {requirement}",
    mapHintWave: "Next wave builds in {terrain} ({lands}).",
    abilityNeedInvaders: "pick a land holding invaders.",
    abilityNeedAnyLand: "pick any land.",

    shopTitle: "Between Rounds",
    shopLostRound: "Round {round} lost. {fear} Fear earned this round.",
    shopFearLabel: "Fear available",
    shopTierLabel: "Tier {tier}",
    shopCostLabel: "{cost} Fear",
    shopBuyBtn: "Buy",
    shopMaxedBtn: "Maxed",
    startNextRoundBtn: "Start next round",
    upgradeNames: {
      dahan_reinforcement: "Dahan Reinforcement",
      blight_resilience: "Blight Resilience",
      swift_currents: "Swift Currents"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 starting Dahan, per tier.",
      blight_resilience: "+1 Blight threshold, per tier.",
      swift_currents: "-5% to all ability cooldowns, per tier."
    },

    logTitle: "Event log",
    manualSaveBtn: "Save now",
    wipeSaveBtn: "Wipe save",
    autosaveHint: "Autosave every 10s.",

    explorersLabel: "Explorers",
    townsLabel: "Towns",
    citiesLabel: "Cities",
    explorersOne: "Explorer",
    townsOne: "Town",
    citiesOne: "City",
    dahanLabel: "Dahan",
    invadersLabel: "Invaders",
    ownForcesLabel: "Own forces",
    noInvadersHere: "No invaders.",
    neighboursLabel: "Adjacent",
    coastalLabel: "Coastal",
    inlandLabel: "Inland",
    invaderHpHint: "HP {current}/{max}",
    landBlightLabel: "Blight here",
    defeatHint: "Defeated: -{count} {unit}",
    blightHint: "+{amount} Blight",

    etaNever: "never",
    pressureNoInvaders: "no invaders",
    pressureHeld: "held - {line}",
    pressureChip: "+{rate}% / s - next in {eta}",
    pressureDetail: "{gross} damage - {defence} Dahan = {net}/s. +{rate}% Blight per second, next in {eta}.",
    pressureDetailHeld: "{gross} damage against {defence} Dahan defence: held, but {net}/s seeps through. +{rate}% Blight per second, next in {eta}.",
    buildChip: "+1 {unit}",
    buildChipNone: "nothing here",
    blightBarLabel: "Blight",
    dahanBarLabel: "Dahan losses",

    invaderTrackTitle: "Invader track",
    buildLabel: "Build:",
    discoverLabel: "Discover:",
    dahanAttackLabel: "Dahan attack",
    buildWord: "Build",
    discoverWord: "Discover",
    invaderNone: "-",
    landDisplay: "Land {id} - {terrain}",
    landShort: "Land {id}",
    invaderLandNames: {
      mountains: "Mountains",
      desert: "Desert",
      jungle: "Jungle",
      wetlands: "Wetlands"
    },

    roundStarted: "Round {round} begins. Blight threshold {threshold}.",
    roundEnded: "Round {round} lost: Blight {blight}/{threshold}. {fear} Fear earned.",
    waveResolved: "Wave {wave} resolved.",
    waveIncoming: "Invader track - Build: {build}, Discover: {discover}.",
    dahanAttackResolved: "The Dahan strike in {land}: {damage} damage, {defeated} invaders defeated.",
    dahanAttackNoTargets: "Dahan attack: no land holds both invaders and Dahan.",
    dahanFell: "{count} Dahan fall in {land}. {left} still standing.",
    blightGained: "Blight in {land}: +{amount}. Total {total}/{threshold}.",
    buildNothing: "Build: no terrain on the track yet.",
    buildNoInvaders: "Build in {land}: no invaders, nothing is built.",
    buildResolved: "Build in {land}: +1 {unit}.",
    exploreNothing: "Discover: no terrain drawn.",
    exploreResolved: "Discover in {land}: +1 explorer.",
    exploreBlocked: "Discover in {land}: no way in, not coastal and no town or city adjacent.",
    exploreNoneReachable: "Discover in {terrain}: no land reachable.",
    setupExplore: "The invaders come ashore.",
    dahanRoundLog: "The Dahan gather: {summary}.",

    abilityOnCooldown: "{ability} is still {seconds}s from ready.",
    abilityArmedLog: "{ability}: pick a target.",
    abilityCancelled: "{ability} cancelled.",
    abilityNoTarget: "{ability} finds no valid target. Cooldown unspent.",
    abilityIllegalTarget: "{land} is not a valid target for {ability}.",
    boonResolved: "Boon of Vigor: {count} abilities hurried by {amount}s.",
    washAwayResolved: "Wash Away: {total} units pushed from {from} to {to}.",
    flashFloodsResolved: "Flash Floods hits {unit} in {land}: {damage} damage, {defeated} defeated.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}.",

    roundStillRunning: "The round is still running.",
    upgradePurchased: "Purchased: {upgrade} (tier {tier}) for {cost} Fear.",
    upgradeTooExpensive: "{upgrade} costs {cost} Fear. You have {fear}.",
    upgradeMaxed: "{upgrade} is already at its highest tier.",

    migrationReset: "The old save (version {version}) is not compatible with the round-based build and was reset.",
    saveWiped: "Save wiped.",
    manualSaved: "Manual save completed.",
    spiritAwakens: "The spirit awakens."
  }
};

function currentLang(state) {
  return state && state.ui && state.ui.language === "en" ? "en" : "de";
}

function locale(state) {
  return I18N[currentLang(state)];
}

function template(text, vars) {
  let out = String(text == null ? "" : text);
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

function addLog(state, text) {
  if (!state._log) state._log = [];
  const stamp = new Date(nowMs()).toLocaleTimeString();
  state._log.unshift(`${stamp} - ${text}`);
  state._log = state._log.slice(0, 24);
}

function activeSpirit(state) {
  return SPIRITS[state.spirit.activeSpiritId] || SPIRITS.core_spirit_01;
}

/* ------------------------------------------------------------------ *
 * Naming helpers                                                       *
 * ------------------------------------------------------------------ */

function terrainName(state, terrain) {
  const t = locale(state);
  if (!terrain) return t.invaderNone;
  return t.invaderLandNames[terrain] || terrain;
}

function landName(state, landId) {
  const t = locale(state);
  if (!isLandId(landId)) return t.invaderNone;
  return template(t.landDisplay, { id: landId, terrain: terrainName(state, landTerrain(landId)) });
}

function terrainLandsSummary(state, terrain) {
  const t = locale(state);
  const lands = landsOfTerrain(terrain);
  if (lands.length === 0) return t.invaderNone;
  return lands.map((landId) => template(t.landShort, { id: landId })).join(", ");
}

function unitLabelByType(state, unitType) {
  const t = locale(state);
  if (unitType === "explorers") return t.explorersLabel;
  if (unitType === "towns") return t.townsLabel;
  if (unitType === "cities") return t.citiesLabel;
  if (unitType === "dahan") return t.dahanLabel;
  return unitType;
}

// The singular, for lines that name exactly one unit.
function unitLabelOne(state, unitType) {
  const t = locale(state);
  if (unitType === "explorers") return t.explorersOne;
  if (unitType === "towns") return t.townsOne;
  if (unitType === "cities") return t.citiesOne;
  if (unitType === "dahan") return t.dahanLabel;
  return unitType;
}

function abilityName(state, abilityId) {
  const t = locale(state);
  return (t.abilityNames && t.abilityNames[abilityId]) || abilityId;
}

function abilityText(state, abilityId) {
  const t = locale(state);
  const raw = (t.abilityTexts && t.abilityTexts[abilityId]) || "";
  return template(raw, { amount: (ABILITIES[abilityId] || {}).amount || 0 });
}

// What an armed ability is waiting for, in words. The board dims to teach the same rule;
// this is the sentence version of it.
function abilityRequirementText(state, abilityId) {
  const t = locale(state);
  const record = ABILITIES[abilityId];
  if (!record || !record.needsTarget) return "";
  return record.effect === "damage_one_type" ? t.abilityNeedInvaders : t.abilityNeedAnyLand;
}

// Everything a land's fight is doing right now, in one object. The chip, the detail panel,
// and the tests all read this, so no two of them can disagree about how bad a land is.
//
// Two rates come out of the same invader damage:
//   Blight  - net of what the Dahan standing there cancel, but never below
//             BLIGHT_FLOOR_FRACTION of gross: a held land seeps instead of sitting at 0.
//   Dahan   - gross, and concentrated on the survivors: the fewer defenders are left, the
//             faster the next one falls. That is the death spiral, and it is deliberate.
//             It stops concentrating past DAHAN_CONCENTRATION_CAP, so the spiral only runs
//             downward - a big stack no longer buys itself slower attrition.
function landPressure(state, landId) {
  const slot = state.invaders[landId] || { explorers: 0, towns: 0, cities: 0 };
  const gross = invaderDamageInLand(slot);
  const dahan = Math.max(0, state.dahan[landId] || 0);
  const defence = dahan * UNIT_STATS.dahan.damage;
  const held = gross > 0 && defence >= gross;
  const net = Math.max(gross - defence, gross * BLIGHT_FLOOR_FRACTION);

  const blightPerSecond = net * BLIGHT_PER_DAMAGE_SECOND;
  const concentration = Math.min(dahan, DAHAN_CONCENTRATION_CAP);
  const dahanPerSecond = dahan > 0 ? (gross / concentration) * DAHAN_LOSS_PER_DAMAGE_SECOND : 0;

  const blightProgress = (state.round.blightProgress || {})[landId] || 0;
  const dahanProgress = (state.round.dahanProgress || {})[landId] || 0;

  return {
    gross,
    dahan,
    defence,
    // The Dahan are cancelling everything they can. Not the same as safe any more, which is
    // why it is its own flag rather than a `net === 0` test.
    held,
    net,
    blightPerSecond,
    dahanPerSecond,
    blightProgress,
    dahanProgress,
    // Infinity, not null: "never" sorts correctly against a real countdown.
    blightEta: blightPerSecond > 0 ? (1 - blightProgress) / blightPerSecond : Infinity,
    dahanEta: dahanPerSecond > 0 ? (1 - dahanProgress) / dahanPerSecond : Infinity
  };
}

// What the next Build would put in this land, or null when it would find nothing to build on.
function buildOutcomeInLand(state, landId) {
  const slot = state.invaders[landId];
  if (!slot || invaderCountInLand(slot) <= 0) return null;
  return (slot.towns || 0) > (slot.cities || 0) ? "cities" : "towns";
}

function pctText(rate) {
  return String(Math.round(rate * 1000) / 10);
}

// One decimal, with no trailing ".0". Needed wherever a readout can be fractional - the net
// damage rate is, now that BLIGHT_FLOOR_FRACTION can be the thing setting it.
function formatAmount(value) {
  const number = Number(value) || 0;
  return Math.abs(number - Math.round(number)) < 0.001
    ? String(Math.round(number))
    : number.toFixed(1);
}

function etaText(state, seconds) {
  const t = locale(state);
  if (!Number.isFinite(seconds)) return t.etaNever;
  return template(t.secondsShort, { seconds: Math.max(0, Math.ceil(seconds)) });
}

// The one-line version, for the board chip: how fast Blight is rising here and when it lands.
function pressureChipText(state, landId) {
  const t = locale(state);
  const p = landPressure(state, landId);
  if (p.gross <= 0) return t.pressureNoInvaders;
  const line = template(t.pressureChip, { rate: pctText(p.blightPerSecond), eta: etaText(state, p.blightEta) });
  return p.held ? template(t.pressureHeld, { line }) : line;
}

// The long version, for the detail panel: both bars, with the arithmetic shown.
function pressureDetailText(state, landId) {
  const t = locale(state);
  const p = landPressure(state, landId);
  if (p.gross <= 0) return t.pressureNoInvaders;
  const parts = {
    gross: p.gross,
    defence: p.defence,
    net: formatAmount(p.net),
    rate: pctText(p.blightPerSecond),
    eta: etaText(state, p.blightEta)
  };
  return template(p.held ? t.pressureDetailHeld : t.pressureDetail, parts);
}

function buildChipText(state, landId) {
  const t = locale(state);
  const built = buildOutcomeInLand(state, landId);
  if (!built) return t.buildChipNone;
  return template(t.buildChip, { unit: unitLabelOne(state, built) });
}

function upgradeName(state, upgradeId) {
  const t = locale(state);
  return (t.upgradeNames && t.upgradeNames[upgradeId]) || upgradeId;
}

function upgradeText(state, upgradeId) {
  const t = locale(state);
  return (t.upgradeTexts && t.upgradeTexts[upgradeId]) || "";
}

/* ------------------------------------------------------------------ *
 * Board state factories and normalizers (03-state-contract.md)         *
 * ------------------------------------------------------------------ */

function drawInvaderTerrain() {
  return INVADER_TERRAINS[Math.floor(rng() * INVADER_TERRAINS.length)];
}

// The opening Discover draws only from terrains that can actually take an explorer on an
// empty board, which means terrains with a coastal land. Mountains has none, so drawing it
// at setup would seed nothing and hand the player a silent island for the whole first wave -
// exactly what the opening Discover exists to prevent.
function drawOpeningTerrain(state) {
  const shut = INVADER_TERRAINS.filter(
    (terrain) => !landsOfTerrain(terrain).some((landId) => landAcceptsExplorer(state, landId))
  );
  return drawInvaderTerrainExcluding(shut);
}

function drawInvaderTerrainExcluding(excludedTerrains) {
  const excluded = new Set((excludedTerrains || []).filter((terrain) => INVADER_TERRAINS.includes(terrain)));
  const choices = INVADER_TERRAINS.filter((terrain) => !excluded.has(terrain));
  if (choices.length === 0) return drawInvaderTerrain();
  return choices[Math.floor(rng() * choices.length)];
}

// Two slots, not three. Ravaging is no longer a phase that picks a terrain - invaders damage
// the land they stand in, continuously, everywhere at once (02-core-loop.md#the-fight).
function normalizeInvaderPhases(invader) {
  const build = INVADER_TERRAINS.includes(invader && invader.build) ? invader.build : null;
  const exploreRaw = INVADER_TERRAINS.includes(invader && invader.explore) ? invader.explore : null;

  let explore = exploreRaw;
  if (!explore || explore === build) explore = drawInvaderTerrainExcluding([build]);

  return { build, explore };
}

function createInvaderCounts() {
  return createLandMap(() => ({ explorers: 0, towns: 0, cities: 0 }));
}

function normalizeInvaderCounts(invaders) {
  const merged = invaders || {};
  return createLandMap((landId) => {
    const slot = merged[landId] || {};
    return {
      explorers: Math.max(0, Math.floor(slot.explorers || 0)),
      towns: Math.max(0, Math.floor(slot.towns || 0)),
      cities: Math.max(0, Math.floor(slot.cities || 0))
    };
  });
}

function createInvaderDamage() {
  return createInvaderCounts();
}

// Carried damage can never exceed what the living units of that type could still absorb,
// or a save edit (or a stale field) would show a unit at negative health.
function clampInvaderDamageByCounts(invaders, invaderDamage) {
  const out = normalizeInvaderCounts(invaderDamage);
  const counts = normalizeInvaderCounts(invaders);

  for (const landId of LAND_IDS) {
    for (const type of INVADER_TYPES) {
      const health = UNIT_STATS[type].health;
      if ((counts[landId][type] || 0) <= 0 || health <= 1) {
        out[landId][type] = 0;
      } else {
        out[landId][type] = clamp(out[landId][type], 0, health - 1);
      }
    }
  }

  return out;
}

function createDahanCounts() {
  return createLandMap(() => 0);
}

function normalizeDahanCounts(dahan) {
  const merged = dahan || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

function createEssencePools() {
  const out = {};
  for (const terrain of INVADER_TERRAINS) out[terrain] = 0;
  return out;
}

// Inert placeholder: nothing writes essence in the round-based design. Kept so a later
// redesign has somewhere to land without another schema bump.
function normalizeEssencePools(essence) {
  const merged = essence || {};
  const out = {};
  for (const terrain of INVADER_TERRAINS) out[terrain] = Math.max(0, Math.floor(merged[terrain] || 0));
  return out;
}

function createBlightByLand() {
  return createLandMap(() => 0);
}

function normalizeBlightByLand(blightByLand) {
  const merged = blightByLand || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

// The two per-land bars, each a fraction of the next whole thing: 0 is a clean land, 1 is
// the moment a Blight lands or a Dahan falls. Floats on purpose - they fill every tick, and
// rounding them to whole points is what the old per-wave Ravage did wrong.
function createProgressByLand() {
  return createLandMap(() => 0);
}

function normalizeProgressByLand(progress) {
  const merged = progress || {};
  return createLandMap((landId) => {
    const raw = Number(merged[landId]);
    return Number.isFinite(raw) ? clamp(raw, 0, 1) : 0;
  });
}

/* ------------------------------------------------------------------ *
 * Transient feedback (06-ui-contract.md)                               *
 * ------------------------------------------------------------------ */

function normalizeDefeatFx(defeatFx) {
  if (!defeatFx || typeof defeatFx !== "object") return null;
  const land = isLandId(defeatFx.land) ? defeatFx.land : null;
  const unitType = ["explorers", "towns", "cities", "dahan"].includes(defeatFx.unitType) ? defeatFx.unitType : null;
  const count = Math.max(0, Math.floor(defeatFx.count || 0));
  const at = Number(defeatFx.at);
  if (!land || !unitType || count <= 0 || !Number.isFinite(at)) return null;
  return { land, unitType, count, at };
}

function normalizeBlightFx(blightFx) {
  if (!blightFx || typeof blightFx !== "object") return null;
  const lands = Array.isArray(blightFx.lands) ? blightFx.lands.filter(isLandId) : [];
  const amount = Math.max(0, Math.floor(blightFx.amount || 0));
  const at = Number(blightFx.at);
  if (lands.length === 0 || amount <= 0 || !Number.isFinite(at)) return null;
  return { lands, amount, at };
}

function fxIsFresh(fx) {
  return Boolean(fx) && (nowMs() - fx.at) <= DEFEAT_FX_MS;
}

function activeDefeatFx(state) {
  const fx = normalizeDefeatFx(state.ui && state.ui.defeatFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeBlightFx(state) {
  const fx = normalizeBlightFx(state.ui && state.ui.blightFx);
  return fxIsFresh(fx) ? fx : null;
}

function pruneFx(state) {
  if (!fxIsFresh(normalizeDefeatFx(state.ui.defeatFx))) state.ui.defeatFx = null;
  if (!fxIsFresh(normalizeBlightFx(state.ui.blightFx))) state.ui.blightFx = null;
}

function markDefeatFx(state, land, unitType, count) {
  const c = Math.max(0, Math.floor(count || 0));
  if (!isLandId(land) || c <= 0) return;
  state.ui.defeatFx = { land, unitType, count: c, at: nowMs() };
}

function markBlightFx(state, lands, amount) {
  const valid = (lands || []).filter(isLandId);
  if (valid.length === 0 || amount <= 0) return;
  state.ui.blightFx = { lands: valid, amount, at: nowMs() };
}

/* ------------------------------------------------------------------ *
 * Upgrades (05-progression.md)                                         *
 * ------------------------------------------------------------------ */

function upgradeTier(state, upgradeId) {
  const raw = state.upgrades && state.upgrades.purchased ? state.upgrades.purchased[upgradeId] : 0;
  if (raw === true) return 1;
  return Math.max(0, Math.floor(Number(raw) || 0));
}

function upgradeMaxTier(upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return 0;
  if (!record.repeatable) return 1;
  return Number.isFinite(record.maxTier) ? record.maxTier : Infinity;
}

// Cost of the *next* tier. Rounded to whole Fear so the shop never shows 6.4 Fear.
function upgradeCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const tier = upgradeTier(state, upgradeId);
  return Math.round(record.baseCost * Math.pow(UPGRADE_COST_GROWTH, tier));
}

// The permanent baseline every round starts from (04 Round Reset Formula).
function upgradeTotals(state) {
  const swiftTier = upgradeTier(state, "swift_currents");
  return {
    dahanBonus: upgradeTier(state, "dahan_reinforcement"),
    blightThresholdBonus: upgradeTier(state, "blight_resilience"),
    // Multiplicative, so each tier is worth slightly less than the last. Tier 12 lands at
    // roughly -46%, never at -60%, and the value can never cross zero.
    cooldownReductionPct: 1 - Math.pow(0.95, swiftTier)
  };
}

function purchaseUpgrade(state, upgradeId) {
  const t = locale(state);
  const record = UPGRADES[upgradeId];
  if (!record) return false;

  // Fear is a between-round currency; nothing in a round can spend it.
  if (state.round.status !== "ended") {
    addLog(state, t.roundStillRunning);
    return false;
  }

  const tier = upgradeTier(state, upgradeId);
  if (tier >= upgradeMaxTier(upgradeId)) {
    addLog(state, template(t.upgradeMaxed, { upgrade: upgradeName(state, upgradeId) }));
    return false;
  }

  const cost = upgradeCost(state, upgradeId);
  if (state.meta.fear < cost) {
    addLog(state, template(t.upgradeTooExpensive, {
      upgrade: upgradeName(state, upgradeId),
      cost,
      fear: formatFear(state.meta.fear)
    }));
    return false;
  }

  state.meta.fear -= cost;
  state.upgrades.purchased[upgradeId] = tier + 1;
  addLog(state, template(t.upgradePurchased, {
    upgrade: upgradeName(state, upgradeId),
    tier: tier + 1,
    cost
  }));
  return true;
}

// Fear accrues in 0.35 steps, so it is fractional by nature. One decimal is enough to see
// a single explorer land, and integer costs stay readable against it.
function formatFear(value) {
  return formatAmount(value);
}

/* ------------------------------------------------------------------ *
 * Abilities (07-content-registry.md, 04-economy-formulas.md)           *
 * ------------------------------------------------------------------ */

// The ability bar's contents: the spirit's own kit plus anything unlocked in the shop.
function unlockedAbilityIds(state) {
  const own = activeSpirit(state).abilityIds || [];
  const unlocked = own.filter((id) => Boolean(ABILITIES[id]));
  for (const upgradeId of Object.keys(state.upgrades.purchased || {})) {
    if (!upgradeId.startsWith("unlock_")) continue;
    const abilityId = upgradeId.slice("unlock_".length);
    if (ABILITIES[abilityId] && !unlocked.includes(abilityId)) unlocked.push(abilityId);
  }
  return unlocked;
}

function createAbilityState(state) {
  const out = {};
  for (const abilityId of unlockedAbilityIds(state)) out[abilityId] = { cooldownRemaining: 0 };
  return out;
}

function normalizeAbilities(state, abilities) {
  const merged = abilities || {};
  const out = {};
  for (const abilityId of unlockedAbilityIds(state)) {
    const slot = merged[abilityId] || {};
    const full = abilityCooldownSeconds(state, abilityId);
    const raw = Number(slot.cooldownRemaining);
    out[abilityId] = { cooldownRemaining: Number.isFinite(raw) ? clamp(raw, 0, full) : 0 };
  }
  return out;
}

// The round's own cooldown baseline, frozen at setup so a shop purchase cannot shorten a
// cooldown that is already ticking.
function abilityCooldownSeconds(state, abilityId) {
  const record = ABILITIES[abilityId];
  if (!record) return 0;
  const mult = Number.isFinite(state.round && state.round.abilityCooldownMult)
    ? state.round.abilityCooldownMult
    : 1;
  // Deliberately not rounded: at -5% per tier the difference between two tiers is under a
  // tenth of a second, and rounding here would quietly flatten the diminishing curve into
  // equal steps. The display rounds instead.
  return Math.max(1, record.cooldownSeconds * mult);
}

function abilityIsReady(state, abilityId) {
  const slot = state.abilities[abilityId];
  return Boolean(slot) && slot.cooldownRemaining <= 0;
}

function tickCooldowns(state, dt) {
  for (const abilityId of Object.keys(state.abilities)) {
    const slot = state.abilities[abilityId];
    if (slot.cooldownRemaining > 0) slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
  }
}

// The strongest invader type standing in a land, or null. Both the Dahan strike and Flash
// Floods pick this way, so "hits the biggest thing" is one rule, not two.
function strongestInvaderType(state, landId) {
  const slot = state.invaders[landId];
  if (!slot) return null;
  for (const type of INVADER_TYPES_BY_TIER) {
    if ((slot[type] || 0) > 0) return type;
  }
  return null;
}

function invaderCountInLand(slot) {
  if (!slot) return 0;
  return Math.max(0, slot.explorers || 0) + Math.max(0, slot.towns || 0) + Math.max(0, slot.cities || 0);
}

// A land is a legal click for the armed ability. Kept as one function so the board's
// highlight and the click handler can never disagree about what is legal.
function abilityLegalLand(state, abilityId, landId) {
  if (!isLandId(landId)) return false;
  const record = ABILITIES[abilityId];
  if (!record || !record.needsTarget) return false;
  if (record.effect === "damage_one_type") return invaderCountInLand(state.invaders[landId]) > 0;
  if (record.effect === "add_dahan") return true;
  return false;
}

function abilityLegalLands(state, abilityId) {
  return LAND_IDS.filter((landId) => abilityLegalLand(state, abilityId, landId));
}

// The land Wash Away acts on: the most-Blighted land that still holds something pushable.
// Ties break on the lowest land id, so the effect is reproducible.
function washAwaySourceLand(state) {
  let best = null;
  for (const landId of LAND_IDS) {
    const slot = state.invaders[landId];
    const pushable = (slot.explorers || 0) + (slot.towns || 0);
    if (pushable <= 0) continue;
    const blight = state.round.blightByLand[landId] || 0;
    if (blight <= 0) continue;
    if (!best || blight > best.blight) best = { landId, blight };
  }
  return best ? best.landId : null;
}

// Where those units go: the adjacent land carrying the fewest invaders, so the push
// relieves pressure instead of stacking it. Ties break on the lowest land id.
function washAwayDestination(state, source) {
  let best = null;
  for (const landId of adjacentLands(source)) {
    const load = invaderCountInLand(state.invaders[landId]);
    if (!best || load < best.load) best = { landId, load };
  }
  return best ? best.landId : null;
}

function applyBoonOfVigor(state, abilityId) {
  const t = locale(state);
  const amount = ABILITIES[abilityId].amount;
  let count = 0;

  for (const otherId of Object.keys(state.abilities)) {
    if (otherId === abilityId) continue;
    const slot = state.abilities[otherId];
    if (slot.cooldownRemaining <= 0) continue;
    slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - amount);
    count += 1;
  }

  addLog(state, template(t.boonResolved, { count, amount }));
  return true;
}

function applyWashAway(state) {
  const t = locale(state);
  const source = washAwaySourceLand(state);
  if (!source) return false;

  const destination = washAwayDestination(state, source);
  if (!destination) return false;

  const from = state.invaders[source];
  const to = state.invaders[destination];
  const moved = (from.explorers || 0) + (from.towns || 0);
  if (moved <= 0) return false;

  to.explorers += from.explorers;
  to.towns += from.towns;
  from.explorers = 0;
  from.towns = 0;

  // Partial damage belongs to the units, so it travels with them. Two half-dead towns
  // arriving in a land that already holds a half-dead town would need per-unit tracking to
  // be exact; the destination keeps the worse of the two, which never resurrects a unit.
  const fromDamage = state.invaderDamage[source];
  const toDamage = state.invaderDamage[destination];
  toDamage.explorers = Math.max(toDamage.explorers, fromDamage.explorers);
  toDamage.towns = Math.max(toDamage.towns, fromDamage.towns);
  fromDamage.explorers = 0;
  fromDamage.towns = 0;
  state.invaderDamage = clampInvaderDamageByCounts(state.invaders, state.invaderDamage);

  addLog(state, template(t.washAwayResolved, {
    total: moved,
    from: landName(state, source),
    to: landName(state, destination)
  }));
  return true;
}

function applyFlashFloods(state, landId) {
  const t = locale(state);
  const type = strongestInvaderType(state, landId);
  if (!type) return false;

  const damage = ABILITIES.flash_floods.amount;
  const result = applyDamageToInvaderType(state, landId, type, damage);
  if (result.defeated > 0) markDefeatFx(state, landId, type, result.defeated);

  addLog(state, template(t.flashFloodsResolved, {
    unit: unitLabelByType(state, type),
    land: landName(state, landId),
    damage,
    defeated: result.defeated
  }));
  return true;
}

function applyRiversBounty(state, landId) {
  const t = locale(state);
  const amount = ABILITIES.rivers_bounty.amount;
  state.dahan[landId] = (state.dahan[landId] || 0) + amount;
  addLog(state, template(t.riversBountyResolved, { amount, land: landName(state, landId) }));
  return true;
}

// Runs an ability's effect. Returns false when the effect found nothing to act on, which
// is what leaves the cooldown unspent (09 "Failure to find a target").
function applyAbilityEffect(state, abilityId, landId) {
  const record = ABILITIES[abilityId];
  if (!record) return false;
  if (record.effect === "reduce_cooldowns") return applyBoonOfVigor(state, abilityId);
  if (record.effect === "push_from_blighted") return applyWashAway(state);
  if (record.effect === "damage_one_type") return applyFlashFloods(state, landId);
  if (record.effect === "add_dahan") return applyRiversBounty(state, landId);
  return false;
}

function startCooldown(state, abilityId) {
  state.abilities[abilityId].cooldownRemaining = abilityCooldownSeconds(state, abilityId);
}

// The single entry point for the ability bar. Everything it can answer with - cancel,
// refuse, arm, resolve - lands here so the UI stays a view.
function triggerAbility(state, abilityId) {
  const t = locale(state);
  if (!ABILITIES[abilityId] || !state.abilities[abilityId]) return false;
  if (state.round.status !== "running") return false;

  // Clicking an armed ability again disarms it, without spending the cooldown.
  if (state.pendingAbilityTarget === abilityId) {
    state.pendingAbilityTarget = null;
    addLog(state, template(t.abilityCancelled, { ability: abilityName(state, abilityId) }));
    return false;
  }

  if (!abilityIsReady(state, abilityId)) {
    addLog(state, template(t.abilityOnCooldown, {
      ability: abilityName(state, abilityId),
      seconds: Math.ceil(state.abilities[abilityId].cooldownRemaining)
    }));
    return false;
  }

  const record = ABILITIES[abilityId];

  if (record.needsTarget) {
    if (abilityLegalLands(state, abilityId).length === 0) {
      addLog(state, template(t.abilityNoTarget, { ability: abilityName(state, abilityId) }));
      return false;
    }
    state.pendingAbilityTarget = abilityId;
    addLog(state, template(t.abilityArmedLog, { ability: abilityName(state, abilityId) }));
    return true;
  }

  const applied = applyAbilityEffect(state, abilityId, null);
  if (!applied) {
    addLog(state, template(t.abilityNoTarget, { ability: abilityName(state, abilityId) }));
    return false;
  }

  startCooldown(state, abilityId);
  return true;
}

// The land click that answers an armed ability. One click, no follow-up questions.
function resolveAbilityTarget(state, landId) {
  const t = locale(state);
  const abilityId = state.pendingAbilityTarget;
  if (!abilityId || !ABILITIES[abilityId]) return false;
  if (state.round.status !== "running") return false;

  if (!abilityLegalLand(state, abilityId, landId)) {
    addLog(state, template(t.abilityIllegalTarget, {
      land: landName(state, landId),
      ability: abilityName(state, abilityId)
    }));
    return false;
  }

  const applied = applyAbilityEffect(state, abilityId, landId);
  state.pendingAbilityTarget = null;
  if (!applied) {
    addLog(state, template(t.abilityNoTarget, { ability: abilityName(state, abilityId) }));
    return false;
  }

  startCooldown(state, abilityId);
  return true;
}

/* ------------------------------------------------------------------ *
 * Land states (06-ui-contract.md Land State Rules)                     *
 *                                                                      *
 * A rule rather than a paint job, so it is asserted in the suite along  *
 * with everything else the board promises.                             *
 * ------------------------------------------------------------------ */

// The lands the next wave will reinforce. Damage is everywhere now, so the wave marks where
// the island is about to get *worse* rather than where it is about to be hit.
function waveLands(state) {
  if (state.round.status !== "running") return [];
  return landsOfTerrain(state.invader.build);
}

// The detail panel is never empty: it falls back to the land the next wave will hit, so
// the most urgent land is on screen without the player hunting for it.
function effectiveSelectedLand(state) {
  if (isLandId(state.ui.selectedLand)) return state.ui.selectedLand;
  const pending = waveLands(state);
  if (pending.length > 0) return pending[0];
  return LAND_IDS[0];
}

// While an ability is armed, legality is the only thing the board says: everything that is
// not a legal click dims. That is what makes a targeting rule teachable without a rulebook,
// and it is why `out` never appears when nothing is armed.
function landRenderStates(state) {
  const armed = state.pendingAbilityTarget;
  const pending = waveLands(state);
  const selected = effectiveSelectedLand(state);
  const out = {};

  for (const landId of LAND_IDS) {
    if (armed) {
      out[landId] = abilityLegalLand(state, armed, landId) ? "legal" : "out";
    } else if (pending.includes(landId)) {
      out[landId] = "wave-active";
    } else if (landId === selected) {
      out[landId] = "selected";
    } else {
      out[landId] = "idle";
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Combat (02-core-loop.md, 04-economy-formulas.md)                     *
 * ------------------------------------------------------------------ */

// Fear from a defeat, by the unit's power value: explorer 1, town 2, city 3.
function gainFearFromDefeat(state, unitType, defeatedCount) {
  const defeated = Math.max(0, Math.floor(defeatedCount || 0));
  if (defeated <= 0) return;
  const power = (UNIT_STATS[unitType] || {}).damage || 0;
  const gain = defeated * power * FEAR_PER_POWER;
  if (gain <= 0) return;

  state.meta.fear += gain;
  state.round.fearEarned += gain;
}

function applyDamageToInvaderType(state, land, type, damage) {
  const nothing = { defeated: 0, remainingHp: 0, maxHp: 0, consumed: 0 };
  if (!isLandId(land) || !INVADER_TYPES.includes(type)) return nothing;

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = clampInvaderDamageByCounts(state.invaders, state.invaderDamage);

  const slot = state.invaders[land];
  const damageSlot = state.invaderDamage[land];
  const unitCount = Math.max(0, slot[type] || 0);
  const maxHp = UNIT_STATS[type].health;
  if (unitCount <= 0 || maxHp <= 0) return { defeated: 0, remainingHp: 0, maxHp, consumed: 0 };

  const incoming = Math.max(0, Math.floor(damage || 0));
  const carry = maxHp > 1 ? clamp(damageSlot[type] || 0, 0, maxHp - 1) : 0;

  const totalPotential = incoming + carry;
  const totalCap = unitCount * maxHp;
  const totalApplied = Math.min(totalPotential, totalCap);

  let defeated = Math.floor(totalApplied / maxHp);
  let remainder = totalApplied % maxHp;

  if (defeated >= unitCount) {
    defeated = unitCount;
    remainder = 0;
  }

  slot[type] = Math.max(0, unitCount - defeated);
  damageSlot[type] = slot[type] > 0 ? remainder : 0;

  gainFearFromDefeat(state, type, defeated);

  const remainingHp = slot[type] > 0 ? maxHp - damageSlot[type] : 0;

  // How much of the incoming damage this type actually absorbed. Callers spreading damage
  // across several types need this to avoid spending the same point twice.
  const consumed = Math.max(0, totalApplied - carry);

  return { defeated, remainingHp, maxHp, consumed };
}

function invaderDamageInLand(slot) {
  return (slot.explorers || 0) * UNIT_STATS.explorers.damage
    + (slot.towns || 0) * UNIT_STATS.towns.damage
    + (slot.cities || 0) * UNIT_STATS.cities.damage;
}

// The Dahan strike, spent automatically: 1 damage at a time on the highest tier standing,
// until the pool or the invaders run out. No player input, nothing left pending.
function spendDahanAttack(state, land, pool) {
  let remaining = Math.max(0, Math.floor(pool));
  let defeated = 0;
  let lastDefeatedType = null;

  while (remaining > 0) {
    const type = strongestInvaderType(state, land);
    if (!type) break;

    const result = applyDamageToInvaderType(state, land, type, 1);
    if (result.consumed <= 0) break;

    remaining -= result.consumed;
    if (result.defeated > 0) {
      defeated += result.defeated;
      lastDefeatedType = type;
    }
  }

  if (defeated > 0 && lastDefeatedType) markDefeatFx(state, land, lastDefeatedType, defeated);
  return { defeated, spent: Math.max(0, Math.floor(pool)) - remaining };
}

/* ------------------------------------------------------------------ *
 * Blight (02-core-loop.md, 04-economy-formulas.md)                     *
 * ------------------------------------------------------------------ */

// Blight only ever goes up, and it is the round's only clock. The per-land tally is what
// lets the board show which land cost the round, and what Wash Away reads to find the
// worst land - see docs/spec/03-state-contract.md.
function addBlight(state, land, amount) {
  const gain = Math.max(0, Math.floor(amount));
  if (gain <= 0) return 0;

  const before = state.round.blight;
  state.round.blight = clamp(before + gain, 0, state.round.blightThreshold);
  const applied = state.round.blight - before;
  if (applied > 0 && isLandId(land)) state.round.blightByLand[land] += applied;
  return applied;
}

function blightReached(state) {
  return state.round.blight >= state.round.blightThreshold;
}

/* ------------------------------------------------------------------ *
 * The fight, resolved continuously (02-core-loop.md#the-fight)         *
 *                                                                      *
 * There is no Ravage phase and no damage tick any more. Every land      *
 * holding invaders is under attack every moment of the round, and both  *
 * consequences - Blight rising, Dahan falling - accrue as fractions      *
 * that only ever land on a whole number when a bar fills.               *
 * ------------------------------------------------------------------ */

// One land, one slice of time. Both bars advance from the same snapshot of the land, so a
// Dahan that falls this slice still defended against Blight for the whole of it.
function resolveLandCombat(state, land, dt) {
  const p = landPressure(state, land);
  const out = { blightGained: 0, dahanLost: 0 };
  if (p.gross <= 0) return out;

  if (p.blightPerSecond > 0) {
    let progress = state.round.blightProgress[land] + p.blightPerSecond * dt;
    // The remainder carries rather than resetting, so a bar that overshoots by 3% starts the
    // next Blight at 3% instead of throwing it away. Over a round that drift is whole Blight.
    while (progress >= 1 && !blightReached(state)) {
      progress -= 1;
      out.blightGained += addBlight(state, land, 1);
    }
    state.round.blightProgress[land] = blightReached(state) ? 0 : clamp(progress, 0, 1);
  }

  if (p.dahanPerSecond > 0) {
    let progress = state.round.dahanProgress[land] + p.dahanPerSecond * dt;
    while (progress >= 1 && state.dahan[land] > 0) {
      progress -= 1;
      state.dahan[land] -= 1;
      out.dahanLost += 1;
    }
    // Nothing left to wound, so nothing carries: reinforcements arrive at a full bar.
    state.round.dahanProgress[land] = state.dahan[land] > 0 ? clamp(progress, 0, 1) : 0;
  }

  return out;
}

function resolveContinuousCombat(state, dt) {
  if (dt <= 0) return;
  const t = locale(state);

  state.invaders = normalizeInvaderCounts(state.invaders);

  const blightedLands = [];
  let blightTotal = 0;

  for (const land of LAND_IDS) {
    const result = resolveLandCombat(state, land, dt);

    if (result.dahanLost > 0) {
      markDefeatFx(state, land, "dahan", result.dahanLost);
      addLog(state, template(t.dahanFell, {
        count: result.dahanLost,
        land: landName(state, land),
        left: state.dahan[land]
      }));
    }

    if (result.blightGained > 0) {
      blightedLands.push(land);
      blightTotal = Math.max(blightTotal, result.blightGained);
      addLog(state, template(t.blightGained, {
        land: landName(state, land),
        amount: result.blightGained,
        total: state.round.blight,
        threshold: state.round.blightThreshold
      }));
    }
  }

  if (blightedLands.length > 0) markBlightFx(state, blightedLands, blightTotal);
  if (blightReached(state)) endRound(state);
}

// Every Dahan on the island swings at once, on their own timer. A land with no invaders is
// skipped rather than logged, or the log would be nothing but empty-land lines.
function resolveDahanAttack(state) {
  const t = locale(state);
  state.invaders = normalizeInvaderCounts(state.invaders);

  let landsThatStruck = 0;

  for (const land of LAND_IDS) {
    const dahan = Math.max(0, state.dahan[land] || 0);
    if (dahan <= 0 || invaderCountInLand(state.invaders[land]) <= 0) continue;

    const result = spendDahanAttack(state, land, dahan * DAHAN_ATTACK_DAMAGE);
    landsThatStruck += 1;
    addLog(state, template(t.dahanAttackResolved, {
      land: landName(state, land),
      damage: result.spent,
      defeated: result.defeated
    }));
  }

  if (landsThatStruck === 0) addLog(state, t.dahanAttackNoTargets);
}

/* ------------------------------------------------------------------ *
 * Invader phases (09-island-board.md)                                  *
 * ------------------------------------------------------------------ */

// Discover only seeds explorers into a land that is coastal, or that sits next to a town or
// city. Mountains has no coast, so it stays quiet until the invaders build their way inland.
function landAcceptsExplorer(state, landId) {
  if (landIsCoastal(landId)) return true;
  return adjacentLands(landId).some((neighbour) => {
    const slot = state.invaders[neighbour];
    return Boolean(slot) && ((slot.towns || 0) > 0 || (slot.cities || 0) > 0);
  });
}

function resolveBuildPhase(state) {
  const t = locale(state);
  const terrain = state.invader.build;

  if (!terrain) {
    addLog(state, t.buildNothing);
    return;
  }

  state.invaders = normalizeInvaderCounts(state.invaders);

  // Each land of the terrain builds on its own count, so the two can build different units.
  for (const land of landsOfTerrain(terrain)) {
    const slot = state.invaders[land];
    if (invaderCountInLand(slot) <= 0) {
      addLog(state, template(t.buildNoInvaders, { land: landName(state, land) }));
      continue;
    }

    const built = slot.towns > slot.cities ? "cities" : "towns";
    slot[built] += 1;
    addLog(state, template(t.buildResolved, {
      land: landName(state, land),
      unit: unitLabelOne(state, built)
    }));
  }
}

function resolveExplorePhase(state) {
  const t = locale(state);
  const terrain = state.invader.explore;

  if (!terrain) {
    addLog(state, t.exploreNothing);
    return;
  }

  state.invaders = normalizeInvaderCounts(state.invaders);

  let seeded = 0;
  for (const land of landsOfTerrain(terrain)) {
    if (!landAcceptsExplorer(state, land)) {
      addLog(state, template(t.exploreBlocked, { land: landName(state, land) }));
      continue;
    }
    state.invaders[land].explorers += 1;
    seeded += 1;
    addLog(state, template(t.exploreResolved, { land: landName(state, land) }));
  }

  if (seeded === 0) {
    addLog(state, template(t.exploreNoneReachable, { terrain: terrainName(state, terrain) }));
  }
}

// The track slides forward. What was discovered this wave is built on the next one, so the
// player can see a terrain thicken one wave before it does.
function shiftInvaderTrack(state) {
  state.invader = normalizeInvaderPhases(state.invader);

  const shiftedToBuild = state.invader.explore;
  state.invader.build = shiftedToBuild;
  state.invader.explore = drawInvaderTerrainExcluding([shiftedToBuild]);

  const t = locale(state);
  addLog(state, template(t.waveIncoming, {
    build: terrainName(state, state.invader.build),
    discover: terrainName(state, state.invader.explore)
  }));
}

/* ------------------------------------------------------------------ *
 * The round (02-core-loop.md)                                          *
 * ------------------------------------------------------------------ */

// One wave: reinforcement only. A wave no longer deals a point of damage - it just adds to
// what is already grinding the island down between waves.
function resolveWave(state) {
  resolveBuildPhase(state);
  resolveExplorePhase(state);
  shiftInvaderTrack(state);

  state.round.wavesResolved += 1;
  addLog(state, template(locale(state).waveResolved, { wave: state.round.wavesResolved }));
}

function endRound(state) {
  const t = locale(state);
  if (state.round.status === "ended") return;

  state.round.status = "ended";
  state.round.waveTimerRemaining = 0;
  state.round.dahanAttackRemaining = 0;
  state.pendingAbilityTarget = null;

  state.meta.totalRoundsPlayed += 1;
  state.meta.bestRoundReached = Math.max(state.meta.bestRoundReached, state.round.number);

  addLog(state, template(t.roundEnded, {
    round: state.round.number,
    blight: state.round.blight,
    threshold: state.round.blightThreshold,
    fear: formatFear(state.round.fearEarned)
  }));
}

// Seeds the Dahan for a round: the spirit's fixed baseline, then any purchased
// reinforcement, one at a time into whichever land is emptiest.
function seedRoundDahan(state) {
  const spirit = activeSpirit(state);
  state.dahan = normalizeDahanCounts(spirit.roundStartDahan);

  let remaining = upgradeTotals(state).dahanBonus;

  while (remaining > 0) {
    // Emptiest land first, ties on the lowest id: deterministic, so a round setup can be
    // asserted in a test rather than sampled. Always filling the emptiest land is also what
    // holds the DAHAN_MAX_SPREAD invariant - a land can only rise to n+1 once every land
    // has reached n - and it is the fastest repair if a spirit's baseline starts lopsided.
    let target = LAND_IDS[0];
    for (const landId of LAND_IDS) {
      if (state.dahan[landId] < state.dahan[target]) target = landId;
    }

    state.dahan[target] += 1;
    remaining -= 1;
  }

  const summary = LAND_IDS
    .filter((landId) => state.dahan[landId] > 0)
    .map((landId) => `${template(locale(state).landShort, { id: landId })} ${state.dahan[landId]}`)
    .join(", ");

  if (summary) addLog(state, template(locale(state).dahanRoundLog, { summary }));
}

// Round setup (02 Round Sequence step 1). Runs at the start of every round, not just at
// game start, and reads the permanent upgrade baseline each time.
function startRound(state) {
  const totals = upgradeTotals(state);

  state.round.status = "running";
  state.round.elapsedSeconds = 0;
  state.round.blight = 0;
  state.round.blightByLand = createBlightByLand();
  state.round.blightProgress = createProgressByLand();
  state.round.dahanProgress = createProgressByLand();
  state.round.blightThreshold = BLIGHT_THRESHOLD_BASE + totals.blightThresholdBonus;
  state.round.waveTimerRemaining = WAVE_INTERVAL_SECONDS;
  state.round.dahanAttackRemaining = DAHAN_ATTACK_INTERVAL_SECONDS;
  state.round.wavesResolved = 0;
  state.round.fearEarned = 0;
  state.round.abilityCooldownMult = 1 - totals.cooldownReductionPct;

  state.invaders = createInvaderCounts();
  state.invaderDamage = createInvaderDamage();
  state.invader = normalizeInvaderPhases({ build: null, explore: drawOpeningTerrain(state) });

  state.pendingAbilityTarget = null;
  state.abilities = createAbilityState(state);

  state.ui.defeatFx = null;
  state.ui.blightFx = null;

  addLog(state, template(locale(state).roundStarted, {
    round: state.round.number,
    threshold: state.round.blightThreshold
  }));

  seedRoundDahan(state);
  seedRoundExplore(state);
  return state;
}

// The opening Discover, run at setup rather than on the first wave. Without it the island
// stands empty for the whole first wave interval: nothing to fight, no Blight accruing, and
// a Build phase at wave 1 with nothing to build on. Now the invaders are ashore from second
// zero, and the terrain they landed in is what wave 1 builds up - the track shift below is
// what puts it in the Build slot, so wave 1 reads the same as every wave after it.
//
// It is not a wave: `wavesResolved` stays at 0 and no timer is touched.
function seedRoundExplore(state) {
  addLog(state, locale(state).setupExplore);
  resolveExplorePhase(state);
  shiftInvaderTrack(state);
}

// Leaving the shop. The round number only moves here, so a reload inside the shop cannot
// skip a round.
function startNextRound(state) {
  if (state.round.status !== "ended") return false;
  state.round.number += 1;
  startRound(state);
  return true;
}

/* ------------------------------------------------------------------ *
 * Tick (04-economy-formulas.md Wave Timing)                            *
 * ------------------------------------------------------------------ */

function tick(state, dt) {
  const step = Math.max(0, Math.min(MAX_TICK_SECONDS, Number(dt) || 0));
  state.time.totalSeconds += step;
  pruneFx(state);

  if (state.round.status !== "running" || step <= 0) return;

  state.round.elapsedSeconds += step;
  tickCooldowns(state, step);

  // The fight first: it is what actually ends the round, and resolving it before the wave
  // means a land cannot be reinforced out from under damage it had already taken this tick.
  resolveContinuousCombat(state, step);
  if (state.round.status !== "running") {
    state.round.waveTimerRemaining = 0;
    state.round.dahanAttackRemaining = 0;
    return;
  }

  state.round.dahanAttackRemaining -= step;
  let dahanGuard = 0;
  while (state.round.dahanAttackRemaining <= 0 && dahanGuard < 16) {
    state.round.dahanAttackRemaining += DAHAN_ATTACK_INTERVAL_SECONDS;
    resolveDahanAttack(state);
    dahanGuard += 1;
  }

  state.round.waveTimerRemaining -= step;

  // A capped tick is shorter than a wave interval today, but the loop is written to survive
  // a longer one rather than silently swallowing the extra waves.
  let guard = 0;
  while (state.round.status === "running" && state.round.waveTimerRemaining <= 0 && guard < 16) {
    state.round.waveTimerRemaining += WAVE_INTERVAL_SECONDS;
    resolveWave(state);
    guard += 1;
  }

  if (state.round.status !== "running") {
    state.round.waveTimerRemaining = 0;
    state.round.dahanAttackRemaining = 0;
  }
}

/* ------------------------------------------------------------------ *
 * State creation, normalization, migration (03-state-contract.md)      *
 * ------------------------------------------------------------------ */

function createInitialState() {
  return {
    schemaVersion: VERSION,
    time: {
      totalSeconds: 0,
      lastTickUnixMs: nowMs(),
      lastSaveUnixMs: nowMs()
    },
    meta: {
      fear: 0,
      totalRoundsPlayed: 0,
      bestRoundReached: 0
    },
    spirit: {
      activeSpiritId: "core_spirit_01",
      unlockedSpiritIds: ["core_spirit_01"]
    },
    upgrades: {
      purchased: {}
    },
    ui: {
      language: "de",
      defeatFx: null,
      blightFx: null,
      selectedLand: null
    },
    round: {
      number: 1,
      status: "running",
      elapsedSeconds: 0,
      blight: 0,
      blightByLand: createBlightByLand(),
      blightProgress: createProgressByLand(),
      dahanProgress: createProgressByLand(),
      blightThreshold: BLIGHT_THRESHOLD_BASE,
      waveTimerRemaining: WAVE_INTERVAL_SECONDS,
      dahanAttackRemaining: DAHAN_ATTACK_INTERVAL_SECONDS,
      wavesResolved: 0,
      fearEarned: 0,
      abilityCooldownMult: 1
    },
    invader: { build: null, explore: null },
    invaders: createInvaderCounts(),
    invaderDamage: createInvaderDamage(),
    dahan: createDahanCounts(),
    abilities: {},
    pendingAbilityTarget: null,
    resources: { energy: 0 },
    essence: createEssencePools(),
    _log: []
  };
}

// First-ever load, and the target every migration falls back to.
function createFreshGameState() {
  const state = createInitialState();
  state.abilities = createAbilityState(state);
  startRound(state);
  return state;
}

function normalizeState(raw) {
  const base = createInitialState();
  const input = raw && typeof raw === "object" ? raw : {};

  const merged = {
    ...base,
    ...input,
    time: { ...base.time, ...(input.time || {}) },
    meta: { ...base.meta, ...(input.meta || {}) },
    spirit: { ...base.spirit, ...(input.spirit || {}) },
    upgrades: { ...base.upgrades, ...(input.upgrades || {}) },
    ui: { ...base.ui, ...(input.ui || {}) },
    round: { ...base.round, ...(input.round || {}) },
    resources: { ...base.resources, ...(input.resources || {}) }
  };

  merged.schemaVersion = VERSION;

  // Single-spirit mode: an unknown or absent spirit id falls back rather than crashing.
  if (!SPIRITS[merged.spirit.activeSpiritId]) merged.spirit.activeSpiritId = "core_spirit_01";
  merged.spirit.unlockedSpiritIds = Array.isArray(merged.spirit.unlockedSpiritIds)
    ? merged.spirit.unlockedSpiritIds.filter((id) => Boolean(SPIRITS[id]))
    : ["core_spirit_01"];
  if (merged.spirit.unlockedSpiritIds.length === 0) merged.spirit.unlockedSpiritIds = ["core_spirit_01"];

  merged.ui.language = merged.ui.language === "en" ? "en" : "de";
  merged.ui.selectedLand = isLandId(merged.ui.selectedLand) ? merged.ui.selectedLand : null;
  merged.ui.defeatFx = normalizeDefeatFx(merged.ui.defeatFx);
  merged.ui.blightFx = normalizeBlightFx(merged.ui.blightFx);

  merged.meta.fear = Math.max(0, Number(merged.meta.fear) || 0);
  merged.meta.totalRoundsPlayed = Math.max(0, Math.floor(merged.meta.totalRoundsPlayed || 0));
  merged.meta.bestRoundReached = Math.max(0, Math.floor(merged.meta.bestRoundReached || 0));

  // Upgrade tiers survive anything: an unknown id is dropped, a bad value clamps to 0.
  const purchased = {};
  for (const [id, value] of Object.entries(merged.upgrades.purchased || {})) {
    const known = Boolean(UPGRADES[id]) || (id.startsWith("unlock_") && Boolean(ABILITIES[id.slice("unlock_".length)]));
    if (!known) continue;
    const tier = value === true ? 1 : Math.max(0, Math.floor(Number(value) || 0));
    if (tier <= 0) continue;
    purchased[id] = Math.min(tier, upgradeMaxTier(id));
  }
  merged.upgrades.purchased = purchased;

  merged.round.number = Math.max(1, Math.floor(merged.round.number || 1));
  merged.round.status = merged.round.status === "ended" ? "ended" : "running";
  merged.round.elapsedSeconds = Math.max(0, Number(merged.round.elapsedSeconds) || 0);
  merged.round.wavesResolved = Math.max(0, Math.floor(merged.round.wavesResolved || 0));
  merged.round.fearEarned = Math.max(0, Number(merged.round.fearEarned) || 0);
  merged.round.blightThreshold = Math.max(1, Math.floor(merged.round.blightThreshold || BLIGHT_THRESHOLD_BASE));
  merged.round.blight = clamp(Math.floor(Number(merged.round.blight) || 0), 0, merged.round.blightThreshold);
  merged.round.blightByLand = normalizeBlightByLand(merged.round.blightByLand);
  merged.round.blightProgress = normalizeProgressByLand(merged.round.blightProgress);
  merged.round.dahanProgress = normalizeProgressByLand(merged.round.dahanProgress);
  merged.round.waveTimerRemaining = clamp(
    Number(merged.round.waveTimerRemaining) || 0,
    0,
    WAVE_INTERVAL_SECONDS
  );
  merged.round.dahanAttackRemaining = clamp(
    Number(merged.round.dahanAttackRemaining) || 0,
    0,
    DAHAN_ATTACK_INTERVAL_SECONDS
  );
  const mult = Number(merged.round.abilityCooldownMult);
  merged.round.abilityCooldownMult = Number.isFinite(mult) && mult > 0 ? Math.min(mult, 1) : 1;

  merged.invader = normalizeInvaderPhases(merged.invader);
  merged.invaders = normalizeInvaderCounts(merged.invaders);
  merged.invaderDamage = clampInvaderDamageByCounts(merged.invaders, merged.invaderDamage);
  merged.dahan = normalizeDahanCounts(merged.dahan);
  merged.essence = normalizeEssencePools(merged.essence);
  merged.resources.energy = Math.max(0, Math.floor(merged.resources.energy || 0));

  merged.abilities = normalizeAbilities(merged, merged.abilities);
  merged.pendingAbilityTarget = merged.abilities[merged.pendingAbilityTarget]
    && ABILITIES[merged.pendingAbilityTarget]
    && ABILITIES[merged.pendingAbilityTarget].needsTarget
    ? merged.pendingAbilityTarget
    : null;

  merged._log = Array.isArray(merged._log) ? merged._log.slice(0, 24) : [];

  return merged;
}

// A 2.0.0 save is turn-based and presence-driven: there is no meaningful mapping from a
// presence track to an ability cooldown, so migration is a hard reset rather than a
// field-by-field translation. See docs/spec/03-state-contract.md#migration-from-200.
function migrateSave(raw) {
  if (raw && typeof raw === "object" && raw.schemaVersion === VERSION) {
    return { state: normalizeState(raw), reset: false, fromVersion: raw.schemaVersion };
  }

  const fromVersion = raw && typeof raw === "object" && raw.schemaVersion ? String(raw.schemaVersion) : "?";
  const fresh = createFreshGameState();

  // The language toggle is a display preference, not run state, so it survives the reset.
  // Coming back to a wiped run in the wrong language would read as a second bug.
  if (raw && raw.ui && raw.ui.language === "en") fresh.ui.language = "en";

  addLog(fresh, template(locale(fresh).migrationReset, { version: fromVersion }));
  return { state: fresh, reset: true, fromVersion };
}

/* ------------------------------------------------------------------ *
 * Persistence                                                          *
 * ------------------------------------------------------------------ */

// No offline catch-up: a save resumes exactly as written, crediting nothing for the gap.
function loadState(storage) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return createFreshGameState();

  try {
    const rawText = store.getItem(SAVE_KEY);
    if (!rawText) return createFreshGameState();

    const parsed = JSON.parse(rawText);
    const migrated = migrateSave(parsed);
    const state = migrated.state;

    state.time.lastTickUnixMs = nowMs();
    state.time.lastSaveUnixMs = nowMs();
    return state;
  } catch (_) {
    return createFreshGameState();
  }
}

function saveState(state, storage) {
  const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return;
  state.time.lastSaveUnixMs = nowMs();
  state.time.lastTickUnixMs = nowMs();
  store.setItem(SAVE_KEY, JSON.stringify(state));
}

/* ------------------------------------------------------------------ *
 * Export shim                                                          *
 *                                                                      *
 * The browser loads this as a classic script, so ui.js can just call    *
 * these by name. The test harness wants them as one object instead, in  *
 * either environment: `window.SpiritEngine` for tests.html, or          *
 * `module.exports` for node tests/run.js.                              *
 * ------------------------------------------------------------------ */

const ENGINE_EXPORTS = {
  SAVE_KEY,
  VERSION,
  WAVE_INTERVAL_SECONDS,
  BLIGHT_THRESHOLD_BASE,
  BLIGHT_PER_DAMAGE_SECOND,
  DAHAN_LOSS_PER_DAMAGE_SECOND,
  BLIGHT_FLOOR_FRACTION,
  DAHAN_CONCENTRATION_CAP,
  DAHAN_ATTACK_INTERVAL_SECONDS,
  DAHAN_ATTACK_DAMAGE,
  DAHAN_PER_ROUND_START_BASE,
  DAHAN_MAX_SPREAD,
  DEFEAT_FX_MS,
  MAX_TICK_SECONDS,
  FEAR_PER_POWER,
  UNIT_STATS,
  INVADER_TYPES,
  INVADER_TERRAINS,
  SPIRITS,
  ABILITIES,
  ABILITY_IDS,
  UPGRADES,
  UPGRADE_IDS,
  BOARD_LANDS,
  TERRAIN_RGB,
  LAND_IDS,
  I18N,
  setNowSource,
  setRng,
  isLandId,
  landTerrain,
  landIsCoastal,
  adjacentLands,
  areAdjacent,
  landsOfTerrain,
  locale,
  template,
  addLog,
  activeSpirit,
  landName,
  terrainName,
  terrainLandsSummary,
  unitLabelByType,
  unitLabelOne,
  abilityName,
  abilityText,
  abilityRequirementText,
  landPressure,
  buildOutcomeInLand,
  pressureChipText,
  pressureDetailText,
  buildChipText,
  etaText,
  upgradeName,
  upgradeText,
  formatFear,
  upgradeTier,
  upgradeMaxTier,
  upgradeCost,
  upgradeTotals,
  purchaseUpgrade,
  unlockedAbilityIds,
  abilityCooldownSeconds,
  abilityIsReady,
  abilityLegalLand,
  abilityLegalLands,
  washAwaySourceLand,
  washAwayDestination,
  strongestInvaderType,
  waveLands,
  effectiveSelectedLand,
  landRenderStates,
  invaderCountInLand,
  invaderDamageInLand,
  triggerAbility,
  resolveAbilityTarget,
  applyDamageToInvaderType,
  spendDahanAttack,
  gainFearFromDefeat,
  addBlight,
  blightReached,
  resolveLandCombat,
  resolveContinuousCombat,
  resolveDahanAttack,
  landAcceptsExplorer,
  drawOpeningTerrain,
  resolveBuildPhase,
  resolveExplorePhase,
  shiftInvaderTrack,
  resolveWave,
  startRound,
  startNextRound,
  endRound,
  seedRoundDahan,
  seedRoundExplore,
  tick,
  createInitialState,
  createFreshGameState,
  createInvaderCounts,
  createInvaderDamage,
  createDahanCounts,
  createBlightByLand,
  createProgressByLand,
  normalizeState,
  migrateSave,
  loadState,
  saveState,
  activeDefeatFx,
  activeBlightFx,
  pruneFx
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ENGINE_EXPORTS;
} else if (typeof window !== "undefined") {
  window.SpiritEngine = ENGINE_EXPORTS;
}
