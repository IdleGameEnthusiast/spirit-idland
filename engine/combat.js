/* ------------------------------------------------------------------ *
 * Land states, the fight, Blight, and invader phases
 * ------------------------------------------------------------------ *
 *
 * Damage, defeats, Fear and Energy income, Blight accrual, and the
 * build/explore phases a wave resolves through.
 * Spec: docs/spec/02-core-loop.md, docs/spec/04-economy-formulas.md
 */

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
  // Before the pressure is read, so a ward whose wave is up cannot cancel one more tick of
  // damage on its way out.
  expireDefense(state, land);

  const p = landPressure(state, land);
  const out = { blightGained: 0, dahanLost: 0 };
  if (p.gross <= 0) return out;

  // The attack arrived, so the ward has now done something and its wave starts here. It keeps
  // its whole value for that wave and is then gone entirely, unused points and all - which is
  // what "any use spends the whole pool" means, and why a stockpile needs no cap.
  if (p.defense > 0) markDefenseUsed(state, land);

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

