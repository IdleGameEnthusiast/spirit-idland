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
  waveCountLabel: document.getElementById("waveCountLabel"),
  waveCountValue: document.getElementById("waveCountValue"),
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

function unitGlyph(unitType, count) {
  return `<span class="chip-unit unit-${unitType}">${tokenIcon(unitType)}${count}</span>`;
}

function fmtSeconds(value) {
  return String(Math.max(0, Math.ceil(value)));
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
// the full width of the chip, and beside it a Dahan token that fills as its defenders near a
// casualty - the same reading in a fraction of the space, so the two never compete. Both fill
// continuously, so the fills themselves are written by patchLandMeters rather than baked in
// here - a bar rebuilt ten times a second could never animate.
function chipMetersMarkup(state, landId) {
  if (state.pendingAbilityTarget) return "";
  const p = landPressure(state, landId);
  if (p.gross <= 0) return "";

  const t = locale(state);
  const dahanMark = p.dahan > 0
    ? `
      <span class="chip-dahan-mark" title="${t.dahanBarLabel}">
        ${tokenIcon("dahan")}
        <span class="chip-dahan-fill" data-meter-land="${landId}" data-meter-kind="dahan">${tokenIcon("dahan")}</span>
      </span>
    `
    : "";

  return `
    <div class="chip-meters">
      <span class="chip-meter is-blight" title="${t.blightBarLabel}">
        <span class="chip-meter-fill" data-meter-land="${landId}" data-meter-kind="blight"></span>
      </span>
      ${dahanMark}
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
      if (counts[type]) invaderBits.push(unitGlyph(type, counts[type]));
    }

    const allyBits = [];
    if (state.dahan[landId]) allyBits.push(unitGlyph("dahan", state.dahan[landId]));

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
    const p = landPressure(state, landId);
    const value = el.getAttribute("data-meter-kind") === "dahan" ? p.dahanProgress : p.blightProgress;
    el.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
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

  const rows = [];
  for (const type of INVADER_TYPES) {
    if ((counts[type] || 0) <= 0) continue;
    const health = UNIT_STATS[type].health;
    const carry = Math.max(0, Math.floor(damageSlot[type] || 0));
    const hpHint = carry > 0 && health > 1
      ? `<span class="detail-hp">${template(t.invaderHpHint, { current: health - carry, max: health })}</span>`
      : "";
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

function abilityBarSignature(state) {
  return [currentLang(state), unlockedAbilityIds(state).join(",")].join("|");
}

function renderAbilityBar(state) {
  dom.abilityBar.innerHTML = "";

  for (const abilityId of unlockedAbilityIds(state)) {
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
    dom.abilityBar.appendChild(button);
  }
}

// Per-frame patch: state class, the countdown, and the sweep's width. No node is replaced.
function patchAbilityBar(state) {
  const t = locale(state);

  for (const button of dom.abilityBar.querySelectorAll("[data-ability]")) {
    const abilityId = button.getAttribute("data-ability");
    const slot = state.abilities[abilityId];
    if (!slot) continue;

    const full = abilityCooldownSeconds(state, abilityId);
    const remaining = slot.cooldownRemaining;
    const armed = state.pendingAbilityTarget === abilityId;
    const ready = remaining <= 0;

    button.classList.toggle("is-armed", armed);
    button.classList.toggle("is-ready", ready && !armed);
    button.classList.toggle("is-cooling", !ready);
    button.disabled = state.round.status !== "running" || (!ready && !armed);

    button.querySelector('[data-role="state"]').textContent = armed
      ? t.abilityArmed
      : (ready ? t.abilityReady : template(t.abilityCooldown, { seconds: fmtSeconds(remaining) }));

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
  for (const upgradeId of UPGRADE_IDS) {
    const tier = upgradeTier(state, upgradeId);
    const maxed = tier >= upgradeMaxTier(upgradeId);
    const cost = upgradeCost(state, upgradeId);
    const affordable = !maxed && state.meta.fear >= cost;

    const row = document.createElement("div");
    row.className = `upgrade${affordable ? " is-affordable" : ""}`;
    row.innerHTML = `
      <div class="upgrade-info">
        <span class="upgrade-name">${upgradeName(state, upgradeId)}</span>
        <span class="upgrade-text">${upgradeText(state, upgradeId)}</span>
        <span class="upgrade-tier">${template(t.shopTierLabel, { tier })}</span>
      </div>
      <button type="button" class="upgrade-buy" data-upgrade="${upgradeId}" ${maxed || !affordable ? "disabled" : ""}>
        ${maxed ? t.shopMaxedBtn : template(t.shopCostLabel, { cost })}
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

  dom.roundValue.textContent = String(state.round.number);
  dom.bestRoundValue.textContent = String(state.meta.bestRoundReached);
  dom.fearValue.textContent = formatFear(state.meta.fear);
  dom.waveCountValue.textContent = String(state.round.wavesResolved);

  dom.blightValue.textContent = template(t.blightMeter, {
    value: state.round.blight,
    max: state.round.blightThreshold
  });
  const blightPct = Math.min(100, (state.round.blight / state.round.blightThreshold) * 100);
  dom.blightFill.style.width = `${blightPct}%`;
  // The meter turns as the round turns: a round two thirds gone should look like one.
  dom.blightFill.classList.toggle("is-critical", blightPct >= 70);

  const running = state.round.status === "running";
  dom.waveValue.textContent = running
    ? template(t.secondsShort, { seconds: fmtSeconds(state.round.waveTimerRemaining) })
    : "-";
  dom.waveFill.style.width = running
    ? `${Math.max(0, Math.min(100, (state.round.waveTimerRemaining / WAVE_INTERVAL_SECONDS) * 100))}%`
    : "0%";

  // The Dahan swing on their own clock, so it gets its own countdown rather than being read
  // off the wave timer - the two will drift apart the moment the shop can shorten one.
  dom.dahanAttackValue.textContent = running
    ? template(t.secondsShort, { seconds: fmtSeconds(state.round.dahanAttackRemaining) })
    : "-";

  dom.buildTerrain.textContent = terrainName(state, state.invader.build);
  dom.discoverTerrain.textContent = terrainName(state, state.invader.explore);

  document.body.classList.toggle("round-ended", !running);
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
  dom.roundLabel.textContent = t.roundLabel;
  dom.bestRoundLabel.textContent = t.bestRoundLabel;
  dom.blightLabel.textContent = t.blightLabel;
  dom.waveLabel.textContent = t.waveLabel;
  dom.waveCountLabel.textContent = t.waveCountLabel;
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
      damage.explorers, damage.towns, damage.cities,
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

drawIslandOnce();
let state = loadState();
addLog(state, locale(state).spiritAwakens);
updateUI(state);

/* ------------------------------------------------------------------ *
 * Input                                                                *
 * ------------------------------------------------------------------ */

dom.languageToggleBtn.addEventListener("click", () => {
  state.ui.language = currentLang(state) === "de" ? "en" : "de";
  updateUI(state);
  saveState(state);
});

dom.abilityBar.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
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
  saveState(state);
});

dom.startNextRoundBtn.addEventListener("click", () => {
  startNextRound(state);
  updateUI(state);
  saveState(state);
});

dom.manualSaveBtn.addEventListener("click", () => {
  saveState(state);
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

  localStorage.removeItem(SAVE_KEY);
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

setInterval(() => {
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
    saveState(state);
  }
}, 100);

window.addEventListener("beforeunload", () => {
  saveState(state);
});
