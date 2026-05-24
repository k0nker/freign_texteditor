"use strict";

const TILE_SIZE = 48;
const WALL_COLOR = "#6a4a2c";
const WALL_BORDER_COLOR = "rgba(16, 12, 8, 0.96)";
const STORAGE_KEY = "frmapper.savedMap.v1";
const TRAIL_FADE_MS = 650;
const DEFAULT_SCAN_DISTANCE = 3;
const SECTOR_ORDER = [
  "inside",
  "city",
  "field",
  "forest",
  "hills",
  "mountain",
  "water_swim",
  "water_noswim",
  "underwater",
  "air",
  "desert",
  "dungeon"
];

const SECTOR_ALIASES = {
  indoors: "inside",
  indoor: "inside",
  town: "city",
  plains: "field",
  swamp: "field",
  hill: "hills",
  mountains: "mountain",
  water: "water_swim",
  waterswim: "water_swim",
  waternoswim: "water_noswim",
  water_no_swim: "water_noswim",
  water_noswimming: "water_noswim",
  no_swim: "water_noswim",
  under_water: "underwater",
  sky: "air",
  cave: "dungeon",
  caves: "dungeon"
};

const DIRECTION_VECTORS = {
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: -1, dy: 0 }
};

const OPPOSITE_DIRECTIONS = {
  n: "s",
  e: "w",
  s: "n",
  w: "e"
};

const DIRECTION_ALIASES = {
  north: "n",
  east: "e",
  south: "s",
  west: "w",
  up: "u",
  down: "d",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw"
};

const state = {
  mapData: { version: "frmapper.v1", meta: {}, rooms: [] },
  roomsById: new Map(),
  roomByCoord: new Map(),
  roomIndexById: new Map(),
  selectedRoomId: null,
  activeGridId: "",
  zLevels: [0],
  activeZ: 0,
  zoom: 1,
  panX: 100,
  panY: 100,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  panStartX: 0,
  panStartY: 0,
  isEmbedMode: false,
  contextRoomId: null,
  resizeObserver: null,
  resizePassTimer: 0,
  renderRafId: 0,
  persistTimer: 0,
  persistIdleId: 0,
  gridOptionsKey: "",
  zOptionsKey: "",
  isSafari: false,
  showParty: true,
  showMobHints: true,
  scanDistance: DEFAULT_SCAN_DISTANCE,
  sectorIcons: new Map(),
  playerLocation: null,
  playerRoomId: null,
  partyMembers: [],
  roomMobs: [],
  movementTrail: [],
  animation: {
    active: false,
    lineOnly: false,
    rafId: 0,
    startedAt: 0,
    durationMs: 250,
    fromPanX: 0,
    fromPanY: 0,
    toPanX: 0,
    toPanY: 0,
    effectRafId: 0,
    lastRenderTs: 0,
    fromCoord: null,
    toCoord: null
  }
};

const el = {
  embedToggle: document.getElementById("embed-toggle"),
  canvas: document.getElementById("map-canvas"),
  zoomRange: document.getElementById("zoom-range"),
  zoomValue: document.getElementById("zoom-value"),
  gridId: document.getElementById("grid-id"),
  zLevel: document.getElementById("z-level"),
  toggleParty: document.getElementById("toggle-party"),
  toggleMobs: document.getElementById("toggle-mobs"),
  roomInspector: document.getElementById("room-inspector"),
  fileInput: document.getElementById("file-input"),
  btnLoadSample: document.getElementById("btn-load-sample"),
  btnClearMap: document.getElementById("btn-clear-map"),
  btnExport: document.getElementById("btn-export"),
  contextMenu: document.getElementById("context-menu"),
  menuRemoveRoom: document.getElementById("menu-remove-room"),
  menuClearMap: document.getElementById("menu-clear-map"),
  legend: document.getElementById("legend")
};

const ctx = el.canvas.getContext("2d");

async function init() {
  state.isSafari = detectSafari();
  setupEmbedMode();
  await loadSectorIcons();
  buildLegend();
  wireEvents();
  requestCanvasResizePass();
  const loadedPersisted = loadPersistedMap();
  if (!loadedPersisted) resetToEmptyMap();
  // Session view is intentionally not persisted: always start at 100% zoom.
  fitToView({ zoom: 1 });
  render();
}

function setupEmbedMode() {
  const params = new URLSearchParams(window.location.search || "");
  const embed = params.get("embed");
  const isEmbed = embed === "1" || embed === "true" || embed === "yes";
  state.isEmbedMode = isEmbed;
  if (!isEmbed || !el.embedToggle) return;

  document.body.classList.add("embed-mode");
  document.body.classList.remove("controls-expanded");

  el.embedToggle.hidden = false;
  applyEmbedToggleState(false);
  el.embedToggle.addEventListener("click", () => {
    const expanded = document.body.classList.toggle("controls-expanded");
    applyEmbedToggleState(expanded);
  });
}

function applyEmbedToggleState(expanded) {
  if (!el.embedToggle) return;
  el.embedToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  el.embedToggle.setAttribute("title", expanded ? "Hide mapper controls" : "Show mapper controls");
  el.embedToggle.setAttribute("aria-label", expanded ? "Hide mapper controls" : "Show mapper controls");
}

function wireEvents() {
  window.addEventListener("resize", requestCanvasResizePass);
  window.addEventListener("pagehide", () => persistMap());
  window.addEventListener("beforeunload", () => persistMap());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistMap();
  });

  if (typeof ResizeObserver !== "undefined" && !state.resizeObserver) {
    state.resizeObserver = new ResizeObserver(() => requestCanvasResizePass());
    if (el.canvas && el.canvas.parentElement) {
      state.resizeObserver.observe(el.canvas.parentElement);
    }
    state.resizeObserver.observe(el.canvas);
    if (document.body) {
      state.resizeObserver.observe(document.body);
    }
    if (document.documentElement) {
      state.resizeObserver.observe(document.documentElement);
    }
  }

  el.zoomRange.addEventListener("input", () => {
    const minZoom = getMinZoomForActiveGrid();
    state.zoom = clampZoom(Number.parseFloat(el.zoomRange.value) || 1, minZoom);
    el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    scheduleRender();
  });

  if (el.gridId) {
    el.gridId.addEventListener("change", () => {
      state.activeGridId = normalizeGridId(el.gridId.value);
      syncZLevels();
      fitToView();
      scheduleRender();
    });
  }

  el.zLevel.addEventListener("change", () => {
    state.activeZ = Number.parseInt(el.zLevel.value, 10);
    state.selectedRoomId = null;
    updateInspector();
    scheduleRender();
  });

  if (el.toggleParty) {
    el.toggleParty.addEventListener("change", () => {
      state.showParty = !!el.toggleParty.checked;
      scheduleRender();
    });
  }

  if (el.toggleMobs) {
    el.toggleMobs.addEventListener("change", () => {
      state.showMobHints = !!el.toggleMobs.checked;
      scheduleRender();
    });
  }

  el.fileInput.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.files || !input.files[0]) return;
    const text = await input.files[0].text();
    applyMapJson(text, `Loaded ${input.files[0].name}`);
    input.value = "";
  });

  el.btnLoadSample.addEventListener("click", loadSample);
  el.btnClearMap.addEventListener("click", clearMapWithConfirmation);
  el.btnExport.addEventListener("click", exportMap);

  el.canvas.addEventListener("mousedown", (event) => {
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.panStartX = state.panX;
    state.panStartY = state.panY;
    el.canvas.classList.add("dragging");
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.dragStartX;
    const dy = event.clientY - state.dragStartY;
    state.panX = state.panStartX + dx;
    state.panY = state.panStartY + dy;
    scheduleRender();
  });

  window.addEventListener("mouseup", () => {
    state.dragging = false;
    el.canvas.classList.remove("dragging");
    scheduleRender();
  });

  el.canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = el.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = state.zoom;
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    const minZoom = getMinZoomForActiveGrid();
    const newZoom = clampZoom(oldZoom * factor, minZoom);
    if (newZoom === oldZoom) return;

    const worldX = (mouseX - state.panX) / oldZoom;
    const worldY = (mouseY - state.panY) / oldZoom;

    state.zoom = newZoom;
    state.panX = mouseX - worldX * newZoom;
    state.panY = mouseY - worldY * newZoom;

    el.zoomRange.value = String(newZoom);
    el.zoomValue.textContent = `${Math.round(newZoom * 100)}%`;
    scheduleRender();
  }, { passive: false });

  el.canvas.addEventListener("click", (event) => {
    hideContextMenu();
    const room = pickRoomAt(event.clientX, event.clientY);
    state.selectedRoomId = room ? room.id : null;
    updateInspector();
    scheduleRender();
  });

  el.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const room = pickRoomAt(event.clientX, event.clientY);
    showContextMenu(event.clientX, event.clientY, room ? room.id : null);
  });

  window.addEventListener("click", (event) => {
    if (!el.contextMenu || el.contextMenu.hidden) return;
    if (!el.contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
    }
  });

  el.menuRemoveRoom.addEventListener("click", () => {
    const roomId = state.contextRoomId;
    hideContextMenu();
    if (!roomId) return;
    removeRoomById(roomId);
  });

  el.menuClearMap.addEventListener("click", () => {
    hideContextMenu();
    clearMapWithConfirmation();
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "frmapper.loadSnapshot" && msg.payload) {
      applyMapObject(msg.payload, "Snapshot loaded via postMessage");
    }
    if (msg.type === "frmapper.loadRoomInfoSnapshot" && msg.payload) {
      applyRoomInfoSnapshot(msg.payload);
    }
    if (msg.type === "frmapper.upsertRoom" && msg.payload) {
      upsertRoom(msg.payload);
      schedulePersistMap();
      scheduleRender();
    }
    if (msg.type === "frmapper.ingestRoomInfo" && msg.payload) {
      ingestRoomInfo(msg.payload.roomInfo, msg.payload.durationMs);
    }
    if (msg.type === "frmapper.setPlayerLocation" && msg.payload) {
      setPlayerLocationPayload(msg.payload);
    }
    if (msg.type === "frmapper.groupInfo" && msg.payload) {
      updatePartyFromGroupInfo(msg.payload);
    }
    if (msg.type === "frmapper.roomMobs" && msg.payload) {
      updateRoomMobs(msg.payload);
    }
    if (msg.type === "frmapper.centerOn" && msg.payload) {
      centerOnPayload(msg.payload);
    }
    if (msg.type === "frmapper.moveTo" && msg.payload) {
      moveToPayload(msg.payload);
    }
    if (msg.type === "frmapper.resize") {
      requestCanvasResizePass();
    }
  });
}

function requestCanvasResizePass() {
  resizeCanvas();
  window.requestAnimationFrame(() => resizeCanvas());
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => resizeCanvas());
  });
  if (state.resizePassTimer) {
    window.clearTimeout(state.resizePassTimer);
  }
  state.resizePassTimer = window.setTimeout(() => {
    resizeCanvas();
    state.resizePassTimer = 0;
  }, 180);
}

function showContextMenu(clientX, clientY, roomId) {
  if (!el.contextMenu || !el.menuRemoveRoom) return;
  const canvasRect = el.canvas.getBoundingClientRect();

  el.contextMenu.hidden = false;
  const menuRect = el.contextMenu.getBoundingClientRect();

  const localX = clientX - canvasRect.left;
  const localY = clientY - canvasRect.top;
  const maxX = Math.max(6, canvasRect.width - menuRect.width - 6);
  const maxY = Math.max(6, canvasRect.height - menuRect.height - 6);
  const left = Math.max(6, Math.min(maxX, localX));
  const top = Math.max(6, Math.min(maxY, localY));

  state.contextRoomId = roomId || null;
  el.menuRemoveRoom.disabled = !state.contextRoomId;
  el.contextMenu.style.left = `${left}px`;
  el.contextMenu.style.top = `${top}px`;
}

function hideContextMenu() {
  if (!el.contextMenu) return;
  el.contextMenu.hidden = true;
  state.contextRoomId = null;
}

function resetToEmptyMap() {
  state.mapData = { version: "frmapper.v1", meta: {}, rooms: [] };
  state.playerLocation = null;
  state.movementTrail = [];
  state.selectedRoomId = null;
  rebuildIndexes();
  syncZLevels();
  fitToView();
  updateInspector();
  render();
}

function clearMapWithConfirmation() {
  const confirmA = window.confirm("Clear map data? This will remove all stored rooms.");
  if (!confirmA) return;
  const confirmB = window.confirm("Are you absolutely sure? This action cannot be undone.");
  if (!confirmB) return;

  resetToEmptyMap();
  persistMap();
}

function removeRoomById(roomId) {
  const id = String(roomId || "");
  if (!id) return;

  const nextRooms = state.mapData.rooms.filter((room) => room.id !== id);
  if (nextRooms.length === state.mapData.rooms.length) return;

  for (const room of nextRooms) {
    for (const dir of Object.keys(room.exits || {})) {
      const ex = room.exits[dir];
      if (ex && String(ex.to || "") === id) {
        delete room.exits[dir];
      }
    }
  }

  state.mapData.rooms = nextRooms;
  if (state.selectedRoomId === id) state.selectedRoomId = null;
  if (state.playerLocation) {
    const playerKey = coordKey(
      state.playerLocation.x,
      state.playerLocation.y,
      state.playerLocation.z,
      state.playerLocation.gridId
    );
    const removedRoom = state.roomByCoord.get(playerKey);
    if (removedRoom === id) state.playerLocation = null;
  }

  rebuildIndexes();
  syncZLevels();
  updateInspector();
  persistMap();
  render();
}

function resizeCanvas() {
  const rect = el.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const ratio = window.devicePixelRatio || 1;
  el.canvas.width = Math.round(rect.width * ratio);
  el.canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;
  scheduleRender();
}

async function loadSectorIcons() {
  const loadPromises = SECTOR_ORDER.map((sector) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        state.sectorIcons.set(sector, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `./assets/sectors/${sector}.svg`;
    });
  });
  await Promise.all(loadPromises);
}

function buildLegend() {
  el.legend.innerHTML = "";
  for (const sector of SECTOR_ORDER) {
    const item = document.createElement("div");
    item.className = "legend-item";

    const img = document.createElement("img");
    img.src = `./assets/sectors/${sector}.svg`;
    img.alt = sector;

    const text = document.createElement("span");
    text.textContent = sector;

    item.appendChild(img);
    item.appendChild(text);
    el.legend.appendChild(item);
  }
}

async function loadSample() {
  try {
    const response = await fetch("./sample-map.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    applyMapJson(text, "Loaded sample-map.json");
  } catch (error) {
    console.error(error);
    alert("Could not load sample-map.json");
  }
}

function applyMapJson(text, _sourceLabel) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    alert("Invalid JSON file.");
    return;
  }
  applyMapObject(data);
}

function applyMapObject(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.rooms)) {
    alert("Map JSON must include a rooms array.");
    return;
  }

  state.mapData = {
    version: data.version || "frmapper.v1",
    meta: data.meta || {},
    rooms: data.rooms.map(normalizeRoom)
  };
  state.playerLocation = null;
  state.movementTrail = [];
  state.selectedRoomId = null;
  rebuildIndexes();
  syncZLevels();
  fitToView();
  updateInspector();
  persistMap();
  render();
}

function normalizeRoom(room) {
  const parsedScanRange = Number.parseInt(room.scanRange, 10);
  return {
    id: String(room.id),
    name: room.name ? String(room.name) : "",
    x: Number.parseInt(room.x, 10) || 0,
    y: Number.parseInt(room.y, 10) || 0,
    z: Number.parseInt(room.z, 10) || 0,
    gridId: normalizeGridId(room.gridId),
    sector: normalizeSector(room.sector),
    exits: normalizeExits(room.exits || {}),
    markers: normalizeMarkers(room.markers || {}),
    nearbyMobs: normalizeNearbyMobs(room.nearbyMobs || room.nearby_mobs || {}),
    scanRange: Number.isFinite(parsedScanRange) && parsedScanRange > 0 ? parsedScanRange : null,
    notes: room.notes ? String(room.notes) : ""
  };
}

function normalizeMarkers(markers) {
  return {
    trail: !!(markers && markers.trail),
    shop: !!(markers && markers.shop),
    bank: !!(markers && markers.bank),
    runegate: !!(markers && markers.runegate)
  };
}

function normalizeNearbyMobs(value) {
  const out = {};
  for (const key of Object.keys(value || {})) {
    const dir = normalizeDirectionToken(key);
    if (!dir) continue;
    const parsed = parseNearbyMobsEntry(value[key]);
    if (parsed.count <= 0) continue;
    out[dir] = parsed;
  }
  return out;
}

function parseNearbyMobsEntry(entry) {
  if (entry && typeof entry === "object") {
    const count = Number.parseInt(entry.count ?? entry.mobs ?? entry.total ?? 0, 10);
    const distance = Number.parseInt(entry.distance ?? entry.range ?? entry.scanRange ?? entry.scan_range ?? 0, 10);
    return {
      count: Number.isFinite(count) && count > 0 ? count : 0,
      distance: Number.isFinite(distance) && distance > 0 ? distance : null
    };
  }
  const count = Number.parseInt(entry, 10);
  return {
    count: Number.isFinite(count) && count > 0 ? count : 0,
    distance: null
  };
}

function normalizeGridId(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeExits(exits) {
  const out = {};
  for (const rawDir of Object.keys(exits || {})) {
    const dir = normalizeDirectionToken(rawDir);
    if (!dir) continue;
    const ex = exits[rawDir];
    if (!ex) continue;
    if (typeof ex === "string") {
      out[dir] = { to: ex, state: "open" };
      continue;
    }
    out[dir] = {
      to: String(ex.to || ""),
      state: ex.state ? String(ex.state).toLowerCase() : "open"
    };
  }
  return out;
}

function normalizeSector(rawSector) {
  const base = String(rawSector || "inside").trim().toLowerCase();
  if (!base) return "inside";
  if (SECTOR_ORDER.includes(base)) return base;

  const compact = base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (SECTOR_ORDER.includes(compact)) return compact;
  if (SECTOR_ALIASES[compact]) return SECTOR_ALIASES[compact];

  const squash = compact.replace(/_/g, "");
  if (SECTOR_ALIASES[squash]) return SECTOR_ALIASES[squash];
  return "inside";
}

function normalizeDirectionToken(dir) {
  const token = String(dir || "").trim().toLowerCase();
  if (!token) return "";
  if (["n", "e", "s", "w", "u", "d", "ne", "nw", "se", "sw"].includes(token)) return token;
  return DIRECTION_ALIASES[token] || "";
}

function roomFromRoomInfo(info) {
  if (!info || typeof info !== "object") return null;
  if (!info.coord || typeof info.coord !== "object") return null;

  const x = Number.parseInt(info.coord.x, 10);
  const y = -Number.parseInt(info.coord.y, 10);
  const z = Number.parseInt(info.coord.z, 10);
  const gridId = normalizeGridId(info.coord.gridId);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  let roomId = String(info.id || "").trim();
  if (!roomId) roomId = coordKey(x, y, z, gridId);

  const exits = {};
  if (Array.isArray(info.exits)) {
    for (const entry of info.exits) {
      const dir = normalizeDirectionToken(entry && entry.dir);
      if (!dir) continue;
      exits[dir] = {
        to: String(entry && entry.to ? entry.to : ""),
        state: entry && entry.locked ? "locked" : entry && entry.closed ? "closed" : "open"
      };
    }
  }

  return normalizeRoom({
    id: roomId,
    name: info.name,
    x,
    y,
    z,
    gridId,
    sector: info.terrain,
    exits,
    markers: info.markers || {},
    nearbyMobs: info.nearby_mobs || info.nearbyMobs || {},
    scanRange: info.scan_range ?? info.scanRange ?? info.scan_dist ?? info.scanDistance,
    notes: info.area ? `area=${String(info.area)}` : ""
  });
}

function applyRoomInfoSnapshot(payload) {
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  const durationMs = Math.max(50, Number.parseInt(payload.durationMs, 10) || 250);
  for (const info of rooms) {
    const parsed = roomFromRoomInfo(info);
    if (!parsed) continue;
    upsertRoom(parsed);
  }
  syncZLevels();
  schedulePersistMap();

  if (rooms.length > 0) {
    const latest = roomFromRoomInfo(rooms[rooms.length - 1]);
    if (latest) {
      setPlayerLocationPayload({
        roomId: latest.id,
        to: { x: latest.x, y: latest.y, z: latest.z, gridId: latest.gridId },
        durationMs
      });
      return;
    }
  }
  render();
}

function ingestRoomInfo(info, durationMs) {
  const room = roomFromRoomInfo(info);
  if (!room) return;
  upsertRoom(room);
  schedulePersistMap();
  setPlayerLocationPayload({
    roomId: room.id,
    to: { x: room.x, y: room.y, z: room.z, gridId: room.gridId },
    durationMs: Math.max(50, Number.parseInt(durationMs, 10) || 250)
  });
}

function updatePartyFromGroupInfo(payload) {
  const members = Array.isArray(payload && payload.members) ? payload.members : [];
  state.partyMembers = members.map((m) => {
    const roomId = String(m && m.room_id ? m.room_id : "");
    const coord = m && m.room_coord && typeof m.room_coord === "object" ? m.room_coord : null;
    return {
      name: String(m && m.name ? m.name : ""),
      roomId,
      coord: normalizeCoord(coord),
      isLeader: !!(m && m.is_leader)
    };
  });
  scheduleRender();
}

function updateRoomMobs(payload) {
  state.roomMobs = Array.isArray(payload && payload.mobs) ? payload.mobs : [];
  scheduleRender();
}

function upsertRoom(rawRoom) {
  const room = normalizeRoom(rawRoom);
  const index = state.roomIndexById.get(room.id);

  if (index !== undefined) {
    const prev = state.mapData.rooms[index];
    if (prev) {
      const prevKey = coordKey(prev.x, prev.y, prev.z, prev.gridId);
      const nextKey = coordKey(room.x, room.y, room.z, room.gridId);
      if (prevKey !== nextKey) {
        state.roomByCoord.delete(prevKey);
      }
    }
    state.mapData.rooms[index] = room;
  } else {
    const newIndex = state.mapData.rooms.length;
    state.mapData.rooms.push(room);
    state.roomIndexById.set(room.id, newIndex);
  }

  state.roomsById.set(room.id, room);
  state.roomByCoord.set(coordKey(room.x, room.y, room.z, room.gridId), room.id);
}

function rebuildIndexes() {
  state.roomsById.clear();
  state.roomByCoord.clear();
  state.roomIndexById.clear();

  for (let i = 0; i < state.mapData.rooms.length; i++) {
    const room = state.mapData.rooms[i];
    state.roomsById.set(room.id, room);
    state.roomByCoord.set(coordKey(room.x, room.y, room.z, room.gridId), room.id);
    state.roomIndexById.set(room.id, i);
  }
}

function syncZLevels() {
  const gridSet = new Set(state.mapData.rooms.map((r) => normalizeGridId(r.gridId)));
  const gridIds = Array.from(gridSet).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  let activeGrid = normalizeGridId(state.activeGridId);
  if (!gridSet.has(activeGrid) && gridIds.length > 0) {
    activeGrid = gridIds[0];
    state.activeGridId = activeGrid;
  }

  const gridKey = gridIds.join("|");
  if (el.gridId && gridKey !== state.gridOptionsKey) {
    el.gridId.innerHTML = "";
    for (const gridId of gridIds) {
      const option = document.createElement("option");
      option.value = String(gridId);
      option.textContent = String(gridId || "default");
      el.gridId.appendChild(option);
    }
    state.gridOptionsKey = gridKey;
  }
  if (el.gridId && el.gridId.value !== String(activeGrid)) {
    el.gridId.value = String(activeGrid);
  }

  const zSet = new Set(
    state.mapData.rooms
      .filter((r) => normalizeGridId(r.gridId) === activeGrid)
      .map((r) => r.z)
  );
  if (zSet.size === 0) zSet.add(0);
  state.zLevels = Array.from(zSet).sort((a, b) => a - b);
  if (!zSet.has(state.activeZ)) state.activeZ = state.zLevels[0];

  const zKey = state.zLevels.join("|");
  if (zKey !== state.zOptionsKey) {
    el.zLevel.innerHTML = "";
    for (const z of state.zLevels) {
      const option = document.createElement("option");
      option.value = String(z);
      option.textContent = `z=${z}`;
      if (z === state.activeZ) option.selected = true;
      el.zLevel.appendChild(option);
    }
    state.zOptionsKey = zKey;
  }
  if (el.zLevel.value !== String(state.activeZ)) {
    el.zLevel.value = String(state.activeZ);
  }

  const minZoom = getMinZoomForActiveGrid();
  if (el.zoomRange) {
    el.zoomRange.min = String(Math.max(0.05, Math.min(1, minZoom)));
    el.zoomRange.max = "3";
  }
  const clamped = clampZoom(state.zoom, minZoom);
  if (clamped !== state.zoom) {
    state.zoom = clamped;
    if (el.zoomRange) el.zoomRange.value = String(state.zoom);
    if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

function fitToView(options) {
  const opts = options || {};
  const activeGrid = normalizeGridId(state.activeGridId);
  const rooms = state.mapData.rooms.filter((r) => r.z === state.activeZ && normalizeGridId(r.gridId) === activeGrid);
  if (rooms.length === 0) {
    state.zoom = typeof opts.zoom === "number" ? opts.zoom : 1;
    if (el.zoomRange) el.zoomRange.value = String(state.zoom);
    if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    state.panX = 100;
    state.panY = 100;
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x);
    maxX = Math.max(maxX, room.x);
    minY = Math.min(minY, room.y);
    maxY = Math.max(maxY, room.y);
  }

  const rect = el.canvas.getBoundingClientRect();
  const fitZoom = computeFitZoomForRooms(rooms, rect.width, rect.height);
  const minZoom = Math.max(0.05, Math.min(1, fitZoom));
  const desiredZoom = Number.isFinite(opts.zoom)
    ? clampZoom(opts.zoom, minZoom)
    : clampZoom(state.zoom, minZoom);

  state.zoom = desiredZoom;
  if (el.zoomRange) el.zoomRange.value = String(state.zoom);
  if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;

  const centerWorldX = ((minX + maxX + 1) / 2) * TILE_SIZE;
  const centerWorldY = ((minY + maxY + 1) / 2) * TILE_SIZE;
  state.panX = rect.width / 2 - centerWorldX * state.zoom;
  state.panY = rect.height / 2 - centerWorldY * state.zoom;
}

function computeFitZoomForRooms(rooms, viewWidth, viewHeight) {
  if (!rooms || !rooms.length) return 1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x);
    maxX = Math.max(maxX, room.x);
    minY = Math.min(minY, room.y);
    maxY = Math.max(maxY, room.y);
  }

  const widthPx = Math.max(1, (maxX - minX + 1) * TILE_SIZE);
  const heightPx = Math.max(1, (maxY - minY + 1) * TILE_SIZE);
  const safeW = Math.max(40, Number(viewWidth) - 80);
  const safeH = Math.max(40, Number(viewHeight) - 80);
  const fit = Math.min(safeW / widthPx, safeH / heightPx);
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  return fit;
}

function getMinZoomForActiveGrid() {
  const activeGrid = normalizeGridId(state.activeGridId);
  const rooms = state.mapData.rooms.filter((r) => normalizeGridId(r.gridId) === activeGrid);
  if (!rooms.length) return 0.05;
  const rect = el.canvas.getBoundingClientRect();
  const fitZoom = computeFitZoomForRooms(rooms, rect.width, rect.height);
  return Math.max(0.05, Math.min(1, fitZoom));
}

function clampZoom(value, minZoom) {
  const min = Number.isFinite(minZoom) ? minZoom : 0.05;
  return Math.min(3, Math.max(min, value));
}

function render() {
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  ctx.restore();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const activeGrid = normalizeGridId(state.activeGridId);
  const gridRooms = state.mapData.rooms.filter((r) => normalizeGridId(r.gridId) === activeGrid);
  const rooms = gridRooms.filter((r) => r.z === state.activeZ);
  const lightMode = state.isSafari && (state.dragging || state.animation.active);
  const tilePx = TILE_SIZE * state.zoom;
  const viewW = el.canvas.clientWidth;
  const viewH = el.canvas.clientHeight;
  const visibleRooms = [];
  const visibleFadedRooms = [];
  const occupiedActive = new Set(rooms.map((r) => `${r.x}:${r.y}`));

  for (const room of rooms) {
    const sx = state.panX + room.x * tilePx;
    const sy = state.panY + room.y * tilePx;
    if (sx + tilePx < 0 || sy + tilePx < 0 || sx > viewW || sy > viewH) continue;
    visibleRooms.push(room);
  }

  if (!lightMode) {
    for (const room of gridRooms) {
      if (room.z === state.activeZ) continue;
      if (occupiedActive.has(`${room.x}:${room.y}`)) continue;
      const sx = state.panX + room.x * tilePx;
      const sy = state.panY + room.y * tilePx;
      if (sx + tilePx < 0 || sy + tilePx < 0 || sx > viewW || sy > viewH) continue;
      visibleFadedRooms.push(room);
    }
  }

  for (const room of visibleFadedRooms) {
    drawRoomTile(room, { alpha: 0.22, ghost: true });
  }

  for (const room of visibleRooms) {
    drawRoomTile(room);
  }

  if (!lightMode) {
    for (const room of visibleRooms) {
      drawTrailOverlay(room);
    }

    drawPartyOverlays(visibleRooms);
    drawMobHints(visibleRooms);
    drawGridOutline(rooms);
  }

  for (const room of visibleRooms) {
    drawRoomWallsAndDoors(room);
    drawExtraExitMarkers(room);
    if (!lightMode) drawRoomPoiMarkers(room);
  }

  drawActiveMoveLine();
}

function detectSafari() {
  const ua = String((navigator && navigator.userAgent) || "").toLowerCase();
  if (!ua.includes("safari")) return false;
  if (ua.includes("chrome") || ua.includes("crios") || ua.includes("fxios") || ua.includes("edg")) return false;
  return true;
}

function drawTrailOverlay(room) {
  if (!room.markers || !room.markers.trail) return;
  const tilePx = TILE_SIZE * state.zoom;
  const cx = state.panX + (room.x + 0.5) * tilePx;
  const cy = state.panY + (room.y + 0.5) * tilePx;

  ctx.strokeStyle = "rgba(184, 149, 90, 0.9)";
  ctx.lineWidth = Math.max(2, state.zoom * 2.2);
  ctx.lineCap = "round";

  let branchCount = 0;
  for (const dir of ["n", "e", "s", "w"]) {
    const vec = DIRECTION_VECTORS[dir];
    const neighborId = state.roomByCoord.get(coordKey(room.x + vec.dx, room.y + vec.dy, room.z, room.gridId));
    if (!neighborId) continue;
    const neighbor = state.roomsById.get(neighborId);
    if (!neighbor || !neighbor.markers || !neighbor.markers.trail) continue;

    const exit = room.exits[dir];
    const reverse = OPPOSITE_DIRECTIONS[dir];
    const nExit = reverse ? neighbor.exits[reverse] : null;
    if (!(isOpenPassageExit(exit, neighbor.id) || isOpenPassageExit(nExit, room.id))) continue;

    const ex = state.panX + (room.x + 0.5 + vec.dx * 0.5) * tilePx;
    const ey = state.panY + (room.y + 0.5 + vec.dy * 0.5) * tilePx;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    branchCount += 1;
  }

  if (branchCount === 0) {
    ctx.fillStyle = "rgba(184, 149, 90, 0.88)";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.8, state.zoom * 1.8), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoomPoiMarkers(room) {
  if (!room.markers) return;
  const markers = [];
  if (room.markers.shop) markers.push("shop");
  if (room.markers.bank) markers.push("bank");
  if (room.markers.runegate) markers.push("runegate");
  if (!markers.length) return;

  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const size = Math.max(5, state.zoom * 4.8);
  const step = size * 2 + 3;
  markers.forEach((kind, i) => {
    const cx = x + 5 + size + i * step;
    const cy = y + 5 + size;
    drawPoiMarker(kind, cx, cy, size);
  });
}

function drawPoiMarker(kind, cx, cy, size) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 236, 165, 0.8)";
  ctx.shadowBlur = Math.max(5, state.zoom * 6);

  ctx.fillStyle = "rgba(22, 28, 35, 0.92)";
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.2, state.zoom * 1.2);
  ctx.strokeStyle = "rgba(250, 224, 120, 0.95)";

  if (kind === "shop") {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === "bank") {
    // Moneybag icon.
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.5, cy + size * 0.35);
    ctx.quadraticCurveTo(cx - size * 0.55, cy - size * 0.15, cx, cy - size * 0.05);
    ctx.quadraticCurveTo(cx + size * 0.55, cy - size * 0.15, cx + size * 0.5, cy + size * 0.35);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2, cy - size * 0.18);
    ctx.lineTo(cx + size * 0.2, cy - size * 0.18);
    ctx.stroke();
  } else if (kind === "runegate") {
    // Archway icon.
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.45, cy + size * 0.35);
    ctx.lineTo(cx - size * 0.45, cy - size * 0.05);
    ctx.arc(cx, cy - size * 0.05, size * 0.45, Math.PI, 0);
    ctx.lineTo(cx + size * 0.45, cy + size * 0.35);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPartyOverlays(visibleRooms) {
  if (!state.showParty || !state.partyMembers.length) return;
  const visibleById = new Set(visibleRooms.map((r) => r.id));

  for (const member of state.partyMembers) {
    if (!member.roomId || member.roomId === state.playerRoomId) continue;
    const room = state.roomsById.get(member.roomId);
    if (!room) continue;

    const sameGrid = normalizeGridId(room.gridId) === normalizeGridId(state.activeGridId);
    if (!sameGrid) continue;

    if (room.z === state.activeZ && visibleById.has(room.id)) {
      drawPartyDot(room);
      continue;
    }

    const anchor = findVisibleExitAnchorToRoom(visibleRooms, room.id);
    if (anchor) {
      drawAnchorWaypoint(anchor.room, anchor.dir);
      continue;
    }

    drawOffscreenPartyWaypoint(room);
  }
}

function drawPartyDot(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx + tilePx * 0.5;
  const y = state.panY + room.y * tilePx + Math.max(3, state.zoom * 3);
  ctx.save();
  ctx.shadowColor = "rgba(230, 130, 230, 0.9)";
  ctx.shadowBlur = Math.max(5, state.zoom * 6);
  ctx.fillStyle = "rgba(220, 90, 220, 0.95)";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, state.zoom * 2.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function findVisibleExitAnchorToRoom(visibleRooms, targetRoomId) {
  for (const room of visibleRooms) {
    for (const dir of ["n", "e", "s", "w", "ne", "nw", "se", "sw", "u", "d"]) {
      const ex = room.exits[dir];
      if (ex && String(ex.to || "") === targetRoomId) {
        return { room, dir };
      }
    }
  }
  return null;
}

function drawAnchorWaypoint(room, dir) {
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const pad = Math.max(2, state.zoom * 2);
  const cx = x + tilePx * 0.5;
  const cy = y + tilePx * 0.5;
  const color = "rgba(220, 90, 220, 0.88)";

  if (dir === "n") drawTriangle(cx, y + pad, 0, color);
  else if (dir === "s") drawTriangle(cx, y + tilePx - pad, Math.PI, color);
  else if (dir === "e") drawTriangle(x + tilePx - pad, cy, Math.PI * 0.5, color);
  else if (dir === "w") drawTriangle(x + pad, cy, -Math.PI * 0.5, color);
  else drawTriangle(cx, y + pad, 0, color);
}

function drawOffscreenPartyWaypoint(room) {
  if (room.z !== state.activeZ) return;
  const rect = el.canvas.getBoundingClientRect();
  const tilePx = TILE_SIZE * state.zoom;
  const tx = state.panX + (room.x + 0.5) * tilePx;
  const ty = state.panY + (room.y + 0.5) * tilePx;
  const centerX = rect.width * 0.5;
  const centerY = rect.height * 0.5;
  const dx = tx - centerX;
  const dy = ty - centerY;
  const mag = Math.hypot(dx, dy) || 1;
  const nx = dx / mag;
  const ny = dy / mag;
  const edgeX = centerX + nx * (Math.min(rect.width, rect.height) * 0.45);
  const edgeY = centerY + ny * (Math.min(rect.width, rect.height) * 0.45);
  const ang = Math.atan2(ny, nx) + Math.PI * 0.5;
  drawTriangle(edgeX, edgeY, ang, "rgba(220, 90, 220, 0.88)");
}

function drawTriangle(x, y, angle, color) {
  const size = Math.max(4, state.zoom * 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.65, size * 0.7);
  ctx.lineTo(-size * 0.65, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMobHints(visibleRooms) {
  if (!state.showMobHints) return;
  const currentRoom = state.playerRoomId ? state.roomsById.get(state.playerRoomId) : null;
  if (!currentRoom || currentRoom.z !== state.activeZ) return;
  if (normalizeGridId(currentRoom.gridId) !== normalizeGridId(state.activeGridId)) return;

  const countsByRoom = new Map();
  const localMobs = Array.isArray(state.roomMobs) ? state.roomMobs.length : 0;
  if (localMobs > 0) countsByRoom.set(currentRoom.id, localMobs);

  const nearby = currentRoom.nearbyMobs || {};
  for (const dir of Object.keys(nearby)) {
    const parsed = parseNearbyMobsEntry(nearby[dir]);
    const count = Math.max(1, parsed.count || 1);
    const normDir = normalizeDirectionToken(dir);
    if (!normDir || !DIRECTION_VECTORS[normDir]) continue;
    const distance = Math.max(1, parsed.distance || resolveScanDistance(currentRoom));
    const targetId = findDirectionalScanRoomId(currentRoom, normDir, distance);
    if (!targetId) continue;
    countsByRoom.set(targetId, (countsByRoom.get(targetId) || 0) + count);
  }

  const visibleSet = new Set((visibleRooms || []).map((r) => r.id));
  countsByRoom.forEach((count, roomId) => {
    if (!visibleSet.has(roomId)) return;
    const room = state.roomsById.get(roomId);
    if (!room) return;
    drawMobDotsOnRoom(room, count);
  });
}

function resolveScanDistance(room) {
  const candidate = room && Number.isFinite(room.scanRange)
    ? Number.parseInt(room.scanRange, 10)
    : Number.parseInt(state.scanDistance, 10);
  if (Number.isFinite(candidate) && candidate > 0) return candidate;
  return DEFAULT_SCAN_DISTANCE;
}

function findDirectionalScanRoomId(originRoom, dir, distance) {
  const vec = DIRECTION_VECTORS[dir];
  if (!vec) return null;
  let current = originRoom;
  let lastId = null;
  const maxSteps = Math.max(1, Number.parseInt(distance, 10) || 1);

  for (let step = 0; step < maxSteps; step++) {
    const neighborId = state.roomByCoord.get(coordKey(
      current.x + vec.dx,
      current.y + vec.dy,
      current.z,
      current.gridId
    ));
    if (!neighborId) break;
    const neighbor = state.roomsById.get(neighborId);
    if (!neighbor) break;

    const exit = current.exits[dir];
    const reverse = OPPOSITE_DIRECTIONS[dir];
    const nExit = reverse ? neighbor.exits[reverse] : null;
    if (!(isOpenPassageExit(exit, neighbor.id) || isOpenPassageExit(nExit, current.id))) break;

    lastId = neighbor.id;
    current = neighbor;
  }
  return lastId;
}

function drawMobDotsOnRoom(room, mobCount) {
  const count = Math.max(1, Number.parseInt(mobCount, 10) || 1);
  const dots = Math.min(5, count);
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const r = Math.max(2.2, state.zoom * 2.2);
  const step = r * 2 + Math.max(1.5, state.zoom * 1.5);
  const startX = x + tilePx * 0.5 - ((dots - 1) * step) * 0.5;
  const dotY = y + Math.max(4, state.zoom * 4);
  const shadowScale = shouldReduceGlowEffects() ? 0.25 : 1;

  ctx.save();
  ctx.shadowColor = "rgba(255, 78, 170, 0.98)";
  ctx.shadowBlur = Math.max(1, Math.round(Math.max(10, state.zoom * 11) * shadowScale));
  ctx.fillStyle = "rgba(255, 72, 128, 0.98)";
  for (let i = 0; i < dots; i++) {
    const cx = startX + i * step;
    ctx.beginPath();
    ctx.arc(cx, dotY, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 184, 220, 0.86)";
    ctx.arc(cx, dotY, Math.max(1.1, r * 0.44), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 72, 128, 0.98)";
  }
  ctx.restore();

  if (count > dots) {
    ctx.fillStyle = "rgba(245, 225, 225, 0.95)";
    ctx.font = `${Math.max(8, Math.round(8 * state.zoom))}px monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText(`+${count - dots}`, startX + (dots - 1) * step + r + 2, dotY);
  }
}

function centerOnPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  const durationMs = Math.max(50, Number.parseInt(payload.durationMs, 10) || 250);
  const to = normalizeCoord(payload.to);
  let targetRoom = null;

  if (payload.roomId) {
    targetRoom = state.roomsById.get(String(payload.roomId)) || null;
  }
  if (!targetRoom && to) {
    const id = state.roomByCoord.get(coordKey(to.x, to.y, to.z, to.gridId));
    if (id) targetRoom = state.roomsById.get(id) || null;
  }
  if (!targetRoom) return;

  setActiveLayerFromRoom(targetRoom);
  const targetPan = panForRoom(targetRoom);
  startPanAnimation(targetPan.x, targetPan.y, durationMs, null, null);
}

function setPlayerLocationPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  const durationMs = Math.max(50, Number.parseInt(payload.durationMs, 10) || 250);
  const to = normalizeCoord(payload.to || payload);
  let targetRoom = null;

  if (payload.roomId) {
    targetRoom = state.roomsById.get(String(payload.roomId)) || null;
  }
  if (!targetRoom && to) {
    const id = state.roomByCoord.get(coordKey(to.x, to.y, to.z, to.gridId));
    if (id) targetRoom = state.roomsById.get(id) || null;
  }
  if (!targetRoom) return;

  const prior = state.playerLocation;
  const next = { x: targetRoom.x, y: targetRoom.y, z: targetRoom.z, gridId: normalizeGridId(targetRoom.gridId) };
  const moved = !!prior && (
    prior.x !== next.x ||
    prior.y !== next.y ||
    prior.z !== next.z ||
    normalizeGridId(prior.gridId) !== normalizeGridId(next.gridId)
  );

  state.playerLocation = next;
  state.playerRoomId = targetRoom.id;
  state.scanDistance = resolveScanDistance(targetRoom);
  if (!state.selectedRoomId) {
    state.selectedRoomId = targetRoom.id;
    updateInspector();
  }

  setActiveLayerFromRoom(targetRoom);
  const targetPan = panForRoom(targetRoom);
  if (moved) {
    addMovementTrail(prior, next);
  }
  startPanAnimation(targetPan.x, targetPan.y, durationMs, moved ? prior : null, moved ? next : null);
}

function moveToPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  const durationMs = Math.max(50, Number.parseInt(payload.durationMs, 10) || 250);
  const from = normalizeCoord(payload.from);
  const to = normalizeCoord(payload.to);
  let targetRoom = null;

  if (payload.roomId) {
    targetRoom = state.roomsById.get(String(payload.roomId)) || null;
  }
  if (!targetRoom && to) {
    const id = state.roomByCoord.get(coordKey(to.x, to.y, to.z, to.gridId));
    if (id) targetRoom = state.roomsById.get(id) || null;
  }
  if (!targetRoom) return;

  setActiveLayerFromRoom(targetRoom);
  const targetPan = panForRoom(targetRoom);
  startPanAnimation(targetPan.x, targetPan.y, durationMs, from, to);
}

function setActiveLayerFromRoom(room) {
  const nextGrid = normalizeGridId(room.gridId);
  const nextZ = room.z;
  const changed = nextGrid !== normalizeGridId(state.activeGridId) || nextZ !== state.activeZ;
  state.activeGridId = nextGrid;
  state.activeZ = nextZ;
  if (changed) {
    syncZLevels();
  }
}

function normalizeCoord(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number.parseInt(value.x, 10);
  const y = Number.parseInt(value.y, 10);
  const z = Number.parseInt(value.z, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z, gridId: normalizeGridId(value.gridId) };
}

function panForRoom(room) {
  const rect = el.canvas.getBoundingClientRect();
  const worldX = (room.x + 0.5) * TILE_SIZE;
  const worldY = (room.y + 0.5) * TILE_SIZE;
  return {
    x: rect.width / 2 - worldX * state.zoom,
    y: rect.height / 2 - worldY * state.zoom
  };
}

function startPanAnimation(targetX, targetY, durationMs, fromCoord, toCoord) {
  const anim = state.animation;
  if (anim.rafId) {
    cancelAnimationFrame(anim.rafId);
    anim.rafId = 0;
  }

  anim.active = true;
  anim.startedAt = performance.now();
  anim.durationMs = durationMs;
  anim.fromPanX = state.panX;
  anim.fromPanY = state.panY;
  anim.toPanX = targetX;
  anim.toPanY = targetY;
  anim.fromCoord = fromCoord || null;
  anim.toCoord = toCoord || null;
  ensureEffectsLoop();
}

function easeOutCubic(t) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function drawActiveMoveLine() {
  const tilePx = TILE_SIZE * state.zoom;
  const now = performance.now();

  for (const segment of state.movementTrail) {
    if (segment.from.z !== state.activeZ || segment.to.z !== state.activeZ) continue;
    if (normalizeGridId(segment.from.gridId) !== normalizeGridId(state.activeGridId)) continue;
    if (normalizeGridId(segment.to.gridId) !== normalizeGridId(state.activeGridId)) continue;
    const age = now - segment.createdAt;
    const alpha = Math.max(0, 1 - age / segment.fadeMs);
    if (alpha <= 0) continue;

    const x1 = state.panX + (segment.from.x + 0.5) * tilePx;
    const y1 = state.panY + (segment.from.y + 0.5) * tilePx;
    const x2 = state.panX + (segment.to.x + 0.5) * tilePx;
    const y2 = state.panY + (segment.to.y + 0.5) * tilePx;

    ctx.strokeStyle = `rgba(250, 231, 155, ${Math.min(0.92, alpha)})`;
    ctx.lineWidth = Math.max(2, state.zoom * 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  if (!state.playerLocation || state.playerLocation.z !== state.activeZ) return;
  if (normalizeGridId(state.playerLocation.gridId) !== normalizeGridId(state.activeGridId)) return;
  const hx = state.panX + (state.playerLocation.x + 0.5) * tilePx;
  const hy = state.panY + (state.playerLocation.y + 0.5) * tilePx;
  drawPlayerCenterIcon(hx, hy);
}

function drawPlayerCenterIcon(x, y) {
  const outerR = Math.max(5.5, state.zoom * 5.4);
  const innerR = Math.max(1.9, state.zoom * 1.9);
  const tickLen = Math.max(2.8, state.zoom * 2.8);
  const tickGap = Math.max(1.6, state.zoom * 1.6);
  const shadowScale = shouldReduceGlowEffects() ? 0.25 : 1;

  ctx.save();
  ctx.shadowColor = "rgba(128, 225, 255, 0.95)";
  ctx.shadowBlur = Math.max(1, Math.round(Math.max(8, state.zoom * 8.5) * shadowScale));

  // Outer ring.
  ctx.strokeStyle = "rgba(164, 241, 255, 0.98)";
  ctx.lineWidth = Math.max(1.4, state.zoom * 1.4);
  ctx.beginPath();
  ctx.arc(x, y, outerR, 0, Math.PI * 2);
  ctx.stroke();

  // Inner center dot.
  ctx.fillStyle = "rgba(200, 249, 255, 0.98)";
  ctx.beginPath();
  ctx.arc(x, y, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Crosshair ticks (GPS-style center marker).
  ctx.lineWidth = Math.max(1.2, state.zoom * 1.2);
  ctx.beginPath();
  ctx.moveTo(x, y - outerR - tickGap);
  ctx.lineTo(x, y - outerR - tickGap - tickLen);
  ctx.moveTo(x, y + outerR + tickGap);
  ctx.lineTo(x, y + outerR + tickGap + tickLen);
  ctx.moveTo(x - outerR - tickGap, y);
  ctx.lineTo(x - outerR - tickGap - tickLen, y);
  ctx.moveTo(x + outerR + tickGap, y);
  ctx.lineTo(x + outerR + tickGap + tickLen, y);
  ctx.stroke();

  ctx.restore();
}

function shouldReduceGlowEffects() {
  return state.isSafari && (state.dragging || state.animation.active);
}

function drawRoomTile(room, options) {
  const opts = options || {};
  const tilePx = TILE_SIZE * state.zoom;
  const screenX = state.panX + room.x * tilePx;
  const screenY = state.panY + room.y * tilePx;
  const alpha = typeof opts.alpha === "number" ? Math.max(0, Math.min(1, opts.alpha)) : 1;
  const ghost = !!opts.ghost;

  ctx.save();
  ctx.globalAlpha = alpha;

  const icon = state.sectorIcons.get(room.sector) || state.sectorIcons.get("inside");
  if (icon) {
    ctx.drawImage(icon, screenX, screenY, tilePx, tilePx);
  } else {
    ctx.fillStyle = "#1f2f3f";
    ctx.fillRect(screenX, screenY, tilePx, tilePx);
  }

  const isSelected = room.id === state.selectedRoomId;
  if (ghost) {
    ctx.strokeStyle = "rgba(220, 228, 238, 0.35)";
    ctx.lineWidth = Math.max(1, state.zoom * 0.9);
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, tilePx - 1, tilePx - 1);
  } else if (isSelected) {
    ctx.strokeStyle = "rgba(120, 205, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, tilePx - 1, tilePx - 1);
  }
  ctx.restore();
}

function drawRoomWallsAndDoors(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const line = Math.max(2.4, 2.4 * state.zoom);
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;

  const dirs = {
    n: { x1: x, y1: y, x2: x + tilePx, y2: y },
    e: { x1: x + tilePx, y1: y, x2: x + tilePx, y2: y + tilePx },
    s: { x1: x, y1: y + tilePx, x2: x + tilePx, y2: y + tilePx },
    w: { x1: x, y1: y, x2: x, y2: y + tilePx }
  };

  for (const dir of ["n", "e", "s", "w"]) {
    const exit = room.exits[dir];
    const wall = dirs[dir];
    const vec = DIRECTION_VECTORS[dir];
    const neighborId = state.roomByCoord.get(coordKey(room.x + vec.dx, room.y + vec.dy, room.z, room.gridId));
    const neighbor = neighborId ? state.roomsById.get(neighborId) : null;
    const reverseDir = OPPOSITE_DIRECTIONS[dir];
    const neighborExit = neighbor && reverseDir ? neighbor.exits[reverseDir] : null;

    const hasOpenPassage = isOpenPassageExit(exit, neighborId) || isOpenPassageExit(neighborExit, room.id);

    if (hasOpenPassage) {
      drawOpenExitMark(wall, line);
      continue;
    }

    const blockedExit = pickBlockedExitForEdge(exit, neighborExit, neighborId, room.id);

    if (!blockedExit) {
      drawWall(wall, line, WALL_COLOR);
      continue;
    }

    drawWall(wall, line, WALL_COLOR);
    drawDoorMark(wall, blockedExit.state, line);
  }
}

function isOpenPassageExit(exit, expectedToId) {
  if (!exit || exit.state === "closed" || exit.state === "locked") return false;
  const to = String(exit.to || "");
  if (!to) return true;
  return !expectedToId || to === expectedToId;
}

function pickBlockedExitForEdge(exit, neighborExit, expectedToId, thisRoomId) {
  if (exit && (exit.state === "closed" || exit.state === "locked")) {
    const to = String(exit.to || "");
    if (!to || !expectedToId || to === expectedToId) return exit;
  }
  if (neighborExit && (neighborExit.state === "closed" || neighborExit.state === "locked")) {
    const to = String(neighborExit.to || "");
    if (!to || !thisRoomId || to === thisRoomId) return neighborExit;
  }
  return null;
}

function drawWall(segment, lineWidth, color) {
  ctx.strokeStyle = WALL_BORDER_COLOR;
  ctx.lineWidth = lineWidth + Math.max(0.4, state.zoom * 0.4);
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
  ctx.stroke();
}

function drawDoorGap(segment, lineWidth) {
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = lineWidth;

  const isHorizontal = segment.y1 === segment.y2;
  const doorSpan = Math.abs((isHorizontal ? segment.x2 - segment.x1 : segment.y2 - segment.y1)) * 0.36;

  if (isHorizontal) {
    const mid = (segment.x1 + segment.x2) * 0.5;
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(mid - doorSpan * 0.5, segment.y1);
    ctx.moveTo(mid + doorSpan * 0.5, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  } else {
    const mid = (segment.y1 + segment.y2) * 0.5;
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x1, mid - doorSpan * 0.5);
    ctx.moveTo(segment.x1, mid + doorSpan * 0.5);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  }
}

function drawDoorMark(segment, stateLabel, lineWidth) {
  const isHorizontal = segment.y1 === segment.y2;
  const midX = (segment.x1 + segment.x2) * 0.5;
  const midY = (segment.y1 + segment.y2) * 0.5;
  const size = Math.max(6, 10 * state.zoom);

  ctx.strokeStyle = stateLabel === "locked" ? "#e06a62" : "#5d3d25";
  ctx.lineWidth = Math.max(1, lineWidth - 1);

  if (isHorizontal) {
    ctx.beginPath();
    ctx.moveTo(midX - size * 0.5, midY - size * 0.3);
    ctx.lineTo(midX + size * 0.5, midY - size * 0.3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(midX - size * 0.3, midY - size * 0.5);
    ctx.lineTo(midX - size * 0.3, midY + size * 0.5);
    ctx.stroke();
  }

  if (stateLabel === "locked") {
    ctx.beginPath();
    ctx.moveTo(midX - size * 0.2, midY - size * 0.2);
    ctx.lineTo(midX + size * 0.2, midY + size * 0.2);
    ctx.moveTo(midX + size * 0.2, midY - size * 0.2);
    ctx.lineTo(midX - size * 0.2, midY + size * 0.2);
    ctx.stroke();
  }
}

function drawOpenExitMark(segment, lineWidth) {
  const isHorizontal = segment.y1 === segment.y2;
  const midX = (segment.x1 + segment.x2) * 0.5;
  const midY = (segment.y1 + segment.y2) * 0.5;
  const span = Math.max(5, state.zoom * 6.5);

  ctx.strokeStyle = "rgba(248, 213, 110, 0.96)";
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.55);
  ctx.beginPath();
  if (isHorizontal) {
    ctx.moveTo(midX - span * 0.5, midY);
    ctx.lineTo(midX + span * 0.5, midY);
  } else {
    ctx.moveTo(midX, midY - span * 0.5);
    ctx.lineTo(midX, midY + span * 0.5);
  }
  ctx.stroke();
}

function drawExtraExitMarkers(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const midX = x + tilePx * 0.5;
  const midY = y + tilePx * 0.5;

  const diagonal = ["ne", "nw", "se", "sw"];
  let diagCount = 0;
  for (const dir of diagonal) {
    if (room.exits[dir]) diagCount += 1;
  }

  if (diagCount > 0) {
    ctx.fillStyle = "rgba(194, 225, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(midX, midY, Math.max(2, 3 * state.zoom), 0, Math.PI * 2);
    ctx.fill();
  }

  if (room.exits.u) {
    ctx.fillStyle = "#7ff0b0";
    ctx.beginPath();
    ctx.moveTo(midX, y + 6 * state.zoom);
    ctx.lineTo(midX - 5 * state.zoom, y + 14 * state.zoom);
    ctx.lineTo(midX + 5 * state.zoom, y + 14 * state.zoom);
    ctx.closePath();
    ctx.fill();
  }

  if (room.exits.d) {
    ctx.fillStyle = "#6fb8ff";
    ctx.beginPath();
    ctx.moveTo(midX, y + tilePx - 6 * state.zoom);
    ctx.lineTo(midX - 5 * state.zoom, y + tilePx - 14 * state.zoom);
    ctx.lineTo(midX + 5 * state.zoom, y + tilePx - 14 * state.zoom);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGridOutline(rooms) {
  if (rooms.length === 0) return;
  const tilePx = TILE_SIZE * state.zoom;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x);
    maxX = Math.max(maxX, room.x);
    minY = Math.min(minY, room.y);
    maxY = Math.max(maxY, room.y);
  }

  const x = state.panX + minX * tilePx;
  const y = state.panY + minY * tilePx;
  const width = (maxX - minX + 1) * tilePx;
  const height = (maxY - minY + 1) * tilePx;

  ctx.strokeStyle = "rgba(103, 126, 147, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function pickRoomAt(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const worldX = (x - state.panX) / state.zoom;
  const worldY = (y - state.panY) / state.zoom;
  const roomX = Math.floor(worldX / TILE_SIZE);
  const roomY = Math.floor(worldY / TILE_SIZE);

  const id = state.roomByCoord.get(coordKey(roomX, roomY, state.activeZ, state.activeGridId));
  if (!id) return null;
  return state.roomsById.get(id) || null;
}

function updateInspector() {
  if (!state.selectedRoomId) {
    el.roomInspector.textContent = "No room selected.";
    return;
  }

  const room = state.roomsById.get(state.selectedRoomId);
  if (!room) {
    el.roomInspector.textContent = "No room selected.";
    return;
  }

  const payload = {
    id: room.id,
    name: room.name,
    x: room.x,
    y: room.y,
    z: room.z,
    gridId: normalizeGridId(room.gridId),
    sector: room.sector,
    exits: room.exits,
    notes: room.notes || ""
  };

  el.roomInspector.textContent = JSON.stringify(payload, null, 2);
}

function exportMap() {
  const data = JSON.stringify(state.mapData, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "frmapper-export.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function persistMap() {
  if (state.persistTimer) {
    window.clearTimeout(state.persistTimer);
    state.persistTimer = 0;
  }
  if (state.persistIdleId && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(state.persistIdleId);
    state.persistIdleId = 0;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.mapData));
  } catch (_error) {
    // Ignore storage failures (private mode/quota).
  }
}

function schedulePersistMap() {
  if (state.persistTimer || state.persistIdleId) return;

  if (typeof window.requestIdleCallback === "function") {
    state.persistIdleId = window.requestIdleCallback(() => {
      state.persistIdleId = 0;
      persistMap();
    }, { timeout: 1800 });
    return;
  }

  state.persistTimer = window.setTimeout(() => {
    state.persistTimer = 0;
    persistMap();
  }, 1500);
}

function scheduleRender() {
  if (state.renderRafId) return;
  state.renderRafId = requestAnimationFrame(() => {
    state.renderRafId = 0;
    render();
  });
}

function loadPersistedMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rooms)) return false;
    applyMapObject(parsed);
    return true;
  } catch (_error) {
    return false;
  }
}

function addMovementTrail(from, to) {
  state.movementTrail.push({
    from: { x: from.x, y: from.y, z: from.z, gridId: normalizeGridId(from.gridId) },
    to: { x: to.x, y: to.y, z: to.z, gridId: normalizeGridId(to.gridId) },
    createdAt: performance.now(),
    fadeMs: TRAIL_FADE_MS
  });
  if (state.movementTrail.length > 128) {
    state.movementTrail.splice(0, state.movementTrail.length - 128);
  }
  ensureEffectsLoop();
}

function updatePanAnimation(now) {
  const anim = state.animation;
  if (!anim.active) return;
  const t = Math.max(0, Math.min(1, (now - anim.startedAt) / anim.durationMs));
  const eased = easeOutCubic(t);
  state.panX = anim.fromPanX + (anim.toPanX - anim.fromPanX) * eased;
  state.panY = anim.fromPanY + (anim.toPanY - anim.fromPanY) * eased;

  if (t >= 1) {
    anim.active = false;
    anim.fromCoord = null;
    anim.toCoord = null;
  }
}

function pruneMovementTrail(now) {
  state.movementTrail = state.movementTrail.filter((segment) => (now - segment.createdAt) < segment.fadeMs);
}

function ensureEffectsLoop() {
  const anim = state.animation;
  if (anim.effectRafId) return;

  const tick = (now) => {
    updatePanAnimation(now);
    pruneMovementTrail(now);
    const targetFrameMs = state.animation.active ? 33 : 16;
    if ((now - anim.lastRenderTs) >= targetFrameMs) {
      render();
      anim.lastRenderTs = now;
    }

    if (state.animation.active || state.movementTrail.length > 0) {
      anim.effectRafId = requestAnimationFrame(tick);
      return;
    }
    if ((performance.now() - anim.lastRenderTs) > 8) {
      render();
      anim.lastRenderTs = performance.now();
    }
    anim.effectRafId = 0;
  };

  anim.effectRafId = requestAnimationFrame(tick);
}

function isVisible(x, y, width, height) {
  const rect = el.canvas.getBoundingClientRect();
  return !(x + width < 0 || y + height < 0 || x > rect.width || y > rect.height);
}

function coordKey(x, y, z, gridId) {
  return `${x}:${y}:${z}:${normalizeGridId(gridId)}`;
}

init();
