const SAVE_KEY = "spirit-idland-save-v1";
const VERSION = "1.5.0";

const CONSTS = {
  MAX_OFFLINE_HOURS: 12,
  ACTION_INTERVAL_SECONDS: 7,
  ACTION_MAX_CHARGES: 3,
  STARTING_ENERGY: 20
};

const SPIRITS = {
  core_spirit_01: {
    name: "Reissende Fluten im Sonnenlicht",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
    traitsEn: "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
    energyRateMult: 1.05,
    fearRateMult: 1,
    pushPowerMult: 1.2,
    strikePowerMult: 0.9
  }
};

const I18N = {
  de: {
    topSubtitle: "Kooperatives Idle-Prototyping im Geister-Stil",
    metricsTitle: "Kernwerte",
    energyLabel: "Energie",
    fearLabel: "Furcht",
    fearProgressLabel: "Fortschritt zur naechsten Furchtstufe",
    cardsTitle: "Startkarten des Flussgeists",
    turnTitle: "Rundenablauf",
    turnInfo: "Waehle pro Runde genau eine Wachstumsoption. Die neuen Systeme sind vorerst Platzhalter.",
    turnLabel: "Runde:",
    growthChosenLabel: "Wachstum:",
    growthNotChosen: "nicht gewaehlt",
    growthOptionReclaim: "Karten zurueckholen, +1 Energie, 1 Kraftkarte nehmen (ohne Effekt)",
    growthOptionDoublePresence: "2 Praesenzen hinzufuegen (ohne Effekt)",
    growthOptionPowerAndPresence: "1 Kraftkarte nehmen und 1 Praesenz hinzufuegen (ohne Effekt)",
    endTurnBtn: "Runde beenden",
    drawLabel: "Nachziehstapel:",
    discardLabel: "Ablage:",
    handLabel: "Hand:",
    actionStatus: "Aktionen: {charges}/{max} (naechste in {next}s)",
    noFailHint: "Furcht bleibt zentral und wird spaeter als Waehrung genutzt.",
    learnTitle: "So funktioniert es",
    learnItem1Title: "Karten ausspielen:",
    learnItem1Text: "jedes Omen kostet Energie und wirkt als bestimmtes Geisterritual.",
    learnItem2Title: "Nachzieh-Ablage-Kreislauf:",
    learnItem2Text: "gespielte Omen wandern in die Ablage und spaeter zurueck in den Stapel.",
    learnItem3Title: "Kartenrollen:",
    learnItem3Text: "Startkarten sind als Grundlage gesetzt, weitere Effekte folgen schrittweise.",
    learnItem4Title: "Furchtstufen:",
    learnItem4Text: "Furcht bleibt als Kernressource erhalten und wird spaeter erweitert.",
    mapTitle: "Gebietstypen",
    mapPlanHint: "Vier Bereiche, einer pro Gebietstyp. Invasoren starten bei 0.",
    explorersLabel: "Entdecker",
    townsLabel: "Doerfer",
    citiesLabel: "Staedte",
    dahanLabel: "Dahan",
    pushAwayBtn: "Wegschieben",
    pushToBtn: "Hinschieben",
    washAwayChooseSource: "Wash Away: Waehle einen Bereich fuer Wegschieben.",
    washAwayChooseUnits: "Wash Away: Waehle, was weggeschoben wird (max. 3 Entdecker/Doerfer).",
    washAwayChooseDestination: "Wash Away: Waehle das Zielgebiet.",
    washAwayUnitsBtn: "E:{explorers} D:{towns}",
    washAwayConfirmBtn: "Weiter",
    washAwayNoTargets: "Wash Away hat keine Entdecker/Doerfer zum Schieben.",
    washAwayResolved: "Wash Away: {total} verschoben von {from} nach {to} (E:{explorers}, D:{towns}).",
    finishWashAwayFirst: "Beende zuerst den Wash-Away-Effekt.",
    flashFloodsChooseLand: "Flash Floods: Waehle ein Zielgebiet.",
    flashFloodsChooseTarget: "Flash Floods: Waehle einen Zieltyp.",
    flashFloodsChooseBonusTarget: "Flash Floods: Waehle das Ziel fuer den restlichen Schaden.",
    flashFloodsLandBtn: "Zielen",
    flashFloodsTargetBtn: "Treffe {target}",
    flashFloodsNoTargets: "Flash Floods hat kein gueltiges Ziel.",
    flashFloodsResolved: "Flash Floods trifft {target} in {land}: {damage} Schaden, {defeated} besiegt.",
    finishFlashFloodsFirst: "Beende zuerst den Flash-Floods-Effekt.",
    riversBountyChooseDestination: "River's Bounty: Waehle Zielgebiet fuer Gather.",
    riversBountyChooseSources: "River's Bounty: Waehle ein oder mehrere Quellgebiete.",
    riversBountySetDestinationBtn: "Hier sammeln",
    riversBountyFromBtn: "Von hier sammeln",
    riversBountyFinishBtn: "Gather beenden",
    riversBountyProgress: "Gather: {moved}/2",
    riversBountyNoTargets: "River's Bounty hat keine Dahan zum Gather.",
    riversBountyResolved: "River's Bounty: {moved} Dahan nach {to} gesammelt.",
    riversBountyBonus: "River's Bounty-Bonus in {to}: +1 Dahan, +1 Energie.",
    finishRiversBountyFirst: "Beende zuerst den River's-Bounty-Effekt.",
    defeatHint: "Besiegt: -{count} {unit}",
    spiritTitle: "Geisterfokus (Phase 1)",
    activeSpiritLabel: "Aktiver Geist:",
    spiritPhaseHint: "Diese Version ist absichtlich auf einen Geist begrenzt, damit wir Mechaniken Schritt fuer Schritt aufbauen koennen.",
    progressionTitle: "Fortschritt",
    logTitle: "Spielprotokoll",
    manualSaveBtn: "Jetzt speichern",
    wipeSaveBtn: "Spielstand loeschen",
    autosaveHint: "Autosave alle 10s. Offline-Fortschritt wird bei Rueckkehr angewendet.",
    fearTierPrefix: "Furchtstufe",
    adversaryTierPrefix: "Invasor-Stufe",
    energySourceText: "nur durch Karten",
    fearSourceText: "Kernressource",
    playHint: "River-Startkarten (Phase 1): Boon of Vigor, Flash Floods, River's Bounty, Wash Away.",
    costWord: "Kosten",
    energyWord: "Energie",
    playWord: "Ausspielen",
    reclaimNeededWord: "Rueckholen noetig",
    noCardsInHand: "Keine Karten auf der Hand. Ziehe eine neue Hand.",
    cardReadyStatus: "Bereit",
    cardNeedEnergyStatus: "Mehr Energie noetig",
    cardNeedActionStatus: "Keine Aktion verfuegbar",
    cardNeedGrowthStatus: "Zuerst Wachstum waehlen",
    cardNeedTargetingStatus: "Zuerst laufenden Zieleffekt beenden",
    cardUsedStatus: "Verbraucht bis Rueckholen",
    noActionPoints: "Keine Aktionen verfuegbar.",
    growthFirstRequired: "Waehle zuerst eine Wachstumsoption.",
    growthAlreadyChosen: "Wachstum wurde fuer diese Runde bereits gewaehlt.",
    growthPicked: "Wachstum fuer Runde {turn} gewaehlt: {option}.",
    reclaimApplied: "Wachstum: Karten zurueckgeholt, +1 Energie, 1 Kraftkarte markiert.",
    endTurnLog: "Runde {turn} beendet. Runde {nextTurn} beginnt.",
    invaderTrackTitle: "Invasorenphasen",
    ravageLabel: "Verwuesten:",
    buildLabel: "Bauen:",
    discoverLabel: "Entdecken:",
    invaderNone: "-",
    invaderLandNames: {
      mountains: "Berge",
      desert: "Wueste",
      jungle: "Dschungel",
      wetlands: "Suempfe"
    },
    invaderPhaseLog: "Invasorenphasen - Verwuesten: {ravage}, Bauen: {build}, Entdecken: {discover}.",
    dahanRoundLog: "Dahan versammeln sich: {summary}.",
    invaderHpHint: "{unit} HP: {current}/{max}",
    fearConsequence: "Furchtstufe {tier}. Noch {fearNeeded} Furcht bis zur naechsten Terrorwende.",
    cardNames: {
      boon_of_vigor: "Boon of Vigor",
      flash_floods: "Flash Floods",
      rivers_bounty: "River's Bounty",
      wash_away: "Wash Away"
    },
    langToggle: "English"
  },
  en: {
    topSubtitle: "Cooperative idle prototyping in spirit-form",
    metricsTitle: "Core Metrics",
    energyLabel: "Energy",
    fearLabel: "Fear",
    fearProgressLabel: "Progress to next Fear Tier",
    cardsTitle: "River Starter Cards",
    turnTitle: "Turn Flow",
    turnInfo: "Choose exactly one growth option each turn. These new systems are placeholders for now.",
    turnLabel: "Turn:",
    growthChosenLabel: "Growth:",
    growthNotChosen: "not chosen",
    growthOptionReclaim: "Reclaim cards, +1 energy, gain 1 power card (no effect yet)",
    growthOptionDoublePresence: "Add 2 presences (no effect yet)",
    growthOptionPowerAndPresence: "Gain 1 power card and add 1 presence (no effect yet)",
    endTurnBtn: "End Turn",
    drawLabel: "Draw Pile:",
    discardLabel: "Discard:",
    handLabel: "Hand:",
    actionStatus: "Actions: {charges}/{max} (next in {next}s)",
    noFailHint: "Fear stays central and will later become currency.",
    learnTitle: "How It Works",
    learnItem1Title: "Play cards:",
    learnItem1Text: "each omen costs energy and represents a specific spirit rite.",
    learnItem2Title: "Draw-discard cycle:",
    learnItem2Text: "played omens move to discard and later return to the draw pile.",
    learnItem3Title: "Card roles:",
    learnItem3Text: "starter cards are set as the foundation, with more effects coming step by step.",
    learnItem4Title: "Fear layers:",
    learnItem4Text: "fear remains a core resource and will be expanded later.",
    mapTitle: "Area Types",
    mapPlanHint: "Four panels, one for each area type. Invaders start at 0.",
    explorersLabel: "Explorers",
    townsLabel: "Towns",
    citiesLabel: "Cities",
    dahanLabel: "Dahan",
    pushAwayBtn: "Push Away",
    pushToBtn: "Push To",
    washAwayChooseSource: "Wash Away: choose an area type to push from.",
    washAwayChooseUnits: "Wash Away: choose what to push (up to 3 explorers/towns).",
    washAwayChooseDestination: "Wash Away: choose a destination area type.",
    washAwayUnitsBtn: "E:{explorers} T:{towns}",
    washAwayConfirmBtn: "Continue",
    washAwayNoTargets: "Wash Away has no explorers/towns to push.",
    washAwayResolved: "Wash Away: moved {total} from {from} to {to} (E:{explorers}, T:{towns}).",
    finishWashAwayFirst: "Finish the Wash Away effect first.",
    flashFloodsChooseLand: "Flash Floods: choose a target area type.",
    flashFloodsChooseTarget: "Flash Floods: choose a target unit type.",
    flashFloodsChooseBonusTarget: "Flash Floods: choose where to apply remaining damage.",
    flashFloodsLandBtn: "Target",
    flashFloodsTargetBtn: "Hit {target}",
    flashFloodsNoTargets: "Flash Floods has no valid target.",
    flashFloodsResolved: "Flash Floods hits {target} in {land}: {damage} damage, {defeated} defeated.",
    finishFlashFloodsFirst: "Finish the Flash Floods effect first.",
    riversBountyChooseDestination: "River's Bounty: choose a destination area type.",
    riversBountyChooseSources: "River's Bounty: choose one or more source area types.",
    riversBountySetDestinationBtn: "Gather Here",
    riversBountyFromBtn: "Gather From",
    riversBountyFinishBtn: "Finish Gather",
    riversBountyProgress: "Gathered: {moved}/2",
    riversBountyNoTargets: "River's Bounty has no Dahan to gather.",
    riversBountyResolved: "River's Bounty: gathered {moved} Dahan into {to}.",
    riversBountyBonus: "River's Bounty bonus in {to}: +1 Dahan, +1 Energy.",
    finishRiversBountyFirst: "Finish the River's Bounty effect first.",
    defeatHint: "Defeated: -{count} {unit}",
    spiritTitle: "Spirit Focus (Phase 1)",
    activeSpiritLabel: "Active Spirit:",
    spiritPhaseHint: "This version is intentionally limited to one spirit so we can rebuild mechanics step by step.",
    progressionTitle: "Progression",
    logTitle: "Game Log",
    manualSaveBtn: "Save Now",
    wipeSaveBtn: "Wipe Save",
    autosaveHint: "Autosave every 10s. Offline progress applies when you return.",
    fearTierPrefix: "Fear Tier",
    adversaryTierPrefix: "Adversary Tier",
    energySourceText: "from cards only",
    fearSourceText: "core resource",
    playHint: "River starter cards (phase 1): Boon of Vigor, Flash Floods, River's Bounty, Wash Away.",
    costWord: "Cost",
    energyWord: "energy",
    playWord: "Play",
    reclaimNeededWord: "Reclaim needed",
    noCardsInHand: "No cards in hand. Draw a new hand.",
    cardReadyStatus: "Ready",
    cardNeedEnergyStatus: "Need more energy",
    cardNeedActionStatus: "No action available",
    cardNeedGrowthStatus: "Choose growth first",
    cardNeedTargetingStatus: "Finish current targeting effect first",
    cardUsedStatus: "Used until reclaimed",
    noActionPoints: "No actions available.",
    growthFirstRequired: "Choose a growth option first.",
    growthAlreadyChosen: "Growth already chosen for this turn.",
    growthPicked: "Growth chosen for turn {turn}: {option}.",
    reclaimApplied: "Growth: cards reclaimed, +1 energy, 1 power card marked.",
    endTurnLog: "Turn {turn} ended. Turn {nextTurn} begins.",
    invaderTrackTitle: "Invader Phases",
    ravageLabel: "Ravage:",
    buildLabel: "Build:",
    discoverLabel: "Discover:",
    invaderNone: "-",
    invaderLandNames: {
      mountains: "Mountains",
      desert: "Desert",
      jungle: "Jungle",
      wetlands: "Wetlands"
    },
    invaderPhaseLog: "Invader phases - Ravage: {ravage}, Build: {build}, Discover: {discover}.",
    dahanRoundLog: "Dahan gather: {summary}.",
    invaderHpHint: "{unit} HP: {current}/{max}",
    fearConsequence: "Fear Tier {tier}. {fearNeeded} fear until the next terror shift.",
    cardNames: {
      boon_of_vigor: "Boon of Vigor",
      flash_floods: "Flash Floods",
      rivers_bounty: "River's Bounty",
      wash_away: "Wash Away"
    },
    langToggle: "Deutsch"
  }
};

const GROWTH_OPTIONS = {
  reclaim_and_power: "growthOptionReclaim",
  double_presence: "growthOptionDoublePresence",
  power_and_presence: "growthOptionPowerAndPresence"
};

const INVADER_LANDS = ["mountains", "desert", "jungle", "wetlands"];
const DAHAN_PER_ROUND = 3;
const DAHAN_MAX_ADD_PER_AREA = 2;
const DEFEAT_FX_MS = 1200;
const UNIT_STATS = {
  explorers: { health: 1, damage: 1 },
  towns: { health: 2, damage: 2 },
  cities: { health: 3, damage: 3 },
  dahan: { health: 2, damage: 2 }
};

function currentLang(state) {
  return state.ui && state.ui.language === "en" ? "en" : "de";
}

function locale(state) {
  return I18N[currentLang(state)];
}

function template(text, vars) {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

const CARD_LIBRARY = {
  boon_of_vigor: {
    id: "boon_of_vigor",
    name: "Boon of Vigor",
    cost: 0,
    speed: "fast",
    target: "Any Spirit",
    elements: ["Sun", "Water", "Plant"],
    text: "Gain 1 Energy per Power Card played this turn.",
    play: (state) => {
      const playedThisTurn = Math.max(0, Math.floor(state.turn.powerCardsPlayed || 0));
      state.resources.energy += playedThisTurn;
      addLog(
        state,
        currentLang(state) === "en"
          ? `Boon of Vigor grants ${playedThisTurn} energy.`
          : `Boon of Vigor verleiht ${playedThisTurn} Energie.`
      );
    }
  },
  flash_floods: {
    id: "flash_floods",
    name: "Flash Floods",
    cost: 2,
    speed: "fast",
    range: "Presence 1",
    target: "Any",
    elements: ["Sun", "Water"],
    text: "1 Damage. If target land is Wetlands, +1 Damage.",
    play: (state) => {
      startFlashFloods(state);
    }
  },
  rivers_bounty: {
    id: "rivers_bounty",
    name: "River's Bounty",
    cost: 0,
    speed: "slow",
    range: "Presence 0",
    target: "Any",
    elements: ["Sun", "Water", "Animal"],
    text: "Gather up to 2 Dahan. If there are now at least 2 Dahan, add 1 Dahan and gain 1 Energy.",
    play: (state) => {
      startRiversBounty(state);
    }
  },
  wash_away: {
    id: "wash_away",
    name: "Wash Away",
    cost: 1,
    speed: "slow",
    range: "Presence 1",
    target: "Any",
    elements: ["Water", "Earth"],
    text: "Push up to 3 Explorer/Town.",
    play: (state) => {
      startWashAway(state);
    }
  }
};

function nowMs() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createStarterDeckIds() {
  return shuffle(["boon_of_vigor", "flash_floods", "rivers_bounty", "wash_away"]);
}

function buildFreshCardState() {
  const pile = createStarterDeckIds();
  const hand = pile.splice(0, 4);
  return {
    drawPile: pile,
    discardPile: [],
    hand,
    maxHandSize: 4
  };
}

function drawInvaderLand() {
  const idx = Math.floor(Math.random() * INVADER_LANDS.length);
  return INVADER_LANDS[idx];
}

function drawInvaderLandExcluding(excludedLands) {
  const excluded = new Set((excludedLands || []).filter((land) => INVADER_LANDS.includes(land)));
  const choices = INVADER_LANDS.filter((land) => !excluded.has(land));
  if (choices.length === 0) return drawInvaderLand();
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}

function normalizeInvaderPhases(invader) {
  const ravage = INVADER_LANDS.includes(invader?.ravage) ? invader.ravage : null;
  const build = INVADER_LANDS.includes(invader?.build) ? invader.build : null;
  const exploreRaw = INVADER_LANDS.includes(invader?.explore) ? invader.explore : null;

  let explore = exploreRaw;
  if (!explore || explore === build || explore === ravage) {
    explore = drawInvaderLandExcluding([ravage, build]);
  }

  return { ravage, build, explore };
}

function createInvaderCounts() {
  const out = {};
  for (const land of INVADER_LANDS) {
    out[land] = {
      explorers: 0,
      towns: 0,
      cities: 0
    };
  }
  return out;
}

function normalizeInvaderCounts(invaders) {
  const base = createInvaderCounts();
  const merged = { ...base, ...(invaders || {}) };
  const out = {};

  for (const land of INVADER_LANDS) {
    const slot = merged[land] || {};
    out[land] = {
      explorers: Math.max(0, Math.floor(slot.explorers || 0)),
      towns: Math.max(0, Math.floor(slot.towns || 0)),
      cities: Math.max(0, Math.floor(slot.cities || 0))
    };
  }

  return out;
}

function createInvaderDamage() {
  const out = {};
  for (const land of INVADER_LANDS) {
    out[land] = {
      explorers: 0,
      towns: 0,
      cities: 0
    };
  }
  return out;
}

function normalizeInvaderDamage(invaderDamage) {
  const base = createInvaderDamage();
  const merged = { ...base, ...(invaderDamage || {}) };
  const out = {};

  for (const land of INVADER_LANDS) {
    const slot = merged[land] || {};
    out[land] = {
      explorers: Math.max(0, Math.floor(slot.explorers || 0)),
      towns: Math.max(0, Math.floor(slot.towns || 0)),
      cities: Math.max(0, Math.floor(slot.cities || 0))
    };
  }

  return out;
}

function clampInvaderDamageByCounts(invaders, invaderDamage) {
  const out = normalizeInvaderDamage(invaderDamage);
  const counts = normalizeInvaderCounts(invaders);

  for (const land of INVADER_LANDS) {
    for (const type of ["explorers", "towns", "cities"]) {
      const health = UNIT_STATS[type].health;
      if ((counts[land][type] || 0) <= 0 || health <= 1) {
        out[land][type] = 0;
      } else {
        out[land][type] = clamp(out[land][type], 0, health - 1);
      }
    }
  }

  return out;
}

function applyDamageToInvaderType(state, land, type, damage) {
  if (!INVADER_LANDS.includes(land)) return { defeated: 0, remainingHp: 0, maxHp: 0 };
  if (!["explorers", "towns", "cities"].includes(type)) return { defeated: 0, remainingHp: 0, maxHp: 0 };

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = clampInvaderDamageByCounts(state.invaders, state.invaderDamage);

  const slot = state.invaders[land];
  const damageSlot = state.invaderDamage[land];
  const unitCount = Math.max(0, slot[type] || 0);
  const maxHp = UNIT_STATS[type].health;
  if (unitCount <= 0 || maxHp <= 0) {
    return { defeated: 0, remainingHp: 0, maxHp };
  }

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

  const remainingHp = slot[type] > 0
    ? maxHp - damageSlot[type]
    : 0;

  return { defeated, remainingHp, maxHp };
}

function createDahanCounts() {
  const out = {};
  for (const land of INVADER_LANDS) {
    out[land] = 0;
  }
  return out;
}

function normalizeDahanCounts(dahan) {
  const base = createDahanCounts();
  const merged = { ...base, ...(dahan || {}) };
  const out = {};

  for (const land of INVADER_LANDS) {
    out[land] = Math.max(0, Math.floor(merged[land] || 0));
  }

  return out;
}

function normalizeWashAwayState(washAway) {
  if (!washAway || typeof washAway !== "object") return null;
  const validSteps = new Set(["choose-source", "choose-units", "choose-destination"]);
  if (!validSteps.has(washAway.step)) return null;

  const source = INVADER_LANDS.includes(washAway.source) ? washAway.source : null;
  const explorers = Math.max(0, Math.floor(washAway.explorers || 0));
  const towns = Math.max(0, Math.floor(washAway.towns || 0));

  return {
    step: washAway.step,
    source,
    explorers,
    towns
  };
}

function normalizeFlashFloodsState(flashFloods) {
  if (!flashFloods || typeof flashFloods !== "object") return null;
  const validSteps = new Set(["choose-land", "choose-target", "choose-bonus-target"]);
  if (!validSteps.has(flashFloods.step)) return null;
  const land = INVADER_LANDS.includes(flashFloods.land) ? flashFloods.land : null;
  const primaryTarget = ["explorers", "towns", "cities"].includes(flashFloods.primaryTarget)
    ? flashFloods.primaryTarget
    : null;
  const bonusDamage = Math.max(0, Math.floor(flashFloods.bonusDamage || 0));
  return {
    step: flashFloods.step,
    land,
    primaryTarget,
    bonusDamage
  };
}

function normalizeRiversBountyState(riversBounty) {
  if (!riversBounty || typeof riversBounty !== "object") return null;
  const validSteps = new Set(["choose-destination", "choose-sources"]);
  if (!validSteps.has(riversBounty.step)) return null;

  const destination = INVADER_LANDS.includes(riversBounty.destination) ? riversBounty.destination : null;
  const moved = clamp(Math.floor(riversBounty.moved || 0), 0, 2);
  const pulledFrom = normalizeDahanCounts(riversBounty.pulledFrom);

  return {
    step: riversBounty.step,
    destination,
    moved,
    pulledFrom
  };
}

function normalizeDefeatFx(defeatFx) {
  if (!defeatFx || typeof defeatFx !== "object") return null;
  const land = INVADER_LANDS.includes(defeatFx.land) ? defeatFx.land : null;
  const unitType = ["explorers", "towns", "cities", "dahan"].includes(defeatFx.unitType) ? defeatFx.unitType : null;
  const count = Math.max(0, Math.floor(defeatFx.count || 0));
  const at = Number(defeatFx.at);
  if (!land || !unitType || count <= 0 || !Number.isFinite(at)) return null;
  return { land, unitType, count, at };
}

function activeDefeatFx(state) {
  const fx = normalizeDefeatFx(state.ui && state.ui.defeatFx);
  if (!fx) return null;
  if ((nowMs() - fx.at) > DEFEAT_FX_MS) return null;
  return fx;
}

function pruneDefeatFx(state) {
  const fx = normalizeDefeatFx(state.ui && state.ui.defeatFx);
  if (!fx) {
    state.ui.defeatFx = null;
    return;
  }
  if ((nowMs() - fx.at) > DEFEAT_FX_MS) {
    state.ui.defeatFx = null;
  }
}

function markDefeatFx(state, land, unitType, count) {
  const c = Math.max(0, Math.floor(count || 0));
  if (!INVADER_LANDS.includes(land) || c <= 0) return;
  state.ui.defeatFx = {
    land,
    unitType,
    count: c,
    at: nowMs()
  };
}

function unitLabelByType(state, unitType) {
  const t = locale(state);
  if (unitType === "explorers") return t.explorersLabel;
  if (unitType === "towns") return t.townsLabel;
  if (unitType === "cities") return t.citiesLabel;
  if (unitType === "dahan") return t.dahanLabel;
  return unitType;
}

function invaderCountInLand(slot) {
  if (!slot) return 0;
  return Math.max(0, slot.explorers || 0) + Math.max(0, slot.towns || 0) + Math.max(0, slot.cities || 0);
}

function currentPendingEffectMessage(state) {
  const t = locale(state);
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (washAway) return t.finishWashAwayFirst;
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  if (flashFloods) return t.finishFlashFloodsFirst;
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (riversBounty) return t.finishRiversBountyFirst;
  return "";
}

function hasPendingTargetingEffect(state) {
  return currentPendingEffectMessage(state) !== "";
}

function createInitialState() {
  return {
    schemaVersion: VERSION,
    time: {
      totalSeconds: 0,
      lastTickUnixMs: nowMs(),
      lastSaveUnixMs: nowMs()
    },
    resources: {
      energy: CONSTS.STARTING_ENERGY,
      fear: 0
    },
    rates: {
      energyPerSecond: 0,
      fearPerSecond: 0
    },
    spirit: {
      activeSpiritId: "core_spirit_01",
      unlockedSpiritIds: ["core_spirit_01"],
      growthLevel: 0
    },
    actions: {
      charges: 1,
      maxCharges: CONSTS.ACTION_MAX_CHARGES,
      nextChargeInSeconds: CONSTS.ACTION_INTERVAL_SECONDS,
      intervalSeconds: CONSTS.ACTION_INTERVAL_SECONDS
    },
    ui: {
      language: "de",
      defeatFx: null
    },
    turn: {
      number: 1,
      selectedGrowthOption: "",
      powerCardsGained: 0,
      presencesPlaced: 0,
      powerCardsPlayed: 0
    },
    invader: normalizeInvaderPhases({
      ravage: null,
      build: null,
      explore: drawInvaderLand()
    }),
    invaders: createInvaderCounts(),
    invaderDamage: createInvaderDamage(),
    dahan: createDahanCounts(),
    effects: {
      washAway: null,
      flashFloods: null,
      riversBounty: null
    },
    progression: {
      totalEnergySpent: 0,
      totalFearGenerated: 0
    },
    cards: buildFreshCardState(),
    milestones: {
      unlockedCount: 0,
      lastNotice: ""
    }
  };
}

function createFreshGameState() {
  const state = createInitialState();
  addRoundStartDahan(state);
  return state;
}

function normalizeState(state) {
  const base = createInitialState();
  const merged = {
    ...base,
    ...state,
    time: { ...base.time, ...(state.time || {}) },
    resources: { ...base.resources, ...(state.resources || {}) },
    rates: { ...base.rates, ...(state.rates || {}) },
    spirit: { ...base.spirit, ...(state.spirit || {}) },
    actions: { ...base.actions, ...(state.actions || {}) },
    ui: { ...base.ui, ...(state.ui || {}) },
    turn: { ...base.turn, ...(state.turn || {}) },
    invader: { ...base.invader, ...(state.invader || {}) },
    invaders: { ...base.invaders, ...(state.invaders || {}) },
    invaderDamage: { ...base.invaderDamage, ...(state.invaderDamage || {}) },
    dahan: { ...base.dahan, ...(state.dahan || {}) },
    effects: { ...base.effects, ...(state.effects || {}) },
    progression: { ...base.progression, ...(state.progression || {}) },
    cards: { ...base.cards, ...(state.cards || {}) },
    milestones: { ...base.milestones, ...(state.milestones || {}) }
  };

  if (!Array.isArray(merged.spirit.unlockedSpiritIds) || merged.spirit.unlockedSpiritIds.length === 0) {
    merged.spirit.unlockedSpiritIds = ["core_spirit_01"];
  }

  // Step-2 migration: enforce one-spirit mode even for older saves.
  merged.spirit.unlockedSpiritIds = ["core_spirit_01"];
  merged.spirit.activeSpiritId = "core_spirit_01";
  merged.milestones.lastNotice = "";
  merged.ui.language = merged.ui.language === "en" ? "en" : "de";
  merged.ui.defeatFx = normalizeDefeatFx(merged.ui.defeatFx);

  merged.actions.maxCharges = CONSTS.ACTION_MAX_CHARGES;
  merged.actions.intervalSeconds = CONSTS.ACTION_INTERVAL_SECONDS;
  merged.actions.charges = clamp(Math.floor(merged.actions.charges || 0), 0, merged.actions.maxCharges);
  if (typeof merged.actions.nextChargeInSeconds !== "number") {
    merged.actions.nextChargeInSeconds = merged.actions.intervalSeconds;
  }

  if (!SPIRITS[merged.spirit.activeSpiritId]) {
    merged.spirit.activeSpiritId = "core_spirit_01";
  }

  if (!Array.isArray(merged.cards.drawPile)) merged.cards.drawPile = [];
  if (!Array.isArray(merged.cards.discardPile)) merged.cards.discardPile = [];
  if (!Array.isArray(merged.cards.hand)) merged.cards.hand = [];
  if (!merged.cards.maxHandSize) merged.cards.maxHandSize = 4;

  const validCardIds = new Set(Object.keys(CARD_LIBRARY));
  merged.cards.drawPile = merged.cards.drawPile.filter((id) => validCardIds.has(id));
  merged.cards.discardPile = merged.cards.discardPile.filter((id) => validCardIds.has(id));
  merged.cards.hand = merged.cards.hand.filter((id) => validCardIds.has(id));
  merged.cards.maxHandSize = 4;

  if (merged.cards.drawPile.length > 0) {
    merged.cards.discardPile = [...merged.cards.discardPile, ...merged.cards.drawPile];
    merged.cards.drawPile = [];
  }

  const knownCardCount = merged.cards.drawPile.length + merged.cards.discardPile.length + merged.cards.hand.length;
  if (knownCardCount < 4) {
    merged.cards = buildFreshCardState();
  }

  if (!Array.isArray(merged._log)) {
    merged._log = [];
  }

  merged.turn.number = Math.max(1, Math.floor(merged.turn.number || 1));
  merged.turn.selectedGrowthOption = typeof merged.turn.selectedGrowthOption === "string" ? merged.turn.selectedGrowthOption : "";
  merged.turn.powerCardsGained = Math.max(0, Math.floor(merged.turn.powerCardsGained || 0));
  merged.turn.presencesPlaced = Math.max(0, Math.floor(merged.turn.presencesPlaced || 0));
  merged.turn.powerCardsPlayed = Math.max(0, Math.floor(merged.turn.powerCardsPlayed || 0));

  merged.invader = normalizeInvaderPhases(merged.invader);
  merged.invaders = normalizeInvaderCounts(merged.invaders);
  merged.invaderDamage = clampInvaderDamageByCounts(merged.invaders, merged.invaderDamage);
  merged.dahan = normalizeDahanCounts(merged.dahan);
  merged.effects.washAway = normalizeWashAwayState(merged.effects.washAway);
  merged.effects.flashFloods = normalizeFlashFloodsState(merged.effects.flashFloods);
  merged.effects.riversBounty = normalizeRiversBountyState(merged.effects.riversBounty);

  merged.schemaVersion = VERSION;
  return merged;
}

function activeSpirit(state) {
  return SPIRITS[state.spirit.activeSpiritId] || SPIRITS.core_spirit_01;
}

function derivedValues(state) {
  const spirit = activeSpirit(state);

  const energyPerSecond = 0;
  const fearPerSecond = 0;

  return {
    energyPerSecond,
    fearPerSecond,
    pushPowerMult: spirit.pushPowerMult,
    strikePowerMult: spirit.strikePowerMult
  };
}

function addLog(state, text) {
  if (!state._log) state._log = [];
  state._log.unshift(`${new Date().toLocaleTimeString()} - ${text}`);
  state._log = state._log.slice(0, 20);
}

function invaderLandName(state, landKey) {
  const t = locale(state);
  if (!landKey) return t.invaderNone;
  return t.invaderLandNames[landKey] || landKey;
}

function advanceInvaderPhases(state) {
  state.invader = normalizeInvaderPhases(state.invader);
  state.invaders = normalizeInvaderCounts(state.invaders);

  const shiftedToRavage = state.invader.build;
  const shiftedToBuild = state.invader.explore;
  const nextDiscover = drawInvaderLandExcluding([shiftedToRavage, shiftedToBuild]);

  state.invader.ravage = shiftedToRavage;
  state.invader.build = shiftedToBuild;
  state.invader.explore = nextDiscover;

  if (state.invader.explore) {
    state.invaders[state.invader.explore].explorers += 1;
  }

  if (state.invader.build) {
    const slot = state.invaders[state.invader.build];
    const total = slot.explorers + slot.towns + slot.cities;
    if (total > 0) {
      if (slot.towns > slot.cities) {
        slot.cities += 1;
      } else {
        slot.towns += 1;
      }
    }
  }

  const t = locale(state);
  addLog(
    state,
    template(t.invaderPhaseLog, {
      ravage: invaderLandName(state, state.invader.ravage),
      build: invaderLandName(state, state.invader.build),
      discover: invaderLandName(state, state.invader.explore)
    })
  );
}

function addRoundStartDahan(state) {
  state.dahan = normalizeDahanCounts(state.dahan);

  const added = createDahanCounts();
  let remaining = DAHAN_PER_ROUND;

  while (remaining > 0) {
    const eligible = INVADER_LANDS.filter((land) => added[land] < DAHAN_MAX_ADD_PER_AREA);
    if (eligible.length === 0) break;
    const land = eligible[Math.floor(Math.random() * eligible.length)];
    added[land] += 1;
    state.dahan[land] += 1;
    remaining -= 1;
  }

  const summary = INVADER_LANDS
    .filter((land) => added[land] > 0)
    .map((land) => `${invaderLandName(state, land)} +${added[land]}`)
    .join(", ");

  if (summary) {
    addLog(state, template(locale(state).dahanRoundLog, { summary }));
  }
}

function startRiversBounty(state) {
  state.dahan = normalizeDahanCounts(state.dahan);
  const totalDahan = INVADER_LANDS.reduce((sum, land) => sum + (state.dahan[land] || 0), 0);
  if (totalDahan <= 0) {
    addLog(state, locale(state).riversBountyNoTargets);
    state.effects.riversBounty = null;
    return;
  }

  state.effects.riversBounty = {
    step: "choose-destination",
    destination: null,
    moved: 0,
    pulledFrom: createDahanCounts()
  };
}

function chooseRiversBountyDestination(state, destination) {
  if (!INVADER_LANDS.includes(destination)) return;
  const riversBounty = normalizeRiversBountyState(state.effects.riversBounty);
  if (!riversBounty || riversBounty.step !== "choose-destination") return;

  riversBounty.step = "choose-sources";
  riversBounty.destination = destination;
  riversBounty.moved = 0;
  riversBounty.pulledFrom = createDahanCounts();
  state.effects.riversBounty = riversBounty;
}

function gatherRiversBountyFrom(state, source) {
  if (!INVADER_LANDS.includes(source)) return;
  const riversBounty = normalizeRiversBountyState(state.effects.riversBounty);
  if (!riversBounty || riversBounty.step !== "choose-sources" || !riversBounty.destination) return;
  if (source === riversBounty.destination) return;
  if (riversBounty.moved >= 2) return;

  state.dahan = normalizeDahanCounts(state.dahan);
  if ((state.dahan[source] || 0) <= 0) return;

  state.dahan[source] -= 1;
  state.dahan[riversBounty.destination] += 1;
  riversBounty.moved += 1;
  riversBounty.pulledFrom[source] += 1;
  state.effects.riversBounty = riversBounty;

  // Auto-resolve once the max gather amount is reached.
  if (riversBounty.moved >= 2) {
    finishRiversBounty(state);
  }
}

function finishRiversBounty(state) {
  const riversBounty = normalizeRiversBountyState(state.effects.riversBounty);
  if (!riversBounty || riversBounty.step !== "choose-sources" || !riversBounty.destination) return;

  const t = locale(state);
  const destination = riversBounty.destination;
  addLog(
    state,
    template(t.riversBountyResolved, {
      moved: riversBounty.moved,
      to: invaderLandName(state, destination)
    })
  );

  if ((state.dahan[destination] || 0) >= 2) {
    state.dahan[destination] += 1;
    state.resources.energy += 1;
    addLog(
      state,
      template(t.riversBountyBonus, { to: invaderLandName(state, destination) })
    );
  }

  state.effects.riversBounty = null;
}

function startFlashFloods(state) {
  state.invaders = normalizeInvaderCounts(state.invaders);
  const anyTarget = INVADER_LANDS.some((land) => invaderCountInLand(state.invaders[land]) > 0);
  if (!anyTarget) {
    addLog(state, locale(state).flashFloodsNoTargets);
    state.effects.flashFloods = null;
    return;
  }

  state.effects.flashFloods = {
    step: "choose-land",
    land: null
  };
}

function chooseFlashFloodsLand(state, land) {
  if (!INVADER_LANDS.includes(land)) return;
  const flashFloods = normalizeFlashFloodsState(state.effects.flashFloods);
  if (!flashFloods || flashFloods.step !== "choose-land") return;
  if (invaderCountInLand(state.invaders[land]) <= 0) return;

  flashFloods.step = "choose-target";
  flashFloods.land = land;
  state.effects.flashFloods = flashFloods;
}

function resolveFlashFloodsTarget(state, targetType) {
  if (!UNIT_STATS[targetType] || targetType === "dahan") return;

  const flashFloods = normalizeFlashFloodsState(state.effects.flashFloods);
  if (!flashFloods || flashFloods.step !== "choose-target" || !flashFloods.land) return;

  const land = flashFloods.land;
  const slot = state.invaders[land];
  if (!slot) return;
  if ((slot[targetType] || 0) <= 0) return;

  const damage = 1;
  const remainingAfterHit = land === "wetlands" ? 1 : 0;
  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = clampInvaderDamageByCounts(state.invaders, state.invaderDamage);

  const hp = UNIT_STATS[targetType].health;
  const carry = hp > 1
    ? clamp(state.invaderDamage[land][targetType] || 0, 0, hp - 1)
    : 0;
  const maxIncomingHere = Math.max(0, (state.invaders[land][targetType] * hp) - carry);
  const incomingHere = Math.min(damage, maxIncomingHere);

  const outcome = applyDamageToInvaderType(state, land, targetType, incomingHere);
  const defeated = outcome.defeated;
  const remainingDamage = Math.max(0, remainingAfterHit);

  if (defeated > 0) {
    markDefeatFx(state, land, targetType, defeated);
  }

  const t = locale(state);
  const targetLabel = targetType === "explorers"
    ? t.explorersLabel
    : targetType === "towns"
      ? t.townsLabel
      : t.citiesLabel;

  addLog(
    state,
    template(t.flashFloodsResolved, {
      target: targetLabel,
      land: invaderLandName(state, land),
      damage: incomingHere,
      defeated
    })
  );

  const bonusTargets = ["explorers", "towns", "cities"].filter((type) => (state.invaders[land][type] || 0) > 0);
  if (remainingDamage > 0 && bonusTargets.length > 0) {
    state.effects.flashFloods = {
      step: "choose-bonus-target",
      land,
      primaryTarget: targetType,
      bonusDamage: remainingDamage
    };
    return;
  }

  state.effects.flashFloods = null;
}

function resolveFlashFloodsBonusTarget(state, targetType) {
  if (!UNIT_STATS[targetType] || targetType === "dahan") return;

  const flashFloods = normalizeFlashFloodsState(state.effects.flashFloods);
  if (!flashFloods || flashFloods.step !== "choose-bonus-target" || !flashFloods.land) return;

  const land = flashFloods.land;
  const slot = state.invaders[land];
  if (!slot) return;
  if ((slot[targetType] || 0) <= 0) return;

  const damage = Math.max(0, Math.floor(flashFloods.bonusDamage || 0));
  if (damage <= 0) {
    state.effects.flashFloods = null;
    return;
  }

  const outcome = applyDamageToInvaderType(state, land, targetType, damage);
  const defeated = outcome.defeated;

  if (defeated > 0) {
    markDefeatFx(state, land, targetType, defeated);
  }

  const t = locale(state);
  const targetLabel = targetType === "explorers"
    ? t.explorersLabel
    : targetType === "towns"
      ? t.townsLabel
      : t.citiesLabel;

  addLog(
    state,
    template(t.flashFloodsResolved, {
      target: targetLabel,
      land: invaderLandName(state, land),
      damage,
      defeated
    })
  );

  state.effects.flashFloods = null;
}

function pushableCount(slot) {
  if (!slot) return 0;
  return Math.max(0, slot.explorers || 0) + Math.max(0, slot.towns || 0);
}

function startWashAway(state) {
  state.invaders = normalizeInvaderCounts(state.invaders);
  const anyPushable = INVADER_LANDS.some((land) => pushableCount(state.invaders[land]) > 0);
  if (!anyPushable) {
    addLog(state, locale(state).washAwayNoTargets);
    state.effects.washAway = null;
    return;
  }

  state.effects.washAway = {
    step: "choose-source",
    source: null,
    explorers: 0,
    towns: 0
  };
}

function chooseWashAwaySource(state, source) {
  if (!INVADER_LANDS.includes(source)) return;
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-source") return;
  const slot = state.invaders[source];
  if (!slot || pushableCount(slot) <= 0) return;

  washAway.step = "choose-units";
  washAway.source = source;
  washAway.explorers = 0;
  washAway.towns = 0;
  state.effects.washAway = washAway;
}

function adjustWashAwayUnits(state, unitType, delta) {
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-units" || !washAway.source) return;

  const slot = state.invaders[washAway.source];
  if (!slot) return;

  const d = Number(delta);
  if (![-1, 1].includes(d)) return;

  let nextExplorers = washAway.explorers;
  let nextTowns = washAway.towns;
  if (unitType === "explorers") {
    nextExplorers += d;
  } else if (unitType === "towns") {
    nextTowns += d;
  } else {
    return;
  }

  if (nextExplorers < 0 || nextTowns < 0) return;
  if (nextExplorers > slot.explorers || nextTowns > slot.towns) return;
  if ((nextExplorers + nextTowns) > 3) return;

  washAway.explorers = nextExplorers;
  washAway.towns = nextTowns;
  state.effects.washAway = washAway;
}

function confirmWashAwayUnits(state) {
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-units" || !washAway.source) return;

  const total = washAway.explorers + washAway.towns;
  if (total <= 0) return;

  washAway.step = "choose-destination";
  state.effects.washAway = washAway;
}

function chooseWashAwayDestination(state, destination) {
  if (!INVADER_LANDS.includes(destination)) return;
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-destination" || !washAway.source) return;
  if (destination === washAway.source) return;

  const from = state.invaders[washAway.source];
  const to = state.invaders[destination];
  if (!from || !to) return;
  if (washAway.explorers > from.explorers || washAway.towns > from.towns) return;

  from.explorers -= washAway.explorers;
  from.towns -= washAway.towns;
  to.explorers += washAway.explorers;
  to.towns += washAway.towns;

  const t = locale(state);
  addLog(
    state,
    template(t.washAwayResolved, {
      total: washAway.explorers + washAway.towns,
      from: invaderLandName(state, washAway.source),
      to: invaderLandName(state, destination),
      explorers: washAway.explorers,
      towns: washAway.towns
    })
  );

  state.effects.washAway = null;
}

function unlockSpirits(state) {
  // Schritt 1: Nur ein Geist aktiv. Weitere Geister folgen in spaeteren Mechanik-Schritten.
}

function ensureDrawPile(state) {
  if (state.cards.drawPile.length > 0) return;
  if (state.cards.discardPile.length === 0) return;
  state.cards.drawPile = shuffle(state.cards.discardPile);
  state.cards.discardPile = [];
  addLog(state, "Alte Omen kehren als Echo zurueck und formen den Nachziehstapel neu.");
}

function drawCards(state, count) {
  for (let i = 0; i < count; i += 1) {
    ensureDrawPile(state);
    if (state.cards.drawPile.length === 0) return;
    const cardId = state.cards.drawPile.shift();
    state.cards.hand.push(cardId);
  }
}

function advanceActionRecharge(state, dt) {
  if (state.actions.charges >= state.actions.maxCharges) {
    state.actions.nextChargeInSeconds = state.actions.intervalSeconds;
    return;
  }

  state.actions.nextChargeInSeconds -= dt;
  while (state.actions.nextChargeInSeconds <= 0 && state.actions.charges < state.actions.maxCharges) {
    state.actions.charges += 1;
    state.actions.nextChargeInSeconds += state.actions.intervalSeconds;
  }
}

function spendAction(state) {
  if (state.actions.charges <= 0) return false;
  state.actions.charges -= 1;
  if (state.actions.charges >= state.actions.maxCharges) {
    state.actions.nextChargeInSeconds = state.actions.intervalSeconds;
  }
  return true;
}

function gainFearFromDefeat(state, unitType, defeatedCount) {
  const defeated = Math.max(0, Math.floor(defeatedCount || 0));
  if (defeated <= 0) return;

  let fearPerUnit = 0;
  if (unitType === "towns") fearPerUnit = 1;
  if (unitType === "cities") fearPerUnit = 2;

  const fearGain = defeated * fearPerUnit;
  if (fearGain <= 0) return;

  state.resources.fear += fearGain;
  state.progression.totalFearGenerated += fearGain;
}

function spendEnergy(state, amount) {
  if (state.resources.energy < amount) return false;
  state.resources.energy -= amount;
  state.progression.totalEnergySpent += amount;
  return true;
}

function playCardAtIndex(state, handIndex) {
  const t = locale(state);
  const pendingMessage = currentPendingEffectMessage(state);
  if (pendingMessage) {
    addLog(state, pendingMessage);
    return;
  }
  if (!state.turn.selectedGrowthOption) {
    addLog(state, t.growthFirstRequired);
    return;
  }

  const cardId = state.cards.hand[handIndex];
  const card = CARD_LIBRARY[cardId];
  if (!card) return;

  if (!spendEnergy(state, card.cost)) {
    const name = cardDisplayName(state, card);
    addLog(state, currentLang(state) === "en" ? `The rite ${name} remains dormant. More energy is required.` : `Das Ritual ${name} ruht weiter. Mehr Energie wird benoetigt.`);
    return;
  }

  state.cards.hand.splice(handIndex, 1);
  // Track successful card plays this turn so effects can scale from total power cards played.
  state.turn.powerCardsPlayed = Math.max(0, Math.floor(state.turn.powerCardsPlayed || 0)) + 1;
  card.play(state);
  state.cards.discardPile.push(cardId);
}

function tick(state, dt) {
  const dv = derivedValues(state);
  state.rates.energyPerSecond = dv.energyPerSecond;
  state.rates.fearPerSecond = dv.fearPerSecond;
  state.time.totalSeconds += dt;

  unlockSpirits(state);
  pruneDefeatFx(state);

  state.resources.energy = Math.max(0, state.resources.energy);
  state.resources.fear = Math.max(0, state.resources.fear);
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createFreshGameState();
    const parsed = JSON.parse(raw);
    const state = normalizeState(parsed);

    const elapsedMs = Math.max(0, nowMs() - (state.time.lastTickUnixMs || nowMs()));
    const offlineSeconds = Math.min(elapsedMs / 1000, CONSTS.MAX_OFFLINE_HOURS * 3600);
    if (offlineSeconds > 1) {
      state.time.totalSeconds += offlineSeconds;
      addLog(
        state,
        currentLang(state) === "en"
          ? `Offline return: ${Math.floor(offlineSeconds / 60)}m of progress applied.`
          : `Offline-Rueckkehr: ${Math.floor(offlineSeconds / 60)}m Fortschritt wurde angewendet.`
      );
      unlockSpirits(state);
    }

    state.time.lastTickUnixMs = nowMs();
    state.time.lastSaveUnixMs = nowMs();
    return state;
  } catch (_) {
    return createFreshGameState();
  }
}

function saveState(state) {
  state.time.lastSaveUnixMs = nowMs();
  state.time.lastTickUnixMs = nowMs();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

const dom = {
  topSubtitle: document.getElementById("topSubtitle"),
  languageToggleBtn: document.getElementById("languageToggleBtn"),
  metricsTitle: document.getElementById("metricsTitle"),
  energyLabel: document.getElementById("energyLabel"),
  fearLabel: document.getElementById("fearLabel"),
  cardsTitle: document.getElementById("cardsTitle"),
  discardLabel: document.getElementById("discardLabel"),
  handLabel: document.getElementById("handLabel"),
  noFailHint: document.getElementById("noFailHint"),
  mapTitle: document.getElementById("mapTitle"),
  mapPlanHint: document.getElementById("mapPlanHint"),
  mapGrid: document.getElementById("mapGrid"),
  invaderTrackTitle: document.getElementById("invaderTrackTitle"),
  ravageLabel: document.getElementById("ravageLabel"),
  buildLabel: document.getElementById("buildLabel"),
  discoverLabel: document.getElementById("discoverLabel"),
  ravageArea: document.getElementById("ravageArea"),
  buildArea: document.getElementById("buildArea"),
  discoverArea: document.getElementById("discoverArea"),
  spiritTitle: document.getElementById("spiritTitle"),
  activeSpiritLabel: document.getElementById("activeSpiritLabel"),
  spiritPhaseHint: document.getElementById("spiritPhaseHint"),
  turnTitle: document.getElementById("turnTitle"),
  turnInfo: document.getElementById("turnInfo"),
  turnLabel: document.getElementById("turnLabel"),
  growthChosenLabel: document.getElementById("growthChosenLabel"),
  turnNumber: document.getElementById("turnNumber"),
  growthChosenValue: document.getElementById("growthChosenValue"),
  growthOptions: document.getElementById("growthOptions"),
  endTurnBtn: document.getElementById("endTurnBtn"),
  progressionTitle: document.getElementById("progressionTitle"),
  logTitle: document.getElementById("logTitle"),
  autosaveHint: document.getElementById("autosaveHint"),
  energyValue: document.getElementById("energyValue"),
  fearValue: document.getElementById("fearValue"),
  energyRate: document.getElementById("energyRate"),
  fearRate: document.getElementById("fearRate"),
  runTime: document.getElementById("runTime"),
  activeSpiritName: document.getElementById("activeSpiritName"),
  growthLevel: document.getElementById("growthLevel"),
  spiritsUnlocked: document.getElementById("spiritsUnlocked"),
  milestoneNotice: document.getElementById("milestoneNotice"),
  eventLog: document.getElementById("eventLog"),
  spiritFixedName: document.getElementById("spiritFixedName"),
  spiritTraits: document.getElementById("spiritTraits"),
  manualSaveBtn: document.getElementById("manualSaveBtn"),
  wipeSaveBtn: document.getElementById("wipeSaveBtn"),
  discardCount: document.getElementById("discardCount"),
  handCount: document.getElementById("handCount"),
  handCards: document.getElementById("handCards"),
  playHint: document.getElementById("playHint")
};

const uiRenderCache = {
  growthOptionsSignature: "",
  handSignature: "",
  mapSignature: ""
};

function fmt(n) {
  return String(Math.round(Number(n) || 0));
}

function spiritDisplayName(state) {
  const spirit = activeSpirit(state);
  return currentLang(state) === "en" ? spirit.englishName : spirit.name;
}

function spiritTraitText(state) {
  const spirit = activeSpirit(state);
  return currentLang(state) === "en" ? spirit.traitsEn : spirit.traits;
}

function cardDisplayName(state, card) {
  const t = locale(state);
  return t.cardNames[card.id] || card.name;
}

function applyStaticLanguage(state) {
  const t = locale(state);
  document.documentElement.lang = currentLang(state);

  dom.topSubtitle.textContent = t.topSubtitle;
  dom.metricsTitle.textContent = t.metricsTitle;
  dom.energyLabel.textContent = t.energyLabel;
  dom.fearLabel.textContent = t.fearLabel;
  dom.cardsTitle.textContent = t.cardsTitle;
  dom.turnTitle.textContent = t.turnTitle;
  dom.turnInfo.textContent = t.turnInfo;
  dom.turnLabel.textContent = t.turnLabel;
  dom.growthChosenLabel.textContent = t.growthChosenLabel;
  dom.endTurnBtn.textContent = t.endTurnBtn;
  dom.discardLabel.textContent = t.discardLabel;
  dom.handLabel.textContent = t.handLabel;
  dom.noFailHint.textContent = t.noFailHint;
  dom.mapTitle.textContent = t.mapTitle;
  dom.mapPlanHint.textContent = t.mapPlanHint;
  dom.invaderTrackTitle.textContent = t.invaderTrackTitle;
  dom.ravageLabel.textContent = t.ravageLabel;
  dom.buildLabel.textContent = t.buildLabel;
  dom.discoverLabel.textContent = t.discoverLabel;
  dom.spiritTitle.textContent = t.spiritTitle;
  dom.activeSpiritLabel.textContent = t.activeSpiritLabel;
  dom.spiritPhaseHint.textContent = t.spiritPhaseHint;
  dom.progressionTitle.textContent = t.progressionTitle;
  dom.logTitle.textContent = t.logTitle;
  dom.manualSaveBtn.textContent = t.manualSaveBtn;
  dom.wipeSaveBtn.textContent = t.wipeSaveBtn;
  dom.autosaveHint.textContent = t.autosaveHint;
  dom.languageToggleBtn.textContent = t.langToggle;
}

function cardPreview(state, card) {
  return card.text;
}

function growthOptionLabel(state, optionId) {
  const t = locale(state);
  const token = GROWTH_OPTIONS[optionId];
  return token ? t[token] : t.growthNotChosen;
}

function renderGrowthOptions(state) {
  const t = locale(state);
  dom.growthOptions.innerHTML = "";

  const optionIds = Object.keys(GROWTH_OPTIONS);
  for (const optionId of optionIds) {
    const btn = document.createElement("button");
    btn.className = "growth-option-btn";
    btn.textContent = growthOptionLabel(state, optionId);
    if (state.turn.selectedGrowthOption === optionId) {
      btn.classList.add("selected");
    }
    btn.addEventListener("click", () => {
      chooseGrowthOption(state, optionId);
      updateUI(state);
    });
    dom.growthOptions.appendChild(btn);
  }
}

function growthOptionsSignature(state) {
  return `${currentLang(state)}|${state.turn.selectedGrowthOption}`;
}

function handSignature(state) {
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  const washAwaySig = washAway
    ? `${washAway.step}:${washAway.source || "-"}:${washAway.explorers}:${washAway.towns}`
    : "none";
  const flashFloodsSig = flashFloods
    ? `${flashFloods.step}:${flashFloods.land || "-"}`
    : "none";
  const riversBountySig = riversBounty
    ? `${riversBounty.step}:${riversBounty.destination || "-"}:${riversBounty.moved}`
    : "none";
  return `${currentLang(state)}|${state.turn.selectedGrowthOption || "-"}|${state.cards.hand.join(",")}|${state.cards.discardPile.join(",")}|${Math.floor(state.resources.energy)}|${washAwaySig}|${flashFloodsSig}|${riversBountySig}`;
}

function chooseGrowthOption(state, optionId) {
  const t = locale(state);
  const pendingMessage = currentPendingEffectMessage(state);
  if (pendingMessage) {
    addLog(state, pendingMessage);
    return;
  }
  if (state.turn.selectedGrowthOption) {
    addLog(state, t.growthAlreadyChosen);
    return;
  }

  state.turn.selectedGrowthOption = optionId;

  if (optionId === "reclaim_and_power") {
    const pool = [...state.cards.hand, ...state.cards.discardPile];
    state.cards.hand = shuffle(pool);
    state.cards.drawPile = [];
    state.cards.discardPile = [];
    state.resources.energy += 1;
    state.turn.powerCardsGained += 1;
    addLog(state, t.reclaimApplied);
  } else if (optionId === "double_presence") {
    state.turn.presencesPlaced += 2;
  } else if (optionId === "power_and_presence") {
    state.turn.powerCardsGained += 1;
    state.turn.presencesPlaced += 1;
  }

  addLog(state, template(t.growthPicked, { turn: state.turn.number, option: growthOptionLabel(state, optionId) }));
}

function endTurn(state) {
  const t = locale(state);
  const pendingMessage = currentPendingEffectMessage(state);
  if (pendingMessage) {
    addLog(state, pendingMessage);
    return;
  }
  if (!state.turn.selectedGrowthOption) {
    addLog(state, t.growthFirstRequired);
    return;
  }
  const oldTurn = state.turn.number;
  state.turn.number += 1;
  state.turn.selectedGrowthOption = "";
  state.turn.powerCardsPlayed = 0;
  state.invaderDamage = createInvaderDamage();
  advanceInvaderPhases(state);
  addLog(state, template(t.endTurnLog, { turn: oldTurn, nextTurn: state.turn.number }));
}

function renderHand(state) {
  const t = locale(state);
  const pendingTargeting = hasPendingTargetingEffect(state);
  const needsGrowthChoice = !state.turn.selectedGrowthOption;
  dom.handCards.innerHTML = "";

  if (state.cards.hand.length === 0 && state.cards.discardPile.length === 0) {
    dom.handCards.innerHTML = `<div class='hint'>${t.noCardsInHand}</div>`;
    return;
  }

  const ordered = [
    ...state.cards.hand.map((cardId, handIndex) => ({ cardId, handIndex, used: false })),
    ...state.cards.discardPile.map((cardId) => ({ cardId, handIndex: -1, used: true }))
  ];

  for (const entry of ordered) {
    const cardId = entry.cardId;
    const card = CARD_LIBRARY[cardId];
    if (!card) continue;

    const item = document.createElement("div");
    item.className = "card-item";
    item.classList.add(entry.used ? "card-used" : "card-ready");

    const playable = !entry.used
      && !pendingTargeting
      && !needsGrowthChoice
      && state.resources.energy >= card.cost;
    if (!playable) item.classList.add("card-unplayable");

    let statusText = t.cardReadyStatus;
    if (entry.used) {
      statusText = t.cardUsedStatus;
    } else if (pendingTargeting) {
      statusText = t.cardNeedTargetingStatus;
    } else if (needsGrowthChoice) {
      statusText = t.cardNeedGrowthStatus;
    } else if (state.resources.energy < card.cost) {
      statusText = t.cardNeedEnergyStatus;
    }

    const cardName = cardDisplayName(state, card);
    const actionText = entry.used ? t.reclaimNeededWord : t.playWord;
    const dataIndex = entry.used ? "" : `data-card-index="${entry.handIndex}"`;
    item.innerHTML = `
      <h4>${cardName}</h4>
      <p>${cardPreview(state, card)}</p>
      <small class="card-state">${statusText}</small>
      <div class="card-meta">
        <span>${t.costWord}: ${card.cost} ${t.energyWord}</span>
        <button class="play-btn" ${dataIndex} ${playable ? "" : "disabled"}>${actionText}</button>
      </div>
    `;

    dom.handCards.appendChild(item);
  }
}

function mapSignature(state) {
  const parts = [currentLang(state)];
  for (const land of INVADER_LANDS) {
    const slot = state.invaders && state.invaders[land] ? state.invaders[land] : { explorers: 0, towns: 0, cities: 0 };
    const dahan = state.dahan && typeof state.dahan[land] === "number" ? state.dahan[land] : 0;
    const dmg = state.invaderDamage && state.invaderDamage[land]
      ? state.invaderDamage[land]
      : { explorers: 0, towns: 0, cities: 0 };
    parts.push(`${slot.explorers}:${slot.towns}:${slot.cities}:d${dahan}:x${dmg.explorers}:${dmg.towns}:${dmg.cities}`);
  }
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (washAway) {
    parts.push(`wash:${washAway.step}:${washAway.source || "-"}:${washAway.explorers}:${washAway.towns}`);
  }
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  if (flashFloods) {
    parts.push(`flash:${flashFloods.step}:${flashFloods.land || "-"}:${flashFloods.primaryTarget || "-"}:${flashFloods.bonusDamage || 0}`);
  }
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (riversBounty) {
    parts.push(`rb:${riversBounty.step}:${riversBounty.destination || "-"}:${riversBounty.moved}`);
  }
  const defeatFx = activeDefeatFx(state);
  if (defeatFx) {
    parts.push(`defeat:${defeatFx.land}:${defeatFx.unitType}:${defeatFx.count}:${Math.floor(defeatFx.at / 100)}`);
  }
  return parts.join("|");
}

function renderMap(state) {
  const t = locale(state);
  const defeatFx = activeDefeatFx(state);
  dom.mapGrid.innerHTML = "";

  for (const terrain of INVADER_LANDS) {
    const panel = document.createElement("article");
    panel.className = `area-type-panel terrain-${terrain}`;
    const terrainLabel = t.invaderLandNames[terrain] || terrain;
    const counts = state.invaders && state.invaders[terrain] ? state.invaders[terrain] : { explorers: 0, towns: 0, cities: 0 };
    const damageSlot = state.invaderDamage && state.invaderDamage[terrain]
      ? state.invaderDamage[terrain]
      : { explorers: 0, towns: 0, cities: 0 };
    const dahanCount = state.dahan && typeof state.dahan[terrain] === "number" ? state.dahan[terrain] : 0;
    const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
    const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
    const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
    const actions = [];

    if (washAway && washAway.step === "choose-source") {
      const disabled = pushableCount(counts) <= 0 ? "disabled" : "";
      actions.push(`<button class="area-action-btn" data-wash-action="source" data-terrain="${terrain}" ${disabled}>${t.pushAwayBtn}</button>`);
    }

    if (washAway && washAway.step === "choose-units" && washAway.source === terrain) {
      const selectedExplorers = washAway.explorers;
      const selectedTowns = washAway.towns;
      const selectedTotal = selectedExplorers + selectedTowns;

      const canMinusExplorers = selectedExplorers > 0;
      const canPlusExplorers = selectedExplorers < counts.explorers && selectedTotal < 3;
      const canMinusTowns = selectedTowns > 0;
      const canPlusTowns = selectedTowns < counts.towns && selectedTotal < 3;

      actions.push(`
        <div class="unit-picker-row">
          <span>${t.explorersLabel}: ${selectedExplorers}</span>
          <div class="unit-picker-controls">
            <button class="area-action-btn area-action-mini" data-wash-action="units-delta" data-unit="explorers" data-delta="-1" ${canMinusExplorers ? "" : "disabled"}>-</button>
            <button class="area-action-btn area-action-mini" data-wash-action="units-delta" data-unit="explorers" data-delta="1" ${canPlusExplorers ? "" : "disabled"}>+</button>
          </div>
        </div>
      `);

      actions.push(`
        <div class="unit-picker-row">
          <span>${t.townsLabel}: ${selectedTowns}</span>
          <div class="unit-picker-controls">
            <button class="area-action-btn area-action-mini" data-wash-action="units-delta" data-unit="towns" data-delta="-1" ${canMinusTowns ? "" : "disabled"}>-</button>
            <button class="area-action-btn area-action-mini" data-wash-action="units-delta" data-unit="towns" data-delta="1" ${canPlusTowns ? "" : "disabled"}>+</button>
          </div>
        </div>
      `);

      actions.push(`<button class="area-action-btn" data-wash-action="units-confirm" ${selectedTotal > 0 ? "" : "disabled"}>${t.washAwayConfirmBtn}</button>`);
    }

    if (washAway && washAway.step === "choose-destination" && washAway.source && washAway.source !== terrain) {
      actions.push(`<button class="area-action-btn" data-wash-action="destination" data-terrain="${terrain}">${t.pushToBtn}</button>`);
    }

    if (flashFloods && flashFloods.step === "choose-land") {
      const disabled = invaderCountInLand(counts) <= 0 ? "disabled" : "";
      actions.push(`<button class="area-action-btn" data-flash-action="land" data-terrain="${terrain}" ${disabled}>${t.flashFloodsLandBtn}</button>`);
    }

    if (flashFloods && flashFloods.step === "choose-target" && flashFloods.land === terrain) {
      if (counts.explorers > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="explorers">${template(t.flashFloodsTargetBtn, { target: t.explorersLabel })}</button>`);
      }
      if (counts.towns > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="towns">${template(t.flashFloodsTargetBtn, { target: t.townsLabel })}</button>`);
      }
      if (counts.cities > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="cities">${template(t.flashFloodsTargetBtn, { target: t.citiesLabel })}</button>`);
      }
    }

    if (flashFloods && flashFloods.step === "choose-bonus-target" && flashFloods.land === terrain) {
      if (counts.explorers > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="explorers">${template(t.flashFloodsTargetBtn, { target: t.explorersLabel })}</button>`);
      }
      if (counts.towns > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="towns">${template(t.flashFloodsTargetBtn, { target: t.townsLabel })}</button>`);
      }
      if (counts.cities > 0) {
        actions.push(`<button class="area-action-btn" data-flash-action="target" data-target="cities">${template(t.flashFloodsTargetBtn, { target: t.citiesLabel })}</button>`);
      }
    }

    if (riversBounty && riversBounty.step === "choose-destination") {
      actions.push(`<button class="area-action-btn" data-rb-action="destination" data-terrain="${terrain}">${t.riversBountySetDestinationBtn}</button>`);
    }

    if (riversBounty && riversBounty.step === "choose-sources" && riversBounty.destination) {
      if (terrain === riversBounty.destination) {
        actions.push(`<div class="area-progress">${template(t.riversBountyProgress, { moved: riversBounty.moved })}</div>`);
        actions.push(`<button class="area-action-btn" data-rb-action="finish">${t.riversBountyFinishBtn}</button>`);
      } else {
        const canGather = riversBounty.moved < 2 && (state.dahan[terrain] || 0) > 0;
        actions.push(`<button class="area-action-btn" data-rb-action="source" data-terrain="${terrain}" ${canGather ? "" : "disabled"}>${t.riversBountyFromBtn}</button>`);
      }
    }

    const defeatHint = defeatFx && defeatFx.land === terrain
      ? `<div class="defeat-hint">${template(t.defeatHint, { count: defeatFx.count, unit: unitLabelByType(state, defeatFx.unitType) })}</div>`
      : "";

    const hpHints = [];
    for (const type of ["explorers", "towns", "cities"]) {
      const carry = Math.max(0, Math.floor(damageSlot[type] || 0));
      const health = UNIT_STATS[type].health;
      if ((counts[type] || 0) > 0 && carry > 0 && health > 1) {
        hpHints.push(`<span>${template(t.invaderHpHint, {
          unit: unitLabelByType(state, type),
          current: health - carry,
          max: health
        })}</span>`);
      }
    }
    const hpHintMarkup = hpHints.length > 0
      ? `<div class="area-hp-hints">${hpHints.join("")}</div>`
      : "";

    panel.innerHTML = `
      <h3 class="area-type-title">${terrainLabel}</h3>
      <div class="area-counts">
        <span>${t.explorersLabel}: ${counts.explorers}</span>
        <span>${t.townsLabel}: ${counts.towns}</span>
        <span>${t.citiesLabel}: ${counts.cities}</span>
      </div>
      <div class="area-dahan">
        <span>${t.dahanLabel}: ${dahanCount}</span>
      </div>
      ${hpHintMarkup}
      ${defeatHint}
      <div class="area-actions">${actions.join("")}</div>
    `;

    dom.mapGrid.appendChild(panel);
  }
}

function updateUI(state) {
  const t = locale(state);
  applyStaticLanguage(state);

  dom.energyValue.textContent = fmt(state.resources.energy);
  dom.fearValue.textContent = fmt(state.resources.fear);

  dom.energyRate.textContent = t.energySourceText;
  dom.fearRate.textContent = t.fearSourceText;

  dom.runTime.textContent = `${Math.floor(state.time.totalSeconds / 60)}m`;
  dom.activeSpiritName.textContent = spiritDisplayName(state);
  dom.growthLevel.textContent = String(state.spirit.growthLevel);
  dom.spiritsUnlocked.textContent = String(state.spirit.unlockedSpiritIds.length);
  dom.milestoneNotice.textContent = state.milestones.lastNotice || "";
  dom.spiritFixedName.textContent = spiritDisplayName(state);

  dom.spiritTraits.textContent = currentLang(state) === "en"
    ? `${spiritTraitText(state)} (${activeSpirit(state).name})`
    : `${spiritTraitText(state)} (${activeSpirit(state).englishName})`;

  const logEntries = state._log || [];
  dom.eventLog.innerHTML = logEntries.map((entry) => `<li>${entry}</li>`).join("");

  dom.discardCount.textContent = String(state.cards.discardPile.length);
  dom.handCount.textContent = String(state.cards.hand.length);
  dom.turnNumber.textContent = String(state.turn.number);
  dom.growthChosenValue.textContent = state.turn.selectedGrowthOption
    ? growthOptionLabel(state, state.turn.selectedGrowthOption)
    : t.growthNotChosen;
  dom.ravageArea.textContent = invaderLandName(state, state.invader.ravage);
  dom.buildArea.textContent = invaderLandName(state, state.invader.build);
  dom.discoverArea.textContent = invaderLandName(state, state.invader.explore);
  dom.playHint.textContent = t.playHint;

  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  dom.endTurnBtn.disabled = !state.turn.selectedGrowthOption || Boolean(washAway) || Boolean(flashFloods) || Boolean(riversBounty);
  if (washAway) {
    if (washAway.step === "choose-source") {
      dom.mapPlanHint.textContent = t.washAwayChooseSource;
    } else if (washAway.step === "choose-units") {
      dom.mapPlanHint.textContent = t.washAwayChooseUnits;
    } else {
      dom.mapPlanHint.textContent = t.washAwayChooseDestination;
    }
  } else if (flashFloods) {
    if (flashFloods.step === "choose-land") {
      dom.mapPlanHint.textContent = t.flashFloodsChooseLand;
    } else if (flashFloods.step === "choose-target") {
      dom.mapPlanHint.textContent = t.flashFloodsChooseTarget;
    } else {
      dom.mapPlanHint.textContent = t.flashFloodsChooseBonusTarget;
    }
  } else if (riversBounty) {
    dom.mapPlanHint.textContent = riversBounty.step === "choose-destination"
      ? t.riversBountyChooseDestination
      : t.riversBountyChooseSources;
  }

  const nextGrowthOptionsSig = growthOptionsSignature(state);
  if (uiRenderCache.growthOptionsSignature !== nextGrowthOptionsSig) {
    renderGrowthOptions(state);
    uiRenderCache.growthOptionsSignature = nextGrowthOptionsSig;
  }

  const nextHandSig = handSignature(state);
  if (uiRenderCache.handSignature !== nextHandSig) {
    renderHand(state);
    uiRenderCache.handSignature = nextHandSig;
  }

  const nextMapSig = mapSignature(state);
  if (uiRenderCache.mapSignature !== nextMapSig) {
    renderMap(state);
    uiRenderCache.mapSignature = nextMapSig;
  }

}

let state = normalizeState(loadState());
addLog(state, currentLang(state) === "en" ? "The spirit awakens." : "Der Geist erwacht.");
updateUI(state);

dom.languageToggleBtn.addEventListener("click", () => {
  state.ui.language = currentLang(state) === "de" ? "en" : "de";
  updateUI(state);
  saveState(state);
});

dom.handCards.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest("button[data-card-index]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-card-index"));
  if (Number.isNaN(idx)) return;
  playCardAtIndex(state, idx);
  updateUI(state);
});

dom.mapGrid.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest("button[data-wash-action], button[data-flash-action], button[data-rb-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-wash-action");
  const flashAction = btn.getAttribute("data-flash-action");
  const rbAction = btn.getAttribute("data-rb-action");

  if (action === "source") {
    const terrain = btn.getAttribute("data-terrain") || "";
    chooseWashAwaySource(state, terrain);
  } else if (action === "units-delta") {
    const unit = btn.getAttribute("data-unit") || "";
    const delta = Number(btn.getAttribute("data-delta"));
    adjustWashAwayUnits(state, unit, delta);
  } else if (action === "units-confirm") {
    confirmWashAwayUnits(state);
  } else if (action === "destination") {
    const terrain = btn.getAttribute("data-terrain") || "";
    chooseWashAwayDestination(state, terrain);
  } else if (flashAction === "land") {
    const terrain = btn.getAttribute("data-terrain") || "";
    chooseFlashFloodsLand(state, terrain);
  } else if (flashAction === "target") {
    const targetType = btn.getAttribute("data-target") || "";
    const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
    if (flashFloods && flashFloods.step === "choose-bonus-target") {
      resolveFlashFloodsBonusTarget(state, targetType);
    } else {
      resolveFlashFloodsTarget(state, targetType);
    }
  } else if (rbAction === "destination") {
    const terrain = btn.getAttribute("data-terrain") || "";
    chooseRiversBountyDestination(state, terrain);
  } else if (rbAction === "source") {
    const terrain = btn.getAttribute("data-terrain") || "";
    gatherRiversBountyFrom(state, terrain);
  } else if (rbAction === "finish") {
    finishRiversBounty(state);
  }

  updateUI(state);
});

dom.endTurnBtn.addEventListener("click", () => {
  endTurn(state);
  updateUI(state);
});

dom.manualSaveBtn.addEventListener("click", () => {
  saveState(state);
  addLog(state, currentLang(state) === "en" ? "Manual save completed." : "Manuelles Speichern abgeschlossen.");
  updateUI(state);
});

dom.wipeSaveBtn.addEventListener("click", () => {
  const langBeforeWipe = currentLang(state);
  const ok = confirm(
    langBeforeWipe === "en"
      ? "This deletes your local Spirit Idland save. Continue?"
      : "Dadurch wird dein lokaler Spirit-Idland-Spielstand geloescht. Fortfahren?"
  );
  if (!ok) return;
  localStorage.removeItem(SAVE_KEY);
  state = createFreshGameState();
  state.ui.language = langBeforeWipe;
  addLog(state, langBeforeWipe === "en" ? "Save wiped." : "Spielstand geloescht.");
  updateUI(state);
});

let lastTick = nowMs();
let saveAccumulator = 0;

setInterval(() => {
  const t = nowMs();
  const dt = Math.min(0.5, (t - lastTick) / 1000);
  lastTick = t;

  tick(state, dt);
  updateUI(state);

  saveAccumulator += dt;
  if (saveAccumulator >= 10) {
    saveAccumulator = 0;
    saveState(state);
  }
}, 100);

window.addEventListener("beforeunload", () => {
  saveState(state);
});