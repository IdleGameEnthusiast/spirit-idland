const SAVE_KEY = "spirit-idland-save-v1";
const VERSION = "2.0.0";

const CONSTS = {
  STARTING_ENERGY: 0
};

const SPIRITS = {
  core_spirit_01: {
    name: "Reissende Fluten im Sonnenlicht",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
    traitsEn: "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
    // Presence the spirit already holds on the board when a run begins, keyed by land.
    // Land 1 is the coastal wetland: a river mouth, and the tightest opening on the board,
    // since range 1 from there reaches only lands 1, 2, 4, and 5.
    startingPresence: { "1": 1 },
    // Presence tracks. `open` is always visible; `slots` start covered by presence and
    // are revealed left to right as presence is taken off to place on the island.
    tracks: {
      energy: { open: 1, slots: [2, 2, 3, 4, 4, 5] },
      cardPlays: { open: 1, slots: [2, 2, 3, "regain", 4, 5] }
    },
    pushPowerMult: 1.2,
    strikePowerMult: 0.9
  }
};

const TRACK_IDS = ["energy", "cardPlays"];

const I18N = {
  de: {
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
    growthOptionReclaim: "Karten zurueckholen, +1 Energie, 1 Kraftkarte nehmen",
    growthOptionDoublePresence: "2 Praesenzen hinzufuegen",
    growthOptionPowerAndPresence: "1 Kraftkarte nehmen und 1 Praesenz hinzufuegen",
    endTurnBtn: "Runde beenden",
    drawLabel: "Nachziehstapel:",
    discardLabel: "Ablage:",
    handLabel: "Hand:",
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
    mapTitle: "Die Insel",
    mapPlanHint: "Acht Gebiete, drei an der Kueste. Waehle ein Gebiet fuer Details.",
    explorersLabel: "Entdecker",
    townsLabel: "Doerfer",
    citiesLabel: "Staedte",
    dahanLabel: "Dahan",
    presenceLabel: "Praesenz",
    essenceLabel: "Essenz",
    essenceRate: "1 Essenz / {seconds}s",
    essenceNextIn: "Naechste in {seconds}s",
    essenceNoGeneration: "Keine Erzeugung",
    essenceNextTier: "Ab {presence} Praesenz: {seconds}s",
    essenceMaxTier: "Schnellste Rate erreicht",
    pushAwayBtn: "Wegschieben",
    pushToBtn: "Hinschieben",
    washAwayChooseSource: "Wash Away (Reichweite Praesenz 1): waehle ein Gebiet zum Wegschieben.",
    washAwayChooseUnits: "Wash Away: Waehle, was weggeschoben wird (max. 3 Entdecker/Doerfer).",
    washAwayChooseDestination: "Wash Away: schiebe in ein angrenzendes Gebiet.",
    washAwayUnitsBtn: "E:{explorers} D:{towns}",
    washAwayConfirmBtn: "Weiter",
    washAwayNoTargets: "Wash Away hat kein Gebiet in Reichweite mit Entdeckern oder Doerfern.",
    washAwayResolved: "Wash Away: {total} verschoben von {from} nach {to} (E:{explorers}, D:{towns}).",
    finishWashAwayFirst: "Beende zuerst den Wash-Away-Effekt.",
    flashFloodsChooseLand: "Flash Floods (Reichweite Praesenz 1): waehle ein Zielgebiet.",
    flashFloodsChooseTarget: "Flash Floods: Waehle einen Zieltyp.",
    flashFloodsChooseBonusTarget: "Flash Floods: Waehle das Ziel fuer den restlichen Schaden.",
    flashFloodsLandBtn: "Zielen",
    flashFloodsTargetBtn: "Treffe {target}",
    flashFloodsNoTargets: "Flash Floods hat kein Ziel in Reichweite.",
    flashFloodsResolved: "Flash Floods trifft {target} in {land}: {damage} Schaden, {defeated} besiegt.",
    finishFlashFloodsFirst: "Beende zuerst den Flash-Floods-Effekt.",
    riversBountyChooseDestination: "River's Bounty: sammle in einem Gebiet mit eigener Praesenz.",
    riversBountyChooseSources: "River's Bounty: hole Dahan aus angrenzenden Gebieten.",
    riversBountySetDestinationBtn: "Hier sammeln",
    riversBountyFromBtn: "Von hier sammeln",
    riversBountyFinishBtn: "Gather beenden",
    riversBountyProgress: "Gather: {moved}/2",
    riversBountyNoTargets: "River's Bounty braucht ein Gebiet mit eigener Praesenz.",
    riversBountyResolved: "River's Bounty: {moved} Dahan nach {to} gesammelt.",
    riversBountyBonus: "River's Bounty-Bonus in {to}: +1 Dahan, +1 Energie.",
    finishRiversBountyFirst: "Beende zuerst den River's-Bounty-Effekt.",
    presenceChooseTrack: "Praesenz setzen: waehle eine Leiste ({remaining} verbleibend).",
    presenceChooseArea: "Praesenz aus der {track}: waehle ein Gebiet in Reichweite 1.",
    presenceRevealed: "Praesenz nach {land}. {track} deckt auf: {value}.",
    presenceNoneLeft: "Keine Praesenz mehr auf den Leisten.",
    presencePlacementBtn: "Praesenz setzen",
    tracksTitle: "Geisterleisten",
    tracksHint: "Praesenz wird von den Leisten genommen. Jede Platzierung deckt den naechsten Wert auf.",
    energyTrackLabel: "Energie-Leiste",
    cardPlaysTrackLabel: "Kartenspiele-Leiste",
    trackCurrentEnergy: "{value} Energie/Runde",
    trackCurrentCardPlays: "{used}/{limit} Karten",
    trackPresenceLeft: "{left} Praesenz verfuegbar",
    regainSymbol: "Regain",
    regainBtn: "Zurueckholen",
    regainResolved: "Regain: {card} zurueck auf die Hand.",
    energyIncome: "Energie-Leiste: +{amount} Energie.",
    cardPlayLimitReached: "Kartenlimit erreicht ({limit} pro Runde).",
    cardPlayLimitStatus: "Kartenlimit erreicht",
    cardRegainableStatus: "Kann zurueckgeholt werden",
    presencePlacementResolved: "Praesenz platziert: {summary}.",
    finishPresencePlacementFirst: "Platziere zuerst die Praesenz.",
    defeatHint: "Besiegt: -{count} {unit}",
    spiritTitle: "Geisterfokus (Phase 1)",
    activeSpiritLabel: "Aktiver Geist:",
    spiritPhaseHint: "Diese Version ist absichtlich auf einen Geist begrenzt, damit wir Mechaniken Schritt fuer Schritt aufbauen koennen.",
    progressionTitle: "Fortschritt",
    logTitle: "Spielprotokoll",
    manualSaveBtn: "Jetzt speichern",
    wipeSaveBtn: "Spielstand loeschen",
    autosaveHint: "Autosave alle 10s.",
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
    cardNeedGrowthStatus: "Zuerst Wachstum waehlen",
    cardNeedInvaderPhasesStatus: "Zuerst Invasorenphasen aufloesen",
    cardNeedTargetingStatus: "Zuerst laufenden Zieleffekt beenden",
    cardUsedStatus: "Verbraucht bis Rueckholen",
    growthFirstRequired: "Waehle zuerst eine Wachstumsoption.",
    growthAlreadyChosen: "Wachstum wurde fuer diese Runde bereits gewaehlt.",
    growthPicked: "Wachstum fuer Runde {turn} gewaehlt: {option}.",
    reclaimApplied: "Wachstum: Karten zurueckgeholt, +1 Energie, 1 Kraftkarte markiert.",
    endTurnLog: "Runde {turn} beendet. Runde {nextTurn} beginnt.",
    invaderTrackTitle: "Invasorenphasen",
    ravageLabel: "Verwuesten:",
    buildLabel: "Bauen:",
    discoverLabel: "Entdecken:",
    ravageWord: "Verwuesten",
    buildWord: "Bauen",
    discoverWord: "Entdecken",
    executeAllPhasesBtn: "Alle Invasorenphasen ausfuehren",
    phaseStateNext: "Jetzt aufloesen",
    phaseStateResolved: "Aufgeloest",
    phaseStateWaiting: "Wartet",
    phaseStateBlocked: "Gesperrt",
    invaderTrackHintNext: "Naechste Phase: {step} in {land}.",
    invaderTrackHintBlocked: "Waehle zuerst eine Wachstumsoption.",
    invaderTrackHintDone: "Alle Invasorenphasen aufgeloest. Jetzt Karten spielen.",
    invaderStepOutOfOrder: "Die Phasen laufen der Reihe nach. Als naechstes: {step}.",
    invaderPhasesRequired: "Loese zuerst alle Invasorenphasen auf.",
    invaderPhasesAlreadyDone: "Die Invasorenphasen sind fuer diese Runde schon aufgeloest.",
    phasePreviewRavage: "Verwuesten: {damage} Schaden, -{dahanLost} Dahan, Ueberlebende antworten mit {counter}.",
    phasePreviewRavageNone: "Verwuesten: keine Invasoren hier.",
    phasePreviewBuild: "Bauen: +1 {unit}.",
    phasePreviewBuildNone: "Bauen: keine Invasoren hier.",
    phasePreviewExplore: "Entdecken: +1 Entdecker.",
    ravageNothing: "Verwuesten: noch kein Gebiet auf der Leiste.",
    ravageNoInvaders: "Verwuesten in {land}: keine Invasoren, nichts passiert.",
    ravageResolved: "Verwuesten in {land}: {damage} Schaden, {dahanLost} Dahan verloren.",
    ravageNoSurvivors: "Kein Dahan ueberlebt in {land}. Kein Gegenangriff.",
    ravageCounterChoose: "Dahan-Gegenangriff in {land}: waehle Ziele ({remaining} Schaden uebrig).",
    ravageCounterRemaining: "Gegenangriff: {remaining} Schaden uebrig",
    ravageCounterTargetBtn: "1 Schaden: {target}",
    ravageCounterResolved: "Dahan-Gegenangriff in {land}: {defeated} Invasoren besiegt.",
    ravageCounterNoTargets: "Gegenangriff in {land}: keine Invasoren mehr uebrig.",
    finishRavageCounterFirst: "Beende zuerst den Gegenangriff der Dahan.",
    buildNothing: "Bauen: noch kein Gebiet auf der Leiste.",
    buildNoInvaders: "Bauen in {land}: keine Invasoren, nichts wird gebaut.",
    buildResolved: "Bauen in {land}: +1 {unit}.",
    exploreNothing: "Entdecken: kein Gebiet gezogen.",
    exploreResolved: "Entdecken in {land}: +1 Entdecker.",
    invaderNone: "-",
    landDisplay: "Gebiet {id} · {terrain}",
    landShort: "Gebiet {id}",
    coastalLabel: "Kueste",
    inlandLabel: "Binnenland",
    neighboursLabel: "Angrenzend",
    invadersLabel: "Invasoren",
    ownForcesLabel: "Eigene Kraefte",
    noInvadersHere: "Keine Invasoren.",
    noLandSelected: "Waehle ein Gebiet auf der Karte.",
    outOfRangeLabel: "Ausserhalb der Reichweite",
    noTargetHere: "Kein gueltiges Ziel hier",
    phaseTargetLands: "{terrain}: {lands}",
    phasePreviewExploreBlocked: "Entdecken: hier kein Zugang.",
    phaseChipRavage: "{damage} Schaden · -{dahanLost} Dahan · Antwort {counter}",
    phaseChipRavageNone: "keine Invasoren",
    phaseChipBuild: "+1 {unit}",
    phaseChipBuildNone: "keine Invasoren",
    phaseChipExplore: "+1 Entdecker",
    phaseChipExploreBlocked: "kein Zugang",
    ravageCounterShort: "Gegenangriff: {remaining}",
    exploreBlocked: "Entdecken in {land}: kein Zugang, keine Kueste und kein Dorf/keine Stadt daneben.",
    exploreNoneReachable: "Entdecken in {terrain}: kein Gebiet erreichbar.",
    ravageCounterNext: "Naechster Gegenangriff: {land}.",
    ravageCounterWaiting: "Gegenangriff wartet",
    invaderLandNames: {
      mountains: "Berge",
      desert: "Wueste",
      jungle: "Dschungel",
      wetlands: "Suempfe"
    },
    essenceNames: {
      mountains: "Bergessenz",
      desert: "Wuestenessenz",
      jungle: "Dschungelessenz",
      wetlands: "Sumpfessenz"
    },
    invaderPhaseLog: "Invasorenphasen - Verwuesten: {ravage}, Bauen: {build}, Entdecken: {discover}.",
    dahanRoundLog: "Dahan versammeln sich: {summary}.",
    startingPresenceLog: "Startpraesenz: {summary}.",
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
    growthOptionReclaim: "Reclaim cards, +1 energy, gain 1 power card",
    growthOptionDoublePresence: "Add 2 presences",
    growthOptionPowerAndPresence: "Gain 1 power card and add 1 presence",
    endTurnBtn: "End Turn",
    drawLabel: "Draw Pile:",
    discardLabel: "Discard:",
    handLabel: "Hand:",
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
    mapTitle: "The Island",
    mapPlanHint: "Eight lands, three of them coastal. Select a land for details.",
    explorersLabel: "Explorers",
    townsLabel: "Towns",
    citiesLabel: "Cities",
    dahanLabel: "Dahan",
    presenceLabel: "Presence",
    essenceLabel: "Essence",
    essenceRate: "1 essence / {seconds}s",
    essenceNextIn: "Next in {seconds}s",
    essenceNoGeneration: "No generation",
    essenceNextTier: "At {presence} presence: {seconds}s",
    essenceMaxTier: "Fastest rate reached",
    pushAwayBtn: "Push Away",
    pushToBtn: "Push To",
    washAwayChooseSource: "Wash Away (Range: Presence 1): choose a land to push from.",
    washAwayChooseUnits: "Wash Away: choose what to push (up to 3 explorers/towns).",
    washAwayChooseDestination: "Wash Away: push into an adjacent land.",
    washAwayUnitsBtn: "E:{explorers} T:{towns}",
    washAwayConfirmBtn: "Continue",
    washAwayNoTargets: "Wash Away has no land in range holding explorers or towns.",
    washAwayResolved: "Wash Away: moved {total} from {from} to {to} (E:{explorers}, T:{towns}).",
    finishWashAwayFirst: "Finish the Wash Away effect first.",
    flashFloodsChooseLand: "Flash Floods (Range: Presence 1): choose a target land.",
    flashFloodsChooseTarget: "Flash Floods: choose a target unit type.",
    flashFloodsChooseBonusTarget: "Flash Floods: choose where to apply remaining damage.",
    flashFloodsLandBtn: "Target",
    flashFloodsTargetBtn: "Hit {target}",
    flashFloodsNoTargets: "Flash Floods has no target in range.",
    flashFloodsResolved: "Flash Floods hits {target} in {land}: {damage} damage, {defeated} defeated.",
    finishFlashFloodsFirst: "Finish the Flash Floods effect first.",
    riversBountyChooseDestination: "River's Bounty: gather into a land you have presence in.",
    riversBountyChooseSources: "River's Bounty: pull Dahan from adjacent lands.",
    riversBountySetDestinationBtn: "Gather Here",
    riversBountyFromBtn: "Gather From",
    riversBountyFinishBtn: "Finish Gather",
    riversBountyProgress: "Gathered: {moved}/2",
    riversBountyNoTargets: "River's Bounty needs a land you have presence in.",
    riversBountyResolved: "River's Bounty: gathered {moved} Dahan into {to}.",
    riversBountyBonus: "River's Bounty bonus in {to}: +1 Dahan, +1 Energy.",
    finishRiversBountyFirst: "Finish the River's Bounty effect first.",
    presenceChooseTrack: "Place presence: choose a track ({remaining} left).",
    presenceChooseArea: "Presence from the {track}: choose a land within range 1.",
    presenceRevealed: "Presence to {land}. {track} reveals: {value}.",
    presenceNoneLeft: "No presence left on the tracks.",
    presencePlacementBtn: "Place Presence",
    tracksTitle: "Spirit Tracks",
    tracksHint: "Presence is taken from the tracks. Each placement reveals the next value.",
    energyTrackLabel: "Energy Track",
    cardPlaysTrackLabel: "Card Plays Track",
    trackCurrentEnergy: "{value} energy/turn",
    trackCurrentCardPlays: "{used}/{limit} cards",
    trackPresenceLeft: "{left} presence available",
    regainSymbol: "Regain",
    regainBtn: "Regain",
    regainResolved: "Regain: {card} returned to hand.",
    energyIncome: "Energy track: +{amount} energy.",
    cardPlayLimitReached: "Card play limit reached ({limit} per turn).",
    cardPlayLimitStatus: "Card play limit reached",
    cardRegainableStatus: "Can be regained",
    presencePlacementResolved: "Presence placed: {summary}.",
    finishPresencePlacementFirst: "Finish placing presence first.",
    defeatHint: "Defeated: -{count} {unit}",
    spiritTitle: "Spirit Focus (Phase 1)",
    activeSpiritLabel: "Active Spirit:",
    spiritPhaseHint: "This version is intentionally limited to one spirit so we can rebuild mechanics step by step.",
    progressionTitle: "Progression",
    logTitle: "Game Log",
    manualSaveBtn: "Save Now",
    wipeSaveBtn: "Wipe Save",
    autosaveHint: "Autosave every 10s.",
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
    cardNeedGrowthStatus: "Choose growth first",
    cardNeedInvaderPhasesStatus: "Resolve invader phases first",
    cardNeedTargetingStatus: "Finish current targeting effect first",
    cardUsedStatus: "Used until reclaimed",
    growthFirstRequired: "Choose a growth option first.",
    growthAlreadyChosen: "Growth already chosen for this turn.",
    growthPicked: "Growth chosen for turn {turn}: {option}.",
    reclaimApplied: "Growth: cards reclaimed, +1 energy, 1 power card marked.",
    endTurnLog: "Turn {turn} ended. Turn {nextTurn} begins.",
    invaderTrackTitle: "Invader Phases",
    ravageLabel: "Ravage:",
    buildLabel: "Build:",
    discoverLabel: "Discover:",
    ravageWord: "Ravage",
    buildWord: "Build",
    discoverWord: "Discover",
    executeAllPhasesBtn: "Execute all invader phases",
    phaseStateNext: "Resolve now",
    phaseStateResolved: "Resolved",
    phaseStateWaiting: "Waiting",
    phaseStateBlocked: "Locked",
    invaderTrackHintNext: "Next phase: {step} in {land}.",
    invaderTrackHintBlocked: "Choose a growth option first.",
    invaderTrackHintDone: "All invader phases resolved. Cards are open now.",
    invaderStepOutOfOrder: "Phases resolve in order. Next up: {step}.",
    invaderPhasesRequired: "Resolve all invader phases first.",
    invaderPhasesAlreadyDone: "The invader phases are already resolved this turn.",
    phasePreviewRavage: "Ravage: {damage} damage, -{dahanLost} Dahan, survivors strike back for {counter}.",
    phasePreviewRavageNone: "Ravage: no invaders here.",
    phasePreviewBuild: "Build: +1 {unit}.",
    phasePreviewBuildNone: "Build: no invaders here.",
    phasePreviewExplore: "Discover: +1 explorer.",
    ravageNothing: "Ravage: no land on the track yet.",
    ravageNoInvaders: "Ravage in {land}: no invaders, nothing happens.",
    ravageResolved: "Ravage in {land}: {damage} damage, {dahanLost} Dahan lost.",
    ravageNoSurvivors: "No Dahan survive in {land}. No counterattack.",
    ravageCounterChoose: "Dahan counterattack in {land}: choose targets ({remaining} damage left).",
    ravageCounterRemaining: "Counterattack: {remaining} damage left",
    ravageCounterTargetBtn: "1 damage: {target}",
    ravageCounterResolved: "Dahan counterattack in {land}: {defeated} invaders defeated.",
    ravageCounterNoTargets: "Counterattack in {land}: no invaders left to hit.",
    finishRavageCounterFirst: "Finish the Dahan counterattack first.",
    buildNothing: "Build: no land on the track yet.",
    buildNoInvaders: "Build in {land}: no invaders, nothing is built.",
    buildResolved: "Build in {land}: +1 {unit}.",
    exploreNothing: "Discover: no land drawn.",
    exploreResolved: "Discover in {land}: +1 explorer.",
    invaderNone: "-",
    landDisplay: "Land {id} · {terrain}",
    landShort: "Land {id}",
    coastalLabel: "Coastal",
    inlandLabel: "Inland",
    neighboursLabel: "Adjacent",
    invadersLabel: "Invaders",
    ownForcesLabel: "Your forces",
    noInvadersHere: "No invaders.",
    noLandSelected: "Select a land on the map.",
    outOfRangeLabel: "Out of range",
    noTargetHere: "No valid target here",
    phaseTargetLands: "{terrain}: {lands}",
    phasePreviewExploreBlocked: "Discover: no way in here.",
    phaseChipRavage: "{damage} damage · -{dahanLost} Dahan · reply {counter}",
    phaseChipRavageNone: "no invaders",
    phaseChipBuild: "+1 {unit}",
    phaseChipBuildNone: "no invaders",
    phaseChipExplore: "+1 explorer",
    phaseChipExploreBlocked: "no way in",
    ravageCounterShort: "Counterattack: {remaining}",
    exploreBlocked: "Discover in {land}: no way in, not coastal and no adjacent town or city.",
    exploreNoneReachable: "Discover in {terrain}: no land is reachable.",
    ravageCounterNext: "Next counterattack: {land}.",
    ravageCounterWaiting: "Counterattack waiting",
    invaderLandNames: {
      mountains: "Mountains",
      desert: "Desert",
      jungle: "Jungle",
      wetlands: "Wetlands"
    },
    essenceNames: {
      mountains: "Mountain Essence",
      desert: "Desert Essence",
      jungle: "Jungle Essence",
      wetlands: "Wetlands Essence"
    },
    invaderPhaseLog: "Invader phases - Ravage: {ravage}, Build: {build}, Discover: {discover}.",
    dahanRoundLog: "Dahan gather: {summary}.",
    startingPresenceLog: "Starting presence: {summary}.",
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

// Terrain is an attribute of a land, and it is still what the invader track names.
const INVADER_TERRAINS = ["mountains", "desert", "jungle", "wetlands"];

// The island. Built to the published structure of a standard Spirit Island board: eight
// lands, exactly two of each terrain, and three coastal lands rather than four. Coastal
// means touching the board's ocean edge; the other borders are cliffs and do not count.
//
// Three coasts over four terrains means one terrain has no coast at all. That is mountains
// here, which is why Discover cannot seed explorers into lands 4 and 6 until the invaders
// have already worked inland. See docs/spec/09-island-board.md.
//
// Adjacency is symmetric and deliberately uneven: land 5 is a six-neighbour hub, land 3 is
// a two-neighbour corner. Never assume a land has four neighbours.
// `rect` is the land's footprint in board space: u runs left to right, v runs from the back
// of the board (0) to the ocean edge (1). Every adjacency above falls out of these
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

// Terrain hues, mirrored in app.css. One value per terrain so a land, its essence pool, and
// its detail panel can never disagree about what colour it is.
const TERRAIN_RGB = {
  mountains: "171, 184, 196",
  desert: "242, 196, 90",
  jungle: "124, 198, 116",
  wetlands: "118, 179, 222"
};

// Land IDs are strings, never numbers: JSON object keys are strings, so a numeric id would
// silently stop matching itself after a save/load round-trip.
const LAND_IDS = Object.keys(BOARD_LANDS);

// Mandatory order the invader phases must be resolved in each turn.
const INVADER_STEPS = ["ravage", "build", "explore"];
const INVADER_STEP_DONE = "done";
// Six across eight lands holds the same per-land density the four-panel build had at 3/4.
const DAHAN_AT_SETUP = 6;
const DAHAN_MAX_ADD_PER_AREA = 2;
const DEFEAT_FX_MS = 1200;
const MAX_TICK_SECONDS = 5;
const UNIT_STATS = {
  explorers: { health: 1, damage: 1 },
  towns: { health: 2, damage: 2 },
  cities: { health: 3, damage: 3 },
  dahan: { health: 2, damage: 2 }
};

// Presence thresholds for essence generation speed. Each entry applies from its
// presence value up to the next entry. Below 1 presence an area generates nothing.
const ESSENCE_RATE_TABLE = [
  { presence: 1, seconds: 180 },
  { presence: 2, seconds: 150 },
  { presence: 3, seconds: 120 },
  { presence: 4, seconds: 110 },
  { presence: 5, seconds: 100 },
  { presence: 6, seconds: 90 },
  { presence: 7, seconds: 80 },
  { presence: 8, seconds: 70 },
  { presence: 9, seconds: 60 },
  { presence: 10, seconds: 51 },
  { presence: 20, seconds: 50 },
  { presence: 30, seconds: 49 },
  { presence: 40, seconds: 48 },
  { presence: 50, seconds: 47 },
  { presence: 60, seconds: 46 },
  { presence: 70, seconds: 45 },
  { presence: 80, seconds: 44 },
  { presence: 90, seconds: 43 },
  { presence: 100, seconds: 42 },
  { presence: 200, seconds: 41 },
  { presence: 300, seconds: 40 },
  { presence: 400, seconds: 39 },
  { presence: 500, seconds: 38 },
  { presence: 600, seconds: 37 },
  { presence: 700, seconds: 36 },
  { presence: 800, seconds: 35 },
  { presence: 900, seconds: 34 },
  { presence: 1000, seconds: 33 },
  { presence: 2000, seconds: 32 },
  { presence: 3000, seconds: 31 },
  { presence: 4000, seconds: 30 },
  { presence: 5000, seconds: 29 },
  { presence: 6000, seconds: 28 },
  { presence: 7000, seconds: 27 },
  { presence: 8000, seconds: 26 },
  { presence: 9000, seconds: 25 },
  { presence: 10000, seconds: 24 },
  { presence: 100000, seconds: 23 },
  { presence: 1000000, seconds: 22 },
  { presence: 10000000, seconds: 21 },
  { presence: 100000000, seconds: 20 }
];

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

function landsWithPresence(state) {
  return LAND_IDS.filter((landId) => (state.presence && state.presence[landId] > 0));
}

// Range 0 is the lands holding presence; each further step adds their neighbours.
// A spirit with no presence at all can reach anywhere, which keeps a corrupt save playable.
function landsInRange(state, range) {
  const seeds = landsWithPresence(state);
  if (seeds.length === 0) return new Set(LAND_IDS);

  const reached = new Set(seeds);
  for (let step = 0; step < Math.max(0, Math.floor(range || 0)); step += 1) {
    for (const landId of [...reached]) {
      for (const neighbour of adjacentLands(landId)) reached.add(neighbour);
    }
  }
  return reached;
}

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

function drawInvaderTerrain() {
  const idx = Math.floor(Math.random() * INVADER_TERRAINS.length);
  return INVADER_TERRAINS[idx];
}

function drawInvaderTerrainExcluding(excludedTerrains) {
  const excluded = new Set((excludedTerrains || []).filter((terrain) => INVADER_TERRAINS.includes(terrain)));
  const choices = INVADER_TERRAINS.filter((terrain) => !excluded.has(terrain));
  if (choices.length === 0) return drawInvaderTerrain();
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}

function normalizeInvaderPhases(invader) {
  const ravage = INVADER_TERRAINS.includes(invader?.ravage) ? invader.ravage : null;
  const build = INVADER_TERRAINS.includes(invader?.build) ? invader.build : null;
  const exploreRaw = INVADER_TERRAINS.includes(invader?.explore) ? invader.explore : null;

  let explore = exploreRaw;
  if (!explore || explore === build || explore === ravage) {
    explore = drawInvaderTerrainExcluding([ravage, build]);
  }

  return { ravage, build, explore };
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

function normalizeInvaderDamage(invaderDamage) {
  return normalizeInvaderCounts(invaderDamage);
}

function clampInvaderDamageByCounts(invaders, invaderDamage) {
  const out = normalizeInvaderDamage(invaderDamage);
  const counts = normalizeInvaderCounts(invaders);

  for (const landId of LAND_IDS) {
    for (const type of ["explorers", "towns", "cities"]) {
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

function applyDamageToInvaderType(state, land, type, damage) {
  if (!isLandId(land)) return { defeated: 0, remainingHp: 0, maxHp: 0, consumed: 0 };
  if (!["explorers", "towns", "cities"].includes(type)) return { defeated: 0, remainingHp: 0, maxHp: 0, consumed: 0 };

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = clampInvaderDamageByCounts(state.invaders, state.invaderDamage);

  const slot = state.invaders[land];
  const damageSlot = state.invaderDamage[land];
  const unitCount = Math.max(0, slot[type] || 0);
  const maxHp = UNIT_STATS[type].health;
  if (unitCount <= 0 || maxHp <= 0) {
    return { defeated: 0, remainingHp: 0, maxHp, consumed: 0 };
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

  // How much of the incoming damage this type actually absorbed. Callers that spread
  // damage across several types need this to avoid spending the same damage twice.
  const consumed = Math.max(0, totalApplied - carry);

  return { defeated, remainingHp, maxHp, consumed };
}

function createDahanCounts() {
  return createLandMap(() => 0);
}

function normalizeDahanCounts(dahan) {
  const merged = dahan || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

function createPresenceCounts() {
  return createLandMap(() => 0);
}

function normalizePresenceCounts(presence) {
  const merged = presence || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

// Essence pools stay terrain-keyed: four named currencies, whatever the board looks like.
function createEssencePools() {
  const out = {};
  for (const terrain of INVADER_TERRAINS) out[terrain] = 0;
  return out;
}

function normalizeEssencePools(essence) {
  const merged = essence || {};
  const out = {};
  for (const terrain of INVADER_TERRAINS) {
    out[terrain] = Math.max(0, Math.floor(merged[terrain] || 0));
  }
  return out;
}

// Progress is per land: every land runs its own generator into its terrain's pool.
function createEssenceProgress() {
  return createLandMap(() => 0);
}

function normalizeEssenceProgress(progress) {
  const merged = progress || {};
  return createLandMap((landId) => {
    const value = Number(merged[landId]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
}

// Seconds needed for one essence at this presence count. 0 means no generation.
function essenceSecondsPerUnit(presenceCount) {
  const count = Math.max(0, Math.floor(presenceCount || 0));
  if (count < 1) return 0;

  let seconds = 0;
  for (const tier of ESSENCE_RATE_TABLE) {
    if (count < tier.presence) break;
    seconds = tier.seconds;
  }
  return seconds;
}

// The next presence threshold that would speed generation up, or null at max rate.
function nextEssenceTier(presenceCount) {
  const count = Math.max(0, Math.floor(presenceCount || 0));
  for (const tier of ESSENCE_RATE_TABLE) {
    if (tier.presence > count) return tier;
  }
  return null;
}

function normalizeWashAwayState(washAway) {
  if (!washAway || typeof washAway !== "object") return null;
  const validSteps = new Set(["choose-source", "choose-units", "choose-destination"]);
  if (!validSteps.has(washAway.step)) return null;

  const source = isLandId(washAway.source) ? washAway.source : null;
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
  const land = isLandId(flashFloods.land) ? flashFloods.land : null;
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

  const destination = isLandId(riversBounty.destination) ? riversBounty.destination : null;
  const moved = clamp(Math.floor(riversBounty.moved || 0), 0, 2);
  const pulledFrom = normalizeDahanCounts(riversBounty.pulledFrom);

  return {
    step: riversBounty.step,
    destination,
    moved,
    pulledFrom
  };
}

function normalizePresencePlacementState(presencePlacement) {
  if (!presencePlacement || typeof presencePlacement !== "object") return null;
  const remaining = Math.max(0, Math.floor(presencePlacement.remaining || 0));
  if (remaining <= 0) return null;

  const validSteps = new Set(["choose-track", "choose-land"]);
  const step = validSteps.has(presencePlacement.step) ? presencePlacement.step : "choose-track";
  const track = TRACK_IDS.includes(presencePlacement.track) ? presencePlacement.track : null;
  // A land step without a source track is incoherent, so fall back to picking a track.
  if (step === "choose-land" && !track) {
    return { step: "choose-track", track: null, remaining, placed: normalizePresenceCounts(presencePlacement.placed) };
  }

  const placed = normalizePresenceCounts(presencePlacement.placed);

  return {
    step,
    track,
    remaining,
    placed
  };
}

// A terrain-wide Ravage acts on two lands, so more than one land can earn a counterattack.
// `queued` holds the lands still waiting behind the active one.
function normalizeRavageCounterState(ravageCounter) {
  if (!ravageCounter || typeof ravageCounter !== "object") return null;

  const queuedRaw = Array.isArray(ravageCounter.queued) ? ravageCounter.queued : [];
  const queued = queuedRaw
    .map((entry) => ({
      land: isLandId(entry && entry.land) ? entry.land : null,
      remaining: Math.max(0, Math.floor((entry && entry.remaining) || 0))
    }))
    // A bad queue entry is dropped on its own rather than voiding the whole effect.
    .filter((entry) => entry.land && entry.remaining > 0);

  const land = isLandId(ravageCounter.land) ? ravageCounter.land : null;
  const remaining = Math.max(0, Math.floor(ravageCounter.remaining || 0));
  const defeated = Math.max(0, Math.floor(ravageCounter.defeated || 0));

  // If the active land is gone but the queue is not, promote the next one instead of
  // dropping a counterattack the player is still owed.
  if (!land || remaining <= 0) {
    if (queued.length === 0) return null;
    const next = queued.shift();
    return { land: next.land, remaining: next.remaining, defeated, queued };
  }

  return { land, remaining, defeated, queued };
}

function normalizeDefeatFx(defeatFx) {
  if (!defeatFx || typeof defeatFx !== "object") return null;
  const land = isLandId(defeatFx.land) ? defeatFx.land : null;
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
  if (!isLandId(land) || c <= 0) return;
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
  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  if (presencePlacement) return t.finishPresencePlacementFirst;
  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  if (ravageCounter) return t.finishRavageCounterFirst;
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
    spirit: {
      activeSpiritId: "core_spirit_01",
      unlockedSpiritIds: ["core_spirit_01"],
      growthLevel: 0
    },
    ui: {
      language: "de",
      defeatFx: null,
      selectedLand: null
    },
    tracks: {
      energy: { revealed: 0 },
      cardPlays: { revealed: 0 }
    },
    turn: {
      number: 1,
      selectedGrowthOption: "",
      invaderStep: INVADER_STEPS[0],
      powerCardsGained: 0,
      presencesPlaced: 0,
      powerCardsPlayed: 0,
      cardPlaysUsed: 0,
      regainUsed: false,
      energyIncomePaid: false
    },
    invader: normalizeInvaderPhases({
      ravage: null,
      build: null,
      explore: drawInvaderTerrain()
    }),
    invaders: createInvaderCounts(),
    invaderDamage: createInvaderDamage(),
    dahan: createDahanCounts(),
    presence: createPresenceCounts(),
    essence: createEssencePools(),
    essenceProgress: createEssenceProgress(),
    effects: {
      washAway: null,
      flashFloods: null,
      riversBounty: null,
      presencePlacement: null,
      ravageCounter: null
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
  addStartingPresence(state);
  return state;
}

/* ------------------------------------------------------------------ *
 * Migration: 1.5.0 kept board state under terrain keys, before lands   *
 * existed. Split each terrain's value across the two lands that now    *
 * carry that terrain.                                                  *
 * ------------------------------------------------------------------ */

function looksTerrainKeyed(map) {
  if (!map || typeof map !== "object") return false;
  const keys = Object.keys(map);
  if (keys.length === 0) return false;
  return keys.some((key) => INVADER_TERRAINS.includes(key)) && !keys.some((key) => isLandId(key));
}

// Half to each land, odd token to the coastal one. Deterministic, so a save migrates the
// same way every time it is loaded.
function splitAcrossTerrainLands(total, terrain) {
  const lands = landsOfTerrain(terrain);
  const amount = Math.max(0, Math.floor(total || 0));
  const out = {};
  if (lands.length === 0) return out;

  const each = Math.floor(amount / lands.length);
  let remainder = amount - each * lands.length;

  // Coastal first, so the remainder lands where the invaders actually arrive.
  const ordered = [...lands].sort((a, b) => Number(landIsCoastal(b)) - Number(landIsCoastal(a)));
  for (const landId of ordered) {
    out[landId] = each + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return out;
}

function migrateNumberMapToLands(map) {
  const out = createLandMap(() => 0);
  for (const terrain of INVADER_TERRAINS) {
    const split = splitAcrossTerrainLands(map[terrain], terrain);
    for (const landId of Object.keys(split)) out[landId] = split[landId];
  }
  return out;
}

function migrateUnitMapToLands(map) {
  const out = createInvaderCounts();
  for (const terrain of INVADER_TERRAINS) {
    const slot = map[terrain] || {};
    for (const type of ["explorers", "towns", "cities"]) {
      const split = splitAcrossTerrainLands(slot[type], terrain);
      for (const landId of Object.keys(split)) out[landId][type] = split[landId];
    }
  }
  return out;
}

function migrateBoardShape(state) {
  if (!state || typeof state !== "object") return state;

  const needsMigration = looksTerrainKeyed(state.invaders)
    || looksTerrainKeyed(state.dahan)
    || looksTerrainKeyed(state.presence);
  if (!needsMigration) return state;

  if (looksTerrainKeyed(state.invaders)) state.invaders = migrateUnitMapToLands(state.invaders);
  if (looksTerrainKeyed(state.invaderDamage)) state.invaderDamage = migrateUnitMapToLands(state.invaderDamage);
  if (looksTerrainKeyed(state.dahan)) state.dahan = migrateNumberMapToLands(state.dahan);
  if (looksTerrainKeyed(state.presence)) state.presence = migrateNumberMapToLands(state.presence);

  // Fractional seconds are not worth a migration rule, and `essence` was already
  // terrain-keyed, so it carries over untouched.
  state.essenceProgress = createEssenceProgress();

  // Effects hold terrain references mid-interaction. Dropping them costs at most one
  // in-flight card and is the only safe option.
  state.effects = { washAway: null, flashFloods: null, riversBounty: null, presencePlacement: null, ravageCounter: null };
  if (state.ui) {
    state.ui.defeatFx = null;
    state.ui.selectedLand = null;
  }

  return state;
}

function normalizeState(state) {
  migrateBoardShape(state);
  const base = createInitialState();
  const merged = {
    ...base,
    ...state,
    time: { ...base.time, ...(state.time || {}) },
    resources: { ...base.resources, ...(state.resources || {}) },
    spirit: { ...base.spirit, ...(state.spirit || {}) },
    tracks: { ...base.tracks, ...(state.tracks || {}) },
    ui: { ...base.ui, ...(state.ui || {}) },
    turn: { ...base.turn, ...(state.turn || {}) },
    invader: { ...base.invader, ...(state.invader || {}) },
    invaders: { ...base.invaders, ...(state.invaders || {}) },
    invaderDamage: { ...base.invaderDamage, ...(state.invaderDamage || {}) },
    dahan: { ...base.dahan, ...(state.dahan || {}) },
    presence: { ...base.presence, ...(state.presence || {}) },
    essence: { ...base.essence, ...(state.essence || {}) },
    essenceProgress: { ...base.essenceProgress, ...(state.essenceProgress || {}) },
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
  merged.ui.selectedLand = isLandId(merged.ui.selectedLand) ? merged.ui.selectedLand : null;

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
  merged.turn.invaderStep = INVADER_STEPS.includes(merged.turn.invaderStep) || merged.turn.invaderStep === INVADER_STEP_DONE
    ? merged.turn.invaderStep
    : INVADER_STEPS[0];
  merged.turn.powerCardsGained = Math.max(0, Math.floor(merged.turn.powerCardsGained || 0));
  merged.turn.presencesPlaced = Math.max(0, Math.floor(merged.turn.presencesPlaced || 0));
  merged.turn.powerCardsPlayed = Math.max(0, Math.floor(merged.turn.powerCardsPlayed || 0));
  merged.turn.cardPlaysUsed = Math.max(0, Math.floor(merged.turn.cardPlaysUsed || 0));
  merged.turn.regainUsed = merged.turn.regainUsed === true;
  merged.turn.energyIncomePaid = merged.turn.energyIncomePaid === true;

  // Track progress cannot exceed the slots the active spirit actually has.
  const spiritTracks = (SPIRITS[merged.spirit.activeSpiritId] || SPIRITS.core_spirit_01).tracks;
  for (const trackId of TRACK_IDS) {
    const slotCount = spiritTracks[trackId].slots.length;
    const revealed = Math.floor((merged.tracks[trackId] && merged.tracks[trackId].revealed) || 0);
    merged.tracks[trackId] = { revealed: clamp(revealed, 0, slotCount) };
  }

  merged.invader = normalizeInvaderPhases(merged.invader);
  merged.invaders = normalizeInvaderCounts(merged.invaders);
  merged.invaderDamage = clampInvaderDamageByCounts(merged.invaders, merged.invaderDamage);
  merged.dahan = normalizeDahanCounts(merged.dahan);
  merged.presence = normalizePresenceCounts(merged.presence);
  merged.essence = normalizeEssencePools(merged.essence);
  merged.essenceProgress = normalizeEssenceProgress(merged.essenceProgress);
  merged.effects.washAway = normalizeWashAwayState(merged.effects.washAway);
  merged.effects.flashFloods = normalizeFlashFloodsState(merged.effects.flashFloods);
  merged.effects.riversBounty = normalizeRiversBountyState(merged.effects.riversBounty);
  merged.effects.presencePlacement = normalizePresencePlacementState(merged.effects.presencePlacement);
  merged.effects.ravageCounter = normalizeRavageCounterState(merged.effects.ravageCounter);

  merged.schemaVersion = VERSION;
  return merged;
}

function activeSpirit(state) {
  return SPIRITS[state.spirit.activeSpiritId] || SPIRITS.core_spirit_01;
}

function trackDefinition(state, trackId) {
  return activeSpirit(state).tracks[trackId];
}

function trackRevealed(state, trackId) {
  return Math.max(0, Math.floor((state.tracks[trackId] && state.tracks[trackId].revealed) || 0));
}

// Presence still sitting on a track, i.e. how many placements it can still supply.
function trackPresenceLeft(state, trackId) {
  return trackDefinition(state, trackId).slots.length - trackRevealed(state, trackId);
}

// Index of the only slot the player may take from: the leftmost still covered.
function nextTrackSlotIndex(state, trackId) {
  return trackPresenceLeft(state, trackId) > 0 ? trackRevealed(state, trackId) : -1;
}

function totalPresenceLeftOnTracks(state) {
  return TRACK_IDS.reduce((sum, trackId) => sum + trackPresenceLeft(state, trackId), 0);
}

// The active value of a track is the rightmost revealed number. The Regain slot carries
// no number, so it is skipped when reading the card play limit.
function trackValue(state, trackId) {
  const def = trackDefinition(state, trackId);
  const revealed = trackRevealed(state, trackId);

  let value = def.open;
  for (let i = 0; i < revealed; i += 1) {
    if (typeof def.slots[i] === "number") value = def.slots[i];
  }
  return value;
}

function energyPerTurn(state) {
  return trackValue(state, "energy");
}

function cardPlayLimit(state) {
  return trackValue(state, "cardPlays");
}

function regainUnlocked(state) {
  const def = trackDefinition(state, "cardPlays");
  const revealed = trackRevealed(state, "cardPlays");
  return def.slots.slice(0, revealed).includes("regain");
}

function regainAvailable(state) {
  return regainUnlocked(state)
    && !state.turn.regainUsed
    && state.cards.discardPile.length > 0;
}

function trackLabel(state, trackId) {
  const t = locale(state);
  return trackId === "energy" ? t.energyTrackLabel : t.cardPlaysTrackLabel;
}

// Slot text, with the Regain symbol standing in for the value it has no number for.
function trackSlotLabel(state, trackId, slotIndex) {
  const value = trackDefinition(state, trackId).slots[slotIndex];
  return value === "regain" ? locale(state).regainSymbol : String(value);
}

function addLog(state, text) {
  if (!state._log) state._log = [];
  state._log.unshift(`${new Date().toLocaleTimeString()} - ${text}`);
  state._log = state._log.slice(0, 20);
}

// The terrain a phase names, e.g. "Dschungel".
function terrainName(state, terrain) {
  const t = locale(state);
  if (!terrain) return t.invaderNone;
  return t.invaderLandNames[terrain] || terrain;
}

// A land, e.g. "Gebiet 3 · Dschungel". Log lines and headings both read this.
function landName(state, landId) {
  const t = locale(state);
  if (!isLandId(landId)) return t.invaderNone;
  return template(t.landDisplay, { id: landId, terrain: terrainName(state, landTerrain(landId)) });
}

// The list of lands a phase's terrain covers, e.g. "Gebiet 3, Gebiet 5".
function terrainLandsSummary(state, terrain) {
  const t = locale(state);
  const lands = landsOfTerrain(terrain);
  if (lands.length === 0) return t.invaderNone;
  return lands.map((landId) => template(t.landShort, { id: landId })).join(", ");
}

// Essence is named by terrain, so both lands of a terrain feed the same pool.
function essenceName(state, terrain) {
  const t = locale(state);
  return t.essenceNames[terrain] || t.essenceLabel;
}

function landEssenceName(state, landId) {
  return essenceName(state, landTerrain(landId));
}

function invaderStepLabel(state, step) {
  const t = locale(state);
  if (step === "ravage") return t.ravageWord;
  if (step === "build") return t.buildWord;
  if (step === "explore") return t.discoverWord;
  return "";
}

// The terrain a given phase will act on this turn. Both of that terrain's lands resolve.
function invaderStepTerrain(state, step) {
  if (step === "ravage") return state.invader.ravage;
  if (step === "build") return state.invader.build;
  if (step === "explore") return state.invader.explore;
  return null;
}

// Every land the pending phase will touch.
function invaderStepLands(state, step) {
  const terrain = invaderStepTerrain(state, step);
  return terrain ? landsOfTerrain(terrain) : [];
}

// Discover only seeds explorers into a land that is coastal, or that sits next to a town or
// city. A terrain with no coastal land therefore stays quiet until the invaders reach it.
function landAcceptsExplorer(state, landId) {
  if (landIsCoastal(landId)) return true;
  return adjacentLands(landId).some((neighbour) => {
    const slot = state.invaders[neighbour];
    return Boolean(slot) && ((slot.towns || 0) > 0 || (slot.cities || 0) > 0);
  });
}

// The same preview as phaseTargetText, compressed to fit on a land. The full sentence
// stays in the detail panel, where there is room to read it.
function phaseChipText(state, step, land) {
  const t = locale(state);
  const slot = state.invaders[land] || { explorers: 0, towns: 0, cities: 0 };

  if (step === "ravage") {
    const damage = invaderDamageInLand(slot);
    if (damage <= 0) return t.phaseChipRavageNone;
    const dahan = state.dahan[land] || 0;
    const dahanLost = Math.min(dahan, Math.floor(damage / UNIT_STATS.dahan.health));
    const counter = (dahan - dahanLost) * UNIT_STATS.dahan.damage;
    return template(t.phaseChipRavage, { damage, dahanLost, counter });
  }

  if (step === "build") {
    if (slot.explorers + slot.towns + slot.cities <= 0) return t.phaseChipBuildNone;
    const built = slot.towns > slot.cities ? "cities" : "towns";
    return template(t.phaseChipBuild, { unit: unitLabelByType(state, built) });
  }

  if (step === "explore") {
    return landAcceptsExplorer(state, land) ? t.phaseChipExplore : t.phaseChipExploreBlocked;
  }
  return "";
}

// Preview of what resolving the pending phase will do to this land.
function phaseTargetText(state, step, land) {
  const t = locale(state);
  const slot = state.invaders[land] || { explorers: 0, towns: 0, cities: 0 };

  if (step === "ravage") {
    const damage = invaderDamageInLand(slot);
    if (damage <= 0) return t.phasePreviewRavageNone;

    // Preview the real outcome: Dahan die first, so only the survivors strike back.
    const dahan = state.dahan[land] || 0;
    const dahanLost = Math.min(dahan, Math.floor(damage / UNIT_STATS.dahan.health));
    const counter = (dahan - dahanLost) * UNIT_STATS.dahan.damage;
    return template(t.phasePreviewRavage, { damage, dahanLost, counter });
  }

  if (step === "build") {
    const total = slot.explorers + slot.towns + slot.cities;
    if (total <= 0) return t.phasePreviewBuildNone;
    const built = slot.towns > slot.cities ? "cities" : "towns";
    return template(t.phasePreviewBuild, { unit: unitLabelByType(state, built) });
  }

  if (step === "explore") {
    return landAcceptsExplorer(state, land) ? t.phasePreviewExplore : t.phasePreviewExploreBlocked;
  }
  return "";
}

// Total damage the invaders in a land deal during Ravage.
function invaderDamageInLand(slot) {
  return (slot.explorers || 0) * UNIT_STATS.explorers.damage
    + (slot.towns || 0) * UNIT_STATS.towns.damage
    + (slot.cities || 0) * UNIT_STATS.cities.damage;
}

// Dahan absorb damage in whole units: each one soaks its full health before the next falls.
function applyDamageToDahan(state, land, damage) {
  state.dahan = normalizeDahanCounts(state.dahan);
  const available = state.dahan[land] || 0;
  const health = UNIT_STATS.dahan.health;
  if (available <= 0 || damage <= 0) return 0;

  const destroyed = Math.min(available, Math.floor(damage / health));
  state.dahan[land] = available - destroyed;
  return destroyed;
}

// Ravage in one land. Returns the counterattack pool the survivors earned, or 0.
function ravageOneLand(state, land) {
  const t = locale(state);
  const damage = invaderDamageInLand(state.invaders[land]);

  if (damage <= 0) {
    addLog(state, template(t.ravageNoInvaders, { land: landName(state, land) }));
    return 0;
  }

  // Invaders strike first. Only the Dahan still standing afterwards counterattack,
  // so enough damage can wipe out a land's defenders before they land a blow.
  const dahanLost = applyDamageToDahan(state, land, damage);
  const survivingDahan = state.dahan[land] || 0;
  const counterDamage = survivingDahan * UNIT_STATS.dahan.damage;

  if (dahanLost > 0) markDefeatFx(state, land, "dahan", dahanLost);

  addLog(
    state,
    template(t.ravageResolved, {
      land: landName(state, land),
      damage,
      dahanLost
    })
  );

  if (counterDamage <= 0) {
    if (survivingDahan <= 0 && dahanLost > 0) {
      addLog(state, template(t.ravageNoSurvivors, { land: landName(state, land) }));
    }
    return 0;
  }

  if (invaderCountInLand(state.invaders[land]) <= 0) {
    addLog(state, template(t.ravageCounterNoTargets, { land: landName(state, land) }));
    return 0;
  }

  return counterDamage;
}

function resolveRavagePhase(state) {
  const t = locale(state);
  const terrain = state.invader.ravage;

  if (!terrain) {
    addLog(state, t.ravageNothing);
    return;
  }

  state.invaders = normalizeInvaderCounts(state.invaders);

  // A phase names a terrain, so every land of that terrain ravages, lowest id first.
  const pending = [];
  for (const land of landsOfTerrain(terrain)) {
    const counterDamage = ravageOneLand(state, land);
    if (counterDamage > 0) pending.push({ land, remaining: counterDamage });
  }

  if (pending.length === 0) return;

  // The player assigns each counterattack, so hand off to a pending targeting effect.
  // More than one land can earn one, and the rest wait in the queue behind the first.
  const [active, ...queued] = pending;
  state.effects.ravageCounter = {
    land: active.land,
    remaining: active.remaining,
    defeated: 0,
    queued
  };
}

// Each click spends 1 point of the counterattack pool on the chosen invader type.
function assignRavageCounterDamage(state, targetType) {
  const counter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  if (!counter) return;
  if (!["explorers", "towns", "cities"].includes(targetType)) return;

  state.invaders = normalizeInvaderCounts(state.invaders);
  if ((state.invaders[counter.land][targetType] || 0) <= 0) return;

  const result = applyDamageToInvaderType(state, counter.land, targetType, 1);
  if (result.consumed <= 0) return;

  counter.remaining -= result.consumed;
  counter.defeated += result.defeated;

  if (result.defeated > 0) markDefeatFx(state, counter.land, targetType, result.defeated);

  state.effects.ravageCounter = counter;

  // Nothing left to spend, or nothing left to spend it on.
  if (counter.remaining <= 0 || invaderCountInLand(state.invaders[counter.land]) <= 0) {
    finishRavageCounter(state);
  }
}

// Closes out the active land, then promotes the next queued land if there is one.
// The effect only clears once every land the Ravage hit has been paid out.
function finishRavageCounter(state) {
  const counter = state.effects && state.effects.ravageCounter;
  if (!counter) return;

  const t = locale(state);
  addLog(
    state,
    template(t.ravageCounterResolved, {
      land: landName(state, counter.land),
      defeated: counter.defeated
    })
  );

  const queued = Array.isArray(counter.queued) ? counter.queued : [];
  if (queued.length > 0) {
    const next = queued[0];
    state.effects.ravageCounter = {
      land: next.land,
      remaining: next.remaining,
      defeated: 0,
      queued: queued.slice(1)
    };
    addLog(state, template(t.ravageCounterNext, { land: landName(state, next.land) }));
    return;
  }

  state.effects.ravageCounter = null;
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
    const total = slot.explorers + slot.towns + slot.cities;

    if (total <= 0) {
      addLog(state, template(t.buildNoInvaders, { land: landName(state, land) }));
      continue;
    }

    const built = slot.towns > slot.cities ? "cities" : "towns";
    slot[built] += 1;

    addLog(
      state,
      template(t.buildResolved, {
        land: landName(state, land),
        unit: unitLabelByType(state, built)
      })
    );
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

  // Explorers only land where they can actually get ashore: a coastal land, or one already
  // next to a town or city. Mountains has no coast, so it stays untouched until the
  // invaders have built their way inland.
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

// End of turn: the track slides forward. What was explored this turn is built next
// turn and ravaged the turn after, so the player can see pressure coming.
function shiftInvaderTrack(state) {
  state.invader = normalizeInvaderPhases(state.invader);

  const shiftedToRavage = state.invader.build;
  const shiftedToBuild = state.invader.explore;
  const nextDiscover = drawInvaderTerrainExcluding([shiftedToRavage, shiftedToBuild]);

  state.invader.ravage = shiftedToRavage;
  state.invader.build = shiftedToBuild;
  state.invader.explore = nextDiscover;

  const t = locale(state);
  addLog(
    state,
    template(t.invaderPhaseLog, {
      ravage: terrainName(state, state.invader.ravage),
      build: terrainName(state, state.invader.build),
      discover: terrainName(state, state.invader.explore)
    })
  );
}

function addRoundStartDahan(state) {
  state.dahan = normalizeDahanCounts(state.dahan);

  const added = createDahanCounts();
  let remaining = DAHAN_AT_SETUP;

  while (remaining > 0) {
    const eligible = LAND_IDS.filter((landId) => added[landId] < DAHAN_MAX_ADD_PER_AREA);
    if (eligible.length === 0) break;
    const landId = eligible[Math.floor(Math.random() * eligible.length)];
    added[landId] += 1;
    state.dahan[landId] += 1;
    remaining -= 1;
  }

  const summary = LAND_IDS
    .filter((landId) => added[landId] > 0)
    .map((landId) => `${landName(state, landId)} +${added[landId]}`)
    .join(", ");

  if (summary) {
    addLog(state, template(locale(state).dahanRoundLog, { summary }));
  }
}

function addStartingPresence(state) {
  state.presence = normalizePresenceCounts(state.presence);

  const startingPresence = activeSpirit(state).startingPresence || {};
  const added = normalizePresenceCounts(startingPresence);

  for (const landId of LAND_IDS) {
    state.presence[landId] += added[landId];
    state.turn.presencesPlaced += added[landId];
  }

  const summary = LAND_IDS
    .filter((landId) => added[landId] > 0)
    .map((landId) => `${landName(state, landId)} +${added[landId]}`)
    .join(", ");

  if (summary) {
    addLog(state, template(locale(state).startingPresenceLog, { summary }));
  }
}

// Range: Presence 0. The gather target must be a land the spirit already occupies.
function riversBountyLegalDestination(state, land) {
  return isLandId(land) && landsInRange(state, 0).has(land);
}

// Gather pulls Dahan in from adjacent lands.
function riversBountyLegalSource(state, land) {
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (!riversBounty || !riversBounty.destination) return false;
  if (!areAdjacent(riversBounty.destination, land)) return false;
  return (state.dahan[land] || 0) > 0;
}

function startRiversBounty(state) {
  state.dahan = normalizeDahanCounts(state.dahan);

  const destinations = LAND_IDS.filter((land) => riversBountyLegalDestination(state, land));
  if (destinations.length === 0) {
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
  if (!riversBountyLegalDestination(state, destination)) return;
  const riversBounty = normalizeRiversBountyState(state.effects.riversBounty);
  if (!riversBounty || riversBounty.step !== "choose-destination") return;

  riversBounty.step = "choose-sources";
  riversBounty.destination = destination;
  riversBounty.moved = 0;
  riversBounty.pulledFrom = createDahanCounts();
  state.effects.riversBounty = riversBounty;
}

function gatherRiversBountyFrom(state, source) {
  if (!isLandId(source)) return;
  const riversBounty = normalizeRiversBountyState(state.effects.riversBounty);
  if (!riversBounty || riversBounty.step !== "choose-sources" || !riversBounty.destination) return;
  if (source === riversBounty.destination) return;
  // Gather only reaches the destination's neighbours.
  if (!areAdjacent(riversBounty.destination, source)) return;
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
      to: landName(state, destination)
    })
  );

  if ((state.dahan[destination] || 0) >= 2) {
    state.dahan[destination] += 1;
    state.resources.energy += 1;
    addLog(
      state,
      template(t.riversBountyBonus, { to: landName(state, destination) })
    );
  }

  state.effects.riversBounty = null;
}

// Range: Presence 1. The damaged land must sit within one step of the spirit's presence.
function flashFloodsLegalLand(state, land) {
  if (!isLandId(land)) return false;
  if (!landsInRange(state, 1).has(land)) return false;
  return invaderCountInLand(state.invaders[land]) > 0;
}

function startFlashFloods(state) {
  state.invaders = normalizeInvaderCounts(state.invaders);

  const targets = LAND_IDS.filter((land) => flashFloodsLegalLand(state, land));
  if (targets.length === 0) {
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
  const flashFloods = normalizeFlashFloodsState(state.effects.flashFloods);
  if (!flashFloods || flashFloods.step !== "choose-land") return;
  if (!flashFloodsLegalLand(state, land)) return;

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
  // The card's wetlands bonus reads the land's terrain, so it fires in either wetland land.
  const remainingAfterHit = landTerrain(land) === "wetlands" ? 1 : 0;
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
      land: landName(state, land),
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
      land: landName(state, land),
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

// Range: Presence 1 constrains the source. Push itself always moves to a neighbour.
function washAwayLegalSource(state, land) {
  if (!isLandId(land)) return false;
  if (!landsInRange(state, 1).has(land)) return false;
  return pushableCount(state.invaders[land]) > 0;
}

function washAwayLegalDestination(state, land) {
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (!washAway || !washAway.source) return false;
  return areAdjacent(washAway.source, land);
}

function startWashAway(state) {
  state.invaders = normalizeInvaderCounts(state.invaders);

  const sources = LAND_IDS.filter((land) => washAwayLegalSource(state, land));
  if (sources.length === 0) {
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
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-source") return;
  if (!washAwayLegalSource(state, source)) return;

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
  const washAway = normalizeWashAwayState(state.effects.washAway);
  if (!washAway || washAway.step !== "choose-destination" || !washAway.source) return;
  if (destination === washAway.source) return;
  // Push moves one land, never across the island.
  if (!washAwayLegalDestination(state, destination)) return;

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
      from: landName(state, washAway.source),
      to: landName(state, destination),
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
  if (!invaderPhasesComplete(state)) {
    addLog(state, t.invaderPhasesRequired);
    return;
  }
  if (state.turn.cardPlaysUsed >= cardPlayLimit(state)) {
    addLog(state, template(t.cardPlayLimitReached, { limit: cardPlayLimit(state) }));
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
  state.turn.cardPlaysUsed += 1;
  card.play(state);
  state.cards.discardPile.push(cardId);
}

// Regain returns one chosen card from the discard. It is optional, costs no card play,
// and expires unused at end turn.
function regainCard(state, discardIndex) {
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
  if (!invaderPhasesComplete(state)) {
    addLog(state, t.invaderPhasesRequired);
    return;
  }
  if (!regainAvailable(state)) return;

  const cardId = state.cards.discardPile[discardIndex];
  if (!cardId || !CARD_LIBRARY[cardId]) return;

  state.cards.discardPile.splice(discardIndex, 1);
  state.cards.hand.push(cardId);
  state.turn.regainUsed = true;

  addLog(state, template(t.regainResolved, { card: cardDisplayName(state, CARD_LIBRARY[cardId]) }));
}

// Every land runs its own generator off its own presence, and deposits into its terrain's
// pool. Two lands of a terrain therefore add up: spreading presence across both is faster
// than stacking it in one, which is what makes the board worth playing on.
function advanceEssence(state, dt) {
  for (const land of LAND_IDS) {
    const seconds = essenceSecondsPerUnit(state.presence[land]);

    // A land with no presence generates nothing and holds no partial progress.
    if (seconds <= 0) {
      state.essenceProgress[land] = 0;
      continue;
    }

    const terrain = landTerrain(land);
    state.essenceProgress[land] += dt;
    while (state.essenceProgress[land] >= seconds) {
      state.essenceProgress[land] -= seconds;
      state.essence[terrain] += 1;
    }
  }
}

function tick(state, dt) {
  state.time.totalSeconds += dt;

  advanceEssence(state, dt);
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
  islandSvg: document.getElementById("islandSvg"),
  landChips: document.getElementById("landChips"),
  landDetail: document.getElementById("landDetail"),
  essenceRail: document.getElementById("essenceRail"),
  invaderTrackTitle: document.getElementById("invaderTrackTitle"),
  ravageLabel: document.getElementById("ravageLabel"),
  buildLabel: document.getElementById("buildLabel"),
  discoverLabel: document.getElementById("discoverLabel"),
  ravageArea: document.getElementById("ravageArea"),
  buildArea: document.getElementById("buildArea"),
  discoverArea: document.getElementById("discoverArea"),
  invaderTrackHint: document.getElementById("invaderTrackHint"),
  ravagePhaseBtn: document.getElementById("ravagePhaseBtn"),
  buildPhaseBtn: document.getElementById("buildPhaseBtn"),
  discoverPhaseBtn: document.getElementById("discoverPhaseBtn"),
  ravagePhaseState: document.getElementById("ravagePhaseState"),
  buildPhaseState: document.getElementById("buildPhaseState"),
  discoverPhaseState: document.getElementById("discoverPhaseState"),
  executeAllPhasesBtn: document.getElementById("executeAllPhasesBtn"),
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
  tracksTitle: document.getElementById("tracksTitle"),
  tracksHint: document.getElementById("tracksHint"),
  spiritTracks: document.getElementById("spiritTracks"),
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
  mapSignature: "",
  tracksSignature: ""
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
  dom.executeAllPhasesBtn.textContent = t.executeAllPhasesBtn;
  dom.tracksTitle.textContent = t.tracksTitle;
  dom.tracksHint.textContent = t.tracksHint;
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

function tracksSignature(state) {
  const placement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  const placementSig = placement ? `${placement.step}:${placement.track || "-"}:${placement.remaining}` : "none";
  return [
    currentLang(state),
    trackRevealed(state, "energy"),
    trackRevealed(state, "cardPlays"),
    state.turn.cardPlaysUsed,
    state.turn.regainUsed ? "1" : "0",
    regainAvailable(state) ? "r" : "-",
    placementSig
  ].join("|");
}

function renderSpiritTracks(state) {
  const t = locale(state);
  const placement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  const choosingTrack = Boolean(placement && placement.step === "choose-track");
  dom.spiritTracks.innerHTML = "";

  for (const trackId of TRACK_IDS) {
    const def = trackDefinition(state, trackId);
    const revealed = trackRevealed(state, trackId);
    const nextIndex = nextTrackSlotIndex(state, trackId);
    const selectable = choosingTrack && nextIndex >= 0;

    const row = document.createElement("div");
    row.className = "track-row";

    const slots = [`<span class="track-slot track-slot-open">${def.open}</span>`];
    def.slots.forEach((value, index) => {
      const isRevealed = index < revealed;
      const isNext = index === nextIndex;
      const label = value === "regain" ? t.regainSymbol : String(value);

      const classes = ["track-slot"];
      if (isRevealed) classes.push("track-slot-revealed");
      else classes.push("track-slot-covered");
      if (value === "regain") classes.push("track-slot-regain");
      if (isRevealed && value === "regain" && regainAvailable(state)) classes.push("track-slot-regain-ready");
      if (isNext) classes.push("track-slot-next");

      // Only the leftmost covered slot is ever a valid pick, and only mid-placement.
      if (isNext && selectable) {
        slots.push(`<button class="${classes.join(" ")}" data-track-id="${trackId}" title="${label}">${label}</button>`);
      } else {
        slots.push(`<span class="${classes.join(" ")}">${label}</span>`);
      }
    });

    const current = trackId === "energy"
      ? template(t.trackCurrentEnergy, { value: energyPerTurn(state) })
      : template(t.trackCurrentCardPlays, { used: state.turn.cardPlaysUsed, limit: cardPlayLimit(state) });

    row.innerHTML = `
      <div class="track-head">
        <strong>${trackLabel(state, trackId)}</strong>
        <span class="track-current">${current}</span>
      </div>
      <div class="track-slots ${selectable ? "track-slots-selectable" : ""}">${slots.join("")}</div>
      <small class="track-left">${template(t.trackPresenceLeft, { left: trackPresenceLeft(state, trackId) })}</small>
    `;

    dom.spiritTracks.appendChild(row);
  }
}

function handSignature(state) {
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  const washAwaySig = washAway
    ? `${washAway.step}:${washAway.source || "-"}:${washAway.explorers}:${washAway.towns}`
    : "none";
  const flashFloodsSig = flashFloods
    ? `${flashFloods.step}:${flashFloods.land || "-"}`
    : "none";
  const riversBountySig = riversBounty
    ? `${riversBounty.step}:${riversBounty.destination || "-"}:${riversBounty.moved}`
    : "none";
  const presencePlacementSig = presencePlacement ? `${presencePlacement.step}:${presencePlacement.remaining}` : "none";
  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  const ravageCounterSig = ravageCounter ? `${ravageCounter.land}:${ravageCounter.remaining}` : "none";
  const playSig = `${state.turn.cardPlaysUsed}/${cardPlayLimit(state)}:${regainAvailable(state) ? "r" : "-"}`;
  return `${currentLang(state)}|${state.turn.selectedGrowthOption || "-"}|${state.turn.invaderStep}|${state.cards.hand.join(",")}|${state.cards.discardPile.join(",")}|${Math.floor(state.resources.energy)}|${playSig}|${washAwaySig}|${flashFloodsSig}|${riversBountySig}|${presencePlacementSig}|${ravageCounterSig}`;
}

function startPresencePlacement(state, total) {
  // Presence comes off the tracks, so an exhausted spirit simply cannot place.
  const available = totalPresenceLeftOnTracks(state);
  if (available <= 0) {
    addLog(state, locale(state).presenceNoneLeft);
    return;
  }

  state.effects.presencePlacement = {
    step: "choose-track",
    track: null,
    remaining: Math.min(total, available),
    placed: createPresenceCounts()
  };
}

// Step 1: take the leftmost still-covered slot from the chosen track.
function choosePresenceTrack(state, trackId) {
  if (!TRACK_IDS.includes(trackId)) return;
  const presencePlacement = normalizePresencePlacementState(state.effects.presencePlacement);
  if (!presencePlacement || presencePlacement.step !== "choose-track") return;
  if (trackPresenceLeft(state, trackId) <= 0) return;

  presencePlacement.step = "choose-land";
  presencePlacement.track = trackId;
  state.effects.presencePlacement = presencePlacement;
}

// Growth places presence within range 1 of presence the spirit already holds, so the
// island is grown outward rather than dropped into freely.
function presencePlacementLegalLand(state, land) {
  return isLandId(land) && landsInRange(state, 1).has(land);
}

// Step 2: drop that presence onto a land, which reveals the slot behind it.
function placePresence(state, land) {
  const presencePlacement = normalizePresencePlacementState(state.effects.presencePlacement);
  if (!presencePlacement || presencePlacement.step !== "choose-land" || !presencePlacement.track) return;
  if (!presencePlacementLegalLand(state, land)) return;

  const trackId = presencePlacement.track;
  if (trackPresenceLeft(state, trackId) <= 0) return;

  state.presence = normalizePresenceCounts(state.presence);
  state.presence[land] += 1;
  state.turn.presencesPlaced += 1;
  state.tracks[trackId].revealed += 1;

  presencePlacement.placed[land] += 1;
  presencePlacement.remaining -= 1;
  presencePlacement.track = null;
  presencePlacement.step = "choose-track";
  state.effects.presencePlacement = presencePlacement;

  addLog(
    state,
    template(locale(state).presenceRevealed, {
      track: trackLabel(state, trackId),
      land: landName(state, land),
      value: trackSlotLabel(state, trackId, trackRevealed(state, trackId) - 1)
    })
  );

  // Stop early if the tracks ran dry mid-placement.
  if (presencePlacement.remaining <= 0 || totalPresenceLeftOnTracks(state) <= 0) {
    finishPresencePlacement(state);
  }
}

function finishPresencePlacement(state) {
  const presencePlacement = state.effects.presencePlacement;
  if (!presencePlacement) return;

  const t = locale(state);
  const summary = LAND_IDS
    .filter((land) => presencePlacement.placed[land] > 0)
    .map((land) => `${landName(state, land)} +${presencePlacement.placed[land]}`)
    .join(", ");

  if (summary) {
    addLog(state, template(t.presencePlacementResolved, { summary }));
  }

  state.effects.presencePlacement = null;
  payEnergyIncomeIfDue(state);
}

// Pays the energy track once per turn, but only after growth is fully settled: while
// presence is still being placed the track value can still change.
function payEnergyIncomeIfDue(state) {
  if (state.turn.energyIncomePaid) return;
  if (!state.turn.selectedGrowthOption) return;
  if (normalizePresencePlacementState(state.effects && state.effects.presencePlacement)) return;

  const income = energyPerTurn(state);
  state.resources.energy += income;
  state.turn.energyIncomePaid = true;
  addLog(state, template(locale(state).energyIncome, { amount: income }));
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
    startPresencePlacement(state, 2);
  } else if (optionId === "power_and_presence") {
    state.turn.powerCardsGained += 1;
    startPresencePlacement(state, 1);
  }

  addLog(state, template(t.growthPicked, { turn: state.turn.number, option: growthOptionLabel(state, optionId) }));

  // Income waits until any presence placement has finished, so a presence taken off the
  // energy track pays its newly revealed value this turn rather than next.
  payEnergyIncomeIfDue(state);
}

function invaderPhasesComplete(state) {
  return state.turn.invaderStep === INVADER_STEP_DONE;
}

// Shared gate for anything that must wait until growth is chosen and no effect is mid-flow.
function invaderStepBlockedMessage(state) {
  const t = locale(state);
  const pendingMessage = currentPendingEffectMessage(state);
  if (pendingMessage) return pendingMessage;
  if (!state.turn.selectedGrowthOption) return t.growthFirstRequired;
  return "";
}

function resolveInvaderStep(state, step) {
  const t = locale(state);

  const blocked = invaderStepBlockedMessage(state);
  if (blocked) {
    addLog(state, blocked);
    return false;
  }

  if (invaderPhasesComplete(state)) {
    addLog(state, t.invaderPhasesAlreadyDone);
    return false;
  }

  // The phases are strictly ordered, so a click on a later one is rejected outright.
  if (step !== state.turn.invaderStep) {
    addLog(state, template(t.invaderStepOutOfOrder, { step: invaderStepLabel(state, state.turn.invaderStep) }));
    return false;
  }

  if (step === "ravage") resolveRavagePhase(state);
  else if (step === "build") resolveBuildPhase(state);
  else if (step === "explore") resolveExplorePhase(state);

  const nextIndex = INVADER_STEPS.indexOf(step) + 1;
  state.turn.invaderStep = nextIndex < INVADER_STEPS.length ? INVADER_STEPS[nextIndex] : INVADER_STEP_DONE;
  return true;
}

function resolveAllInvaderSteps(state) {
  const blocked = invaderStepBlockedMessage(state);
  if (blocked) {
    addLog(state, blocked);
    return;
  }

  if (invaderPhasesComplete(state)) {
    addLog(state, locale(state).invaderPhasesAlreadyDone);
    return;
  }

  while (!invaderPhasesComplete(state)) {
    if (!resolveInvaderStep(state, state.turn.invaderStep)) break;
  }
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
  if (!invaderPhasesComplete(state)) {
    addLog(state, t.invaderPhasesRequired);
    return;
  }
  const oldTurn = state.turn.number;
  state.turn.number += 1;
  state.turn.selectedGrowthOption = "";
  state.turn.invaderStep = INVADER_STEPS[0];
  state.turn.powerCardsPlayed = 0;
  state.turn.cardPlaysUsed = 0;
  state.turn.regainUsed = false;
  state.turn.energyIncomePaid = false;
  state.invaderDamage = createInvaderDamage();
  shiftInvaderTrack(state);
  addLog(state, template(t.endTurnLog, { turn: oldTurn, nextTurn: state.turn.number }));
}

function renderHand(state) {
  const t = locale(state);
  const pendingTargeting = hasPendingTargetingEffect(state);
  const needsGrowthChoice = !state.turn.selectedGrowthOption;
  const needsInvaderPhases = !invaderPhasesComplete(state);
  dom.handCards.innerHTML = "";

  if (state.cards.hand.length === 0 && state.cards.discardPile.length === 0) {
    dom.handCards.innerHTML = `<div class='hint'>${t.noCardsInHand}</div>`;
    return;
  }

  const ordered = [
    ...state.cards.hand.map((cardId, handIndex) => ({ cardId, handIndex, discardIndex: -1, used: false })),
    ...state.cards.discardPile.map((cardId, discardIndex) => ({ cardId, handIndex: -1, discardIndex, used: true }))
  ];

  const canRegain = regainAvailable(state) && !pendingTargeting && !needsGrowthChoice && !needsInvaderPhases;
  const atPlayLimit = state.turn.cardPlaysUsed >= cardPlayLimit(state);

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
      && !needsInvaderPhases
      && !atPlayLimit
      && state.resources.energy >= card.cost;
    if (!playable) item.classList.add("card-unplayable");

    let statusText = t.cardReadyStatus;
    if (entry.used) {
      statusText = canRegain ? t.cardRegainableStatus : t.cardUsedStatus;
    } else if (pendingTargeting) {
      statusText = t.cardNeedTargetingStatus;
    } else if (needsGrowthChoice) {
      statusText = t.cardNeedGrowthStatus;
    } else if (needsInvaderPhases) {
      statusText = t.cardNeedInvaderPhasesStatus;
    } else if (atPlayLimit) {
      statusText = t.cardPlayLimitStatus;
    } else if (state.resources.energy < card.cost) {
      statusText = t.cardNeedEnergyStatus;
    }

    const cardName = cardDisplayName(state, card);

    // Discarded cards become the Regain targets while a regain is banked.
    const actionButton = entry.used
      ? `<button class="play-btn regain-btn" data-regain-index="${entry.discardIndex}" ${canRegain ? "" : "disabled"}>${canRegain ? t.regainBtn : t.reclaimNeededWord}</button>`
      : `<button class="play-btn" data-card-index="${entry.handIndex}" ${playable ? "" : "disabled"}>${t.playWord}</button>`;

    item.innerHTML = `
      <h4>${cardName}</h4>
      <p>${cardPreview(state, card)}</p>
      <small class="card-state">${statusText}</small>
      <div class="card-meta">
        <span>${t.costWord}: ${card.cost} ${t.energyWord}</span>
        ${actionButton}
      </div>
    `;

    dom.handCards.appendChild(item);
  }
}

/* ------------------------------------------------------------------ *
 * Island geometry                                                      *
 *                                                                      *
 * Board space is (u, v): u runs left to right, v runs from the back of  *
 * the board to the ocean edge. Every boundary point is a pure function  *
 * of (u, v), so two lands sharing an edge compute the identical point   *
 * and the seam is exact. Sampling walks a fixed global grid for the     *
 * same reason.                                                          *
 * ------------------------------------------------------------------ */

const SVG_NS = "http://www.w3.org/2000/svg";
const ISLAND_VIEW = { w: 760, h: 500 };
const ISLAND_GEO = { cx: 380, top: 50, height: 352, wBack: 440, wCoast: 632 };
const EDGE_STEP_U = 0.02;
const EDGE_STEP_V = 0.025;

// Fixed sums of sines rather than random jitter: the island has to be the same island on
// every load, or a reader could not learn its shape.
//
// The last term in each axis is deliberately not a multiple of 2*pi over the unit square.
// Without it the warp repeats at the board's edges and the silhouette comes out
// suspiciously symmetric, which reads as a quilt rather than a coastline.
function islandWarp(u, v) {
  const a = u * Math.PI * 2;
  const b = v * Math.PI * 2;
  return [
    18 * Math.sin(a * 1.3 + b * 0.7 + 0.9)
      + 9 * Math.sin(b * 2.1 - 1.4)
      + 6 * Math.sin(a * 2.9 + 2.2)
      + 7 * Math.sin(v * 5.1 + 1.7),
    14 * Math.sin(b * 1.1 + a * 0.9 - 0.4)
      + 7 * Math.sin(a * 2.3 + 1.1)
      + 5 * Math.sin(b * 3.1 - 0.7)
      + 6 * Math.sin(u * 4.3 - 0.8)
  ];
}

// The board widens toward the coast, which is what gives it a wedge silhouette rather than
// a rectangle.
function islandProject(u, v) {
  const halfWidth = (ISLAND_GEO.wBack + (ISLAND_GEO.wCoast - ISLAND_GEO.wBack) * v) / 2;
  const offset = islandWarp(u, v);
  return [
    ISLAND_GEO.cx + (u - 0.5) * halfWidth * 2 + offset[0],
    ISLAND_GEO.top + v * ISLAND_GEO.height + offset[1]
  ];
}

function snap(value) {
  return Math.round(value * 1000) / 1000;
}

function islandEdgeH(u0, u1, v) {
  const direction = u1 > u0 ? 1 : -1;
  const steps = Math.round(Math.abs(u1 - u0) / EDGE_STEP_U);
  const points = [];
  for (let i = 0; i <= steps; i += 1) points.push(islandProject(snap(u0 + direction * i * EDGE_STEP_U), v));
  return points;
}

function islandEdgeV(u, v0, v1) {
  const direction = v1 > v0 ? 1 : -1;
  const steps = Math.round(Math.abs(v1 - v0) / EDGE_STEP_V);
  const points = [];
  for (let i = 0; i <= steps; i += 1) points.push(islandProject(u, snap(v0 + direction * i * EDGE_STEP_V)));
  return points;
}

function pointsToPath(points, close) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) d += `L${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  return close ? `${d}Z` : d;
}

function landPolygon(landId) {
  const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
  return islandEdgeH(u0, u1, v0)
    .concat(islandEdgeV(u1, v0, v1))
    .concat(islandEdgeH(u1, u0, v1))
    .concat(islandEdgeV(u0, v1, v0));
}

function islandPathFor(landId) {
  return pointsToPath(landPolygon(landId), true);
}

// The land's area centroid, not the midpoint of its board-space rectangle. The projection
// widens toward the coast and the warp bends every edge, so the rect midpoint sits visibly
// off-centre in the drawn shape -- most obviously in the coastal lands, whose bottom edge
// is the curved shoreline.
function landCentre(landId) {
  const points = landPolygon(landId);
  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }

  // A degenerate polygon would divide by zero; fall back to the rectangle's midpoint.
  if (Math.abs(twiceArea) < 1e-6) {
    const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
    return islandProject((u0 + u1) / 2, (v0 + v1) / 2);
  }

  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

// The land's own width, as a percentage of the board frame. Lands differ in width by more
// than two to one, so a single chip size either overflows the narrow ones or wastes the
// wide ones. The floor keeps the smallest land's label readable.
function landChipWidthPercent(landId) {
  const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
  const middleV = (v0 + v1) / 2;
  const span = Math.abs(islandProject(u1, middleV)[0] - islandProject(u0, middleV)[0]);
  return Math.max(15, (span / ISLAND_VIEW.w) * 100 * 0.92);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key of Object.keys(attrs || {})) el.setAttribute(key, attrs[key]);
  return el;
}

// The board's shapes never change, so they are built once. Only fills, rings, and the
// overlay chips are repainted per render.
function drawIslandOnce() {
  const svg = dom.islandSvg;
  svg.innerHTML = "";

  const defs = svgEl("defs", {});
  const ocean = svgEl("linearGradient", { id: "oceanGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
  ocean.appendChild(svgEl("stop", { offset: "0", "stop-color": "#14536b" }));
  ocean.appendChild(svgEl("stop", { offset: "1", "stop-color": "#07202e" }));
  defs.appendChild(ocean);
  const shadow = svgEl("filter", { id: "landShadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
  shadow.appendChild(svgEl("feDropShadow", {
    dx: "0", dy: "3", stdDeviation: "5", "flood-color": "#03121a", "flood-opacity": "0.55"
  }));
  defs.appendChild(shadow);
  svg.appendChild(defs);

  // Water fills everything past the coast edge.
  const coast = islandEdgeH(0, 1, 1);
  const water = coast.concat([[ISLAND_VIEW.w + 40, ISLAND_VIEW.h + 40], [-40, ISLAND_VIEW.h + 40]]);
  svg.appendChild(svgEl("path", { d: pointsToPath(water, true), fill: "url(#oceanGrad)" }));

  // Surf: the coastline echoed outward and fading. Spread wide and kept faint, or the
  // nearest ring reads as a hard white outline rather than water.
  const surf = [{ offset: 6, opacity: 0.2, width: 1.6 }, { offset: 15, opacity: 0.12, width: 1.3 }, { offset: 26, opacity: 0.07, width: 1 }];
  for (const ring of surf) {
    svg.appendChild(svgEl("path", {
      d: pointsToPath(coast.map((p) => [p[0], p[1] + ring.offset]), false),
      fill: "none",
      stroke: "#8ed3e6",
      "stroke-opacity": String(ring.opacity),
      "stroke-width": String(ring.width),
      "stroke-linecap": "round"
    }));
  }

  const landLayer = svgEl("g", { filter: "url(#landShadow)" });
  svg.appendChild(landLayer);

  for (const landId of LAND_IDS) {
    const hue = TERRAIN_RGB[landTerrain(landId)];
    const group = svgEl("g", { class: "land-shape", "data-land": landId, tabindex: "0", role: "button" });
    group.appendChild(svgEl("path", {
      d: islandPathFor(landId),
      fill: `rgb(${hue})`,
      "data-role": "fill",
      stroke: `rgb(${hue})`,
      "stroke-opacity": "0.5",
      "stroke-width": "1.2"
    }));
    group.appendChild(svgEl("path", {
      d: islandPathFor(landId),
      fill: "none",
      "data-role": "ring",
      stroke: "transparent",
      "stroke-width": "3",
      "stroke-linejoin": "round"
    }));
    landLayer.appendChild(group);
  }

  // The board's other three borders are cliffs, not coast: nothing lands there.
  for (const edge of [islandEdgeH(0, 1, 0), islandEdgeV(0, 0, 1), islandEdgeV(1, 0, 1)]) {
    svg.appendChild(svgEl("path", {
      d: pointsToPath(edge, false), fill: "none", stroke: "#050f16",
      "stroke-opacity": "0.85", "stroke-width": "5", "stroke-linecap": "round"
    }));
    svg.appendChild(svgEl("path", {
      d: pointsToPath(edge, false), fill: "none", stroke: "#3c5560",
      "stroke-opacity": "0.7", "stroke-width": "1.6", "stroke-linecap": "round"
    }));
  }
}

/* ------------------------------------------------------------------ *
 * Land render states                                                   *
 * ------------------------------------------------------------------ */

// One token per land, driving both the fill and how the chip reads. Precedence matters:
// an active targeting effect always outranks the pending invader phase, because that is
// what the player has to answer next.
function landRenderStates(state) {
  const states = {};
  for (const landId of LAND_IDS) states[landId] = "idle";

  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);

  // Dimming what is out of range teaches the range rule; merely refusing the click does not.
  const markRange = (range, isLegal) => {
    const reach = landsInRange(state, range);
    for (const landId of LAND_IDS) {
      if (!reach.has(landId)) states[landId] = "out";
      else states[landId] = isLegal(landId) ? "legal" : "inrange";
    }
  };

  if (ravageCounter) {
    const waiting = new Set((ravageCounter.queued || []).map((entry) => entry.land));
    for (const landId of LAND_IDS) {
      if (landId === ravageCounter.land) states[landId] = "active";
      else if (waiting.has(landId)) states[landId] = "queued";
      else states[landId] = "out";
    }
    return states;
  }

  if (washAway) {
    if (washAway.step === "choose-source") {
      markRange(1, (landId) => washAwayLegalSource(state, landId));
    } else if (washAway.step === "choose-units") {
      for (const landId of LAND_IDS) states[landId] = landId === washAway.source ? "active" : "out";
    } else {
      for (const landId of LAND_IDS) {
        if (landId === washAway.source) states[landId] = "active";
        else states[landId] = areAdjacent(washAway.source, landId) ? "legal" : "out";
      }
    }
    return states;
  }

  if (flashFloods) {
    if (flashFloods.step === "choose-land") {
      markRange(1, (landId) => flashFloodsLegalLand(state, landId));
    } else {
      for (const landId of LAND_IDS) states[landId] = landId === flashFloods.land ? "active" : "out";
    }
    return states;
  }

  if (riversBounty) {
    if (riversBounty.step === "choose-destination") {
      markRange(0, (landId) => riversBountyLegalDestination(state, landId));
    } else {
      for (const landId of LAND_IDS) {
        if (landId === riversBounty.destination) states[landId] = "active";
        else states[landId] = riversBountyLegalSource(state, landId) ? "legal" : "out";
      }
    }
    return states;
  }

  if (presencePlacement && presencePlacement.step === "choose-land") {
    markRange(1, (landId) => presencePlacementLegalLand(state, landId));
    return states;
  }

  // Nothing pending: show what the next invader phase is about to hit. Both lands of the
  // terrain light up, because both of them resolve.
  const pendingStep = invaderPhasesComplete(state) ? null : state.turn.invaderStep;
  if (pendingStep && !invaderStepBlockedMessage(state)) {
    for (const landId of invaderStepLands(state, pendingStep)) states[landId] = "phase";
  }
  return states;
}

// A click on a legal land resolves the step outright when the step has only one possible
// answer. Steps that still need a choice (which units, which unit type) stay button-driven
// in the detail panel, so a click on the map is never ambiguous.
function landDirectAction(state, landId) {
  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (washAway && washAway.step === "choose-source" && washAwayLegalSource(state, landId)) {
    return () => chooseWashAwaySource(state, landId);
  }
  if (washAway && washAway.step === "choose-destination" && washAwayLegalDestination(state, landId)) {
    return () => chooseWashAwayDestination(state, landId);
  }

  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  if (flashFloods && flashFloods.step === "choose-land" && flashFloodsLegalLand(state, landId)) {
    return () => chooseFlashFloodsLand(state, landId);
  }

  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (riversBounty && riversBounty.step === "choose-destination" && riversBountyLegalDestination(state, landId)) {
    return () => chooseRiversBountyDestination(state, landId);
  }
  if (riversBounty && riversBounty.step === "choose-sources" && riversBountyLegalSource(state, landId)) {
    return () => gatherRiversBountyFrom(state, landId);
  }

  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  if (presencePlacement && presencePlacement.step === "choose-land" && presencePlacementLegalLand(state, landId)) {
    return () => placePresence(state, landId);
  }

  return null;
}

// The detail panel is never empty: it falls back to whatever the pending phase is about to
// hit, so the most urgent land is on screen without the player hunting for it.
function effectiveSelectedLand(state) {
  if (isLandId(state.ui.selectedLand)) return state.ui.selectedLand;

  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  if (ravageCounter) return ravageCounter.land;

  const pendingStep = invaderPhasesComplete(state) ? null : state.turn.invaderStep;
  const phaseLands = pendingStep ? invaderStepLands(state, pendingStep) : [];
  if (phaseLands.length > 0) return phaseLands[0];

  return LAND_IDS[0];
}

/* ------------------------------------------------------------------ *
 * Board painting                                                       *
 * ------------------------------------------------------------------ */

// Fills sit high enough that slate mountains and blue wetlands stay tellable apart against
// a dark ocean. Below roughly 0.4 the two terrains converge into the same blue-grey.
const LAND_STATE_STYLE = {
  idle: { fill: 0.42, ring: "transparent", opacity: 1, chip: 1 },
  phase: { fill: 0.56, ring: "#e76755", opacity: 1, chip: 1 },
  legal: { fill: 0.62, ring: "#8ed3e6", opacity: 1, chip: 1 },
  inrange: { fill: 0.42, ring: "rgba(142, 211, 230, 0.3)", opacity: 1, chip: 1 },
  active: { fill: 0.58, ring: "#f2c45a", opacity: 1, chip: 1 },
  queued: { fill: 0.46, ring: "rgba(231, 103, 85, 0.45)", opacity: 1, chip: 1 },
  out: { fill: 0.16, ring: "transparent", opacity: 0.4, chip: 0.32 }
};

// Sprite ids from index.html. Shapes follow the printed game: stick figure, two buildings,
// three buildings. Colour is set per type in CSS, and the sprite paints with currentColor.
const UNIT_GLYPH = {
  explorers: "si-explorer",
  towns: "si-town",
  cities: "si-city",
  dahan: "si-dahan",
  presence: "si-presence"
};

function tokenIcon(unitType) {
  return `<svg class="tok" aria-hidden="true" focusable="false"><use href="#${UNIT_GLYPH[unitType]}"/></svg>`;
}

function unitGlyph(unitType, count) {
  return `<span class="chip-unit unit-${unitType}">${tokenIcon(unitType)}${count}</span>`;
}

// Ravage reads as threat, Build and Discover as invader growth. Matching the phase controls
// means the colour on the board and the colour on the button agree.
const PHASE_RING = {
  ravage: "#e76755",
  build: "#f2c45a",
  explore: "#f2c45a"
};

// The banner that spells out what the pending phase is about to do here. Without it the
// outline says "something happens in this land" and nothing more.
function chipPhaseMarkup(state, landId) {
  if (invaderPhasesComplete(state)) return "";
  if (hasPendingTargetingEffect(state)) return "";
  if (invaderStepBlockedMessage(state)) return "";

  const step = state.turn.invaderStep;
  if (!invaderStepLands(state, step).includes(landId)) return "";

  return `
    <div class="chip-phase phase-${step}">
      <span class="chip-phase-name">${invaderStepLabel(state, step)}</span>
      <span class="chip-phase-text">${phaseChipText(state, step, landId)}</span>
    </div>
  `;
}

function renderBoard(state) {
  const t = locale(state);
  const states = landRenderStates(state);
  const selected = effectiveSelectedLand(state);
  const defeatFx = activeDefeatFx(state);
  const pendingStep = invaderPhasesComplete(state) ? null : state.turn.invaderStep;

  dom.landChips.innerHTML = "";

  for (const landId of LAND_IDS) {
    const style = LAND_STATE_STYLE[states[landId]] || LAND_STATE_STYLE.idle;
    const group = dom.islandSvg.querySelector(`[data-land="${landId}"]`);
    if (group) {
      group.setAttribute("opacity", String(style.opacity));
      group.querySelector('[data-role="fill"]').setAttribute("fill-opacity", String(style.fill));

      const ring = group.querySelector('[data-role="ring"]');
      const isPhaseTarget = states[landId] === "phase";
      // A phase target keeps its own colour even while selected, so the selection ring
      // cannot quietly hide which lands the invaders are about to hit.
      const strokeColour = isPhaseTarget
        ? (PHASE_RING[pendingStep] || style.ring)
        : (landId === selected ? "#f7f1de" : style.ring);

      ring.setAttribute("stroke", strokeColour);
      ring.setAttribute("stroke-width", isPhaseTarget ? "4" : (landId === selected ? "2.6" : "3"));
      ring.setAttribute("stroke-dasharray", states[landId] === "queued" ? "7 5" : "");
      group.classList.toggle("land-phase-target", isPhaseTarget);
      group.classList.toggle("land-selected", landId === selected);
    }

    const counts = state.invaders[landId];
    const invaderBits = [];
    for (const type of ["explorers", "towns", "cities"]) {
      if (counts[type]) invaderBits.push(unitGlyph(type, counts[type]));
    }

    const allyBits = [];
    if (state.dahan[landId]) allyBits.push(unitGlyph("dahan", state.dahan[landId]));
    if (state.presence[landId]) allyBits.push(unitGlyph("presence", state.presence[landId]));

    const chip = document.createElement("div");
    chip.className = "land-chip";
    chip.setAttribute("data-chip", landId);
    chip.style.setProperty("--terrain-rgb", TERRAIN_RGB[landTerrain(landId)]);
    chip.style.opacity = String(style.chip);

    const centre = landCentre(landId);
    chip.style.left = `${(centre[0] / ISLAND_VIEW.w) * 100}%`;
    chip.style.top = `${(centre[1] / ISLAND_VIEW.h) * 100}%`;
    // Size the chip to its land, or a narrow land like 4 wears a label wider than itself.
    chip.style.width = `${landChipWidthPercent(landId)}%`;

    const defeatMarkup = defeatFx && defeatFx.land === landId
      ? `<div class="chip-defeat">${template(t.defeatHint, {
          count: defeatFx.count,
          unit: unitLabelByType(state, defeatFx.unitType)
        })}</div>`
      : "";

    const actions = landChipActions(state, landId);

    chip.innerHTML = `
      <div class="chip-head">
        <span class="chip-num">${landId}</span>
        <span class="chip-terrain">${terrainName(state, landTerrain(landId))}</span>
      </div>
      ${invaderBits.length ? `<div class="chip-row invaders">${invaderBits.join("")}</div>` : ""}
      ${allyBits.length ? `<div class="chip-row allies">${allyBits.join("")}</div>` : ""}
      ${chipPhaseMarkup(state, landId)}
      ${defeatMarkup}
      ${actions ? `<div class="chip-actions">${actions}</div>` : ""}
    `;

    dom.landChips.appendChild(chip);
  }
}

/* ------------------------------------------------------------------ *
 * Land detail panel                                                    *
 * ------------------------------------------------------------------ */

// Everything the player has to choose now sits on the land it applies to. A choice about
// invaders in land 3 belongs on land 3, not in a side panel the player has to look away to.
// The overlay is pointer-events: none apart from these controls, so land clicks still fall
// through to the shape underneath.
function landChipActions(state, landId) {
  const t = locale(state);
  const counts = state.invaders[landId];
  const parts = [];

  const unitButton = (attr, action, type, label) =>
    `<button class="chip-btn unit-${type}" data-${attr}="${action}" data-target="${type}">${tokenIcon(type)}${label}</button>`;

  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  if (ravageCounter) {
    if (ravageCounter.land === landId) {
      parts.push(`<div class="chip-progress">${template(t.ravageCounterShort, { remaining: ravageCounter.remaining })}</div>`);
      for (const type of ["explorers", "towns", "cities"]) {
        if ((counts[type] || 0) <= 0) continue;
        parts.push(unitButton("ravage-action", "target", type, String(counts[type])));
      }
    } else if ((ravageCounter.queued || []).some((entry) => entry.land === landId)) {
      parts.push(`<div class="chip-progress waiting">${t.ravageCounterWaiting}</div>`);
    }
    return parts.join("");
  }

  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (washAway && washAway.step === "choose-units" && washAway.source === landId) {
    const chosenTotal = washAway.explorers + washAway.towns;
    for (const type of ["explorers", "towns"]) {
      if ((counts[type] || 0) <= 0) continue;
      const chosen = washAway[type];
      parts.push(`
        <div class="chip-picker">
          <span class="unit-${type}">${tokenIcon(type)}</span>
          <button class="chip-step" data-wash-action="units-delta" data-unit="${type}" data-delta="-1" ${chosen > 0 ? "" : "disabled"}>&minus;</button>
          <span class="chip-count">${chosen}</span>
          <button class="chip-step" data-wash-action="units-delta" data-unit="${type}" data-delta="1" ${chosen < counts[type] && chosenTotal < 3 ? "" : "disabled"}>+</button>
        </div>
      `);
    }
    parts.push(`<button class="chip-btn wide" data-wash-action="units-confirm" ${chosenTotal > 0 ? "" : "disabled"}>${t.washAwayConfirmBtn}</button>`);
    return parts.join("");
  }

  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  if (flashFloods && flashFloods.land === landId
      && (flashFloods.step === "choose-target" || flashFloods.step === "choose-bonus-target")) {
    for (const type of ["explorers", "towns", "cities"]) {
      if ((counts[type] || 0) <= 0) continue;
      parts.push(unitButton("flash-action", "target", type, String(counts[type])));
    }
    return parts.join("");
  }

  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (riversBounty && riversBounty.step === "choose-sources" && riversBounty.destination === landId) {
    parts.push(`<div class="chip-progress">${template(t.riversBountyProgress, { moved: riversBounty.moved })}</div>`);
    parts.push(`<button class="chip-btn wide" data-rb-action="finish">${t.riversBountyFinishBtn}</button>`);
  }

  return parts.join("");
}

function renderLandDetail(state) {
  const t = locale(state);
  const landId = effectiveSelectedLand(state);
  const terrain = landTerrain(landId);
  const counts = state.invaders[landId];
  const damageSlot = state.invaderDamage[landId];
  const presenceCount = state.presence[landId];
  const seconds = essenceSecondsPerUnit(presenceCount);
  const tier = nextEssenceTier(presenceCount);

  const rows = [];
  for (const [type, label] of [["explorers", t.explorersLabel], ["towns", t.townsLabel], ["cities", t.citiesLabel]]) {
    if ((counts[type] || 0) <= 0) continue;
    const health = UNIT_STATS[type].health;
    const carry = Math.max(0, Math.floor(damageSlot[type] || 0));
    const hpHint = carry > 0 && health > 1
      ? `<span class="detail-hp">${template(t.invaderHpHint, { unit: "", current: health - carry, max: health }).trim()}</span>`
      : "";
    rows.push(`<div class="detail-row"><span class="detail-key unit-${type}">${tokenIcon(type)}${label}</span><span class="detail-val">${hpHint}${counts[type]}</span></div>`);
  }
  if (rows.length === 0) rows.push(`<p class="detail-empty">${t.noInvadersHere}</p>`);

  const neighbours = adjacentLands(landId)
    .map((other) => `<button class="neighbour-chip" data-goto-land="${other}" style="--terrain-rgb:${TERRAIN_RGB[landTerrain(other)]}">${other}</button>`)
    .join("");

  const remaining = seconds > 0
    ? Math.max(0, Math.ceil(seconds - (state.essenceProgress[landId] || 0)))
    : 0;

  // Every choice now lives on the board, so the panel explains rather than asks. It still
  // names what the pending phase will do here, for the land the player is reading.
  const pendingStep = invaderPhasesComplete(state) ? null : state.turn.invaderStep;
  const phaseNote = pendingStep
      && !hasPendingTargetingEffect(state)
      && !invaderStepBlockedMessage(state)
      && invaderStepLands(state, pendingStep).includes(landId)
    ? `<div class="detail-phase phase-${pendingStep}">
         <strong>${invaderStepLabel(state, pendingStep)}</strong>
         <span>${phaseTargetText(state, pendingStep, landId)}</span>
       </div>`
    : "";

  dom.landDetail.style.setProperty("--terrain-rgb", TERRAIN_RGB[terrain]);
  dom.landDetail.innerHTML = `
    <div class="detail-head">
      <span class="detail-num">${landId}</span>
      <span class="detail-terrain">${terrainName(state, terrain)}</span>
      <span class="detail-tag ${landIsCoastal(landId) ? "coastal" : ""}">${landIsCoastal(landId) ? t.coastalLabel : t.inlandLabel}</span>
    </div>
    <div class="detail-body">
      ${phaseNote}
      <div class="detail-block">
        <div class="detail-label">${t.invadersLabel}</div>
        ${rows.join("")}
      </div>
      <div class="detail-block">
        <div class="detail-label">${t.ownForcesLabel}</div>
        <div class="detail-row"><span class="detail-key unit-dahan">${tokenIcon("dahan")}${t.dahanLabel}</span><span class="detail-val">${state.dahan[landId]}</span></div>
        <div class="detail-row"><span class="detail-key unit-presence">${tokenIcon("presence")}${t.presenceLabel}</span><span class="detail-val">${presenceCount}</span></div>
      </div>
      <div class="detail-block">
        <div class="detail-label">${essenceName(state, terrain)}</div>
        <div class="detail-row">
          <span class="detail-key">${seconds > 0 ? template(t.essenceRate, { seconds }) : t.essenceNoGeneration}</span>
          <span class="detail-val detail-countdown">${seconds > 0 ? template(t.essenceNextIn, { seconds: remaining }) : "-"}</span>
        </div>
        <small class="detail-tier">${tier ? template(t.essenceNextTier, { presence: tier.presence, seconds: tier.seconds }) : t.essenceMaxTier}</small>
      </div>
      <div class="detail-block">
        <div class="detail-label">${t.neighboursLabel}</div>
        <div class="neighbour-row">${neighbours}</div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ *
 * Essence rail                                                         *
 * ------------------------------------------------------------------ */

// Four pools, whatever the board looks like. Each shows which lands are feeding it, so the
// per-land generators add up visibly rather than disappearing into one number.
function renderEssenceRail(state) {
  const t = locale(state);
  dom.essenceRail.innerHTML = "";

  for (const terrain of INVADER_TERRAINS) {
    const contributors = landsOfTerrain(terrain)
      .map((landId) => ({ landId, seconds: essenceSecondsPerUnit(state.presence[landId]) }))
      .filter((entry) => entry.seconds > 0);

    const pool = document.createElement("div");
    pool.className = "essence-pool";
    pool.style.setProperty("--terrain-rgb", TERRAIN_RGB[terrain]);
    pool.innerHTML = `
      <span class="pool-name">${essenceName(state, terrain)}</span>
      <span class="pool-value" data-pool="${terrain}">${state.essence[terrain]}</span>
      <small class="pool-rate">${contributors.length
        ? contributors.map((entry) => `${template(t.landShort, { id: entry.landId })}: ${template(t.essenceRate, { seconds: entry.seconds })}`).join(" · ")
        : t.essenceNoGeneration}</small>
    `;
    dom.essenceRail.appendChild(pool);
  }
}

/* ------------------------------------------------------------------ *
 * Signature and live patching                                          *
 * ------------------------------------------------------------------ */

function mapSignature(state) {
  const parts = [currentLang(state), `sel:${effectiveSelectedLand(state)}`];
  for (const landId of LAND_IDS) {
    const slot = state.invaders[landId];
    const dmg = state.invaderDamage[landId];
    // The essence totals and countdowns deliberately stay out of this signature: they change
    // every second and are patched in place by updateEssenceReadouts, so hovering a map
    // button is not interrupted by a full rebuild.
    parts.push(`${slot.explorers}:${slot.towns}:${slot.cities}:d${state.dahan[landId]}:p${state.presence[landId]}:x${dmg.explorers}:${dmg.towns}:${dmg.cities}`);
  }

  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  if (washAway) parts.push(`wash:${washAway.step}:${washAway.source || "-"}:${washAway.explorers}:${washAway.towns}`);

  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  if (flashFloods) parts.push(`flash:${flashFloods.step}:${flashFloods.land || "-"}:${flashFloods.primaryTarget || "-"}:${flashFloods.bonusDamage || 0}`);

  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  if (riversBounty) parts.push(`rb:${riversBounty.step}:${riversBounty.destination || "-"}:${riversBounty.moved}`);

  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  if (presencePlacement) parts.push(`pp:${presencePlacement.step}:${presencePlacement.remaining}`);

  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  if (ravageCounter) {
    const queue = (ravageCounter.queued || []).map((entry) => `${entry.land}/${entry.remaining}`).join(",");
    parts.push(`rc:${ravageCounter.land}:${ravageCounter.remaining}:${queue}`);
  }

  const defeatFx = activeDefeatFx(state);
  if (defeatFx) parts.push(`defeat:${defeatFx.land}:${defeatFx.unitType}:${defeatFx.count}:${Math.floor(defeatFx.at / 100)}`);

  // The pending phase drives the target highlight.
  parts.push(`step:${state.turn.invaderStep}:${invaderStepBlockedMessage(state) ? "blocked" : "ready"}`);
  return parts.join("|");
}

// Patches the per-second readouts in place. Rebuilding the board for these would tear down
// the action buttons every second and break hover and focus.
function updateEssenceReadouts(state) {
  const t = locale(state);

  for (const terrain of INVADER_TERRAINS) {
    const poolEl = dom.essenceRail.querySelector(`[data-pool="${terrain}"]`);
    if (!poolEl) continue;
    const next = String(state.essence[terrain]);
    if (poolEl.textContent !== next) poolEl.textContent = next;
  }

  const selected = effectiveSelectedLand(state);
  const countdownEl = dom.landDetail.querySelector(".detail-countdown");
  if (countdownEl) {
    const seconds = essenceSecondsPerUnit(state.presence[selected]);
    const next = seconds > 0
      ? template(t.essenceNextIn, { seconds: Math.max(0, Math.ceil(seconds - (state.essenceProgress[selected] || 0))) })
      : "-";
    if (countdownEl.textContent !== next) countdownEl.textContent = next;
  }
}


// Drives the three phase buttons: which is next, which are already resolved, and why
// they may be locked. Keeps the mandatory order visible instead of only enforced.
function renderInvaderPhaseControls(state) {
  const t = locale(state);
  const blocked = invaderStepBlockedMessage(state);
  const done = invaderPhasesComplete(state);
  const activeStep = state.turn.invaderStep;

  const buttons = {
    ravage: { btn: dom.ravagePhaseBtn, state: dom.ravagePhaseState },
    build: { btn: dom.buildPhaseBtn, state: dom.buildPhaseState },
    explore: { btn: dom.discoverPhaseBtn, state: dom.discoverPhaseState }
  };

  for (const step of INVADER_STEPS) {
    const { btn, state: stateEl } = buttons[step];
    const stepIndex = INVADER_STEPS.indexOf(step);
    const activeIndex = done ? INVADER_STEPS.length : INVADER_STEPS.indexOf(activeStep);
    const isResolved = stepIndex < activeIndex;
    const isNext = !done && step === activeStep;

    btn.classList.toggle("phase-resolved", isResolved);
    btn.classList.toggle("phase-next", isNext && !blocked);
    btn.classList.toggle("phase-locked", !isResolved && !isNext);
    btn.disabled = Boolean(blocked) || !isNext;

    if (isResolved) stateEl.textContent = t.phaseStateResolved;
    else if (isNext) stateEl.textContent = blocked ? t.phaseStateBlocked : t.phaseStateNext;
    else stateEl.textContent = t.phaseStateWaiting;
  }

  dom.executeAllPhasesBtn.disabled = Boolean(blocked) || done;

  if (blocked) dom.invaderTrackHint.textContent = t.invaderTrackHintBlocked;
  else if (done) dom.invaderTrackHint.textContent = t.invaderTrackHintDone;
  else {
    dom.invaderTrackHint.textContent = template(t.invaderTrackHintNext, {
      step: invaderStepLabel(state, activeStep),
      land: template(t.phaseTargetLands, {
        terrain: terrainName(state, invaderStepTerrain(state, activeStep)),
        lands: terrainLandsSummary(state, invaderStepTerrain(state, activeStep))
      })
    });
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
  dom.ravageArea.textContent = terrainName(state, state.invader.ravage);
  dom.buildArea.textContent = terrainName(state, state.invader.build);
  dom.discoverArea.textContent = terrainName(state, state.invader.explore);
  dom.playHint.textContent = t.playHint;
  renderInvaderPhaseControls(state);

  const washAway = normalizeWashAwayState(state.effects && state.effects.washAway);
  const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
  const riversBounty = normalizeRiversBountyState(state.effects && state.effects.riversBounty);
  const presencePlacement = normalizePresencePlacementState(state.effects && state.effects.presencePlacement);
  const ravageCounter = normalizeRavageCounterState(state.effects && state.effects.ravageCounter);
  dom.endTurnBtn.disabled = !state.turn.selectedGrowthOption
    || !invaderPhasesComplete(state)
    || Boolean(washAway) || Boolean(flashFloods) || Boolean(riversBounty) || Boolean(presencePlacement) || Boolean(ravageCounter);
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
  } else if (presencePlacement) {
    dom.mapPlanHint.textContent = presencePlacement.step === "choose-track"
      ? template(t.presenceChooseTrack, { remaining: presencePlacement.remaining })
      : template(t.presenceChooseArea, { track: trackLabel(state, presencePlacement.track) });
  } else if (ravageCounter) {
    dom.mapPlanHint.textContent = template(t.ravageCounterChoose, {
      land: landName(state, ravageCounter.land),
      remaining: ravageCounter.remaining
    });
  }

  const nextGrowthOptionsSig = growthOptionsSignature(state);
  if (uiRenderCache.growthOptionsSignature !== nextGrowthOptionsSig) {
    renderGrowthOptions(state);
    uiRenderCache.growthOptionsSignature = nextGrowthOptionsSig;
  }

  const nextTracksSig = tracksSignature(state);
  if (uiRenderCache.tracksSignature !== nextTracksSig) {
    renderSpiritTracks(state);
    uiRenderCache.tracksSignature = nextTracksSig;
  }

  const nextHandSig = handSignature(state);
  if (uiRenderCache.handSignature !== nextHandSig) {
    renderHand(state);
    uiRenderCache.handSignature = nextHandSig;
  }

  const nextMapSig = mapSignature(state);
  if (uiRenderCache.mapSignature !== nextMapSig) {
    renderBoard(state);
    renderLandDetail(state);
    renderEssenceRail(state);
    uiRenderCache.mapSignature = nextMapSig;
  }

  updateEssenceReadouts(state);
}

drawIslandOnce();
let state = normalizeState(loadState());
addLog(state, currentLang(state) === "en" ? "The spirit awakens." : "Der Geist erwacht.");
updateUI(state);

dom.languageToggleBtn.addEventListener("click", () => {
  state.ui.language = currentLang(state) === "de" ? "en" : "de";
  updateUI(state);
  saveState(state);
});

dom.spiritTracks.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest("button[data-track-id]");
  if (!btn) return;
  choosePresenceTrack(state, btn.getAttribute("data-track-id") || "");
  updateUI(state);
});

dom.handCards.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const regainBtn = target.closest("button[data-regain-index]");
  if (regainBtn) {
    const regainIdx = Number(regainBtn.getAttribute("data-regain-index"));
    if (!Number.isNaN(regainIdx)) regainCard(state, regainIdx);
    updateUI(state);
    return;
  }

  const btn = target.closest("button[data-card-index]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-card-index"));
  if (Number.isNaN(idx)) return;
  playCardAtIndex(state, idx);
  updateUI(state);
});

// A land click always selects, and additionally resolves the pending step when that step
// has exactly one possible answer for this land.
function selectLand(state, landId) {
  if (!isLandId(landId)) return;
  const direct = landDirectAction(state, landId);
  state.ui.selectedLand = landId;
  if (direct) direct();
  updateUI(state);
}

dom.islandSvg.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const group = target.closest("[data-land]");
  if (!group) return;
  selectLand(state, group.getAttribute("data-land") || "");
});

dom.islandSvg.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const group = target.closest("[data-land]");
  if (!group) return;
  event.preventDefault();
  selectLand(state, group.getAttribute("data-land") || "");
});

// The panel only navigates now; every choice is answered on the board itself.
dom.landDetail.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const jump = target.closest("button[data-goto-land]");
  if (!jump) return;
  state.ui.selectedLand = jump.getAttribute("data-goto-land") || null;
  updateUI(state);
});

// Choices rendered onto the lands themselves. The overlay is pointer-events: none apart
// from these controls, so a click anywhere else still falls through to the land shape.
dom.landChips.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const btn = target.closest("button[data-wash-action], button[data-flash-action], button[data-rb-action], button[data-ravage-action]");
  if (!btn) return;

  const washAction = btn.getAttribute("data-wash-action");
  const flashAction = btn.getAttribute("data-flash-action");
  const rbAction = btn.getAttribute("data-rb-action");
  const ravageAction = btn.getAttribute("data-ravage-action");

  if (washAction === "units-delta") {
    adjustWashAwayUnits(state, btn.getAttribute("data-unit") || "", Number(btn.getAttribute("data-delta")));
  } else if (washAction === "units-confirm") {
    confirmWashAwayUnits(state);
  } else if (flashAction === "target") {
    const targetType = btn.getAttribute("data-target") || "";
    const flashFloods = normalizeFlashFloodsState(state.effects && state.effects.flashFloods);
    if (flashFloods && flashFloods.step === "choose-bonus-target") {
      resolveFlashFloodsBonusTarget(state, targetType);
    } else {
      resolveFlashFloodsTarget(state, targetType);
    }
  } else if (rbAction === "finish") {
    finishRiversBounty(state);
  } else if (ravageAction === "target") {
    assignRavageCounterDamage(state, btn.getAttribute("data-target") || "");
  }

  updateUI(state);
});

for (const btn of [dom.ravagePhaseBtn, dom.buildPhaseBtn, dom.discoverPhaseBtn]) {
  btn.addEventListener("click", () => {
    resolveInvaderStep(state, btn.getAttribute("data-invader-step") || "");
    updateUI(state);
  });
}

dom.executeAllPhasesBtn.addEventListener("click", () => {
  resolveAllInvaderSteps(state);
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
  // Browsers throttle background tabs to roughly one tick per second, so the cap has to
  // sit well above that or essence would quietly accrue slower than the displayed rate.
  // It still guards against a huge jump after the machine sleeps.
  const dt = Math.min(MAX_TICK_SECONDS, (t - lastTick) / 1000);
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