/* ------------------------------------------------------------------ *
 * State creation, normalization, migration, persistence
 * ------------------------------------------------------------------ *
 *
 * Fresh games, loading older saves forward, and export/import.
 * Spec: docs/spec/03-state-contract.md
 */

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
      bestWaveReached: 0,
      // The best wave since the last ascension, against bestWaveReached's all-time figure.
      // Two scores because after a Reclaim they answer different questions - how far this
      // player has ever got, and how the current climb is going. Both are score: the ascension
      // unlock is priced in Presence and reads neither.
      cycleBestWave: 0,
      // The ascension layer. Neither is ever cleared: presence is spent only in the Presence
      // catalogue, and the count is the one number saying how deep a *run* is rather than how
      // deep a cycle got.
      presence: 0,
      ascensionCount: 0,
      // The cycle's Fear ledger, for playtesting: everything the economy has produced, and
      // everything the shop has taken back. `fear` is only what is left over right now, which
      // says nothing about how much passed through it - a player who earned ten thousand and
      // spent ten thousand reads as a player who never earned anything.
      //
      // A cycle is the span between ascensions. Nothing resets these because nothing ascends
      // yet; when ascension lands, it is the one thing that zeroes all three.
      cycleFearGenerated: 0,
      // Playtest grants, kept apart from what the round earned. They are not income - counting
      // them as generated would make the one number a balance pass is read from a lie - but
      // they are spendable, so they are counted somewhere: generated + granted - spent is the
      // bank, and that identity is what makes the readout self-checking.
      cycleFearGranted: 0,
      cycleFearSpent: 0
    },
    spirit: {
      activeSpiritId: "core_spirit_01",
      unlockedSpiritIds: ["core_spirit_01"]
    },
    upgrades: {
      purchased: {}
    },
    // Its own object rather than more keys in `upgrades.purchased`, and that one decision is
    // what keeps ascension simple: the wipe is `upgrades.purchased = {}` whole, with no filter
    // and no exception list to get wrong later.
    presenceUpgrades: {
      purchased: {}
    },
    // Bought with Presence and kept forever, ascension included - listed under *kept* beside
    // presenceUpgrades.purchased. `draw` is the stored three-card offer: state rather than a
    // render-time roll, because without that a reload would be a free re-roll and the price
    // would be decoration.
    powerCards: createPowerCardsState(),
    ui: {
      language: "de",
      // Both pacing controls are preferences, not run state: they sit beside the language
      // toggle in every sense, and survive a reset the same way it does.
      gameSpeed: DEFAULT_GAME_SPEED,
      autoProceed: false,
      // The idle switch. It only does anything once auto_start_round is owned, and it sits
      // beside auto-proceed rather than inside the upgrade because buying the automation and
      // wanting it on right now are two different things - a player who wants to stop and
      // shop should not have to un-buy anything to get the pause back.
      autoStartRound: true,
      // One switch per ability automation, and the same idea one level down from the round
      // gate: owning auto_wash_away and wanting it casting right now are two different
      // questions. It lives in `ui` beside the two above rather than in `round` because it
      // outlives every round it is read in. Written out here rather than left to normalize,
      // since the state contract documents literal shapes; normalizeState rebuilds it from
      // AUTO_CAST_UPGRADES.
      autoCast: {
        boon_of_vigor: true,
        rivers_bounty: true,
        innate_power: true,
        wash_away: true,
        flash_floods: true
      },
      // Per-card switches, one key today: whether Tsunami takes the other coastal lands with
      // it. A preference like the two above and the five beside them - it survives ascension
      // with the rest of `ui.*`, because a setting the player put somewhere should stay there.
      cardOptions: { ...POWER_CARD_OPTION_DEFAULTS },
      // How far auto-buy goes with the round's Energy, and how it chooses once it gets there.
      // A preference like the switches above it, and it survives ascension with the rest of
      // `ui.*` for the same reason - a setting the player put somewhere should stay there.
      //
      // `mode` opens at the top rung, not the bottom: every rung above "focus" is behaviour the
      // game already had, and the one rung that is new is gated by Presence rather than by this
      // field (see autoBuyModeRank). So a save carrying the default behaves exactly as it did
      // before the dial existed, and starts spending into Focus the moment the row is bought.
      //
      // `innateCap` counts the way the card does - 3 is "Tier 3", the top of the Innate's
      // ladder, which is where auto-buy already stopped. Literal rather than derived from
      // abilityMaxTier, because the state contract documents literal shapes.
      //
      // `focusAbilities` holds only refusals: absent means allowed, so a card drawn for the
      // first time needs no entry - see autoBuyFocusAllowed.
      autoBuy: {
        mode: "focus",
        innateCap: 3,
        focusOrder: "value",
        focusAbilities: {}
      },
      // Whether the auto-buy sheet is unfolded. Disclosure rather than a rule, but it sits here
      // with the other preferences because that is what it is - and because the round's start
      // closes it (see startNextRound), which is a thing the engine has to be able to do.
      autoBuyOpen: false,
      // The playtest code, once redeemed. It sits with the other settings rather than in meta
      // because it is the same kind of thing: how the game is being read, not what has been
      // earned inside it. Nothing in the rules reads it - see the playtest section.
      playtest: false,
      defeatFx: null,
      blightFx: null,
      fearFx: null,
      roundEndFx: null,
      cardFx: null,
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
      // Set by startRound from the auto-proceed preference; false here so a state that never
      // starts a round is not stuck behind a gate nothing would draw.
      awaitingWave: false,
      wavesResolved: 0,
      fearEarned: 0,
      // What the round would have earned with none of the Fear ladders owned. Tracked rather
      // than derived: the three multiply different sources, so one total has no unique split.
      fearEarnedBase: 0,
      abilityCooldownMult: 1,
      // What this round is running on, as against what the player owns - see
      // activeUpgradeTier. Filled by startRound; empty here because no round has started.
      upgradeTiers: {},
      // Both live here rather than on the spirit because both die with the round, exactly
      // like the Energy that bought them. `purchasedAbilityIds` never lists the spirit's own
      // startingAbilityIds - those are not bought - so it is precisely the record of what
      // this round spent. `abilityTiers` maps a tiered ability id to its zero-based tier.
      purchasedAbilityIds: [],
      abilityTiers: {},
      // Energy invested in Focus, per ability - see abilityFocusEnergy. What is stored is the
      // spend, not the rung count it bought; the count is read back off it against whatever
      // ladder the ability is standing on. Round-scoped like the two fields above, and reset
      // the same way: what Energy bought this round dies with it.
      abilityFocusEnergy: {},
      // The wards on the board, and the `elapsedSeconds` each one lapses at - null while it is
      // still unused, which is what lets a ward wait indefinitely on a quiet land. Storing the
      // deadline rather than a countdown means the speed dial and the wave gate need no
      // special case: both already move that clock.
      defense: createDefenseByLand(),
      defenseExpiry: createDefenseExpiry(),
      // The hand, and the drip's own bookkeeping. Round-scoped like everything above it: a
      // card is held by the round that survived to draw it and by nothing else.
      cards: createRoundCardsState()
    },
    invader: { build: [], explore: [] },
    invaders: createInvaderCounts(),
    invaderDamage: createInvaderDamage(),
    dahan: createDahanCounts(),
    abilities: {},
    pendingAbilityTarget: null,
    resources: { energy: 0 },
    _log: []
  };
}

// First-ever load, and the target every migration falls back to.
function createFreshGameState() {
  const state = createInitialState();
  state.abilities = createAbilityState(state);
  startRound(state);
  // Deliberately no offer rolled here. ensurePowerCardOffer touches the RNG, and a draw taken
  // at setup would shift every roll the island makes after it - so a given seed would land on
  // a different board purely because power cards exist. The offer is rolled the first time it
  // is looked at instead, and stored from then on. See ensurePowerCardOffer.
  return state;
}

/* What a set of owned tiers cost to buy, at the catalogue's current prices.
 *
 * Takes the normalized `purchased` map rather than a state, because its one caller runs while
 * the state is still being assembled. See the ledger note in normalizeState for why the answer
 * is exact rather than an estimate, and for the two ids it deliberately skips.
 *
 * "At the catalogue's current prices" is the one honest caveat: a save bought its rungs at
 * whatever the prices were then, and a retune moves what this reads back. That is the right
 * trade - the alternative is storing a price history no other part of the game needs - and it
 * only ever affects the single load that seeds the field.
 */
function rebuildSpentFear(purchased) {
  let spent = 0;
  for (const [id, tier] of Object.entries(purchased || {})) {
    if (!UPGRADES[id]) continue;
    const cost = upgradeCostFromTier(id, 0, tier);
    if (Number.isFinite(cost)) spent += cost;
  }
  return Math.max(0, Math.floor(spent));
}

/* The seven Presence rows deleted when automations became permanent grants, and what their
 * rungs cost, kept only so normalizeState can pay a save back for them. Nothing else reads
 * either: they describe a catalogue that no longer exists.
 */
const RETIRED_PRESENCE_DISCOUNT_IDS = [
  "presence_boon_remembered",
  "presence_instinct_remembered",
  "presence_bounty_remembered",
  "presence_flood_remembered",
  "presence_current_remembered",
  "presence_need_remembered",
  "presence_tide_remembered"
];
const RETIRED_PRESENCE_DISCOUNT_COSTS = [5, 10, 25, 50, 100, 250];

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
    presenceUpgrades: { ...base.presenceUpgrades, ...(input.presenceUpgrades || {}) },
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
  // Read before the speed, which is validated against the dial this flag decides the width of:
  // a save at 8x loads at 8x only if it also carries the redeemed code.
  merged.ui.playtest = merged.ui.playtest === true;
  merged.ui.gameSpeed = availableGameSpeeds(merged).includes(Number(merged.ui.gameSpeed))
    ? Number(merged.ui.gameSpeed)
    : DEFAULT_GAME_SPEED;
  merged.ui.autoProceed = merged.ui.autoProceed === true;
  // Defaults on rather than off, unlike auto-proceed: a save that predates the toggle has no
  // value to read, and the only player it can affect is one who has bought the automation.
  merged.ui.autoStartRound = merged.ui.autoStartRound !== false;
  // Rebuilt from the registry rather than merged over it, the same way upgrades.purchased and
  // abilities are: every id AUTO_CAST_UPGRADES carries gets `raw !== false`, so a save written
  // before the toggles existed loads with all five still running, and a key the map does not
  // carry is dropped rather than kept as a preference for an ability nothing can cast.
  const rawAutoCast = merged.ui.autoCast && typeof merged.ui.autoCast === "object" ? merged.ui.autoCast : {};
  const autoCast = {};
  for (const abilityId of Object.keys(AUTO_CAST_UPGRADES)) {
    autoCast[abilityId] = rawAutoCast[abilityId] !== false;
  }
  merged.ui.autoCast = autoCast;

  /* The auto-buy dial. Three of its four fields go through the engine's own setters, which are
   * already the validators - a bad `mode` falls back to the default there rather than being
   * checked twice with two chances to disagree.
   *
   * `focusAbilities` is the one rebuilt by hand, and it is rebuilt as a list of *refusals*
   * rather than from a registry the way ui.autoCast is. The difference is what the two are
   * keyed by: autoCast has a fixed five, one per automation the shop sells, so a registry can
   * name them all. Focus applies to the kit and to every power card, and cards arrive over a
   * cycle - rebuilding from the full catalogue would write a settled `true` for a card the
   * player has never seen. Storing only the offs keeps absent meaning allowed, which is what
   * autoBuyFocusAllowed reads and what makes a newly drawn card focusable without a click.
   *
   * Unknown ids are dropped, so a save cannot hold a preference for an ability the catalogue
   * no longer has - the same rule upgrades.purchased follows. */
  const storedAutoBuy = merged.ui.autoBuy && typeof merged.ui.autoBuy === "object" ? merged.ui.autoBuy : {};
  // The three readers already fall back and clamp - they have to, since they answer for a
  // state built by hand in a test as readily as for a loaded one. So the normalizer reads
  // through them rather than repeating their rules, and what it writes back is what every
  // other caller would have got anyway.
  merged.ui.autoBuy = storedAutoBuy;
  merged.ui.autoBuy = {
    mode: autoBuyMode(merged),
    innateCap: autoBuyTierCap(merged),
    focusOrder: autoBuyFocusOrder(merged),
    focusAbilities: {}
  };

  const storedFocusAbilities = storedAutoBuy.focusAbilities && typeof storedAutoBuy.focusAbilities === "object"
    ? storedAutoBuy.focusAbilities
    : {};
  const focusAbilities = {};
  for (const abilityId of Object.keys(storedFocusAbilities)) {
    if (!ABILITIES[abilityId] && !POWER_CARDS[abilityId]) continue;
    if (storedFocusAbilities[abilityId] === false) focusAbilities[abilityId] = false;
  }
  merged.ui.autoBuy.focusAbilities = focusAbilities;

  merged.ui.autoBuyOpen = merged.ui.autoBuyOpen === true;
  merged.ui.selectedLand = isLandId(merged.ui.selectedLand) ? merged.ui.selectedLand : null;
  merged.ui.defeatFx = normalizeDefeatFx(merged.ui.defeatFx);
  merged.ui.blightFx = normalizeBlightFx(merged.ui.blightFx);
  merged.ui.fearFx = normalizeFearFx(merged.ui.fearFx);
  merged.ui.roundEndFx = normalizeRoundEndFx(merged.ui.roundEndFx);
  merged.ui.cardFx = normalizeCardFx(merged.ui.cardFx);

  // Floored, not just clamped: a save written while Fear was fractional loads as the whole
  // number the shop can actually spend, and never as 6.3.
  merged.meta.fear = Math.max(0, Math.floor(Number(merged.meta.fear) || 0));
  merged.meta.cycleFearGranted = Math.max(0, Math.floor(Number(merged.meta.cycleFearGranted) || 0));
  // The other two fields of the ledger are seeded further down, after the catalogue has told
  // us what the save's purchases cost - see the note above rebuiltCycleSpend.
  //
  // A save from before the ladder tracked waves has no best wave to carry. The old best round
  // is not a substitute - it counted attempts, not depth - so the record simply restarts at 0
  // and the first finished round writes a true one.
  merged.meta.bestWaveReached = Math.max(0, Math.floor(merged.meta.bestWaveReached || 0));
  // The other half of the pair, and honestly zero when absent rather than seeded from the
  // all-time figure: a save from before the split has ascended zero times, so its whole
  // history *is* the current cycle - but claiming a cycle best it never recorded would be
  // inventing a number, and the first finished round writes a true one anyway.
  merged.meta.cycleBestWave = Math.max(0, Math.floor(merged.meta.cycleBestWave || 0));
  // The ascension layer. Both honestly zero when absent: a save from before it existed has
  // ascended no times and holds no Presence, and seeding either from anything else would be
  // inventing progress.
  merged.meta.presence = Math.max(0, Math.floor(Number(merged.meta.presence) || 0));
  merged.meta.ascensionCount = Math.max(0, Math.floor(Number(merged.meta.ascensionCount) || 0));
  delete merged.meta.bestRoundReached;
  // Rounds played was only ever a tally: nothing reads it, and the record that does say
  // something about a run is the best wave above. A save that carries one drops it here.
  delete merged.meta.totalRoundsPlayed;

  // Upgrade tiers survive anything: an unknown id is dropped, a bad value clamps to 0.
  const purchased = {};
  for (const [id, value] of Object.entries(merged.upgrades.purchased || {})) {
    const known = Boolean(UPGRADES[id]) || (id.startsWith("unlock_") && Boolean(ABILITIES[id.slice("unlock_".length)]));
    if (!known) continue;
    const tier = value === true ? 1 : Math.max(0, Math.floor(Number(value) || 0));
    if (tier <= 0) continue;
    // Capping here is what makes the three Fear ladders' new maxTier free: a save carrying
    // rising_dread at 14 from the soft-capped build clamps to 10 rather than being stranded
    // above the ladder's end. No migration code was needed for it, only the number.
    purchased[id] = Math.min(tier, upgradeMaxTier(id));
  }
  merged.upgrades.purchased = purchased;

  /* ---------- The cycle ledger, and the one-time rebuild that seeds it ----------
   *
   * Whole and never negative for the same reason the bank is. `cycleFearGenerated` is the one
   * field an absent value cannot honestly call zero: a save from before the ledger existed
   * still has a bank, and that bank was earned somehow - and so was everything already spent
   * out of it. Seeding generated from `meta.fear` alone was the first answer and it was the
   * wrong one: a player who had earned ten thousand and spent nine of it loaded as a player who
   * had earned a thousand, and the ascension payout reads this field, so the whole of that
   * player's shopping was quietly deducted from the Presence their first Reclaim would pay.
   *
   * Fear leaves the bank in exactly one place - purchaseUpgrade - so what was spent is not
   * guesswork: it is the sum of the catalogue's own price curve over the rungs the save owns,
   * read back with upgradeCostFromTier. generated = bank + spent, which is the ledger identity
   * turned around, and it is exact for any save that never had the playtest grant (i.e. every
   * save old enough to be missing the field, since the grant and the ledger landed together).
   *
   * Three things make it safe to run on load:
   *
   * - It only fires when the key is absent, and it writes the key. That is what makes it
   *   one-time rather than a recomputation every load - a save written after this change
   *   carries its own generated figure and is never touched again, so a player who ascends and
   *   spends their way back down does not get their pre-ascension shopping handed back.
   * - It reads `purchased` above rather than the raw save: normalized ids, tiers already capped
   *   to the ladder. A doctored row that was dropped on the way past cannot mint Fear here, and
   *   a tier clamped from 14 to 10 is priced as the 10 it now is.
   * - An id with no catalogue price (the `unlock_` ability path, which no row uses today) is
   *   skipped rather than counted as Infinity. Undercounting a row nobody owns beats an
   *   ascension payout of NaN.
   */
  const hadGenerated = Boolean(input.meta) && "cycleFearGenerated" in input.meta;
  const hadSpent = Boolean(input.meta) && "cycleFearSpent" in input.meta;
  const rebuiltCycleSpend = hadGenerated && hadSpent ? 0 : rebuildSpentFear(purchased);
  merged.meta.cycleFearGenerated = hadGenerated
    ? Math.max(0, Math.floor(Number(merged.meta.cycleFearGenerated) || 0))
    : merged.meta.fear + rebuiltCycleSpend;
  // Seeded from the same figure, so generated + granted - spent = bank still holds after the
  // rebuild and the playtest tally stays self-checking. Reconstructing one and zeroing the
  // other would have made the readout lie by exactly the amount it had just discovered.
  merged.meta.cycleFearSpent = hadSpent
    ? Math.max(0, Math.floor(Number(merged.meta.cycleFearSpent) || 0))
    : rebuiltCycleSpend;

  // Rebuilt from the Presence registry, never merged over it - the same rule upgrades.purchased
  // and ui.autoCast follow, so a save cannot smuggle in a row the catalogue no longer has.
  // Clamped to the row's own top, which is 1 for every row now that no Presence row is a
  // ladder; the clamp stays in the shape the Fear tiers above use rather than assuming that.
  const presencePurchased = {};
  for (const id of PRESENCE_UPGRADE_IDS) {
    const value = (merged.presenceUpgrades.purchased || {})[id];
    const tier = value === true ? 1 : Math.max(0, Math.floor(Number(value) || 0));
    if (tier > 0) presencePurchased[id] = Math.min(tier, presenceUpgradeMaxTier(id));
  }

  /* Refunding the seven discount rows, which the loop above has just dropped on the floor.
   *
   * They were repeatable rows that walked an automation's Fear price down a ladder, deleted
   * because holding the Presence beat buying them at every rung (see the note above
   * PRESENCE_UPGRADES). Dropping an id the catalogue no longer has is the right rule and the
   * one every other registry follows - but a save that had walked all seven to the bottom had
   * 515 Presence in them, and silently keeping it would be taking back a purchase rather than
   * replacing it. So the tiers are priced at what they cost and paid back into the purse, where
   * the rows that replaced them are waiting at 2, 3 and 5.
   *
   * The price table is inlined here rather than left in content.js. It is migration data now,
   * not balance: nothing in the live game has rungs to price, and a constant kept in the
   * catalogue for one loader to read is a constant the next reader has to rule out.
   *
   * The same three properties the grandfathering it replaces had:
   *
   * - It only fires when a dead id is present, and the write it does is to `presence`. A save
   *   written after this change carries none of these ids, so it is never touched again.
   * - It reads the raw save rather than `presencePurchased`, because the whole point is the ids
   *   that did not survive the rebuild - but it prices only ids on the dead list, so a doctored
   *   row cannot mint Presence here.
   * - Tiers are clamped to the table's length before they are summed, so a save claiming rung
   *   400 of a six-rung ladder is refunded the six it could actually have bought.
   */
  const rawPresence = (input.presenceUpgrades && input.presenceUpgrades.purchased) || {};
  let refund = 0;
  for (const id of RETIRED_PRESENCE_DISCOUNT_IDS) {
    const raw = rawPresence[id];
    const tier = raw === true ? 1 : Math.max(0, Math.floor(Number(raw) || 0));
    const rungs = Math.min(tier, RETIRED_PRESENCE_DISCOUNT_COSTS.length);
    for (let i = 0; i < rungs; i += 1) refund += RETIRED_PRESENCE_DISCOUNT_COSTS[i];
  }
  if (refund > 0) merged.meta.presence = Math.max(0, Math.floor(Number(merged.meta.presence) || 0)) + refund;

  merged.presenceUpgrades.purchased = presencePurchased;

  /* ---------- Power cards ----------
   *
   * All additive, so the save migration stays a no-op: a file written before any of this
   * existed loads with nothing owned, an empty hand and an offer rolled on the spot.
   *
   * Normalization drops unknown card ids, collapses duplicates, drops a hand entry naming a
   * card the cycle does not own, and clamps `nextDrawWave` to at least 1 - all of it inside
   * normalizePowerCards and normalizeRoundCards. It runs here, above the ability block below,
   * because normalizeAbilities reads the hand through unlockedAbilityIds and would otherwise
   * be deciding which slots to keep off a list nothing had checked yet.
   */
  merged.powerCards = normalizePowerCards(merged.powerCards);
  merged.round.cards = normalizeRoundCards(merged.round.cards, merged.powerCards.owned);
  merged.round.defense = normalizeDefense(merged.round.defense);
  merged.round.defenseExpiry = normalizeDefenseExpiry(merged.round.defenseExpiry);
  // Rebuilt from the defaults rather than merged over them, the same rule ui.autoCast follows:
  // a key the registry does not carry is dropped rather than kept as a preference for a card
  // that has no switch, and a save written before the switch existed loads with it on.
  const rawCardOptions = merged.ui.cardOptions && typeof merged.ui.cardOptions === "object"
    ? merged.ui.cardOptions
    : {};
  const cardOptions = {};
  for (const [cardId, fallback] of Object.entries(POWER_CARD_OPTION_DEFAULTS)) {
    const raw = rawCardOptions[cardId];
    cardOptions[cardId] = raw === undefined ? fallback : raw !== false;
  }
  merged.ui.cardOptions = cardOptions;

  // An unknown ability id is dropped rather than carried: a save that names an ability the
  // build no longer has would otherwise show a bar entry nothing can cast. Duplicates are
  // collapsed too, so a double-write cannot make one purchase look like two.
  merged.round.purchasedAbilityIds = Array.isArray(merged.round.purchasedAbilityIds)
    ? merged.round.purchasedAbilityIds.filter(
        (id, index, all) => Boolean(ABILITIES[id]) && all.indexOf(id) === index
      )
    : [];

  // A tier is only meaningful for an ability that has tiers, and only up to the last one it
  // actually defines - so shortening the ladder in the catalogue cannot strand a save above
  // its top rung.
  const tiers = {};
  for (const [id, value] of Object.entries(merged.round.abilityTiers || {})) {
    if (!abilityIsTiered(id)) continue;
    const tier = clamp(Math.floor(Number(value) || 0), 0, abilityMaxTier(id));
    if (tier > 0) tiers[id] = tier;
  }
  merged.round.abilityTiers = tiers;

  // Same rule as abilityTiers just above: an unknown ability id is dropped, and the figure is
  // only ever a non-negative integer. No upper clamp against the ladder's length is needed -
  // abilityFocusPurchases stops at abilityFocusMaxPurchases, so a doctored save holding an
  // absurd sum reads exactly like one that stopped at the floor. It deliberately is not clamped
  // on load either: the Energy is kept as spent, and a tier change that shortens the ladder must
  // not silently spend the investment back - that Energy is still owed the rungs of whatever
  // tier the ability lands on next.
  //
  // Runs after the abilityTiers loop above on purpose: the migration below reads a tier.
  const focus = {};
  // Saves written before Focus was measured in Energy hold rung counts under `abilityFocus`.
  // Converted rather than dropped, and converted the same way an upgrade converts: price the
  // counted rungs on the ladder the save's own tier puts in front of them, and carry the total.
  // Tested for emptiness rather than for absence, because `merged` already carries a fresh
  // state's `abilityFocusEnergy: {}` under whatever the save brought - so "the save named none"
  // and "the save has no such field" are the same thing here, and only a save that actually
  // holds Energy outranks its own legacy counts.
  const carried = merged.round.abilityFocusEnergy;
  const legacy = merged.round.abilityFocus;
  if (legacy && typeof legacy === "object" && (!carried || Object.keys(carried).length === 0)) {
    const spent = {};
    for (const [id, value] of Object.entries(legacy)) {
      if (!abilityBaseRecord(id)) continue;
      const rungs = Math.max(0, Math.floor(Number(value) || 0));
      if (rungs > 0) spent[id] = abilityFocusLadderTotal(merged, id, rungs);
    }
    merged.round.abilityFocusEnergy = spent;
  }
  delete merged.round.abilityFocus;

  for (const [id, value] of Object.entries(merged.round.abilityFocusEnergy || {})) {
    // Cards take Focus too, so the test is "is this castable at all" rather than "is this in
    // the kit" - a spend against a card in hand must survive a save the same way one against
    // the Innate does.
    if (!abilityBaseRecord(id)) continue;
    const energy = Math.max(0, Math.floor(Number(value) || 0));
    if (energy > 0) focus[id] = energy;
  }
  merged.round.abilityFocusEnergy = focus;

  merged.round.number = Math.max(1, Math.floor(merged.round.number || 1));
  merged.round.status = merged.round.status === "ended" ? "ended" : "running";
  // An ended round holds no gate: the shop is what the player is looking at, and a flag left
  // set by a save written mid-gate would freeze the round it starts next.
  merged.round.awaitingWave = merged.round.awaitingWave === true && merged.round.status === "running";
  merged.round.elapsedSeconds = Math.max(0, Number(merged.round.elapsedSeconds) || 0);
  merged.round.wavesResolved = Math.max(0, Math.floor(merged.round.wavesResolved || 0));
  merged.round.fearEarned = Math.max(0, Math.floor(Number(merged.round.fearEarned) || 0));
  // A save written before the split was tracked has no base to read, and defaulting it to 0
  // would have the HUD claim the entire round was upgrade income. Missing means "all of it was
  // base" instead - no bonus shown, which is simply true for the save most likely to be
  // missing the field: one from a build that had no Fear ladders in it.
  //
  // Read off `input` rather than off `merged`, because the merge has already filled the field
  // in from the fresh-state defaults by this point and a genuine 0 is indistinguishable from
  // an absent one there.
  const hadBase = Boolean(input.round) && "fearEarnedBase" in input.round;
  merged.round.fearEarnedBase = hadBase
    ? Math.min(merged.round.fearEarned, Math.max(0, Math.floor(Number(merged.round.fearEarnedBase) || 0)))
    : merged.round.fearEarned;
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
  // Against the base interval, not the round's hasted one: the hasted number is derived from
  // the upgrade snapshot, which is normalized further down and is not to be trusted yet. Every
  // legal remaining is under the base anyway, so the clamp is still the fence it was - the
  // worst a doctored save buys itself is one late first strike.
  merged.round.dahanAttackRemaining = clamp(
    Number(merged.round.dahanAttackRemaining) || 0,
    0,
    DAHAN_ATTACK_INTERVAL_SECONDS
  );
  const mult = Number(merged.round.abilityCooldownMult);
  merged.round.abilityCooldownMult = Number.isFinite(mult) && mult > 0 ? Math.min(mult, 1) : 1;

  // The snapshot of what this round runs on. Unknown ids are dropped and every tier is capped
  // the same way the owned tiers are, so a save cannot smuggle a round a tier the catalogue
  // does not sell. A save with no snapshot at all gets an empty one, which activeUpgradeTier
  // reads id by id as "fall back to what is owned" - how that save behaved when it was
  // written, and what the next startRound will replace with a real snapshot anyway.
  if (merged.round.upgradeTiers && typeof merged.round.upgradeTiers === "object") {
    const active = {};
    for (const [id, value] of Object.entries(merged.round.upgradeTiers)) {
      if (!UPGRADES[id]) continue;
      active[id] = clamp(Math.floor(Number(value) || 0), 0, upgradeMaxTier(id));
    }
    merged.round.upgradeTiers = active;
  } else {
    merged.round.upgradeTiers = {};
  }

  merged.invader = normalizeInvaderPhases(merged.invader, merged);
  merged.invaders = normalizeInvaderCounts(merged.invaders);
  merged.invaderDamage = normalizeInvaderDamage(merged.invaders, merged.invaderDamage, merged.round.wavesResolved);
  merged.dahan = normalizeDahanCounts(merged.dahan);
  merged.resources.energy = Math.max(0, Math.floor(merged.resources.energy || 0));

  merged.abilities = normalizeAbilities(merged, merged.abilities);
  const pendingRecord = abilityRecord(merged, merged.pendingAbilityTarget);
  merged.pendingAbilityTarget = merged.abilities[merged.pendingAbilityTarget] && pendingRecord && pendingRecord.needsTarget
    ? merged.pendingAbilityTarget
    : null;

  merged._log = Array.isArray(merged._log) ? merged._log.slice(0, 24) : [];

  // Last, and the only place an offer is ever rolled outside a purchase. It tops up an offer
  // that is short - which is a fresh game, or a save whose offer named a card bought since -
  // and leaves a full one exactly as it was found. That is what makes a reload not a re-roll.
  ensurePowerCardOffer(merged);

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

  // The toggles are display preferences, not run state, so they survive the reset. Coming back
  // to a wiped run in the wrong language - or at a speed the player did not pick - would read
  // as a second bug. The redeemed code carries for the same reason, and is read before the
  // speed because it is what says whether a playtest speed is still on the dial.
  //
  // ui.autoCast is deliberately not in that list. The reset takes every purchase with it, so
  // there is no automation left to switch off and no checkbox on any card to carry a
  // preference for - the fresh state's five defaults are the right answer.
  const prefs = (raw && raw.ui) || {};
  if (prefs.language === "en") fresh.ui.language = "en";
  if (prefs.playtest === true) setPlaytest(fresh, true);
  if (availableGameSpeeds(fresh).includes(Number(prefs.gameSpeed))) fresh.ui.gameSpeed = Number(prefs.gameSpeed);
  // Set after the round has already started, so the gate startRound closed on the default has
  // to be reopened by hand here - waveGateHeld would ignore it, but the flag would outlive the
  // preference the moment auto-proceed was switched back off.
  if (prefs.autoProceed === true) {
    setAutoProceed(fresh, true);
    fresh.round.awaitingWave = false;
  }

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
 * Export and import                                                    *
 *                                                                      *
 * The same state localStorage holds, wrapped so it can travel as a      *
 * file. The wrapper is three fields joined by dots: a magic word, the   *
 * state as base64, and a checksum over the two.                        *
 *                                                                      *
 * The base64 is not encryption and the checksum is not a signature -    *
 * engine.js is served to the browser, so anyone who reads it can        *
 * recompute both. What they buy is that a save is no longer editable by *
 * accident or by curiosity: opening the file shows no Fear count to     *
 * raise, and a hand-edited one is refused rather than silently loaded.  *
 * A player determined to cheat still can, and always could - the        *
 * localStorage entry is right there in the dev tools.                  *
 * ------------------------------------------------------------------ */

const SAVE_FILE_MAGIC = "SPIRITIDLAND1";
const SAVE_FILE_EXT = ".spiritsave";
const SAVE_CHECKSUM_SALT = "the-ocean-remembers";

// FNV-1a, 32 bits, salted. Not a cryptographic hash - it is here to catch a file that was
// edited or truncated, not one that was forged.
function saveChecksum(text) {
  const salted = SAVE_CHECKSUM_SALT + text;
  let hash = 0x811c9dc5;
  for (let i = 0; i < salted.length; i += 1) {
    hash ^= salted.charCodeAt(i);
    // imul rather than *: the FNV prime overflows a double's 53-bit mantissa within a few
    // characters, and the low bits that would be lost are the ones that carry the signal.
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Base64 through whichever door the environment opens: Buffer in node for the tests, btoa in
// the browser. The log lines carry umlauts, so both paths go via UTF-8 bytes rather than
// treating the JSON as Latin-1 - btoa alone would throw on the first "ä".
function encodeBase64(text) {
  if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(b64) {
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
  const binary = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

function exportSave(state) {
  const payload = encodeBase64(JSON.stringify(state));
  return `${SAVE_FILE_MAGIC}.${payload}.${saveChecksum(payload)}`;
}

// Named for the run inside it, so a folder of saves can be read without opening any of them.
function exportSaveFileName(state, date) {
  const day = (date || new Date()).toISOString().slice(0, 10);
  const wave = Math.max(0, Math.floor((state && state.round && state.round.wavesResolved) || 0));
  return `spirit-idland-welle-${wave}-${day}${SAVE_FILE_EXT}`;
}

/* Every failure is a reason rather than a throw: the caller has a message to show for each,
 * and a bad file must never be the thing that ends the session. */
function importSave(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return { ok: false, reason: "format" };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== SAVE_FILE_MAGIC) return { ok: false, reason: "format" };

  const [, payload, checksum] = parts;
  // Checked before decoding: Buffer.from drops characters it does not recognise instead of
  // failing, so an unvalidated payload could decode to something plausible-looking.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return { ok: false, reason: "format" };
  if (saveChecksum(payload) !== checksum) return { ok: false, reason: "checksum" };

  let parsed;
  try {
    parsed = JSON.parse(decodeBase64(payload));
  } catch (_) {
    return { ok: false, reason: "format" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "format" };

  // Through the same gate a stored save comes through, so an imported file cannot carry in a
  // shape the game has stopped being able to read.
  const migrated = migrateSave(parsed);
  const state = migrated.state;
  // No offline catch-up across the import either: a file written last month resumes where it
  // was written, crediting nothing for the month.
  state.time.lastTickUnixMs = nowMs();
  state.time.lastSaveUnixMs = nowMs();

  return { ok: true, state, reset: migrated.reset, fromVersion: migrated.fromVersion };
}

