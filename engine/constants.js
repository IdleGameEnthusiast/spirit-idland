/* ==================================================================== *
 * Spirit Idland - round engine: constants                              *
 * ==================================================================== *
 *
 * FIRST module in the engine load order. Every balance number the game
 * has, plus the injectable clock and RNG the tests drive it through.
 *
 * The engine is a set of classic scripts sharing one global scope: a
 * top-level `const` or `function` declared in any engine/*.js file is
 * visible to every other one, in either direction, with no imports.
 * Only top-level *initializer* order matters, which is why the load
 * order in index.html and tests.html must not be reshuffled casually.
 *
 * No DOM access anywhere in engine/. That split is what lets the suite
 * play hundreds of rounds headless.
 *
 * Spec: docs/spec/04-economy-formulas.md
 */


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

/* ---------- The fast-forwarded opening (05-progression.md, `presence_deep_water_comes`) ----
 *
 * A third pacing control, and the only one the player does not hold: a Presence row that runs
 * the first waves of every round at 20x and hands the dial back once they are behind.
 *
 * It is a *fast-forward and not a skip*, and the distinction is the whole of why the row is
 * priced as comfort. Speed multiplies dt (see gameSpeed) and reaches no rule, so the
 * fast-forwarded waves still build, still explore, still blight and still pay their Fear -
 * every one of them, at full value. What the row buys back is real seconds and nothing else.
 *
 * 20x is kept out of GAME_SPEEDS and PLAYTEST_GAME_SPEEDS alike for the reason the comment
 * above gives: a save must not come back stuck at a speed with no button to leave it by. This
 * one is never *set*, only applied while the opening runs - `effectiveGameSpeed` reads it,
 * `state.ui.gameSpeed` never holds it, and the dial keeps drawing the player's own choice.
 *
 * Why nothing can be hand-played at this speed, and why that is the row's real gate: a
 * cooldown ticks in game seconds, so at 20x the whole ability kit fires twenty times faster
 * than a hand can answer. The row is only *free* to a player who owns the automations, which
 * puts 8 Presence of `presence_river_knows` + `presence_all_unbidden` underneath it before its
 * own 3 is asked for. That depth is the gate; the price is not asked to be one.
 */
const FAST_FORWARD_SPEED = 20;

/* How much of the all-time record each rung fast-forwards, and the whole of the ladder.
 *
 * Keyed to `meta.bestWaveReached` rather than to a flat wave count because the opening a
 * player finds trivial moves with the run: eight waves is most of an early round and a rounding
 * error of a deep one. The record only ever ratchets up (see endRound), so what the row grants
 * grows on its own between purchases - which is what lets three rungs cover the whole game
 * instead of a rung per depth.
 *
 * Floored, always: at a record of 87 the first rung fast-forwards 8 waves and not 9. The share
 * is deliberately small. Waves the player wants back are the ones before the round becomes a
 * question, and the cap has to stay well below where the answer starts being in doubt - a row
 * that fast-forwarded through the part of the round that can be lost would be playing it.
 *
 * 3 / 4 / 5 Presence for 10 / 15 / 20%: flat-ish growth, near the 1.3-1.5 the note above
 * PRESENCE_UPGRADES asks of any repeatable Presence row, because Presence income is
 * root-shaped and a quadratic ladder dies inside three rungs. The benefit is linear in the
 * rung, so the cost must not be worse than linear either.
 */
const FAST_FORWARD_SHARE_PER_TIER = [0.10, 0.15, 0.20];
const FAST_FORWARD_MAX_TIER = FAST_FORWARD_SHARE_PER_TIER.length;
const FAST_FORWARD_COSTS = [3, 4, 5];

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
// The card reveal runs on its own clock, and a longer one. The three fx above mark a number
// that moved - a highlight the eye catches or misses in a moment - while this one carries a
// name, an effect and a cooldown the player is meant to actually read before deciding whether
// to keep the card. Stretching DEFEAT_FX_MS to fit would lengthen every defeat chip with it.
const CARD_FX_MS = 2600;
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

/* ---------- What a new cycle starts with ----------
 *
 * `presence_fear_remains` is the one repeatable row in the Presence catalogue, and these
 * two numbers are the whole of it: every rung hands the next ascension 50 more Fear, up to ten
 * rungs and 500. It is paid into `meta.cycleFearGranted`, never `cycleFearGenerated`, so the
 * head start mints no Presence of its own (see the note above the meta.cycleFear* fields, and
 * `grantPlaytestFear`, which lands in the same column for the same reason).
 *
 * What it buys is the shopping prologue of a cycle rather than any wave: rounds always start at
 * wave 0 and the ladder below is keyed per-round, so nothing here skips a wave. 500 Fear at the
 * top of a cycle is about eight rungs of `rising_dread` (6 * 1.6^n sums to 420), which is the
 * first few rounds of a fresh catalogue bought before they have to be played.
 *
 * The flat 50 is the number asked for, and it is worth writing down what it does and does not
 * do, because the row ages in a direction the rest of the catalogue does not. Holding one
 * Presence is +1% Fear generated forever (PRESENCE_FEAR_BONUS_PER_POINT), so a 1-Presence rung
 * granting 50 Fear beats holding while a cycle generates under 5,000 - and every rung shares
 * that break-even exactly, because the cost is flat. Under 5,000 all ten rungs are worth
 * taking; well above it none of them are, and the row is a deliberate late-game sink rather
 * than a competitive buy. That is the accepted shape, not an oversight: the alternative
 * considered was a grant scaling with the cycle just finished, which would hold its value at
 * any depth and was set aside for this. The lever if it ever wants revisiting is the 50.
 */
const ASCENSION_START_FEAR_PER_TIER = 50;
const ASCENSION_START_FEAR_MAX_TIER = 10;

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
 * Small shared helpers                                                 *
 * ------------------------------------------------------------------ */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
