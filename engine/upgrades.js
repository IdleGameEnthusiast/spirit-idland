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

// What the player owns. The shop reads this: it is what the next tier costs from, and what
// "maxed" is measured against.
function upgradeTier(state, upgradeId) {
  const raw = state.upgrades && state.upgrades.purchased ? state.upgrades.purchased[upgradeId] : 0;
  if (raw === true) return 1;
  return Math.max(0, Math.floor(Number(raw) || 0));
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

/* How many rungs a row has, which for a discount row is a question about the Fear catalogue
 * rather than about this one: the automation's own price is a rung of one of the two ladders,
 * and what is left is everything under it on that same ladder.
 *
 * An automation priced off both ladders has no rungs at all rather than a guessed position - see
 * the structural test in tests/ascension.test.js, which is what actually keeps the two tables
 * agreeing.
 */
function presenceUpgradeMaxTier(presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return 0;
  if (!record.discounts) return 1;
  const target = UPGRADES[record.discounts];
  const ladder = target ? automationLadder(target.baseCost) : null;
  if (!ladder) return 0;
  return ladder.length - 1 - ladder.indexOf(target.baseCost);
}

function presenceUpgradeMaxed(state, presenceId) {
  return presenceUpgradeTier(state, presenceId) >= presenceUpgradeMaxTier(presenceId);
}

// Cost of the *next* rung, mirroring upgradeCost on the Fear side - which is why this takes a
// state where it used to take an id alone. A flat row has one rung and answers with its price.
function presenceUpgradeCost(state, presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return Infinity;
  if (!record.discounts) return record.cost;
  if (presenceUpgradeMaxed(state, presenceId)) return Infinity;
  const cost = PRESENCE_DISCOUNT_COSTS[presenceUpgradeTier(state, presenceId)];
  return Number.isFinite(cost) ? cost : Infinity;
}

function purchasePresenceUpgrade(state, presenceId) {
  const t = locale(state);
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return false;

  // "Owned" and "maxed" are the same sentence for the three flat rows, whose max tier is 1, and
  // differ only for the ladders - so there is one check here rather than a branch.
  if (presenceUpgradeMaxed(state, presenceId)) {
    addLog(state, template(record.discounts ? t.presenceMaxed : t.presenceOwned, {
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

  // Names the Fear row it moved, not just itself. What a Presence purchase *does* is happen in
  // the other shop, and a log line that did not say which row would be reporting a number going
  // down and nothing going up. A discount row reports the new price, because the price is the
  // whole of what it did; a row with no Fear-row counterpart (see PRESENCE_UPGRADES) has
  // nothing to name and gets the plainer line instead.
  if (record.discounts) {
    addLog(state, template(t.presenceDiscounted, {
      upgrade: presenceUpgradeName(state, presenceId),
      unlocks: upgradeName(state, record.discounts),
      price: upgradeBaseCost(state, record.discounts),
      cost
    }));
  } else {
    addLog(state, record.unlocks
      ? template(t.presencePurchased, {
          upgrade: presenceUpgradeName(state, presenceId),
          unlocks: upgradeName(state, record.unlocks),
          cost
        })
      : template(t.presencePurchasedDirect, {
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
 * The auto-cast switches in particular stay where they were set even though the automations
 * they switch have just been un-bought, so re-buying one next cycle gets it back in the state
 * the player last chose.
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

  state.meta.fear = 0;
  state.meta.cycleFearGenerated = 0;
  state.meta.cycleFearGranted = 0;
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
function orderedUpgradeIds(state) {
  const maxed = (id) => upgradeTier(state, id) >= upgradeMaxTier(id);
  const buyable = UPGRADE_IDS.filter((id) => !maxed(id));
  const soldOut = UPGRADE_IDS.filter(maxed);
  return buyable.concat(soldOut);
}

function upgradeMaxTier(upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return 0;
  if (!record.repeatable) return 1;
  return Number.isFinite(record.maxTier) ? record.maxTier : Infinity;
}

/* ---------- The two rows Fear alone cannot reach ----------
 *
 * A row naming a `presenceUnlock` is locked until that Presence row is bought, whatever the
 * Fear purse holds. The lock is about a different currency than the price, which is why
 * purchaseUpgrade tests it *before* the price: a player holding 500 Fear in front of a dead
 * button deserves the real reason.
 *
 * This replaces `gatedUpgradesUnlocked`, which asked whether the whole catalogue was finished.
 * That question no longer has an answer worth having - the Fear catalogue is not a thing that
 * finishes, because Presence is what grows it - and a test for a state that never arrives is
 * a wall rather than a gate. Deleted with it: GATED_UPGRADE_IDS, upgradeIsLocked,
 * upgradeRequiredForGate, the `requiredForGate` field, and upgradeIsSoftCapped, which lost its
 * last caller when the three Fear ladders got a maxTier.
 */
function upgradePresenceUnlock(upgradeId) {
  const record = UPGRADES[upgradeId];
  return (record && record.presenceUnlock) || null;
}

function upgradeNeedsPresence(state, upgradeId) {
  const required = upgradePresenceUnlock(upgradeId);
  if (!required) return false;
  return presenceUpgradeTier(state, required) <= 0;
}

// The 1.6 curve unless the row names its own. A `costGrowth` of 1 is what makes a row a pool
// rather than a ladder (see dahan_remember): every unit costs what the first one did.
function upgradeCostGrowth(upgradeId) {
  const record = UPGRADES[upgradeId];
  const growth = record && Number(record.costGrowth);
  return Number.isFinite(growth) && growth > 0 ? growth : UPGRADE_COST_GROWTH;
}

/* What a row's first rung costs *this cycle*, which is its catalogue price unless a Presence
 * discount row has walked it down its ladder.
 *
 * Every Fear price in the game goes through here rather than reading `baseCost` directly, so
 * there is one place a discount can apply and no path - shop label, purchase, affordability -
 * that can disagree with another about what a row costs.
 */
function upgradeBaseCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const presenceId = PRESENCE_DISCOUNT_BY_UPGRADE[upgradeId];
  if (!presenceId) return record.baseCost;
  return automationPriceAtTier(upgradeId, presenceUpgradeTier(state, presenceId));
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

  // Before the price check, because a locked row's price is not the reason it is refused and
  // a player with the Fear in hand deserves the real reason - which is a different currency.
  if (upgradeNeedsPresence(state, upgradeId)) {
    addLog(state, template(t.upgradeLocked, {
      upgrade: upgradeName(state, upgradeId),
      presence: presenceUpgradeName(state, upgradePresenceUnlock(upgradeId))
    }));
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
      seconds: strikeSecondsText(state, dahanAttackIntervalFor(tier + amount))
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

