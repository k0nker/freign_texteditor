"use strict";

const TILE_SIZE = 48;
const WALL_COLOR = "#6a4a2c";
const WALL_BORDER_COLOR = "rgba(16, 12, 8, 0.96)";
const STORAGE_KEY = "frmapper.savedMap.v1";
const TRAIL_DOT_HOLD_MS = 3000;
const TRAIL_DOT_FADE_MIN_MS = 2000;
const TRAIL_DOT_FADE_MAX_MS = 2000;
const FOG_STALE_START_MS = 8 * 60 * 1000;
const FOG_STALE_FULL_MS = 40 * 60 * 1000;
const TRAIL_SPRITE_SIZE = 64;
const DECOR_SPRITE_SIZE = 96;
const TRAIL_DIR_BITS = { n: 1, e: 2, s: 4, w: 8 };
const TRAIL_SPRITE_CACHE = new Map();
const MOB_DOT_SPRITE_CACHE = new Map();
const POI_SPRITE_CACHE = new Map();
const WATER_DROP_SPRITE_CACHE = new Map();
const PLAYER_CENTER_SPRITE_CACHE = new Map();
const EDGE_SPRITE_CACHE = new Map();
const EXTRA_EXIT_SPRITE_CACHE = new Map();
const ROOM_STATIC_SPRITE_CACHE = new Map();
const DEFAULT_SCAN_DISTANCE = 3;
const MOB_DOT_PALETTE = {
  glowInner: "rgba(255, 70, 70, 0.56)",
  glowOuter: "rgba(255, 20, 20, 0)",
  coreHighlight: "rgba(255, 125, 125, 0.98)",
  coreMid: "rgba(220, 40, 40, 0.98)",
  coreOuter: "rgba(126, 8, 8, 0.98)"
};
const PARTY_DOT_PALETTE = {
  glowInner: "rgba(146, 180, 255, 0.62)",
  glowOuter: "rgba(114, 140, 255, 0)",
  coreHighlight: "rgba(216, 228, 255, 0.99)",
  coreMid: "rgba(134, 120, 255, 0.99)",
  coreOuter: "rgba(72, 54, 184, 0.99)"
};
const TRAIL_DOT_PALETTE = {
  glowInner: "rgba(250, 231, 155, 0.42)",
  glowOuter: "rgba(250, 231, 155, 0)",
  coreHighlight: "rgba(255, 242, 192, 0.92)",
  coreMid: "rgba(226, 199, 108, 0.9)",
  coreOuter: "rgba(136, 109, 36, 0.86)"
};
const PARTY_NEON_COLOR = "rgba(150, 166, 255, 0.94)";
const PARTY_NEON_GLOW = "rgba(164, 150, 255, 0.97)";
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

const sessionParams = new URLSearchParams(window.location.search || "");
const sessionToken = sessionParams.get("session") || "";
const sessionRealm = sessionParams.get("realm") || "public";
const sessionMode = sessionToken ? "ws" : "embed";
const sessionWsUrl = buildSessionWsUrl(sessionToken, sessionRealm);

const state = {
  mapData: { version: "frmapper.v1", meta: {}, rooms: [] },
  roomsById: new Map(),
  roomByCoord: new Map(),
  roomIndexById: new Map(),
  roomsByGrid: new Map(),
  roomsByLayer: new Map(),
  roomCoordSetByLayer: new Map(),
  roomBoundsByGrid: new Map(),
  roomBoundsByLayer: new Map(),
  roomLayerIndexDirty: false,
  selectedRoomId: null,
  hoverRoomId: null,
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
  sessionToken,
  sessionRealm,
  sessionMode,
  sessionWsUrl,
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
  showTraveledPath: true,
  showFogOfWar: true,
  scanDistance: DEFAULT_SCAN_DISTANCE,
  sectorIcons: new Map(),
  playerLocation: null,
  playerRoomId: null,
  partyMembers: [],
  roomMobs: [],
  sessionSocket: null,
  sessionSocketState: "disconnected",
  sessionSocketReconnectTimer: 0,
  sessionReconnectAttempts: 0,
  sessionReconnectBaseMs: 1500,
  sessionReconnectMaxMs: 60000,
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

function connectSessionSocket() {
  if (!state.sessionWsUrl) return;
  if (state.sessionSocket && state.sessionSocket.readyState !== WebSocket.CLOSED) return;
  let socket;
  try {
    socket = new WebSocket(state.sessionWsUrl);
  } catch (error) {
    console.warn("frmapper websocket connection failed", error);
    scheduleSessionReconnect();
    return;
  }

  state.sessionSocket = socket;
  state.sessionSocketState = "connecting";

  socket.addEventListener("open", () => {
    state.sessionSocketState = "connected";
    state.sessionReconnectAttempts = 0;
    if (state.sessionSocketReconnectTimer) {
      window.clearTimeout(state.sessionSocketReconnectTimer);
      state.sessionSocketReconnectTimer = 0;
    }
    console.info("frmapper websocket connected");
  });

  socket.addEventListener("close", (event) => {
    state.sessionSocketState = "disconnected";
    state.sessionSocket = null;
    console.warn("frmapper websocket closed", {
      code: event && typeof event.code === "number" ? event.code : 0,
      reason: event && event.reason ? event.reason : ""
    });
    scheduleSessionReconnect();
  });

  socket.addEventListener("error", (event) => {
    state.sessionSocketState = "error";
    console.warn("frmapper websocket error", event);
  });

  socket.addEventListener("message", (event) => {
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleSessionMessage(msg);
  });
}

function scheduleSessionReconnect() {
  if (state.sessionMode !== "ws") return;
  if (!state.sessionWsUrl) return;
  if (state.sessionSocketReconnectTimer) return;

  state.sessionReconnectAttempts += 1;
  const attempt = state.sessionReconnectAttempts;
  const baseDelay = Math.min(
    state.sessionReconnectMaxMs,
    state.sessionReconnectBaseMs * Math.pow(2, Math.max(0, attempt - 1))
  );
  const jitter = Math.floor(Math.random() * 1000);
  const reconnectDelay = Math.min(state.sessionReconnectMaxMs, baseDelay + jitter);
  console.info("frmapper websocket reconnect scheduled", { attempt, delayMs: reconnectDelay });

  state.sessionSocketReconnectTimer = window.setTimeout(() => {
    state.sessionSocketReconnectTimer = 0;
    if (!state.sessionSocket) {
      connectSessionSocket();
    }
  }, reconnectDelay);
}

function handleSessionMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "frmapper.attached") {
    const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    const gmcpNegotiated = !!payload.gmcpNegotiated;
    const gmcpEnabled = !!payload.gmcpEnabled;
    console.info("frmapper attached", { gmcpNegotiated, gmcpEnabled });
    if (!gmcpEnabled) {
      console.warn("frmapper attached but GMCP feed is disabled; run 'frmapper' again in-game (or 'gmcp force') and reopen this page.");
    }
  }
  if (msg.type === "frmapper.loadSnapshot" && msg.payload) {
    applyMapObject(msg.payload, "Snapshot loaded via websocket");
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
  if (msg.type === "frmapper.roomObjects" && msg.payload) {
    ingestRoomObjects(msg.payload);
  }
  if (msg.type === "frmapper.roomScannedMobs" && msg.payload) {
    ingestRoomScannedMobs(msg.payload);
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
  if (msg.type === "frmapper.clearArea" && msg.payload) {
    const gridId = String(msg.payload.gridId || msg.payload.grid_id || "");
    if (gridId) clearAreaByGridId(gridId);
  }
  if (msg.type === "frmapper.resize") {
    requestCanvasResizePass();
  }
  if (msg.type === "frmapper.controls.toggle") {
    setEmbedControlsExpanded(undefined);
  }
  if (msg.type === "frmapper.controls.set") {
    const expanded = !!(msg.payload && msg.payload.expanded);
    setEmbedControlsExpanded(expanded);
  }
}

function buildSessionWsUrl(token, realm) {
  if (!token) return "";
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const routeRealm = realm && realm.toLowerCase() === "test" ? "test" : "public";
  const url = new URL(`${scheme}//${window.location.host}/frmapper/ws/${routeRealm}`);
  url.searchParams.set("session", token);
  if (realm) {
    url.searchParams.set("realm", realm);
  }
  return url.toString();
}

function startFrmapperSessionMode() {
  if (state.sessionMode !== "embed") return;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "frmapper.ready",
        payload: { mode: "embed" }
      }, "*");
    }
  } catch (_error) {
    // Host integration is optional; ignore cross-origin messaging failures.
  }
}

const el = {
  embedToggle: document.getElementById("embed-toggle"),
  canvas: document.getElementById("map-canvas"),
  zoomRange: document.getElementById("zoom-range"),
  zoomValue: document.getElementById("zoom-value"),
  gridId: document.getElementById("grid-id"),
  zLevel: document.getElementById("z-level"),
  toggleParty: document.getElementById("toggle-party"),
  toggleMobs: document.getElementById("toggle-mobs"),
  toggleTraveledPath: document.getElementById("toggle-traveled-path"),
  toggleFog: document.getElementById("toggle-fog"),
  roomInspector: document.getElementById("room-inspector"),
  fileInput: document.getElementById("file-input"),
  btnClearMap: document.getElementById("btn-clear-map"),
  btnExport: document.getElementById("btn-export"),
  contextMenu: document.getElementById("context-menu"),
  menuRemoveRoom: document.getElementById("menu-remove-room"),
  menuClearArea: document.getElementById("menu-clear-area"),
  menuClearMap: document.getElementById("menu-clear-map"),
  legend: document.getElementById("legend"),
  roomHoverTooltip: document.getElementById("room-hover-tooltip")
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
  if (state.sessionMode === "ws") {
    connectSessionSocket();
  }
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
    setEmbedControlsExpanded(undefined);
  });
}

function setEmbedControlsExpanded(expanded) {
  if (!state.isEmbedMode) return;
  const isExplicit = typeof expanded === "boolean";
  const nextExpanded = isExplicit
    ? expanded
    : !document.body.classList.contains("controls-expanded");
  document.body.classList.toggle("controls-expanded", nextExpanded);
  applyEmbedToggleState(nextExpanded);
}

function applyEmbedToggleState(expanded) {
  if (!el.embedToggle) return;
  el.embedToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  el.embedToggle.setAttribute("title", expanded ? "Hide mapper controls" : "Show mapper controls");
  el.embedToggle.setAttribute("aria-label", expanded ? "Hide mapper controls" : "Show mapper controls");
}

function wireEvents() {
  if (el.canvas) {
    el.canvas.setAttribute("draggable", "false");
    el.canvas.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });
  }

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

  if (el.toggleTraveledPath) {
    el.toggleTraveledPath.addEventListener("change", () => {
      state.showTraveledPath = !!el.toggleTraveledPath.checked;
      scheduleRender();
    });
  }

  if (el.toggleFog) {
    el.toggleFog.addEventListener("change", () => {
      state.showFogOfWar = !!el.toggleFog.checked;
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


  el.btnClearMap.addEventListener("click", clearMapWithConfirmation);
  el.btnExport.addEventListener("click", exportMap);

  function endCanvasDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    el.canvas.classList.remove("dragging");
    scheduleRender();
  }

  el.canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) return;
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

  el.canvas.addEventListener("mousemove", (event) => {
    if (state.dragging) return;
    const room = pickRoomAt(event.clientX, event.clientY);
    setHoverTooltip(room, event.clientX, event.clientY);
    state.hoverRoomId = room ? room.id : null;
  });

  el.canvas.addEventListener("mouseleave", () => {
    state.hoverRoomId = null;
    hideHoverTooltip();
  });

  window.addEventListener("mouseup", endCanvasDrag);
  window.addEventListener("blur", endCanvasDrag);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) endCanvasDrag();
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
    endCanvasDrag();
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

  el.menuClearArea.addEventListener("click", () => {
    const roomId = state.contextRoomId;
    hideContextMenu();
    if (!roomId) return;
    const room = state.roomsById.get(roomId);
    if (!room) return;
    const gridId = normalizeGridId(room.gridId);
    const label = gridId || "default";
    if (!window.confirm(`Remove all rooms in area "${label}"? This cannot be undone.`)) return;
    clearAreaByGridId(gridId);
  });

  el.menuClearMap.addEventListener("click", () => {
    hideContextMenu();
    clearMapWithConfirmation();
  });

  startFrmapperSessionMode();

  window.addEventListener("message", (event) => {
    handleSessionMessage(event.data);
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
  if (el.menuClearArea) el.menuClearArea.disabled = !state.contextRoomId;
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
  const parsedLastSeenAt = Number.parseInt(room.lastSeenAt, 10);
  const hasName = !!(room.name && String(room.name).trim());
  const parsedEphNum = Number.parseInt(room.ephNum, 10);
  const parsedAreaID = Number.parseInt(room.areaID ?? room.areaId, 10);
  const parsedLocalID = Number.parseInt(room.localID ?? room.localId, 10);
  const normalized = {
    id: String(room.id),
    name: room.name ? String(room.name) : "",
    x: Number.parseInt(room.x, 10) || 0,
    y: Number.parseInt(room.y, 10) || 0,
    z: Number.parseInt(room.z, 10) || 0,
    gridId: normalizeGridId(room.gridId),
    sector: normalizeSector(room.sector),
    area: room.area ? String(room.area) : "",
    exits: normalizeExits(room.exits || {}),
    markers: normalizeMarkers(room.markers || {}),
    objects: normalizeRoomObjects(room.objects || room.items || room.obj_list || []),
    nearbyMobs: normalizeNearbyMobs(room.nearbyMobs || room.nearby_mobs || {}),
    knownMobs: normalizeKnownMobs(room.knownMobs || room.known_mobs || []),
    scanRange: Number.isFinite(parsedScanRange) && parsedScanRange > 0 ? parsedScanRange : null,
    notes: room.notes ? String(room.notes) : "",
    visibleNow: !!room.visibleNow,
    discovered: room.discovered === undefined ? hasName : !!room.discovered,
    darkUnknown: !!room.darkUnknown,
    lastSeenAt: Number.isFinite(parsedLastSeenAt) && parsedLastSeenAt > 0 ? parsedLastSeenAt : (hasName ? Date.now() : null),
    ephNum: Number.isFinite(parsedEphNum) ? parsedEphNum : null,
    areaID: Number.isFinite(parsedAreaID) ? parsedAreaID : null,
    localID: Number.isFinite(parsedLocalID) ? parsedLocalID : null
  };
  normalized.staticSignature = buildRoomStaticSignature(normalized);
  return normalized;
}

function normalizeKnownMobs(value) {
  const mobs = Array.isArray(value) ? value : [];
  return mobs
    .map((m) => {
      if (m && typeof m === "object") {
        return String(m.name || m.shortDesc || m.short_desc || "").trim();
      }
      return String(m || "").trim();
    })
    .filter((m) => !!m);
}

function normalizeRoomObjects(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        const name = String(item || "").trim();
        return name ? { name, type: "unknown" } : null;
      }
      const name = String(item.name || item.shortName || item.short_name || item.shortDesc || item.short_desc || item.desc || item.description || "").trim();
      if (!name) return null;
      const type = String(item.type || item.itemType || item.item_type || "unknown").trim().toLowerCase() || "unknown";
      return { name, type };
    })
    .filter((item) => !!item);
}

function normalizeMarkers(markers) {
  return {
    trail: !!(markers && markers.trail),
    shop: !!(markers && markers.shop),
    bank: !!(markers && markers.bank),
    runegate: !!(markers && markers.runegate),
    waterSource: !!(markers && markers.waterSource)
  };
}

function buildRoomStaticSignature(room) {
  const markers = room && room.markers ? room.markers : {};
  return [
    String(room && room.sector ? room.sector : ""),
    room && room.darkUnknown ? "1" : "0",
    markers.shop ? "1" : "0",
    markers.bank ? "1" : "0",
    markers.runegate ? "1" : "0",
    markers.waterSource ? "1" : "0",
    JSON.stringify(room && room.exits ? room.exits : {})
  ].join("|");
}

function detectWaterSource(objects) {
  if (!Array.isArray(objects) || objects.length === 0) return false;
  const waterKeywords = ["fountain", "spring", "well", "pool", "brook", "stream", "river"];
  for (const obj of objects) {
    const name = String(obj && (obj.name || obj.short_desc || obj.shortDesc || obj.desc || obj.description || "")).toLowerCase();
    if (waterKeywords.some((kw) => name.includes(kw))) return true;
    const type = String(obj && (obj.type || obj.item_type || obj.itemType || "")).toLowerCase();
    if (type === "drink_container" || type === "fountain") return true;
  }
  return false;
}

function buildMarkersFromInfo(info, existingRoom) {
  const base = info.markers || {};
  const roomObjects = (info && (info.objects || info.items || info.obj_list))
    || (existingRoom && Array.isArray(existingRoom.objects) ? existingRoom.objects : []);
  const waterSource = detectWaterSource(roomObjects);
  return Object.assign({}, base, { waterSource: !!(base.waterSource || waterSource) });
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
      state: ex.state ? String(ex.state).toLowerCase() : "open",
      door: !!ex.door
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

function deriveFallbackCoord(info, roomId, existingRoom) {
  if (existingRoom && Number.isFinite(existingRoom.x) && Number.isFinite(existingRoom.y) && Number.isFinite(existingRoom.z)) {
    return {
      x: existingRoom.x,
      y: existingRoom.y,
      z: existingRoom.z,
      gridId: normalizeGridId(existingRoom.gridId)
    };
  }

  const playerRoomId = state.playerLocation && state.playerLocation.roomId
    ? String(state.playerLocation.roomId)
    : "";
  const previousRoom = playerRoomId ? state.roomsById.get(playerRoomId) : null;
  if (previousRoom && previousRoom.exits && typeof previousRoom.exits === "object") {
    const fallbackGrid = normalizeGridId(
      info && info.coord && info.coord.gridId !== undefined
        ? info.coord.gridId
        : previousRoom.gridId
    );
    for (const [dir, ex] of Object.entries(previousRoom.exits)) {
      if (!ex || String(ex.to || "") !== roomId) continue;
      const vec = DIRECTION_VECTORS[dir];
      if (!vec) continue;
      return {
        x: previousRoom.x + vec.dx,
        y: previousRoom.y + vec.dy,
        z: previousRoom.z,
        gridId: fallbackGrid
      };
    }
    return {
      x: previousRoom.x,
      y: previousRoom.y,
      z: previousRoom.z,
      gridId: fallbackGrid
    };
  }

  return {
    x: 0,
    y: 0,
    z: 0,
    gridId: normalizeGridId(info && info.coord ? info.coord.gridId : "")
  };
}

function roomFromRoomInfo(info, existingRoom) {
  if (!info || typeof info !== "object") return null;
  const coordInfo = info.coord && typeof info.coord === "object" ? info.coord : null;

  let roomId = String(info.id || "").trim();
  const rawX = coordInfo ? Number.parseInt(coordInfo.x, 10) : Number.NaN;
  const rawY = coordInfo ? -Number.parseInt(coordInfo.y, 10) : Number.NaN;
  const rawZ = coordInfo ? Number.parseInt(coordInfo.z, 10) : Number.NaN;
  const hasCoord = Number.isFinite(rawX) && Number.isFinite(rawY) && Number.isFinite(rawZ);

  const fallback = hasCoord ? null : deriveFallbackCoord(info, roomId, existingRoom || null);
  const x = hasCoord ? rawX : fallback.x;
  const y = hasCoord ? rawY : fallback.y;
  const z = hasCoord ? rawZ : fallback.z;
  const gridId = hasCoord
    ? normalizeGridId(coordInfo && coordInfo.gridId)
    : fallback.gridId;

  if (!roomId) roomId = coordKey(x, y, z, gridId);
  const canSeeRoom = info.name !== null && info.name !== undefined;

  if (!canSeeRoom) {
    if (existingRoom) {
      return normalizeRoom({
        ...existingRoom,
        id: roomId,
        x,
        y,
        z,
        gridId,
        ephNum: info.ephNum ?? existingRoom.ephNum,
        areaID: info.areaID ?? info.areaId ?? existingRoom.areaID,
        localID: info.localID ?? info.localId ?? existingRoom.localID,
        area: existingRoom.area || String(info.area || ""),
        visibleNow: false,
        darkUnknown: !existingRoom.discovered
      });
    }
    return normalizeRoom({
      id: roomId,
      name: "",
      x,
      y,
      z,
      gridId,
      area: String(info.area || ""),
      sector: "inside",
      exits: {},
      markers: {},
      nearbyMobs: {},
      knownMobs: [],
      notes: "",
      ephNum: info.ephNum ?? null,
      areaID: info.areaID ?? info.areaId ?? null,
      localID: info.localID ?? info.localId ?? null,
      visibleNow: false,
      discovered: false,
      darkUnknown: true,
      lastSeenAt: null
    });
  }

  const exits = {};
  if (Array.isArray(info.exits)) {
    for (const entry of info.exits) {
      const dir = normalizeDirectionToken(entry && entry.dir);
      if (!dir) continue;
      exits[dir] = {
        to: String(entry && entry.to ? entry.to : ""),
        state: entry && entry.locked ? "locked" : entry && entry.closed ? "closed" : "open",
        door: !!(entry && entry.door)
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
    area: info.area,
    exits,
    markers: buildMarkersFromInfo(info, existingRoom),
    objects: existingRoom ? existingRoom.objects : [],
    nearbyMobs: info.nearby_mobs || info.nearbyMobs || {},
    knownMobs: [],
    scanRange: info.scan_range ?? info.scanRange ?? info.scan_dist ?? info.scanDistance,
    ephNum: info.ephNum ?? (existingRoom ? existingRoom.ephNum : null),
    areaID: info.areaID ?? info.areaId ?? (existingRoom ? existingRoom.areaID : null),
    localID: info.localID ?? info.localId ?? (existingRoom ? existingRoom.localID : null),
    notes: info.area ? `area=${String(info.area)}` : "",
    visibleNow: true,
    discovered: true,
    darkUnknown: false,
    lastSeenAt: Date.now()
  });
}

function applyRoomInfoSnapshot(payload) {
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  const durationMs = Math.max(50, Number.parseInt(payload.durationMs, 10) || 250);
  for (const info of rooms) {
    const infoId = String(info && info.id ? info.id : "").trim();
    const existing = infoId ? state.roomsById.get(infoId) : null;
    const parsed = roomFromRoomInfo(info, existing || null);
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
  const infoId = String(info && info.id ? info.id : "").trim();
  const existing = infoId ? state.roomsById.get(infoId) : null;
  const room = roomFromRoomInfo(info, existing || null);
  if (!room) return;

  upsertRoom(room);

  schedulePersistMap();
  setPlayerLocationPayload({
    roomId: room.id,
    to: { x: room.x, y: room.y, z: room.z, gridId: room.gridId },
    durationMs: Math.max(50, Number.parseInt(durationMs, 10) || 250)
  });
}

function ingestRoomObjects(payload) {
  const roomId = String(payload && (payload.roomId || payload.room_id || payload.id) || "").trim();
  const objects = normalizeRoomObjects(payload && (payload.objects || payload.items || payload.obj_list || []));
  if (!roomId) return;
  const existing = state.roomsById.get(roomId);
  if (!existing) return;
  const markers = Object.assign({}, existing.markers || {}, { waterSource: detectWaterSource(objects) });
  upsertRoom(Object.assign({}, existing, { objects, markers }));
  schedulePersistMap();
  scheduleRender();
}

function ingestRoomScannedMobs(payload) {
  const roomId = String(payload && (payload.roomId || payload.room_id || payload.id) || "").trim();
  const scanSightings = Array.isArray(payload && payload.scan_mobs)
    ? payload.scan_mobs
    : (Array.isArray(payload && payload.scanned_mobs) ? payload.scanned_mobs : (Array.isArray(payload && payload.mobs) ? payload.mobs : []));
  if (!scanSightings.length) return;
  const existing = roomId ? state.roomsById.get(roomId) : null;
  const layerZ = existing ? existing.z : (state.playerLocation ? state.playerLocation.z : 0);
  const gridId = existing ? existing.gridId : (state.playerLocation ? state.playerLocation.gridId : "");
  clearKnownMobsForLayer(layerZ, gridId);
  applyScanMobSightings(scanSightings);
  schedulePersistMap();
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
      if (areRoomsEquivalent(prev, room)) {
        return;
      }
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
  state.roomLayerIndexDirty = true;
}

function areRoomsEquivalent(a, b) {
  if (!a || !b) return false;
  const markerA = a.markers || {};
  const markerB = b.markers || {};
  return (
    String(a.id || "") === String(b.id || "") &&
    String(a.name || "") === String(b.name || "") &&
    a.x === b.x &&
    a.y === b.y &&
    a.z === b.z &&
    normalizeGridId(a.gridId) === normalizeGridId(b.gridId) &&
    String(a.sector || "") === String(b.sector || "") &&
    String(a.area || "") === String(b.area || "") &&
    String(a.notes || "") === String(b.notes || "") &&
    JSON.stringify(a.exits || {}) === JSON.stringify(b.exits || {}) &&
    JSON.stringify(a.objects || []) === JSON.stringify(b.objects || []) &&
    JSON.stringify(a.nearbyMobs || {}) === JSON.stringify(b.nearbyMobs || {}) &&
    JSON.stringify(a.knownMobs || []) === JSON.stringify(b.knownMobs || []) &&
    Number(a.ephNum || 0) === Number(b.ephNum || 0) &&
    Number(a.areaID || 0) === Number(b.areaID || 0) &&
    Number(a.localID || 0) === Number(b.localID || 0) &&
    Number(a.scanRange || 0) === Number(b.scanRange || 0) &&
    !!markerA.shop === !!markerB.shop &&
    !!markerA.bank === !!markerB.bank &&
    !!markerA.runegate === !!markerB.runegate &&
    !!markerA.trail === !!markerB.trail &&
    !!markerA.waterSource === !!markerB.waterSource &&
    JSON.stringify(a.objects || []) === JSON.stringify(b.objects || [])
  );
}

function clearKnownMobsForLayer(z, gridId) {
  const normGrid = normalizeGridId(gridId);
  for (const room of state.mapData.rooms) {
    if (room.z !== z) continue;
    if (normalizeGridId(room.gridId) !== normGrid) continue;
    if (!Array.isArray(room.knownMobs) || room.knownMobs.length === 0) continue;
    room.knownMobs = [];
  }
}

function applyScanMobSightings(scanSightings) {
  for (const entry of scanSightings) {
    if (!entry || typeof entry !== "object") continue;
    const coord = normalizeCoord(entry.coord);
    if (!coord) continue;

    const roomId = String(entry.room_id || entry.roomId || entry.id || "").trim()
      || coordKey(coord.x, -coord.y, coord.z, normalizeGridId(coord.gridId));
    const mappedY = -coord.y;
    const mobs = normalizeKnownMobs(entry.mobs || []);

    const existing = state.roomsById.get(roomId);
    if (existing) {
      upsertRoom(Object.assign({}, existing, {
        knownMobs: mobs,
        area: existing.area || String(entry.area || ""),
        name: existing.name || String(entry.room_name || entry.roomName || "")
      }));
      continue;
    }

    upsertRoom({
      id: roomId,
      name: String(entry.room_name || entry.roomName || ""),
      x: coord.x,
      y: mappedY,
      z: coord.z,
      gridId: normalizeGridId(coord.gridId),
      sector: "inside",
      area: String(entry.area || ""),
      exits: {},
      markers: {},
      nearbyMobs: {},
      knownMobs: mobs,
      notes: "",
      discovered: false,
      darkUnknown: true,
      visibleNow: false,
      lastSeenAt: null
    });
  }
}

function rebuildIndexes() {
  state.roomsById.clear();
  state.roomByCoord.clear();
  state.roomIndexById.clear();
  state.roomsByGrid.clear();
  state.roomsByLayer.clear();
  state.roomCoordSetByLayer.clear();
  state.roomBoundsByGrid.clear();
  state.roomBoundsByLayer.clear();

  for (let i = 0; i < state.mapData.rooms.length; i++) {
    const room = state.mapData.rooms[i];
    const gridKey = normalizeGridId(room.gridId);
    const layerKey = `${gridKey}|${room.z}`;
    state.roomsById.set(room.id, room);
    state.roomByCoord.set(coordKey(room.x, room.y, room.z, room.gridId), room.id);
    state.roomIndexById.set(room.id, i);

    if (!state.roomsByGrid.has(gridKey)) state.roomsByGrid.set(gridKey, []);
    state.roomsByGrid.get(gridKey).push(room);

    if (!state.roomsByLayer.has(layerKey)) state.roomsByLayer.set(layerKey, []);
    state.roomsByLayer.get(layerKey).push(room);

    if (!state.roomCoordSetByLayer.has(layerKey)) state.roomCoordSetByLayer.set(layerKey, new Set());
    state.roomCoordSetByLayer.get(layerKey).add(`${room.x}:${room.y}`);

    updateRoomBounds(state.roomBoundsByGrid, gridKey, room);
    updateRoomBounds(state.roomBoundsByLayer, layerKey, room);
  }

  state.roomLayerIndexDirty = false;
}

function updateRoomBounds(boundsMap, key, room) {
  const existing = boundsMap.get(key);
  if (!existing) {
    boundsMap.set(key, { minX: room.x, maxX: room.x, minY: room.y, maxY: room.y });
    return;
  }
  existing.minX = Math.min(existing.minX, room.x);
  existing.maxX = Math.max(existing.maxX, room.x);
  existing.minY = Math.min(existing.minY, room.y);
  existing.maxY = Math.max(existing.maxY, room.y);
}

function ensureRoomLayerIndexes() {
  if (!state.roomLayerIndexDirty) return;
  rebuildIndexes();
}

function makeRoomLayerKey(gridId, z) {
  return `${normalizeGridId(gridId)}|${z}`;
}

function getRoomsForGrid(gridId) {
  ensureRoomLayerIndexes();
  return state.roomsByGrid.get(normalizeGridId(gridId)) || [];
}

function getRoomsForLayer(gridId, z) {
  ensureRoomLayerIndexes();
  return state.roomsByLayer.get(makeRoomLayerKey(gridId, z)) || [];
}

function getRoomCoordSetForLayer(gridId, z) {
  ensureRoomLayerIndexes();
  return state.roomCoordSetByLayer.get(makeRoomLayerKey(gridId, z)) || new Set();
}

function getRoomBoundsForLayer(gridId, z) {
  ensureRoomLayerIndexes();
  return state.roomBoundsByLayer.get(makeRoomLayerKey(gridId, z)) || null;
}

function getRoomBoundsForGrid(gridId) {
  ensureRoomLayerIndexes();
  return state.roomBoundsByGrid.get(normalizeGridId(gridId)) || null;
}

function syncZLevels() {
  ensureRoomLayerIndexes();
  const gridIds = Array.from(state.roomsByGrid.keys()).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const gridSet = new Set(gridIds);

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

  const zSet = new Set(getRoomsForGrid(activeGrid).map((r) => r.z));
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
  const rooms = getRoomsForLayer(activeGrid, state.activeZ);
  if (rooms.length === 0) {
    state.zoom = typeof opts.zoom === "number" ? opts.zoom : 1;
    if (el.zoomRange) el.zoomRange.value = String(state.zoom);
    if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    state.panX = 100;
    state.panY = 100;
    return;
  }

  const bounds = getRoomBoundsForLayer(activeGrid, state.activeZ);
  if (!bounds) return;

  const rect = el.canvas.getBoundingClientRect();
  const fitZoom = computeFitZoomForRooms(rooms, rect.width, rect.height);
  const minZoom = Math.max(0.05, Math.min(1, fitZoom));
  const desiredZoom = Number.isFinite(opts.zoom)
    ? clampZoom(opts.zoom, minZoom)
    : clampZoom(state.zoom, minZoom);

  state.zoom = desiredZoom;
  if (el.zoomRange) el.zoomRange.value = String(state.zoom);
  if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;

  const centerWorldX = ((bounds.minX + bounds.maxX + 1) / 2) * TILE_SIZE;
  const centerWorldY = ((bounds.minY + bounds.maxY + 1) / 2) * TILE_SIZE;
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
  const rooms = getRoomsForGrid(activeGrid);
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
  const gridRooms = getRoomsForGrid(activeGrid);
  const rooms = getRoomsForLayer(activeGrid, state.activeZ);
  const lightMode = state.isSafari && (state.dragging || state.animation.active);
  const tilePx = TILE_SIZE * state.zoom;
  const viewW = el.canvas.clientWidth;
  const viewH = el.canvas.clientHeight;
  const visibleRooms = [];
  const visibleFadedRooms = [];
  const occupiedActive = getRoomCoordSetForLayer(activeGrid, state.activeZ);

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
    drawRoomStaticSprite(room, { ghost: true });
  }

  for (const room of visibleRooms) {
    drawRoomStaticSprite(room);
  }

  if (state.showFogOfWar) {
    const now = Date.now();
    for (const room of visibleRooms) {
      drawFogOfWarHaze(room, now);
    }
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
  }

  for (const room of visibleRooms) {
    drawOneWayExitOverlays(room);
  }

  drawActiveMoveLine();

  for (const room of visibleRooms) {
    if (room.id === state.selectedRoomId) {
      drawSelectedRoomOutline(room);
    }
  }
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
  const mask = getTrailMaskForRoom(room);
  if (!mask) return;

  const endpointMode = countBits(mask) === 1 ? "fadeIn" : "none";
  const sprite = getTrailSprite(mask, endpointMode);
  if (!sprite) return;

  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  ctx.drawImage(sprite, x, y, tilePx, tilePx);
}

function getTrailMaskForRoom(room) {
  let mask = 0;
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
    mask |= (TRAIL_DIR_BITS[dir] || 0);
  }
  return mask;
}

function getTrailSprite(mask, endpointMode) {
  const key = `${mask}:${endpointMode}`;
  const cached = TRAIL_SPRITE_CACHE.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = TRAIL_SPRITE_SIZE;
  canvas.height = TRAIL_SPRITE_SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;

  renderTrailSprite(g, TRAIL_SPRITE_SIZE, mask, endpointMode, key);
  TRAIL_SPRITE_CACHE.set(key, canvas);
  return canvas;
}

function renderTrailSprite(g, size, mask, endpointMode, seedKey) {
  const outerW = size * 0.3;
  const innerW = size * 0.17;

  fillTrailShape(g, size, mask, outerW, "rgba(72, 44, 22, 0.95)", endpointMode);
  fillTrailShape(g, size, mask, innerW, "rgba(136, 95, 50, 0.72)", endpointMode);

  g.save();
  applyTrailClip(g, size, mask, outerW);
  const rand = makeSeededRandom(hashString(seedKey));
  const count = 24 + countBits(mask) * 8;
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.45 + rand() * 1.05;
    g.fillStyle = rand() < 0.7 ? "rgba(214, 176, 118, 0.36)" : "rgba(154, 118, 72, 0.28)";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function fillTrailShape(g, size, mask, width, color, endpointMode) {
  g.save();

  if (countBits(mask) === 1 && endpointMode !== "none") {
    const grad = endpointGradient(g, size, mask, color, endpointMode);
    g.fillStyle = grad;
  } else {
    g.fillStyle = color;
  }

  drawTrailRects(g, size, mask, width);
  g.fill();
  g.restore();
}

function endpointGradient(g, size, mask, color, endpointMode) {
  const c = size * 0.5;
  let x2 = c;
  let y2 = c;
  if (mask & TRAIL_DIR_BITS.n) y2 = 0;
  if (mask & TRAIL_DIR_BITS.e) x2 = size;
  if (mask & TRAIL_DIR_BITS.s) y2 = size;
  if (mask & TRAIL_DIR_BITS.w) x2 = 0;

  const grad = g.createLinearGradient(c, c, x2, y2);
  if (endpointMode === "fadeIn") {
    grad.addColorStop(0, color.replace(/0\.[0-9]+\)/, "0.08)"));
    grad.addColorStop(0.35, color.replace(/0\.[0-9]+\)/, "0.52)"));
    grad.addColorStop(1, color);
  } else {
    grad.addColorStop(0, color);
    grad.addColorStop(0.7, color.replace(/0\.[0-9]+\)/, "0.52)"));
    grad.addColorStop(1, color.replace(/0\.[0-9]+\)/, "0.08)"));
  }
  return grad;
}

function drawTrailRects(g, size, mask, width) {
  const c = size * 0.5;
  const hw = width * 0.5;
  g.beginPath();
  g.rect(c - hw, c - hw, width, width);
  if (mask & TRAIL_DIR_BITS.n) g.rect(c - hw, 0, width, c);
  if (mask & TRAIL_DIR_BITS.e) g.rect(c, c - hw, c, width);
  if (mask & TRAIL_DIR_BITS.s) g.rect(c - hw, c, width, c);
  if (mask & TRAIL_DIR_BITS.w) g.rect(0, c - hw, c, width);
}

function applyTrailClip(g, size, mask, width) {
  drawTrailRects(g, size, mask, width);
  g.clip();
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeSeededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function countBits(mask) {
  let m = mask >>> 0;
  let c = 0;
  while (m) {
    c += m & 1;
    m >>>= 1;
  }
  return c;
}

function drawRoomPoiMarkers(room) {
  if (!room.markers) return;
  const markers = [];
  if (room.markers.shop) markers.push("shop");
  if (room.markers.bank) markers.push("bank");
  if (room.markers.runegate) markers.push("runegate");

  const opacity = wallOpacityForZoom();
  if (opacity <= 0) return;

  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const cornerInset = Math.max(1.5, state.zoom * 5);

  ctx.save();
  ctx.globalAlpha *= opacity;
  if (markers.length > 0) {
    const size = Math.max(2.25, state.zoom * 7.5);
    const step = size * 2 + Math.max(1.5, state.zoom * 3);
    markers.forEach((kind, i) => {
      const cx = x + cornerInset + size + i * step;
      const cy = y + cornerInset + size;
      drawPoiMarker(kind, cx, cy, size);
    });
  }

  // Water source icon in bottom-right corner.
  if (room.markers.waterSource) {
    const wSize = Math.max(2, state.zoom * 6);
    drawWaterDrop(x + tilePx - wSize - cornerInset, y + tilePx - wSize - cornerInset, wSize);
  }
  ctx.restore();
}

function drawWaterDrop(cx, cy, size) {
  const sprite = getWaterDropSprite(size, shouldReduceGlowEffects());
  ctx.drawImage(sprite.canvas, cx - sprite.center, cy - sprite.center);
}

function drawPoiMarker(kind, cx, cy, size) {
  const sprite = getPoiMarkerSprite(kind, size, shouldReduceGlowEffects());
  ctx.drawImage(sprite.canvas, cx - sprite.center, cy - sprite.center);
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
  // Bottom of tile — avoids overlapping mob dots which sit at the top.
  const y = state.panY + room.y * tilePx + tilePx - Math.max(6, state.zoom * 6);
  const r = Math.max(3.5, state.zoom * 3.5);
  const sprite = getDotSprite(r, shouldReduceGlowEffects(), PARTY_DOT_PALETTE);
  ctx.save();
  ctx.drawImage(sprite.canvas, x - sprite.center, y - sprite.center);
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
  const color = PARTY_NEON_COLOR;

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
  drawTriangle(edgeX, edgeY, ang, PARTY_NEON_COLOR);
}

function drawTriangle(x, y, angle, color) {
  const size = Math.max(11, state.zoom * 13);
  const shadowScale = shouldReduceGlowEffects() ? 0.3 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = PARTY_NEON_GLOW;
  ctx.shadowBlur = Math.max(8, Math.round(state.zoom * 16 * shadowScale));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, state.zoom * 2.5);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Hollow neon outline arrow.
  ctx.beginPath();
  ctx.moveTo(0, -size);                     // tip
  ctx.lineTo(size * 0.75, size * 0.5);      // right outer
  ctx.lineTo(size * 0.3, size * 0.15);      // right inner notch
  ctx.lineTo(size * 0.3, size * 0.72);      // right tail bottom
  ctx.lineTo(-size * 0.3, size * 0.72);     // left tail bottom
  ctx.lineTo(-size * 0.3, size * 0.15);     // left inner notch
  ctx.lineTo(-size * 0.75, size * 0.5);     // left outer
  ctx.closePath();
  ctx.stroke();
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
    const distance = Math.max(1, parsed.distance || 1);
    const targetId = findDirectionalScanRoomId(currentRoom, normDir, distance);
    if (!targetId) continue;
    countsByRoom.set(targetId, (countsByRoom.get(targetId) || 0) + count);
  }

  const visibleSet = new Set((visibleRooms || []).map((r) => r.id));
  for (const room of visibleRooms || []) {
    const knownCount = Array.isArray(room.knownMobs) ? room.knownMobs.length : 0;
    if (knownCount <= 0) continue;
    countsByRoom.set(room.id, Math.max(countsByRoom.get(room.id) || 0, knownCount));
  }

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
  const r = Math.max(3.5, state.zoom * 3.5);
  const step = r * 2 + Math.max(2, state.zoom * 2);
  const startX = x + tilePx * 0.5 - ((dots - 1) * step) * 0.5;
  const dotY = y + Math.max(6, state.zoom * 6);
  const reduceGlow = shouldReduceGlowEffects();
  const sprite = getDotSprite(r, reduceGlow, MOB_DOT_PALETTE);

  ctx.save();
  for (let i = 0; i < dots; i++) {
    const cx = startX + i * step;
    ctx.drawImage(sprite.canvas, cx - sprite.center, dotY - sprite.center);
  }
  ctx.restore();

  if (count > dots) {
    ctx.fillStyle = "rgba(245, 225, 225, 0.95)";
    ctx.font = `${Math.max(8, Math.round(8 * state.zoom))}px monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText(`+${count - dots}`, startX + (dots - 1) * step + r + 2, dotY);
  }
}

function getDotSprite(radius, reduceGlow, palette) {
  const roundedRadius = Math.max(1, Math.round(radius * 10) / 10);
  const paletteKey = [palette.glowInner, palette.glowOuter, palette.coreHighlight, palette.coreMid, palette.coreOuter].join("|");
  const cacheKey = `${roundedRadius}:${reduceGlow ? 1 : 0}:${paletteKey}`;
  const cached = MOB_DOT_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const glowRadius = roundedRadius * (reduceGlow ? 1.15 : 2.2);
  const half = Math.ceil(roundedRadius + glowRadius + 2);
  const size = Math.max(8, half * 2);
  const center = size * 0.5;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const sctx = canvas.getContext("2d");
  if (!sctx) {
    const fallback = { canvas, center };
    MOB_DOT_SPRITE_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const glowGradient = sctx.createRadialGradient(center, center, roundedRadius * 0.35, center, center, roundedRadius + glowRadius);
  glowGradient.addColorStop(0, palette.glowInner);
  glowGradient.addColorStop(1, palette.glowOuter);
  sctx.fillStyle = glowGradient;
  sctx.beginPath();
  sctx.arc(center, center, roundedRadius + glowRadius, 0, Math.PI * 2);
  sctx.fill();

  const coreGradient = sctx.createRadialGradient(center - roundedRadius * 0.22, center - roundedRadius * 0.22, roundedRadius * 0.25, center, center, roundedRadius);
  coreGradient.addColorStop(0, palette.coreHighlight);
  coreGradient.addColorStop(0.45, palette.coreMid);
  coreGradient.addColorStop(1, palette.coreOuter);
  sctx.fillStyle = coreGradient;
  sctx.beginPath();
  sctx.arc(center, center, roundedRadius, 0, Math.PI * 2);
  sctx.fill();

  const sprite = { canvas, center };
  MOB_DOT_SPRITE_CACHE.set(cacheKey, sprite);
  return sprite;
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

  touchRoomSeen(targetRoom.id);

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

function touchRoomSeen(roomId) {
  const id = String(roomId || "");
  if (!id) return;
  const existing = state.roomsById.get(id);
  if (!existing) return;

  const now = Date.now();
  const next = normalizeRoom({
    ...existing,
    visibleNow: true,
    discovered: true,
    darkUnknown: false,
    lastSeenAt: now
  });
  upsertRoom(next);
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

  if (state.showTraveledPath) {
    for (const dot of state.movementTrail) {
      if (dot.z !== state.activeZ) continue;
      if (normalizeGridId(dot.gridId) !== normalizeGridId(state.activeGridId)) continue;
      const age = now - dot.createdAt;
      const holdMs = Number.isFinite(dot.holdMs) ? dot.holdMs : TRAIL_DOT_HOLD_MS;
      const fadeAge = Math.max(0, age - holdMs);
      const alpha = age <= holdMs ? 1 : Math.max(0, 1 - fadeAge / dot.fadeMs);
      if (alpha <= 0) continue;

      const x = state.panX + (dot.x + 0.5) * tilePx;
      const y = state.panY + (dot.y + 0.5) * tilePx;
      const radius = Math.max(1.4, state.zoom * 1.45);
      const sprite = getDotSprite(radius, true, TRAIL_DOT_PALETTE);

      ctx.save();
      ctx.globalAlpha *= Math.min(0.63, alpha * 0.7);
      ctx.drawImage(sprite.canvas, x - sprite.center, y - sprite.center);
      ctx.restore();
    }
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
  const sprite = getPlayerCenterSprite(outerR, innerR, tickLen, tickGap, shouldReduceGlowEffects());
  ctx.drawImage(sprite.canvas, x - sprite.center, y - sprite.center);
}

function shouldReduceGlowEffects() {
  return state.isSafari && (state.dragging || state.animation.active);
}

function drawRoomStaticSprite(room, options) {
  const opts = options || {};
  const ghost = !!opts.ghost;
  const tilePx = TILE_SIZE * state.zoom;
  const screenX = state.panX + room.x * tilePx;
  const screenY = state.panY + room.y * tilePx;
  const zoomBucket = getZoomSpriteBucket();
  const sprite = getRoomStaticSprite(room, zoomBucket, ghost);
  if (!sprite) return;

  ctx.save();
  if (ghost) {
    ctx.globalAlpha *= 0.22;
  }
  ctx.drawImage(sprite, screenX, screenY, tilePx, tilePx);
  ctx.restore();
}

function getRoomStaticSprite(room, zoomBucket, ghost) {
  const cacheKey = `${room.staticSignature}:${ghost ? 1 : 0}:${zoomBucket}`;
  const cached = ROOM_STATIC_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const tilePx = Math.max(4, Math.round(TILE_SIZE * zoomBucket));
  const canvas = document.createElement("canvas");
  canvas.width = tilePx;
  canvas.height = tilePx;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = false;

  renderRoomStaticSprite(g, room, tilePx, zoomBucket, ghost);
  ROOM_STATIC_SPRITE_CACHE.set(cacheKey, canvas);
  return canvas;
}

function renderRoomStaticSprite(g, room, tilePx, zoomBucket, ghost) {
  renderRoomTileToContext(g, room, tilePx);

  if (ghost) {
    g.save();
    g.strokeStyle = "rgba(220, 228, 238, 0.35)";
    g.lineWidth = Math.max(1, zoomBucket * 0.9);
    g.strokeRect(0.5, 0.5, tilePx - 1, tilePx - 1);
    g.restore();
    return;
  }

  const extraExitSprite = getExtraExitSprite(room, zoomBucket);
  if (extraExitSprite) {
    g.drawImage(extraExitSprite, 0, 0, tilePx, tilePx);
  }

  renderRoomPoiMarkersToContext(g, room, tilePx, zoomBucket);
}

function renderRoomTileToContext(g, room, tilePx) {
  const tileBleedY = Math.max(0.22, tilePx * 0.0045);
  const icon = state.sectorIcons.get(room.sector) || state.sectorIcons.get("inside");

  if (room.darkUnknown) {
    g.fillStyle = "#353a40";
    g.fillRect(0, -tileBleedY, tilePx, tilePx + tileBleedY * 2);
    return;
  }
  if (icon) {
    g.drawImage(icon, 0, -tileBleedY, tilePx, tilePx + tileBleedY * 2);
    return;
  }
  g.fillStyle = "#1f2f3f";
  g.fillRect(0, -tileBleedY, tilePx, tilePx + tileBleedY * 2);
}

function renderRoomPoiMarkersToContext(g, room, tilePx, zoomBucket) {
  if (!room.markers) return;
  const markers = [];
  if (room.markers.shop) markers.push("shop");
  if (room.markers.bank) markers.push("bank");
  if (room.markers.runegate) markers.push("runegate");

  const opacity = wallOpacityForZoomValue(zoomBucket);
  if (opacity <= 0) return;

  const cornerInset = Math.max(1.5, zoomBucket * 5);
  g.save();
  g.globalAlpha *= opacity;

  if (markers.length > 0) {
    const size = Math.max(3.4, zoomBucket * 9.5);
    const step = size * 2 + Math.max(2, zoomBucket * 4);
    const startY = tilePx * 0.5 - ((markers.length - 1) * step) * 0.5;
    markers.forEach((kind, i) => {
      const sprite = getPoiMarkerSprite(kind, size, false);
      if (!sprite) return;
      const cx = cornerInset + size;
      const cy = startY + i * step;
      g.drawImage(sprite.canvas, cx - sprite.center, cy - sprite.center);
    });
  }

  if (room.markers.waterSource) {
    const wSize = Math.max(2, zoomBucket * 6);
    const sprite = getWaterDropSprite(wSize, false);
    if (sprite) {
      const cx = tilePx - wSize - cornerInset;
      const cy = tilePx - wSize - cornerInset;
      g.drawImage(sprite.canvas, cx - sprite.center, cy - sprite.center);
    }
  }
  g.restore();
}

function drawSelectedRoomOutline(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const screenX = state.panX + room.x * tilePx;
  const screenY = state.panY + room.y * tilePx;
  ctx.save();
  ctx.strokeStyle = "rgba(120, 205, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX + 0.5, screenY + 0.5, tilePx - 1, tilePx - 1);
  ctx.restore();
}

function getRoomWallSignature(room) {
  return ["n", "e", "s", "w"].map((dir) => getEdgeVariant(room, dir) || "-").join("|");
}

function renderRoomWallsToContext(g, room, tilePx, zoomBucket) {
  const opacity = wallOpacityForZoomValue(zoomBucket);
  if (opacity <= 0) return;

  const lineWidth = Math.max(2.6, 2.6 * zoomBucket) * (tilePx / TILE_SIZE);
  const edgeInset = Math.max(lineWidth * 0.5 + 0.75, tilePx * 0.035);

  g.save();
  g.globalAlpha *= opacity;
  for (const dir of ["n", "e", "s", "w"]) {
    const variant = getEdgeVariant(room, dir);
    if (!variant) continue;
    const segment = getInsetEdgeSegment(tilePx, dir, edgeInset);
    if (variant === "wall" || variant === "closed" || variant === "locked") {
      renderLocalWall(g, segment, lineWidth, 1);
    }
    if (variant === "open" || variant === "closed" || variant === "locked") {
      renderLocalDoorMark(g, segment, variant === "open" ? "open" : variant, lineWidth);
    }
  }
  g.restore();
}

function drawOneWayExitOverlays(room) {
  for (const dir of ["n", "e", "s", "w"]) {
    if (getEdgeVariant(room, dir) !== "oneway") continue;
    drawOneWayExitArrow(room, dir);
  }
}

function getInsetEdgeSegment(size, dir, inset) {
  if (dir === "n") return { x1: inset, y1: inset, x2: size - inset, y2: inset };
  if (dir === "e") return { x1: size - inset, y1: inset, x2: size - inset, y2: size - inset };
  if (dir === "s") return { x1: inset, y1: size - inset, x2: size - inset, y2: size - inset };
  return { x1: inset, y1: inset, x2: inset, y2: size - inset };
}

function drawRoomTile(room, options) {
  const opts = options || {};
  const tilePx = TILE_SIZE * state.zoom;
  const screenX = state.panX + room.x * tilePx;
  const screenY = state.panY + room.y * tilePx;
  const tileBleedY = Math.max(0.22, tilePx * 0.0045);
  const alpha = typeof opts.alpha === "number" ? Math.max(0, Math.min(1, opts.alpha)) : 1;
  const ghost = !!opts.ghost;

  ctx.save();
  ctx.globalAlpha = alpha;

  const icon = state.sectorIcons.get(room.sector) || state.sectorIcons.get("inside");
  if (room.darkUnknown) {
    ctx.fillStyle = "#353a40";
    ctx.fillRect(screenX, screenY - tileBleedY, tilePx, tilePx + tileBleedY * 2);
  } else if (icon) {
    ctx.drawImage(icon, screenX, screenY - tileBleedY, tilePx, tilePx + tileBleedY * 2);
  } else {
    ctx.fillStyle = "#1f2f3f";
    ctx.fillRect(screenX, screenY - tileBleedY, tilePx, tilePx + tileBleedY * 2);
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

function drawFogOfWarHaze(room, nowMs) {
  if (!room || !room.discovered) return;
  const seenAt = Number.isFinite(room.lastSeenAt) ? room.lastSeenAt : nowMs;
  const age = nowMs - seenAt;
  if (age <= FOG_STALE_START_MS) return;

  const intensity = Math.max(0, Math.min(1, (age - FOG_STALE_START_MS) / (FOG_STALE_FULL_MS - FOG_STALE_START_MS)));
  const alpha = 0.12 + intensity * 0.26;
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;

  // Lightweight fog overlay: flat tile tint instead of per-room radial cloud gradients.
  ctx.save();
  ctx.fillStyle = `rgba(9, 12, 15, ${alpha})`;
  ctx.fillRect(x, y, tilePx, tilePx);
  ctx.restore();
}

function drawRoomWallsAndDoors(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const line = Math.max(2.6, 2.6 * state.zoom);

  const dirs = {
    n: { x1: x, y1: y, x2: x + tilePx, y2: y },
    e: { x1: x + tilePx, y1: y, x2: x + tilePx, y2: y + tilePx },
    s: { x1: x, y1: y + tilePx, x2: x + tilePx, y2: y + tilePx },
    w: { x1: x, y1: y, x2: x, y2: y + tilePx }
  };

  for (const dir of ["n", "e", "s", "w"]) {
    const variant = getEdgeVariant(room, dir);
    if (!variant || variant === "oneway") continue;
    const segment = dirs[dir];
    if (variant === "wall") {
      drawWall(segment, line, WALL_COLOR);
      continue;
    }
    if (variant === "open") {
      drawDoorMark(segment, "open", line);
      continue;
    }
    drawWall(segment, line, WALL_COLOR);
    drawDoorMark(segment, variant, line);
  }
}

function getEdgeVariant(room, dir) {
  const exit = room.exits[dir];
  const vec = DIRECTION_VECTORS[dir];
  const neighborId = state.roomByCoord.get(coordKey(room.x + vec.dx, room.y + vec.dy, room.z, room.gridId));
  const neighbor = neighborId ? state.roomsById.get(neighborId) : null;
  const reverseDir = OPPOSITE_DIRECTIONS[dir];
  const neighborExit = neighbor && reverseDir ? neighbor.exits[reverseDir] : null;

  const hasOpenPassage = isOpenPassageExit(exit, neighborId) || isOpenPassageExit(neighborExit, room.id);
  const oneWayExit = isConfirmedOneWayExit(room, dir, exit);

  if (hasOpenPassage) {
    if (oneWayExit) return shouldSkipSharedBoundary(dir, neighbor) ? "" : "oneway";
    const openDoor = pickOpenDoorForEdge(exit, neighborExit, neighborId, room.id);
    if (!openDoor) return "";
    return shouldSkipSharedBoundary(dir, neighbor) ? "" : "open";
  }

  const blockedExit = pickBlockedExitForEdge(exit, neighborExit, neighborId, room.id);
  if (!blockedExit) return shouldSkipSharedBoundary(dir, neighbor) ? "" : "wall";
  if (shouldSkipSharedBoundary(dir, neighbor)) return "";
  return blockedExit.state === "locked" ? "locked" : "closed";
}

function shouldSkipSharedBoundary(dir, neighbor) {
  if (!neighbor) return false;
  return dir === "n" || dir === "w";
}

function isConfirmedOneWayExit(room, dir, exit) {
  if (!exit || exit.state === "closed" || exit.state === "locked") return false;
  const targetRoomId = String(exit.to || "");
  if (!targetRoomId) return false;

  const targetRoom = state.roomsById.get(targetRoomId);
  if (!targetRoom) return false;

  const reverseDir = OPPOSITE_DIRECTIONS[dir];
  if (!reverseDir) return false;
  const reverseExit = targetRoom.exits[reverseDir];
  if (!reverseExit || reverseExit.state === "closed" || reverseExit.state === "locked") return true;

  const reverseTo = String(reverseExit.to || "");
  if (!reverseTo) return false;
  return reverseTo !== room.id;
}

function isOpenPassageExit(exit, expectedToId) {
  if (!exit || exit.state === "closed" || exit.state === "locked") return false;
  const to = String(exit.to || "");
  if (!to) return true;
  return !expectedToId || to === expectedToId;
}

function pickOpenDoorForEdge(exit, neighborExit, expectedToId, thisRoomId) {
  if (exit && exit.state === "open" && exit.door) {
    const to = String(exit.to || "");
    if (!to || !expectedToId || to === expectedToId) return exit;
  }
  if (neighborExit && neighborExit.state === "open" && neighborExit.door) {
    const to = String(neighborExit.to || "");
    if (!to || !thisRoomId || to === thisRoomId) return neighborExit;
  }
  return null;
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

function wallOpacityForZoom() {
  const z = Number(state.zoom) || 1;
  if (z >= 0.5) return 1;
  if (z <= 0.2) return 0.25;
  const t = (z - 0.2) / 0.3;
  return 0.25 + t * 0.75;
}

function drawWall(segment, lineWidth, color) {
  ctx.save();
  ctx.globalAlpha *= wallOpacityForZoom();

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

  ctx.restore();
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
  const opacity = wallOpacityForZoom();
  if (opacity <= 0) return;

  const isHorizontal = segment.y1 === segment.y2;
  const midX = (segment.x1 + segment.x2) * 0.5;
  const midY = (segment.y1 + segment.y2) * 0.5;
  const along = Math.max(7, 11 * state.zoom);

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = stateLabel === "locked" ? "#e06a62" : stateLabel === "closed" ? "#e08830" : "#f8d56e";
  ctx.lineWidth = Math.max(2.1, lineWidth + 0.35);

  if (isHorizontal) {
    ctx.beginPath();
    ctx.moveTo(midX - along * 0.5, midY);
    ctx.lineTo(midX + along * 0.5, midY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(midX, midY - along * 0.5);
    ctx.lineTo(midX, midY + along * 0.5);
    ctx.stroke();
  }

  if (stateLabel === "locked") {
    const lockArm = Math.max(2.5, along * 0.28);
    ctx.beginPath();
    ctx.moveTo(midX - lockArm, midY - lockArm);
    ctx.lineTo(midX + lockArm, midY + lockArm);
    ctx.moveTo(midX + lockArm, midY - lockArm);
    ctx.lineTo(midX - lockArm, midY + lockArm);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOneWayExitArrow(room, dir, segment) {
  const opacity = wallOpacityForZoom();
  if (opacity <= 0) return;

  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const inset = Math.max(4, tilePx * 0.11);
  const lineWidth = Math.max(1.2, state.zoom * 1.5);
  const head = Math.max(4.5, tilePx * 0.08);

  let sx = x + tilePx * 0.5;
  let sy = y + tilePx * 0.5;
  let ex = sx;
  let ey = sy;

  if (dir === "n") {
    sx = x + tilePx * 0.82;
    sy = y + inset;
    ex = sx;
    ey = y - inset * 0.7;
  } else if (dir === "s") {
    sx = x + tilePx * 0.82;
    sy = y + tilePx - inset;
    ex = sx;
    ey = y + tilePx + inset * 0.7;
  } else if (dir === "e") {
    sx = x + tilePx - inset;
    sy = y + tilePx * 0.82;
    ex = x + tilePx + inset * 0.7;
    ey = sy;
  } else if (dir === "w") {
    sx = x + inset;
    sy = y + tilePx * 0.82;
    ex = x - inset * 0.7;
    ey = sy;
  }

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const angle = Math.atan2(ey - sy, ex - sx);
  const hx = ex;
  const hy = ey;
  const leftX = hx - Math.cos(angle) * head - Math.sin(angle) * (head * 0.65);
  const leftY = hy - Math.sin(angle) * head + Math.cos(angle) * (head * 0.65);
  const rightX = hx - Math.cos(angle) * head + Math.sin(angle) * (head * 0.65);
  const rightY = hy - Math.sin(angle) * head - Math.cos(angle) * (head * 0.65);

  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOpenExitMark(segment, lineWidth) {
  const opacity = wallOpacityForZoom();
  if (opacity <= 0) return;

  const isHorizontal = segment.y1 === segment.y2;
  const midX = (segment.x1 + segment.x2) * 0.5;
  const midY = (segment.y1 + segment.y2) * 0.5;
  const span = Math.max(5, state.zoom * 6.5);

  ctx.save();
  ctx.globalAlpha *= opacity;
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
  ctx.restore();
}

function drawExtraExitMarkers(room) {
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const sprite = getExtraExitSprite(room, getZoomSpriteBucket());
  if (!sprite) return;
  ctx.drawImage(sprite, x, y, tilePx, tilePx);
}

function getZoomSpriteBucket() {
  return Math.max(0.1, Math.round(state.zoom * 20) / 20);
}

function getSpriteSizeBucket(value, step) {
  const bucketStep = step || 0.5;
  return Math.max(bucketStep, Math.round(value / bucketStep) * bucketStep);
}

function getPoiMarkerSprite(kind, size, reduceGlow) {
  const sizeBucket = getSpriteSizeBucket(size, 0.5);
  const cacheKey = `${kind}:${sizeBucket}:${reduceGlow ? 1 : 0}`;
  const cached = POI_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const glow = sizeBucket * (reduceGlow ? 0.55 : 0.9);
  const center = Math.ceil(sizeBucket + glow + 2);
  const canvasSize = Math.max(12, center * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const g = canvas.getContext("2d");
  if (!g) {
    const fallback = { canvas, center };
    POI_SPRITE_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  g.save();
  g.shadowColor = "rgba(255, 236, 165, 0.8)";
  g.shadowBlur = Math.max(3, sizeBucket * (reduceGlow ? 0.8 : 1.2));
  g.fillStyle = "rgba(22, 28, 35, 0.92)";
  g.beginPath();
  g.arc(center, center, sizeBucket, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = Math.max(1.1, sizeBucket * 0.16);
  g.strokeStyle = "rgba(250, 224, 120, 0.95)";

  if (kind === "shop" || kind === "bank") {
    // Emoji glyph sprite with golden glow; shop uses money bag, bank uses chest-like icon.
    const glyph = kind === "shop" ? "💰" : "🧰";
    const fontPx = Math.max(10, Math.round(sizeBucket * 1.35));
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(glyph, center, center + sizeBucket * 0.02);
  } else if (kind === "runegate") {
    g.beginPath();
    g.moveTo(center - sizeBucket * 0.45, center + sizeBucket * 0.35);
    g.lineTo(center - sizeBucket * 0.45, center - sizeBucket * 0.05);
    g.arc(center, center - sizeBucket * 0.05, sizeBucket * 0.45, Math.PI, 0);
    g.lineTo(center + sizeBucket * 0.45, center + sizeBucket * 0.35);
    g.stroke();
  }
  g.restore();

  const sprite = { canvas, center };
  POI_SPRITE_CACHE.set(cacheKey, sprite);
  return sprite;
}

function getWaterDropSprite(size, reduceGlow) {
  const sizeBucket = getSpriteSizeBucket(size, 0.5);
  const cacheKey = `${sizeBucket}:${reduceGlow ? 1 : 0}`;
  const cached = WATER_DROP_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const glow = sizeBucket * (reduceGlow ? 0.65 : 1.05);
  const center = Math.ceil(sizeBucket + glow + 2);
  const canvasSize = Math.max(12, center * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const g = canvas.getContext("2d");
  if (!g) {
    const fallback = { canvas, center };
    WATER_DROP_SPRITE_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  g.save();
  g.shadowColor = "rgba(80, 180, 255, 0.95)";
  g.shadowBlur = Math.max(3, sizeBucket * (reduceGlow ? 0.95 : 1.35));
  g.beginPath();
  g.moveTo(center, center - sizeBucket * 0.6);
  g.bezierCurveTo(
    center + sizeBucket * 0.55, center - sizeBucket * 0.05,
    center + sizeBucket * 0.55, center + sizeBucket * 0.55,
    center, center + sizeBucket * 0.65
  );
  g.bezierCurveTo(
    center - sizeBucket * 0.55, center + sizeBucket * 0.55,
    center - sizeBucket * 0.55, center - sizeBucket * 0.05,
    center, center - sizeBucket * 0.6
  );
  g.closePath();
  g.fillStyle = "rgba(40, 155, 255, 0.9)";
  g.fill();
  g.beginPath();
  g.arc(center - sizeBucket * 0.18, center - sizeBucket * 0.1, sizeBucket * 0.17, 0, Math.PI * 2);
  g.fillStyle = "rgba(180, 230, 255, 0.65)";
  g.fill();
  g.restore();

  const sprite = { canvas, center };
  WATER_DROP_SPRITE_CACHE.set(cacheKey, sprite);
  return sprite;
}

function getPlayerCenterSprite(outerR, innerR, tickLen, tickGap, reduceGlow) {
  const outerBucket = getSpriteSizeBucket(outerR, 0.5);
  const innerBucket = getSpriteSizeBucket(innerR, 0.25);
  const tickLenBucket = getSpriteSizeBucket(tickLen, 0.25);
  const tickGapBucket = getSpriteSizeBucket(tickGap, 0.25);
  const cacheKey = `${outerBucket}:${innerBucket}:${tickLenBucket}:${tickGapBucket}:${reduceGlow ? 1 : 0}`;
  const cached = PLAYER_CENTER_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const glow = Math.max(4, outerBucket * (reduceGlow ? 0.8 : 1.3));
  const extent = outerBucket + tickGapBucket + tickLenBucket + glow + 2;
  const center = Math.ceil(extent);
  const canvasSize = Math.max(18, center * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const g = canvas.getContext("2d");
  if (!g) {
    const fallback = { canvas, center };
    PLAYER_CENTER_SPRITE_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  g.save();
  g.shadowColor = "rgba(128, 225, 255, 0.95)";
  g.shadowBlur = Math.max(1, Math.round(Math.max(8, outerBucket * 1.6) * (reduceGlow ? 0.25 : 1)));
  g.strokeStyle = "rgba(164, 241, 255, 0.98)";
  g.lineWidth = Math.max(1.2, outerBucket * 0.26);
  g.beginPath();
  g.arc(center, center, outerBucket, 0, Math.PI * 2);
  g.stroke();

  g.fillStyle = "rgba(200, 249, 255, 0.98)";
  g.beginPath();
  g.arc(center, center, innerBucket, 0, Math.PI * 2);
  g.fill();

  g.lineWidth = Math.max(1, outerBucket * 0.22);
  g.beginPath();
  g.moveTo(center, center - outerBucket - tickGapBucket);
  g.lineTo(center, center - outerBucket - tickGapBucket - tickLenBucket);
  g.moveTo(center, center + outerBucket + tickGapBucket);
  g.lineTo(center, center + outerBucket + tickGapBucket + tickLenBucket);
  g.moveTo(center - outerBucket - tickGapBucket, center);
  g.lineTo(center - outerBucket - tickGapBucket - tickLenBucket, center);
  g.moveTo(center + outerBucket + tickGapBucket, center);
  g.lineTo(center + outerBucket + tickGapBucket + tickLenBucket, center);
  g.stroke();
  g.restore();

  const sprite = { canvas, center };
  PLAYER_CENTER_SPRITE_CACHE.set(cacheKey, sprite);
  return sprite;
}

function getEdgeSprite(dir, variant, zoomBucket) {
  const cacheKey = `${dir}:${variant}:${zoomBucket}`;
  const cached = EDGE_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = DECOR_SPRITE_SIZE;
  canvas.height = DECOR_SPRITE_SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;

  renderEdgeSprite(g, DECOR_SPRITE_SIZE, dir, variant, zoomBucket);
  EDGE_SPRITE_CACHE.set(cacheKey, canvas);
  return canvas;
}

function renderEdgeSprite(g, size, dir, variant, zoomBucket) {
  const opacity = wallOpacityForZoomValue(zoomBucket);
  g.save();
  g.globalAlpha = opacity;
  const lineWidth = Math.max(2.6, 2.6 * zoomBucket) * (size / TILE_SIZE);
  const segment = getLocalEdgeSegment(size, dir);
  if (variant === "wall" || variant === "closed" || variant === "locked") {
    renderLocalWall(g, segment, lineWidth, 1);
  }
  if (variant === "open" || variant === "closed" || variant === "locked") {
    renderLocalDoorMark(g, segment, variant === "closed" || variant === "locked" ? variant : "open", lineWidth);
  }
  if (variant === "oneway") {
    renderLocalOneWayArrow(g, size, dir, zoomBucket);
  }
  g.restore();
}

function getLocalEdgeSegment(size, dir) {
  if (dir === "n") return { x1: 0, y1: 0, x2: size, y2: 0 };
  if (dir === "e") return { x1: size, y1: 0, x2: size, y2: size };
  if (dir === "s") return { x1: 0, y1: size, x2: size, y2: size };
  return { x1: 0, y1: 0, x2: 0, y2: size };
}

function wallOpacityForZoomValue(zoomValue) {
  const z = Number(zoomValue) || 1;
  if (z >= 0.5) return 1;
  if (z <= 0.2) return 0.25;
  const t = (z - 0.2) / 0.3;
  return 0.25 + t * 0.75;
}

function renderLocalWall(g, segment, lineWidth, opacity) {
  g.save();
  g.globalAlpha = opacity;
  g.strokeStyle = WALL_BORDER_COLOR;
  g.lineWidth = lineWidth + Math.max(0.4, lineWidth * 0.16);
  g.beginPath();
  g.moveTo(segment.x1, segment.y1);
  g.lineTo(segment.x2, segment.y2);
  g.stroke();
  g.strokeStyle = WALL_COLOR;
  g.lineWidth = lineWidth;
  g.beginPath();
  g.moveTo(segment.x1, segment.y1);
  g.lineTo(segment.x2, segment.y2);
  g.stroke();
  g.restore();
}

function renderLocalDoorMark(g, segment, stateLabel, lineWidth) {
  const isHorizontal = segment.y1 === segment.y2;
  const midX = (segment.x1 + segment.x2) * 0.5;
  const midY = (segment.y1 + segment.y2) * 0.5;
  const size = Math.max(9, 14 * (Math.max(Math.abs(segment.x2 - segment.x1), Math.abs(segment.y2 - segment.y1)) / TILE_SIZE));

  g.strokeStyle = stateLabel === "locked" ? "#e06a62" : stateLabel === "closed" ? "#e08830" : "#f8d56e";
  g.lineWidth = Math.max(1.8, lineWidth * 0.9);

  if (isHorizontal) {
    g.beginPath();
    g.moveTo(midX - size * 0.62, midY - size * 0.32);
    g.lineTo(midX + size * 0.62, midY - size * 0.32);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(midX - size * 0.32, midY - size * 0.62);
    g.lineTo(midX - size * 0.32, midY + size * 0.62);
    g.stroke();
  }

  if (stateLabel === "locked") {
    g.beginPath();
    g.moveTo(midX - size * 0.2, midY - size * 0.2);
    g.lineTo(midX + size * 0.2, midY + size * 0.2);
    g.moveTo(midX + size * 0.2, midY - size * 0.2);
    g.lineTo(midX - size * 0.2, midY + size * 0.2);
    g.stroke();
  }
}

function renderLocalOneWayArrow(g, size, dir, zoomBucket, edgeInset) {
  const inset = Number.isFinite(edgeInset) ? edgeInset : Math.max(4, size * 0.11);
  const lineWidth = Math.max(1.2, zoomBucket * 1.5) * (size / TILE_SIZE);
  const head = Math.max(4.5, size * 0.08);
  let sx = size * 0.5;
  let sy = size * 0.5;
  let ex = sx;
  let ey = sy;

  if (dir === "n") {
    sx = size * 0.82;
    sy = inset;
    ex = sx;
    ey = inset * 0.35;
  } else if (dir === "s") {
    sx = size * 0.82;
    sy = size - inset;
    ex = sx;
    ey = size - inset * 0.35;
  } else if (dir === "e") {
    sx = size - inset;
    sy = size * 0.82;
    ex = size - inset * 0.35;
    ey = sy;
  } else if (dir === "w") {
    sx = inset;
    sy = size * 0.82;
    ex = inset * 0.35;
    ey = sy;
  }

  g.save();
  g.strokeStyle = "rgba(255, 255, 255, 0.9)";
  g.fillStyle = "rgba(255, 255, 255, 0.95)";
  g.lineWidth = lineWidth;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(ex, ey);
  g.stroke();

  const angle = Math.atan2(ey - sy, ex - sx);
  const leftX = ex - Math.cos(angle) * head - Math.sin(angle) * (head * 0.65);
  const leftY = ey - Math.sin(angle) * head + Math.cos(angle) * (head * 0.65);
  const rightX = ex - Math.cos(angle) * head + Math.sin(angle) * (head * 0.65);
  const rightY = ey - Math.sin(angle) * head - Math.cos(angle) * (head * 0.65);
  g.beginPath();
  g.moveTo(ex, ey);
  g.lineTo(leftX, leftY);
  g.lineTo(rightX, rightY);
  g.closePath();
  g.fill();
  g.restore();
}

function getExtraExitSprite(room, zoomBucket) {
  const diagCount = ["ne", "nw", "se", "sw"].reduce((count, dir) => count + (room.exits[dir] ? 1 : 0), 0);
  const hasUp = !!room.exits.u;
  const hasDown = !!room.exits.d;
  if (!diagCount && !hasUp && !hasDown) return null;

  const cacheKey = `${diagCount}:${hasUp ? 1 : 0}:${hasDown ? 1 : 0}:${zoomBucket}`;
  const cached = EXTRA_EXIT_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = DECOR_SPRITE_SIZE;
  canvas.height = DECOR_SPRITE_SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;

  const size = DECOR_SPRITE_SIZE;
  const midX = size * 0.5;
  const midY = size * 0.5;
  if (diagCount > 0) {
    g.fillStyle = "rgba(194, 225, 255, 0.9)";
    g.beginPath();
    g.arc(midX, midY, Math.max(2, 3 * zoomBucket) * (size / TILE_SIZE), 0, Math.PI * 2);
    g.fill();
  }
  if (hasUp) {
    g.fillStyle = "#7ff0b0";
    const ux = size * 0.88;
    const uy = size * 0.12;
    const halfW = size * 0.11;
    const h = size * 0.16;
    g.beginPath();
    g.moveTo(ux, uy);
    g.lineTo(ux - halfW, uy + h);
    g.lineTo(ux + halfW, uy + h);
    g.closePath();
    g.fill();
  }
  if (hasDown) {
    g.fillStyle = "#6fb8ff";
    const dx = size * 0.12;
    const dy = size * 0.88;
    const halfW = size * 0.11;
    const h = size * 0.16;
    g.beginPath();
    g.moveTo(dx, dy);
    g.lineTo(dx - halfW, dy - h);
    g.lineTo(dx + halfW, dy - h);
    g.closePath();
    g.fill();
  }

  EXTRA_EXIT_SPRITE_CACHE.set(cacheKey, canvas);
  return canvas;
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
  const inspectRoomId = state.selectedRoomId;
  if (!inspectRoomId) {
    el.roomInspector.textContent = "No room selected.";
    return;
  }

  const room = state.roomsById.get(inspectRoomId);
  if (!room) {
    el.roomInspector.textContent = "No room selected.";
    return;
  }

  const payload = {
    id: room.id,
    name: room.name,
    area: room.area || "",
    ephNum: room.ephNum != null ? room.ephNum : "",
    areaID: room.areaID != null ? room.areaID : "",
    localID: room.localID != null ? room.localID : "",
    x: room.x,
    y: room.y,
    z: room.z,
    gridId: normalizeGridId(room.gridId),
    sector: room.sector,
    mobs: room.knownMobs || [],
    exits: room.exits,
    notes: room.notes || ""
  };

  el.roomInspector.textContent = JSON.stringify(payload, null, 2);
}

function formatRoomHoverTooltip(room) {
  const mobs = Array.isArray(room.knownMobs) ? room.knownMobs : [];
  const exits = room.exits && typeof room.exits === "object" ? room.exits : {};
  const exitParts = [];

  for (const dir of ["n", "e", "s", "w", "u", "d", "ne", "nw", "se", "sw"]) {
    const ex = exits[dir];
    if (!ex) continue;
    const stateLabel = ex.state ? String(ex.state) : "open";
    exitParts.push(`${dir}:${stateLabel}`);
  }

  const mobText = mobs.length ? mobs.join("\n- ") : "Unknown";
  const exitsText = exitParts.length ? exitParts.join(", ") : "None";
  const nsidText = room.areaID != null && room.localID != null ? `${room.areaID}:${room.localID}` : "";
  const ephText = room.ephNum != null ? String(room.ephNum) : "";

  return [
    `Area: ${room.area || "Unknown"}`,
    `Room: ${room.name || "Unknown"}`,
    nsidText ? `NSID: ${nsidText}` : null,
    ephText ? `ephNum: ${ephText}` : null,
    `XYZ: ${room.x}, ${room.y}, ${room.z}`,
    `Sector: ${room.sector || "unknown"}`,
    `Mobs: ${mobs.length ? `\n- ${mobText}` : mobText}`,
    `Exits: ${exitsText}`
  ].filter(Boolean).join("\n");
}

function setHoverTooltip(room, clientX, clientY) {
  if (!el.roomHoverTooltip) return;
  if (!room) {
    hideHoverTooltip();
    return;
  }

  const wrap = el.canvas.parentElement;
  if (!wrap) return;
  const wrapRect = wrap.getBoundingClientRect();
  const tooltip = el.roomHoverTooltip;
  tooltip.textContent = formatRoomHoverTooltip(room);
  tooltip.hidden = false;

  const offset = 14;
  const maxX = Math.max(0, wrap.clientWidth - tooltip.offsetWidth - 8);
  const maxY = Math.max(0, wrap.clientHeight - tooltip.offsetHeight - 8);
  const left = Math.max(8, Math.min(maxX, clientX - wrapRect.left + offset));
  const top = Math.max(8, Math.min(maxY, clientY - wrapRect.top + offset));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideHoverTooltip() {
  if (!el.roomHoverTooltip) return;
  el.roomHoverTooltip.hidden = true;
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
  if (!from || !to) return;
  const now = performance.now();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(3, Math.ceil(Math.hypot(dx, dy) * 6));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dotGridId = t < 0.5 ? normalizeGridId(from.gridId) : normalizeGridId(to.gridId);
    const dotZ = t < 0.5 ? from.z : to.z;
    state.movementTrail.push({
      x: from.x + dx * t,
      y: from.y + dy * t,
      z: dotZ,
      gridId: dotGridId,
      createdAt: now,
      holdMs: TRAIL_DOT_HOLD_MS,
      fadeMs: TRAIL_DOT_FADE_MIN_MS + Math.random() * (TRAIL_DOT_FADE_MAX_MS - TRAIL_DOT_FADE_MIN_MS)
    });
  }

  if (state.movementTrail.length > 640) {
    state.movementTrail.splice(0, state.movementTrail.length - 640);
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
  state.movementTrail = state.movementTrail.filter((segment) => {
    const holdMs = Number.isFinite(segment.holdMs) ? segment.holdMs : TRAIL_DOT_HOLD_MS;
    return (now - segment.createdAt) < (holdMs + segment.fadeMs);
  });
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

function clearAreaByGridId(gridId) {
  const key = normalizeGridId(gridId);
  const kept = state.mapData.rooms.filter((r) => normalizeGridId(r.gridId) !== key);
  if (kept.length === state.mapData.rooms.length) return;
  state.mapData.rooms = kept;
  if (state.selectedRoomId) {
    const still = state.roomsById.get(state.selectedRoomId);
    if (!still || normalizeGridId(still.gridId) === key) state.selectedRoomId = null;
  }
  rebuildIndexes();
  syncZLevels();
  updateInspector();
  persistMap();
  render();
}

function isVisible(x, y, width, height) {
  const rect = el.canvas.getBoundingClientRect();
  return !(x + width < 0 || y + height < 0 || x > rect.width || y > rect.height);
}

function coordKey(x, y, z, gridId) {
  return `${x}:${y}:${z}:${normalizeGridId(gridId)}`;
}

init();
