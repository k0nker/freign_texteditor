(function () {
  'use strict';

  var PROBE_TIMEOUT_MS = 5000;

  var PROBES = [
    { id: 'public', label: 'public', wsPath: '/play/ws' },
    { id: 'test',   label: 'test',   wsPath: '/play/ws-test' },
  ];

  document.addEventListener('DOMContentLoaded', function () {
    PROBES.forEach(function (probe) {
      var el = document.getElementById('realm-status-' + probe.id);
      if (!el) return;
      el.textContent = probe.label + ': checking\u2026';
      probeMud(probe.wsPath, function (online) {
        el.textContent = probe.label + ': ' + (online ? 'online' : 'offline');
        el.className = online ? 'status-online' : 'status-offline';
      });
    });
  });

  function probeMud(wsPath, cb) {
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
      // Bridge sends a status message first; we reply with connect after that arrives.
      // Sending now is fine — the bridge queues nothing before our message fires.
    });

    var gotBridge = false;
    ws.addEventListener('message', function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }

      if (!gotBridge && msg.type === 'status') {
        // "Bridge connected. Send connect command." — send probe connect.
        gotBridge = true;
        ws.send(JSON.stringify({ type: 'connect' }));
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
