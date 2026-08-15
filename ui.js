/* ==================================================================== *
 * Spirit Idland - view layer                                            *
 *                                                                       *
 * Everything that touches the DOM. It reads state and calls the engine;  *
 * it never decides a rule. Loaded after engine.js, which puts its        *
 * functions in the same classic-script scope.                           *
 *                                                                       *
 * Spec: docs/spec/06-ui-contract.md and 09-island-board.md.              *
 * ==================================================================== */

const dom = {
  languageToggleBtn: document.getElementById("languageToggleBtn"),
  speedGroup: document.getElementById("speedGroup"),
  speedLabel: document.getElementById("speedLabel"),
  autoWaveBtn: document.getElementById("autoWaveBtn"),
  startNextWaveBtn: document.getElementById("startNextWaveBtn"),

  roundLabel: document.getElementById("roundLabel"),
  roundValue: document.getElementById("roundValue"),
  bestWaveLabel: document.getElementById("bestWaveLabel"),
  bestWaveValue: document.getElementById("bestWaveValue"),
  blightLabel: document.getElementById("blightLabel"),
  blightValue: document.getElementById("blightValue"),
  blightFill: document.getElementById("blightFill"),
  waveLabel: document.getElementById("waveLabel"),
  waveValue: document.getElementById("waveValue"),
  waveFill: document.getElementById("waveFill"),
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
  playtestFearBtn: document.getElementById("playtestFearBtn")
};

// What each renderer last drew. A render only reruns when its own signature changes, so
// the per-second HUD patch never rebuilds the board underneath a hover or a focus ring.
const renderCache = {
  language: null,
  map: null,
  ladder: null,
  abilityBar: null,
  shop: null,
  log: null
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

    const blightHere = state.round.blightByLand[landId] || 0;
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
        ${blightHere > 0 ? `<span class="chip-blight-count" title="${t.landBlightLabel}">${blightHere}</span>` : ""}
      </div>
      ${invaderBits.length ? `<div class="chip-row invaders">${invaderBits.join("")}</div>` : ""}
      ${allyBits.length ? `<div class="chip-row allies">${allyBits.join("")}</div>` : ""}
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
  for (const el of dom.landChips.querySelectorAll("[data-meter-land]")) {
    const landId = el.getAttribute("data-meter-land");
    const kind = el.getAttribute("data-meter-kind");

    // Two shapes, two dials. Blight is a bar and fills by width as the round is lost; a
    // health ring is a conic sweep and drains by the registered property it is drawn from.
    if (kind === "blight") {
      el.style.width = `${clamp(landPressure(state, landId).blightProgress, 0, 1) * 100}%`;
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
}

/* ------------------------------------------------------------------ *
 * Land detail panel                                                    *
 * ------------------------------------------------------------------ */

function renderLandDetail(state) {
  const t = locale(state);
  const landId = effectiveSelectedLand(state);
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
  return [currentLang(state), unlockedAbilityIds(state).join(","), tiers, automations].join("|");
}

// The switch that says whether this ability's automation casts. Drawn only once the automation
// is owned, and drawn from then on forever: autoCastOwned reads the purchase rather than the
// round's snapshot, so the box appears the instant it is bought - already ticked, because a
// player who just paid for it should not have to click a second time - and never disappears.
//
// The input carries data-auto-cast and the label does not, so a click on the text reaches the
// bar's handler once, through the click the label synthesizes on the box itself.
function abilityAutoCastMarkup(state, abilityId) {
  if (!autoCastOwned(state, abilityId)) return "";
  const t = locale(state);
  return `
    <label class="ability-auto" title="${t.autoCastHint}">
      <input type="checkbox" data-auto-cast="${abilityId}">
      <span>${t.autoCastLabel}</span>
    </label>
  `;
}

// One unlocked ability: the pressable card, with the cooldown sweep behind its text.
//
// Two shapes, and which one it takes is the automation. Without one it stays the single button
// it has always been. With one it becomes the container the tiered card already is - a checkbox
// cannot live inside a button, which is the same wall renderTieredAbility hit - so the cast
// surface moves into a button of its own and the box sits in a foot beneath it.
function renderUnlockedAbility(state, abilityId) {
  const face = `
    <span class="ability-sweep" data-role="sweep"></span>
    <span class="ability-body">
      <span class="ability-head">
        <span class="ability-name">${abilityName(state, abilityId)}</span>
        <span class="ability-state" data-role="state"></span>
      </span>
      <span class="ability-text">${abilityText(state, abilityId)}</span>
    </span>
  `;

  const auto = abilityAutoCastMarkup(state, abilityId);
  if (!auto) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ability";
    button.setAttribute("data-ability", abilityId);
    button.innerHTML = face;
    return button;
  }

  const card = document.createElement("div");
  card.className = "ability is-automated";
  card.innerHTML = `
    <button type="button" class="ability-cast" data-ability="${abilityId}">${face}</button>
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
    <button type="button" class="ability-cast" data-ability="${abilityId}">
      <span class="ability-sweep" data-role="sweep"></span>
      <span class="ability-body">
        <span class="ability-head">
          <span class="ability-name">${abilityName(state, abilityId)}</span>
          <span class="ability-state" data-role="state"></span>
        </span>
        <span class="ability-text">${abilityText(state, abilityId)}</span>
      </span>
    </button>
    <span class="ability-foot">
      <span class="ability-tier">${template(t.abilityTierLabel, { tier: abilityTier(state, abilityId) + 1 })}</span>
      ${upgrade}
      ${abilityAutoCastMarkup(state, abilityId)}
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

  // Both prices in the bar answer the same question - can I afford this yet - so they are
  // patched the same way, and the card wears the answer as a warm border either way.
  for (const button of dom.abilityBar.querySelectorAll("[data-unlock-ability], [data-upgrade-ability]")) {
    const unlockId = button.getAttribute("data-unlock-ability");
    const cost = unlockId
      ? abilityUnlockCost(state, unlockId)
      : abilityUpgradeCost(state, button.getAttribute("data-upgrade-ability"));
    const affordable = running && state.resources.energy >= cost;
    button.disabled = !affordable;
    button.closest(".ability").classList.toggle("is-affordable", affordable);
  }

  // The one exception to the rule above: the checkbox stays live while the round is not
  // running. It spends nothing - no Energy, no cooldown, no Fear - and the shop between rounds
  // is exactly where a player decides how the next round should play, so deadening it would
  // take the setting away at the moment it is most wanted.
  //
  // Ticked-ness is patched here rather than rebuilt, like every other per-frame value.
  for (const box of dom.abilityBar.querySelectorAll("[data-auto-cast]")) {
    box.checked = state.ui.autoCast[box.getAttribute("data-auto-cast")] !== false;
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

    button.querySelector('[data-role="state"]').textContent = armed
      ? t.abilityArmed
      : (ready ? t.abilityReady : template(t.abilityCooldown, { seconds: displaySeconds(state, remaining) }));

    // The sweep drains left to right as the cooldown runs down, so "how long still" is
    // readable at a glance without reading the number.
    const pct = ready || full <= 0 ? 0 : Math.max(0, Math.min(100, (remaining / full) * 100));
    button.querySelector('[data-role="sweep"]').style.width = `${pct}%`;
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
function shopSignature(state) {
  const tiers = UPGRADE_IDS.map((id) => `${id}:${upgradeTier(state, id)}:${activeUpgradeTier(state, id)}`).join(",");
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
    autoStartRoundOwned(state),
    autoStartRoundOn(state),
    tiers
  ].join("|");
}

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

  function renderRow(upgradeId, soldOutRow) {
    const repeatable = Boolean((UPGRADES[upgradeId] || {}).repeatable);
    const tier = upgradeTier(state, upgradeId);
    const maxed = tier >= upgradeMaxTier(upgradeId);
    const cost = upgradeCost(state, upgradeId);
    // Behind the gate rather than behind the price: the row shows what it will cost, but
    // nothing about the purse opens it (see upgradeIsLocked).
    const locked = upgradeIsLocked(state, upgradeId);
    const affordable = !maxed && !locked && state.meta.fear >= cost;
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
    // Only one note per row, and the lock outranks the pending hint: a locked row cannot have
    // been bought, so the two can never both apply anyway.
    const lockedNote = locked ? `<span class="upgrade-locked">${t.shopLockedHint}</span>` : "";
    const buyLabel = maxed
      ? (repeatable ? t.shopMaxedBtn : t.shopOwnedBtn)
      : template(t.shopCostLabel, { cost });

    const row = document.createElement("div");
    row.className = `upgrade${affordable ? " is-affordable" : ""}${repeatable ? "" : " is-one-off"}${pending ? " is-pending" : ""}${locked ? " is-locked" : ""}${soldOutRow ? " is-sold-out" : ""}${upgradeIsPool(upgradeId) ? " is-pool" : ""}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <span class="upgrade-name">${upgradeName(state, upgradeId)}</span>
        <span class="upgrade-text">${upgradeText(state, upgradeId)}</span>
        ${status}
        ${lockedNote || pendingNote}
      </div>
      ${upgradeIsPool(upgradeId) ? poolButtons(state, upgradeId, maxed) : `
      <button type="button" class="upgrade-buy" data-upgrade="${upgradeId}" ${maxed || !affordable ? "disabled" : ""}>
        ${buyLabel}
      </button>`}
    `;
    dom.upgradeList.appendChild(row);
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
  const maxedId = (id) => upgradeTier(state, id) >= upgradeMaxTier(id);
  const buyable = UPGRADE_IDS.filter((id) => !maxedId(id));
  const soldOut = UPGRADE_IDS.filter(maxedId);

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
  // bought row reads as just another entry in the list you are still shopping from.
  if (soldOut.length) renderDivider(t.shopSoldOutLabel, "is-sold-out");
  for (const upgradeId of soldOut) renderRow(upgradeId, true);
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

  document.body.classList.toggle("round-ended", !running);
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

  const auto = autoProceedOn(state);
  dom.autoWaveBtn.textContent = auto ? t.autoWaveOnBtn : t.autoWaveOffBtn;
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
    dom.autoRoundBtn.textContent = autoRound ? t.autoRoundOnBtn : t.autoRoundOffBtn;
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
      state.round.blightByLand[landId]
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

  const nextAbilitySig = abilityBarSignature(state);
  if (renderCache.abilityBar !== nextAbilitySig) {
    renderAbilityBar(state);
    renderCache.abilityBar = nextAbilitySig;
  }
  patchAbilityBar(state);

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

  // Both prices are checked before the cast path. A locked card carries no data-ability at
  // all, but a tiered card carries both - its upgrade button sits beside the cast button, and
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

  // Ahead of the cast path too, and for the same reason: the box sits in the card's foot, and
  // the click that lands on it is not a click on the ability.
  //
  // The new value is read off the box rather than derived from autoCastOn, which is false for
  // an automation bought this round - deriving it would make the first click of a fresh
  // purchase a no-op that appears to un-tick itself.
  const autoBox = target.closest("[data-auto-cast]");
  if (autoBox) {
    setAutoCast(state, autoBox.getAttribute("data-auto-cast") || "", autoBox.checked === true);
    updateUI(state);
    persist();
    return;
  }

  const button = target.closest("[data-ability]");
  if (!button) return;
  triggerAbility(state, button.getAttribute("data-ability") || "");
  updateUI(state);
});

// A land click always selects. If an ability is armed and the land is legal, the same click
// also resolves it - one click, never two, and never an ambiguous one.
function selectLand(state, landId) {
  if (!isLandId(landId)) return;
  const armed = state.pendingAbilityTarget;
  state.ui.selectedLand = landId;
  if (armed && abilityLegalLand(state, armed, landId)) resolveAbilityTarget(state, landId);
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
