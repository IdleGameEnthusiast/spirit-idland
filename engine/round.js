/* ------------------------------------------------------------------ *
 * The round, pacing, playtest tools, and the tick
 * ------------------------------------------------------------------ *
 *
 * Round start and end, the speed dial and wave gate, and the single tick
 * that advances everything.
 * Spec: docs/spec/02-core-loop.md
 */

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

  // Last, and after the wave's own line: the card is what the round earned by surviving to
  // here, so it reads as the wave's reward rather than as part of the wave. It arrives ready,
  // so it is castable on this very tick.
  resolveCardDraw(state);

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
  markRoundEndFx(state);

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
  state.round.abilityFocusEnergy = {};

  // The auto-buy sheet folds itself away as the round begins (06-ui-contract.md#the-auto-buy-sheet).
  // It unfolds in place, above the ability bar, and pushes the bar down the page - which is
  // harmless while the player is reading it and a misclick waiting to happen once waves are
  // running. Closing it here rather than refusing to open it during a round is what lets the
  // rule be "it is never open while you are playing" without ever being "not now".
  //
  // Here rather than in ui.js because rounds start without a click: `auto_start_round` would
  // otherwise leave it open on exactly the setup that never touches the button.
  state.ui.autoBuyOpen = false;

  // Cards die with the round that drew them, exactly like Energy and everything Energy bought.
  // What survives is `powerCards.owned`, which this never touches - the Presence bought the
  // card, and the round has to earn the right to hold it all over again. Cleared before
  // createAbilityState below, so the empty hand is what the new bar is built from.
  state.round.cards = createRoundCardsState();
  // Wards go with them. A ward is a thing a card did, so it can no more outlive the round than
  // the card can.
  state.round.defense = createDefenseByLand();
  state.round.defenseExpiry = createDefenseExpiry();

  state.invaders = createInvaderCounts();
  state.invaderDamage = createInvaderDamage();
  state.invader = normalizeInvaderPhases({ build: [], explore: drawOpeningTerrains(state) }, state);

  state.pendingAbilityTarget = null;
  state.abilities = createAbilityState(state);

  state.ui.defeatFx = null;
  state.ui.blightFx = null;
  state.ui.fearFx = null;
  state.ui.roundEndFx = null;
  state.ui.cardFx = null;

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

