/* ═══════════════════════════════════════════════════════════════
   FREIGN Play v2 — Client Application
   Forgotten Reign MUD Web Client

   Layout: left panel rail | center terminal | right settings rail
   GMCP-ready panel system — panels exist now, receive data when
   the server implements GMCP (Char.Vitals, Room.Info, etc.)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY  = 'freign.play2.settings.v1';
  var SITE_THEME_KEY = 'freign.site.theme.v1';
  var themeApi = window.FreignThemes || null;

  var LOCKED_MUDS = [
    { id: 'public', name: 'Public', host: '192.168.86.99', port: 25555, tls: false },
    { id: 'test',   name: 'Test',   host: '192.168.86.99', port: 25556, tls: false },
  ];

  var DEFAULT_16 = window.AnsiRenderer.buildDefaultPalette16();

  /* Default settings shape — extended with panel layout */
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
    /* Panel layout */
    openPanels:     ['map'],        /* which left-rail panels are open */
    gmcpPanels:     [],             /* user-defined GMCP panels */
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
    lastCmd:        '',
    activeDrawer:   null,
  };

  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  /* ═══════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════ */

  function init() {
    bindEls();
    bindUi();
    loadSettings();
    renderAll();
    appendSystem('Client ready \u2014 choose Public or Test to connect.');
  }

  function bindEls() {
    /* Terminal area */
    el.terminal      = document.getElementById('terminal');
    el.connStatus    = document.getElementById('conn-status');
    el.macroBar      = document.getElementById('macro-bar');
    el.cmdForm       = document.getElementById('cmd-form');
    el.cmdInput      = document.getElementById('cmd-input');
    el.cmdSend       = document.getElementById('cmd-send');
    el.btnRepeat     = document.getElementById('btn-repeat');

    /* Header connect buttons */
    el.btnPublic     = document.getElementById('btn-public');
    el.btnTest       = document.getElementById('btn-test');
    el.btnDisconnect = document.getElementById('btn-disconnect');

    /* Vitals strip */
    el.vitalsStrip   = document.getElementById('vitals-strip');
    el.vHp           = document.getElementById('v-hp-val');
    el.vMp           = document.getElementById('v-mp-val');
    el.vMv           = document.getElementById('v-mv-val');

    /* Left rail */
    el.leftPanels    = document.getElementById('left-panels');
    el.gmcpPanelBtns = document.getElementById('gmcp-panel-btns');
    el.gmcpPanels    = document.getElementById('gmcp-panels');

    /* Settings drawer */
    el.settingsDrawer = document.getElementById('settings-drawer');
    el.drawerTitle    = document.getElementById('drawer-title');
    el.drawerClose    = document.getElementById('drawer-close');
    el.drawerBody     = document.getElementById('drawer-body');

    /* Drawer connect panel */
    el.spPublic      = document.getElementById('sp-public');
    el.spTest        = document.getElementById('sp-test');
    el.spDisconnect  = document.getElementById('sp-disconnect');

    /* Config panel */
    el.cfgTimestamps = document.getElementById('cfg-timestamps');
    el.cfgWrap       = document.getElementById('cfg-wrap');
    el.cfgStackSep   = document.getElementById('cfg-stack-sep');
    el.gmcpPanelList = document.getElementById('gmcp-panel-list');
    el.addGmcpPanel  = document.getElementById('add-gmcp-panel');

    /* Item lists */
    el.aliasList     = document.getElementById('alias-list');
    el.triggerList   = document.getElementById('trigger-list');
    el.macroList     = document.getElementById('macro-list');
    el.addAlias      = document.getElementById('add-alias');
    el.addTrigger    = document.getElementById('add-trigger');
    el.addMacro      = document.getElementById('add-macro');

    /* Colors */
    el.ansiColorGrid = document.getElementById('ansi-color-grid');

    /* Settings I/O */
    el.exportSettings = document.getElementById('export-settings');
    el.importSettings = document.getElementById('import-settings');
    el.resetSettings  = document.getElementById('reset-settings');
    el.importFile     = document.getElementById('import-file');
  }

  function bindUi() {
    /* Command form */
    el.cmdForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });

    el.cmdInput.addEventListener('keydown', handleInputHistory);

    /* Repeat-last button */
    el.btnRepeat.addEventListener('click', function () {
      if (state.lastCmd) sendCommand(state.lastCmd);
    });

    /* Global macro hotkeys */
    document.addEventListener('keydown', onGlobalKeydown);

    /* Header buttons */
    el.btnPublic.addEventListener('click',     function () { connectMud('public'); });
    el.btnTest.addEventListener('click',       function () { connectMud('test'); });
    el.btnDisconnect.addEventListener('click', disconnect);

    /* Drawer connect buttons */
    el.spPublic.addEventListener('click',     function () { connectMud('public'); });
    el.spTest.addEventListener('click',       function () { connectMud('test'); });
    el.spDisconnect.addEventListener('click', disconnect);

    /* Right-rail icon buttons — toggle settings drawer */
    document.querySelectorAll('.rnav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var drawer = btn.dataset.drawer;
        toggleDrawer(drawer, btn);
      });
    });

    /* Drawer close */
    el.drawerClose.addEventListener('click', function () { closeDrawer(); });

    /* Close drawer on outside click */
    document.addEventListener('click', function (e) {
      if (!state.activeDrawer) return;
      if (el.settingsDrawer.contains(e.target)) return;
      if (e.target.closest('.rnav-btn')) return;
      closeDrawer();
    });

    /* Left-rail panel toggle buttons */
    document.querySelectorAll('.lnav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleLeftPanel(btn.dataset.panel);
      });
    });

    /* Left-panel close buttons */
    document.querySelectorAll('.lpanel-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeLeftPanel(btn.dataset.panel);
      });
    });

    /* Config toggles */
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

    /* Custom GMCP panel add button */
    el.addGmcpPanel.addEventListener('click', function () {
      state.settings.gmcpPanels.push({ id: uid(), name: 'Panel', gmcpPath: '', enabled: true });
      saveAndRefresh();
    });

    /* Alias / trigger / macro add buttons */
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

    /* Settings import / export / reset */
    el.exportSettings.addEventListener('click', exportSettings);
    el.importSettings.addEventListener('click', function () { el.importFile.click(); });
    el.resetSettings.addEventListener('click',  resetLocalSettings);
    el.importFile.addEventListener('change',    importSettingsFile);

    /* Theme changes from the site-wide theme picker */
    window.addEventListener('freign-theme-changed', function (evt) {
      if (!evt || !evt.detail) return;
      state.settings.theme = resolveTheme(evt.detail.themeId);
      saveSettings();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     DRAWER (right-rail settings panels)
     ═══════════════════════════════════════════════════════════════ */

  var DRAWER_TITLES = {
    connect:  'Connection',
    config:   'Configuration',
    aliases:  'Aliases',
    triggers: 'Triggers',
    macros:   'Macros',
    colors:   'ANSI Colors',
  };

  function toggleDrawer(id, triggerBtn) {
    if (state.activeDrawer === id) {
      closeDrawer();
      return;
    }
    openDrawer(id, triggerBtn);
  }

  function openDrawer(id, triggerBtn) {
    /* Activate the right nav button */
    document.querySelectorAll('.rnav-btn').forEach(function (b) {
      b.classList.toggle('active', b === triggerBtn);
    });

    /* Switch visible pane */
    document.querySelectorAll('.drawer-pane').forEach(function (p) {
      p.classList.toggle('active', p.id === 'dpane-' + id);
    });

    el.drawerTitle.textContent = DRAWER_TITLES[id] || id;
    el.settingsDrawer.hidden   = false;
    state.activeDrawer = id;
  }

  function closeDrawer() {
    el.settingsDrawer.hidden = true;
    document.querySelectorAll('.rnav-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    state.activeDrawer = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     LEFT PANELS
     ═══════════════════════════════════════════════════════════════ */

  function toggleLeftPanel(id) {
    var isOpen = state.settings.openPanels.indexOf(id) >= 0;
    if (isOpen) {
      closeLeftPanel(id);
    } else {
      openLeftPanel(id);
    }
  }

  function openLeftPanel(id) {
    if (state.settings.openPanels.indexOf(id) < 0) {
      state.settings.openPanels.push(id);
    }
    applyLeftPanelState();
    saveSettings();
  }

  function closeLeftPanel(id) {
    state.settings.openPanels = state.settings.openPanels.filter(function (p) { return p !== id; });
    applyLeftPanelState();
    saveSettings();
  }

  function applyLeftPanelState() {
    var open = state.settings.openPanels;

    /* Built-in panels */
    document.querySelectorAll('.lpanel').forEach(function (panel) {
      var id = panel.id.replace('lpanel-', '');
      panel.classList.toggle('active', open.indexOf(id) >= 0);
    });

    /* Left nav button active state */
    document.querySelectorAll('.lnav-btn').forEach(function (btn) {
      btn.classList.toggle('active', open.indexOf(btn.dataset.panel) >= 0);
    });

    /* Toggle has-active class for :has fallback */
    var anyOpen = open.length > 0;
    el.leftPanels.classList.toggle('has-active', anyOpen);
  }

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS PERSISTENCE
     ═══════════════════════════════════════════════════════════════ */

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

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

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

    applyLeftPanelState();
    renderGmcpPanels();
    renderAliases();
    renderTriggers();
    renderMacros();
    renderMacroBar();
    renderAnsiColors();
  }

  /* ── GMCP panels ─────────────────────────────────────────── */

  function renderGmcpPanels() {
    /* Render the config list in the drawer */
    el.gmcpPanelList.innerHTML = '';
    state.settings.gmcpPanels.forEach(function (panel, idx) {
      var card = makeItemCard('panel', !!panel.enabled, idx, state.settings.gmcpPanels);

      card.appendChild(makeItemField('Name', 'text', panel.name || '', function (v) {
        panel.name = v;
        saveAndRefresh();
      }));
      card.appendChild(makeItemField('GMCP Path', 'text', panel.gmcpPath || '', function (v) {
        panel.gmcpPath = v;
        saveSettings();
      }));

      el.gmcpPanelList.appendChild(card);
    });

    /* Rebuild the left-rail nav buttons and panel elements for custom panels */
    el.gmcpPanelBtns.innerHTML = '';
    el.gmcpPanels.innerHTML    = '';

    state.settings.gmcpPanels.forEach(function (panel) {
      if (!panel.enabled) return;
      var panelId = 'gmcp-' + panel.id;

      /* Nav button */
      var btn = document.createElement('button');
      btn.className       = 'lnav-btn';
      btn.dataset.panel   = panelId;
      btn.type            = 'button';
      btn.title           = panel.name;
      btn.innerHTML       = '<span class="lnav-icon" aria-hidden="true">◇</span>' +
                            '<span class="lnav-label">' + escHtml(panel.name) + '</span>';
      btn.addEventListener('click', function () { toggleLeftPanel(panelId); });
      el.gmcpPanelBtns.appendChild(btn);

      /* Panel element */
      var div = document.createElement('div');
      div.className = 'lpanel';
      div.id        = 'lpanel-' + panelId;

      var head = document.createElement('div');
      head.className = 'lpanel-head';
      head.innerHTML = '<span>' + escHtml(panel.name) + '</span>' +
                       '<button class="lpanel-close" type="button" title="Close">&#x2715;</button>';
      head.querySelector('.lpanel-close').addEventListener('click', function () {
        closeLeftPanel(panelId);
      });

      var body = document.createElement('div');
      body.className  = 'lpanel-body ph-centered';
      body.dataset.gmcpPanelId = panel.id;
      body.innerHTML  = '<div class="ph-icon" aria-hidden="true">&#9671;</div>' +
                        '<div class="ph-title">' + escHtml(panel.name) + '</div>' +
                        '<div class="ph-sub">Awaiting GMCP<br>' + escHtml(panel.gmcpPath || 'no path set') + '</div>';

      div.appendChild(head);
      div.appendChild(body);
      el.gmcpPanels.appendChild(div);
    });

    /* Re-apply open/close state so new panels honour saved setting */
    applyLeftPanelState();
  }

  /* ── Aliases ─────────────────────────────────────────────── */

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

  /* ── Triggers ────────────────────────────────────────────── */

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

      var row = document.createElement('div');
      row.className = 'item-card-row';
      var lbl = document.createElement('label');
      lbl.textContent = 'Action';
      var sel = document.createElement('select');
      ['highlight', 'send', 'notify'].forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        sel.appendChild(o);
      });
      sel.value = t.action || 'highlight';
      sel.addEventListener('change', function () { t.action = sel.value; saveSettings(); });
      row.appendChild(lbl);
      row.appendChild(sel);
      card.appendChild(row);

      card.appendChild(makeItemField('Value', 'text', t.value || '', function (v) {
        t.value = v; saveSettings();
      }));

      el.triggerList.appendChild(card);
    });
  }

  /* ── Macros ──────────────────────────────────────────────── */

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
      btn.type      = 'button';
      btn.className = 'macro-btn';
      btn.textContent = m.label || m.command;
      if (m.hotkey) btn.title = m.hotkey + ': ' + m.command;
      btn.addEventListener('click', function () { sendCommand(m.command); });
      el.macroBar.appendChild(btn);
    });
  }

  /* ── ANSI color grid ─────────────────────────────────────── */

  function renderAnsiColors() {
    el.ansiColorGrid.innerHTML = '';
    for (var i = 0; i < 16; i++) {
      var wrap = document.createElement('div');
      wrap.className = 'color-swatch-wrap';

      var pick = document.createElement('input');
      pick.type  = 'color';
      pick.value = state.settings.palette16[String(i)] || DEFAULT_16[i];
      pick.title = 'ANSI ' + i;
      (function (index, picker) {
        picker.addEventListener('input', function () {
          state.settings.palette16[String(index)] = picker.value;
          rebuildPalette();
          saveSettings();
        });
      })(i, pick);

      var lbl = document.createElement('div');
      lbl.className   = 'color-swatch-label';
      lbl.textContent = String(i);

      wrap.appendChild(pick);
      wrap.appendChild(lbl);
      el.ansiColorGrid.appendChild(wrap);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ITEM CARD BUILDER (shared by aliases / triggers / macros / gmcp)
     ═══════════════════════════════════════════════════════════════ */

  function makeItemCard(type, enabled, idx, list) {
    var card = document.createElement('div');
    card.className = 'item-card';

    var actions = document.createElement('div');
    actions.className = 'item-card-actions';

    var chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.checked = enabled;
    chk.title   = 'Enable';
    chk.addEventListener('change', function () {
      list[idx].enabled = !!chk.checked;
      saveAndRefresh();
    });

    var lbl = document.createElement('span');
    lbl.className   = 'item-label';
    lbl.textContent = type + ' #' + (idx + 1);

    var rmBtn = document.createElement('button');
    rmBtn.type      = 'button';
    rmBtn.className = 'del';
    rmBtn.title     = 'Delete';
    rmBtn.textContent = '\u2715';
    rmBtn.addEventListener('click', function () {
      list.splice(idx, 1);
      saveAndRefresh();
    });

    actions.appendChild(chk);
    actions.appendChild(lbl);
    actions.appendChild(rmBtn);
    card.appendChild(actions);
    return card;
  }

  function makeItemField(labelText, inputType, value, onChange) {
    var row = document.createElement('div');
    row.className = 'item-card-row';

    var lbl = document.createElement('label');
    lbl.textContent = labelText;

    var inp = document.createElement('input');
    inp.type        = inputType;
    inp.value       = value;
    inp.placeholder = labelText;
    inp.addEventListener('change', function () { onChange(inp.value); });

    row.appendChild(lbl);
    row.appendChild(inp);
    return row;
  }

  /* ═══════════════════════════════════════════════════════════════
     WEBSOCKET / CONNECTION
     ═══════════════════════════════════════════════════════════════ */

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
    appendSystem('Connecting to ' + mud.name + ' (' + mud.host + ':' + mud.port + ')\u2026');

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
    state.connected            = (status === 'online');
    var labels = { online: '\u25CF Online', offline: '\u25CF Offline', connecting: '\u25CC Connecting\u2026' };
    el.connStatus.textContent  = labels[status] || '\u25CF Offline';
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

  /* ═══════════════════════════════════════════════════════════════
     BRIDGE MESSAGE HANDLING
     ═══════════════════════════════════════════════════════════════ */

  function handleBridgeMessage(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (_) { appendSystem('Invalid bridge payload.'); return; }

    if (msg.type === 'status')       { appendSystem(msg.message || 'status'); return; }
    if (msg.type === 'data')         { ingestMudText(msg.data || ''); return; }
    if (msg.type === 'pong')         { return; }
    if (msg.type === 'disconnected') { appendSystem('MUD disconnected.'); return; }
    /* GMCP — planned: {type:'gmcp', package:'Char.Vitals', data:{hp,mp,mv}} */
    if (msg.type === 'gmcp')         { handleGmcp(msg.package, msg.data); return; }
  }

  /* ── GMCP dispatcher ─────────────────────────────────────── */

  function handleGmcp(pkg, data) {
    if (!pkg || !data) return;

    /* Char.Vitals — HP / mana / movement */
    if (pkg === 'Char.Vitals') {
      updateVitals(data);
      return;
    }

    /* Route to any matching user-defined GMCP panel */
    state.settings.gmcpPanels.forEach(function (panel) {
      if (!panel.enabled || panel.gmcpPath !== pkg) return;
      var body = el.gmcpPanels.querySelector('[data-gmcp-panel-id="' + panel.id + '"]');
      if (!body) return;
      /* Simple JSON display; replace with richer rendering as needed */
      body.className  = 'lpanel-body';
      body.textContent = JSON.stringify(data, null, 2);
    });
  }

  function updateVitals(data) {
    if (data.hp !== undefined) el.vHp.textContent = String(data.hp);
    if (data.mp !== undefined) el.vMp.textContent = String(data.mp);
    if (data.mv !== undefined) el.vMv.textContent = String(data.mv);
    el.vitalsStrip.hidden = false;
  }

  /* ═══════════════════════════════════════════════════════════════
     TEXT INGESTION & ANSI RENDERING
     ═══════════════════════════════════════════════════════════════ */

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
      ts.className   = 'ts';
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

  /* ═══════════════════════════════════════════════════════════════
     COMMAND SENDING
     ═══════════════════════════════════════════════════════════════ */

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

    if (!skipHistory) {
      pushHistory(source);
      state.lastCmd = source;
    }

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

  /* ═══════════════════════════════════════════════════════════════
     COMMAND HISTORY
     ═══════════════════════════════════════════════════════════════ */

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
      if (state.historyIdx === state.cmdHistory.length) {
        state.historyIdx    = -1;
        el.cmdInput.value   = '';
        return;
      }
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

  /* ═══════════════════════════════════════════════════════════════
     GLOBAL HOTKEYS
     ═══════════════════════════════════════════════════════════════ */

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
      if (n === 'ctrl' || n === 'control')                    flags.ctrl  = true;
      else if (n === 'alt' || n === 'option')                 flags.alt   = true;
      else if (n === 'shift')                                  flags.shift = true;
      else if (n === 'meta' || n === 'cmd' || n === 'command') flags.meta  = true;
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

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS IMPORT / EXPORT / RESET
     ═══════════════════════════════════════════════════════════════ */

  function exportSettings() {
    var json = JSON.stringify(state.settings, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'freign-play2-settings.json';
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
    state.settings   = clone(DEFAULT_SETTINGS);
    state.cmdHistory = [];
    state.historyIdx = -1;
    state.lineCarry  = '';
    state.lastCmd    = '';
    if (state.partialRow && state.partialRow.parentNode) {
      state.partialRow.parentNode.removeChild(state.partialRow);
    }
    state.partialRow = null;
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

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS MERGE & HELPERS
     ═══════════════════════════════════════════════════════════════ */

  function mergeSettings(base, incoming) {
    var out = clone(base);
    incoming = incoming || {};

    out.theme          = resolveTheme(incoming.theme || base.theme);
    out.timestamps     = typeof incoming.timestamps === 'boolean' ? incoming.timestamps : base.timestamps;
    out.wrapLines      = typeof incoming.wrapLines   === 'boolean' ? incoming.wrapLines  : base.wrapLines;
    out.stackSeparator = sanitizeStackSep(incoming.stackSeparator);
    out.bridgeUrl      = typeof incoming.bridgeUrl   === 'string'  ? incoming.bridgeUrl  : base.bridgeUrl;

    out.openPanels = Array.isArray(incoming.openPanels) ? incoming.openPanels : clone(base.openPanels);

    out.aliases = Array.isArray(incoming.aliases)
      ? incoming.aliases.map(function (a) {
          return { enabled: a.enabled !== false, pattern: String(a.pattern || ''), replacement: String(a.replacement || '') };
        })
      : [];

    out.triggers = Array.isArray(incoming.triggers)
      ? incoming.triggers.map(function (t) {
          return {
            enabled: t.enabled !== false,
            pattern: String(t.pattern || ''),
            flags:   String(t.flags   || ''),
            action:  oneOf(t.action, ['highlight', 'send', 'notify'], 'highlight'),
            value:   String(t.value   || ''),
          };
        })
      : [];

    out.macros = Array.isArray(incoming.macros)
      ? incoming.macros.map(function (m) {
          return { enabled: m.enabled !== false, label: String(m.label || ''), command: String(m.command || ''), hotkey: normalizeHotkey(m.hotkey) };
        })
      : [];

    out.gmcpPanels = Array.isArray(incoming.gmcpPanels)
      ? incoming.gmcpPanels.map(function (p) {
          return { id: p.id || uid(), name: String(p.name || 'Panel'), gmcpPath: String(p.gmcpPath || ''), enabled: p.enabled !== false };
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
    return s ? s.slice(0, 4) : ';';
  }

  function isHexColor(v)  { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
  function oneOf(v, vals, d) { return vals.indexOf(v) >= 0 ? v : d; }
  function clone(v)          { return JSON.parse(JSON.stringify(v)); }
  function nowTime()         { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
  function uid()             { return Math.random().toString(36).slice(2, 10); }
  function escHtml(s)        {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
