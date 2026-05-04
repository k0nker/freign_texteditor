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
    var areaLabels = [];  // {name, sector, x, y, z}
    var areaIndex = {};   // shortName -> {x, y, z, minX, maxX, minY, maxY, minZ, maxZ}

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

    function sectorStyle(sector) {
        var palettes = {
            dark: {
                link: '#586072',
                areaLabel: '#f0dfab',
                areaLabelStroke: 'rgba(8,8,12,0.45)',
                canvasBg: '#0a0a0e',
                areaLabelBg: 'rgba(10,14,20,0.44)',
                minLightness: 0.46,
                saturationBoost: 1.65,
                sectors: {
                    0:'#1e1e26',1:'#241e14',2:'#141e14',3:'#0e160e',4:'#1e1e14',5:'#1a1818',6:'#101828',7:'#0c1020',8:'#141a10',9:'#141820',10:'#22180a',11:'#1e0c06',12:'#1a1e22',_default:'#181820'
                }
            },
            parchment: {
                link: '#8a7756',
                areaLabel: '#8a5a1f',
                areaLabelStroke: 'rgba(255,245,226,0.55)',
                canvasBg: '#efe5cd',
                areaLabelBg: 'rgba(255,248,232,0.84)',
                minLightness: 0.60,
                saturationBoost: 1.18,
                sectors: {
                    0:'#e4dbc6',1:'#d9c8a7',2:'#ced9b0',3:'#c2cfaa',4:'#ddd6ac',5:'#cfc7ba',6:'#b9cfe6',7:'#a8c2df',8:'#c3cda9',9:'#dbe4ed',10:'#e6d29e',11:'#d4b09e',12:'#eef3f8',_default:'#dfd7c8'
                }
            },
            cobalt: {
                link: '#637898',
                areaLabel: '#d8ebff',
                areaLabelStroke: 'rgba(10,16,28,0.54)',
                canvasBg: '#111722',
                areaLabelBg: 'rgba(10,16,28,0.44)',
                minLightness: 0.48,
                saturationBoost: 1.70,
                sectors: {
                    0:'#1f2634',1:'#2c2930',2:'#1d2a26',3:'#1a2524',4:'#2a2d26',5:'#262731',6:'#1a2638',7:'#172236',8:'#232a25',9:'#262e3b',10:'#322c23',11:'#3a2520',12:'#2b3340',_default:'#222936'
                }
            }
        };
        var theme = palettes[themeName()] || palettes.cobalt;
        var baseFill = theme.sectors.hasOwnProperty(sector) ? theme.sectors[sector] : theme.sectors._default;
        var fill = liftSectorHex(baseFill, theme.minLightness, theme.saturationBoost);
        return {
            fill: fill,
            border: brightenHex(fill, 0.34),
            link: liftSectorHex(theme.link, Math.min(0.62, theme.minLightness + 0.04), 1.12),
            areaLabel: theme.areaLabel,
            areaLabelStroke: theme.areaLabelStroke,
            canvasBg: theme.canvasBg,
            areaLabelBg: theme.areaLabelBg,
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

    // ---- Build geometry ----
    function build(data) {
        rooms3d    = [];
        edges3d    = [];
        roomIndex  = {};
        areaLabels = [];
        areaIndex  = {};

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
                var rm = {
                    vnum:  rj.v,
                    name:  rj.n,
                    areaShort: wa.n,
                    areaName: ad.name || wa.n,
                    x:     areaPX + rj.x * SPACING,
                    y:     (rj.z || 0) * SPACING,       // vertical axis
                    z:     areaPZ + rj.y * SPACING,
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
        var startRadius = 5000;
        var startAz = Math.PI / 5;
        var startEl = Math.PI / 7;
        cam.x = cx + startRadius * Math.cos(startEl) * Math.sin(startAz);
        cam.y = cy + startRadius * Math.sin(startEl);
        cam.z = cz + startRadius * Math.cos(startEl) * Math.cos(startAz);
        var dirX = cx - cam.x;
        var dirY = cy - cam.y;
        var dirZ = cz - cam.z;
        var dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
        dirX /= dirLen;
        dirY /= dirLen;
        dirZ /= dirLen;
        cam.az = Math.atan2(dirX, -dirZ);
        cam.el = Math.asin(dirY);
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

            var col = sectorStyle(0).link;
            if (!edgesByColor[col]) edgesByColor[col] = [];
            edgesByColor[col].push(pA.x, pA.y, pB.x, pB.y);
        }
        for (var col in edgesByColor) {
            var arr = edgesByColor[col];
            ctx.strokeStyle = hexToRgba(col, 0.58);
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

        // Square half-size: closer = bigger, capped
        for (var i = 0; i < visRooms.length; i++) {
            var item = visRooms[i];
            var p = item.p, r = item.r;
            if (p.x < -20 || p.x > W+20 || p.y < -20 || p.y > H+20) continue;

            var sz = Math.max(1, Math.min(6, 2200 / p.depth));
            var roomStyle = sectorStyle(r.sector);
            var isOrigin = r.vnum === selectedOrigin;
            var isDest = r.vnum === selectedDest;
            var isPath = !!selectedPathSet[r.vnum];
            var isHover = r.vnum === hoveredVnum;
            ctx.fillStyle = roomStyle.fill;
            ctx.fillRect(p.x - sz, p.y - sz, sz*2, sz*2);
            if (isOrigin) {
                ctx.strokeStyle = 'rgba(232,212,120,0.98)';
                ctx.lineWidth = 2.0;
            } else if (isDest) {
                ctx.strokeStyle = 'rgba(140,195,255,0.98)';
                ctx.lineWidth = 2.0;
            } else if (isPath) {
                ctx.strokeStyle = 'rgba(205,175,95,0.96)';
                ctx.lineWidth = 1.6;
            } else if (isHover) {
                ctx.strokeStyle = 'rgba(230,240,255,0.95)';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = hexToRgba(roomStyle.border, 0.92);
                ctx.lineWidth = 1.0;
            }
            ctx.strokeRect(p.x - sz, p.y - sz, sz*2, sz*2);
            // Bright highlight on the top-left corner for a 3D feel
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.fillRect(p.x - sz, p.y - sz, sz, sz);
        }

        // -- Draw floating area labels --
        ctx.textAlign = 'center';
        for (var ai = 0; ai < areaLabels.length; ai++) {
            var label = areaLabels[ai];
            var lp = proj(label.x, label.y, label.z);
            if (!lp) continue;
            if (lp.x < -80 || lp.x > W + 80 || lp.y < -20 || lp.y > H + 20) continue;
            var fontSize = Math.max(10, Math.min(20, 3200 / lp.depth));
            var labelStyle = sectorStyle(label.sector);
            var textW = label.name.length * fontSize * 0.62;
            var padX = 8;
            var padY = 4;
            ctx.font = 'bold ' + Math.round(fontSize) + 'px Consolas, monospace';
            ctx.fillStyle = hexToRgba(labelStyle.canvasBg, 0.62);
            ctx.fillRect(lp.x - textW / 2 - padX, lp.y - fontSize + 2, textW + padX * 2, fontSize + padY * 2);
            ctx.strokeStyle = labelStyle.areaLabelStroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(lp.x - textW / 2 - padX, lp.y - fontSize + 2, textW + padX * 2, fontSize + padY * 2);
            ctx.fillStyle = labelStyle.border;
            ctx.fillText(label.name.toUpperCase(), lp.x, lp.y + 1);
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
        var bestD2 = Infinity;
        for (var v in roomIndex) {
            var r = roomIndex[v];
            var p = proj(r.x, r.y, r.z);
            if (!p) continue;
            var size = Math.max(4, Math.min(16, 2200 / p.depth + 4));
            var dx = p.x - sx;
            var dy = p.y - sy;
            if (Math.abs(dx) > size || Math.abs(dy) > size) continue;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
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
            cam.az += dx * 0.006;
            cam.el -= dy * 0.006;
            cam.el  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, cam.el));
        } else {
            // Pan from the current viewpoint using the camera's right/up vectors.
            computeBasis(canvas.width, canvas.height);
            var speed = SPACING * 1.5;
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
        var speed = SPACING * 2.25;

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
        render: render,
    };
})();
