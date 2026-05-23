/**
 * map3d.js — 3D wireframe renderer for FREIGN world map
 *
 * Controls:
 *   Left-drag    → strafe/up pan from current view
 *   Right-drag   → look around
 *   Scroll       → zoom (FOV)
 *
 * Public API:  window.Map3D.init(canvasEl, worldData)
 *              window.Map3D.resize(w, h)
 */
(function () {
    'use strict';

    // ---- State ----
    var canvas, ctx;
    var tooltipEl = null;
    var rooms3d   = [];   // {vnum, x, y, z, sector, exits:[{v}]}
    var edges3d   = [];   // {ax,ay,az, bx,by,bz, color}
    var roomIndex = {};   // vnum -> rooms3d entry
    var areaLabels = [];  // {name, sector, x, y, z, minX, maxX, minY, maxY, minZ, maxZ}
    var areaIndex = {};   // shortName -> {x, y, z, minX, maxX, minY, maxY, minZ, maxZ}
    var sourceData = null;
    var trueMappingEnabled = false;
    var cubeModeEnabled    = false;
    var activeGridId = 'global';

    var SPACING = 14;     // world units per grid cell (matches world.json scale)

    // Camera
    var cam = {
        x: 0, y: 0, z: 0,
        az: Math.PI / 6,      // yaw around vertical axis
        el: 0,                // pitch
        fov: 55,              // degrees
    };

    // Cached per-frame camera basis
    var eyeX, eyeY, eyeZ;
    var fwdX, fwdY, fwdZ;
    var rgtX, rgtY, rgtZ;
    var upX,  upY,  upZ;
    var tanHalfFov;
    var vpW, vpH;

    // Mouse
    var drag = { active: false, btn: -1, lx: 0, ly: 0 };
    var keysDown = Object.create(null);
    var flightAccel = 1.0;   // hold-to-accelerate multiplier
    var animFrame = 0;
    var initialized = false;
    var hoveredVnum = null;
    var selectedOrigin = null;
    var selectedDest = null;
    var selectedPathSet = Object.create(null);

    function hexToRgba(hex, a) {
        var r = parseInt(hex.slice(1,3),16);
        var g = parseInt(hex.slice(3,5),16);
        var b = parseInt(hex.slice(5,7),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
    }

    function brightenHex(hex, amount) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        r = Math.round(r + (255 - r) * amount);
        g = Math.round(g + (255 - g) * amount);
        b = Math.round(b + (255 - b) * amount);
        return '#'
            + r.toString(16).padStart(2, '0')
            + g.toString(16).padStart(2, '0')
            + b.toString(16).padStart(2, '0');
    }

    function darkenHex(hex, factor) {
        var r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
        var g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
        var b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
        return '#'
            + r.toString(16).padStart(2, '0')
            + g.toString(16).padStart(2, '0')
            + b.toString(16).padStart(2, '0');
    }

    function hexToHsl(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255;
        var g = parseInt(hex.slice(3, 5), 16) / 255;
        var b = parseInt(hex.slice(5, 7), 16) / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h, s;
        var l = (max + min) / 2;
        if (max === min) {
            h = 0;
            s = 0;
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                default:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return { h: h, s: s, l: l };
    }

    function hslToHex(h, s, l) {
        function hueToRgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hueToRgb(p, q, h + 1 / 3);
            g = hueToRgb(p, q, h);
            b = hueToRgb(p, q, h - 1 / 3);
        }
        return '#'
            + Math.round(r * 255).toString(16).padStart(2, '0')
            + Math.round(g * 255).toString(16).padStart(2, '0')
            + Math.round(b * 255).toString(16).padStart(2, '0');
    }

    function liftSectorHex(hex, minLightness, saturationBoost) {
        var hsl = hexToHsl(hex);
        var lightness = Math.max(hsl.l, minLightness);
        var saturation = Math.min(1, hsl.s * saturationBoost + 0.08);
        return hslToHex(hsl.h, saturation, lightness);
    }

    function themeName() {
        return document.body.getAttribute('data-theme') || 'cobalt';
    }

    // Shared sector color table — matches map.js ANSI_COLOR_HEX + sectorAnsiCode
    var SECTOR_COLOR = {
        0:  '#b8b8b8', // inside     (gray)
        1:  '#b07898', // city       (mauve-pink)
        2:  '#a38a2a', // field      (yellow)
        3:  '#2f7a2f', // forest     (green)
        4:  '#8c5a1e', // hills      (orange-brown)
        5:  '#6b3f1e', // mountain   (brown)
        6:  '#4f92ff', // water_swim (bright blue)
        7:  '#3157b0', // water_deep (dark blue)
        8:  '#58c35d', // swamp      (bright green)
        9:  '#4db7c8', // air        (cyan)
        10: '#f0cf63', // desert     (bright yellow)
        11: '#cf4a4a', // lava       (red)
        12: '#f2f2f2', // snow       (white)
    };

    function sectorStyle(sector) {
        var themeUi = {
            dark: {
                link: '#586072',
                areaLabel: '#f0dfab',
                areaLabelStroke: 'rgba(8,8,12,0.45)',
                canvasBg: '#0a0a0e',
                areaLabelBg: 'rgba(10,14,20,0.44)',
            },
            parchment: {
                link: '#8a7756',
                areaLabel: '#8a5a1f',
                areaLabelStroke: 'rgba(255,245,226,0.55)',
                canvasBg: '#efe5cd',
                areaLabelBg: 'rgba(255,248,232,0.84)',
            },
            cobalt: {
                link: '#637898',
                areaLabel: '#d8ebff',
                areaLabelStroke: 'rgba(10,16,28,0.54)',
                canvasBg: '#111722',
                areaLabelBg: 'rgba(10,16,28,0.44)',
            },
        };
        var ui = themeUi[themeName()] || themeUi.cobalt;
        var fill = SECTOR_COLOR.hasOwnProperty(sector) ? SECTOR_COLOR[sector] : SECTOR_COLOR[0];
        return {
            fill: fill,
            border: brightenHex(fill, 0.22),
            link: ui.link,
            areaLabel: ui.areaLabel,
            areaLabelStroke: ui.areaLabelStroke,
            canvasBg: ui.canvasBg,
            areaLabelBg: ui.areaLabelBg,
        };
    }

    function isActive() {
        return !!canvas && canvas.style.display !== 'none';
    }

    function clearKeys() {
        keysDown.w = false;
        keysDown.a = false;
        keysDown.s = false;
        keysDown.d = false;
        keysDown.space = false;
        keysDown.shift = false;
        keysDown.arrowleft = false;
        keysDown.arrowright = false;
        keysDown.arrowup = false;
        keysDown.arrowdown = false;
    }

    function isTextEntryFocused() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = (el.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
    }

    function controlsEnabled() {
        return isActive() && !isTextEntryFocused();
    }

    function directionDelta(d) {
        if (d === 0) return { dx: 0, dz: -SPACING }; // north
        if (d === 1) return { dx: SPACING, dz: 0 };  // east
        if (d === 2) return { dx: 0, dz: SPACING };  // south
        if (d === 3) return { dx: -SPACING, dz: 0 }; // west
        return { dx: 0, dz: 0 }; // up/down do not change planar position
    }

    function findAsiynAnchor(data) {
        for (var i = 0; i < data.world.length; i++) {
            var wa = data.world[i];
            var ad = data.areas[wa.n];
            if (!ad || !ad.rooms || !ad.rooms.length) continue;
            var shortHit = (wa.n || '').toLowerCase().indexOf('asiyn') !== -1;
            var nameHit = (ad.name || '').toLowerCase().indexOf('asiyn') !== -1;
            if (shortHit || nameHit) return ad.rooms[0].v;
        }
        return null;
    }

    function computeTrueMappingPositions(data) {
        var byVnum = Object.create(null);
        var areaShortByVnum = Object.create(null);

        for (var i = 0; i < data.world.length; i++) {
            var wa = data.world[i];
            var ad = data.areas[wa.n];
            if (!ad) continue;
            var areaPX = wa.wx * SPACING;
            var areaPZ = wa.wy * SPACING;
            for (var j = 0; j < ad.rooms.length; j++) {
                var rj = ad.rooms[j];
                // gx/gy/gz = mapcheck world-absolute coords (only on rooms
                // reached by BFS from the focal room). x/y/z = area-local.
                var hasCoords = (rj.gx != null);
                byVnum[rj.v] = {
                    vnum: rj.v,
                    // World-absolute position from mapcheck BFS.
                    // gy is North=+Y in SpatialBfsRunner; map uses North=-Z, so negate.
                    x0: (rj.gx || 0) * SPACING,
                    z0: -(rj.gy || 0) * SPACING,
                    // Area-grid fallback for disconnected rooms: keeps them
                    // spread out rather than piling at origin.
                    fallX: areaPX + rj.x * SPACING,
                    fallZ: areaPZ + rj.y * SPACING,
                    y: (rj.gz != null ? rj.gz : (rj.z || 0)) * SPACING,
                    exits: rj.ex || [],
                    hasCoords: hasCoords,
                };
                areaShortByVnum[rj.v] = wa.n;
            }
        }

        var pos = Object.create(null);
        var visited = Object.create(null);
        var queue = [];

        function enqueueSeed(seedVnum, sx, sz) {
            if (!byVnum[seedVnum] || visited[seedVnum]) return;
            pos[seedVnum] = { x: sx, z: sz };
            visited[seedVnum] = true;
            queue.push(seedVnum);
        }

        // Phase 1: honour explicit xyz from world.json — place these rooms
        // directly and mark them visited so BFS cannot override them.
        for (var pv in byVnum) {
            var pr = byVnum[pv];
            if (pr.hasCoords) {
                pos[pr.vnum]     = { x: pr.x0, z: pr.z0 };
                visited[pr.vnum] = true;
            }
        }

        function runBfs() {
            while (queue.length) {
                var curV = queue.shift();
                var curRoom = byVnum[curV];
                if (!curRoom) continue;
                var curPos = pos[curV];
                for (var ei = 0; ei < curRoom.exits.length; ei++) {
                    var ex = curRoom.exits[ei];
                    if (!byVnum[ex.v]) continue;
                    if (visited[ex.v]) continue;
                    var d = directionDelta(ex.d);
                    enqueueSeed(ex.v, curPos.x + d.dx, curPos.z + d.dz);
                }
            }
        }

        // Phase 2: disconnected rooms (no mapcheck xyz).
        // Try to place each one next to an already-positioned exit neighbor.
        // If truly isolated, seed at the area-grid position so disconnected
        // areas spread out in a row rather than piling up at origin.
        for (var v in byVnum) {
            var seed = +v;
            if (visited[seed]) continue;
            var seedRoom = byVnum[seed];

            var seeded = false;
            for (var ei = 0; ei < seedRoom.exits.length; ei++) {
                var ex = seedRoom.exits[ei];
                if (!pos[ex.v]) continue;
                var d = directionDelta(ex.d);
                enqueueSeed(seed, pos[ex.v].x - d.dx, pos[ex.v].z - d.dz);
                seeded = true;
                break;
            }
            if (!seeded) {
                enqueueSeed(seed, seedRoom.fallX, seedRoom.fallZ);
            }
            runBfs();
        }

        return {
            pos: pos,
            byVnum: byVnum,
            areaShortByVnum: areaShortByVnum,
        };
    }

    // ---- Build geometry ----
    function build(data) {
        rooms3d    = [];
        edges3d    = [];
        roomIndex  = {};
        areaLabels = [];
        areaIndex  = {};

        var trueMap = trueMappingEnabled ? computeTrueMappingPositions(data) : null;

        for (var i = 0; i < data.world.length; i++) {
            var wa = data.world[i];
            var ad = data.areas[wa.n];
            if (!ad) continue;

            var areaPX = wa.wx * SPACING;
            var areaPZ = wa.wy * SPACING;   // 2D Y → 3D Z

            var areaMinX = Infinity, areaMaxX = -Infinity;
            var areaMinY = Infinity, areaMaxY = -Infinity;
            var areaMinZ = Infinity, areaMaxZ = -Infinity;

            for (var j = 0; j < ad.rooms.length; j++) {
                var rj = ad.rooms[j];
                if ((rj.g || 'global') !== activeGridId) continue;
                var tx = areaPX + rj.x * SPACING;
                var tz = areaPZ + rj.y * SPACING;
                if (trueMap && trueMap.pos[rj.v]) {
                    tx = trueMap.pos[rj.v].x;
                    tz = trueMap.pos[rj.v].z;
                }
                var rm = {
                    vnum:  rj.v,
                    name:  rj.n,
                    areaShort: wa.n,
                    areaName: ad.name || wa.n,
                    x:     tx,
                    y:     (trueMap ? (trueMap.byVnum[rj.v] ? trueMap.byVnum[rj.v].y : (rj.gz != null ? rj.gz : (rj.z || 0)) * SPACING) : (rj.z || 0) * SPACING),
                    z:     tz,
                    sector: rj.s,
                    exits: rj.ex || [],
                };
                rooms3d.push(rm);
                roomIndex[rj.v] = rm;
                if (rm.x < areaMinX) areaMinX = rm.x;
                if (rm.x > areaMaxX) areaMaxX = rm.x;
                if (rm.y < areaMinY) areaMinY = rm.y;
                if (rm.y > areaMaxY) areaMaxY = rm.y;
                if (rm.z < areaMinZ) areaMinZ = rm.z;
                if (rm.z > areaMaxZ) areaMaxZ = rm.z;
            }

            if (ad.rooms.length) {
                areaIndex[wa.n] = {
                    x: (areaMinX + areaMaxX) * 0.5,
                    y: (areaMinY + areaMaxY) * 0.5,
                    z: (areaMinZ + areaMaxZ) * 0.5,
                    minX: areaMinX,
                    maxX: areaMaxX,
                    minY: areaMinY,
                    maxY: areaMaxY,
                    minZ: areaMinZ,
                    maxZ: areaMaxZ,
                };
                areaLabels.push({
                    name: ad.name || wa.n,
                    sector: wa.s,
                    x: (areaMinX + areaMaxX) * 0.5,
                    y: areaMaxY + SPACING * 3,
                    z: (areaMinZ + areaMaxZ) * 0.5,
                    minX: areaMinX,
                    maxX: areaMaxX,
                    minY: areaMinY,
                    maxY: areaMaxY,
                    minZ: areaMinZ,
                    maxZ: areaMaxZ,
                });
            }
        }

        // Edges — one per unique pair
        var seen = {};
        for (var k = 0; k < rooms3d.length; k++) {
            var r = rooms3d[k];
            for (var e = 0; e < r.exits.length; e++) {
                var nb = roomIndex[r.exits[e].v];
                if (!nb) continue;
                var key = r.vnum < nb.vnum
                    ? r.vnum + '_' + nb.vnum
                    : nb.vnum + '_' + r.vnum;
                if (seen[key]) continue;
                seen[key] = true;
                edges3d.push({
                    av: r.vnum,
                    bv: nb.vnum,
                    ax: r.x,  ay: r.y,  az: r.z,
                    bx: nb.x, by: nb.y, bz: nb.z,
                    color: '#000000',
                });
            }
        }

        // Center camera on world centroid
        var sx = 0, sy = 0, sz = 0;
        for (var m = 0; m < rooms3d.length; m++) {
            sx += rooms3d[m].x;
            sy += rooms3d[m].y;
            sz += rooms3d[m].z;
        }
        var cx = sx / rooms3d.length;
        var cy = sy / rooms3d.length;
        var cz = sz / rooms3d.length;
        var startAz = Math.PI / 5;
        var startEl = -Math.PI / 7;
        var fwdX0 = Math.cos(startEl) * Math.sin(startAz);
        var fwdY0 = Math.sin(startEl);
        var fwdZ0 = -Math.cos(startEl) * Math.cos(startAz);
        var rgtX0 = -fwdZ0, rgtY0 = 0, rgtZ0 = fwdX0;
        var rl0 = Math.sqrt(rgtX0 * rgtX0 + rgtZ0 * rgtZ0) || 1;
        rgtX0 /= rl0;
        rgtZ0 /= rl0;
        var upX0 = rgtY0 * fwdZ0 - rgtZ0 * fwdY0;
        var upY0 = rgtZ0 * fwdX0 - rgtX0 * fwdZ0;
        var upZ0 = rgtX0 * fwdY0 - rgtY0 * fwdX0;

        var vw = (canvas && canvas.width) ? canvas.width : 1600;
        var vh = (canvas && canvas.height) ? canvas.height : 900;
        var aspect = Math.max(0.5, vw / Math.max(1, vh));
        var tan = Math.tan((55 * Math.PI / 180) / 2);
        var fitD = 1;
        for (var fi = 0; fi < rooms3d.length; fi++) {
            var rr = rooms3d[fi];
            var qx = rr.x - cx;
            var qy = rr.y - cy;
            var qz = rr.z - cz;
            var qRight = qx * rgtX0 + qy * rgtY0 + qz * rgtZ0;
            var qUp = qx * upX0 + qy * upY0 + qz * upZ0;
            var qFwd = qx * fwdX0 + qy * fwdY0 + qz * fwdZ0;
            var needX = Math.abs(qRight) / (tan * aspect) - qFwd;
            var needY = Math.abs(qUp) / tan - qFwd;
            var needZ = -qFwd + 1;
            if (needX > fitD) fitD = needX;
            if (needY > fitD) fitD = needY;
            if (needZ > fitD) fitD = needZ;
        }
        fitD *= 1.10;

        cam.az = startAz;
        cam.el = startEl;
        cam.x = cx - fwdX0 * fitD;
        cam.y = cy - fwdY0 * fitD;
        cam.z = cz - fwdZ0 * fitD;
        cam.fov = 55;
    }

    // ---- Camera basis (call once per frame) ----
    function computeBasis(w, h) {
        vpW = w; vpH = h;
        var az = cam.az, el = cam.el;

        eyeX = cam.x;
        eyeY = cam.y;
        eyeZ = cam.z;

        fwdX = Math.cos(el) * Math.sin(az);
        fwdY = Math.sin(el);
        fwdZ = -Math.cos(el) * Math.cos(az);

        // right = cross(forward, world_up=(0,1,0))
        // = (fwdY*0 - fwdZ*1,  fwdZ*0 - fwdX*0,  fwdX*1 - fwdY*0)
        // = (-fwdZ, 0, fwdX)
        rgtX = -fwdZ; rgtY = 0; rgtZ = fwdX;
        var rl = Math.sqrt(rgtX*rgtX + rgtZ*rgtZ);
        if (rl > 0.0001) {
            rgtX /= rl; rgtZ /= rl;
        } else {
            rgtX = 1; rgtY = 0; rgtZ = 0;
        }

        // up = cross(right, forward)
        upX = rgtY*fwdZ - rgtZ*fwdY;
        upY = rgtZ*fwdX - rgtX*fwdZ;
        upZ = rgtX*fwdY - rgtY*fwdX;

        var fovRad = cam.fov * Math.PI / 180;
        tanHalfFov = Math.tan(fovRad / 2);
    }

    // Project world point → screen {x,y,depth} or null if behind camera
    function proj(px, py, pz) {
        var dx = px - eyeX;
        var dy = py - eyeY;
        var dz = pz - eyeZ;
        // Camera-space coordinates
        var cx = dx*rgtX + dy*rgtY + dz*rgtZ;
        var cy = dx*upX  + dy*upY  + dz*upZ;
        var cz = dx*fwdX + dy*fwdY + dz*fwdZ;
        if (cz <= 0.1) return null;
        var aspect = vpW / vpH;
        var hw = vpW / 2, hh = vpH / 2;
        return {
            x: hw + (cx / (cz * tanHalfFov * aspect)) * hw,
            y: hh - (cy / (cz * tanHalfFov))          * hh,
            depth: cz,
        };
    }

    // ---- 3D Cube room drawing ----
    // Draws a perspective-correct 3-faced cube for a single room.
    // Faces are shaded: top = brightest, one side = medium, other side = dark.
    // highlightStroke/Width apply an outline to the top (or bottom) face.
    function drawRoomCube3d(rx, ry, rz, hs, fill, border, roomAlpha, highlightStroke, highlightWidth) {
        var showTop   = eyeY >= ry;
        var showEast  = eyeX >= rx;
        var showSouth = eyeZ >= rz;

        // Project all 8 corners. Bit pattern: bit2=x, bit1=y, bit0=z (0=min, 1=max).
        var p000 = proj(rx-hs, ry-hs, rz-hs);
        var p001 = proj(rx-hs, ry-hs, rz+hs);
        var p010 = proj(rx-hs, ry+hs, rz-hs);
        var p011 = proj(rx-hs, ry+hs, rz+hs);
        var p100 = proj(rx+hs, ry-hs, rz-hs);
        var p101 = proj(rx+hs, ry-hs, rz+hs);
        var p110 = proj(rx+hs, ry+hs, rz-hs);
        var p111 = proj(rx+hs, ry+hs, rz+hs);
        if (!p000 || !p001 || !p010 || !p011 || !p100 || !p101 || !p110 || !p111) return;

        ctx.globalAlpha = roomAlpha;

        function fillFace(a, b, c, d, shade) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.closePath();
            ctx.fillStyle   = darkenHex(fill, shade);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(border, 0.55);
            ctx.lineWidth   = 0.7;
            ctx.stroke();
        }

        // Side faces drawn first (back-to-front doesn't matter between perpendicular
        // faces sharing an edge), then the horizontal face last so it sits on top.
        var xFace  = showEast  ? [p100, p110, p111, p101] : [p000, p010, p011, p001];
        var zFace  = showSouth ? [p001, p101, p111, p011] : [p000, p100, p110, p010];
        var yFace  = showTop   ? [p010, p110, p111, p011] : [p000, p100, p101, p001];

        fillFace(zFace[0], zFace[1], zFace[2], zFace[3], 0.60); // darkest side
        fillFace(xFace[0], xFace[1], xFace[2], xFace[3], 0.78); // medium side
        fillFace(yFace[0], yFace[1], yFace[2], yFace[3], 1.00); // brightest face (top/bottom)

        // Highlight outline on the horizontal face
        if (highlightStroke) {
            ctx.beginPath();
            ctx.moveTo(yFace[0].x, yFace[0].y);
            ctx.lineTo(yFace[1].x, yFace[1].y);
            ctx.lineTo(yFace[2].x, yFace[2].y);
            ctx.lineTo(yFace[3].x, yFace[3].y);
            ctx.closePath();
            ctx.strokeStyle = highlightStroke;
            ctx.lineWidth   = highlightWidth;
            ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
    }

    // ---- Render ----
    function render() {
        if (!canvas) return;
        var W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Background gradient
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0a0d14');
        bg.addColorStop(1, '#0d1320');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        computeBasis(W, H);

        // Pre-project all rooms (reuse for edge endpoints)
        var projected = {};
        for (var i = 0; i < rooms3d.length; i++) {
            var r = rooms3d[i];
            var p = proj(r.x, r.y, r.z);
            if (p) projected[r.vnum] = p;
        }

        // -- Draw edges --
        // Compute adaptive depth fog range from the rooms that are actually visible.
        var depthValues = [];
        for (var fv in projected) depthValues.push(projected[fv].depth);
        depthValues.sort(function (a, b) { return a - b; });
        var fogNear = depthValues[Math.floor(depthValues.length * 0.03)] || 1;
        var fogFar  = depthValues[Math.floor(depthValues.length * 0.88)] || fogNear * 8;
        var fogRange = Math.max(1, fogFar - fogNear);
        function depthAlpha(depth, bright, dim) {
            var t = Math.max(0, Math.min(1, (depth - fogNear) / fogRange));
            // ease-in so the near zone stays fully bright longer
            t = t * t;
            return bright - t * (bright - dim);
        }

        // Group edges by color for fewer strokeStyle changes
        var edgesByColor = {};
        var pathEdges = [];
        for (var i = 0; i < edges3d.length; i++) {
            var e = edges3d[i];
            var pA = proj(e.ax, e.ay, e.az);
            var pB = proj(e.bx, e.by, e.bz);
            if (!pA || !pB) continue;
            var minX = Math.min(pA.x, pB.x), maxX = Math.max(pA.x, pB.x);
            var minY = Math.min(pA.y, pB.y), maxY = Math.max(pA.y, pB.y);
            if (maxX < -W || minX > 2*W || maxY < -H || minY > 2*H) continue;

            var inPathEdge = !!selectedPathSet[e.av] && !!selectedPathSet[e.bv];
            if (inPathEdge) {
                pathEdges.push(pA.x, pA.y, pB.x, pB.y);
                continue;
            }

            // Sector-color the edge by source room; fall back to link color
            var srcRoom = roomIndex[e.av];
            var edgeBase = srcRoom ? SECTOR_COLOR[srcRoom.sector] || SECTOR_COLOR[0] : sectorStyle(0).link;
            var edgeDepth = (pA.depth + pB.depth) * 0.5;
            var edgeAlpha = depthAlpha(edgeDepth, 0.52, 0.06);
            var col = hexToRgba(edgeBase, edgeAlpha);
            if (!edgesByColor[col]) edgesByColor[col] = [];
            edgesByColor[col].push(pA.x, pA.y, pB.x, pB.y);
        }
        for (var col in edgesByColor) {
            var arr = edgesByColor[col];
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (var k = 0; k < arr.length; k += 4) {
                ctx.moveTo(arr[k],   arr[k+1]);
                ctx.lineTo(arr[k+2], arr[k+3]);
            }
            ctx.stroke();
        }
        if (pathEdges.length) {
            ctx.strokeStyle = 'rgba(230,210,120,0.92)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (var pk = 0; pk < pathEdges.length; pk += 4) {
                ctx.moveTo(pathEdges[pk], pathEdges[pk + 1]);
                ctx.lineTo(pathEdges[pk + 2], pathEdges[pk + 3]);
            }
            ctx.stroke();
        }

        // -- Draw rooms sorted back-to-front --
        var visRooms = [];
        for (var vnum in projected) {
            visRooms.push({ p: projected[vnum], r: roomIndex[vnum] });
        }
        visRooms.sort(function (a, b) { return b.p.depth - a.p.depth; });

        // Room drawing: cubes for nearby rooms (when cube mode on), squares otherwise.
        var CUBE_HS = SPACING * 0.42; // world-unit half-size; gives a small gap between adjacent rooms
        for (var i = 0; i < visRooms.length; i++) {
            var item = visRooms[i];
            var p = item.p, r = item.r;
            if (p.x < -20 || p.x > W+20 || p.y < -20 || p.y > H+20) continue;

            var sz = Math.max(2, Math.min(12, 4000 / p.depth));
            var roomAlpha = depthAlpha(p.depth, 1.0, 0.12);
            var roomStyle = sectorStyle(r.sector);
            var isOrigin = r.vnum === selectedOrigin;
            var isDest   = r.vnum === selectedDest;
            var isPath   = !!selectedPathSet[r.vnum];
            var isHover  = r.vnum === hoveredVnum;

            // Highlight color for special states
            var hlStroke = null, hlWidth = 1.5;
            if (isOrigin)     { hlStroke = 'rgba(232,212,120,0.98)'; hlWidth = sz > 4 ? 2.0 : 1.5; }
            else if (isDest)  { hlStroke = 'rgba(140,195,255,0.98)'; hlWidth = sz > 4 ? 2.0 : 1.5; }
            else if (isPath)  { hlStroke = 'rgba(205,175,95,0.96)';  hlWidth = sz > 3 ? 1.6 : 1.0; }
            else if (isHover) { hlStroke = 'rgba(230,240,255,0.95)'; hlWidth = sz > 3 ? 1.5 : 1.0; }

            // Cube mode: project full 3-faced box for nearby rooms; fall back to square for tiny/distant ones
            if (cubeModeEnabled && sz >= 3) {
                drawRoomCube3d(r.x, r.y, r.z, CUBE_HS, roomStyle.fill, roomStyle.border, roomAlpha, hlStroke, hlWidth);
            } else {
                // Original flat square
                ctx.globalAlpha = roomAlpha;
                ctx.fillStyle   = roomStyle.fill;
                ctx.fillRect(p.x - sz, p.y - sz, sz*2, sz*2);
                ctx.strokeStyle = hlStroke ? hlStroke : hexToRgba(roomStyle.border, 0.88);
                ctx.lineWidth   = hlStroke ? hlWidth : (sz > 4 ? 1.0 : 0.6);
                ctx.strokeRect(p.x - sz, p.y - sz, sz*2, sz*2);
                // Corner highlight for a flat 3D feel
                if (sz >= 3) {
                    ctx.fillStyle = 'rgba(255,255,255,0.22)';
                    ctx.fillRect(p.x - sz, p.y - sz, sz, sz);
                }
                ctx.globalAlpha = 1.0;
            }
        }

        // -- Draw floating area labels --
        ctx.textAlign = 'center';
        for (var ai = 0; ai < areaLabels.length; ai++) {
            var label = areaLabels[ai];
            var lp = proj(label.x, label.y, label.z);
            if (!lp) continue;
            if (lp.x < -80 || lp.x > W + 80 || lp.y < -20 || lp.y > H + 20) continue;

            var corners = [
                [label.minX, label.minY, label.minZ], [label.minX, label.minY, label.maxZ],
                [label.minX, label.maxY, label.minZ], [label.minX, label.maxY, label.maxZ],
                [label.maxX, label.minY, label.minZ], [label.maxX, label.minY, label.maxZ],
                [label.maxX, label.maxY, label.minZ], [label.maxX, label.maxY, label.maxZ]
            ];
            var bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
            var visibleCornerCount = 0;
            for (var ci = 0; ci < corners.length; ci++) {
                var cp = proj(corners[ci][0], corners[ci][1], corners[ci][2]);
                if (!cp) continue;
                visibleCornerCount++;
                if (cp.x < bMinX) bMinX = cp.x;
                if (cp.y < bMinY) bMinY = cp.y;
                if (cp.x > bMaxX) bMaxX = cp.x;
                if (cp.y > bMaxY) bMaxY = cp.y;
            }
            if (visibleCornerCount < 2) continue;

            var projectedW = Math.max(24, bMaxX - bMinX);
            var projectedH = Math.max(18, bMaxY - bMinY);
            var labelX = (bMinX + bMaxX) * 0.5;
            var labelY = bMinY + Math.min(projectedH * 0.30, 18);

            var fontSize = Math.max(8, Math.min(20, 3200 / lp.depth));
            var labelStyle = sectorStyle(label.sector);
            var text = label.name.toUpperCase();
            ctx.font = 'bold ' + Math.round(fontSize) + 'px Consolas, monospace';
            var textW = ctx.measureText(text).width;
            var maxTextW = Math.max(14, projectedW - 16);
            if (textW > maxTextW) {
                var scale = maxTextW / textW;
                fontSize = Math.max(8, fontSize * scale);
                ctx.font = 'bold ' + Math.round(fontSize) + 'px Consolas, monospace';
                textW = ctx.measureText(text).width;
            }

            var padX = 6;
            var padY = 4;
            ctx.fillStyle = hexToRgba(labelStyle.canvasBg, 0.62);
            ctx.fillRect(labelX - textW / 2 - padX, labelY - fontSize + 2, textW + padX * 2, fontSize + padY * 2);
            ctx.strokeStyle = labelStyle.areaLabelStroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX - textW / 2 - padX, labelY - fontSize + 2, textW + padX * 2, fontSize + padY * 2);
            ctx.fillStyle = labelStyle.border;
            ctx.fillText(text, labelX, labelY + 1);
        }

        // -- HUD: controls --
        ctx.fillStyle = 'rgba(160,160,180,0.45)';
        ctx.font = '11px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('W/A/S/D: fly where you look   |   Space/Shift: up/down   |   Arrows/right-drag: look   |   Left-drag: pan   |   Scroll: FOV zoom', 12, H - 14);

    }

    // ---- Mouse handlers ----
    function toCanvasCoords(e) {
        var rect = canvas.getBoundingClientRect();
        var sx = (e.clientX - rect.left) * (canvas.width / rect.width);
        var sy = (e.clientY - rect.top) * (canvas.height / rect.height);
        return { x: sx, y: sy };
    }

    function toCanvasLocalCss(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function pickRoomAt(sx, sy) {
        computeBasis(canvas.width, canvas.height);
        var bestVnum = null;
        var bestDepth = Infinity;
        for (var v in roomIndex) {
            var r = roomIndex[v];
            var p = proj(r.x, r.y, r.z);
            if (!p) continue;
            // Use same size formula as draw so hitbox matches the visible square.
            var sz = Math.max(2, Math.min(12, 4000 / p.depth));
            var dx = p.x - sx;
            var dy = p.y - sy;
            if (Math.abs(dx) > sz || Math.abs(dy) > sz) continue;
            // Among rooms whose hitbox contains the cursor, pick the closest
            // (smallest depth = drawn on top = what the user sees on top).
            if (p.depth < bestDepth) {
                bestDepth = p.depth;
                bestVnum = +v;
            }
        }
        return bestVnum;
    }

    function setHoverFromEvent(e) {
        if (!isActive()) return;
        var pt = toCanvasCoords(e);
        hoveredVnum = pickRoomAt(pt.x, pt.y);

        if (!tooltipEl) return;
        if (!hoveredVnum) {
            tooltipEl.style.display = 'none';
            return;
        }
        var cssPt = toCanvasLocalCss(e);
        var r = roomIndex[hoveredVnum];
        if (!r) {
            tooltipEl.style.display = 'none';
            return;
        }
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = (cssPt.x + 14) + 'px';
        tooltipEl.style.top  = (cssPt.y + 8) + 'px';
        tooltipEl.innerHTML = '<strong>' + r.name + '</strong><br>' +
                              r.areaName + ' · vnum ' + r.vnum;
    }

    function onDown(e) {
        drag.active = true;
        drag.btn = e.button;
        drag.sx  = e.clientX;
        drag.sy  = e.clientY;
        drag.lx  = e.clientX;
        drag.ly  = e.clientY;
        drag.moved = false;
        e.preventDefault();
    }

    function onMove(e) {
        setHoverFromEvent(e);
        if (!drag.active) {
            render();
            return;
        }
        var dx = e.clientX - drag.lx;
        var dy = e.clientY - drag.ly;
        drag.lx = e.clientX;
        drag.ly = e.clientY;
        if (!drag.moved && (Math.abs(e.clientX - drag.sx) > 4 || Math.abs(e.clientY - drag.sy) > 4)) {
            drag.moved = true;
        }

        if (drag.btn === 2) {
            // Look around from the current camera position.
            cam.az += dx * 0.003;
            cam.el -= dy * 0.003;
            cam.el  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, cam.el));
        } else {
            // Pan from the current viewpoint using the camera's right/up vectors.
            computeBasis(canvas.width, canvas.height);
            var speed = SPACING * 0.55;
            cam.x -= dx * rgtX * speed;
            cam.y -= dx * rgtY * speed;
            cam.z -= dx * rgtZ * speed;
            cam.x += dy * upX * speed;
            cam.y += dy * upY * speed;
            cam.z += dy * upZ * speed;
        }
        render();
    }

    function onUp(e) {
        if (drag.active && drag.btn === 0 && !drag.moved) {
            var pt = toCanvasCoords(e);
            var vnum = pickRoomAt(pt.x, pt.y);
            if (vnum !== null) {
                window.dispatchEvent(new CustomEvent('map3d-room-click', { detail: { vnum: vnum } }));
            }
        }
        drag.active = false;
    }

    function onLeave() {
        drag.active = false;
        hoveredVnum = null;
        if (tooltipEl) tooltipEl.style.display = 'none';
        render();
    }

    function onWheel(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 3 : -3;
        cam.fov = Math.max(24, Math.min(92, cam.fov + delta));
        render();
    }

    function onCtxMenu(e) { e.preventDefault(); }

    function onKeyDown(e) {
        if (!controlsEnabled()) return;
        var key = e.key ? e.key.toLowerCase() : '';
        if (key === ' ') key = 'space';
        if (key === 'leftshift' || key === 'rightshift') key = 'shift';
        if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'space' || key === 'shift' || key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
            keysDown[key] = true;
            e.preventDefault();
        }
    }

    function onKeyUp(e) {
        if (!controlsEnabled()) return;
        var key = e.key ? e.key.toLowerCase() : '';
        if (key === ' ') key = 'space';
        if (key === 'leftshift' || key === 'rightshift') key = 'shift';
        if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'space' || key === 'shift' || key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
            keysDown[key] = false;
            e.preventDefault();
        }
    }

    function stepFlight() {
        if (!canvas) return;
        if (!controlsEnabled()) {
            clearKeys();
            animFrame = window.requestAnimationFrame(stepFlight);
            return;
        }
        computeBasis(canvas.width, canvas.height);
        var moved = false;
        // Base speed scales with FOV so movement feels consistent at any zoom.
        // Hold-to-accelerate: ramps from 1× up to 12× over ~2 s, resets on release.
        var anyMove = keysDown.w || keysDown.s || keysDown.a || keysDown.d ||
                      keysDown.space || keysDown.shift;
        if (anyMove) {
            flightAccel = Math.min(flightAccel + 0.04, 12.0);
        } else {
            flightAccel = 1.0;
        }
        var speed = SPACING * 0.85 * flightAccel;

        if (keysDown.w) {
            cam.x += fwdX * speed;
            cam.y += fwdY * speed;
            cam.z += fwdZ * speed;
            moved = true;
        }
        if (keysDown.s) {
            cam.x -= fwdX * speed;
            cam.y -= fwdY * speed;
            cam.z -= fwdZ * speed;
            moved = true;
        }
        if (keysDown.a) {
            cam.x -= rgtX * speed;
            cam.y -= rgtY * speed;
            cam.z -= rgtZ * speed;
            moved = true;
        }
        if (keysDown.d) {
            cam.x += rgtX * speed;
            cam.y += rgtY * speed;
            cam.z += rgtZ * speed;
            moved = true;
        }
        if (keysDown.space) {
            cam.y += speed;
            moved = true;
        }
        if (keysDown.shift) {
            cam.y -= speed;
            moved = true;
        }

        if (keysDown.arrowleft) {
            cam.az -= 0.028;
            moved = true;
        }
        if (keysDown.arrowright) {
            cam.az += 0.028;
            moved = true;
        }
        if (keysDown.arrowup) {
            cam.el = Math.min(Math.PI / 2 - 0.05, cam.el + 0.018);
            moved = true;
        }
        if (keysDown.arrowdown) {
            cam.el = Math.max(-Math.PI / 2 + 0.05, cam.el - 0.018);
            moved = true;
        }

        if (moved) render();
        animFrame = window.requestAnimationFrame(stepFlight);
    }

    // ---- Public ----
    window.Map3D = {
        init: function (canvasEl, data) {
            canvas = canvasEl;
            ctx    = canvas.getContext('2d');
            tooltipEl = document.getElementById('tooltip');
            sourceData = data;
            build(data);
            if (!initialized) {
                canvas.addEventListener('mousedown',   onDown);
                canvas.addEventListener('mousemove',   onMove);
                canvas.addEventListener('mouseup',     onUp);
                canvas.addEventListener('mouseleave',  onLeave);
                canvas.addEventListener('wheel',       onWheel,   { passive: false });
                canvas.addEventListener('contextmenu', onCtxMenu);
                window.addEventListener('keydown', onKeyDown);
                window.addEventListener('keyup', onKeyUp);
                initialized = true;
            }
            if (!animFrame) animFrame = window.requestAnimationFrame(stepFlight);
            render();
        },
        setTrueMapping: function (enabled) {
            trueMappingEnabled = !!enabled;
            if (!sourceData || !canvas) return;
            build(sourceData);
            render();
        },
        isTrueMappingEnabled: function () {
            return !!trueMappingEnabled;
        },
        setCubeMode: function (enabled) {
            cubeModeEnabled = !!enabled;
            render();
        },
        isCubeModeEnabled: function () {
            return !!cubeModeEnabled;
        },
        resize: function (w, h) {
            if (!canvas) return;
            canvas.width  = w;
            canvas.height = h;
            render();
        },
        focusRoom: function (vnum) {
            var room = roomIndex[vnum];
            if (!room) return;
            computeBasis(canvas.width, canvas.height);
            cam.x = room.x - fwdX * (SPACING * 18);
            cam.y = room.y - fwdY * (SPACING * 18);
            cam.z = room.z - fwdZ * (SPACING * 18);
            render();
        },
        focusArea: function (shortName) {
            var area = areaIndex[shortName];
            if (!area) return;
            computeBasis(canvas.width, canvas.height);
            var span = Math.max(area.maxX - area.minX, area.maxY - area.minY, area.maxZ - area.minZ, SPACING * 20);
            cam.x = area.x - fwdX * (span * 1.8);
            cam.y = area.y - fwdY * (span * 1.8) + span * 0.25;
            cam.z = area.z - fwdZ * (span * 1.8);
            render();
        },
        setSelectionState: function (originVnum, destVnum, pathVnums) {
            selectedOrigin = originVnum || null;
            selectedDest = destVnum || null;
            selectedPathSet = Object.create(null);
            if (Array.isArray(pathVnums)) {
                for (var i = 0; i < pathVnums.length; i++) {
                    selectedPathSet[pathVnums[i]] = true;
                }
            }
            render();
        },
        setGridId: function (gridId) {
            activeGridId = gridId || 'global';
            if (!sourceData || !canvas) return;
            build(sourceData);
            render();
        },
        render: render,
    };
})();
