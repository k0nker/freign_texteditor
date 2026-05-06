(function () {
  'use strict';

  var PROBE_TIMEOUT_MS = 5000;
  var PROBE_REFRESH_MS = 60000;

  // Same-origin paths — nginx proxies these to the lobby's plain HTTP port,
  // avoiding browser mixed-content and CORS issues.
  var PROBES = [
    { id: 'public', label: 'public', statusUrl: '/api/status/public' },
    { id: 'test',   label: 'test',   statusUrl: '/api/status/test'   },
  ];

  document.addEventListener('DOMContentLoaded', function () {
    PROBES.forEach(function (probe) {
      var el = document.getElementById('realm-status-' + probe.id);
      if (!el) return;
      function updateStatus() {
        el.textContent = probe.label + ': checking\u2026';
        probeRealmStatus(probe.statusUrl, function (state) {
          el.textContent = probe.label + ': ' + state;
          if (state === 'online') {
            el.className = 'status-online';
            return;
          }
          el.className = 'status-offline';
        });
      }

      updateStatus();
      window.setInterval(updateStatus, PROBE_REFRESH_MS);
    });
  });

  function probeRealmStatus(statusUrl, cb) {
    var done = false;
    var timer = null;
    var controller = null;

    function finish(result) {
      if (done) return;
      done = true;
      if (timer) window.clearTimeout(timer);
      if (controller) {
        try { controller.abort(); } catch (_) {}
      }
      cb(result);
    }

    if (typeof window.AbortController === 'function') {
      controller = new AbortController();
    }

    timer = window.setTimeout(function () { finish('offline'); }, PROBE_TIMEOUT_MS);

    fetch(statusUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) {
        finish('offline');
        return null;
      }
      return res.json();
    }).then(function (data) {
      if (!data) return;
      if (data.online === true) {
        finish('online');
        return;
      }
      finish('offline');
    }).catch(function () {
      finish('offline');
    });
  }
})();
