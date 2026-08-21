/* ------------------------------------------------------------------ *
 * Naming and formatting helpers
 * ------------------------------------------------------------------ *
 *
 * Turns state into the words the UI shows. Reads I18N; holds no rules.
 * Spec: docs/spec/06-ui-contract.md
 */

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

// A phase slot as one phrase - "Wetlands + Jungle". Everything that used to print a single
// terrain name for a slot prints this instead, so widening Discover never needs the caller
// to know it widened.
function terrainNames(state, terrains) {
  const names = terrainList(terrains).map((terrain) => terrainName(state, terrain));
  return names.length > 0 ? names.join(" + ") : terrainName(state, null);
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

// The record's own numbers are substituted into its description, so a kit tuned in ABILITIES
// never leaves a card promising something the effect no longer does. A tiered ability picks
// the text for the tier it is standing at, from the array in abilityTexts.
function abilityText(state, abilityId) {
  const t = locale(state);
  const entry = (t.abilityTexts && t.abilityTexts[abilityId]) || "";
  const record = abilityRecord(state, abilityId) || {};
  const raw = Array.isArray(entry)
    ? (entry[clamp(record.tier || 0, 0, entry.length - 1)] || "")
    : entry;

  // A card's numbers live in its step list rather than in fields on the record, so they are
  // read back out of it - see cardTextVars. Same contract either way: the description is
  // written from the effect, never beside it.
  const vars = isPowerCard(abilityId)
    ? cardTextVars(state, record)
    : {
        amount: record.amount || 0,
        damage: record.damage || 0,
        coastal: record.coastalBonus || 0,
        push: record.pushCount || 0,
        sea: record.seaCount || 0
      };

  return template(raw, vars);
}

// Everything a land's fight is doing right now, in one object. The chip, the detail panel,
// and the tests all read this, so no two of them can disagree about how bad a land is.
//
// Two rates come out of the same invader damage:
//   Blight  - net of what the Dahan standing there cancel, but never below
//             BLIGHT_FLOOR_FRACTION of gross: a held land seeps instead of sitting at 0.
//   Dahan   - gross, and flat: every land under the same damage loses its people at the same
//             rate, however many are standing there. A stack's lifetime is therefore linear
//             in its size, with no spiral and no discount for depth.
//
// The flat rate replaced a concentrated one that divided gross by the survivors (capped at
// two). It read as a death spiral but measured as its opposite: a stack of four outlived two
// singles by so much that reinforcement upgrades compounded, and one tier of them doubled a
// round's length on its own. The cap meant to hold that down never bound - lands rarely hold
// more than two Dahan - so removing it changed nothing, and removing the divisor changed
// everything.
function landPressure(state, landId) {
  const slot = state.invaders[landId] || { explorers: 0, towns: 0, cities: 0 };
  const gross = invaderDamageInLand(state, slot);
  const dahan = Math.max(0, state.dahan[landId] || 0);
  const defence = dahan * UNIT_STATS.dahan.damage;

  // Defense first, and against the raw attack rather than against what the Dahan left of it.
  // Everything downstream then reads `effective` where it used to read `gross`, so a 6-attack
  // land behind Defend 2 is a 4-attack land in every formula - which is what makes a ward
  // protect the Dahan as well as the land, something their own defence never does.
  const defense = defenseInLand(state, landId);
  const effective = Math.max(0, gross - defense);
  // Total denial is measured against Defense alone: Defend 6 covers a 6-attack land whatever
  // else is standing in it. It is also the one thing that beats BLIGHT_FLOOR_FRACTION - a
  // ward stops the seep a full stack of Dahan cannot - and that is bounded by the ward being
  // spent one wave later, so no land is ever permanently safe.
  const denied = gross > 0 && effective <= 0;
  const held = gross > 0 && defence >= gross;
  const net = denied ? 0 : Math.max(effective - defence, effective * BLIGHT_FLOOR_FRACTION);

  const blightPerSecond = net * BLIGHT_PER_DAMAGE_SECOND;
  const dahanPerSecond = dahan > 0 ? effective * DAHAN_LOSS_PER_DAMAGE_SECOND : 0;

  const blightProgress = (state.round.blightProgress || {})[landId] || 0;
  const dahanProgress = (state.round.dahanProgress || {})[landId] || 0;

  return {
    gross,
    dahan,
    defence,
    // The ward on this land, what the invaders are left dealing after it, and whether it
    // covered the attack outright. Three fields rather than one because the board draws the
    // pool, the formulas read the remainder, and the chip says which of the two stories to
    // tell.
    defense,
    effective,
    denied,
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

/* The Dahan Remember needs two decimals where everything else needs one, because its smallest
 * purchase is one Fear and one Fear is a hundredth of a percent. Rounding that to 0.1% would
 * print the same number for the +1 button and the +10 one - a readout that says a purchase did
 * nothing is worse than no readout.
 *
 * Trailing zeros are trimmed, so a round percentage still reads as "12%" rather than "12.00%"
 * and the interesting digits only appear when they exist.
 */
function hastePctText(fraction) {
  const pct = Math.round((Number(fraction) || 0) * 10000) / 100;
  return String(Number(pct.toFixed(2)));
}

/* Game seconds as the player's own stopwatch measures them: divided by the speed dial, exactly
 * like every countdown on the HUD (`displaySeconds` in ui.js). A stopped clock has no rate to
 * divide by and reports the game's own seconds, the same fallback the HUD takes.
 *
 * One decimal rather than the HUD's ceiling, because the readouts that use this are differences
 * and thresholds rather than countdowns: the first few hundred Fear move the strike interval by
 * tenths, and a Focus rung is 2 seconds at 1x but 1 at 2x and a quarter at the playtest speed.
 *
 * This is the one place that division lives outside the HUD. Anything quoting a duration the
 * player is *watching* goes through here; anything quoting the engine's own authored clock does
 * not, or the dial would be applied twice.
 */
function dialSecondsText(state, gameSeconds) {
  const speed = gameSpeed(state);
  return formatAmount(speed > 0 ? gameSeconds / speed : gameSeconds);
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
  // A ward that covered the attack outright replaces the line rather than decorating it:
  // there is no rate to quote and no next Blight to count down to, which is the whole of what
  // Defense bought and the one state the chip must not report as "0% / s - next in never".
  if (p.denied) return template(t.pressureDenied, { defense: p.defense, gross: p.gross });
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
    defense: p.defense,
    effective: p.effective,
    net: formatAmount(p.net),
    rate: pctText(p.blightPerSecond),
    eta: etaText(state, p.blightEta)
  };
  // Three readings, and a ward changes which one is true: it covered everything, it covered
  // some of it, or there is none and the Dahan are the whole of the answer.
  if (p.denied) return template(t.pressureDetailDenied, parts);
  if (p.defense > 0) return template(t.pressureDetailWarded, parts);
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

function presenceUpgradeName(state, presenceId) {
  const t = locale(state);
  return (t.presenceNames && t.presenceNames[presenceId]) || presenceId;
}

/* Every Presence row is translated flat. The rows that used to be built here rather than
 * translated were the discounts, whose honest description was a price and the next price - both
 * of which moved as the row was bought. The discount ladders are gone (see PRESENCE_UPGRADES),
 * and what a grant does reads the same sentence before and after it is bought, so `presenceTexts`
 * can simply say it.
 *
 * Deleted with them: presenceNextTexts and presenceMaxedTexts. `presenceUpgradeStatusText` went
 * the same way and has come back below, because `presence_fear_remains` is a rung again and
 * a ladder with no chip cannot say how far up it the player is.
 *
 * A grant row's text names the Fear rows it hands over, and where it quotes a price at all it
 * does so in words rather than from `baseCost`. That is a deliberate step back from the
 * live-price rule the Fear ladders follow (see NEXT_TIER_UPGRADE_TEXT): a grant is bought once,
 * its worth is "these rows, forever", and a number re-read every render buys nothing here that
 * the sentence does not already say. `presence_all_unbidden` quotes none - five prices summed
 * into one figure is arithmetic the player did not ask for, and the row names all five anyway.
 */
function presenceUpgradeText(state, presenceId) {
  const t = locale(state);
  const text = (t.presenceTexts && t.presenceTexts[presenceId]) || "";
  // The rows that carry a number, and none of them is a price: `presence_current_quickens` sells
  // Focus, whose whole rule is that every purchase takes the same amount off a cooldown. The
  // objection above is to figures that move *because the shop was used* - a price that changes
  // as it is bought. This one moves with the speed dial and with nothing else, exactly like the
  // countdown it describes, which is the opposite case: written flat it would be wrong at every
  // dial position but one.
  return template(text, {
    seconds: focusStepSecondsText(state),
    // What one rung of the Fear ladder puts in the bank. Flat, and the only figure of that
    // that row's sentence needs: how much is already banked is what the ascension log answers,
    // and the row's own promise is per-rank anyway.
    step: formatFear(ASCENSION_START_FEAR_PER_TIER),
    /* The fast-forward's share, live because the row is bought three times and every rung
     * moves it. It quotes the rung *above* the one owned - what the next click buys, which is
     * the question a row still on the shelf is being asked. At the top rung there is none
     * above, so it falls back to the one owned, which is exactly true then. What the owned
     * rung grants right now is the chip's job - see `presenceUpgradeStatusText`.
     */
    share: fastForwardSharePct(Math.min(
      presenceUpgradeTier(state, "presence_deep_water_comes") + 1,
      FAST_FORWARD_MAX_TIER
    )),
    speed: FAST_FORWARD_SPEED
  });
}

/* The tier chip beside a Presence row, for the rows that have rungs to report.
 *
 * A one-off answers "" and draws no chip, which is every other row in the catalogue - the same
 * answer `upgradeStatusText` gives a non-repeatable Fear row, and the reason this reads off
 * `repeatable` rather than off the tier. It borrows the Fear shop's own label so the two shops
 * count rungs in the same words; a Presence ladder is not different enough from a Fear ladder
 * to be worth a second phrasing the player has to learn.
 */
function presenceUpgradeStatusText(state, presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record || !record.repeatable) return "";
  const tier = presenceUpgradeTier(state, presenceId);
  const max = presenceUpgradeMaxTier(presenceId);
  // The fast-forward's chip counts rungs and then says what the rungs bought so far are worth,
  // in the waves the player watches go by. Its row's text sells the *next* rung, so without
  // this the shop would never state what the owned one is doing - and a share alone does not
  // answer it either, because the wave count moves with the record as well as with the tier.
  //
  // Only once a rung is owned. At 0/3 the tail would read "0 waves (0%)", which is the row's
  // own text told backwards, and the plain chip the other ladder draws says the same thing in
  // fewer words.
  if (presenceId === "presence_deep_water_comes" && tier > 0) {
    return template(locale(state).presenceTierFastForward, {
      tier,
      max,
      waves: fastForwardWaves(state),
      share: fastForwardSharePct(tier)
    });
  }
  return template(locale(state).shopTierLabelMax, { tier, max });
}

// What one Focus rung is worth on the clock the player is watching, for the two blurbs that
// describe Focus in general rather than one ability's ladder: the Presence row that sells it and
// the card offer's cooldown hint. The step by itself, before any ability's own haste - a general
// sentence about the mechanic cannot answer for a particular round's multiplier, and every
// ability and card in the catalogue names this same step anyway.
//
// A rung is always one *beat*. What that is worth in seconds is not fixed: two at 1x, one at 2x,
// a quarter at the playtest speed - so the number has to be drawn through the dial like every
// other duration on screen, or the pill would promise 2s to a player watching a clock that only
// ever loses 1.
function focusStepSecondsText(state) {
  return dialSecondsText(state, FOCUS_STEP_BEATS_DEFAULT * TIME_SCALE);
}

/* The Focus pill's numbers, in the seconds the countdown beside it is drawn in.
 *
 * The pill is where the ladder's one rule has to be learned - every rung takes the same fixed
 * time off, at a rising price - so it says that time outright rather than leaving it to be
 * read off a countdown that moves for several other reasons too. Both figures take the same
 * clamped reading of the round's permanent haste that the bar takes, so the pill and the
 * countdown beside it cannot disagree.
 */
function abilityFocusPillParts(state, abilityId) {
  const floor = abilityFocusFloorBeats(state, abilityId) * TIME_SCALE * roundCooldownMult(state);
  return {
    cost: abilityFocusCost(state, abilityId),
    seconds: dialSecondsText(state, abilityFocusSecondsPerStep(state, abilityId)),
    floor: dialSecondsText(state, Math.max(1, floor))
  };
}

/* Where an ability stands on its Focus ladder, as two numbers: the cooldown it has right now
 * and the one its ladder ends at. The auto-buy sheet's per-ability rows are the only reader.
 *
 * It says the same thing the pill says, from the other end. The pill answers "what does the
 * next rung cost", which is the question in front of a player about to click; the sheet asks
 * "is this ability worth letting the bot spend on at all", and that is answered by how much
 * clock there is left to buy. An ability already sitting on its floor shows two equal numbers,
 * which is the honest way to say the switch beside it no longer decides anything.
 *
 * Both figures take the round's permanent haste the same way the pill's floor does, so the two
 * controls on one card cannot quote different clocks.
 */
function abilityFocusRangeParts(state, abilityId) {
  const mult = roundCooldownMult(state);
  const now = abilityFocusedCooldownSeconds(state, abilityId) * mult;
  const floor = abilityFocusFloorBeats(state, abilityId) * TIME_SCALE * mult;
  return {
    now: dialSecondsText(state, Math.max(1, now)),
    floor: dialSecondsText(state, Math.max(1, floor))
  };
}

/* ---------- The rows that describe where they stand ----------
 *
 * Every other repeatable pays a constant per tier, so "+1 Dahan, per tier" answers the only
 * question the shop is ever asked: what does the next price buy. These three do not. `headwaters`
 * climbs a hand-built table and `high_water_mark` pays a fraction of a wave number that grows
 * with the run, so their honest descriptions are a list and a formula - both true, neither an
 * answer. So these print the next rung instead of their own shape, and the tier chip beside the
 * text says which rung that is.
 *
 * The Mark needs a wave to be concrete about, and the useful one is the next milestone the
 * player is actually heading for rather than a fixed example: at wave 20 the row should talk
 * about 30, and at wave 200 about 210. Both it and `headwaters` end, so both need the same
 * fallback: a ladder at its top has to say what it pays rather than what it would next.
 *
 * Anything here may return "" to fall back to the static `upgradeTexts` entry, which is why
 * those two entries stay in both locale tables: a row is never left blank because a
 * translation is missing a key.
 */
const NEXT_TIER_UPGRADE_TEXT = {
  headwaters(state, t) {
    const tier = upgradeTier(state, "headwaters");
    const current = startingEnergyForTier(tier);
    if (tier >= upgradeMaxTier(state, "headwaters")) {
      return template((t.upgradeMaxedTexts || {}).headwaters, { energy: current });
    }
    const next = startingEnergyForTier(tier + 1);
    return template((t.upgradeNextTexts || {}).headwaters, { gain: next - current, current, next });
  },

  // A pool describes where it stands rather than what the next rung buys: there is no next
  // rung, only more of the same, and what the player wants to know is how far in they are and
  // what the clock reads now. The static text under `upgradeTexts` still carries the rate, so
  // between the two the row says what a Fear buys and what the Fear already spent bought.
  dahan_remember(state, t) {
    const invested = upgradeTier(state, "dahan_remember");
    const full = dahanHasteFearForFull(state);
    const parts = {
      invested,
      full,
      pct: hastePctText(dahanHasteFraction(invested, full)),
      seconds: dialSecondsText(state, dahanAttackIntervalFor(invested, full)),
      base: dialSecondsText(state, DAHAN_ATTACK_INTERVAL_SECONDS),
      damage: dahanAttackDamage(state),
      strength: DAHAN_STRENGTH_DAMAGE,
      next: DAHAN_STRENGTH_FEAR_FOR_FULL
    };
    // Three answers where every other row has two, and the middle one is the point of the
    // whole feature: a full first pool is not finished, it is *ready*. Saying "maxed" there
    // would be the row lying about itself at the one moment it has something new to offer -
    // see upgradeIsSoldOut, which keeps it out of the sold-out half for the same reason.
    if (dahanStrengthPending(state)) {
      return template((t.upgradeReadyTexts || {}).dahan_remember, parts);
    }
    if (invested >= upgradeMaxTier(state, "dahan_remember")) {
      return template((t.upgradeMaxedTexts || {}).dahan_remember, parts);
    }
    return template((t.upgradeNextTexts || {}).dahan_remember, parts);
  },

  // The drip's row, and the one in the catalogue whose rungs are lumpy by construction: draws
  // land at 25, 25+I, 25+2I against a round of integer waves, so a tier only pays when it
  // moves a draw under the round's ceiling. Printing the two intervals is the honest way to
  // sell that - it says exactly what the next 30 Fear moves, and leaves the player to know
  // how deep their rounds go.
  power_card_interval(state, t) {
    const tier = upgradeTier(state, "power_card_interval");
    const current = POWER_CARD_DRAW_INTERVAL_BASE - tier;
    const parts = { first: POWER_CARD_FIRST_DRAW_WAVE, current, next: current - 1 };
    if (tier >= upgradeMaxTier(state, "power_card_interval")) {
      return template((t.upgradeMaxedTexts || {}).power_card_interval, parts);
    }
    return template((t.upgradeNextTexts || {}).power_card_interval, parts);
  },

  high_water_mark(state, t) {
    const tier = upgradeTier(state, "high_water_mark");
    // Both the round in progress and the best ever reached, because neither alone is the
    // player's depth: a save loaded between rounds has no running wave, and a run that is
    // already past its record has left the record behind.
    const deepest = Math.max(
      Math.floor((state.meta && state.meta.bestWaveReached) || 0),
      Math.floor((state.round && state.round.wavesResolved) || 0)
    );
    const wave = (Math.floor(deepest / FEAR_MILESTONE_WAVE_INTERVAL) + 1) * FEAR_MILESTONE_WAVE_INTERVAL;
    const payout = (n) => Math.round(wave * n * FEAR_MILESTONE_FRACTION_PER_TIER);
    return template((t.upgradeNextTexts || {}).high_water_mark, {
      pct: pctText(FEAR_MILESTONE_FRACTION_PER_TIER),
      wave,
      current: payout(tier),
      next: payout(tier + 1)
    });
  }
};

function upgradeText(state, upgradeId) {
  const t = locale(state);
  const nextRung = NEXT_TIER_UPGRADE_TEXT[upgradeId];
  if (nextRung) {
    const text = nextRung(state, t);
    if (text) return text;
  }
  return (t.upgradeTexts && t.upgradeTexts[upgradeId]) || "";
}

/* The little chip above the row's note: "Tier 3" for a ladder, the haste for a pool, nothing
 * at all for a one-off - it was never on a ladder, so there is no rung to report.
 *
 * A pool shows what its Fear bought rather than how many units of it are in there. "Tier 4271"
 * is true and useless; "42.71% faster" is the same fact in the units the player was shopping
 * in. It lives here rather than in the shop's renderer because every string the player reads
 * is built in the engine, next to the table it is translated in.
 */
function upgradeStatusText(state, upgradeId) {
  const t = locale(state);
  const record = UPGRADES[upgradeId];
  if (!record || !record.repeatable) return "";
  if (upgradeIsPool(upgradeId)) {
    return template(t.shopHasteLabel, {
      pct: hastePctText(dahanHasteFraction(upgradeTier(state, upgradeId), dahanHasteFearForFull(state)))
    });
  }
  const tier = upgradeTier(state, upgradeId);
  const max = upgradeMaxTier(state, upgradeId);
  return Number.isFinite(max)
    ? template(t.shopTierLabelMax, { tier, max })
    : template(t.shopTierLabel, { tier });
}

