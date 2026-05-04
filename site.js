(function () {
  'use strict';

  var PROBE_TIMEOUT_MS = 5000;

  var PROBES = [
    { id: 'public', label: 'public', wsPath: '/play/ws', host: '192.168.86.99', port: 25555 },
    { id: 'test',   label: 'test',   wsPath: '/play/ws', host: '192.168.86.99', port: 25556 },
  ];

  document.addEventListener('DOMContentLoaded', function () {
    PROBES.forEach(function (probe) {
      var el = document.getElementById('realm-status-' + probe.id);
      if (!el) return;
      el.textContent = probe.label + ': checking\u2026';
      probeMud(probe.wsPath, probe.host, probe.port, function (state) {
        el.textContent = probe.label + ': ' + state;
        if (state === 'online') {
          el.className = 'status-online';
          return;
        }
        el.className = 'status-offline';
      });
    });
  });

  function probeMud(wsPath, mudHost, mudPort, cb) {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var host = window.location.host;
    var url = protocol + '//' + host + wsPath;

    var done = false;
    var timer = null;

    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      cb(result);
    }

    var ws;
    try {
      ws = new WebSocket(url);
    } catch (_) {
      cb('offline');
      return;
    }

    timer = setTimeout(function () { finish('offline'); }, PROBE_TIMEOUT_MS);

    ws.addEventListener('open', function () {
    });

    var gotBridge = false;
    ws.addEventListener('message', function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }

      if (!gotBridge && msg.type === 'status') {
        gotBridge = true;
        ws.send(JSON.stringify({ type: 'connect', host: mudHost, port: mudPort }));
        return;
      }

      if (gotBridge && msg.type === 'status') {
        // "Connected." = MUD is reachable. All other failures are treated as offline.
        if (typeof msg.message === 'string' && msg.message.indexOf('Connected') === 0) {
          finish('online');
          return;
        }
        finish('offline');
        return;
      }

      if (msg.type === 'disconnected') {
        finish('offline');
      }
    });

    ws.addEventListener('error', function () { finish('offline'); });
    ws.addEventListener('close', function () { finish('offline'); });
  }
})();
