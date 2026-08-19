/* ------------------------------------------------------------------ *
 * Localization
 * ------------------------------------------------------------------ *
 *
 * Every player-visible string, in German and English. Data only: no rule
 * reads this file, and nothing here reads game state.
 * Spec: docs/spec/06-ui-contract.md
 */

/* ------------------------------------------------------------------ *
 * Localization                                                         *
 * ------------------------------------------------------------------ */

const I18N = {
  de: {
    langToggle: "English",

    roundLabel: "Welle",
    bestWaveLabel: "Höchste Welle",
    cycleBestWaveLabel: "Dieser Zyklus",
    blightLabel: "Verderbnis",
    waveLabel: "Nächste Welle",
    fearLabel: "Furcht",
    // Die Furcht dieser Runde ist noch nicht ausgebbar - sie wird erst am Rundenende gebucht.
    // Neben der gebuchten Furcht: was diese Runde bisher dazugelegt hat, gebucht erst am
    // Rundenende.
    fearRoundHint: "(+{fear} in dieser Runde)",
    // Eine Zeile tiefer, und nur wenn ein Aufstieg wirklich etwas beisteuert: wie sich die
    // Zeile darüber aufteilt. Beide Zahlen zusammen ergeben genau den Wert oben.
    fearSplitHint: "+{fear} Basis (+{bonus} durch Upgrades)",
    secondsShort: "{seconds}s",
    // The two readings the wave tile has that are not a countdown: a stopped clock, and a
    // wave standing due behind the gate waiting to be called.
    wavePausedValue: "Pause",
    waveHeldValue: "Wartet",
    startNextWaveBtn: "Welle starten",
    // Beide Schalter tragen ihren Zustand im Schieber, nicht im Wort - deshalb steht hier
    // nur noch, was geschaltet wird, und nicht mehr An und Aus dazu.
    autoWaveLabel: "Auto",
    autoWaveHint: "Nächste Welle läuft von selbst an. Aus: am Ende der Leiste hält die Zeit an, bis du die Welle startest.",
    // Zweizeilig: neben dem größten Knopf der Leiste steht der Schalter selbst größer, und die
    // Beschriftung wächst mit ihm in die Höhe statt in die Breite. Wo das Wort umbricht, weiß
    // nur die Sprache selbst - deshalb steht der Umbruch hier und nicht im Layout.
    autoRoundLabel: "Auto-\nRunde",
    autoRoundHint: "Die nächste Runde startet von selbst. Aus: der Laden bleibt offen, bis du sie startest.",
    // Auf der Fähigkeitskarte selbst, neben Stufe und Preis - dort, wo der Knopf sitzt, den
    // die Automatik drückt.
    autoCastLabel: "Auto",
    autoCastHint: "Diese Fähigkeit wirkt sich selbst. Aus: die Automatik bleibt gekauft, die Fähigkeit wird wieder von Hand gewirkt. Nichts wird zurückerstattet, keine Abklingzeit ändert sich.",
    speedLabel: "Tempo",
    speedOptionTitle: "Spieltempo {speed}x",
    speedPausedTitle: "Pause - die Zeit steht still",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Aktiver Geist:",

    abilitiesTitle: "Fähigkeiten",
    abilitiesHint: "Einsetzen kostet nur Abklingzeit. Energie schaltet neue Fähigkeiten frei.",
    energyLabel: "Energie",
    energyHint: "Energie kommt aus besiegten Invasoren: 1 pro Entdecker, 2 pro Dorf, 3 pro Stadt. Boon of Vigor gibt +1. Zu Rundenbeginn fällt sie zurück - auf 0, oder auf das, was Quellwasser hergibt - und alles, was mit ihr gekauft wurde, ist damit weg.",
    abilityReady: "Bereit",
    abilityArmed: "Ziel wählen",
    abilityCooldown: "{seconds}s",
    abilityLocked: "Gesperrt",
    abilityUnlockBtn: "{cost} Energie",
    abilityTierLabel: "Stufe {tier}",
    abilityUpgradeBtn: "Stufe {tier}: {cost} Energie",
    abilityFocusBtn: "Fokus: {cost} Energie",
    abilityNames: {
      innate_power: "Angeborene Kraft",
      boon_of_vigor: "Boon of Vigor",
      rivers_bounty: "River's Bounty",
      flash_floods: "Flash Floods",
      wash_away: "Wash Away",
      // Die sieben Machtkarten stehen in derselben Tabelle wie die Ausrüstung, weil eine Karte
      // in jeder Hinsicht, die zählt, eine Fähigkeit ist - abilityName fragt nicht nach, was
      // sie ist. Die deutschen Namen sind Platzhalter für dieses Paket und nicht die
      // veröffentlichten Kartennamen; liegen die offiziellen vor, ersetzen sie diese hier.
      pull_beneath: "Hinab in die hungrige Erde",
      song_of_sanctity: "Lied der Unverletzlichkeit",
      uncanny_melting: "Unheimliches Schmelzen",
      natures_resilience: "Widerstandskraft der Natur",
      encompassing_ward: "Umfassender Schutzwall",
      accelerated_rot: "Beschleunigte Fäulnis",
      tsunami: "Tsunami"
    },
    // The Innate carries one text per tier, in tier order. Every other ability carries one.
    abilityTexts: {
      innate_power: [
        "Schiebt {push} Entdecker/Dorf in ein angrenzendes Gebiet.",
        "{damage} Schaden. Schiebt bis zu {push} Entdecker/Dörfer in ein angrenzendes Gebiet.",
        "{damage} Schaden auf jeden Invasor im gewählten Gebiet."
      ],
      boon_of_vigor: "+{amount} Energie.",
      rivers_bounty: "+{amount} Dahan im Gebiet mit den wenigsten Dahan und Invasoren, wenn möglich.",
      flash_floods: "{damage} Schaden. Liegt das Ziel an der Küste: +{coastal} Schaden.",
      wash_away: "Schiebt bis zu {push} Entdecker/Dörfer in ein angrenzendes Gebiet. An der Küste spült das Wasser stattdessen bis zu {sea} von der Insel ins Meer.",
      // Die Zahlen einer Karte kommen aus ihrer Schrittliste, nicht aus der Übersetzung -
      // siehe cardTextVars. Wer in POWER_CARDS eine Zahl ändert, ändert diese Texte mit.
      pull_beneath: "{fear} Furcht und {damage} Schaden. Liegt das Ziel in {terrains}: +{bonus} Schaden.",
      song_of_sanctity: "Zerstört {destroy} Entdecker und schiebt alle übrigen Entdecker fort. Ohne Entdecker im Ziel: entfernt stattdessen {blight} Verderbnis.",
      uncanny_melting: "Stehen Invasoren im Ziel: {fear} Furcht je Invasor. Liegt das Ziel in {terrains}: entfernt {blight} Verderbnis.",
      natures_resilience: "Schutz {defend}. Entfernt {blight} Verderbnis.",
      encompassing_ward: "Schutz {defend} in jedem Gebiet.",
      accelerated_rot: "{fear} Furcht. {damage} Schaden. Entfernt {blight} Verderbnis.",
      tsunami: "Nur an der Küste: {fear} Furcht, {damage} Schaden, zerstört {dahan} Dahan. Ist der Schalter an, trifft es jede andere Küste mit {alsoFear} Furcht und {alsoDamage} Schaden und zerstört dort {alsoDahan} Dahan."
    },

    mapTitle: "Die Insel",

    shopTitle: "Zwischen den Runden",
    shopLostRound: "Runde {round} verloren. {fear} Furcht in dieser Runde erbeutet.",
    // Während eine Runde läuft, steht statt der Verlustmeldung, was sie bisher eingebracht
    // hat - und dass es erst am Rundenende gebucht wird.
    shopRoundRunning: "Runde {round} läuft, Welle {wave}. {fear} Furcht bisher - buchbar am Rundenende.",
    shopFearLabel: "Verfügbare Furcht",
    shopTierLabel: "Stufe {tier}",
    // Für eine Leiter mit bekanntem Ende - siehe upgradeStatusText.
    shopTierLabelMax: "Stufe {tier}/{max}",
    // Was ein Becken dort zeigt, wo eine Leiter ihre Stufe zeigt - siehe upgradeStatusText.
    shopHasteLabel: "{pct}% schneller",
    shopCostLabel: "{cost} Furcht",
    // Die Knöpfe des Beckens: je eine Stückelung, dann alles, was die Börse hergibt.
    shopInvestBtn: "+{amount}",
    shopInvestMaxBtn: "Max",
    shopInvestTitle: "{amount} Furcht einlegen",
    shopInvestMaxTitle: "{amount} Furcht einlegen - alles, was du dir leisten kannst",
    shopMaxedBtn: "Maximum",
    // A one-off is owned, not maxed: there was never a ladder for it to reach the top of.
    shopOwnedBtn: "Gekauft",
    shopOneOffLabel: "Einmalig",
    // Überschrift über allem, was ausverkauft ist - nichts darunter ist noch zu haben.
    shopSoldOutLabel: "Bereits gekauft",
    // Während der Runde gekauft: gehört dir, wirkt aber erst ab der nächsten Runde.
    shopPendingHint: "Wirkt ab der nächsten Runde.",
    startNextRoundBtn: "Nächste Runde starten",

    /* ---------- Aszension und Präsenz ---------- */
    ascensionTitle: "Aszension",
    ascensionPresenceLabel: "Präsenz",
    ascensionPayoutLabel: "Aufsteigen bringt",
    ascensionCountLabel: "Bisher aufgestiegen",
    ascensionGeneratedLabel: "Dieser Zyklus erzeugte",
    // Die Auszahlung ist eine Wurzel, also sagt die Zahl allein nie, wie nah die nächste
    // Präsenz ist. Diese Zeile sagt es: was noch erzeugt werden muss, damit der Knopf eine
    // Präsenz mehr bringt.
    ascensionNextPresenceHint: "Noch {fear} Furcht bis zur nächsten Präsenz.",
    // Was ungenutzte Präsenz gerade kostet, statt sie zu verkaufen: 1% mehr Furcht pro Punkt,
    // auf jeden Kill, jede Welle und jeden Meilenstein. Nur sichtbar, wenn sie etwas beiträgt -
    // bei 0 Präsenz wäre "+0%" nur eine Zeile mehr zu lesen für nichts.
    ascensionPresenceBonusHint: "+{percent}% Furcht durch ungenutzte Präsenz.",
    // Was der Knopf kostet, vor dem Knopf statt danach. Das Einzige im Spiel, das sich nicht
    // rückgängig machen lässt.
    ascensionLossHint: "Aufsteigen nimmt alles: {fear} Furcht und {tiers} gekaufte Stufen. Präsenz und die höchste Welle bleiben.",
    ascensionBtn: "Aufsteigen",
    ascensionConfirmBtn: "Wirklich aufsteigen",
    ascensionLockedHint: "Erst wenn Aufsteigen {presence} Präsenz bringt.",
    ascensionRoundHint: "Erst zwischen den Runden.",
    ascensionShopLabel: "Was Präsenz freischaltet",
    ascended: "Aszension {count}. {generated} Furcht dieses Zyklus wurden zu {presence} Präsenz - {total} insgesamt. Die Insel beginnt von vorn.",
    ascendRefused: "Noch nicht. Aufsteigen geht erst zwischen den Runden, und erst wenn der Zyklus es wert ist.",
    presenceNames: {
      presence_tide_returns: "Die Flut kehrt wieder",
      presence_river_knows: "Der Fluss weiß, was er braucht",
      presence_current_quickens: "Die Strömung eilt",
      // Eine Familie, weil es ein Mechanismus ist - siehe die englische Fassung. Jede Zeile
      // nennt die Furchtzeile, die sie günstiger macht.
      presence_boon_remembered: "Der Segen bleibt in Erinnerung",
      presence_instinct_remembered: "Der Instinkt bleibt in Erinnerung",
      presence_bounty_remembered: "Die Gabe bleibt in Erinnerung",
      presence_flood_remembered: "Die Sturzflut bleibt in Erinnerung",
      presence_current_remembered: "Die Strömung bleibt in Erinnerung",
      presence_need_remembered: "Der Bedarf bleibt in Erinnerung",
      presence_tide_remembered: "Die Flut bleibt in Erinnerung"
    },
    presenceTexts: {
      presence_tide_returns: "Öffnet \"Die Flut kehrt wieder\" im Furchtladen. Die Furcht dafür ist weiter fällig - in jedem Zyklus neu.",
      presence_river_knows: "Öffnet \"Der Fluss weiß, was er braucht\" im Furchtladen. Die Furcht dafür ist weiter fällig - in jedem Zyklus neu.",
      presence_current_quickens: "Schaltet Fokus frei: Abklingzeiten von Fähigkeiten lassen sich während der Runde mit Energie verkürzen, bis auf 30% ihrer Ausgangszeit.",
      // Nur Rückfallebene - presenceUpgradeText baut diese Zeilen aus dem echten Preis.
      presence_boon_remembered: "Senkt, was \"Segen von selbst\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_instinct_remembered: "Senkt, was \"Angeborener Instinkt\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_bounty_remembered: "Senkt, was \"Gabe des Flusses\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_flood_remembered: "Senkt, was \"Sturzflut von selbst\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_current_remembered: "Senkt, was \"Strömung von selbst\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_need_remembered: "Senkt, was \"Der Fluss weiß, was er braucht\" im Furchtladen kostet, eine Stufe je Rang.",
      presence_tide_remembered: "Senkt, was \"Die Flut kehrt wieder\" im Furchtladen kostet, eine Stufe je Rang."
    },
    // Beide Hälften nennen den Preis, nicht den Rabatt - siehe die englische Fassung.
    presenceNextTexts: {
      discount: "{upgrade} kostet jeden Zyklus {current} Furcht. Nächste Stufe: {next}."
    },
    presenceMaxedTexts: {
      discount: "{upgrade} kostet jeden Zyklus {current} Furcht - weniger verlangt die Insel nicht."
    },
    presencePurchased: "{upgrade} für {cost} Präsenz. {unlocks} steht jetzt im Laden.",
    presencePurchasedDirect: "{upgrade} für {cost} Präsenz.",
    presenceDiscounted: "{upgrade} für {cost} Präsenz. {unlocks} kostet jetzt {price} Furcht.",
    presenceOwned: "{upgrade} gehört dir bereits.",
    presenceMaxed: "{upgrade} hat nichts mehr zurückzugeben.",
    presenceTooExpensive: "{upgrade} kostet {cost} Präsenz, du hast {presence}.",
    presenceCostLabel: "{cost} Präsenz",
    presenceOwnedBtn: "Freigeschaltet",
    presenceMaxedBtn: "Vollständig",
    upgradeNames: {
      dahan_reinforcement: "Verstärkung der Dahan",
      blight_resilience: "Widerstand gegen Verderbnis",
      headwaters: "Quellwasser",
      rising_dread: "Steigendes Grauen",
      mounting_terror: "Wachsender Schrecken",
      high_water_mark: "Hochwassermarke",
      power_card_interval: "Die Insel erinnert sich früher",
      dahan_remember: "Die Dahan erinnern sich",
      auto_boon: "Segen von selbst",
      auto_innate: "Angeborener Instinkt",
      auto_wash_away: "Strömung von selbst",
      auto_bounty: "Gabe des Flusses",
      auto_flash_floods: "Sturzflut von selbst",
      auto_buy_abilities: "Der Fluss weiß, was er braucht",
      auto_start_round: "Die Flut kehrt wieder"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 Dahan zu Rundenbeginn, pro Stufe.",
      blight_resilience: "+1 Verderbnisgrenze, pro Stufe.",
      headwaters: "Jede Runde beginnt mit Energie in der Hand: 1 / 2 / 3 / 5 / 8 / 13 / 19 / 26 / 35 nach Stufe. Stufe 9 ist die ganze Ausrüstung, gekauft vor der ersten Welle.",
      rising_dread: "+10% Furcht aus besiegten Invasoren, pro Stufe.",
      mounting_terror: "+10% Furcht für überstandene Wellen, pro Stufe.",
      high_water_mark: "Jede 10. Welle zahlt zusätzlich 10% ihrer eigenen Nummer als Furcht, pro Stufe. Welle 50 auf Stufe 3 bringt 15 dazu.",
      power_card_interval: "Der Abstand zwischen zwei Machtkarten sinkt um 1 Welle, pro Stufe. Nur Rückfallebene - der Text der Zeile nennt die Abstände selbst.",
      dahan_remember: "Furcht, in die Erinnerung der Dahan gelegt - 100 je 1%. Sie schlagen früher dafür. Bei 100% schlagen sie doppelt so oft.",
      auto_boon: "Boon of Vigor wirkt sich selbst, sobald es bereit ist.",
      auto_innate: "Die Angeborene Kraft wirkt sich selbst, sobald sie bereit ist - auf jeder Stufe, die du besitzt.",
      auto_wash_away: "Wash Away wirkt sich selbst und sucht sich sein Ziel - sobald es freigeschaltet und bereit ist.",
      auto_bounty: "River's Bounty wirkt sich selbst, sobald es freigeschaltet und bereit ist.",
      auto_flash_floods: "Flash Floods wirkt sich selbst und schlägt dorthin, wo es tötet - sobald es freigeschaltet und bereit ist.",
      auto_buy_abilities: "Energie kauft von selbst: erst die verschlossenen Fähigkeiten, günstigste zuerst, dann die nächste Stufe der Angeborenen Kraft.",
      auto_start_round: "Die nächste Runde startet von selbst. Abschaltbar, wenn du in Ruhe einkaufen willst."
    },
    // Was die nächste Stufe bringt, statt der Form der ganzen Leiter - siehe
    // NEXT_TIER_UPGRADE_TEXT.
    upgradeNextTexts: {
      headwaters: "Nächste Stufe: +{gain} Energie zu Rundenbeginn, dann {next} in der Hand.",
      high_water_mark: "Nächste Stufe: +{pct}% der Wellennummer bei jeder 10. Welle - Welle {wave} zahlt dann {next} statt {current}.",
      power_card_interval: "Die erste Machtkarte kommt in Welle {first}, danach alle {current} Wellen. Nächste Stufe: alle {next}.",
      // Kein Vergleich mit dem Grundwert - siehe die englische Fassung.
      dahan_remember: "{invested} / {full} Furcht erinnert ({pct}%). Die Dahan schlagen alle {seconds}s zu. 100 Furcht bringen 1% mehr."
    },
    upgradeMaxedTexts: {
      headwaters: "Jede Runde beginnt mit {energy} Energie in der Hand: die ganze Ausrüstung, gekauft vor der ersten Welle.",
      power_card_interval: "Die erste Machtkarte kommt in Welle {first}, danach alle {current} Wellen - schneller erinnert sich die Insel nicht.",
      dahan_remember: "Alle {full} Furcht erinnert. Die Dahan schlagen alle {seconds}s zu - doppelt so oft wie die {base}s, mit denen sie begannen."
    },

    /* ---------- Machtkarten ---------- */
    // Der Kartenzug im Präsenzladen: drei liegen aus, eine wird behalten.
    cardShopLabel: "Machtkarten",
    cardShopHint: "Drei liegen aus, eine gehört dir - für immer, auch über die Aszension hinweg. Auf der Hand liegt sie erst, wenn eine Runde tief genug kommt.",
    cardDrawCostLabel: "{cost} Präsenz",
    // Die Abklingzeit steht auf einer eigenen Zeile unter dem Namen, weil sie beim Kauf die
    // Frage ist: die drei Auslagen unterscheiden sich weniger darin, was sie tun, als darin,
    // wie oft sie es dürfen. Der Hinweistext trägt sie, weil eine Zahl allein nicht sagt,
    // wovon sie die Wartezeit ist.
    cardOfferCooldownLabel: "{seconds}s Abklingzeit",
    cardOfferCooldownHint: "Die Wartezeit zwischen zwei Einsätzen, bevor Fokus sie verkürzt. Keine Karte wirkt sich selbst - so oft kannst du sie also von Hand spielen.",
    // Der Preis nennt seine Währung, wie der Kaufknopf darüber: eine nackte Zahl in Klammern
    // liest sich wie "noch 3 Mal", nicht wie ein Preis.
    cardRerollBtn: "Neu mischen: {cost} Präsenz",
    cardRerollHint: "Mindestens zwei Karten, die gerade nicht ausliegen.",
    cardRerollDeadHint: "Nur noch drei Karten - es liegt bereits alles aus.",
    cardShopSoldOut: "Alle sieben Karten gehören dir.",
    cardOwnedLabel: "In Besitz: {count} / {total}",
    // Auf der Karte in der Fähigkeitsleiste.
    cardTag: "Karte",
    cardRedrawBtn: "Tauschen: {cost} Energie",
    cardRedrawHint: "Wirf diese Karte zurück und zieh eine andere. Sobald du sie gewirkt hast, ist sie deine.",
    cardOptionLabel: "Küsten",
    cardOptionHint: "Trifft auch jede andere Küste - mit weniger Furcht und Schaden, und es kostet dort ebenfalls Dahan. Aus: nur das gewählte Gebiet.",
    cardNextDrawHint: "Nächste Karte: Welle {wave}",
    // Der Countdown auf der Wellenkachel und die Enthüllung über der Insel. Beide nennen die
    // Welle, weil die Welle der Preis ist: Präsenz kauft die Karte, überlebte Wellen kaufen
    // den Augenblick, in dem sie kommt.
    cardCountdownWaves: "Karte in {waves} Wellen",
    cardCountdownNext: "Karte: nächste Welle",
    cardRevealTitle: "Welle {wave} bringt",
    // Protokollzeilen.
    cardBought: "{card} für {cost} Präsenz. Die Insel erinnert sich.",
    cardTooExpensive: "{card} kostet {cost} Präsenz, du hast {presence}.",
    cardRerolled: "Neu gemischt für {cost} Präsenz. {presence} übrig.",
    cardRerollTooExpensive: "Neu mischen kostet {cost} Präsenz, du hast {presence}.",
    cardRerollRefused: "Es liegen bereits alle übrigen Karten aus - neu mischen bringt nichts.",
    cardDrawn: "Welle {wave}: {card} kommt auf die Hand.",
    cardRedrawn: "{card} zurückgelegt für {cost} Energie. Stattdessen: {next}.",
    cardRedrawTooExpensive: "Tauschen kostet {cost} Energie, du hast {energy}.",
    cardResolved: "{card} in {land}: {summary}.",
    cardResolvedNoLand: "{card}: {summary}.",
    // Die Bausteine der Zusammenfassung oben, in der Reihenfolge, in der sie gesammelt werden.
    cardPartFear: "{amount} Furcht",
    cardPartDamage: "{amount} Schaden",
    cardPartDefeated: "{count} besiegt",
    cardPartPushed: "{count} geschoben",
    cardPartBlight: "{amount} Verderbnis entfernt",
    cardPartDefend: "Schutz {amount}",
    cardPartDahan: "{count} Dahan gefallen",

    logTitle: "Spielprotokoll",
    manualSaveBtn: "Jetzt speichern",
    exportSaveBtn: "Exportieren",
    importSaveBtn: "Importieren",
    wipeSaveBtn: "Spielstand löschen",
    autosaveHint: "Autosave alle 10s.",
    importOk: "Spielstand geladen.",
    importReset: "Datei stammt aus Version {version} und wurde auf ein neues Spiel zurückgesetzt.",
    importBadFormat: "Das ist keine Spirit-Idland-Datei.",
    importBadChecksum: "Die Datei wurde verändert und wird nicht geladen.",
    importCancelled: "Import abgebrochen.",

    redeemLabel: "Code einlösen",
    redeemPlaceholder: "Code eingeben",
    redeemBtn: "Einlösen",
    redeemOk: "Code eingelöst. Die Playtest-Werkzeuge sind aktiv.",
    redeemAlready: "Dieser Code ist bereits eingelöst.",
    redeemUnknown: "Unbekannter Code.",
    redeemPlaytestLog: "Playtest-Werkzeuge aktiviert.",
    playtestHideBtn: "Playtest-Werkzeuge ausblenden",
    playtestHiddenLog: "Playtest-Werkzeuge ausgeblendet.",
    playtestEnergyBtn: "+{amount} Energie",
    playtestEnergyTitle: "Playtest: {amount} Energie hinzufügen",
    playtestEnergyLog: "Playtest: +{amount} Energie.",
    playtestFearBtn: "+{amount} Furcht",
    playtestFearTitle: "Playtest: {amount} Furcht hinzufügen",
    playtestFearLog: "Playtest: +{amount} Furcht.",
    playtestTally: "Zyklus: {generated} Furcht erzeugt · {spent} ausgegeben",
    // Angehängt statt eingebaut: wer die Knöpfe nie drückt, soll auch keine dritte Zahl lesen.
    playtestTallyGranted: " · {granted} geschenkt",
    playtestTallyTitle: "Playtest: Furcht dieses Zyklus, also seit der letzten Aszension. Erzeugt = von Runden eingezahlt, ausgegeben = im Laden. Geschenkte Furcht zählt getrennt, damit die erzeugte Zahl ehrlich bleibt.",

    explorersLabel: "Entdecker",
    townsLabel: "Dörfer",
    citiesLabel: "Städte",
    // Build and defeat lines name one unit at a time, and "+1 Städte" reads as a typo.
    explorersOne: "Entdecker",
    townsOne: "Dorf",
    citiesOne: "Stadt",
    dahanLabel: "Dahan",
    invadersLabel: "Invasoren",
    ownForcesLabel: "Eigene Kräfte",
    noInvadersHere: "Keine Invasoren.",
    neighboursLabel: "Angrenzend",
    coastalLabel: "Küste",
    inlandLabel: "Binnenland",
    invaderHpHint: "HP {current}/{max}",
    landBlightLabel: "Verderbnis hier",
    defeatHint: "Besiegt: -{count} {unit}",
    blightHint: "+{amount} Verderbnis",

    etaNever: "nie",
    pressureNoInvaders: "keine Invasoren",
    pressureHeld: "gehalten - {line}",
    pressureChip: "+{rate}% / s - nächste in {eta}",
    pressureDetail: "{gross} Schaden - {defence} Dahan = {net}/s. +{rate}% Verderbnis pro Sekunde, nächste in {eta}.",
    pressureDetailHeld: "{gross} Schaden gegen {defence} Dahan-Abwehr: aufgehalten, aber {net}/s sickern durch. +{rate}% Verderbnis pro Sekunde, nächste in {eta}.",
    // Ein Schutzwall, der den ganzen Angriff auffängt: kein Sickern, kein Verlust an Dahan.
    pressureDenied: "abgeschirmt - Schutz {defense} deckt {gross} Schaden",
    pressureDetailDenied: "{gross} Schaden gegen Schutz {defense}: nichts kommt durch. Der Schutzwall vergeht eine Welle, nachdem er zum ersten Mal gewirkt hat.",
    // Ein Schutzwall, der nur einen Teil auffängt - der Rest trifft das Gebiet als kleinerer Angriff.
    pressureDetailWarded: "{gross} Schaden - Schutz {defense} = {effective}, davon {defence} durch Dahan = {net}/s. +{rate}% Verderbnis pro Sekunde, nächste in {eta}.",
    landDefenseLabel: "Schutz hier",
    buildChip: "+1 {unit}",
    buildChipNone: "nichts hier",
    blightBarLabel: "Verderbnis",
    dahanBarLabel: "Dahan-Gesundheit",
    invaderBarLabel: "Gesundheit",

    invaderTrackTitle: "Invasorenleiste",
    buildLabel: "Bauen:",
    discoverLabel: "Entdecken:",

    // Die Eskalationsleiter, wie sie auf der Leiste steht. Jede Zeile nennt die Welle, ab der
    // sie gilt - und weil die Leiter pro Runde zählt, fängt jede Runde wieder unten an.
    ladderTitle: "Eskalation",
    ladderHint: "Ab dieser Welle. Jede Runde beginnt wieder ganz unten.",
    ladderWaveTitle: "Welle {wave}",
    rungUnrestricted: "Entdecken erreicht jedes Gebiet",
    rungSecondExplorer: "Ein Gebiet bekommt einen zweiten Entdecker",
    rungBonusTown: "Ein Dorf erhebt sich, wo keines steht",
    rungDoubleSeed: "Zwei Entdecker in jedem Gebiet",
    rungExtraLand: "Ein zusätzliches Gebiet abseits der Leiste",
    rungTwoTerrains: "Entdecken zieht zwei Geländearten, auch die vom Bauen",
    rungBuildTwice: "Bauen läuft zweimal",
    rungThreeTerrains: "Entdecken zieht drei Geländearten",
    rungAllTerrains: "Entdecken zieht jede Geländeart",
    rungInvaderDamage: "Invasoren schlagen härter",
    rungInvaderHealth: "Invasoren werden zäher",
    rungRepeated: "{text} (jetzt +{bonus})",

    dahanAttackLabel: "Dahan-Angriff",
    dahanStrikeBarLabel: "Dahan schlagen zu, wenn der Balken voll ist",
    buildWord: "Bauen",
    invaderNone: "-",
    landDisplay: "Gebiet {id} - {terrain}",
    landShort: "Gebiet {id}",
    invaderLandNames: {
      mountains: "Berge",
      desert: "Wüste",
      jungle: "Dschungel",
      wetlands: "Sümpfe"
    },

    roundStarted: "Runde {round} beginnt. Verderbnisgrenze {threshold}.",
    roundEnded: "Runde {round} verloren bei Welle {wave}: Verderbnis {blight}/{threshold}. {fear} Furcht gebucht.",
    waveResolved: "Welle {wave} aufgelöst.",
    waveMilestone: "Hochwassermarke bei Welle {wave}: +{fear} Furcht.",
    waveIncoming: "Invasorenleiste - Bauen: {build}, Entdecken: {discover}.",
    dahanAttackResolved: "Dahan greifen in {land} an: {damage} Schaden, {defeated} Invasoren besiegt.",
    dahanAttackNoTargets: "Dahan-Angriff: kein Gebiet mit Invasoren und Dahan.",
    dahanFell: "{count} Dahan fallen in {land}. Noch {left} übrig.",
    blightGained: "Verderbnis in {land}: +{amount}. Gesamt {total}/{threshold}.",
    buildNothing: "Bauen: noch kein Gebiet auf der Leiste.",
    buildNoInvaders: "Bauen in {land}: keine Invasoren, nichts wird gebaut.",
    buildResolved: "Bauen in {land}: +1 {unit}.",
    exploreNothing: "Entdecken: kein Gebiet gezogen.",
    exploreResolved: "Entdecken in {land}: +{count} Entdecker.",
    exploreBlocked: "Entdecken in {land}: kein Zugang, keine Küste und kein Dorf/keine Stadt daneben.",
    exploreNoneReachable: "Entdecken in {terrain}: kein Gebiet erreichbar.",
    bonusTownResolved: "Ein Dorf erhebt sich in {land}.",
    setupExplore: "Die Invasoren gehen an Land.",
    dahanRoundLog: "Dahan versammeln sich: {summary}.",

    abilityOnCooldown: "{ability} klingt noch {seconds}s ab.",
    abilityArmedLog: "{ability}: wähle ein Ziel.",
    abilityCancelled: "{ability} abgebrochen.",
    abilityNoTarget: "{ability} findet kein gültiges Ziel. Abklingzeit läuft nicht.",
    abilityIllegalTarget: "{land} ist kein gültiges Ziel für {ability}.",
    boonResolved: "Boon of Vigor: +{amount} Energie.",
    pushResolved: "{ability}: {total} Einheiten von {from} nach {to} geschoben.",
    seaResolved: "{ability}: {total} Einheiten aus {land} ins Meer gespült.",
    damageResolved: "{ability} in {land}: {damage} Schaden, {defeated} Invasoren besiegt.",
    damageEachResolved: "{ability} in {land}: {damage} Schaden auf jeden Invasor, {defeated} besiegt.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}. Jetzt {total} dort.",

    abilityUnlocked: "{ability} freigeschaltet für {cost} Energie.",
    abilityUnlockTooExpensive: "{ability} kostet {cost} Energie. Du hast {energy}.",
    abilityUpgraded: "{ability} auf Stufe {tier} gebracht für {cost} Energie.",
    abilityUpgradeTooExpensive: "Stufe {tier} von {ability} kostet {cost} Energie. Du hast {energy}.",
    abilityFocused: "{ability} fokussiert: Abklingzeit jetzt {pct}% kürzer, für {cost} Energie.",
    abilityFocusTooExpensive: "{ability} kostet {cost} Energie für mehr Fokus. Du hast {energy}.",

    upgradePurchased: "Gekauft: {upgrade} (Stufe {tier}) für {cost} Furcht.",
    // Ein Becken hat keine Stufe zu melden - also meldet es, was hineinging und was herauskam.
    upgradeInvested: "{upgrade}: {cost} Furcht erinnert. Jetzt {pct}% schneller - ein Schlag alle {seconds}s.",
    upgradeTooExpensive: "{upgrade} kostet {cost} Furcht. Du hast {fear}.",
    upgradeMaxed: "{upgrade} ist bereits auf der höchsten Stufe.",
    upgradeLocked: "{upgrade} bleibt verschlossen, bis {presence} mit Präsenz gekauft ist.",

    migrationReset: "Alter Spielstand (Version {version}) ist nicht mit dem Rundenmodus kompatibel und wurde zurückgesetzt.",
    saveWiped: "Spielstand gelöscht.",
    manualSaved: "Manuelles Speichern abgeschlossen.",
    saveExported: "Spielstand als {file} exportiert.",
    saveImported: "Spielstand importiert: Runde {round}, Welle {wave}.",
    spiritAwakens: "Der Geist erwacht."
  },

  en: {
    langToggle: "Deutsch",

    roundLabel: "Wave",
    bestWaveLabel: "Highest wave",
    cycleBestWaveLabel: "This cycle",
    blightLabel: "Blight",
    waveLabel: "Next wave",
    fearLabel: "Fear",
    // Beside the banked purse: what this round has added to it so far, unspendable until the
    // round ends.
    fearRoundHint: "(+{fear} this round)",
    // A line below, and only when a ladder is actually contributing: how the line above splits.
    // The two figures together are exactly the number above them.
    fearSplitHint: "+{fear} base (+{bonus} from upgrades)",
    secondsShort: "{seconds}s",
    wavePausedValue: "Paused",
    waveHeldValue: "Waiting",
    startNextWaveBtn: "Start wave",
    autoWaveLabel: "Auto",
    autoWaveHint: "Let the next wave start by itself. Off: time stops at the end of the bar until you start the wave.",
    autoRoundLabel: "Auto\nround",
    autoRoundHint: "Let the next round start by itself. Off: the shop stays open until you start it.",
    autoCastLabel: "Auto",
    autoCastHint: "Let this ability cast itself. Off: the automation stays bought and the ability goes back to being cast by hand. Nothing is refunded and no cooldown changes.",
    speedLabel: "Speed",
    speedOptionTitle: "Game speed {speed}x",
    speedPausedTitle: "Paused - time stands still",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Active spirit:",

    abilitiesTitle: "Abilities",
    abilitiesHint: "Casting costs only a cooldown. Energy unlocks new abilities.",
    energyLabel: "Energy",
    energyHint: "Energy comes from defeated invaders: 1 per Explorer, 2 per Town, 3 per City. Boon of Vigor grants +1. It resets when a round starts - to 0, or to whatever Headwaters pays - and everything bought with it goes with it.",
    abilityReady: "Ready",
    abilityArmed: "Pick a land",
    abilityCooldown: "{seconds}s",
    abilityLocked: "Locked",
    abilityUnlockBtn: "{cost} Energy",
    abilityTierLabel: "Tier {tier}",
    abilityUpgradeBtn: "Tier {tier}: {cost} Energy",
    abilityFocusBtn: "Focus: {cost} Energy",
    abilityNames: {
      innate_power: "Innate Power",
      boon_of_vigor: "Boon of Vigor",
      rivers_bounty: "River's Bounty",
      flash_floods: "Flash Floods",
      wash_away: "Wash Away",
      // The seven power cards sit in the same table as the kit, because a card is an ability
      // in every respect that matters and abilityName does not ask which it is looking at.
      pull_beneath: "Pull Beneath the Hungry Earth",
      song_of_sanctity: "Song of Sanctity",
      uncanny_melting: "Uncanny Melting",
      natures_resilience: "Nature's Resilience",
      encompassing_ward: "Encompassing Ward",
      accelerated_rot: "Accelerated Rot",
      tsunami: "Tsunami"
    },
    abilityTexts: {
      innate_power: [
        "Push {push} Explorer/Town into an adjacent land.",
        "Deal {damage} damage. Push up to {push} Explorers/Towns into an adjacent land.",
        "Deal {damage} damage to each invader in the chosen land."
      ],
      boon_of_vigor: "Gain {amount} Energy.",
      rivers_bounty: "+{amount} Dahan to the land with the fewest Dahan and Invaders if possible.",
      flash_floods: "{damage} damage. If the target land is coastal, +{coastal} damage.",
      wash_away: "Push up to {push} Explorers/Towns to an adjacent land. From a coastal land, up to {sea} are washed out to sea and off the island instead.",
      // A card's numbers come out of its step list rather than out of the translation - see
      // cardTextVars. Retune a number in POWER_CARDS and these move with it.
      pull_beneath: "{fear} Fear and {damage} damage. If the target land is {terrains}, +{bonus} damage.",
      song_of_sanctity: "Destroy {destroy} Explorer, then push all other Explorers. With no Explorer in the target, remove {blight} Blight instead.",
      uncanny_melting: "If Invaders are present, {fear} Fear per Invader. If the target land is {terrains}, remove {blight} Blight.",
      natures_resilience: "Defend {defend}. Remove {blight} Blight.",
      encompassing_ward: "Defend {defend} in each land.",
      accelerated_rot: "{fear} Fear. {damage} damage. Remove {blight} Blight.",
      tsunami: "Coastal land only: {fear} Fear, {damage} damage, destroy {dahan} Dahan. With the switch on, each other coastal land takes {alsoFear} Fear and {alsoDamage} damage and loses {alsoDahan} Dahan."
    },

    mapTitle: "The Island",

    shopTitle: "Between Rounds",
    shopLostRound: "Round {round} lost. {fear} Fear earned this round.",
    shopRoundRunning: "Round {round} running, wave {wave}. {fear} Fear so far - banked when the round ends.",
    shopFearLabel: "Fear available",
    shopTierLabel: "Tier {tier}",
    // For a ladder with a known top - see upgradeStatusText.
    shopTierLabelMax: "Tier {tier}/{max}",
    // What a pool shows where a ladder shows its tier - see upgradeStatusText.
    shopHasteLabel: "{pct}% faster",
    shopCostLabel: "{cost} Fear",
    // The pool's buttons: a denomination each, then everything the purse holds.
    shopInvestBtn: "+{amount}",
    shopInvestMaxBtn: "Max",
    shopInvestTitle: "Invest {amount} Fear",
    shopInvestMaxTitle: "Invest {amount} Fear - everything you can afford",
    shopMaxedBtn: "Maxed",
    shopOwnedBtn: "Owned",
    shopOneOffLabel: "One-off",
    shopSoldOutLabel: "Already bought",
    shopPendingHint: "Takes effect next round.",
    startNextRoundBtn: "Start next round",

    /* ---------- Ascension and Presence ---------- */
    ascensionTitle: "Ascension",
    ascensionPresenceLabel: "Presence",
    ascensionPayoutLabel: "Ascending pays",
    ascensionCountLabel: "Ascended so far",
    ascensionGeneratedLabel: "This cycle generated",
    // The payout is a root, so the figure alone never says how close the next Presence is.
    // This line says it: the Fear still to generate before the button pays one more.
    ascensionNextPresenceHint: "{fear} more Fear until the next Presence.",
    // What unspent Presence is worth right now instead of being spent: 1% more Fear per point,
    // on every kill, wave and milestone. Shown only when it is actually contributing - at 0
    // Presence "+0%" would just be another line to read for nothing.
    ascensionPresenceBonusHint: "+{percent}% Fear from unspent Presence.",
    // What the button costs, before the button rather than after it. The one thing in the game
    // that cannot be undone.
    ascensionLossHint: "Ascending takes all of it: {fear} Fear and {tiers} purchased tiers. Presence and your highest wave stay.",
    ascensionBtn: "Ascend",
    ascensionConfirmBtn: "Ascend, and mean it",
    ascensionLockedHint: "Not until ascending pays {presence} Presence.",
    ascensionRoundHint: "Between rounds only.",
    ascensionShopLabel: "What Presence unlocks",
    ascended: "Ascension {count}. {generated} Fear this cycle became {presence} Presence - {total} in all. The island begins again.",
    ascendRefused: "Not yet. Ascending waits for the end of a round, and for a cycle worth giving back.",
    presenceNames: {
      presence_tide_returns: "The Tide Returns",
      presence_river_knows: "The River Knows Its Own Need",
      presence_current_quickens: "The Current Quickens",
      // One family, because they are one mechanism: the island remembers what was already paid
      // for and asks less the next time. Each names the Fear row it walks down, so the pairing
      // is readable off the two shops without the player learning a mapping.
      presence_boon_remembered: "The Boon Remembered",
      presence_instinct_remembered: "The Instinct Remembered",
      presence_bounty_remembered: "The Bounty Remembered",
      presence_flood_remembered: "The Flood Remembered",
      presence_current_remembered: "The Current Remembered",
      presence_need_remembered: "The Need Remembered",
      presence_tide_remembered: "The Tide Remembered"
    },
    presenceTexts: {
      presence_tide_returns: "Opens \"The Tide Returns\" in the Fear shop. Its Fear price is still owed - every cycle, again.",
      presence_river_knows: "Opens \"The River Knows Its Own Need\" in the Fear shop. Its Fear price is still owed - every cycle, again.",
      presence_current_quickens: "Unlocks Focus: ability cooldowns can be shortened mid-round with Energy, down to 30% of where they started.",
      // Fallbacks only - presenceUpgradeText builds these rows from the live price. Kept so the
      // "every row has a text in both languages" test has something to find and so a row is
      // never blank if the dynamic tables lose a key.
      presence_boon_remembered: "Lowers what \"Boon Unbidden\" costs in the Fear shop, one rung a tier.",
      presence_instinct_remembered: "Lowers what \"Innate Instinct\" costs in the Fear shop, one rung a tier.",
      presence_bounty_remembered: "Lowers what \"The River Provides\" costs in the Fear shop, one rung a tier.",
      presence_flood_remembered: "Lowers what \"The Flood Unbidden\" costs in the Fear shop, one rung a tier.",
      presence_current_remembered: "Lowers what \"The Current Unbidden\" costs in the Fear shop, one rung a tier.",
      presence_need_remembered: "Lowers what \"The River Knows Its Own Need\" costs in the Fear shop, one rung a tier.",
      presence_tide_remembered: "Lowers what \"The Tide Returns\" costs in the Fear shop, one rung a tier."
    },
    // Both halves name the price rather than the discount. What the player is deciding is what
    // the row will cost them next cycle, and "300, then 200" answers that where "-100 Fear"
    // makes them do the arithmetic.
    presenceNextTexts: {
      discount: "{upgrade} costs {current} Fear every cycle. Next tier: {next}."
    },
    presenceMaxedTexts: {
      discount: "{upgrade} costs {current} Fear every cycle - the least the island will ask."
    },
    presencePurchased: "{upgrade} for {cost} Presence. {unlocks} is in the shop now.",
    presencePurchasedDirect: "{upgrade} for {cost} Presence.",
    presenceDiscounted: "{upgrade} for {cost} Presence. {unlocks} costs {price} Fear now.",
    presenceOwned: "{upgrade} is already yours.",
    presenceMaxed: "{upgrade} has nothing further to give back.",
    presenceTooExpensive: "{upgrade} costs {cost} Presence, you have {presence}.",
    presenceCostLabel: "{cost} Presence",
    presenceOwnedBtn: "Unlocked",
    presenceMaxedBtn: "Maxed",
    upgradeNames: {
      dahan_reinforcement: "Dahan Reinforcement",
      blight_resilience: "Blight Resilience",
      headwaters: "Headwaters",
      rising_dread: "Rising Dread",
      mounting_terror: "Mounting Terror",
      high_water_mark: "High-Water Mark",
      power_card_interval: "The Island Remembers Sooner",
      dahan_remember:"The Dahan Remember",
      auto_boon: "Boon Unbidden",
      auto_innate: "Innate Instinct",
      auto_wash_away: "The Current Unbidden",
      auto_bounty: "The River Provides",
      auto_flash_floods: "The Flood Unbidden",
      auto_buy_abilities: "The River Knows Its Own Need",
      auto_start_round: "The Tide Returns"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 starting Dahan, per tier.",
      blight_resilience: "+1 Blight threshold, per tier.",
      headwaters: "Each round opens with Energy in hand: 1 / 2 / 3 / 5 / 8 / 13 / 19 / 26 / 35 by tier. Tier 9 is the whole unlock kit, bought before the first wave.",
      rising_dread: "+10% Fear from defeated invaders, per tier.",
      mounting_terror: "+10% Fear from surviving waves, per tier.",
      high_water_mark: "Every 10th wave pays a bonus of 10% of its own number as Fear, per tier. Wave 50 at tier 3 pays 15 more.",
      power_card_interval: "The gap between two power cards shrinks by 1 wave, per tier. Fallback only - the row prints the intervals themselves.",
      dahan_remember: "Fear poured into the memory of the Dahan, 100 for every 1% - they strike sooner for it. At 100% they strike twice as often.",
      auto_boon: "Boon of Vigor casts itself whenever it is ready.",
      auto_innate: "The Innate casts itself whenever it is ready, at whichever tier you own.",
      auto_wash_away: "Wash Away casts itself and picks its own target, once unlocked and ready.",
      auto_bounty: "River's Bounty casts itself, once unlocked and ready.",
      auto_flash_floods: "Flash Floods casts itself and strikes where it kills, once unlocked and ready.",
      auto_buy_abilities: "Energy spends itself: the locked abilities first, cheapest before dearest, then the Innate's next tier.",
      auto_start_round: "The next round starts by itself. Switch it off when you want to shop in peace."
    },
    // What the next tier buys, in place of the shape of the whole ladder - see
    // NEXT_TIER_UPGRADE_TEXT.
    upgradeNextTexts: {
      headwaters: "Next tier: +{gain} Energy at round start, for {next} in hand.",
      high_water_mark: "Next tier: +{pct}% of each 10th wave's number as Fear - wave {wave} pays {next} instead of {current}.",
      // No comparison against the base here: at zero invested - which is where every player
      // first reads this row - "every 20s, against 20s" is a sentence that says nothing. The
      // maxed text below is where the two numbers are worth putting side by side.
      dahan_remember: "{invested} / {full} Fear remembered ({pct}%). The Dahan strike every {seconds}s. 100 Fear buys another 1%.",
      power_card_interval: "The first power card arrives on wave {first}, then one every {current} waves. Next tier: every {next}."
    },
    upgradeMaxedTexts: {
      headwaters: "Every round opens with {energy} Energy in hand: the whole unlock kit, before the first wave.",
      power_card_interval: "The first power card arrives on wave {first}, then one every {current} waves - the island remembers no sooner than that.",
      dahan_remember: "All {full} Fear remembered. The Dahan strike every {seconds}s - twice as often as the {base}s they began with."
    },

    /* ---------- Power cards ---------- */
    // The draw row in the Presence shop: three on show, one kept.
    cardShopLabel: "Power cards",
    cardShopHint: "Three are offered, one is yours - kept forever, ascension included. It only reaches your hand once a round runs deep enough.",
    cardDrawCostLabel: "{cost} Presence",
    // The cooldown gets a line of its own under the name because at the point of purchase it is
    // the question: the three on offer differ less in what they do than in how often they may
    // do it. The label carries the word, not just the number - a bare "24s" beside a price does
    // not say which of the round's several clocks it is.
    cardOfferCooldownLabel: "{seconds}s cooldown",
    cardOfferCooldownHint: "The wait between casts, before Focus shortens it. No card casts itself, so this is how often you can play it by hand.",
    // The price names its currency, like the buy button above it: a bare number in brackets
    // reads as "3 re-rolls left" rather than as what it costs.
    cardRerollBtn: "Re-roll: {cost} Presence",
    cardRerollHint: "At least two cards this offer does not hold.",
    cardRerollDeadHint: "Three cards left - every one of them is already on show.",
    cardShopSoldOut: "All seven cards are yours.",
    cardOwnedLabel: "Owned: {count} / {total}",
    // On the card itself, in the ability bar.
    cardTag: "Card",
    cardRedrawBtn: "Re-draw: {cost} Energy",
    cardRedrawHint: "Throw this card back and draw another. The moment you cast it, it is yours for the round.",
    cardOptionLabel: "Coasts",
    cardOptionHint: "Hits every other coastal land too - less Fear and damage, and it costs Dahan there as well. Off: the chosen land only.",
    cardNextDrawHint: "Next card: wave {wave}",
    // The countdown on the wave tile and the reveal over the island. Both name the wave,
    // because the wave is the price: Presence buys the card, waves survived buy the moment it
    // arrives.
    cardCountdownWaves: "Card in {waves} waves",
    cardCountdownNext: "Card: next wave",
    cardRevealTitle: "Wave {wave} brings",
    // Log lines.
    cardBought: "{card} for {cost} Presence. The island remembers.",
    cardTooExpensive: "{card} costs {cost} Presence, you have {presence}.",
    cardRerolled: "Re-rolled for {cost} Presence. {presence} left.",
    cardRerollTooExpensive: "A re-roll costs {cost} Presence, you have {presence}.",
    cardRerollRefused: "Every remaining card is already on show - a re-roll would buy nothing.",
    cardDrawn: "Wave {wave}: {card} arrives in hand.",
    cardRedrawn: "{card} thrown back for {cost} Energy. {next} instead.",
    cardRedrawTooExpensive: "A re-draw costs {cost} Energy, you have {energy}.",
    cardResolved: "{card} in {land}: {summary}.",
    cardResolvedNoLand: "{card}: {summary}.",
    // The pieces of that summary, in the order they are gathered.
    cardPartFear: "{amount} Fear",
    cardPartDamage: "{amount} damage",
    cardPartDefeated: "{count} defeated",
    cardPartPushed: "{count} pushed",
    cardPartBlight: "{amount} Blight removed",
    cardPartDefend: "Defend {amount}",
    cardPartDahan: "{count} Dahan lost",

    logTitle: "Event log",
    manualSaveBtn: "Save now",
    exportSaveBtn: "Export",
    importSaveBtn: "Import",
    wipeSaveBtn: "Wipe save",
    autosaveHint: "Autosave every 10s.",
    importOk: "Save loaded.",
    importReset: "That file is from version {version} and was reset to a fresh game.",
    importBadFormat: "That is not a Spirit Idland save file.",
    importBadChecksum: "That file has been edited and will not be loaded.",
    importCancelled: "Import cancelled.",

    redeemLabel: "Redeem code",
    redeemPlaceholder: "Enter code",
    redeemBtn: "Redeem",
    redeemOk: "Code redeemed. The playtest tools are active.",
    redeemAlready: "That code is already redeemed.",
    redeemUnknown: "Unknown code.",
    redeemPlaytestLog: "Playtest tools activated.",
    playtestHideBtn: "Hide playtest tools",
    playtestHiddenLog: "Playtest tools hidden.",
    playtestEnergyBtn: "+{amount} Energy",
    playtestEnergyTitle: "Playtest: add {amount} energy",
    playtestEnergyLog: "Playtest: +{amount} Energy.",
    playtestFearBtn: "+{amount} Fear",
    playtestFearTitle: "Playtest: add {amount} fear",
    playtestFearLog: "Playtest: +{amount} Fear.",
    playtestTally: "Cycle: {generated} Fear generated · {spent} spent",
    // Appended rather than built in: a playtester who never presses the grant has no third
    // number to read.
    playtestTallyGranted: " · {granted} granted",
    playtestTallyTitle: "Playtest: this cycle's Fear, i.e. since the last ascension. Generated = banked by rounds, spent = in the shop. Granted Fear is counted apart, so the generated figure stays honest.",

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
    // A ward that covered the whole attack: no seep, and no Dahan lost either.
    pressureDenied: "warded - Defend {defense} covers {gross} damage",
    pressureDetailDenied: "{gross} damage against Defend {defense}: nothing gets through. The ward lapses one wave after the first moment it did anything.",
    // A ward that covered part of it - what is left hits the land as a smaller attack.
    pressureDetailWarded: "{gross} damage - Defend {defense} = {effective}, less {defence} Dahan = {net}/s. +{rate}% Blight per second, next in {eta}.",
    landDefenseLabel: "Defense here",
    buildChip: "+1 {unit}",
    buildChipNone: "nothing here",
    blightBarLabel: "Blight",
    dahanBarLabel: "Dahan health",
    invaderBarLabel: "Health",

    invaderTrackTitle: "Invader track",
    buildLabel: "Build:",
    discoverLabel: "Discover:",

    // The difficulty ladder, as the track prints it. Each line names the wave it starts at -
    // and because the ladder is counted per round, every round starts back at the bottom.
    ladderTitle: "Escalation",
    ladderHint: "From this wave on. Every round starts back at the bottom.",
    ladderWaveTitle: "Wave {wave}",
    rungUnrestricted: "Discover reaches every land",
    rungSecondExplorer: "One land takes a second Explorer",
    rungBonusTown: "A Town rises where there is none",
    rungDoubleSeed: "Two Explorers in every land",
    rungExtraLand: "One extra land, off the track",
    rungTwoTerrains: "Discover draws two terrains, Build included",
    rungBuildTwice: "Build runs twice",
    rungThreeTerrains: "Discover draws three terrains",
    rungAllTerrains: "Discover draws every terrain",
    rungInvaderDamage: "Invaders hit harder",
    rungInvaderHealth: "Invaders are tougher",
    rungRepeated: "{text} (now +{bonus})",

    dahanAttackLabel: "Dahan attack",
    dahanStrikeBarLabel: "The Dahan strike when this bar is full",
    buildWord: "Build",
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
    roundEnded: "Round {round} lost at wave {wave}: Blight {blight}/{threshold}. {fear} Fear banked.",
    waveResolved: "Wave {wave} resolved.",
    waveMilestone: "High-Water Mark at wave {wave}: +{fear} Fear.",
    waveIncoming: "Invader track - Build: {build}, Discover: {discover}.",
    dahanAttackResolved: "The Dahan strike in {land}: {damage} damage, {defeated} invaders defeated.",
    dahanAttackNoTargets: "Dahan attack: no land holds both invaders and Dahan.",
    dahanFell: "{count} Dahan fall in {land}. {left} still standing.",
    blightGained: "Blight in {land}: +{amount}. Total {total}/{threshold}.",
    buildNothing: "Build: no terrain on the track yet.",
    buildNoInvaders: "Build in {land}: no invaders, nothing is built.",
    buildResolved: "Build in {land}: +1 {unit}.",
    exploreNothing: "Discover: no terrain drawn.",
    exploreResolved: "Discover in {land}: +{count} explorers.",
    exploreBlocked: "Discover in {land}: no way in, not coastal and no town or city adjacent.",
    exploreNoneReachable: "Discover in {terrain}: no land reachable.",
    bonusTownResolved: "A town rises in {land}.",
    setupExplore: "The invaders come ashore.",
    dahanRoundLog: "The Dahan gather: {summary}.",

    abilityOnCooldown: "{ability} is still {seconds}s from ready.",
    abilityArmedLog: "{ability}: pick a target.",
    abilityCancelled: "{ability} cancelled.",
    abilityNoTarget: "{ability} finds no valid target. Cooldown unspent.",
    abilityIllegalTarget: "{land} is not a valid target for {ability}.",
    boonResolved: "Boon of Vigor: +{amount} Energy.",
    pushResolved: "{ability}: {total} units pushed from {from} to {to}.",
    seaResolved: "{ability}: {total} units carried out to sea from {land}.",
    damageResolved: "{ability} in {land}: {damage} damage, {defeated} invaders defeated.",
    damageEachResolved: "{ability} in {land}: {damage} damage to each invader, {defeated} defeated.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}. {total} standing there now.",

    abilityUnlocked: "{ability} unlocked for {cost} Energy.",
    abilityUnlockTooExpensive: "{ability} costs {cost} Energy. You have {energy}.",
    abilityUpgraded: "{ability} raised to tier {tier} for {cost} Energy.",
    abilityUpgradeTooExpensive: "Tier {tier} of {ability} costs {cost} Energy. You have {energy}.",
    abilityFocused: "{ability} focused: cooldown now {pct}% shorter, for {cost} Energy.",
    abilityFocusTooExpensive: "{ability} costs {cost} Energy for more Focus. You have {energy}.",

    upgradePurchased: "Purchased: {upgrade} (tier {tier}) for {cost} Fear.",
    // A pool has no tier to report, so it reports what went in and what came out of it.
    upgradeInvested: "{upgrade}: {cost} Fear remembered. Now {pct}% faster - a strike every {seconds}s.",
    upgradeTooExpensive: "{upgrade} costs {cost} Fear. You have {fear}.",
    upgradeMaxed: "{upgrade} is already at its highest tier.",
    upgradeLocked: "{upgrade} stays sealed until {presence} is bought with Presence.",

    migrationReset: "The old save (version {version}) is not compatible with the round-based build and was reset.",
    saveWiped: "Save wiped.",
    manualSaved: "Manual save completed.",
    saveExported: "Save exported as {file}.",
    saveImported: "Save imported: round {round}, wave {wave}.",
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

