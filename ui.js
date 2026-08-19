/* ==================================================================== *
 * Spirit Idland - view layer                                            *
 *                                                                       *
 * Everything that touches the DOM. It reads state and calls the engine;  *
 * it never decides a rule. Loaded after the engine/ modules, which put   *
 * their functions in the same classic-script scope.                      *
 *                                                                       *
 * Spec: docs/spec/06-ui-contract.md and 09-island-board.md.              *
 * ==================================================================== */

const dom = {
  languageToggleBtn: document.getElementById("languageToggleBtn"),
  speedGroup: document.getElementById("speedGroup"),
  speedLabel: document.getElementById("speedLabel"),
  autoWaveBtn: document.getElementById("autoWaveBtn"),
  // The switch inside the button owns the rest of it, so the text is written into a span of
  // its own rather than over the button's whole content.
  autoWaveBtnText: document.getElementById("autoWaveBtnText"),
  startNextWaveBtn: document.getElementById("startNextWaveBtn"),

  roundLabel: document.getElementById("roundLabel"),
  roundValue: document.getElementById("roundValue"),
  bestWaveLabel: document.getElementById("bestWaveLabel"),
  bestWaveValue: document.getElementById("bestWaveValue"),
  cycleBestWaveRow: document.getElementById("cycleBestWaveRow"),
  cycleBestWaveLabel: document.getElementById("cycleBestWaveLabel"),
  cycleBestWaveValue: document.getElementById("cycleBestWaveValue"),

  ascensionPanel: document.getElementById("ascensionPanel"),
  ascensionTitle: document.getElementById("ascensionTitle"),
  ascensionPresenceLabel: document.getElementById("ascensionPresenceLabel"),
  ascensionPresenceValue: document.getElementById("ascensionPresenceValue"),
  ascensionPresenceBonus: document.getElementById("ascensionPresenceBonus"),
  ascensionPayoutLabel: document.getElementById("ascensionPayoutLabel"),
  ascensionPayoutValue: document.getElementById("ascensionPayoutValue"),
  ascensionNextPresence: document.getElementById("ascensionNextPresence"),
  ascensionGenerated: document.getElementById("ascensionGenerated"),
  ascensionLoss: document.getElementById("ascensionLoss"),
  ascendBtn: document.getElementById("ascendBtn"),
  ascensionHint: document.getElementById("ascensionHint"),
  ascensionShopLabel: document.getElementById("ascensionShopLabel"),
  presenceList: document.getElementById("presenceList"),
  blightLabel: document.getElementById("blightLabel"),
  blightValue: document.getElementById("blightValue"),
  blightFill: document.getElementById("blightFill"),
  waveLabel: document.getElementById("waveLabel"),
  waveValue: document.getElementById("waveValue"),
  waveFill: document.getElementById("waveFill"),
  cardCountdown: document.getElementById("cardCountdown"),
  cardReveal: document.getElementById("cardReveal"),
  dahanAttackLabel: document.getElementById("dahanAttackLabel"),
  dahanAttackValue: document.getElementById("dahanAttackValue"),
  fearLabel: document.getElementById("fearLabel"),
  fearValue: document.getElementById("fearValue"),
  fearRound: document.getElementById("fearRound"),
  fearPending: document.getElementById("fearPending"),
  fearTile: document.getElementById("fearTile"),
  fearMilestone: document.getElementById("fearMilestone"),

  invaderTrackTitle: document.getElementById("invaderTrackTitle"),
  buildLabel: document.getElementById("buildLabel"),
  buildTerrain: document.getElementById("buildTerrain"),
  discoverLabel: document.getElementById("discoverLabel"),
  discoverTerrain: document.getElementById("discoverTerrain"),
  ladderTitle: document.getElementById("ladderTitle"),
  ladderHint: document.getElementById("ladderHint"),
  ladderList: document.getElementById("ladderList"),

  activeSpiritLabel: document.getElementById("activeSpiritLabel"),
  spiritName: document.getElementById("spiritName"),
  spiritTraits: document.getElementById("spiritTraits"),

  abilitiesTitle: document.getElementById("abilitiesTitle"),
  abilitiesNextCard: document.getElementById("abilitiesNextCard"),
  abilitiesHint: document.getElementById("abilitiesHint"),
  energyLabel: document.getElementById("energyLabel"),
  energyValue: document.getElementById("energyValue"),
  energyHint: document.getElementById("energyHint"),
  abilityBar: document.getElementById("abilityBar"),

  mapTitle: document.getElementById("mapTitle"),
  islandSvg: document.getElementById("islandSvg"),
  landChips: document.getElementById("landChips"),
  landDetail: document.getElementById("landDetail"),

  shopPanel: document.getElementById("shopPanel"),
  shopTitle: document.getElementById("shopTitle"),
  shopSummary: document.getElementById("shopSummary"),
  shopFearLabel: document.getElementById("shopFearLabel"),
  shopFearValue: document.getElementById("shopFearValue"),
  upgradeList: document.getElementById("upgradeList"),
  startNextRoundBtn: document.getElementById("startNextRoundBtn"),
  autoRoundBtn: document.getElementById("autoRoundBtn"),
  autoRoundBtnText: document.getElementById("autoRoundBtnText"),

  logTitle: document.getElementById("logTitle"),
  eventLog: document.getElementById("eventLog"),

  manualSaveBtn: document.getElementById("manualSaveBtn"),
  exportSaveBtn: document.getElementById("exportSaveBtn"),
  importSaveBtn: document.getElementById("importSaveBtn"),
  importSaveInput: document.getElementById("importSaveInput"),
  wipeSaveBtn: document.getElementById("wipeSaveBtn"),
  saveStatus: document.getElementById("saveStatus"),
  autosaveHint: document.getElementById("autosaveHint"),

  redeemForm: document.getElementById("redeemForm"),
  redeemLabel: document.getElementById("redeemLabel"),
  redeemInput: document.getElementById("redeemInput"),
  redeemBtn: document.getElementById("redeemBtn"),
  redeemStatus: document.getElementById("redeemStatus"),
  playtestHideBtn: document.getElementById("playtestHideBtn"),
  playtestEnergyBtn: document.getElementById("playtestEnergyBtn"),
  playtestFearBtn: document.getElementById("playtestFearBtn"),
  playtestFearTally: document.getElementById("playtestFearTally")
};

// What each renderer last drew. A render only reruns when its own signature changes, so
// the per-second HUD patch never rebuilds the board underneath a hover or a focus ring.
const renderCache = {
  language: null,
  map: null,
  ladder: null,
  abilityBar: null,
  shop: null,
  presenceShop: null,
  log: null,
  // The reveal's own two pieces of memory. `cardRevealAt` is the fx timestamp whose face is
  // currently in the layer - rebuilding that markup every frame would restart the entrance
  // animation sixty times a second, so it is written once per draw and then left alone.
  // `cardScrollId` is the card the bar should bring into view once the reveal has finished
  // saying its piece; see patchCardReveal for why it waits.
  cardRevealAt: null,
  cardScrollId: null
};

/* ------------------------------------------------------------------ *
 * The island's geometry                                                *
 *                                                                      *
 * Unchanged by the round-based redesign; see 09-island-board.md.        *
 * ------------------------------------------------------------------ */

const SVG_NS = "http://www.w3.org/2000/svg";
const ISLAND_VIEW = { w: 760, h: 500 };
const ISLAND_GEO = { cx: 380, top: 50, height: 352, wBack: 440, wCoast: 632 };
const EDGE_STEP_U = 0.02;
const EDGE_STEP_V = 0.025;

// Fixed sums of sines rather than random jitter: the island has to be the same island on
// every load, or a reader could not learn its shape.
//
// The last term in each axis is deliberately not a multiple of 2*pi over the unit square.
// Without it the warp repeats at the board's edges and the silhouette comes out
// suspiciously symmetric, which reads as a quilt rather than a coastline.
function islandWarp(u, v) {
  const a = u * Math.PI * 2;
  const b = v * Math.PI * 2;
  return [
    18 * Math.sin(a * 1.3 + b * 0.7 + 0.9)
      + 9 * Math.sin(b * 2.1 - 1.4)
      + 6 * Math.sin(a * 2.9 + 2.2)
      + 7 * Math.sin(v * 5.1 + 1.7),
    14 * Math.sin(b * 1.1 + a * 0.9 - 0.4)
      + 7 * Math.sin(a * 2.3 + 1.1)
      + 5 * Math.sin(b * 3.1 - 0.7)
      + 6 * Math.sin(u * 4.3 - 0.8)
  ];
}

// The board widens toward the coast, which is what gives it a wedge silhouette rather than
// a rectangle.
function islandProject(u, v) {
  const halfWidth = (ISLAND_GEO.wBack + (ISLAND_GEO.wCoast - ISLAND_GEO.wBack) * v) / 2;
  const offset = islandWarp(u, v);
  return [
    ISLAND_GEO.cx + (u - 0.5) * halfWidth * 2 + offset[0],
    ISLAND_GEO.top + v * ISLAND_GEO.height + offset[1]
  ];
}

function snap(value) {
  return Math.round(value * 1000) / 1000;
}

// Edges are sampled on a fixed global grid, so two lands sharing an edge compute the
// identical points and the seam between them is exact rather than nearly exact.
function islandEdgeH(u0, u1, v) {
  const direction = u1 > u0 ? 1 : -1;
  const steps = Math.round(Math.abs(u1 - u0) / EDGE_STEP_U);
  const points = [];
  for (let i = 0; i <= steps; i += 1) points.push(islandProject(snap(u0 + direction * i * EDGE_STEP_U), v));
  return points;
}

function islandEdgeV(u, v0, v1) {
  const direction = v1 > v0 ? 1 : -1;
  const steps = Math.round(Math.abs(v1 - v0) / EDGE_STEP_V);
  const points = [];
  for (let i = 0; i <= steps; i += 1) points.push(islandProject(u, snap(v0 + direction * i * EDGE_STEP_V)));
  return points;
}

function pointsToPath(points, close) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) d += `L${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  return close ? `${d}Z` : d;
}

function landPolygon(landId) {
  const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
  return islandEdgeH(u0, u1, v0)
    .concat(islandEdgeV(u1, v0, v1))
    .concat(islandEdgeH(u1, u0, v1))
    .concat(islandEdgeV(u0, v1, v0));
}

function islandPathFor(landId) {
  return pointsToPath(landPolygon(landId), true);
}

// The land's area centroid, not the midpoint of its board-space rectangle. The projection
// widens toward the coast and the warp bends every edge, so the rect midpoint sits visibly
// off-centre in the drawn shape - most obviously in the coastal lands, whose bottom edge is
// the curved shoreline.
function landCentre(landId) {
  const points = landPolygon(landId);
  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }

  if (Math.abs(twiceArea) < 1e-6) {
    const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
    return islandProject((u0 + u1) / 2, (v0 + v1) / 2);
  }

  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

// The land's own width, as a percentage of the board frame. Lands differ in width by more
// than two to one, so a single chip size either overflows the narrow ones or wastes the
// wide ones. The floor keeps the smallest land's label readable.
function landChipWidthPercent(landId) {
  const [u0, u1, v0, v1] = BOARD_LANDS[landId].rect;
  const middleV = (v0 + v1) / 2;
  const span = Math.abs(islandProject(u1, middleV)[0] - islandProject(u0, middleV)[0]);
  return Math.max(15, (span / ISLAND_VIEW.w) * 100 * 0.92);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key of Object.keys(attrs || {})) el.setAttribute(key, attrs[key]);
  return el;
}

// The board's shapes never change, so they are built once. Only fills, rings, and the
// overlay chips are repainted per render.
function drawIslandOnce() {
  const svg = dom.islandSvg;
  svg.innerHTML = "";

  const defs = svgEl("defs", {});
  const ocean = svgEl("linearGradient", { id: "oceanGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
  ocean.appendChild(svgEl("stop", { offset: "0", "stop-color": "#14536b" }));
  ocean.appendChild(svgEl("stop", { offset: "1", "stop-color": "#07202e" }));
  defs.appendChild(ocean);
  const shadow = svgEl("filter", { id: "landShadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
  shadow.appendChild(svgEl("feDropShadow", {
    dx: "0", dy: "3", stdDeviation: "5", "flood-color": "#03121a", "flood-opacity": "0.55"
  }));
  defs.appendChild(shadow);
  svg.appendChild(defs);

  // Water fills everything past the coast edge.
  const coast = islandEdgeH(0, 1, 1);
  const water = coast.concat([[ISLAND_VIEW.w + 40, ISLAND_VIEW.h + 40], [-40, ISLAND_VIEW.h + 40]]);
  svg.appendChild(svgEl("path", { d: pointsToPath(water, true), fill: "url(#oceanGrad)" }));

  // Surf: the coastline echoed outward and fading. Spread wide and kept faint, or the
  // nearest ring reads as a hard white outline rather than water.
  const surf = [{ offset: 6, opacity: 0.2, width: 1.6 }, { offset: 15, opacity: 0.12, width: 1.3 }, { offset: 26, opacity: 0.07, width: 1 }];
  for (const ring of surf) {
    svg.appendChild(svgEl("path", {
      d: pointsToPath(coast.map((p) => [p[0], p[1] + ring.offset]), false),
      fill: "none",
      stroke: "#8ed3e6",
      "stroke-opacity": String(ring.opacity),
      "stroke-width": String(ring.width),
      "stroke-linecap": "round"
    }));
  }

  const landLayer = svgEl("g", { filter: "url(#landShadow)" });
  svg.appendChild(landLayer);

  for (const landId of LAND_IDS) {
    const hue = TERRAIN_RGB[landTerrain(landId)];
    const group = svgEl("g", { class: "land-shape", "data-land": landId, tabindex: "0", role: "button" });
    group.appendChild(svgEl("path", {
      d: islandPathFor(landId),
      fill: `rgb(${hue})`,
      "data-role": "fill",
      stroke: `rgb(${hue})`,
      "stroke-opacity": "0.5",
      "stroke-width": "1.2"
    }));
    landLayer.appendChild(group);
  }

  // The board's other three borders are cliffs, not coast: nothing lands there.
  for (const edge of [islandEdgeH(0, 1, 0), islandEdgeV(0, 0, 1), islandEdgeV(1, 0, 1)]) {
    svg.appendChild(svgEl("path", {
      d: pointsToPath(edge, false), fill: "none", stroke: "#050f16",
      "stroke-opacity": "0.85", "stroke-width": "5", "stroke-linecap": "round"
    }));
    svg.appendChild(svgEl("path", {
      d: pointsToPath(edge, false), fill: "none", stroke: "#3c5560",
      "stroke-opacity": "0.7", "stroke-width": "1.6", "stroke-linecap": "round"
    }));
  }

  // Every ring in one layer of its own, above every fill and above the cliffs.
  //
  // A ring is a stroke on the land's own outline, so half its width lies outside the land -
  // on the neighbour. Drawn inside the land's group it was painted over by every land drawn
  // after it and by the cliff edges, which left a selected land outlined on the borders it
  // shares with lands 1..n-1 and bare everywhere else. Lifting the rings out is the fix: a
  // highlight has to be a closed outline or it does not read as one.
  //
  // Inert to the pointer, so the fills underneath keep owning every click.
  const ringLayer = svgEl("g", { class: "land-ring-layer" });
  for (const landId of LAND_IDS) {
    ringLayer.appendChild(svgEl("path", {
      class: "land-ring",
      "data-ring-land": landId,
      d: islandPathFor(landId),
      fill: "none",
      stroke: "transparent",
      "stroke-width": "3",
      "stroke-linejoin": "round"
    }));
  }
  svg.appendChild(ringLayer);
}

/* ------------------------------------------------------------------ *
 * Board painting                                                       *
 * ------------------------------------------------------------------ */

// Fills sit high enough that slate mountains and blue wetlands stay tellable apart against
// a dark ocean. Below roughly 0.4 the two terrains converge into the same blue-grey.
const LAND_STATE_STYLE = {
  idle: { fill: 0.42, ring: "transparent", opacity: 1, chip: 1 },
  "wave-active": { fill: 0.56, ring: "#e76755", opacity: 1, chip: 1 },
  legal: { fill: 0.62, ring: "#8ed3e6", opacity: 1, chip: 1 },
  selected: { fill: 0.48, ring: "transparent", opacity: 1, chip: 1 },
  out: { fill: 0.16, ring: "transparent", opacity: 0.4, chip: 0.32 },
  // Never returned by landRenderStates: a Discover marks a land without changing what the
  // land *is* to a click, so only the ring colour is read from here. Gold rather than the
  // Build red, because a Discover seeds Explorers - it is the softer of the two warnings.
  "explore-active": { fill: 0.42, ring: "#f2c45a", opacity: 1, chip: 1 }
};

// How full the strike bar has to be before it lights up - see the .chip-strike.is-imminent
// paragraph in app.css for what lighting up looks like.
//
// A share of the swing rather than a count of seconds. The alternative was "light up for the
// last two seconds", and it is the wrong shape: dahan_remember halves the interval, so a fixed
// two seconds would be a quarter of the cycle for a player who has not bought it and half the
// cycle for one who has - the more Fear you sink into the strike, the more of the time the
// board would sit shouting. A fifth is a fifth, and the cue lands at the same point in the
// rhythm however hard the clock has been hastened.
const STRIKE_IMMINENT_AT = 0.8;

// Sprite ids from index.html. Shapes follow the printed game: stick figure, two buildings,
// three buildings. Colour is set per type in CSS, and the sprite paints with currentColor.
const UNIT_GLYPH = {
  explorers: "si-explorer",
  towns: "si-town",
  cities: "si-city",
  dahan: "si-dahan"
};

function tokenIcon(unitType) {
  return `<svg class="tok" aria-hidden="true" focusable="false"><use href="#${UNIT_GLYPH[unitType]}"/></svg>`;
}

// Every unit count on the board wears the same health ring: Dahan and invader alike, red,
// draining clockwise from twelve. It rides on the count rather than beside the Blight bar so
// a land shows one token per type instead of two - the ring belongs on the number it drains.
//
// The ring is always in the markup and revealed by opacity when the unit is hurt, never added
// to the DOM at that moment. patchLandMeters writes both every frame, and the board itself
// only rebuilds when its signature changes - a ring that had to be inserted to appear would
// wait on that rebuild and lag the damage that caused it.
//
// It stays through an armed ability too. The ring is part of the count now, and hiding it
// there would resize the glyph and shift the whole row every time a target is chosen.
function unitGlyph(state, landId, unitType, count) {
  const t = locale(state);
  const title = unitType === "dahan" ? t.dahanBarLabel : t.invaderBarLabel;
  return `<span class="chip-unit unit-${unitType}"><span class="chip-token" title="${title}"><span class="chip-ring" data-meter-land="${landId}" data-meter-kind="${unitType}"></span>${tokenIcon(unitType)}</span>${count}</span>`;
}

// How badly the worst-off unit of a type in this land is hurt, as a fraction of its health.
// The damage array is sorted most-wounded first, so index 0 is the one the ring shows.
function worstInvaderWound(state, landId, unitType) {
  const stats = unitStats(state, unitType);
  const wounds = (state.invaderDamage[landId] || {})[unitType];
  if (!stats || !Array.isArray(wounds) || wounds.length === 0) return 0;
  return clamp((wounds[0] || 0) / stats.health, 0, 1);
}

function fmtSeconds(value) {
  return String(Math.max(0, Math.ceil(value)));
}

// Every countdown on screen is shown in real seconds, not the game seconds the engine holds
// them in. At 2x a twenty-second wave interval really is ten seconds away, and a HUD that
// still said twenty would be counting down twice a second in front of the player.
//
// A stopped clock has no rate to divide by, so it reports the game's own seconds. Nothing is
// moving then, so the reading is a frozen snapshot either way.
function displaySeconds(state, gameSeconds) {
  const speed = gameSpeed(state);
  return fmtSeconds(speed > 0 ? gameSeconds / speed : gameSeconds);
}

// The banner naming what the incoming wave will build here. Without it, the outline says
// "something happens in this land" and nothing more.
//
// A land the wave will visit and find nothing gets the quiet variant. The loud frame is the
// same warning colour as the pulsing wave ring, so wearing it while announcing that nothing
// happens pulls the eye to the one land on the list that needs no attention.
//
// It survives an armed ability. Which land is about to be built on is exactly what the choice
// of target is made against, and while armed the ring has been repainted for legality - the
// banner is the only thing left saying where the wave lands. Illegal lands dim with the rest
// of their chip, so legality still reads at a glance.
function chipWaveMarkup(state, landId) {
  if (!waveLands(state).includes(landId)) return "";

  const quiet = buildOutcomeInLand(state, landId) === null;

  return `
    <div class="chip-wave${quiet ? " is-quiet" : ""}">
      <span class="chip-wave-name">${locale(state).buildWord}</span>
      <span class="chip-wave-text">${buildChipText(state, landId)}</span>
    </div>
  `;
}

// What every contested land wears: the Blight bar, which is what ends the round and so gets
// the full width of the chip. The health rings are not here - they ride on the unit counts
// above, in unitGlyph. The bar fills continuously, so the fill itself is written by
// patchLandMeters rather than baked in here - a bar rebuilt ten times a second could never
// animate.
//
// Like the wave banner, this stays through an armed ability: how close a land is to blighting
// out is the reason one target is picked over another, and blanking it makes the player disarm
// to read the board and arm again.
function chipMetersMarkup(state, landId) {
  if (landPressure(state, landId).gross <= 0) return "";

  const t = locale(state);

  return `
    <div class="chip-meters">
      <span class="chip-meter is-blight" title="${t.blightBarLabel}">
        <span class="chip-meter-fill" data-meter-land="${landId}" data-meter-kind="blight"></span>
      </span>
    </div>
    <div class="chip-pressure" data-pressure-land="${landId}"></div>
  `;
}

// The Dahan's strike clock, on the chip instead of only in the HUD strip. There is one clock
// for the whole island - see resolveDahanAttack - so every bar this draws shows the same
// fraction as every other, and they are all full at the same instant. It is drawn per land only
// because the board is where the player is looking, not because the lands are on separate
// timers: there is no per-land value here to find.
//
// Only where the strike will actually land. resolveDahanAttack skips a land holding no
// invaders, and a bar there would fill to full and then do nothing - the one thing a gauge must
// never do. Deliberately unlike the Dahan health ring, which is left stopped rather than
// cleared when a land empties: the ring's value is that land's own history, and this one is a
// global clock that says nothing whatever about a land the strike will skip.
//
// Like the Blight bar, the fill's width is written by patchLandMeters every frame rather than
// baked in here - a bar rebuilt on every render could never animate.
//
// It rides inside the allies row, immediately right of the Dahan count, rather than in a row of
// its own: it is that count's clock and nothing else's, and sitting against it says so with no
// ink at all. That is also why it is short and fixed-width - a bar spanning the chip would be
// making the claim the Blight bar makes, and the caller only ever emits this beside a Dahan
// count, so the two conditions below cannot fire on a chip with no allies row to sit in.
// The axe goes at the far end, past the fill, where a full bar reaches it as the Dahan swing.
function chipStrikeMarkup(state, landId) {
  if ((state.dahan[landId] || 0) <= 0) return "";
  if (invaderCountInLand(state.invaders[landId]) <= 0) return "";

  return `
    <span class="chip-strike" title="${locale(state).dahanStrikeBarLabel}">
      <span class="chip-strike-track">
        <span class="chip-strike-fill" data-meter-land="${landId}" data-meter-kind="dahan-strike"></span>
      </span>
      <svg class="tok" aria-hidden="true" focusable="false"><use href="#si-axe"/></svg>
    </span>
  `;
}

// The two things a land can be carrying that are neither units nor rates: a ward, and the
// Blight already lying there. Both ride in the chip's head row rather than in a row of their
// own, because both answer "what is the state of this land" and neither is a count of pieces
// standing on it.
//
// Each is a glyph with its number, not a number alone. A bare integer beside the terrain name
// is the one thing on a chip with no way to say what it counts, and these two are the chip's
// only good news and its only permanent bad news - the pair most expensive to confuse.
function chipDefenseMarkup(state, landId) {
  const defense = defenseInLand(state, landId);
  if (defense <= 0) return "";

  // Teal, on the same rule that keeps the strike bar out of pressure red: red on a chip means
  // Blight and wounds, and a ward is the one thing on the board that stops both.
  return `
    <span class="chip-badge chip-defense" title="${locale(state).landDefenseLabel}">
      <svg class="tok" aria-hidden="true" focusable="false"><use href="#si-shield"/></svg>
      ${defense}
    </span>
  `;
}

function chipBlightMarkup(state, landId) {
  const blight = state.round.blightByLand[landId] || 0;
  if (blight <= 0) return "";

  return `
    <span class="chip-badge chip-blight-count" title="${locale(state).landBlightLabel}">
      <svg class="tok" aria-hidden="true" focusable="false"><use href="#si-blight"/></svg>
      ${blight}
    </span>
  `;
}

function renderBoard(state) {
  const t = locale(state);
  const states = landRenderStates(state);
  const wave = waveLands(state);
  const explore = exploreLands(state);
  const selected = effectiveSelectedLand(state);
  const defeatFx = activeDefeatFx(state);
  const blightFx = activeBlightFx(state);

  dom.landChips.innerHTML = "";

  for (const landId of LAND_IDS) {
    const style = LAND_STATE_STYLE[states[landId]] || LAND_STATE_STYLE.idle;
    const group = dom.islandSvg.querySelector(`[data-land="${landId}"]`);
    const ring = dom.islandSvg.querySelector(`[data-ring-land="${landId}"]`);

    if (group) {
      group.setAttribute("opacity", String(style.opacity));
      group.querySelector('[data-role="fill"]').setAttribute("fill-opacity", String(style.fill));
      group.classList.toggle("land-legal-target", states[landId] === "legal");
      group.classList.toggle("land-selected", landId === selected);
    }

    if (ring) {
      // A wave target keeps its own colour even while selected, so the selection ring can
      // never quietly hide which lands the invaders are about to hit.
      //
      // Read from waveLands rather than the render state, because the render state stops
      // saying "wave-active" the moment an ability is armed - which is precisely when the
      // player is choosing between these lands and most needs to see them. Legality still
      // reads without the ring: legal lands stay at full opacity while the rest fade to 0.4.
      const isWaveTarget = wave.includes(landId);
      // Build wins the clash. Once Discover widens far enough the two slots can name the same
      // terrain, and a land taking both should wear the louder of the two warnings.
      const isExploreTarget = !isWaveTarget && explore.includes(landId);
      const strokeColour = isWaveTarget
        ? LAND_STATE_STYLE["wave-active"].ring
        : isExploreTarget
          ? LAND_STATE_STYLE["explore-active"].ring
          : (landId === selected ? "#f7f1de" : style.ring);

      // The ring lives in its own layer now, so it no longer inherits the land group's dim.
      ring.setAttribute("opacity", String(style.opacity));
      ring.setAttribute("stroke", strokeColour);
      ring.setAttribute("stroke-width", isWaveTarget || isExploreTarget
        ? "4"
        : (landId === selected ? "2.6" : "3"));
      ring.classList.toggle("is-wave-target", isWaveTarget);
      ring.classList.toggle("is-explore-target", isExploreTarget);
    }

    const counts = state.invaders[landId];
    const invaderBits = [];
    for (const type of INVADER_TYPES) {
      if (counts[type]) invaderBits.push(unitGlyph(state, landId, type, counts[type]));
    }

    const allyBits = [];
    if (state.dahan[landId]) allyBits.push(unitGlyph(state, landId, "dahan", state.dahan[landId]));

    const chip = document.createElement("div");
    chip.className = "land-chip";
    chip.setAttribute("data-chip", landId);
    chip.style.setProperty("--terrain-rgb", TERRAIN_RGB[landTerrain(landId)]);
    chip.style.opacity = String(style.chip);

    const centre = landCentre(landId);
    chip.style.left = `${(centre[0] / ISLAND_VIEW.w) * 100}%`;
    chip.style.top = `${(centre[1] / ISLAND_VIEW.h) * 100}%`;
    // Size the chip to its land, or a narrow land like 4 wears a label wider than itself.
    chip.style.width = `${landChipWidthPercent(landId)}%`;

    const defeatMarkup = defeatFx && defeatFx.land === landId
      ? `<div class="chip-defeat">${template(t.defeatHint, {
          count: defeatFx.count,
          unit: unitLabelByType(state, defeatFx.unitType)
        })}</div>`
      : "";
    const blightMarkup = blightFx && blightFx.lands.includes(landId)
      ? `<div class="chip-blight">${template(t.blightHint, { amount: blightFx.amount })}</div>`
      : "";

    chip.innerHTML = `
      <div class="chip-head">
        <span class="chip-num">${landId}</span>
        <span class="chip-terrain">${terrainName(state, landTerrain(landId))}</span>
        ${chipDefenseMarkup(state, landId)}
        ${chipBlightMarkup(state, landId)}
      </div>
      ${invaderBits.length ? `<div class="chip-row invaders">${invaderBits.join("")}</div>` : ""}
      ${allyBits.length ? `<div class="chip-row allies">${allyBits.join("")}${chipStrikeMarkup(state, landId)}</div>` : ""}
      ${chipMetersMarkup(state, landId)}
      ${chipWaveMarkup(state, landId)}
      ${defeatMarkup}
      ${blightMarkup}
    `;

    dom.landChips.appendChild(chip);
  }
}

// Per-frame patch for everything that moves continuously: the two land bars and the sentence
// counting down beside them. Nothing here creates or replaces a node, which is what lets the
// bars fill smoothly instead of restarting on every render.
function patchLandMeters(state) {
  // One clock for the whole island, so one number - computed here rather than in the loop,
  // which would recompute the same fraction once per land on every frame.
  //
  // Against the round's interval, not DAHAN_ATTACK_INTERVAL_SECONDS: dahan_remember halves it,
  // and a bar divided by the base constant would top out near half-mast exactly for the player
  // who paid to make the strike matter. roundDahanAttackInterval reads the round's frozen
  // upgrade snapshot, which is the very number tick divides by, so the bar can never disagree
  // with the clock it draws and a mid-round purchase does not re-scale a bar already moving.
  //
  // It fills rather than drains - health drains, an attack gathers - which is the opposite
  // direction from the wave bar beside it. That one is the invaders' and answers "how long do I
  // still have"; this one is the player's and answers "how much have my people gathered".
  const strikeInterval = roundDahanAttackInterval(state);
  const strikeFill = state.round.status === "running" && strikeInterval > 0
    ? clamp(1 - state.round.dahanAttackRemaining / strikeInterval, 0, 1)
    : 0;

  for (const el of dom.landChips.querySelectorAll("[data-meter-land]")) {
    const landId = el.getAttribute("data-meter-land");
    const kind = el.getAttribute("data-meter-kind");

    // Two shapes, two dials. Blight is a bar and fills by width as the round is lost; a
    // health ring is a conic sweep and drains by the registered property it is drawn from.
    if (kind === "blight") {
      el.style.width = `${clamp(landPressure(state, landId).blightProgress, 0, 1) * 100}%`;
      continue;
    }

    // A third kind, and it needs its own branch ahead of the ring fallback below or it would be
    // handed --health-lost and sit invisible at opacity 0. It carries data-meter-land only so
    // the selector above picks it up; nothing here reads the id, because there is no per-land
    // strike value to read.
    //
    // The class goes on the group rather than on the fill because the whole group lights up -
    // track, fill and axe together - and CSS cannot reach up from the fill to its siblings.
    // It is the same one clock driving all of them, so every lit bar on the board lights at the
    // same instant, which is what makes the moment read as the island's and not one land's.
    if (kind === "dahan-strike") {
      el.style.width = `${strikeFill * 100}%`;
      const group = el.closest(".chip-strike");
      if (group) group.classList.toggle("is-imminent", strikeFill >= STRIKE_IMMINENT_AT);
      continue;
    }

    // Both rings show health lost, from two different clocks. A Dahan's is the casualty bar
    // filling continuously toward the next death; an invader's is whole points already taken.
    const lost = kind === "dahan"
      ? clamp(landPressure(state, landId).dahanProgress, 0, 1)
      : worstInvaderWound(state, landId, kind);

    el.style.setProperty("--health-lost", lost);
    // Untouched units wear no ring at all, so the ones that do are the ones worth looking at.
    el.style.opacity = lost > 0 ? "1" : "0";
  }

  for (const el of dom.landChips.querySelectorAll("[data-pressure-land]")) {
    el.textContent = pressureChipText(state, el.getAttribute("data-pressure-land"));
  }

  const detail = dom.landDetail.querySelector("[data-pressure-detail]");
  if (detail) detail.textContent = pressureDetailText(state, detail.getAttribute("data-pressure-detail"));

  // Present only while there is a ward to report. A row reading "Defense here: 0" on seven
  // lands out of eight would be a line of nothing, every frame.
  const defenseRow = dom.landDetail.querySelector("[data-defense-row]");
  if (defenseRow) {
    const value = defenseInLand(state, defenseRow.getAttribute("data-defense-row"));
    defenseRow.hidden = value <= 0;
    defenseRow.querySelector("[data-defense-detail]").textContent = String(value);
  }
}

/* ------------------------------------------------------------------ *
 * Land detail panel                                                    *
 * ------------------------------------------------------------------ */

function renderLandDetail(state) {
  // Unlike the map ring - which always has something to highlight, wave target or not - the
  // panel now has an off state: clicking the selected land again clears the raw selection, and
  // that is the one signal this reads. effectiveSelectedLand would paper back over it with the
  // same fallback the ring uses, which is exactly what must not happen here.
  if (!isLandId(state.ui.selectedLand)) {
    dom.landDetail.hidden = true;
    dom.landDetail.innerHTML = "";
    return;
  }
  dom.landDetail.hidden = false;

  const t = locale(state);
  const landId = state.ui.selectedLand;
  const terrain = landTerrain(landId);
  const counts = state.invaders[landId];
  const damageSlot = state.invaderDamage[landId];

  // The chip has room for one ring per type; this is where the exact per-unit health lives,
  // which is the whole reason damage is tracked per unit. Only the hurt ones are spelled out -
  // a "3/3" beside every healthy city would bury the one number that matters.
  const rows = [];
  for (const type of INVADER_TYPES) {
    if ((counts[type] || 0) <= 0) continue;
    const health = unitStats(state, type).health;
    const wounded = (damageSlot[type] || [])
      .filter((damage) => damage > 0)
      .map((damage) => template(t.invaderHpHint, { current: health - damage, max: health }));
    const hpHint = wounded.length > 0 ? `<span class="detail-hp">${wounded.join(", ")}</span>` : "";
    rows.push(`<div class="detail-row"><span class="detail-key unit-${type}">${tokenIcon(type)}${unitLabelByType(state, type)}</span><span class="detail-val">${hpHint}${counts[type]}</span></div>`);
  }
  if (rows.length === 0) rows.push(`<p class="detail-empty">${t.noInvadersHere}</p>`);

  const neighbours = adjacentLands(landId)
    .map((other) => `<button class="neighbour-chip" data-goto-land="${other}" style="--terrain-rgb:${TERRAIN_RGB[landTerrain(other)]}">${other}</button>`)
    .join("");

  // The panel explains rather than asks: every choice lives on the board itself. The fight
  // line is always here, because there is always a fight now; the Build line only when this
  // land is on the track.
  const pressureNote = `<div class="detail-wave"><strong>${t.blightBarLabel}</strong><span data-pressure-detail="${landId}"></span></div>`;
  const waveNote = waveLands(state).includes(landId)
    ? `<div class="detail-wave"><strong>${t.buildWord}</strong><span>${buildChipText(state, landId)}</span></div>`
    : "";

  dom.landDetail.style.setProperty("--terrain-rgb", TERRAIN_RGB[terrain]);
  dom.landDetail.innerHTML = `
    <div class="detail-head">
      <span class="detail-num">${landId}</span>
      <span class="detail-terrain">${terrainName(state, terrain)}</span>
      <span class="detail-tag ${landIsCoastal(landId) ? "coastal" : ""}">${landIsCoastal(landId) ? t.coastalLabel : t.inlandLabel}</span>
    </div>
    <div class="detail-body">
      ${pressureNote}
      ${waveNote}
      <div class="detail-block">
        <div class="detail-label">${t.invadersLabel}</div>
        ${rows.join("")}
      </div>
      <div class="detail-block">
        <div class="detail-label">${t.ownForcesLabel}</div>
        <div class="detail-row"><span class="detail-key unit-dahan">${tokenIcon("dahan")}${t.dahanLabel}</span><span class="detail-val">${state.dahan[landId]}</span></div>
        <div class="detail-row"><span class="detail-key">${t.landBlightLabel}</span><span class="detail-val">${state.round.blightByLand[landId] || 0}</span></div>
        <!-- A ward is laid and spent inside a round without anything rebuilding this panel,
             so the row is drawn once and both its value and its hidden-ness are patched every
             frame - the same treatment the pressure line above it gets. -->
        <div class="detail-row" data-defense-row="${landId}" hidden><span class="detail-key">${t.landDefenseLabel}</span><span class="detail-val" data-defense-detail="${landId}"></span></div>
      </div>
      <div class="detail-block">
        <div class="detail-label">${t.neighboursLabel}</div>
        <div class="neighbour-row">${neighbours}</div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ *
 * Ability bar                                                          *
 *                                                                      *
 * Built once per ability set, then patched every frame. A cooldown      *
 * sweep cannot survive its own element being replaced ten times a       *
 * second, which is the whole reason for the split.                      *
 * ------------------------------------------------------------------ */

// What changes the bar's shape: which abilities are unlocked, what tier the tiered ones stand
// at - a tier swaps the card's whole text and price - and whether each ability's automation is
// owned, because owning one changes the card from a bare button into a container with a foot.
// Affordability is patched per frame rather than rebuilt, and so is the checkbox's own ticked
// state: folding that in would rebuild the whole bar on every click of the box and take the
// running cooldown sweep with it.
function abilityBarSignature(state) {
  const tiers = spiritAbilityIds(state)
    .filter(abilityIsTiered)
    .map((id) => `${id}:${abilityTier(state, id)}`)
    .join(",");
  const automations = spiritAbilityIds(state)
    .map((id) => `${id}:${autoCastOwned(state, id) ? 1 : 0}`)
    .join(",");
  // Focus buttons show a cost that climbs with every purchase, the same reason a tiered
  // ability's upgrade button is in `tiers` above rather than left to the per-frame patch - and
  // whether Focus is unlocked at all can change mid-round, since buying the Presence row
  // carries no round-status check.
  // Over everything castable rather than over the kit, because a power card takes Focus too
  // and its pill carries the same climbing price. Keyed on the quoted price rather than on the
  // rung count, because the price is what the pill prints: on the Innate a tier change re-reads
  // the round's investment against a different ladder, which can move the price without moving
  // the count (`tiers` above catches that too, and the two agreeing costs nothing).
  const focus = unlockedAbilityIds(state)
    .map((id) => `${id}:${abilityFocusCost(state, id)}`)
    .join(",");
  // What changes a card's shape: which cards are in hand, and whether the one just drawn still
  // carries its re-draw button - which it loses on its first cast, on the next draw, and when
  // the pool it could swap into empties. The price is in here too, since it climbs with every
  // draw the round has taken. The option switch is not: like the auto-cast boxes, its ticked
  // state is patched per frame, and folding it in would rebuild the bar on every click of it.
  const cards = [
    cardsInHand(state).join(","),
    roundCards(state).pendingRedrawId || "",
    powerCardRedrawCost(state),
    powerCardRedrawPool(state).length > 0 ? 1 : 0
  ].join("~");
  return [
    currentLang(state),
    unlockedAbilityIds(state).join(","),
    tiers,
    automations,
    abilityFocusUnlocked(state) ? 1 : 0,
    focus,
    cards
  ].join("|");
}

// A Focus purchase button for one unlocked ability, or nothing if Focus is not unlocked yet or
// this ability has already been bought down to the floor. It carries a class of its own rather
// than the foot's .ability-unlock, because it is not the same kind of thing: an unlock or a
// tier is bought once and changes what the card is, while Focus is bought over and over and
// only moves the number it sits beside. So it is drawn as a small pill on the top line rather
// than a price bar in the foot, and the two stop reading as rungs on one ladder.
//
// No ability is held back, the Innate's tier 1 included. It used to be: tier 1 is the
// opening-hand freebie, and Focus on it read as Energy poured into a cooldown about to be
// outgrown. The Energy now carries across an upgrade onto the new tier's ladder (see
// abilityFocusEnergy in engine/abilities.js), so a beat bought at tier 1 is credited against
// tier 2's rungs rather than lost with the tier - and hiding the pill would be hiding the one
// purchase that is never wasted. Tier 1 carries a real ladder of its own besides: five rungs
// at 3/5/7/10/15, see ABILITIES.innate_power.
function abilityFocusMarkup(state, abilityId) {
  if (!abilityFocusUnlocked(state)) return "";
  const t = locale(state);
  const cost = abilityFocusCost(state, abilityId);
  if (!Number.isFinite(cost)) return "";
  return `<button type="button" class="ability-focus" data-focus-ability="${abilityId}">${template(t.abilityFocusBtn, { cost })}</button>`;
}

// The card's top line: the name, and hard against the right edge the marks - the Focus price,
// then the cooldown state. Focus stands immediately left of the countdown because that is the
// number it buys down; the foot below is left to the purchases that change the card itself.
//
// Every card shape shares this line, so a card with no Focus button is the same markup with the
// pill missing, and the state sits exactly where it always did.
function abilityHeadMarkup(state, abilityId) {
  return `
    <span class="ability-head">
      <span class="ability-name">${abilityName(state, abilityId)}</span>
      <span class="ability-marks">
        ${abilityFocusMarkup(state, abilityId)}
        <span class="ability-state" data-role="state"></span>
      </span>
    </span>
  `;
}

// The face of a two-part card - the shape a card takes as soon as it carries anything pressable
// besides the cast. The head is lifted out of the cast button, because a button cannot hold the
// Focus button that now sits on that line, and the sweep is lifted out with it so the cooldown
// still washes across the whole card rather than only the strip below the name. What is left
// inside the cast button is the description; the card takes the click everywhere else, which is
// what the bar's click handler already does for the foot.
function abilityCardFaceMarkup(state, abilityId) {
  return `
    <span class="ability-sweep" data-role="sweep"></span>
    ${abilityHeadMarkup(state, abilityId)}
    <button type="button" class="ability-cast" data-ability="${abilityId}">
      <span class="ability-text">${abilityText(state, abilityId)}</span>
    </button>
  `;
}

// The switch that says whether this ability's automation casts. Drawn only once the automation
// is owned, and drawn from then on forever: autoCastOwned reads the purchase rather than the
// round's snapshot, so the box appears the instant it is bought - already ticked, because a
// player who just paid for it should not have to click a second time - and never disappears.
//
// The input carries data-auto-cast and the label does not, so a click on the text reaches the
// bar's handler once, through the click the label synthesizes on the box itself.
//
// It is drawn as a sliding switch rather than a tick box - the same shape a phone's settings
// screen uses - because that is what it is: a setting that stays on until it is turned off,
// not a choice being confirmed. The input itself is still a checkbox, only hidden behind the
// track: everything that reads or writes it - the patch pass, the delegated click, the
// keyboard - keeps working on a plain checkbox, and the label still forwards a click on the
// text to it. The track sits after the input so `:checked ~` can paint it.
function abilityAutoCastMarkup(state, abilityId) {
  if (!autoCastOwned(state, abilityId)) return "";
  const t = locale(state);
  return `
    <label class="ability-auto" title="${t.autoCastHint}">
      <input type="checkbox" data-auto-cast="${abilityId}">
      <span>${t.autoCastLabel}</span>
      <span class="auto-switch" aria-hidden="true"></span>
    </label>
  `;
}

// One unlocked ability: the pressable card, with the cooldown sweep behind its text.
//
// Two shapes, and which one it takes is whether the card carries anything pressable besides the
// cast - the automation switch, a Focus pill, or both. With neither it stays the single button
// it has always been. With either it becomes the container the tiered card already is, because
// neither a checkbox nor a button can live inside a button, and the cast moves into a button of
// its own with the head above it and the foot beneath.
function renderUnlockedAbility(state, abilityId) {
  const auto = abilityAutoCastMarkup(state, abilityId);
  const focus = abilityFocusMarkup(state, abilityId);
  if (!auto && !focus) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ability";
    button.setAttribute("data-ability", abilityId);
    button.innerHTML = `
      <span class="ability-sweep" data-role="sweep"></span>
      <span class="ability-body">
        ${abilityHeadMarkup(state, abilityId)}
        <span class="ability-text">${abilityText(state, abilityId)}</span>
      </span>
    `;
    return button;
  }

  const card = document.createElement("div");
  card.className = "ability is-automated";
  card.innerHTML = `
    ${abilityCardFaceMarkup(state, abilityId)}
    <span class="ability-foot">${auto}</span>
  `;
  return card;
}

// One locked ability: the same card, dimmed, with a price where its state would be. It is a
// div rather than a button because it contains one - the card itself does nothing, only the
// price is pressable.
function renderLockedAbility(state, abilityId) {
  const t = locale(state);
  const card = document.createElement("div");
  card.className = "ability is-locked";
  card.setAttribute("data-locked-ability", abilityId);
  card.innerHTML = `
    <span class="ability-body">
      <span class="ability-head">
        <span class="ability-name">${abilityName(state, abilityId)}</span>
        <span class="ability-state">${t.abilityLocked}</span>
      </span>
      <span class="ability-text">${abilityText(state, abilityId)}</span>
      <button type="button" class="ability-unlock" data-unlock-ability="${abilityId}">
        ${template(t.abilityUnlockBtn, { cost: abilityUnlockCost(state, abilityId) })}
      </button>
    </span>
  `;
  return card;
}

// A tiered ability is unlocked and pressable *and* carries a price for its next tier, so it
// cannot be the single button the others are - a button inside a button is not markup. The
// card becomes a div holding two: the cast surface, and the tier row beneath it.
function renderTieredAbility(state, abilityId) {
  const t = locale(state);
  const card = document.createElement("div");
  card.className = "ability is-tiered";
  card.setAttribute("data-tiered-ability", abilityId);

  const cost = abilityUpgradeCost(state, abilityId);
  // Tiers are zero-based in state and one-based on the card, because "Tier 0" is not a thing
  // a player has ever been sold.
  const nextTier = abilityTier(state, abilityId) + 2;
  const upgrade = Number.isFinite(cost)
    ? `<button type="button" class="ability-unlock" data-upgrade-ability="${abilityId}">${template(t.abilityUpgradeBtn, { tier: nextTier, cost })}</button>`
    : "";

  card.innerHTML = `
    ${abilityCardFaceMarkup(state, abilityId)}
    <span class="ability-foot">
      <span class="ability-tier">${template(t.abilityTierLabel, { tier: abilityTier(state, abilityId) + 1 })}</span>
      ${upgrade}
      ${abilityAutoCastMarkup(state, abilityId)}
    </span>
  `;
  return card;
}

/* A power card in the bar. Structurally the tiered card's shape - a container with a face and
 * a foot - because it carries two pressable things beside the cast: the re-draw button, and on
 * Tsunami the switch for its second half.
 *
 * It wears its own tag where a tiered ability wears its tier, which is the one place the bar
 * says out loud that this entry is not part of the spirit's kit. Everything else about it is
 * deliberately identical: same head, same sweep, same cast surface, same Focus pill.
 */
function renderPowerCard(state, cardId) {
  const t = locale(state);
  const card = document.createElement("div");
  card.className = "ability is-card";
  card.setAttribute("data-power-card", cardId);

  // Only while the card is still the one just drawn and there is something left to swap to -
  // see powerCardRedrawOffered. Casting is accepting, so this is gone from the first cast on.
  const redraw = powerCardRedrawOffered(state, cardId)
    ? `<button type="button" class="ability-unlock card-redraw" data-redraw-card="${cardId}" title="${t.cardRedrawHint}">${template(t.cardRedrawBtn, { cost: powerCardRedrawCost(state) })}</button>`
    : "";

  // A sliding switch, the same control and the same reasoning as the auto-cast boxes: a
  // setting that stays where it is put, rather than a question asked on every cast. It carries
  // .ability-auto so it inherits that switch's whole look, and .card-option so the bar's click
  // handler can tell the two apart before either reaches the cast.
  const option = cardId in POWER_CARD_OPTION_DEFAULTS
    ? `
      <label class="ability-auto card-option" title="${t.cardOptionHint}">
        <input type="checkbox" data-card-option="${cardId}">
        <span>${t.cardOptionLabel}</span>
        <span class="auto-switch" aria-hidden="true"></span>
      </label>
    `
    : "";

  card.innerHTML = `
    ${abilityCardFaceMarkup(state, cardId)}
    <span class="ability-foot">
      <span class="ability-tier card-tag">${t.cardTag}</span>
      ${redraw}
      ${option}
    </span>
  `;
  return card;
}

function renderAbilityBar(state) {
  dom.abilityBar.innerHTML = "";

  // Kit order, locked entries in place: the bar is the spirit's full hand from the first
  // round, so what is still missing is visible rather than inferred.
  for (const abilityId of spiritAbilityIds(state)) {
    let card;
    if (!abilityIsUnlocked(state, abilityId)) card = renderLockedAbility(state, abilityId);
    else if (abilityIsTiered(abilityId)) card = renderTieredAbility(state, abilityId);
    else card = renderUnlockedAbility(state, abilityId);
    dom.abilityBar.appendChild(card);
  }

  // Then what the round earned, in the order it was handed over. After the kit rather than
  // mixed into it: the five abilities sit where the player has learned to aim at them, and a
  // card arriving at wave 45 must not shove them sideways mid-round.
  // The card the fx is announcing right now gets the entrance. Read off the fx rather than off
  // "is this new to the bar", so a rebuild for some unrelated reason - a Focus purchase, a
  // language switch - does not replay an arrival that already happened.
  const arriving = activeCardFx(state);
  for (const cardId of cardsInHand(state)) {
    const card = renderPowerCard(state, cardId);
    if (arriving && arriving.cardId === cardId) card.classList.add("is-arriving");
    dom.abilityBar.appendChild(card);
  }
}

// Per-frame patch: state class, the countdown, the sweep's width, and whether each locked
// ability is affordable right now. No node is replaced.
function patchAbilityBar(state) {
  const t = locale(state);
  // Everything in this bar is bought and spent inside a round: the Energy, the unlocks it
  // pays for, the tiers, and the casts. A round that has ended still shows the bar - it is
  // the spirit's kit, not a control panel - so every pressable thing on it goes dead instead,
  // rather than taking a click the engine will only refuse (see unlockAbility).
  const running = state.round.status === "running";

  // All three prices in the bar answer the same question - can I afford this yet - so they are
  // patched the same way, and the card wears the answer as a warm border either way. A card can
  // carry two of them at once now - a tier price in the foot and a Focus pill on the top line -
  // so the border is an OR across everything on the card rather than whichever price the loop
  // happened to reach last.
  const cardAfford = new Map();
  for (const button of dom.abilityBar.querySelectorAll("[data-unlock-ability], [data-upgrade-ability], [data-focus-ability], [data-redraw-card]")) {
    const unlockId = button.getAttribute("data-unlock-ability");
    const upgradeId = button.getAttribute("data-upgrade-ability");
    const focusId = button.getAttribute("data-focus-ability");
    // A fourth price on the same footing as the other three: paid in Energy, inside the round,
    // and dead the moment the purse is short. The bar treats it exactly like an unlock.
    const cost = unlockId
      ? abilityUnlockCost(state, unlockId)
      : upgradeId
      ? abilityUpgradeCost(state, upgradeId)
      : focusId
      ? abilityFocusCost(state, focusId)
      : powerCardRedrawCost(state);
    const affordable = running && state.resources.energy >= cost;
    button.disabled = !affordable;
    const card = button.closest(".ability");
    cardAfford.set(card, cardAfford.get(card) === true || affordable);
  }
  for (const [card, affordable] of cardAfford) card.classList.toggle("is-affordable", affordable);

  // The one exception to the rule above: the checkbox stays live while the round is not
  // running. It spends nothing - no Energy, no cooldown, no Fear - and the shop between rounds
  // is exactly where a player decides how the next round should play, so deadening it would
  // take the setting away at the moment it is most wanted.
  //
  // Ticked-ness is patched here rather than rebuilt, like every other per-frame value.
  for (const box of dom.abilityBar.querySelectorAll("[data-auto-cast]")) {
    box.checked = state.ui.autoCast[box.getAttribute("data-auto-cast")] !== false;
  }

  /* A card stays lit from the moment it lands until the moment it is first cast.
   *
   * The entrance animation is over in a second and the reveal in under three, and a player
   * who was reading a land through both has still been given something. This is the mark that
   * waits: it is keyed off pendingRedrawId, which is set by the draw and cleared by
   * acceptPowerCard on the first cast - so "lit" means exactly "handed to you and not yet
   * used", which is the state worth marking. It outlasts the re-draw button, which also needs
   * a non-empty swap pool, so the last card of a round is still lit with no button on it.
   *
   * Patched rather than set at render time so it goes out on the cast itself, without waiting
   * for anything to rebuild the bar.
   */
  const pendingCard = roundCards(state).pendingRedrawId;
  for (const card of dom.abilityBar.querySelectorAll("[data-power-card]")) {
    card.classList.toggle("is-fresh", card.getAttribute("data-power-card") === pendingCard);
  }

  // Same exception and the same reason: a card's option switch spends nothing, so it stays
  // live between rounds, and its ticked state is patched rather than rebuilt.
  for (const box of dom.abilityBar.querySelectorAll("[data-card-option]")) {
    box.checked = powerCardOptionOn(state, box.getAttribute("data-card-option"));
  }

  for (const button of dom.abilityBar.querySelectorAll("[data-ability]")) {
    const abilityId = button.getAttribute("data-ability");
    const slot = state.abilities[abilityId];
    if (!slot) continue;

    const full = abilityCooldownSeconds(state, abilityId);
    const remaining = slot.cooldownRemaining;
    const armed = state.pendingAbilityTarget === abilityId;
    const ready = remaining <= 0;

    // The state classes go on the card, not the pressable element: for a plain ability those
    // are the same node, for a tiered one the card is the button's parent.
    const card = button.closest(".ability");
    card.classList.toggle("is-armed", armed);
    card.classList.toggle("is-ready", ready && !armed);
    card.classList.toggle("is-cooling", !ready);
    button.disabled = !running || (!ready && !armed);
    // The whole card takes the cast, not just the cast button, so the card has to know whether
    // the cast would land - a disabled button refuses its own clicks, but the foot around it
    // would still be showing a pointer over a cast that goes nowhere.
    card.classList.toggle("is-castable", !button.disabled);

    card.querySelector('[data-role="state"]').textContent = armed
      ? t.abilityArmed
      : (ready ? t.abilityReady : template(t.abilityCooldown, { seconds: displaySeconds(state, remaining) }));

    // The sweep drains left to right as the cooldown runs down, so "how long still" is
    // readable at a glance without reading the number.
    const pct = ready || full <= 0 ? 0 : Math.max(0, Math.min(100, (remaining / full) * 100));
    card.querySelector('[data-role="sweep"]').style.width = `${pct}%`;
  }
}

/* ------------------------------------------------------------------ *
 * Shop                                                                 *
 * ------------------------------------------------------------------ */

// The wave is in here because the running-round summary prints it, and the round-scoped
// tiers because a purchase made mid-round changes a row's "takes effect next round" note
// without changing anything the owned tiers can see. The best wave joins them because the
// High-Water Mark's row quotes the next milestone the player is heading for, which moves with
// their depth rather than with anything else in this list.
//
// The round controls are not in this list and must not go back into it: they are not in this
// panel any more, and renderShop never read them. Whether auto_start_round is owned still
// reaches the catalogue through tiers, which is the only part of it this panel draws.
function shopSignature(state) {
  const tiers = UPGRADE_IDS.map((id) => `${id}:${upgradeTier(state, id)}:${activeUpgradeTier(state, id)}`).join(",");
  // What the Presence catalogue owns decides which rows exist at all now that a locked one is
  // absent rather than dead, and - since the discount ladders landed - what several of them
  // cost. So a Presence purchase has to reach this signature; nothing else in the list moves
  // when one is made, and a discounted row would otherwise keep advertising its old price.
  const unlocks = PRESENCE_UPGRADE_IDS.map((id) => presenceUpgradeTier(state, id)).join(",");
  // How many cards are owned, because the first one reveals a row (upgradeRevealed) and the
  // card is bought in the panel *below* this one - so without this the shelf would grow a row
  // that nothing here repaints, and the player would see it appear at some unrelated later
  // moment. The count rather than the ids: no row's text depends on which cards are owned.
  const cards = ownedPowerCardIds(state).length;
  return [
    currentLang(state),
    // The Dahan Remember prints its strike interval in real seconds, which the speed dial
    // divides - so the row is stale the moment the dial moves unless the signature knows.
    gameSpeed(state),
    state.round.status,
    state.round.number,
    state.round.wavesResolved,
    state.meta.bestWaveReached,
    formatFear(state.meta.fear),
    formatFear(state.round.fearEarned),
    tiers,
    unlocks,
    cards
  ].join("|");
}

// What changes a Presence row is the purse crossing its cost, or a rung being taken - and the
// purse only moves on an ascension or a purchase. So the signature is the purse, the rung every
// row stands on, and the language. The discount rows quote a Fear price, but that price is a
// function of the rung, so the rung already covers it.
function presenceShopSignature(state) {
  const owned = PRESENCE_UPGRADE_IDS.map((id) => `${id}:${presenceUpgradeTier(state, id)}`).join(",");
  // The draw row lives in this panel, so what it shows joins the signature: which cards are
  // owned, which three are on offer, and - because the row prints where the next draw is due -
  // the wave the drip is counting toward.
  const cards = [
    ownedPowerCardIds(state).join(","),
    powerCardOfferIds(state).join(","),
    state.round.status,
    roundCards(state).nextDrawWave
  ].join("~");
  // The offers quote their cooldowns in real seconds, which the speed dial divides - the same
  // reason gameSpeed is in shopSignature, and the row is stale without it.
  return [currentLang(state), gameSpeed(state), state.meta.presence, owned, cards].join("|");
}

/* Whether the bought half of the shop is unfolded.
 *
 * Shut to start, and shut again on every reload: the list under that heading is a record of
 * what has already been paid for, and the panel's job is the part still for sale. A player who
 * wants the record asks for it. Late in a run the sold-out half is most of the catalogue, and
 * folded it costs one line instead of scrolling the buyable rows off the panel.
 *
 * A view preference, not game state, so it lives here rather than in the save - the same
 * reasoning as `ascendArmed` below, minus the danger. It does sit outside renderShop, because
 * renderShop runs again whenever the catalogue moves and a flag inside it would snap shut
 * every time something was bought.
 */
let soldOutOpen = false;
let presenceSoldOutOpen = false;

function renderShop(state) {
  const t = locale(state);
  const ended = state.round.status === "ended";

  // Never hidden any more. Fear is banked at the round boundary rather than spendable the
  // moment it is earned, so the shop no longer has to be shut to keep a round from buying
  // its own way out - and once rounds start themselves there would be no moment to open it.
  dom.shopPanel.hidden = false;

  dom.shopSummary.textContent = ended
    ? template(t.shopLostRound, {
        round: state.round.number,
        fear: formatFear(state.round.fearEarned)
      })
    : template(t.shopRoundRunning, {
        round: state.round.number,
        wave: state.round.wavesResolved,
        fear: formatFear(state.round.fearEarned)
      });
  dom.shopFearValue.textContent = formatFear(state.meta.fear);

  dom.upgradeList.innerHTML = "";

  function renderRow(upgradeId, soldOutRow, parent) {
    const repeatable = Boolean((UPGRADES[upgradeId] || {}).repeatable);
    const tier = upgradeTier(state, upgradeId);
    const maxed = tier >= upgradeMaxTier(upgradeId);
    const cost = upgradeCost(state, upgradeId);
    const affordable = !maxed && state.meta.fear >= cost;
    // Owned but not yet running: bought during a round, waiting on the next one to start.
    // Only worth saying while a round is actually in progress - between rounds every
    // purchase is pending, and saying so on every row would say nothing.
    const pending = !ended && tier > activeUpgradeTier(state, upgradeId);

    // A one-off has no ladder, so it shows nothing where a tier would go and reads "Owned"
    // rather than "Maxed" once it is bought. A pool shows its haste there instead of a tier -
    // see upgradeStatusText, which decides all three.
    const statusText = upgradeStatusText(state, upgradeId);
    const status = statusText ? `<span class="upgrade-tier">${statusText}</span>` : "";
    const pendingNote = pending ? `<span class="upgrade-pending">${t.shopPendingHint}</span>` : "";
    const buyLabel = maxed
      ? (repeatable ? t.shopMaxedBtn : t.shopOwnedBtn)
      : template(t.shopCostLabel, { cost });

    const row = document.createElement("div");
    row.className = `upgrade${affordable ? " is-affordable" : ""}${repeatable ? "" : " is-one-off"}${pending ? " is-pending" : ""}${soldOutRow ? " is-sold-out" : ""}${upgradeIsPool(upgradeId) ? " is-pool" : ""}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <span class="upgrade-name">${upgradeName(state, upgradeId)}</span>
        <span class="upgrade-text">${upgradeText(state, upgradeId)}</span>
        ${status}
        ${pendingNote}
      </div>
      ${upgradeIsPool(upgradeId) ? poolButtons(state, upgradeId, maxed) : `
      <button type="button" class="upgrade-buy" data-upgrade="${upgradeId}" ${maxed || !affordable ? "disabled" : ""}>
        ${buyLabel}
      </button>`}
    `;
    (parent || dom.upgradeList).appendChild(row);
  }

  /* ---------- What a pool row offers instead of a Buy ----------
   *
   * One button per denomination the catalogue names, then a Max that takes everything the
   * purse can pay for. Every button carries the Fear it will actually spend, because "+100"
   * near the cap is not 100 Fear - purchaseUpgrade buys what is left rather than refusing, and
   * a button that hid that would be spending a number the player did not agree to.
   *
   * A denomination the purse cannot cover is disabled rather than dropped. The row would
   * reshuffle under the cursor otherwise, and what the next tier of the pool costs is worth
   * seeing from below it.
   */
  function poolButtons(state, upgradeId, maxed) {
    if (maxed) {
      return `<div class="upgrade-pool-buys"><button type="button" class="upgrade-buy" disabled>${t.shopMaxedBtn}</button></div>`;
    }

    const room = upgradeMaxTier(upgradeId) - upgradeTier(state, upgradeId);
    const affordableCount = upgradeTiersAffordable(state, upgradeId);
    const buttons = upgradeBulkAmounts(upgradeId).map((amount) => {
      // What this button will really take: the last +1000 before the cap spends what is left.
      const spend = Math.min(amount, room);
      const cost = upgradeCostFor(state, upgradeId, spend);
      return `<button type="button" class="upgrade-buy is-pool-buy" data-upgrade="${upgradeId}" data-amount="${amount}"
        title="${template(t.shopInvestTitle, { amount: cost })}" ${spend > affordableCount ? "disabled" : ""}>${template(t.shopInvestBtn, { amount })}</button>`;
    });

    // Max is offered even at zero, disabled, so the row keeps its shape whatever the purse
    // holds - and so the button the player reaches for is always in the same place.
    const maxCost = upgradeCostFor(state, upgradeId, affordableCount);
    buttons.push(`<button type="button" class="upgrade-buy is-pool-max" data-upgrade="${upgradeId}" data-amount="${affordableCount}"
      title="${template(t.shopInvestMaxTitle, { amount: maxCost })}" ${affordableCount <= 0 ? "disabled" : ""}>${t.shopInvestMaxBtn}</button>`);

    return `<div class="upgrade-pool-buys">${buttons.join("")}</div>`;
  }

  // Two passes, not one sorted list: anything sold out - a maxed ladder or a bought one-off -
  // sinks below everything still worth a look, and within each half the catalogue stays
  // repeatables first, one-offs after. Splitting the passes keeps a maxed ladder from landing
  // under the "One-off" divider it has nothing to do with just because it sorted next to one.
  //
  // Every row on the shelf is drawn, because every row on the shelf is buyable - the Presence
  // lock that used to hide two of them is gone (see the note where upgradeNeedsPresence was).
  // What Presence does to this list now shows up through `maxedId`: a granted automation reads
  // as owned via upgradeTier, so it sinks into the sold-out fold and stays there across the wipe.
  //
  // `upgradeRevealed` is the one thing that keeps a row off the shelf entirely, and it is a
  // reveal rather than a lock: the card-interval row waits for the first power card, because
  // until then its text prices a drip the player has nothing to receive. Filtered here rather
  // than drawn disabled - a locked row invites a click, and this one has nothing to explain.
  const maxedId = (id) => upgradeTier(state, id) >= upgradeMaxTier(id);
  const shelf = UPGRADE_IDS.filter((id) => upgradeRevealed(state, id));
  const buyable = shelf.filter((id) => !maxedId(id));
  const soldOut = shelf.filter(maxedId);

  function renderDivider(label, extraClass) {
    const rule = document.createElement("div");
    rule.className = `upgrade-divider${extraClass ? ` ${extraClass}` : ""}`;
    rule.textContent = label;
    dom.upgradeList.appendChild(rule);
  }

  let seenOneOff = false;
  for (const upgradeId of buyable) {
    const repeatable = Boolean((UPGRADES[upgradeId] || {}).repeatable);
    if (!repeatable && !seenOneOff) {
      seenOneOff = true;
      renderDivider(t.shopOneOffLabel);
    }
    renderRow(upgradeId, false);
  }
  // The sold-out half gets its own heading and a wider gap above it: without one the first
  // bought row reads as just another entry in the list you are still shopping from. The
  // heading is also the handle that folds it - see soldOutOpen for why it starts shut.
  if (soldOut.length) {
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "upgrade-divider is-sold-out upgrade-fold";
    fold.dataset.fold = "sold-out";
    fold.setAttribute("aria-expanded", String(soldOutOpen));
    fold.setAttribute("aria-controls", "upgradeSoldOut");
    // The count is on the heading because it is the only thing the fold can say about what it
    // is hiding: shut, the list is one line, and "how much have I bought" should not cost a click.
    fold.innerHTML = `
      <span class="upgrade-fold-caret" aria-hidden="true"></span>
      <span>${t.shopSoldOutLabel} (${soldOut.length})</span>
    `;
    dom.upgradeList.appendChild(fold);

    const box = document.createElement("div");
    box.id = "upgradeSoldOut";
    box.className = "upgrade-fold-body";
    box.hidden = !soldOutOpen;
    dom.upgradeList.appendChild(box);
    for (const upgradeId of soldOut) renderRow(upgradeId, true, box);
  }
}

/* ------------------------------------------------------------------ *
 * The ascension panel (06-ui-contract.md section 5a)                   *
 * ------------------------------------------------------------------ */

/* Arming, not a modal.
 *
 * Reclaiming is the one irreversible action in the game, so it takes two clicks: the first
 * arms the button, the second commits. A dialog would have covered the numbers the player is
 * deciding on - the payout, the Fear about to go, the tiers about to go - and those are all on
 * the panel behind it. Anything else on the page disarms it, so a click that wandered off and
 * came back does not find a live button waiting.
 *
 * It lives outside the state deliberately: it is not a preference, it means nothing after a
 * reload, and a save that came back armed would be the worst possible thing to persist.
 */
let ascendArmed = false;

function disarmAscend() {
  ascendArmed = false;
}

// Simpler than the Fear shop's: no pool denominations and no pending hint, because nothing here
// waits on a round to start. What it does share is the tier chip on the rows that have a ladder
// and the sold-out treatment, which is keyed to *maxed* rather than owned - a discount row is
// still worth looking at with rungs left on it.
/* The cooldown an offered card would run, printed the way every other countdown in the HUD is:
 * in real seconds, which the speed dial divides. Effect text alone cannot answer the question
 * this row is actually asking - the three on offer differ far more in how often they may be
 * cast than in what one cast does, and Tsunami against Pull Beneath is 50 beats against 10.
 *
 * Deliberately the authored figure rather than abilityCooldownSeconds: that one reads Focus,
 * which nobody has bought on a card they do not own yet, and multiplies by
 * `round.abilityCooldownMult` - 1 in every round today, but the moment a row moves it, it is
 * frozen per round, so between rounds an offer would be quoting a fight that is already over.
 * The tooltip is what says Focus comes on top.
 */
function cardOfferCooldownSeconds(state, cardId) {
  const record = abilityRecord(state, cardId);
  return displaySeconds(state, record ? record.cooldownSeconds : 0);
}

/* The draw row, which is not an upgrade row at all: three cards on show and one kept, rather
 * than a price and a tier. It sits at the top of the Presence panel because it is the only
 * thing in there that buys a new kind of thing rather than discounting an old one.
 *
 * ensurePowerCardOffer is the read path, not powerCards.draw.offerIds - see the note on it.
 * The roll is stored, so opening this panel twice shows the same three cards, and so does a
 * reload. Boot rolls and saves the first one, which is what keeps the re-roll price honest.
 */
function renderCardShop(state) {
  const t = locale(state);
  const box = document.createElement("div");
  box.className = "card-shop";

  const owned = ownedPowerCardIds(state).length;
  const head = `
    <div class="card-shop-head">
      <h4>${t.cardShopLabel}</h4>
      <span class="card-shop-count">${template(t.cardOwnedLabel, { count: owned, total: POWER_CARD_IDS.length })}</span>
    </div>
  `;

  // Nothing left to sell. The panel keeps the heading and the tally rather than vanishing:
  // owning all seven is the end of a ladder, and a row that disappears reads like a bug.
  if (powerCardsSoldOut(state)) {
    box.innerHTML = `${head}<p class="card-shop-hint">${t.cardShopSoldOut}</p>`;
    return box;
  }

  const cost = powerCardDrawCost(state);
  const affordable = state.meta.presence >= cost;
  const offers = ensurePowerCardOffer(state).map((cardId) => `
    <div class="card-offer${affordable ? " is-affordable" : ""}">
      <div class="card-offer-info">
        <span class="card-offer-name">${abilityName(state, cardId)}</span>
        <span class="card-offer-cooldown" title="${t.cardOfferCooldownHint}">${template(t.cardOfferCooldownLabel, { seconds: cardOfferCooldownSeconds(state, cardId) })}</span>
        <span class="card-offer-text">${abilityText(state, cardId)}</span>
      </div>
      <button type="button" class="upgrade-buy" data-draw-card="${cardId}" ${affordable ? "" : "disabled"}>
        ${template(t.cardDrawCostLabel, { cost })}
      </button>
    </div>
  `).join("");

  // Dead rather than dear once three or fewer are unowned: at that point every card is already
  // on show and a paid re-roll could only hand back what is already there.
  const rerollAllowed = powerCardRerollAllowed(state);
  const rerollCost = powerCardRerollCost(state);
  const rerollAfford = rerollAllowed && state.meta.presence >= rerollCost;
  const reroll = `
    <div class="card-shop-foot">
      <button type="button" class="small-btn card-reroll" data-reroll-cards ${rerollAfford ? "" : "disabled"}>
        ${template(t.cardRerollBtn, { cost: rerollCost })}
      </button>
      <small class="card-shop-hint">${rerollAllowed ? t.cardRerollHint : t.cardRerollDeadHint}</small>
    </div>
  `;

  // Where the next card is due used to be printed here. It has moved to the Abilities headline
  // - see patchNextCardHint. This panel is only ever open between rounds, and a wave number is
  // a countdown to nothing at the one moment nobody can be looking at it.
  box.innerHTML = `
    ${head}
    <p class="card-shop-hint">${t.cardShopHint}</p>
    <div class="card-offers">${offers}</div>
    ${reroll}
  `;
  return box;
}

function renderPresenceShop(state) {
  const t = locale(state);
  dom.presenceList.innerHTML = "";

  // Above the catalogue, and outside the sold-out fold below it: the draw is its own thing and
  // never sinks, because "all seven owned" is a state it says in its own words.
  dom.presenceList.appendChild(renderCardShop(state));

  function renderRow(presenceId, soldOutRow, parent) {
    // Every Presence row is a one-off now, so the tier chip and the "Maxed" button label both
    // went with the discount ladders (see presenceUpgradeText): there is no rung to report and
    // "owned" is the only way a row can be finished.
    const maxed = presenceUpgradeMaxed(state, presenceId);
    const cost = presenceUpgradeCost(state, presenceId);
    const affordable = !maxed && state.meta.presence >= cost;

    const row = document.createElement("div");
    row.className = `upgrade is-presence is-one-off${affordable ? " is-affordable" : ""}${soldOutRow ? " is-sold-out" : ""}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <span class="upgrade-name">${presenceUpgradeName(state, presenceId)}</span>
        <span class="upgrade-text">${presenceUpgradeText(state, presenceId)}</span>
      </div>
      <button type="button" class="upgrade-buy" data-presence="${presenceId}" ${maxed || !affordable ? "disabled" : ""}>
        ${maxed ? t.presenceOwnedBtn : template(t.presenceCostLabel, { cost })}
      </button>
    `;
    (parent || dom.presenceList).appendChild(row);
  }

  // Same split and fold as the Fear shop's sold-out section (see renderShop): a Presence row with
  // nothing left to sell sinks below what is still worth a look instead of cluttering the list
  // it was just bought out of.
  const buyable = PRESENCE_UPGRADE_IDS.filter((id) => !presenceUpgradeMaxed(state, id));
  const soldOut = PRESENCE_UPGRADE_IDS.filter((id) => presenceUpgradeMaxed(state, id));

  for (const presenceId of buyable) renderRow(presenceId, false);

  if (soldOut.length) {
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "upgrade-divider is-sold-out upgrade-fold";
    fold.dataset.fold = "presence-sold-out";
    fold.setAttribute("aria-expanded", String(presenceSoldOutOpen));
    fold.setAttribute("aria-controls", "presenceSoldOut");
    fold.innerHTML = `
      <span class="upgrade-fold-caret" aria-hidden="true"></span>
      <span>${t.shopSoldOutLabel} (${soldOut.length})</span>
    `;
    dom.presenceList.appendChild(fold);

    const box = document.createElement("div");
    box.id = "presenceSoldOut";
    box.className = "upgrade-fold-body";
    box.hidden = !presenceSoldOutOpen;
    dom.presenceList.appendChild(box);
    for (const presenceId of soldOut) renderRow(presenceId, true, box);
  }
}

/* Patched every frame rather than rebuilt, for the payout above all: it moves as the cycle
 * earns, and it is the number the whole decision turns on. The catalogue below has its own
 * signature and is rebuilt only when something in it actually changes.
 */
function patchAscension(state) {
  const t = locale(state);

  // Absent until there is something to decide, not dimmed - see the markup note. Everything
  // below is skipped in that case, so a hidden panel costs two predicates a frame.
  //
  // The unlock is re-earned by every cycle now, but the panel is not hidden again between them:
  // a player who has Reclaimed once holds Presence, and this is the only place that figure and
  // the Presence catalogue are drawn. So it appears at the first payout worth taking and stays
  // from then on, dark hint and disabled button in the cycles where the payout is still short.
  const unlocked = ascensionUnlocked(state);
  const visible = unlocked || state.meta.ascensionCount > 0;
  dom.ascensionPanel.hidden = !visible;
  if (!visible) {
    disarmAscend();
    return;
  }

  const payout = ascensionPayout(state);
  const totals = cycleFearTotals(state);
  const tiers = Object.values(state.upgrades.purchased || {})
    .reduce((sum, tier) => sum + Math.max(0, Math.floor(Number(tier) || 0)), 0);

  dom.ascensionPresenceValue.textContent = String(state.meta.presence);
  // Only drawn once it is nonzero, same as the fear split beneath the HUD's own purse: at 0
  // Presence the bonus is 0% and the line would be a standing reminder of nothing.
  dom.ascensionPresenceBonus.textContent = state.meta.presence > 0
    ? template(t.ascensionPresenceBonusHint, { percent: pctText(presenceFearMultiplier(state) - 1) })
    : "";
  dom.ascensionPayoutValue.textContent = String(payout);
  // Under the payout, because it is the same question asked forward: how much further this
  // cycle has to run before that number reads one higher.
  dom.ascensionNextPresence.textContent = template(t.ascensionNextPresenceHint, {
    fear: formatFear(fearToNextPresence(state))
  });
  dom.ascensionGenerated.textContent = `${t.ascensionGeneratedLabel}: ${formatFear(totals.generated)} · ${t.ascensionCountLabel}: ${state.meta.ascensionCount}`;
  dom.ascensionLoss.textContent = template(t.ascensionLossHint, {
    fear: formatFear(state.meta.fear),
    tiers
  });

  // The same rule the round controls follow, and for the same reason: ascension is a
  // between-rounds action. Disabled rather than hidden, so the panel does not change height at
  // every round boundary.
  //
  // Two reasons it can be disabled, and the hint names whichever is the real one. A short payout
  // outranks a running round: the round will end on its own in a minute, and the player who is
  // told to wait for that and then finds the button still dead has been misled.
  const ready = canAscend(state);
  if (!ready) disarmAscend();
  dom.ascendBtn.disabled = !ready;
  dom.ascendBtn.textContent = ascendArmed ? t.ascensionConfirmBtn : t.ascensionBtn;
  dom.ascendBtn.classList.toggle("is-armed", ascendArmed);
  dom.ascensionHint.textContent = !unlocked
    ? template(t.ascensionLockedHint, { presence: ASCENSION_UNLOCK_PRESENCE })
    : ready ? "" : t.ascensionRoundHint;
}

/* ------------------------------------------------------------------ *
 * HUD, hint and log                                                    *
 * ------------------------------------------------------------------ */

// Patched every frame. Everything here is a text write or one style property; nothing in
// this function creates or replaces a node.
function patchHud(state) {
  const t = locale(state);

  // Which wave is live right now, not how many rounds have been played - the round number
  // resets on every loss and the player never asked to track it. Waves resolved counts what
  // is behind us, so the wave in front of us is one past that while the round still runs.
  const currentWave = state.round.wavesResolved + (state.round.status === "running" ? 1 : 0);
  dom.roundValue.textContent = String(currentWave);
  dom.bestWaveValue.textContent = String(state.meta.bestWaveReached);
  // The cycle's own best, and only from the first ascension on. Before that the two figures are
  // always equal, and a second identical number on the strip would be noise rather than a
  // reading. From the first Reclaim they part company, and the cycle one is the only one that
  // moves in the rounds just after.
  const showCycleBest = state.meta.ascensionCount > 0;
  dom.cycleBestWaveRow.hidden = !showCycleBest;
  if (showCycleBest) dom.cycleBestWaveValue.textContent = String(state.meta.cycleBestWave);
  // The banked pool, which is the only one the shop can spend. What this round has earned
  // rides underneath it so the player can watch it grow without mistaking it for money.
  dom.fearValue.textContent = formatFear(state.meta.fear);
  // Three readings of one purse, each answering a different question. The value is what can be
  // spent right now; beside it, what the round has added and will bank; below, how that splits
  // between what the round earned on its own and what the Fear ladders added on top.
  //
  // The split line is drawn only when a ladder is actually contributing. With none owned it
  // would read "+8 base" under a line already saying "(+8 this round)" - the same number twice,
  // and a standing reminder of an upgrade the player has not bought yet.
  const fear = fearBreakdown(state);
  dom.fearRound.textContent = fear.total > 0
    ? template(t.fearRoundHint, { fear: fear.total })
    : "";
  dom.fearPending.textContent = fear.bonus > 0
    ? template(t.fearSplitHint, { fear: fear.base, bonus: fear.bonus })
    : "";

  // The High-Water Mark payout. Every other Fear source is a rate that only ever nudges the
  // running total, so the one source that arrives in a lump gets said out loud - otherwise
  // the upgrade the player just spent hundreds on is invisible at the moment it pays.
  // activeFearFx expires it on the same clock the defeat and Blight chips use, so the class
  // comes off by itself on a later frame without anything here holding a timer.
  const fearFx = activeFearFx(state);
  dom.fearMilestone.textContent = fearFx ? `+${fearFx.amount}` : "";
  dom.fearTile.classList.toggle("is-milestone", Boolean(fearFx));
  // Energy is whole-numbered and rises mid-fight, so it is patched with the rest of the
  // per-tick readouts rather than waiting on an ability-bar rebuild.
  dom.energyValue.textContent = String(state.resources.energy);

  dom.blightValue.textContent = template(t.blightMeter, {
    value: state.round.blight,
    max: state.round.blightThreshold
  });
  const blightPct = Math.min(100, (state.round.blight / state.round.blightThreshold) * 100);
  dom.blightFill.style.width = `${blightPct}%`;
  // The meter turns as the round turns: a round two thirds gone should look like one.
  dom.blightFill.classList.toggle("is-critical", blightPct >= 70);

  // Three readings, and only one of them is a countdown. A held gate is named before a stopped
  // clock because it is the more specific answer to "why is nothing moving" - and the only one
  // of the two with a button waiting to be pressed.
  const running = state.round.status === "running";
  const held = waveGateHeld(state);
  const stopped = gameSpeed(state) <= 0;
  dom.waveValue.textContent = !running
    ? "-"
    : held
      ? t.waveHeldValue
      : (stopped ? t.wavePausedValue : template(t.secondsShort, { seconds: displaySeconds(state, state.round.waveTimerRemaining) }));
  dom.waveFill.style.width = running
    ? `${Math.max(0, Math.min(100, (state.round.waveTimerRemaining / WAVE_INTERVAL_SECONDS) * 100))}%`
    : "0%";

  patchCardCountdown(state);

  // The Dahan swing on their own clock, so it gets its own countdown rather than being read
  // off the wave timer - the two will drift apart the moment the shop can shorten one. It
  // keeps showing its number while the clock is stopped rather than repeating the word beside
  // it: a frozen countdown is already legible as frozen next to one that says so.
  dom.dahanAttackValue.textContent = running
    ? template(t.secondsShort, { seconds: displaySeconds(state, state.round.dahanAttackRemaining) })
    : "-";

  // Both slots can hold several terrains once the ladder widens Discover, so both print the
  // joined phrase rather than a single name.
  dom.buildTerrain.textContent = terrainNames(state, state.invader.build);
  dom.discoverTerrain.textContent = terrainNames(state, state.invader.explore);

  // Two readings of one boundary, and they are not the same length. `round-ended` holds for as
  // long as the round is over - it dims the frozen board and calls the Start button - while
  // `round-end-flash` marks the instant it happened and expires on the fx clock the defeat and
  // Blight chips run on. Without the second one, a round that ends while the player is reading
  // the shop simply finds the board already grey, with nothing having said when.
  document.body.classList.toggle("round-ended", !running);
  document.body.classList.toggle("round-end-flash", Boolean(activeRoundEndFx(state)));
}

/* How many waves until the next card, on the tile that counts waves.
 *
 * The drip is the one reward in the game whose arrival is known in advance to the wave, and
 * until now that number was printed only as a hint at the foot of the Presence panel - closed
 * during a round, and scrolled off the screen when it is not. A reward nobody saw coming reads
 * as noise; the same reward with three waves of countdown in front of it reads as an arrival,
 * which is what the drip is for.
 *
 * Three reasons there is nothing to count, and all of them hide the line rather than print a
 * dash: no round running, no card owned, or every owned card already standing in the hand. The
 * last is the one worth naming - a player holding all seven has nothing left to be handed, and
 * a countdown to a draw that will pass silently would be a lie with a number on it.
 */
function patchCardCountdown(state) {
  const t = locale(state);
  const waves = roundCards(state).nextDrawWave - state.round.wavesResolved;
  const show = state.round.status === "running"
    && drawablePowerCardIds(state).length > 0
    && waves > 0;

  dom.cardCountdown.hidden = !show;
  if (!show) {
    dom.cardCountdown.classList.remove("is-due");
    return;
  }

  // One wave out gets its own sentence rather than "in 1 waves", and lights up: that is the
  // last countdown reading the player will see before the card is simply there.
  dom.cardCountdown.textContent = waves === 1
    ? t.cardCountdownNext
    : template(t.cardCountdownWaves, { waves });
  dom.cardCountdown.classList.toggle("is-due", waves === 1);
}

/* The same drip, said the other way round, beside the Abilities headline.
 *
 * Two readings of one fact, and they are not redundant. The HUD tile counts *how many waves are
 * left* against the wave clock it sits on; this one names *which wave* the card arrives on, over
 * the bar it will arrive in. The first is the countdown, the second is the appointment.
 *
 * It sits here rather than at the foot of the card shop, where it used to be. That panel is
 * reachable only between rounds, so the line was on screen exactly when its number could not be
 * acted on and gone for the whole of the round it described.
 *
 * Same three reasons to hide it as the tile above: no round running, nothing left to draw, or
 * the wave already passed. Hidden rather than dashed - a headline is not a place for an empty
 * value to sit taking up room.
 */
function patchNextCardHint(state) {
  const cards = roundCards(state);
  const show = state.round.status === "running"
    && drawablePowerCardIds(state).length > 0
    && cards.nextDrawWave > state.round.wavesResolved;

  dom.abilitiesNextCard.hidden = !show;
  if (!show) return;

  dom.abilitiesNextCard.textContent = template(locale(state).cardNextDrawHint, {
    wave: cards.nextDrawWave
  });
}

/* The card reveal, laid over the island for as long as its fx is fresh.
 *
 * Built once per draw and then left alone. Everything else in this file that changes per frame
 * is a text write, but this one carries a CSS entrance animation, and rewriting the markup on
 * every frame would restart that animation on every frame - the card would sit there pulsing
 * instead of arriving once.
 *
 * It prints the three things the player needs before deciding whether to keep it: the name, the
 * effect, and the cooldown - the same three the shop's offer rows carry, and for the same
 * reason (see cardOfferCooldownSeconds). The wave it arrived on is the kicker above them,
 * because that is what paid for it.
 */
function renderCardReveal(state, fx) {
  const t = locale(state);
  dom.cardReveal.innerHTML = `
    <div class="card-reveal-face">
      <span class="card-reveal-kicker">${template(t.cardRevealTitle, { wave: fx.wave })}</span>
      <span class="card-reveal-name">${abilityName(state, fx.cardId)}</span>
      <span class="card-reveal-text">${abilityText(state, fx.cardId)}</span>
      <span class="card-reveal-marks">
        <span class="card-reveal-tag">${t.cardTag}</span>
        <span class="card-reveal-cooldown">${template(t.cardOfferCooldownLabel, {
          seconds: cardOfferCooldownSeconds(state, fx.cardId)
        })}</span>
      </span>
    </div>
  `;
}

/* Per frame: put a fresh reveal up, take a stale one down, and hand the bar its scroll.
 *
 * The scroll waits for the reveal to expire rather than firing with it. The two would
 * otherwise fight - the reveal is drawn over the board and the bar is somewhere else on the
 * page, so scrolling to the card at the moment of the draw would carry the player away from
 * the very thing announcing it. Once the reveal has said its piece the card in the bar is the
 * only thing left to look at, and that is when the view goes to it.
 */
function patchCardReveal(state) {
  const fx = activeCardFx(state);

  if (fx) {
    if (renderCache.cardRevealAt !== fx.at) {
      // Dropped and re-added around a forced reflow, rather than simply added. A re-draw
      // pressed while the previous reveal is still up replaces the face under a class that is
      // already set, and an animation does not restart for new content underneath it - the
      // swapped-in card would inherit whatever was left of the old card's second, or nothing
      // at all. Reading offsetWidth between the two is what makes the browser commit the
      // removal, so the new face gets a full pass of its own.
      dom.cardReveal.classList.remove("is-live");
      renderCardReveal(state, fx);
      void dom.cardReveal.offsetWidth;
      dom.cardReveal.classList.add("is-live");
      renderCache.cardRevealAt = fx.at;
      renderCache.cardScrollId = fx.cardId;
    }
    return;
  }

  if (renderCache.cardRevealAt === null) return;

  dom.cardReveal.classList.remove("is-live");
  dom.cardReveal.innerHTML = "";
  renderCache.cardRevealAt = null;

  const cardId = renderCache.cardScrollId;
  renderCache.cardScrollId = null;
  if (cardId) scrollCardIntoView(cardId);
}

/* Bring the arrived card into view, and only if it is not already there.
 *
 * `block: "nearest"` on purpose: it is the one option that scrolls by the smallest amount that
 * works, so a bar already on screen is left exactly where it is and a bar just below the fold
 * rises far enough to be read and no further. Nothing here yanks a player who can already see
 * the card - the in-viewport check is what makes the desktop layout, where the bar sits beside
 * the board the whole time, a no-op.
 */
function scrollCardIntoView(cardId) {
  const card = dom.abilityBar.querySelector(`[data-power-card="${cardId}"]`);
  if (!card || typeof card.scrollIntoView !== "function") return;

  const box = card.getBoundingClientRect();
  const visible = box.top >= 0 && box.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (visible) return;

  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
}

// The escalation ladder under the track. Rebuilt rather than patched, and only when the wave
// count moves: eleven rows once a wave is nothing beside the board, and a row's whole text
// changes when a repeating rung fires anyway.
function ladderSignature(state) {
  return `${currentLang(state)}|${state.round.wavesResolved}`;
}

// Three readings, and they are not "done / not done": a rung the round has passed is a rule
// currently *in force*, not a task cleared, so it is the one drawn brightest. `is-next` is
// what the round is about to walk into, and the rest are dim because they are not the
// player's problem yet.
function renderLadder(state) {
  const t = locale(state);
  dom.ladderList.innerHTML = difficultyLadder(state).map((row) => {
    const classes = ["ladder-row"];
    if (row.reached) classes.push("is-live");
    if (row.next) classes.push("is-next");
    return `
      <li class="${classes.join(" ")}" title="${template(t.ladderWaveTitle, { wave: row.wave })}">
        <span class="ladder-wave">${row.wave}</span>
        <span class="ladder-text">${row.text}</span>
      </li>
    `;
  }).join("");
}

// The two pacing controls, patched together because they are read together: how fast the
// round is allowed to run, and whether it is allowed to run on without being asked. Both wear
// their state rather than describing it - the chosen scale is the lit button, and the toggle
// says what it is, not what it would do.
function patchPacingControls(state) {
  const t = locale(state);
  const speed = gameSpeed(state);

  // Which speeds the dial offers is the engine's answer, not a flag read twice: the playtest
  // button is in the markup all along and simply hidden while the code has not been redeemed.
  const offered = availableGameSpeeds(state);
  for (const button of dom.speedGroup.querySelectorAll("[data-game-speed]")) {
    const value = Number(button.getAttribute("data-game-speed"));
    const active = value === speed;
    button.hidden = !offered.includes(value);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.title = value === 0 ? t.speedPausedTitle : template(t.speedOptionTitle, { speed: value });
  }

  // The label says what is switched and never whether it is on: that reading belongs to the
  // slider beside it, and a word repeating it would be a second answer to look at.
  const auto = autoProceedOn(state);
  dom.autoWaveBtnText.textContent = t.autoWaveLabel;
  dom.autoWaveBtn.setAttribute("aria-pressed", String(auto));
  dom.autoWaveBtn.classList.toggle("is-on", auto);
  dom.autoWaveBtn.title = t.autoWaveHint;

  // Pressable only while the gate actually holds. It stays on the strip the rest of the time
  // rather than being hidden: it is the one control the manual mode is played through, and a
  // button that came and went would move the two beside it every wave.
  const held = waveGateHeld(state);
  dom.startNextWaveBtn.textContent = t.startNextWaveBtn;
  dom.startNextWaveBtn.disabled = !held;
  document.body.classList.toggle("wave-held", held);

  // The round toggle only exists once it has been bought - unlike the wave toggle, which is
  // free and always on the strip. Hidden rather than disabled: an unowned upgrade is not a
  // control the player is failing to use, and a dead button beside a live one reads as one.
  const owned = autoStartRoundOwned(state);
  dom.autoRoundBtn.hidden = !owned;
  if (owned) {
    const autoRound = autoStartRoundOn(state);
    dom.autoRoundBtnText.textContent = t.autoRoundLabel;
    dom.autoRoundBtn.setAttribute("aria-pressed", String(autoRound));
    dom.autoRoundBtn.classList.toggle("is-on", autoRound);
    dom.autoRoundBtn.title = t.autoRoundHint;
  }

  // Only pressable between rounds, the same way the wave button is only pressable at a held
  // gate - the shop is on screen all the time now, but the round still ends where it ends.
  dom.startNextRoundBtn.disabled = state.round.status !== "ended";
}

/* ---------- The playtest tools ----------
 *
 * Three controls that only exist once the code is redeemed - the 8x button on the dial, and a
 * grant button inside each of the two currency readouts - plus the button that takes all three
 * away again. Each one lives inside the thing it changes rather than in a panel of its own: a
 * playtest tray somewhere else on the page would be one more place to look, and the point of
 * these is to be one click from the number they move.
 *
 * They are hidden rather than inserted, so nothing here can lag the state that reveals it.
 */

// What the last redeem attempt did, kept as a locale key rather than a sentence: the language
// toggle re-renders it, and a stored German sentence would survive the switch to English.
let redeemStatusKey = null;

function patchRedeemStatus(state) {
  const t = locale(state);
  dom.redeemStatus.textContent = redeemStatusKey ? t[redeemStatusKey] : "";
  dom.redeemStatus.classList.toggle("is-ok", redeemStatusKey === "redeemOk");
  dom.redeemStatus.classList.toggle("is-bad", redeemStatusKey === "redeemUnknown");
}

// What the last export or import did, kept as a key and its variables for the same reason the
// redeem status is: a finished sentence would survive the language toggle in the wrong tongue.
let saveStatus = null;

function setSaveStatus(key, tone, vars) {
  saveStatus = key ? { key, tone, vars: vars || {} } : null;
}

function patchSaveStatus(state) {
  const t = locale(state);
  dom.saveStatus.textContent = saveStatus ? template(t[saveStatus.key], saveStatus.vars) : "";
  dom.saveStatus.classList.toggle("is-ok", Boolean(saveStatus) && saveStatus.tone === "ok");
  dom.saveStatus.classList.toggle("is-bad", Boolean(saveStatus) && saveStatus.tone === "bad");
}

function patchPlaytestTools(state) {
  const on = playtestOn(state);
  // The dial's own button is handled in patchPacingControls, with the rest of the dial.
  dom.playtestEnergyBtn.hidden = !on;
  dom.playtestFearBtn.hidden = !on;
  dom.playtestHideBtn.hidden = !on;
  dom.playtestFearTally.hidden = !on;
  // Patched here rather than in the static text, because these are numbers rather than labels:
  // they move while the language sits still. The granted column is only written once something
  // has been granted - a row of zeroes teaches nothing and makes the line harder to read.
  if (on) {
    const t = locale(state);
    const totals = cycleFearTotals(state);
    const text = template(t.playtestTally, {
      generated: formatFear(totals.generated),
      spent: formatFear(totals.spent)
    });
    dom.playtestFearTally.textContent = totals.granted > 0
      ? text + template(t.playtestTallyGranted, { granted: formatFear(totals.granted) })
      : text;
  }
  // Patched rather than rendered with the rest of the static text: the message answers a click
  // that does not change the language, so it cannot wait on the language cache.
  patchRedeemStatus(state);
}

function renderLog(state) {
  dom.eventLog.innerHTML = (state._log || []).map((entry) => `<li>${entry}</li>`).join("");
}

function applyStaticLanguage(state) {
  const t = locale(state);
  document.documentElement.lang = currentLang(state);

  dom.languageToggleBtn.textContent = t.langToggle;
  dom.speedLabel.textContent = t.speedLabel;
  dom.speedGroup.setAttribute("aria-label", t.speedLabel);
  dom.roundLabel.textContent = t.roundLabel;
  dom.bestWaveLabel.textContent = t.bestWaveLabel;
  dom.cycleBestWaveLabel.textContent = t.cycleBestWaveLabel;
  dom.blightLabel.textContent = t.blightLabel;
  dom.waveLabel.textContent = t.waveLabel;
  dom.fearLabel.textContent = t.fearLabel;

  dom.invaderTrackTitle.textContent = t.invaderTrackTitle;
  dom.buildLabel.textContent = t.buildLabel;
  dom.discoverLabel.textContent = t.discoverLabel;
  dom.dahanAttackLabel.textContent = t.dahanAttackLabel;
  dom.ladderTitle.textContent = t.ladderTitle;
  dom.ladderHint.textContent = t.ladderHint;

  dom.activeSpiritLabel.textContent = t.activeSpiritLabel;
  dom.spiritName.textContent = currentLang(state) === "en"
    ? activeSpirit(state).englishName
    : activeSpirit(state).name;
  dom.spiritTraits.textContent = currentLang(state) === "en"
    ? activeSpirit(state).traitsEn
    : activeSpirit(state).traits;

  dom.abilitiesTitle.textContent = t.abilitiesTitle;
  dom.abilitiesHint.textContent = t.abilitiesHint;
  dom.energyLabel.textContent = t.energyLabel;
  dom.energyHint.textContent = t.energyHint;
  dom.mapTitle.textContent = t.mapTitle;
  dom.shopTitle.textContent = t.shopTitle;
  dom.shopFearLabel.textContent = t.shopFearLabel;
  dom.startNextRoundBtn.textContent = t.startNextRoundBtn;
  dom.ascensionTitle.textContent = t.ascensionTitle;
  dom.ascensionPresenceLabel.textContent = t.ascensionPresenceLabel;
  dom.ascensionPayoutLabel.textContent = t.ascensionPayoutLabel;
  dom.ascensionShopLabel.textContent = t.ascensionShopLabel;
  // Not the Reclaim button itself: its text says whether it is armed, so it is patched every
  // frame rather than written once per language change.
  dom.logTitle.textContent = t.logTitle;
  dom.manualSaveBtn.textContent = t.manualSaveBtn;
  dom.exportSaveBtn.textContent = t.exportSaveBtn;
  dom.importSaveBtn.textContent = t.importSaveBtn;
  dom.wipeSaveBtn.textContent = t.wipeSaveBtn;
  dom.autosaveHint.textContent = t.autosaveHint;

  dom.redeemLabel.textContent = t.redeemLabel;
  dom.redeemInput.placeholder = t.redeemPlaceholder;
  dom.redeemBtn.textContent = t.redeemBtn;
  dom.playtestHideBtn.textContent = t.playtestHideBtn;
  // The grants name their amount, and the amount is the engine's - the label must not be able
  // to promise a hundred while the button hands out fifty.
  dom.playtestEnergyBtn.textContent = template(t.playtestEnergyBtn, { amount: PLAYTEST_GRANT });
  dom.playtestEnergyBtn.title = template(t.playtestEnergyTitle, { amount: PLAYTEST_GRANT });
  dom.playtestFearBtn.textContent = template(t.playtestFearBtn, { amount: PLAYTEST_GRANT });
  dom.playtestFearBtn.title = template(t.playtestFearTitle, { amount: PLAYTEST_GRANT });
  // Only the tally's explanation is static; its numbers are patched every frame.
  dom.playtestFearTally.title = t.playtestTallyTitle;
}

/* ------------------------------------------------------------------ *
 * Render orchestration                                                 *
 * ------------------------------------------------------------------ */

// Everything the board draws, in one string. The board is rebuilt only when this changes,
// so a per-second HUD patch never destroys hover, focus, or a running animation.
function mapSignature(state) {
  const parts = [
    currentLang(state),
    `sel:${effectiveSelectedLand(state)}`,
    // The ring's target and the panel's are not the same read once a deselect can happen: the
    // ring still falls back, but the panel goes empty, and effectiveSelectedLand alone cannot
    // tell those two moments apart.
    `selRaw:${state.ui.selectedLand || "-"}`,
    `armed:${state.pendingAbilityTarget || "-"}`,
    `wave:${state.invader.build || "-"}`,
    // The Discover slot paints rings too now, so a redraw it does not trigger would leave
    // gold on lands the track has already moved off.
    `disc:${state.invader.explore || "-"}`,
    `status:${state.round.status}`
  ];

  for (const landId of LAND_IDS) {
    const slot = state.invaders[landId];
    const damage = state.invaderDamage[landId];
    parts.push([
      landId,
      slot.explorers, slot.towns, slot.cities,
      // Joined explicitly rather than left to Array.toString: these are per-unit damage
      // lists now, and two of them must not collapse into one indistinguishable string.
      damage.explorers.join("/"), damage.towns.join("/"), damage.cities.join("/"),
      state.dahan[landId],
      state.round.blightByLand[landId],
      // The ward is chip markup now, not only patched text, so a cast that lays Defense on a
      // quiet land has to rebuild the board - nothing else in this list would have moved.
      defenseInLand(state, landId)
    ].join("."));
  }

  const defeatFx = activeDefeatFx(state);
  parts.push(defeatFx ? `fx:${defeatFx.land}.${defeatFx.unitType}.${defeatFx.count}.${defeatFx.at}` : "fx:-");
  const blightFx = activeBlightFx(state);
  parts.push(blightFx ? `bfx:${blightFx.lands.join("+")}.${blightFx.at}` : "bfx:-");

  return parts.join("|");
}

function updateUI(state) {
  if (renderCache.language !== currentLang(state)) {
    applyStaticLanguage(state);
    renderCache.language = currentLang(state);
  }

  patchHud(state);
  patchPacingControls(state);

  const nextLadderSig = ladderSignature(state);
  if (renderCache.ladder !== nextLadderSig) {
    renderLadder(state);
    renderCache.ladder = nextLadderSig;
  }

  patchPlaytestTools(state);
  patchSaveStatus(state);
  patchNextCardHint(state);

  const nextAbilitySig = abilityBarSignature(state);
  if (renderCache.abilityBar !== nextAbilitySig) {
    renderAbilityBar(state);
    renderCache.abilityBar = nextAbilitySig;
  }
  patchAbilityBar(state);
  // After the bar, never before: the reveal hands the bar a card to scroll to when it expires,
  // and on the frame a draw lands that node has only just been built.
  patchCardReveal(state);

  const nextMapSig = mapSignature(state);
  if (renderCache.map !== nextMapSig) {
    renderBoard(state);
    renderLandDetail(state);
    renderCache.map = nextMapSig;
  }
  // Always, even when the board itself did not change: the bars and their countdowns move
  // between renders, and that motion is the only thing telling the player time is passing.
  patchLandMeters(state);

  const nextShopSig = shopSignature(state);
  if (renderCache.shop !== nextShopSig) {
    renderShop(state);
    renderCache.shop = nextShopSig;
  }

  const nextPresenceSig = presenceShopSignature(state);
  if (renderCache.presenceShop !== nextPresenceSig) {
    renderPresenceShop(state);
    renderCache.presenceShop = nextPresenceSig;
  }
  // Always, and after the catalogue: the payout moves as the cycle earns, and the arming state
  // changes on a click that never touches the rows.
  patchAscension(state);

  const nextLogSig = (state._log || [])[0] || "";
  if (renderCache.log !== nextLogSig) {
    renderLog(state);
    renderCache.log = nextLogSig;
  }
}

/* ------------------------------------------------------------------ *
 * Boot                                                                 *
 * ------------------------------------------------------------------ */

// Dev fixture mode: `index.html?vis` hands the page over to vis.js, which paints a
// hand-authored mid-round board for layout work. It is a mode of the real page rather than
// a second page, because a second page meant a second copy of this markup - and that copy
// went stale the first time the layout changed.
//
// Two things are switched off for it, and both are the point:
//   - Persistence. A fixture that autosaved would overwrite a real save with a board nobody
//     played, ten seconds after being opened out of curiosity.
//   - The clock. A frozen board is what makes the fixture a fixture: the state vis.js
//     authored is the state on screen, not the state a second later.
const FIXTURE_MODE = /[?&]vis(&|=|$)/.test(location.search);

// The one place a save is written from. Everything below calls this rather than saveState,
// so fixture mode cannot leak a board into storage through a call site added later.
function persist() {
  if (!FIXTURE_MODE) saveState(state);
}

drawIslandOnce();
// A fixture starts from a fresh game, never from the player's save: the board it paints has
// to be the same board on every machine, and a stale upgrade tier would quietly change it.
let state = FIXTURE_MODE ? createFreshGameState() : loadState();
addLog(state, locale(state).spiritAwakens);

/* The card offer, rolled here and saved with it rather than left to the shop's first render.
 *
 * A loaded save already carries one - normalizeState is where that happens - so this only ever
 * fires for a game that has never had one, and it writes immediately. That is the whole point:
 * an offer that only existed in the DOM would be gone on reload, and a reload that hands out
 * three fresh cards makes the re-roll price decoration. Rolling it costs one RNG draw, which
 * is why it is not done inside createFreshGameState - see the note on ensurePowerCardOffer.
 */
const hadOffer = state.powerCards.draw.offerIds.length;
ensurePowerCardOffer(state);
if (state.powerCards.draw.offerIds.length !== hadOffer) persist();

updateUI(state);

/* ------------------------------------------------------------------ *
 * Input                                                                *
 * ------------------------------------------------------------------ */

dom.languageToggleBtn.addEventListener("click", () => {
  state.ui.language = currentLang(state) === "de" ? "en" : "de";
  updateUI(state);
  persist();
});

dom.speedGroup.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("[data-game-speed]");
  if (!button) return;
  if (!setGameSpeed(state, Number(button.getAttribute("data-game-speed")))) return;
  updateUI(state);
  persist();
});

dom.autoWaveBtn.addEventListener("click", () => {
  setAutoProceed(state, !autoProceedOn(state));
  // Nothing is resolved here even when a wave is standing due: the gate simply stops holding,
  // and the next tick runs the wave it was waiting on, on the same path every other wave takes.
  updateUI(state);
  persist();
});

dom.startNextWaveBtn.addEventListener("click", () => {
  if (!startNextWave(state)) return;
  updateUI(state);
  persist();
});

// Turning it on does not start the round standing in the shop right now - the next tick sees
// an ended round with the toggle on and starts it, on the same path the button takes.
dom.autoRoundBtn.addEventListener("click", () => {
  setAutoStartRound(state, !autoStartRoundOn(state));
  updateUI(state);
  persist();
});

dom.abilityBar.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // All three prices are checked before the cast path. A locked card carries no data-ability
  // at all, but a tiered or Focus-bearing card carries a price beside the cast button, and
  // whichever was clicked has to win outright rather than by DOM accident.
  const unlock = target.closest("[data-unlock-ability]");
  if (unlock) {
    unlockAbility(state, unlock.getAttribute("data-unlock-ability") || "");
    updateUI(state);
    persist();
    return;
  }

  const upgrade = target.closest("[data-upgrade-ability]");
  if (upgrade) {
    upgradeAbility(state, upgrade.getAttribute("data-upgrade-ability") || "");
    updateUI(state);
    persist();
    return;
  }

  const focus = target.closest("[data-focus-ability]");
  if (focus) {
    purchaseAbilityFocus(state, focus.getAttribute("data-focus-ability") || "");
    updateUI(state);
    persist();
    return;
  }

  // The fourth price, checked with the other three and ahead of the cast for the same reason.
  const redraw = target.closest("[data-redraw-card]");
  if (redraw) {
    redrawPowerCard(state, redraw.getAttribute("data-redraw-card") || "");
    updateUI(state);
    persist();
    return;
  }

  // Before the auto-cast switch below, not after it: a card's option switch wears
  // .ability-auto too - it is the same control - so the more specific class has to win, or the
  // block below would claim the click and then find no data-auto-cast on it.
  const optionSwitch = target.closest(".card-option");
  if (optionSwitch) {
    const optionBox = target.closest("[data-card-option]");
    if (optionBox) {
      setPowerCardOption(state, optionBox.getAttribute("data-card-option") || "", optionBox.checked === true);
      updateUI(state);
      persist();
    }
    return;
  }

  // Ahead of the cast path too, and for the same reason: the box sits in the card's foot, and
  // the click that lands on it is not a click on the ability.
  //
  // The new value is read off the box rather than derived from autoCastOn, which is false for
  // an automation bought this round - deriving it would make the first click of a fresh
  // purchase a no-op that appears to un-tick itself.
  //
  // The whole switch is claimed here, not just the box inside it, because the cast below now
  // takes everything that falls through: a click on the label's text or on its track arrives
  // once as itself and once as the click the label synthesizes on the box, and only the second
  // carries data-auto-cast. Without the label in the way the first would cast the ability.
  const autoSwitch = target.closest(".ability-auto");
  if (autoSwitch) {
    const autoBox = target.closest("[data-auto-cast]");
    if (autoBox) {
      setAutoCast(state, autoBox.getAttribute("data-auto-cast") || "", autoBox.checked === true);
      updateUI(state);
      persist();
    }
    return;
  }

  // The cast surface is the whole card, not only the button carrying the sweep. On a card with
  // a foot - a tier row, a price, a switch - the strip beneath the cast button was dead space
  // that looked exactly as pressable as the rest of the tile. Anything in the foot that wants
  // the click has already taken it above; whatever is left falls through to the cast.
  //
  // The fallback goes through the card's own cast button rather than the id alone, so a cast
  // the button would refuse - cooling down, or a round that is not running - is refused here
  // too. A locked card has no cast button at all and drops out the same way.
  const card = target.closest(".ability");
  const button = target.closest("[data-ability]") || (card && card.querySelector("[data-ability]"));
  if (!button || button.disabled) return;
  triggerAbility(state, button.getAttribute("data-ability") || "");
  updateUI(state);
});

// A land click selects it; clicking the already-selected land again deselects it, which is
// what lets the detail panel close. While an ability is armed the click means something else
// entirely - it names the target - so it leaves the selection alone: the detail panel does not
// pop open behind the cast, and it does not close if the targeted land happened to be the one
// already open. A click on an illegal land is still a targeting click, just a refused one.
function selectLand(state, landId) {
  if (!isLandId(landId)) return;
  const armed = state.pendingAbilityTarget;
  if (armed) {
    if (abilityLegalLand(state, armed, landId)) resolveAbilityTarget(state, landId);
    updateUI(state);
    return;
  }
  state.ui.selectedLand = state.ui.selectedLand === landId ? null : landId;
  updateUI(state);
}

dom.islandSvg.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const group = target.closest("[data-land]");
  if (!group) return;
  selectLand(state, group.getAttribute("data-land") || "");
});

dom.islandSvg.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const group = target.closest("[data-land]");
  if (!group) return;
  event.preventDefault();
  selectLand(state, group.getAttribute("data-land") || "");
});

// The focus ring, carried across the two layers by hand. The land group is what takes focus
// and its ring now lives above every fill, so the CSS rule that used to reach from one to the
// other cannot; `:focus-visible` is still what decides, so a mouse click lights nothing.
function markLandFocus(landId) {
  for (const ring of dom.islandSvg.querySelectorAll(".land-ring")) {
    ring.classList.toggle("is-focus", ring.getAttribute("data-ring-land") === landId);
  }
}

dom.islandSvg.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const group = target.closest("[data-land]");
  markLandFocus(group && group.matches(":focus-visible") ? group.getAttribute("data-land") : null);
});

dom.islandSvg.addEventListener("focusout", () => markLandFocus(null));

dom.landDetail.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const jump = target.closest("button[data-goto-land]");
  if (!jump) return;
  selectLand(state, jump.getAttribute("data-goto-land") || "");
});

dom.upgradeList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // Folding is done in place rather than by asking for a redraw: the shop only redraws when
  // its signature moves, and nothing about a fold is in the signature - it is not state the
  // game has an opinion about. The flag still has to be set, so the next real redraw keeps it.
  const fold = target.closest("button[data-fold]");
  if (fold) {
    soldOutOpen = !soldOutOpen;
    fold.setAttribute("aria-expanded", String(soldOutOpen));
    const body = document.getElementById("upgradeSoldOut");
    if (body) body.hidden = !soldOutOpen;
    return;
  }

  const button = target.closest("button[data-upgrade]");
  if (!button) return;
  // Absent on every row but the pool's, where it is the denomination the button was drawn
  // for. purchaseUpgrade reads a missing one as a single tier, which is what every other row
  // has always bought.
  const amount = Number(button.getAttribute("data-amount")) || 1;
  purchaseUpgrade(state, button.getAttribute("data-upgrade") || "", amount);
  updateUI(state);
  persist();
});

dom.startNextRoundBtn.addEventListener("click", () => {
  startNextRound(state);
  updateUI(state);
  persist();
});

dom.presenceList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const fold = target.closest("button[data-fold]");
  if (fold) {
    presenceSoldOutOpen = !presenceSoldOutOpen;
    fold.setAttribute("aria-expanded", String(presenceSoldOutOpen));
    const body = document.getElementById("presenceSoldOut");
    if (body) body.hidden = !presenceSoldOutOpen;
    return;
  }

  // The draw row's two buttons, both ahead of the catalogue's own: they sit in the same list
  // and neither carries data-presence, so the row below would otherwise drop the click.
  const draw = target.closest("button[data-draw-card]");
  if (draw) {
    drawPowerCard(state, draw.getAttribute("data-draw-card") || "");
    updateUI(state);
    persist();
    return;
  }

  if (target.closest("button[data-reroll-cards]")) {
    rerollPowerCardOffer(state);
    updateUI(state);
    persist();
    return;
  }

  const button = target.closest("button[data-presence]");
  if (!button) return;
  purchasePresenceUpgrade(state, button.getAttribute("data-presence") || "");
  updateUI(state);
  persist();
});

/* Two clicks, and the second one is the only one that does anything. See the note above
 * `ascendArmed` for why this is an arming button rather than a dialog.
 *
 * The `canAscend` check is not trusted to the disabled attribute alone: `ascend` refuses on its
 * own terms and logs why, which is what makes the rule live in the engine rather than here.
 */
dom.ascendBtn.addEventListener("click", () => {
  if (!ascendArmed) {
    ascendArmed = true;
    updateUI(state);
    return;
  }
  disarmAscend();
  ascend(state);
  updateUI(state);
  persist();
});

// Anything else on the page disarms it, so a click that wandered off and came back does not
// find a live Reclaim waiting. Capture, because the handlers above it stop nothing and this
// has to see a click the shop or the board is about to consume.
document.addEventListener("click", (event) => {
  if (!ascendArmed) return;
  const target = event.target;
  if (target instanceof Element && target.closest("#ascendBtn")) return;
  disarmAscend();
  updateUI(state);
}, true);

// A submit rather than a click, so Enter in the field is the button - the code is typed, and a
// typist reaches for Enter. The default navigation is what would reload the page and lose the
// state the redeem just changed.
dom.redeemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = redeemCode(state, dom.redeemInput.value);
  redeemStatusKey = result === "ok" ? "redeemOk" : result === "already" ? "redeemAlready" : "redeemUnknown";
  // Only a code that did something clears the field. A rejected one stays put to be corrected,
  // which is the whole reason it is worth reading the message beside it.
  if (result === "ok") dom.redeemInput.value = "";
  updateUI(state);
  persist();
});

// Switching the tools off is not un-redeeming a code that was wrong - it is putting the page
// back the way it plays. Typing the code again brings them back.
dom.playtestHideBtn.addEventListener("click", () => {
  setPlaytest(state, false);
  redeemStatusKey = null;
  addLog(state, locale(state).playtestHiddenLog);
  updateUI(state);
  persist();
});

dom.playtestEnergyBtn.addEventListener("click", () => {
  if (!grantPlaytestEnergy(state)) return;
  updateUI(state);
  persist();
});

dom.playtestFearBtn.addEventListener("click", () => {
  if (!grantPlaytestFear(state)) return;
  updateUI(state);
  persist();
});

dom.manualSaveBtn.addEventListener("click", () => {
  persist();
  addLog(state, locale(state).manualSaved);
  updateUI(state);
});

/* ------------------------------------------------------------------ *
 * Export and import                                                    *
 *                                                                      *
 * A file rather than a text box to paste: a save is carried between a   *
 * desktop and a laptop, and the thing that carries it is a file. The    *
 * engine does the wrapping and all of the checking; everything here is  *
 * the download, the picker, and the question asked before a run is      *
 * replaced.                                                            *
 * ------------------------------------------------------------------ */

dom.exportSaveBtn.addEventListener("click", () => {
  // Written from the state in hand rather than from storage, so the file is the board on
  // screen - including in fixture mode, where nothing was ever stored to read back.
  const fileName = exportSaveFileName(state);
  const url = URL.createObjectURL(new Blob([exportSave(state)], { type: "application/octet-stream" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });

  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released a tick later, not immediately: Firefox cancels a download whose blob URL is
  // revoked in the same tick as the click that started it.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  // The log carries the file name, so a player who lost the download can find what to search
  // for. The status line stays clear - nothing failed, and the file itself is the receipt.
  setSaveStatus(null);
  addLog(state, template(locale(state).saveExported, { file: fileName }));
  updateUI(state);
});

dom.importSaveBtn.addEventListener("click", () => {
  // Cleared before opening rather than after picking: choosing the same file twice in a row
  // is otherwise no change at all, and the second pick fires nothing.
  dom.importSaveInput.value = "";
  dom.importSaveInput.click();
});

dom.importSaveInput.addEventListener("change", () => {
  const file = dom.importSaveInput.files && dom.importSaveInput.files[0];
  if (!file) return;

  const showFailure = (key) => {
    setSaveStatus(key, "bad");
    updateUI(state);
  };

  file.text().then((text) => {
    const result = importSave(text);
    if (!result.ok) {
      showFailure(result.reason === "checksum" ? "importBadChecksum" : "importBadFormat");
      return;
    }

    // Asked every time, not only for the files that cannot be loaded as they are: an import is
    // the one control besides the wipe that ends the run in progress, and the player reaching
    // for it has usually just been looking at a file picker rather than at their board.
    const lang = currentLang(state);
    const question = result.reset
      ? (lang === "en"
        ? `This file is from version ${result.fromVersion} and cannot be loaded as it is. Importing it starts a FRESH game, and your current run is lost. Continue?`
        : `Diese Datei stammt aus Version ${result.fromVersion} und kann nicht so geladen werden. Der Import startet ein NEUES Spiel, dein laufender Spielstand geht verloren. Fortfahren?`)
      : (lang === "en"
        ? "Importing replaces your current run with the one in the file. Continue?"
        : "Der Import ersetzt deinen laufenden Spielstand durch den aus der Datei. Fortfahren?");

    if (!confirm(question)) {
      showFailure("importCancelled");
      return;
    }

    state = result.state;
    // The redeemed code came in with the file, so a message about one typed into the run being
    // replaced would be standing over a bar that is no longer the one it answered.
    redeemStatusKey = null;
    // Every render cache is keyed on the old state, and a different board can hash to the same
    // signature - the language above all, which would leave an English file drawn in German.
    // Cleared, so the next updateUI redraws the page from nothing.
    for (const key of Object.keys(renderCache)) renderCache[key] = null;

    setSaveStatus(result.reset ? "importReset" : "importOk", result.reset ? "bad" : "ok", { version: result.fromVersion });
    addLog(state, template(locale(state).saveImported, {
      round: state.round.number,
      wave: state.round.wavesResolved
    }));
    updateUI(state);
    // Written through at once rather than waiting for the autosave: a player who imports and
    // closes the tab within ten seconds should not find the old run still sitting there.
    persist();
  }, () => showFailure("importBadFormat"));
});

dom.wipeSaveBtn.addEventListener("click", () => {
  const langBeforeWipe = currentLang(state);
  const ok = confirm(
    langBeforeWipe === "en"
      ? "This deletes your local Spirit Idland save. Continue?"
      : "Dadurch wird dein lokaler Spirit-Idland-Spielstand geloescht. Fortfahren?"
  );
  if (!ok) return;

  // The one destructive control on the page, and fixture mode reaches it too now that the
  // fixture is a mode of this page. It must not be able to wipe a save it cannot even write.
  if (!FIXTURE_MODE) localStorage.removeItem(SAVE_KEY);
  state = createFreshGameState();
  state.ui.language = langBeforeWipe;
  // A wipe takes the redeemed code with it, so the message about it must go too - it would
  // otherwise stand over a bar whose tools are gone. The import message goes for the same
  // reason: it reports on a run that no longer exists.
  redeemStatusKey = null;
  setSaveStatus(null);
  addLog(state, locale(state).saveWiped);
  updateUI(state);
});

/* ------------------------------------------------------------------ *
 * The clock                                                            *
 * ------------------------------------------------------------------ */

let lastTick = nowMs();
let saveAccumulator = 0;

// Not started in fixture mode. The board vis.js authored has a wave most of the way in and a
// city one hit from falling; a running clock would spend both before the page finished
// painting, and every screenshot of it would be of a different board.
if (!FIXTURE_MODE) setInterval(() => {
  const now = nowMs();
  // Browsers throttle background tabs to roughly one tick per second, so the cap inside
  // tick() has to sit well above that. It still guards against a huge jump after sleep.
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  tick(state, dt);
  updateUI(state);

  saveAccumulator += dt;
  if (saveAccumulator >= 10) {
    saveAccumulator = 0;
    persist();
  }
}, 100);

window.addEventListener("beforeunload", () => {
  persist();
});
