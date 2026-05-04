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
      probeMud(probe.wsPath, probe.host, probe.port, function (online) {
        el.textContent = probe.label + ': ' + (online ? 'online' : 'offline');
        el.className = online ? 'status-online' : 'status-offline';
      });
    });
  });

  function probeMud(wsPath, cb) {
      function probeMud(wsPath, mudHost, mudPort, cb) {
    var origin = window.location.origin;
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
      cb(false);
      return;
    }

    timer = setTimeout(function () { finish(false); }, PROBE_TIMEOUT_MS);

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
        // "Connected." = MUD is reachable. Anything else = failure.
        finish(typeof msg.message === 'string' && msg.message.indexOf('Connected') === 0);
        return;
      }

      if (msg.type === 'disconnected') {
        finish(false);
      }
    });

    ws.addEventListener('error', function () { finish(false); });
    ws.addEventListener('close', function () { finish(false); });
  }
})();
