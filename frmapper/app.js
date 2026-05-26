"use strict";

const TILE_SIZE = 48;
const WALL_COLOR = "#74442c";
const OFF_LAYER_WALL_COLOR = "#3f6ca6";
const WALL_BORDER_COLOR = "rgba(34, 17, 11, 0.96)";
const WALL_LINE_WIDTH_BASE = 2.85;
const STORAGE_KEY_PREFIX = "frmapper.savedMap.v2";
const SITE_THEME_KEY = "freign.site.theme.v1";
const FRMAPPER_THEME_DEFAULT = "onyx";
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
const ROOM_WALL_SPRITE_CACHE = new Map();
const TRAIL_SPRITE_CACHE_REV = 4;
const ROOM_WALL_SPRITE_CACHE_REV = 3;
const ROOM_STATIC_SPRITE_CACHE_REV = 2;
const SECTOR_TILE_VARIANT_CACHE = new Map();
const SECTOR_TILE_VARIANT_CACHE_REV = 2;
const MAX_TRAIL_SPRITE_CACHE = 256;
const MAX_EDGE_SPRITE_CACHE = 512;
const MAX_EXTRA_EXIT_SPRITE_CACHE = 256;
const MAX_ROOM_STATIC_SPRITE_CACHE = 5000;
const MAX_ROOM_WALL_SPRITE_CACHE = 4096;
const MAX_SECTOR_TILE_VARIANT_CACHE = 1024;
const MAX_MOB_DOT_SPRITE_CACHE = 512;
const MAX_POI_SPRITE_CACHE = 512;
const MAX_WATER_DROP_SPRITE_CACHE = 256;
const MAX_PLAYER_CENTER_SPRITE_CACHE = 256;
const STATIC_CHUNK_ROOM_SIZE = 12;
const DEFAULT_SCAN_DISTANCE = 3;
const QUALITY_MEDIUM_ROOM_COUNT = 1400;
const QUALITY_LOW_ROOM_COUNT = 2600;
const QUALITY_ULTRA_ROOM_COUNT = 4200;
const SECTOR_VARIANT_COUNT = 6;
const TEXTURED_SECTORS = new Set([
  "city",
  "village",
  "field",
  "meadow",
  "forest",
  "deep_forest",
  "hills",
  "mesa",
  "mountain",
  "cave",
  "dungeon",
  "crypt",
  "ruins",
  "sewer",
  "volcanic",
  "swamp",
  "water_swim",
  "water_noswim",
  "underwater",
  "underwater_cave",
  "underwater_city",
  "air",
  "ice",
  "desert",
  "lava",
  "snow",
  "planar"
]);
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
const TRACKED_CHAR_PALETTE = {
  glowInner: "rgba(255, 130, 200, 0.55)",
  glowOuter: "rgba(255, 100, 180, 0)",
  coreHighlight: "rgba(255, 210, 235, 0.99)",
  coreMid: "rgba(240, 90, 170, 0.99)",
  coreOuter: "rgba(170, 30, 110, 0.99)"
};
const TRACKED_MOB_PALETTE = {
  glowInner: "rgba(255, 150, 50, 0.55)",
  glowOuter: "rgba(255, 110, 20, 0)",
  coreHighlight: "rgba(255, 220, 160, 0.99)",
  coreMid: "rgba(240, 140, 30, 0.99)",
  coreOuter: "rgba(160, 70, 0, 0.99)"
};
const PARTY_NEON_COLOR = "rgba(150, 166, 255, 0.94)";
const PARTY_NEON_GLOW = "rgba(164, 150, 255, 0.97)";
const PARTY_JELLY_FADE_MS = 1500;
const PARTY_JELLY_SPRING = 26;
const PARTY_JELLY_DAMPING = 0.84;
const PARTY_JELLY_MIN_LAG = 0.003;
const BLOB_MAX_WAYPOINTS = 100;
const BLOB_WAYPOINT_EPSILON = 0.02;
const PARTY_BLOB_SLURP_SPEED = 1.8;
const TRACKED_BLOB_SLURP_SPEED = 1.8;
const PLAYER_BLOB_SLURP_SPEED = 1.8;
// Speed multiplier = fractional waypoints remaining (e.g. 2.5 waypoints behind = 2.5x speed). Min = 1x.
const PLAYER_BLOB_SPRING = 28;
const PLAYER_BLOB_DAMPING = 0.86;
const MOB_HINT_FADE_START_MS = 5000;
const MOB_HINT_FADE_END_MS = 10000;
const SECTOR_ORDER = [
  "inside",
  "dungeon",
  "crypt",
  "city",
  "village",
  "field",
  "meadow",
  "forest",
  "deep_forest",
  "hills",
  "mesa",
  "mountain",
  "cave",
  "sewer",
  "water_swim",
  "water_noswim",
  "underwater",
  "underwater_cave",
  "underwater_city",
  "swamp",
  "air",
  "ice",
  "desert",
  "lava",
  "volcanic",
  "snow",
  "ruins",
  "planar"
];

const SECTOR_ALIASES = {
  indoors: "inside",
  indoor: "inside",
  town: "city",
  plains: "field",
  swamp: "swamp",
  hill: "hills",
  mountains: "mountain",
  water: "water_swim",
  waterswim: "water_swim",
  waternoswim: "water_noswim",
  water_no_swim: "water_noswim",
  water_noswimming: "water_noswim",
  no_swim: "water_noswim",
  under_water: "underwater",
  underwater: "underwater",
  underwatercave: "underwater_cave",
  underwater_city: "underwater_city",
  underwatercity: "underwater_city",
  underwater_cavern: "underwater_cave",
  underwater_town: "underwater_city",
  sky: "air",
  cave: "cave",
  caves: "cave",
  dungeon: "dungeon",
  dungeons: "dungeon",
  meadow: "meadow",
  meadows: "meadow",
  village: "village",
  villages: "village",
  mesa: "mesa",
  sewer: "sewer",
  sewers: "sewer",
  crypt: "crypt",
  crypts: "crypt",
  deepforest: "deep_forest",
  deep_forest: "deep_forest",
  ancientforest: "deep_forest",
  volcanic: "volcanic",
  volcano: "volcanic",
  volcanoes: "volcanic",
  ruin: "ruins",
  ruins: "ruins",
  ice: "ice",
  planar: "planar",
  plane: "planar"
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
const embedParam = String(sessionParams.get("embed") || "").toLowerCase();
const sessionMode = sessionToken ? "ws" : ((embedParam === "1" || embedParam === "true" || embedParam === "yes") ? "embed" : "anon");
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
  storageCharacterName: "",
  storageRealm: sessionRealm || "public",
  storageNamespace: "",
  storageKey: "",
  storageLoadedKey: "",
  contextRoomId: null,
  resizeObserver: null,
  resizePassTimer: 0,
  renderRafId: 0,
  persistTimer: 0,
  persistIdleId: 0,
  gridOptionsKey: "",
  zOptionsKey: "",
  showParty: true,
  showMobHints: true,
  showTraveledPath: true,
  showFogOfWar: true,
  showGridOutline: false,
  showPerfStats: false,
  showLocalIds: false,
  followPlayer: true,
  pendingInitialSnap: false,
  themeHighlightColor: "#d9b05f",
  scanDistance: DEFAULT_SCAN_DISTANCE,
  sectorIcons: new Map(),
  playerLocation: null,
  playerRoomId: null,
  partyMembers: [],
  partyMemberLastPos: new Map(),
  jellyFollowers: new Map(),
  roomMobs: [],
  roomMobsSeenAt: 0,
  roomStatus: null,
  roomMobHint: null,
  tempMobDotByRoom: new Map(),
  trackedChars: new Map(),   // Map<name, { roomId }>
  trackedMobs:  new Map(),   // Map<name, { roomId, uid }>
  partyMobUids: new Set(),   // Set<number> of mob instance IDs that are party members
  // jellyFollowers is the unified Map for all blob trails (player, party, tracked)
  roomEdgeVariants: new Map(),
  roomEdgeVariantsDirty: true,
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
    lastEffectTs: 0,
    fromCoord: null,
    toCoord: null
  },
  staticLayer: {
    version: 0,
    chunks: new Map(),
    zoomKey: ""
  },
  perf: {
    frameMs: 0,
    renderMs: 0,
    visibleRooms: 0,
    qualityTier: "full",
    staticRebuilt: false,
    staticVersion: 0,
    staticChunksDrawn: 0,
    staticChunksRebuilt: 0,
    staticChunkCacheSize: 0,
    lastDrawTs: 0,
    fpsEstimate: 0,
    panelTs: 0
  }
};

function resolveFrmapperThemeId(rawThemeId) {
  const raw = String(rawThemeId || "").trim().toLowerCase();
  if (window.FreignThemes && typeof window.FreignThemes.resolveThemeId === "function") {
    return window.FreignThemes.resolveThemeId(raw || FRMAPPER_THEME_DEFAULT) || FRMAPPER_THEME_DEFAULT;
  }
  return raw || FRMAPPER_THEME_DEFAULT;
}

function readSiteThemePreference() {
  let stored = "";
  try {
    stored = localStorage.getItem(SITE_THEME_KEY) || "";
  } catch (_err) {
    stored = "";
  }
  return resolveFrmapperThemeId(stored || FRMAPPER_THEME_DEFAULT);
}

function applyFrmapperTheme(themeId) {
  const resolved = resolveFrmapperThemeId(themeId || FRMAPPER_THEME_DEFAULT);
  let vars = null;

  if (window.FreignThemes && typeof window.FreignThemes.getTheme === "function") {
    const theme = window.FreignThemes.getTheme(resolved);
    if (theme && theme.vars) vars = theme.vars;
  }

  if (!vars) {
    vars = {
      bg: "#0a0a0e",
      panel: "#111118",
      "panel-border": "#2a2a38",
      text: "#c8c0b0",
      muted: "#8f8798",
      title: "#e0c87a",
      "input-bg": "#1a1a24",
      "input-border": "#3a3a50",
      accent: "#d9b05f",
      "terminal-bg": "#0c0c13",
      "terminal-border": "#323246"
    };
  }

  const root = document.body;
  root.setAttribute("data-theme", resolved);
  root.style.setProperty("--fm-bg", vars.bg || "#0a0a0e");
  root.style.setProperty("--fm-panel", vars.panel || "#111118");
  root.style.setProperty("--fm-panel-border", vars["panel-border"] || "#2a2a38");
  root.style.setProperty("--fm-text", vars.text || "#c8c0b0");
  root.style.setProperty("--fm-muted", vars.muted || "#8f8798");
  root.style.setProperty("--fm-title", vars.title || "#e0c87a");
  root.style.setProperty("--fm-input-bg", vars["input-bg"] || "#1a1a24");
  root.style.setProperty("--fm-input-border", vars["input-border"] || "#3a3a50");
  const accent = vars.accent || vars.title || "#d9b05f";
  root.style.setProperty("--fm-accent", accent);
  root.style.setProperty("--fm-terminal-bg", vars["terminal-bg"] || "#0c0c13");
  root.style.setProperty("--fm-terminal-border", vars["terminal-border"] || "#323246");
  state.themeHighlightColor = accent;

  scheduleRender();
}

function syncFrmapperThemeFromSitePreference() {
  applyFrmapperTheme(readSiteThemePreference());
}

function hashStringFNV1a(input) {
  const text = String(input || "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function nextRand() {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), t | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function mixColor(a, b, t) {
  const tt = clamp01(t);
  return {
    r: Math.round(a.r + (b.r - a.r) * tt),
    g: Math.round(a.g + (b.g - a.g) * tt),
    b: Math.round(a.b + (b.b - a.b) * tt)
  };
}

function colorToStyle(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function setCappedCache(cache, key, value, maxEntries) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function getSectorVariantIndex(room) {
  if (!room || !TEXTURED_SECTORS.has(room.sector)) return -1;
  const variantSeed = [
    String(room.sector || ""),
    String(room.id || ""),
    String(room.areaID ?? ""),
    String(room.localID ?? "")
  ].join("|");
  return hashStringFNV1a(variantSeed) % SECTOR_VARIANT_COUNT;
}

function getRoomTileImage(room, tilePx) {
  const sector = String((room && room.sector) || "inside");
  const baseIcon = state.sectorIcons.get(sector) || state.sectorIcons.get("inside") || null;
  const variant = getSectorVariantIndex(room);
  if (variant < 0) {
    return baseIcon;
  }

  const cacheKey = `${SECTOR_TILE_VARIANT_CACHE_REV}:${sector}:${variant}:${tilePx}`;
  const cached = SECTOR_TILE_VARIANT_CACHE.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = tilePx;
  canvas.height = tilePx;
  const g = canvas.getContext("2d");
  if (!g) return null;

  if (baseIcon) {
    renderSectorVariantTile(g, baseIcon, sector, variant, tilePx);
  } else {
    renderProceduralSectorFallback(g, sector, variant, tilePx);
  }
  setCappedCache(SECTOR_TILE_VARIANT_CACHE, cacheKey, canvas, MAX_SECTOR_TILE_VARIANT_CACHE);
  return canvas;
}

function applySeamlessOverlay(g, size, rgba, phaseX, phaseY, intensity) {
  const alphaScale = Math.max(0, Math.min(1, intensity));
  g.save();
  g.fillStyle = rgba;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / size) * Math.PI * 2;
      const ny = (y / size) * Math.PI * 2;
      const wave = 0.5
        + 0.28 * Math.sin(nx * 2 + phaseX)
        + 0.22 * Math.cos(ny * 2 + phaseY)
        + 0.12 * Math.sin((nx + ny) * 2 + phaseX * 0.6);
      const a = Math.max(0, Math.min(1, wave * alphaScale));
      if (a <= 0.01) continue;
      g.globalAlpha = a;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.restore();
}

function drawSubtleSectorAccent(g, size, sector, variant, rng) {
  if (sector === "field") {
    g.save();
    g.strokeStyle = "rgba(176, 202, 120, 0.16)";
    g.lineWidth = Math.max(0.7, size * 0.012);
    for (let i = 0; i < 4; i += 1) {
      const y = size * (0.18 + i * 0.2) + (variant - 2.5) * 0.14;
      g.beginPath();
      g.moveTo(size * 0.08, y);
      g.bezierCurveTo(size * 0.26, y - size * 0.04, size * 0.72, y + size * 0.04, size * 0.92, y);
      g.stroke();
    }
    g.strokeStyle = "rgba(114, 136, 78, 0.14)";
    g.lineWidth = Math.max(0.55, size * 0.01);
    for (let i = 0; i < 18; i += 1) {
      const x = size * (0.1 + rng() * 0.8);
      const y = size * (0.2 + rng() * 0.62);
      const h = size * (0.02 + rng() * 0.035);
      g.beginPath();
      g.moveTo(x, y + h);
      g.lineTo(x + size * 0.01, y - h);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "forest") {
    g.save();
    g.strokeStyle = "rgba(46, 74, 42, 0.2)";
    g.lineWidth = Math.max(0.7, size * 0.012);
    for (let i = 0; i < 5; i += 1) {
      const x = size * (0.16 + rng() * 0.68);
      const top = size * (0.2 + rng() * 0.18);
      const bottom = size * (0.66 + rng() * 0.16);
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x, bottom);
      g.stroke();
    }
    g.fillStyle = "rgba(66, 112, 62, 0.16)";
    for (let i = 0; i < 10; i += 1) {
      const cx = size * (0.14 + rng() * 0.72);
      const cy = size * (0.14 + rng() * 0.66);
      const r = size * (0.03 + rng() * 0.03);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }

  if (sector === "hills") {
    g.save();
    g.strokeStyle = "rgba(94, 126, 86, 0.18)";
    g.lineWidth = Math.max(0.8, size * 0.013);
    for (let i = 0; i < 4; i += 1) {
      const y = size * (0.22 + i * 0.18) + (variant - 2.5) * 0.12;
      g.beginPath();
      g.moveTo(size * 0.09, y);
      g.quadraticCurveTo(size * 0.38, y - size * 0.07, size * 0.7, y + size * 0.05);
      g.quadraticCurveTo(size * 0.82, y + size * 0.03, size * 0.92, y - size * 0.03);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "mountain") {
    g.save();
    g.strokeStyle = "rgba(58, 62, 76, 0.2)";
    g.lineWidth = Math.max(0.8, size * 0.013);
    for (let i = 0; i < 6; i += 1) {
      const x = size * (0.12 + rng() * 0.76);
      const y = size * (0.2 + rng() * 0.58);
      g.beginPath();
      g.moveTo(x - size * 0.05, y + size * 0.05);
      g.lineTo(x, y - size * 0.06);
      g.lineTo(x + size * 0.05, y + size * 0.05);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "city") {
    g.save();
    const stoneCount = 14 + Math.floor(rng() * 8);
    for (let i = 0; i < stoneCount; i += 1) {
      const cx = size * (0.1 + rng() * 0.8);
      const cy = size * (0.1 + rng() * 0.8);
      const w = size * (0.045 + rng() * 0.065);
      const h = size * (0.032 + rng() * 0.055);
      const r = Math.max(1, Math.min(w, h) * (0.24 + rng() * 0.22));
      const roll = rng();
      if (roll > 0.68) g.fillStyle = "rgba(98, 80, 62, 0.28)"; // dark brown stone
      else if (roll > 0.35) g.fillStyle = "rgba(62, 64, 70, 0.3)"; // dark grey stone
      else g.fillStyle = "rgba(126, 128, 134, 0.22)"; // light grey stone
      roundedRectPath(g, cx - w * 0.5, cy - h * 0.5, w, h, r);
      g.fill();
    }
    g.strokeStyle = "rgba(44, 42, 40, 0.2)";
    g.lineWidth = Math.max(0.65, size * 0.011);
    for (let i = 0; i < 4; i += 1) {
      const y = size * (0.2 + i * 0.18) + (variant - 2.5) * 0.1;
      g.beginPath();
      g.moveTo(size * 0.08, y + (rng() - 0.5) * size * 0.03);
      g.bezierCurveTo(
        size * 0.28,
        y - size * (0.02 + rng() * 0.02),
        size * 0.7,
        y + size * (0.02 + rng() * 0.03),
        size * 0.92,
        y + (rng() - 0.5) * size * 0.03
      );
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "water_swim" || sector === "water_noswim") {
    g.save();
    g.strokeStyle = "rgba(208, 232, 250, 0.18)";
    g.lineWidth = Math.max(0.7, size * 0.012);
    for (let i = 0; i < 5; i += 1) {
      const y = size * (0.16 + i * 0.16) + (variant - 2.5) * 0.12;
      g.beginPath();
      g.moveTo(size * 0.1, y);
      g.bezierCurveTo(size * 0.24, y - size * 0.03, size * 0.72, y + size * 0.03, size * 0.9, y);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "air") {
    g.save();
    g.fillStyle = "rgba(235, 245, 252, 0.18)";
    for (let i = 0; i < 6; i += 1) {
      const cx = size * (0.14 + rng() * 0.72);
      const cy = size * (0.18 + rng() * 0.64);
      const r = size * (0.024 + rng() * 0.03);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }

  if (sector === "desert") {
    g.save();
    g.strokeStyle = "rgba(150, 126, 82, 0.16)";
    g.lineWidth = Math.max(0.7, size * 0.012);
    for (let i = 0; i < 4; i += 1) {
      const y = size * (0.22 + i * 0.18) + (variant - 2.5) * 0.12;
      g.beginPath();
      g.moveTo(size * 0.1, y);
      g.bezierCurveTo(size * 0.28, y - size * 0.04, size * 0.74, y + size * 0.05, size * 0.92, y);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "swamp") {
    g.save();
    g.fillStyle = "rgba(98, 122, 88, 0.18)";
    for (let i = 0; i < 7; i += 1) {
      const cx = size * (0.12 + rng() * 0.76);
      const cy = size * (0.14 + rng() * 0.72);
      const rx = size * (0.03 + rng() * 0.05);
      const ry = size * (0.02 + rng() * 0.04);
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }

  if (sector === "lava") {
    g.save();
    g.strokeStyle = "rgba(248, 122, 44, 0.22)";
    g.lineWidth = Math.max(0.9, size * 0.014);
    for (let i = 0; i < 4; i += 1) {
      const y = size * (0.16 + i * 0.18) + (variant - 2.5) * 0.12;
      g.beginPath();
      g.moveTo(size * 0.1, y);
      g.bezierCurveTo(size * 0.3, y - size * 0.06, size * 0.68, y + size * 0.06, size * 0.9, y - size * 0.01);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (sector === "snow") {
    g.save();
    g.fillStyle = "rgba(252, 254, 255, 0.2)";
    for (let i = 0; i < 14; i += 1) {
      const cx = size * (0.1 + rng() * 0.8);
      const cy = size * (0.1 + rng() * 0.8);
      const r = size * (0.006 + rng() * 0.012);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

function drawEdgeContinuityBand(g, size, palette) {
  const edge = Math.max(2, Math.floor(size * 0.08));
  const dark = palette.edgeDark;
  const light = palette.edgeLight;

  for (let i = 0; i < size; i += 1) {
    const t = i / Math.max(1, size - 1);
    const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    const c = mixColor(dark, light, wave);
    g.fillStyle = colorToStyle(c, 0.34);
    g.fillRect(i, 0, 1, edge);
    g.fillRect(i, size - edge, 1, edge);
    g.fillRect(0, i, edge, 1);
    g.fillRect(size - edge, i, edge, 1);
  }
}

function drawInteriorGrain(g, size, rng, color, count, minR, maxR, inset) {
  const edgeInset = Math.max(2, inset);
  for (let i = 0; i < count; i += 1) {
    const x = edgeInset + rng() * Math.max(1, size - edgeInset * 2);
    const y = edgeInset + rng() * Math.max(1, size - edgeInset * 2);
    const r = minR + rng() * (maxR - minR);
    g.fillStyle = colorToStyle(color, 0.22 + rng() * 0.18);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function drawFieldTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 92, g: 134, b: 62 },
    grainA: { r: 122, g: 164, b: 84 },
    grainB: { r: 70, g: 108, b: 46 },
    edgeDark: { r: 62, g: 94, b: 40 },
    edgeLight: { r: 128, g: 170, b: 90 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.grainA, 32 + variant * 2, 0.8, 2.2, size * 0.11);
  drawInteriorGrain(g, size, rng, palette.grainB, 24 + variant, 0.6, 1.8, size * 0.11);

  g.strokeStyle = "rgba(178, 202, 120, 0.28)";
  for (let i = 0; i < 5; i += 1) {
    const y = size * (0.16 + i * 0.17) + (variant - 2.5) * 0.2;
    g.beginPath();
    g.moveTo(size * 0.1, y);
    g.bezierCurveTo(size * 0.3, y - size * 0.06, size * 0.7, y + size * 0.06, size * 0.9, y);
    g.stroke();
  }
}

function drawForestTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 34, g: 74, b: 44 },
    canopyA: { r: 52, g: 102, b: 60 },
    canopyB: { r: 30, g: 62, b: 36 },
    edgeDark: { r: 22, g: 48, b: 28 },
    edgeLight: { r: 58, g: 112, b: 68 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.canopyA, 24 + variant * 3, 1.1, 3.1, size * 0.1);
  drawInteriorGrain(g, size, rng, palette.canopyB, 20 + variant * 2, 1.0, 2.8, size * 0.1);

  g.strokeStyle = "rgba(78, 130, 84, 0.34)";
  g.lineWidth = Math.max(0.9, size * 0.016);
  for (let i = 0; i < 4; i += 1) {
    const x = size * (0.16 + i * 0.22) + (variant - 2.5) * 0.25;
    g.beginPath();
    g.moveTo(x, size * 0.16);
    g.lineTo(x + size * 0.03, size * 0.86);
    g.stroke();
  }
}

function drawHillsTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 148, g: 122, b: 84 },
    ridgeA: { r: 178, g: 146, b: 102 },
    ridgeB: { r: 114, g: 92, b: 62 },
    edgeDark: { r: 98, g: 78, b: 52 },
    edgeLight: { r: 192, g: 156, b: 110 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  const ridgeCount = 6;
  for (let i = 0; i < ridgeCount; i += 1) {
    const y = size * (0.12 + i * 0.16) + (variant - 2.5) * 0.2;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.ridgeA, 0.4) : colorToStyle(palette.ridgeB, 0.34);
    g.lineWidth = Math.max(1.2, size * 0.02);
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.bezierCurveTo(
      size * 0.24,
      y - size * (0.07 + rng() * 0.03),
      size * 0.52,
      y + size * (0.06 + rng() * 0.03),
      size * 0.72,
      y - size * (0.04 + rng() * 0.03)
    );
    g.bezierCurveTo(
      size * 0.8,
      y - size * (0.02 + rng() * 0.02),
      size * 0.88,
      y + size * (0.04 + rng() * 0.03),
      size * 0.94,
      y - size * (0.03 + rng() * 0.02)
    );
    g.stroke();
  }

  drawInteriorGrain(g, size, rng, palette.ridgeB, 18 + variant * 2, 0.55, 1.35, size * 0.1);
}

function drawMountainTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 88, g: 92, b: 104 },
    facetA: { r: 122, g: 128, b: 142 },
    facetB: { r: 60, g: 64, b: 78 },
    edgeDark: { r: 54, g: 58, b: 70 },
    edgeLight: { r: 128, g: 132, b: 146 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  const tris = 12 + variant * 2;
  for (let i = 0; i < tris; i += 1) {
    const x = size * (0.1 + rng() * 0.8);
    const y = size * (0.12 + rng() * 0.76);
    const w = size * (0.07 + rng() * 0.14);
    const h = size * (0.05 + rng() * 0.12);
    g.fillStyle = i % 2 === 0 ? colorToStyle(palette.facetA, 0.3) : colorToStyle(palette.facetB, 0.3);
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x - w, y + h);
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
  }
}

function drawCityTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 96, g: 98, b: 102 },
    stoneA: { r: 138, g: 140, b: 144 },
    stoneB: { r: 76, g: 78, b: 84 },
    stoneBrown: { r: 112, g: 94, b: 76 },
    mortar: { r: 52, g: 50, b: 52 },
    edgeDark: { r: 62, g: 62, b: 66 },
    edgeLight: { r: 140, g: 136, b: 130 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  const rowH = Math.max(4.8, size * 0.115);
  const colW = Math.max(7.4, size * 0.16);
  const inset = Math.max(3, size * 0.1);
  let row = 0;
  for (let y = inset; y < size - inset - rowH * 0.6; y += rowH) {
    const offset = row % 2 === 0 ? 0 : colW * 0.5;
    for (let x = inset - colW; x < size - inset + colW; x += colW) {
      const cx = x + offset + colW * 0.5;
      const cy = y + rowH * 0.5;
      if (cx < inset || cx > size - inset) continue;

      const w = colW * (0.78 + (rng() - 0.5) * 0.18);
      const h = rowH * (0.72 + (rng() - 0.5) * 0.2);
      const radius = Math.max(1.2, Math.min(w, h) * 0.28);
      const roll = rng();
      g.fillStyle = roll > 0.72
        ? colorToStyle(palette.stoneBrown, 0.88)
        : (roll > 0.38 ? colorToStyle(palette.stoneA, 0.9) : colorToStyle(palette.stoneB, 0.88));
      roundedRectPath(g, cx - w * 0.5, cy - h * 0.5, w, h, radius);
      g.fill();

      g.strokeStyle = colorToStyle(palette.mortar, 0.42);
      g.lineWidth = Math.max(0.55, size * 0.011);
      g.stroke();
    }
    row += 1;
  }

  // Faint road wear bands for less rigid, used-in traffic feel.
  g.strokeStyle = "rgba(44, 42, 40, 0.2)";
  g.lineWidth = Math.max(1.2, size * 0.023);
  for (let i = 0; i < 2; i += 1) {
    const y = size * (0.33 + i * 0.28) + (variant - 2.5) * 0.25;
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.bezierCurveTo(size * 0.26, y - size * 0.03, size * 0.72, y + size * 0.03, size * 0.92, y - size * 0.01);
    g.stroke();
  }
}

function drawSwampTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 62, g: 80, b: 54 },
    mudA: { r: 88, g: 104, b: 72 },
    mudB: { r: 48, g: 62, b: 42 },
    edgeDark: { r: 36, g: 48, b: 32 },
    edgeLight: { r: 96, g: 118, b: 84 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.mudA, 32 + variant * 2, 1.2, 3.2, size * 0.1);
  drawInteriorGrain(g, size, rng, palette.mudB, 26 + variant, 0.9, 2.8, size * 0.1);

  g.fillStyle = "rgba(112, 142, 126, 0.24)";
  for (let i = 0; i < 6; i += 1) {
    const x = size * (0.12 + rng() * 0.76);
    const y = size * (0.12 + rng() * 0.76);
    const rx = size * (0.045 + rng() * 0.06);
    const ry = size * (0.03 + rng() * 0.05);
    g.beginPath();
    g.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = "rgba(84, 108, 76, 0.28)";
  g.lineWidth = Math.max(0.8, size * 0.014);
  for (let i = 0; i < 4; i += 1) {
    const x0 = size * (0.12 + rng() * 0.76);
    const y0 = size * (0.12 + rng() * 0.76);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 + size * (0.05 + rng() * 0.08), y0 - size * (0.08 + rng() * 0.12));
    g.stroke();
  }
}

function drawWaterTexture(g, size, variant, rng, isShallow) {
  const palette = isShallow
    ? {
        base: { r: 42, g: 92, b: 126 },
        waveA: { r: 84, g: 142, b: 178 },
        waveB: { r: 28, g: 68, b: 102 },
        edgeDark: { r: 24, g: 58, b: 86 },
        edgeLight: { r: 96, g: 160, b: 196 }
      }
    : {
        base: { r: 24, g: 56, b: 86 },
        waveA: { r: 56, g: 104, b: 146 },
        waveB: { r: 16, g: 40, b: 64 },
        edgeDark: { r: 12, g: 30, b: 52 },
        edgeLight: { r: 68, g: 122, b: 168 }
      };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  g.lineWidth = Math.max(1, size * 0.017);
  for (let i = 0; i < 6; i += 1) {
    const y = size * (0.11 + i * 0.15) + (variant - 2.5) * 0.2;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.waveA, 0.34) : colorToStyle(palette.waveB, 0.28);
    g.beginPath();
    g.moveTo(size * 0.07, y);
    g.bezierCurveTo(size * 0.22, y - size * (0.04 + rng() * 0.02), size * 0.72, y + size * (0.04 + rng() * 0.03), size * 0.93, y - size * 0.01);
    g.stroke();
  }
}

function drawAirTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 132, g: 180, b: 218 },
    cloudA: { r: 224, g: 238, b: 248 },
    cloudB: { r: 176, g: 208, b: 232 },
    edgeDark: { r: 96, g: 142, b: 182 },
    edgeLight: { r: 210, g: 232, b: 246 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  const cloudCount = 6 + variant;
  for (let i = 0; i < cloudCount; i += 1) {
    const cx = size * (0.12 + rng() * 0.76);
    const cy = size * (0.16 + rng() * 0.68);
    const r = size * (0.05 + rng() * 0.05);
    const color = i % 2 === 0 ? palette.cloudA : palette.cloudB;
    g.fillStyle = colorToStyle(color, 0.42 + rng() * 0.14);
    g.beginPath();
    g.arc(cx - r * 0.45, cy, r * 0.8, 0, Math.PI * 2);
    g.arc(cx + r * 0.15, cy - r * 0.2, r, 0, Math.PI * 2);
    g.arc(cx + r * 0.72, cy, r * 0.72, 0, Math.PI * 2);
    g.fill();
  }
}

function drawDesertTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 186, g: 162, b: 112 },
    duneA: { r: 210, g: 184, b: 132 },
    duneB: { r: 154, g: 132, b: 90 },
    grain: { r: 132, g: 112, b: 72 },
    edgeDark: { r: 138, g: 114, b: 76 },
    edgeLight: { r: 218, g: 194, b: 144 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  g.lineWidth = Math.max(1, size * 0.017);
  for (let i = 0; i < 6; i += 1) {
    const y = size * (0.1 + i * 0.14) + (variant - 2.5) * 0.18;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.duneA, 0.3) : colorToStyle(palette.duneB, 0.26);
    g.beginPath();
    g.moveTo(size * 0.06, y);
    g.bezierCurveTo(size * 0.2, y - size * (0.03 + rng() * 0.02), size * 0.62, y + size * (0.04 + rng() * 0.02), size * 0.94, y - size * 0.01);
    g.stroke();
  }

  drawInteriorGrain(g, size, rng, palette.grain, 34 + variant * 3, 0.45, 1.25, size * 0.1);
}

function drawMeadowTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 102, g: 142, b: 78 },
    grassA: { r: 138, g: 176, b: 102 },
    grassB: { r: 82, g: 120, b: 60 },
    edgeDark: { r: 68, g: 102, b: 50 },
    edgeLight: { r: 154, g: 190, b: 116 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.grassA, 30 + variant * 2, 0.7, 1.9, size * 0.1);
  drawInteriorGrain(g, size, rng, palette.grassB, 24 + variant, 0.5, 1.5, size * 0.1);

  g.strokeStyle = colorToStyle(palette.grassA, 0.3);
  g.lineWidth = Math.max(0.8, size * 0.013);
  for (let i = 0; i < 8; i += 1) {
    const x = size * (0.1 + rng() * 0.8);
    const y = size * (0.16 + rng() * 0.7);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + size * 0.02, y - size * (0.04 + rng() * 0.03));
    g.stroke();
  }
}

function drawCaveTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 70, g: 68, b: 66 },
    rockA: { r: 106, g: 102, b: 98 },
    rockB: { r: 52, g: 50, b: 48 },
    edgeDark: { r: 44, g: 42, b: 40 },
    edgeLight: { r: 118, g: 112, b: 106 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.rockA, 24 + variant * 2, 1, 2.8, size * 0.1);
  drawInteriorGrain(g, size, rng, palette.rockB, 30 + variant * 2, 0.7, 2.2, size * 0.1);

  g.strokeStyle = colorToStyle(palette.rockA, 0.24);
  g.lineWidth = Math.max(0.8, size * 0.014);
  for (let i = 0; i < 4; i += 1) {
    const y = size * (0.18 + i * 0.2);
    g.beginPath();
    g.moveTo(size * 0.08, y + (rng() - 0.5) * size * 0.04);
    g.lineTo(size * 0.92, y + (rng() - 0.5) * size * 0.04);
    g.stroke();
  }
}

function drawDungeonTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 64, g: 62, b: 68 },
    stoneA: { r: 96, g: 94, b: 104 },
    stoneB: { r: 44, g: 42, b: 50 },
    mortar: { r: 28, g: 26, b: 32 },
    edgeDark: { r: 36, g: 34, b: 40 },
    edgeLight: { r: 110, g: 106, b: 116 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  const rowH = Math.max(4.8, size * 0.13);
  const colW = Math.max(7.6, size * 0.18);
  const inset = Math.max(3, size * 0.1);
  let row = 0;
  for (let y = inset; y < size - inset - rowH * 0.5; y += rowH) {
    const offset = row % 2 === 0 ? 0 : colW * 0.5;
    for (let x = inset - colW; x < size - inset + colW; x += colW) {
      const cx = x + offset + colW * 0.5;
      const cy = y + rowH * 0.5;
      if (cx < inset || cx > size - inset) continue;

      const w = colW * (0.8 + (rng() - 0.5) * 0.16);
      const h = rowH * (0.72 + (rng() - 0.5) * 0.18);
      const roll = rng();
      g.fillStyle = roll > 0.5
        ? colorToStyle(palette.stoneA, 0.88)
        : colorToStyle(palette.stoneB, 0.86);
      roundedRectPath(g, cx - w * 0.5, cy - h * 0.5, w, h, Math.max(1.1, Math.min(w, h) * 0.22));
      g.fill();
      g.strokeStyle = colorToStyle(palette.mortar, 0.46);
      g.lineWidth = Math.max(0.5, size * 0.01);
      g.stroke();
    }
    row += 1;
  }
}

function drawLavaTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 42, g: 24, b: 18 },
    flowA: { r: 232, g: 102, b: 24 },
    flowB: { r: 184, g: 46, b: 14 },
    glow: { r: 255, g: 168, b: 52 },
    edgeDark: { r: 30, g: 16, b: 12 },
    edgeLight: { r: 198, g: 84, b: 24 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  g.lineCap = "round";
  g.lineWidth = Math.max(1.4, size * 0.026);
  for (let i = 0; i < 5; i += 1) {
    const y = size * (0.1 + i * 0.18) + (variant - 2.5) * 0.22;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.flowA, 0.54) : colorToStyle(palette.flowB, 0.5);
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.bezierCurveTo(size * 0.3, y - size * 0.08, size * 0.66, y + size * 0.08, size * 0.92, y - size * 0.02);
    g.stroke();
  }

  drawInteriorGrain(g, size, rng, palette.glow, 14 + variant, 0.8, 2.1, size * 0.1);
}

function drawSnowTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 224, g: 232, b: 236 },
    driftA: { r: 248, g: 252, b: 254 },
    driftB: { r: 188, g: 204, b: 214 },
    edgeDark: { r: 172, g: 188, b: 198 },
    edgeLight: { r: 250, g: 254, b: 255 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);

  g.lineWidth = Math.max(0.9, size * 0.014);
  g.strokeStyle = colorToStyle(palette.driftB, 0.28);
  for (let i = 0; i < 4; i += 1) {
    const y = size * (0.18 + i * 0.2) + (variant - 2.5) * 0.14;
    g.beginPath();
    g.moveTo(size * 0.07, y);
    g.quadraticCurveTo(size * 0.46, y - size * 0.05, size * 0.93, y + size * 0.01);
    g.stroke();
  }

  drawInteriorGrain(g, size, rng, palette.driftA, 28 + variant * 2, 0.6, 1.6, size * 0.1);
}

function drawIceTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 198, g: 222, b: 238 },
    crackA: { r: 140, g: 176, b: 204 },
    crackB: { r: 118, g: 156, b: 186 },
    edgeDark: { r: 128, g: 160, b: 186 },
    edgeLight: { r: 224, g: 240, b: 250 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  g.lineWidth = Math.max(0.85, size * 0.013);
  for (let i = 0; i < 6; i += 1) {
    const x0 = size * (0.1 + rng() * 0.8);
    const y0 = size * (0.1 + rng() * 0.8);
    const x1 = x0 + size * (rng() - 0.5) * 0.42;
    const y1 = y0 + size * (rng() - 0.5) * 0.42;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.crackA, 0.34) : colorToStyle(palette.crackB, 0.3);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
}

function drawVillageTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 150, g: 126, b: 94 },
    roadA: { r: 122, g: 98, b: 70 },
    roadB: { r: 176, g: 152, b: 118 },
    edgeDark: { r: 106, g: 84, b: 60 },
    edgeLight: { r: 190, g: 164, b: 128 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  g.strokeStyle = colorToStyle(palette.roadA, 0.4);
  g.lineWidth = Math.max(1, size * 0.02);
  for (let i = 0; i < 3; i += 1) {
    const y = size * (0.22 + i * 0.26) + (variant - 2.5) * 0.16;
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.bezierCurveTo(size * 0.28, y - size * 0.03, size * 0.72, y + size * 0.03, size * 0.92, y);
    g.stroke();
  }
  drawInteriorGrain(g, size, rng, palette.roadB, 18 + variant * 2, 0.7, 1.8, size * 0.1);
}

function drawUnderwaterTexture(g, size, variant, rng) {
  drawWaterTexture(g, size, variant, rng, false);
  g.save();
  g.fillStyle = "rgba(86, 146, 196, 0.22)";
  g.fillRect(0, 0, size, size);
  g.restore();
}

function drawUnderwaterCaveTexture(g, size, variant, rng) {
  drawUnderwaterTexture(g, size, variant, rng);
  g.save();
  g.fillStyle = "rgba(46, 58, 74, 0.34)";
  for (let i = 0; i < 9; i += 1) {
    const x = size * (0.1 + rng() * 0.8);
    const y = size * (0.1 + rng() * 0.8);
    const r = size * (0.03 + rng() * 0.05);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawUnderwaterCityTexture(g, size, variant, rng) {
  drawUnderwaterTexture(g, size, variant, rng);
  g.save();
  g.strokeStyle = "rgba(160, 210, 226, 0.32)";
  g.lineWidth = Math.max(0.75, size * 0.012);
  for (let i = 0; i < 4; i += 1) {
    const y = size * (0.18 + i * 0.2);
    g.beginPath();
    g.moveTo(size * 0.12, y);
    g.lineTo(size * 0.88, y);
    g.stroke();
  }
  for (let i = 0; i < 3; i += 1) {
    const x = size * (0.2 + i * 0.24);
    g.beginPath();
    g.moveTo(x, size * 0.14);
    g.lineTo(x, size * 0.86);
    g.stroke();
  }
  g.restore();
}

function drawMesaTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 146, g: 96, b: 60 },
    ridgeA: { r: 184, g: 130, b: 86 },
    ridgeB: { r: 108, g: 72, b: 44 },
    edgeDark: { r: 92, g: 62, b: 38 },
    edgeLight: { r: 194, g: 138, b: 92 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  g.lineWidth = Math.max(1.1, size * 0.019);
  for (let i = 0; i < 5; i += 1) {
    const y = size * (0.12 + i * 0.17) + (variant - 2.5) * 0.2;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.ridgeA, 0.36) : colorToStyle(palette.ridgeB, 0.3);
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.lineTo(size * 0.92, y + size * (rng() - 0.5) * 0.05);
    g.stroke();
  }
}

function drawSewerTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 66, g: 84, b: 58 },
    sludgeA: { r: 94, g: 120, b: 78 },
    sludgeB: { r: 50, g: 66, b: 42 },
    edgeDark: { r: 42, g: 54, b: 34 },
    edgeLight: { r: 106, g: 128, b: 90 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  drawInteriorGrain(g, size, rng, palette.sludgeA, 28 + variant * 2, 1.1, 2.8, size * 0.1);
  drawInteriorGrain(g, size, rng, palette.sludgeB, 22 + variant * 2, 0.8, 2.2, size * 0.1);
}

function drawCryptTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 64, g: 56, b: 74 },
    stoneA: { r: 94, g: 84, b: 108 },
    stoneB: { r: 44, g: 40, b: 54 },
    edgeDark: { r: 36, g: 32, b: 44 },
    edgeLight: { r: 106, g: 96, b: 120 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  g.strokeStyle = colorToStyle(palette.stoneA, 0.34);
  g.lineWidth = Math.max(0.9, size * 0.014);
  g.beginPath();
  g.moveTo(size * 0.2, size * 0.72);
  g.lineTo(size * 0.8, size * 0.72);
  g.moveTo(size * 0.5, size * 0.26);
  g.lineTo(size * 0.5, size * 0.84);
  g.stroke();
  drawInteriorGrain(g, size, rng, palette.stoneB, 16 + variant, 0.6, 1.6, size * 0.12);
}

function drawPlanarTexture(g, size, variant, rng) {
  const palette = {
    base: { r: 88, g: 58, b: 128 },
    riftA: { r: 168, g: 116, b: 220 },
    riftB: { r: 98, g: 188, b: 212 },
    edgeDark: { r: 58, g: 34, b: 94 },
    edgeLight: { r: 184, g: 126, b: 230 }
  };

  g.fillStyle = colorToStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  drawEdgeContinuityBand(g, size, palette);
  g.lineWidth = Math.max(1, size * 0.018);
  for (let i = 0; i < 5; i += 1) {
    const y = size * (0.14 + i * 0.16) + (variant - 2.5) * 0.2;
    g.strokeStyle = i % 2 === 0 ? colorToStyle(palette.riftA, 0.36) : colorToStyle(palette.riftB, 0.34);
    g.beginPath();
    g.moveTo(size * 0.08, y);
    g.bezierCurveTo(size * 0.26, y - size * 0.06, size * 0.74, y + size * 0.06, size * 0.92, y);
    g.stroke();
  }
}

function roundedRectPath(g, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function renderProceduralSectorFallback(g, sector, variant, size) {
  const seed = hashStringFNV1a(`${sector}:${variant}:fallback`);
  const rng = mulberry32(seed);

  if (sector === "field") return drawFieldTexture(g, size, variant, rng);
  if (sector === "village") return drawVillageTexture(g, size, variant, rng);
  if (sector === "meadow") return drawMeadowTexture(g, size, variant, rng);
  if (sector === "forest") return drawForestTexture(g, size, variant, rng);
  if (sector === "deep_forest") return drawForestTexture(g, size, variant + 2, rng);
  if (sector === "hills") return drawHillsTexture(g, size, variant, rng);
  if (sector === "mesa") return drawMesaTexture(g, size, variant, rng);
  if (sector === "mountain") return drawMountainTexture(g, size, variant, rng);
  if (sector === "cave") return drawCaveTexture(g, size, variant, rng);
  if (sector === "dungeon") return drawDungeonTexture(g, size, variant, rng);
  if (sector === "crypt") return drawCryptTexture(g, size, variant, rng);
  if (sector === "sewer") return drawSewerTexture(g, size, variant, rng);
  if (sector === "city") return drawCityTexture(g, size, variant, rng);
  if (sector === "swamp") return drawSwampTexture(g, size, variant, rng);
  if (sector === "water_swim") return drawWaterTexture(g, size, variant, rng, true);
  if (sector === "water_noswim") return drawWaterTexture(g, size, variant, rng, false);
  if (sector === "underwater") return drawUnderwaterTexture(g, size, variant, rng);
  if (sector === "underwater_cave") return drawUnderwaterCaveTexture(g, size, variant, rng);
  if (sector === "underwater_city") return drawUnderwaterCityTexture(g, size, variant, rng);
  if (sector === "air") return drawAirTexture(g, size, variant, rng);
  if (sector === "ice") return drawIceTexture(g, size, variant, rng);
  if (sector === "desert") return drawDesertTexture(g, size, variant, rng);
  if (sector === "lava") return drawLavaTexture(g, size, variant, rng);
  if (sector === "volcanic") return drawLavaTexture(g, size, variant + 1, rng);
  if (sector === "snow") return drawSnowTexture(g, size, variant, rng);
  if (sector === "ruins") return drawCityTexture(g, size, variant + 2, rng);
  if (sector === "planar") return drawPlanarTexture(g, size, variant, rng);

  g.fillStyle = "#1f2f3f";
  g.fillRect(0, 0, size, size);
}

function getSectorVariantTone(sector, variant, rng) {
  const palettes = {
    city: [
      "rgba(126, 116, 102, 0.08)",
      "rgba(94, 100, 108, 0.09)",
      "rgba(112, 104, 90, 0.08)",
      "rgba(88, 96, 104, 0.09)",
      "rgba(130, 118, 106, 0.08)"
    ],
    field: [
      "rgba(204, 178, 88, 0.1)",
      "rgba(174, 148, 66, 0.09)",
      "rgba(188, 164, 80, 0.09)",
      "rgba(166, 142, 62, 0.1)",
      "rgba(196, 170, 86, 0.08)"
    ],
    forest: [
      "rgba(62, 96, 74, 0.1)",
      "rgba(48, 80, 60, 0.1)",
      "rgba(70, 102, 80, 0.09)",
      "rgba(54, 84, 66, 0.1)",
      "rgba(74, 110, 86, 0.08)"
    ],
    mountain: [
      "rgba(116, 80, 56, 0.1)",
      "rgba(96, 66, 44, 0.11)",
      "rgba(126, 90, 62, 0.09)",
      "rgba(104, 72, 50, 0.1)",
      "rgba(134, 96, 66, 0.08)"
    ],
    swamp: [
      "rgba(86, 118, 84, 0.1)",
      "rgba(66, 96, 66, 0.1)",
      "rgba(98, 126, 90, 0.09)",
      "rgba(72, 104, 70, 0.1)",
      "rgba(102, 130, 96, 0.08)"
    ],
    default: [
      "rgba(170, 170, 170, 0.06)",
      "rgba(120, 120, 120, 0.07)",
      "rgba(190, 190, 190, 0.05)",
      "rgba(128, 128, 128, 0.07)",
      "rgba(176, 176, 176, 0.05)"
    ]
  };

  const tones = palettes[sector] || palettes.default;
  const idx = (variant + Math.floor(rng() * tones.length)) % tones.length;
  return tones[idx];
}

function applySectorVariantTone(g, size, sector, variant, rng) {
  if (variant <= 0) return;

  const tone = getSectorVariantTone(sector, variant, rng);
  const offset = (variant % 3) * Math.max(1, Math.floor(size * 0.03));

  g.save();
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = tone;
  g.fillRect(0, 0, size, size);

  g.globalCompositeOperation = "multiply";
  g.fillStyle = "rgba(0, 0, 0, 0.03)";
  const stripeStep = Math.max(6, Math.floor(size * 0.16));
  for (let x = -stripeStep + offset; x < size + stripeStep; x += stripeStep) {
    g.fillRect(x, 0, Math.max(1, Math.floor(size * 0.02)), size);
  }
  g.restore();
}

function renderSectorVariantTile(g, baseIcon, sector, variant, size) {
  // When an SVG tile exists, treat it as authoritative art.
  // Layering the procedural fallback on top causes doubled symbols and ghost imagery.
  if (baseIcon) {
    g.drawImage(baseIcon, 0, 0, size, size);
  } else if (TEXTURED_SECTORS.has(sector)) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = size;
    textureCanvas.height = size;
    const tg = textureCanvas.getContext("2d");
    if (tg) {
      renderProceduralSectorFallback(tg, sector, variant, size);
      g.drawImage(textureCanvas, 0, 0, size, size);
    }
  }
}

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
  if (msg.type === "frmapper.theme" && msg.payload && typeof msg.payload === "object") {
    applyFrmapperTheme(msg.payload.themeId || FRMAPPER_THEME_DEFAULT);
  }
  if (msg.type === "frmapper.identity" && msg.payload && typeof msg.payload === "object") {
    updateStorageIdentity(msg.payload);
  }
  if (msg.type === "frmapper.attached") {
    const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    const gmcpNegotiated = !!payload.gmcpNegotiated;
    const gmcpEnabled = !!payload.gmcpEnabled;
    updateStorageIdentity({
      characterName: payload.characterName,
      realm: payload.testRealm ? "test" : (state.sessionRealm || "public")
    });
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
  if (msg.type === "frmapper.groupVitals" && msg.payload) {
    mergePartyVitals(msg.payload);
  }
  if (msg.type === "frmapper.groupPosition" && msg.payload) {
    mergePartyPosition(msg.payload);
  }
  if (msg.type === "frmapper.roomMobs" && msg.payload) {
    updateRoomMobs(msg.payload);
  }
  if (msg.type === "frmapper.roomStatus" && msg.payload) {
    // Room.Status carries dynamic light data; frmapper stores it for overlay use.
    state.roomStatus = msg.payload;
  }
  if (msg.type === "frmapper.roomMobHint" && msg.payload) {
    // Room.MobHint carries nearby_mobs and scan_range for minimap overlays.
    ingestRoomMobHint(msg.payload);
  }
  if (msg.type === "frmapper.trackedChars" && msg.payload) {
    ingestTrackedDelta("chars", msg.payload);
  }
  if (msg.type === "frmapper.trackedMobs" && msg.payload) {
    ingestTrackedDelta("mobs", msg.payload);
  }
  if (msg.type === "frmapper.centerOn" && msg.payload) {
    centerOnPayload(msg.payload);
  }
  if (msg.type === "frmapper.moveTo" && msg.payload) {
    moveToPayload(msg.payload);
  }
  if (msg.type === "frmapper.clearArea" && msg.payload) {
    const gridId = String(msg.payload.gridId || msg.payload.grid_id || "");
    const areaID = msg.payload.areaID ?? msg.payload.area_id ?? null;
    if (gridId) clearAreaByGridId(gridId, areaID != null ? Number(areaID) : null);
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

function notifyHostInteraction(kind) {
  if (state.sessionMode !== "embed") return;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "frmapper.interaction",
        payload: { kind: String(kind || "generic") }
      }, "*");
    }
  } catch (_error) {
    // Host integration is optional; ignore cross-origin messaging failures.
  }
}

function sanitizeStorageToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveStorageRealm() {
  const realm = sanitizeStorageToken(state.storageRealm || state.sessionRealm || "public");
  return realm || "public";
}

function buildStorageNamespace(opts) {
  const options = opts || {};
  const mode = options.mode ? String(options.mode) : state.sessionMode;
  const realm = sanitizeStorageToken(options.realm || resolveStorageRealm()) || "public";
  const characterName = sanitizeStorageToken(options.characterName || state.storageCharacterName);
  const token = sanitizeStorageToken(options.sessionToken || state.sessionToken);

  if (characterName) return `${realm}:char:${characterName}`;
  if (mode === "ws" && token) return `${realm}:session:${token}`;
  if (mode === "embed") return `${realm}:embed`;
  return `${realm}:anon`;
}

function storageKeyForNamespace(namespace) {
  return `${STORAGE_KEY_PREFIX}:${namespace}`;
}

function activeStorageKey() {
  if (state.sessionMode === "anon") return "";
  state.storageNamespace = buildStorageNamespace();
  state.storageKey = storageKeyForNamespace(state.storageNamespace);
  return state.storageKey;
}

function loadPersistedMapFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rooms)) return false;
    applyMapObject(parsed);
    state.storageLoadedKey = key;
    return true;
  } catch (_error) {
    return false;
  }
}

function storageLoadCandidates() {
  if (state.sessionMode === "anon") return [];
  const out = [];
  const seen = new Set();
  const push = (key) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  push(storageKeyForNamespace(buildStorageNamespace()));

  return out;
}

function updateStorageIdentity(identity) {
  const nextName = sanitizeStorageToken(identity && identity.characterName);
  const nextRealm = sanitizeStorageToken(identity && identity.realm) || resolveStorageRealm();
  let changed = false;

  if (nextName && nextName !== state.storageCharacterName) {
    state.storageCharacterName = nextName;
    changed = true;
  }
  if (nextRealm && nextRealm !== state.storageRealm) {
    state.storageRealm = nextRealm;
    changed = true;
  }

  if (!changed) return;

  const nextKey = activeStorageKey();
  if (nextKey === state.storageLoadedKey) return;

  if (loadPersistedMapFromKey(nextKey)) {
    fitToView({ zoom: 1 });
    state.pendingInitialSnap = true;
    render();
    return;
  }

  resetToEmptyMap();
  state.storageLoadedKey = nextKey;
}

const el = {
  embedToggle: document.getElementById("embed-toggle"),
  embedQuickControls: document.getElementById("embed-quick-controls"),
  embedZDown: document.getElementById("embed-z-down"),
  embedZUp: document.getElementById("embed-z-up"),
  embedZLabel: document.getElementById("embed-z-label"),
  embedRoomMeta: document.getElementById("embed-room-meta"),
  embedRoomNsid: document.getElementById("embed-room-nsid"),
  embedRoomEph: document.getElementById("embed-room-eph"),
  embedLocalIdToggle: document.getElementById("embed-localid-toggle"),
  embedFollow: document.getElementById("embed-follow"),
  embedQuickTooltip: document.getElementById("embed-quick-tooltip"),
  canvas: document.getElementById("map-canvas"),
  zoomRange: document.getElementById("zoom-range"),
  zoomValue: document.getElementById("zoom-value"),
  gridId: document.getElementById("grid-id"),
  zLevel: document.getElementById("z-level"),
  toggleParty: document.getElementById("toggle-party"),
  toggleMobs: document.getElementById("toggle-mobs"),
  toggleTraveledPath: document.getElementById("toggle-traveled-path"),
  toggleFog: document.getElementById("toggle-fog"),
  toggleGridOutline: document.getElementById("toggle-grid-outline"),
  togglePerfStats: document.getElementById("toggle-perf-stats"),
  perfStats: document.getElementById("perf-stats"),
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
  syncFrmapperThemeFromSitePreference();
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
  if (el.embedQuickControls) el.embedQuickControls.hidden = false;
  applyEmbedToggleState(false);
  updateEmbedQuickControls();
  el.embedToggle.addEventListener("click", () => {
    setEmbedControlsExpanded(undefined);
  });

  if (el.embedLocalIdToggle) {
    el.embedLocalIdToggle.addEventListener("click", () => {
      state.showLocalIds = !state.showLocalIds;
      updateEmbedQuickControls();
      scheduleRender();
    });
  }
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

function updateEmbedQuickControls() {
  if (!state.isEmbedMode) return;
  const quickFade = Math.max(0.24, Math.min(1, wallOpacityForZoomValue(state.zoom || 1)));
  document.body.style.setProperty("--fm-embed-z-fade", String(quickFade.toFixed(3)));

  if (el.embedZLabel) {
    el.embedZLabel.textContent = `z=${state.activeZ}`;
  }
  if (el.embedRoomMeta && el.embedRoomNsid && el.embedRoomEph) {
    let room = null;
    if (state.playerRoomId) {
      room = state.roomsById.get(String(state.playerRoomId)) || null;
    }
    if (!room && state.playerLocation) {
      const id = state.roomByCoord.get(coordKey(
        state.playerLocation.x,
        state.playerLocation.y,
        state.playerLocation.z,
        state.playerLocation.gridId
      ));
      room = id ? state.roomsById.get(id) || null : null;
    }

    if (!room) {
      el.embedRoomMeta.hidden = true;
      el.embedRoomNsid.textContent = "NSID: --";
      el.embedRoomEph.textContent = "ephNum: --";
    } else {
      const hasArea = room.areaID != null && Number.isFinite(Number(room.areaID));
      const hasLocal = room.localID != null && Number.isFinite(Number(room.localID));
      const nsidText = hasArea && hasLocal ? `${room.areaID}:${room.localID}` : "";
      const nsidValid = nsidText && !nsidText.includes("null") && !nsidText.includes("undefined");
      if (!nsidValid) {
        el.embedRoomMeta.hidden = true;
      } else {
        const eph = room.ephNum != null && String(room.ephNum).trim() ? String(room.ephNum) : "--";
        el.embedRoomNsid.textContent = `NSID: ${nsidText}`;
        el.embedRoomEph.textContent = `ephNum: ${eph}`;
        el.embedRoomMeta.hidden = false;
      }
    }
  }
  if (el.embedLocalIdToggle) {
    el.embedLocalIdToggle.setAttribute("aria-pressed", state.showLocalIds ? "true" : "false");
    el.embedLocalIdToggle.textContent = state.showLocalIds ? "IDs On" : "IDs Off";
    el.embedLocalIdToggle.setAttribute(
      "title",
      state.showLocalIds ? "Hide localID labels on map" : "Show localID labels on map"
    );
  }
  if (el.embedFollow) {
    el.embedFollow.classList.toggle("active", !!state.followPlayer);
    el.embedFollow.setAttribute("aria-pressed", state.followPlayer ? "true" : "false");
    el.embedFollow.setAttribute(
      "aria-label",
      state.followPlayer ? "Follow player enabled" : "Follow player disabled"
    );
  }
}

function showEmbedQuickTooltip(sourceEl, message) {
  if (!el.embedQuickTooltip || !sourceEl || !message) return;
  const wrap = el.canvas.parentElement;
  if (!wrap) return;
  const wrapRect = wrap.getBoundingClientRect();
  const sourceRect = sourceEl.getBoundingClientRect();

  el.embedQuickTooltip.textContent = message;
  el.embedQuickTooltip.hidden = false;

  const preferredLeft = sourceRect.left - wrapRect.left + (sourceRect.width / 2) - (el.embedQuickTooltip.offsetWidth / 2);
  const preferredTop = sourceRect.bottom - wrapRect.top + 6;
  const pos = clampTooltipPositionInWrap(wrap, el.embedQuickTooltip, preferredLeft, preferredTop);

  el.embedQuickTooltip.style.left = `${Math.round(pos.left)}px`;
  el.embedQuickTooltip.style.top = `${Math.round(pos.top)}px`;
  el.embedQuickTooltip.style.transform = "none";
}

function hideEmbedQuickTooltip() {
  if (!el.embedQuickTooltip) return;
  el.embedQuickTooltip.hidden = true;
}

function stepActiveZ(delta) {
  if (!Array.isArray(state.zLevels) || state.zLevels.length === 0) return;
  const currentIndex = state.zLevels.indexOf(state.activeZ);
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(0, Math.min(state.zLevels.length - 1, baseIndex + delta));
  if (nextIndex === baseIndex) return;
  state.activeZ = state.zLevels[nextIndex];
  state.selectedRoomId = null;
  updateInspector();
  syncZLevels();
  scheduleRender();
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
    updateEmbedQuickControls();
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
    updateEmbedQuickControls();
    scheduleRender();
  });

  if (state.isEmbedMode && el.embedZDown) {
    el.embedZDown.addEventListener("click", () => {
      stepActiveZ(-1);
    });
    el.embedZDown.addEventListener("mouseenter", () => showEmbedQuickTooltip(el.embedZDown, "Lower z-layer"));
    el.embedZDown.addEventListener("mouseleave", hideEmbedQuickTooltip);
  }

  if (state.isEmbedMode && el.embedZUp) {
    el.embedZUp.addEventListener("click", () => {
      stepActiveZ(1);
    });
    el.embedZUp.addEventListener("mouseenter", () => showEmbedQuickTooltip(el.embedZUp, "Higher z-layer"));
    el.embedZUp.addEventListener("mouseleave", hideEmbedQuickTooltip);
  }

  if (state.isEmbedMode && el.embedFollow) {
    el.embedFollow.addEventListener("click", () => {
      state.followPlayer = !state.followPlayer;
      updateEmbedQuickControls();
      if (state.followPlayer && state.playerRoomId) {
        const room = state.roomsById.get(state.playerRoomId);
        if (room) {
          setActiveLayerFromRoom(room);
          const targetPan = panForRoom(room);
          startPanAnimation(targetPan.x, targetPan.y, 180, null, null);
        }
      }
    });
    el.embedFollow.addEventListener("mouseenter", () => {
      const msg = state.followPlayer
        ? "Follow Player enabled: auto-center on player movement"
        : "Follow Player disabled: keep map position while player moves";
      showEmbedQuickTooltip(el.embedFollow, msg);
    });
    el.embedFollow.addEventListener("mouseleave", hideEmbedQuickTooltip);
  }

  if (state.isEmbedMode && el.embedQuickControls) {
    el.embedQuickControls.addEventListener("focusout", (event) => {
      if (!el.embedQuickControls.contains(event.relatedTarget)) {
        hideEmbedQuickTooltip();
      }
    });
  }

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

  if (el.toggleGridOutline) {
    el.toggleGridOutline.addEventListener("change", () => {
      state.showGridOutline = !!el.toggleGridOutline.checked;
      scheduleRender();
    });
  }

  if (el.togglePerfStats) {
    el.togglePerfStats.addEventListener("change", () => {
      state.showPerfStats = !!el.togglePerfStats.checked;
      updatePerfStatsPanel(true);
      scheduleRender();
    });
  }
  updatePerfStatsPanel(true);

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
    notifyHostInteraction("pan-start");
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

  window.addEventListener("mouseup", () => {
    endCanvasDrag();
    notifyHostInteraction("pan-end");
  });
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
    updateEmbedQuickControls();
    scheduleRender();
    notifyHostInteraction("zoom");
  }, { passive: false });

  el.canvas.addEventListener("click", (event) => {
    hideContextMenu();
    const room = pickRoomAt(event.clientX, event.clientY);
    state.selectedRoomId = room ? room.id : null;
    updateInspector();
    scheduleRender();
    notifyHostInteraction("click");
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
    const areaID = room.areaID;
    const areaName = room.area || (areaID != null ? String(areaID) : gridId || "default");
    if (!window.confirm(`Remove all rooms in area "${areaName}"? This cannot be undone.`)) return;
    clearAreaByGridId(gridId, areaID);
  });

  el.menuClearMap.addEventListener("click", () => {
    hideContextMenu();
    clearMapWithConfirmation();
  });

  startFrmapperSessionMode();

  window.addEventListener("message", (event) => {
    handleSessionMessage(event.data);
  });

  window.addEventListener("storage", (event) => {
    if (!event || event.key !== SITE_THEME_KEY) return;
    syncFrmapperThemeFromSitePreference();
  });

  window.addEventListener("freign-theme-changed", (event) => {
    const detail = event && event.detail && typeof event.detail === "object" ? event.detail : null;
    if (detail && detail.themeId) {
      applyFrmapperTheme(detail.themeId);
      return;
    }
    syncFrmapperThemeFromSitePreference();
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
  state.partyMemberLastPos = new Map();
  state.jellyFollowers = new Map();
  state.roomMobs = [];
  state.roomMobsSeenAt = 0;
  state.tempMobDotByRoom = new Map();
  state.trackedChars = new Map();
  state.trackedMobs = new Map();
  state.partyMobUids = new Set();
  state.selectedRoomId = null;
  markStaticLayerDirty();
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
  markStaticLayerDirty();
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

  const rooms = data.rooms
    .map(normalizeRoom)
    .filter((room) => !!room);

  state.mapData = {
    version: data.version || "frmapper.v1",
    meta: data.meta || {},
    rooms
  };
  markStaticLayerDirty();
  state.playerLocation = null;
  state.movementTrail = [];
  state.partyMemberLastPos = new Map();
  state.jellyFollowers = new Map();
  state.roomMobs = [];
  state.roomMobsSeenAt = 0;
  state.tempMobDotByRoom = new Map();
  state.trackedChars = new Map();
  state.trackedMobs = new Map();
  state.partyMobUids = new Set();
  state.selectedRoomId = null;
  rebuildIndexes();
  syncZLevels();
  fitToView();
  updateInspector();
  persistMap();
  render();
}

function normalizeRoom(room) {
  if (!room || typeof room !== "object") return null;
  const parsedScanRange = Number.parseInt(room.scanRange, 10);
  const parsedLastSeenAt = Number.parseInt(room.lastSeenAt, 10);
  const hasName = !!(room.name && String(room.name).trim());
  const parsedEphNum = Number.parseInt(room.ephNum, 10);
  const parsedAreaID = Number.parseInt(room.areaID ?? room.areaId, 10);
  const parsedLocalID = Number.parseInt(room.localID ?? room.localId, 10);
  const parsedX = Number.parseInt(room.x, 10);
  const parsedY = Number.parseInt(room.y, 10);
  const parsedZ = Number.parseInt(room.z, 10);
  const normalizedGridId = normalizeGridId(room.gridId);
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY) || !Number.isFinite(parsedZ) || !normalizedGridId) {
    return null;
  }
  const normalized = {
    id: String(room.id),
    name: room.name ? String(room.name) : "",
    x: parsedX,
    y: parsedY,
    z: parsedZ,
    gridId: normalizedGridId,
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
  const sectorVariant = getSectorVariantIndex(room);
  return [
    String(room && room.sector ? room.sector : ""),
    String(sectorVariant),
    room && room.darkUnknown ? "1" : "0",
    markers.shop ? "1" : "0",
    markers.bank ? "1" : "0",
    markers.runegate ? "1" : "0",
    markers.waterSource ? "1" : "0"
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
  const gridId = normalizeGridId(coordInfo && coordInfo.gridId);
  const hasCoord = Number.isFinite(rawX) && Number.isFinite(rawY) && Number.isFinite(rawZ) && !!gridId;
  if (!hasCoord) return null;

  const x = rawX;
  const y = rawY;
  const z = rawZ;

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
  if (!room) {
    // Coords were null in Room.Info (room not yet BFS-assigned), but if we're
    // waiting for the initial player snap and we already have this room in the
    // persisted map with coords, snap to it now.
    if (state.pendingInitialSnap && existing &&
        typeof existing.x === 'number' && typeof existing.y === 'number') {
      state.pendingInitialSnap = false;
      setActiveLayerFromRoom(existing);
      const snap = panForRoom(existing);
      state.panX = snap.x;
      state.panY = snap.y;
      state.playerLocation = { x: existing.x, y: existing.y, z: existing.z, gridId: normalizeGridId(existing.gridId), roomId: String(existing.id || '') };
      state.playerRoomId = existing.id;
      scheduleRender();
    }
    return;
  }

  upsertRoom(room);

  // Create dark-unknown stub rooms for exits leading to as-yet-unmapped rooms
  // so they appear as unexplored squares on the map (same treatment as scan mobs).
  if (room.discovered) {
    for (const [dir, ex] of Object.entries(room.exits || {})) {
      const vec = DIRECTION_VECTORS[dir];
      if (!vec) continue;
      const toId = String(ex && ex.to ? ex.to : "").trim();
      if (!toId || state.roomsById.has(toId)) continue;
      const nx = room.x + vec.dx;
      const ny = room.y + vec.dy;
      const ck = coordKey(nx, ny, room.z, room.gridId);
      if (state.roomByCoord.has(ck)) continue;
      upsertRoom({
        id: toId,
        name: "",
        x: nx,
        y: ny,
        z: room.z,
        gridId: room.gridId,
        sector: "inside",
        exits: {},
        markers: {},
        nearbyMobs: {},
        knownMobs: [],
        notes: "",
        visibleNow: false,
        discovered: false,
        darkUnknown: true,
        lastSeenAt: null,
        ephNum: null,
        areaID: null,
        localID: null
      });
    }
  }

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
  const now = performance.now();
  const existing = roomId ? state.roomsById.get(roomId) : null;
  const layerZ = existing ? existing.z : (state.playerLocation ? state.playerLocation.z : 0);
  const gridId = existing ? existing.gridId : (state.playerLocation ? state.playerLocation.gridId : "");
  clearKnownMobsForLayer(layerZ, gridId);
  applyScanMobSightings(scanSightings, now);
  ensureEffectsLoop();
  scheduleRender();
  schedulePersistMap();
}

function updatePartyFromGroupInfo(payload) {
  const members = Array.isArray(payload && payload.members) ? payload.members : [];
  const nextMembers = members.map((m) => {
    const roomId = String(m && m.room_id ? m.room_id : "");
    const coord = m && m.room_coord && typeof m.room_coord === "object" ? m.room_coord : null;
    return {
      name: String(m && m.name ? m.name : ""),
      roomId,
      coord: normalizeCoord(coord),
      isLeader: !!(m && m.is_leader),
      isNpc: !!(m && m.is_npc),
      uid: m && m.uid != null ? Number(m.uid) : null
    };
  });

  const nextPartyMobUids = new Set();
  for (const member of nextMembers) {
    if (member.isNpc && member.uid != null) nextPartyMobUids.add(member.uid);
  }
  state.partyMobUids = nextPartyMobUids;

  const nextLastPos = new Map();
  const activeFollowerKeys = new Set();
  for (let i = 0; i < nextMembers.length; i++) {
    const member = nextMembers[i];
    if (isLocalPlayerPartyMember(member)) continue;
    const memberKey = partyMemberKey(member, i);
    const nextPos = resolvePartyMemberPosition(member);
    if (!nextPos) continue;
    activeFollowerKeys.add(memberKey);

    const priorPos = state.partyMemberLastPos.get(memberKey);
    if (priorPos && didPartyMemberMove(priorPos, nextPos)) {
      addPartyJellyTrail(memberKey, priorPos, nextPos);
    }
    nextLastPos.set(memberKey, nextPos);
  }

  for (const [key, follower] of state.jellyFollowers.entries()) {
    if (!follower || follower.role !== 'party') continue;
    if (activeFollowerKeys.has(key)) continue;
    state.jellyFollowers.delete(key);
  }

  state.partyMemberLastPos = nextLastPos;
  state.partyMembers = nextMembers;
  if (state.jellyFollowers.size > 0) ensureEffectsLoop();
  scheduleRender();
}

function partyMemberKey(member, index) {
  const base = String(member && member.name ? member.name : "").trim().toLowerCase();
  if (base) return base;
  return `member-${index}`;
}

/** Find a party member in state.partyMembers by uid (preferred) or name. */
function findPartyMember(uid, name) {
  if (uid != null) {
    const byUid = state.partyMembers.find((m) => m.uid != null && m.uid === uid);
    if (byUid) return byUid;
  }
  const lname = String(name || "").trim().toLowerCase();
  if (!lname) return null;
  return state.partyMembers.find((m) => String(m.name || "").trim().toLowerCase() === lname) || null;
}

/**
 * Merge Group.Position into state.partyMembers — updates roomId and coord for each
 * member in the payload without replacing unknown members or vitals fields.
 */
function mergePartyPosition(payload) {
  const items = Array.isArray(payload && payload.members) ? payload.members : [];
  if (!items.length) return;

  let changed = false;
  for (const item of items) {
    const member = findPartyMember(item.uid != null ? Number(item.uid) : null, item.name);
    if (!member) continue;
    const newRoomId = String(item.room_id || "");
    const coord = item.room_coord && typeof item.room_coord === "object" ? item.room_coord : null;
    const newCoord = normalizeCoord(coord);
    if (member.roomId !== newRoomId || JSON.stringify(member.coord) !== JSON.stringify(newCoord)) {
      member.roomId = newRoomId;
      member.coord = newCoord;
      changed = true;
    }
  }

  if (changed) {
    // Re-run trail logic using updated positions (same logic as updatePartyFromGroupInfo)
    const nextLastPos = new Map();
    const activeFollowerKeys = new Set();
    for (let i = 0; i < state.partyMembers.length; i++) {
      const member = state.partyMembers[i];
      if (isLocalPlayerPartyMember(member)) continue;
      const memberKey = partyMemberKey(member, i);
      const nextPos = resolvePartyMemberPosition(member);
      if (!nextPos) continue;
      activeFollowerKeys.add(memberKey);
      const priorPos = state.partyMemberLastPos.get(memberKey);
      if (priorPos && didPartyMemberMove(priorPos, nextPos)) {
        addPartyJellyTrail(memberKey, priorPos, nextPos);
      }
      nextLastPos.set(memberKey, nextPos);
    }
    for (const [key, follower] of state.jellyFollowers.entries()) {
      if (!follower || follower.role !== "party") continue;
      if (activeFollowerKeys.has(key)) continue;
      state.jellyFollowers.delete(key);
    }
    state.partyMemberLastPos = nextLastPos;
    if (state.jellyFollowers.size > 0) ensureEffectsLoop();
    scheduleRender();
  }
}

/**
 * Merge Group.Vitals into state.partyMembers — frmapper doesn't render vitals but
 * stores them so future overlays can use them.
 */
function mergePartyVitals(payload) {
  const items = Array.isArray(payload && payload.members) ? payload.members : [];
  if (!items.length) return;
  for (const item of items) {
    const member = findPartyMember(item.uid != null ? Number(item.uid) : null, item.name);
    if (!member) continue;
    member.hpPct   = typeof item.hp_pct   === "number" ? item.hp_pct   : member.hpPct;
    member.manaPct = typeof item.mana_pct === "number" ? item.mana_pct : member.manaPct;
    member.mvPct   = typeof item.mv_pct   === "number" ? item.mv_pct   : member.mvPct;
    member.hp      = typeof item.hp       === "number" ? item.hp       : member.hp;
    member.maxHp   = typeof item.maxhp    === "number" ? item.maxhp    : member.maxHp;
  }
}

function isLocalPlayerPartyMember(member) {
  const memberName = sanitizeStorageToken(member && member.name ? member.name : "");
  const playerName = sanitizeStorageToken(state.storageCharacterName || "");
  return !!memberName && !!playerName && memberName === playerName;
}

function resolvePartyMemberPosition(member) {
  if (!member || typeof member !== "object") return null;
  const roomId = String(member.roomId || "").trim();
  if (!roomId) return null;
  const room = state.roomsById.get(roomId);
  if (!room) return null;
  return {
    x: room.x,
    y: room.y,
    z: room.z,
    gridId: normalizeGridId(room.gridId),
    roomId: room.id
  };
}

function didPartyMemberMove(from, to) {
  if (!from || !to) return false;
  return (
    from.x !== to.x ||
    from.y !== to.y ||
    from.z !== to.z ||
    normalizeGridId(from.gridId) !== normalizeGridId(to.gridId)
  );
}

function updateRoomMobs(payload) {
  state.roomMobs = Array.isArray(payload && payload.mobs) ? payload.mobs : [];
  state.roomMobsSeenAt = state.roomMobs.length > 0 ? performance.now() : 0;
  if (state.roomMobsSeenAt > 0) ensureEffectsLoop();
  scheduleRender();
}

function ingestRoomMobHint(payload) {
  state.roomMobHint = payload || {};
  const roomId = state.playerLocation && state.playerLocation.roomId
    ? String(state.playerLocation.roomId)
    : null;
  if (!roomId) return;
  const room = state.roomsById.get(roomId);
  if (!room) return;

  // Mirror what the old Room.Info path did: store on the room then fire showTempMobDot
  // for every adjacent room that has mobs, so the minimap dots appear.
  const nearbyMobs = normalizeNearbyMobs(payload.nearby_mobs || payload.nearbyMobs || {});
  room.nearbyMobs = nearbyMobs;
  const sr = payload.scan_range ?? payload.scanRange ?? null;
  room.scanRange = Number.isFinite(Number(sr)) && Number(sr) > 0 ? Number(sr) : null;

  for (const [dir, entry] of Object.entries(nearbyMobs)) {
    const parsed = parseNearbyMobsEntry(entry);
    if (parsed.count <= 0) continue;
    const normDir = normalizeDirectionToken(dir);
    if (!normDir) continue;
    const targetId = findDirectionalScanRoomId(room, normDir, Math.max(1, parsed.distance || 1));
    if (!targetId) continue;
    showTempMobDot(targetId, parsed.count, "nearby");
  }

  ensureEffectsLoop();
  scheduleRender();
}

function ingestTrackedDelta(type, payload) {
  const isMobs = type === "mobs";
  const map = isMobs ? state.trackedMobs : state.trackedChars;
  const action = String((payload && payload.action) || "");
  if (action === "clear") { map.clear(); scheduleRender(); return; }
  const name = String((payload && payload.name) || "").trim();
  const uid = payload && payload.uid != null ? Number(payload.uid) : null;
  // Mobs are keyed by UID string to avoid name-collision overwrites. Chars keep name as key.
  const key = (isMobs && uid != null) ? String(uid) : name;
  if (!key) return;
  if (action === "remove") {
    map.delete(key);
    state.jellyFollowers.delete(key);
    scheduleRender();
    return;
  }
  if (action === "add") {
    map.set(key, { roomId: String((payload && payload.roomId) || ""), uid, name });
    scheduleRender();
    return;
  }
  if (action === "move") {
    const fromRoomId = String((payload && payload.fromRoomId) || "");
    const toRoomId   = String((payload && payload.toRoomId)   || "");
    map.set(key, { roomId: toRoomId, uid, name });
    const fromRoom = fromRoomId ? state.roomsById.get(fromRoomId) : null;
    const toRoom   = toRoomId   ? state.roomsById.get(toRoomId)   : null;
    if (fromRoom && toRoom && fromRoom.discovered && toRoom.discovered) {
      const fromPos = { x: fromRoom.x, y: fromRoom.y, z: fromRoom.z, gridId: fromRoom.gridId, roomId: fromRoomId };
      const toPos   = { x: toRoom.x,   y: toRoom.y,   z: toRoom.z,   gridId: toRoom.gridId,   roomId: toRoomId   };
      addTrackedJellyTrail(key, fromPos, toPos, type);
    }
    scheduleRender();
  }
}

function addTrackedJellyTrail(name, from, to, type) {
  if (!name || !from || !to) return;
  if (!to.roomId || !state.roomsById.has(String(to.roomId))) return;
  const fromGrid = normalizeGridId(from.gridId);
  const toGrid = normalizeGridId(to.gridId);
  const gridId = toGrid || fromGrid;
  if (!gridId) return;

  const palette = type === "chars" ? TRACKED_CHAR_PALETTE : TRACKED_MOB_PALETTE;
  const dotAnchorY = type === "chars" ? "bottom" : "top";
  const now = performance.now();
  const existing = state.jellyFollowers.get(name);
  if (!existing) {
    const follower = {
      x: from.x,
      y: from.y,
      vx: 0,
      vy: 0,
      z: to.z,
      gridId,
      fromRoomId: String(from.roomId || ""),
      toRoomId: String(to.roomId || ""),
      headX: to.x,
      headY: to.y,
      headRoomId: String(to.roomId || ""),
      roomId: String(to.roomId || ""),
      targetX: to.x,
      targetY: to.y,
      waypoints: [],
      createdAt: now,
      durationMs: PARTY_JELLY_FADE_MS,
      palette,
      anchorY: dotAnchorY,
      wobbleT:   Math.random() * 20,
      wobbleAmp: 0,
      blobSeed:  Math.random() * 100,
      speed: TRACKED_BLOB_SLURP_SPEED,
      role: 'tracked'
    };
    applyFollowerPathUpdate(follower, from, to);
    state.jellyFollowers.set(name, follower);
    ensureEffectsLoop();
    return;
  }

  existing.fromRoomId = String(from.roomId || "");
  existing.toRoomId = String(to.roomId || "");
  existing.palette = palette;
  existing.anchorY = dotAnchorY;
  applyFollowerPathUpdate(existing, from, to);
  existing.durationMs = PARTY_JELLY_FADE_MS;
  existing.createdAt = now;
  ensureEffectsLoop();
}

function upsertRoom(rawRoom) {
  const room = normalizeRoom(rawRoom);
  if (!room) return;
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
  markStaticLayerDirty();
}

function areRoomsEquivalent(a, b) {
  if (!a || !b) return false;
  const markerA = a.markers || {};
  const markerB = b.markers || {};
  const aSeen = Number.isFinite(a.lastSeenAt) ? Number(a.lastSeenAt) : 0;
  const bSeen = Number.isFinite(b.lastSeenAt) ? Number(b.lastSeenAt) : 0;
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
    !!a.visibleNow === !!b.visibleNow &&
    !!a.discovered === !!b.discovered &&
    !!a.darkUnknown === !!b.darkUnknown &&
    aSeen === bSeen &&
    JSON.stringify(a.objects || []) === JSON.stringify(b.objects || [])
  );
}

function clearKnownMobsForLayer(z, gridId) {
  const normGrid = normalizeGridId(gridId);
  for (const room of state.mapData.rooms) {
    if (room.z !== z) continue;
    if (normalizeGridId(room.gridId) !== normGrid) continue;
    if (Array.isArray(room.knownMobs) && room.knownMobs.length > 0) {
      room.knownMobs = [];
    }
    // Only remove scan-derived dots; nearby-mob hint dots (source === 'nearby')
    // have their own seenAt timestamps and should fade out naturally.
    const id = String(room.id || "");
    const entry = state.tempMobDotByRoom.get(id);
    if (entry && entry.source !== "nearby") {
      state.tempMobDotByRoom.delete(id);
    }
  }
}

function showTempMobDot(roomId, count, source) {
  const id = String(roomId || "");
  if (!id || count <= 0) return;
  state.tempMobDotByRoom.set(id, { count, seenAt: performance.now(), source: source || "scan" });
  ensureEffectsLoop();
}

function applyScanMobSightings(scanSightings, seenAt) {
  const scanSeenAt = Number.isFinite(seenAt) ? seenAt : performance.now();
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
      if (mobs.length > 0) {
        showTempMobDot(roomId, mobs.length);
      }
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
    if (mobs.length > 0) {
      showTempMobDot(roomId, mobs.length);
    }
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
  markRoomEdgeVariantsDirty();
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
  updateEmbedQuickControls();

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

function markStaticLayerDirty() {
  state.staticLayer.version += 1;
  state.staticLayer.chunks.clear();
  state.staticLayer.zoomKey = "";
  markRoomEdgeVariantsDirty();
}

function markRoomEdgeVariantsDirty() {
  state.roomEdgeVariantsDirty = true;
}

function qualityTierName(visibleRoomCount) {
  if (visibleRoomCount > QUALITY_ULTRA_ROOM_COUNT) return "ultra";
  if (visibleRoomCount > QUALITY_LOW_ROOM_COUNT) return "low";
  if (visibleRoomCount > QUALITY_MEDIUM_ROOM_COUNT) return "medium";
  return "full";
}

function updatePerfStatsPanel(force) {
  if (!el.perfStats) return;

  const enabled = !!state.showPerfStats;
  el.perfStats.hidden = !enabled;
  if (el.togglePerfStats && el.togglePerfStats.checked !== enabled) {
    el.togglePerfStats.checked = enabled;
  }
  if (!enabled) return;

  const now = performance.now();
  if (!force && (now - state.perf.panelTs) < 220) return;
  state.perf.panelTs = now;

  const p = state.perf;
  el.perfStats.textContent = [
    `fps ~ ${p.fpsEstimate.toFixed(1)}  frame ${p.frameMs.toFixed(2)} ms  render ${p.renderMs.toFixed(2)} ms`,
    `visible rooms ${p.visibleRooms}  quality ${p.qualityTier}`,
    `static rebuilt ${p.staticRebuilt ? "yes" : "no"}  static version ${p.staticVersion}`,
    `static chunks drawn ${p.staticChunksDrawn}  rebuilt ${p.staticChunksRebuilt}  cache ${p.staticChunkCacheSize}`,
    `edge cache rooms ${state.roomEdgeVariants.size}`
  ].join("\n");
}

function getRenderQualityProfile(visibleRoomCount) {
  const quality = {
    tier: qualityTierName(visibleRoomCount),
    drawFog: state.showFogOfWar,
    drawTrailOverlay: state.showTraveledPath,
    drawTrailPath: state.showTraveledPath,
    drawParty: state.showParty,
    drawMobHints: state.showMobHints,
    drawGridOutline: state.showGridOutline,
    drawExtraExitMarkers: true,
    drawOneWayOverlays: true
  };

  if (visibleRoomCount > QUALITY_MEDIUM_ROOM_COUNT) {
    quality.drawFog = false;
  }
  if (visibleRoomCount > QUALITY_LOW_ROOM_COUNT) {
    quality.drawExtraExitMarkers = false;
    quality.drawOneWayOverlays = false;
    quality.drawTrailOverlay = false;
  }
  if (visibleRoomCount > QUALITY_ULTRA_ROOM_COUNT) {
    quality.drawTrailPath = false;
    quality.drawParty = false;
    quality.drawMobHints = false;
  }

  return quality;
}

function ensureRoomEdgeVariants() {
  if (!state.roomEdgeVariantsDirty) return;
  const next = new Map();
  for (const room of state.mapData.rooms) {
    const variants = Object.create(null);
    for (const dir of ["n", "e", "s", "w"]) {
      variants[dir] = computeEdgeVariantRaw(room, dir);
    }
    next.set(room.id, variants);
  }
  state.roomEdgeVariants = next;
  state.roomEdgeVariantsDirty = false;
}

function getVisibleRoomBounds(tilePx, viewW, viewH) {
  const minX = Math.floor((-state.panX) / tilePx) - 1;
  const maxX = Math.ceil((viewW - state.panX) / tilePx) + 1;
  const minY = Math.floor((-state.panY) / tilePx) - 1;
  const maxY = Math.ceil((viewH - state.panY) / tilePx) + 1;
  return { minX, maxX, minY, maxY };
}

function collectVisibleRoomsForViewport(activeGrid, activeZ, tilePx, viewW, viewH, lightMode) {
  const bounds = getVisibleRoomBounds(tilePx, viewW, viewH);
  const visibleRooms = [];
  const visibleFadedRooms = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const activeId = state.roomByCoord.get(coordKey(x, y, activeZ, activeGrid));
      if (activeId) {
        const room = state.roomsById.get(activeId);
        if (room) visibleRooms.push(room);
        continue;
      }

      if (lightMode) continue;

      const lowerId = state.roomByCoord.get(coordKey(x, y, activeZ - 1, activeGrid));
      if (lowerId) {
        const lower = state.roomsById.get(lowerId);
        if (lower) visibleFadedRooms.push(lower);
      }
      const upperId = state.roomByCoord.get(coordKey(x, y, activeZ + 1, activeGrid));
      if (upperId) {
        const upper = state.roomsById.get(upperId);
        if (upper) visibleFadedRooms.push(upper);
      }
    }
  }

  return { bounds, visibleRooms, visibleFadedRooms };
}

function staticChunkCacheKey(activeGrid, activeZ, lightMode, chunkX, chunkY) {
  return [
    normalizeGridId(activeGrid),
    activeZ,
    Number(state.zoom).toFixed(3),
    lightMode ? 1 : 0,
    chunkX,
    chunkY,
    state.staticLayer.version
  ].join("|");
}

function buildStaticChunkRoomLists(activeGrid, activeZ, chunkX, chunkY, lightMode) {
  const size = STATIC_CHUNK_ROOM_SIZE;
  const minX = chunkX * size;
  const minY = chunkY * size;
  const maxX = minX + size - 1;
  const maxY = minY + size - 1;
  const visibleRooms = [];
  const visibleFadedRooms = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const activeId = state.roomByCoord.get(coordKey(x, y, activeZ, activeGrid));
      if (activeId) {
        const room = state.roomsById.get(activeId);
        if (room) visibleRooms.push(room);
        continue;
      }

      if (lightMode) continue;

      const lowerId = state.roomByCoord.get(coordKey(x, y, activeZ - 1, activeGrid));
      if (lowerId) {
        const lower = state.roomsById.get(lowerId);
        if (lower) visibleFadedRooms.push(lower);
      }
      const upperId = state.roomByCoord.get(coordKey(x, y, activeZ + 1, activeGrid));
      if (upperId) {
        const upper = state.roomsById.get(upperId);
        if (upper) visibleFadedRooms.push(upper);
      }
    }
  }

  return { minX, minY, visibleRooms, visibleFadedRooms };
}

function ensureStaticChunk(activeGrid, activeZ, lightMode, chunkX, chunkY, tilePx) {
  const cacheKey = staticChunkCacheKey(activeGrid, activeZ, lightMode, chunkX, chunkY);
  const cached = state.staticLayer.chunks.get(cacheKey);
  if (cached) {
    return { sprite: cached, rebuilt: false };
  }

  const chunkPx = Math.max(1, Math.ceil(STATIC_CHUNK_ROOM_SIZE * tilePx));
  const canvas = document.createElement("canvas");
  canvas.width = chunkPx;
  canvas.height = chunkPx;
  const g = canvas.getContext("2d");
  if (!g) {
    return { sprite: null, rebuilt: false };
  }

  const content = buildStaticChunkRoomLists(activeGrid, activeZ, chunkX, chunkY, lightMode);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);

  const worldOffsetX = -content.minX * tilePx;
  const worldOffsetY = -content.minY * tilePx;
  for (const room of content.visibleFadedRooms) {
    drawRoomStaticSprite(room, { ghost: true, worldOffsetX, worldOffsetY }, g);
  }
  for (const room of content.visibleRooms) {
    drawRoomStaticSprite(room, { worldOffsetX, worldOffsetY }, g);
  }

  const sprite = { canvas };
  state.staticLayer.chunks.set(cacheKey, sprite);
  return { sprite, rebuilt: true };
}

function drawStaticChunks(activeGrid, activeZ, lightMode, tilePx, bounds) {
  if (!bounds) {
    return {
      rebuiltAny: false,
      chunksDrawn: 0,
      chunksRebuilt: 0,
      cacheSize: state.staticLayer.chunks.size
    };
  }

  const zoomKey = Number(state.zoom).toFixed(3);
  if (state.staticLayer.zoomKey !== zoomKey) {
    state.staticLayer.chunks.clear();
    state.staticLayer.zoomKey = zoomKey;
  }

  const size = STATIC_CHUNK_ROOM_SIZE;
  const minChunkX = Math.floor(bounds.minX / size);
  const maxChunkX = Math.floor(bounds.maxX / size);
  const minChunkY = Math.floor(bounds.minY / size);
  const maxChunkY = Math.floor(bounds.maxY / size);
  let rebuiltAny = false;
  let chunksDrawn = 0;
  let chunksRebuilt = 0;

  for (let cy = minChunkY; cy <= maxChunkY; cy += 1) {
    for (let cx = minChunkX; cx <= maxChunkX; cx += 1) {
      const { sprite, rebuilt } = ensureStaticChunk(activeGrid, activeZ, lightMode, cx, cy, tilePx);
      rebuiltAny = rebuiltAny || rebuilt;
      if (rebuilt) chunksRebuilt += 1;
      if (!sprite || !sprite.canvas) continue;
      chunksDrawn += 1;
      const worldChunkX = cx * size * tilePx;
      const worldChunkY = cy * size * tilePx;
      const screenX = state.panX + worldChunkX;
      const screenY = state.panY + worldChunkY;
      ctx.drawImage(sprite.canvas, screenX, screenY);
    }
  }

  return {
    rebuiltAny,
    chunksDrawn,
    chunksRebuilt,
    cacheSize: state.staticLayer.chunks.size
  };
}

function drawVisibleRoomWalls(visibleFadedRooms, visibleRooms) {
  for (const room of visibleFadedRooms) {
    drawRoomWallBase(room, undefined, { offLayer: true });
  }
  for (const room of visibleRooms) {
    drawRoomWallBase(room);
  }
}

function drawRoomLocalIdOverlays(visibleRooms, visibleFadedRooms) {
  if (!state.showLocalIds) return;
  const hasVisible = Array.isArray(visibleRooms) && visibleRooms.length > 0;
  const hasFaded = Array.isArray(visibleFadedRooms) && visibleFadedRooms.length > 0;
  if (!hasVisible && !hasFaded) return;

  const tilePx = TILE_SIZE * state.zoom;
  const fontPx = Math.max(10, Math.floor(tilePx * 0.22));
  const textOpacity = Math.max(0.68, Math.min(1, wallOpacityForZoomValue(state.zoom || 1)));
  const offLayerOpacity = 0.3;

  const drawLocalIds = (rooms, alphaScale) => {
    if (!Array.isArray(rooms) || rooms.length === 0) return;
    ctx.save();
    ctx.globalAlpha *= textOpacity * alphaScale;
    for (const room of rooms) {
      if (!Number.isFinite(Number(room.localID))) continue;
      const x = state.panX + room.x * tilePx;
      const y = state.panY + room.y * tilePx;
      const label = String(room.localID);
      const tx = x + tilePx - Math.max(4, tilePx * 0.08);
      const ty = y + tilePx * 0.5;
      ctx.strokeText(label, tx, ty);
      ctx.fillText(label, tx, ty);
    }
    ctx.restore();
  };

  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `${fontPx}px "JetBrains Mono", "Roboto Mono", "Consolas", monospace`;
  ctx.lineWidth = Math.max(2.2, fontPx * 0.24);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  drawLocalIds(visibleFadedRooms, offLayerOpacity);
  drawLocalIds(visibleRooms, 1);
  ctx.restore();
}

function render() {
  if (!ctx) return;
  ensureRoomEdgeVariants();
  const frameStart = performance.now();

  const ratio = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  ctx.restore();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const activeGrid = normalizeGridId(state.activeGridId);
  const rooms = getRoomsForLayer(activeGrid, state.activeZ);
  const lightMode = false;
  const tilePx = TILE_SIZE * state.zoom;
  const viewW = el.canvas.clientWidth;
  const viewH = el.canvas.clientHeight;
  const visible = collectVisibleRoomsForViewport(activeGrid, state.activeZ, tilePx, viewW, viewH, lightMode);
  const visibleRooms = visible.visibleRooms;
  const visibleFadedRooms = visible.visibleFadedRooms;

  const quality = getRenderQualityProfile(visibleRooms.length);

  if (quality.drawGridOutline) {
    drawGridOutline(tilePx, viewW, viewH);
  }

  const staticStats = drawStaticChunks(activeGrid, state.activeZ, lightMode, tilePx, visible.bounds);
  const staticRebuilt = !!(staticStats && staticStats.rebuiltAny);

  drawNonActiveRoomDimming(visibleRooms);

  const activeRoom = state.playerRoomId ? state.roomsById.get(String(state.playerRoomId)) : null;
  if (activeRoom && activeRoom.z === state.activeZ
      && normalizeGridId(activeRoom.gridId) === normalizeGridId(state.activeGridId)) {
    drawActiveRoomPulse(activeRoom);
  }

  if (quality.drawFog) {
    const now = Date.now();
    for (const room of visibleRooms) {
      drawFogOfWarHaze(room, now);
    }
  }

  if (quality.drawParty) {
    drawAllJellyTrails();
  }

  drawVisibleRoomWalls(visibleFadedRooms, visibleRooms);
  drawRoomLocalIdOverlays(visibleRooms, visibleFadedRooms);

  for (const room of visibleRooms) {
    drawRoomDoorOverlays(room);
  }

  if (quality.drawExtraExitMarkers) {
    for (const room of visibleRooms) {
      drawExtraExitMarkers(room);
    }
  }

  if (!lightMode) {
    if (quality.drawTrailOverlay) {
      for (const room of visibleRooms) {
        drawTrailOverlay(room);
      }
    }

    let partyRoomCounts = null;
    if (quality.drawParty) {
      partyRoomCounts = drawPartyOverlays(visibleRooms);
    }
    if (quality.drawMobHints) {
      drawMobHints(visibleRooms);
    }
    drawTrackedDots(visibleRooms, partyRoomCounts);
  }

  if (quality.drawOneWayOverlays) {
    for (const room of visibleRooms) {
      drawOneWayExitOverlays(room);
    }
  }

  drawActiveMoveLine({ drawTrailPath: quality.drawTrailPath });

  for (const room of visibleRooms) {
    if (room.id === state.selectedRoomId) {
      drawSelectedRoomOutline(room);
    }
  }

  const frameEnd = performance.now();
  const elapsed = frameEnd - frameStart;
  const sinceLast = state.perf.lastDrawTs > 0 ? (frameEnd - state.perf.lastDrawTs) : 0;
  if (sinceLast > 0.5) {
    const instFps = 1000 / sinceLast;
    state.perf.fpsEstimate = state.perf.fpsEstimate > 0
      ? (state.perf.fpsEstimate * 0.82 + instFps * 0.18)
      : instFps;
  }
  state.perf.lastDrawTs = frameEnd;
  state.perf.frameMs = elapsed;
  state.perf.renderMs = elapsed;
  state.perf.visibleRooms = visibleRooms.length;
  state.perf.qualityTier = quality.tier;
  state.perf.staticRebuilt = staticRebuilt;
  state.perf.staticVersion = state.staticLayer.version;
  state.perf.staticChunksDrawn = staticStats ? staticStats.chunksDrawn : 0;
  state.perf.staticChunksRebuilt = staticStats ? staticStats.chunksRebuilt : 0;
  state.perf.staticChunkCacheSize = staticStats ? staticStats.cacheSize : state.staticLayer.chunks.size;
  if (state.showPerfStats) {
    updatePerfStatsPanel(false);
  }
}

function drawNonActiveRoomDimming(visibleRooms) {
  if (!Array.isArray(visibleRooms) || visibleRooms.length === 0) return;
  const tilePx = TILE_SIZE * state.zoom;
  const activeId = state.playerRoomId ? String(state.playerRoomId) : "";
  const baseAlpha = activeId ? 0.12 : 0.08;

  ctx.save();
  ctx.fillStyle = `rgba(6, 8, 12, ${baseAlpha})`;
  for (const room of visibleRooms) {
    if (!room || String(room.id || "") === activeId) continue;
    const x = state.panX + room.x * tilePx;
    const y = state.panY + room.y * tilePx;
    ctx.fillRect(x, y, tilePx, tilePx);
  }
  ctx.restore();
}

function drawActiveRoomPulse(room) {
  if (!room) return;
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const pulse = (Math.sin(performance.now() / 520) + 1) * 0.5;
  const glowAlpha = 0.02 + pulse * 0.05;
  const strokeAlpha = 0.06 + pulse * 0.38;

  ctx.save();
  ctx.shadowColor = `rgba(255, 244, 220, ${Math.min(0.42, 0.08 + pulse * 0.34)})`;
  ctx.shadowBlur = Math.max(7, tilePx * 0.26);
  ctx.fillStyle = `rgba(255, 243, 214, ${glowAlpha})`;
  ctx.fillRect(x + 1, y + 1, tilePx - 2, tilePx - 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255, 237, 190, ${strokeAlpha})`;
  ctx.lineWidth = Math.max(1, state.zoom * 1.1);
  ctx.strokeRect(x + 0.5, y + 0.5, tilePx - 1, tilePx - 1);
  ctx.restore();
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
  const key = `${TRAIL_SPRITE_CACHE_REV}:${mask}:${endpointMode}`;
  const cached = TRAIL_SPRITE_CACHE.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = TRAIL_SPRITE_SIZE;
  canvas.height = TRAIL_SPRITE_SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;

  renderTrailSprite(g, TRAIL_SPRITE_SIZE, mask, endpointMode, key);
  setCappedCache(TRAIL_SPRITE_CACHE, key, canvas, MAX_TRAIL_SPRITE_CACHE);
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

  softenTrailOuterCorner(g, size, mask, outerW);
  softenTrailOuterCorner(g, size, mask, innerW);
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
  const hasN = (mask & TRAIL_DIR_BITS.n) !== 0;
  const hasE = (mask & TRAIL_DIR_BITS.e) !== 0;
  const hasS = (mask & TRAIL_DIR_BITS.s) !== 0;
  const hasW = (mask & TRAIL_DIR_BITS.w) !== 0;

  g.beginPath();
  g.rect(c - hw, c - hw, width, width);
  if (hasN) g.rect(c - hw, 0, width, c);
  if (hasE) g.rect(c, c - hw, c, width);
  if (hasS) g.rect(c - hw, c, width, c);
  if (hasW) g.rect(0, c - hw, c, width);

  // Smooth L/T/+ intersections without changing the overall trail style.
  g.moveTo(c + hw, c);
  g.arc(c, c, hw, 0, Math.PI * 2);
  if (hasN && hasE) {
    g.moveTo(c + hw * 2, c - hw);
    g.arc(c + hw, c - hw, hw, 0, Math.PI * 2);
  }
  if (hasE && hasS) {
    g.moveTo(c + hw * 2, c + hw);
    g.arc(c + hw, c + hw, hw, 0, Math.PI * 2);
  }
  if (hasS && hasW) {
    g.moveTo(c, c + hw);
    g.arc(c - hw, c + hw, hw, 0, Math.PI * 2);
  }
  if (hasW && hasN) {
    g.moveTo(c, c - hw);
    g.arc(c - hw, c - hw, hw, 0, Math.PI * 2);
  }
}

function applyTrailClip(g, size, mask, width) {
  drawTrailRects(g, size, mask, width);
  g.clip();
}

function softenTrailOuterCorner(g, size, mask, width) {
  const hasN = (mask & TRAIL_DIR_BITS.n) !== 0;
  const hasE = (mask & TRAIL_DIR_BITS.e) !== 0;
  const hasS = (mask & TRAIL_DIR_BITS.s) !== 0;
  const hasW = (mask & TRAIL_DIR_BITS.w) !== 0;
  const sideCount = countBits(mask);
  const isCorner = sideCount === 2 && !((hasN && hasS) || (hasE && hasW));
  if (!isCorner) return;

  const c = size * 0.5;
  const hw = width * 0.5;
  const cut = Math.max(1.2, hw * 0.48);
  let px = c;
  let py = c;
  let ix = 0;
  let iy = 0;

  // Carve the convex outer elbow only.
  if (hasN && hasE) {
    px = c - hw;
    py = c + hw;
    ix = 1;
    iy = -1;
  } else if (hasE && hasS) {
    px = c - hw;
    py = c - hw;
    ix = 1;
    iy = 1;
  } else if (hasS && hasW) {
    px = c + hw;
    py = c - hw;
    ix = -1;
    iy = 1;
  } else if (hasW && hasN) {
    px = c + hw;
    py = c + hw;
    ix = -1;
    iy = -1;
  } else {
    return;
  }

  const ax = px + ix * cut;
  const ay = py;
  const bx = px;
  const by = py + iy * cut;

  g.save();
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.moveTo(px, py);
  g.lineTo(ax, ay);
  g.quadraticCurveTo(px, py, bx, by);
  g.closePath();
  g.fill();
  g.restore();
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
  if (!state.showParty || !state.partyMembers.length) return null;
  const visibleById = new Set(visibleRooms.map((r) => r.id));
  const roomCounts = new Map();

  for (const member of state.partyMembers) {
    if (isLocalPlayerPartyMember(member)) continue;
    if (!member.roomId) continue;
    const room = state.roomsById.get(member.roomId);
    if (!room) continue;

    const sameGrid = normalizeGridId(room.gridId) === normalizeGridId(state.activeGridId);
    if (!sameGrid) continue;

    roomCounts.set(room.id, (roomCounts.get(room.id) || 0) + 1);

    if (room.z === state.activeZ && visibleById.has(room.id)) {
      continue;
    }

    const anchor = findVisibleExitAnchorToRoom(visibleRooms, room.id);
    if (anchor) {
      drawAnchorWaypoint(anchor.room, anchor.dir);
      continue;
    }

    drawOffscreenPartyWaypoint(room);
  }

  // Dots for visible rooms are drawn by drawTrackedDots (pooled with char dots)
  return roomCounts;
}

function buildAxisFallbackWaypoints(from, to) {
  const points = [];
  if (!from || !to) return points;
  let x = from.x;
  let y = from.y;
  const sx = Math.sign(to.x - from.x);
  const sy = Math.sign(to.y - from.y);

  while (x !== to.x && points.length < BLOB_MAX_WAYPOINTS) {
    x += sx;
    points.push({ x, y, z: to.z, gridId: normalizeGridId(to.gridId), roomId: String(to.roomId || "") });
  }
  while (y !== to.y && points.length < BLOB_MAX_WAYPOINTS) {
    y += sy;
    points.push({ x, y, z: to.z, gridId: normalizeGridId(to.gridId), roomId: String(to.roomId || "") });
  }

  if (!points.length || points[points.length - 1].x !== to.x || points[points.length - 1].y !== to.y) {
    points.push({ x: to.x, y: to.y, z: to.z, gridId: normalizeGridId(to.gridId), roomId: String(to.roomId || "") });
  }
  return points.slice(0, BLOB_MAX_WAYPOINTS);
}

function buildRoomWaypointPath(from, to) {
  if (!from || !to) return [];
  const sameLayer = from.z === to.z && normalizeGridId(from.gridId) === normalizeGridId(to.gridId);
  if (!sameLayer || !from.roomId || !to.roomId) {
    return buildAxisFallbackWaypoints(from, to);
  }

  const fromId = String(from.roomId);
  const toId = String(to.roomId);
  if (!fromId || !toId || fromId === toId) {
    return [{ x: to.x, y: to.y, z: to.z, gridId: normalizeGridId(to.gridId), roomId: toId }];
  }

  const visited = new Set([fromId]);
  const parent = new Map();
  const queue = [fromId];
  let found = false;

  while (queue.length > 0 && visited.size <= 320) {
    const roomId = queue.shift();
    if (!roomId) continue;
    if (roomId === toId) {
      found = true;
      break;
    }

    const room = state.roomsById.get(roomId);
    const exits = room && room.exits && typeof room.exits === "object" ? room.exits : {};
    for (const ex of Object.values(exits)) {
      if (!ex) continue;
      const nextId = String(ex.to || "");
      if (!nextId || visited.has(nextId)) continue;
      const nextRoom = state.roomsById.get(nextId);
      if (!nextRoom) continue;
      if (nextRoom.z !== to.z) continue;
      if (normalizeGridId(nextRoom.gridId) !== normalizeGridId(to.gridId)) continue;
      visited.add(nextId);
      parent.set(nextId, roomId);
      queue.push(nextId);
      if (nextId === toId) {
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return buildAxisFallbackWaypoints(from, to);
  }

  const pathRoomIds = [];
  let cursor = toId;
  while (cursor && cursor !== fromId && pathRoomIds.length <= BLOB_MAX_WAYPOINTS + 4) {
    pathRoomIds.push(cursor);
    cursor = parent.get(cursor) || "";
  }
  pathRoomIds.reverse();

  const out = [];
  for (const roomId of pathRoomIds) {
    const room = state.roomsById.get(roomId);
    if (!room) continue;
    out.push({
      x: room.x,
      y: room.y,
      z: room.z,
      gridId: normalizeGridId(room.gridId),
      roomId: String(room.id || "")
    });
    if (out.length >= BLOB_MAX_WAYPOINTS) break;
  }

  if (!out.length || out[out.length - 1].x !== to.x || out[out.length - 1].y !== to.y) {
    out.push({ x: to.x, y: to.y, z: to.z, gridId: normalizeGridId(to.gridId), roomId: toId });
  }
  return out.slice(0, BLOB_MAX_WAYPOINTS);
}

function sameBlobWaypoint(a, b) {
  if (!a || !b) return false;
  return (
    a.x === b.x
    && a.y === b.y
    && a.z === b.z
    && normalizeGridId(a.gridId) === normalizeGridId(b.gridId)
    && String(a.roomId || "") === String(b.roomId || "")
  );
}

function appendBlobWaypoints(existingWaypoints, segment) {
  const out = Array.isArray(existingWaypoints) ? existingWaypoints.slice(0, BLOB_MAX_WAYPOINTS) : [];
  const points = Array.isArray(segment) ? segment : [];
  for (const point of points) {
    if (!point) continue;
    const nextPoint = {
      x: point.x,
      y: point.y,
      z: point.z,
      gridId: normalizeGridId(point.gridId),
      roomId: String(point.roomId || "")
    };
    const last = out.length > 0 ? out[out.length - 1] : null;
    if (last && sameBlobWaypoint(last, nextPoint)) continue;
    out.push(nextPoint);
    if (out.length >= BLOB_MAX_WAYPOINTS) break;
  }
  return out;
}

function applyFollowerPathUpdate(follower, from, to) {
  if (!follower || !to) return;

  const sameLayer = !!from
    && from.z === to.z
    && normalizeGridId(from.gridId) === normalizeGridId(to.gridId);

  follower.z = to.z;
  follower.gridId = normalizeGridId(to.gridId);
  follower.roomId = String(to.roomId || "");
  follower.headX = to.x;
  follower.headY = to.y;
  follower.headRoomId = String(to.roomId || "");

  if (!sameLayer) {
    follower.x = to.x;
    follower.y = to.y;
    follower.vx = 0;
    follower.vy = 0;
    follower.targetX = to.x;
    follower.targetY = to.y;
    follower.waypoints = [];
    return;
  }

  const segment = buildRoomWaypointPath(from, to);
  follower.waypoints = appendBlobWaypoints(follower.waypoints, segment);
  if (!follower.waypoints.length && (follower.x !== to.x || follower.y !== to.y)) {
    follower.waypoints = [{
      x: to.x,
      y: to.y,
      z: to.z,
      gridId: normalizeGridId(to.gridId),
      roomId: String(to.roomId || "")
    }];
  }
  const nextTarget = follower.waypoints.length > 0 ? follower.waypoints[0] : to;
  follower.targetX = nextTarget.x;
  follower.targetY = nextTarget.y;
}

function advanceBlobFollower(follower, dt, speedRoomsPerSec) {
  if (!follower) return;
  // Fractional waypoints remaining: integer queue length minus how far we've already
  // travelled into the current segment (each segment is ~1 room unit).
  const wps = Array.isArray(follower.waypoints) ? follower.waypoints : [];
  let fractionalRemaining = 0;
  if (wps.length > 0) {
    const first = wps[0];
    const distToFirst = Math.hypot(first.x - follower.x, first.y - follower.y);
    fractionalRemaining = (wps.length - 1) + distToFirst;
  }
  const speedMultiplier = Math.max(1, fractionalRemaining);
  const stepBudget = Math.max(0, speedRoomsPerSec * speedMultiplier * dt);
  let remaining = stepBudget;
  let moved = false;

  while (remaining > 0) {
    const waypoints = Array.isArray(follower.waypoints) ? follower.waypoints : [];
    const target = waypoints.length > 0
      ? waypoints[0]
      : { x: follower.headX, y: follower.headY };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) break;

    follower.targetX = target.x;
    follower.targetY = target.y;

    const dx = target.x - follower.x;
    const dy = target.y - follower.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= BLOB_WAYPOINT_EPSILON) {
      follower.x = target.x;
      follower.y = target.y;
      if (waypoints.length > 0) {
        waypoints.shift();
        continue;
      }
      break;
    }

    const ux = dx / dist;
    const uy = dy / dist;
    if (dist <= remaining) {
      follower.x = target.x;
      follower.y = target.y;
      follower.vx = ux * speedRoomsPerSec;
      follower.vy = uy * speedRoomsPerSec;
      moved = true;
      remaining -= dist;
      if (waypoints.length > 0) {
        waypoints.shift();
        continue;
      }
      remaining = 0;
      break;
    }

    follower.x += ux * remaining;
    follower.y += uy * remaining;
    follower.vx = ux * speedRoomsPerSec;
    follower.vy = uy * speedRoomsPerSec;
    moved = true;
    remaining = 0;
  }

  if (!moved) {
    follower.vx = 0;
    follower.vy = 0;
  }
}

// ── Jelly blob trail helpers ────────────────────────────────────────────────

// Lightweight pseudo-noise: sum of sines gives smooth, non-repeating values.
// Returns a value roughly in [-1, 1].
function simpleNoise(t, seed) {
  const s = seed || 0;
  return Math.sin(t * 1.7321 + s)        * 0.50
       + Math.sin(t * 3.1415 + s * 1.41) * 0.30
       + Math.sin(t * 7.2380 + s * 2.72) * 0.20;
}

// Draw a smooth Catmull-Rom curve through pts on ctx.
// continuing=true uses lineTo to the first point instead of moveTo (for closing shapes).
function _catmullRomPath(ctx, pts, continuing) {
  if (!pts || pts.length === 0) return;
  if (pts.length === 1) {
    if (!continuing) ctx.moveTo(pts[0].x, pts[0].y);
    else             ctx.lineTo(pts[0].x, pts[0].y);
    return;
  }
  // Pad endpoints so the spline reaches first and last points.
  const ext = [
    { x: pts[0].x * 2 - pts[1].x, y: pts[0].y * 2 - pts[1].y },
    ...pts,
    { x: pts[pts.length-1].x * 2 - pts[pts.length-2].x,
      y: pts[pts.length-1].y * 2 - pts[pts.length-2].y }
  ];
  if (!continuing) ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i-1], p1 = ext[i], p2 = ext[i+1], p3 = ext[i+2];
    // Catmull-Rom → cubic Bézier control points
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
}

// Draws a wobbly circular blob (the "settled" jelly blob) at a screen position.
function _drawSettledJellyBlob(palette, center, baseR, amp, wobbleT, seed, reduceGlow) {
  const NUM_PTS = 9;
  const pts = [];
  for (let i = 0; i < NUM_PTS; i++) {
    const angle = (i / NUM_PTS) * Math.PI * 2;
    const n = simpleNoise(wobbleT * 3.8 + i * 1.23, seed + i * 0.67);
    const r = baseR * (1 + amp * n * 0.48);
    pts.push({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r });
  }
  ctx.save();
  ctx.globalAlpha *= Math.min(0.9, amp * 1.15);
  ctx.shadowColor = palette.glowInner;
  ctx.shadowBlur = Math.max(5, baseR * (reduceGlow ? 1.5 : 2.6));
  ctx.fillStyle = palette.coreMid;
  ctx.beginPath();
  // Close the Catmull-Rom loop by appending the first two points
  _catmullRomPath(ctx, [...pts, pts[0], pts[1]], false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Draws an animated jelly-blob trail for a tracked follower.
// The trail is a filled, tapered, noise-wobbled shape (wider at head, narrower at tail).
// When the follower has settled at its destination, draws a wobbly blob instead.
function drawJellyBlobTrail(follower, palette, options) {
  if (!follower || !palette) return;
  const opts = options || {};
  const tilePx = TILE_SIZE * state.zoom;
  const reduceGlow = shouldReduceGlowEffects();
  const tailOffset = Number.isFinite(opts.tailOffset) ? opts.tailOffset : Math.max(6, state.zoom * 6);

  const getScreenY = opts.anchorY === "center"
    ? (cy) => state.panY + (cy + 0.5) * tilePx
    : opts.anchorY === "top"
    ? (cy) => state.panY + cy * tilePx + tailOffset
    : (cy) => state.panY + cy * tilePx + tilePx - tailOffset;

  const headScreen = {
    x: state.panX + (follower.headX + 0.5) * tilePx,
    y: getScreenY(follower.headY)
  };
  const tailScreen = {
    x: state.panX + (follower.x + 0.5) * tilePx,
    y: getScreenY(follower.y)
  };

  // Build screen-space path: head → reversed waypoints → tail
  const points = [headScreen];
  const waypoints = Array.isArray(follower.waypoints) ? follower.waypoints : [];
  for (let i = waypoints.length - 1; i >= 0; i--) {
    const wp = waypoints[i];
    if (!wp) continue;
    const sp = { x: state.panX + (wp.x + 0.5) * tilePx, y: getScreenY(wp.y) };
    const prev = points[points.length - 1];
    if (Math.hypot(sp.x - prev.x, sp.y - prev.y) <= 0.5) continue;
    points.push(sp);
  }
  const lastPt = points[points.length - 1];
  if (Math.hypot(tailScreen.x - lastPt.x, tailScreen.y - lastPt.y) > 0.5) {
    points.push(tailScreen);
  }

  let pathLen = 0;
  for (let i = 1; i < points.length; i++) {
    pathLen += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
  }

  const wobbleAmp = follower.wobbleAmp || 0;
  const wobbleT   = follower.wobbleT   || 0;
  const seed      = follower.blobSeed  || 0;
  const maxR = Math.max(3.5, tilePx * 0.135); // head radius

  // Blob has arrived — only draw settled wobble
  if (pathLen < tilePx * 0.25) {
    if (wobbleAmp > 0.015) {
      _drawSettledJellyBlob(palette, headScreen, maxR, wobbleAmp, wobbleT, seed, reduceGlow);
    }
    return;
  }

  const alpha = Math.min(0.88, pathLen / Math.max(14, tilePx * 1.2));
  if (alpha <= 0.015) return;

  // Build left/right jelly edge points
  const n = points.length;
  const minR = Math.max(0.5, tilePx * 0.022); // tail radius
  const leftEdge  = [];
  const rightEdge = [];

  for (let i = 0; i < n; i++) {
    const tNorm = i / Math.max(1, n - 1); // 0=head 1=tail
    const r = maxR * (1 - tNorm) + minR * tNorm;

    // Tangent direction at this point
    let dx, dy;
    if (n === 1)      { dx = 1; dy = 0; }
    else if (i === 0) { dx = points[1].x - points[0].x; dy = points[1].y - points[0].y; }
    else if (i === n-1) { dx = points[n-1].x - points[n-2].x; dy = points[n-1].y - points[n-2].y; }
    else              { dx = points[i+1].x - points[i-1].x; dy = points[i+1].y - points[i-1].y; }

    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len; // perpendicular left
    const py =  dx / len;

    // Noise wobble (stronger at head, fades toward tail)
    const wobbleScale = 1 - tNorm * 0.55;
    const nL = simpleNoise(wobbleT * 2.6 + i * 1.13, seed)       * r * 0.4 * wobbleScale;
    const nR = simpleNoise(wobbleT * 2.6 + i * 1.13, seed + 6.1) * r * 0.4 * wobbleScale;

    leftEdge.push({ x: points[i].x + px * (r + nL), y: points[i].y + py * (r + nL) });
    rightEdge.push({ x: points[i].x - px * (r + nR), y: points[i].y - py * (r + nR) });
  }

  // ── Filled jelly shape ──────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = palette.glowInner;
  ctx.shadowBlur  = Math.max(7, maxR * (reduceGlow ? 1.7 : 3.1));
  ctx.fillStyle   = palette.coreMid;
  ctx.beginPath();
  _catmullRomPath(ctx, leftEdge, false);
  _catmullRomPath(ctx, [...rightEdge].reverse(), true);
  ctx.closePath();
  ctx.fill();

  // Inner highlight strip (center is brighter)
  ctx.shadowBlur  = 0;
  ctx.globalAlpha *= 0.40;
  ctx.fillStyle   = palette.coreHighlight || palette.coreMid;
  const s = 0.42;
  const innerL = leftEdge.map((p, i) => ({ x: p.x * (1-s) + rightEdge[i].x * s, y: p.y * (1-s) + rightEdge[i].y * s }));
  const innerR = rightEdge.map((p, i) => ({ x: p.x * (1-s) + leftEdge[i].x * s, y: p.y * (1-s) + leftEdge[i].y * s }));
  ctx.beginPath();
  _catmullRomPath(ctx, innerL, false);
  _catmullRomPath(ctx, [...innerR].reverse(), true);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // If settling, also render the wobble blob at the head
  if (wobbleAmp > 0.015) {
    _drawSettledJellyBlob(palette, headScreen, maxR, wobbleAmp * Math.min(1, alpha * 1.4), wobbleT, seed, reduceGlow);
  }
}

// ── End jelly blob trail helpers ────────────────────────────────────────────

function drawBlobTrail(follower, palette, options) {
  if (!follower || !palette) return;
  const opts = options || {};
  const tilePx = TILE_SIZE * state.zoom;
  const reduceGlow = shouldReduceGlowEffects();
  const tailOffset = Number.isFinite(opts.tailOffset) ? opts.tailOffset : Math.max(6, state.zoom * 6);
  const anchorY = opts.anchorY === "center"
    ? (coordY) => state.panY + (coordY + 0.5) * tilePx
    : opts.anchorY === "top"
    ? (coordY) => state.panY + coordY * tilePx + tailOffset
    : (coordY) => state.panY + coordY * tilePx + tilePx - tailOffset;
  const headScreen = {
    x: state.panX + (follower.headX + 0.5) * tilePx,
    y: anchorY(follower.headY)
  };
  const tailScreen = {
    x: state.panX + (follower.x + 0.5) * tilePx,
    y: anchorY(follower.y)
  };

  const points = [headScreen];
  const waypoints = Array.isArray(follower.waypoints) ? follower.waypoints : [];
  for (let i = waypoints.length - 1; i >= 0; i--) {
    const point = waypoints[i];
    if (!point) continue;
    const screenPoint = {
      x: state.panX + (point.x + 0.5) * tilePx,
      y: anchorY(point.y)
    };
    const last = points[points.length - 1];
    if (Math.hypot(screenPoint.x - last.x, screenPoint.y - last.y) <= 0.25) continue;
    points.push(screenPoint);
  }
  const last = points[points.length - 1];
  if (Math.hypot(tailScreen.x - last.x, tailScreen.y - last.y) > 0.25) {
    points.push(tailScreen);
  }

  let pathLen = 0;
  for (let i = 1; i < points.length; i++) {
    pathLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const alpha = Math.max(0, Math.min(0.84, pathLen / Math.max(12, tilePx * 1.25)));
  if (alpha <= 0.015) return;

  const thickness = Math.max(2.2, tilePx * 0.12);
  const trailGlow = Math.max(6, thickness * (reduceGlow ? 1.4 : 2.2));

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.coreMid;
  ctx.shadowColor = palette.glowInner;
  ctx.shadowBlur = trailGlow;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.restore();
}

function addPartyJellyTrail(memberKey, from, to) {
  if (!memberKey || !from || !to) return;
  if (!to.roomId || !state.roomsById.has(String(to.roomId))) return;
  const fromGrid = normalizeGridId(from.gridId);
  const toGrid = normalizeGridId(to.gridId);
  const gridId = toGrid || fromGrid;
  if (!gridId) return;

  const waypoints = buildRoomWaypointPath(from, to);
  const now = performance.now();
  const existing = state.jellyFollowers.get(memberKey);
  if (!existing) {
    const follower = {
      x: from.x,
      y: from.y,
      vx: 0,
      vy: 0,
      z: to.z,
      gridId,
      fromRoomId: String(from.roomId || ""),
      toRoomId: String(to.roomId || ""),
      headX: to.x,
      headY: to.y,
      headRoomId: String(to.roomId || ""),
      roomId: String(to.roomId || ""),
      targetX: to.x,
      targetY: to.y,
      waypoints: [],
      createdAt: now,
      durationMs: PARTY_JELLY_FADE_MS,
      wobbleT:   Math.random() * 20,
      wobbleAmp: 0,
      blobSeed:  Math.random() * 100,
      speed: PARTY_BLOB_SLURP_SPEED,
      palette: PARTY_DOT_PALETTE,
      anchorY: "bottom",
      role: 'party'
    };
    applyFollowerPathUpdate(follower, from, to);
    state.jellyFollowers.set(memberKey, follower);
    ensureEffectsLoop();
    return;
  }

  existing.fromRoomId = String(from.roomId || "");
  existing.toRoomId = String(to.roomId || "");
  applyFollowerPathUpdate(existing, from, to);
  existing.durationMs = PARTY_JELLY_FADE_MS;
  existing.createdAt = now;
  ensureEffectsLoop();
}

function drawAllJellyTrails() {
  if (!state.jellyFollowers.size) return;

  // Build exclusion set: player self + party members already have their own dot/trail
  const partyNameSet = new Set();
  const rawPlayerName = sanitizeStorageToken(state.storageCharacterName || "").toLowerCase();
  if (rawPlayerName) partyNameSet.add(rawPlayerName);
  for (const m of (state.partyMembers || [])) {
    const n = String(m && m.name ? m.name : "").trim().toLowerCase();
    if (n) partyNameSet.add(n);
  }

  for (const [key, follower] of state.jellyFollowers) {
    if (!follower) continue;
    if (follower.isPlayer) continue; // player drawn by drawActiveMoveLine
    if (follower.z !== state.activeZ) continue;
    if (normalizeGridId(follower.gridId) !== normalizeGridId(state.activeGridId)) continue;
    if (!follower.toRoomId || !state.roomsById.has(String(follower.toRoomId))) continue;
    // Char followers (anchorY==="bottom") — skip if player or party member
    if (follower.anchorY === "bottom" && follower.role === 'tracked') {
      if (partyNameSet.has(String(key || "").trim().toLowerCase())) continue;
    }
    drawJellyBlobTrail(follower, follower.palette, { anchorY: follower.anchorY });
  }
}

function drawTrackedDots(visibleRooms, partyRoomCounts) {
  if (!visibleRooms || visibleRooms.length === 0) return;
  const hasTracked = state.trackedChars.size > 0 || state.trackedMobs.size > 0;
  const hasParty = partyRoomCounts && partyRoomCounts.size > 0;
  if (!hasTracked && !hasParty) return;

  // Names that already have a party dot or are the local player — skip pink.
  const partyNameSet = new Set();
  const rawPlayerName = sanitizeStorageToken(state.storageCharacterName || "").toLowerCase();
  if (rawPlayerName) partyNameSet.add(rawPlayerName);
  for (const m of (state.partyMembers || [])) {
    const n = String(m && m.name ? m.name : "").trim().toLowerCase();
    if (n) partyNameSet.add(n);
  }

  // Accumulate counts per room
  const charCounts = new Map();
  const mobCounts = new Map();
  for (const [key, v] of state.trackedChars) {
    if (!v || !v.roomId) continue;
    // If this char is a party member or the player, their party dot covers it
    const charName = String(v.name || key || "").trim().toLowerCase();
    if (partyNameSet.has(charName)) continue;
    charCounts.set(v.roomId, (charCounts.get(v.roomId) || 0) + 1);
  }
  for (const [, v] of state.trackedMobs) {
    if (!v || !v.roomId) continue;
    if (v.uid != null && state.partyMobUids.has(v.uid)) continue;
    mobCounts.set(v.roomId, (mobCounts.get(v.roomId) || 0) + 1);
  }

  const visibleSet = new Set(visibleRooms.map((r) => r.id));

  // Tracked mobs: top row
  for (const [roomId, count] of mobCounts) {
    if (!visibleSet.has(roomId)) continue;
    const room = state.roomsById.get(roomId);
    if (!room) continue;
    if (room.z !== state.activeZ) continue;
    if (normalizeGridId(room.gridId) !== normalizeGridId(state.activeGridId)) continue;
    drawDotsOnRoom(room, count, TRACKED_MOB_PALETTE, "top");
  }

  // Bottom row: party + tracked chars pooled together per room
  const combinedRoomIds = new Set([
    ...(partyRoomCounts ? partyRoomCounts.keys() : []),
    ...charCounts.keys()
  ]);
  for (const roomId of combinedRoomIds) {
    if (!visibleSet.has(roomId)) continue;
    const room = state.roomsById.get(roomId);
    if (!room) continue;
    if (room.z !== state.activeZ) continue;
    if (normalizeGridId(room.gridId) !== normalizeGridId(state.activeGridId)) continue;
    const pCount = (partyRoomCounts && partyRoomCounts.get(roomId)) || 0;
    const cCount = charCounts.get(roomId) || 0;
    drawMixedBottomDotsOnRoom(room, pCount, cCount);
  }
}

function drawMixedBottomDotsOnRoom(room, partyCount, charCount) {
  const total = partyCount + charCount;
  if (total <= 0) return;
  const maxVisible = 5;
  const partyDots = Math.min(partyCount, maxVisible);
  const charDots  = Math.min(charCount, Math.max(0, maxVisible - partyDots));
  const visibleDots = partyDots + charDots;
  const overflow = total - visibleDots;

  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const r = Math.max(3.2, state.zoom * 3.3);
  const step = Math.max(r * 2.1, state.zoom * 5.0);
  const margin = Math.max(6, state.zoom * 6);
  const dotY = y + tilePx - margin;
  const startX = x + tilePx * 0.5 - ((visibleDots - 1) * step) * 0.5;

  ctx.save();
  if (partyDots > 0) {
    const sprite = getDotSprite(r, shouldReduceGlowEffects(), PARTY_DOT_PALETTE);
    for (let i = 0; i < partyDots; i++) {
      ctx.drawImage(sprite.canvas, startX + i * step - sprite.center, dotY - sprite.center);
    }
  }
  if (charDots > 0) {
    const sprite = getDotSprite(r, shouldReduceGlowEffects(), TRACKED_CHAR_PALETTE);
    for (let i = 0; i < charDots; i++) {
      ctx.drawImage(sprite.canvas, startX + (partyDots + i) * step - sprite.center, dotY - sprite.center);
    }
  }
  if (overflow > 0) {
    ctx.fillStyle = "rgba(228, 235, 255, 0.95)";
    ctx.font = `${Math.max(8, Math.round(8 * state.zoom))}px monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText(`+${overflow}`, startX + (visibleDots - 1) * step + r + 2, dotY - r - 2);
  }
  ctx.restore();
}

function drawPartyDot(room) {
  drawPartyDotsOnRoom(room, 1);
}

function drawPartyDotsOnRoom(room, memberCount) {
  drawDotsOnRoom(room, Math.max(0, Number.parseInt(memberCount, 10) || 0), PARTY_DOT_PALETTE, "bottom");
}

function getPartyDotScreenPos(roomX, roomY) {
  const tilePx = TILE_SIZE * state.zoom;
  return {
    x: state.panX + roomX * tilePx + tilePx * 0.5,
    y: state.panY + roomY * tilePx + tilePx - Math.max(6, state.zoom * 6)
  };
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

  const now = performance.now();
  const countsByRoom = new Map();
  const mergeHint = (roomId, count, alpha) => {
    if (!roomId) return;
    if (!Number.isFinite(count) || count <= 0) return;
    if (!Number.isFinite(alpha) || alpha <= 0) return;

    const existing = countsByRoom.get(roomId);
    if (!existing) {
      countsByRoom.set(roomId, { count, alpha });
      return;
    }
    countsByRoom.set(roomId, {
      count: Math.max(existing.count, count),
      alpha: Math.max(existing.alpha, alpha)
    });
  };

  const localMobs = Array.isArray(state.roomMobs) ? state.roomMobs.length : 0;
  mergeHint(currentRoom.id, localMobs, localMobs > 0 ? 1 : 0);

  const visibleSet = new Set((visibleRooms || []).map((r) => r.id));
  for (const [roomId, entry] of state.tempMobDotByRoom.entries()) {
    mergeHint(roomId, entry.count, mobHintAlphaForTime(entry.seenAt, now));
  }

  // Pre-compute rooms where tracked mobs exist — suppress red hints there.
  const trackedMobRooms = new Set();
  if (state.trackedMobs.size > 0) {
    for (const [, v] of state.trackedMobs) {
      if (v && v.roomId && !(v.uid != null && state.partyMobUids.has(v.uid))) {
        trackedMobRooms.add(v.roomId);
      }
    }
  }

  countsByRoom.forEach((entry, roomId) => {
    if (!visibleSet.has(roomId)) return;
    if (trackedMobRooms.has(roomId)) return; // tracked mob covers this room
    const room = state.roomsById.get(roomId);
    if (!room) return;
    drawMobDotsOnRoom(room, entry.count, entry.alpha);
  });
}

function mobHintAlphaForTime(seenAt, now) {
  if (!Number.isFinite(seenAt) || seenAt <= 0) return 0;
  const age = now - seenAt;
  if (age <= MOB_HINT_FADE_START_MS) return 1;
  if (age >= MOB_HINT_FADE_END_MS) return 0;
  const span = Math.max(1, MOB_HINT_FADE_END_MS - MOB_HINT_FADE_START_MS);
  const t = (age - MOB_HINT_FADE_START_MS) / span;
  return Math.max(0, 1 - t);
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

// Unified dot renderer. anchorY: "top" | "bottom".
function drawDotsOnRoom(room, count, palette, anchorY, alpha) {
  if (!room || count <= 0) return;
  const dotAlpha = Number.isFinite(alpha) ? alpha : 1;
  if (dotAlpha <= 0) return;
  const dots = Math.min(5, count);
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const r = Math.max(3.2, state.zoom * 3.3);
  const step = Math.max(r * 2.1, state.zoom * 5.0);
  const sprite = getDotSprite(r, shouldReduceGlowEffects(), palette);
  const startX = x + tilePx * 0.5 - ((dots - 1) * step) * 0.5;
  const margin = Math.max(6, state.zoom * 6);
  const dotY = anchorY === "bottom" ? y + tilePx - margin : y + margin;
  ctx.save();
  ctx.globalAlpha *= dotAlpha;
  for (let i = 0; i < dots; i++) {
    const cx = startX + i * step;
    ctx.drawImage(sprite.canvas, cx - sprite.center, dotY - sprite.center);
  }
  if (count > dots) {
    ctx.fillStyle = "rgba(228, 235, 255, 0.95)";
    ctx.font = `${Math.max(8, Math.round(8 * state.zoom))}px monospace`;
    ctx.textBaseline = "middle";
    const overflowY = anchorY === "bottom" ? dotY - r - 2 : dotY + r + 2;
    ctx.fillText(`+${count - dots}`, startX + (dots - 1) * step + r + 2, overflowY);
  }
  ctx.restore();
}

function drawMobDotsOnRoom(room, mobCount, alpha) {
  drawDotsOnRoom(room, Math.max(1, Number.parseInt(mobCount, 10) || 1), MOB_DOT_PALETTE, "top", alpha);
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
    setCappedCache(MOB_DOT_SPRITE_CACHE, cacheKey, fallback, MAX_MOB_DOT_SPRITE_CACHE);
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
  setCappedCache(MOB_DOT_SPRITE_CACHE, cacheKey, sprite, MAX_MOB_DOT_SPRITE_CACHE);
  return sprite;
}

function centerOnPayload(payload) {
  if (!state.followPlayer) return;
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

  if (state.pendingInitialSnap) {
    state.pendingInitialSnap = false;
    setActiveLayerFromRoom(targetRoom);
    const snap = panForRoom(targetRoom);
    state.panX = snap.x;
    state.panY = snap.y;
  }

  touchRoomSeen(targetRoom.id);

  const prior = state.playerLocation;
  const priorWithRoom = prior ? {
    x: prior.x,
    y: prior.y,
    z: prior.z,
    gridId: normalizeGridId(prior.gridId),
    roomId: String(prior.roomId || "")
  } : null;
  const next = { x: targetRoom.x, y: targetRoom.y, z: targetRoom.z, gridId: normalizeGridId(targetRoom.gridId) };
  const moved = !!prior && (
    prior.x !== next.x ||
    prior.y !== next.y ||
    prior.z !== next.z ||
    normalizeGridId(prior.gridId) !== normalizeGridId(next.gridId)
  );

  state.playerLocation = { ...next, roomId: String(targetRoom.id || "") };
  state.playerRoomId = targetRoom.id;
  state.scanDistance = resolveScanDistance(targetRoom);
  const hasNearby = currentRoomHasNearbyMobs(targetRoom);
  if (hasNearby) {
    for (const [dir, entry] of Object.entries(targetRoom.nearbyMobs || {})) {
      const parsed = parseNearbyMobsEntry(entry);
      if (parsed.count <= 0) continue;
      const normDir = normalizeDirectionToken(dir);
      if (!normDir) continue;
      const targetId = findDirectionalScanRoomId(targetRoom, normDir, Math.max(1, parsed.distance || 1));
      if (!targetId) continue;
      showTempMobDot(targetId, parsed.count, "nearby");
    }
  }
  updateEmbedQuickControls();

  if (moved && priorWithRoom) {
    addMovementTrail(priorWithRoom, next);
  }

  if (!state.jellyFollowers.get('__player__')
      || state.jellyFollowers.get('__player__').z !== next.z
      || normalizeGridId(state.jellyFollowers.get('__player__').gridId) !== normalizeGridId(next.gridId)) {
    const seed = priorWithRoom || next;
    state.jellyFollowers.set('__player__', {
      x: seed.x,
      y: seed.y,
      vx: 0,
      vy: 0,
      z: next.z,
      gridId: normalizeGridId(next.gridId),
      roomId: String(targetRoom.id || ""),
      headX: next.x,
      headY: next.y,
      headRoomId: String(targetRoom.id || ""),
      targetX: next.x,
      targetY: next.y,
      waypoints: [],
      wobbleT:   Math.random() * 20,
      wobbleAmp: 0,
      blobSeed:  Math.random() * 100,
      speed: PLAYER_BLOB_SLURP_SPEED,
      palette: TRAIL_DOT_PALETTE,
      anchorY: "center",
      isPlayer: true,
      role: 'player'
    });
  }

  const playerBlob = state.jellyFollowers.get('__player__');
  if (playerBlob) {
    if (moved && priorWithRoom) {
      applyFollowerPathUpdate(playerBlob, priorWithRoom, {
        ...next,
        roomId: String(targetRoom.id || "")
      });
      ensureEffectsLoop();
    } else {
      // Non-movement update: refresh metadata only, let blob settle naturally
      playerBlob.z = next.z;
      playerBlob.gridId = normalizeGridId(next.gridId);
      playerBlob.roomId = String(targetRoom.id || "");
      playerBlob.headX = next.x;
      playerBlob.headY = next.y;
      playerBlob.headRoomId = String(targetRoom.id || "");
    }
  }

  if (state.followPlayer) {
    setActiveLayerFromRoom(targetRoom);
    const targetPan = panForRoom(targetRoom);
    startPanAnimation(targetPan.x, targetPan.y, durationMs, moved ? priorWithRoom : null, moved ? next : null);
    return;
  }
  scheduleRender();
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
  if (!state.followPlayer) return;
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

  touchRoomSeen(targetRoom.id);

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

function drawActiveMoveLine(options) {
  const opts = options || {};
  const drawTrailPath = opts.drawTrailPath !== false;
  const tilePx = TILE_SIZE * state.zoom;
  const now = performance.now();

  if (drawTrailPath && state.showTraveledPath) {
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

  const playerBlob = state.jellyFollowers.get('__player__');
  const marker = state.playerLocation || playerBlob;
  if (!marker || marker.z !== state.activeZ) return;
  if (normalizeGridId(marker.gridId) !== normalizeGridId(state.activeGridId)) return;
  const hx = state.panX + (marker.x + 0.5) * tilePx;
  const hy = state.panY + (marker.y + 0.5) * tilePx;

  if (playerBlob) {
    if (playerBlob.z === state.activeZ
        && normalizeGridId(playerBlob.gridId) === normalizeGridId(state.activeGridId)) {
      drawJellyBlobTrail(playerBlob, TRAIL_DOT_PALETTE, { anchorY: "center" });
    }
    drawPlayerBlobIcon(hx, hy, 0, 0);
    return;
  }
  drawPlayerCenterIcon(hx, hy);
}

function drawPlayerCenterIcon(x, y) {
  const outerR = Math.max(2.75, state.zoom * 2.7);
  const innerR = Math.max(0.95, state.zoom * 0.95);
  const tickLen = Math.max(1.4, state.zoom * 1.4);
  const tickGap = Math.max(0.8, state.zoom * 0.8);
  const sprite = getPlayerCenterSprite(outerR, innerR, tickLen, tickGap, shouldReduceGlowEffects());
  ctx.drawImage(sprite.canvas, x - sprite.center, y - sprite.center);
}

function drawPlayerBlobIcon(x, y, vx, vy) {
  const speed = Math.hypot(vx || 0, vy || 0);
  const base = Math.max(3.1, state.zoom * 3.15);
  const stretchT = Math.min(1, speed / 0.95);
  const rx = base * (1 + stretchT * 0.55);
  const ry = base * (1 - stretchT * 0.23);
  const angle = Math.atan2(vy || 0, vx || 0);
  const reduceGlow = shouldReduceGlowEffects();

  ctx.save();
  ctx.translate(x, y);
  if (speed > 0.0001) ctx.rotate(angle);
  ctx.shadowColor = "rgba(190, 208, 255, 0.94)";
  ctx.shadowBlur = Math.max(4, base * (reduceGlow ? 1.2 : 2.0));

  const body = ctx.createRadialGradient(-rx * 0.35, -ry * 0.1, Math.max(0.9, ry * 0.3), 0, 0, Math.max(rx, ry) * 1.5);
  body.addColorStop(0, "rgba(236, 244, 255, 0.98)");
  body.addColorStop(0.6, "rgba(158, 178, 255, 0.98)");
  body.addColorStop(1, "rgba(106, 124, 234, 0.2)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(248, 252, 255, 0.98)";
  ctx.beginPath();
  ctx.arc(-rx * 0.22, -ry * 0.05, Math.max(0.9, base * 0.26), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shouldReduceGlowEffects() {
  return false;
}

function drawRoomStaticSprite(room, options, targetCtx) {
  const opts = options || {};
  const ghost = !!opts.ghost;
  const worldOffsetX = Number.isFinite(opts.worldOffsetX) ? opts.worldOffsetX : state.panX;
  const worldOffsetY = Number.isFinite(opts.worldOffsetY) ? opts.worldOffsetY : state.panY;
  const drawCtx = targetCtx || ctx;
  const tilePx = TILE_SIZE * state.zoom;
  const screenX = worldOffsetX + room.x * tilePx;
  const screenY = worldOffsetY + room.y * tilePx;
  const zoomBucket = getZoomSpriteBucket();
  const sprite = getRoomStaticSprite(room, zoomBucket, ghost);
  if (!sprite) return;

  drawCtx.save();
  if (ghost) {
    drawCtx.globalAlpha *= 0.22;
  }
  drawCtx.drawImage(sprite, screenX, screenY, tilePx, tilePx);
  drawCtx.restore();
}

function drawRoomWallBase(room, targetCtx, options) {
  const opts = options || {};
  const wallVariant = opts.offLayer ? "offLayer" : "default";
  const drawCtx = targetCtx || ctx;
  const tilePx = TILE_SIZE * state.zoom;
  const x = state.panX + room.x * tilePx;
  const y = state.panY + room.y * tilePx;
  const sprite = getRoomWallSprite(room, getZoomSpriteBucket(), wallVariant);
  if (!sprite) return;
  drawCtx.drawImage(sprite.canvas, x - sprite.pad, y - sprite.pad, tilePx + sprite.pad * 2, tilePx + sprite.pad * 2);
}

function getRoomStaticSprite(room, zoomBucket, ghost) {
  const cacheKey = `${ROOM_STATIC_SPRITE_CACHE_REV}:${room.staticSignature}:${ghost ? 1 : 0}:${zoomBucket}`;
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
  setCappedCache(ROOM_STATIC_SPRITE_CACHE, cacheKey, canvas, MAX_ROOM_STATIC_SPRITE_CACHE);
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

  renderRoomPoiMarkersToContext(g, room, tilePx, zoomBucket);
}

function renderRoomTileToContext(g, room, tilePx) {
  const tileBleedY = Math.max(0.22, tilePx * 0.0045);
  const icon = getRoomTileImage(room, tilePx);

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
  const sprite = getRoomWallSprite(room, zoomBucket, "default");
  if (!sprite) return;
  const scale = sprite.tilePx > 0 ? tilePx / sprite.tilePx : 1;
  const drawPad = sprite.pad * scale;
  g.drawImage(sprite.canvas, -drawPad, -drawPad, tilePx + drawPad * 2, tilePx + drawPad * 2);
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

function getRoomWallMask(room) {
  let mask = 0;
  if (!room) return mask;
  if (["wall", "closed", "locked"].includes(getEdgeVariant(room, "n"))) mask |= TRAIL_DIR_BITS.n;
  if (["wall", "closed", "locked"].includes(getEdgeVariant(room, "e"))) mask |= TRAIL_DIR_BITS.e;
  if (["wall", "closed", "locked"].includes(getEdgeVariant(room, "s"))) mask |= TRAIL_DIR_BITS.s;
  if (["wall", "closed", "locked"].includes(getEdgeVariant(room, "w"))) mask |= TRAIL_DIR_BITS.w;
  return mask;
}

function getRoomWallSprite(room, zoomBucket, variant) {
  const spriteVariant = variant || "default";
  const mask = getRoomWallMask(room);
  if (!mask) return null;

  const lineWidth = Math.max(2.6, 2.6 * zoomBucket);
  const pad = Math.ceil(lineWidth * 0.7) + 2;
  const cacheKey = `${ROOM_WALL_SPRITE_CACHE_REV}:${mask}:${zoomBucket}:${pad}:${spriteVariant}`;
  const cached = ROOM_WALL_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const tilePx = Math.max(4, Math.round(TILE_SIZE * zoomBucket));
  const canvas = document.createElement("canvas");
  canvas.width = tilePx + pad * 2;
  canvas.height = tilePx + pad * 2;
  const g = canvas.getContext("2d");
  if (!g) return null;

  renderRoomWallSprite(g, tilePx, pad, mask, zoomBucket, spriteVariant);
  const sprite = { canvas, pad, tilePx };
  setCappedCache(ROOM_WALL_SPRITE_CACHE, cacheKey, sprite, MAX_ROOM_WALL_SPRITE_CACHE);
  return sprite;
}

function renderRoomWallSprite(g, tilePx, pad, mask, zoomBucket, variant) {
  const opacity = wallOpacityForZoomValue(zoomBucket);
  if (opacity <= 0) return;

  const lineWidth = Math.max(WALL_LINE_WIDTH_BASE, WALL_LINE_WIDTH_BASE * zoomBucket) * (tilePx / TILE_SIZE);
  const half = lineWidth * 0.5;
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + tilePx;
  const y1 = pad + tilePx;
  const joinBleed = Math.min(0.7, Math.max(0.08, lineWidth * 0.18));
  const hasN = (mask & TRAIL_DIR_BITS.n) !== 0;
  const hasE = (mask & TRAIL_DIR_BITS.e) !== 0;
  const hasS = (mask & TRAIL_DIR_BITS.s) !== 0;
  const hasW = (mask & TRAIL_DIR_BITS.w) !== 0;
  const isOffLayer = variant === "offLayer";
  const wallColor = isOffLayer ? OFF_LAYER_WALL_COLOR : WALL_COLOR;
  const variantOpacity = isOffLayer ? 0.3 : 1;

  g.save();
  g.globalAlpha *= opacity * variantOpacity;
  g.fillStyle = wallColor;
  if (hasN) {
    const extendLeft = hasW ? joinBleed : 0;
    const extendRight = hasE ? joinBleed : 0;
    g.fillRect(x0 - half - extendLeft, y0 - half, tilePx + lineWidth + extendLeft + extendRight, lineWidth);
  }
  if (hasE) {
    const extendUp = hasN ? joinBleed : 0;
    const extendDown = hasS ? joinBleed : 0;
    g.fillRect(x1 - half, y0 - half - extendUp, lineWidth, tilePx + lineWidth + extendUp + extendDown);
  }
  if (hasS) {
    const extendLeft = hasW ? joinBleed : 0;
    const extendRight = hasE ? joinBleed : 0;
    g.fillRect(x0 - half - extendLeft, y1 - half, tilePx + lineWidth + extendLeft + extendRight, lineWidth);
  }
  if (hasW) {
    const extendUp = hasN ? joinBleed : 0;
    const extendDown = hasS ? joinBleed : 0;
    g.fillRect(x0 - half, y0 - half - extendUp, lineWidth, tilePx + lineWidth + extendUp + extendDown);
  }

  g.restore();
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

  const icon = getRoomTileImage(room, tilePx);
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
  drawRoomWallBase(room);
  drawRoomDoorOverlays(room);
}

function drawRoomDoorOverlays(room) {
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

  const isPlayerRoom = room.id && state.playerRoomId && String(room.id) === String(state.playerRoomId);

  for (const dir of ["n", "e", "s", "w"]) {
    const variant = getEdgeVariant(room, dir);
    if (!variant || variant === "oneway") continue;
    if ((variant === "openpassage" || variant === "open") && !isPlayerRoom) continue;
    if (variant === "openpassage") {
      drawOpenExitMark(dirs[dir], line);
      continue;
    }
    if (variant === "open" || variant === "closed" || variant === "locked") {
      drawDoorMark(dirs[dir], variant === "open" ? "open" : variant, line);
    }
  }
}

function getEdgeVariant(room, dir) {
  const cached = room && state.roomEdgeVariants.get(room.id);
  if (cached && Object.prototype.hasOwnProperty.call(cached, dir)) {
    return cached[dir] || "";
  }
  return computeEdgeVariantRaw(room, dir);
}

function computeEdgeVariantRaw(room, dir) {
  if (!room) return "";
  const exit = room.exits[dir];
  const vec = DIRECTION_VECTORS[dir];
  if (!vec) return "";
  const neighborId = state.roomByCoord.get(coordKey(room.x + vec.dx, room.y + vec.dy, room.z, room.gridId));
  const neighbor = neighborId ? state.roomsById.get(neighborId) : null;
  const reverseDir = OPPOSITE_DIRECTIONS[dir];
  const neighborExit = neighbor && reverseDir ? neighbor.exits[reverseDir] : null;

  const hasOpenPassage = isOpenPassageExit(exit, neighborId) || isOpenPassageExit(neighborExit, room.id);
  const oneWayExit = isConfirmedOneWayExit(room, dir, exit);

  if (hasOpenPassage) {
    if (oneWayExit) return shouldSkipSharedBoundary(dir, neighbor) ? "" : "oneway";
    const openDoor = pickOpenDoorForEdge(exit, neighborExit, neighborId, room.id);
    if (!openDoor) return "openpassage";
    return "open";
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
  drawWallCapsule(ctx, segment, lineWidth, WALL_BORDER_COLOR, color);
  ctx.restore();
}

function drawWallCapsule(g, segment, lineWidth, outerColor, innerColor) {
  const horizontal = segment.y1 === segment.y2;
  const length = horizontal ? Math.abs(segment.x2 - segment.x1) : Math.abs(segment.y2 - segment.y1);
  const thickness = Math.max(1.8, lineWidth);
  const outerThickness = thickness + Math.max(0.8, thickness * 0.24);
  const inset = (outerThickness - thickness) * 0.5;

  g.fillStyle = outerColor;
  if (horizontal) {
    const x = Math.min(segment.x1, segment.x2);
    const y = segment.y1 - outerThickness * 0.5;
    roundedRectPath(g, x - inset, y, length + inset * 2, outerThickness, outerThickness * 0.5);
    g.fill();
    g.fillStyle = innerColor;
    roundedRectPath(g, x, segment.y1 - thickness * 0.5, length, thickness, thickness * 0.5);
    g.fill();
    return;
  }

  const x = segment.x1 - outerThickness * 0.5;
  const y = Math.min(segment.y1, segment.y2);
  g.beginPath();
  roundedRectPath(g, x, y - inset, outerThickness, length + inset * 2, outerThickness * 0.5);
  g.fill();
  g.fillStyle = innerColor;
  roundedRectPath(g, segment.x1 - thickness * 0.5, y, thickness, length, thickness * 0.5);
  g.fill();
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
  ctx.lineWidth = Math.max(1.4, lineWidth * 0.55);

  if (stateLabel === "open") {
    ctx.lineWidth = Math.max(0.95, lineWidth * 0.34);
    ctx.shadowColor = "rgba(248, 213, 110, 0.9)";
    ctx.shadowBlur = Math.max(3, lineWidth * 0.9);
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  } else if (isHorizontal) {
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

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = "rgba(248, 213, 110, 0.96)";
  ctx.lineWidth = Math.max(0.95, lineWidth * 0.34);
  ctx.shadowColor = "rgba(248, 213, 110, 0.9)";
  ctx.shadowBlur = Math.max(3, lineWidth * 0.9);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
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
    setCappedCache(POI_SPRITE_CACHE, cacheKey, fallback, MAX_POI_SPRITE_CACHE);
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
  setCappedCache(POI_SPRITE_CACHE, cacheKey, sprite, MAX_POI_SPRITE_CACHE);
  return sprite;
}

function getWaterDropSprite(size, reduceGlow) {
  const sizeBucket = getSpriteSizeBucket(size, 0.5);
  const cacheKey = `${sizeBucket}:${reduceGlow ? 1 : 0}`;
  const cached = WATER_DROP_SPRITE_CACHE.get(cacheKey);
  if (cached) return cached;

  const glow = sizeBucket * (reduceGlow ? 0.7 : 1.15);
  const center = Math.ceil(sizeBucket + glow + 2);
  const canvasSize = Math.max(12, center * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const g = canvas.getContext("2d");
  if (!g) {
    const fallback = { canvas, center };
    setCappedCache(WATER_DROP_SPRITE_CACHE, cacheKey, fallback, MAX_WATER_DROP_SPRITE_CACHE);
    return fallback;
  }

  const width = sizeBucket * 1.45;
  const lineGap = Math.max(1.8, sizeBucket * 0.42);
  const amplitude = Math.max(1.2, sizeBucket * 0.2);
  const strokeW = Math.max(1.1, sizeBucket * 0.2);

  g.save();
  g.shadowColor = "rgba(96, 222, 255, 0.95)";
  g.shadowBlur = Math.max(4, sizeBucket * (reduceGlow ? 1.0 : 1.6));
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = strokeW;

  function drawWave(offsetY) {
    const left = center - width * 0.5;
    const right = center + width * 0.5;
    g.beginPath();
    g.moveTo(left, center + offsetY);
    g.bezierCurveTo(
      left + width * 0.2, center + offsetY - amplitude,
      left + width * 0.3, center + offsetY - amplitude,
      center, center + offsetY
    );
    g.bezierCurveTo(
      left + width * 0.7, center + offsetY + amplitude,
      left + width * 0.8, center + offsetY + amplitude,
      right, center + offsetY
    );
    g.stroke();
  }

  g.strokeStyle = "rgba(80, 231, 255, 0.92)";
  drawWave(-lineGap * 0.5);
  drawWave(lineGap * 0.5);

  g.shadowBlur = 0;
  g.lineWidth = Math.max(0.7, strokeW * 0.45);
  g.strokeStyle = "rgba(204, 255, 255, 0.86)";
  drawWave(-lineGap * 0.5);
  drawWave(lineGap * 0.5);
  g.restore();

  const sprite = { canvas, center };
  setCappedCache(WATER_DROP_SPRITE_CACHE, cacheKey, sprite, MAX_WATER_DROP_SPRITE_CACHE);
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
    setCappedCache(PLAYER_CENTER_SPRITE_CACHE, cacheKey, fallback, MAX_PLAYER_CENTER_SPRITE_CACHE);
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
  setCappedCache(PLAYER_CENTER_SPRITE_CACHE, cacheKey, sprite, MAX_PLAYER_CENTER_SPRITE_CACHE);
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
  setCappedCache(EDGE_SPRITE_CACHE, cacheKey, canvas, MAX_EDGE_SPRITE_CACHE);
  return canvas;
}

function renderEdgeSprite(g, size, dir, variant, zoomBucket) {
  const opacity = wallOpacityForZoomValue(zoomBucket);
  g.save();
  g.globalAlpha = opacity;
  const lineWidth = Math.max(WALL_LINE_WIDTH_BASE, WALL_LINE_WIDTH_BASE * zoomBucket) * (size / TILE_SIZE);
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

  if (stateLabel === "open") {
    g.lineWidth = Math.max(0.95, lineWidth * 0.34);
    g.shadowColor = "rgba(248, 213, 110, 0.9)";
    g.shadowBlur = Math.max(3, lineWidth * 0.95);
  }

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
    g.strokeStyle = "rgba(127, 240, 176, 0.95)";
    g.lineWidth = Math.max(0.9, size * 0.032);
    g.shadowColor = "rgba(127, 240, 176, 0.9)";
    g.shadowBlur = Math.max(2, size * 0.16);
    const ux = size * 0.84;
    const uy = size * 0.24;
    g.font = `${Math.max(9, Math.round(size * 0.3))}px "Segoe UI Symbol", "Noto Sans Symbols 2", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.strokeText("⌃", ux, uy);
    g.fillText("⌃", ux, uy);
    g.shadowBlur = 0;
  }

  if (hasDown) {
    g.fillStyle = "#6fb8ff";
    g.strokeStyle = "rgba(111, 184, 255, 0.95)";
    g.lineWidth = Math.max(0.9, size * 0.032);
    g.shadowColor = "rgba(111, 184, 255, 0.9)";
    g.shadowBlur = Math.max(2, size * 0.16);
    const dx = size * 0.16;
    const dy = size * 0.74;
    g.font = `${Math.max(9, Math.round(size * 0.3))}px "Segoe UI Symbol", "Noto Sans Symbols 2", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.strokeText("⌄", dx, dy);
    g.fillText("⌄", dx, dy);
    g.shadowBlur = 0;
  }

  setCappedCache(EXTRA_EXIT_SPRITE_CACHE, cacheKey, canvas, MAX_EXTRA_EXIT_SPRITE_CACHE);
  return canvas;
}

function drawGridOutline(tilePx, viewW, viewH) {
  const size = tilePx || (TILE_SIZE * state.zoom);
  const gridColor = state.themeHighlightColor || "#d9b05f";
  const alpha = 0.09;
  const lineWidth = Math.max(WALL_LINE_WIDTH_BASE, WALL_LINE_WIDTH_BASE * state.zoom);
  const startX = Math.floor((-state.panX) / size) - 1;
  const endX = Math.ceil((viewW - state.panX) / size) + 1;
  const startY = Math.floor((-state.panY) / size) - 1;
  const endY = Math.ceil((viewH - state.panY) / size) + 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";

  for (let x = startX; x <= endX; x += 1) {
    const screenX = state.panX + x * size;
    ctx.beginPath();
    ctx.moveTo(screenX + 0.5, 0);
    ctx.lineTo(screenX + 0.5, viewH);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += 1) {
    const screenY = state.panY + y * size;
    ctx.beginPath();
    ctx.moveTo(0, screenY + 0.5);
    ctx.lineTo(viewW, screenY + 0.5);
    ctx.stroke();
  }

  ctx.restore();
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

  const trackedCharsHere = [...state.trackedChars.entries()]
    .filter(([, v]) => v && v.roomId === room.id).map(([n]) => n);
  const trackedMobsHere = [...state.trackedMobs.entries()]
    .filter(([, v]) => v && v.roomId === room.id).map(([, v]) => v.name || String(v.uid || "(unknown)"));

  return [
    `Area: ${room.area || "Unknown"}`,
    `Room: ${room.name || "Unknown"}`,
    nsidText ? `NSID: ${nsidText}` : null,
    ephText ? `ephNum: ${ephText}` : null,
    `XYZ: ${room.x}, ${room.y}, ${room.z}`,
    `Sector: ${room.sector || "unknown"}`,
    `Mobs: ${mobs.length ? `\n- ${mobText}` : mobText}`,
    `Exits: ${exitsText}`,
    trackedCharsHere.length ? `Tracking (chars): ${trackedCharsHere.join(", ")}` : null,
    trackedMobsHere.length ? `Tracking (mobs): ${trackedMobsHere.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

function clampTooltipPositionInWrap(wrap, tooltip, preferredLeft, preferredTop) {
  const maxX = Math.max(0, wrap.clientWidth - tooltip.offsetWidth - 8);
  const maxY = Math.max(0, wrap.clientHeight - tooltip.offsetHeight - 8);
  return {
    left: Math.max(8, Math.min(maxX, preferredLeft)),
    top: Math.max(8, Math.min(maxY, preferredTop))
  };
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
  const preferredLeft = clientX - wrapRect.left + offset;
  const preferredTop = clientY - wrapRect.top + offset;
  const pos = clampTooltipPositionInWrap(wrap, tooltip, preferredLeft, preferredTop);

  tooltip.style.left = `${pos.left}px`;
  tooltip.style.top = `${pos.top}px`;
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
  if (state.sessionMode === "anon") return;
  if (state.persistTimer) {
    window.clearTimeout(state.persistTimer);
    state.persistTimer = 0;
  }
  if (state.persistIdleId && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(state.persistIdleId);
    state.persistIdleId = 0;
  }
  try {
    const rooms = state.mapData.rooms
      .map(normalizeRoom)
      .filter((room) => !!room);
    if (rooms.length !== state.mapData.rooms.length) {
      state.mapData.rooms = rooms;
      rebuildIndexes();
      syncZLevels();
      updateInspector();
    }
    localStorage.setItem(activeStorageKey(), JSON.stringify({
      ...state.mapData,
      rooms
    }));
    state.storageLoadedKey = state.storageKey;
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
  if (state.sessionMode === "anon") {
    activeStorageKey();
    return false;
  }
  const candidates = storageLoadCandidates();
  for (const key of candidates) {
    if (loadPersistedMapFromKey(key)) {
      activeStorageKey();
      return true;
    }
  }
  activeStorageKey();
  return false;
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

function currentRoomHasNearbyMobs(room) {
  if (!room || !room.nearbyMobs || typeof room.nearbyMobs !== "object") return false;
  for (const dir of Object.keys(room.nearbyMobs)) {
    const parsed = parseNearbyMobsEntry(room.nearbyMobs[dir]);
    if ((parsed.count || 0) > 0) return true;
  }
  return false;
}

function pruneMobHintAges(now) {
  let knownChanged = false;

  for (const [roomId, entry] of state.tempMobDotByRoom.entries()) {
    if (mobHintAlphaForTime(entry.seenAt, now) > 0) continue;
    state.tempMobDotByRoom.delete(roomId);
    const room = state.roomsById.get(roomId);
    if (!room || !Array.isArray(room.knownMobs) || room.knownMobs.length === 0) continue;
    room.knownMobs = [];
    knownChanged = true;
  }

  if (knownChanged) {
    schedulePersistMap();
  }
}

function hasActiveMobHintEffects(now) {
  if (mobHintAlphaForTime(state.roomMobsSeenAt, now) > 0) return true;
  for (const entry of state.tempMobDotByRoom.values()) {
    if (mobHintAlphaForTime(entry.seenAt, now) > 0) return true;
  }
  return false;
}

function hasActiveRoomPulseEffect() {
  const activeRoomId = state.playerRoomId ? String(state.playerRoomId) : "";
  if (!activeRoomId) return false;
  const activeRoom = state.roomsById.get(activeRoomId);
  if (!activeRoom) return false;
  return activeRoom.z === state.activeZ
    && normalizeGridId(activeRoom.gridId) === normalizeGridId(state.activeGridId);
}

function updateAllJellyFollowers(dt) {
  if (!state.jellyFollowers.size) return;
  for (const follower of state.jellyFollowers.values()) {
    if (!follower) continue;
    const headX = follower.headX != null ? follower.headX : follower.targetX;
    const headY = follower.headY != null ? follower.headY : follower.targetY;
    const prevLag = Math.hypot(headX - follower.x, headY - follower.y);
    advanceBlobFollower(follower, dt, follower.speed);
    const newLag  = Math.hypot(headX - follower.x, headY - follower.y);
    if (prevLag > 0.12 && newLag <= 0.12) follower.wobbleAmp = 0.35;
    follower.wobbleT = (follower.wobbleT || 0) + dt * 3.2;
    if ((follower.wobbleAmp || 0) > 0.001) {
      follower.wobbleAmp = (follower.wobbleAmp || 0) * Math.exp(-dt * 2.15);
    } else {
      follower.wobbleAmp = 0;
    }
  }
}

function pruneAllJellyTrails(now) {
  if (!state.jellyFollowers.size) return;
  for (const [key, follower] of state.jellyFollowers.entries()) {
    if (!follower) { state.jellyFollowers.delete(key); continue; }
    if (follower.isPlayer) continue; // player managed by room-update handler
    if (!follower.toRoomId || !state.roomsById.has(String(follower.toRoomId))) {
      state.jellyFollowers.delete(key); continue;
    }
    if (follower.z !== state.activeZ || normalizeGridId(follower.gridId) !== normalizeGridId(state.activeGridId)) continue;
    const dx = (follower.headX != null ? follower.headX : follower.targetX) - follower.x;
    const dy = (follower.headY != null ? follower.headY : follower.targetY) - follower.y;
    const speed = Math.hypot(follower.vx || 0, follower.vy || 0);
    const waypoints = Array.isArray(follower.waypoints) ? follower.waypoints : [];
    if (waypoints.length === 0 && Math.hypot(dx, dy) < 0.004 && speed < 0.003) {
      follower.x = follower.headX != null ? follower.headX : follower.targetX;
      follower.y = follower.headY != null ? follower.headY : follower.targetY;
      follower.vx = 0;
      follower.vy = 0;
    }
  }
}

function hasActiveJellyFollowers() {
  if (!state.jellyFollowers.size) return false;
  for (const follower of state.jellyFollowers.values()) {
    if (!follower) continue;
    if (follower.z !== state.activeZ) continue;
    if (normalizeGridId(follower.gridId) !== normalizeGridId(state.activeGridId)) continue;
    if ((follower.wobbleAmp || 0) > 0.015) return true;
    const headX = follower.headX != null ? follower.headX : follower.targetX;
    const headY = follower.headY != null ? follower.headY : follower.targetY;
    const lag = Math.hypot(headX - follower.x, headY - follower.y);
    const speed = Math.hypot(follower.vx || 0, follower.vy || 0);
    const hasWaypoints = Array.isArray(follower.waypoints) && follower.waypoints.length > 0;
    if (hasWaypoints || lag > 0.004 || speed > 0.003) return true;
  }
  return false;
}

function ensureEffectsLoop() {
  const anim = state.animation;
  if (anim.effectRafId) return;

  const tick = (now) => {
    const prevTs = Number.isFinite(state.animation.lastEffectTs) && state.animation.lastEffectTs > 0
      ? state.animation.lastEffectTs
      : now;
    const dt = Math.max(1 / 240, Math.min(0.07, (now - prevTs) / 1000));
    state.animation.lastEffectTs = now;
    updatePanAnimation(now);
    updateAllJellyFollowers(dt);
    pruneMovementTrail(now);
    pruneAllJellyTrails(now);
    pruneMobHintAges(now);
    const targetFrameMs = state.animation.active ? 33 : 16;
    if ((now - anim.lastRenderTs) >= targetFrameMs) {
      render();
      anim.lastRenderTs = now;
    }

    if (state.animation.active || state.movementTrail.length > 0 || hasActiveJellyFollowers() || hasActiveMobHintEffects(now) || hasActiveRoomPulseEffect()) {
      anim.effectRafId = requestAnimationFrame(tick);
      return;
    }
    if ((performance.now() - anim.lastRenderTs) > 8) {
      render();
      anim.lastRenderTs = performance.now();
    }
    anim.effectRafId = 0;
    anim.lastEffectTs = 0;
  };

  anim.effectRafId = requestAnimationFrame(tick);
}

function clearAreaByGridId(gridId, areaID) {
  const key = normalizeGridId(gridId);
  const kept = state.mapData.rooms.filter((r) => {
    if (normalizeGridId(r.gridId) !== key) return true;  // different grid — keep
    if (areaID != null) return r.areaID !== areaID;       // same grid, different area — keep
    return false;                                          // no areaID provided — remove all in grid
  });
  if (kept.length === state.mapData.rooms.length) return;
  state.mapData.rooms = kept;
  markStaticLayerDirty();
  if (state.selectedRoomId) {
    const still = state.roomsById.get(state.selectedRoomId);
    if (!still || (normalizeGridId(still.gridId) === key && (areaID == null || still.areaID === areaID))) state.selectedRoomId = null;
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
