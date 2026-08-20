/* ------------------------------------------------------------------ *
 * State factories, normalizers, and transient feedback
 * ------------------------------------------------------------------ *
 *
 * Builds blank state shapes and repairs loaded ones, plus the short-lived
 * fx markers the UI animates from.
 * Spec: docs/spec/03-state-contract.md, docs/spec/06-ui-contract.md
 */

/* ------------------------------------------------------------------ *
 * Board state factories and normalizers (03-state-contract.md)         *
 * ------------------------------------------------------------------ */

// The opening Discover draws only from terrains that can actually take an explorer on an
// empty board, which means terrains with a coastal land. Mountains has none, so drawing it
// at setup would seed nothing and hand the player a silent island for the whole first wave -
// exactly what the opening Discover exists to prevent.
//
// It always draws one terrain regardless of the ladder: wave 0 is the bottom rung, and the
// counter is per round, so no round ever opens wider than any other.
function drawOpeningTerrains(state) {
  const shut = INVADER_TERRAINS.filter(
    (terrain) => !landsOfTerrain(terrain).some((landId) => landAcceptsExplorer(state, landId))
  );
  return drawInvaderTerrains(1, shut);
}

// `count` distinct terrains, avoiding `excludedTerrains` where there is room to. The
// exclusion is a preference and not a rule, because past three terrains a wave there is no
// longer room to honour it - and a Discover that had to shrink to keep "not what we just
// built" would be the ladder undoing itself. From the free-draw rung the wave phase stops
// passing an exclusion at all (see exploreAvoidsBuild), which is a caller's decision rather
// than one this function makes: it draws whatever it is asked to avoid, or nothing.
function drawInvaderTerrains(count, excludedTerrains) {
  const wanted = clamp(Math.floor(Number(count) || 1), 1, INVADER_TERRAINS.length);
  if (wanted >= INVADER_TERRAINS.length) return INVADER_TERRAINS.slice();

  const excluded = new Set(terrainList(excludedTerrains));
  const preferred = INVADER_TERRAINS.filter((terrain) => !excluded.has(terrain));
  const bag = (preferred.length >= wanted ? preferred : INVADER_TERRAINS).slice();

  const drawn = [];
  while (drawn.length < wanted && bag.length > 0) {
    drawn.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  }
  return terrainList(drawn);
}

// How many terrains Discover draws this wave, off EXPLORE_TERRAIN_RUNGS. The rungs are read
// highest-first, so the first one the round has reached is the one that answers.
function exploreTerrainCount(state) {
  const wave = state && state.round ? state.round.wavesResolved : 0;
  for (const rung of EXPLORE_TERRAIN_RUNGS) {
    if (wave >= rung.fromWave) return Math.min(rung.terrains, INVADER_TERRAINS.length);
  }
  return 1;
}

// Whether Discover still keeps off the Build slot. Below the free-draw rung it does, and the
// early board is legible because of it: the terrain being reinforced is never also the one
// being seeded. From the rung on it does not, and the draw is a plain draw over every terrain.
function exploreAvoidsBuild(state) {
  const wave = state && state.round ? state.round.wavesResolved : 0;
  return wave < EXPLORE_FREE_DRAW_FROM_WAVE;
}

// Two slots, not three. Ravaging is no longer a phase that picks a terrain - invaders damage
// the land they stand in, continuously, everywhere at once (02-core-loop.md#the-fight).
function normalizeInvaderPhases(invader, state) {
  const build = terrainList(invader && invader.build);
  let explore = terrainList(invader && invader.explore);

  // A save written before Discover could widen holds one terrain where the round now wants
  // several, so the wanted count is taken from the ladder and the slot redrawn to match
  // rather than patched - the count and the contents always agree afterwards.
  const wanted = state ? exploreTerrainCount(state) : Math.max(1, explore.length);

  // Below the free-draw rung, Build and Discover still never name the same thing while there
  // is room for them not to - and once Discover takes every terrain there is no room, so the
  // clash stops being one. From the rung on, naming the same terrain is the rule rather than a
  // fault, so a save that holds an overlap is left exactly as it was written.
  const avoidsBuild = state ? exploreAvoidsBuild(state) : true;
  const clashes = avoidsBuild
    && wanted < INVADER_TERRAINS.length
    && explore.length > 0
    && explore.every((terrain) => build.includes(terrain));

  if (explore.length !== wanted || clashes) {
    explore = drawInvaderTerrains(wanted, avoidsBuild ? build : []);
  }

  return { build, explore };
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

// Damage is tracked per unit, not per type: one entry per living invader, holding how much
// that individual has taken. The earlier model kept a single number per type per land, which
// meant a land could only ever hold one wounded city - "two cities, both at one damage" was
// not a state it could describe. Everything that spreads damage over a whole land (the
// Innate's third tier above all) needs it to be.
//
// The invariant, held by normalizeInvaderDamage: one entry per living unit, each in
// [0, health-1], sorted most-wounded first.
function createInvaderDamage() {
  return createLandMap(() => ({ explorers: [], towns: [], cities: [] }));
}

// `wavesResolved` is how far up the ladder the round has climbed, because the cap this holds
// wounds under is the unit's *current* health (see unitStats). Passing it is not optional in
// practice: normalizing a wave-100 board against the shipped health would clamp every wound
// the extra hit point allowed back down to the base cap, quietly healing the whole island.
function normalizeInvaderDamage(invaders, invaderDamage, wavesResolved) {
  const counts = normalizeInvaderCounts(invaders);
  const merged = invaderDamage || {};
  const wave = { round: { wavesResolved: wavesResolved || 0 } };

  return createLandMap((landId) => {
    const slot = merged[landId] || {};
    const out = {};

    for (const type of INVADER_TYPES) {
      const health = unitStats(wave, type).health;
      const count = counts[landId][type];
      const raw = Array.isArray(slot[type]) ? slot[type] : [];
      const list = [];

      // Length follows the count, not the stored array: a unit that died elsewhere in the
      // engine must not leave its wound behind for the next arrival to inherit. Damage caps
      // one short of the unit's health, because a unit at full damage would be a dead one.
      for (let i = 0; i < count; i += 1) {
        list.push(clamp(Math.floor(Number(raw[i]) || 0), 0, health - 1));
      }

      // Most wounded first, so "which unit does this land show a health ring for" has one
      // answer rather than depending on the order damage happened to arrive in.
      list.sort((a, b) => b - a);
      out[type] = list;
    }

    return out;
  });
}

function createDahanCounts() {
  return createLandMap(() => 0);
}

function normalizeDahanCounts(dahan) {
  const merged = dahan || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

function createBlightByLand() {
  return createLandMap(() => 0);
}

function normalizeBlightByLand(blightByLand) {
  const merged = blightByLand || {};
  return createLandMap((landId) => Math.max(0, Math.floor(merged[landId] || 0)));
}

// The two per-land bars, each a fraction of the next whole thing: 0 is a clean land, 1 is
// the moment a Blight lands or a Dahan falls. Floats on purpose - they fill every tick, and
// rounding them to whole points is what the old per-wave Ravage did wrong.
function createProgressByLand() {
  return createLandMap(() => 0);
}

function normalizeProgressByLand(progress) {
  const merged = progress || {};
  return createLandMap((landId) => {
    const raw = Number(merged[landId]);
    return Number.isFinite(raw) ? clamp(raw, 0, 1) : 0;
  });
}

/* ------------------------------------------------------------------ *
 * Transient feedback (06-ui-contract.md)                               *
 * ------------------------------------------------------------------ */

function normalizeDefeatFx(defeatFx) {
  if (!defeatFx || typeof defeatFx !== "object") return null;
  const land = isLandId(defeatFx.land) ? defeatFx.land : null;
  const unitType = ["explorers", "towns", "cities", "dahan"].includes(defeatFx.unitType) ? defeatFx.unitType : null;
  const count = Math.max(0, Math.floor(defeatFx.count || 0));
  const at = Number(defeatFx.at);
  if (!land || !unitType || count <= 0 || !Number.isFinite(at)) return null;
  return { land, unitType, count, at };
}

function normalizeBlightFx(blightFx) {
  if (!blightFx || typeof blightFx !== "object") return null;
  const lands = Array.isArray(blightFx.lands) ? blightFx.lands.filter(isLandId) : [];
  const amount = Math.max(0, Math.floor(blightFx.amount || 0));
  const at = Number(blightFx.at);
  if (lands.length === 0 || amount <= 0 || !Number.isFinite(at)) return null;
  return { lands, amount, at };
}

// The high_water_mark payout, for the Fear readout to flash. Unlike the other two this is not
// tied to a land: it is the HUD's own number that moved, so it carries the wave that paid
// rather than where it happened.
function normalizeFearFx(fearFx) {
  if (!fearFx || typeof fearFx !== "object") return null;
  const wave = Math.max(0, Math.floor(fearFx.wave || 0));
  const amount = Math.max(0, Math.floor(fearFx.amount || 0));
  const at = Number(fearFx.at);
  if (wave <= 0 || amount <= 0 || !Number.isFinite(at)) return null;
  return { wave, amount, at };
}

// The round-end flash, for the board to mark the instant itself rather than only the frozen
// state that follows it. Carries no payload - unlike the other three fx, what it announces is
// not a number or a land, just that the boundary was crossed - so a bare timestamp is enough.
function normalizeRoundEndFx(roundEndFx) {
  if (!roundEndFx || typeof roundEndFx !== "object") return null;
  const at = Number(roundEndFx.at);
  if (!Number.isFinite(at)) return null;
  return { at };
}

/* A card reaching the hand, for the board to say so and for the bar to light the card that
 * arrived. It carries the id because both readers need to name it - the reveal prints the
 * card's own text, and the bar has to find the one entry out of several to mark - and the
 * wave because that is the sentence the reveal is making: this is what wave 45 was worth.
 *
 * Written by both draw paths, the drip and the re-draw. A swap is a card arriving in hand by
 * every measure that matters here, and the re-draw is precisely the moment the player is
 * asking to be shown something.
 */
function normalizeCardFx(cardFx) {
  if (!cardFx || typeof cardFx !== "object") return null;
  const cardId = POWER_CARDS[cardFx.cardId] ? cardFx.cardId : null;
  const wave = Math.max(0, Math.floor(cardFx.wave || 0));
  const at = Number(cardFx.at);
  if (!cardId || !Number.isFinite(at)) return null;
  return { cardId, wave, at };
}

// The window is a parameter rather than the constant, because the card reveal outlives the
// other three by design - see CARD_FX_MS.
function fxIsFresh(fx, windowMs) {
  const span = Number.isFinite(windowMs) ? windowMs : DEFEAT_FX_MS;
  return Boolean(fx) && (nowMs() - fx.at) <= span;
}

function activeDefeatFx(state) {
  const fx = normalizeDefeatFx(state.ui && state.ui.defeatFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeBlightFx(state) {
  const fx = normalizeBlightFx(state.ui && state.ui.blightFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeFearFx(state) {
  const fx = normalizeFearFx(state.ui && state.ui.fearFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeRoundEndFx(state) {
  const fx = normalizeRoundEndFx(state.ui && state.ui.roundEndFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeCardFx(state) {
  const fx = normalizeCardFx(state.ui && state.ui.cardFx);
  return fxIsFresh(fx, CARD_FX_MS) ? fx : null;
}

function pruneFx(state) {
  if (!fxIsFresh(normalizeDefeatFx(state.ui.defeatFx))) state.ui.defeatFx = null;
  if (!fxIsFresh(normalizeBlightFx(state.ui.blightFx))) state.ui.blightFx = null;
  if (!fxIsFresh(normalizeFearFx(state.ui.fearFx))) state.ui.fearFx = null;
  if (!fxIsFresh(normalizeRoundEndFx(state.ui.roundEndFx))) state.ui.roundEndFx = null;
  if (!fxIsFresh(normalizeCardFx(state.ui.cardFx), CARD_FX_MS)) state.ui.cardFx = null;
}

function markDefeatFx(state, land, unitType, count) {
  const c = Math.max(0, Math.floor(count || 0));
  if (!isLandId(land) || c <= 0) return;
  state.ui.defeatFx = { land, unitType, count: c, at: nowMs() };
}

function markBlightFx(state, lands, amount) {
  const valid = (lands || []).filter(isLandId);
  if (valid.length === 0 || amount <= 0) return;
  state.ui.blightFx = { lands: valid, amount, at: nowMs() };
}

// Floored to match what the bank will actually pay, so the flash never promises a Fear the
// player does not get.
function markFearFx(state, wave, amount) {
  const w = Math.max(0, Math.floor(wave || 0));
  const a = Math.floor(amount || 0);
  if (w <= 0 || a <= 0) return;
  state.ui.fearFx = { wave: w, amount: a, at: nowMs() };
}

function markRoundEndFx(state) {
  state.ui.roundEndFx = { at: nowMs() };
}

/* Both draw paths call this, so both get the same announcement. An unknown id writes nothing
 * rather than a reveal with an empty face.
 *
 * And nothing is written at all while the opening is being fast-forwarded. CARD_FX_MS is 2600
 * *real* milliseconds and a card drips every wave, so at FAST_FORWARD_SPEED a wave arrives
 * every second and each reveal would be overwritten by the next one before it could be read -
 * the panel would flicker through a stack of cards and settle on whichever happened to be
 * last. A reveal nobody can read is not a reveal, and holding them back is what the shop row
 * says it does.
 *
 * The *cards* are unaffected: `grantPowerCard` has already run, the hand is exactly what it
 * would be at 1x, and the log still records every draw. Only the announcement is skipped, and
 * only for as long as it could not be seen.
 */
function markCardFx(state, cardId, wave) {
  if (!POWER_CARDS[cardId]) return;
  if (fastForwardActive(state)) return;
  state.ui.cardFx = { cardId, wave: Math.max(0, Math.floor(wave || 0)), at: nowMs() };
}

