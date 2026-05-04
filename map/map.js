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
    fetch('data/world.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            buildGraph(data);
            loading.style.display = 'none';
            buildLegend();
            centerView();
            requestAnimationFrame(renderLoop);
        })
        .catch(function (e) {
            loading.textContent = 'Error loading data/world.json: ' + e.message;
        });

    function buildGraph(data) {
        worldAreas = data.world;

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
                rooms: [],
            };
            areaMap[wa.n] = areaObj;

            for (var j = 0; j < ad.rooms.length; j++) {
                var rj = ad.rooms[j];
                var wx = areaPX + rj.x * SPACING + SPACING / 2;
                var wy = areaPY + rj.y * SPACING + SPACING / 2;

                var room = {
                    vnum:   rj.v,
                    name:   rj.n,
                    area:   wa.n,
                    sector: rj.s,
                    gridX:  rj.x,
                    gridY:  rj.y,
                    worldX: wx,
                    worldY: wy,
                    exits:  rj.ex || [],
                };
                rooms[rj.v] = room;
                areaObj.rooms.push(room);

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
        var scaleX = canvas.width  / (maxX - minX + SPACING * 6);
        var scaleY = canvas.height / (maxY - minY + SPACING * 6);
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = activePalette.canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var s = cam.scale;
        var cellPx = CELL * s;
        var spacPx = SPACING * s;

        // Compute visible world bounds
        var tl = screenToWorld(0, 0);
        var br = screenToWorld(canvas.width, canvas.height);
        var margin = SPACING * 5;

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

        // ---- Draw exit lines ----
        if (s >= 0.18) {
            ctx.lineWidth = Math.max(0.5, s * 0.6);
            for (var vnum in rooms) {
                var r = rooms[vnum];
                if (r.worldX < tl.x - margin || r.worldX > br.x + margin) continue;
                if (r.worldY < tl.y - margin || r.worldY > br.y + margin) continue;

                var rs = worldToScreen(r.worldX, r.worldY);
                var inPath = !!pathSet[vnum];

                for (var i = 0; i < r.exits.length; i++) {
                    var ex  = r.exits[i];
                    var nb  = rooms[ex.v];
                    if (!nb) continue;
                    // Only draw each connection once (lower vnum draws it)
                    if (ex.v < +vnum) continue;

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

            // Room name label at close zoom, with fixed readable size
            if (s >= LABEL_ZOOM && r.name) {
                ctx.fillStyle = isInPath ? activePalette.pathLabel : activePalette.roomLabel;
                ctx.font = '10px Consolas, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(r.name, rs.x, rs.y + half + 10);
            }
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

    function drawAreaLabels(areas, zoomScale) {
        for (var i = 0; i < areas.length; i++) {
            var a = areas[i];
            var secStyle = sectorStyle(a.sector);
            var labelColor = secStyle.border;
            var areaWeight = Math.sqrt(Math.max(1, a.gridW * a.gridH));

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
                var fontTop = Math.max(10, Math.min(14, 10 + Math.log(areaWeight + 1) * 0.8));
                ctx.font = '700 ' + fontTop.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';

                var topTextW = ctx.measureText(a.name).width;
                var topPadX = Math.max(6, fontTop * 0.42);
                var topPadY = Math.max(2, fontTop * 0.2);
                var topW = topTextW + topPadX * 2;
                var topH = fontTop + topPadY * 2;
                var topX = lx - topW / 2;
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
                ctx.fillText(a.name.toUpperCase(), lx, topY + topH / 2 + 0.5);
            } else {
                // Zoomed out: large centered badges over room names.
                var baseSize = 12 + Math.min(16, Math.log(areaWeight + 1) * 3.2);
                var zoomOutBoost = Math.max(0.85, Math.min(1.45, Math.pow(1 / Math.max(zoomScale, 0.08), 0.2)));
                var fontCenter = Math.max(12, Math.min(28, baseSize * zoomOutBoost));
                ctx.font = '700 ' + fontCenter.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';

                var textW = ctx.measureText(a.name).width;
                var padX = Math.max(6, fontCenter * 0.35);
                var padY = Math.max(3, fontCenter * 0.22);
                var bw = textW + padX * 2;
                var bh = fontCenter + padY * 2;
                var bx = lx - bw / 2;
                var by = ly - bh / 2;
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
                ctx.fillText(a.name.toUpperCase(), lx, ly + 0.5);
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
    }

    // Click on path step -> center on that room
    document.getElementById('path-steps').addEventListener('click', function (e) {
        var li = e.target.closest('li[data-vnum]');
        if (!li) return;
        centerOnRoom(+li.dataset.vnum);
    });
    document.getElementById('sidebar-body').addEventListener('click', function (e) {
        var card = e.target.closest('.sb-room[data-vnum]');
        if (!card) return;
        centerOnRoom(+card.dataset.vnum);
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
        if (card) { centerOnRoom(+card.dataset.vnum); return; }
        var acard = e.target.closest('[data-area]');
        if (acard) { centerOnArea(acard.dataset.area); }
    });

    // ---- Camera centering ----
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
    });

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
