// ================================================================
// FREIGN World Map — Canvas renderer, BFS pathfinding, interactions
// ================================================================
(function () {
    'use strict';

    // ---- Constants ----
    var CELL    = 14;         // room tile size (px)
    var GAP     = 8;          // gap between tiles
    var SPACING = CELL + GAP; // grid pitch
    var MIN_ZOOM   = 0.06;
    var MAX_ZOOM   = 6.0;
    var LABEL_ZOOM = 2.2;       // room labels only at close zoom
    var AREA_LABEL_ZOOM = 0.08;  // keep area labels visible when zoomed out

    // ORIG_DOOR index -> label
    var DIR_NAMES  = ['N', 'E', 'S', 'W', 'U', 'D'];
    var DIR_ARROWS = ['↑N', '→E', '↓S', '←W', '↑U', '↓D'];

    var THEME_PRESETS = {
        dark: {
            canvasBg: '#0a0a0e',
            link: 'rgba(80,80,110,0.35)',
            pathLink: 'rgba(224,200,100,0.72)',
            roomLabel: '#8f8470',
            pathLabel: '#e0c87a',
            areaLabel: 'rgba(196,170,110,0.78)',
            areaLabelStroke: 'rgba(8,8,12,0.45)',
            hoverBorder: '#707090',
            originBorder: '#e0c87a',
            destBorder: '#7ab0e0',
            pathBorder: '#b09050',
            sectors: {
                0:  { name: 'Inside',      fill: '#1e1e26', border: '#4a4a60' },
                1:  { name: 'City',        fill: '#241e14', border: '#907848' },
                2:  { name: 'Field',       fill: '#141e14', border: '#407840' },
                3:  { name: 'Forest',      fill: '#0e160e', border: '#286828' },
                4:  { name: 'Hills',       fill: '#1e1e14', border: '#787840' },
                5:  { name: 'Mountain',    fill: '#1a1818', border: '#706060' },
                6:  { name: 'Water',       fill: '#101828', border: '#284878' },
                7:  { name: 'Deep Water',  fill: '#0c1020', border: '#1e3060' },
                8:  { name: 'Swamp',       fill: '#141a10', border: '#3a5030' },
                9:  { name: 'Air',         fill: '#141820', border: '#3a4858' },
                10: { name: 'Desert',      fill: '#22180a', border: '#806030' },
                11: { name: 'Lava',        fill: '#1e0c06', border: '#783018' },
                12: { name: 'Snow',        fill: '#1a1e22', border: '#6888a0' },
                _default: { name: 'Unknown', fill: '#181820', border: '#383848' },
            }
        },
        parchment: {
            canvasBg: '#efe5cd',
            link: 'rgba(132,106,66,0.28)',
            pathLink: 'rgba(178,102,22,0.78)',
            roomLabel: '#5f4a2e',
            pathLabel: '#8d4d12',
            areaLabel: 'rgba(110,74,30,0.72)',
            areaLabelStroke: 'rgba(255,245,226,0.55)',
            hoverBorder: '#82643a',
            originBorder: '#9e5f1f',
            destBorder: '#4d7ca8',
            pathBorder: '#9e6e2b',
            sectors: {
                0:  { name: 'Inside',      fill: '#e4dbc6', border: '#907f62' },
                1:  { name: 'City',        fill: '#d9c8a7', border: '#a98047' },
                2:  { name: 'Field',       fill: '#ced9b0', border: '#6d8f4a' },
                3:  { name: 'Forest',      fill: '#c2cfaa', border: '#587b3d' },
                4:  { name: 'Hills',       fill: '#ddd6ac', border: '#8d8347' },
                5:  { name: 'Mountain',    fill: '#cfc7ba', border: '#7f7260' },
                6:  { name: 'Water',       fill: '#b9cfe6', border: '#547ea9' },
                7:  { name: 'Deep Water',  fill: '#a8c2df', border: '#496d95' },
                8:  { name: 'Swamp',       fill: '#c3cda9', border: '#65754b' },
                9:  { name: 'Air',         fill: '#dbe4ed', border: '#7289a0' },
                10: { name: 'Desert',      fill: '#e6d29e', border: '#a1843c' },
                11: { name: 'Lava',        fill: '#d4b09e', border: '#a05a35' },
                12: { name: 'Snow',        fill: '#eef3f8', border: '#7fa3ba' },
                _default: { name: 'Unknown', fill: '#dfd7c8', border: '#8e816d' },
            }
        },
        cobalt: {
            canvasBg: '#111722',
            link: 'rgba(99,120,152,0.33)',
            pathLink: 'rgba(187,214,255,0.76)',
            roomLabel: '#9fb5d1',
            pathLabel: '#d8e9ff',
            areaLabel: 'rgba(157,192,235,0.72)',
            areaLabelStroke: 'rgba(10,16,28,0.54)',
            hoverBorder: '#86a2c8',
            originBorder: '#c1dcff',
            destBorder: '#8ec7ff',
            pathBorder: '#98bee9',
            sectors: {
                0:  { name: 'Inside',      fill: '#1f2634', border: '#5c7191' },
                1:  { name: 'City',        fill: '#2c2930', border: '#8b7a8c' },
                2:  { name: 'Field',       fill: '#1d2a26', border: '#4b7e73' },
                3:  { name: 'Forest',      fill: '#1a2524', border: '#427568' },
                4:  { name: 'Hills',       fill: '#2a2d26', border: '#7f8661' },
                5:  { name: 'Mountain',    fill: '#262731', border: '#70758b' },
                6:  { name: 'Water',       fill: '#1a2638', border: '#4f79a7' },
                7:  { name: 'Deep Water',  fill: '#172236', border: '#466d97' },
                8:  { name: 'Swamp',       fill: '#232a25', border: '#63765f' },
                9:  { name: 'Air',         fill: '#262e3b', border: '#70849f' },
                10: { name: 'Desert',      fill: '#322c23', border: '#9a8054' },
                11: { name: 'Lava',        fill: '#3a2520', border: '#a25d49' },
                12: { name: 'Snow',        fill: '#2b3340', border: '#7e9fbe' },
                _default: { name: 'Unknown', fill: '#222936', border: '#5f728d' },
            }
        }
    };

    var activeTheme = 'cobalt';
    var activePalette = THEME_PRESETS.cobalt;

    function sectorStyle(s) {
        var map = activePalette.sectors;
        return map[s] || map._default;
    }

    function hexToRgbaColor(hex, alpha) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        var h = hex.slice(1);
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        var r = parseInt(h.slice(0, 2), 16);
        var g = parseInt(h.slice(2, 4), 16);
        var b = parseInt(h.slice(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function getPaperPattern() {
        if (getPaperPattern._pattern) return getPaperPattern._pattern;

        var noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 128;
        noiseCanvas.height = 128;
        var nctx = noiseCanvas.getContext('2d');
        var img = nctx.createImageData(noiseCanvas.width, noiseCanvas.height);

        for (var i = 0; i < img.data.length; i += 4) {
            var base = 118 + Math.floor(Math.random() * 20);
            var grainA = 5 + Math.floor(Math.random() * 10);
            img.data[i] = base;
            img.data[i + 1] = base - 2;
            img.data[i + 2] = base - 6;
            img.data[i + 3] = grainA;
        }
        nctx.putImageData(img, 0, 0);

        // Very light fiber streaks to suggest old paper texture.
        nctx.strokeStyle = 'rgba(170,140,96,0.06)';
        nctx.lineWidth = 1;
        for (var l = 0; l < 18; l++) {
            var y = Math.floor(Math.random() * noiseCanvas.height);
            nctx.beginPath();
            nctx.moveTo(0, y + Math.random() * 2 - 1);
            nctx.lineTo(noiseCanvas.width, y + Math.random() * 2 - 1);
            nctx.stroke();
        }

        getPaperPattern._pattern = ctx.createPattern(noiseCanvas, 'repeat');
        return getPaperPattern._pattern;
    }

    function drawMapPatina() {
        var w = canvas.width;
        var h = canvas.height;
        var isDarkTheme = (activeTheme !== 'parchment');

        var pattern = getPaperPattern();
        if (pattern) {
            ctx.save();
            ctx.globalCompositeOperation = isDarkTheme ? 'screen' : 'multiply';
            ctx.globalAlpha = isDarkTheme ? 0.07 : 0.06;
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

    function getHazeNoisePattern() {
        if (getHazeNoisePattern._pattern) return getHazeNoisePattern._pattern;

        var noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 96;
        noiseCanvas.height = 96;
        var nctx = noiseCanvas.getContext('2d');
        var img = nctx.createImageData(noiseCanvas.width, noiseCanvas.height);

        // Tiny monochrome grain to dither smooth gradients and reduce visible banding.
        for (var i = 0; i < img.data.length; i += 4) {
            var v = 114 + Math.floor(Math.random() * 26);
            var a = 6 + Math.floor(Math.random() * 14);
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = a;
        }

        nctx.putImageData(img, 0, 0);
        getHazeNoisePattern._pattern = ctx.createPattern(noiseCanvas, 'repeat');
        return getHazeNoisePattern._pattern;
    }

    function visibleSectorProfile(tl, br, margin) {
        var counts = Object.create(null);
        var total = 0;
        for (var vnum in rooms) {
            var r = rooms[vnum];
            if (r.worldX < tl.x - margin || r.worldX > br.x + margin) continue;
            if (r.worldY < tl.y - margin || r.worldY > br.y + margin) continue;
            if (layerMode === 'expanded' && r.gridZ !== currentLayer) continue;
            counts[r.sector] = (counts[r.sector] || 0) + 1;
            total++;
        }
        if (!total) return null;

        var ranked = [];
        for (var s in counts) ranked.push({ sector: +s, count: counts[s] });
        ranked.sort(function (a, b) { return b.count - a.count; });

        return {
            total: total,
            primary: ranked[0] ? ranked[0].sector : null,
            secondary: ranked[1] ? ranked[1].sector : null,
            tertiary: ranked[2] ? ranked[2].sector : null,
        };
    }

    function drawSectorHaze(profile) {
        var w = canvas.width;
        var h = canvas.height;
        ctx.fillStyle = activePalette.canvasBg;
        ctx.fillRect(0, 0, w, h);

        if (!profile || profile.primary === null) return;

        var p1 = sectorStyle(profile.primary);
        var p2 = sectorStyle(profile.secondary !== null ? profile.secondary : profile.primary);
        var p3 = sectorStyle(profile.tertiary !== null ? profile.tertiary : profile.secondary !== null ? profile.secondary : profile.primary);

        // Layered wash keeps atmosphere while avoiding sharp gradient bands.
        var wash = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, h);
        wash.addColorStop(0.00, hexToRgbaColor(p1.fill, 0.08));
        wash.addColorStop(0.30, hexToRgbaColor(p2.fill, 0.06));
        wash.addColorStop(0.60, hexToRgbaColor(p3.fill, 0.07));
        wash.addColorStop(1.00, hexToRgbaColor(p1.fill, 0.05));
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);

        var wash2 = ctx.createLinearGradient(0, h * 0.15, w, h * 0.85);
        wash2.addColorStop(0.00, hexToRgbaColor(p3.border, 0.04));
        wash2.addColorStop(0.50, hexToRgbaColor(p2.border, 0.03));
        wash2.addColorStop(1.00, hexToRgbaColor(p1.border, 0.04));
        ctx.fillStyle = wash2;
        ctx.fillRect(0, 0, w, h);

        // Soft sector haze blooms
        var g1 = ctx.createRadialGradient(w * 0.20, h * 0.28, w * 0.02, w * 0.20, h * 0.28, w * 0.58);
        g1.addColorStop(0.00, hexToRgbaColor(p1.border, 0.12));
        g1.addColorStop(1.00, hexToRgbaColor(p1.border, 0.00));
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);

        var g2 = ctx.createRadialGradient(w * 0.78, h * 0.24, w * 0.01, w * 0.78, h * 0.24, w * 0.46);
        g2.addColorStop(0.00, hexToRgbaColor(p2.border, 0.10));
        g2.addColorStop(1.00, hexToRgbaColor(p2.border, 0.00));
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);

        var g3 = ctx.createRadialGradient(w * 0.50, h * 0.92, h * 0.01, w * 0.50, h * 0.92, h * 0.62);
        g3.addColorStop(0.00, hexToRgbaColor(p3.fill, 0.09));
        g3.addColorStop(1.00, hexToRgbaColor(p3.fill, 0.00));
        ctx.fillStyle = g3;
        ctx.fillRect(0, 0, w, h);

        // Grain pass acts as dithering to mask monitor/compositor banding.
        var noise = getHazeNoisePattern();
        if (noise) {
            ctx.save();
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = noise;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // Subtle vignette keeps center readable while preserving atmosphere.
        var vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.18, w * 0.5, h * 0.45, Math.max(w, h) * 0.86);
        vignette.addColorStop(0.00, 'rgba(0,0,0,0.00)');
        vignette.addColorStop(1.00, 'rgba(0,0,0,0.16)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }

    // ---- State ----
    var canvas  = document.getElementById('map-canvas');
    var ctx     = canvas.getContext('2d');
    var wrap    = document.getElementById('canvas-wrap');
    var tooltip = document.getElementById('tooltip');
    var loading = document.getElementById('loading');
    var themeSelect = document.getElementById('theme-select');

    var rooms      = {};   // vnum -> room object (with worldX, worldY, area, sector, name, exits)
    var adjacency  = {};   // vnum -> [{v, d}]
    var areaMap    = {};   // short_name -> area object
    var worldAreas = [];   // ordered list of area placement records

    // Layer mode
    var layerMode    = 'collapsed';  // 'collapsed' | 'expanded'
    var currentLayer = 0;
    var globalMinLayer = 0;
    var globalMaxLayer = 0;

    // Camera
    var cam = { x: 0, y: 0, scale: 0.4 };

    // Selection / path
    var selOrigin = null;   // vnum
    var selDest   = null;   // vnum
    var pathVnums = [];     // ordered vnums of current path
    var pathSet   = {};     // fast lookup
    var pathDirs  = [];     // direction at each step

    // Mouse tracking
    var drag = { active: false, sx: 0, sy: 0, cx: 0, cy: 0 };
    var lastMouseWorld = { x: 0, y: 0 };
    var hoveredVnum = null;

    applyTheme(readStoredTheme());
    if (themeSelect) {
        themeSelect.value = activeTheme;
        themeSelect.addEventListener('change', function () {
            applyTheme(themeSelect.value);
            buildLegend();
        });
    }

    // ---- Data loading ----
    var _worldData = null;
    var canvas3d   = document.getElementById('map-canvas-3d');
    var view3dBtn  = document.getElementById('view-3d-btn');
    var mode3d     = false;

    function enter3D() {
        mode3d = true;
        canvas.style.display    = 'none';
        canvas3d.style.display  = 'block';
        var wrap = canvas.parentElement;
        canvas3d.width  = wrap.clientWidth;
        canvas3d.height = wrap.clientHeight;
        if (view3dBtn) { view3dBtn.textContent = '2D Map'; view3dBtn.classList.add('active'); }
        if (_worldData) {
            Map3D.init(canvas3d, _worldData);
            sync3DSelectionState();
        }
    }

    function exit3D() {
        mode3d = false;
        canvas3d.style.display = 'none';
        canvas.style.display   = 'block';
        if (view3dBtn) { view3dBtn.textContent = '3D View'; view3dBtn.classList.remove('active'); }
    }

    if (view3dBtn) {
        view3dBtn.addEventListener('click', function () {
            if (mode3d) { exit3D(); } else { enter3D(); }
        });
    }

    window.addEventListener('resize', function () {
        if (!mode3d || !canvas3d) return;
        var wrap = canvas.parentElement;
        Map3D.resize(wrap.clientWidth, wrap.clientHeight);
    });

    // ---- Data loading ----
    fetch('data/world.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            _worldData = data;
            buildGraph(data);
            loading.style.display = 'none';
            buildLegend();
            resizeCanvas();
            centerView();
            requestAnimationFrame(renderLoop);
        })
        .catch(function (e) {
            loading.textContent = 'Error loading data/world.json: ' + e.message;
        });

    function buildGraph(data) {
        worldAreas = data.world;
        globalMinLayer = 0;
        globalMaxLayer = 0;

        for (var i = 0; i < data.world.length; i++) {
            var wa = data.world[i];
            var ad = data.areas[wa.n];
            if (!ad) continue;

            var areaPX = wa.wx * SPACING;
            var areaPY = wa.wy * SPACING;
            var areaW  = ad.w * SPACING;
            var areaH  = ad.h * SPACING;

            var areaObj = {
                shortName: wa.n,
                name:      ad.name || wa.n,
                sector:    wa.s,
                px: areaPX,
                py: areaPY,
                w:  areaW,
                h:  areaH,
                gridW: ad.w,
                gridH: ad.h,
                minZ: ad.minZ || 0,
                maxZ: ad.maxZ || 0,
                rooms: [],
                roomKeySet: Object.create(null),
            };
            areaMap[wa.n] = areaObj;

            for (var j = 0; j < ad.rooms.length; j++) {
                var rj = ad.rooms[j];
                var wx = areaPX + rj.x * SPACING + SPACING / 2;
                var wy = areaPY + rj.y * SPACING + SPACING / 2;
                var rz = rj.z || 0;

                if (rz < globalMinLayer) globalMinLayer = rz;
                if (rz > globalMaxLayer) globalMaxLayer = rz;

                var room = {
                    vnum:   rj.v,
                    name:   rj.n,
                    area:   wa.n,
                    sector: rj.s,
                    gridX:  rj.x,
                    gridY:  rj.y,
                    gridZ:  rz,
                    worldX: wx,
                    worldY: wy,
                    exits:  rj.ex || [],
                };
                rooms[rj.v] = room;
                areaObj.rooms.push(room);
                areaObj.roomKeySet[rj.x + ',' + rj.y] = true;

                adjacency[rj.v] = rj.ex || [];
            }
        }
    }

    // ---- BFS pathfinding ----
    function bfs(startVnum, endVnum) {
        if (startVnum === endVnum) return { path: [startVnum], dirs: [] };

        var visited = {};
        var prev    = {};
        var prevDir = {};
        var queue   = [startVnum];
        visited[startVnum] = true;

        while (queue.length > 0) {
            var cur = queue.shift();
            if (cur === endVnum) {
                var path = [], dirs = [], v = endVnum;
                while (v !== startVnum) {
                    path.unshift(v);
                    dirs.unshift(prevDir[v]);
                    v = prev[v];
                }
                path.unshift(startVnum);
                return { path: path, dirs: dirs };
            }
            var exits = adjacency[cur];
            if (!exits) continue;
            for (var i = 0; i < exits.length; i++) {
                var ex = exits[i];
                if (!visited[ex.v] && rooms[ex.v]) {
                    visited[ex.v] = true;
                    prev[ex.v]    = cur;
                    prevDir[ex.v] = ex.d;
                    queue.push(ex.v);
                }
            }
        }
        return null;
    }

    // ---- Camera helpers ----
    function worldToScreen(wx, wy) {
        return {
            x: (wx - cam.x) * cam.scale + canvas.width  / 2,
            y: (wy - cam.y) * cam.scale + canvas.height / 2,
        };
    }

    function screenToWorld(sx, sy) {
        return {
            x: (sx - canvas.width  / 2) / cam.scale + cam.x,
            y: (sy - canvas.height / 2) / cam.scale + cam.y,
        };
    }

    function centerView() {
        if (worldAreas.length === 0) return;
        var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        for (var v in rooms) {
            var r = rooms[v];
            if (r.worldX < minX) minX = r.worldX;
            if (r.worldX > maxX) maxX = r.worldX;
            if (r.worldY < minY) minY = r.worldY;
            if (r.worldY > maxY) maxY = r.worldY;
        }
        cam.x = (minX + maxX) / 2;
        cam.y = (minY + maxY) / 2;
        var pad = SPACING * 2.5;
        var scaleX = (canvas.width * 0.96)  / Math.max(1, (maxX - minX + pad * 2));
        var scaleY = (canvas.height * 0.96) / Math.max(1, (maxY - minY + pad * 2));
        cam.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));
    }

    // ---- Rendering ----
    function resizeCanvas() {
        canvas.width  = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
    }

    function renderLoop() {
        resizeCanvas();
        render();
        requestAnimationFrame(renderLoop);
    }

    function render() {
        var s = cam.scale;
        var cellPx = CELL * s;
        var spacPx = SPACING * s;

        // Ensure no alpha carry-over between frames.
        ctx.globalAlpha = 1.0;

        // Compute visible world bounds
        var tl = screenToWorld(0, 0);
        var br = screenToWorld(canvas.width, canvas.height);
        var margin = SPACING * 5;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = activePalette.canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawMapPatina();

        // ---- Gather visible areas ----
        var visibleAreas = [];
        for (var an in areaMap) {
            var a = areaMap[an];
            if (a.px + a.w + margin < tl.x) continue;
            if (a.py + a.h + margin < tl.y) continue;
            if (a.px - margin > br.x) continue;
            if (a.py - margin > br.y) continue;
            visibleAreas.push(a);
        }

        drawAreaBackplates(visibleAreas, s);

        // ---- Draw exit lines ----
        if (s >= 0.18) {
            ctx.lineWidth = Math.max(0.5, s * 0.6);
            for (var vnum in rooms) {
                var r = rooms[vnum];
                if (r.worldX < tl.x - margin || r.worldX > br.x + margin) continue;
                if (r.worldY < tl.y - margin || r.worldY > br.y + margin) continue;

                // In expanded mode only draw exits from the current layer
                if (layerMode === 'expanded' && r.gridZ !== currentLayer) continue;

                var rs = worldToScreen(r.worldX, r.worldY);
                var inPath = !!pathSet[vnum];

                for (var i = 0; i < r.exits.length; i++) {
                    var ex  = r.exits[i];
                    var nb  = rooms[ex.v];
                    if (!nb) continue;
                    // Only draw each connection once (lower vnum draws it)
                    if (ex.v < +vnum) continue;

                    // In expanded mode: skip U/D exits (drawn as indicators) and cross-layer exits
                    if (layerMode === 'expanded') {
                        if (ex.d >= 4) continue;
                        if (nb.gridZ !== currentLayer) continue;
                    }

                    var ns = worldToScreen(nb.worldX, nb.worldY);
                    var inPathEdge = inPath && !!pathSet[ex.v];

                    if (inPathEdge) {
                        ctx.strokeStyle = activePalette.pathLink;
                        ctx.lineWidth = Math.max(1.5, s * 1.2);
                    } else {
                        ctx.strokeStyle = activePalette.link;
                        ctx.lineWidth = Math.max(0.5, s * 0.6);
                    }
                    ctx.beginPath();
                    ctx.moveTo(rs.x, rs.y);
                    ctx.lineTo(ns.x, ns.y);
                    ctx.stroke();
                }
            }
        }

        // ---- Draw rooms ----
        var half = cellPx / 2;
        for (var vnum in rooms) {
            var r = rooms[vnum];
            if (r.worldX < tl.x - margin || r.worldX > br.x + margin) continue;
            if (r.worldY < tl.y - margin || r.worldY > br.y + margin) continue;

            // Layer filtering in expanded mode
            var layerDiff = 0;
            if (layerMode === 'expanded') {
                layerDiff = Math.abs(r.gridZ - currentLayer);
                if (layerDiff > 1) continue;
                ctx.globalAlpha = layerDiff === 1 ? 0.36 : 1.0;
            }

            var rs   = worldToScreen(r.worldX, r.worldY);
            var sec  = sectorStyle(r.sector);
            var isOrigin  = (r.vnum === selOrigin);
            var isDest    = (r.vnum === selDest);
            var isInPath  = !!pathSet[r.vnum];
            var isHovered = (r.vnum === hoveredVnum);

            // Room square
            ctx.fillStyle = isInPath ? '#2a2010' : sec.fill;
            ctx.fillRect(rs.x - half, rs.y - half, cellPx, cellPx);

            // Border
            if (isOrigin) {
                ctx.strokeStyle = activePalette.originBorder;
                ctx.lineWidth = Math.max(1.5, s * 1.5);
            } else if (isDest) {
                ctx.strokeStyle = activePalette.destBorder;
                ctx.lineWidth = Math.max(1.5, s * 1.5);
            } else if (isInPath) {
                ctx.strokeStyle = activePalette.pathBorder;
                ctx.lineWidth = Math.max(1, s);
            } else if (isHovered) {
                ctx.strokeStyle = activePalette.hoverBorder;
                ctx.lineWidth = Math.max(1, s);
            } else {
                ctx.strokeStyle = sec.border;
                ctx.lineWidth = Math.max(0.5, s * 0.7);
            }
            ctx.strokeRect(rs.x - half, rs.y - half, cellPx, cellPx);

            // Selection dot
            if (isOrigin || isDest) {
                var dotR = Math.max(2, cellPx * 0.25);
                ctx.fillStyle = isOrigin ? activePalette.originBorder : activePalette.destBorder;
                ctx.beginPath();
                ctx.arc(rs.x, rs.y, dotR, 0, Math.PI * 2);
                ctx.fill();
            }

            // U/D exit indicators in expanded mode (on-layer rooms only)
            if (layerMode === 'expanded' && layerDiff === 0 && s >= 0.18) {
                var hasUp = false, hasDown = false;
                for (var ei = 0; ei < r.exits.length; ei++) {
                    var ed = r.exits[ei].d;
                    if (ed === 4 && rooms[r.exits[ei].v]) hasUp = true;
                    if (ed === 5 && rooms[r.exits[ei].v]) hasDown = true;
                }
                if (hasUp || hasDown) {
                    var indSize = Math.max(4, cellPx * 0.32);
                    ctx.globalAlpha = 0.82;
                    ctx.fillStyle = activePalette.areaLabel || '#c8b87a';
                    ctx.font = Math.max(7, Math.round(indSize * 1.1)) + 'px Consolas, monospace';
                    ctx.textAlign = 'center';
                    if (hasUp)   ctx.fillText('↑', rs.x, rs.y - half - 2);
                    if (hasDown) ctx.fillText('↓', rs.x, rs.y + half + Math.max(8, indSize * 1.1));
                    ctx.globalAlpha = 1.0;
                }
            }

            // Room name label at close zoom, with fixed readable size
            if (s >= LABEL_ZOOM && r.name && layerDiff === 0) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = isInPath ? activePalette.pathLabel : activePalette.roomLabel;
                ctx.font = '10px Consolas, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(r.name, rs.x, rs.y + half + 10);
            }

            ctx.globalAlpha = 1.0;
        }

        // ---- Draw path direction arrows ----
        if (pathVnums.length > 1 && s >= 0.5) {
            ctx.fillStyle = activePalette.pathLabel;
            ctx.font = '10px Consolas, monospace';
            ctx.textAlign = 'center';
            for (var pi = 0; pi < pathDirs.length; pi++) {
                var rv = rooms[pathVnums[pi]];
                var nv = rooms[pathVnums[pi + 1]];
                if (!rv || !nv) continue;
                var ms = worldToScreen(
                    (rv.worldX + nv.worldX) / 2,
                    (rv.worldY + nv.worldY) / 2
                );
                var d = pathDirs[pi];
                if (d >= 0 && d <= 5) {
                    ctx.fillText(DIR_ARROWS[d], ms.x, ms.y + 3);
                }
            }
        }

        // ---- Draw area labels on top of rooms ----
        if (s >= AREA_LABEL_ZOOM) {
            drawAreaLabels(visibleAreas, s);
        }
    }

    function drawAreaBackplates(areas, zoomScale) {
        ctx.save();
        var isDarkTheme = (activeTheme !== 'parchment');
        for (var i = 0; i < areas.length; i++) {
            var a = areas[i];
            var sec = sectorStyle(a.sector);
            var roomList = a.rooms || [];
            if (!roomList.length) continue;

            // Footprint-tint follows room layout; no global haze and no circular blooms.
            var tile = Math.max(8, CELL * zoomScale * 1.75);
            var halfTile = tile * 0.5;
            var fillAlpha = isDarkTheme ? 0.15 : 0.12;
            var edgeAlpha = isDarkTheme ? 0.24 : 0.20;

            ctx.fillStyle = hexToRgbaColor(sec.fill, fillAlpha);
            for (var ri = 0; ri < roomList.length; ri++) {
                var rr = roomList[ri];
                var rs = worldToScreen(rr.worldX, rr.worldY);
                if (rs.x < -tile || rs.x > canvas.width + tile) continue;
                if (rs.y < -tile || rs.y > canvas.height + tile) continue;
                ctx.fillRect(rs.x - halfTile, rs.y - halfTile, tile, tile);
            }

            // Faint contour ink along exposed room edges adds old-map character.
            var edgeHalf = Math.max(halfTile, SPACING * zoomScale * 0.45);
            var keySet = a.roomKeySet || Object.create(null);
            ctx.strokeStyle = hexToRgbaColor(sec.border, edgeAlpha);
            ctx.lineWidth = Math.max(0.6, zoomScale * 0.45);
            ctx.beginPath();

            for (var ei = 0; ei < roomList.length; ei++) {
                var er = roomList[ei];
                var es = worldToScreen(er.worldX, er.worldY);
                if (es.x < -edgeHalf || es.x > canvas.width + edgeHalf) continue;
                if (es.y < -edgeHalf || es.y > canvas.height + edgeHalf) continue;

                var x0 = es.x - edgeHalf;
                var x1 = es.x + edgeHalf;
                var y0 = es.y - edgeHalf;
                var y1 = es.y + edgeHalf;

                if (!keySet[(er.gridX - 1) + ',' + er.gridY]) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
                if (!keySet[(er.gridX + 1) + ',' + er.gridY]) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
                if (!keySet[er.gridX + ',' + (er.gridY - 1)]) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
                if (!keySet[er.gridX + ',' + (er.gridY + 1)]) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAreaLabels(areas, zoomScale) {
        for (var i = 0; i < areas.length; i++) {
            var a = areas[i];
            var secStyle = sectorStyle(a.sector);
            var labelColor = secStyle.border;
            var areaWeight = Math.sqrt(Math.max(1, a.gridW * a.gridH));
            var labelText = (a.name || '').toUpperCase();

            var sp = worldToScreen(a.px, a.py);
            var boxW = a.w * zoomScale;
            var boxH = a.h * zoomScale;
            var lx = sp.x + boxW / 2;
            var ly = sp.y + boxH / 2;
            var zoomedInMode = zoomScale >= 0.95;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (zoomedInMode) {
                // Zoomed in: pin label to top edge of area bounds.
                var fontTop = Math.max(8, Math.min(14, 10 + Math.log(areaWeight + 1) * 0.8));
                ctx.font = '700 ' + fontTop.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';

                var topTextW = ctx.measureText(labelText).width;
                var topPadX = Math.max(4, fontTop * 0.34);
                var topPadY = Math.max(2, fontTop * 0.2);
                var maxTopW = Math.max(18, boxW - 8);
                var desiredTopW = topTextW + topPadX * 2;
                if (desiredTopW > maxTopW) {
                    var scaleTop = maxTopW / desiredTopW;
                    fontTop = Math.max(7, fontTop * scaleTop);
                    ctx.font = '700 ' + fontTop.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
                    topTextW = ctx.measureText(labelText).width;
                    topPadX = Math.max(3, fontTop * 0.30);
                }
                var topW = Math.min(maxTopW, topTextW + topPadX * 2);
                var topH = fontTop + topPadY * 2;
                var topX = Math.max(sp.x + 2, Math.min(sp.x + boxW - topW - 2, lx - topW / 2));
                var topY = sp.y + 2;
                var topR = Math.max(3, topH * 0.24);

                ctx.globalAlpha = 0.62;
                ctx.fillStyle = activePalette.canvasBg;
                roundedRect(ctx, topX, topY, topW, topH, topR);
                ctx.fill();

                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = activePalette.areaLabelStroke;
                ctx.lineWidth = 1;
                roundedRect(ctx, topX, topY, topW, topH, topR);
                ctx.stroke();

                ctx.globalAlpha = 0.96;
                ctx.fillStyle = labelColor;
                ctx.fillText(labelText, topX + topW / 2, topY + topH / 2 + 0.5);
            } else {
                // Zoomed out: large centered badges over room names.
                var baseSize = 12 + Math.min(16, Math.log(areaWeight + 1) * 3.2);
                var zoomOutBoost = Math.max(0.85, Math.min(1.45, Math.pow(1 / Math.max(zoomScale, 0.08), 0.2)));
                var fontCenter = Math.max(8, Math.min(28, baseSize * zoomOutBoost));
                ctx.font = '700 ' + fontCenter.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';

                var textW = ctx.measureText(labelText).width;
                var padX = Math.max(4, fontCenter * 0.30);
                var padY = Math.max(3, fontCenter * 0.22);
                var maxBw = Math.max(20, boxW - 6);
                var desiredBw = textW + padX * 2;
                if (desiredBw > maxBw) {
                    var scaleCenter = maxBw / desiredBw;
                    fontCenter = Math.max(7, fontCenter * scaleCenter);
                    ctx.font = '700 ' + fontCenter.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
                    textW = ctx.measureText(labelText).width;
                    padX = Math.max(3, fontCenter * 0.25);
                }
                var bw = Math.min(maxBw, textW + padX * 2);
                var bh = fontCenter + padY * 2;
                var bx = Math.max(sp.x + 2, Math.min(sp.x + boxW - bw - 2, lx - bw / 2));
                var by = Math.max(sp.y + 2, Math.min(sp.y + boxH - bh - 2, ly - bh / 2));
                var rr = Math.max(4, bh * 0.28);

                ctx.globalAlpha = Math.max(0.35, Math.min(0.75, 0.3 + zoomScale * 0.9));
                ctx.fillStyle = activePalette.canvasBg;
                roundedRect(ctx, bx, by, bw, bh, rr);
                ctx.fill();

                ctx.globalAlpha = Math.max(0.55, Math.min(0.95, 0.45 + zoomScale * 0.7));
                ctx.strokeStyle = activePalette.areaLabelStroke;
                ctx.lineWidth = Math.max(1, fontCenter * 0.08);
                roundedRect(ctx, bx, by, bw, bh, rr);
                ctx.stroke();

                ctx.globalAlpha = Math.max(0.7, Math.min(1.0, 0.58 + zoomScale * 0.6));
                ctx.fillStyle = labelColor;
                ctx.fillText(labelText, bx + bw / 2, by + bh / 2 + 0.5);
            }

            ctx.restore();
        }
    }

    function roundedRect(context, x, y, w, h, r) {
        var rr = Math.min(r, w / 2, h / 2);
        context.beginPath();
        context.moveTo(x + rr, y);
        context.lineTo(x + w - rr, y);
        context.quadraticCurveTo(x + w, y, x + w, y + rr);
        context.lineTo(x + w, y + h - rr);
        context.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        context.lineTo(x + rr, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - rr);
        context.lineTo(x, y + rr);
        context.quadraticCurveTo(x, y, x + rr, y);
        context.closePath();
    }

    // ---- Spatial hit-test ----
    function roomAtScreen(sx, sy) {
        var w = screenToWorld(sx, sy);
        var best = null, bestDist = (SPACING / 2) * (SPACING / 2);
        for (var v in rooms) {
            var r = rooms[v];
            var dx = r.worldX - w.x, dy = r.worldY - w.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestDist) { bestDist = d2; best = r.vnum; }
        }
        return best;
    }

    // ---- Selection & pathfinding ----
    function sync3DSelectionState() {
        if (!window.Map3D || typeof Map3D.setSelectionState !== 'function') return;
        Map3D.setSelectionState(selOrigin, selDest, pathVnums);
    }

    function selectRoom(vnum) {
        if (!rooms[vnum]) return;

        if (selOrigin === null) {
            selOrigin = vnum;
            pathVnums = []; pathSet = {}; pathDirs = [];
            selDest = null;
            updateSidebar();
        } else if (selDest === null && vnum !== selOrigin) {
            selDest = vnum;
            runPathfinding();
            updateSidebar();
        } else {
            // Reset and start fresh
            selOrigin = vnum;
            selDest   = null;
            pathVnums = []; pathSet = {}; pathDirs = [];
            updateSidebar();
        }
    }

    function runPathfinding() {
        if (!selOrigin || !selDest) return;
        var result = bfs(selOrigin, selDest);
        if (!result) {
            pathVnums = []; pathSet = {}; pathDirs = [];
        } else {
            pathVnums = result.path;
            pathDirs  = result.dirs;
            pathSet   = {};
            for (var i = 0; i < pathVnums.length; i++) pathSet[pathVnums[i]] = true;
        }
    }

    // 3D map emits this event when a room square is clicked.
    window.addEventListener('map3d-room-click', function (e) {
        var detail = e && e.detail;
        var vnum = detail ? +detail.vnum : 0;
        if (!rooms[vnum]) return;
        selectRoom(vnum);
    });

    // ---- Sidebar ----
    function roomCardHtml(vnum, cssClass) {
        var r = rooms[vnum];
        if (!r) return '';
        var a  = areaMap[r.area] || {};
        var sec = sectorStyle(r.sector);
        return '<div class="sb-room ' + cssClass + '" data-vnum="' + vnum + '">' +
               '<div class="sb-room-name">' + esc(r.name) + '</div>' +
               '<div class="sb-room-meta">' + esc(a.name || r.area) +
               ' &nbsp;·&nbsp; vnum ' + vnum +
               ' &nbsp;·&nbsp; ' + sec.name + '</div>' +
               '</div>';
    }

    function updateSidebar() {
        var hintO  = document.getElementById('hint-origin');
        var hintD  = document.getElementById('hint-dest');
        var secO   = document.getElementById('section-origin');
        var secD   = document.getElementById('section-dest');
        var secP   = document.getElementById('section-path');
        var steps  = document.getElementById('path-steps');
        var pLen   = document.getElementById('path-length');

        if (selOrigin) {
            secO.innerHTML = '<div class="sb-label">Origin</div>' + roomCardHtml(selOrigin, 'origin');
        } else {
            secO.innerHTML = '<div class="sb-label">Origin</div><div class="sb-hint">Click a room on the map</div>';
        }

        if (selDest) {
            secD.innerHTML = '<div class="sb-label">Destination</div>' + roomCardHtml(selDest, 'dest');
        } else {
            secD.innerHTML = '<div class="sb-label">Destination</div><div class="sb-hint" id="hint-dest">Click a second room</div>';
        }

        if (pathVnums.length > 1) {
            secP.style.display = '';
            pLen.textContent = pathDirs.length;
            var html = '';
            for (var i = 0; i < pathDirs.length; i++) {
                var r = rooms[pathVnums[i + 1]];
                var d = pathDirs[i];
                var dirLabel = (d >= 0 && d <= 5) ? DIR_NAMES[d] : '?';
                html += '<li data-vnum="' + pathVnums[i + 1] + '">' +
                        '<span class="step-dir">' + dirLabel + '</span>' +
                        '<span class="step-room">' + esc(r ? r.name : '?') + '</span>' +
                        '</li>';
            }
            steps.innerHTML = html;
        } else if (selOrigin && selDest) {
            secP.style.display = '';
            pLen.textContent = '0';
            steps.innerHTML = '<li><span class="step-room" style="color:#a05050">No path found</span></li>';
        } else {
            secP.style.display = 'none';
            steps.innerHTML = '';
        }

        sync3DSelectionState();
    }

    // Click on path step -> center on that room
    document.getElementById('path-steps').addEventListener('click', function (e) {
        var li = e.target.closest('li[data-vnum]');
        if (!li) return;
        jumpToRoom(+li.dataset.vnum);
    });
    document.getElementById('sidebar-body').addEventListener('click', function (e) {
        var card = e.target.closest('.sb-room[data-vnum]');
        if (!card) return;
        jumpToRoom(+card.dataset.vnum);
    });

    // ---- Search ----
    var searchInput = document.getElementById('search-input');
    var searchBtn   = document.getElementById('search-btn');

    function doSearch() {
        var q = searchInput.value.trim().toLowerCase();
        if (!q) return;

        var secSR    = document.getElementById('section-search-results');
        var listEl   = document.getElementById('search-results-list');
        var results  = [];

        // Match area names first
        for (var an in areaMap) {
            if (areaMap[an].name.toLowerCase().indexOf(q) >= 0 || an.indexOf(q) >= 0) {
                results.push({ type: 'area', obj: areaMap[an] });
                if (results.length >= 5) break;
            }
        }

        // Then room names
        if (results.length < 10) {
            for (var v in rooms) {
                var r = rooms[v];
                if (r.name && r.name.toLowerCase().indexOf(q) >= 0) {
                    results.push({ type: 'room', vnum: r.vnum });
                    if (results.length >= 15) break;
                }
            }
        }

        // Vnum lookup
        if (/^\d+$/.test(q) && rooms[+q]) {
            results.unshift({ type: 'room', vnum: +q });
        }

        if (results.length === 0) {
            listEl.innerHTML = '<div class="sb-hint">No results</div>';
        } else {
            var html = '';
            for (var i = 0; i < results.length; i++) {
                var res = results[i];
                if (res.type === 'area') {
                    html += '<div class="sb-room" data-area="' + esc(res.obj.shortName) + '">' +
                            '<div class="sb-room-name">' + esc(res.obj.name) + '</div>' +
                            '<div class="sb-room-meta">Area &nbsp;·&nbsp; ' + res.obj.rooms.length + ' rooms</div>' +
                            '</div>';
                } else {
                    var rr = rooms[res.vnum];
                    html += '<div class="sb-room" data-vnum="' + res.vnum + '">' +
                            '<div class="sb-room-name">' + esc(rr.name) + '</div>' +
                            '<div class="sb-room-meta">vnum ' + res.vnum + ' &nbsp;·&nbsp; ' + esc((areaMap[rr.area] || {}).name || rr.area) + '</div>' +
                            '</div>';
                }
            }
            listEl.innerHTML = html;
        }

        secSR.style.display = '';
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    document.getElementById('search-results-list').addEventListener('click', function (e) {
        var card = e.target.closest('[data-vnum]');
        if (card) { jumpToRoom(+card.dataset.vnum); return; }
        var acard = e.target.closest('[data-area]');
        if (acard) { jumpToArea(acard.dataset.area); }
    });

    // ---- Camera centering ----
    function jumpToRoom(vnum) {
        if (mode3d && window.Map3D && typeof Map3D.focusRoom === 'function') {
            Map3D.focusRoom(vnum);
            return;
        }
        centerOnRoom(vnum);
    }

    function jumpToArea(aname) {
        if (mode3d && window.Map3D && typeof Map3D.focusArea === 'function') {
            Map3D.focusArea(aname);
            return;
        }
        centerOnArea(aname);
    }

    function centerOnRoom(vnum) {
        var r = rooms[vnum];
        if (!r) return;
        cam.x = r.worldX;
        cam.y = r.worldY;
        cam.scale = Math.max(cam.scale, 1.5);
    }

    function centerOnArea(aname) {
        var a = areaMap[aname];
        if (!a) return;
        cam.x = a.px + a.w / 2;
        cam.y = a.py + a.h / 2;
        var scaleX = canvas.width  / (a.w + SPACING * 8);
        var scaleY = canvas.height / (a.h + SPACING * 8);
        cam.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));
    }

    // ---- Input handling ----
    canvas.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        drag.active = true;
        drag.sx = e.clientX;
        drag.sy = e.clientY;
        drag.cx = cam.x;
        drag.cy = cam.y;
        drag.moved = false;
    });

    window.addEventListener('mousemove', function (e) {
        var rect = canvas.getBoundingClientRect();
        var sx = e.clientX - rect.left;
        var sy = e.clientY - rect.top;
        lastMouseWorld = screenToWorld(sx, sy);

        if (drag.active) {
            var dx = e.clientX - drag.sx;
            var dy = e.clientY - drag.sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
            cam.x = drag.cx - dx / cam.scale;
            cam.y = drag.cy - dy / cam.scale;
        }

        // Hover hit-test (throttled to every frame via hoveredVnum)
        hoveredVnum = roomAtScreen(sx, sy);
        if (hoveredVnum) {
            var r = rooms[hoveredVnum];
            var a = areaMap[r.area] || {};
            tooltip.style.display = 'block';
            tooltip.style.left = (sx + 14) + 'px';
            tooltip.style.top  = (sy + 8)  + 'px';
            tooltip.innerHTML  = '<strong>' + esc(r.name) + '</strong><br>' +
                                 esc(a.name || r.area) + ' · vnum ' + r.vnum + '<br>' +
                                 sectorStyle(r.sector).name;
        } else {
            tooltip.style.display = 'none';
        }
    });

    window.addEventListener('mouseup', function (e) {
        if (e.button !== 0) return;
        if (drag.active && !drag.moved) {
            // Click: hit-test for room selection
            var rect = canvas.getBoundingClientRect();
            var vnum = roomAtScreen(e.clientX - rect.left, e.clientY - rect.top);
            if (vnum) selectRoom(vnum);
        }
        drag.active = false;
    });

    canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        var factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
        var rect  = canvas.getBoundingClientRect();
        var sx    = e.clientX - rect.left;
        var sy    = e.clientY - rect.top;
        var before = screenToWorld(sx, sy);
        cam.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.scale * factor));
        var after  = screenToWorld(sx, sy);
        cam.x += before.x - after.x;
        cam.y += before.y - after.y;
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            selOrigin = null; selDest = null;
            pathVnums = []; pathSet = {}; pathDirs = [];
            updateSidebar();
        }
        if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            searchInput.focus();
        }
        // Layer navigation (expanded mode only)
        if (layerMode === 'expanded') {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentLayer < globalMaxLayer) {
                    currentLayer++;
                    updateLayerNav();
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentLayer > globalMinLayer) {
                    currentLayer--;
                    updateLayerNav();
                }
            }
        }
    });

    // ---- Layer mode ----
    function updateLayerNav() {
        var nav = document.getElementById('layer-nav');
        var lbl = document.getElementById('layer-label');
        var upBtn  = document.getElementById('layer-up');
        var dnBtn  = document.getElementById('layer-down');
        if (!nav) return;
        if (layerMode === 'expanded') {
            nav.style.display = 'flex';
            lbl.textContent = 'Floor ' + currentLayer;
            if (upBtn)  upBtn.disabled  = (currentLayer >= globalMaxLayer);
            if (dnBtn)  dnBtn.disabled  = (currentLayer <= globalMinLayer);
        } else {
            nav.style.display = 'none';
        }
    }

    var layerModeBtn = document.getElementById('layer-mode-btn');
    if (layerModeBtn) {
        layerModeBtn.addEventListener('click', function () {
            if (layerMode === 'collapsed') {
                layerMode = 'expanded';
                currentLayer = 0;
                layerModeBtn.textContent = 'Layers: Expanded';
            } else {
                layerMode = 'collapsed';
                layerModeBtn.textContent = 'Layers: Collapsed';
            }
            updateLayerNav();
        });
    }

    var layerUpBtn = document.getElementById('layer-up');
    var layerDnBtn = document.getElementById('layer-down');
    if (layerUpBtn) {
        layerUpBtn.addEventListener('click', function () {
            if (currentLayer < globalMaxLayer) { currentLayer++; updateLayerNav(); }
        });
    }
    if (layerDnBtn) {
        layerDnBtn.addEventListener('click', function () {
            if (currentLayer > globalMinLayer) { currentLayer--; updateLayerNav(); }
        });
    }

    // ---- Legend ----
    function buildLegend() {
        var el  = document.getElementById('legend-list');
        if (!el) return;
        var html = '';
        var sectors = activePalette.sectors;
        for (var k in sectors) {
            if (k === '_default') continue;
            var sec = sectors[k];
            html += '<div class="leg-item">' +
                    '<div class="leg-swatch" style="background:' + sec.fill + ';border-color:' + sec.border + '"></div>' +
                    sec.name + '</div>';
        }
        el.innerHTML = html;
    }

    function applyTheme(name) {
        if (!THEME_PRESETS[name]) name = 'cobalt';
        activeTheme = name;
        activePalette = THEME_PRESETS[name];
        document.body.setAttribute('data-theme', name);
        try { localStorage.setItem('freignMapTheme', name); } catch (_) {}
    }

    function readStoredTheme() {
        try {
            var v = localStorage.getItem('freignMapTheme');
            if (v === 'dusk') return 'cobalt';
            return THEME_PRESETS[v] ? v : 'cobalt';
        } catch (_) {
            return 'cobalt';
        }
    }

    // ---- Utility ----
    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

})();
