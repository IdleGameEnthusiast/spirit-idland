/* ==================================================================== *
 * Spirit Idland - round engine                                          *
 *                                                                       *
 * Every rule the game has, and nothing that touches the DOM. The browser *
 * loads this before ui.js; the test harness loads the same file through  *
 * the export shim at the bottom.                                        *
 *                                                                       *
 * Spec: docs/spec/. Section numbers in comments point at the doc that    *
 * owns the rule, so a number here can always be traced to a decision.    *
 * ==================================================================== */

const SAVE_KEY = "spirit-idland-save-v1";
const VERSION = "5.0.0";

/* ------------------------------------------------------------------ *
 * Constants (04-economy-formulas.md)                                   *
 * ------------------------------------------------------------------ */

// How many real seconds one beat of the design costs. Every clock in the game is written as
// its beat count times this number, and every per-second rate as its beat rate divided by it,
// so the whole game is one dial away from running faster or slower without being rebalanced.
//
// At 2 the player gets twice the real time to read a board and answer it, and nothing else
// moves: a wave still costs one wave interval, an ability still fires the same number of times
// inside one, and a land under the same damage still takes exactly as many waves to Blight.
// The arithmetic that guarantees it is that the fight only ever spends *damage-seconds* - a
// doubled clock and a halved rate multiply back to the same total, at every moment of the
// round and not merely at its end.
//
// The one thing it does change is what a second means to a reader: every number below is real
// seconds, so anything comparing a constant against a stopwatch stays honest, and nothing may
// scale a duration a second time on the way to the screen.
const TIME_SCALE = 2;

// The player's speed dial: how many game seconds one real second buys. 1x is the game as it
// ships - the twenty-second wave TIME_SCALE above sets - 2x runs it at double speed for a
// ten-second wave, and 0x stops every clock in the round.
//
// It multiplies dt and nothing else, which is what keeps it a setting rather than a rule: a
// wave still costs one whole wave interval, an ability still fires the same number of times
// inside one, and a land under the same damage still takes exactly as many waves to Blight.
// Only the map from real seconds to game seconds moves.
const GAME_SPEEDS = [0, 1, 2];
const DEFAULT_GAME_SPEED = 1;

const WAVE_INTERVAL_SECONDS = 10 * TIME_SCALE;
const BLIGHT_THRESHOLD_BASE = 10;
const DAHAN_PER_ROUND_START_BASE = 6;
// Reinforcement is no longer capped per land - the shop can be pushed far past the sixteen
// a +2 cap allowed, and the extra tiers have to land somewhere. What is capped instead is
// the gap: no land may stand more than two Dahan above another, so nothing reaches 3 while
// a land is still empty.
const DAHAN_MAX_SPREAD = 2;
// A flash, not a clock: how long a defeat or Blight marker stays on the board. Deliberately
// outside TIME_SCALE - it is measured against how fast an eye catches a highlight, which no
// change of game pace moves.
const DEFEAT_FX_MS = 1200;
const MAX_TICK_SECONDS = 5 * TIME_SCALE;

// The whole fight runs on one currency: a damage-second. One point of damage sustained for
// one second is 1% of a Blight, and 2.5% of a Dahan casualty - 100 damage-seconds buys a
// Blight, 40 buys a casualty. The two rates were equal until the Dahan proved too durable to
// pressure; they are now deliberately apart, and the casualty clock is the one under playtest.
//
// Both are divided by TIME_SCALE, which is why the figures above are not the 50 and 20 the
// design was tuned at. A round lasts TIME_SCALE times as long in seconds and accrues at
// 1/TIME_SCALE the rate, so it still costs exactly 50 and 20 damage-*beats* - the ratio the
// balance actually rests on. Retune these against the beat rates (0.02 and 0.05), never
// against the seconds.
const BLIGHT_PER_DAMAGE_SECOND = 0.02 / TIME_SCALE;
const DAHAN_LOSS_PER_DAMAGE_SECOND = 0.05 / TIME_SCALE;

// The brake on stacking Dahan into one land: a land never cancels all of its Blight, only
// the share above this fraction of gross. Defence buys time, not immunity, so a stack has to
// be spent rather than parked.
const BLIGHT_FLOOR_FRACTION = 0.25;

// The Dahan's periodic strike against the invaders, on its own clock rather than the wave's.
// It starts at the wave interval only so the two read as one rhythm at round one; the shop
// is expected to shorten this later, and nothing should re-couple it to WAVE_INTERVAL_SECONDS.
const DAHAN_ATTACK_INTERVAL_SECONDS = 10 * TIME_SCALE;
const DAHAN_ATTACK_DAMAGE = 1;

/* ---------- The difficulty ladder ----------
 *
 * A round that survives its opening used to be flat: the Dahan out-kill the track and nothing
 * further threatens it. The ladder is what keeps a round finite. Every rung is keyed to the
 * wave count, which is per round like everything except Fear - so every round re-earns its own
 * difficulty, and reaching wave 60 in round 90 is exactly as hard as reaching it in round 2.
 * Nothing here reads the round number, and nothing should.
 *
 * Each rung is its own rule rather than a number tuned on the last one:
 *
 *    0  Discover runs at setup, so the island is never empty (see seedRoundExplore)
 *   10  Discover stops asking whether a land is reachable
 *   20  Discover seeds two Explorers per land instead of one
 *   30  A Town appears each wave in some land that has none
 *   40  Discover takes one extra land, off-terrain
 *   50  Discover draws two terrains instead of one
 *   60  Build runs twice
 *   70  Discover draws three terrains
 *   80  Discover draws every terrain
 *   90  Invaders hit harder, and again every 20 waves after
 *  100  Invaders are tougher, and again every 20 waves after
 *
 * Because the track slides forward (see shiftInvaderTrack), every rung that widens Discover
 * widens Build one wave later - the terrains discovered this wave are the ones built next.
 * That coupling is the point: the player watches a terrain thicken before it does.
 */
const EXPLORE_UNRESTRICTED_FROM_WAVE = 10;
const EXPLORE_DOUBLE_SEED_FROM_WAVE = 20;
const BONUS_TOWN_FROM_WAVE = 30;
const EXPLORE_EXTRA_LAND_FROM_WAVE = 40;
const BUILD_TWICE_FROM_WAVE = 60;

// How many terrains Discover draws, by wave. Read in order, first match wins - so the table
// reads top-down as the ladder climbs rather than as a chain of comparisons. `Infinity` is
// "every terrain there is", clamped against INVADER_TERRAINS at the point of use so this
// table never has to know how many that is.
const EXPLORE_TERRAIN_RUNGS = [
  { fromWave: 80, terrains: Infinity },
  { fromWave: 70, terrains: 3 },
  { fromWave: 50, terrains: 2 }
];

// The last two rungs never stop. From wave 90 every point of Invader damage is +1, and again
// every 20 waves; health does the same from 100, so the two alternate every ten waves forever
// and a round can always be out-scaled eventually. Damage is deliberately the first of the
// pair: power is read off damage (see gainFearFromDefeat), so a damage rung raises what an
// Invader is worth in the same stroke as what it threatens, and the two stay in agreement.
const INVADER_DAMAGE_RUNG_FROM_WAVE = 90;
const INVADER_HEALTH_RUNG_FROM_WAVE = 100;
const INVADER_STAT_RUNG_INTERVAL = 20;

/* ---------- The two Fear pools ----------
 *
 * Fear is earned into `round.fearEarned` and banked into `meta.fear` when the round ends.
 * Only the banked pool can be spent.
 *
 * The split exists because the shop no longer closes. Auto Start Round removes the pause
 * between rounds, so "Fear is a between-round currency" could no longer be enforced by the
 * clock - there is no longer a moment the shop is the only thing on screen. The rule is the
 * same one it always was, moved from *when* the player may spend to *which pool* they spend:
 * a round is paid out for what it survived, once, after it has survived it.
 *
 * What this stops is a round buying its own way out - banking a kill mid-fight and spending
 * it on Blight Resilience before the Blight lands. See activeUpgradeTier for the other half
 * of the same rule.
 */

// Fear per point of defeated invader power. An explorer is worth 1 power, a town 2,
// a city 3 - the same numbers as their damage, so a unit's threat and its worth agree.
const FEAR_PER_POWER = 1;

// Fear for living through a wave, paid when the wave resolves. The second half of the
// income: killing pays for what you clear, this pays for what you outlast. Without it a
// round that holds the line perfectly and kills little would earn almost nothing.
const FEAR_PER_WAVE = 1;

// Energy per point of that same power, on the same scale: killing an explorer pays 1,
// a town 2, a city 3. Fear and Energy are deliberately drawn from one number - a unit's
// threat is its worth, and a second scale would only ask the player to learn two. Since
// both rates are 1, a defeat now pays the same figure into each purse; what separates them
// is where else the income comes from, and how long it lasts.
//
// Energy is the round's own currency and it does not survive one: startRound zeroes it along
// with everything bought with it. The kit is rebuilt from scratch every round, and the only
// thing that carries is Fear - which is what the shop's permanent upgrades are drawn from.
// So the two currencies answer two different questions: Energy is "what can this round
// become", Fear is "what does every round start as".
const ENERGY_PER_POWER = 1;

// `damage` is now a rate: what the unit deals every second it stands in a land. A Dahan's 2
// is what it cancels out of the invader total, which is why one Dahan holds off two
// explorers exactly. `health` still only matters to invaders, who are killed in whole
// points; Dahan die to the casualty bar instead - see resolveContinuousCombat.
const UNIT_STATS = {
  explorers: { health: 1, damage: 1 },
  towns: { health: 2, damage: 2 },
  cities: { health: 3, damage: 3 },
  dahan: { health: 2, damage: 2 }
};

const INVADER_TYPES = ["explorers", "towns", "cities"];

// A rung that repeats: 0 before `fromWave`, then +1 for every INVADER_STAT_RUNG_INTERVAL
// waves on top of it. Kept as one function because damage and health differ only in where
// they start.
function repeatingRungBonus(wavesResolved, fromWave) {
  const wave = Math.max(0, Math.floor(Number(wavesResolved) || 0));
  if (wave < fromWave) return 0;
  return 1 + Math.floor((wave - fromWave) / INVADER_STAT_RUNG_INTERVAL);
}

// The stats a unit actually fights with this wave, as opposed to the ones it shipped with.
// Every reader goes through here - damage rates, wound caps, the Fear a defeat pays, and the
// numbers the panel prints - so no two of them can disagree about how big an Invader is.
//
// Dahan never ride the ladder. It scales what the island throws at the player, and scaling
// the answer alongside the question would leave the round exactly where it started.
function unitStats(state, unitType) {
  const base = UNIT_STATS[unitType];
  if (!base) return { health: 0, damage: 0 };
  if (!INVADER_TYPES.includes(unitType)) return base;

  const wave = state && state.round ? state.round.wavesResolved : 0;
  return {
    health: base.health + repeatingRungBonus(wave, INVADER_HEALTH_RUNG_FROM_WAVE),
    damage: base.damage + repeatingRungBonus(wave, INVADER_DAMAGE_RUNG_FROM_WAVE)
  };
}

// Strongest first. Read wherever damage has to break a tie between two units it could hit
// equally well, and by the defeat banner when it picks which loss to name.
const INVADER_TYPES_BY_TIER = ["cities", "towns", "explorers"];

/* ------------------------------------------------------------------ *
 * Injectable clock and RNG                                             *
 *                                                                      *
 * Both exist so tests can run a whole round in a millisecond and get    *
 * the same board every time. Production passes nothing and gets         *
 * Date.now and Math.random.                                             *
 * ------------------------------------------------------------------ */

let nowSource = () => Date.now();
let rngSource = () => Math.random();

function nowMs() {
  return nowSource();
}

function rng() {
  return rngSource();
}

function setNowSource(fn) {
  nowSource = typeof fn === "function" ? fn : () => Date.now();
}

function setRng(fn) {
  rngSource = typeof fn === "function" ? fn : () => Math.random();
}

/* ------------------------------------------------------------------ *
 * Content registry (07-content-registry.md)                            *
 * ------------------------------------------------------------------ */

const SPIRITS = {
  core_spirit_01: {
    id: "core_spirit_01",
    name: "Reissende Fluten im Sonnenlicht",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Stroeme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
    traitsEn: "Swift currents displace invaders and keep the land in motion. Focus: control, positioning, and steady flow.",
    // The spirit's whole kit, in bar order: the Innate first because it is the only one that
    // grows, then the free faucet, then the three Energy unlocks in ascending price. The bar
    // reads top to bottom as the order a round is actually built in.
    abilityIds: ["innate_power", "boon_of_vigor", "rivers_bounty", "flash_floods", "wash_away"],
    // What every round opens with. The rest are locked behind Energy earned in that same
    // round, so round one is two abilities used well rather than five used at random.
    startingAbilityIds: ["innate_power", "boon_of_vigor"],
    // The baseline Dahan placement every round starts from, before upgrades. Six across
    // eight lands, skipping 3 and 8 - the two lands hardest to reinforce later.
    roundStartDahan: { "1": 1, "2": 1, "4": 1, "5": 1, "6": 1, "7": 1 }
  }
};

// The spirit's kit. `unlockCost` is what the ability costs in Energy this round - 0 means it
// is in the opening hand. The ladder 5 / 10 / 20 is deliberately steep against a round's
// income: the three unlocks together are about one early round's worth, so which two you buy
// is the round's first real decision.
//
// The Innate is the one ability that grows rather than being bought once. Its `tiers` array
// replaces the record wholesale - text, cooldown, effect and all - so tier 2 is not tier 1
// with a modifier, it is a different ability standing in the same slot. Read one with
// abilityRecord(), never by reaching into ABILITIES directly, or a tiered ability will
// silently answer with its tier-1 self.
//
// Cooldowns rise with the tier on purpose. Throughput still improves at every step - tier 2
// is three pushes and 2 damage per 8 beats against tier 1's one push per 4 - so the longer
// wait buys a bigger swing rather than taxing the upgrade.
//
// Every cooldown here is written as beats times TIME_SCALE, the same dial the wave interval
// turns on. That is what keeps a cast rate a cast rate: an ability that fired twice a wave at
// scale 1 fires twice a wave at any scale, because both clocks stretched together.
const ABILITIES = {
  innate_power: {
    id: "innate_power",
    unlockCost: 0,
    tiers: [
      {
        cooldownSeconds: 8 * TIME_SCALE,
        needsTarget: true,
        effect: "push_invaders",
        pushCount: 1,
        upgradeCost: 50
      },
      {
        cooldownSeconds: 16 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_and_push",
        damage: 2,
        pushCount: 3,
        upgradeCost: 250
      },
      {
        cooldownSeconds: 24 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_each_invader",
        damage: 2,
        upgradeCost: Infinity
      }
    ]
  },
  boon_of_vigor: {
    id: "boon_of_vigor",
    unlockCost: 0,
    cooldownSeconds: 12 * TIME_SCALE,
    needsTarget: false,
    effect: "gain_energy",
    amount: 1
  },
  // The one ability that picks its own land: the thinnest-held land under attack, or simply
  // the thinnest-held land when nothing is under attack. It needs no click because there is
  // only ever one answer to "where is this most needed", and asking would be asking the
  // player to re-derive it.
  rivers_bounty: {
    id: "rivers_bounty",
    unlockCost: 5,
    cooldownSeconds: 15 * TIME_SCALE,
    needsTarget: false,
    effect: "add_dahan",
    amount: 1
  },
  flash_floods: {
    id: "flash_floods",
    unlockCost: 10,
    cooldownSeconds: 25 * TIME_SCALE,
    needsTarget: true,
    effect: "flood_damage",
    damage: 1,
    coastalBonus: 1
  },
  wash_away: {
    id: "wash_away",
    unlockCost: 20,
    cooldownSeconds: 35 * TIME_SCALE,
    needsTarget: true,
    effect: "push_invaders",
    pushCount: 3
  }
};

const ABILITY_IDS = Object.keys(ABILITIES);

// Costs scale with the tier already owned, so the shop stays a choice rather than a
// checklist. 1.6x per tier outruns what a tier is worth: with attrition flat, a Dahan tier
// buys about 11% more income, so the price pulls away from the payoff instead of chasing it.
const UPGRADE_COST_GROWTH = 1.6;

// Repeatable tiers first, then the one-off unlocks. The shop renders them in this order and
// draws the line between the two halves where `repeatable` stops.
const UPGRADES = {
  dahan_reinforcement: {
    id: "dahan_reinforcement",
    repeatable: true,
    effect: "dahan_bonus_per_tier",
    baseCost: 10,
    // Past eight the island runs out of room to spread them and the tiers stop paying.
    maxTier: 8
  },
  blight_resilience: {
    id: "blight_resilience",
    repeatable: true,
    effect: "blight_threshold_per_tier",
    // Cheap and capped on purpose. Invader power grows faster than linearly, so Blight
    // accrues faster than the threshold can be raised: ten tiers measured at +6% round
    // length. It is a small comfort for an early round, priced like one, and it is not the
    // shop's growth lever - reinforcement and the one-offs are.
    baseCost: 3,
    maxTier: 5
  },

  auto_boon: {
    id: "auto_boon",
    repeatable: false,
    effect: "auto_cast_boon",
    // Priced as comfort, not as power. Measured against a player who was already clicking the
    // Boon on cooldown it is worth 0-2% more Fear a round: it buys back a click every twelve
    // beats and nothing else. Roughly one round's income, which is what a convenience
    // should cost - the shop's power lives in the ladders above.
    baseCost: 25
  },
  auto_innate: {
    id: "auto_innate",
    repeatable: false,
    effect: "auto_cast_innate",
    // Priced well above auto_boon (25): the Innate fires more often at every tier (8/16/24
    // beats against the Boon's flat 12) and, unlike the Boon, its cast is a real decision -
    // which land - that this buys back rather than a fixed no-target effect. It stays a
    // one-time comfort purchase, just a pricier one.
    baseCost: 100
  },
  auto_wash_away: {
    id: "auto_wash_away",
    repeatable: false,
    effect: "auto_cast_wash_away",
    // The cheapest of the three targeted automations, because the push never kills. It moves
    // invaders off a land rather than off the board, and its value is highest early and
    // thinnest late - by the time every land holds something there is nowhere left to push
    // to. A permanent purchase whose worth decays is priced under one whose worth compounds.
    baseCost: 150
  },
  auto_bounty: {
    id: "auto_bounty",
    repeatable: false,
    effect: "auto_cast_bounty",
    // The one automation that is not comfort. A Dahan every 15 beats, all round, is the same
    // thing the reinforcement ladder sells - and it is priced against that ladder's last rung
    // (10 * 1.6^7, about 268) rather than against the other auto upgrades, because that is
    // what it competes with. Automating the click is incidental; this buys the Dahan.
    baseCost: 250
  },
  auto_start_round: {
    id: "auto_start_round",
    repeatable: false,
    effect: "auto_start_round",
    // The most expensive thing in the shop, and the only one that changes the shape of the
    // game rather than a number in it: rounds stop needing a hand on them. It is priced as a
    // milestone - several rounds of income even once the ladders are deep - because what it
    // buys is every round after it.
    baseCost: 500
  }
};

const UPGRADE_IDS = Object.keys(UPGRADES);

/* ------------------------------------------------------------------ *
 * The island (09-island-board.md)                                      *
 * ------------------------------------------------------------------ */

const INVADER_TERRAINS = ["mountains", "desert", "jungle", "wetlands"];

// Built to the published structure of a standard Spirit Island board: eight lands, exactly
// two of each terrain, and three coastal lands rather than four. Coastal means touching the
// board's ocean edge; the other borders are cliffs and do not count.
//
// Three coasts over four terrains means one terrain has no coast at all. That is mountains
// here, which is why Discover cannot seed explorers into lands 4 and 6 until the invaders
// have already worked inland.
//
// Adjacency is symmetric and deliberately uneven: land 5 is a six-neighbour hub, land 3 is
// a two-neighbour corner. Never assume a land has four neighbours.
// `rect` is the land's footprint in board space: u runs left to right, v runs from the back
// of the board (0) to the ocean edge (1). Every adjacency below falls out of these
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

// Terrain hues, mirrored in app.css. One value per terrain so a land, its chip, and its
// detail panel can never disagree about what colour it is.
const TERRAIN_RGB = {
  mountains: "171, 184, 196",
  desert: "242, 196, 90",
  jungle: "124, 198, 116",
  wetlands: "118, 179, 222"
};

// Land IDs are strings, never numbers: JSON object keys are strings, so a numeric id would
// silently stop matching itself after a save/load round-trip.
const LAND_IDS = Object.keys(BOARD_LANDS);

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

// The same, for a phase that covers several terrains. Still id order, and still one entry per
// land however many terrains asked for it.
function landsOfTerrains(terrains) {
  const wanted = terrainList(terrains);
  return LAND_IDS.filter((landId) => wanted.includes(BOARD_LANDS[landId].terrain));
}

// Both phase slots hold a *list* of terrains, now that the ladder can widen Discover past
// one. Every read goes through here, so a slot holding a bare terrain string - a save written
// before the ladder, or a test that set one by hand - still reads as the one-terrain list it
// means. Duplicates are dropped and the result is put in INVADER_TERRAINS order, so a slot
// prints the same way however it was drawn.
function terrainList(value) {
  const raw = Array.isArray(value) ? value : [value];
  const out = [];
  for (const terrain of raw) {
    if (INVADER_TERRAINS.includes(terrain) && !out.includes(terrain)) out.push(terrain);
  }
  return out.sort((a, b) => INVADER_TERRAINS.indexOf(a) - INVADER_TERRAINS.indexOf(b));
}

// Builds a fresh land-keyed map. `factory` returns the value for one land.
function createLandMap(factory) {
  const out = {};
  for (const landId of LAND_IDS) out[landId] = factory(landId);
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* ------------------------------------------------------------------ *
 * Localization                                                         *
 * ------------------------------------------------------------------ */

const I18N = {
  de: {
    langToggle: "English",

    hudTitle: "Runde",
    roundLabel: "Welle",
    bestWaveLabel: "Hoechste Welle",
    blightLabel: "Verderbnis",
    waveLabel: "Naechste Welle",
    fearLabel: "Furcht",
    // Die Furcht dieser Runde ist noch nicht ausgebbar - sie wird erst am Rundenende gebucht.
    fearPendingHint: "+{fear} in dieser Runde",
    secondsShort: "{seconds}s",
    // The two readings the wave tile has that are not a countdown: a stopped clock, and a
    // wave standing due behind the gate waiting to be called.
    wavePausedValue: "Pause",
    waveHeldValue: "Wartet",
    startNextWaveBtn: "Welle starten",
    autoWaveOnBtn: "Auto: An",
    autoWaveOffBtn: "Auto: Aus",
    autoWaveHint: "Naechste Welle laeuft von selbst an. Aus: am Ende der Leiste haelt die Zeit an, bis du die Welle startest.",
    autoRoundOnBtn: "Auto-Runde: An",
    autoRoundOffBtn: "Auto-Runde: Aus",
    autoRoundHint: "Die naechste Runde startet von selbst. Aus: der Laden bleibt offen, bis du sie startest.",
    speedLabel: "Tempo",
    speedOptionTitle: "Spieltempo {speed}x",
    speedPausedTitle: "Pause - die Zeit steht still",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Aktiver Geist:",

    abilitiesTitle: "Faehigkeiten",
    abilitiesHint: "Einsetzen kostet nur Abklingzeit. Energie schaltet neue Faehigkeiten frei.",
    energyLabel: "Energie",
    energyHint: "Energie kommt aus besiegten Invasoren: 1 pro Entdecker, 2 pro Dorf, 3 pro Stadt. Boon of Vigor gibt +1. Zu Rundenbeginn faellt sie auf 0 zurueck - und alles, was mit ihr gekauft wurde, mit ihr.",
    abilityReady: "Bereit",
    abilityArmed: "Ziel waehlen",
    abilityCooldown: "{seconds}s",
    abilityLocked: "Gesperrt",
    abilityUnlockBtn: "{cost} Energie",
    abilityTierLabel: "Stufe {tier}",
    abilityUpgradeBtn: "Stufe {tier}: {cost} Energie",
    abilityNames: {
      innate_power: "Angeborene Kraft",
      boon_of_vigor: "Boon of Vigor",
      rivers_bounty: "River's Bounty",
      flash_floods: "Flash Floods",
      wash_away: "Wash Away"
    },
    // The Innate carries one text per tier, in tier order. Every other ability carries one.
    abilityTexts: {
      innate_power: [
        "Schiebt {push} Entdecker/Dorf in ein angrenzendes Gebiet ohne Invasoren.",
        "{damage} Schaden. Schiebt bis zu {push} Entdecker/Doerfer in ein angrenzendes Gebiet ohne Invasoren.",
        "{damage} Schaden auf jeden Invasor im gewaehlten Gebiet."
      ],
      boon_of_vigor: "+{amount} Energie.",
      rivers_bounty: "+{amount} Dahan im Gebiet mit den wenigsten Dahan und Invasoren, wenn moeglich.",
      flash_floods: "{damage} Schaden. Liegt das Ziel an der Kueste: +{coastal} Schaden.",
      wash_away: "Schiebt bis zu {push} Entdecker/Doerfer in ein angrenzendes Gebiet ohne Invasoren."
    },

    mapTitle: "Die Insel",
    mapPlanHint: "Acht Gebiete, drei an der Kueste. Waehle ein Gebiet fuer Details.",
    mapHintArmed: "{ability}: {requirement}",
    mapHintWave: "Naechste Welle baut in {terrain} ({lands}).",
    abilityNeedInvaders: "waehle ein Gebiet mit Invasoren.",
    abilityNeedPushable: "waehle ein Gebiet mit Entdeckern/Doerfern und einem freien Nachbarn.",
    abilityNeedAnyLand: "waehle ein beliebiges Gebiet.",

    shopTitle: "Zwischen den Runden",
    shopLostRound: "Runde {round} verloren. {fear} Furcht in dieser Runde erbeutet.",
    // Waehrend eine Runde laeuft, steht statt der Verlustmeldung, was sie bisher eingebracht
    // hat - und dass es erst am Rundenende gebucht wird.
    shopRoundRunning: "Runde {round} laeuft, Welle {wave}. {fear} Furcht bisher - buchbar am Rundenende.",
    shopFearLabel: "Verfuegbare Furcht",
    shopTierLabel: "Stufe {tier}",
    shopCostLabel: "{cost} Furcht",
    shopBuyBtn: "Kaufen",
    shopMaxedBtn: "Maximum",
    // A one-off is owned, not maxed: there was never a ladder for it to reach the top of.
    shopOwnedBtn: "Gekauft",
    shopOneOffLabel: "Einmalig",
    // Waehrend der Runde gekauft: gehoert dir, wirkt aber erst ab der naechsten Runde.
    shopPendingHint: "Wirkt ab der naechsten Runde.",
    startNextRoundBtn: "Naechste Runde starten",
    upgradeNames: {
      dahan_reinforcement: "Verstaerkung der Dahan",
      blight_resilience: "Widerstand gegen Verderbnis",
      auto_boon: "Segen von selbst",
      auto_innate: "Angeborener Instinkt",
      auto_wash_away: "Stroemung von selbst",
      auto_bounty: "Gabe des Flusses",
      auto_start_round: "Die Flut kehrt wieder"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 Dahan zu Rundenbeginn, pro Stufe.",
      blight_resilience: "+1 Verderbnisgrenze, pro Stufe.",
      auto_boon: "Boon of Vigor wirkt sich selbst, sobald es bereit ist.",
      auto_innate: "Die Angeborene Kraft wirkt sich selbst, sobald sie bereit ist - auf jeder Stufe, die du besitzt.",
      auto_wash_away: "Wash Away wirkt sich selbst und sucht sich sein Ziel - sobald es freigeschaltet und bereit ist.",
      auto_bounty: "River's Bounty wirkt sich selbst, sobald es freigeschaltet und bereit ist.",
      auto_start_round: "Die naechste Runde startet von selbst. Abschaltbar, wenn du in Ruhe einkaufen willst."
    },

    logTitle: "Spielprotokoll",
    manualSaveBtn: "Jetzt speichern",
    wipeSaveBtn: "Spielstand loeschen",
    autosaveHint: "Autosave alle 10s.",

    explorersLabel: "Entdecker",
    townsLabel: "Doerfer",
    citiesLabel: "Staedte",
    // Build and defeat lines name one unit at a time, and "+1 Staedte" reads as a typo.
    explorersOne: "Entdecker",
    townsOne: "Dorf",
    citiesOne: "Stadt",
    dahanLabel: "Dahan",
    invadersLabel: "Invasoren",
    ownForcesLabel: "Eigene Kraefte",
    noInvadersHere: "Keine Invasoren.",
    neighboursLabel: "Angrenzend",
    coastalLabel: "Kueste",
    inlandLabel: "Binnenland",
    invaderHpHint: "HP {current}/{max}",
    landBlightLabel: "Verderbnis hier",
    defeatHint: "Besiegt: -{count} {unit}",
    blightHint: "+{amount} Verderbnis",

    etaNever: "nie",
    pressureNoInvaders: "keine Invasoren",
    pressureHeld: "gehalten - {line}",
    pressureChip: "+{rate}% / s - naechste in {eta}",
    pressureDetail: "{gross} Schaden - {defence} Dahan = {net}/s. +{rate}% Verderbnis pro Sekunde, naechste in {eta}.",
    pressureDetailHeld: "{gross} Schaden gegen {defence} Dahan-Abwehr: aufgehalten, aber {net}/s sickern durch. +{rate}% Verderbnis pro Sekunde, naechste in {eta}.",
    buildChip: "+1 {unit}",
    buildChipNone: "nichts hier",
    blightBarLabel: "Verderbnis",
    dahanBarLabel: "Dahan-Gesundheit",
    invaderBarLabel: "Gesundheit",

    invaderTrackTitle: "Invasorenleiste",
    buildLabel: "Bauen:",
    discoverLabel: "Entdecken:",
    dahanAttackLabel: "Dahan-Angriff",
    buildWord: "Bauen",
    discoverWord: "Entdecken",
    invaderNone: "-",
    landDisplay: "Gebiet {id} - {terrain}",
    landShort: "Gebiet {id}",
    invaderLandNames: {
      mountains: "Berge",
      desert: "Wueste",
      jungle: "Dschungel",
      wetlands: "Suempfe"
    },

    roundStarted: "Runde {round} beginnt. Verderbnisgrenze {threshold}.",
    roundEnded: "Runde {round} verloren bei Welle {wave}: Verderbnis {blight}/{threshold}. {fear} Furcht gebucht.",
    waveResolved: "Welle {wave} aufgeloest.",
    waveIncoming: "Invasorenleiste - Bauen: {build}, Entdecken: {discover}.",
    dahanAttackResolved: "Dahan greifen in {land} an: {damage} Schaden, {defeated} Invasoren besiegt.",
    dahanAttackNoTargets: "Dahan-Angriff: kein Gebiet mit Invasoren und Dahan.",
    dahanFell: "{count} Dahan fallen in {land}. Noch {left} uebrig.",
    blightGained: "Verderbnis in {land}: +{amount}. Gesamt {total}/{threshold}.",
    buildNothing: "Bauen: noch kein Gebiet auf der Leiste.",
    buildNoInvaders: "Bauen in {land}: keine Invasoren, nichts wird gebaut.",
    buildResolved: "Bauen in {land}: +1 {unit}.",
    exploreNothing: "Entdecken: kein Gebiet gezogen.",
    exploreResolved: "Entdecken in {land}: +{count} Entdecker.",
    exploreBlocked: "Entdecken in {land}: kein Zugang, keine Kueste und kein Dorf/keine Stadt daneben.",
    exploreNoneReachable: "Entdecken in {terrain}: kein Gebiet erreichbar.",
    bonusTownResolved: "Ein Dorf erhebt sich in {land}.",
    setupExplore: "Die Invasoren gehen an Land.",
    dahanRoundLog: "Dahan versammeln sich: {summary}.",

    abilityOnCooldown: "{ability} klingt noch {seconds}s ab.",
    abilityArmedLog: "{ability}: waehle ein Ziel.",
    abilityCancelled: "{ability} abgebrochen.",
    abilityNoTarget: "{ability} findet kein gueltiges Ziel. Abklingzeit laeuft nicht.",
    abilityIllegalTarget: "{land} ist kein gueltiges Ziel fuer {ability}.",
    boonResolved: "Boon of Vigor: +{amount} Energie.",
    pushResolved: "{ability}: {total} Einheiten von {from} nach {to} geschoben.",
    damageResolved: "{ability} in {land}: {damage} Schaden, {defeated} Invasoren besiegt.",
    damageEachResolved: "{ability} in {land}: {damage} Schaden auf jeden Invasor, {defeated} besiegt.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}. Jetzt {total} dort.",

    abilityUnlocked: "{ability} freigeschaltet fuer {cost} Energie.",
    abilityUnlockTooExpensive: "{ability} kostet {cost} Energie. Du hast {energy}.",
    abilityUpgraded: "{ability} auf Stufe {tier} gebracht fuer {cost} Energie.",
    abilityUpgradeTooExpensive: "Stufe {tier} von {ability} kostet {cost} Energie. Du hast {energy}.",

    upgradePurchased: "Gekauft: {upgrade} (Stufe {tier}) fuer {cost} Furcht.",
    upgradeTooExpensive: "{upgrade} kostet {cost} Furcht. Du hast {fear}.",
    upgradeMaxed: "{upgrade} ist bereits auf der hoechsten Stufe.",

    migrationReset: "Alter Spielstand (Version {version}) ist nicht mit dem Rundenmodus kompatibel und wurde zurueckgesetzt.",
    saveWiped: "Spielstand geloescht.",
    manualSaved: "Manuelles Speichern abgeschlossen.",
    spiritAwakens: "Der Geist erwacht."
  },

  en: {
    langToggle: "Deutsch",

    hudTitle: "Round",
    roundLabel: "Wave",
    bestWaveLabel: "Highest wave",
    blightLabel: "Blight",
    waveLabel: "Next wave",
    fearLabel: "Fear",
    fearPendingHint: "+{fear} this round",
    secondsShort: "{seconds}s",
    wavePausedValue: "Paused",
    waveHeldValue: "Waiting",
    startNextWaveBtn: "Start wave",
    autoWaveOnBtn: "Auto: on",
    autoWaveOffBtn: "Auto: off",
    autoWaveHint: "Let the next wave start by itself. Off: time stops at the end of the bar until you start the wave.",
    autoRoundOnBtn: "Auto round: on",
    autoRoundOffBtn: "Auto round: off",
    autoRoundHint: "Let the next round start by itself. Off: the shop stays open until you start it.",
    speedLabel: "Speed",
    speedOptionTitle: "Game speed {speed}x",
    speedPausedTitle: "Paused - time stands still",
    blightMeter: "{value} / {max}",
    activeSpiritLabel: "Active spirit:",

    abilitiesTitle: "Abilities",
    abilitiesHint: "Casting costs only a cooldown. Energy unlocks new abilities.",
    energyLabel: "Energy",
    energyHint: "Energy comes from defeated invaders: 1 per Explorer, 2 per Town, 3 per City. Boon of Vigor grants +1. It resets to 0 when a round starts - and everything bought with it goes with it.",
    abilityReady: "Ready",
    abilityArmed: "Pick a land",
    abilityCooldown: "{seconds}s",
    abilityLocked: "Locked",
    abilityUnlockBtn: "{cost} Energy",
    abilityTierLabel: "Tier {tier}",
    abilityUpgradeBtn: "Tier {tier}: {cost} Energy",
    abilityNames: {
      innate_power: "Innate Power",
      boon_of_vigor: "Boon of Vigor",
      rivers_bounty: "River's Bounty",
      flash_floods: "Flash Floods",
      wash_away: "Wash Away"
    },
    abilityTexts: {
      innate_power: [
        "Push {push} Explorer/Town into an adjacent land without invaders.",
        "Deal {damage} damage. Push up to {push} Explorers/Towns into an adjacent land without invaders.",
        "Deal {damage} damage to each invader in the chosen land."
      ],
      boon_of_vigor: "Gain {amount} Energy.",
      rivers_bounty: "+{amount} Dahan to the land with the fewest Dahan and Invaders if possible.",
      flash_floods: "{damage} damage. If the target land is coastal, +{coastal} damage.",
      wash_away: "Push up to {push} Explorers/Towns into an adjacent land without invaders."
    },

    mapTitle: "The Island",
    mapPlanHint: "Eight lands, three of them coastal. Pick a land for details.",
    mapHintArmed: "{ability}: {requirement}",
    mapHintWave: "Next wave builds in {terrain} ({lands}).",
    abilityNeedInvaders: "pick a land holding invaders.",
    abilityNeedPushable: "pick a land with Explorers/Towns and a free neighbour.",
    abilityNeedAnyLand: "pick any land.",

    shopTitle: "Between Rounds",
    shopLostRound: "Round {round} lost. {fear} Fear earned this round.",
    shopRoundRunning: "Round {round} running, wave {wave}. {fear} Fear so far - banked when the round ends.",
    shopFearLabel: "Fear available",
    shopTierLabel: "Tier {tier}",
    shopCostLabel: "{cost} Fear",
    shopBuyBtn: "Buy",
    shopMaxedBtn: "Maxed",
    shopOwnedBtn: "Owned",
    shopOneOffLabel: "One-off",
    shopPendingHint: "Takes effect next round.",
    startNextRoundBtn: "Start next round",
    upgradeNames: {
      dahan_reinforcement: "Dahan Reinforcement",
      blight_resilience: "Blight Resilience",
      auto_boon: "Boon Unbidden",
      auto_innate: "Innate Instinct",
      auto_wash_away: "The Current Unbidden",
      auto_bounty: "The River Provides",
      auto_start_round: "The Tide Returns"
    },
    upgradeTexts: {
      dahan_reinforcement: "+1 starting Dahan, per tier.",
      blight_resilience: "+1 Blight threshold, per tier.",
      auto_boon: "Boon of Vigor casts itself whenever it is ready.",
      auto_innate: "The Innate casts itself whenever it is ready, at whichever tier you own.",
      auto_wash_away: "Wash Away casts itself and picks its own target, once unlocked and ready.",
      auto_bounty: "River's Bounty casts itself, once unlocked and ready.",
      auto_start_round: "The next round starts by itself. Switch it off when you want to shop in peace."
    },

    logTitle: "Event log",
    manualSaveBtn: "Save now",
    wipeSaveBtn: "Wipe save",
    autosaveHint: "Autosave every 10s.",

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
    buildChip: "+1 {unit}",
    buildChipNone: "nothing here",
    blightBarLabel: "Blight",
    dahanBarLabel: "Dahan health",
    invaderBarLabel: "Health",

    invaderTrackTitle: "Invader track",
    buildLabel: "Build:",
    discoverLabel: "Discover:",
    dahanAttackLabel: "Dahan attack",
    buildWord: "Build",
    discoverWord: "Discover",
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
    damageResolved: "{ability} in {land}: {damage} damage, {defeated} invaders defeated.",
    damageEachResolved: "{ability} in {land}: {damage} damage to each invader, {defeated} defeated.",
    riversBountyResolved: "River's Bounty: +{amount} Dahan in {land}. {total} standing there now.",

    abilityUnlocked: "{ability} unlocked for {cost} Energy.",
    abilityUnlockTooExpensive: "{ability} costs {cost} Energy. You have {energy}.",
    abilityUpgraded: "{ability} raised to tier {tier} for {cost} Energy.",
    abilityUpgradeTooExpensive: "Tier {tier} of {ability} costs {cost} Energy. You have {energy}.",

    upgradePurchased: "Purchased: {upgrade} (tier {tier}) for {cost} Fear.",
    upgradeTooExpensive: "{upgrade} costs {cost} Fear. You have {fear}.",
    upgradeMaxed: "{upgrade} is already at its highest tier.",

    migrationReset: "The old save (version {version}) is not compatible with the round-based build and was reset.",
    saveWiped: "Save wiped.",
    manualSaved: "Manual save completed.",
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

function terrainLandsSummary(state, terrain) {
  const t = locale(state);
  const lands = landsOfTerrains(terrain);
  if (lands.length === 0) return t.invaderNone;
  return lands.map((landId) => template(t.landShort, { id: landId })).join(", ");
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

  return template(raw, {
    amount: record.amount || 0,
    damage: record.damage || 0,
    coastal: record.coastalBonus || 0,
    push: record.pushCount || 0
  });
}

// What an armed ability is waiting for, in words. The board dims to teach the same rule;
// this is the sentence version of it.
function abilityRequirementText(state, abilityId) {
  const t = locale(state);
  const record = abilityRecord(state, abilityId);
  if (!record || !record.needsTarget) return "";
  return record.effect === "push_invaders" ? t.abilityNeedPushable : t.abilityNeedInvaders;
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
  const held = gross > 0 && defence >= gross;
  const net = Math.max(gross - defence, gross * BLIGHT_FLOOR_FRACTION);

  const blightPerSecond = net * BLIGHT_PER_DAMAGE_SECOND;
  const dahanPerSecond = dahan > 0 ? gross * DAHAN_LOSS_PER_DAMAGE_SECOND : 0;

  const blightProgress = (state.round.blightProgress || {})[landId] || 0;
  const dahanProgress = (state.round.dahanProgress || {})[landId] || 0;

  return {
    gross,
    dahan,
    defence,
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
    net: formatAmount(p.net),
    rate: pctText(p.blightPerSecond),
    eta: etaText(state, p.blightEta)
  };
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

function upgradeText(state, upgradeId) {
  const t = locale(state);
  return (t.upgradeTexts && t.upgradeTexts[upgradeId]) || "";
}

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
// built" would be the ladder undoing itself.
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

// Two slots, not three. Ravaging is no longer a phase that picks a terrain - invaders damage
// the land they stand in, continuously, everywhere at once (02-core-loop.md#the-fight).
function normalizeInvaderPhases(invader, state) {
  const build = terrainList(invader && invader.build);
  let explore = terrainList(invader && invader.explore);

  // A save written before Discover could widen holds one terrain where the round now wants
  // several, so the wanted count is taken from the ladder and the slot redrawn to match
  // rather than patched - the count and the contents always agree afterwards.
  const wanted = state ? exploreTerrainCount(state) : Math.max(1, explore.length);

  // Build and Discover still never name the same thing while there is room for them not to.
  // Once Discover takes every terrain there is no room, and the clash stops being one.
  const clashes = wanted < INVADER_TERRAINS.length
    && explore.length > 0
    && explore.every((terrain) => build.includes(terrain));

  if (explore.length !== wanted || clashes) explore = drawInvaderTerrains(wanted, build);

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

function createEssencePools() {
  const out = {};
  for (const terrain of INVADER_TERRAINS) out[terrain] = 0;
  return out;
}

// Inert placeholder: nothing writes essence in the round-based design. Kept so a later
// redesign has somewhere to land without another schema bump.
function normalizeEssencePools(essence) {
  const merged = essence || {};
  const out = {};
  for (const terrain of INVADER_TERRAINS) out[terrain] = Math.max(0, Math.floor(merged[terrain] || 0));
  return out;
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

function fxIsFresh(fx) {
  return Boolean(fx) && (nowMs() - fx.at) <= DEFEAT_FX_MS;
}

function activeDefeatFx(state) {
  const fx = normalizeDefeatFx(state.ui && state.ui.defeatFx);
  return fxIsFresh(fx) ? fx : null;
}

function activeBlightFx(state) {
  const fx = normalizeBlightFx(state.ui && state.ui.blightFx);
  return fxIsFresh(fx) ? fx : null;
}

function pruneFx(state) {
  if (!fxIsFresh(normalizeDefeatFx(state.ui.defeatFx))) state.ui.defeatFx = null;
  if (!fxIsFresh(normalizeBlightFx(state.ui.blightFx))) state.ui.blightFx = null;
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

// Cost of the *next* tier. Rounded to whole Fear so the shop never shows 6.4 Fear.
function upgradeCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const tier = upgradeTier(state, upgradeId);
  return Math.round(record.baseCost * Math.pow(UPGRADE_COST_GROWTH, tier));
}

// The permanent baseline every round starts from (04 Round Reset Formula).
function upgradeTotals(state) {
  return {
    dahanBonus: upgradeTier(state, "dahan_reinforcement"),
    blightThresholdBonus: upgradeTier(state, "blight_resilience"),
    // No upgrade moves cooldowns today. The multiplier stays in the round state because the
    // next cooldown upgrade will want it, and a round that reads 1 costs nothing to keep.
    cooldownReductionPct: 0
  };
}

function purchaseUpgrade(state, upgradeId) {
  const t = locale(state);
  const record = UPGRADES[upgradeId];
  if (!record) return false;

  // No check on the round's status. The shop is always open now that Auto Start Round can
  // remove the pause it used to live in - what keeps a round from buying its own way out is
  // the pool the Fear sits in, not the clock (see the two-pool note above FEAR_PER_POWER).
  const tier = upgradeTier(state, upgradeId);
  if (tier >= upgradeMaxTier(upgradeId)) {
    addLog(state, template(t.upgradeMaxed, { upgrade: upgradeName(state, upgradeId) }));
    return false;
  }

  const cost = upgradeCost(state, upgradeId);
  if (state.meta.fear < cost) {
    addLog(state, template(t.upgradeTooExpensive, {
      upgrade: upgradeName(state, upgradeId),
      cost,
      fear: formatFear(state.meta.fear)
    }));
    return false;
  }

  state.meta.fear -= cost;
  state.upgrades.purchased[upgradeId] = tier + 1;
  addLog(state, template(t.upgradePurchased, {
    upgrade: upgradeName(state, upgradeId),
    tier: tier + 1,
    cost
  }));
  return true;
}

// Fear is whole-numbered at every source, so it never needs a decimal place. The function
// stays because every readout goes through it, and a stray fraction from an old save should
// show as the integer the shop will actually spend rather than as noise.
function formatFear(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

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
  const base = ABILITIES[abilityId];
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
// for.
function unlockAbility(state, abilityId) {
  const t = locale(state);
  if (!ABILITIES[abilityId]) return false;
  if (!spiritAbilityIds(state).includes(abilityId)) return false;
  if (abilityIsUnlocked(state, abilityId)) return false;

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

// The round's own cooldown baseline, frozen at setup so a shop purchase cannot shorten a
// cooldown that is already ticking.
function abilityCooldownSeconds(state, abilityId) {
  const record = abilityRecord(state, abilityId);
  if (!record) return 0;
  const mult = Number.isFinite(state.round && state.round.abilityCooldownMult)
    ? state.round.abilityCooldownMult
    : 1;
  // Deliberately not rounded: at -5% per tier the difference between two tiers is under a
  // tenth of a second, and rounding here would quietly flatten the diminishing curve into
  // equal steps. The display rounds instead.
  return Math.max(1, record.cooldownSeconds * mult);
}

function abilityIsReady(state, abilityId) {
  const slot = state.abilities[abilityId];
  return Boolean(slot) && slot.cooldownRemaining <= 0;
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

  // A pure push needs somewhere to push to as well as something to push, which is why it is
  // the one target rule that reads two lands. Everything else only needs invaders present -
  // including the Innate's second tier, whose damage stands on its own if the push finds no
  // room (see applyDamageAndPush).
  if (record.effect === "push_invaders") {
    return pushableCount(state, landId) > 0 && pushDestinations(state, landId).length > 0;
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

// Where a push can land: an adjacent land holding no invaders at all. A land with Dahan
// already standing on it wins outright when there is one - the pushed unit lands straight in
// front of a defender instead of sitting somewhere undefended racking up Blight for free.
// Failing that, a coastal one wins - pushing toward the water is what this spirit does, and
// it is also the harder land for the invaders to build back into.
function pushDestinations(state, landId) {
  const open = adjacentLands(landId).filter(
    (other) => invaderCountInLand(state.invaders[other]) <= 0
  );
  const defended = open.filter((other) => (state.dahan[other] || 0) > 0);
  if (defended.length > 0) {
    const coastalDefended = defended.filter(landIsCoastal);
    return coastalDefended.length > 0 ? coastalDefended : defended;
  }
  const coastal = open.filter(landIsCoastal);
  return coastal.length > 0 ? coastal : open;
}

// The lowest land id among those, like every other tie on this board. The water always runs
// the same way, so a player can plan a push instead of gambling on it - and since the coastal
// ids are the low ones, "lowest id" already lands on the coast whenever a coast is free.
function pushDestination(state, landId) {
  const choices = pushDestinations(state, landId);
  if (choices.length === 0) return null;
  return choices.slice().sort((a, b) => Number(a) - Number(b))[0];
}

// Moves up to `maxCount` explorers and towns into one adjacent empty land, carrying each
// unit's own damage with it. Returns null - so the caller can leave the cooldown unspent -
// when there is nothing to move or nowhere to move it.
function applyPushFrom(state, landId, maxCount) {
  const destination = pushDestination(state, landId);
  if (!destination) return null;

  let budget = Math.max(0, Math.floor(maxCount || 0));
  let moved = 0;

  for (const type of PUSH_ORDER) {
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

  switch (record.effect) {
    case "gain_energy":
      return applyBoonOfVigor(state, record, quiet);
    case "add_dahan":
      return applyRiversBounty(state, record, quiet);
    case "push_invaders":
      return applyPushAbility(state, abilityId, record, landId, quiet);
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
}

// The Boon fires itself once `auto_boon` is bought. It goes straight to the effect rather
// than through triggerAbility: there is no target to arm, no refusal to report, and nothing
// here should ever surface as a message. The cooldown is the same one a click would spend,
// so owning it changes who presses the button and not how often it can be pressed.
function resolveAutoBoon(state) {
  if (activeUpgradeTier(state, "auto_boon") <= 0) return;
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
 */

// The lowest id among a set of candidate lands - the same tie-break every other choice on this
// board uses.
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
    meta: { fear: 0 },
    resources: { energy: 0 },
    // `wavesResolved` carries because unit stats are read off it (see unitStats). A scratch
    // board without it would fight wave-1 invaders on a wave-100 island and tell the
    // auto-caster a land clears when it does not.
    round: { fearEarned: 0, wavesResolved: state.round ? state.round.wavesResolved : 0 },
    ui: {}
  };
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

// Would `damage` followed by a push of up to `pushCount` empty this land completely?
// Simulated for the same reason - the kill-first order and the push's own destination rule
// are real engine behaviour, not something worth re-deriving by hand.
function landClearsWithDamageAndPush(state, landId, damage, pushCount) {
  const scratch = cloneCombatState(state);
  applyDamage(scratch, landId, damage);
  applyPushFrom(scratch, landId, pushCount);
  return invaderCountInLand(scratch.invaders[landId]) <= 0;
}

function landClearsWithDamageEach(state, landId, damage) {
  const scratch = cloneCombatState(state);
  applyDamageToEachInvader(scratch, landId, damage);
  return invaderCountInLand(scratch.invaders[landId]) <= 0;
}

// The lands the next Build phase will thicken, or [] when nothing is on the track yet.
function buildThreatLands(state) {
  return landsOfTerrains(buildTerrains(state));
}

// The steepest live Blight source on the board, or null when nothing is bleeding. Shared by
// tiers 2 and 3, which both fall back to "put the damage where it hurts most" once nothing
// more specific applies.
function worstBlightLand(state) {
  const candidates = LAND_IDS.filter((land) => landPressure(state, land).blightPerSecond > 0);
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const diff = landPressure(state, b).blightPerSecond - landPressure(state, a).blightPerSecond;
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

/* Tier 1 - push_invaders, pushCount 1 */

// Prio 1: a build-terrain land holding exactly one pushable unit and nothing else, that the
// Dahan strike will not clear on its own before Build resolves. Pushing it out is the only
// thing that stops the build.
function innateT1BreakBuildLands(state) {
  return buildThreatLands(state).filter((land) => {
    const slot = state.invaders[land];
    if (!slot || (slot.cities || 0) > 0) return false;
    if (pushableCount(state, land) !== 1) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    return !landClearsToDahanStrike(state, land);
  });
}

// Prio 2: an undefended land, pushed into a neighbour that already holds Dahan - now that
// pushDestinations prefers a defended neighbour on its own, this only has to check whether the
// push this land would make lands on one.
function innateT1RouteToCoverLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

// Prio 3: pull an invader off whichever defended land has the fewest Dahan left, before that
// stack runs out.
function innateT1ProtectThinDahanLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) <= 0) return false;
    return abilityLegalLand(state, "innate_power", land);
  });
}

function pickInnateTargetTier1(state) {
  const breakBuild = innateT1BreakBuildLands(state);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const routeToCover = innateT1RouteToCoverLands(state);
  if (routeToCover.length > 0) return lowestLandId(routeToCover);

  const protectThin = innateT1ProtectThinDahanLands(state);
  if (protectThin.length > 0) return thinnestDefendedLand(state, protectThin);

  return null;
}

/* Tier 2 - damage_and_push: 2 damage, then push up to 3 */

// Prio 1: a build-terrain land the damage-then-push would empty outright.
function innateT2BreakBuildLands(state) {
  return buildThreatLands(state).filter((land) => {
    const slot = state.invaders[land];
    if (!slot || (slot.cities || 0) > 0) return false;
    if (invaderCountInLand(slot) <= 0) return false;
    return landClearsWithDamageAndPush(state, land, 2, 3);
  });
}

// Prio 2: the same routing idea as Tier 1 - just needs a pushable unit and a defended
// destination; the damage half is free value riding along on top.
function innateT2RouteToCoverLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) > 0) return false;
    if (invaderCountInLand(state.invaders[land]) <= 0) return false;
    if (pushableCount(state, land) <= 0) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

function pickInnateTargetTier2(state) {
  const breakBuild = innateT2BreakBuildLands(state);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const routeToCover = innateT2RouteToCoverLands(state);
  if (routeToCover.length > 0) return lowestLandId(routeToCover);

  const blight = worstBlightLand(state);
  if (blight) return blight;

  const protectThin = LAND_IDS.filter((land) =>
    (state.dahan[land] || 0) > 0 && invaderCountInLand(state.invaders[land]) > 0
  );
  if (protectThin.length > 0) return thinnestDefendedLand(state, protectThin);

  return null;
}

/* Tier 3 - damage_each_invader: 2 to every unit individually, no push */

// Prio 1: a build-terrain land the AoE would wipe outright.
function innateT3BreakBuildLands(state) {
  return buildThreatLands(state).filter((land) => {
    const slot = state.invaders[land];
    if (!slot || (slot.cities || 0) > 0) return false;
    if (invaderCountInLand(slot) <= 0) return false;
    return landClearsWithDamageEach(state, land, 2);
  });
}

// Prio 3: the land with the most bodies to hit - two or more, so a lone unit falls through to
// the toughest-thing fallback rather than winning this slot by default.
function innateT3MostInvadersLand(state) {
  const candidates = LAND_IDS.filter((land) => invaderCountInLand(state.invaders[land]) >= 2);
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const diff = invaderCountInLand(state.invaders[b]) - invaderCountInLand(state.invaders[a]);
    return diff !== 0 ? diff : Number(a) - Number(b);
  })[0];
}

// Prio 4: the toughest single thing still standing, when nothing else qualified.
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

function pickInnateTargetTier3(state) {
  const breakBuild = innateT3BreakBuildLands(state);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const blight = worstBlightLand(state);
  if (blight) return blight;

  const mostInvaders = innateT3MostInvadersLand(state);
  if (mostInvaders) return mostInvaders;

  return innateT3ToughestLand(state);
}

// Dispatches on whichever tier is currently owned - the Innate replaces its own record
// wholesale per tier (see abilityRecord), so the auto-caster only has to read `effect`.
function pickInnateAutoTarget(state) {
  const record = abilityRecord(state, "innate_power");
  if (!record) return null;
  switch (record.effect) {
    case "push_invaders": return pickInnateTargetTier1(state);
    case "damage_and_push": return pickInnateTargetTier2(state);
    case "damage_each_invader": return pickInnateTargetTier3(state);
    default: return null;
  }
}

// The Innate acts on its own once `auto_innate` is bought, at whichever tier is currently
// owned - tiering up later never has to re-buy this. Unlike the Boon it has real judgement to
// exercise (see pickInnateAutoTarget), so a tick that satisfies no priority leaves the
// cooldown alone rather than spending it on a land that did not need it.
function resolveAutoInnate(state) {
  if (activeUpgradeTier(state, "auto_innate") <= 0) return;
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
  if (activeUpgradeTier(state, "auto_bounty") <= 0) return;
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
 * The push never kills. Everything below is therefore about *where* the invaders end up
 * rather than how many are left, which is why none of these priorities look at damage.
 */

// Prio 1: a land the next Build phase will thicken, that the push would empty outright.
// Emptying it is the only thing that stops the build - Build needs something already standing
// there to build on.
function washAwayBreakBuildLands(state, pushCount) {
  return buildThreatLands(state).filter((land) => {
    if (!abilityLegalLand(state, "wash_away", land)) return false;
    const scratch = cloneCombatState(state);
    applyPushFrom(scratch, land, pushCount);
    return invaderCountInLand(scratch.invaders[land]) <= 0;
  });
}

// Prio 2: an undefended land whose push lands on a neighbour that holds Dahan. Invaders that
// nobody is fighting become invaders somebody is - the closest this ability gets to a kill.
function washAwayRouteToCoverLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "wash_away", land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

// Prio 3: take the weight off whichever defended land is closest to losing its last Dahan.
function washAwayProtectThinDahanLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) <= 0) return false;
    return abilityLegalLand(state, "wash_away", land);
  });
}

function pickWashAwayAutoTarget(state) {
  const record = abilityRecord(state, "wash_away");
  if (!record) return null;

  const breakBuild = washAwayBreakBuildLands(state, record.pushCount);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const routeToCover = washAwayRouteToCoverLands(state);
  if (routeToCover.length > 0) return lowestLandId(routeToCover);

  const protectThin = washAwayProtectThinDahanLands(state);
  if (protectThin.length > 0) return thinnestDefendedLand(state, protectThin);

  return null;
}

function resolveAutoWashAway(state) {
  if (activeUpgradeTier(state, "auto_wash_away") <= 0) return;
  if (!abilityIsUnlocked(state, "wash_away")) return;
  if (!abilityIsReady(state, "wash_away")) return;

  const landId = pickWashAwayAutoTarget(state);
  if (!landId) return;

  if (!applyAbilityEffect(state, "wash_away", landId, true)) return;
  startCooldown(state, "wash_away");
}

// The single entry point for the ability bar. Everything it can answer with - cancel,
// refuse, arm, resolve - lands here so the UI stays a view.
function triggerAbility(state, abilityId) {
  const t = locale(state);
  if (!ABILITIES[abilityId] || !state.abilities[abilityId]) return false;
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
  if (!abilityId || !ABILITIES[abilityId]) return false;
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

/* ------------------------------------------------------------------ *
 * Land states (06-ui-contract.md Land State Rules)                     *
 *                                                                      *
 * A rule rather than a paint job, so it is asserted in the suite along  *
 * with everything else the board promises.                             *
 * ------------------------------------------------------------------ */

// The lands the next wave will reinforce. Damage is everywhere now, so the wave marks where
// the island is about to get *worse* rather than where it is about to be hit.
function waveLands(state) {
  if (state.round.status !== "running") return [];
  return landsOfTerrains(buildTerrains(state));
}

// The detail panel is never empty: it falls back to the land the next wave will hit, so
// the most urgent land is on screen without the player hunting for it.
function effectiveSelectedLand(state) {
  if (isLandId(state.ui.selectedLand)) return state.ui.selectedLand;
  const pending = waveLands(state);
  if (pending.length > 0) return pending[0];
  return LAND_IDS[0];
}

// While an ability is armed, legality is the only thing the board says: everything that is
// not a legal click dims. That is what makes a targeting rule teachable without a rulebook,
// and it is why `out` never appears when nothing is armed.
function landRenderStates(state) {
  const armed = state.pendingAbilityTarget;
  const pending = waveLands(state);
  const selected = effectiveSelectedLand(state);
  const out = {};

  for (const landId of LAND_IDS) {
    if (armed) {
      out[landId] = abilityLegalLand(state, armed, landId) ? "legal" : "out";
    } else if (pending.includes(landId)) {
      out[landId] = "wave-active";
    } else if (landId === selected) {
      out[landId] = "selected";
    } else {
      out[landId] = "idle";
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Combat (02-core-loop.md, 04-economy-formulas.md)                     *
 * ------------------------------------------------------------------ */

// Fear from a defeat, by the unit's power value: explorer 1, town 2, city 3 - and one more
// each at every damage rung of the ladder, so a tougher Invader is worth proportionally more
// to kill rather than being strictly worse news.
function gainFearFromDefeat(state, unitType, defeatedCount) {
  const defeated = Math.max(0, Math.floor(defeatedCount || 0));
  if (defeated <= 0) return;
  const power = unitStats(state, unitType).damage || 0;
  const gain = defeated * power * FEAR_PER_POWER;
  if (gain <= 0) return;

  state.round.fearEarned += gain;
}

// Fear for outlasting a wave. Paid once per wave, at the wave, so a round that ends between
// two waves is paid for the ones it finished and not for the one it was standing in.
function gainFearFromWave(state) {
  if (FEAR_PER_WAVE <= 0) return;
  state.round.fearEarned += FEAR_PER_WAVE;
}

// Energy from the same defeat, on the same power scale: an explorer pays 1, a town 2, a
// city 3. Unlike Fear it is whole-numbered and spendable mid-round, which is what makes the
// fight itself pay for the ability bar.
function gainEnergyFromDefeat(state, unitType, defeatedCount) {
  const defeated = Math.max(0, Math.floor(defeatedCount || 0));
  if (defeated <= 0) return;
  const power = unitStats(state, unitType).damage || 0;
  const gain = defeated * power * ENERGY_PER_POWER;
  if (gain <= 0) return;

  state.resources.energy += gain;
}

/* ---------- Applying damage ----------
 *
 * One rule, everywhere: damage kills if it can, and only wounds when it cannot.
 *
 * The alternative - always spend on the biggest thing standing - meant a Dahan strike could
 * scratch a city for a round while four explorers stood untouched beside it. Killing is what
 * pays Fear and Energy, so damage that cannot buy a kill is damage the round did not use.
 */

// Every invader in a land, one entry per unit. `index` is the unit's position in its type's
// damage array, which is what lets a caller wound or remove that individual rather than its
// whole type. Recompute after any change: the indices move when a unit dies.
function livingUnits(state, landId) {
  const out = [];
  const slot = state.invaders[landId];
  const damage = state.invaderDamage[landId];
  if (!slot || !damage) return out;

  for (const type of INVADER_TYPES) {
    const maxHp = unitStats(state, type).health;
    const wounds = damage[type] || [];
    for (let i = 0; i < Math.max(0, slot[type] || 0); i += 1) {
      out.push({ type, index: i, maxHp, hp: maxHp - (wounds[i] || 0) });
    }
  }

  return out;
}

// 0 is a city, 2 an explorer: lower is stronger, matching INVADER_TYPES_BY_TIER.
function unitTierRank(type) {
  return INVADER_TYPES_BY_TIER.indexOf(type);
}

// Of the units this damage could kill outright, the best one to spend it on: the toughest,
// because a kill is worth its power in Fear and Energy. A tie goes to the higher tier - a
// wounded city at 2 HP dies before a fresh town at 2 HP - and then to the lowest index, so
// the choice is reproducible.
function betterKill(a, b) {
  if (a.hp !== b.hp) return a.hp > b.hp ? a : b;
  const rankA = unitTierRank(a.type);
  const rankB = unitTierRank(b.type);
  if (rankA !== rankB) return rankA < rankB ? a : b;
  return a.index <= b.index ? a : b;
}

// When nothing can be killed, the damage goes on the strongest thing standing - highest tier
// first, and within a tier the one already closest to falling, so the next hit has a kill to
// find. Everything here has more HP left than there is damage to spend, so no clamping.
function betterWound(a, b) {
  const rankA = unitTierRank(a.type);
  const rankB = unitTierRank(b.type);
  if (rankA !== rankB) return rankA < rankB ? a : b;
  if (a.hp !== b.hp) return a.hp < b.hp ? a : b;
  return a.index <= b.index ? a : b;
}

function removeInvaderUnit(state, landId, type, index) {
  state.invaders[landId][type] = Math.max(0, (state.invaders[landId][type] || 0) - 1);
  state.invaderDamage[landId][type].splice(index, 1);
}

function woundInvaderUnit(state, landId, type, index, amount) {
  const wounds = state.invaderDamage[landId][type];
  wounds[index] = clamp((wounds[index] || 0) + amount, 0, unitStats(state, type).health - 1);
}

function emptyDefeatTally() {
  return { explorers: 0, towns: 0, cities: 0 };
}

function creditDefeat(state, result, type) {
  result.defeated[type] += 1;
  result.totalDefeated += 1;
  gainFearFromDefeat(state, type, 1);
  gainEnergyFromDefeat(state, type, 1);
}

// Spends a pool of damage on one land, kill-first. Damage left over after a kill carries to
// the next target, so 2 damage into a land holding a 1-HP city and an explorer takes both.
function applyDamage(state, landId, amount) {
  const result = { defeated: emptyDefeatTally(), totalDefeated: 0, spent: 0 };
  if (!isLandId(landId)) return result;

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);

  let remaining = Math.max(0, Math.floor(amount || 0));
  const budget = remaining;

  while (remaining > 0) {
    const units = livingUnits(state, landId);
    if (units.length === 0) break;

    const killable = units.filter((unit) => unit.hp <= remaining);

    if (killable.length > 0) {
      const victim = killable.reduce(betterKill);
      remaining -= victim.hp;
      removeInvaderUnit(state, landId, victim.type, victim.index);
      creditDefeat(state, result, victim.type);
      continue;
    }

    // Nothing here can be killed with what is left, so all of it goes on one unit.
    const victim = units.reduce(betterWound);
    woundInvaderUnit(state, landId, victim.type, victim.index, remaining);
    remaining = 0;
  }

  // The tie-breaks above happen to leave the arrays sorted, but the invariant should not rest
  // on that: the ring the board draws reads index 0 and has to be the worst-off unit.
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);

  result.spent = budget - remaining;
  return result;
}

// The Innate's third tier: every invader takes the same hit, individually. No pooling and no
// carry - a unit that survives is wounded by exactly `amount`, whatever its neighbours did.
//
// The land is snapshotted first so a unit is never spared by another dying ahead of it.
function applyDamageToEachInvader(state, landId, amount) {
  const result = { defeated: emptyDefeatTally(), totalDefeated: 0, spent: 0 };
  const hit = Math.max(0, Math.floor(amount || 0));
  if (!isLandId(landId) || hit <= 0) return result;

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);

  const units = livingUnits(state, landId);
  const survivors = { explorers: [], towns: [], cities: [] };

  for (const unit of units) {
    result.spent += hit;
    if (unit.hp <= hit) {
      creditDefeat(state, result, unit.type);
    } else {
      // Stored as damage taken, not health left, to match the array's contract.
      survivors[unit.type].push(unit.maxHp - (unit.hp - hit));
    }
  }

  for (const type of INVADER_TYPES) {
    state.invaders[landId][type] = survivors[type].length;
    state.invaderDamage[landId][type] = survivors[type].sort((a, b) => b - a);
  }

  return result;
}

// The floating "-2 Towns" over a land. One type only, so it names the heaviest thing that
// fell - the number that made the cast worth watching.
function markDefeatFxFromResult(state, landId, result) {
  if (!result || result.totalDefeated <= 0) return;
  for (const type of INVADER_TYPES_BY_TIER) {
    if (result.defeated[type] > 0) {
      markDefeatFx(state, landId, type, result.defeated[type]);
      return;
    }
  }
}

// Takes the state as well as the land, because what an Invader hits for is a function of how
// far the round has climbed (see unitStats) and no longer a constant.
function invaderDamageInLand(state, slot) {
  return (slot.explorers || 0) * unitStats(state, "explorers").damage
    + (slot.towns || 0) * unitStats(state, "towns").damage
    + (slot.cities || 0) * unitStats(state, "cities").damage;
}

// The Dahan strike, spent automatically: one pool of damage through the same kill-first rule
// every ability uses. No player input, nothing left pending.
//
// This is what the kill-first rule changed most. Under the old strongest-first rule two Dahan
// scratched a city for 2 and the round moved on; now they take a town off the board. The
// Dahan are meaningfully stronger for it, which is deliberate - they were too easy to ignore.
function spendDahanAttack(state, land, pool) {
  const result = applyDamage(state, land, pool);
  markDefeatFxFromResult(state, land, result);
  return { defeated: result.totalDefeated, spent: result.spent };
}

/* ------------------------------------------------------------------ *
 * Blight (02-core-loop.md, 04-economy-formulas.md)                     *
 * ------------------------------------------------------------------ */

// Blight only ever goes up, and it is the round's only clock. The per-land tally is what
// lets the board show which land cost the round, and what Wash Away reads to find the
// worst land - see docs/spec/03-state-contract.md.
function addBlight(state, land, amount) {
  const gain = Math.max(0, Math.floor(amount));
  if (gain <= 0) return 0;

  const before = state.round.blight;
  state.round.blight = clamp(before + gain, 0, state.round.blightThreshold);
  const applied = state.round.blight - before;
  if (applied > 0 && isLandId(land)) state.round.blightByLand[land] += applied;
  return applied;
}

function blightReached(state) {
  return state.round.blight >= state.round.blightThreshold;
}

/* ------------------------------------------------------------------ *
 * The fight, resolved continuously (02-core-loop.md#the-fight)         *
 *                                                                      *
 * There is no Ravage phase and no damage tick any more. Every land      *
 * holding invaders is under attack every moment of the round, and both  *
 * consequences - Blight rising, Dahan falling - accrue as fractions      *
 * that only ever land on a whole number when a bar fills.               *
 * ------------------------------------------------------------------ */

// One land, one slice of time. Both bars advance from the same snapshot of the land, so a
// Dahan that falls this slice still defended against Blight for the whole of it.
function resolveLandCombat(state, land, dt) {
  const p = landPressure(state, land);
  const out = { blightGained: 0, dahanLost: 0 };
  if (p.gross <= 0) return out;

  if (p.blightPerSecond > 0) {
    let progress = state.round.blightProgress[land] + p.blightPerSecond * dt;
    // The remainder carries rather than resetting, so a bar that overshoots by 3% starts the
    // next Blight at 3% instead of throwing it away. Over a round that drift is whole Blight.
    while (progress >= 1 && !blightReached(state)) {
      progress -= 1;
      out.blightGained += addBlight(state, land, 1);
    }
    state.round.blightProgress[land] = blightReached(state) ? 0 : clamp(progress, 0, 1);
  }

  if (p.dahanPerSecond > 0) {
    let progress = state.round.dahanProgress[land] + p.dahanPerSecond * dt;
    while (progress >= 1 && state.dahan[land] > 0) {
      progress -= 1;
      state.dahan[land] -= 1;
      out.dahanLost += 1;
    }
    // Nothing left to wound, so nothing carries: reinforcements arrive at a full bar.
    state.round.dahanProgress[land] = state.dahan[land] > 0 ? clamp(progress, 0, 1) : 0;
  }

  return out;
}

function resolveContinuousCombat(state, dt) {
  if (dt <= 0) return;
  const t = locale(state);

  state.invaders = normalizeInvaderCounts(state.invaders);

  const blightedLands = [];
  let blightTotal = 0;

  for (const land of LAND_IDS) {
    const result = resolveLandCombat(state, land, dt);

    if (result.dahanLost > 0) {
      markDefeatFx(state, land, "dahan", result.dahanLost);
      addLog(state, template(t.dahanFell, {
        count: result.dahanLost,
        land: landName(state, land),
        left: state.dahan[land]
      }));
    }

    if (result.blightGained > 0) {
      blightedLands.push(land);
      blightTotal = Math.max(blightTotal, result.blightGained);
      addLog(state, template(t.blightGained, {
        land: landName(state, land),
        amount: result.blightGained,
        total: state.round.blight,
        threshold: state.round.blightThreshold
      }));
    }
  }

  if (blightedLands.length > 0) markBlightFx(state, blightedLands, blightTotal);
  if (blightReached(state)) endRound(state);
}

// Every Dahan on the island swings at once, on their own timer. A land with no invaders is
// skipped rather than logged, or the log would be nothing but empty-land lines.
function resolveDahanAttack(state) {
  const t = locale(state);
  state.invaders = normalizeInvaderCounts(state.invaders);

  let landsThatStruck = 0;

  for (const land of LAND_IDS) {
    const dahan = Math.max(0, state.dahan[land] || 0);
    if (dahan <= 0 || invaderCountInLand(state.invaders[land]) <= 0) continue;

    const result = spendDahanAttack(state, land, dahan * DAHAN_ATTACK_DAMAGE);
    landsThatStruck += 1;
    addLog(state, template(t.dahanAttackResolved, {
      land: landName(state, land),
      damage: result.spent,
      defeated: result.defeated
    }));
  }

  if (landsThatStruck === 0) addLog(state, t.dahanAttackNoTargets);
}

/* ------------------------------------------------------------------ *
 * Invader phases (09-island-board.md)                                  *
 * ------------------------------------------------------------------ */

// A unit arriving on the board brings a wound list entry with it. Every place that adds an
// invader goes through here: the damage array holds one entry per living unit, and a phase
// that incremented the count alone would leave the two out of step until the next save.
function addInvaderUnit(state, landId, type) {
  state.invaders[landId][type] = (state.invaders[landId][type] || 0) + 1;
  state.invaderDamage[landId][type].push(0);
}

// Discover only seeds explorers into a land that is coastal, or that sits next to a town or
// city. Mountains has no coast, so it stays quiet until the invaders build their way inland.
//
// From EXPLORE_UNRESTRICTED_FROM_WAVE the question stops being asked: by then the invaders
// are ashore in force and no longer need a foothold to land beside. Mountains is what this
// opens - lands 4 and 6 have no coast, so it is the only terrain that was ever really gated.
function landAcceptsExplorer(state, landId) {
  if (state.round.wavesResolved >= EXPLORE_UNRESTRICTED_FROM_WAVE) return true;
  if (landIsCoastal(landId)) return true;
  return adjacentLands(landId).some((neighbour) => {
    const slot = state.invaders[neighbour];
    return Boolean(slot) && ((slot.towns || 0) > 0 || (slot.cities || 0) > 0);
  });
}

// The terrains each phase is currently pointed at. Read through these rather than off the
// state, so a slot holding a bare terrain is understood the same way everywhere.
function buildTerrains(state) {
  return terrainList(state.invader && state.invader.build);
}

function exploreTerrains(state) {
  return terrainList(state.invader && state.invader.explore);
}

function resolveBuildPhase(state) {
  const t = locale(state);
  const terrains = buildTerrains(state);

  if (terrains.length === 0) {
    addLog(state, t.buildNothing);
    return;
  }

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);

  // From BUILD_TWICE_FROM_WAVE the whole phase runs a second time. It is a second pass rather
  // than a doubled count on purpose: the second one reads the counts the first one left, so a
  // land that has just taken its first Town follows it with a City instead of a second Town.
  const passes = state.round.wavesResolved >= BUILD_TWICE_FROM_WAVE ? 2 : 1;

  for (let pass = 0; pass < passes; pass += 1) {
    // Each land of the terrain builds on its own count, so the two can build different units.
    for (const land of landsOfTerrains(terrains)) {
      const slot = state.invaders[land];
      if (invaderCountInLand(slot) <= 0) {
        // Only the first pass says so. An empty land is empty for both, and logging it twice
        // would read as two separate failures.
        if (pass === 0) addLog(state, template(t.buildNoInvaders, { land: landName(state, land) }));
        continue;
      }

      const built = slot.towns > slot.cities ? "cities" : "towns";
      addInvaderUnit(state, land, built);
      addLog(state, template(t.buildResolved, {
        land: landName(state, land),
        unit: unitLabelOne(state, built)
      }));
    }
  }
}

// How many Explorers each discovered land takes. One until the ladder says two - the cheapest
// rung there is, and the one that first makes a single Discover worth answering.
function explorersPerLand(state) {
  return state.round.wavesResolved >= EXPLORE_DOUBLE_SEED_FROM_WAVE ? 2 : 1;
}

function seedExplorers(state, land, count) {
  for (let i = 0; i < count; i += 1) addInvaderUnit(state, land, "explorers");
  addLog(state, template(locale(state).exploreResolved, {
    land: landName(state, land),
    count
  }));
}

// The one land Discover takes that its terrains never covered, from
// EXPLORE_EXTRA_LAND_FROM_WAVE. Drawn at random, and drawn from the lands this Discover has
// not already seeded - it is meant to open a second front, not to double up on the one the
// track already warned about.
function drawExtraExploreLand(state, alreadySeeded) {
  const candidates = LAND_IDS.filter(
    (landId) => !alreadySeeded.includes(landId) && landAcceptsExplorer(state, landId)
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

// From BONUS_TOWN_FROM_WAVE a Town simply appears in a land that had none. It is the only
// rung that arrives through neither phase, which is the point of it: Build thickens what is
// already there and Discover lands where the track said it would, so both reward a player
// who is watching. This one goes where nobody is - a land with no Town is by definition one
// that has been left alone - and it is what stops a quiet corner staying quiet.
function resolveBonusTown(state) {
  if (state.round.wavesResolved < BONUS_TOWN_FROM_WAVE) return;

  const candidates = LAND_IDS.filter((landId) => (state.invaders[landId].towns || 0) <= 0);
  if (candidates.length === 0) return;

  const land = candidates[Math.floor(rng() * candidates.length)];
  addInvaderUnit(state, land, "towns");
  addLog(state, template(locale(state).bonusTownResolved, { land: landName(state, land) }));
}

function resolveExplorePhase(state) {
  const t = locale(state);
  const terrains = exploreTerrains(state);

  if (terrains.length === 0) {
    addLog(state, t.exploreNothing);
    return;
  }

  state.invaders = normalizeInvaderCounts(state.invaders);
  state.invaderDamage = normalizeInvaderDamage(state.invaders, state.invaderDamage, state.round.wavesResolved);

  const perLand = explorersPerLand(state);
  const seededLands = [];

  for (const land of landsOfTerrains(terrains)) {
    if (!landAcceptsExplorer(state, land)) {
      addLog(state, template(t.exploreBlocked, { land: landName(state, land) }));
      continue;
    }
    seedExplorers(state, land, perLand);
    seededLands.push(land);
  }

  // After the terrains have had theirs, so the extra land can never be one of them.
  if (state.round.wavesResolved >= EXPLORE_EXTRA_LAND_FROM_WAVE) {
    const extra = drawExtraExploreLand(state, seededLands);
    if (extra) {
      seedExplorers(state, extra, perLand);
      seededLands.push(extra);
    }
  }

  if (seededLands.length === 0) {
    addLog(state, template(t.exploreNoneReachable, { terrain: terrainNames(state, terrains) }));
  }

  // Rides along with Discover rather than sitting in resolveWave, so the opening Discover at
  // setup runs it too and the rung has no seam at a round boundary.
  resolveBonusTown(state);
}

// The track slides forward. What was discovered this wave is built on the next one, so the
// player can see a terrain thicken one wave before it does. That promise is why the two slots
// widen together: every rung that gives Discover another terrain gives Build the same terrain
// one wave later, and the track never shows less than what is coming.
function shiftInvaderTrack(state) {
  state.invader = normalizeInvaderPhases(state.invader, state);

  const shiftedToBuild = exploreTerrains(state);
  state.invader.build = shiftedToBuild;
  state.invader.explore = drawInvaderTerrains(exploreTerrainCount(state), shiftedToBuild);

  const t = locale(state);
  addLog(state, template(t.waveIncoming, {
    build: terrainNames(state, state.invader.build),
    discover: terrainNames(state, state.invader.explore)
  }));
}

/* ------------------------------------------------------------------ *
 * The round (02-core-loop.md)                                          *
 * ------------------------------------------------------------------ */

// One wave: reinforcement only. A wave no longer deals a point of damage - it just adds to
// what is already grinding the island down between waves.
function resolveWave(state) {
  // Counted before the phases run, not after, so the wave can read its own number while it
  // resolves - which is what lets Discover know it has reached the tenth.
  state.round.wavesResolved += 1;

  resolveBuildPhase(state);
  resolveExplorePhase(state);
  shiftInvaderTrack(state);

  gainFearFromWave(state);
  addLog(state, template(locale(state).waveResolved, { wave: state.round.wavesResolved }));
}

function endRound(state) {
  const t = locale(state);
  if (state.round.status === "ended") return;

  state.round.status = "ended";
  state.round.waveTimerRemaining = 0;
  state.round.dahanAttackRemaining = 0;
  state.round.awaitingWave = false;
  state.pendingAbilityTarget = null;

  // Payday. Everything the round earned becomes spendable here and nowhere else, which is
  // what makes surviving the round the thing that pays rather than the kills inside it.
  state.meta.fear += state.round.fearEarned;

  state.meta.totalRoundsPlayed += 1;
  // How far up the ladder this run has ever climbed. The wave is the honest measure of a
  // run's depth now that the ladder is keyed to it - the round number only counts attempts,
  // and every round starts at the bottom rung regardless of which number it wears.
  state.meta.bestWaveReached = Math.max(state.meta.bestWaveReached, state.round.wavesResolved);

  addLog(state, template(t.roundEnded, {
    round: state.round.number,
    wave: state.round.wavesResolved,
    blight: state.round.blight,
    threshold: state.round.blightThreshold,
    fear: formatFear(state.round.fearEarned)
  }));
}

// Seeds the Dahan for a round: the spirit's fixed baseline, then any purchased
// reinforcement, one at a time into whichever land is emptiest.
function seedRoundDahan(state) {
  const spirit = activeSpirit(state);
  state.dahan = normalizeDahanCounts(spirit.roundStartDahan);

  let remaining = upgradeTotals(state).dahanBonus;

  while (remaining > 0) {
    // Emptiest land first, ties on the lowest id: deterministic, so a round setup can be
    // asserted in a test rather than sampled. Always filling the emptiest land is also what
    // holds the DAHAN_MAX_SPREAD invariant - a land can only rise to n+1 once every land
    // has reached n - and it is the fastest repair if a spirit's baseline starts lopsided.
    let target = LAND_IDS[0];
    for (const landId of LAND_IDS) {
      if (state.dahan[landId] < state.dahan[target]) target = landId;
    }

    state.dahan[target] += 1;
    remaining -= 1;
  }

  const summary = LAND_IDS
    .filter((landId) => state.dahan[landId] > 0)
    .map((landId) => `${template(locale(state).landShort, { id: landId })} ${state.dahan[landId]}`)
    .join(", ");

  if (summary) addLog(state, template(locale(state).dahanRoundLog, { summary }));
}

// Round setup (02 Round Sequence step 1). Runs at the start of every round, not just at
// game start, and reads the permanent upgrade baseline each time.
function startRound(state) {
  const totals = upgradeTotals(state);

  state.round.status = "running";
  state.round.elapsedSeconds = 0;
  state.round.blight = 0;
  state.round.blightByLand = createBlightByLand();
  state.round.blightProgress = createProgressByLand();
  state.round.dahanProgress = createProgressByLand();
  state.round.blightThreshold = BLIGHT_THRESHOLD_BASE + totals.blightThresholdBonus;
  state.round.waveTimerRemaining = WAVE_INTERVAL_SECONDS;
  state.round.dahanAttackRemaining = DAHAN_ATTACK_INTERVAL_SECONDS;
  // A manual round opens on a held gate, so the island stands still until the player has read
  // it. The timer is already full here, so that first click starts the clock without costing
  // a wave - see startNextWave.
  state.round.awaitingWave = !autoProceedOn(state);
  state.round.wavesResolved = 0;
  state.round.fearEarned = 0;
  state.round.abilityCooldownMult = 1 - totals.cooldownReductionPct;
  // The shop stays open all round, so what the round runs on is fixed here and read from
  // here - see activeUpgradeTier. Anything bought after this line is owned but idle until
  // the next round takes its own snapshot.
  state.round.upgradeTiers = snapshotUpgradeTiers(state);

  // The kit is rebuilt from nothing every round: the purse empties, every Energy unlock is
  // given back, and the Innate drops to its first tier. What carries between rounds is Fear
  // and the shop tiers it bought - so a round's power is earned inside that round, and the
  // permanent progression is what decides how fast it can be earned again.
  state.resources.energy = 0;
  state.round.purchasedAbilityIds = [];
  state.round.abilityTiers = {};

  state.invaders = createInvaderCounts();
  state.invaderDamage = createInvaderDamage();
  state.invader = normalizeInvaderPhases({ build: [], explore: drawOpeningTerrains(state) }, state);

  state.pendingAbilityTarget = null;
  state.abilities = createAbilityState(state);

  state.ui.defeatFx = null;
  state.ui.blightFx = null;

  addLog(state, template(locale(state).roundStarted, {
    round: state.round.number,
    threshold: state.round.blightThreshold
  }));

  seedRoundDahan(state);
  seedRoundExplore(state);
  return state;
}

// The opening Discover, run at setup rather than on the first wave. Without it the island
// stands empty for the whole first wave interval: nothing to fight, no Blight accruing, and
// a Build phase at wave 1 with nothing to build on. Now the invaders are ashore from second
// zero, and the terrain they landed in is what wave 1 builds up - the track shift below is
// what puts it in the Build slot, so wave 1 reads the same as every wave after it.
//
// It is not a wave: `wavesResolved` stays at 0 and no timer is touched.
function seedRoundExplore(state) {
  addLog(state, locale(state).setupExplore);
  resolveExplorePhase(state);
  shiftInvaderTrack(state);
}

// Leaving the shop. The round number only moves here, so a reload inside the shop cannot
// skip a round.
function startNextRound(state) {
  if (state.round.status !== "ended") return false;
  state.round.number += 1;
  startRound(state);
  // Leaving the shop is itself the click that starts the round, so the wave gate does not ask
  // for a second one on the way out.
  state.round.awaitingWave = false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Pacing: the speed dial and the wave gate (02-core-loop.md Pacing)     *
 *                                                                      *
 * Two controls over the same thing - how fast the round is allowed to   *
 * reach the player - and both are settings rather than rules: neither   *
 * changes what a wave costs, only when it is spent.                     *
 * ------------------------------------------------------------------ */

// Game seconds per real second, and the whole of the speed dial: the engine only ever thinks
// in the seconds it was authored in, so the setting never reaches past this one multiplication
// on dt. It is read through a function rather than off the state because an unknown value has
// to fall back to the shipped speed, not stop the game.
function gameSpeed(state) {
  const value = Number(state.ui.gameSpeed);
  return GAME_SPEEDS.includes(value) ? value : DEFAULT_GAME_SPEED;
}

function setGameSpeed(state, value) {
  const next = Number(value);
  if (!GAME_SPEEDS.includes(next)) return false;
  state.ui.gameSpeed = next;
  return true;
}

function autoProceedOn(state) {
  return state.ui.autoProceed === true;
}

// Turning it on releases a gate that is already holding: the flag stays set, and waveGateHeld
// simply stops reading it. Nothing has to be resolved here - the next tick finds the wave
// timer at zero and runs the wave it was waiting on.
function setAutoProceed(state, on) {
  state.ui.autoProceed = on === true;
  return state.ui.autoProceed;
}

// Whether the round is currently standing still because the player has not called the next
// wave. It is one flag rather than a round status, because everything else about the round is
// still true while it waits: the board, the timers and the cooldowns are all exactly where
// they were, and only the clock is not moving.
function waveGateHeld(state) {
  return state.round.awaitingWave === true && !autoProceedOn(state);
}

/* ---------- The round gate ----------
 *
 * The same idea as the wave gate, one level up: a round that has ended stands in the shop
 * until something starts the next one. Owning auto_start_round is what lets that something
 * be the engine.
 *
 * It is deliberately two conditions rather than one. The upgrade is permanent and the toggle
 * is a preference, so a player who wants to stop and read the shop turns the toggle off
 * rather than regretting a 500-Fear purchase. The toggle is read live rather than off the
 * round snapshot for the same reason - it is a setting, not a power the round runs on.
 */
function autoStartRoundOwned(state) {
  return upgradeTier(state, "auto_start_round") > 0;
}

function autoStartRoundOn(state) {
  return autoStartRoundOwned(state) && state.ui.autoStartRound === true;
}

function setAutoStartRound(state, on) {
  state.ui.autoStartRound = on === true;
  return state.ui.autoStartRound;
}

// Called from the tick after the round has ended. Nothing else is needed: startNextRound
// already refuses unless the round is over, so this is the click and not a second path.
function resolveAutoStartRound(state) {
  if (state.round.status !== "ended") return;
  if (!autoStartRoundOn(state)) return;
  startNextRound(state);
}

// The player's own clock, and the only way past a held gate. Two gates use it and the wave
// timer is what tells them apart: at the start of a round it is still full and the click
// merely lets time begin, and at the end of a wave it is empty and the click is what resolves
// the wave that came due.
function startNextWave(state) {
  if (state.round.status !== "running" || state.round.awaitingWave !== true) return false;

  state.round.awaitingWave = false;
  if (state.round.waveTimerRemaining <= 0) {
    // Refilled before the wave resolves, so a wave that ends the round leaves endRound's zero
    // standing rather than a fresh interval nothing will ever count down.
    state.round.waveTimerRemaining = WAVE_INTERVAL_SECONDS;
    resolveWave(state);
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Tick (04-economy-formulas.md Wave Timing)                            *
 * ------------------------------------------------------------------ */

function tick(state, dt) {
  // Real seconds in, game seconds out. Capped after the conversion, not before: the cap is
  // there to swallow a jump after sleep, and that jump is a jump in game time.
  const step = Math.min(MAX_TICK_SECONDS, Math.max(0, Number(dt) || 0) * gameSpeed(state));
  state.time.totalSeconds += step;
  pruneFx(state);

  // Before the running-check below, because a round that has ended is precisely what that
  // check turns the tick away for. Gated on `step` so a paused game stays paused: the speed
  // dial stops time, and starting a round is something time does.
  if (step > 0) resolveAutoStartRound(state);

  if (state.round.status !== "running" || waveGateHeld(state) || step <= 0) return;

  state.round.elapsedSeconds += step;
  tickCooldowns(state, step);
  // Before the fight, so Energy the Boon just paid is spendable on the same tick the player
  // sees it - the ability bar is read after the tick, not during it.
  resolveAutoBoon(state);
  resolveAutoInnate(state);
  resolveAutoBounty(state);
  resolveAutoWashAway(state);

  // The fight first: it is what actually ends the round, and resolving it before the wave
  // means a land cannot be reinforced out from under damage it had already taken this tick.
  resolveContinuousCombat(state, step);
  if (state.round.status !== "running") {
    state.round.waveTimerRemaining = 0;
    state.round.dahanAttackRemaining = 0;
    return;
  }

  state.round.dahanAttackRemaining -= step;
  let dahanGuard = 0;
  while (state.round.dahanAttackRemaining <= 0 && dahanGuard < 16) {
    state.round.dahanAttackRemaining += DAHAN_ATTACK_INTERVAL_SECONDS;
    resolveDahanAttack(state);
    dahanGuard += 1;
  }

  state.round.waveTimerRemaining -= step;

  // The gate closes the instant the bar empties: with auto-proceed off the wave is due, but
  // nothing resolves it except the player, and no clock moves again until they say so. The
  // overshoot is dropped rather than carried - the click buys a whole fresh interval, which
  // is what the bar it refills is promising.
  if (state.round.waveTimerRemaining <= 0 && !autoProceedOn(state)) {
    state.round.waveTimerRemaining = 0;
    state.round.awaitingWave = true;
    return;
  }

  // A capped tick is shorter than a wave interval today, but the loop is written to survive
  // a longer one rather than silently swallowing the extra waves.
  let guard = 0;
  while (state.round.status === "running" && state.round.waveTimerRemaining <= 0 && guard < 16) {
    state.round.waveTimerRemaining += WAVE_INTERVAL_SECONDS;
    state.round.awaitingWave = false;
    resolveWave(state);
    guard += 1;
  }

  if (state.round.status !== "running") {
    state.round.waveTimerRemaining = 0;
    state.round.dahanAttackRemaining = 0;
  }
}

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
      totalRoundsPlayed: 0,
      bestWaveReached: 0
    },
    spirit: {
      activeSpiritId: "core_spirit_01",
      unlockedSpiritIds: ["core_spirit_01"]
    },
    upgrades: {
      purchased: {}
    },
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
      defeatFx: null,
      blightFx: null,
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
      abilityCooldownMult: 1,
      // What this round is running on, as against what the player owns - see
      // activeUpgradeTier. Filled by startRound; empty here because no round has started.
      upgradeTiers: {},
      // Both live here rather than on the spirit because both die with the round, exactly
      // like the Energy that bought them. `purchasedAbilityIds` never lists the spirit's own
      // startingAbilityIds - those are not bought - so it is precisely the record of what
      // this round spent. `abilityTiers` maps a tiered ability id to its zero-based tier.
      purchasedAbilityIds: [],
      abilityTiers: {}
    },
    invader: { build: [], explore: [] },
    invaders: createInvaderCounts(),
    invaderDamage: createInvaderDamage(),
    dahan: createDahanCounts(),
    abilities: {},
    pendingAbilityTarget: null,
    resources: { energy: 0 },
    essence: createEssencePools(),
    _log: []
  };
}

// First-ever load, and the target every migration falls back to.
function createFreshGameState() {
  const state = createInitialState();
  state.abilities = createAbilityState(state);
  startRound(state);
  return state;
}

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
  merged.ui.gameSpeed = GAME_SPEEDS.includes(Number(merged.ui.gameSpeed))
    ? Number(merged.ui.gameSpeed)
    : DEFAULT_GAME_SPEED;
  merged.ui.autoProceed = merged.ui.autoProceed === true;
  // Defaults on rather than off, unlike auto-proceed: a save that predates the toggle has no
  // value to read, and the only player it can affect is one who has bought the automation.
  merged.ui.autoStartRound = merged.ui.autoStartRound !== false;
  merged.ui.selectedLand = isLandId(merged.ui.selectedLand) ? merged.ui.selectedLand : null;
  merged.ui.defeatFx = normalizeDefeatFx(merged.ui.defeatFx);
  merged.ui.blightFx = normalizeBlightFx(merged.ui.blightFx);

  // Floored, not just clamped: a save written while Fear was fractional loads as the whole
  // number the shop can actually spend, and never as 6.3.
  merged.meta.fear = Math.max(0, Math.floor(Number(merged.meta.fear) || 0));
  merged.meta.totalRoundsPlayed = Math.max(0, Math.floor(merged.meta.totalRoundsPlayed || 0));
  // A save from before the ladder tracked waves has no best wave to carry. The old best round
  // is not a substitute - it counted attempts, not depth - so the record simply restarts at 0
  // and the first finished round writes a true one.
  merged.meta.bestWaveReached = Math.max(0, Math.floor(merged.meta.bestWaveReached || 0));
  delete merged.meta.bestRoundReached;

  // Upgrade tiers survive anything: an unknown id is dropped, a bad value clamps to 0.
  const purchased = {};
  for (const [id, value] of Object.entries(merged.upgrades.purchased || {})) {
    const known = Boolean(UPGRADES[id]) || (id.startsWith("unlock_") && Boolean(ABILITIES[id.slice("unlock_".length)]));
    if (!known) continue;
    const tier = value === true ? 1 : Math.max(0, Math.floor(Number(value) || 0));
    if (tier <= 0) continue;
    purchased[id] = Math.min(tier, upgradeMaxTier(id));
  }
  merged.upgrades.purchased = purchased;

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

  merged.round.number = Math.max(1, Math.floor(merged.round.number || 1));
  merged.round.status = merged.round.status === "ended" ? "ended" : "running";
  // An ended round holds no gate: the shop is what the player is looking at, and a flag left
  // set by a save written mid-gate would freeze the round it starts next.
  merged.round.awaitingWave = merged.round.awaitingWave === true && merged.round.status === "running";
  merged.round.elapsedSeconds = Math.max(0, Number(merged.round.elapsedSeconds) || 0);
  merged.round.wavesResolved = Math.max(0, Math.floor(merged.round.wavesResolved || 0));
  merged.round.fearEarned = Math.max(0, Math.floor(Number(merged.round.fearEarned) || 0));
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
  merged.essence = normalizeEssencePools(merged.essence);
  merged.resources.energy = Math.max(0, Math.floor(merged.resources.energy || 0));

  merged.abilities = normalizeAbilities(merged, merged.abilities);
  const pendingRecord = abilityRecord(merged, merged.pendingAbilityTarget);
  merged.pendingAbilityTarget = merged.abilities[merged.pendingAbilityTarget] && pendingRecord && pendingRecord.needsTarget
    ? merged.pendingAbilityTarget
    : null;

  merged._log = Array.isArray(merged._log) ? merged._log.slice(0, 24) : [];

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

  // The three toggles are display preferences, not run state, so they survive the reset.
  // Coming back to a wiped run in the wrong language - or at a speed the player did not pick -
  // would read as a second bug.
  const prefs = (raw && raw.ui) || {};
  if (prefs.language === "en") fresh.ui.language = "en";
  if (GAME_SPEEDS.includes(Number(prefs.gameSpeed))) fresh.ui.gameSpeed = Number(prefs.gameSpeed);
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
 * Export shim                                                          *
 *                                                                      *
 * The browser loads this as a classic script, so ui.js can just call    *
 * these by name. The test harness wants them as one object instead, in  *
 * either environment: `window.SpiritEngine` for tests.html, or          *
 * `module.exports` for node tests/run.js.                              *
 * ------------------------------------------------------------------ */

const ENGINE_EXPORTS = {
  SAVE_KEY,
  VERSION,
  TIME_SCALE,
  GAME_SPEEDS,
  DEFAULT_GAME_SPEED,
  WAVE_INTERVAL_SECONDS,
  BLIGHT_THRESHOLD_BASE,
  BLIGHT_PER_DAMAGE_SECOND,
  DAHAN_LOSS_PER_DAMAGE_SECOND,
  BLIGHT_FLOOR_FRACTION,
  DAHAN_ATTACK_INTERVAL_SECONDS,
  DAHAN_ATTACK_DAMAGE,
  DAHAN_PER_ROUND_START_BASE,
  DAHAN_MAX_SPREAD,
  DEFEAT_FX_MS,
  MAX_TICK_SECONDS,
  FEAR_PER_POWER,
  FEAR_PER_WAVE,
  EXPLORE_UNRESTRICTED_FROM_WAVE,
  ENERGY_PER_POWER,
  UNIT_STATS,
  unitStats,
  INVADER_TYPES,
  INVADER_TERRAINS,
  SPIRITS,
  ABILITIES,
  ABILITY_IDS,
  UPGRADES,
  UPGRADE_COST_GROWTH,
  UPGRADE_IDS,
  BOARD_LANDS,
  TERRAIN_RGB,
  LAND_IDS,
  I18N,
  setNowSource,
  setRng,
  isLandId,
  landTerrain,
  landIsCoastal,
  adjacentLands,
  areAdjacent,
  landsOfTerrain,
  locale,
  template,
  addLog,
  activeSpirit,
  landName,
  terrainName,
  terrainLandsSummary,
  unitLabelByType,
  unitLabelOne,
  abilityName,
  abilityText,
  abilityRequirementText,
  landPressure,
  buildOutcomeInLand,
  pressureChipText,
  pressureDetailText,
  buildChipText,
  etaText,
  upgradeName,
  upgradeText,
  formatFear,
  upgradeTier,
  upgradeMaxTier,
  upgradeCost,
  upgradeTotals,
  purchaseUpgrade,
  spiritAbilityIds,
  unlockedAbilityIds,
  lockedAbilityIds,
  abilityIsUnlocked,
  abilityUnlockCost,
  unlockAbility,
  abilityIsTiered,
  abilityMaxTier,
  abilityTier,
  abilityRecord,
  abilityUpgradeCost,
  upgradeAbility,
  abilityCooldownSeconds,
  abilityIsReady,
  abilityLegalLand,
  abilityLegalLands,
  pushableCount,
  pushDestinations,
  pushDestination,
  applyPushFrom,
  riversBountyLand,
  waveLands,
  effectiveSelectedLand,
  landRenderStates,
  invaderCountInLand,
  invaderDamageInLand,
  triggerAbility,
  resolveAbilityTarget,
  livingUnits,
  applyDamage,
  applyDamageToEachInvader,
  spendDahanAttack,
  gainFearFromDefeat,
  gainFearFromWave,
  gainEnergyFromDefeat,
  resolveAutoBoon,
  orderedUpgradeIds,
  lowestLandId,
  thinnestDefendedLand,
  cloneCombatState,
  landClearsToDahanStrike,
  landClearsWithDamageAndPush,
  landClearsWithDamageEach,
  buildThreatLands,
  worstBlightLand,
  innateT1BreakBuildLands,
  innateT1RouteToCoverLands,
  innateT1ProtectThinDahanLands,
  innateT2BreakBuildLands,
  innateT2RouteToCoverLands,
  innateT3BreakBuildLands,
  innateT3MostInvadersLand,
  innateT3ToughestLand,
  pickInnateTargetTier1,
  pickInnateTargetTier2,
  pickInnateTargetTier3,
  pickInnateAutoTarget,
  resolveAutoInnate,
  resolveAutoBounty,
  resolveAutoWashAway,
  pickWashAwayAutoTarget,
  addBlight,
  blightReached,
  resolveLandCombat,
  resolveContinuousCombat,
  resolveDahanAttack,
  landAcceptsExplorer,
  drawOpeningTerrains,
  drawInvaderTerrains,
  exploreTerrainCount,
  terrainList,
  landsOfTerrains,
  buildTerrains,
  exploreTerrains,
  resolveBuildPhase,
  resolveExplorePhase,
  shiftInvaderTrack,
  resolveWave,
  startRound,
  startNextRound,
  endRound,
  gameSpeed,
  setGameSpeed,
  autoProceedOn,
  autoStartRoundOwned,
  autoStartRoundOn,
  setAutoStartRound,
  resolveAutoStartRound,
  activeUpgradeTier,
  setAutoProceed,
  waveGateHeld,
  startNextWave,
  seedRoundDahan,
  seedRoundExplore,
  tick,
  createInitialState,
  createFreshGameState,
  createInvaderCounts,
  createInvaderDamage,
  createDahanCounts,
  createBlightByLand,
  createProgressByLand,
  normalizeInvaderCounts,
  normalizeInvaderDamage,
  normalizeState,
  migrateSave,
  loadState,
  saveState,
  activeDefeatFx,
  activeBlightFx,
  pruneFx
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ENGINE_EXPORTS;
} else if (typeof window !== "undefined") {
  window.SpiritEngine = ENGINE_EXPORTS;
}
