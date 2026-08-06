/* Test harness: a tiny assertion API plus the fixtures every suite needs.
 *
 * The engine takes its clock and RNG by injection, which is the whole reason a round can
 * be played to its end in a millisecond here and still be the same round every run.
 *
 * Runs in two places, because the game itself needs no build step and neither should its
 * tests: open tests.html in a browser, or `node tests/run.js` if node is installed. */

const engine = typeof require === "function"
  ? require("../engine.js")
  : window.SpiritEngine;

const registry = [];

function test(name, fn) {
  registry.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "assertEqual"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const tol = tolerance == null ? 0.0001 : tolerance;
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${message || "assertClose"}: expected ~${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "assertDeepEqual"}: expected ${b}, got ${a}`);
}

function assertThrows(fn, message) {
  try {
    fn();
  } catch (_) {
    return;
  }
  throw new Error(message || "expected a throw");
}

/* A small LCG. Any fixed sequence would do; what matters is that it is the same one on
 * every run, so a failing assertion is a real failure and not a reroll. */
function seededRng(seed) {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/* A clock the test moves by hand. The engine stamps log lines and FX with it, so nothing
 * in a test depends on how long the test itself took to run. */
function fakeClock(startMs) {
  let current = startMs == null ? 1700000000000 : startMs;
  return {
    now: () => current,
    advance: (seconds) => { current += seconds * 1000; }
  };
}

/* A fresh game with the clock and RNG pinned. Every suite starts here. */
function newGame(options) {
  const opts = options || {};
  const clock = fakeClock();
  engine.setNowSource(clock.now);
  engine.setRng(seededRng(opts.seed || 42));

  const state = engine.createFreshGameState();
  if (opts.language) state.ui.language = opts.language;
  return { state, clock };
}

/* Advances wall-clock time in steps the engine will actually credit. The engine caps a
 * single tick at MAX_TICK_SECONDS, so a test that advanced 30s in one call would silently
 * lose 25 of them - exactly the bug the cap exists to cause on purpose. */
function advance(ctx, seconds, stepSeconds) {
  const step = stepSeconds || 1;
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    ctx.clock.advance(dt);
    engine.tick(ctx.state, dt);
    left -= dt;
  }
  return ctx.state;
}

/* Runs waves until the round ends or the cap trips. The cap is a test-suite guard against
 * an engine change that stops the round ending at all. */
function runUntilRoundEnds(ctx, maxWaves) {
  const cap = maxWaves || 60;
  let waves = 0;
  while (ctx.state.round.status === "running" && waves < cap) {
    advance(ctx, engine.WAVE_INTERVAL_SECONDS);
    waves += 1;
  }
  return waves;
}

/* An in-memory stand-in for localStorage, so save/load can be tested without a browser. */
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    _dump: () => Object.fromEntries(data)
  };
}

/* Clears a land and puts exactly the units a test cares about into it. */
function setLand(state, landId, invaders, dahan) {
  state.invaders[landId] = {
    explorers: (invaders && invaders.explorers) || 0,
    towns: (invaders && invaders.towns) || 0,
    cities: (invaders && invaders.cities) || 0
  };
  state.dahan[landId] = dahan || 0;
}

function clearBoard(state) {
  state.invaders = engine.createInvaderCounts();
  state.invaderDamage = engine.createInvaderDamage();
  state.dahan = engine.createDahanCounts();
}

const HARNESS = {
  engine,
  registry,
  test,
  assert,
  assertEqual,
  assertClose,
  assertDeepEqual,
  assertThrows,
  seededRng,
  fakeClock,
  newGame,
  advance,
  runUntilRoundEnds,
  memoryStorage,
  setLand,
  clearBoard
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = HARNESS;
} else if (typeof window !== "undefined") {
  window.SpiritTests = HARNESS;
}
