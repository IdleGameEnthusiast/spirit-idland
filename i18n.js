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
    abilityFocusBtn: "{cost} Energie - Abklingzeit -{seconds} Sek",
    abilityFocusHint: "Fokus: Jeder Kauf nimmt weitere {seconds} Sek von dieser Abklingzeit - immer gleich viel, zu steigendem Preis. Schluss ist bei {floor} Sek, einem Drittel des Ausgangswerts.",

    /* Die Auto-Kauf-Lade. Der Knopf sitzt in der Energie-Börse, die Lade klappt darunter auf.
       Die drei Sprossen sind kumulativ - jede schließt die darüber ein - deshalb trägt die
       unterste ein "+" im Namen und die oberen nicht. Die Innate-Stufen sind keine Sprosse
       mehr: darüber entscheidet "Energie in" in der Energie-Börse. */
    autoBuyBtn: "Anpassen",
    autoBuyBtnHint: "Einstellen, wofür die Runde ihre Energie von selbst ausgibt.",
    autoBuyTitle: "Auto-Kauf",
    autoBuySub: "Wie weit die Runde ihre Energie von selbst ausgibt.",
    autoBuySpendLegend: "Ausgeben für",
    autoBuyModeOff: "Nichts",
    autoBuyModeOffWhy: "alles von Hand",
    autoBuyModeUnlocks: "Freischaltungen",
    // Sagt, was diese Sprosse nicht kauft, statt die Preisleiter aufzuzählen: die Innate-Stufen
    // sind der eine Kauf, den sie auslässt, und "Energie in" nebenan ist der Grund.
    autoBuyModeUnlocksWhy: "(außer Innate)",
    autoBuyModeFocus: "+ Fokus",
    autoBuyModeFocusWhy: "der ganze Rest",
    // Steht statt "der ganze Rest", solange die Präsenz-Zeile fehlt. Nennt sie beim Namen,
    // weil die Sprosse sonst nur grau ist und nicht sagt, woran es liegt.
    autoBuyModeFocusLocked: "braucht \"Der Fluss gräbt tiefer\"",
    innateSplitLegend: "Energie in",
    innateSplitFocus: "Fokus",
    innateSplitTier: "Innate-Stufe {tier}",
    innateSplitHint: "Wohin die Automatik die Energie dieser Runde steckt. Auf eine Stufe gestellt spart sie darauf, statt Fokus zu kaufen - ist die Stufe erreicht, geht wieder alles in Fokus. Von Hand bleibt jede Stufe kaufbar.",
    autoBuyOrderLegend: "Fokus-Reihenfolge",
    autoBuyOrderValue: "Bester Wert",
    autoBuyOrderValueWhy: "Tempo je Energie",
    autoBuyOrderCheap: "Günstigste Sprosse",
    autoBuyOrderCheapWhy: "breit statt tief",
    autoBuyFocusLegend: "Fokus erlaubt für",
    // Abklingzeit jetzt, und wo die Leiter dieser Fähigkeit endet.
    autoBuyFocusRange: "{now} → {floor}",
    autoBuyFocusRangeHint: "Abklingzeit jetzt {now} Sek, Ende der Leiter {floor} Sek.",
    autoBuyFoot: "Nicht ausgegebene Energie verfällt am Rundenende.",
    autoBuyCloseHint: "Esc, oder daneben klicken",
    autoBuyDone: "Fertig",
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
    /* Die vier Überschriften im Furchtladen, in der Reihenfolge des Regals (UPGRADE_GROUP_IDS).
     * Der Laden zeichnet eine davon, sobald die Gruppe wechselt - "Einmalig" stand hier
     * früher allein und beschrieb die Art des Kaufs statt das, was er kauft. */
    shopGroupLabels: {
      waves: "Wellenfortschritt",
      fear: "Furchtquellen",
      dahan: "Die Dahan",
      // Alle Einmalkäufe sind Automatisierungen, deshalb sagt die Zeile das Was statt das Wie.
      automation: "Automatisierung"
    },
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
    ascendedStartFear: "Die Furcht bleibt: {fear} Furcht liegen schon bereit.",
    ascendRefused: "Noch nicht. Aufsteigen geht erst zwischen den Runden, und erst wenn der Zyklus es wert ist.",
    presenceNames: {
      presence_tide_returns: "Die Flut kehrt wieder",
      presence_river_knows: "Der Fluss weiß, was er braucht",
      // Nimmt sich, was die fünf Furchtzeilen im Namen teilen - siehe die englische Fassung.
      presence_all_unbidden: "Alles von selbst",
      presence_current_quickens: "Die Strömung eilt",
      // Nimmt den Fluss der Zeile auf, die sie erweitert ("Der Fluss weiß, was er braucht"):
      // dieselbe Automatik, eine Sprosse tiefer.
      presence_river_deepens: "Der Fluss gräbt tiefer",
      // Nicht nach Wasser benannt wie die übrigen, sondern nach dem, was bleibt: der Geist
      // zieht sich zurück, die Furcht der Invasoren nicht. Bewusst *nicht* "Die Insel erinnert
      // sich" - so heißt schon `power_card_interval` in der Furchtliste, und zwei Zeilen mit
      // fast demselben Namen stünden gleichzeitig nebeneinander im Rail.
      presence_fear_remains: "Die Furcht bleibt",
      // Benannt nach dem Ziel, nicht nach dem Übersprungenen - siehe die englische Fassung.
      // "Tiefes Wasser" ist in beiden Läden neu: Flut, Fluss, Strömung und Quellwasser sind
      // schon vergeben.
      presence_deep_water_comes: "Tiefes Wasser kommt früher",
      // Benannt gegen "Die Dahan erinnern sich" in der Furchtliste: dieselben Leute, das
      // zweite Verb. Erinnern ist, was sie schneller macht; ausharren ist, was sie stärker
      // macht - und die Zeile schaltet genau die Fortsetzung jener Zeile frei.
      presence_dahan_endure: "Die Dahan halten stand"
    },
    presenceTexts: {
      presence_tide_returns: "Neue Wellen starten von jetzt an von selbst.",
      presence_river_knows: "Fähigkeiten schalten sich von selbst für Energie frei.",
      presence_all_unbidden: "Schaltet die fünf Fähigkeits-Automatiken für immer frei - Segen, Instinkt, Gabe, Sturzflut und Strömung.",
      presence_current_quickens: "Schaltet Fokus frei: Energie während der Runde ausgeben und je Einsatz {seconds} Sek von der Abklingzeit einer Fähigkeit nehmen.",
      presence_river_deepens: "Der Auto-Kauf setzt auch Fokus ein und senkt die Abklingzeiten von selbst. Unter \"Anpassen\" legst du fest, was zuerst gekauft wird.",
      presence_fear_remains: "Beginne jede Aszension mit {step} Furcht in der Bank je Stufe. Zählt nicht gegen den Präsenzgewinn.",
      presence_deep_water_comes: "Jede Stufe schickt mehr vom Rundenanfang in den Zeitraffer: die ersten {share}% deiner höchsten Welle mit {speed}x.",
      presence_dahan_endure: "Schaltet eine Reihe neuer Furcht-Upgrades frei, mit denen die Dahan im Lauf einer Aszension neue Stärke finden."
    },
    // Der Trenner für Namenslisten in Logzeilen - siehe die englische Fassung.
    listSeparator: ", ",
    presenceGranted: "{upgrade} für {cost} Präsenz. {unlocks} gehört jetzt für immer dir.",
    presencePurchasedDirect: "{upgrade} für {cost} Präsenz.",
    presenceTierPurchased: "{upgrade}, Stufe {tier}/{max}, für {cost} Präsenz.",
    // Die Stufenanzeige der Zeitrafferzeile: Der Zeilentext sagt, was die nächste Stufe
    // kauft, die Anzeige darunter, was die gekaufte gerade gewährt - in Wellen, denn das ist
    // die Zahl, die der Spieler am Rundenanfang tatsächlich vorbeiziehen sieht.
    presenceTierFastForward: "Stufe {tier}/{max} - Zeitraffer für {waves} Wellen ({share}%)",
    fastForwardStarted: "Tiefes Wasser kommt früher: die ersten {waves} Wellen laufen mit {speed}x.",
    fastForwardEnded: "Welle {wave} - der Zeitraffer endet, das Tempo gehört wieder dir.",
    waveFastForwardValue: "Zeitraffer",
    presenceOwned: "{upgrade} gehört dir bereits.",
    presenceTooExpensive: "{upgrade} kostet {cost} Präsenz, du hast {presence}.",
    presenceLocked: "{upgrade} ist noch nicht zu haben.",
    presenceCostLabel: "{cost} Präsenz",
    presenceOwnedBtn: "Freigeschaltet",
    presenceLockedBtn: "Noch nicht",
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
      dahan_remember: "Alle {full} Furcht erinnert. Die Dahan schlagen alle {seconds}s zu - doppelt so oft wie die {base}s, mit denen sie begannen. Sie schlagen mit {damage} Schaden."
    },
    /* Der volle erste Vorrat: nicht fertig, sondern bereit. Die Zeile muss sagen, dass der
     * Tausch nichts kostet - {full} Furcht aufzugeben sieht nach Verlust aus, und der Grund,
     * warum es keiner ist, steht nicht auf dem Knopf. Doppelt so oft mal einfacher Schaden ist
     * genau einfach oft mal doppelter Schaden. */
    upgradeReadyTexts: {
      dahan_remember: "Alle {full} Furcht erinnert - und die Dahan haben noch etwas vor. Beginne von vorn: {strength} Schaden statt einem, dafür wieder alle {base}s. Das ist im selben Moment genau derselbe Schaden - und der Vorrat fasst danach {next} Furcht."
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
    cardOfferCooldownHint: "Die Wartezeit zwischen zwei Einsätzen, bevor Fokus sie in Schritten von {seconds} Sek verkürzt. Keine Karte wirkt sich selbst - so oft kannst du sie also von Hand spielen.",
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

    // Die Zeichenerklärung: was das Gebietsfeld zeigt, solange kein Land ausgewählt ist.
    // Jede Zahl darin kommt aus dem Zustand, damit die Erklärung nie etwas anderes behauptet
    // als das Brett daneben tut.
    legendTitle: "Zeichenerklärung",
    legendTag: "Karte",
    legendHint: "Klicke ein Gebiet an, um seine eigenen Zahlen zu sehen.",
    // Der Griff sagt, was ein Klick tut, nicht wie es gerade steht - das steht im Pfeil.
    legendFoldOpenHint: "Zeichenerklärung einklappen",
    legendFoldShutHint: "Zeichenerklärung ausklappen",
    legendInvadersLabel: "Invasoren",
    legendFightLabel: "Der Kampf",
    legendWaveLabel: "Die Welle",
    legendUnitNote: "{damage} Schaden, {health} Leben.",
    // Der wichtigste Satz der ganzen Erklärung, und deshalb der erste im Block: Es gibt keine
    // Angriffsphase, auf die man warten könnte.
    legendBlightTerm: "Verderbnis",
    legendBlightNote: "Es gibt keine Angriffsphase. Jedes Gebiet, in dem Invasoren stehen, wird in jedem Augenblick angegriffen. Je Punkt Schaden, den die Dahan nicht wegnehmen, wächst die Verderbnis um {rate}% pro Sekunde. {floor}% des Angriffs kommen immer durch, egal wie viele Dahan dort stehen - ein gehaltenes Gebiet sickert. Bei {threshold} endet die Runde.",
    legendDahanNote: "Deine Leute, aus Holz statt aus weißem Kunststoff. Solange sie stehen, nehmen sie je {damage} Schaden vom Angriff ihres Gebiets weg. {health} Leben, und sie fallen um {rate}% pro Punkt durchkommenden Schaden und Sekunde - gleich schnell, wie viele auch dort stehen.",
    legendStrikeTerm: "Dahan-Angriff",
    legendStrikeNote: "Alle {seconds}s schlagen alle Dahan zu, je {damage} Schaden, in jedem Gebiet mit Invasoren. Eine eigene Uhr, nicht die der Welle - deshalb zählt die Leiste oben zwei Zeiten.",
    legendWardTerm: "Schutzwall",
    legendWardNote: "Fängt so viel Angriff ab, wie er groß ist. Deckt er den ganzen Angriff, kommt gar keine Verderbnis durch - als Einziges, denn er schlägt auch die {floor}% oben. Er vergeht eine Welle, nachdem er zum ersten Mal etwas bewirkt hat.",
    legendBarsTerm: "Die Balken",
    legendBarsNote: "Zwei je Gebiet: die Verderbnis, die sich zum nächsten Fleck füllt, und die Verluste der Dahan. Beide laufen weiter, auch wenn sich die Zahl noch nicht bewegt hat - erst der volle Balken kostet eine Figur. Der Ring auf einer Figur zeigt, wie viel Leben ihr fehlt.",
    legendBuildNote: "Zuerst. Jedes Gebiet des Bau-Geländes, in dem Invasoren stehen, bekommt ein Dorf - oder eine Stadt, wenn dort schon mehr Dörfer als Städte sind. Leere Gebiete bauen nichts.",
    legendDiscoverTerm: "Entdecken",
    legendDiscoverNote: "Danach. Ein Entdecker in jedes Gebiet des Entdecken-Geländes, das an der Küste liegt oder an ein Dorf oder eine Stadt grenzt. Ab Welle {wave} in jedes Gebiet.",
    legendTrackTerm: "Die Leiste rückt",
    legendTrackNote: "Zuletzt. Was gerade entdeckt wurde, ist das Bau-Gelände der nächsten Welle - das Entdecken-Feld zeigt also schon, wo als Nächstes gebaut wird.",

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
    abilityFocused: "{ability} fokussiert: Abklingzeit -{seconds} Sek, jetzt {cooldown} Sek, für {cost} Energie.",
    abilityFocusTooExpensive: "{ability} kostet {cost} Energie für mehr Fokus. Du hast {energy}.",

    upgradePurchased: "Gekauft: {upgrade} (Stufe {tier}) für {cost} Furcht.",
    // Ein Becken hat keine Stufe zu melden - also meldet es, was hineinging und was herauskam.
    upgradeInvested: "{upgrade}: {cost} Furcht erinnert. Jetzt {pct}% schneller - ein Schlag alle {seconds}s.",
    dahanStrengthClaimed: "Die Dahan halten stand. Sie schlagen jetzt mit {damage} Schaden, wieder alle {seconds}s - und ihre Erinnerung fasst nun {full} Furcht.",
    dahanStrengthRefused: "Dafür ist es zu früh: die Erinnerung der Dahan muss voll sein, und die Runde muss vorbei sein.",
    shopDahanStrengthBtn: "Von vorn, mit +1 Schaden",
    shopDahanStrengthTitle: "Die Dahan schlagen fortan mit {damage} statt {base} Schaden. Der Vorrat leert sich und fasst danach {full} Furcht - im Moment des Tauschs ändert sich am Schaden nichts.",
    shopDahanStrengthWait: "Erst am Rundenende: der Tausch leert einen Vorrat, mit dem die laufende Runde noch rechnet.",
    upgradeTooExpensive: "{upgrade} kostet {cost} Furcht. Du hast {fear}.",
    upgradeMaxed: "{upgrade} ist bereits auf der höchsten Stufe.",

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
    autoBuyBtn: "Customize",
    autoBuyBtnHint: "Set how far the round spends its own Energy.",
    autoBuyTitle: "Auto-Buy",
    autoBuySub: "How far the round spends its own Energy.",
    autoBuySpendLegend: "Spends on",
    autoBuyModeOff: "Nothing",
    autoBuyModeOffWhy: "all by hand",
    autoBuyModeUnlocks: "Unlocks",
    autoBuyModeUnlocksWhy: "(except Innate)",
    autoBuyModeFocus: "+ Focus",
    autoBuyModeFocusWhy: "everything left",
    autoBuyModeFocusLocked: "wants \"The River Runs Deeper\"",
    innateSplitLegend: "Energy to",
    innateSplitFocus: "Focus",
    innateSplitTier: "Innate Tier {tier}",
    innateSplitHint: "Where the automation puts this round's Energy. Set to a tier it saves for that tier rather than buying Focus, and hands everything back to Focus once it gets there. By hand, every tier stays buyable.",
    autoBuyOrderLegend: "Focus order",
    autoBuyOrderValue: "Best value",
    autoBuyOrderValueWhy: "speed per Energy",
    autoBuyOrderCheap: "Cheapest rung",
    autoBuyOrderCheapWhy: "wide, not deep",
    autoBuyFocusLegend: "Focus allowed on",
    autoBuyFocusRange: "{now} → {floor}",
    autoBuyFocusRangeHint: "Cooldown now {now} Sec, end of the ladder {floor} Sec.",
    autoBuyFoot: "Energy left unspent burns at the end of the round.",
    autoBuyCloseHint: "Esc, or click away",
    autoBuyDone: "Done",
    abilityFocusBtn: "{cost} Energy - Cooldown -{seconds} Sec",
    abilityFocusHint: "Focus: each purchase takes another {seconds} Sec off this cooldown - always the same amount, at a rising price. It stops at {floor} Sec, a third of where the ability started.",
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
    shopGroupLabels: {
      waves: "Wave progression",
      fear: "Fear generators",
      dahan: "The Dahan",
      automation: "Automation"
    },
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
    // A second Reclaim line, printed only when the ladder has rungs on it - see `ascend`.
    ascendedStartFear: "The fear remains: {fear} Fear is already waiting.",
    ascendRefused: "Not yet. Ascending waits for the end of a round, and for a cycle worth giving back.",
    presenceNames: {
      presence_tide_returns: "The Tide Returns",
      presence_river_knows: "The River Knows Its Own Need",
      // Takes the word the five Fear rows it grants already share - three of them are
      // "Unbidden" and the German half of all five is "von selbst" - so the player reads the
      // pairing off the two shops rather than learning a mapping.
      presence_all_unbidden: "Everything Unbidden",
      presence_current_quickens: "The Current Quickens",
      // Takes the river from the row it extends - the same automation, one rung deeper.
      presence_river_deepens: "The River Runs Deeper",
      // The catalogue's only ladder. Not named for water like the rest but for what survives
      // the Reclaim: the spirit withdraws, the invaders' fear of it does not. Deliberately
      // *not* "The Island Remembers" - that is `power_card_interval` in the Fear shop, and the
      // two rails are on screen together.
      presence_fear_remains: "The Fear Remains",
      // Named for where it gets you rather than for what it leaves out: the deep part of the
      // round is the part worth playing, and arriving there sooner is the whole promise.
      // "Deep water" is unspoken-for in both shops - tide, river, current and headwaters are
      // all taken, and the island's memory twice over.
      presence_deep_water_comes: "Deep Water Comes Sooner",
      // Named against "The Dahan Remember" in the Fear list: the same people, the second verb.
      // Remembering is what makes them faster; enduring is what makes them stronger - and this
      // row unlocks precisely the continuation of that row.
      presence_dahan_endure: "The Dahan Endure"
    },
    presenceTexts: {
      presence_tide_returns: "New waves start themselves from now on.",
      presence_river_knows: "Abilities unlock themselves for Energy, automatically.",
      presence_all_unbidden: "Permanently unlocks the five ability automations - the Boon, the Instinct, the Bounty, the Flood and the Current.",
      presence_current_quickens: "Unlocks Focus: spend Energy mid-round to take {seconds} Sec off one ability's cooldown each cast.",
      presence_river_deepens: "Auto-buy casts Focus too, cutting ability cooldowns on its own. \"Customize\" is where you say what it buys first.",
      presence_fear_remains: "Start every ascension with {step} Fear in the bank per rank. Does not count against the Presence gain.",
      presence_deep_water_comes: "Each tier fast-forwards more of the opening: the first {share}% of your highest wave at {speed}x.",
      presence_dahan_endure: "Unlocks a run of new Fear upgrades, letting the Dahan find new strength over the course of an ascension."
    },
    // Says "for good", because that is the whole of what separates a Presence purchase from a
    // Fear one. {unlocks} is one row for two of the three grants and five for the other, joined
    // with listSeparator rather than given a line each - it was one purchase.
    // How a list of row names is joined inside a log line. In the locale table rather than in
    // the engine because it is punctuation, and punctuation is a language's business.
    listSeparator: ", ",
    presenceGranted: "{upgrade} for {cost} Presence. {unlocks} is yours for good.",
    presencePurchasedDirect: "{upgrade} for {cost} Presence.",
    // The ladder's line: ten identical purchase lines would report no progress, so the rung is
    // named. Only `presence_fear_remains` ever reaches this.
    presenceTierPurchased: "{upgrade}, tier {tier}/{max}, for {cost} Presence.",
    // The fast-forward row's chip. The row's text sells the next rung; the chip below it says
    // what the rung already owned grants right now - in waves, because that is the figure the
    // player actually watches go by at the start of a round.
    presenceTierFastForward: "Tier {tier}/{max} - fast-forwards {waves} waves ({share}%)",
    // The fast-forward says where it starts and where it stops, because between the two the
    // log is the only thing moving slowly enough to read.
    fastForwardStarted: "Deep Water Comes Sooner: the first {waves} waves run at {speed}x.",
    fastForwardEnded: "Wave {wave} - the fast-forward ends, the pace is yours again.",
    // Stands in for the wave countdown while the opening runs: at 50x the real figure would be
    // a blur, and what the player needs from that slot is the reason it is a blur.
    waveFastForwardValue: "Fast-forward",
    presenceOwned: "{upgrade} is already yours.",
    presenceTooExpensive: "{upgrade} costs {cost} Presence, you have {presence}.",
    presenceLocked: "{upgrade} is not for sale yet.",
    presenceCostLabel: "{cost} Presence",
    presenceOwnedBtn: "Unlocked",
    presenceLockedBtn: "Not yet",
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
      dahan_remember: "All {full} Fear remembered. The Dahan strike every {seconds}s - twice as often as the {base}s they began with. They strike for {damage} damage."
    },
    /* A full first pool: not finished, ready. The line has to say the trade is free - giving up
     * {full} Fear of haste looks like a loss, and the reason it is not one does not fit on the
     * button. Twice as often for single damage is exactly once as often for double. */
    upgradeReadyTexts: {
      dahan_remember: "All {full} Fear remembered - and the Dahan are not done. Start over: {strength} damage instead of one, back to every {base}s. That is the very same damage in the moment - and the pool holds {next} Fear afterwards."
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
    cardOfferCooldownHint: "The wait between casts, before Focus shortens it in steps of {seconds} Sec. No card casts itself, so this is how often you can play it by hand.",
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

    // The legend: what the land panel shows while no land is selected. Every number in it is
    // read out of state, so the explanation can never claim something other than what the
    // board beside it is doing.
    legendTitle: "Legend",
    legendTag: "Map",
    legendHint: "Click a land for its own numbers.",
    // The handle says what a click will do, not how it is set - the caret says that.
    legendFoldOpenHint: "Fold the legend away",
    legendFoldShutHint: "Open the legend",
    legendInvadersLabel: "Invaders",
    legendFightLabel: "The fight",
    legendWaveLabel: "The wave",
    legendUnitNote: "{damage} damage, {health} health.",
    // The most important sentence in the whole legend, and so the first one in the block:
    // there is no attack phase to wait for.
    legendBlightTerm: "Blight",
    legendBlightNote: "There is no attack phase. Every land holding invaders is under attack every moment. For each point of damage the Dahan do not cancel, Blight grows {rate}% per second. {floor}% of the attack always gets through, however many Dahan stand there - a held land still seeps. At {threshold} the round ends.",
    legendDahanNote: "Your people, in wood rather than white plastic. While they stand, each cancels {damage} damage from their land's attack. {health} health, and they fall at {rate}% per point of damage that gets through per second - at the same rate however many are standing there.",
    legendStrikeTerm: "Dahan attack",
    legendStrikeNote: "Every {seconds}s all Dahan strike for {damage} each, in every land holding invaders. Its own clock, not the wave's - which is why the strip above counts two.",
    legendWardTerm: "Ward",
    legendWardNote: "Absorbs as much attack as it is worth. Cover the whole attack and no Blight gets through at all - the only thing that does, because it beats the {floor}% above. It lapses one wave after the first moment it did anything.",
    legendBarsTerm: "The bars",
    legendBarsNote: "Two per land: Blight filling toward the next splotch, and the Dahan's casualties. Both keep running while the count still reads the same - only a full bar costs a piece. The ring on a piece shows the health it has lost.",
    legendBuildNote: "First. Every land of the Build terrain holding invaders gains a Town - or a City if it already has more towns than cities. Empty lands build nothing.",
    legendDiscoverTerm: "Discover",
    legendDiscoverNote: "Then. One Explorer into each land of the Discover terrain that is coastal or borders a town or city. From wave {wave} on, into every land.",
    legendTrackTerm: "The track slides",
    legendTrackNote: "Last. What was just discovered becomes the next wave's Build terrain - so the Discover slot already shows where the building happens next.",

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
    abilityFocused: "{ability} focused: cooldown -{seconds} Sec, now {cooldown} Sec, for {cost} Energy.",
    abilityFocusTooExpensive: "{ability} costs {cost} Energy for more Focus. You have {energy}.",

    upgradePurchased: "Purchased: {upgrade} (tier {tier}) for {cost} Fear.",
    // A pool has no tier to report, so it reports what went in and what came out of it.
    upgradeInvested: "{upgrade}: {cost} Fear remembered. Now {pct}% faster - a strike every {seconds}s.",
    dahanStrengthClaimed: "The Dahan endure. They strike for {damage} damage now, every {seconds}s again - and their memory holds {full} Fear from here.",
    dahanStrengthRefused: "Too early for that: the memory of the Dahan must be full, and the round must be over.",
    shopDahanStrengthBtn: "Start over, +1 damage",
    shopDahanStrengthTitle: "The Dahan strike for {damage} instead of {base} from here. The pool empties and holds {full} Fear afterwards - in the moment of the trade, nothing about the damage changes.",
    shopDahanStrengthWait: "Between rounds only: the trade empties a pool the running round is still counting on.",
    upgradeTooExpensive: "{upgrade} costs {cost} Fear. You have {fear}.",
    upgradeMaxed: "{upgrade} is already at its highest tier.",

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

