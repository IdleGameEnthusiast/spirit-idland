/* ------------------------------------------------------------------ *
 * Power cards: owning, drawing, and casting
 * ------------------------------------------------------------------ *
 *
 * The card pool, the offer, the hand, and the step machine a cast runs.
 * Spec: docs/spec/10-power-cards.md
 */

/* ------------------------------------------------------------------ *
 * Power cards: owning, drawing, and casting (10-power-cards.md)        *
 *                                                                      *
 * Three parts, in the order a card travels: bought with Presence out    *
 * of a three-card offer, handed to a round by depth, then cast through  *
 * the ability runtime above - the same cooldowns, the same one land     *
 * click, the same Focus. Nothing here builds a parallel runtime.        *
 * ------------------------------------------------------------------ */

/* ---------- State factories ---------- */

function createPowerCardsState() {
  return { owned: [], draw: { offerIds: [], rerollCount: 0 } };
}

function createRoundCardsState() {
  return {
    handIds: [],
    drawsTaken: 0,
    nextDrawWave: POWER_CARD_FIRST_DRAW_WAVE,
    pendingRedrawId: null,
    rejectedIds: []
  };
}

// A ward is a number on a land, and its deadline is stored beside it as the `elapsedSeconds`
// at which it lapses rather than as a countdown. That is what lets the speed dial and the wave
// gate need no special case here: both already move that clock, and neither has to know that
// Defense exists.
function createDefenseByLand() {
  return createLandMap(() => 0);
}

function createDefenseExpiry() {
  return createLandMap(() => null);
}

function normalizeDefense(defense) {
  const raw = defense || {};
  return createLandMap((landId) => Math.max(0, Math.floor(Number(raw[landId]) || 0)));
}

function normalizeDefenseExpiry(expiry) {
  const raw = expiry || {};
  return createLandMap((landId) => {
    const value = Number(raw[landId]);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
}

// Unknown ids dropped, duplicates collapsed. Both lists are rebuilt from POWER_CARD_IDS order
// rather than from the save, so a doctored file cannot smuggle in a card the build does not
// have and cannot reorder the hand into something the bar would draw twice.
function normalizeCardIdList(list) {
  const wanted = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];
  for (const id of wanted) {
    if (!POWER_CARDS[id] || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizePowerCards(powerCards) {
  const raw = powerCards && typeof powerCards === "object" ? powerCards : {};
  const owned = normalizeCardIdList(raw.owned);
  const draw = raw.draw && typeof raw.draw === "object" ? raw.draw : {};
  // An offer naming a card that has since been bought is dropped from it rather than left to
  // sell something twice. ensurePowerCardOffer tops the offer back up afterwards, which is
  // repair rather than a free re-roll: it only ever runs on an offer that was already short.
  const offerIds = normalizeCardIdList(draw.offerIds).filter((id) => !owned.includes(id));
  return {
    owned,
    draw: { offerIds, rerollCount: Math.max(0, Math.floor(Number(draw.rerollCount) || 0)) }
  };
}

// The hand is round state, so it is normalized against what is owned: a save naming a card in
// hand that the cycle no longer owns loses it, exactly like an ability id the build dropped.
function normalizeRoundCards(cards, owned) {
  const raw = cards && typeof cards === "object" ? cards : {};
  const handIds = normalizeCardIdList(raw.handIds).filter((id) => owned.includes(id));
  const rejectedIds = normalizeCardIdList(raw.rejectedIds).filter((id) => owned.includes(id));
  const pending = raw.pendingRedrawId;
  return {
    handIds,
    drawsTaken: Math.max(0, Math.floor(Number(raw.drawsTaken) || 0)),
    // At least 1: a doctored 0 would have every wave try to draw. A *missing* field is not a
    // doctored one though - it is a save from before the drip existed, whose next draw is
    // honestly the first one - so absent and zero are told apart rather than both falling
    // through a `||`.
    nextDrawWave: Number.isFinite(Number(raw.nextDrawWave))
      ? Math.max(1, Math.floor(Number(raw.nextDrawWave)))
      : POWER_CARD_FIRST_DRAW_WAVE,
    // The re-draw offer only means anything for a card actually standing in hand.
    pendingRedrawId: handIds.includes(pending) ? pending : null,
    rejectedIds
  };
}

function powerCardOptionOn(state, cardId) {
  const options = (state.ui && state.ui.cardOptions) || {};
  return options[cardId] !== false;
}

function setPowerCardOption(state, cardId, on) {
  if (!(cardId in POWER_CARD_OPTION_DEFAULTS)) return false;
  if (!state.ui.cardOptions || typeof state.ui.cardOptions !== "object") state.ui.cardOptions = {};
  state.ui.cardOptions[cardId] = on === true;
  return true;
}

/* ---------- Owning: the Presence draw ----------
 *
 * The first Presence row that is not an upgrade at all. It draws three and the player keeps
 * one; what is bought is permanent and survives ascension, like every Presence purchase.
 */

function ownedPowerCardIds(state) {
  return normalizeCardIdList(state.powerCards && state.powerCards.owned);
}

function unownedPowerCardIds(state) {
  const owned = ownedPowerCardIds(state);
  return POWER_CARD_IDS.filter((id) => !owned.includes(id));
}

function powerCardOfferIds(state) {
  const draw = (state.powerCards && state.powerCards.draw) || {};
  return normalizeCardIdList(draw.offerIds);
}

function powerCardDrawCost(state) {
  return Math.round(POWER_CARD_DRAW_BASE_COST * Math.pow(POWER_CARD_DRAW_GROWTH, ownedPowerCardIds(state).length));
}

function powerCardRerollCost(state) {
  return Math.ceil(powerCardDrawCost(state) / POWER_CARD_REROLL_DIVISOR);
}

function powerCardsSoldOut(state) {
  return unownedPowerCardIds(state).length <= 0;
}

// Takes `count` at random out of a pool, without replacement. The same bag-and-splice the
// invader track draws its terrains with, so both roll off the one injected RNG a test pins.
function drawFromPool(pool, count) {
  const bag = pool.slice();
  const drawn = [];
  const wanted = Math.max(0, Math.floor(count || 0));
  while (drawn.length < wanted && bag.length > 0) {
    drawn.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  }
  return drawn;
}

/* The offer is state, and this is the only thing that ever fills it. Read it through here
 * rather than off `powerCards.draw.offerIds`, which is the raw field and can be legitimately
 * empty - on a fresh game that has never opened the shop, most of all.
 *
 * It rolls exactly once, when the stored offer is short of what it should hold: the first look
 * at a fresh game, after a draw is taken, and after normalization dropped a card the player has
 * since bought. Re-rendering the panel, reloading the save and reopening the shop all find a
 * full offer and leave it alone - which is what stops a reload from being a free re-roll and
 * keeps the re-roll price from being decoration.
 *
 * Rolling on first look rather than at setup is what keeps the RNG stream where it was: a draw
 * taken in createFreshGameState would shift every roll the island makes after it, and a given
 * seed would land on a different board purely because this feature exists.
 */
function ensurePowerCardOffer(state) {
  if (!state.powerCards || typeof state.powerCards !== "object") state.powerCards = createPowerCardsState();
  if (!state.powerCards.draw || typeof state.powerCards.draw !== "object") {
    state.powerCards.draw = { offerIds: [], rerollCount: 0 };
  }

  const unowned = unownedPowerCardIds(state);
  const current = powerCardOfferIds(state).filter((id) => unowned.includes(id));
  const wanted = Math.min(POWER_CARD_OFFER_SIZE, unowned.length);
  if (current.length >= wanted) {
    state.powerCards.draw.offerIds = current.slice(0, wanted);
    return state.powerCards.draw.offerIds;
  }

  const fill = drawFromPool(unowned.filter((id) => !current.includes(id)), wanted - current.length);
  state.powerCards.draw.offerIds = current.concat(fill);
  return state.powerCards.draw.offerIds;
}

/* A paid re-roll, and the guarantee that makes the price honest.
 *
 * Paying for a re-roll that could hand back the same three cards is paying for nothing, so the
 * new offer holds at least two cards the old one did not - whenever that many exist. Once the
 * unowned pool is down to three every card is already on show, there is nothing left to
 * guarantee, and the button goes dead rather than taking the Presence.
 */
function powerCardRerollAllowed(state) {
  return unownedPowerCardIds(state).length > POWER_CARD_OFFER_SIZE;
}

function rerollPowerCardOffer(state) {
  const t = locale(state);
  if (!powerCardRerollAllowed(state)) {
    addLog(state, t.cardRerollRefused);
    return false;
  }

  const cost = powerCardRerollCost(state);
  if (state.meta.presence < cost) {
    addLog(state, template(t.cardRerollTooExpensive, { cost, presence: state.meta.presence }));
    return false;
  }

  const unowned = unownedPowerCardIds(state);
  const current = powerCardOfferIds(state);
  const fresh = unowned.filter((id) => !current.includes(id));

  const guaranteed = drawFromPool(fresh, Math.min(POWER_CARD_REROLL_GUARANTEE, fresh.length));
  const rest = drawFromPool(
    unowned.filter((id) => !guaranteed.includes(id)),
    Math.min(POWER_CARD_OFFER_SIZE, unowned.length) - guaranteed.length
  );

  state.meta.presence -= cost;
  state.powerCards.draw.offerIds = guaranteed.concat(rest);
  state.powerCards.draw.rerollCount += 1;

  addLog(state, template(t.cardRerolled, { cost, presence: state.meta.presence }));
  return true;
}

// Keeping one of the three. The offer is cleared with the purchase and a fresh one rolled for
// the next draw, so the price ladder and the offer move together.
function drawPowerCard(state, cardId) {
  const t = locale(state);
  if (!POWER_CARDS[cardId]) return false;
  if (!powerCardOfferIds(state).includes(cardId)) return false;

  const cost = powerCardDrawCost(state);
  if (state.meta.presence < cost) {
    addLog(state, template(t.cardTooExpensive, {
      card: abilityName(state, cardId),
      cost,
      presence: state.meta.presence
    }));
    return false;
  }

  state.meta.presence -= cost;
  state.powerCards.owned = ownedPowerCardIds(state).concat([cardId]);
  state.powerCards.draw = { offerIds: [], rerollCount: 0 };
  ensurePowerCardOffer(state);

  addLog(state, template(t.cardBought, { card: abilityName(state, cardId), cost }));
  return true;
}

/* ---------- Holding: the drip ----------
 *
 * A round hands the player one owned card at a time, on a wave schedule. Nothing here is
 * random except which card arrives, and the Energy re-draw below is what the player pays to
 * argue with that.
 */

function powerCardDrawInterval(state) {
  const tier = activeUpgradeTier(state, "power_card_interval");
  return Math.max(1, POWER_CARD_DRAW_INTERVAL_BASE - tier);
}

function roundCards(state) {
  if (!state.round.cards || typeof state.round.cards !== "object") {
    state.round.cards = createRoundCardsState();
  }
  return state.round.cards;
}

function cardsInHand(state) {
  return normalizeCardIdList(roundCards(state).handIds);
}

// What a draw can still reach: owned, and not already standing in this round's hand.
function drawablePowerCardIds(state) {
  const hand = cardsInHand(state);
  return ownedPowerCardIds(state).filter((id) => !hand.includes(id));
}

// A card arrives ready, not cooling - the same rule a bought unlock follows, and for the same
// reason: what was paid for is the card, not a wait.
function grantPowerCard(state, cardId) {
  const cards = roundCards(state);
  if (!POWER_CARDS[cardId] || cards.handIds.includes(cardId)) return false;
  cards.handIds.push(cardId);
  state.abilities[cardId] = { cooldownRemaining: 0 };
  return true;
}

function removeCardFromHand(state, cardId) {
  const cards = roundCards(state);
  cards.handIds = cards.handIds.filter((id) => id !== cardId);
  delete state.abilities[cardId];
  if (state.pendingAbilityTarget === cardId) state.pendingAbilityTarget = null;
}

/* The wave that hands a card over. Called at the end of resolveWave, so a card drawn on wave
 * 25 is castable on the same tick that wave resolved.
 *
 * The schedule advances whether or not a card was actually handed over. A round owning nothing
 * must not bank three draws to spend the moment its first card is bought - the drip is paid for
 * in waves survived, and a wave that passed is spent.
 */
function resolveCardDraw(state) {
  const cards = roundCards(state);
  if (state.round.wavesResolved < cards.nextDrawWave) return null;
  cards.nextDrawWave = state.round.wavesResolved + powerCardDrawInterval(state);

  const pool = drawablePowerCardIds(state);
  // Nothing owned, or everything owned already in hand: nothing happens, silently.
  if (pool.length === 0) return null;

  const cardId = drawFromPool(pool, 1)[0];
  grantPowerCard(state, cardId);
  cards.drawsTaken += 1;
  // The re-draw offer belongs to this draw alone: the pool of what it may swap to narrows as
  // it is used, and the next draw starts that narrowing over.
  cards.pendingRedrawId = cardId;
  cards.rejectedIds = [];

  // The log records it; the fx announces it. The bar alone cannot - a card sliding into a
  // panel the player is not looking at is not an event, and the drip is the one moment in a
  // round where something arrives rather than being spent.
  markCardFx(state, cardId, state.round.wavesResolved);
  addLog(state, template(locale(state).cardDrawn, {
    card: abilityName(state, cardId),
    wave: state.round.wavesResolved
  }));
  return cardId;
}

/* ---------- The re-draw, which does not stop the round ----------
 *
 * Nothing inside a round waits for player input, so this is not a prompt. The card lands in
 * hand ready and immediately castable, with a button on it priced in Energy - and casting is
 * accepting, so the button is gone from the first cast on. There is no order of clicks that
 * casts a card and then swaps it for another.
 */

function powerCardRedrawCost(state) {
  return POWER_CARD_REDRAW_BASE_ENERGY * Math.max(1, roundCards(state).drawsTaken);
}

// Narrower with every re-draw: neither already in hand nor already thrown back in this same
// draw. That is what bounds the fee - when the pool empties the button goes dead and the last
// card stands.
function powerCardRedrawPool(state) {
  const cards = roundCards(state);
  const rejected = normalizeCardIdList(cards.rejectedIds);
  return drawablePowerCardIds(state).filter((id) => !rejected.includes(id));
}

function powerCardRedrawOffered(state, cardId) {
  return roundCards(state).pendingRedrawId === cardId && powerCardRedrawPool(state).length > 0;
}

function redrawPowerCard(state, cardId) {
  const t = locale(state);
  const cards = roundCards(state);
  if (state.round.status !== "running") return false;
  if (!powerCardRedrawOffered(state, cardId)) return false;

  const cost = powerCardRedrawCost(state);
  if (state.resources.energy < cost) {
    addLog(state, template(t.cardRedrawTooExpensive, {
      card: abilityName(state, cardId),
      cost,
      energy: state.resources.energy
    }));
    return false;
  }

  const pool = powerCardRedrawPool(state);
  state.resources.energy -= cost;
  removeCardFromHand(state, cardId);
  cards.rejectedIds = normalizeCardIdList(cards.rejectedIds).concat([cardId]);

  const next = drawFromPool(pool, 1)[0];
  grantPowerCard(state, next);
  cards.pendingRedrawId = next;
  // Announced like the drip's own draw. This is the moment the Energy was spent to see, so
  // showing it is the whole point of the button rather than an embellishment on it.
  markCardFx(state, next, state.round.wavesResolved);

  addLog(state, template(t.cardRedrawn, {
    card: abilityName(state, cardId),
    next: abilityName(state, next),
    cost
  }));
  return true;
}

// Casting is accepting. Called from startCooldown, so it covers both cast paths - the
// untargeted one and the land click - and only ever after the effect actually landed.
function acceptPowerCard(state, cardId) {
  const cards = state.round && state.round.cards;
  if (!cards || cards.pendingRedrawId !== cardId) return;
  cards.pendingRedrawId = null;
  cards.rejectedIds = [];
}

/* ---------- Defense ----------
 *
 * A ward laid on a land: it waits, unspent, for as long as it takes, cancels invader attack
 * when the attack arrives, and is gone one wave later.
 *
 * Five things about it are load-bearing, and every one of them is deliberate:
 *
 *  - Total denial is measured against Defense alone, not against Defense plus what the Dahan
 *    standing there cancel. Otherwise one point of Defense would flip a Dahan-held land from
 *    seeping to immune and the number printed on the card would stop meaning anything.
 *  - Total denial ignores BLIGHT_FLOOR_FRACTION. A held land seeps a quarter of its gross and
 *    no stack of Dahan can stop that; a ward can. The acceptance rule that no land is ever
 *    permanently safe survives, because a ward is spent after one wave - safety is now
 *    purchasable by the wave and still never by the round.
 *  - Below the threshold it is a plain reduction, read by every formula as a smaller attack.
 *    So Defense protects Dahan, which their own defence does not; the price is that it runs out.
 *  - It expires one full wave interval after it first does anything, not at the next wave
 *    boundary. Boundary consumption made the cast time against the visible wave clock decide
 *    whether a ward was worth twenty seconds or one - a trap a HUD countdown teaches good
 *    players to exploit and never teaches new ones at all.
 *  - Any use spends the whole pool, which is what stops a ward from being a stat and why
 *    stockpiling needs no cap: eight casts on a quiet land do bank Defend 16, and it pays out
 *    exactly once.
 */

function defenseInLand(state, landId) {
  const map = state.round && state.round.defense;
  return Math.max(0, Math.floor((map && map[landId]) || 0));
}

function addDefense(state, landId, amount) {
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  if (gain <= 0 || !isLandId(landId)) return 0;
  if (!state.round.defense) state.round.defense = createDefenseByLand();
  if (!state.round.defenseExpiry) state.round.defenseExpiry = createDefenseExpiry();
  // Additive and uncapped, and it does not restart a clock already running: a ward stacked on
  // top of one that has begun to lapse lapses with it, rather than the second cast quietly
  // buying the first one more wave.
  state.round.defense[landId] = defenseInLand(state, landId) + gain;
  return gain;
}

// Clears a ward whose wave is up, and returns whether anything is still standing. Run at the
// top of a land's combat, before the pressure is read, so a lapsed ward cannot cancel one more
// tick of damage on its way out.
function expireDefense(state, landId) {
  if (defenseInLand(state, landId) <= 0) return false;
  const expiry = (state.round.defenseExpiry || {})[landId];
  if (expiry !== null && expiry !== undefined && state.round.elapsedSeconds >= expiry) {
    state.round.defense[landId] = 0;
    state.round.defenseExpiry[landId] = null;
    return false;
  }
  return true;
}

// The first tick in which a ward did anything starts its wave. Until then it waits - a quiet
// land holds its ward indefinitely, which is the whole of what makes Encompassing Ward bank
// value against where the invaders are going rather than against where they are.
function markDefenseUsed(state, landId) {
  if (!state.round.defenseExpiry) state.round.defenseExpiry = createDefenseExpiry();
  if (state.round.defenseExpiry[landId] !== null && state.round.defenseExpiry[landId] !== undefined) return;
  state.round.defenseExpiry[landId] = state.round.elapsedSeconds + WAVE_INTERVAL_SECONDS;
}

/* ---------- Blight that can fall ----------
 *
 * 02-core-loop.md said Blight only ever goes up. Four of the seven cards remove it. The
 * invariant that survives is narrower and is the one that mattered: the round still ends the
 * instant `round.blight` reaches `round.blightThreshold`, and removal is preventive, never a
 * rescue. The threshold check runs inside the same tick that raised the bar, so there is no
 * window in which a card can pull a round back from the end.
 *
 * `round.blightProgress[land]` is deliberately not touched: a removal takes whole Blight off
 * the round's clock and leaves the land's part-filled bar exactly where it stands.
 */
function removeBlight(state, land, amount) {
  const wanted = Math.max(0, Math.floor(Number(amount) || 0));
  if (wanted <= 0 || !isLandId(land)) return 0;

  const inLand = Math.max(0, state.round.blightByLand[land] || 0);
  const taken = Math.min(wanted, inLand, state.round.blight);
  if (taken <= 0) return 0;

  state.round.blight -= taken;
  state.round.blightByLand[land] -= taken;
  return taken;
}

// The untargeted removal's land: the most-blighted one, ties on the lowest land id like every
// other tie on this board. This is the first thing that has ever read `blightByLand` for a
// decision rather than for a display.
function mostBlightedLand(state) {
  let best = null;
  for (const landId of LAND_IDS) {
    const blight = Math.max(0, (state.round.blightByLand || {})[landId] || 0);
    if (blight <= 0) continue;
    if (!best || blight > best.blight) best = { landId, blight };
  }
  return best ? best.landId : null;
}

/* ---------- Casting: the effect-step resolver ----------
 *
 * A kit ability carries one `effect` string; a card carries an ordered step list, because
 * every one of the seven is two to four clauses with conditions. Steps resolve in order
 * against one snapshot of the target land taken before the first step, so a clause cannot be
 * defeated by an earlier clause's kill.
 */

function cardLandSnapshot(state, landId) {
  if (!isLandId(landId)) return null;
  const slot = state.invaders[landId] || {};
  return {
    landId,
    explorers: Math.max(0, slot.explorers || 0),
    towns: Math.max(0, slot.towns || 0),
    cities: Math.max(0, slot.cities || 0),
    invaders: invaderCountInLand(slot),
    blight: Math.max(0, (state.round.blightByLand || {})[landId] || 0),
    terrain: landTerrain(landId),
    coastal: landIsCoastal(landId)
  };
}

// `else` pairs with the step above it, and it reads that step's *condition* rather than
// whether it found anything to do: a Destroy that fizzled on an empty land is still the
// Explorer mode of the card having been chosen, and the removal must not fire behind it.
function cardStepApplies(step, snapshot, lastConditionMet) {
  const when = step.when;
  if (!when) return true;
  if (when === "else") return !lastConditionMet;
  if (!snapshot) return false;
  if (when === "invaders_present") return snapshot.invaders > 0;
  if (when === "explorers_present") return snapshot.explorers > 0;
  if (when === "coastal") return snapshot.coastal;
  if (when.startsWith("terrain:")) return conditionTerrains(when).includes(snapshot.terrain);
  return false;
}

// `terrain:desert,wetlands` names its terrains in one string, so it is split before it reaches
// terrainList - which takes a list and would quietly read the whole comma-joined string as one
// unknown terrain, matching nothing and failing silently.
function conditionTerrains(when) {
  return terrainList(String(when).slice("terrain:".length).split(","));
}

// Fear a card pays: a third source beside kill Fear and wave Fear, multiplied by the Presence
// bonus only. Not by rising_dread, which multiplies kills, and not by mounting_terror, which
// multiplies waves - folding it into either would make that ladder's tuning do two jobs, and
// both are already capped at ten tiers against a fixed income shape.
function gainFearFromCard(state, amount) {
  const base = Math.max(0, Math.floor(Number(amount) || 0));
  if (base <= 0) return 0;
  const gain = base * presenceFearMultiplier(state);
  state.round.fearEarned += gain;
  state.round.fearEarnedBase += base;
  return gain;
}

// Removal that pays, exactly as the sea does in wash_away: creditDefeat is the same function
// the damage path calls, so a destroyed unit pays its Fear and its Energy without any damage
// having been spent on it. The healthiest of its type goes first - a removal does not care how
// hurt a unit was, so spending it on the hardest one to kill is what makes it worth more than
// the damage it replaces.
function destroyInvaderUnits(state, landId, unitType, amount) {
  const result = { defeated: emptyDefeatTally(), totalDefeated: 0, spent: 0 };
  if (!isLandId(landId) || !INVADER_TYPES.includes(unitType)) return result;

  let budget = Math.max(0, Math.floor(Number(amount) || 0));
  while (budget > 0 && (state.invaders[landId][unitType] || 0) > 0) {
    const wounds = state.invaderDamage[landId][unitType];
    removeInvaderUnit(state, landId, unitType, Math.max(0, wounds.length - 1));
    creditDefeat(state, result, unitType);
    budget -= 1;
  }
  return result;
}

// A cost, not an effect: the Dahan are allies, so this pays nothing at all. It must reset the
// land's `dahanProgress` when it empties one, holding the invariant that reinforcements arrive
// at a full bar.
function destroyDahan(state, landId, amount) {
  if (!isLandId(landId)) return 0;
  const before = Math.max(0, state.dahan[landId] || 0);
  const lost = Math.min(before, Math.max(0, Math.floor(Number(amount) || 0)));
  if (lost <= 0) return 0;

  state.dahan[landId] = before - lost;
  if (state.dahan[landId] <= 0) state.round.dahanProgress[landId] = 0;
  markDefeatFx(state, landId, "dahan", lost);
  return lost;
}

function emptyCardOutcome() {
  return {
    fear: 0,
    damage: 0,
    defeated: 0,
    blightRemoved: 0,
    defended: 0,
    pushed: 0,
    dahanLost: 0,
    acted: false
  };
}

function applyCardStep(state, step, landId, snapshot, out) {
  switch (step.kind) {
    case "fear_flat": {
      const gained = gainFearFromCard(state, step.amount);
      if (gained > 0) {
        out.fear += gained;
        out.acted = true;
      }
      return;
    }
    // Counts bodies, not power: a City pays the same as an Explorer, which is what makes this
    // a crowd-clearing payout rather than a second kill-Fear ladder.
    case "fear_per_invader": {
      const bodies = snapshot ? snapshot.invaders : 0;
      const gained = gainFearFromCard(state, step.amount * bodies);
      if (gained > 0) {
        out.fear += gained;
        out.acted = true;
      }
      return;
    }
    case "damage": {
      if (invaderCountInLand(state.invaders[landId]) <= 0) return;
      const bonus = step.terrainBonus && terrainList(step.terrains).includes(landTerrain(landId))
        ? step.terrainBonus
        : 0;
      const amount = Math.max(0, Math.floor(step.amount || 0)) + bonus;
      if (amount <= 0) return;
      const result = applyDamage(state, landId, amount);
      markDefeatFxFromResult(state, landId, result);
      out.damage += amount;
      out.defeated += result.totalDefeated;
      out.acted = true;
      return;
    }
    case "remove_blight": {
      // A targeted card removes from the clicked land if it has any, and the clause does
      // nothing otherwise. An untargeted one has no land to read, so it takes the worst.
      const land = isLandId(landId) ? landId : mostBlightedLand(state);
      const removed = removeBlight(state, land, step.amount);
      if (removed > 0) {
        out.blightRemoved += removed;
        out.acted = true;
      }
      return;
    }
    case "defend": {
      const lands = step.scope === "all" ? LAND_IDS : (isLandId(landId) ? [landId] : []);
      let laid = 0;
      for (const land of lands) laid = addDefense(state, land, step.amount) || laid;
      if (laid > 0) {
        out.defended += laid;
        out.acted = true;
      }
      return;
    }
    case "push_all": {
      // The shared push rule with no count cap: same destinations, same preferences, same
      // wounds carried along - only the budget and the unit types differ.
      const pushed = applyPushFrom(state, landId, Infinity, [step.unitType]);
      if (pushed) {
        out.pushed += pushed.moved;
        out.acted = true;
      }
      return;
    }
    case "destroy_units": {
      const result = destroyInvaderUnits(state, landId, step.unitType, step.amount);
      if (result.totalDefeated > 0) {
        markDefeatFxFromResult(state, landId, result);
        out.defeated += result.totalDefeated;
        out.acted = true;
      }
      return;
    }
    case "destroy_dahan": {
      const lost = destroyDahan(state, landId, step.amount);
      if (lost > 0) {
        out.dahanLost += lost;
        out.acted = true;
      }
      return;
    }
    default:
      return;
  }
}

function runCardSteps(state, steps, landId, out) {
  const snapshot = cardLandSnapshot(state, landId);
  let lastConditionMet = false;
  for (const step of steps || []) {
    const met = cardStepApplies(step, snapshot, lastConditionMet);
    lastConditionMet = met;
    if (met) applyCardStep(state, step, landId, snapshot, out);
  }
}

/* What a card's own numbers are, read back out of its steps for its description.
 *
 * The same rule the kit follows and for the same reason: a card tuned in POWER_CARDS must
 * never leave a description promising something the steps no longer do. Amounts of a kind are
 * summed, which is right for every card here - none of them carries two clauses of one kind
 * that a player would read as separate numbers - and the terrain list is picked up from
 * whichever half of the card names one, the damage step's `terrains` or a `terrain:` condition.
 */
function cardStepAmounts(steps) {
  const out = { fear: 0, damage: 0, bonus: 0, blight: 0, defend: 0, destroy: 0, dahan: 0 };
  for (const step of steps || []) {
    const amount = Math.max(0, Math.floor(Number(step.amount) || 0));
    switch (step.kind) {
      case "fear_flat":
      case "fear_per_invader":
        out.fear += amount;
        break;
      case "damage":
        out.damage += amount;
        out.bonus += Math.max(0, Math.floor(Number(step.terrainBonus) || 0));
        break;
      case "remove_blight":
        out.blight += amount;
        break;
      case "defend":
        out.defend += amount;
        break;
      case "destroy_units":
        out.destroy += amount;
        break;
      case "destroy_dahan":
        out.dahan += amount;
        break;
      default:
        break;
    }
  }
  return out;
}

function cardBonusTerrains(record) {
  for (const step of record.effects || []) {
    if (Array.isArray(step.terrains) && step.terrains.length > 0) return terrainList(step.terrains);
    if (typeof step.when === "string" && step.when.startsWith("terrain:")) {
      return conditionTerrains(step.when);
    }
  }
  return terrainList(record.blightTerrains);
}

function cardTextVars(state, record) {
  const main = cardStepAmounts(record.effects);
  const also = cardStepAmounts(record.alsoEachOtherCoastal);
  return {
    ...main,
    alsoFear: also.fear,
    alsoDamage: also.damage,
    alsoDahan: also.dahan,
    terrains: terrainNames(state, cardBonusTerrains(record)),
    beats: Math.round(record.cooldownSeconds / TIME_SCALE)
  };
}

// What a cast is worth, in one line the log can print. Built out of the outcome rather than
// out of the card, so a card whose Fear clause found no invaders does not claim to have paid.
function cardOutcomeSummary(state, out) {
  const t = locale(state);
  const parts = [];
  if (out.fear > 0) parts.push(template(t.cardPartFear, { amount: formatFear(out.fear) }));
  if (out.damage > 0) parts.push(template(t.cardPartDamage, { amount: out.damage }));
  if (out.defeated > 0) parts.push(template(t.cardPartDefeated, { count: out.defeated }));
  if (out.pushed > 0) parts.push(template(t.cardPartPushed, { count: out.pushed }));
  if (out.blightRemoved > 0) parts.push(template(t.cardPartBlight, { amount: out.blightRemoved }));
  if (out.defended > 0) parts.push(template(t.cardPartDefend, { amount: out.defended }));
  if (out.dahanLost > 0) parts.push(template(t.cardPartDahan, { count: out.dahanLost }));
  return parts.join(", ");
}

/* One cast. Returns false when nothing at all landed, which is what leaves the cooldown
 * unspent - the same contract every kit effect follows.
 *
 * Tsunami's second half runs here rather than as a second ability: the primary land resolves
 * fully first, then each other coastal land in ascending id, each one independent of the rest.
 * A coast with no invaders still loses its Dahan, which is exactly the cost the switch exists
 * to let the player refuse.
 */
function applyCardEffect(state, cardId, landId, quiet) {
  const record = POWER_CARDS[cardId];
  if (!record) return false;

  const out = emptyCardOutcome();
  runCardSteps(state, record.effects, landId, out);

  if (Array.isArray(record.alsoEachOtherCoastal) && powerCardOptionOn(state, cardId)) {
    const others = LAND_IDS
      .filter((other) => landIsCoastal(other) && other !== landId)
      .sort((a, b) => Number(a) - Number(b));
    for (const other of others) runCardSteps(state, record.alsoEachOtherCoastal, other, out);
  }

  if (!out.acted) return false;

  if (!quiet) {
    const summary = cardOutcomeSummary(state, out);
    addLog(state, isLandId(landId)
      ? template(locale(state).cardResolved, {
          card: abilityName(state, cardId),
          land: landName(state, landId),
          summary
        })
      : template(locale(state).cardResolvedNoLand, {
          card: abilityName(state, cardId),
          summary
        }));
  }
  return true;
}

// A card's legal lands. Every card names its own rule because every card's is different, and
// the seven between them want six of them - so they are written out rather than inferred from
// the step list, where a condition on step three would silently become a targeting rule.
function cardLegalLand(state, cardId, landId) {
  const record = POWER_CARDS[cardId];
  if (!record || !record.needsTarget || !isLandId(landId)) return false;

  const invaders = invaderCountInLand(state.invaders[landId]);
  const explorers = Math.max(0, (state.invaders[landId] || {}).explorers || 0);
  const blight = Math.max(0, (state.round.blightByLand || {})[landId] || 0);

  switch (record.target) {
    case "any":
      return true;
    case "invaders":
      return invaders > 0;
    case "invaders_or_blight":
      return invaders > 0 || blight > 0;
    case "explorers_or_blight":
      return explorers > 0 || blight > 0;
    case "invaders_or_terrain_blight":
      return invaders > 0 || (blight > 0 && terrainList(record.blightTerrains).includes(landTerrain(landId)));
    case "coastal_invaders":
      return landIsCoastal(landId) && invaders > 0;
    default:
      return invaders > 0;
  }
}

