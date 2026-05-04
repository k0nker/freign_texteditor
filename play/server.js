#!/usr/bin/env node
'use strict';

const net = require('net');
const tls = require('tls');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PLAY_WS_PORT || '9001', 10);
const PATH = process.env.PLAY_WS_PATH || '/ws';
const PROXY_PROTOCOL = String(process.env.PLAY_PROXY_PROTOCOL || '').trim().toLowerCase();
const FORCED_TARGET_HOST = String(process.env.PLAY_TARGET_HOST || '').trim();
const FORCED_TARGET_PORT = clampInt(process.env.PLAY_TARGET_PORT, 1, 65535, 0);
const FORCED_TARGET_TLS = parseBool(process.env.PLAY_TARGET_TLS, false);
const HOST_ALLOWLIST = (process.env.PLAY_ALLOW_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;
const OPT_NAWS = 31;
const PROXY_V2_SIGNATURE = Buffer.from([
  0x0d, 0x0a, 0x0d, 0x0a,
  0x00, 0x0d, 0x0a, 0x51,
  0x55, 0x49, 0x54, 0x0a,
]);

const wss = new WebSocketServer({ port: PORT, path: PATH });

wss.on('connection', (ws, req) => {
  const state = {
    socket: null,
    connectedHost: null,
    connectedPort: null,
    client: getClientInfo(req),
    cols: 120,
    rows: 40,
  };

  ws.send(json({ type: 'status', message: `Bridge connected. Send connect command.` }));

  ws.on('message', (msgBuf) => {
    let msg;
    try {
      msg = JSON.parse(msgBuf.toString('utf8'));
    } catch {
      ws.send(json({ type: 'status', message: 'Invalid JSON message.' }));
      return;
    }

    if (msg.type === 'connect') {
      openMudConnection(ws, state, msg);
      return;
    }

    if (msg.type === 'disconnect') {
      closeMud(state, ws, 'Disconnected by client.');
      return;
    }

    if (msg.type === 'resize') {
      state.cols = clampInt(msg.cols, 20, 320, state.cols);
      state.rows = clampInt(msg.rows, 10, 120, state.rows);
      if (state.socket) sendNaws(state.socket, state.cols, state.rows);
      return;
    }

    if (msg.type === 'ping') {
      ws.send(json({ type: 'pong', t: Date.now() }));
      return;
    }

    if (msg.type === 'input') {
      if (!state.socket) {
        ws.send(json({ type: 'status', message: 'Not connected to any MUD.' }));
        return;
      }
      const text = String(msg.data || '').replace(/\r?\n/g, '\r\n');
      state.socket.write(Buffer.from(text, 'utf8'));
      return;
    }
  });

  ws.on('close', () => {
    closeMud(state, ws, null);
  });
});

function openMudConnection(ws, state, msg) {
  const target = resolveTarget(msg);
  const host = target.host;
  const port = target.port;
  const useTls = target.tls;

  if (!host || !port) {
    ws.send(json({ type: 'status', message: 'Connect requires host and port.' }));
    return;
  }

  if (!isAllowedHost(host)) {
    ws.send(json({ type: 'status', message: 'Requested destination is not allowed.' }));
    return;
  }

  closeMud(state, ws, null);

  const opts = { host, port, rejectUnauthorized: false };
  const sock = useTls ? tls.connect(opts) : net.connect(opts);

  state.socket = sock;
  state.connectedHost = host;
  state.connectedPort = port;

  sock.on('connect', () => {
    sendProxyHeader(sock, state.client);
    ws.send(json({ type: 'status', message: `Connected${useTls ? ' (TLS)' : ''}.` }));
    sendNaws(sock, state.cols, state.rows);
  });

  sock.on('data', (buf) => {
    const clean = stripAndNegotiateTelnet(buf, sock);
    if (clean.length > 0) {
      ws.send(json({ type: 'data', data: clean.toString('utf8') }));
    }
  });

  sock.on('error', (err) => {
    ws.send(json({ type: 'status', message: socketErrorMessage(err) }));
  });

  sock.on('close', () => {
    ws.send(json({ type: 'disconnected' }));
    state.socket = null;
  });
}

function stripAndNegotiateTelnet(buf, socket) {
  const out = [];

  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b !== IAC) {
      out.push(b);
      continue;
    }

    const cmd = buf[++i];
    if (cmd === undefined) break;

    if (cmd === IAC) {
      out.push(IAC);
      continue;
    }

    if (cmd === DO || cmd === DONT || cmd === WILL || cmd === WONT) {
      const opt = buf[++i];
      if (opt === undefined) break;
      negotiate(socket, cmd, opt);
      continue;
    }

    if (cmd === SB) {
      // Skip subnegotiation until IAC SE.
      while (i < buf.length) {
        if (buf[i] === IAC && buf[i + 1] === SE) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
  }

  return Buffer.from(out);
}

function negotiate(socket, cmd, opt) {
  if (cmd === DO) {
    if (opt === OPT_NAWS) sendIac(socket, WILL, opt);
    else sendIac(socket, WONT, opt);
    return;
  }

  if (cmd === WILL) {
    // Permit only ECHO(1) and SGA(3), reject others.
    if (opt === 1 || opt === 3) sendIac(socket, DO, opt);
    else sendIac(socket, DONT, opt);
    return;
  }

  if (cmd === DONT) {
    sendIac(socket, WONT, opt);
    return;
  }

  if (cmd === WONT) {
    sendIac(socket, DONT, opt);
  }
}

function sendNaws(socket, cols, rows) {
  const c = clampInt(cols, 20, 320, 120);
  const r = clampInt(rows, 10, 120, 40);
  const payload = Buffer.from([
    IAC, SB, OPT_NAWS,
    (c >> 8) & 0xff, c & 0xff,
    (r >> 8) & 0xff, r & 0xff,
    IAC, SE,
  ]);
  socket.write(payload);
}

function sendIac(socket, command, option) {
  socket.write(Buffer.from([IAC, command, option]));
}

function sendProxyHeader(socket, client) {
  if (!shouldSendProxyV2()) return;
  const header = buildProxyV2Header(client, socket);
  if (header) {
    socket.write(header.buffer);
    console.log(`[play-bridge] PROXY v2 sent src=${header.sourceAddress}:${header.sourcePort} dst=${header.destAddress}:${header.destPort} fam=${header.family === 6 ? 'tcp6' : 'tcp4'}`);
  } else {
    const src = normalizeIp(client && client.address) || 'unknown';
    const dst = normalizeIp(socket && socket.remoteAddress) || 'unknown';
    console.warn(`[play-bridge] PROXY v2 skipped src=${src} dst=${dst} (could not build header)`);
  }
}

function closeMud(state, ws, status) {
  if (state.socket) {
    try { state.socket.destroy(); } catch {}
    state.socket = null;
  }
  if (status) ws.send(json({ type: 'status', message: status }));
}

function isAllowedHost(host) {
  if (HOST_ALLOWLIST.length === 0) return true;
  return HOST_ALLOWLIST.includes(host.toLowerCase());
}

function shouldSendProxyV2() {
  return PROXY_PROTOCOL === 'v2' || PROXY_PROTOCOL === '2' || PROXY_PROTOCOL === 'proxy-v2';
}

function isForcedTargetEnabled() {
  return !!FORCED_TARGET_HOST;
}

function resolveTarget(msg) {
  if (isForcedTargetEnabled()) {
    return {
      host: FORCED_TARGET_HOST,
      port: FORCED_TARGET_PORT || 0,
      tls: FORCED_TARGET_TLS,
    };
  }

  return {
    host: String((msg && msg.host) || '').trim(),
    port: clampInt(msg && msg.port, 1, 65535, 0),
    tls: !!(msg && msg.tls),
  };
}

function socketErrorMessage(err) {
  const code = String(err && err.code ? err.code : '').toUpperCase();
  if (code === 'ECONNREFUSED') return 'Socket error: connection refused.';
  if (code === 'ETIMEDOUT') return 'Socket error: connection timed out.';
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'Socket error: destination unreachable.';
  return 'Socket error: connection failed.';
}

function getClientInfo(req) {
  const headers = (req && req.headers) || {};
  const forwardedFor = headerValues(headers['x-forwarded-for']);
  const realIp = headerValues(headers['x-real-ip']);
  const chain = [];

  forwardedFor.forEach(function (v) {
    const ip = normalizeIp(v);
    if (ip) chain.push(ip);
  });
  realIp.forEach(function (v) {
    const ip = normalizeIp(v);
    if (ip) chain.push(ip);
  });

  const socketAddress = normalizeIp(req && req.socket && req.socket.remoteAddress);
  if (socketAddress) chain.push(socketAddress);

  const address = pickBestClientIp(chain) || socketAddress;
  const port = clampInt(req && req.socket && req.socket.remotePort, 1, 65535, 0);
  return { address, port };
}

function headerValues(value) {
  if (Array.isArray(value)) {
    return value
      .map(function (v) { return String(v || ''); })
      .join(',')
      .split(',')
      .map(function (v) { return v.trim(); })
      .filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map(function (v) { return v.trim(); })
    .filter(Boolean);
}

function pickBestClientIp(chain) {
  if (!Array.isArray(chain) || chain.length === 0) return null;

  for (let i = 0; i < chain.length; i += 1) {
    if (isPublicIp(chain[i])) return chain[i];
  }

  return chain[0] || null;
}

function isPublicIp(ip) {
  const family = net.isIP(ip);
  if (!family) return false;
  if (family === 4) return isPublicIpv4(ip);
  return isPublicIpv6(ip);
}

function isPublicIpv4(ip) {
  const parts = ip.split('.').map(function (p) { return Number.parseInt(p, 10); });
  const a = parts[0];
  const b = parts[1];

  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a >= 224) return false; // multicast/reserved

  return true;
}

function isPublicIpv6(ip) {
  const lower = String(ip || '').toLowerCase();
  if (lower === '::1' || lower === '::') return false;
  if (lower.startsWith('fe80:')) return false; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false; // unique local
  return true;
}

function normalizeIp(value) {
  let raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('::ffff:')) {
    raw = raw.slice(7);
  }

  if (raw.startsWith('[') && raw.endsWith(']')) {
    raw = raw.slice(1, -1);
  }

  let match = raw.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}):(\d+)$/);
  if (match) raw = match[1];

  match = raw.match(/^\[([^\]]+)\]:(\d+)$/);
  if (match) raw = match[1];

  return net.isIP(raw) ? raw : null;
}

function buildProxyV2Header(client, socket) {
  const sourceAddress = normalizeIp(client && client.address);
  const sourcePort = clampInt(client && client.port, 1, 65535, 0);
  const destAddress = normalizeIp(socket && socket.remoteAddress);
  const destPort = clampInt(socket && socket.remotePort, 1, 65535, 0);
  const pair = pickProxyAddressPair(sourceAddress, destAddress);

  if (!pair || !sourcePort || !destPort) {
    return null;
  }

  const family = pair.family;
  const src = pair.sourceAddress;
  const dst = pair.destAddress;

  if (family === 4) {
    const payload = Buffer.alloc(12);
    writeIpv4(payload, 0, src);
    writeIpv4(payload, 4, dst);
    payload.writeUInt16BE(sourcePort, 8);
    payload.writeUInt16BE(destPort, 10);
    return {
      buffer: Buffer.concat([PROXY_V2_SIGNATURE, Buffer.from([0x21, 0x11, 0x00, 0x0c]), payload]),
      family,
      sourceAddress: src,
      sourcePort,
      destAddress: dst,
      destPort,
    };
  }

  const payload = Buffer.alloc(36);
  writeIpv6(payload, 0, src);
  writeIpv6(payload, 16, dst);
  payload.writeUInt16BE(sourcePort, 32);
  payload.writeUInt16BE(destPort, 34);
  return {
    buffer: Buffer.concat([PROXY_V2_SIGNATURE, Buffer.from([0x21, 0x21, 0x00, 0x24]), payload]),
    family,
    sourceAddress: src,
    sourcePort,
    destAddress: dst,
    destPort,
  };
}

function pickProxyAddressPair(sourceAddress, destAddress) {
  const sourceFamily = sourceAddress ? net.isIP(sourceAddress) : 0;
  const destFamily = destAddress ? net.isIP(destAddress) : 0;
  if (!sourceFamily || !destFamily) return null;

  if (sourceFamily === destFamily) {
    return { family: sourceFamily, sourceAddress, destAddress };
  }

  return {
    family: 6,
    sourceAddress: toIpv6Mapped(sourceAddress),
    destAddress: toIpv6Mapped(destAddress),
  };
}

function toIpv6Mapped(address) {
  if (!address) return address;
  const family = net.isIP(address);
  if (family === 6) return address;
  if (family !== 4) return address;
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  const hi = ((parts[0] << 8) | parts[1]).toString(16);
  const lo = ((parts[2] << 8) | parts[3]).toString(16);
  return `::ffff:${hi}:${lo}`;
}

function writeIpv4(buffer, offset, address) {
  const parts = address.split('.');
  for (let i = 0; i < 4; i += 1) {
    buffer[offset + i] = Number.parseInt(parts[i], 10) & 0xff;
  }
}

function writeIpv6(buffer, offset, address) {
  const bytes = ipv6ToBytes(address);
  for (let i = 0; i < 16; i += 1) {
    buffer[offset + i] = bytes[i];
  }
}

function ipv6ToBytes(address) {
  const zoneIndex = address.indexOf('%');
  const clean = zoneIndex === -1 ? address : address.slice(0, zoneIndex);
  const halves = clean.split('::');
  const head = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const tail = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - (head.length + tail.length);
  const groups = head.concat(new Array(Math.max(0, missing)).fill('0'), tail);
  const bytes = new Array(16).fill(0);

  for (let i = 0; i < 8; i += 1) {
    const value = Number.parseInt(groups[i] || '0', 16) & 0xffff;
    bytes[i * 2] = (value >> 8) & 0xff;
    bytes[i * 2 + 1] = value & 0xff;
  }

  return bytes;
}

function clampInt(v, min, max, def) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function parseBool(v, def) {
  const raw = String(v || '').trim().toLowerCase();
  if (!raw) return def;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function json(obj) {
  return JSON.stringify(obj);
}

console.log(
  `FREIGN play bridge listening on ws://0.0.0.0:${PORT}${PATH}`
  + `${shouldSendProxyV2() ? ' (PROXY v2 enabled)' : ''}`
  + `${isForcedTargetEnabled() ? ` (target locked to ${FORCED_TARGET_HOST}:${FORCED_TARGET_PORT || '?'}${FORCED_TARGET_TLS ? ' TLS' : ''})` : ''}`
);
