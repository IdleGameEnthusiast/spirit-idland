/* ------------------------------------------------------------------ *
 * Abilities: unlocking, targeting, and auto-cast
 * ------------------------------------------------------------------ *
 *
 * Unlock and tier economy first, then legal targets, then the auto-cast
 * target pickers that stand in for the player.
 * Spec: docs/spec/07-content-registry.md, docs/spec/04-economy-formulas.md
 */

/* ------------------------------------------------------------------ *
 * Abilities (07-content-registry.md, 04-economy-formulas.md)           *
 * ------------------------------------------------------------------ */

// The ability bar's contents: the spirit's whole kit, locked entries included. The bar shows
// a locked ability rather than hiding it - what is still out there is half of what makes
// Energy worth banking, and a bar that grows by surprise teaches nothing.
function spiritAbilityIds(state) {
  return (activeSpirit(state).abilityIds || []).filter((id) => Boolean(ABILITIES[id]));
}

// The abilities that are actually castable: the spirit's starting kit, anything bought with
// Energy this round, plus the `unlock_` shop path (which no catalogue row uses today - see
// 07-content-registry.md - and which stays live so a sixth ability is content, not code).
function unlockedAbilityIds(state) {
  const kit = spiritAbilityIds(state);
  const starting = activeSpirit(state).startingAbilityIds || [];
  // Round state, not spirit state: Energy does not survive a round, so neither does anything
  // bought with it. startRound empties this list along with the purse that filled it.
  const bought = Array.isArray(state.round && state.round.purchasedAbilityIds)
    ? state.round.purchasedAbilityIds
    : [];

  // Kit order, not purchase order: the bar must not reshuffle itself the moment something
  // is bought, or the player loses the position they had learned.
  const unlocked = kit.filter((id) => starting.includes(id) || bought.includes(id));

  for (const upgradeId of Object.keys((state.upgrades && state.upgrades.purchased) || {})) {
    if (!upgradeId.startsWith("unlock_")) continue;
    const abilityId = upgradeId.slice("unlock_".length);
    if (ABILITIES[abilityId] && !unlocked.includes(abilityId)) unlocked.push(abilityId);
  }

  // The third source, after the kit and the `unlock_` path: the power cards this round has
  // been handed. Round state like the Energy unlocks above, and last in the list on purpose -
  // the bar reads as the spirit's own kit first and what the round earned after it, and a
  // card arriving at wave 45 must not shove the five abilities the player aims at sideways.
  const hand = Array.isArray(state.round && state.round.cards && state.round.cards.handIds)
    ? state.round.cards.handIds
    : [];
  for (const cardId of hand) {
    if (POWER_CARDS[cardId] && !unlocked.includes(cardId)) unlocked.push(cardId);
  }

  return unlocked;
}

function lockedAbilityIds(state) {
  const unlocked = unlockedAbilityIds(state);
  return spiritAbilityIds(state).filter((id) => !unlocked.includes(id));
}

function abilityIsUnlocked(state, abilityId) {
  return unlockedAbilityIds(state).includes(abilityId);
}

/* ---------- Tiers ----------
 *
 * A tiered ability is one entry in the bar that changes what it is as the round goes on.
 * Its `tiers` array holds a whole record each - cooldown, effect, text - so tier 2 is not
 * tier 1 with a modifier applied, and nothing has to reason about which fields a tier is
 * allowed to override.
 *
 * Read a record through abilityRecord, never straight out of ABILITIES: the raw entry for a
 * tiered ability has no cooldownSeconds and no effect of its own, and a caller reaching past
 * this would get a record that quietly does nothing.
 */

function abilityIsTiered(abilityId) {
  return Boolean(ABILITIES[abilityId] && Array.isArray(ABILITIES[abilityId].tiers));
}

function abilityMaxTier(abilityId) {
  return abilityIsTiered(abilityId) ? ABILITIES[abilityId].tiers.length - 1 : 0;
}

// Zero-based, so tier index 0 is what the card calls "Tier 1".
function abilityTier(state, abilityId) {
  if (!abilityIsTiered(abilityId)) return 0;
  const tiers = (state.round && state.round.abilityTiers) || {};
  return clamp(Math.floor(Number(tiers[abilityId]) || 0), 0, abilityMaxTier(abilityId));
}

function abilityRecord(state, abilityId) {
  // Cards come through here too - a card is an ability in every respect that matters, and
  // this is the one door every reader of a record uses. None of them has tiers, so a card
  // falls straight out of the branch below as its own record.
  const base = abilityBaseRecord(abilityId);
  if (!base) return null;
  if (!Array.isArray(base.tiers)) return base;
  const tier = abilityTier(state, abilityId);
  return { ...base, ...base.tiers[tier], tier };
}

// What the next tier costs, or Infinity at the top of the ladder.
function abilityUpgradeCost(state, abilityId) {
  if (!abilityIsTiered(abilityId)) return Infinity;
  if (abilityTier(state, abilityId) >= abilityMaxTier(abilityId)) return Infinity;
  const cost = abilityRecord(state, abilityId).upgradeCost;
  return Number.isFinite(cost) ? cost : Infinity;
}

function upgradeAbility(state, abilityId) {
  const t = locale(state);
  if (!abilityIsTiered(abilityId) || !abilityIsUnlocked(state, abilityId)) return false;
  // Energy is round-local, and so is every tier it buys: startRound clears both. Spending it
  // in the shop would buy a tier that is wiped before it is ever cast - see unlockAbility.
  if (state.round.status !== "running") return false;

  const cost = abilityUpgradeCost(state, abilityId);
  if (!Number.isFinite(cost)) return false;

  const nextTier = abilityTier(state, abilityId) + 1;
  if (state.resources.energy < cost) {
    addLog(state, template(t.abilityUpgradeTooExpensive, {
      ability: abilityName(state, abilityId),
      tier: nextTier + 1,
      cost,
      energy: state.resources.energy
    }));
    return false;
  }

  state.resources.energy -= cost;
  if (!state.round.abilityTiers || typeof state.round.abilityTiers !== "object") {
    state.round.abilityTiers = {};
  }
  state.round.abilityTiers[abilityId] = nextTier;

  // Ready, not cooling, for the same reason a bought ability is: the Energy was the cost, and
  // an upgrade that cannot be used for another twenty-four beats reads as a punishment.
  state.abilities[abilityId] = { cooldownRemaining: 0 };

  addLog(state, template(t.abilityUpgraded, {
    ability: abilityName(state, abilityId),
    tier: nextTier + 1,
    cost
  }));
  return true;
}

/* ---------- Unlocks ---------- */

// Per ability, not one flat price: the kit is a ladder now (5 / 10 / 20), and which rung a
// round can afford is the round's first real decision.
function abilityUnlockCost(state, abilityId) {
  const record = ABILITIES[abilityId];
  if (!record) return Infinity;
  return Number.isFinite(record.unlockCost) ? record.unlockCost : Infinity;
}

// Buying an ability with Energy. Mid-round by nature now: Energy is earned by killing
// invaders and dies with the round, so the fight it came from is the only fight it can pay
// for - and a round that has ended is no longer that fight. The bar stays on screen between
// rounds because it is the spirit's kit and not a control panel, so the refusal has to live
// here: startRound wipes the Energy and every unlock made with it, and a purchase in the shop
// would be a button that spends a currency for nothing.
function unlockAbility(state, abilityId) {
  const t = locale(state);
  if (!ABILITIES[abilityId]) return false;
  if (!spiritAbilityIds(state).includes(abilityId)) return false;
  if (abilityIsUnlocked(state, abilityId)) return false;
  if (state.round.status !== "running") return false;

  const cost = abilityUnlockCost(state, abilityId);
  if (state.resources.energy < cost) {
    addLog(state, template(t.abilityUnlockTooExpensive, {
      ability: abilityName(state, abilityId),
      cost,
      energy: state.resources.energy
    }));
    return false;
  }

  state.resources.energy -= cost;
  if (!Array.isArray(state.round.purchasedAbilityIds)) state.round.purchasedAbilityIds = [];
  state.round.purchasedAbilityIds.push(abilityId);

  // It arrives ready, not cooling: the purchase is the cost, and a bought ability that
  // cannot be used for another twenty-five beats reads as a bug.
  state.abilities[abilityId] = { cooldownRemaining: 0 };

  addLog(state, template(t.abilityUnlocked, { ability: abilityName(state, abilityId), cost }));
  return true;
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

// The round's permanent, shop-bought haste, frozen at setup. Its own function because the Focus
// pill has to read it too: the pill quotes seconds off the drawn clock, and the drawn clock is
// this multiplier applied to the ability's own.
function roundCooldownMult(state) {
  return Number.isFinite(state.round && state.round.abilityCooldownMult)
    ? state.round.abilityCooldownMult
    : 1;
}

// The round's own cooldown baseline, frozen at setup so a shop purchase cannot shorten a
// cooldown that is already ticking. Focus is the one exception - see the Focus section below -
// because it is not a shop purchase against the round's snapshot, it is a live spend against
// the cooldown itself.
function abilityCooldownSeconds(state, abilityId) {
  const record = abilityRecord(state, abilityId);
  if (!record) return 0;
  // The Focus ladder is already whole beats, so only `mult` can put a fraction of a second on
  // this, and it is left unrounded so a permanent cut composes exactly. The bar rounds up.
  return Math.max(1, abilityFocusedCooldownSeconds(state, abilityId) * roundCooldownMult(state));
}

function abilityIsReady(state, abilityId) {
  const slot = state.abilities[abilityId];
  return Boolean(slot) && slot.cooldownRemaining <= 0;
}

/* ---------- Focus: spending Energy mid-round to shorten one ability's cooldown ----------
 *
 * docs/tasks/implementation-microtasks.md#12. Not the same mechanism as `abilityCooldownMult`
 * above: that one is a permanent, Fear/Presence-bought multiplier frozen at round start. This
 * is a live, per-ability purchase made during the round itself, closer in shape to
 * `upgradeAbility` (tier purchases) than to the shop.
 *
 * A purchase takes whole **beats** off the clock - `focusStepBeats` of them, one by default -
 * and the ladder ends at `focusFloorBeats`. Subtraction rather than a percentage, and the
 * reason is what the two do to the shape of the ladder: at a flat -5% a purchase against a
 * price growing 1.5x, value per Energy fell about fortyfold from the first rung to the last
 * and the final affordable one arrived nowhere near the floor, so the tail was decoration.
 * Taking a whole beat off instead makes each rung buy *more* throughput than the one before
 * (a beat off 5 is worth far more than a beat off 12), which is what lets the price go on
 * growing without leaving dead rungs behind it. The floor, not the price tag, ends the ladder.
 *
 * The floor defaults to a third of the ability's own cooldown, so every ability tops out at
 * three times the cast rate it started the round with however long its ladder is. An ability
 * that has had its own balance pass names both numbers itself in the catalogue.
 *
 * **What the round stores is Energy invested, not rungs bought.** The rung count is a reading
 * of that investment against the ladder the ability is standing on right now - the same
 * "replay it, never cache it" rule difficultyLadder follows. It is what makes an Innate tier
 * change lossless: a tier names its own ladder (see ABILITIES.innate_power), and the Energy
 * poured into tier 1's is read against tier 2's the moment tier 2 is bought, covering however
 * many of its rungs it covers and leaving the remainder as a discount on the next one. Nothing
 * is refunded because nothing was ever spent on a rung - it was spent on the ability.
 */
const FOCUS_COST_GROWTH_DEFAULT = 1.5;
const FOCUS_STEP_BEATS_DEFAULT = 1;
const FOCUS_FLOOR_FRACTION = 1 / 3;
// The fallback for an ability with unlockCost 0 - there is no unlock price to anchor the first
// purchase to. `innate_power` is also unlockCost 0 and its tier 1 ladder does open on this
// exact figure, but by naming it per tier rather than by falling through here: its three tiers
// price their ladders apart (3 / 8 / 25), and only the first of them agrees with the fallback.
const FOCUS_BASE_COST_FALLBACK = 3;

function abilityFocusUnlocked(state) {
  return presenceUpgradeOwned(state, "presence_current_quickens");
}

// The round's record of Focus: Energy put into this ability, cumulative, in the currency it was
// paid in. Everything else on this page is derived from it.
function abilityFocusEnergy(state, abilityId) {
  const raw = state.round && state.round.abilityFocusEnergy
    ? state.round.abilityFocusEnergy[abilityId]
    : 0;
  return Math.max(0, Math.floor(Number(raw) || 0));
}

// Every figure below reads a record rather than the raw catalogue entry, so a tiered ability
// answers for the tier it is standing at: the Innate's floor moves with its cooldown when tier 2
// is bought rather than staying at whatever tier 1 would have allowed.
function abilityCooldownBeats(record) {
  return record.cooldownSeconds / TIME_SCALE;
}

/* ---------- One ladder, named ----------
 *
 * Every figure below is a reading of one record's ladder: where it starts, how fast it climbs,
 * how long it is, and where its floor sits. They used to be eight functions each re-deriving
 * those four from the record on their own. Naming the ladder once and reading it out is the
 * same rule stated in one place instead of nine - and it is what lets a tiered ability answer
 * for the tier it is standing on without any of them knowing that tiers exist.
 */
function abilityFocusLadder(state, abilityId) {
  const rec = abilityRecord(state, abilityId);
  if (!rec) return null;

  const cdBeats = abilityCooldownBeats(rec);

  const namedStep = Number(rec.focusStepBeats);
  const stepBeats = Number.isFinite(namedStep) && namedStep > 0 ? namedStep : FOCUS_STEP_BEATS_DEFAULT;

  // Rounded up, so a derived floor is never a fraction of a beat. The whole point of the
  // subtractive ladder is that every rung is a beat a player can count.
  const namedFloor = Number(rec.focusFloorBeats);
  const floorBeats = Number.isFinite(namedFloor) && namedFloor > 0
    ? namedFloor
    : Math.ceil(cdBeats * FOCUS_FLOOR_FRACTION);

  // Where a ladder starts. The unlock price is the default anchor - what an ability costs to
  // have is a fair reading of what it is worth hastening - but it is only a default, and every
  // ability in the game has had its own balance pass and names one with `focusBaseCost`.
  //
  // What that anchor is, read off the tuned ladders: what the *cast* is worth, over the clock
  // it sits on - `worth * 100 / cooldownBeats`, so the cooldown enters only as a divisor. It is
  // why wash_away opens at 6 and the Innate's tier 3 at 25 despite the Wash being the bigger
  // cast: the ladder prices a beat, and a beat off 30 is worth less than a beat off 22. Cards
  // carry no unlockCost at all - the Presence was the cost - and follow the same rule.
  const namedAnchor = Number(rec.focusBaseCost);
  const anchor = Number.isFinite(namedAnchor) && namedAnchor > 0
    ? namedAnchor
    : (isPowerCard(abilityId) ? 0 : abilityUnlockCost(state, abilityId)) || FOCUS_BASE_COST_FALLBACK;

  // And how fast it climbs. Per ability - and per tier, since a tier names its own record -
  // because ladder lengths are: 1.5 a rung is right for the Boon's eight, and would put the
  // Floods' sixteenth rung at 2189 Energy and the Wash's twentieth past 9000, a tail no round
  // ever reaches, which is the failure the whole subtractive rework was meant to end.
  const namedGrowth = Number(rec.focusCostGrowth);
  const growth = Number.isFinite(namedGrowth) && namedGrowth > 1 ? namedGrowth : FOCUS_COST_GROWTH_DEFAULT;

  return {
    record: rec,
    cdBeats,
    stepBeats,
    floorBeats,
    anchor,
    growth,
    // How long the ladder is, which is the same question as "when does the bar stop quoting
    // a price" - see abilityFocusCost below.
    maxRungs: Math.max(0, Math.floor((cdBeats - floorBeats) / stepBeats))
  };
}

// What standing at `rungs` rungs of a ladder costs, all told. The sum of the rounded rung
// prices rather than a closed form over the unrounded ones, because these are the prices the
// bar actually quoted: pay each in turn and the running total lands here exactly, which is
// what keeps "Energy invested" and "rungs bought" two readings of one number rather than two
// numbers that can drift apart.
function focusLadderTotal(ladder, rungs) {
  let total = 0;
  for (let n = 0; n < rungs; n += 1) total += Math.round(ladder.anchor * Math.pow(ladder.growth, n));
  return total;
}

// The rung an investment has climbed to on a ladder. Capped at that ladder's length, so Energy
// carried in from a cheaper tier - or an absurd figure in a doctored save - rests on the floor
// instead of driving the cooldown under it.
function focusLadderRungs(ladder, invested) {
  let bought = 0;
  while (bought < ladder.maxRungs && focusLadderTotal(ladder, bought + 1) <= invested) bought += 1;
  return bought;
}

// And where that leaves the clock, in beats. This is the line the tier payback test reads
// against a ladder its ability is not standing on.
function focusLadderBeats(ladder, invested) {
  return Math.max(ladder.floorBeats, ladder.cdBeats - focusLadderRungs(ladder, invested) * ladder.stepBeats);
}

function abilityFocusStepBeats(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  return ladder ? ladder.stepBeats : FOCUS_STEP_BEATS_DEFAULT;
}

function abilityFocusFloorBeats(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  return ladder ? ladder.floorBeats : 0;
}

function abilityFocusMaxPurchases(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  return ladder ? ladder.maxRungs : 0;
}

// Read through the ladder, not the raw catalogue entry, so a *tier* may name its own anchor
// and be answered for - which is the whole of what "a ladder per tier" asks of this page.
function abilityFocusBaseCost(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  if (ladder) return ladder.anchor;
  return (isPowerCard(abilityId) ? 0 : abilityUnlockCost(state, abilityId)) || FOCUS_BASE_COST_FALLBACK;
}

function abilityFocusCostGrowth(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  return ladder ? ladder.growth : FOCUS_COST_GROWTH_DEFAULT;
}

function abilityFocusLadderTotal(state, abilityId, rungs) {
  const ladder = abilityFocusLadder(state, abilityId);
  if (ladder) return focusLadderTotal(ladder, rungs);
  // No record at all: the anchor and the growth still answer off their fallbacks, so the sum
  // is the same one this gave before the ladder was named.
  return focusLadderTotal({
    anchor: abilityFocusBaseCost(state, abilityId),
    growth: abilityFocusCostGrowth(state, abilityId)
  }, rungs);
}

// The rung the round's investment has climbed to on the ladder standing in front of it now.
function abilityFocusPurchases(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  return ladder ? focusLadderRungs(ladder, abilityFocusEnergy(state, abilityId)) : 0;
}

// Replayed from the invested Energy rather than stored as its own field, so the cooldown and
// the spend that produced it can never disagree - the same reason difficultyLadder reads
// wavesResolved live instead of caching a rung. Seconds, and before `abilityCooldownMult`:
// this is the ability's own clock, not the round's.
function abilityFocusedCooldownSeconds(state, abilityId) {
  const ladder = abilityFocusLadder(state, abilityId);
  if (!ladder) return 0;
  return focusLadderBeats(ladder, abilityFocusEnergy(state, abilityId)) * TIME_SCALE;
}

// What the next rung takes off the countdown the player is watching, in the seconds that
// countdown is drawn in. Not simply `focusStepBeats * TIME_SCALE`: the bar draws the ability's
// clock *after* the round's permanent haste, so with `abilityCooldownMult` bought a rung that
// buys one whole beat still shows as less than a whole beat's worth of seconds. Quoting the
// beats would promise the player a drop they do not see, so this quotes the drop instead - the
// same two clamped readings the bar itself takes, subtracted.
//
// Zero at the floor, where there is no next rung to price.
function abilityFocusSecondsPerStep(state, abilityId) {
  if (!abilityRecord(state, abilityId)) return 0;
  const mult = roundCooldownMult(state);
  const now = abilityFocusedCooldownSeconds(state, abilityId);
  const floor = abilityFocusFloorBeats(state, abilityId) * TIME_SCALE;
  const next = Math.max(floor, now - abilityFocusStepBeats(state, abilityId) * TIME_SCALE);
  return Math.max(0, Math.max(1, now * mult) - Math.max(1, next * mult));
}

// What the next rung costs *from here*: the rest of the way up to it, not its sticker price. On
// a ladder climbed rung by rung the two are the same figure, because the running total lands
// exactly on every rung. They part company only where the investment was made against a
// different ladder - which is precisely where it should be credited rather than charged twice.
//
// Infinity once the floor is reached, the same refusal shape as abilityUpgradeCost at the top
// of a tier ladder.
function abilityFocusCost(state, abilityId) {
  if (!abilityRecord(state, abilityId)) return Infinity;
  const bought = abilityFocusPurchases(state, abilityId);
  if (bought >= abilityFocusMaxPurchases(state, abilityId)) return Infinity;
  return abilityFocusLadderTotal(state, abilityId, bought + 1) - abilityFocusEnergy(state, abilityId);
}

function purchaseAbilityFocus(state, abilityId) {
  const t = locale(state);
  if (!abilityFocusUnlocked(state)) return false;
  if (!abilityIsUnlocked(state, abilityId)) return false;
  if (state.round.status !== "running") return false;

  const cost = abilityFocusCost(state, abilityId);
  if (!Number.isFinite(cost)) return false;
  if (state.resources.energy < cost) {
    addLog(state, template(t.abilityFocusTooExpensive, {
      ability: abilityName(state, abilityId),
      cost,
      energy: state.resources.energy
    }));
    return false;
  }

  // Read before the investment is written, or it prices the rung *after* this one - and at the
  // last rung it would read zero, on the one purchase that actually lands on the floor. Drawn
  // through the speed dial like the pill that quoted it, so the line says what the player just
  // watched happen rather than what the engine holds the clock in.
  const step = dialSecondsText(state, abilityFocusSecondsPerStep(state, abilityId));

  state.resources.energy -= cost;
  if (!state.round.abilityFocusEnergy || typeof state.round.abilityFocusEnergy !== "object") {
    state.round.abilityFocusEnergy = {};
  }
  state.round.abilityFocusEnergy[abilityId] = abilityFocusEnergy(state, abilityId) + cost;

  // Clamped down, not left to overshoot: an ability already mid-cooldown when this is bought
  // would otherwise sit above the new, shorter maximum until the next cast, which is a
  // purchase that visibly does nothing for as long as a whole cooldown.
  const slot = state.abilities[abilityId];
  if (slot) {
    slot.cooldownRemaining = Math.min(slot.cooldownRemaining, abilityCooldownSeconds(state, abilityId));
  }

  addLog(state, template(t.abilityFocused, {
    ability: abilityName(state, abilityId),
    cost,
    seconds: step,
    cooldown: dialSecondsText(state, abilityCooldownSeconds(state, abilityId))
  }));
  return true;
}

function tickCooldowns(state, dt) {
  for (const abilityId of Object.keys(state.abilities)) {
    const slot = state.abilities[abilityId];
    if (slot.cooldownRemaining > 0) slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
  }
}

function invaderCountInLand(slot) {
  if (!slot) return 0;
  return Math.max(0, slot.explorers || 0) + Math.max(0, slot.towns || 0) + Math.max(0, slot.cities || 0);
}

// A land is a legal click for the armed ability. Kept as one function so the board's
// highlight and the click handler can never disagree about what is legal.
function abilityLegalLand(state, abilityId, landId) {
  if (!isLandId(landId)) return false;
  const record = abilityRecord(state, abilityId);
  if (!record || !record.needsTarget) return false;

  // A card names its own targeting rule - see cardLegalLand, which is where all six of them
  // are written out. Everything below is the kit's.
  if (isPowerCard(abilityId)) return cardLegalLand(state, abilityId, landId);

  // A push needs something the water can carry: an Explorer or a Town, never a City. Where it
  // goes is never in doubt any more - open ground, an occupied neighbour, or the sea - so this
  // no longer reads a second land the way it used to. Everything else only needs invaders
  // present, including the Innate's second tier, whose damage stands on its own if the push
  // finds nothing to move (see applyDamageAndPush).
  if (record.effect === "push_invaders" || record.effect === "wash_invaders") {
    return pushableCount(state, landId) > 0;
  }

  return invaderCountInLand(state.invaders[landId]) > 0;
}

function abilityLegalLands(state, abilityId) {
  return LAND_IDS.filter((landId) => abilityLegalLand(state, abilityId, landId));
}

/* ---------- Pushing ----------
 *
 * Cities are never pushed: they are built into the land, and a spirit of rivers moves what
 * the water can carry.
 */

// Towns before explorers. A town is worth two of an explorer everywhere else in the engine,
// so a push with a budget smaller than the land should spend it on the heavier thing.
const PUSH_ORDER = ["towns", "explorers"];

function pushableCount(state, landId) {
  const slot = state.invaders[landId];
  if (!slot) return 0;
  return Math.max(0, slot.towns || 0) + Math.max(0, slot.explorers || 0);
}

/* ---------- Where a push lands ----------
 *
 * One ranked question asked of every neighbour rather than a chain of filters, because the
 * terms genuinely disagree with each other and the order they disagree in is the design. Each
 * key below returns a cost that sorts ascending, and the pool is narrowed key by key, so a
 * later term only ever breaks a tie the earlier ones left standing.
 */

// What the next Build phase would raise in this land, or null when it would raise nothing.
// `counts` lets a caller ask the question about a land it has not actually changed yet.
//
// This is resolveBuildPhase's own rule and nothing else: Build skips a land holding no
// invaders, and otherwise reads that land's own counts to choose between a Town and a City.
// Kept as one function so a push can ask what it is about to cause without the two drifting.
function landBuildsNext(state, landId, counts) {
  if (!buildTerrains(state).includes(landTerrain(landId))) return null;
  const slot = counts || state.invaders[landId];
  if (invaderCountInLand(slot) <= 0) return null;
  return (slot.towns || 0) > (slot.cities || 0) ? "cities" : "towns";
}

// Nothing < a Town < a City, so two Build outcomes can be compared rather than merely told
// apart.
function buildSeverity(built) {
  return built === "cities" ? 2 : built === "towns" ? 1 : 0;
}

// The unit a push out of this land would actually carry - towns before explorers, the order
// applyPushFrom spends its budget in. A rung that wants to know what its push costs has to
// know what its push moves.
function nextPushedType(state, landId) {
  const slot = state.invaders[landId];
  if (!slot) return null;
  return PUSH_ORDER.find((type) => (slot[type] || 0) > 0) || null;
}

// Would landing a unit here hand the next Build something worse than it was already going to
// get? Three cases, and all three fall out of asking landBuildsNext twice rather than being
// spelled out by hand:
//
//   - an empty Build-terrain land is skipped by Build until something stands in it, so a push
//     into one *creates* a target that did not exist;
//   - a land holding Explorers alone builds a Town, but one holding a Town builds a City, so
//     carrying a Town onto Explorers upgrades what arrives next wave;
//   - carrying an Explorer onto Explorers changes nothing, which is what makes stacking onto
//     Explorers safe at all.
//
// It reads the Build slot only. The Discover slot becomes Build one wave later (see
// shiftInvaderTrack), but a push made now is answering the wave that is actually coming.
function pushWorsensBuild(state, from, to) {
  const type = nextPushedType(state, from);
  if (!type) return false;
  const slot = state.invaders[to];
  const after = Object.assign({}, slot);
  after[type] = (slot[type] || 0) + 1;
  return buildSeverity(landBuildsNext(state, to, after)) > buildSeverity(landBuildsNext(state, to));
}

// Cover as a single rank: Dahan and a ward together beat Dahan alone, which beat a ward alone,
// which beats bare ground. Dahan outrank a ward because Dahan kill what arrives while a ward
// only absorbs it, and holding both is strictly better than holding either.
function pushCoverRank(state, landId) {
  return ((state.dahan[landId] || 0) > 0 ? 2 : 0) + (defenseInLand(state, landId) > 0 ? 1 : 0);
}

// The ranking, most important first. Every key is written as a cost so they all sort the same
// way.
const PUSH_PREFERENCE_KEYS = [
  // Cover first - landing a unit in front of a defender is the point of pushing at all, and it
  // is the promise the board makes to a player planning a push.
  (state, from, to) => -pushCoverRank(state, to),
  // Then how much cover. A big stack kills what arrives and can afford the losses the arrival
  // causes; a lone Dahan can do neither. The loss rate is flat regardless of stack size (see
  // landPressure), so the bigger stack is strictly the better landing.
  (state, from, to) => -(state.dahan[to] || 0),
  // Then, among destinations the cover terms could not separate, do not feed the next Build.
  //
  // Deliberately below cover rather than above it. Ranking it first would make where the water
  // runs depend on the Build track, and a push is meant to be plannable off the board alone -
  // so this only ever chooses between landings that were already equally good. That is enough
  // to close the trap it exists for: the undefended-open-ground case, where every candidate
  // ties at zero cover and the old rule happily picked the empty Build-terrain land.
  (state, from, to) => (pushWorsensBuild(state, from, to) ? 1 : 0),
  // Open ground before an occupied neighbour - but below the terms above, rather than absolute
  // the way it used to be. A land already holding Explorers can be the better destination, and
  // treating openness as a hard gate is what left the positional rungs silent on a full island.
  (state, from, to) => (invaderCountInLand(state.invaders[to]) <= 0 ? 0 : 1),
  // Last, the water's own preference: toward the ocean edge, which is also the harder ground
  // for the invaders to build back into. It ranks under the Dahan count now - a lone Dahan on
  // the coast is not worth passing up a real stack inland for.
  (state, from, to) => (landIsCoastal(to) ? 0 : 1)
];

// The candidates that survive every term above. Several can tie - two equally defended coastal
// neighbours are genuinely the same choice - so this stays a set and pushDestination settles
// the rest.
function preferredPushLands(state, landId, candidates) {
  let pool = candidates.slice();
  for (const key of PUSH_PREFERENCE_KEYS) {
    if (pool.length <= 1) break;
    const costs = pool.map((other) => key(state, landId, other));
    const best = Math.min.apply(null, costs);
    pool = pool.filter((other, i) => costs[i] === best);
  }
  return pool;
}

// Where a push can land. Every neighbour is a candidate: what used to be an absolute
// preference for open ground is now one term in the ranking above.
//
// The occupied fallback is what the board game has always allowed and what this engine used to
// refuse. Refusing it made the push the one effect that stopped working as the round went on:
// a full island is exactly when the pressure most needs moving, and exactly when every
// neighbour was disqualified.
//
// Every land on this board has at least two neighbours, so this never comes back empty.
function pushDestinations(state, landId) {
  return preferredPushLands(state, landId, adjacentLands(landId));
}

// Is there open ground next to this land - somewhere a push can go without stacking onto
// invaders that are already standing there?
function pushHasOpenGround(state, landId) {
  return adjacentLands(landId).some((other) => invaderCountInLand(state.invaders[other]) <= 0);
}

// Somewhere a push for *position* can go without making the board worse: open ground, or a
// land holding nothing but Explorers, and in neither case one where the arrival would upgrade
// what the next Build raises.
//
// This is what the auto-casts that push for position ask for, and it is deliberately weaker
// than "open ground". Stacking onto Explorers is safe in a way stacking onto a Town is not:
// Build reads a land's own counts, so another Explorer on a pile of Explorers still builds a
// Town, while a Town landing beside one is what turns the next Build into a City. Refusing
// every stack meant the positional rungs went silent on a full island - which is the exact
// moment the pressure most needs moving.
function pushStacksSafely(state, landId) {
  const destination = pushDestination(state, landId);
  if (!destination) return false;
  const slot = state.invaders[destination];
  return (slot.towns || 0) <= 0 && (slot.cities || 0) <= 0;
}

// The stacking rule and the Build rule together. Split from pushStacksSafely because a rung
// that has already established the arrival *dies* has no reason to ask the second question:
// what the next Build would have raised on top of a unit that will not be standing there is
// not a cost the push is paying. Rungs that only improve a unit's position ask for both.
function pushLandsSafely(state, landId) {
  if (!pushStacksSafely(state, landId)) return false;
  return !pushWorsensBuild(state, landId, pushDestination(state, landId));
}

// The stricter question: does this push land on ground holding no invaders at all? Wash Away
// asks this rather than pushLandsSafely, and deliberately keeps the harder rule - it moves a
// whole land at once, so a stack it concentrates is a much bigger one than the Innate's single
// unit, and refusing outright is still the right trade there.
//
// It replaces a `pushHasOpenGround` test that meant the same thing only while open ground beat
// every other destination outright. Now that cover outranks openness (see PUSH_PREFERENCE_KEYS)
// a land can have open ground next to it and still push somewhere occupied, so the question has
// to be asked of the destination itself.
function pushLandsOnOpenGround(state, landId) {
  const destination = pushDestination(state, landId);
  return Boolean(destination) && invaderCountInLand(state.invaders[destination]) <= 0;
}

// The lowest land id among those, like every other tie on this board. The water always runs
// the same way, so a player can plan a push instead of gambling on it.
function pushDestination(state, landId) {
  const choices = pushDestinations(state, landId);
  if (choices.length === 0) return null;
  return choices.slice().sort((a, b) => Number(a) - Number(b))[0];
}

// Moves up to `maxCount` explorers and towns into one adjacent empty land, carrying each
// unit's own damage with it. Returns null - so the caller can leave the cooldown unspent -
// when there is nothing to move or nowhere to move it.
// `types` narrows what moves - `push_all { unitType: "explorers" }` on a card asks for the
// Explorers alone and leaves the Towns standing. It is filtered against PUSH_ORDER rather
// than trusted, so no caller can talk this into carrying a City.
function applyPushFrom(state, landId, maxCount, types) {
  const destination = pushDestination(state, landId);
  if (!destination) return null;

  const order = Array.isArray(types) ? PUSH_ORDER.filter((type) => types.includes(type)) : PUSH_ORDER;
  // Infinity is a legal budget here - a card that pushes all of something has no count cap -
  // so this floors only a real number and leaves the unbounded case alone.
  let budget = maxCount === Infinity ? Infinity : Math.max(0, Math.floor(maxCount || 0));
  let moved = 0;

  for (const type of order) {
    while (budget > 0 && (state.invaders[landId][type] || 0) > 0) {
      // The most wounded unit of its type leaves first, and its wound travels with it. Under
      // the old per-type model this was an approximation; per-unit health makes it exact.
      const carried = state.invaderDamage[landId][type].shift() || 0;
      state.invaders[landId][type] -= 1;
      state.invaders[destination][type] += 1;
      state.invaderDamage[destination][type].push(carried);
      budget -= 1;
      moved += 1;
    }
  }

  if (moved <= 0) return null;

  // Restores the sorted-and-sized invariant at both ends in one pass.
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);
  return { destination, moved };
}

/* ---------- Effects ---------- */

// `quiet` is the auto-cast path: the same effect, without the log line. A click the player
// made is worth a line; one the shop makes for them every twelve beats would bury the log.
function applyBoonOfVigor(state, record, quiet) {
  const amount = Math.max(0, Math.floor(record.amount || 0));
  if (amount <= 0) return false;
  state.resources.energy += amount;
  if (!quiet) addLog(state, template(locale(state).boonResolved, { amount }));
  return true;
}

function applyPushAbility(state, abilityId, record, landId, quiet) {
  const pushed = applyPushFrom(state, landId, record.pushCount);
  if (!pushed) return false;

  if (!quiet) {
    addLog(state, template(locale(state).pushResolved, {
      ability: abilityName(state, abilityId),
      total: pushed.moved,
      from: landName(state, landId),
      to: landName(state, pushed.destination)
    }));
  }
  return true;
}

/* ---------- The sea ----------
 *
 * Wash Away's own destination, and the only removal in the kit that is not damage. A coastal
 * land borders the ocean, the ocean is not a land, and what the water carries off one is gone
 * from the island rather than standing somewhere else.
 *
 * Removal ignores health entirely, which is the whole point of it: 2 damage buys less at every
 * rung of the invader health ladder, and a drowning buys the same thing on the fortieth wave
 * as it did on the first. It still cannot touch a City - a City is built into the land, the
 * same rule that keeps one from being pushed - so the abilities that answer Cities keep their
 * job.
 *
 * A drowning pays Fear and Energy exactly as a defeat does, because it is one: creditDefeat is
 * the same function the damage path calls.
 */
function applyWashToSea(state, landId, maxCount) {
  const result = { defeated: emptyDefeatTally(), totalDefeated: 0, spent: 0 };
  let budget = Math.max(0, Math.floor(maxCount || 0));

  for (const type of PUSH_ORDER) {
    while (budget > 0 && (state.invaders[landId][type] || 0) > 0) {
      // The healthiest unit of its type goes first. The wound arrays are sorted worst-off
      // first, so that is the last index. A drowning does not care how hurt a unit was, so
      // spending it on the one that would have been hardest to kill is what makes it worth
      // more than the damage it replaces - and it leaves the wounded standing for the rest of
      // the kit to finish.
      const wounds = state.invaderDamage[landId][type];
      removeInvaderUnit(state, landId, type, Math.max(0, wounds.length - 1));
      creditDefeat(state, result, type);
      budget -= 1;
    }
  }

  if (result.totalDefeated <= 0) return null;

  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);
  return result;
}

// Wash Away, whole: the sea from a coastal land, a shove into the next land over from anywhere
// else. One rule, no prompt - the water runs downhill, and on this board downhill means the
// ocean whenever the ocean is there.
//
// Three of the eight lands are coastal, so which of the two halves a cast gets is a question
// about position rather than about luck, and the rest of the kit already answers it: the
// Innate's push and pushDestinations' own coastal preference both walk stacks toward the water.
function applyWashAway(state, abilityId, record, landId, quiet) {
  if (!landIsCoastal(landId)) return applyPushAbility(state, abilityId, record, landId, quiet);

  const drowned = applyWashToSea(state, landId, record.seaCount);
  if (!drowned) return false;

  markDefeatFxFromResult(state, landId, drowned);

  if (!quiet) {
    addLog(state, template(locale(state).seaResolved, {
      ability: abilityName(state, abilityId),
      total: drowned.totalDefeated,
      land: landName(state, landId)
    }));
  }
  return true;
}

// One land, one pool of damage, spent by the kill-first rule in applyDamage. Every targeted
// damage ability lands here, so "what does damage do" is one paragraph of the engine rather
// than one per ability.
function resolveDamageAbility(state, abilityId, landId, damage, quiet) {
  if (invaderCountInLand(state.invaders[landId]) <= 0) return null;

  const result = applyDamage(state, landId, damage);
  markDefeatFxFromResult(state, landId, result);

  if (!quiet) {
    addLog(state, template(locale(state).damageResolved, {
      ability: abilityName(state, abilityId),
      land: landName(state, landId),
      damage,
      defeated: result.totalDefeated
    }));
  }
  return result;
}

// A coastal land is where the flood has water to work with, so it takes the extra point.
function flashFloodsDamage(record, landId) {
  return record.damage + (landIsCoastal(landId) ? record.coastalBonus : 0);
}

// The Innate at tier 2: damage, then push what survived.
//
// The two halves are independent. If the damage cleared the land, or every neighbour is
// occupied so there is nowhere to push to, the cast still counts - refusing at that point
// would rewind damage that has already been dealt and paid Fear for.
function applyDamageAndPush(state, abilityId, record, landId, quiet) {
  const damaged = resolveDamageAbility(state, abilityId, landId, record.damage, quiet);
  const pushed = applyPushFrom(state, landId, record.pushCount);

  if (pushed && !quiet) {
    addLog(state, template(locale(state).pushResolved, {
      ability: abilityName(state, abilityId),
      total: pushed.moved,
      from: landName(state, landId),
      to: landName(state, pushed.destination)
    }));
  }

  return Boolean(damaged) || Boolean(pushed);
}

// The Innate at tier 3: every invader in the land takes the hit individually, which is the
// one effect the old per-type damage model could not express at all.
function applyDamageEachInvader(state, abilityId, record, landId, quiet) {
  if (invaderCountInLand(state.invaders[landId]) <= 0) return false;

  const result = applyDamageToEachInvader(state, landId, record.damage);
  markDefeatFxFromResult(state, landId, result);

  if (!quiet) {
    addLog(state, template(locale(state).damageEachResolved, {
      ability: abilityName(state, abilityId),
      land: landName(state, landId),
      damage: record.damage,
      defeated: result.totalDefeated
    }));
  }
  return true;
}

// The land River's Bounty pours into: the thinnest-held land that is actually under attack.
// Fewest Dahan among the lands holding invaders, ties on the lowest land id.
//
// A fight is preferred, but no longer required. With no invaders anywhere the ability still
// resolves, into the thinnest land on the board - a quiet island is the moment to build the
// Dahan up for the wave that follows, and refusing there only punished the player for having
// cleared the map.
function riversBountyLand(state) {
  return thinnestDahanLand(state, true) || thinnestDahanLand(state, false);
}

function thinnestDahanLand(state, contestedOnly) {
  let best = null;
  for (const landId of LAND_IDS) {
    if (contestedOnly && invaderCountInLand(state.invaders[landId]) <= 0) continue;
    const dahan = Math.max(0, state.dahan[landId] || 0);
    if (!best || dahan < best.dahan) best = { landId, dahan };
  }
  return best ? best.landId : null;
}

// Reinforcement out of nothing rather than a gather: the Dahan that arrives is one the
// island did not have, so the ability adds pressure relief instead of moving it around.
// There is always a thinnest land, so this one never fails.
function applyRiversBounty(state, record, quiet) {
  const landId = riversBountyLand(state);
  if (!landId) return false;

  const amount = Math.max(0, Math.floor(record.amount || 0));
  if (amount <= 0) return false;

  state.dahan[landId] = (state.dahan[landId] || 0) + amount;

  // Silent on the auto-cast path, like every other automated ability: this one never fails
  // and fires all round, so logging it would be a line every cooldown and nothing else.
  if (!quiet) {
    addLog(state, template(locale(state).riversBountyResolved, {
      amount,
      land: landName(state, landId),
      total: state.dahan[landId]
    }));
  }
  return true;
}

// Runs an ability's effect. Returns false when the effect found nothing to act on, which
// is what leaves the cooldown unspent (09 "Failure to find a target"). `quiet` is the
// auto-cast path: the same effect, without the log line - see applyBoonOfVigor.
function applyAbilityEffect(state, abilityId, landId, quiet) {
  const record = abilityRecord(state, abilityId);
  if (!record) return false;

  // A card has a step list where an ability has one `effect` string, so it forks here and
  // nowhere else. Everything either side of this call - the cooldown, the arming, the land
  // click, the log - is the same code for both.
  if (isPowerCard(abilityId)) return applyCardEffect(state, abilityId, landId, quiet);

  switch (record.effect) {
    case "gain_energy":
      return applyBoonOfVigor(state, record, quiet);
    case "add_dahan":
      return applyRiversBounty(state, record, quiet);
    case "push_invaders":
      return applyPushAbility(state, abilityId, record, landId, quiet);
    case "wash_invaders":
      return applyWashAway(state, abilityId, record, landId, quiet);
    case "flood_damage":
      return Boolean(resolveDamageAbility(state, abilityId, landId, flashFloodsDamage(record, landId), quiet));
    case "damage_and_push":
      return applyDamageAndPush(state, abilityId, record, landId, quiet);
    case "damage_each_invader":
      return applyDamageEachInvader(state, abilityId, record, landId, quiet);
    default:
      return false;
  }
}

function startCooldown(state, abilityId) {
  state.abilities[abilityId].cooldownRemaining = abilityCooldownSeconds(state, abilityId);
  // Casting a card is accepting it. Here rather than in either cast path, because this is the
  // one line both of them reach and only ever after the effect actually landed - which is what
  // makes it true that there is no order of clicks that casts a card and then swaps it.
  acceptPowerCard(state, abilityId);
}

/* ---------- Auto-buy: the round's Energy spends itself ----------
 *
 * The one automation that spends a currency rather than a cooldown. Every other one buys back
 * a cast; this buys back the two purchases the ability bar asks for - unlocking a locked
 * ability and raising the Innate's tier - which by the time it is affordable a player is
 * making in the same order every round anyway.
 *
 * Unlocks first and tiers after, which is not kit order and not price order across the whole
 * bar. Two reasons, and they point the same way: an unlock is the cheaper claim on the Energy
 * (5 / 10 / 20 against the Innate's 40 / 150), and it is what the three cast automations are
 * waiting on - each of them sits idle all round on an ability that was never bought. Saving
 * toward a tier while Wash Away stays locked is the one order no player actually plays.
 *
 * It goes through unlockAbility and upgradeAbility rather than writing the state itself, so an
 * automated purchase and a clicked one are the same purchase: same refusals, same round-local
 * bookkeeping, same log line. Nothing here can overspend, because each call re-reads the purse
 * the one before it left behind.
 */
function resolveAutoBuyAbilities(state) {
  if (activeUpgradeTier(state, "auto_buy_abilities") <= 0) return;

  // Cheapest first within the unlocks, so a round holding 15 Energy takes the 5 and the 10
  // rather than stalling in kit order on a 20 it cannot afford yet.
  const locked = lockedAbilityIds(state)
    .slice()
    .sort((a, b) => abilityUnlockCost(state, a) - abilityUnlockCost(state, b));
  for (const abilityId of locked) {
    if (state.resources.energy < abilityUnlockCost(state, abilityId)) continue;
    unlockAbility(state, abilityId);
  }

  // One rung per ability per tick. A tier is dear enough that no round buys two in the same
  // beat, and stepping rather than climbing keeps this from emptying a purse the unlocks above
  // may want on the very next tick.
  for (const abilityId of unlockedAbilityIds(state)) {
    if (!abilityIsTiered(abilityId)) continue;
    const cost = abilityUpgradeCost(state, abilityId);
    if (!Number.isFinite(cost) || state.resources.energy < cost) continue;
    upgradeAbility(state, abilityId);
  }
}

/* ---------- Auto-cast: owned, and switched on ----------
 *
 * The same two-question split the round gate already makes (see autoStartRoundOwned below):
 * the upgrade is permanent and the toggle is a preference. Buying an automation used to be a
 * one-way door - the resolver runs inside tick before the fight and fires the instant the
 * cooldown clears, so the card never spends a frame in a state a player could click, and 400
 * Fear permanently removed an ability from active play.
 */

// The five ability automations, by the ability each one casts. It is the only place the two
// id spaces are tied together: the resolvers below are keyed by upgrade, the ability bar is
// keyed by ability, and one map beats a second copy of the pairing in ui.js.
const AUTO_CAST_UPGRADES = {
  boon_of_vigor: "auto_boon",
  rivers_bounty: "auto_bounty",
  innate_power: "auto_innate",
  wash_away: "auto_wash_away",
  flash_floods: "auto_flash_floods"
};

// Whether the player owns this ability's automation - which is what decides whether the card
// draws an auto-cast switch at all. Read off what is owned rather than off the round's
// snapshot: the purchase is permanent, so the control it comes with never disappears again.
function autoCastOwned(state, abilityId) {
  const upgradeId = AUTO_CAST_UPGRADES[abilityId];
  return Boolean(upgradeId) && upgradeTier(state, upgradeId) > 0;
}

// Whether it should actually cast this tick. Ownership through the round's snapshot, so a
// mid-round purchase still waits for the next round; the toggle live, so unticking it stops
// the next cast rather than the next round's casts.
//
// `!== false` rather than `=== true`: absent means on, which is what makes a save written
// before this feature load with its automations still running.
function autoCastOn(state, abilityId) {
  const upgradeId = AUTO_CAST_UPGRADES[abilityId];
  if (!upgradeId || activeUpgradeTier(state, upgradeId) <= 0) return false;
  return state.ui.autoCast[abilityId] !== false;
}

// Unticking stops future casts and nothing else: no cooldown is reset, shortened or
// lengthened, no cast is undone, nothing is refunded, and the upgrade is never un-bought.
function setAutoCast(state, abilityId, on) {
  if (!AUTO_CAST_UPGRADES[abilityId]) return false;
  state.ui.autoCast[abilityId] = on === true;
  return state.ui.autoCast[abilityId];
}

// The Boon fires itself once `auto_boon` is bought. It goes straight to the effect rather
// than through triggerAbility: there is no target to arm, no refusal to report, and nothing
// here should ever surface as a message. The cooldown is the same one a click would spend,
// so owning it changes who presses the button and not how often it can be pressed.
function resolveAutoBoon(state) {
  if (!autoCastOn(state, "boon_of_vigor")) return;
  if (!abilityIsUnlocked(state, "boon_of_vigor")) return;
  if (!abilityIsReady(state, "boon_of_vigor")) return;

  const record = abilityRecord(state, "boon_of_vigor");
  if (!record || !applyBoonOfVigor(state, record, true)) return;
  startCooldown(state, "boon_of_vigor");
}

/* ---------- Auto-cast: the Innate's own judgement ----------
 *
 * `auto_innate` is not just buying back a click the way `auto_boon` is - the Innate always
 * needs a target, so automating it means picking one. Each tier gets the ranked list of
 * reasons to cast that were agreed on with the player: the highest-priority reason that
 * currently applies picks the land, and if nothing on the list applies the ability sits idle
 * rather than firing on a land that did not need it. A tick that finds nothing to do costs
 * nothing - the cooldown is only ever spent on a cast that would have been worth making by
 * hand.
 *
 * Two rungs are shared by all three tiers and sit at the top of every list, because they are
 * the only two that stop invaders *arriving* rather than rearranging ones already ashore:
 * denying a Discover its foothold, and breaking a Build. Both are asked by simulation rather
 * than by hand-written conditions, so the three tiers ask the same question and only their
 * answers - a push, a push behind damage, an area hit - differ.
 *
 * Within a rung the tie-break is the land bleeding the most Blight, never the lowest id. The
 * id order is arbitrary; where the island is actually hurting is not.
 */

// The lowest id among a set of candidate lands - the same tie-break every other choice on this
// board uses. Still what Wash Away ranks by; the Innate now ranks by Blight instead.
function lowestLandId(landIds) {
  return landIds.slice().sort((a, b) => Number(a) - Number(b))[0];
}

// Among lands already holding some Dahan, the one with the fewest - the stack closest to
// losing its last defender, since the loss rate is flat regardless of stack size (see
// landPressure). Ties go to the lowest land id.
function thinnestDefendedLand(state, landIds) {
  return landIds.slice().sort((a, b) => {
    const diff = (state.dahan[a] || 0) - (state.dahan[b] || 0);
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// The steepest live Blight source among a set of lands. This is the Innate's tie-break
// everywhere, replacing the lowest-id one: three lands can all satisfy a rung, and the id that
// happens to be smallest says nothing about which of them is costing the round.
function worstBlightAmong(state, landIds) {
  if (landIds.length === 0) return null;
  return landIds.slice().sort((a, b) => {
    const diff = landPressure(state, b).blightPerSecond - landPressure(state, a).blightPerSecond;
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// The steepest live Blight source on the board, or null when nothing is bleeding.
function worstBlightLand(state) {
  return worstBlightAmong(state, LAND_IDS.filter(
    (land) => landPressure(state, land).blightPerSecond > 0
  ));
}

// A throwaway copy of exactly what damage, pushing, and the Dahan strike touch. Lets the
// auto-caster run the real effect against a scratch board and see whether it is worth
// spending the real cooldown on, without ever mutating the state that counts. `ui` is along
// for the ride only because spendDahanAttack writes a defeat fx as a side effect of killing
// something - the scratch board never reads it back.
function cloneCombatState(state) {
  return {
    invaders: JSON.parse(JSON.stringify(state.invaders)),
    invaderDamage: JSON.parse(JSON.stringify(state.invaderDamage)),
    dahan: JSON.parse(JSON.stringify(state.dahan)),
    // The invader track rides along because a push now reads it: pushWorsensBuild asks what
    // the next Build would raise in a candidate destination, and a scratch board without the
    // track would quietly route its simulated push somewhere the real one would refuse.
    invader: state.invader,
    meta: { fear: 0 },
    resources: { energy: 0 },
    // `wavesResolved` carries because unit stats are read off it (see unitStats). A scratch
    // board without it would fight wave-1 invaders on a wave-100 island and tell the
    // auto-caster a land clears when it does not.
    round: {
      fearEarned: 0,
      fearEarnedBase: 0,
      wavesResolved: state.round ? state.round.wavesResolved : 0,
      // Wards carry for the same reason the track does - they steer a push (see
      // pushCoverRank) and they cancel pressure outright (see landPressure), so a scratch
      // board without them measures a different island.
      defense: state.round ? state.round.defense : null
    },
    ui: {}
  };
}

// Will this wave's Dahan strike actually land before the next wave does? Both run on their own
// clock (see resolveTick), so "the Dahan would clear this land" is only a reason to leave the
// land alone when the Dahan get there first. Without this check the break-build rungs decline
// a land the Build is about to thicken, on the strength of a strike that arrives afterwards.
function dahanStrikeBeatsWave(state) {
  const strike = state.round ? state.round.dahanAttackRemaining : null;
  const wave = state.round ? state.round.waveTimerRemaining : null;
  if (typeof strike !== "number" || typeof wave !== "number") return true;
  return strike <= wave;
}

// Would this wave's Dahan strike, on its own, clear a land - i.e. is it already safe to leave
// alone? Simulated rather than reasoned about by hand, so it can never drift from what the
// real strike (resolveDahanAttack) actually does.
function landClearsToDahanStrike(state, landId) {
  const dahan = state.dahan[landId] || 0;
  if (dahan <= 0) return false;
  const scratch = cloneCombatState(state);
  spendDahanAttack(scratch, landId, dahan * DAHAN_ATTACK_DAMAGE);
  return invaderCountInLand(scratch.invaders[landId]) <= 0;
}

// The same question, asked of the clock as well as of the board.
function landClearsToDahanStrikeInTime(state, landId) {
  return dahanStrikeBeatsWave(state) && landClearsToDahanStrike(state, landId);
}

// Would `damage` followed by a push of up to `pushCount` empty this land completely?
// Simulated for the same reason - the kill-first order and the push's own destination rule
// are real engine behaviour, not something worth re-deriving by hand.
function landClearsWithDamageAndPush(state, landId, damage, pushCount) {
  const scratch = cloneCombatState(state);
  applyDamage(scratch, landId, damage);
  applyPushFrom(scratch, landId, pushCount);
  return invaderCountInLand(scratch.invaders[landId]) <= 0;
}

// The lands the next Build phase will thicken, or [] when nothing is on the track yet.
function buildThreatLands(state) {
  return landsOfTerrains(buildTerrains(state));
}

/* ---------- The two rungs every tier shares ---------- */

// What a cast of this tier would do to one land, run against a scratch board. One function per
// tier shape, so the rungs below can ask "what if" without knowing which tier is asking.
function innateSimulateCast(state, record, scratch, landId) {
  switch (record.effect) {
    case "push_invaders":
      return Boolean(applyPushFrom(scratch, landId, record.pushCount));
    case "damage_and_push": {
      const damaged = applyDamage(scratch, landId, record.damage);
      const pushed = applyPushFrom(scratch, landId, record.pushCount);
      return Boolean((damaged && damaged.spent > 0) || pushed);
    }
    case "damage_each_invader": {
      const result = applyDamageToEachInvader(scratch, landId, record.damage);
      return Boolean(result && result.spent > 0);
    }
    default:
      return false;
  }
}

// The inland Discover lands that are only reachable because a neighbour holds a Town or City.
// Below EXPLORE_UNRESTRICTED_FROM_WAVE a land like this takes no Explorers at all once that
// foothold goes (see landAcceptsExplorer), which makes removing it the only thing in the kit
// that stops invaders arriving rather than tidying up after they have.
//
// Coastal lands are never on this list - the ocean is their foothold and no push can take it
// away - and from wave 10 the question stops being asked at all, so the rung goes quiet for
// the rest of the round rather than pretending to still be worth a cooldown.
function exploreFootholdLands(state) {
  if (!state.round || state.round.wavesResolved >= EXPLORE_UNRESTRICTED_FROM_WAVE) return [];
  return landsOfTerrains(exploreTerrains(state)).filter(
    (land) => !landIsCoastal(land) && landAcceptsExplorer(state, land)
  );
}

// Prio: the lands where casting would cost some Discover land its last foothold. Asked by
// simulation, so a tier that denies by pushing the Town out and a tier that denies by killing
// it outright both answer through the same rung.
function innateDenyExploreLands(state, record) {
  const gated = exploreFootholdLands(state);
  if (gated.length === 0) return [];

  return LAND_IDS.filter((land) => {
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    const scratch = cloneCombatState(state);
    if (!innateSimulateCast(state, record, scratch, land)) return false;

    // Strictly fewer footholds, and no new ones. Shoving the Town one land sideways can close
    // one Discover land and open another - a net of nothing, for a cast - so the rung asks
    // that the whole set shrink rather than that any single land stop accepting.
    const after = exploreFootholdLands(scratch);
    return after.length < gated.length && after.every((target) => gated.includes(target));
  });
}

// Prio: a Build-terrain land this cast would empty outright, that the Dahan will not clear on
// their own first. A land with a City is never on this list - the City stays whatever the cast
// does, so the Build resolves regardless and the cooldown is better spent elsewhere.
function innateBreakBuildLands(state, record) {
  return buildThreatLands(state).filter((land) => {
    const slot = state.invaders[land];
    if (!slot || (slot.cities || 0) > 0) return false;
    if (invaderCountInLand(slot) <= 0) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (landClearsToDahanStrikeInTime(state, land)) return false;

    const scratch = cloneCombatState(state);
    innateSimulateCast(state, record, scratch, land);
    return invaderCountInLand(scratch.invaders[land]) <= 0;
  });
}

/* ---------- The positional rungs, shared by the two tiers that push ---------- */

// Would what this push moves die to the destination's own Dahan strike once it lands? This is
// what "route to cover" now means. The old rung only asked whether the destination held *a*
// Dahan, which sent Towns to lands that could not kill them; simulating the arrival and the
// strike together asks the question the player would actually ask.
//
// At tier 2 the damage lands first, so the survivors arrive already wounded and far more
// destinations qualify than the count of Dahan alone would suggest.
function innatePushDiesOnArrival(state, record, landId) {
  const destination = pushDestination(state, landId);
  if (!destination) return false;

  const scratch = cloneCombatState(state);
  if (record.effect === "damage_and_push") applyDamage(scratch, landId, record.damage);
  if (!applyPushFrom(scratch, landId, record.pushCount)) return false;
  return landClearsToDahanStrike(scratch, destination);
}

// Prio: a land that is bleeding Blight, that its own Dahan will not clear, whose push lands
// somewhere the Dahan finish what arrives. It stops the Blight and kills the unit in one cast,
// which is why it outranks merely improving the cover.
//
// The "not already clearing" guard is what keeps this from oscillating: a land the strike is
// about to empty is never a source, so the rung cannot pick a unit up and put it back.
function innateRouteToCoverLands(state, record) {
  return LAND_IDS.filter((land) => {
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (landPressure(state, land).blightPerSecond <= 0) return false;
    if (landClearsToDahanStrike(state, land)) return false;
    if (!pushStacksSafely(state, land)) return false;
    return innatePushDiesOnArrival(state, record, land);
  });
}

// Prio: move the invader onto a stack that is strictly better defended than the one it is
// standing on. Not a kill - consolidation. The Dahan loss rate is flat regardless of stack
// size (see landPressure), so an invader eating a stack of five costs the same per second as
// one eating a stack of one, and the big stack can afford it where the thin one cannot. It is
// the same protect-the-thin-stack idea tier 2 has always had, done by relocating the invader
// instead of by killing it.
//
// *Strictly* more Dahan is what makes this safe to run on an 8-beat clock: the destination
// always holds more than the source, so a unit can never be pushed back where it came from,
// and the rung terminates on its own rather than ping-ponging one unit over one border.
function innateDefendWithMoreDahanLands(state, record) {
  return LAND_IDS.filter((land) => {
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (!pushLandsSafely(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > (state.dahan[land] || 0);
  });
}

/* Tier 1 - push_invaders, pushCount 1 */

// Prio 5: carry a unit from an inland land onto an open coast, where the sea can reach it.
// One push kills nothing and removes nothing, so the best a spare cast can do is hand a
// better board to the two abilities that do - and the sea is the only removal in the kit that
// the invader health ladder never catches up with.
//
// Only from an inland land: a coast-to-coast shove is already-drownable to still-drownable,
// which is churn. Only from an undefended one: pulling a unit out from under Dahan trades a
// kill that is already happening for one that might.
//
// This is the one positional rung that still asks for genuinely open ground rather than
// pushLandsSafely's looser rule. An open coast holds nothing, which is what stops the rung from
// ever topping a coast up past the two units the sea would have taken anyway.
function innateT1FeedTheSeaLands(state) {
  return LAND_IDS.filter((land) => {
    if (landIsCoastal(land)) return false;
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (!pushLandsOnOpenGround(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && landIsCoastal(destination);
  });
}

function pickInnateTargetTier1(state, record) {
  const denyExplore = innateDenyExploreLands(state, record);
  if (denyExplore.length > 0) return worstBlightAmong(state, denyExplore);

  const breakBuild = innateBreakBuildLands(state, record);
  if (breakBuild.length > 0) return worstBlightAmong(state, breakBuild);

  const routeToCover = innateRouteToCoverLands(state, record);
  if (routeToCover.length > 0) return worstBlightAmong(state, routeToCover);

  const defendBetter = innateDefendWithMoreDahanLands(state, record);
  if (defendBetter.length > 0) return worstBlightAmong(state, defendBetter);

  const feedTheSea = innateT1FeedTheSeaLands(state);
  if (feedTheSea.length > 0) return worstBlightAmong(state, feedTheSea);

  return null;
}

/* Tier 2 - damage_and_push: 2 damage, then push up to 3 */

// Prio 3: any land this cast empties outright, not only a Build-terrain one. Clearing a land
// takes out a Blight source, a Build target and a Discover foothold in one cast, and it is
// certain where routing to cover is a bet on the destination's Dahan - which is why it sits
// above that rung rather than below it.
function innateT2ClearOutrightLands(state, record) {
  return LAND_IDS.filter((land) => {
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (invaderCountInLand(state.invaders[land]) <= 0) return false;
    return landClearsWithDamageAndPush(state, land, record.damage, record.pushCount);
  });
}

// Does this cast actually change the land? A land holding nothing but Cities takes the 2
// damage and keeps every unit, and the push cannot carry a City, so the cast is spent for a
// scratch. Worth checking because the Blight fallback below ranks purely on pressure, and the
// worst land on the board is often exactly that one.
function innateT2ChangesTheLand(state, record, landId) {
  const scratch = cloneCombatState(state);
  const before = invaderCountInLand(scratch.invaders[landId]);
  applyDamage(scratch, landId, record.damage);
  const pushed = applyPushFrom(scratch, landId, record.pushCount);
  return invaderCountInLand(scratch.invaders[landId]) < before || Boolean(pushed);
}

function pickInnateTargetTier2(state, record) {
  const denyExplore = innateDenyExploreLands(state, record);
  if (denyExplore.length > 0) return worstBlightAmong(state, denyExplore);

  const breakBuild = innateBreakBuildLands(state, record);
  if (breakBuild.length > 0) return worstBlightAmong(state, breakBuild);

  const clearOutright = innateT2ClearOutrightLands(state, record);
  if (clearOutright.length > 0) return worstBlightAmong(state, clearOutright);

  const routeToCover = innateRouteToCoverLands(state, record);
  if (routeToCover.length > 0) return worstBlightAmong(state, routeToCover);

  const defendBetter = innateDefendWithMoreDahanLands(state, record);
  if (defendBetter.length > 0) return worstBlightAmong(state, defendBetter);

  const bleeding = LAND_IDS.filter((land) =>
    landPressure(state, land).blightPerSecond > 0 && innateT2ChangesTheLand(state, record, land)
  );
  if (bleeding.length > 0) return worstBlightAmong(state, bleeding);

  const protectThin = LAND_IDS.filter((land) =>
    (state.dahan[land] || 0) > 0 && invaderCountInLand(state.invaders[land]) > 0
  );
  if (protectThin.length > 0) return thinnestDefendedLand(state, protectThin);

  return null;
}

/* Tier 3 - damage_each_invader: 2 to every unit individually, no push */

// How much pressure this cast actually takes off a land, in Blight per second. It replaces
// two rungs that each measured half of it: one counted the bodies standing in a land without
// asking whether any of them died, the other ranked by Blight without asking whether the cast
// changed anything. Killing is the only thing tier 3 does, so ranking by the Blight the kills
// remove is the measure that matches the ability.
function innateT3BlightRelieved(state, record, landId) {
  const before = landPressure(state, landId).blightPerSecond;
  const scratch = cloneCombatState(state);
  applyDamageToEachInvader(scratch, landId, record.damage);
  return before - landPressure(scratch, landId).blightPerSecond;
}

// When nothing dies anywhere, the cast is still worth making: per-unit wounds persist in
// `invaderDamage`, so chipping is real progress toward a kill. This ranks by how much of that
// progress banks - the number of units the *next* cast would finish - so the damage goes where
// it is about to convert rather than being spread thin across a fresh land.
function innateT3ChipProgress(state, record, landId) {
  const scratch = cloneCombatState(state);
  applyDamageToEachInvader(scratch, landId, record.damage);
  return livingUnits(scratch, landId).filter((unit) => unit.hp <= record.damage).length;
}

// The toughest single thing still standing, when nothing else qualified.
function innateT3ToughestLand(state) {
  const candidates = LAND_IDS.filter((land) => invaderCountInLand(state.invaders[land]) > 0);
  if (candidates.length === 0) return null;
  const toughestRank = (land) => {
    const slot = state.invaders[land];
    for (let i = 0; i < INVADER_TYPES_BY_TIER.length; i += 1) {
      if ((slot[INVADER_TYPES_BY_TIER[i]] || 0) > 0) return i;
    }
    return INVADER_TYPES_BY_TIER.length;
  };
  return candidates.slice().sort((a, b) => {
    const diff = toughestRank(a) - toughestRank(b);
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// The one list where breaking a Build outranks denying a Discover, and deliberately so. At the
// tiers that push, the deny costs a push that was not doing much else. Tier 3 has no push: it
// pays for the deny with its whole area hit, on a 22-beat clock, to stop a seeding of the
// weakest unit on the board - while Build is what raises Towns and Cities. So the two swap.
function pickInnateTargetTier3(state, record) {
  const breakBuild = innateBreakBuildLands(state, record);
  if (breakBuild.length > 0) return worstBlightAmong(state, breakBuild);

  const denyExplore = innateDenyExploreLands(state, record);
  if (denyExplore.length > 0) return worstBlightAmong(state, denyExplore);

  const relieving = LAND_IDS.filter((land) => innateT3BlightRelieved(state, record, land) > 0);
  if (relieving.length > 0) {
    return relieving.slice().sort((a, b) => {
      const diff = innateT3BlightRelieved(state, record, b) - innateT3BlightRelieved(state, record, a);
      return diff !== 0 ? diff : Number(a) - Number(b);
    })[0];
  }

  const chipping = LAND_IDS.filter((land) => innateT3ChipProgress(state, record, land) > 0);
  if (chipping.length > 0) {
    return chipping.slice().sort((a, b) => {
      const diff = innateT3ChipProgress(state, record, b) - innateT3ChipProgress(state, record, a);
      if (diff !== 0) return diff;
      const blight = landPressure(state, b).blightPerSecond - landPressure(state, a).blightPerSecond;
      return blight !== 0 ? blight : Number(a) - Number(b);
    })[0];
  }

  return innateT3ToughestLand(state);
}

// Dispatches on whichever tier is currently owned - the Innate replaces its own record
// wholesale per tier (see abilityRecord), so the auto-caster only has to read `effect`.
function pickInnateAutoTarget(state) {
  const record = abilityRecord(state, "innate_power");
  if (!record) return null;
  switch (record.effect) {
    case "push_invaders": return pickInnateTargetTier1(state, record);
    case "damage_and_push": return pickInnateTargetTier2(state, record);
    case "damage_each_invader": return pickInnateTargetTier3(state, record);
    default: return null;
  }
}

// The Innate acts on its own once `auto_innate` is bought, at whichever tier is currently
// owned - tiering up later never has to re-buy this. Unlike the Boon it has real judgement to
// exercise (see pickInnateAutoTarget), so a tick that satisfies no priority leaves the
// cooldown alone rather than spending it on a land that did not need it.
function resolveAutoInnate(state) {
  if (!autoCastOn(state, "innate_power")) return;
  if (!abilityIsUnlocked(state, "innate_power")) return;
  if (!abilityIsReady(state, "innate_power")) return;

  const landId = pickInnateAutoTarget(state);
  if (!landId) return;

  if (!applyAbilityEffect(state, "innate_power", landId, true)) return;
  startCooldown(state, "innate_power");
}

// River's Bounty fires itself once `auto_bounty` is bought. It is the Boon's kind of
// automation rather than the Innate's: the ability already picks its own land (see the note
// on rivers_bounty), so there is no judgement here to buy back and nothing to choose. What
// makes it the pricier upgrade is what it hands over - a Dahan every cooldown for the whole
// round, where the Boon hands over an Energy.
//
// The Energy unlock is deliberately still owed every round. This buys the clicking, not the
// ability, and a round that never spent the 5 Energy has nothing to automate.
function resolveAutoBounty(state) {
  if (!autoCastOn(state, "rivers_bounty")) return;
  if (!abilityIsUnlocked(state, "rivers_bounty")) return;
  if (!abilityIsReady(state, "rivers_bounty")) return;

  if (!applyAbilityEffect(state, "rivers_bounty", null, true)) return;
  startCooldown(state, "rivers_bounty");
}

/* ---------- Auto-cast: Wash Away's own judgement ----------
 *
 * Wash Away needs a target, so automating it means picking one - the same problem the Innate
 * has, answered the same way: a ranked list of reasons to cast, and no cast at all when none
 * of them applies.
 *
 * The ability is two abilities depending on where it is pointed, and the list is split the
 * same way. On a coast it removes units, so the rungs read off what it takes off the board;
 * inland it only relocates them, so those rungs read off where they end up.
 */

// What a cast on this land would actually do, on a scratch board. Simulated rather than
// reasoned about, so the auto-caster can never disagree with applyWashAway about which half of
// the ability a land gets.
function washAwayOutcome(state, landId, record) {
  const scratch = cloneCombatState(state);
  const drowned = landIsCoastal(landId)
    ? applyWashToSea(scratch, landId, record.seaCount)
    : null;
  const pushed = drowned ? null : applyPushFrom(scratch, landId, record.pushCount);

  return {
    removed: drowned ? drowned.totalDefeated : 0,
    acted: Boolean(drowned) || Boolean(pushed),
    clears: invaderCountInLand(scratch.invaders[landId]) <= 0
  };
}

// Prio 1: a land the next Build phase will thicken, that the cast would empty outright.
// Emptying it is the only thing that stops the build - Build needs something already standing
// there to build on. On a coast this rung drowns and breaks the build in the same cast.
function washAwayBreakBuildLands(state, record) {
  return buildThreatLands(state).filter((land) => {
    if (!abilityLegalLand(state, "wash_away", land)) return false;
    const outcome = washAwayOutcome(state, land, record);
    return outcome.acted && outcome.clears;
  });
}

// Prio 2: any coast the water can carry something off. A removal pays Fear and Energy the way
// a defeat does, and it is the only thing this ability does that the invaders cannot undo by
// walking back, so it outranks every reason to merely move them. The most units wins; ties go
// to the lowest land id, like every other choice on this board.
function washAwaySeaLands(state, record) {
  return LAND_IDS.filter((land) => {
    if (!landIsCoastal(land)) return false;
    if (!abilityLegalLand(state, "wash_away", land)) return false;
    return washAwayOutcome(state, land, record).removed > 0;
  });
}

function mostRemovedLand(state, landIds, record) {
  return landIds.slice().sort((a, b) => {
    const diff = washAwayOutcome(state, b, record).removed - washAwayOutcome(state, a, record).removed;
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// Prio 3: an undefended land whose push lands on open ground that holds Dahan. Invaders that
// nobody is fighting become invaders somebody is.
//
// Prio 2 has already taken every coast worth casting on, so this rung and the next only ever
// see inland lands - which is why they can be about the push alone.
function washAwayRouteToCoverLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "wash_away", land)) return false;
    if (!pushLandsOnOpenGround(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

// Prio 4: take the weight off whichever defended land is closest to losing its last Dahan.
function washAwayProtectThinDahanLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) <= 0) return false;
    if (!pushLandsOnOpenGround(state, land)) return false;
    return abilityLegalLand(state, "wash_away", land);
  });
}

function pickWashAwayAutoTarget(state) {
  const record = abilityRecord(state, "wash_away");
  if (!record) return null;

  const breakBuild = washAwayBreakBuildLands(state, record);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const sea = washAwaySeaLands(state, record);
  if (sea.length > 0) return mostRemovedLand(state, sea, record);

  const routeToCover = washAwayRouteToCoverLands(state);
  if (routeToCover.length > 0) return lowestLandId(routeToCover);

  const protectThin = washAwayProtectThinDahanLands(state);
  if (protectThin.length > 0) return thinnestDefendedLand(state, protectThin);

  return null;
}

function resolveAutoWashAway(state) {
  if (!autoCastOn(state, "wash_away")) return;
  if (!abilityIsUnlocked(state, "wash_away")) return;
  if (!abilityIsReady(state, "wash_away")) return;

  const landId = pickWashAwayAutoTarget(state);
  if (!landId) return;

  if (!applyAbilityEffect(state, "wash_away", landId, true)) return;
  startCooldown(state, "wash_away");
}

/* ---------- Auto-cast: Flash Floods' own judgement ----------
 *
 * The third targeted automation, and the only one whose ability kills. Wash Away's priorities
 * are all about where units end up because its push never removes one; these are the mirror
 * image - every rung below is read off what dies.
 *
 * The coastal bonus is the other thing that makes this list its own. The same cast is worth
 * 1 inland and 2 on lands 1, 2 and 3, so "which of these lands" is a real question here where
 * for the push it was only ever a tie-break. bestFloodLand answers it once, for every rung.
 */

// What a cast into this land would actually deal, coastal bonus folded in - the same number
// the player's own click would spend there.
function flashFloodsDamageIn(state, landId) {
  const record = abilityRecord(state, "flash_floods");
  return record ? flashFloodsDamage(record, landId) : 0;
}

// Among candidates, the land the flood hits hardest; ties go to the lowest land id, like every
// other choice on this board. In practice this reads "a coast before an inland" - which is the
// ability's own character, not a heuristic bolted onto it.
function bestFloodLand(state, landIds) {
  return landIds.slice().sort((a, b) => {
    const diff = flashFloodsDamageIn(state, b) - flashFloodsDamageIn(state, a);
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// Prio 1: a land the next Build phase will thicken, that the flood would empty outright.
// Build needs something already standing there, so emptying it is what stops it.
function flashFloodsBreakBuildLands(state) {
  return buildThreatLands(state).filter((land) => {
    if (!abilityLegalLand(state, "flash_floods", land)) return false;
    const scratch = cloneCombatState(state);
    applyDamage(scratch, land, flashFloodsDamageIn(state, land));
    return invaderCountInLand(scratch.invaders[land]) <= 0;
  });
}

// Prio 2: anywhere the cast kills something at all. A defeat pays Fear and Energy both, and
// this is the only ability in the kit that can produce one on its own - so a cooldown spent
// on a kill is never a cooldown spent badly. Simulated rather than reasoned about, so the
// kill-first rule in applyDamage stays the only place that decides what dies.
function flashFloodsKillLands(state) {
  return LAND_IDS.filter((land) => {
    if (!abilityLegalLand(state, "flash_floods", land)) return false;
    const scratch = cloneCombatState(state);
    return applyDamage(scratch, land, flashFloodsDamageIn(state, land)).totalDefeated > 0;
  });
}

// Prio 3: nothing dies this cast, so put the damage where the round is being lost fastest -
// the same fallback the Innate's upper tiers take, for the same reason.
function flashFloodsBleedLand(state) {
  const land = worstBlightLand(state);
  return land && abilityLegalLand(state, "flash_floods", land) ? land : null;
}

function pickFlashFloodsAutoTarget(state) {
  if (!abilityRecord(state, "flash_floods")) return null;

  const breakBuild = flashFloodsBreakBuildLands(state);
  if (breakBuild.length > 0) return bestFloodLand(state, breakBuild);

  const kills = flashFloodsKillLands(state);
  if (kills.length > 0) return bestFloodLand(state, kills);

  return flashFloodsBleedLand(state);
}

function resolveAutoFlashFloods(state) {
  if (!autoCastOn(state, "flash_floods")) return;
  if (!abilityIsUnlocked(state, "flash_floods")) return;
  if (!abilityIsReady(state, "flash_floods")) return;

  const landId = pickFlashFloodsAutoTarget(state);
  if (!landId) return;

  if (!applyAbilityEffect(state, "flash_floods", landId, true)) return;
  startCooldown(state, "flash_floods");
}

// The single entry point for the ability bar. Everything it can answer with - cancel,
// refuse, arm, resolve - lands here so the UI stays a view.
function triggerAbility(state, abilityId) {
  const t = locale(state);
  if (!abilityBaseRecord(abilityId) || !state.abilities[abilityId]) return false;
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

  const record = abilityRecord(state, abilityId);

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
  if (!abilityId || !abilityBaseRecord(abilityId)) return false;
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

