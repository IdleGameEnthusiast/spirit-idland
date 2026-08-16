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

// The speeds the dial only offers once the playtest code is redeemed. 8x is far past what the
// game is balanced to be read at - a whole wave arrives in two and a half real seconds - which
// is exactly what it is for: reaching wave twenty to look at something without playing there.
// It is kept out of GAME_SPEEDS rather than added to it so a save cannot come back stuck at a
// speed with no button to leave it by.
const PLAYTEST_GAME_SPEEDS = [8];

// What the two playtest buttons hand out. One number rather than two because they are the same
// idea - enough of a currency to stop a test being about earning it.
const PLAYTEST_GRANT = 100;

// Redeem codes, as typed to their effect. Compared lowercased and trimmed, so the bar forgives
// a stray space or a capital P.
const REDEEM_CODES = {
  playtester: "playtest"
};

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

/* ---------- The shop shortening it: haste, not subtraction ----------
 *
 * `dahan_remember` is a pool of Fear rather than a ladder of tiers, and what it buys is haste
 * on the strike clock: the interval is *divided* by `1 + haste` rather than having seconds
 * taken off it. Two reasons, and neither is arithmetic taste.
 *
 * The first is that the percentage then means something a player can check against the log:
 * 100% haste is 100% more strikes, not "100% off" a cooldown that would then be zero. The
 * second is that division composes. A second cooldown source - and the comment above says one
 * is expected - multiplies its own divisor in without either source having to know the other
 * exists, and no combination of them can ever reach zero. A subtractive rule would need a
 * floor bolted onto it the moment the second source arrived, and the floor would be the real
 * rule while the percentages were decoration.
 *
 * The cap is therefore a design decision rather than a safety rail: at 1.0 the Dahan strike
 * twice as often, which at the 1x speed dial is every 10 real seconds against the base 20,
 * and 10000 Fear is several times the price of the entire rest of the catalogue. It was
 * priced as the sink that outlives the shop, back when the shop was the only progression
 * axis; ascension is that axis now and this is a deep row that gets wiped like the rest. The
 * figure is left alone until a played cycle says what a cycle generates.
 */
const DAHAN_HASTE_FEAR_FOR_FULL = 10000;
const DAHAN_HASTE_MAX = 1;

/* ---------- The ascension layer (05-progression.md) ----------
 *
 * The spirit withdraws from the island and returns greater: everything Fear bought is given
 * back, and what the cycle *generated* is paid out in Presence.
 *
 * The unlock reads the payout itself: Reclaiming is offered once it would pay
 * ASCENSION_UNLOCK_PRESENCE, and not before. Gate and reward are then the same number, so there
 * is no cycle in which Reclaiming is legal and worthless. The all-time wave gate this replaces
 * measured depth the payout does not read, and let a cycle that had generated nothing Reclaim
 * for zero.
 *
 * It is re-earned every cycle, which the wave gate deliberately was not. That is not the wall a
 * per-cycle *depth* gate would have been: what it forbids is a Reclaim that hands back a whole
 * catalogue for four Presence or fewer, which is the trade the panel should never offer. What
 * it costs is the free Reclaim at the top of a fresh cycle, which paid nothing anyway.
 *
 * 5 is the figure PRESENCE_FEAR_DIVISOR was itself anchored to - "a first Reclaim should pay
 * about 5" - so the gate asks for exactly what the payout was always meant to deliver first. In
 * generated Fear that is 5*5*100 = 2500, but the constant is written in Presence on purpose:
 * retuning the divisor moves the Fear the gate costs and leaves the promise to the player alone.
 *
 * The payout is a square root, and that is the whole mechanism. A linear payout would make a
 * cycle twice as long pay exactly twice as much, so waiting would never be worse than
 * Reclaiming and the answer to "should I ascend now" would be *no, later*, forever - a
 * decision the player is asked to make and can only get wrong. Under the root, doubling a
 * cycle's Fear pays 1.41x, so two short cycles beat one long one and ascending early is a real
 * strategy rather than a mistake. It also absorbs the compounding: the payout reads *banked*
 * Fear, which the three Fear ladders multiply and high_water_mark makes quadratic in depth, so
 * a linear payout on top of that would be quadratic on quadratic.
 *
 * PRESENCE_FEAR_DIVISOR is a guess anchored only to "a first Reclaim should pay about 5", and
 * the pacing of the entire layer rides on it - the unlock above included, since 5 Presence is
 * 25 divisors of generated Fear. No cycle has been played to read the real figure. The
 * measurement is one line in the playtest tally: play a cycle to the point where a Reclaim
 * feels earned, read cycleFearGenerated, and the divisor is that number over 25.
 */
const ASCENSION_UNLOCK_PRESENCE = 5;
const PRESENCE_FEAR_DIVISOR = 100;

// What unspent Presence is worth while it sits in the purse, so that holding it instead of
// spending it is a real choice and not a free stat. Uncapped and read live, not from the round
// snapshot the three Fear ladders use - Presence never moves mid-round from combat, only from
// Reclaiming (which ends the round outright) or a Presence purchase (which only ever lowers
// it), so there is no same-round loop here for a snapshot to guard against.
const PRESENCE_FEAR_BONUS_PER_POINT = 0.01;

// Ten tiers, +10% each, +100% at the top - see the note above the three ladders in UPGRADES.
const FEAR_LADDER_MAX_TIER = 10;

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
 *   20  One land of each Discover takes a second Explorer
 *   30  A Town appears each wave in some land that has none
 *   40  Discover seeds two Explorers per land instead of one
 *   50  Discover takes one extra land, off-terrain
 *   60  Discover draws two terrains instead of one, and stops avoiding Build
 *   70  Build runs twice
 *   80  Discover draws three terrains
 *   90  Discover draws every terrain
 *  100  Invaders hit harder, and again every 20 waves after
 *  110  Invaders are tougher, and again every 20 waves after
 *
 * Doubling the Discover seed arrives in two steps rather than one. A single terrain covers
 * exactly two lands (see BOARD_LANDS), so the old one-step rung went from two Explorers a wave
 * to four - the sharpest jump on the whole ladder, and the one that decided most rounds. Wave
 * 20 now adds the third Explorer and wave 40 adds the fourth, which is the same climb with the
 * cliff taken out of it. Everything the old wave 40 carried and above sits ten waves later to
 * make room, including both stat rungs.
 *
 * Because the track slides forward (see shiftInvaderTrack), every rung that widens Discover
 * widens Build one wave later - the terrains discovered this wave are the ones built next.
 * That coupling is the point: the player watches a terrain thicken before it does.
 *
 * Wave 60 carries a second rule on the same rung, and for the same reason. Below it, Discover
 * steers around whatever is in the Build slot, so a land being reinforced this wave is never
 * also being seeded: pressure spreads out, and the board always offers somewhere quieter to
 * stand. From 60 the draw is free - a terrain may sit in both slots at once, and when it does
 * that terrain's two lands take a Build and a Discover in the same wave and then inherit that
 * Build again on the next. That is the point of the rung: the wave stops guaranteeing the
 * player a fresh front and starts letting the same one compound.
 */
const EXPLORE_UNRESTRICTED_FROM_WAVE = 10;
const EXPLORE_SECOND_EXPLORER_FROM_WAVE = 20;
const BONUS_TOWN_FROM_WAVE = 30;
const EXPLORE_DOUBLE_SEED_FROM_WAVE = 40;
const EXPLORE_EXTRA_LAND_FROM_WAVE = 50;
const EXPLORE_TWO_TERRAINS_FROM_WAVE = 60;
// Deliberately the same wave rather than its own number: the free draw is the second half of
// the two-terrain rung, so it moves wherever that rung moves and can never drift off it.
const EXPLORE_FREE_DRAW_FROM_WAVE = EXPLORE_TWO_TERRAINS_FROM_WAVE;
const BUILD_TWICE_FROM_WAVE = 70;
const EXPLORE_THREE_TERRAINS_FROM_WAVE = 80;
const EXPLORE_ALL_TERRAINS_FROM_WAVE = 90;

// How many terrains Discover draws, by wave. Read in order, first match wins - so the table
// reads top-down as the ladder climbs rather than as a chain of comparisons. `Infinity` is
// "every terrain there is", clamped against INVADER_TERRAINS at the point of use so this
// table never has to know how many that is.
const EXPLORE_TERRAIN_RUNGS = [
  { fromWave: EXPLORE_ALL_TERRAINS_FROM_WAVE, terrains: Infinity },
  { fromWave: EXPLORE_THREE_TERRAINS_FROM_WAVE, terrains: 3 },
  { fromWave: EXPLORE_TWO_TERRAINS_FROM_WAVE, terrains: 2 }
];

// The last two rungs never stop. From wave 100 every point of Invader damage is +1, and again
// every 20 waves; health does the same from 110, so the two alternate every ten waves forever
// and a round can always be out-scaled eventually. Damage is deliberately the first of the
// pair: power is read off damage (see gainFearFromDefeat), so a damage rung raises what an
// Invader is worth in the same stroke as what it threatens, and the two stay in agreement.
const INVADER_DAMAGE_RUNG_FROM_WAVE = 100;
const INVADER_HEALTH_RUNG_FROM_WAVE = 110;
const INVADER_STAT_RUNG_INTERVAL = 20;

/* ---------- The ladder as the track prints it ----------
 *
 * The same rungs again, in climbing order, as rows a panel can draw: the wave each lands on,
 * what it does, and whether this round has reached it. It is a second reading of the table
 * above rather than a second copy of it - every entry points at the constant its rule reads,
 * so a rung that moves moves on the track in the same edit.
 *
 * This exists because the ladder was invisible. A round simply got worse and the only place
 * the reason was written down was this file: nothing on screen said at which wave, or what was
 * coming next, so a player could not plan a run around it. Since the rungs are per round, the
 * readout doubles as the thing that teaches the shape of a round at all.
 *
 * `repeats` marks the two that never stop. Those print their *next* firing rather than their
 * first - a round at wave 150 wants to read "170 Invaders hit harder", not a rung it cleared
 * fifty waves ago - and carry what they are worth so far in their text.
 */
const DIFFICULTY_RUNGS = [
  { wave: EXPLORE_UNRESTRICTED_FROM_WAVE, key: "rungUnrestricted" },
  { wave: EXPLORE_SECOND_EXPLORER_FROM_WAVE, key: "rungSecondExplorer" },
  { wave: BONUS_TOWN_FROM_WAVE, key: "rungBonusTown" },
  { wave: EXPLORE_DOUBLE_SEED_FROM_WAVE, key: "rungDoubleSeed" },
  { wave: EXPLORE_EXTRA_LAND_FROM_WAVE, key: "rungExtraLand" },
  { wave: EXPLORE_TWO_TERRAINS_FROM_WAVE, key: "rungTwoTerrains" },
  { wave: BUILD_TWICE_FROM_WAVE, key: "rungBuildTwice" },
  { wave: EXPLORE_THREE_TERRAINS_FROM_WAVE, key: "rungThreeTerrains" },
  { wave: EXPLORE_ALL_TERRAINS_FROM_WAVE, key: "rungAllTerrains" },
  { wave: INVADER_DAMAGE_RUNG_FROM_WAVE, key: "rungInvaderDamage", repeats: true },
  { wave: INVADER_HEALTH_RUNG_FROM_WAVE, key: "rungInvaderHealth", repeats: true }
];

// One row per rung: `wave` is the wave it next lands on, `reached` whether it is already live,
// and `next` marks the single row that lands soonest. Text is finished here rather than in the
// panel, so the two repeating rungs can say what they are worth without the panel knowing how
// the ladder is built.
function difficultyLadder(state) {
  const t = locale(state);
  const wave = state && state.round ? state.round.wavesResolved : 0;

  const rows = DIFFICULTY_RUNGS.map((rung) => {
    if (!rung.repeats) {
      return { key: rung.key, wave: rung.wave, text: t[rung.key], reached: wave >= rung.wave, next: false };
    }
    const bonus = repeatingRungBonus(wave, rung.wave);
    return {
      key: rung.key,
      wave: rung.wave + bonus * INVADER_STAT_RUNG_INTERVAL,
      text: bonus > 0 ? template(t.rungRepeated, { text: t[rung.key], bonus }) : t[rung.key],
      reached: bonus > 0,
      next: false
    };
  });

  // Whichever lands soonest, which is not simply the first unreached row: past the stat rungs
  // every row is reached and what comes next is a repeat rather than a first firing.
  let soonest = null;
  for (const row of rows) {
    if (row.wave > wave && (!soonest || row.wave < soonest.wave)) soonest = row;
  }
  if (soonest) soonest.next = true;

  return rows;
}

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
// Energy is the round's own currency and it does not survive one: startRound clears it along
// with everything bought with it. The kit is rebuilt from scratch every round, and the only
// thing that carries is Fear - which is what the shop's permanent upgrades are drawn from.
// So the two currencies answer two different questions: Energy is "what can this round
// become", Fear is "what does every round start as". `headwaters` below is the one place the
// second question is answered with the first currency.
const ENERGY_PER_POWER = 1;

/* ---------- headwaters: what a round opens with ----------
 *
 * Cumulative Energy at the start of a round, indexed by owned tier - not a per-tier step. It
 * has to be a table because the gain is not linear: it climbs with the price instead of
 * staying flat, which is the opposite of every other ladder in the shop.
 *
 * That inversion is deliberate and it is forced by the cost curve. A flat-gain ladder against
 * 1.6x-a-tier is what makes the top rungs of `dahan_reinforcement` bad buys on purpose (see
 * UPGRADE_COST_GROWTH) - fine over 5 tiers, useless over 9, where the last tier costs 43x the
 * first. Tracking the gain to the price keeps all nine rungs live: Fear per point of Energy
 * still climbs, from 8 at the bottom to 38 at the top, just gently enough that no tier is
 * dead weight.
 *
 * The first three tiers are weak on purpose and are not a mistake to be fixed: 3 Energy
 * crosses none of the ability prices (5 / 10 / 20), so it is worth about three Boon ticks off
 * the opening. They are the entry fee on a ladder whose top is very strong, and they are
 * priced like one.
 *
 * The ceiling is exactly 5 + 10 + 20, the whole unlock ladder. A tier 9 round paired with
 * `auto_buy_abilities` opens with the entire kit bought and not one Energy spare, which is
 * the most this is ever meant to be worth. That is why it is capped and the Fear ladders are
 * not - what it buys genuinely runs out, and past 35 it would only be pre-banking toward the
 * Innate's tier 2 (40).
 */
const STARTING_ENERGY_BY_TIER = [0, 1, 2, 3, 5, 8, 13, 19, 26, 35];

// The three Fear ladders (see UPGRADES). All three step by the same +10% a tier so the shop
// reads as one shape three times; what differs is which half of the income they multiply.
const FEAR_KILL_BONUS_PER_TIER = 0.10;
const FEAR_WAVE_BONUS_PER_TIER = 0.10;

// high_water_mark: every Nth wave pays a bonus of `tier * FRACTION` of its own wave number.
// The interval is what makes the payout quadratic in depth rather than linear - a run to wave
// 10m collects `tier * m(m+1)/2` where the flat per-wave Fear collects 10m.
const FEAR_MILESTONE_WAVE_INTERVAL = 10;
const FEAR_MILESTONE_FRACTION_PER_TIER = 0.10;

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
    name: "Reißende Fluten im Sonnenlicht",
    englishName: "River Surges in Sunlight",
    traits: "Schnelle Ströme verschieben Invasoren und halten das Land beweglich. Fokus: Kontrolle, Positionierung und stetiger Fluss.",
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
        upgradeCost: 40
      },
      {
        cooldownSeconds: 16 * TIME_SCALE,
        needsTarget: true,
        effect: "damage_and_push",
        damage: 2,
        pushCount: 3,
        upgradeCost: 150
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
  // The one ability that can take a unit off the island without hurting it. Inland it is a
  // shove; from a coastal land the water keeps going and what it carries does not come back.
  // `seaCount` is under `pushCount` on purpose - a shove is cheap and a one-way trip is not.
  wash_away: {
    id: "wash_away",
    // Dearer than Flash Floods (10), because removal outlives damage: 2 points buy less at
    // every rung of the invader health ladder, and a drowning buys the same thing on wave 40
    // as it did on wave 1.
    unlockCost: 20,
    cooldownSeconds: 30 * TIME_SCALE,
    needsTarget: true,
    effect: "wash_invaders",
    pushCount: 3,
    seaCount: 2
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
  headwaters: {
    id: "headwaters",
    repeatable: true,
    effect: "starting_energy_per_tier",
    // The gain per tier is not flat, so it lives in STARTING_ENERGY_BY_TIER rather than here -
    // see the note above that table for why this ladder is shaped against the grain of every
    // other one. `maxTier` is its length: the ladder ends where the unlock kit does.
    //
    // Priced from the same 8 the ladder needs to reach 344 at tier 9, which is 903 Fear for
    // the whole thing - the dearest row in the catalogue, above auto_start_round (500). It
    // should be: what it ends at is the full kit in hand before the first wave, every round,
    // forever. It is also the one upgrade whose worth *shrinks* with depth, the exact inverse
    // of high_water_mark - a run to wave 100 barely notices its first thirty seconds. This
    // pays for playing; the Mark pays for pushing.
    baseCost: 8,
    maxTier: STARTING_ENERGY_BY_TIER.length - 1
  },

  /* ---------- The three Fear ladders ----------
   *
   * One shape read three times: ten tiers, +10% a tier, +100% at the top, on the 1.6 curve
   * every other repeatable uses. At 1.6 a tier costs 60% more than the one under it while
   * paying the same flat +10%, so the price pulls away from the payoff on its own: tier 1 pays
   * for itself in about two rounds, tier 10 in over a hundred.
   *
   * They used to carry no `maxTier` at all - soft-capped, stopped by the curve rather than by
   * a number - and the reason was structural rather than numeric. The Fear shop was the game's
   * only progression axis, so it had to keep absorbing income forever or the game ran out of
   * progression. Ascension is that axis now, and a catalogue whose size Presence grows does not
   * need a row with no top. Ten tiers is the whole matched set: +100% each, finishable, and
   * able to reach the shop's sold-out half like every other row.
   *
   * Tier 12 alone cost more than the whole ten-tier ladder, so the cap removes rungs nobody was
   * going to buy and turns "this never ends" into a number a player can plan against.
   */
  rising_dread: {
    id: "rising_dread",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_kill_bonus_per_tier",
    // The cheapest ladder in the shop and deliberately the strongest early buy: at 6 Fear it
    // pays back inside two rounds. It is priced under dahan_reinforcement (10) without being
    // strictly better than it - the Dahan tier buys survival as well as income, and this buys
    // only income - so the opening move becomes a choice rather than a script.
    baseCost: 6
  },
  mounting_terror: {
    id: "mounting_terror",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_wave_bonus_per_tier",
    // Same price as rising_dread on purpose, even though wave Fear is the smaller half of the
    // income and falls further behind at every damage rung of the ladder. What squares the two
    // is high_water_mark below: it multiplies the milestone payout too, which is the half of
    // wave income that grows with depth. Bought alone this is the weaker ladder; bought
    // alongside the Mark it is the multiplier on the fastest-growing number in the game.
    baseCost: 6
  },
  high_water_mark: {
    id: "high_water_mark",
    repeatable: true,
    maxTier: FEAR_LADDER_MAX_TIER,
    effect: "fear_wave_milestone_per_tier",
    // Every tenth wave pays a bonus of `tier * 10%` of its own number. Wave 50 at tier 3 pays
    // 15. That makes the total quadratic in depth - a run to wave 10m collects
    // `tier * m(m+1)/2` - against the flat 1-per-wave the baseline pays, which is the one
    // thing in the shop whose worth grows faster than the invaders do.
    //
    // Twice the base of the other two because each tier is worth roughly 3-5x as much at
    // depth (about 55 Fear a run at wave 100 against a multiplier tier's 10-20). It is still
    // the weakest of the three for a player dying at wave 30, where a tier is worth about 6 a
    // run - which is the point: this is the ladder that pays for pushing rather than for
    // playing, and it should not be the obvious first buy.
    baseCost: 12
  },

  /* ---------- The Dahan Remember: a pool, not a ladder ----------
   *
   * Every other row in the shop asks the same question - is the next tier worth its price -
   * and the answer is a yes or a no. This one asks nothing. Fear goes in at one Fear a tier,
   * flat, forever, and what comes back out is haste on the Dahan's strike clock at exactly
   * the rate it went in. A tier here is not a rung; it is a unit of the pool, which is why
   * the row shows a percentage where every other repeatable shows "Tier n" - the tier number
   * is an implementation detail and 4271 of them is not a thing to tell a player.
   *
   * `costGrowth: 1` is the whole of what makes it a pool. The 1.6 curve everywhere else is
   * there to keep a ladder a decision; a sink is the opposite of a decision, and a sink whose
   * price climbed would just be another ladder with a worse name.
   *
   * Its 10000 was priced when the Fear shop was the only progression axis and the pool had to
   * absorb income forever. Ascension is that axis now, so this is a deep row that gets wiped
   * like every other - deep enough that early cycles will not fill it, which makes it scenery
   * for a while rather than a trap. The figure is left alone deliberately until a played cycle
   * says what a cycle actually generates.
   */
  dahan_remember: {
    id: "dahan_remember",
    repeatable: true,
    effect: "dahan_attack_haste",
    // One Fear, one hundredth of a percent, and the cap is the whole pool - see
    // DAHAN_HASTE_FEAR_FOR_FULL for why the price is what it is.
    baseCost: 1,
    costGrowth: 1,
    maxTier: DAHAN_HASTE_FEAR_FOR_FULL,
    // What the row offers instead of a single Buy. A pool this deep cannot be filled a click
    // at a time, and the small denominations stay because the last few hundred Fear before
    // the cap should not have to be overpaid in thousands.
    bulkAmounts: [1, 10, 100, 1000]
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
  // The three ability automations below are ranked by what their ability puts on the board or
  // takes off it, not by how much clicking they save: the Bounty reinforces, the Floods kill,
  // and the sea removes. Each rung up is a stronger claim on the round than the one under it.
  auto_bounty: {
    id: "auto_bounty",
    repeatable: false,
    effect: "auto_cast_bounty",
    // The cheapest of the three, because it is the only one whose ability picks its own land -
    // there is no judgement here to buy back, only the click. What it sells is a Dahan every
    // 15 beats, all round, which is the same thing the reinforcement ladder sells and is worth
    // more than the ladder's last rung (10 * 1.6^7, about 268) charges for a single one. It is
    // priced under that rung deliberately: the ladder is the early game's lever and this is
    // the thing that eventually replaces it.
    baseCost: 200
  },
  auto_flash_floods: {
    id: "auto_flash_floods",
    repeatable: false,
    effect: "auto_cast_flash_floods",
    // Dearer than the Bounty because it kills, and a defeat pays Fear and Energy at once
    // where a Dahan only holds ground. Cheaper than the sea because what it kills with is
    // damage, and 2 points buy fewer bodies at every rung of the invader health ladder: this
    // is the one automation on this list whose worth thins out as the round climbs.
    baseCost: 300
  },
  auto_wash_away: {
    id: "auto_wash_away",
    repeatable: false,
    effect: "auto_cast_wash_away",
    // The dearest of the three, and the only automation whose worth *grows* with the round.
    // The sea takes a unit off the island whole, so it pays a defeat's Fear and Energy without
    // spending damage to do it - and it costs the same on the fortieth wave as on the first,
    // while every damage number in the kit is losing ground to invader health. It stays under
    // auto_start_round (500), which is still the only purchase that changes the shape of the
    // game rather than a number in it.
    baseCost: 400
  },

  /* ---------- The two rows Presence unlocks ----------
   *
   * The only rows in this catalogue that Fear alone cannot reach. Each names a Presence row in
   * `presenceUnlock`, and until that row is bought the Fear row is locked whatever the purse
   * holds (see upgradeNeedsPresence).
   *
   * They were behind a completion gate until the ascension layer landed: refused until every
   * other row was maxed, which is ~2674 Fear and something like ninety hand-played rounds
   * before the game would play itself. The gate is deleted along with the idea it rested on -
   * that the shop is a thing which finishes.
   *
   * The Fear price is still owed, and owed again every cycle: a Presence unlock puts the row in
   * the shop, it does not buy the row. So every cycle opens hand-played and 500 Fear is a live
   * decision against the five tiers of rising_dread it would otherwise buy. That trade - play
   * this cycle actively, or pay to idle it - is the point of leaving the price where it is.
   */
  auto_buy_abilities: {
    id: "auto_buy_abilities",
    repeatable: false,
    effect: "auto_buy_abilities",
    presenceUnlock: "presence_river_knows",
    // Cheap for where it sits, and deliberately so: Presence is what holds it back, not the
    // price. What it sells is also less than the automations under it - it spends Energy the
    // round was already going to spend, in the order a settled player already spends it, and
    // buys back the clicks rather than any new power.
    baseCost: 200
  },
  auto_start_round: {
    id: "auto_start_round",
    repeatable: false,
    effect: "auto_start_round",
    presenceUnlock: "presence_tide_returns",
    // The most expensive one-off in the shop, and the only one that changes the shape of the
    // game rather than a number in it: rounds stop needing a hand on them. Priced as a
    // milestone - several rounds of income even once the ladders are deep - because what it
    // buys is every round after it, for the rest of the cycle.
    baseCost: 500
  }
};

/* ------------------------------------------------------------------ *
 * The Presence catalogue (05-progression.md, 07-content-registry.md)   *
 *                                                                      *
 * Fear buys. Presence decides what Fear is allowed to buy.             *
 *                                                                      *
 * Every row here unlocks a Fear row and does nothing else. Presence never touches the board:
 * it buys no Dahan, shortens no clock, adds no damage. That is what makes the two currencies
 * impossible to price against each other - there is no exchange rate to get wrong, and no
 * future Presence row can quietly do a Fear row's job at a different price.
 *
 * Prices are flat because neither row is repeatable. A repeatable row added later wants
 * something nearer 1.3-1.5 growth, or none at all: Presence income is root-shaped and grows
 * slowly, so the Fear catalogue's 1.6 curve would kill a Presence ladder inside three tiers.
 *
 * The names are the ones the Fear rows already carried, kept rather than invented. The
 * Presence row and the Fear row it opens are the same idea at two prices, and separate names
 * would make the player learn the pairing.
 * ------------------------------------------------------------------ */

const PRESENCE_UPGRADES = {
  // 2 and 3 against a first payout of about 5, so the first Reclaim buys both. Deliberate: the
  // first ascension should read as an unambiguous win rather than a dilemma. Dilemmas belong
  // to rows that do not exist yet.
  presence_tide_returns: {
    id: "presence_tide_returns",
    unlocks: "auto_start_round",
    cost: 2
  },
  presence_river_knows: {
    id: "presence_river_knows",
    unlocks: "auto_buy_abilities",
    cost: 3
  }
};

const PRESENCE_UPGRADE_IDS = Object.keys(PRESENCE_UPGRADES);

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
        "Schiebt {push} Entdecker/Dorf in ein angrenzendes Gebiet.",
        "{damage} Schaden. Schiebt bis zu {push} Entdecker/Dörfer in ein angrenzendes Gebiet.",
        "{damage} Schaden auf jeden Invasor im gewählten Gebiet."
      ],
      boon_of_vigor: "+{amount} Energie.",
      rivers_bounty: "+{amount} Dahan im Gebiet mit den wenigsten Dahan und Invasoren, wenn möglich.",
      flash_floods: "{damage} Schaden. Liegt das Ziel an der Küste: +{coastal} Schaden.",
      wash_away: "Schiebt bis zu {push} Entdecker/Dörfer in ein angrenzendes Gebiet. An der Küste spült das Wasser stattdessen bis zu {sea} von der Insel ins Meer."
    },

    mapTitle: "Die Insel",

    shopTitle: "Zwischen den Runden",
    shopLostRound: "Runde {round} verloren. {fear} Furcht in dieser Runde erbeutet.",
    // Während eine Runde läuft, steht statt der Verlustmeldung, was sie bisher eingebracht
    // hat - und dass es erst am Rundenende gebucht wird.
    shopRoundRunning: "Runde {round} läuft, Welle {wave}. {fear} Furcht bisher - buchbar am Rundenende.",
    shopFearLabel: "Verfügbare Furcht",
    shopTierLabel: "Stufe {tier}",
    // Was ein Becken dort zeigt, wo eine Leiter ihre Stufe zeigt - siehe upgradeStatusText.
    shopHasteLabel: "{pct}% schneller",
    shopCostLabel: "{cost} Furcht",
    // Die Knöpfe des Beckens: je eine Stückelung, dann alles, was die Börse hergibt.
    shopInvestBtn: "+{amount}",
    shopInvestMaxBtn: "Max",
    shopInvestTitle: "{amount} Furcht einlegen",
    shopInvestMaxTitle: "{amount} Furcht einlegen - alles, was du dir leisten kannst",
    shopBuyBtn: "Kaufen",
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
      presence_river_knows: "Der Fluss weiß, was er braucht"
    },
    presenceTexts: {
      presence_tide_returns: "Öffnet \"Die Flut kehrt wieder\" im Furchtladen. Die Furcht dafür ist weiter fällig - in jedem Zyklus neu.",
      presence_river_knows: "Öffnet \"Der Fluss weiß, was er braucht\" im Furchtladen. Die Furcht dafür ist weiter fällig - in jedem Zyklus neu."
    },
    presencePurchased: "{upgrade} für {cost} Präsenz. {unlocks} steht jetzt im Laden.",
    presenceOwned: "{upgrade} gehört dir bereits.",
    presenceTooExpensive: "{upgrade} kostet {cost} Präsenz, du hast {presence}.",
    presenceCostLabel: "{cost} Präsenz",
    presenceOwnedBtn: "Freigeschaltet",
    upgradeNames: {
      dahan_reinforcement: "Verstärkung der Dahan",
      blight_resilience: "Widerstand gegen Verderbnis",
      headwaters: "Quellwasser",
      rising_dread: "Steigendes Grauen",
      mounting_terror: "Wachsender Schrecken",
      high_water_mark: "Hochwassermarke",
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
      // Kein Vergleich mit dem Grundwert - siehe die englische Fassung.
      dahan_remember: "{invested} / {full} Furcht erinnert ({pct}%). Die Dahan schlagen alle {seconds}s zu. 100 Furcht bringen 1% mehr."
    },
    upgradeMaxedTexts: {
      headwaters: "Jede Runde beginnt mit {energy} Energie in der Hand: die ganze Ausrüstung, gekauft vor der ersten Welle.",
      dahan_remember: "Alle {full} Furcht erinnert. Die Dahan schlagen alle {seconds}s zu - doppelt so oft wie die {base}s, mit denen sie begannen."
    },

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
    discoverWord: "Entdecken",
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

    hudTitle: "Round",
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
    abilityNames: {
      innate_power: "Innate Power",
      boon_of_vigor: "Boon of Vigor",
      rivers_bounty: "River's Bounty",
      flash_floods: "Flash Floods",
      wash_away: "Wash Away"
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
      wash_away: "Push up to {push} Explorers/Towns to an adjacent land. From a coastal land, up to {sea} are washed out to sea and off the island instead."
    },

    mapTitle: "The Island",

    shopTitle: "Between Rounds",
    shopLostRound: "Round {round} lost. {fear} Fear earned this round.",
    shopRoundRunning: "Round {round} running, wave {wave}. {fear} Fear so far - banked when the round ends.",
    shopFearLabel: "Fear available",
    shopTierLabel: "Tier {tier}",
    // What a pool shows where a ladder shows its tier - see upgradeStatusText.
    shopHasteLabel: "{pct}% faster",
    shopCostLabel: "{cost} Fear",
    // The pool's buttons: a denomination each, then everything the purse holds.
    shopInvestBtn: "+{amount}",
    shopInvestMaxBtn: "Max",
    shopInvestTitle: "Invest {amount} Fear",
    shopInvestMaxTitle: "Invest {amount} Fear - everything you can afford",
    shopBuyBtn: "Buy",
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
      presence_river_knows: "The River Knows Its Own Need"
    },
    presenceTexts: {
      presence_tide_returns: "Opens \"The Tide Returns\" in the Fear shop. Its Fear price is still owed - every cycle, again.",
      presence_river_knows: "Opens \"The River Knows Its Own Need\" in the Fear shop. Its Fear price is still owed - every cycle, again."
    },
    presencePurchased: "{upgrade} for {cost} Presence. {unlocks} is in the shop now.",
    presenceOwned: "{upgrade} is already yours.",
    presenceTooExpensive: "{upgrade} costs {cost} Presence, you have {presence}.",
    presenceCostLabel: "{cost} Presence",
    presenceOwnedBtn: "Unlocked",
    upgradeNames: {
      dahan_reinforcement: "Dahan Reinforcement",
      blight_resilience: "Blight Resilience",
      headwaters: "Headwaters",
      rising_dread: "Rising Dread",
      mounting_terror: "Mounting Terror",
      high_water_mark: "High-Water Mark",
      dahan_remember: "The Dahan Remember",
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
      dahan_remember: "{invested} / {full} Fear remembered ({pct}%). The Dahan strike every {seconds}s. 100 Fear buys another 1%."
    },
    upgradeMaxedTexts: {
      headwaters: "Every round opens with {energy} Energy in hand: the whole unlock kit, before the first wave.",
      dahan_remember: "All {full} Fear remembered. The Dahan strike every {seconds}s - twice as often as the {base}s they began with."
    },

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
    push: record.pushCount || 0,
    sea: record.seaCount || 0
  });
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

// The strike interval as the player's own stopwatch would measure it: game seconds divided by
// the speed dial, exactly like every countdown on the HUD. One decimal, because the first few
// hundred Fear move it by tenths and a whole-second readout would swallow them.
function strikeSecondsText(state, gameSeconds) {
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

function presenceUpgradeName(state, presenceId) {
  const t = locale(state);
  return (t.presenceNames && t.presenceNames[presenceId]) || presenceId;
}

function presenceUpgradeText(state, presenceId) {
  const t = locale(state);
  return (t.presenceTexts && t.presenceTexts[presenceId]) || "";
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
    if (tier >= upgradeMaxTier("headwaters")) {
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
    const parts = {
      invested,
      full: DAHAN_HASTE_FEAR_FOR_FULL,
      pct: hastePctText(dahanHasteFraction(invested)),
      seconds: strikeSecondsText(state, dahanAttackIntervalFor(invested)),
      base: strikeSecondsText(state, DAHAN_ATTACK_INTERVAL_SECONDS)
    };
    if (invested >= upgradeMaxTier("dahan_remember")) {
      return template((t.upgradeMaxedTexts || {}).dahan_remember, parts);
    }
    return template((t.upgradeNextTexts || {}).dahan_remember, parts);
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
      pct: hastePctText(dahanHasteFraction(upgradeTier(state, upgradeId)))
    });
  }
  return template(t.shopTierLabel, { tier: upgradeTier(state, upgradeId) });
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

function activeFearFx(state) {
  const fx = normalizeFearFx(state.ui && state.ui.fearFx);
  return fxIsFresh(fx) ? fx : null;
}

function pruneFx(state) {
  if (!fxIsFresh(normalizeDefeatFx(state.ui.defeatFx))) state.ui.defeatFx = null;
  if (!fxIsFresh(normalizeBlightFx(state.ui.blightFx))) state.ui.blightFx = null;
  if (!fxIsFresh(normalizeFearFx(state.ui.fearFx))) state.ui.fearFx = null;
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

function presenceUpgradeCost(presenceId) {
  const record = PRESENCE_UPGRADES[presenceId];
  return record ? record.cost : Infinity;
}

function purchasePresenceUpgrade(state, presenceId) {
  const t = locale(state);
  const record = PRESENCE_UPGRADES[presenceId];
  if (!record) return false;

  if (presenceUpgradeOwned(state, presenceId)) {
    addLog(state, template(t.presenceOwned, { upgrade: presenceUpgradeName(state, presenceId) }));
    return false;
  }

  const cost = record.cost;
  if (state.meta.presence < cost) {
    addLog(state, template(t.presenceTooExpensive, {
      upgrade: presenceUpgradeName(state, presenceId),
      cost,
      presence: state.meta.presence
    }));
    return false;
  }

  state.meta.presence -= cost;
  state.presenceUpgrades.purchased[presenceId] = 1;

  // Names the Fear row it opened, not just itself. What a Presence purchase *does* is put a
  // row in the other shop, and a log line that did not say which one would be reporting a
  // number going down and nothing going up.
  addLog(state, template(t.presencePurchased, {
    upgrade: presenceUpgradeName(state, presenceId),
    unlocks: upgradeName(state, record.unlocks),
    cost
  }));
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

// Cost of the *next* tier. Rounded to whole Fear so the shop never shows 6.4 Fear.
function upgradeCost(state, upgradeId) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const tier = upgradeTier(state, upgradeId);
  return Math.round(record.baseCost * Math.pow(upgradeCostGrowth(upgradeId), tier));
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
  return upgradeCostFromTier(upgradeId, upgradeTier(state, upgradeId), count);
}

/* The same sum without a state to read the starting rung from.
 *
 * upgradeCostFor is this function with `from` filled in from what the player owns, which is
 * every caller in the game. The one caller that needs the other end of it is the migration in
 * normalizeState, which asks what a save's owned tiers *have already cost* - a question about
 * rungs 0..n-1, with no state to ask because the state is still being built.
 */
function upgradeCostFromTier(upgradeId, from, count) {
  const record = UPGRADES[upgradeId];
  if (!record) return Infinity;
  const want = Math.max(0, Math.floor(Number(count) || 0));
  if (want === 0) return 0;

  const tier = Math.max(0, Math.floor(Number(from) || 0));
  const growth = upgradeCostGrowth(upgradeId);
  if (growth === 1) return Math.round(record.baseCost) * want;

  let total = 0;
  for (let i = 0; i < want; i += 1) total += Math.round(record.baseCost * Math.pow(growth, tier + i));
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

  if (upgradeCostGrowth(upgradeId) === 1) {
    const each = Math.max(1, Math.round(record.baseCost));
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
    spent += Math.round(record.baseCost * Math.pow(growth, tier + count));
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

// The ranking among a set of candidate destinations. A land with Dahan already standing on it
// wins outright when there is one - the pushed unit lands straight in front of a defender
// instead of sitting somewhere undefended racking up Blight for free. Failing that, a coastal
// one wins - pushing toward the water is what this spirit does, and it is also the harder land
// for the invaders to build back into.
function preferredPushLands(state, candidates) {
  const defended = candidates.filter((other) => (state.dahan[other] || 0) > 0);
  const pool = defended.length > 0 ? defended : candidates;
  const coastal = pool.filter(landIsCoastal);
  return coastal.length > 0 ? coastal : pool;
}

// Where a push can land: open ground first - an adjacent land holding no invaders at all - and
// a neighbour that already holds invaders only when there is no open ground left.
//
// The occupied fallback is what the board game has always allowed and what this engine used to
// refuse. Refusing it made the push the one effect that stopped working as the round went on:
// a full island is exactly when the pressure most needs moving, and exactly when every
// neighbour was disqualified. It is not free - shoving a Town onto a land that already holds
// one is what turns the next Build into a City - which is why it is last, and why the
// auto-casts that push for position ask for open ground instead (see pushHasOpenGround).
//
// Every land on this board has at least two neighbours, so this never comes back empty.
function pushDestinations(state, landId) {
  const neighbours = adjacentLands(landId);
  const open = neighbours.filter((other) => invaderCountInLand(state.invaders[other]) <= 0);
  return preferredPushLands(state, open.length > 0 ? open : neighbours);
}

// Is there open ground next to this land - somewhere a push can go without stacking onto
// invaders that are already standing there?
function pushHasOpenGround(state, landId) {
  return adjacentLands(landId).some((other) => invaderCountInLand(state.invaders[other]) <= 0);
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
    round: {
      fearEarned: 0,
      fearEarnedBase: 0,
      wavesResolved: state.round ? state.round.wavesResolved : 0
    },
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

// Prio 2: an undefended land, pushed into open ground that already holds Dahan - now that
// pushDestinations prefers a defended neighbour on its own, this only has to check whether the
// push this land would make lands on one.
//
// Open ground, not just any neighbour: this rung and the next push for *position*, and the
// occupied fallback in pushDestinations would land the unit on a stack instead. A player
// reaching for it can see what that costs the next Build; an automation cannot, so it stays
// where the position it was buying is actually there to buy.
function innateT1RouteToCoverLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (!pushHasOpenGround(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

// Prio 3: carry a unit from an inland land onto an open coast, where the sea can reach it.
// One push kills nothing and removes nothing, so the best a spare cast can do is hand a
// better board to the two abilities that do - and the sea is the only removal in the kit that
// the invader health ladder never catches up with.
//
// Only from an inland land: a coast-to-coast shove is already-drownable to still-drownable,
// which is churn. Only from an undefended one: pulling a unit out from under Dahan trades a
// kill that is already happening for one that might. Those two conditions together are also
// what stops this from ever undoing prio 2 - the land prio 2 pushed *into* holds Dahan, so
// this rung cannot pick it up next cast and shove it back out.
//
// Open ground, like every rung that pushes for position (see pushDestinations). It has a
// second use here: an open coast holds nothing, so this can never top a coast past the two
// units the sea would take anyway.
function innateT1FeedTheSeaLands(state) {
  return LAND_IDS.filter((land) => {
    if (landIsCoastal(land)) return false;
    if ((state.dahan[land] || 0) > 0) return false;
    if (!abilityLegalLand(state, "innate_power", land)) return false;
    if (!pushHasOpenGround(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && landIsCoastal(destination);
  });
}

// The order of these rungs follows pushDestination's own order rather than arguing with it.
// That function puts a defended neighbour above a coastal one, so a land with both open next
// to it routes into cover whatever this list says - putting the sea rung above cover would
// only be a lie about what the push then does.
//
// There is no protect-the-thin-stack rung here, though tier 2 and Wash Away both have one.
// At one unit it does not lift enough pressure off a stack to save it, and it was the exact
// mirror of prio 2 - onto Dahan, then off Dahan - which on an 8-beat clock against a 10-beat
// Dahan strike meant the same unit ping-ponging over the same border all round.
function pickInnateTargetTier1(state) {
  const breakBuild = innateT1BreakBuildLands(state);
  if (breakBuild.length > 0) return lowestLandId(breakBuild);

  const routeToCover = innateT1RouteToCoverLands(state);
  if (routeToCover.length > 0) return lowestLandId(routeToCover);

  const feedTheSea = innateT1FeedTheSeaLands(state);
  if (feedTheSea.length > 0) return lowestLandId(feedTheSea);

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
    if (!pushHasOpenGround(state, land)) return false;
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
    if (!pushHasOpenGround(state, land)) return false;
    const destination = pushDestination(state, land);
    return Boolean(destination) && (state.dahan[destination] || 0) > 0;
  });
}

// Prio 4: take the weight off whichever defended land is closest to losing its last Dahan.
function washAwayProtectThinDahanLands(state) {
  return LAND_IDS.filter((land) => {
    if ((state.dahan[land] || 0) <= 0) return false;
    if (!pushHasOpenGround(state, land)) return false;
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

// The lands the next wave will come ashore in. Weaker news than a Build - a Discover only
// seeds Explorers - but it is the other half of what the track promises, and a player reading
// only the Build slot cannot see where next wave's Build will land: the track slides, so the
// terrains discovered now are the ones built after (see shiftInvaderTrack).
//
// A land can be on both lists once Discover widens far enough to clash with Build. Which
// marking wins is the view's call, not this one's.
function exploreLands(state) {
  if (state.round.status !== "running") return [];
  return landsOfTerrains(exploreTerrains(state));
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

/* ---------- What the Fear ladders multiply ----------
 *
 * Read through activeUpgradeTier, never upgradeTier. These are read every single time Fear is
 * earned - every kill, every wave - which makes them exactly the class the round snapshot
 * exists for. Without it, a tier bought while a round was running would pay out on Fear that
 * round had already banked in spirit, and a round could buy its own way out through the back
 * door the two-pool split closed at the front. Dahan Reinforcement and Blight Resilience never
 * needed this because setup is the only thing that reads them.
 *
 * `round.fearEarned` stays fractional on purpose. Flooring each award instead would round a
 * +10% multiplier away to nothing: an explorer pays 1, and floor(1 * 1.1) is 1, so the first
 * four tiers of rising_dread would buy a number that never moved. The whole round accumulates
 * in fractions and endRound floors the total once, which is the only place Fear becomes
 * spendable and so the only place it has to be whole.
 */
function fearMultiplier(state, upgradeId, perTier) {
  return 1 + activeUpgradeTier(state, upgradeId) * perTier;
}

// See the note above PRESENCE_FEAR_BONUS_PER_POINT: 1% more Fear for every point of Presence
// still unspent, on every kill, wave and milestone alike.
function presenceFearMultiplier(state) {
  const presence = Math.max(0, Math.floor((state.meta && state.meta.presence) || 0));
  return 1 + presence * PRESENCE_FEAR_BONUS_PER_POINT;
}

// Fear from a defeat, by the unit's power value: explorer 1, town 2, city 3 - and one more
// each at every damage rung of the ladder, so a tougher Invader is worth proportionally more
// to kill rather than being strictly worse news.
function gainFearFromDefeat(state, unitType, defeatedCount) {
  const defeated = Math.max(0, Math.floor(defeatedCount || 0));
  if (defeated <= 0) return;
  const power = unitStats(state, unitType).damage || 0;
  const base = defeated * power * FEAR_PER_POWER;
  const gain = base * fearMultiplier(state, "rising_dread", FEAR_KILL_BONUS_PER_TIER)
    * presenceFearMultiplier(state);
  if (gain <= 0) return;

  state.round.fearEarned += gain;
  state.round.fearEarnedBase += base;
}

// Fear for outlasting a wave. Paid once per wave, at the wave, so a round that ends between
// two waves is paid for the ones it finished and not for the one it was standing in.
function gainFearFromWave(state) {
  if (FEAR_PER_WAVE <= 0) return;
  state.round.fearEarned += FEAR_PER_WAVE
    * fearMultiplier(state, "mounting_terror", FEAR_WAVE_BONUS_PER_TIER)
    * presenceFearMultiplier(state);
  state.round.fearEarnedBase += FEAR_PER_WAVE;
}

// high_water_mark: every tenth wave pays a bonus of `tier * 10%` of its own wave number, and
// mounting_terror multiplies it as it does any other wave income - which is what makes the
// two worth owning together rather than instead of each other.
//
// Returns what it paid so the caller can log and flash it. This is the only Fear in the game
// that arrives as an event rather than as a rate, and an event that shows up only as a
// slightly larger running total is an event the player never sees happen.
function gainFearFromWaveMilestone(state) {
  const wave = Math.max(0, Math.floor(state.round.wavesResolved || 0));
  if (wave <= 0 || wave % FEAR_MILESTONE_WAVE_INTERVAL !== 0) return 0;

  const tier = activeUpgradeTier(state, "high_water_mark");
  if (tier <= 0) return 0;

  const bonus = wave * tier * FEAR_MILESTONE_FRACTION_PER_TIER
    * fearMultiplier(state, "mounting_terror", FEAR_WAVE_BONUS_PER_TIER)
    * presenceFearMultiplier(state);
  if (bonus <= 0) return 0;

  // Nothing is added to `fearEarnedBase`: without high_water_mark there is no milestone at
  // all, so every point of this is upgrade income by construction. That is what makes the Mark
  // read as the strongest of the three in the HUD's split - all of it lands on the right-hand
  // number, where the two multipliers only ever move part of theirs.
  state.round.fearEarned += bonus;
  return bonus;
}

/* ---------- The Fear readout's split ----------
 *
 * What this round would have earned with none of the three ladders owned, and what they added
 * on top. The total cannot be inverted back into these - kill Fear, wave Fear and the
 * milestone each carry a different multiplier, so one sum has no unique decomposition - which
 * is why `fearEarnedBase` is tracked alongside rather than derived.
 *
 * The bonus is `floor(total) - floor(base)` rather than `floor(total - base)`. Two independent
 * floors can lose a whole Fear between them and leave the HUD showing a split that does not
 * add up to the number the bank pays; taking the difference of the floors makes the two halves
 * sum to exactly what endRound will bank, always.
 */
function fearBreakdown(state) {
  const round = (state && state.round) || {};
  const total = Math.max(0, Math.floor(round.fearEarned || 0));
  // Clamped to the total as well as to zero: a save hand-edited or written by an older build
  // could carry a base above its own total, and a negative bonus would render as "+-2".
  const base = Math.min(total, Math.max(0, Math.floor(round.fearEarnedBase || 0)));
  return { total, base, bonus: total - base };
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

// How many Explorers *every* discovered land takes. One until the ladder says two - see
// drawSecondExplorerLand for the half rung that lands twenty waves before this one.
function explorersPerLand(state) {
  return state.round.wavesResolved >= EXPLORE_DOUBLE_SEED_FROM_WAVE ? 2 : 1;
}

// The half rung: from EXPLORE_SECOND_EXPLORER_FROM_WAVE one land of the Discover - one of the
// two a single terrain covers - takes a second Explorer, twenty waves before every land does.
// Which one is drawn rather than fixed, so the player cannot learn to hold one half of a
// terrain and ignore the other.
//
// It reads explorersPerLand rather than a second wave number so the two rungs can never stack
// into three: the moment the full rung is live this one stops answering. `lands` is what
// Discover actually seeded, so a land the reachability rule turned away can never be given it.
function drawSecondExplorerLand(state, lands) {
  if (state.round.wavesResolved < EXPLORE_SECOND_EXPLORER_FROM_WAVE) return null;
  if (explorersPerLand(state) > 1) return null;
  if (lands.length === 0) return null;
  return lands[Math.floor(rng() * lands.length)];
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

  // Which lands are actually taking Explorers is settled before any are placed, because the
  // half rung has to pick one of them and a land turned away for reachability is not one.
  const reachable = [];
  for (const land of landsOfTerrains(terrains)) {
    if (!landAcceptsExplorer(state, land)) {
      addLog(state, template(t.exploreBlocked, { land: landName(state, land) }));
      continue;
    }
    reachable.push(land);
  }

  const doubled = drawSecondExplorerLand(state, reachable);
  for (const land of reachable) {
    seedExplorers(state, land, land === doubled ? perLand + 1 : perLand);
    seededLands.push(land);
  }

  // After the terrains have had theirs, so the extra land can never be one of them. It takes
  // the flat count: the half rung is long dead by the wave this one opens.
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
//
// The new Discover only steers around the terrain that just slid into Build while the round is
// below the free-draw rung. Above it the two slots can name the same terrain, and a terrain
// that does holds its lands for two waves running.
function shiftInvaderTrack(state) {
  state.invader = normalizeInvaderPhases(state.invader, state);

  const shiftedToBuild = exploreTerrains(state);
  state.invader.build = shiftedToBuild;
  state.invader.explore = drawInvaderTerrains(
    exploreTerrainCount(state),
    exploreAvoidsBuild(state) ? shiftedToBuild : []
  );

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

  // After the wave's own line, so the log reads as "wave 50 resolved, and it paid".
  const milestone = gainFearFromWaveMilestone(state);
  if (milestone > 0) {
    markFearFx(state, state.round.wavesResolved, milestone);
    addLog(state, template(locale(state).waveMilestone, {
      wave: state.round.wavesResolved,
      fear: formatFear(milestone)
    }));
  }
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
  //
  // Floored here and only here. `round.fearEarned` accumulates in fractions all round because
  // the Fear ladders multiply it (see fearMultiplier) and a +10% on a 1-power explorer is
  // nothing at all once rounded; the bank is where those fractions stop mattering, so it is
  // where they get dropped. Down, never up: a part-earned Fear is not a Fear.
  const banked = Math.floor(state.round.fearEarned);
  state.meta.fear += banked;
  // The cycle ledger counts what the bank was actually credited, not the fractional total the
  // round carried, so the two can never disagree about what a round was worth.
  state.meta.cycleFearGenerated += banked;

  // How far up the ladder this run has ever climbed. The wave is the honest measure of a
  // run's depth now that the ladder is keyed to it - the round number only counts attempts,
  // and every round starts at the bottom rung regardless of which number it wears.
  //
  // Written twice from the same figure, into the two high scores. The all-time one outlives
  // every ascension; the cycle one is cleared by each Reclaim and is the only one that moves in
  // the rounds just after. Both are score and nothing else - the ascension unlock is priced in
  // Presence and reads neither. Neither can be derived from the other, which is why both are
  // stored.
  state.meta.bestWaveReached = Math.max(state.meta.bestWaveReached, state.round.wavesResolved);
  state.meta.cycleBestWave = Math.max(state.meta.cycleBestWave, state.round.wavesResolved);

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
  // From `totals` rather than from roundDahanAttackInterval, because the snapshot this round
  // will run on is written a few lines below and does not exist yet. The two agree by
  // construction: both read the tiers owned at this instant.
  state.round.dahanAttackRemaining = totals.dahanAttackInterval;
  // A manual round opens on a held gate, so the island stands still until the player has read
  // it. The timer is already full here, so that first click starts the clock without costing
  // a wave - see startNextWave.
  state.round.awaitingWave = !autoProceedOn(state);
  state.round.wavesResolved = 0;
  state.round.fearEarned = 0;
  state.round.fearEarnedBase = 0;
  state.round.abilityCooldownMult = 1 - totals.cooldownReductionPct;
  // The shop stays open all round, so what the round runs on is fixed here and read from
  // here - see activeUpgradeTier. Anything bought after this line is owned but idle until
  // the next round takes its own snapshot.
  state.round.upgradeTiers = snapshotUpgradeTiers(state);

  // The kit is rebuilt every round: every Energy unlock is given back and the Innate drops to
  // its first tier. What carries between rounds is Fear and the shop tiers it bought - so a
  // round's power is earned inside that round, and the permanent progression is what decides
  // how fast it can be earned again.
  //
  // The purse is the one exception, and only by exactly what `headwaters` was bought up to.
  // Set from `totals`, which reads owned tiers rather than the round snapshot, for the same
  // reason the Dahan bonus does: this line runs before the round it is setting up exists, so
  // there is no round to benefit from itself yet.
  state.resources.energy = totals.startingEnergy;
  state.round.purchasedAbilityIds = [];
  state.round.abilityTiers = {};

  state.invaders = createInvaderCounts();
  state.invaderDamage = createInvaderDamage();
  state.invader = normalizeInvaderPhases({ build: [], explore: drawOpeningTerrains(state) }, state);

  state.pendingAbilityTarget = null;
  state.abilities = createAbilityState(state);

  state.ui.defeatFx = null;
  state.ui.blightFx = null;
  state.ui.fearFx = null;

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
 * Playtest tools (06-ui-contract.md Playtest tools)                     *
 *                                                                      *
 * Switched on by typing a code into the redeem bar, and off again by    *
 * the button that appears beside it. Everything here is deliberately    *
 * outside the game's economy: nothing costs anything, nothing is        *
 * earned, and no rule reads the flag - it only widens the speed dial    *
 * and adds two buttons that hand out currency.                          *
 * ------------------------------------------------------------------ */

function playtestOn(state) {
  return state.ui.playtest === true;
}

// Turning it off has to take the extra speed with it: a player sitting at 8x when the tools go
// away would otherwise be left at a speed the dial no longer draws a button for.
function setPlaytest(state, on) {
  state.ui.playtest = on === true;
  if (!state.ui.playtest && !GAME_SPEEDS.includes(Number(state.ui.gameSpeed))) {
    state.ui.gameSpeed = DEFAULT_GAME_SPEED;
  }
  return state.ui.playtest;
}

// The dial as it currently stands. The base speeds are always on it; the playtest ones are
// appended rather than mixed in, so 8x stays visibly the odd one out.
function availableGameSpeeds(state) {
  return playtestOn(state) ? GAME_SPEEDS.concat(PLAYTEST_GAME_SPEEDS) : GAME_SPEEDS.slice();
}

// Three answers rather than a boolean: the bar says something different for a code that was
// already redeemed than for one it has never heard of, and "nothing happened" would cover both.
function redeemCode(state, text) {
  const code = String(text == null ? "" : text).trim().toLowerCase();
  if (!code) return "unknown";

  const flag = REDEEM_CODES[code];
  if (!flag) return "unknown";
  if (flag === "playtest" && playtestOn(state)) return "already";

  if (flag === "playtest") {
    setPlaytest(state, true);
    addLog(state, locale(state).redeemPlaytestLog);
  }
  return "ok";
}

// Both grants refuse while the tools are off, so a stale click from a page that has not
// re-rendered yet cannot hand out a hundred of anything.
function grantPlaytestEnergy(state) {
  if (!playtestOn(state)) return false;
  state.resources.energy += PLAYTEST_GRANT;
  addLog(state, template(locale(state).playtestEnergyLog, { amount: PLAYTEST_GRANT }));
  return true;
}

// Fear lands in the banked pool, not in what the round has earned: the point of the button is
// to be able to buy something in the shop right now, and round Fear is not money until the
// round ends.
function grantPlaytestFear(state) {
  if (!playtestOn(state)) return false;
  state.meta.fear += PLAYTEST_GRANT;
  // Into the granted column, never the generated one - see the meta.cycleFear* note.
  state.meta.cycleFearGranted += PLAYTEST_GRANT;
  addLog(state, template(locale(state).playtestFearLog, { amount: PLAYTEST_GRANT }));
  return true;
}

// The cycle's Fear ledger as one object, read by the playtest tally. `banked` is handed back
// with the rest so a reader can check the identity without going to a second field: generated
// plus granted, less spent, is what is in the bank.
function cycleFearTotals(state) {
  const meta = state.meta || {};
  return {
    generated: Math.max(0, Math.floor(Number(meta.cycleFearGenerated) || 0)),
    granted: Math.max(0, Math.floor(Number(meta.cycleFearGranted) || 0)),
    spent: Math.max(0, Math.floor(Number(meta.cycleFearSpent) || 0)),
    banked: Math.max(0, Math.floor(Number(meta.fear) || 0))
  };
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
// to fall back to the shipped speed, not stop the game - and "unknown" now includes a playtest
// speed on a state whose tools have been switched off.
function gameSpeed(state) {
  const value = Number(state.ui.gameSpeed);
  return availableGameSpeeds(state).includes(value) ? value : DEFAULT_GAME_SPEED;
}

function setGameSpeed(state, value) {
  const next = Number(value);
  if (!availableGameSpeeds(state).includes(next)) return false;
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
  // Ahead of every cast, because what it buys is what they fire: an ability unlocked here is
  // ready this tick (see unlockAbility), so the automation waiting on it does not idle out a
  // whole cooldown behind its own purchase.
  resolveAutoBuyAbilities(state);
  // Before the fight, so Energy the Boon just paid is spendable on the same tick the player
  // sees it - the ability bar is read after the tick, not during it.
  resolveAutoBoon(state);
  resolveAutoBounty(state);
  resolveAutoWashAway(state);
  resolveAutoFlashFloods(state);
  // The Innate last, and the order among these five is deliberate. It has the shortest
  // cooldown in the kit and the weakest effect - one unit moved, nothing killed, nothing
  // removed - so letting it go first meant the two automations that do kill and remove chose
  // their target on a board it had just stirred. Casting it last leaves it doing what its
  // priority list is now written for: tidying up whatever the heavier casts left standing.
  resolveAutoInnate(state);

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
    state.round.dahanAttackRemaining += roundDahanAttackInterval(state);
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
      // The playtest code, once redeemed. It sits with the other settings rather than in meta
      // because it is the same kind of thing: how the game is being read, not what has been
      // earned inside it. Nothing in the rules reads it - see the playtest section.
      playtest: false,
      defeatFx: null,
      blightFx: null,
      fearFx: null,
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
  merged.ui.selectedLand = isLandId(merged.ui.selectedLand) ? merged.ui.selectedLand : null;
  merged.ui.defeatFx = normalizeDefeatFx(merged.ui.defeatFx);
  merged.ui.blightFx = normalizeBlightFx(merged.ui.blightFx);
  merged.ui.fearFx = normalizeFearFx(merged.ui.fearFx);

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
  const presencePurchased = {};
  for (const id of PRESENCE_UPGRADE_IDS) {
    const value = (merged.presenceUpgrades.purchased || {})[id];
    const tier = value === true ? 1 : Math.max(0, Math.floor(Number(value) || 0));
    if (tier > 0) presencePurchased[id] = 1;
  }

  /* Grandfathering, and the only place normalization *writes* a Presence row rather than
   * reading one.
   *
   * `auto_start_round` and `auto_buy_abilities` were bought with Fear alone under the old
   * completion gate. Putting them behind Presence must not take back a purchase already made,
   * so a save that owns the Fear row is handed the Presence row that now opens it.
   *
   * Idempotent by construction: the grant is a set to 1, not an increment, so loading the same
   * save twice cannot pay twice. And it runs off `purchased` above rather than the raw save,
   * so a doctored id that was already dropped cannot mint Presence on the way past.
   */
  for (const id of Object.keys(purchased)) {
    const required = upgradePresenceUnlock(id);
    if (required && PRESENCE_UPGRADES[required]) presencePurchased[required] = 1;
  }

  merged.presenceUpgrades.purchased = presencePurchased;

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
  SAVE_FILE_MAGIC,
  SAVE_FILE_EXT,
  VERSION,
  TIME_SCALE,
  GAME_SPEEDS,
  DEFAULT_GAME_SPEED,
  PLAYTEST_GAME_SPEEDS,
  PLAYTEST_GRANT,
  REDEEM_CODES,
  WAVE_INTERVAL_SECONDS,
  BLIGHT_THRESHOLD_BASE,
  BLIGHT_PER_DAMAGE_SECOND,
  DAHAN_LOSS_PER_DAMAGE_SECOND,
  BLIGHT_FLOOR_FRACTION,
  DAHAN_ATTACK_INTERVAL_SECONDS,
  DAHAN_ATTACK_DAMAGE,
  DAHAN_HASTE_FEAR_FOR_FULL,
  DAHAN_HASTE_MAX,
  dahanHasteFraction,
  dahanAttackIntervalFor,
  roundDahanAttackInterval,
  DAHAN_PER_ROUND_START_BASE,
  DAHAN_MAX_SPREAD,
  DEFEAT_FX_MS,
  MAX_TICK_SECONDS,
  FEAR_PER_POWER,
  FEAR_PER_WAVE,
  STARTING_ENERGY_BY_TIER,
  FEAR_KILL_BONUS_PER_TIER,
  FEAR_WAVE_BONUS_PER_TIER,
  FEAR_MILESTONE_WAVE_INTERVAL,
  FEAR_MILESTONE_FRACTION_PER_TIER,
  EXPLORE_UNRESTRICTED_FROM_WAVE,
  EXPLORE_SECOND_EXPLORER_FROM_WAVE,
  EXPLORE_DOUBLE_SEED_FROM_WAVE,
  EXPLORE_EXTRA_LAND_FROM_WAVE,
  EXPLORE_FREE_DRAW_FROM_WAVE,
  BONUS_TOWN_FROM_WAVE,
  BUILD_TWICE_FROM_WAVE,
  INVADER_DAMAGE_RUNG_FROM_WAVE,
  INVADER_HEALTH_RUNG_FROM_WAVE,
  INVADER_STAT_RUNG_INTERVAL,
  DIFFICULTY_RUNGS,
  difficultyLadder,
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
  landPressure,
  buildOutcomeInLand,
  pressureChipText,
  pressureDetailText,
  buildChipText,
  etaText,
  upgradeName,
  upgradeText,
  upgradeStatusText,
  formatFear,
  fearBreakdown,
  upgradeTier,
  upgradeMaxTier,
  upgradeCost,
  upgradeCostFor,
  upgradeCostFromTier,
  upgradeCostGrowth,
  upgradeTiersAffordable,
  upgradeIsPool,
  upgradeBulkAmounts,
  upgradeNeedsPresence,
  upgradePresenceUnlock,
  upgradeTotals,
  startingEnergyForTier,
  purchaseUpgrade,

  // The ascension layer.
  PRESENCE_UPGRADES,
  PRESENCE_UPGRADE_IDS,
  ASCENSION_UNLOCK_PRESENCE,
  PRESENCE_FEAR_DIVISOR,
  PRESENCE_FEAR_BONUS_PER_POINT,
  presenceFearMultiplier,
  FEAR_LADDER_MAX_TIER,
  presenceUpgradeTier,
  presenceUpgradeOwned,
  presenceUpgradeCost,
  presenceUpgradeName,
  presenceUpgradeText,
  purchasePresenceUpgrade,
  ascensionUnlocked,
  ascensionPayout,
  fearToNextPresence,
  canAscend,
  ascend,
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
  applyWashToSea,
  pushHasOpenGround,
  riversBountyLand,
  waveLands,
  exploreLands,
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
  innateT1FeedTheSeaLands,
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
  resolveAutoFlashFloods,
  resolveAutoBuyAbilities,
  pickFlashFloodsAutoTarget,
  flashFloodsDamageIn,
  addBlight,
  blightReached,
  resolveLandCombat,
  resolveContinuousCombat,
  resolveDahanAttack,
  landAcceptsExplorer,
  drawOpeningTerrains,
  drawInvaderTerrains,
  exploreTerrainCount,
  exploreAvoidsBuild,
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
  availableGameSpeeds,
  playtestOn,
  setPlaytest,
  redeemCode,
  cycleFearTotals,
  grantPlaytestEnergy,
  grantPlaytestFear,
  autoProceedOn,
  autoStartRoundOwned,
  autoStartRoundOn,
  setAutoStartRound,
  resolveAutoStartRound,
  AUTO_CAST_UPGRADES,
  autoCastOwned,
  autoCastOn,
  setAutoCast,
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
  exportSave,
  exportSaveFileName,
  importSave,
  activeDefeatFx,
  activeBlightFx,
  activeFearFx,
  pruneFx
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ENGINE_EXPORTS;
} else if (typeof window !== "undefined") {
  window.SpiritEngine = ENGINE_EXPORTS;
}
