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
  bestRoundLabel: document.getElementById("bestRoundLabel"),
  bestRoundValue: document.getElementById("bestRoundValue"),
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

  invaderTrackTitle: document.getElementById("invaderTrackTitle"),
  buildLabel: document.getElementById("buildLabel"),
  buildTerrain: document.getElementById("buildTerrain"),
  discoverLabel: document.getElementById("discoverLabel"),
  discoverTerrain: document.getElementById("discoverTerrain"),

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
  mapPlanHint: document.getElementById("mapPlanHint"),
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

  logTitle: document.getElementById("logTitle"),
  eventLog: document.getElementById("eventLog"),

  manualSaveBtn: document.getElementById("manualSaveBtn"),
  wipeSaveBtn: document.getElementById("wipeSaveBtn"),
  autosaveHint: document.getElementById("autosaveHint")
};

// What each renderer last drew. A render only reruns when its own signature changes, so
// the per-second HUD patch never rebuilds the board underneath a hover or a focus ring.
const renderCache = {
  language: null,
  map: null,
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
    group.appendChild(svgEl("path", {
      d: islandPathFor(landId),
      fill: "none",
      "data-role": "ring",
      stroke: "transparent",
      "stroke-width": "3",
      "stroke-linejoin": "round"
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
  out: { fill: 0.16, ring: "transparent", opacity: 0.4, chip: 0.32 }
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
  const stats = UNIT_STATS[unitType];
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
function chipWaveMarkup(state, landId) {
  if (state.pendingAbilityTarget) return "";
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
function chipMetersMarkup(state, landId) {
  if (state.pendingAbilityTarget) return "";
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
  const selected = effectiveSelectedLand(state);
  const defeatFx = activeDefeatFx(state);
  const blightFx = activeBlightFx(state);

  dom.landChips.innerHTML = "";

  for (const landId of LAND_IDS) {
    const style = LAND_STATE_STYLE[states[landId]] || LAND_STATE_STYLE.idle;
    const group = dom.islandSvg.querySelector(`[data-land="${landId}"]`);

    if (group) {
      group.setAttribute("opacity", String(style.opacity));
      group.querySelector('[data-role="fill"]').setAttribute("fill-opacity", String(style.fill));

      // A wave target keeps its own colour even while selected, so the selection ring can
      // never quietly hide which lands the invaders are about to hit.
      const isWaveTarget = states[landId] === "wave-active";
      const ring = group.querySelector('[data-role="ring"]');
      const strokeColour = isWaveTarget
        ? LAND_STATE_STYLE["wave-active"].ring
        : (landId === selected ? "#f7f1de" : style.ring);

      ring.setAttribute("stroke", strokeColour);
      ring.setAttribute("stroke-width", isWaveTarget ? "4" : (landId === selected ? "2.6" : "3"));
      group.classList.toggle("land-wave-target", isWaveTarget);
      group.classList.toggle("land-legal-target", states[landId] === "legal");
      group.classList.toggle("land-selected", landId === selected);
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
    const health = UNIT_STATS[type].health;
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

// What changes the bar's shape: which abilities are unlocked, and what tier the tiered ones
// stand at - a tier swaps the card's whole text and price, so it has to force a rebuild.
// Affordability is patched per frame rather than rebuilt.
function abilityBarSignature(state) {
  const tiers = spiritAbilityIds(state)
    .filter(abilityIsTiered)
    .map((id) => `${id}:${abilityTier(state, id)}`)
    .join(",");
  return [currentLang(state), unlockedAbilityIds(state).join(","), tiers].join("|");
}

// One unlocked ability: the pressable card, with the cooldown sweep behind its text.
function renderUnlockedAbility(state, abilityId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ability";
  button.setAttribute("data-ability", abilityId);
  button.innerHTML = `
    <span class="ability-sweep" data-role="sweep"></span>
    <span class="ability-body">
      <span class="ability-head">
        <span class="ability-name">${abilityName(state, abilityId)}</span>
        <span class="ability-state" data-role="state"></span>
      </span>
      <span class="ability-text">${abilityText(state, abilityId)}</span>
    </span>
  `;
  return button;
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

  // Both prices in the bar answer the same question - can I afford this yet - so they are
  // patched the same way, and the card wears the answer as a warm border either way.
  for (const button of dom.abilityBar.querySelectorAll("[data-unlock-ability], [data-upgrade-ability]")) {
    const unlockId = button.getAttribute("data-unlock-ability");
    const cost = unlockId
      ? abilityUnlockCost(state, unlockId)
      : abilityUpgradeCost(state, button.getAttribute("data-upgrade-ability"));
    const affordable = state.resources.energy >= cost;
    button.disabled = !affordable;
    button.closest(".ability").classList.toggle("is-affordable", affordable);
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
    button.disabled = state.round.status !== "running" || (!ready && !armed);

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

function shopSignature(state) {
  const tiers = UPGRADE_IDS.map((id) => `${id}:${upgradeTier(state, id)}`).join(",");
  return [currentLang(state), state.round.status, state.round.number, formatFear(state.meta.fear), tiers].join("|");
}

function renderShop(state) {
  const t = locale(state);
  const ended = state.round.status === "ended";

  dom.shopPanel.hidden = !ended;
  if (!ended) return;

  dom.shopSummary.textContent = template(t.shopLostRound, {
    round: state.round.number,
    fear: formatFear(state.round.fearEarned)
  });
  dom.shopFearValue.textContent = formatFear(state.meta.fear);

  dom.upgradeList.innerHTML = "";
  // The registry is ordered repeatables first, one-offs after, so the list only has to notice
  // where the two halves meet rather than sort anything itself.
  let seenOneOff = false;

  for (const upgradeId of UPGRADE_IDS) {
    const repeatable = Boolean((UPGRADES[upgradeId] || {}).repeatable);
    const tier = upgradeTier(state, upgradeId);
    const maxed = tier >= upgradeMaxTier(upgradeId);
    const cost = upgradeCost(state, upgradeId);
    const affordable = !maxed && state.meta.fear >= cost;

    if (!repeatable && !seenOneOff) {
      seenOneOff = true;
      const rule = document.createElement("div");
      rule.className = "upgrade-divider";
      rule.textContent = t.shopOneOffLabel;
      dom.upgradeList.appendChild(rule);
    }

    // A one-off has no ladder, so it shows nothing where a tier would go and reads "Owned"
    // rather than "Maxed" once it is bought.
    const status = repeatable
      ? `<span class="upgrade-tier">${template(t.shopTierLabel, { tier })}</span>`
      : "";
    const buyLabel = maxed
      ? (repeatable ? t.shopMaxedBtn : t.shopOwnedBtn)
      : template(t.shopCostLabel, { cost });

    const row = document.createElement("div");
    row.className = `upgrade${affordable ? " is-affordable" : ""}${repeatable ? "" : " is-one-off"}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <span class="upgrade-name">${upgradeName(state, upgradeId)}</span>
        <span class="upgrade-text">${upgradeText(state, upgradeId)}</span>
        ${status}
      </div>
      <button type="button" class="upgrade-buy" data-upgrade="${upgradeId}" ${maxed || !affordable ? "disabled" : ""}>
        ${buyLabel}
      </button>
    `;
    dom.upgradeList.appendChild(row);
  }
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
  dom.bestRoundValue.textContent = String(state.meta.bestRoundReached);
  dom.fearValue.textContent = formatFear(state.meta.fear);
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

  dom.buildTerrain.textContent = terrainName(state, state.invader.build);
  dom.discoverTerrain.textContent = terrainName(state, state.invader.explore);

  document.body.classList.toggle("round-ended", !running);
}

// The two pacing controls, patched together because they are read together: how fast the
// round is allowed to run, and whether it is allowed to run on without being asked. Both wear
// their state rather than describing it - the chosen scale is the lit button, and the toggle
// says what it is, not what it would do.
function patchPacingControls(state) {
  const t = locale(state);
  const speed = gameSpeed(state);

  for (const button of dom.speedGroup.querySelectorAll("[data-game-speed]")) {
    const value = Number(button.getAttribute("data-game-speed"));
    const active = value === speed;
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
}

function patchMapHint(state) {
  const t = locale(state);
  const armed = state.pendingAbilityTarget;

  if (armed) {
    dom.mapPlanHint.textContent = template(t.mapHintArmed, {
      ability: abilityName(state, armed),
      requirement: abilityRequirementText(state, armed)
    });
    return;
  }

  const pending = waveLands(state);
  if (state.round.status === "running" && pending.length > 0) {
    dom.mapPlanHint.textContent = template(t.mapHintWave, {
      terrain: terrainName(state, state.invader.build),
      lands: pending.map((id) => template(t.landShort, { id })).join(", ")
    });
    return;
  }

  dom.mapPlanHint.textContent = t.mapPlanHint;
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
  dom.bestRoundLabel.textContent = t.bestRoundLabel;
  dom.blightLabel.textContent = t.blightLabel;
  dom.waveLabel.textContent = t.waveLabel;
  dom.fearLabel.textContent = t.fearLabel;

  dom.invaderTrackTitle.textContent = t.invaderTrackTitle;
  dom.buildLabel.textContent = t.buildLabel;
  dom.discoverLabel.textContent = t.discoverLabel;
  dom.dahanAttackLabel.textContent = t.dahanAttackLabel;

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
  dom.wipeSaveBtn.textContent = t.wipeSaveBtn;
  dom.autosaveHint.textContent = t.autosaveHint;
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
  patchMapHint(state);

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
  purchaseUpgrade(state, button.getAttribute("data-upgrade") || "");
  updateUI(state);
  persist();
});

dom.startNextRoundBtn.addEventListener("click", () => {
  startNextRound(state);
  updateUI(state);
  persist();
});

dom.manualSaveBtn.addEventListener("click", () => {
  persist();
  addLog(state, locale(state).manualSaved);
  updateUI(state);
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
