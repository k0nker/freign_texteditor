(function () {
  'use strict';

  var STORAGE_KEY = 'freign.play2.settings.v1';
  var SITE_THEME_KEY = 'freign.site.theme.v1';
  var themeApi = window.FreignThemes || null;

  var LOCKED_MUDS = [
    { id: 'public', name: 'Public', host: '192.168.86.99', port: 25555, tls: false },
    { id: 'test',   name: 'Test',   host: '192.168.86.99', port: 25556, tls: false },
  ];

  var DEFAULT_16 = window.AnsiRenderer.buildDefaultPalette16();

  var DEFAULT_SETTINGS = {
    theme:          'amethyst',
    timestamps:     true,
    wrapLines:      true,
    stackSeparator: ';',
    bridgeUrl:      '',
    aliases:        [],
    triggers:       [],
    macros:         [],
    palette16:      {},
  };

  var state = {
    settings:       null,
    ws:             null,
    connected:      false,
    selectedMudId:  'public',
    ansiPalette:    null,
    lineCarry:      '',
    partialRow:     null,
    triggerGuard:   0,
    cmdHistory:     [],
    historyIdx:     -1,
    keepaliveTimer: null,
  };

  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  /* ── Init ──────────────────────────────────────────────────── */

  function init() {
    bindEls();
    bindUi();
    loadSettings();
    renderAll();
    appendSystem('Client ready — choose Public or Test to connect.');
  }

  function bindEls() {
    // Terminal area
    el.terminal      = document.getElementById('terminal');
    el.connStatus    = document.getElementById('conn-status');
    el.macroBar      = document.getElementById('macro-bar');
    el.cmdForm       = document.getElementById('cmd-form');
    el.cmdInput      = document.getElementById('cmd-input');
    el.cmdSend       = document.getElementById('cmd-send');

    // Header connect buttons
    el.btnPublic     = document.getElementById('btn-public');
    el.btnTest       = document.getElementById('btn-test');
    el.btnDisconnect = document.getElementById('btn-disconnect');

    // Sidebar connect panel
    el.spPublic      = document.getElementById('sp-public');
    el.spTest        = document.getElementById('sp-test');
    el.spDisconnect  = document.getElementById('sp-disconnect');

    // Config panel
    el.cfgTimestamps = document.getElementById('cfg-timestamps');
    el.cfgWrap       = document.getElementById('cfg-wrap');
    el.cfgStackSep   = document.getElementById('cfg-stack-sep');

    // Lists
    el.aliasList     = document.getElementById('alias-list');
    el.triggerList   = document.getElementById('trigger-list');
    el.macroList     = document.getElementById('macro-list');
    el.addAlias      = document.getElementById('add-alias');
    el.addTrigger    = document.getElementById('add-trigger');
    el.addMacro      = document.getElementById('add-macro');

    // Colors
    el.ansiColorGrid = document.getElementById('ansi-color-grid');

    // Settings I/O
    el.exportSettings = document.getElementById('export-settings');
    el.importSettings = document.getElementById('import-settings');
    el.resetSettings  = document.getElementById('reset-settings');
    el.importFile     = document.getElementById('import-file');
  }

  function bindUi() {
    // Tab switching
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateTab(btn.dataset.tab);
      });
    });

    // Command form
    el.cmdForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });

    // Keyboard history + force-send on Enter even when empty
    el.cmdInput.addEventListener('keydown', handleInputHistory);
    el.cmdInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });

    // Global macro hotkeys
    document.addEventListener('keydown', onGlobalKeydown);

    // Header buttons
    el.btnPublic.addEventListener('click', function () { connectMud('public'); });
    el.btnTest.addEventListener('click',   function () { connectMud('test');   });
    el.btnDisconnect.addEventListener('click', disconnect);

    // Sidebar connect buttons
    el.spPublic.addEventListener('click',     function () { connectMud('public'); });
    el.spTest.addEventListener('click',       function () { connectMud('test');   });
    el.spDisconnect.addEventListener('click', disconnect);

    // Config toggles
    el.cfgTimestamps.addEventListener('change', function () {
      state.settings.timestamps = !!el.cfgTimestamps.checked;
      saveSettings();
    });
    el.cfgWrap.addEventListener('change', function () {
      state.settings.wrapLines = !!el.cfgWrap.checked;
      el.terminal.classList.toggle('nowrap', !state.settings.wrapLines);
      saveSettings();
    });
    el.cfgStackSep.addEventListener('change', function () {
      state.settings.stackSeparator = sanitizeStackSep(el.cfgStackSep.value);
      el.cfgStackSep.value = state.settings.stackSeparator;
      saveSettings();
    });

    // Alias / trigger / macro add buttons
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

    // Settings import / export / reset
    el.exportSettings.addEventListener('click', exportSettings);
    el.importSettings.addEventListener('click', function () { el.importFile.click(); });
    el.resetSettings.addEventListener('click',  resetLocalSettings);
    el.importFile.addEventListener('change',    importSettingsFile);

    // React to site-wide theme changes dispatched by FreignThemes
    window.addEventListener('freign-theme-changed', function (evt) {
      if (!evt || !evt.detail) return;
      state.settings.theme = resolveTheme(evt.detail.themeId);
      saveSettings();
    });
  }

  /* ── Tab switching ─────────────────────────────────────────── */

  function activateTab(id) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    document.querySelectorAll('.tab-pane').forEach(function (p) {
      p.classList.toggle('active', p.id === 'pane-' + id);
    });
  }

  /* ── Settings persistence ──────────────────────────────────── */

  function loadSettings() {
    try {
      var raw    = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      state.settings = mergeSettings(DEFAULT_SETTINGS, parsed);
      var siteTheme  = themeApi ? themeApi.getThemeId() : localStorage.getItem(SITE_THEME_KEY);
      state.settings.theme = resolveTheme(siteTheme || state.settings.theme);
    } catch (_) {
      state.settings = clone(DEFAULT_SETTINGS);
    }
    rebuildPalette();
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function saveAndRefresh() {
    saveSettings();
    renderAll();
  }

  /* ── Render ────────────────────────────────────────────────── */

  function renderAll() {
    state.settings.theme = resolveTheme(state.settings.theme);
    if (themeApi) {
      themeApi.applyTheme(state.settings.theme, { persist: true });
    } else {
      document.body.setAttribute('data-theme', state.settings.theme || 'amethyst');
    }

    el.cfgTimestamps.checked = !!state.settings.timestamps;
    el.cfgWrap.checked       = !!state.settings.wrapLines;
    el.cfgStackSep.value     = sanitizeStackSep(state.settings.stackSeparator);

    el.terminal.classList.toggle('nowrap', !state.settings.wrapLines);

    renderAliases();
    renderTriggers();
    renderMacros();
    renderMacroBar();
    renderAnsiColors();
  }

  function renderAliases() {
    el.aliasList.innerHTML = '';
    state.settings.aliases.forEach(function (a, idx) {
      var card = makeItemCard('alias', !!a.enabled, idx, state.settings.aliases);

      card.appendChild(makeItemField('Pattern (regex)', 'text', a.pattern || '', function (v) {
        a.pattern = v; saveSettings();
      }));
      card.appendChild(makeItemField('Replacement', 'text', a.replacement || '', function (v) {
        a.replacement = v; saveSettings();
      }));

      el.aliasList.appendChild(card);
    });
  }

  function renderTriggers() {
    el.triggerList.innerHTML = '';
    state.settings.triggers.forEach(function (t, idx) {
      var card = makeItemCard('trigger', !!t.enabled, idx, state.settings.triggers);

      card.appendChild(makeItemField('Pattern (regex)', 'text', t.pattern || '', function (v) {
        t.pattern = v; saveSettings();
      }));
      card.appendChild(makeItemField('Flags', 'text', t.flags || '', function (v) {
        t.flags = v; saveSettings();
      }));

      var actionField = document.createElement('div');
      actionField.className = 'item-field';
      var actionLabel = document.createElement('label');
      actionLabel.textContent = 'Action';
      var actionSel = document.createElement('select');
      ['highlight', 'send', 'notify'].forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        actionSel.appendChild(o);
      });
      actionSel.value = t.action || 'highlight';
      actionSel.addEventListener('change', function () { t.action = actionSel.value; saveSettings(); });
      actionField.appendChild(actionLabel);
      actionField.appendChild(actionSel);
      card.appendChild(actionField);

      card.appendChild(makeItemField('Value', 'text', t.value || '', function (v) {
        t.value = v; saveSettings();
      }));

      el.triggerList.appendChild(card);
    });
  }

  function renderMacros() {
    el.macroList.innerHTML = '';
    state.settings.macros.forEach(function (m, idx) {
      var card = makeItemCard('macro', !!m.enabled, idx, state.settings.macros);

      card.appendChild(makeItemField('Label', 'text', m.label || '', function (v) {
        m.label = v; saveAndRefresh();
      }));
      card.appendChild(makeItemField('Command', 'text', m.command || '', function (v) {
        m.command = v; saveAndRefresh();
      }));
      card.appendChild(makeItemField('Hotkey (e.g. Alt+1)', 'text', m.hotkey || '', function (v) {
        m.hotkey = normalizeHotkey(v); saveAndRefresh();
      }));

      el.macroList.appendChild(card);
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
      btn.addEventListener('click', function () { sendCommand(m.command); });
      el.macroBar.appendChild(btn);
    });
  }

  function renderAnsiColors() {
    el.ansiColorGrid.innerHTML = '';
    for (var i = 0; i < 16; i++) {
      var cell = document.createElement('label');
      cell.className = 'color-cell';

      var num = document.createElement('span');
      num.textContent = String(i);

      var pick = document.createElement('input');
      pick.type = 'color';
      pick.value = state.settings.palette16[String(i)] || DEFAULT_16[i];
      (function (index, picker) {
        picker.addEventListener('input', function () {
          state.settings.palette16[String(index)] = picker.value;
          rebuildPalette();
          saveSettings();
        });
      })(i, pick);

      cell.appendChild(num);
      cell.appendChild(pick);
      el.ansiColorGrid.appendChild(cell);
    }
  }

  /* ── Item card builder ─────────────────────────────────────── */

  function makeItemCard(type, enabled, idx, list) {
    var card = document.createElement('div');
    card.className = 'item-card';

    var header = document.createElement('div');
    header.className = 'item-card-header';

    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = enabled;
    chk.addEventListener('change', function () {
      list[idx].enabled = !!chk.checked;
      saveAndRefresh();
    });

    var lbl = document.createElement('span');
    lbl.className = 'item-type-label';
    lbl.textContent = type + ' #' + (idx + 1);

    var rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'item-remove';
    rmBtn.title = 'Remove';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', function () {
      list.splice(idx, 1);
      saveAndRefresh();
    });

    header.appendChild(chk);
    header.appendChild(lbl);
    header.appendChild(rmBtn);
    card.appendChild(header);
    return card;
  }

  function makeItemField(labelText, inputType, value, onChange) {
    var wrapper = document.createElement('div');
    wrapper.className = 'item-field';

    var lbl = document.createElement('label');
    lbl.textContent = labelText;

    var inp = document.createElement('input');
    inp.type = inputType;
    inp.value = value;
    inp.placeholder = labelText;
    inp.addEventListener('change', function () { onChange(inp.value); });

    wrapper.appendChild(lbl);
    wrapper.appendChild(inp);
    return wrapper;
  }

  /* ── WebSocket / connection ────────────────────────────────── */

  function bridgeUrl() {
    if (state.settings.bridgeUrl) return state.settings.bridgeUrl;
    var scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return scheme + location.host + '/play/ws';
  }

  function connectMud(mudId) {
    var mud = LOCKED_MUDS.find(function (m) { return m.id === mudId; });
    if (!mud) { appendSystem('Unknown server profile.'); return; }

    disconnect();
    state.selectedMudId = mudId;

    setConnectionState('connecting');
    appendSystem('Connecting to ' + mud.name + ' (' + mud.host + ':' + mud.port + ')…');

    try {
      state.ws = new WebSocket(bridgeUrl());
    } catch (err) {
      appendSystem('WebSocket open failed.');
      setConnectionState('offline');
      return;
    }

    state.ws.addEventListener('open', function () {
      sendWs({ type: 'connect', host: mud.host, port: mud.port, tls: !!mud.tls });
      setConnectionState('online');
      startKeepalive();
    });

    state.ws.addEventListener('message', function (e) {
      handleBridgeMessage(e.data);
    });

    state.ws.addEventListener('close', function () {
      stopKeepalive();
      setConnectionState('offline');
      appendSystem('Bridge closed.');
      state.ws = null;
    });

    state.ws.addEventListener('error', function () {
      appendSystem('WebSocket error.');
    });
  }

  function disconnect() {
    stopKeepalive();
    if (!state.ws) return;
    try { sendWs({ type: 'disconnect' }); } catch (_) {}
    try { state.ws.close(); } catch (_) {}
    state.ws = null;
    setConnectionState('offline');
  }

  function setConnectionState(status) {
    state.connected = (status === 'online');
    var labels = { online: '● Online', offline: '● Offline', connecting: '◌ Connecting…' };
    el.connStatus.textContent  = labels[status] || '● Offline';
    el.connStatus.className    = status;
  }

  function sendWs(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify(payload));
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

  /* ── Bridge message handling ───────────────────────────────── */

  function handleBridgeMessage(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (_) { appendSystem('Invalid bridge payload.'); return; }

    if (msg.type === 'status')       { appendSystem(msg.message || 'status'); return; }
    if (msg.type === 'data')         { ingestMudText(msg.data || ''); return; }
    if (msg.type === 'pong')         { return; }
    if (msg.type === 'disconnected') { appendSystem('MUD disconnected.'); return; }
  }

  /* ── Text ingestion & ANSI rendering ───────────────────────── */

  function ingestMudText(chunk) {
    var text  = state.lineCarry + chunk;
    var lines = text.split(/\r?\n/);
    var trailing = lines.pop() || '';

    if (state.partialRow) {
      if (lines.length > 0) {
        var first = lines.shift();
        renderRowContent(state.partialRow, first, runTriggers(first));
        state.partialRow = null;
      } else {
        state.lineCarry = trailing;
        upsertPartialRow(state.lineCarry);
        return;
      }
    }

    lines.forEach(function (line) {
      appendAnsiLine(line, runTriggers(line));
    });

    state.lineCarry = trailing;
    if (state.lineCarry) upsertPartialRow(state.lineCarry);
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
      } catch (_) { /* ignore invalid user regex */ }
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

  function trimTerminal() {
    var max = 2000;
    while (el.terminal.childNodes.length > max) {
      el.terminal.removeChild(el.terminal.firstChild);
    }
  }

  function appendSystem(text) {
    appendAnsiLine('\x1b[1;36m[system]\x1b[0m ' + text, false);
  }

  function appendOutgoing(text) {
    appendAnsiLine('\x1b[1;35m>\x1b[0m ' + text, false);
  }

  /* ── Command sending ───────────────────────────────────────── */

  function submitInputCommand(raw) {
    var cmd = typeof raw === 'string' ? raw : String(raw || '');
    el.cmdInput.value = '';
    sendCommand(cmd);
  }

  function sendCommand(cmd, opts) {
    if (state.partialRow) {
      state.partialRow = null;
      state.lineCarry  = '';
    }

    opts = opts || {};
    var suppressEcho = !!opts.suppressEcho;
    var skipHistory  = !!opts.skipHistory;
    var skipAliases  = !!opts.skipAliases;

    var source = typeof cmd === 'string' ? cmd : String(cmd || '');
    var out    = skipAliases ? source : applyAliases(source);
    if (typeof out !== 'string') out = String(out || '');

    if (source.trim() === '' && out.trim() === '') {
      if (!suppressEcho) appendOutgoing('');
      sendWs({ type: 'input', data: '\n' });
      return;
    }

    var parts = splitStacked(out);
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
        if (re.test(result)) result = result.replace(re, a.replacement || '');
      } catch (_) { /* ignore invalid regex */ }
    });
    return result;
  }

  function splitStacked(text) {
    var raw = typeof text === 'string' ? text : String(text || '');
    var sep = sanitizeStackSep(state.settings && state.settings.stackSeparator);
    if (!sep) return [raw];
    return raw.split(sep).map(function (p) { return p.trim(); }).filter(Boolean);
  }

  /* ── Command history ───────────────────────────────────────── */

  function handleInputHistory(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!state.cmdHistory.length) return;
    e.preventDefault();

    if (e.key === 'ArrowUp') {
      if (state.historyIdx < 0) state.historyIdx = state.cmdHistory.length;
      state.historyIdx = Math.max(0, state.historyIdx - 1);
    } else {
      if (state.historyIdx < 0) return;
      state.historyIdx = Math.min(state.cmdHistory.length, state.historyIdx + 1);
      if (state.historyIdx === state.cmdHistory.length) { state.historyIdx = -1; el.cmdInput.value = ''; return; }
    }
    el.cmdInput.value = state.cmdHistory[state.historyIdx] || '';
  }

  function pushHistory(cmd) {
    var clean = String(cmd || '').trim();
    if (!clean) return;
    var last = state.cmdHistory[state.cmdHistory.length - 1];
    if (last === clean) { state.historyIdx = -1; return; }
    state.cmdHistory.push(clean);
    if (state.cmdHistory.length > 200) state.cmdHistory.shift();
    state.historyIdx = -1;
  }

  /* ── Global hotkeys ────────────────────────────────────────── */

  function onGlobalKeydown(e) {
    if (e.defaultPrevented) return;
    var active = document.activeElement;
    var typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (typing) return;
    var combo = eventToCombo(e);
    if (!combo) return;
    var hit = state.settings.macros.find(function (m) {
      return m.enabled && m.command && normalizeHotkey(m.hotkey) === combo;
    });
    if (!hit) return;
    e.preventDefault();
    sendCommand(hit.command);
  }

  function eventToCombo(e) {
    var key = String(e.key || '');
    if (!key) return '';
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return '';
    if (key.length === 1) key = key.toUpperCase();
    var parts = [];
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.altKey)   parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey)  parts.push('Meta');
    parts.push(key);
    return parts.join('+');
  }

  function normalizeHotkey(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var parts = raw.split('+').map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) return '';
    var flags = { ctrl: false, alt: false, shift: false, meta: false };
    var key = '';
    parts.forEach(function (p) {
      var n = p.toLowerCase();
      if (n === 'ctrl' || n === 'control')              flags.ctrl  = true;
      else if (n === 'alt' || n === 'option')           flags.alt   = true;
      else if (n === 'shift')                            flags.shift = true;
      else if (n === 'meta' || n === 'cmd' || n === 'command') flags.meta = true;
      else key = p;
    });
    if (!key) return '';
    if (key.length === 1) key = key.toUpperCase();
    var out = [];
    if (flags.ctrl)  out.push('Ctrl');
    if (flags.alt)   out.push('Alt');
    if (flags.shift) out.push('Shift');
    if (flags.meta)  out.push('Meta');
    out.push(key);
    return out.join('+');
  }

  /* ── Settings import / export / reset ─────────────────────── */

  function exportSettings() {
    var json = JSON.stringify(state.settings, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'freign-play2-settings.json';
    document.body.appendChild(a); a.click(); a.remove();
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

  function resetLocalSettings() {
    var ok = window.confirm('Reset all FREIGN Play 2 settings? This cannot be undone.');
    if (!ok) return;
    disconnect();
    clearSavedKeys();
    state.settings    = clone(DEFAULT_SETTINGS);
    state.cmdHistory  = [];
    state.historyIdx  = -1;
    state.lineCarry   = '';
    if (state.partialRow && state.partialRow.parentNode) {
      state.partialRow.parentNode.removeChild(state.partialRow);
    }
    state.partialRow  = null;
    rebuildPalette();
    saveAndRefresh();
    appendSystem('Settings reset to defaults.');
  }

  function clearSavedKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('freign.play2.') === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  }

  /* ── Settings merge / helpers ──────────────────────────────── */

  function mergeSettings(base, incoming) {
    var out = clone(base);
    incoming = incoming || {};

    out.theme          = resolveTheme(incoming.theme || base.theme);
    out.timestamps     = typeof incoming.timestamps === 'boolean' ? incoming.timestamps : base.timestamps;
    out.wrapLines      = typeof incoming.wrapLines   === 'boolean' ? incoming.wrapLines  : base.wrapLines;
    out.stackSeparator = sanitizeStackSep(incoming.stackSeparator);
    out.bridgeUrl      = typeof incoming.bridgeUrl   === 'string'  ? incoming.bridgeUrl  : base.bridgeUrl;

    out.aliases = Array.isArray(incoming.aliases)
      ? incoming.aliases.map(function (a) { return { enabled: a.enabled !== false, pattern: String(a.pattern || ''), replacement: String(a.replacement || '') }; })
      : [];

    out.triggers = Array.isArray(incoming.triggers)
      ? incoming.triggers.map(function (t) { return { enabled: t.enabled !== false, pattern: String(t.pattern || ''), flags: String(t.flags || ''), action: oneOf(t.action, ['highlight', 'send', 'notify'], 'highlight'), value: String(t.value || '') }; })
      : [];

    out.macros = Array.isArray(incoming.macros)
      ? incoming.macros.map(function (m) { return { enabled: m.enabled !== false, label: String(m.label || ''), command: String(m.command || ''), hotkey: normalizeHotkey(m.hotkey) }; })
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

  function rebuildPalette() {
    var p16 = [];
    for (var i = 0; i < 16; i++) {
      p16[i] = state.settings.palette16[String(i)] || DEFAULT_16[i];
    }
    state.ansiPalette = window.AnsiRenderer.buildXtermPalette(p16);
  }

  function resolveTheme(value) {
    if (themeApi && typeof themeApi.resolveThemeId === 'function') {
      return themeApi.resolveThemeId(value);
    }
    var raw = String(value || '').toLowerCase();
    if (raw === 'dark')      return 'onyx';
    if (raw === 'parchment') return 'pearl';
    return raw || 'amethyst';
  }

  function sanitizeStackSep(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return ';';
    return s.slice(0, 4);
  }

  function isHexColor(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  }

  function oneOf(v, vals, d) { return vals.indexOf(v) >= 0 ? v : d; }
  function clone(v)          { return JSON.parse(JSON.stringify(v)); }
  function nowTime()         { return new Date().toLocaleTimeString('en-US', { hour12: false }); }

})();
