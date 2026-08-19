/* ------------------------------------------------------------------ *
 * The island and its lookups
 * ------------------------------------------------------------------ *
 *
 * Land ids, terrain, adjacency, coastline. Pure geometry over fixed data.
 * Spec: docs/spec/09-island-board.md
 */

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
