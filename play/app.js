(function () {
  'use strict';

  var STORAGE_KEY = 'freign.play.settings.v4';
  var SITE_THEME_KEY = 'freign.site.theme.v1';
  var themeApi = window.FreignThemes || null;
  var LOCKED_MUDS = [
    { id: 'public', name: 'Public', host: '192.168.86.99', port: 25555, tls: false },
    { id: 'test', name: 'Test', host: '192.168.86.99', port: 25556, tls: false },
  ];

  var DEFAULT_SETTINGS = {
    theme: 'amethyst',
    timestamps: true,
    wrapLines: true,
    stackSeparator: ';',
    bridgeUrl: '',
    muds: fixedMuds(),
    aliases: [],
    triggers: [],
    macros: [],
    palette16: {},
  };

  var DEFAULT_16 = window.AnsiRenderer.buildDefaultPalette16();

  var state = {
    settings: null,
    ws: null,
    connected: false,
    selectedMudId: null,
    ansiPalette: null,
    lineCarry: '',
    partialRow: null,
    triggerGuard: 0,
    cmdHistory: [],
    historyIdx: -1,
    keepaliveTimer: null,
  };

  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindEls();
    bindUi();
    loadSettings();
    renderAll();
    appendSystem('Client ready. Select Public or Test and press Connect.');
  }

  function bindEls() {
    el.terminal = document.getElementById('terminal');
    el.connectionState = document.getElementById('connection-state');
    el.inputForm = document.getElementById('input-form');
    el.cmdInput = document.getElementById('cmd-input');

    el.mudSelect = document.getElementById('mud-select');
    el.mudName = document.getElementById('mud-name');
    el.mudHost = document.getElementById('mud-host');
    el.mudPort = document.getElementById('mud-port');
    el.mudTls = document.getElementById('mud-tls');
    el.mudAdd = document.getElementById('mud-add');
    el.mudRemove = document.getElementById('mud-remove');
    el.connectPublicBtn = document.getElementById('connect-public-btn');
    el.connectTestBtn = document.getElementById('connect-test-btn');
    el.connectBtn = document.getElementById('connect-btn');
    el.disconnectBtn = document.getElementById('disconnect-btn');

    el.themeSelect = document.getElementById('site-theme-select') || document.getElementById('theme-select');
    el.timestamps = document.getElementById('timestamps');
    el.wrapLines = document.getElementById('wrap-lines');
    el.stackSeparator = document.getElementById('stack-separator');
    el.bridgeUrl = document.getElementById('bridge-url');
    el.macroBar = document.getElementById('macro-bar');

    el.aliasesTable = document.getElementById('aliases-table');
    el.triggersTable = document.getElementById('triggers-table');
    el.macrosTable = document.getElementById('macros-table');
    el.addAlias = document.getElementById('add-alias');
    el.addTrigger = document.getElementById('add-trigger');
    el.addMacro = document.getElementById('add-macro');

    el.ansiColors = document.getElementById('ansi-colors');

    el.exportSettings = document.getElementById('export-settings');
    el.importSettings = document.getElementById('import-settings');
    el.resetSettings = document.getElementById('reset-settings');
    el.importFile = document.getElementById('import-file');
  }

  function bindUi() {
    el.inputForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });
    el.cmdInput.addEventListener('keydown', handleInputHistoryKeydown);
    el.cmdInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      // Force-send even blank lines; avoid relying on browser submit behavior for empty inputs.
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });
    document.addEventListener('keydown', onGlobalKeydown);

    if (el.mudSelect) {
      el.mudSelect.addEventListener('change', function () {
        state.selectedMudId = el.mudSelect.value;
        hydrateMudForm();
      });
    }

    if (el.mudAdd) el.mudAdd.addEventListener('click', upsertMudFromForm);
    if (el.mudRemove) el.mudRemove.addEventListener('click', removeSelectedMud);

    if (el.connectPublicBtn) {
      el.connectPublicBtn.addEventListener('click', function () {
        state.selectedMudId = 'public';
        connectSelectedMud();
      });
    }
    if (el.connectTestBtn) {
      el.connectTestBtn.addEventListener('click', function () {
        state.selectedMudId = 'test';
        connectSelectedMud();
      });
    }
    if (el.connectBtn) el.connectBtn.addEventListener('click', connectSelectedMud);
    if (el.disconnectBtn) el.disconnectBtn.addEventListener('click', disconnect);

    // Connection targets are intentionally locked to fixed Public/Test profiles.
    if (el.mudName) el.mudName.readOnly = true;
    if (el.mudHost) el.mudHost.readOnly = true;
    if (el.mudPort) el.mudPort.readOnly = true;
    if (el.mudTls) el.mudTls.disabled = true;
    if (el.mudAdd) el.mudAdd.disabled = true;
    if (el.mudRemove) el.mudRemove.disabled = true;

    if (el.themeSelect) {
      el.themeSelect.addEventListener('change', function () {
        state.settings.theme = resolveTheme(el.themeSelect.value);
        saveSettings();
      });
    }

    window.addEventListener('freign-theme-changed', function (evt) {
      if (!evt || !evt.detail) return;
      state.settings.theme = resolveTheme(evt.detail.themeId);
      if (el.themeSelect) el.themeSelect.value = state.settings.theme;
      saveSettings();
    });
    el.timestamps.addEventListener('change', function () {
      state.settings.timestamps = !!el.timestamps.checked;
      saveSettings();
    });
    el.wrapLines.addEventListener('change', function () {
      state.settings.wrapLines = !!el.wrapLines.checked;
      saveAndRefresh();
    });
    el.stackSeparator.addEventListener('change', function () {
      state.settings.stackSeparator = sanitizeStackSeparator(el.stackSeparator.value);
      el.stackSeparator.value = state.settings.stackSeparator;
      saveSettings();
    });
    el.bridgeUrl.addEventListener('change', function () {
      state.settings.bridgeUrl = el.bridgeUrl.value.trim();
      saveSettings();
    });

    el.addAlias.addEventListener('click', function () {
      state.settings.aliases.push({ enabled: true, pattern: '', replacement: '' });
      saveAndRefresh();
    });

    el.addTrigger.addEventListener('click', function () {
      state.settings.triggers.push({ enabled: true, pattern: '', flags: 'i', action: 'highlight', value: '' });
      saveAndRefresh();
    });

    el.addMacro.addEventListener('click', function () {
      state.settings.macros.push({ enabled: true, label: '', command: '', hotkey: '' });
      saveAndRefresh();
    });

    el.exportSettings.addEventListener('click', exportSettings);
    el.importSettings.addEventListener('click', function () { el.importFile.click(); });
    el.resetSettings.addEventListener('click', resetLocalSettings);
    el.importFile.addEventListener('change', importSettingsFile);
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      state.settings = mergeSettings(DEFAULT_SETTINGS, parsed);
      var siteTheme = themeApi ? themeApi.getThemeId() : localStorage.getItem(SITE_THEME_KEY);
      state.settings.theme = resolveTheme(siteTheme || state.settings.theme);
    } catch (_) {
      state.settings = clone(DEFAULT_SETTINGS);
    }
    state.selectedMudId = state.settings.muds[0] ? state.settings.muds[0].id : null;
    rebuildPalette();
  }

  function rebuildPalette() {
    var p16 = [];
    for (var i = 0; i < 16; i++) {
      p16[i] = state.settings.palette16[String(i)] || DEFAULT_16[i];
    }
    state.ansiPalette = window.AnsiRenderer.buildXtermPalette(p16);
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function saveAndRefresh() {
    saveSettings();
    renderAll();
  }

  function renderAll() {
    state.settings.theme = resolveTheme(state.settings.theme);
    if (themeApi) {
      themeApi.applyTheme(state.settings.theme, { select: el.themeSelect, persist: true });
    } else {
      document.body.setAttribute('data-theme', state.settings.theme || 'amethyst');
      if (el.themeSelect) el.themeSelect.value = state.settings.theme || 'amethyst';
    }
    el.timestamps.checked = !!state.settings.timestamps;
    el.wrapLines.checked = !!state.settings.wrapLines;
    el.stackSeparator.value = sanitizeStackSeparator(state.settings.stackSeparator);
    el.bridgeUrl.value = state.settings.bridgeUrl || '';

    el.terminal.classList.toggle('nowrap', !state.settings.wrapLines);

    renderMuds();
    hydrateMudForm();
    renderAliases();
    renderTriggers();
    renderMacros();
    renderMacroBar();
    renderAnsiColorEditors();
  }

  function renderMuds() {
    el.mudSelect.innerHTML = '';
    state.settings.muds.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name + ' (' + m.host + ':' + m.port + ')';
      el.mudSelect.appendChild(opt);
    });
    if (!state.selectedMudId && state.settings.muds[0]) state.selectedMudId = state.settings.muds[0].id;
    el.mudSelect.value = state.selectedMudId || '';
  }

  function hydrateMudForm() {
    var m = getSelectedMud();
    if (!m) {
      el.mudName.value = '';
      el.mudHost.value = '';
      el.mudPort.value = '';
      el.mudTls.checked = false;
      return;
    }
    el.mudName.value = m.name;
    el.mudHost.value = m.host;
    el.mudPort.value = m.port;
    el.mudTls.checked = !!m.tls;
  }

  function upsertMudFromForm() {
    appendSystem('Connection profiles are locked: Public and Test.');
  }

  function removeSelectedMud() {
    appendSystem('Connection profiles are locked: Public and Test.');
  }

  function getSelectedMud() {
    return state.settings.muds.find(function (m) { return m.id === state.selectedMudId; }) || null;
  }

  function renderAliases() {
    el.aliasesTable.innerHTML = '';
    state.settings.aliases.forEach(function (a, idx) {
      var row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = '' +
        '<input data-k="pattern" placeholder="regex pattern" />' +
        '<input data-k="replacement" placeholder="replacement" />' +
        '<button type="button" data-k="remove">X</button>';
      var inputs = row.querySelectorAll('input');
      inputs[0].value = a.pattern || '';
      inputs[1].value = a.replacement || '';

      var enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = !!a.enabled;
      enabled.title = 'Enabled';
      enabled.addEventListener('change', function () {
        a.enabled = !!enabled.checked;
        saveSettings();
      });
      row.insertBefore(enabled, row.firstChild);

      row.querySelector('[data-k="pattern"]').addEventListener('change', function (e) {
        a.pattern = e.target.value;
        saveSettings();
      });
      row.querySelector('[data-k="replacement"]').addEventListener('change', function (e) {
        a.replacement = e.target.value;
        saveSettings();
      });
      row.querySelector('[data-k="remove"]').addEventListener('click', function () {
        state.settings.aliases.splice(idx, 1);
        saveAndRefresh();
      });

      el.aliasesTable.appendChild(row);
    });
  }

  function renderTriggers() {
    el.triggersTable.innerHTML = '';
    state.settings.triggers.forEach(function (t, idx) {
      var row = document.createElement('div');
      row.className = 'table-row trigger';
      row.innerHTML = '' +
        '<input data-k="pattern" placeholder="regex pattern" />' +
        '<input data-k="flags" placeholder="flags" />' +
        '<select data-k="action"><option value="highlight">highlight</option><option value="send">send</option><option value="notify">notify</option></select>' +
        '<input data-k="value" placeholder="action value" />' +
        '<button type="button" data-k="remove">X</button>';

      var enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = !!t.enabled;
      enabled.title = 'Enabled';
      enabled.addEventListener('change', function () {
        t.enabled = !!enabled.checked;
        saveSettings();
      });
      row.insertBefore(enabled, row.firstChild);

      row.querySelector('[data-k="pattern"]').value = t.pattern || '';
      row.querySelector('[data-k="flags"]').value = t.flags || '';
      row.querySelector('[data-k="action"]').value = t.action || 'highlight';
      row.querySelector('[data-k="value"]').value = t.value || '';

      row.querySelector('[data-k="pattern"]').addEventListener('change', function (e) { t.pattern = e.target.value; saveSettings(); });
      row.querySelector('[data-k="flags"]').addEventListener('change', function (e) { t.flags = e.target.value; saveSettings(); });
      row.querySelector('[data-k="action"]').addEventListener('change', function (e) { t.action = e.target.value; saveSettings(); });
      row.querySelector('[data-k="value"]').addEventListener('change', function (e) { t.value = e.target.value; saveSettings(); });
      row.querySelector('[data-k="remove"]').addEventListener('click', function () {
        state.settings.triggers.splice(idx, 1);
        saveAndRefresh();
      });

      el.triggersTable.appendChild(row);
    });
  }

  function renderMacros() {
    el.macrosTable.innerHTML = '';
    state.settings.macros.forEach(function (m, idx) {
      var row = document.createElement('div');
      row.className = 'table-row macro';
      row.innerHTML = '' +
        '<input data-k="label" placeholder="label" />' +
        '<input data-k="command" placeholder="command to send" />' +
        '<input data-k="hotkey" placeholder="Alt+1 / F2" />' +
        '<button type="button" data-k="remove">X</button>';

      var enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = !!m.enabled;
      enabled.title = 'Enabled';
      enabled.addEventListener('change', function () {
        m.enabled = !!enabled.checked;
        saveAndRefresh();
      });
      row.insertBefore(enabled, row.firstChild);

      row.querySelector('[data-k="label"]').value = m.label || '';
      row.querySelector('[data-k="command"]').value = m.command || '';
      row.querySelector('[data-k="hotkey"]').value = m.hotkey || '';

      row.querySelector('[data-k="label"]').addEventListener('change', function (e) {
        m.label = e.target.value;
        saveAndRefresh();
      });
      row.querySelector('[data-k="command"]').addEventListener('change', function (e) {
        m.command = e.target.value;
        saveAndRefresh();
      });
      row.querySelector('[data-k="hotkey"]').addEventListener('change', function (e) {
        m.hotkey = normalizeHotkeyText(e.target.value);
        saveAndRefresh();
      });
      row.querySelector('[data-k="remove"]').addEventListener('click', function () {
        state.settings.macros.splice(idx, 1);
        saveAndRefresh();
      });

      el.macrosTable.appendChild(row);
    });
  }

  function renderMacroBar() {
    el.macroBar.innerHTML = '';
    state.settings.macros.forEach(function (m) {
      if (!m.enabled || !m.command) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'macro-btn';
      btn.textContent = m.label || m.command;
      if (m.hotkey) btn.title = m.hotkey + ': ' + m.command;
      btn.addEventListener('click', function () {
        sendCommand(m.command);
      });
      el.macroBar.appendChild(btn);
    });
  }

  function renderAnsiColorEditors() {
    el.ansiColors.innerHTML = '';
    for (var i = 0; i < 16; i++) {
      var holder = document.createElement('label');
      holder.className = 'ansi-cell';

      var txt = document.createElement('span');
      txt.textContent = String(i);

      var color = document.createElement('input');
      color.type = 'color';
      color.value = state.settings.palette16[String(i)] || DEFAULT_16[i];
      (function (index) {
        color.addEventListener('input', function () {
          state.settings.palette16[String(index)] = color.value;
          rebuildPalette();
          saveSettings();
        });
      })(i);

      holder.appendChild(txt);
      holder.appendChild(color);
      el.ansiColors.appendChild(holder);
    }
  }

  function bridgeUrl() {
    if (state.settings.bridgeUrl) return state.settings.bridgeUrl;
    var scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return scheme + location.host + '/play/ws';
  }

  function connectSelectedMud() {
    var mud = getSelectedMud();
    if (!mud) {
      appendSystem('No MUD profile selected.');
      return;
    }

    disconnect();

    var url = bridgeUrl();
    appendSystem('Opening bridge ...');

    try {
      state.ws = new WebSocket(url);
    } catch (err) {
      appendSystem('WebSocket open failed.');
      return;
    }

    state.ws.addEventListener('open', function () {
      setConnectionState(true);
      sendWs({ type: 'connect', host: mud.host, port: mud.port, tls: !!mud.tls });
      startKeepalive();
    });

    state.ws.addEventListener('message', function (event) {
      handleBridgeMessage(event.data);
    });

    state.ws.addEventListener('close', function () {
      stopKeepalive();
      setConnectionState(false);
      appendSystem('Bridge closed.');
      state.ws = null;
    });

    state.ws.addEventListener('error', function () {
      appendSystem('Bridge websocket error.');
    });
  }

  function disconnect() {
    stopKeepalive();
    if (!state.ws) return;
    try { sendWs({ type: 'disconnect' }); } catch (_) {}
    try { state.ws.close(); } catch (_) {}
    state.ws = null;
    setConnectionState(false);
  }

  function setConnectionState(online) {
    state.connected = !!online;
    el.connectionState.textContent = online ? 'Online' : 'Offline';
    el.connectionState.className = online ? 'state-online' : 'state-offline';
  }

  function sendWs(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify(payload));
  }

  function submitInputCommand(raw) {
    var cmd = typeof raw === 'string' ? raw : String(raw || '');
    el.cmdInput.value = '';
    sendCommand(cmd);
  }

  function sendCommand(cmd) {
    // If a prompt line is still live (no newline yet), freeze it before local echo.
    // Otherwise the next server chunk can mutate that older row and make output appear out of order.
    if (state.partialRow) {
      state.partialRow = null;
      state.lineCarry = '';
    }

    var options = arguments.length > 1 && arguments[1] ? arguments[1] : {};
    var suppressEcho = !!options.suppressEcho;
    var skipHistory = !!options.skipHistory;
    var skipAliases = !!options.skipAliases;

    var source = typeof cmd === 'string' ? cmd : String(cmd || '');
    var out = skipAliases ? source : applyAliases(source);
    if (typeof out !== 'string') out = String(out || '');

    if (source.trim() === '' && out.trim() === '') {
      if (!suppressEcho) appendOutgoing('');
      sendWs({ type: 'input', data: '\n' });
      return;
    }

    var parts = splitStackedCommands(out);
    if (parts.length === 0) return;

    if (!skipHistory) pushHistory(source);
    parts.forEach(function (part) {
      if (!suppressEcho) appendOutgoing(part);
      sendWs({ type: 'input', data: part + '\n' });
    });
  }

  function applyAliases(cmd) {
    var result = cmd;
    state.settings.aliases.forEach(function (a) {
      if (!a.enabled || !a.pattern) return;
      try {
        var re = new RegExp(a.pattern);
        if (re.test(result)) {
          result = result.replace(re, a.replacement || '');
        }
      } catch (_) {
        // Ignore invalid user regex.
      }
    });
    return result;
  }

  function handleBridgeMessage(raw) {
    var msg;
    try {
      msg = JSON.parse(raw);
    } catch (_) {
      appendSystem('Invalid bridge payload.');
      return;
    }

    if (msg.type === 'status') {
      appendSystem(msg.message || 'status');
      return;
    }

    if (msg.type === 'data') {
      ingestMudText(msg.data || '');
      return;
    }

    if (msg.type === 'pong') {
      return;
    }

    if (msg.type === 'disconnected') {
      appendSystem('MUD disconnected.');
      return;
    }
  }

  function startKeepalive() {
    stopKeepalive();
    state.keepaliveTimer = setInterval(function () {
      sendWs({ type: 'ping', t: Date.now() });
    }, 30000);
  }

  function stopKeepalive() {
    if (!state.keepaliveTimer) return;
    clearInterval(state.keepaliveTimer);
    state.keepaliveTimer = null;
  }

  function ingestMudText(chunk) {
    var text = state.lineCarry + chunk;
    var lines = text.split(/\r?\n/);
    var trailing = lines.pop() || '';

    if (state.partialRow) {
      if (lines.length > 0) {
        var first = lines.shift();
        var firstHighlighted = runTriggers(first);
        renderRowContent(state.partialRow, first, firstHighlighted);
        state.partialRow = null;
      } else {
        state.lineCarry = trailing;
        upsertPartialRow(state.lineCarry);
        return;
      }
    }

    lines.forEach(function (line) {
      var highlighted = runTriggers(line);
      appendAnsiLine(line, highlighted);
    });

    state.lineCarry = trailing;
    if (state.lineCarry) {
      upsertPartialRow(state.lineCarry);
    }
  }

  function runTriggers(line) {
    var highlighted = false;

    state.settings.triggers.forEach(function (t) {
      if (!t.enabled || !t.pattern) return;
      try {
        var re = new RegExp(t.pattern, t.flags || '');
        if (!re.test(line)) return;

        if (t.action === 'highlight') {
          highlighted = true;
        } else if (t.action === 'notify') {
          appendSystem('TRIGGER: ' + (t.value || t.pattern));
        } else if (t.action === 'send' && t.value && state.triggerGuard < 3) {
          state.triggerGuard++;
          sendCommand(t.value, { suppressEcho: true, skipHistory: true });
          setTimeout(function () { state.triggerGuard = Math.max(0, state.triggerGuard - 1); }, 200);
        }
      } catch (_) {
        // Ignore invalid regex.
      }
    });

    return highlighted;
  }

  function appendAnsiLine(line, highlighted) {
    var row = document.createElement('div');
    renderRowContent(row, line, highlighted);

    var atBottom = el.terminal.scrollTop + el.terminal.clientHeight >= el.terminal.scrollHeight - 40;
    el.terminal.appendChild(row);
    trimTerminal();
    if (atBottom) el.terminal.scrollTop = el.terminal.scrollHeight;
  }

  function renderRowContent(row, line, highlighted) {
    row.className = highlighted ? 'line highlight' : 'line';
    row.innerHTML = '';

    if (state.settings.timestamps) {
      var ts = document.createElement('span');
      ts.className = 'ts';
      ts.textContent = '[' + nowTime() + ']';
      row.appendChild(ts);
    }

    row.appendChild(window.AnsiRenderer.renderAnsiLine(line, state.ansiPalette));
  }

  function upsertPartialRow(line) {
    if (!line) return;

    if (state.partialRow) {
      renderRowContent(state.partialRow, line, false);
      return;
    }

    var row = document.createElement('div');
    renderRowContent(row, line, false);

    var atBottom = el.terminal.scrollTop + el.terminal.clientHeight >= el.terminal.scrollHeight - 40;
    el.terminal.appendChild(row);
    state.partialRow = row;
    trimTerminal();
    if (atBottom) el.terminal.scrollTop = el.terminal.scrollHeight;
  }

  function clearPartialRow() {
    if (!state.partialRow) return;
    if (state.partialRow.parentNode) state.partialRow.parentNode.removeChild(state.partialRow);
    state.partialRow = null;
  }

  function appendSystem(text) {
    appendAnsiLine('\x1b[1;36m[system]\x1b[0m ' + text, false);
  }

  function appendOutgoing(text) {
    appendAnsiLine('\x1b[1;35m>\x1b[0m ' + text, false);
  }

  function resetLocalSettings() {
    var ok = window.confirm('Reset all local FREIGN Play settings on this browser? This cannot be undone.');
    if (!ok) return;

    disconnect();
    clearSavedSettingsKeys();
    state.settings = clone(DEFAULT_SETTINGS);
    state.selectedMudId = state.settings.muds[0] ? state.settings.muds[0].id : null;
    state.cmdHistory = [];
    state.historyIdx = -1;
    state.lineCarry = '';
    clearPartialRow();
    rebuildPalette();
    saveAndRefresh();
    appendSystem('Local settings reset.');
  }

  function clearSavedSettingsKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('freign.play.settings.') === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  }

  function handleInputHistoryKeydown(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!state.cmdHistory.length) return;

    e.preventDefault();

    if (e.key === 'ArrowUp') {
      if (state.historyIdx < 0) state.historyIdx = state.cmdHistory.length;
      state.historyIdx = Math.max(0, state.historyIdx - 1);
      el.cmdInput.value = state.cmdHistory[state.historyIdx] || '';
      return;
    }

    if (state.historyIdx < 0) return;
    state.historyIdx = Math.min(state.cmdHistory.length, state.historyIdx + 1);
    if (state.historyIdx === state.cmdHistory.length) {
      state.historyIdx = -1;
      el.cmdInput.value = '';
      return;
    }
    el.cmdInput.value = state.cmdHistory[state.historyIdx] || '';
  }

  function pushHistory(cmd) {
    var clean = String(cmd || '').trim();
    if (!clean) return;
    var last = state.cmdHistory[state.cmdHistory.length - 1];
    if (last === clean) {
      state.historyIdx = -1;
      return;
    }
    state.cmdHistory.push(clean);
    if (state.cmdHistory.length > 200) state.cmdHistory.shift();
    state.historyIdx = -1;
  }

  function onGlobalKeydown(e) {
    if (e.defaultPrevented) return;

    var active = document.activeElement;
    var typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (typing) return;

    var combo = eventToKeyCombo(e);
    if (!combo) return;

    var hit = state.settings.macros.find(function (m) {
      return m.enabled && m.command && normalizeHotkeyText(m.hotkey) === combo;
    });
    if (!hit) return;

    e.preventDefault();
    sendCommand(hit.command);
  }

  function eventToKeyCombo(e) {
    var key = String(e.key || '');
    if (!key) return '';
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return '';

    if (key.length === 1) key = key.toUpperCase();
    var parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    parts.push(key);
    return parts.join('+');
  }

  function normalizeHotkeyText(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';

    var parts = raw.split('+').map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) return '';

    var flags = { ctrl: false, alt: false, shift: false, meta: false };
    var key = '';

    parts.forEach(function (p) {
      var n = p.toLowerCase();
      if (n === 'ctrl' || n === 'control') flags.ctrl = true;
      else if (n === 'alt' || n === 'option') flags.alt = true;
      else if (n === 'shift') flags.shift = true;
      else if (n === 'meta' || n === 'cmd' || n === 'command') flags.meta = true;
      else key = p;
    });

    if (!key) return '';
    if (key.length === 1) key = key.toUpperCase();

    var out = [];
    if (flags.ctrl) out.push('Ctrl');
    if (flags.alt) out.push('Alt');
    if (flags.shift) out.push('Shift');
    if (flags.meta) out.push('Meta');
    out.push(key);
    return out.join('+');
  }

  function trimTerminal() {
    var maxLines = 2000;
    while (el.terminal.childNodes.length > maxLines) {
      el.terminal.removeChild(el.terminal.firstChild);
    }
  }

  function exportSettings() {
    var json = JSON.stringify(state.settings, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'freign-play-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importSettingsFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || '{}'));
        state.settings = mergeSettings(DEFAULT_SETTINGS, parsed);
        state.selectedMudId = state.settings.muds[0] ? state.settings.muds[0].id : null;
        rebuildPalette();
        saveAndRefresh();
        appendSystem('Settings imported.');
      } catch (_) {
        appendSystem('Settings import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function mergeSettings(base, incoming) {
    var out = clone(base);
    incoming = incoming || {};

    out.theme = resolveTheme(incoming.theme || base.theme);
    out.timestamps = typeof incoming.timestamps === 'boolean' ? incoming.timestamps : base.timestamps;
    out.wrapLines = typeof incoming.wrapLines === 'boolean' ? incoming.wrapLines : base.wrapLines;
    out.stackSeparator = sanitizeStackSeparator(incoming.stackSeparator);
    out.bridgeUrl = typeof incoming.bridgeUrl === 'string' ? incoming.bridgeUrl : base.bridgeUrl;

    out.muds = fixedMuds();

    out.aliases = Array.isArray(incoming.aliases)
      ? incoming.aliases.map(function (a) {
          return {
            enabled: a.enabled !== false,
            pattern: String(a.pattern || ''),
            replacement: String(a.replacement || ''),
          };
        })
      : [];

    out.triggers = Array.isArray(incoming.triggers)
      ? incoming.triggers.map(function (t) {
          return {
            enabled: t.enabled !== false,
            pattern: String(t.pattern || ''),
            flags: String(t.flags || ''),
            action: oneOf(t.action, ['highlight', 'send', 'notify'], 'highlight'),
            value: String(t.value || ''),
          };
        })
      : [];

    out.macros = Array.isArray(incoming.macros)
      ? incoming.macros.map(function (m) {
          return {
            enabled: m.enabled !== false,
            label: String(m.label || ''),
            command: String(m.command || ''),
            hotkey: normalizeHotkeyText(m.hotkey),
          };
        })
      : [];

    out.palette16 = {};
    var srcPalette = incoming.palette16 || {};
    for (var i = 0; i < 16; i++) {
      var key = String(i);
      var val = srcPalette[key];
      out.palette16[key] = isHexColor(val) ? val : DEFAULT_16[i];
    }

    return out;
  }

  function isHexColor(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  }

  function sanitizeStackSeparator(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return ';';
    return s.slice(0, 4);
  }

  function splitStackedCommands(text) {
    var raw = typeof text === 'string' ? text : String(text || '');
    var sep = sanitizeStackSeparator(state.settings && state.settings.stackSeparator);
    if (!sep) return [raw];

    return raw
      .split(sep)
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return part.length > 0; });
  }

  function resolveTheme(value) {
    if (themeApi && typeof themeApi.resolveThemeId === 'function') {
      return themeApi.resolveThemeId(value);
    }

    var raw = String(value || '').toLowerCase();
    if (raw === 'dark') return 'onyx';
    if (raw === 'parchment') return 'pearl';
    return raw || 'amethyst';
  }

  function fixedMuds() {
    return LOCKED_MUDS.map(function (m) {
      return {
        id: m.id,
        name: m.name,
        host: m.host,
        port: m.port,
        tls: !!m.tls,
      };
    });
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid() { return 'id-' + Math.random().toString(36).slice(2, 9); }
  function nowTime() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
  function clampInt(v, min, max, d) {
    var n = parseInt(v, 10);
    if (!Number.isFinite(n)) return d;
    return Math.max(min, Math.min(max, n));
  }
  function oneOf(v, vals, d) { return vals.indexOf(v) >= 0 ? v : d; }
})();
