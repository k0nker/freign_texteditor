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

    var themeApi = window.FreignThemes || null;
    var THEME_PRESETS = {
        dark: {
            canvasBg: '#0a0a0e',
            link: 'rgba(122,140,178,0.52)',
            pathLink: 'rgba(244,220,126,0.90)',
            roomLabel: '#d6c9ad',
            pathLabel: '#f1db98',
            areaLabel: 'rgba(232,208,148,0.96)',
            areaLabelStroke: 'rgba(8,8,12,0.45)',
            hoverBorder: '#707090',
            originBorder: '#e0c87a',
            destBorder: '#7ab0e0',
            pathBorder: '#b09050',
            sectors: {
                0:  { name: 'Inside',      fill: '#1e1e26', border: '#4a4a60' },
                1:  { name: 'City',        fill: '#241e14', border: '#907848' },
                2:  { name: 'Field',       fill: '#141e14', border: '#407840' },
                3:  { name: 'Forest',      fill: '#0f1d0f', border: '#296725' },
                4:  { name: 'Hills',       fill: '#2a2612', border: '#b1954a' },
                5:  { name: 'Mountain',    fill: '#2d2411', border: '#c9ab54' },
                6:  { name: 'Water',       fill: '#10254a', border: '#3e80d6' },
                7:  { name: 'Deep Water',  fill: '#0b1b3e', border: '#2f66bf' },
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
            link: 'rgba(132,162,204,0.52)',
            pathLink: 'rgba(220,238,255,0.92)',
            roomLabel: '#d7e6fa',
            pathLabel: '#f0f7ff',
            areaLabel: 'rgba(196,224,255,0.96)',
            areaLabelStroke: 'rgba(10,16,28,0.54)',
            hoverBorder: '#86a2c8',
            originBorder: '#c1dcff',
            destBorder: '#8ec7ff',
            pathBorder: '#98bee9',
            sectors: {
                0:  { name: 'Inside',      fill: '#1f2634', border: '#5c7191' },
                1:  { name: 'City',        fill: '#2c2930', border: '#8b7a8c' },
                2:  { name: 'Field',       fill: '#1d2a26', border: '#4b7e73' },
                3:  { name: 'Forest',      fill: '#15281f', border: '#3d7442' },
                4:  { name: 'Hills',       fill: '#36321e', border: '#c2ab5d' },
                5:  { name: 'Mountain',    fill: '#302816', border: '#d1b262' },
                6:  { name: 'Water',       fill: '#143463', border: '#5aa4ff' },
                7:  { name: 'Deep Water',  fill: '#10284f', border: '#4b89db' },
                8:  { name: 'Swamp',       fill: '#232a25', border: '#63765f' },
                9:  { name: 'Air',         fill: '#262e3b', border: '#70849f' },
                10: { name: 'Desert',      fill: '#322c23', border: '#9a8054' },
                11: { name: 'Lava',        fill: '#3a2520', border: '#a25d49' },
                12: { name: 'Snow',        fill: '#2b3340', border: '#7e9fbe' },
                _default: { name: 'Unknown', fill: '#222936', border: '#5f728d' },
            }
        },
        amethyst: {
            canvasBg: '#19131f',
            link: 'rgba(186,164,210,0.45)',
            pathLink: 'rgba(241,225,255,0.92)',
            roomLabel: '#efe4ff',
            pathLabel: '#fff3ff',
            areaLabel: 'rgba(235,214,255,0.96)',
            areaLabelStroke: 'rgba(18,10,24,0.56)',
            hoverBorder: '#b799d9',
            originBorder: '#ddc0ff',
            destBorder: '#b5dbff',
            pathBorder: '#cfadea',
            sectors: {
                0:  { name: 'Inside',      fill: '#30273a', border: '#7d6694' },
                1:  { name: 'City',        fill: '#3a2d35', border: '#9e7890' },
                2:  { name: 'Field',       fill: '#2b332e', border: '#6ea187' },
                3:  { name: 'Forest',      fill: '#233427', border: '#57926b' },
                4:  { name: 'Hills',       fill: '#43332a', border: '#b59272' },
                5:  { name: 'Mountain',    fill: '#3f3026', border: '#be9d79' },
                6:  { name: 'Water',       fill: '#263d65', border: '#7eb5ff' },
                7:  { name: 'Deep Water',  fill: '#1f3052', border: '#6698de' },
                8:  { name: 'Swamp',       fill: '#313a33', border: '#7a8d79' },
                9:  { name: 'Air',         fill: '#343a47', border: '#8b9ab8' },
                10: { name: 'Desert',      fill: '#453a31', border: '#ba9e72' },
                11: { name: 'Lava',        fill: '#4a2e2d', border: '#c7736d' },
                12: { name: 'Snow',        fill: '#3c4352', border: '#9bb4d5' },
                _default: { name: 'Unknown', fill: '#332d3f', border: '#8976a5' },
            }
        }
    };

    var activeTheme = 'amethyst';
    var activePalette = THEME_PRESETS.amethyst;

    // Canonical ANSI-aligned sector palette (from legacy room_color_table semantics).
    var ANSI_COLOR_HEX = {
        w: '#b8b8b8',
        W: '#f2f2f2',
        mp: '#b07898',
        y: '#a38a2a',
        Y: '#f0cf63',
        g: '#2f7a2f',
        G: '#58c35d',
        b: '#3157b0',
        B: '#4f92ff',
        c: '#4db7c8',
        R: '#cf4a4a',
        br: '#6b3f1e',
        ob: '#8c5a1e',
    };

    function sectorAnsiCode(sector) {
        switch (sector) {
            case 0: return 'w'; // inside
            case 1: return 'mp'; // city (mauve-pink)
            case 2: return 'y'; // field
            case 3: return 'g'; // forest
            case 4: return 'ob'; // hills (orange-brown)
            case 5: return 'br'; // mountain (brown)
            case 6: return 'B'; // water_swim
            case 7: return 'b'; // water_noswim
            case 8: return 'G'; // swamp
            case 9: return 'c'; // air
            case 10: return 'Y'; // desert
            case 11: return 'R'; // lava
            case 12: return 'W'; // snow
            default: return 'w';
        }
    }

    function hexToRgb(hex) {
        var h = hex.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }

    function rgbToHex(r, g, b) {
        return '#'
            + Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0')
            + Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0')
            + Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
    }

    function blendHex(a, b, t) {
        var ca = hexToRgb(a);
        var cb = hexToRgb(b);
        return rgbToHex(
            ca.r + (cb.r - ca.r) * t,
            ca.g + (cb.g - ca.g) * t,
            ca.b + (cb.b - ca.b) * t
        );
    }

    function sectorStyle(s) {
        var map = activePalette.sectors;
        var sec = map[s] || map._default;
        var ansiBase = ANSI_COLOR_HEX[sectorAnsiCode(s)] || ANSI_COLOR_HEX.w;
        var fill = ansiBase;
        var border = blendHex(ansiBase, '#000000', 0.28);

        return {
            name: sec.name,
            fill: fill,
            border: border,
        };
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
        var isDarkTheme = !isLightTheme(activeTheme);

        var pattern = getPaperPattern();
        if (pattern) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = isDarkTheme ? 0.012 : 0.04;
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

    function paintBackdropLayers(visibleAreas, zoomScale) {
        drawMapPatina();
        drawAreaBackplates(visibleAreas, zoomScale);
    }

    // ---- State ----
    var canvas  = document.getElementById('map-canvas');
    var ctx     = canvas.getContext('2d');
    var wrap    = document.getElementById('canvas-wrap');
    var tooltip = document.getElementById('tooltip');
    var loading = document.getElementById('loading');
    var themeSelect = document.getElementById('site-theme-select') || document.getElementById('theme-select');

    var rooms      = {};   // vnum -> room object (with worldX, worldY, area, sector, name, exits)
    var adjacency  = {};   // vnum -> [{v, d}]
    var areaMap    = {};   // short_name -> area object
    var worldAreas = [];   // ordered list of area placement records

    // Grid filtering
    var activeGridId = 'global';
    var activeRealm  = null;   // null = static file, 'public' or 'test' = fetched realm

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
    }
    window.addEventListener('freign-theme-changed', function (evt) {
        if (!evt || !evt.detail) return;
        applyTheme(evt.detail.themeId);
        if (themeSelect) themeSelect.value = activeTheme;
        buildLegend();
    });

    // ---- Data loading ----
    var _worldData    = null;
    var canvas3d      = document.getElementById('map-canvas-3d');
    var gridSelect    = document.getElementById('grid-select');
    var publicMapBtn  = document.getElementById('use-public-map-btn');
    var testMapBtn    = document.getElementById('use-test-map-btn');
    var toggle2d      = document.getElementById('toggle-2d');
    var toggle3d      = document.getElementById('toggle-3d');
    var modeOpts2d    = document.getElementById('mode-options-2d');
    var modeOpts3d    = document.getElementById('mode-options-3d');
    var controlsHint  = document.getElementById('controls-hint');
    var layerModeChk  = document.getElementById('layer-mode-chk');
    var trueMapChk    = document.getElementById('true-map-chk');
    var cubeModeChk   = document.getElementById('cube-mode-chk');
    var mode3d        = false;
    var trueMapping3d = false;

    function apply3DTrueMappingMode() {
        if (!window.Map3D || typeof Map3D.setTrueMapping !== 'function') return;
        Map3D.setTrueMapping(trueMapping3d);
    }

    function applyCubeMode() {
        if (!window.Map3D || typeof Map3D.setCubeMode !== 'function') return;
        Map3D.setCubeMode(cubeModeChk ? cubeModeChk.checked : false);
    }

    function setViewMode(is3d) {
        mode3d = is3d;
        if (toggle2d) toggle2d.classList.toggle('active', !is3d);
        if (toggle3d) toggle3d.classList.toggle('active',  is3d);
        if (modeOpts2d) modeOpts2d.style.display = is3d ? 'none' : 'flex';
        if (modeOpts3d) modeOpts3d.style.display = is3d ? 'flex'  : 'none';
        if (controlsHint) controlsHint.style.display = is3d ? 'none' : '';
    }

    function enter3D() {
        canvas.style.display   = 'none';
        canvas3d.style.display = 'block';
        var wrap = canvas.parentElement;
        canvas3d.width  = wrap.clientWidth;
        canvas3d.height = wrap.clientHeight;
        setViewMode(true);
        if (_worldData) {
            Map3D.init(canvas3d, _worldData);
            apply3DTrueMappingMode();
            applyCubeMode();
            sync3DSelectionState();
        }
    }

    function exit3D() {
        canvas3d.style.display = 'none';
        canvas.style.display   = 'block';
        setViewMode(false);
    }

    if (toggle2d) toggle2d.addEventListener('click', function () { if (mode3d)  exit3D(); });
    if (toggle3d) toggle3d.addEventListener('click', function () { if (!mode3d) enter3D(); });

    if (trueMapChk) {
        trueMapChk.addEventListener('change', function () {
            trueMapping3d = trueMapChk.checked;
            if (mode3d) apply3DTrueMappingMode();
        });
    }

    if (cubeModeChk) {
        cubeModeChk.addEventListener('change', function () {
            if (mode3d) applyCubeMode();
        });
    }

    window.addEventListener('resize', function () {
        if (!mode3d || !canvas3d) return;
        var wrap = canvas.parentElement;
        Map3D.resize(wrap.clientWidth, wrap.clientHeight);
    });

    // ---- Grid dropdown helpers ----
    var renderLoopStarted = false;

    function populateGridSelect(data) {
        if (!gridSelect) return;
        var grids = {};
        for (var i = 0; i < data.world.length; i++) {
            var ad = data.areas[data.world[i].n];
            if (!ad) continue;
            for (var j = 0; j < ad.rooms.length; j++) {
                var g = ad.rooms[j].g || 'global';
                grids[g] = true;
            }
        }
        var sorted = Object.keys(grids).sort();
        gridSelect.innerHTML = '';
        for (var k = 0; k < sorted.length; k++) {
            var opt = document.createElement('option');
            opt.value = sorted[k];
            opt.textContent = sorted[k];
            gridSelect.appendChild(opt);
        }
        // Restore selection or default to 'global'
        if (grids[activeGridId]) {
            gridSelect.value = activeGridId;
        } else if (grids['global']) {
            activeGridId = 'global';
            gridSelect.value = 'global';
        } else if (sorted.length > 0) {
            activeGridId = sorted[0];
            gridSelect.value = sorted[0];
        }
    }

    function updateRealmButtons() {
        // Realm buttons show no persistent active highlight.
    }

    function initMapData(data, realm) {
        _worldData  = data;
        activeRealm = realm;
        populateGridSelect(data);
        updateRealmButtons();
        // Reset graph state
        rooms     = {};
        adjacency = {};
        areaMap   = {};
        buildGraph(data);
        loading.style.display = 'none';
        buildLegend();
        resizeCanvas();
        centerView();
        if (!mode3d) {
            if (!renderLoopStarted) {
                renderLoopStarted = true;
                requestAnimationFrame(renderLoop);
            }
        } else {
            Map3D.init(canvas3d, _worldData);
            apply3DTrueMappingMode();
            sync3DSelectionState();
        }
    }

    function fetchAndInitRealm(realm) {
        var url = '/api/world/' + realm;
        loading.style.display = 'flex';
        loading.textContent = 'Fetching ' + realm + ' map...';
        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                try {
                    localStorage.setItem('freign.map.worldData', JSON.stringify(data));
                    localStorage.setItem('freign.map.worldRealm', realm);
                } catch (e) { /* quota exceeded — ignore */ }
                initMapData(data, realm);
            })
            .catch(function (e) {
                loading.style.display = 'none';
                alert('Could not fetch ' + realm + ' map: ' + e.message);
            });
    }

    if (publicMapBtn) {
        publicMapBtn.addEventListener('click', function () { fetchAndInitRealm('public'); });
    }
    if (testMapBtn) {
        testMapBtn.addEventListener('click', function () { fetchAndInitRealm('test'); });
    }

    if (gridSelect) {
        gridSelect.addEventListener('change', function () {
            activeGridId = this.value;
            rooms     = {};
            adjacency = {};
            areaMap   = {};
            buildGraph(_worldData);
            buildLegend();
            centerView();
            if (mode3d && window.Map3D && typeof Map3D.setGridId === 'function') {
                Map3D.setGridId(activeGridId);
            }
        });
    }

    // ---- Initial data load ----
    (function loadInitialData() {
        var cachedJson = null;
        var cachedRealm = null;
        try {
            cachedJson  = localStorage.getItem('freign.map.worldData');
            cachedRealm = localStorage.getItem('freign.map.worldRealm');
        } catch (e) { /* private browsing — ignore */ }

        if (cachedJson) {
            try {
                var data = JSON.parse(cachedJson);
                initMapData(data, cachedRealm);
                return;
            } catch (e) {
                // Corrupt cache — fall through to static file
                try { localStorage.removeItem('freign.map.worldData'); } catch (e2) {}
            }
        }

        fetch('data/world.json')
            .then(function (r) { return r.json(); })
            .then(function (data) { initMapData(data, null); })
            .catch(function (e) {
                loading.textContent = 'Error loading map data: ' + e.message;
            });
    }());

    function buildGraph(data) {
        worldAreas     = data.world;
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
                if ((rj.g || 'global') !== activeGridId) continue;
                var wx = areaPX + rj.x * SPACING + SPACING / 2;
                var wy = areaPY + rj.y * SPACING + SPACING / 2;
                var rz = rj.z || 0;
                var wgz = (rj.gz != null ? rj.gz : rz);

                if (wgz < globalMinLayer) globalMinLayer = wgz;
                if (wgz > globalMaxLayer) globalMaxLayer = wgz;

                var hasGxGy = (rj.gx != null && rj.gy != null);
                var gxW = hasGxGy ? (rj.gx * SPACING + SPACING / 2) : null;
                var gyW = hasGxGy ? (-rj.gy * SPACING + SPACING / 2) : null;

                var room = {
                    vnum:   rj.v,
                    name:   rj.n,
                    area:   wa.n,
                    sector: rj.s,
                    gridX:  rj.x,
                    gridY:  rj.y,
                    gridZ:  rz,
                    worldGz: wgz,
                    gxW:    gxW,
                    gyW:    gyW,
                    worldX: wx,
                    worldY: wy,
                    packedX: wx,
                    packedY: wy,
                    exits:  rj.ex || [],
                };
                rooms[rj.v] = room;
                areaObj.rooms.push(room);
                areaObj.roomKeySet[rj.x + ',' + rj.y] = true;

                adjacency[rj.v] = rj.ex || [];
            }
        }
        computeBfsPositions();
    }

    // ---- BFS layout (expanded 2D mode) ----
    // Positions rooms relative to each other using horizontal exit directions.
    // Disconnected rooms fall back to their packed (area-grid) positions.
    function computeBfsPositions() {
        var BFS_DELTA = [
            { dx: 0,        dy: -SPACING }, // N (0)
            { dx:  SPACING, dy: 0        }, // E (1)
            { dx: 0,        dy:  SPACING }, // S (2)
            { dx: -SPACING, dy: 0        }, // W (3)
        ];
        var pos     = Object.create(null);
        var visited = Object.create(null);
        var queue   = [];

        function seedRoom(vnum, x, y) {
            if (!rooms[vnum] || visited[vnum]) return;
            pos[vnum]     = { x: x, y: y };
            visited[vnum] = true;
            queue.push(vnum);
        }

        function runBfs() {
            while (queue.length) {
                var v = queue.shift();
                var r = rooms[v];
                var p = pos[v];
                for (var i = 0; i < r.exits.length; i++) {
                    var ex = r.exits[i];
                    if (ex.d >= 4 || !rooms[ex.v] || visited[ex.v]) continue;
                    var d = BFS_DELTA[ex.d];
                    seedRoom(ex.v, p.x + d.dx, p.y + d.dy);
                }
            }
        }

        for (var vnum in rooms) {
            var r = rooms[vnum];
            if (visited[vnum]) continue;
            // Try to attach to an already-positioned horizontal neighbor
            var seeded = false;
            for (var i = 0; i < r.exits.length; i++) {
                var ex = r.exits[i];
                if (ex.d >= 4 || !pos[ex.v]) continue;
                var d = BFS_DELTA[ex.d];
                seedRoom(+vnum, pos[ex.v].x - d.dx, pos[ex.v].y - d.dy);
                seeded = true;
                break;
            }
            if (!seeded) {
                seedRoom(+vnum, r.packedX, r.packedY);
            }
            runBfs();
        }

        for (var v in pos) {
            if (rooms[v]) {
                rooms[v].bfsX = pos[v].x;
                rooms[v].bfsY = pos[v].y;
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
        ctx.globalCompositeOperation = 'source-over';

        // Compute visible world bounds
        var tl = screenToWorld(0, 0);
        var br = screenToWorld(canvas.width, canvas.height);
        var margin = SPACING * 5;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = activePalette.canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ---- Gather visible areas ----
        // In expanded mode rooms are BFS-positioned; area bounds don't match,
        // so skip backplates and area labels (culled per-room instead).
        var visibleAreas = [];
        if (layerMode !== 'expanded') {
            for (var an in areaMap) {
                var a = areaMap[an];
                if (!a.rooms.length) continue;
                if (a.px + a.w + margin < tl.x) continue;
                if (a.py + a.h + margin < tl.y) continue;
                if (a.px - margin > br.x) continue;
                if (a.py - margin > br.y) continue;
                visibleAreas.push(a);
            }
        }

        paintBackdropLayers(visibleAreas, s);

        // ---- Draw exit lines ----
        if (s >= 0.18) {
            ctx.lineWidth = Math.max(0.5, s * 0.6);
            for (var vnum in rooms) {
                var r = rooms[vnum];
                if (r.worldX < tl.x - margin || r.worldX > br.x + margin) continue;
                if (r.worldY < tl.y - margin || r.worldY > br.y + margin) continue;

                // In expanded mode only draw exits from the current layer
                if (layerMode === 'expanded' && r.worldGz !== currentLayer) continue;

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
                        if (nb.worldGz !== currentLayer) continue;
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

        // ---- Draw area labels BEHIND rooms (pinned top-left mode only) ----
        if (s >= AREA_LABEL_ZOOM) {
            drawAreaLabels(visibleAreas, s, 'pinned');
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
                layerDiff = Math.abs(r.worldGz - currentLayer);
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
            ctx.fillStyle = isInPath ? '#2a2010' : hexToRgbaColor(sec.fill, 0.90);
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

        // ---- Draw area labels on top of rooms (centered mode only) ----
        if (s >= AREA_LABEL_ZOOM) {
            if (layerMode === 'expanded') {
                drawExpandedAreaLabels(s);
            } else {
                drawAreaLabels(visibleAreas, s, 'centered');
            }
        }
    }

    function drawExpandedAreaLabels(zoomScale) {
        for (var an in areaMap) {
            var a = areaMap[an];
            if (!a.rooms.length) continue;

            // Collect rooms on the current layer and compute centroid
            var sumX = 0, sumY = 0, count = 0;
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (var ri = 0; ri < a.rooms.length; ri++) {
                var rr = a.rooms[ri];
                if (rr.worldGz !== currentLayer) continue;
                sumX += rr.worldX; sumY += rr.worldY;
                if (rr.worldX < minX) minX = rr.worldX;
                if (rr.worldX > maxX) maxX = rr.worldX;
                if (rr.worldY < minY) minY = rr.worldY;
                if (rr.worldY > maxY) maxY = rr.worldY;
                count++;
            }
            if (!count) continue;

            var cx = sumX / count;
            var cy = sumY / count;
            var sp = worldToScreen(cx, cy);

            // Viewport cull
            if (sp.x < -200 || sp.x > canvas.width + 200) continue;
            if (sp.y < -200 || sp.y > canvas.height + 200) continue;

            var boxW = (maxX - minX + SPACING) * zoomScale;
            var boxH = (maxY - minY + SPACING) * zoomScale;
            var areaWeight = Math.sqrt(Math.max(1, count));
            var secStyle = sectorStyle(a.sector);
            var labelColor = secStyle.border;
            var labelText = (a.name || '').toUpperCase();

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

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
                var scaleC = maxBw / desiredBw;
                fontCenter = Math.max(7, fontCenter * scaleC);
                ctx.font = '700 ' + fontCenter.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
                textW = ctx.measureText(labelText).width;
                padX = Math.max(3, fontCenter * 0.25);
            }
            var bw = Math.min(maxBw, textW + padX * 2);
            var bh = fontCenter + padY * 2;
            var bx = sp.x - bw / 2;
            var by = sp.y - bh / 2;
            var rr2 = Math.max(4, bh * 0.28);

            ctx.globalAlpha = Math.max(0.35, Math.min(0.75, 0.3 + zoomScale * 0.9));
            ctx.fillStyle = activePalette.canvasBg;
            roundedRect(ctx, bx, by, bw, bh, rr2);
            ctx.fill();

            ctx.globalAlpha = Math.max(0.55, Math.min(0.95, 0.45 + zoomScale * 0.7));
            ctx.strokeStyle = activePalette.areaLabelStroke;
            ctx.lineWidth = Math.max(1, fontCenter * 0.08);
            roundedRect(ctx, bx, by, bw, bh, rr2);
            ctx.stroke();

            ctx.globalAlpha = Math.max(0.9, Math.min(1.0, 0.86 + zoomScale * 0.2));
            ctx.fillStyle = labelColor;
            ctx.fillText(labelText, bx + bw / 2, by + bh / 2 + 0.5);

            ctx.restore();
        }
    }

    function drawAreaBackplates(areas, zoomScale) {
        ctx.save();
        var isDarkTheme = !isLightTheme(activeTheme);
        for (var i = 0; i < areas.length; i++) {
            var a = areas[i];
            var sec = sectorStyle(a.sector);
            var roomList = a.rooms || [];
            if (!roomList.length) continue;

            // Footprint-tint follows room layout; no global haze and no circular blooms.
            var tile = Math.max(8, CELL * zoomScale * 1.75);
            var halfTile = tile * 0.5;
            var fillAlpha = isDarkTheme ? 0.075 : 0.10;
            var edgeAlpha = isDarkTheme ? 0.12 : 0.16;

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

    function drawAreaLabels(areas, zoomScale, mode) {
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
            var zoomedInMode = zoomScale >= 0.55;

            if (zoomedInMode && mode === 'centered') { continue; }
            if (!zoomedInMode && mode === 'pinned') { continue; }

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (zoomedInMode) {
                // Zoomed in: pin label to top-left of area bounds.
                var fontTop = Math.max(10, Math.min(18, 13 + Math.log(areaWeight + 1) * 1.0));
                ctx.font = '700 ' + fontTop.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';

                var topTextW = ctx.measureText(labelText).width;
                var topPadX = Math.max(4, fontTop * 0.34);
                var topPadY = Math.max(2, fontTop * 0.2);
                var maxTopW = Math.max(18, boxW * 0.9);
                var desiredTopW = topTextW + topPadX * 2;
                if (desiredTopW > maxTopW) {
                    var scaleTop = maxTopW / desiredTopW;
                    fontTop = Math.max(9, fontTop * scaleTop);
                    ctx.font = '700 ' + fontTop.toFixed(1) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
                    topTextW = ctx.measureText(labelText).width;
                    topPadX = Math.max(3, fontTop * 0.30);
                }
                var topW = Math.min(maxTopW, topTextW + topPadX * 2);
                var topH = fontTop + topPadY * 2;
                var topX = sp.x;                       // left edge of area bounds
                var topY = sp.y - topH - 1;            // just above the area bounds
                var topR = Math.max(3, topH * 0.24);

                ctx.textAlign = 'left';
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
                ctx.fillText(labelText, topX + topPadX, topY + topH / 2 + 0.5);
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

                ctx.globalAlpha = Math.max(0.9, Math.min(1.0, 0.86 + zoomScale * 0.2));
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

        var copyBtn = document.getElementById('copy-path-btn');
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
            if (copyBtn) copyBtn.style.display = '';
        } else if (selOrigin && selDest) {
            secP.style.display = '';
            pLen.textContent = '0';
            steps.innerHTML = '<li><span class="step-room" style="color:#a05050">No path found</span></li>';
            if (copyBtn) copyBtn.style.display = 'none';
        } else {
            secP.style.display = 'none';
            steps.innerHTML = '';
            if (copyBtn) copyBtn.style.display = 'none';
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

    // ---- Search / Autocomplete ----
    var searchInput    = document.getElementById('search-input');
    var searchDropdown = document.getElementById('search-dropdown');
    var dropActiveIdx  = -1;

    function buildSearchResults(q) {
        if (!q) return [];
        var ql = q.toLowerCase();
        var results = [];

        // Exact vnum lookup first
        if (/^\d+$/.test(ql) && rooms[+ql]) {
            results.push({ type: 'room', vnum: +ql });
        }

        // Area names
        for (var an in areaMap) {
            if (areaMap[an].name.toLowerCase().indexOf(ql) >= 0 || an.indexOf(ql) >= 0) {
                results.push({ type: 'area', obj: areaMap[an] });
                if (results.length >= 6) break;
            }
        }

        // Room names
        if (results.length < 12) {
            for (var v in rooms) {
                var r = rooms[v];
                if (r.name && r.name.toLowerCase().indexOf(ql) >= 0) {
                    results.push({ type: 'room', vnum: r.vnum });
                    if (results.length >= 12) break;
                }
            }
        }

        return results;
    }

    function renderDropdown(results) {
        if (!searchDropdown) return;
        dropActiveIdx = -1;
        if (!results || results.length === 0) {
            searchDropdown.style.display = 'none';
            searchDropdown.innerHTML = '';
            return;
        }
        var html = '';
        for (var i = 0; i < results.length; i++) {
            var res = results[i];
            if (res.type === 'area') {
                html += '<div class="drop-item" data-area="' + esc(res.obj.shortName) + '">' +
                        '<div class="drop-item-name">' + esc(res.obj.name) + '</div>' +
                        '<div class="drop-item-meta">Area &nbsp;&middot;&nbsp; ' + res.obj.rooms.length + ' rooms</div>' +
                        '</div>';
            } else {
                var rr = rooms[res.vnum];
                html += '<div class="drop-item" data-vnum="' + res.vnum + '">' +
                        '<div class="drop-item-name">' + esc(rr ? rr.name : '?') + '</div>' +
                        '<div class="drop-item-meta">vnum ' + res.vnum + ' &nbsp;&middot;&nbsp; ' + esc(rr ? ((areaMap[rr.area] || {}).name || rr.area) : '') + '</div>' +
                        '</div>';
            }
        }
        searchDropdown.innerHTML = html;
        searchDropdown.style.display = 'block';
    }

    function closeDropdown() {
        if (searchDropdown) searchDropdown.style.display = 'none';
        dropActiveIdx = -1;
    }

    function activateDropItem(idx) {
        var items = searchDropdown ? searchDropdown.querySelectorAll('.drop-item') : [];
        for (var i = 0; i < items.length; i++) items[i].classList.remove('drop-active');
        if (idx >= 0 && idx < items.length) {
            items[idx].classList.add('drop-active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
        dropActiveIdx = idx;
    }

    function pickDropItem() {
        var items = searchDropdown ? searchDropdown.querySelectorAll('.drop-item') : [];
        var item = items[dropActiveIdx >= 0 ? dropActiveIdx : 0];
        if (!item) return;
        searchInput.value = '';
        closeDropdown();
        if (item.dataset.vnum) jumpToRoom(+item.dataset.vnum);
        else if (item.dataset.area) jumpToArea(item.dataset.area);
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            renderDropdown(buildSearchResults(searchInput.value.trim()));
        });
        searchInput.addEventListener('keydown', function (e) {
            var items = searchDropdown ? searchDropdown.querySelectorAll('.drop-item') : [];
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activateDropItem(Math.min(dropActiveIdx + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activateDropItem(Math.max(dropActiveIdx - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                pickDropItem();
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });
        searchInput.addEventListener('blur', function () {
            setTimeout(closeDropdown, 150);
        });
    }

    if (searchDropdown) {
        searchDropdown.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.drop-item');
            if (!item) return;
            e.preventDefault();
            searchInput.value = '';
            closeDropdown();
            if (item.dataset.vnum) jumpToRoom(+item.dataset.vnum);
            else if (item.dataset.area) jumpToArea(item.dataset.area);
        });
    }

    // ---- Copy stacked command ----
    var copyPathBtn = document.getElementById('copy-path-btn');
    if (copyPathBtn) {
        copyPathBtn.addEventListener('click', function () {
            var DIR_CMD = ['n', 'e', 's', 'w', 'u', 'd'];
            var cmd = pathDirs.map(function (d) {
                return (d >= 0 && d < DIR_CMD.length) ? DIR_CMD[d] : '?';
            }).join(';');
            if (!cmd) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(cmd).then(function () {
                    copyPathBtn.textContent = 'Copied!';
                    setTimeout(function () { copyPathBtn.textContent = 'Copy stacked command'; }, 1500);
                });
            }
        });
    }

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

    if (layerModeChk) {
        layerModeChk.addEventListener('change', function () {
            if (layerModeChk.checked) {
                layerMode = 'expanded';
                currentLayer = 0;
                for (var v in rooms) {
                    var r = rooms[v];
                    r.worldX = (r.gxW != null) ? r.gxW : r.bfsX;
                    r.worldY = (r.gyW != null) ? r.gyW : r.bfsY;
                }
            } else {
                layerMode = 'collapsed';
                for (var v in rooms) {
                    rooms[v].worldX = rooms[v].packedX;
                    rooms[v].worldY = rooms[v].packedY;
                }
            }
            centerView();
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
        var resolved = resolveSiteTheme(name);
        var mapped = mapPresetForTheme(resolved);
        activeTheme = resolved;
        if (themeApi && typeof themeApi.applyTheme === 'function') {
            themeApi.applyTheme(resolved, { persist: false, select: themeSelect || undefined });
        } else {
            document.body.setAttribute('data-theme', resolved);
        }
        activePalette = buildThemePalette(resolved, mapped);
    }

    function readStoredTheme() {
        try {
            var v = themeApi ? themeApi.getThemeId() : (localStorage.getItem('freign.site.theme.v1') || localStorage.getItem('freignMapTheme'));
            if (v === 'dusk') return 'cobalt';
            return resolveSiteTheme(v);
        } catch (_) {
            return 'amethyst';
        }
    }

    function resolveSiteTheme(name) {
        if (themeApi && typeof themeApi.resolveThemeId === 'function') {
            return themeApi.resolveThemeId(name);
        }
        var raw = String(name || '').toLowerCase();
        if (raw === 'dark') return 'onyx';
        if (raw === 'parchment') return 'pearl';
        return raw || 'amethyst';
    }

    function mapPresetForTheme(themeName) {
        var map = {
            amethyst: 'amethyst',
            emerald: 'amethyst',
            jade: 'amethyst',
            cobalt: 'cobalt',
            sapphire: 'cobalt',
            topaz: 'cobalt',
            onyx: 'dark',
            obsidian: 'dark',
            ruby: 'dark',
            garnet: 'dark',
            pearl: 'parchment',
            opal: 'parchment',
            quartz: 'parchment'
        };
        return map[themeName] || 'amethyst';
    }

    function buildThemePalette(themeName, presetName) {
        var base = THEME_PRESETS[presetName] || THEME_PRESETS.amethyst;
        var palette = clonePalette(base);
        var theme = themeApi && typeof themeApi.getTheme === 'function' ? themeApi.getTheme(themeName) : null;
        var vars = theme && theme.vars ? theme.vars : null;
        var styles = getComputedStyle(document.body);
        var bg = getThemeVar(vars, 'bg', getCssVar(styles, '--bg', base.canvasBg));
        var panel = getThemeVar(vars, 'panel', getCssVar(styles, '--panel', bg));
        var terminalBg = getThemeVar(vars, 'terminal-bg', getCssVar(styles, '--terminal-bg', bg));
        var title = getThemeVar(vars, 'title', getCssVar(styles, '--title', base.areaLabel));
        var text = getThemeVar(vars, 'text', getCssVar(styles, '--text', base.roomLabel));
        var accent = getThemeVar(vars, 'accent', getCssVar(styles, '--accent', base.hoverBorder));
        var lightTheme = isLightTheme(themeName);

        palette.canvasBg = lightTheme
            ? blendHex(terminalBg, '#ffffff', 0.18)
            : blendHex(terminalBg, panel, 0.35);
        document.body.style.setProperty('--map-canvas-bg', palette.canvasBg);
        palette.link = hexToRgbaColor(blendHex(accent, text, 0.35), lightTheme ? 0.34 : 0.52);
        palette.pathLink = hexToRgbaColor(blendHex(accent, '#ffffff', 0.45), 0.92);
        palette.roomLabel = text;
        palette.pathLabel = blendHex(title, '#ffffff', lightTheme ? 0.12 : 0.24);
        palette.areaLabel = title;
        palette.areaLabelStroke = hexToRgbaColor(blendHex(panel, '#000000', lightTheme ? 0.18 : 0.42), lightTheme ? 0.42 : 0.56);
        palette.hoverBorder = blendHex(accent, '#ffffff', 0.18);
        palette.originBorder = blendHex(title, '#ffffff', 0.24);
        palette.destBorder = blendHex(accent, '#9ed8ff', 0.48);
        palette.pathBorder = blendHex(accent, title, 0.4);
        return palette;
    }

    function clonePalette(base) {
        var out = {};
        for (var key in base) {
            if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
            if (key === 'sectors') {
                out.sectors = {};
                for (var sKey in base.sectors) {
                    if (!Object.prototype.hasOwnProperty.call(base.sectors, sKey)) continue;
                    out.sectors[sKey] = {
                        name: base.sectors[sKey].name,
                        fill: base.sectors[sKey].fill,
                        border: base.sectors[sKey].border,
                    };
                }
            } else {
                out[key] = base[key];
            }
        }
        return out;
    }

    function getCssVar(styles, name, fallback) {
        var value = styles.getPropertyValue(name);
        value = value ? value.trim() : '';
        return value || fallback;
    }

    function getThemeVar(vars, key, fallback) {
        if (!vars || !Object.prototype.hasOwnProperty.call(vars, key)) {
            return fallback;
        }
        return vars[key] || fallback;
    }

    function isLightTheme(themeName) {
        if (themeApi && typeof themeApi.isLight === 'function') {
            return !!themeApi.isLight(themeName);
        }
        var attr = document.body.getAttribute('data-theme-tone');
        if (attr) {
            return attr === 'light';
        }
        return themeName === 'pearl' || themeName === 'opal' || themeName === 'quartz' || themeName === 'parchment';
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
