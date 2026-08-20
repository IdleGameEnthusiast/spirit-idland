/* ------------------------------------------------------------------ *
 * Upgrades, Presence, and ascension
 * ------------------------------------------------------------------ *
 *
 * The Fear shop and the Presence ladder above it: tiers, costs, Reclaim.
 * Spec: docs/spec/05-progression.md, docs/spec/04-economy-formulas.md
 */

/* ------------------------------------------------------------------ *
 * Upgrades (05-progression.md)                                         *
 * ------------------------------------------------------------------ */

/* What the player owns. The shop reads this: it is what the next tier costs from, and what
 * "maxed" is measured against.
 *
 * Two sources, and the second is the whole of the automation grant. `upgrades.purchased` is
 * what Fear bought this cycle and is wiped by `ascend`; a row named by a Presence row's
 * `grants` reads as owned whatever that object says, and so survives the wipe. Folding it in
 * here rather than at each reader is what makes the grant total for free: the shop shows the
 * row sold out, `orderedUpgradeIds` sinks it, `purchaseUpgrade` refuses it as maxed,
 * `snapshotUpgradeTiers` carries it into the round, and every auto-cast check already reads
 * through `activeUpgradeTier`.
 *
 * A granted row answers 1, not "the highest tier it could have": every automation is a
 * non-repeatable one-off, and a `grants` entry naming a repeatable row would be a content bug
 * (see the structural test in tests/ascension.test.js) rather than a case to handle here.
 *
 * `rebuildSpentFear` deliberately does not come through this - it walks the saved `purchased`
 * object directly, so a granted row is never billed as Fear the player spent.
 */
function upgradeTier(state, upgradeId) {
  const raw = state.upgrades && state.upgrades.purchased ? state.upgrades.purchased[upgradeId] : 0;
  const owned = raw === true ? 1 : Math.max(0, Math.floor(Number(raw) || 0));
  if (owned > 0) return owned;
  return upgradeGrantedForever(state, upgradeId) ? 1 : 0;
}

// Whether a Presence row has handed this automation over for good. Its own tier is what is
// read, so a save carrying a Presence row the catalogue has dropped grants nothing.
function upgradeGrantedForever(state, upgradeId) {
  const presenceId = PRESENCE_GRANT_BY_UPGRADE[upgradeId];
  return Boolean(presenceId) && presenceUpgradeTier(state, presenceId) > 0;
}

/* ---------- The Presence side of the same idea ----------
 *
 * Deliberately a separate object from `upgrades.purchased` rather than more keys in it, and
 * that one decision is what keeps ascension simple: the wipe is `upgrades.purchased = {}`
 * whole, with no filter and no exception list. Two objects with one rule each beats one object
 * with a rule and an exception, and the exception is what a later reader gets wrong.
 *
 * Everything below deliberately mirrors the Fear side rather than sharing code with it. The
 * two catalogues answer different questions and are about to diverge - a Presence row will
 * grow a cap or discount a price, neither of which a UPGRADES record can describe - so
 * factoring them together now would only have to be undone.
 */
function presenceUpgradeTier(state, presenceId) {
  const raw = state.presenceUpgrades && state.presenceUpgrades.purchased
    ? state.presenceUpgrades.purchased[presenceId]
    : 0;
  if (raw === true) return 1;
  return Math.max(0, Math.floor(Number(raw) || 0));
}

function presenceUpgradeOwned(state, presenceId) {
  return presenceUpgradeTier(state, presenceId) > 0;
}

/* How many rungs a row has: one for all but `presence_fear_remains`, which is the
 * repeatable row this signature was kept waiting for (see the note above PRESENCE_UPGRADES).
 *
 * A row without `maxTier` is a one-off and answers 1, so the catalogue says nothing it does not
 * mean - only the ladder carries the field. An unknown id answers 0, so `presenceUpgradeMaxed`
 * is true for it and nothing tries to buy it.
 */
function presenceUpgradeMaxTier(presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return 0;
  if (!record.repeatable) return 1;
  return Number.isFinite(record.maxTier) ? record.maxTier : Infinity;
}

function presenceUpgradeMaxed(state, presenceId) {
  return presenceUpgradeTier(state, presenceId) >= presenceUpgradeMaxTier(presenceId);
}

// Cost of the *next* rung, mirroring upgradeCost on the Fear side - which is why this takes a
// state where it used to take an id alone. There is no growth curve here and there is not meant
// to be one: every Presence price in the catalogue is flat, the ten-rung ladder included (see
// the note above PRESENCE_UPGRADES for why a Presence ladder cannot afford one). So this
// answers the row's price until its last rung is taken and Infinity after.
function presenceUpgradeCost(state, presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return Infinity;
  if (presenceUpgradeMaxed(state, presenceId)) return Infinity;
  return record.cost;
}

function purchasePresenceUpgrade(state, presenceId) {
  const t = locale(state);
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return false;

  // "Owned" and "maxed" are the same sentence for a one-off, and for the ladder they are the
  // same sentence at the top rung, so one check and one line still cover both.
  if (presenceUpgradeMaxed(state, presenceId)) {
    addLog(state, template(t.presenceOwned, {
      upgrade: presenceUpgradeName(state, presenceId)
    }));
    return false;
  }

  const cost = presenceUpgradeCost(state, presenceId);
  if (state.meta.presence < cost) {
    addLog(state, template(t.presenceTooExpensive, {
      upgrade: presenceUpgradeName(state, presenceId),
      cost,
      presence: state.meta.presence
    }));
    return false;
  }

  state.meta.presence -= cost;
  state.presenceUpgrades.purchased[presenceId] = presenceUpgradeTier(state, presenceId) + 1;

  // Names the Fear rows it just handed over, not just itself. What a Presence purchase *does*
  // happens in the other shop, and a line that did not say which rows would be reporting a
  // number going down and nothing going up. `presence_all_unbidden` names five, joined rather
  // than one line each - it is one purchase and it reads as one sentence. A row that grants
  // nothing has nothing to name and gets the plainer line instead.
  const granted = record.grants || [];
  if (granted.length) {
    addLog(state, template(t.presenceGranted, {
      upgrade: presenceUpgradeName(state, presenceId),
      unlocks: granted.map((id) => upgradeName(state, id)).join(t.listSeparator),
      cost
    }));
  } else if (record.repeatable) {
    // The ladder says which rung it just took. Ten identical lines reading "The Fear Remains
    // for 1 Presence" would report a purchase without reporting any progress, and the rung is
    // the only thing that separates the tenth click from the first.
    addLog(state, template(t.presenceTierPurchased, {
      upgrade: presenceUpgradeName(state, presenceId),
      tier: presenceUpgradeTier(state, presenceId),
      max: presenceUpgradeMaxTier(presenceId),
      cost
    }));
  } else {
    addLog(state, template(t.presencePurchasedDirect, {
      upgrade: presenceUpgradeName(state, presenceId),
      cost
    }));
  }
  return true;
}

/* ---------- Ascension ----------
 *
 * Two conditions, and they are separate on purpose. The unlock reads what Reclaiming would pay,
 * so it is re-earned by every cycle and asks nothing of the player that the payout was not
 * already asking. And it is offered only between rounds, the same rule the whole of progression
 * follows - which also removes the question of whether a running round's Fear counts, since it
 * has not been banked.
 *
 * Reading the payout rather than cycleFearGenerated directly is what keeps the gate honest if
 * either constant moves: the threshold is in Presence, the unit the player is being shown.
 */
function ascensionUnlocked(state) {
  return ascensionPayout(state) >= ASCENSION_UNLOCK_PRESENCE;
}

function canAscend(state) {
  return ascensionUnlocked(state) && state.round.status === "ended";
}

/* What Reclaiming right now would pay. See the note above PRESENCE_FEAR_DIVISOR for why the
 * root is the shape.
 *
 * It reads what the cycle *generated*, never the bank, and that is a property rather than an
 * implementation detail: spending Fear costs no Presence, so there is no reason to hoard
 * before Reclaiming and no moment where the shop and this panel want opposite things from the
 * player. `cycleFearGranted` is excluded for the other half of the same reason - a tool for
 * looking at the game must not be a way of progressing through it.
 */
function ascensionPayout(state) {
  const generated = Math.max(0, Math.floor(Number(state.meta.cycleFearGenerated) || 0));
  return Math.floor(Math.sqrt(generated / PRESENCE_FEAR_DIVISOR));
}

/* How much further this cycle has to go before the payout reads one higher.
 *
 * The root is what makes this worth printing: the payout figure alone cannot say whether the
 * next Presence is a round away or six, and the gap between rungs grows with every one taken.
 * Inverting the payout gives the answer exactly - the smallest generated total whose root
 * floors to `payout + 1` is `(payout + 1)^2 * PRESENCE_FEAR_DIVISOR`, because the division
 * comes before the root and the floor only ever rounds down.
 *
 * It reads `cycleFearGenerated` for the same reason ascensionPayout does, which also keeps the
 * two figures agreeing: a round in progress has generated nothing yet as far as either is
 * concerned, so this number never counts Fear the payout above it is ignoring.
 */
/* What the next cycle opens its bank with, bought a rung at a time by
 * `presence_fear_remains`. Zero for a player who owns none of it, which is every player
 * until they choose otherwise - so the default Reclaim is the one this function did not exist
 * for, emptying the bank exactly as it always did.
 *
 * Read at the moment of the Reclaim rather than stored, so a rung bought between two ascensions
 * counts on the very next one. Nothing else reads it: this is a starting balance, not an income.
 */
function ascensionStartFear(state) {
  return presenceUpgradeTier(state, "presence_fear_remains") * ASCENSION_START_FEAR_PER_TIER;
}

function fearToNextPresence(state) {
  const generated = Math.max(0, Math.floor(Number(state.meta.cycleFearGenerated) || 0));
  const next = ascensionPayout(state) + 1;
  return Math.max(0, next * next * PRESENCE_FEAR_DIVISOR - generated);
}

/* The one irreversible action in the game.
 *
 * What it clears is every `cycle*` field plus the two things they describe - the bank and the
 * catalogue it bought. What it keeps is everything else, and the naming carries the rule: a
 * `cycle*` field is wiped by ascension and everything else is not. Anything added later that
 * should survive a Reclaim must not be called `cycle*`, and anything that should not survive
 * one must be.
 *
 * `ui.*` surviving is the same rule that carries the language through a save migration: a
 * preference is not something the player earned, so taking it away is not part of the price.
 * The auto-cast switches in particular stay where they were set, so an automation the wipe
 * un-buys comes back next cycle in the state the player last chose.
 *
 * `presenceUpgrades.purchased` is not touched here and that is what makes a granted automation
 * permanent: the wipe below empties what Fear bought, and `upgradeTier` reads the grant from
 * the Presence catalogue instead. So the rows a Presence row hands over are owned on the other
 * side of this function, with their auto-cast switches still set, and the first round of the
 * new cycle runs itself.
 */
function ascend(state) {
  const t = locale(state);
  if (!canAscend(state)) {
    addLog(state, t.ascendRefused);
    return false;
  }

  const payout = ascensionPayout(state);
  const generated = Math.max(0, Math.floor(Number(state.meta.cycleFearGenerated) || 0));

  state.meta.presence += payout;
  state.meta.ascensionCount += 1;

  /* The wipe, and the one thing that survives it into the bank rather than around it.
   *
   * `ascensionStartFear` is Fear the player did not earn, so it lands in the granted column
   * beside the playtest button's and never in `cycleFearGenerated` - which is what keeps the
   * head start from minting Presence of its own next Reclaim. The identity the playtest tally
   * checks (generated + granted - spent = bank) holds across this line: both sides start the
   * cycle at the same figure.
   *
   * Worth naming because a later reader will find it: the grant does still raise next cycle's
   * payout, just not directly. It buys shop rows at wave 0 that multiply everything the cycle
   * generates afterwards, and that multiplied Fear is generated Fear like any other. Excluding
   * it here is about the Fear itself never being counted twice, not a claim that a head start
   * is worth no Presence.
   */
  const startFear = ascensionStartFear(state);
  state.meta.fear = startFear;
  state.meta.cycleFearGenerated = 0;
  state.meta.cycleFearGranted = startFear;
  state.meta.cycleFearSpent = 0;
  state.meta.cycleBestWave = 0;
  state.upgrades.purchased = {};

  // Flavour rather than mechanics: nothing in the rules reads the round number - the
  // difficulty ladder is keyed to the wave - and a new age counting from one reads better than
  // a run that remembers every attempt.
  state.round.number = 1;

  addLog(state, template(t.ascended, {
    count: state.meta.ascensionCount,
    generated: formatFear(generated),
    presence: payout,
    total: state.meta.presence
  }));

  // A second line rather than a clause in the first: the sentence above is about what the cycle
  // was worth, and this one is about what the next cycle opens with. A player owning none of
  // the ladder never sees it, so the Reclaim reads exactly as it did before the row existed.
  if (startFear > 0) {
    addLog(state, template(t.ascendedStartFear, { fear: formatFear(startFear) }));
  }

  startRound(state);
  // The same closing move startNextRound makes, for the same reason: the button the player
  // just pressed is the click that starts the round, so the wave gate does not ask for a
  // second one. startRound raises that gate on its own, which is right for a fresh game nobody
  // has looked at yet and wrong here - Reclaiming already took two deliberate clicks.
  state.round.awaitingWave = false;
  return true;
}

/* ---------- Owning an upgrade and running on it ----------
 *
 * The shop is open during a round now (see purchaseUpgrade), which splits a question that
 * used to have one answer: what the player owns, and what the round in progress is running
 * on. They are the same number at every round boundary and can differ only in between.
 *
 * One rule decides it, and it is the same rule the two Fear pools follow: *a round cannot
 * spend or benefit from itself*. Fear banks when the round ends; upgrades take effect when
 * the next one starts. Without it, Blight Resilience bought at 9/10 Blight would be an
 * emergency button that rescues a round the player had already lost - and a round's outcome
 * would depend on what they bought while watching it, which is exactly the decision the
 * between-rounds shop existed to keep separate.
 *
 * startRound takes the snapshot; everything a running round reads goes through
 * activeUpgradeTier. Note that most upgrades need no help here - Dahan Reinforcement and
 * Blight Resilience are only ever read at setup, so they were already deferred by where they
 * are read. It is the auto-cast upgrades, read every tick, that this exists for.
 */
function snapshotUpgradeTiers(state) {
  const out = {};
  for (const id of UPGRADE_IDS) out[id] = upgradeTier(state, id);
  return out;
}

function activeUpgradeTier(state, upgradeId) {
  const snapshot = state.round && state.round.upgradeTiers;
  // No snapshot means a save from before the shop opened mid-round. Falling back to what is
  // owned matches how that save behaved when it was written.
  if (!snapshot || !(upgradeId in snapshot)) return upgradeTier(state, upgradeId);
  return Math.max(0, Math.floor(Number(snapshot[upgradeId]) || 0));
}

// The catalogue in shop order, except an upgrade already at its top tier sinks below every
// upgrade that still has something to sell. A maxed repeatable and a bought one-off are both
// "nothing left here" from the shop's point of view, so they leave together rather than the
// one-off keeping its spot at the bottom of a now-pointless ladder. Order is otherwise stable
// within each half, so the split never reshuffles anything the player already learned.
//
// A row the player has not revealed yet is in neither half - see upgradeRevealed.
function orderedUpgradeIds(state) {
  const maxed = (id) => upgradeTier(state, id) >= upgradeMaxTier(id);
  const shelf = UPGRADE_IDS.filter((id) => upgradeRevealed(state, id));
  const buyable = shelf.filter((id) => !maxed(id));
  const soldOut = shelf.filter(maxed);
  return buyable.concat(soldOut);
}

/* ---------- Revealing a row is not locking it ----------
 *
 * The note below is about the three gates this catalogue has shed, and none of them is coming
 * back. This is a different thing: a row whose *text* means nothing yet. `power_card_interval`
 * prices the gap between two power cards, and to a player who has never held one that is a
 * price on a mechanic they have not met - noise in the one list the shop expects them to read.
 *
 * So it waits for the first card, and the difference from a gate is the whole point: nothing
 * here refuses a purchase, moves a price, or asks the player to earn the row. `purchaseUpgrade`
 * does not consult it, because a reveal that can refuse a buy is a lock wearing a new name.
 * This decides whether the row is printed and nothing else, and the condition is one the player
 * passes by playing rather than by shopping.
 *
 * Owned cards survive Reclaim - `ascend` wipes `upgrades.purchased` and does not touch
 * `powerCards.owned` - so a row revealed once stays revealed for good.
 */
const UPGRADE_REVEALS = {
  power_card_owned: (state) => ownedPowerCardIds(state).length > 0
};

function upgradeRevealed(state, upgradeId) {
  const key = (UPGRADES[upgradeId] || {}).revealedBy;
  if (!key) return true;
  const test = UPGRADE_REVEALS[key];
  // An unknown key reveals rather than hides: a typo in the catalogue should show a row that
  // meant to wait, not silently delete one from the shop.
  return test ? Boolean(test(state)) : true;
}

function upgradeMaxTier(upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return 0;
  if (!record.repeatable) return 1;
  return Number.isFinite(record.maxTier) ? record.maxTier : Infinity;
}

/* ---------- No row is locked any more ----------
 *
 * `upgradePresenceUnlock` and `upgradeNeedsPresence` lived here, and with them the rule that
 * `auto_start_round` and `auto_buy_abilities` could not be bought until a Presence row opened
 * them. A Presence row *grants* an automation now (see PRESENCE_UPGRADES), so the row that
 * used to open those two buys them outright and a lock in front of a price nobody pays twice
 * is nothing but a dead button. Every row in the Fear catalogue is buyable at its listed price
 * from the first round of the first cycle.
 *
 * That is the third gate this catalogue has shed, and they failed the same way. First
 * `gatedUpgradesUnlocked`, which refused the two until every other row was maxed - a test for
 * a state that never arrives, since the Fear catalogue does not finish. Then `presenceUnlock`,
 * which asked for an ascension first and then asked for the Fear again every cycle after.
 * Deleted across the three: GATED_UPGRADE_IDS, upgradeIsLocked, upgradeRequiredForGate,
 * `requiredForGate`, upgradeIsSoftCapped, `presenceUnlock`, and the two functions above.
 */

// The 1.6 curve unless the row names its own. A `costGrowth` of 1 is what makes a row a pool
// rather than a ladder (see dahan_remember): every unit costs what the first one did.
function upgradeCostGrowth(upgradeId) {
  const record = UPGRADES[upgradeId];
  const growth = record && Number(record.costGrowth);
  return Number.isFinite(growth) && growth > 0 ? growth : UPGRADE_COST_GROWTH;
}

/* What a row's first rung costs, which is its catalogue price - the Presence discount ladders
 * that made this a live question are gone (see the note above PRESENCE_UPGRADES), and Presence
 * now takes a row out of the shop rather than marking it down.
 *
 * Every Fear price in the game still goes through here rather than reading `baseCost` directly.
 * It is a pass-through today and kept anyway: it is the one seam a future price modifier would
 * land on, and there is no path - shop label, purchase, affordability - that can reach a price
 * without crossing it. `state` is unused for that reason and stays in the signature.
 */
function upgradeBaseCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  return record ? record.baseCost : Infinity;
}

// Cost of the *next* tier. Rounded to whole Fear so the shop never shows 6.4 Fear.
function upgradeCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const tier = upgradeTier(state, upgradeId);
  return Math.round(upgradeBaseCost(state, upgradeId) * Math.pow(upgradeCostGrowth(upgradeId), tier));
}

/* ---------- Buying more than one rung at once ----------
 *
 * Only the pool needs this, but it is written for the general case because a special-cased
 * "and the pool works differently" is how the shop would end up with two purchase paths and
 * one of them untested. The sum is of the individual rounded prices rather than a rounded sum
 * of the curve: what a player pays for ten rungs has to equal what they would have paid
 * clicking ten times, or the bulk button is either a discount or a tax nobody asked for.
 *
 * Flat growth gets the closed form. Not for speed at ten rungs - for the max button, which
 * asks about thousands.
 */
function upgradeCostFor(state, upgradeId, count) {
  return upgradeCostFromTier(upgradeId, upgradeTier(state, upgradeId), count, upgradeBaseCost(state, upgradeId));
}

/* The same sum without a state to read the starting rung from.
 *
 * upgradeCostFor is this function with `from` filled in from what the player owns, which is
 * every caller in the game. The one caller that needs the other end of it is the migration in
 * normalizeState, which asks what a save's owned tiers *have already cost* - a question about
 * rungs 0..n-1, with no state to ask because the state is still being built.
 */
function upgradeCostFromTier(upgradeId, from, count, baseCost) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const want = Math.max(0, Math.floor(Number(count) || 0));
  if (want === 0) return 0;

  // The discounted price when a caller has a state to read one from, the catalogue price when it
  // does not. rebuildSpentFear is the second case: it prices a save's owned rows with no state
  // built yet, and undiscounted is the right answer there anyway - the tiers it is pricing were
  // bought before whatever discount the same save also carries.
  const base = Number.isFinite(baseCost) ? baseCost : record.baseCost;
  const tier = Math.max(0, Math.floor(Number(from) || 0));
  const growth = upgradeCostGrowth(upgradeId);
  if (growth === 1) return Math.round(base) * want;

  let total = 0;
  for (let i = 0; i < want; i += 1) total += Math.round(base * Math.pow(growth, tier + i));
  return total;
}

// How many rungs the purse can actually take, never more than the ladder has left. What the
// max button buys, and what a bulk button is checked against before it is offered.
function upgradeTiersAffordable(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return 0;
  const room = upgradeMaxTier(upgradeId) - upgradeTier(state, upgradeId);
  if (!(room > 0)) return 0;
  const fear = Math.max(0, Math.floor(Number(state.meta.fear) || 0));
  const base = upgradeBaseCost(state, upgradeId);

  if (upgradeCostGrowth(upgradeId) === 1) {
    const each = Math.max(1, Math.round(base));
    return Math.min(room, Math.floor(fear / each));
  }

  // The geometric case walks rung by rung, because the curve is rounded per rung and a closed
  // form would disagree with upgradeCostFor about the last one. The guard keeps it finite on a
  // soft-capped row, where `room` is Infinity - though there the price outruns any purse long
  // before the count gets interesting.
  const tier = upgradeTier(state, upgradeId);
  const growth = upgradeCostGrowth(upgradeId);
  let count = 0;
  let spent = 0;
  while (count < room && count < 1000) {
    spent += Math.round(base * Math.pow(growth, tier + count));
    if (spent > fear) break;
    count += 1;
  }
  return count;
}

// The Energy a round opens with at a given owned tier. Clamped at both ends rather than
// indexed raw: a save carrying a tier from a longer ladder must still answer with the top of
// the one that exists now, not `undefined`.
function startingEnergyForTier(tier) {
  const owned = Math.max(0, Math.floor(Number(tier) || 0));
  return STARTING_ENERGY_BY_TIER[Math.min(owned, STARTING_ENERGY_BY_TIER.length - 1)];
}

/* ---------- The Dahan Remember, as a number ----------
 *
 * The invested Fear *is* the tier, which is the whole reason the pool could be a catalogue row
 * at all: saving, normalizing, ordering and the sold-out half all work on it unchanged. These
 * two are the only places that know the tier means Fear rather than a rung.
 */
function dahanHasteFraction(invested) {
  const fear = Math.max(0, Math.floor(Number(invested) || 0));
  return Math.min(DAHAN_HASTE_MAX, fear / DAHAN_HASTE_FEAR_FOR_FULL);
}

// Divided, not subtracted - see the note above DAHAN_HASTE_FEAR_FOR_FULL. A second cooldown
// source belongs in the denominator beside this one rather than in a second formula.
function dahanAttackIntervalFor(invested) {
  return DAHAN_ATTACK_INTERVAL_SECONDS / (1 + dahanHasteFraction(invested));
}

/* What the round in progress is actually striking on, as against what the player owns.
 *
 * Read off the round's upgrade snapshot rather than off a frozen interval of its own, so the
 * pool obeys the same rule as every other row for the same reason and by the same mechanism:
 * Fear poured in at 9/10 Blight buys the *next* round a faster strike, never the one being
 * lost (see activeUpgradeTier). A second frozen number would have been a second way to be
 * wrong about that, and one of them would eventually stop agreeing with the other.
 */
function roundDahanAttackInterval(state) {
  return dahanAttackIntervalFor(activeUpgradeTier(state, "dahan_remember"));
}

// The permanent baseline every round starts from (04 Round Reset Formula).
function upgradeTotals(state) {
  return {
    dahanBonus: upgradeTier(state, "dahan_reinforcement"),
    blightThresholdBonus: upgradeTier(state, "blight_resilience"),
    startingEnergy: startingEnergyForTier(upgradeTier(state, "headwaters")),
    // The Dahan's strike clock, and the only cooldown the shop touches. Read off owned tiers
    // here; startRound is what freezes it for the round (see the snapshot note there).
    dahanAttackInterval: dahanAttackIntervalFor(upgradeTier(state, "dahan_remember")),
    // No upgrade moves *ability* cooldowns today - the Dahan clock above is its own thing and
    // deliberately not routed through this. The multiplier stays in the round state because
    // the next ability-cooldown upgrade will want it, and a round that reads 1 costs nothing
    // to keep.
    cooldownReductionPct: 0
  };
}

/* `count` is how many rungs to take at once, and it defaults to one because every row except
 * the pool only ever buys one. Two rules about it:
 *
 *   - Asking for more than is left buys what is left, rather than refusing. The +1000 button
 *     four hundred short of the cap should finish the pool, not sulk.
 *   - Asking for more than the purse holds refuses the whole thing, rather than buying what
 *     fits. A partial purchase would spend a number the player never chose - the max button
 *     exists precisely so that "as much as I can afford" is a thing they can say out loud.
 */
function purchaseUpgrade(state, upgradeId, count) {
  const t = locale(state);
  const record = UPGRADES[upgradeId];
  if (!record) return false;

  // No check on the round's status. The shop is always open now that Auto Start Round can
  // remove the pause it used to live in - what keeps a round from buying its own way out is
  // the pool the Fear sits in, not the clock (see the two-pool note above FEAR_PER_POWER).
  const tier = upgradeTier(state, upgradeId);
  const room = upgradeMaxTier(upgradeId) - tier;
  if (!(room > 0)) {
    addLog(state, template(t.upgradeMaxed, { upgrade: upgradeName(state, upgradeId) }));
    return false;
  }

  const want = Math.max(1, Math.floor(Number(count) || 1));
  const amount = Math.min(want, room);
  const cost = upgradeCostFor(state, upgradeId, amount);
  if (state.meta.fear < cost) {
    addLog(state, template(t.upgradeTooExpensive, {
      upgrade: upgradeName(state, upgradeId),
      cost,
      fear: formatFear(state.meta.fear)
    }));
    return false;
  }

  state.meta.fear -= cost;
  state.meta.cycleFearSpent += cost;
  state.upgrades.purchased[upgradeId] = tier + amount;

  // A pool has no tier worth naming, so it reports what it is: Fear in, haste out. Every
  // other row reports the rung it just reached.
  if (upgradeIsPool(upgradeId)) {
    addLog(state, template(t.upgradeInvested, {
      upgrade: upgradeName(state, upgradeId),
      cost,
      pct: hastePctText(dahanHasteFraction(tier + amount)),
      seconds: dialSecondsText(state, dahanAttackIntervalFor(tier + amount))
    }));
  } else {
    addLog(state, template(t.upgradePurchased, {
      upgrade: upgradeName(state, upgradeId),
      tier: tier + amount,
      cost
    }));
  }
  return true;
}

// A row bought by the handful rather than by the rung. The denominations are the row's own,
// so the shop asks the catalogue what to draw instead of naming the pool in the UI.
function upgradeIsPool(upgradeId) {
  const record = UPGRADES[upgradeId];
  return Boolean(record && Array.isArray(record.bulkAmounts) && record.bulkAmounts.length > 0);
}

function upgradeBulkAmounts(upgradeId) {
  return upgradeIsPool(upgradeId) ? UPGRADES[upgradeId].bulkAmounts.slice() : [];
}

// Fear is whole-numbered at every source, so it never needs a decimal place. The function
// stays because every readout goes through it, and a stray fraction from an old save should
// show as the integer the shop will actually spend rather than as noise.
function formatFear(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

