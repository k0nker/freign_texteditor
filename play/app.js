/* ═══════════════════════════════════════════════════════════════
   FREIGN Play v2 — Client Application
   Forgotten Reign MUD Web Client
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY    = 'freign.play2.settings.v1';
  var SCROLLBACK_KEY = 'freign.play2.scrollback';
  var SITE_THEME_KEY = 'freign.site.theme.v1';
  var themeApi = window.FreignThemes || null;

  var LOCKED_MUDS = [
    { id: 'public', name: 'Public', host: '192.168.86.99', port: 25555, tls: false },
    { id: 'test',   name: 'Test',   host: '192.168.86.99', port: 25556, tls: false },
  ];

  var BUILTIN_PANELS = [
    { id: 'map',      name: 'Map',      icon: '\u229e' },
    { id: 'channels', name: 'Channels', icon: '\u22cb' },
    { id: 'party',    name: 'Party',    icon: '\u203f' },
    { id: 'status',   name: 'Status',   icon: '\u25c9' },
    { id: 'targets',  name: 'Targets',  icon: '\u25ce' },
    { id: 'inventory',name: 'Inventory',icon: '\u25a4' },
    { id: 'equipment',name: 'Equipment',icon: '\u2694' },
  ];

  var FONTS = [
    'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Roboto Mono',
    'Inconsolata', 'Space Mono', 'IBM Plex Mono', 'Noto Sans Mono',
    'PT Mono', 'Share Tech Mono', 'Azeret Mono', 'Courier Prime',
  ];

  var DEFAULT_16 = window.AnsiRenderer.buildDefaultPalette16();

  var ANSI_COLOR_NAMES = [
    'Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'Lt.Gray',
    'Dk.Gray', 'Br.Red', 'Br.Green', 'Br.Yellow', 'Br.Blue', 'Br.Magenta', 'Br.Cyan', 'White',
  ];

  var DEFAULT_SETTINGS = {
    theme:          'amethyst',
    font:           'JetBrains Mono',
    layoutStyle:    'rounded',
    timestamps:     true,
    wrapLines:      true,
    particlesEnabled: true,
    stackSeparator: ';',
    bridgeUrl:      '',
    aliases:        [],
    triggers:       [],
    macros:         [],
    palette16:      {},
    openPanels:     ['map', 'channels', 'status', 'targets'],
    panelSides:     {
      map: 'left', channels: 'left', party: 'left',
      status: 'right', targets: 'right', inventory: 'right', equipment: 'right',
    },
    panelTabGroup:  { map: '', channels: '', party: '', status: '', targets: '', inventory: '', equipment: '' },
    panelTabActive: {},
    panelWidths:    { left: 230, right: 230 },
    keepInput:      true,
    gmcpPanels:     [],
    wrapWidth:      120,
    historyMax:     2500,
    consoleWidth:   1080,
    panelOrder:     ['map', 'channels', 'party', 'status', 'targets', 'inventory', 'equipment'],
    tsSelectable:   true,
    logTimestamps:  true,
    affectsView:    'details',
  };

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function ensureDefaultPanelLayout(settings) {
    if (!settings) return settings;
    if (!settings.panelSides || typeof settings.panelSides !== 'object') {
      settings.panelSides = {};
    }
    if (!settings.openPanels || !Array.isArray(settings.openPanels)) {
      settings.openPanels = [];
    }
    var legacyDefaultPanels = ['map', 'party', 'status', 'targets'];
    var nextDefaultPanels = ['map', 'channels', 'status', 'targets'];
    var sameAsLegacy = settings.openPanels.length === legacyDefaultPanels.length && legacyDefaultPanels.every(function (panelId) {
      return settings.openPanels.indexOf(panelId) >= 0;
    });
    if (sameAsLegacy || (settings.openPanels.indexOf('channels') < 0 && settings.openPanels.indexOf('party') >= 0)) {
      settings.openPanels = nextDefaultPanels.slice();
    }
    if (!settings.panelSides.map) settings.panelSides.map = 'left';
    if (!settings.panelSides.channels) settings.panelSides.channels = 'left';
    settings.panelSides.party = settings.panelSides.party || 'left';
    if (!settings.panelSides.status) settings.panelSides.status = 'right';
    if (!settings.panelSides.targets) settings.panelSides.targets = 'right';
    settings.panelSides.inventory = settings.panelSides.inventory || 'right';
    settings.panelSides.equipment = settings.panelSides.equipment || 'right';
    if (settings.openPanels.length === 0) {
      settings.openPanels = nextDefaultPanels.slice();
    }
    return settings;
  }

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
    scrollback:          [],   /* raw {line,highlighted,time} for session persistence */
    userDisconnected:    false,
    reconnectAttempts:   0,
    reconnectTimer:      null,
    wsGeneration:        0,
    activeWsGeneration:  0,
    affectDurationCeilings: {},
    audioCtx: null,
    lastDamageToneAt: 0,
    combatStaleTimer: null,
    atmosphereFx: {
      canvas: null,
      ctx: null,
      rafId: 0,
      running: false,
      motes: [],
      lastTs: 0,
      spawnBudget: 0,
      dpr: 1,
      reduceMotionQuery: null,
      reduceMotionListener: null,
      visibilityListenerAttached: false,
    },
    floatingTooltip: {
      visible: false,
      anchorRect: null,
    },
    gmcp: {
      vitals: null,
      roomInfo: null,
      mapRender: '',
      mapRenderMeta: null,
      mapRenderSeq: 0,
      mapCenteredSeq: 0,
      mapRenderedAnsi: '',
      mapRenderedMetaHtml: '',
      mapRenderedMarkerKey: '',
      mapCenterSeq: 0,
      worldTime: null,
      worldWeather: null,
      worldMoons: null,
      channels: [],
      groupInfo: null,
      charStatus: null,
      charStats: null,
      charWorth: null,
      charAffects: null,
      charCombat: null,
      inventory: [],
      equipment: [],
      channelTab: 'all',
    },
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
    initAtmosphereMotes();
    initResizeHandles();
    loadScrollback();
    appendSystem('Client ready \u2014 choose a server to connect.');
  }

  function bindEls() {
    el.workspace      = document.getElementById('workspace');
    el.terminal       = document.getElementById('terminal');
    el.btnTerminalBottom = document.getElementById('btn-terminal-bottom');
    el.connStatus     = document.getElementById('conn-status');
    el.macroBar       = document.getElementById('macro-bar');
    el.cmdForm        = document.getElementById('cmd-form');
    el.cmdInput       = document.getElementById('cmd-input');
    el.cmdSend        = document.getElementById('cmd-send');
    el.btnLanguage    = document.getElementById('btn-language');
    el.btnRepeat      = document.getElementById('btn-repeat');
    el.languagePicker = document.getElementById('language-picker');
    el.languagePickerList = document.getElementById('language-picker-list');
    el.btnDisconnect  = document.getElementById('btn-disconnect');
    el.btnConnectPublic = document.getElementById('btn-connect-public');
    el.btnConnectTest = document.getElementById('btn-connect-test');

    el.vitalsStrip    = document.getElementById('vitals-strip');
    el.vHp            = document.getElementById('v-hp-val');
    el.vMp            = document.getElementById('v-mp-val');
    el.vMv            = document.getElementById('v-mv-val');
    el.vPos           = document.getElementById('v-position');
    el.vHpSegs        = document.querySelectorAll('#v-hp-gauge .status-bar-fill');
    el.vMpSegs        = document.querySelectorAll('#v-mp-gauge .status-bar-fill');
    el.vMvSegs        = document.querySelectorAll('#v-mv-gauge .status-bar-fill');
    el.vWimpy         = document.getElementById('v-wimpy');

    el.mapPanelBody   = document.getElementById('map-panel-body');
    el.channelsPane   = document.getElementById('channels-pane');
    el.channelsTabs   = document.getElementById('channels-tabs');
    el.channelsLog    = document.getElementById('channels-log');
    el.partyList      = document.getElementById('party-list');
    el.statusPanelBody = document.getElementById('status-panel-body');
    el.targetsPanelBody = document.getElementById('targets-panel-body');
    el.inventoryPanelBody = document.getElementById('inventory-panel-body');
    el.equipmentPanelBody = document.getElementById('equipment-panel-body');

    el.pkgMap        = document.getElementById('pkg-map');
    el.pkgChannels   = document.getElementById('pkg-channels');
    el.pkgParty      = document.getElementById('pkg-party');
    el.pkgStatus     = document.getElementById('pkg-status');
    el.pkgTargets    = document.getElementById('pkg-targets');
    el.pkgInventory  = document.getElementById('pkg-inventory');
    el.pkgEquipment  = document.getElementById('pkg-equipment');

    el.leftNav        = document.getElementById('left-nav');
    el.leftPanels     = document.getElementById('left-panels');
    el.leftPanelBtns  = document.getElementById('left-panel-btns');
    el.leftGmcpPanels = document.getElementById('left-gmcp-panels');

    el.rightPanels    = document.getElementById('right-panels');
    el.rightPanelBtns = document.getElementById('right-panel-btns');
    el.rightGmcpPanels= document.getElementById('right-gmcp-panels');
    el.rightPanelsRail= document.getElementById('right-panels-rail');

    el.settingsDrawer = document.getElementById('settings-drawer');
    el.drawerTitle    = document.getElementById('drawer-title');
    el.drawerClose    = document.getElementById('drawer-close');
    el.drawerBody     = document.getElementById('drawer-body');

    el.spPublic       = document.getElementById('sp-public');
    el.spTest         = document.getElementById('sp-test');
    el.spDisconnect   = document.getElementById('sp-disconnect');

    el.cfgFont        = document.getElementById('cfg-font');
    el.cfgLayout      = document.getElementById('cfg-layout');
    el.cfgKeepInput   = document.getElementById('cfg-keep-input');
    el.resizeLeft     = document.getElementById('resize-left');
    el.resizeRight    = document.getElementById('resize-right');
    el.cfgTimestamps  = document.getElementById('cfg-timestamps');
    el.cfgWrap        = document.getElementById('cfg-wrap');
    el.cfgParticles   = document.getElementById('cfg-particles');
    el.cfgWrapWidth   = document.getElementById('cfg-wrap-width');
    el.cfgHistoryMax  = document.getElementById('cfg-history-max');
    el.cfgClearHistory= document.getElementById('cfg-clear-history');
    el.cfgConsoleWidth = document.getElementById('cfg-console-width');
    el.cfgStackSep    = document.getElementById('cfg-stack-sep');
    el.builtinPanelCfg= document.getElementById('builtin-panel-cfg');
    el.gmcpPanelList  = document.getElementById('gmcp-panel-list');
    el.addGmcpPanel   = document.getElementById('add-gmcp-panel');

    el.aliasList      = document.getElementById('alias-list');
    el.triggerList    = document.getElementById('trigger-list');
    el.macroList      = document.getElementById('macro-list');
    el.addAlias       = document.getElementById('add-alias');
    el.addTrigger     = document.getElementById('add-trigger');
    el.addMacro       = document.getElementById('add-macro');

    el.exportSettings = document.getElementById('export-settings');
    el.importSettings = document.getElementById('import-settings');
    el.resetSettings  = document.getElementById('reset-settings');
    el.importFile      = document.getElementById('import-file');
    el.exportSettingsConfig = document.getElementById('export-settings-config');
    el.importSettingsConfig = document.getElementById('import-settings-config');
    el.resetSettingsConfig  = document.getElementById('reset-settings-config');
    el.importFileConfig     = document.getElementById('import-file-config');

    el.ansiPaletteCfg   = document.getElementById('ansi-palette-cfg');
    el.cfgTsSelectable  = document.getElementById('cfg-ts-selectable');
    el.btnSaveLog        = document.getElementById('btn-save-log');
    el.logSavePopup      = document.getElementById('log-save-popup');
    el.logPopupTs        = document.getElementById('log-popup-timestamps');
    el.logPopupSave      = document.getElementById('log-popup-save');
    el.logPopupClose     = document.getElementById('log-popup-close');
    el.floatingTooltip   = null;
  }

  function bindUi() {
    el.cmdForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitInputCommand(el.cmdInput.value);
    });

    el.cmdInput.addEventListener('keydown', handleInputHistory);

    el.btnRepeat.addEventListener('click', function () {
      if (state.lastCmd) sendCommand(state.lastCmd);
    });

    if (el.btnTerminalBottom) {
      el.btnTerminalBottom.addEventListener('click', function () {
        scrollTerminalToBottom();
      });
    }

    if (el.terminal) {
      el.terminal.addEventListener('scroll', updateTerminalBottomButton);
    }

    window.addEventListener('resize', updateTerminalBottomButton);

    if (el.btnLanguage) {
      el.btnLanguage.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleLanguagePicker();
      });
    }

    if (el.languagePickerList) {
      el.languagePickerList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-language-id]');
        if (!btn) return;
        var languageId = String(btn.dataset.languageId || '').trim();
        if (!languageId) return;
        var escaped = languageId.replace(/'/g, "\\'");
        sendCommand("language set '" + escaped + "'", { skipHistory: true });
        closeLanguagePicker();
        if (el.cmdInput) el.cmdInput.focus();
      });
    }

    el.btnDisconnect.addEventListener('click', disconnect);
    el.spPublic.addEventListener('click',      function () { connectMud('public'); });
    el.spTest.addEventListener('click',        function () { connectMud('test'); });
    el.spDisconnect.addEventListener('click',  disconnect);
    if (el.btnConnectPublic) el.btnConnectPublic.addEventListener('click', function () { connectMud('public'); });
    if (el.btnConnectTest) el.btnConnectTest.addEventListener('click', function () { connectMud('test'); });

    /* Right settings-rail: icon buttons for drawers (only those with data-drawer) */
    document.querySelectorAll('.rnav-btn[data-drawer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleDrawer(btn.dataset.drawer, btn);
      });
    });

    /* Save Log button — opens popup, not a drawer */
    el.btnSaveLog.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !el.logSavePopup.hidden;
      el.logSavePopup.hidden = open;
      if (!open) {
        el.logPopupTs.checked = state.settings.logTimestamps !== false;
      }
    });
    el.logPopupClose.addEventListener('click', function () {
      el.logSavePopup.hidden = true;
    });
    el.logPopupSave.addEventListener('click', function () {
      state.settings.logTimestamps = !!el.logPopupTs.checked;
      saveSettings();
      exportLog(el.logPopupTs.checked);
      el.logSavePopup.hidden = true;
    });
    document.addEventListener('click', function (e) {
      if (!el.logSavePopup.hidden &&
          !el.logSavePopup.contains(e.target) &&
          e.target !== el.btnSaveLog &&
          !el.btnSaveLog.contains(e.target)) {
        el.logSavePopup.hidden = true;
      }
    });

    if (el.channelsTabs) {
      el.channelsTabs.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-channel-tab]');
        if (!btn) return;
        setChannelTab(btn.dataset.channelTab || 'all');
      });
    }

    if (el.statusPanelBody) {
      el.statusPanelBody.addEventListener('click', function (e) {
        var toggleBtn = e.target.closest('[data-affects-view]');
        if (!toggleBtn) return;
        var view = toggleBtn.dataset.affectsView === 'icons' ? 'icons' : 'details';
        state.settings.affectsView = view;
        saveSettings();
        renderStatusPanel();
      });

      el.statusPanelBody.addEventListener('mouseover', function (e) {
        var tipTarget = e.target.closest('[data-tooltip]');
        if (!tipTarget) return;
        var icon = tipTarget.closest('.status-affect-icon');
        if (!icon) return;
        var text = String(tipTarget.dataset.tooltip || icon.dataset.tooltip || '').trim();
        if (!text) return;
        showFloatingTooltip(icon, text);
      });

      el.statusPanelBody.addEventListener('mousemove', function (e) {
        if (!state.floatingTooltip.visible) return;
        var icon = e.target.closest('.status-affect-icon');
        if (!icon) return;
        positionFloatingTooltip(icon);
      });

      el.statusPanelBody.addEventListener('mouseout', function (e) {
        if (!state.floatingTooltip.visible) return;
        var fromIcon = e.target.closest('.status-affect-icon');
        if (!fromIcon) return;
        var to = e.relatedTarget;
        if (to && to.closest && to.closest('.status-affect-icon') === fromIcon) return;
        hideFloatingTooltip();
      });
    }

    el.drawerClose.addEventListener('click', closeDrawer);

    document.addEventListener('click', function (e) {
      if (!state.activeDrawer) return;
      if (el.settingsDrawer.contains(e.target)) return;
      if (e.target.closest('.rnav-btn')) return;
      closeDrawer();
    });

    document.addEventListener('click', function (e) {
      if (!el.languagePicker || el.languagePicker.hidden) return;
      if (el.languagePicker.contains(e.target)) return;
      if (el.btnLanguage && el.btnLanguage.contains(e.target)) return;
      closeLanguagePicker();
    });

    /* Built-in panel nav buttons (initial binding; moved by applyPanelState later) */
    document.querySelectorAll('.panel-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        togglePanel(btn.dataset.panel);
      });
    });

    /* Built-in panel close buttons */
    document.querySelectorAll('.panel-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closePanel(btn.dataset.panel);
      });
    });

    /* Config: font */
    el.cfgFont.addEventListener('change', function () {
      state.settings.font = el.cfgFont.value;
      applyFont();
      saveSettings();
    });

    /* Config: layout style */
    el.cfgLayout.addEventListener('change', function () {
      state.settings.layoutStyle = el.cfgLayout.value;
      applyLayout();
      saveSettings();
    });

    /* Config: keep input */
    el.cfgKeepInput.addEventListener('change', function () {
      state.settings.keepInput = !!el.cfgKeepInput.checked;
      saveSettings();
    });

    /* Config: display toggles */
    el.cfgTimestamps.addEventListener('change', function () {
      state.settings.timestamps = !!el.cfgTimestamps.checked;
      saveSettings();
    });
    el.cfgWrap.addEventListener('change', function () {
      state.settings.wrapLines = !!el.cfgWrap.checked;
      el.terminal.classList.toggle('nowrap', !state.settings.wrapLines);
      applyWrapWidth();
      saveSettings();
    });
    el.cfgParticles.addEventListener('change', function () {
      state.settings.particlesEnabled = !!el.cfgParticles.checked;
      updateAtmosphereFxState();
      saveSettings();
    });
    el.cfgWrapWidth.addEventListener('change', function () {
      state.settings.wrapWidth = Math.max(0, parseInt(el.cfgWrapWidth.value, 10) || 0);
      el.cfgWrapWidth.value = state.settings.wrapWidth;
      applyWrapWidth();
      saveSettings();
    });
    el.cfgHistoryMax.addEventListener('change', function () {
      state.settings.historyMax = Math.max(0, parseInt(el.cfgHistoryMax.value, 10) || 0);
      el.cfgHistoryMax.value = state.settings.historyMax;
      trimTerminal();
      saveSettings();
    });
    el.cfgClearHistory.addEventListener('click', function () {
      el.terminal.innerHTML = '';
      state.scrollback = [];
      localStorage.removeItem(SCROLLBACK_KEY);
    });
    el.cfgConsoleWidth.addEventListener('change', function () {
      state.settings.consoleWidth = Math.max(320, Math.min(1920, parseInt(el.cfgConsoleWidth.value, 10) || 1000));
      el.cfgConsoleWidth.value = state.settings.consoleWidth;
      applyLayout();
      saveSettings();
    });
    el.cfgStackSep.addEventListener('change', function () {
      state.settings.stackSeparator = sanitizeStackSep(el.cfgStackSep.value);
      el.cfgStackSep.value = state.settings.stackSeparator;
      saveSettings();
    });

    el.addGmcpPanel.addEventListener('click', function () {
      state.settings.gmcpPanels.push({ id: uid(), name: 'Panel', gmcpPath: '', enabled: true, side: 'left' });
      saveAndRefresh();
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
      state.settings.macros.push({ enabled: true, label: '', command: '' });
      saveAndRefresh();
    });

    bindSettingsFileControls(
      el.exportSettings,
      el.importSettings,
      el.resetSettings,
      el.importFile
    );
    bindSettingsFileControls(
      el.exportSettingsConfig,
      el.importSettingsConfig,
      el.resetSettingsConfig,
      el.importFileConfig
    );

    el.cfgTsSelectable.addEventListener('change', function () {
      state.settings.tsSelectable = !!el.cfgTsSelectable.checked;
      applyTsSelectable();
      saveSettings();
    });

    window.addEventListener('freign-theme-changed', function (evt) {
      if (!evt || !evt.detail) return;
      state.settings.theme = resolveTheme(evt.detail.themeId);
      saveSettings();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS DRAWER (right-settings-rail)
     ═══════════════════════════════════════════════════════════════ */

  var DRAWER_TITLES = {
    connect: 'Connection', config: 'Configuration',
    aliases: 'Aliases',    triggers: 'Triggers',
    macros:  'Macros',     colors:  'ANSI Colors',
    panels:  'Panels',
  };

  function toggleDrawer(id, triggerBtn) {
    if (state.activeDrawer === id) { closeDrawer(); return; }
    openDrawer(id, triggerBtn);
  }

  function openDrawer(id, triggerBtn) {
    document.querySelectorAll('.rnav-btn').forEach(function (b) {
      b.classList.toggle('active', b === triggerBtn);
    });
    document.querySelectorAll('.drawer-pane').forEach(function (p) {
      p.classList.toggle('active', p.id === 'dpane-' + id);
    });
    el.drawerTitle.textContent = DRAWER_TITLES[id] || id;
    el.settingsDrawer.hidden   = false;
    state.activeDrawer = id;
  }

  function closeDrawer() {
    el.settingsDrawer.hidden = true;
    document.querySelectorAll('.rnav-btn').forEach(function (b) { b.classList.remove('active'); });
    state.activeDrawer = null;
  }

  function bindSettingsFileControls(exportBtn, importBtn, resetBtn, importInput) {
    if (exportBtn) exportBtn.addEventListener('click', exportSettings);
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
    }
    if (resetBtn) resetBtn.addEventListener('click', resetLocalSettings);
    if (importInput) importInput.addEventListener('change', importSettingsFile);
  }

  /* ═══════════════════════════════════════════════════════════════
     PANELS — open / close / side assignment
     ═══════════════════════════════════════════════════════════════ */

  function togglePanel(id) {
    var isOpen = state.settings.openPanels.indexOf(id) >= 0;
    if (isOpen) closePanel(id); else openPanel(id);
  }

  function openPanel(id) {
    if (state.settings.openPanels.indexOf(id) < 0) state.settings.openPanels.push(id);
    applyPanelState();
    saveSettings();
  }

  function closePanel(id) {
    state.settings.openPanels = state.settings.openPanels.filter(function (p) { return p !== id; });
    applyPanelState();
    saveSettings();
  }

  /* applyPanelState — moves panel elements AND nav buttons to the correct rail */
  function applyPanelState() {
    var open  = state.settings.openPanels;
    var sides = state.settings.panelSides;

    /* ── Built-in panels ─────────────────────────────────── */
    BUILTIN_PANELS.forEach(function (bp) {
      var panelEl = document.getElementById('panel-' + bp.id);
      var btnEl   = document.querySelector('.panel-nav-btn[data-panel="' + bp.id + '"]');
      var side    = sides[bp.id] || 'left';
      var isOpen  = open.indexOf(bp.id) >= 0;

      /* Move panel element to correct container */
      var targetContainer = (side === 'right') ? el.rightPanels : el.leftPanels;
      if (panelEl && panelEl.parentNode !== targetContainer) {
        targetContainer.appendChild(panelEl);
      }

      /* Move nav button to correct nav */
      if (btnEl) {
        if (side === 'right') {
          if (btnEl.parentNode !== el.rightPanelBtns) el.rightPanelBtns.appendChild(btnEl);
        } else {
          /* Back to left-nav, before the left-panel-btns div */
          if (btnEl.parentNode !== el.leftNav) {
            el.leftNav.insertBefore(btnEl, el.leftPanelBtns);
          }
        }
      }

      if (panelEl) panelEl.classList.toggle('active', isOpen);
      if (btnEl)   btnEl.classList.toggle('active', isOpen);
    });

    /* ── Reorder builtin panels and nav buttons by panelOrder ──────────────── */
    var panelOrder = state.settings.panelOrder || BUILTIN_PANELS.map(function (bp) { return bp.id; });
    panelOrder.forEach(function (pid) {
      var pEl  = document.getElementById('panel-' + pid);
      var bEl  = document.querySelector('.panel-nav-btn[data-panel="' + pid + '"]');
      if (pEl && pEl.parentNode)  pEl.parentNode.appendChild(pEl);
      if (bEl && bEl.parentNode) {
        if (bEl.parentNode === el.leftNav) {
          el.leftNav.insertBefore(bEl, el.leftPanelBtns);
        } else {
          bEl.parentNode.appendChild(bEl);
        }
      }
    });
    /* Keep GMCP panel containers after builtin panels */
    if (el.leftGmcpPanels  && el.leftGmcpPanels.parentNode)  el.leftGmcpPanels.parentNode.appendChild(el.leftGmcpPanels);
    if (el.rightGmcpPanels && el.rightGmcpPanels.parentNode) el.rightGmcpPanels.parentNode.appendChild(el.rightGmcpPanels);

    applyTabbedCollapse('left');
    applyTabbedCollapse('right');

    /* ── Custom GMCP panels (handled in renderGmcpPanels, just set active) ── */
    state.settings.gmcpPanels.forEach(function (p) {
      if (!p.enabled) return;
      var panelId = 'gmcp-' + p.id;
      var panelEl = document.getElementById('panel-' + panelId);
      var btnEl   = document.querySelector('.panel-nav-btn[data-panel="' + panelId + '"]');
      var isOpen  = open.indexOf(panelId) >= 0;
      if (panelEl) panelEl.classList.toggle('active', isOpen);
      if (btnEl)   btnEl.classList.toggle('active', isOpen);
    });

    /* ── has-active state on containers ─────────────────── */
    var leftHasActive  = false;
    var rightHasActive = false;

    open.forEach(function (id) {
      if (id.indexOf('gmcp-') === 0) {
        var cid = id.slice(5);
        var cp  = state.settings.gmcpPanels.find(function (p) { return p.id === cid; });
        if (cp) {
          if ((cp.side || 'left') === 'right') rightHasActive = true;
          else leftHasActive = true;
        }
      } else {
        if ((sides[id] || 'left') === 'right') rightHasActive = true;
        else leftHasActive = true;
      }
    });

    el.leftPanels.classList.toggle('has-active', leftHasActive);
    el.rightPanels.classList.toggle('has-active', rightHasActive);

    /* ── Panel widths ────────────────────────────────────── */
    var pw = state.settings.panelWidths || {};
    el.leftPanels.style.width  = leftHasActive  ? ((pw.left  || 230) + 'px') : '0';
    el.rightPanels.style.width = rightHasActive ? ((pw.right || 230) + 'px') : '0';

    /* ── Resize handle visibility ────────────────────────── */
    if (el.resizeLeft)  el.resizeLeft.style.display  = leftHasActive  ? 'block' : 'none';
    if (el.resizeRight) el.resizeRight.style.display = rightHasActive ? 'block' : 'none';

    /* ── Right panel rail: hide when no panels assigned to right ─ */
    if (el.rightPanelsRail) {
      el.rightPanelsRail.style.display = el.rightPanelBtns.children.length ? '' : 'none';
    }
  }

  function applyTabbedCollapse(side) {
    var container = side === 'right' ? el.rightPanels : el.leftPanels;
    if (!container) return;

    Array.prototype.slice.call(container.querySelectorAll('.panel-tab-strip')).forEach(function (n) {
      n.parentNode.removeChild(n);
    });

    var open = state.settings.openPanels || [];
    var groups = Object.create(null);

    BUILTIN_PANELS.forEach(function (bp) {
      if (open.indexOf(bp.id) < 0) return;
      if ((state.settings.panelSides[bp.id] || 'left') !== side) return;
      var grp = (state.settings.panelTabGroup && state.settings.panelTabGroup[bp.id]) || '';
      if (!grp) return;
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(bp.id);
    });

    Object.keys(groups).forEach(function (grp) {
      var ids = groups[grp];
      if (ids.length < 2) return;

      var activeKey = side + '|' + grp;
      var selected = state.settings.panelTabActive[activeKey];
      if (ids.indexOf(selected) < 0) {
        selected = ids[0];
        state.settings.panelTabActive[activeKey] = selected;
      }

      ids.forEach(function (pid) {
        var panelEl = document.getElementById('panel-' + pid);
        var btnEl = document.querySelector('.panel-nav-btn[data-panel="' + pid + '"]');
        var show = pid === selected;
        if (panelEl) panelEl.classList.toggle('active', show);
        if (btnEl) btnEl.classList.toggle('active', show);
      });

      var strip = document.createElement('div');
      strip.className = 'panel-tab-strip';
      ids.forEach(function (pid) {
        var bp = BUILTIN_PANELS.find(function (p) { return p.id === pid; });
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'panel-tab-btn' + (pid === selected ? ' active' : '');
        b.textContent = bp ? bp.name : pid;
        b.addEventListener('click', function () {
          state.settings.panelTabActive[activeKey] = pid;
          applyPanelState();
          saveSettings();
        });
        strip.appendChild(b);
      });

      var anchorPanel = null;
      for (var i = 0; i < container.children.length; i++) {
        var child = container.children[i];
        if (!child || !child.id || child.id.indexOf('panel-') !== 0) continue;
        var childPid = child.id.slice(6);
        if (ids.indexOf(childPid) >= 0) {
          anchorPanel = child;
          break;
        }
      }

      if (anchorPanel) {
        container.insertBefore(strip, anchorPanel);
      } else {
        container.appendChild(strip);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     APPLY APPEARANCE
     ═══════════════════════════════════════════════════════════════ */

  function applyFont() {
    var font = state.settings.font || 'JetBrains Mono';
    document.documentElement.style.setProperty('--terminal-font', "'" + font + "', monospace");
  }

  function applyLayout() {
    el.workspace.dataset.layout = state.settings.layoutStyle || 'block';
    var cw = parseInt(state.settings.consoleWidth, 10);
    if (el.workspace.dataset.layout === 'rounded' && cw > 0) {
      el.workspace.style.setProperty('--console-width', cw + 'px');
    } else {
      el.workspace.style.removeProperty('--console-width');
    }
    updateAtmosphereFxState();
  }

  function initAtmosphereMotes() {
    ensureAtmosphereCanvas();
    if (!state.atmosphereFx.canvas) return;

    if (!state.atmosphereFx.visibilityListenerAttached) {
      document.addEventListener('visibilitychange', updateAtmosphereFxState);
      window.addEventListener('resize', resizeAtmosphereCanvas);
      state.atmosphereFx.visibilityListenerAttached = true;
    }

    if (window.matchMedia && !state.atmosphereFx.reduceMotionQuery) {
      state.atmosphereFx.reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      state.atmosphereFx.reduceMotionListener = function () {
        updateAtmosphereFxState();
      };
      if (typeof state.atmosphereFx.reduceMotionQuery.addEventListener === 'function') {
        state.atmosphereFx.reduceMotionQuery.addEventListener('change', state.atmosphereFx.reduceMotionListener);
      } else if (typeof state.atmosphereFx.reduceMotionQuery.addListener === 'function') {
        state.atmosphereFx.reduceMotionQuery.addListener(state.atmosphereFx.reduceMotionListener);
      }
    }

    resizeAtmosphereCanvas();
    updateAtmosphereFxState();
  }

  function ensureAtmosphereCanvas() {
    if (state.atmosphereFx.canvas && state.atmosphereFx.ctx) return;
    var existing = document.getElementById('atmosphere-motes-layer');
    var canvas = existing;

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'atmosphere-motes-layer';
      canvas.setAttribute('aria-hidden', 'true');
      if (document.body.firstChild) {
        document.body.insertBefore(canvas, document.body.firstChild);
      } else {
        document.body.appendChild(canvas);
      }
    }

    state.atmosphereFx.canvas = canvas;
    state.atmosphereFx.ctx = canvas.getContext('2d');
  }

  function updateAtmosphereFxState() {
    var shouldRun = shouldRunAtmosphereFx();
    if (shouldRun) {
      startAtmosphereFx();
    } else {
      stopAtmosphereFx();
    }
  }

  function shouldRunAtmosphereFx() {
    if (!el.workspace) return false;
    if (document.hidden) return false;
    if (state.settings && state.settings.particlesEnabled === false) return false;
    if (el.workspace.dataset.layout !== 'rounded') return false;
    var mq = state.atmosphereFx.reduceMotionQuery;
    if (mq && mq.matches) return false;
    return true;
  }

  function startAtmosphereFx() {
    ensureAtmosphereCanvas();
    if (!state.atmosphereFx.canvas || !state.atmosphereFx.ctx) return;
    resizeAtmosphereCanvas();
    state.atmosphereFx.canvas.classList.add('is-visible');
    if (state.atmosphereFx.running) return;
    state.atmosphereFx.running = true;
    state.atmosphereFx.lastTs = 0;
    state.atmosphereFx.spawnBudget = 0;
    state.atmosphereFx.rafId = requestAnimationFrame(tickAtmosphereFx);
  }

  function stopAtmosphereFx() {
    if (!state.atmosphereFx.canvas || !state.atmosphereFx.ctx) return;
    state.atmosphereFx.canvas.classList.remove('is-visible');
    if (state.atmosphereFx.rafId) {
      cancelAnimationFrame(state.atmosphereFx.rafId);
      state.atmosphereFx.rafId = 0;
    }
    state.atmosphereFx.running = false;
    state.atmosphereFx.motes = [];
    state.atmosphereFx.lastTs = 0;
    clearAtmosphereCanvas();
  }

  function resizeAtmosphereCanvas() {
    if (!state.atmosphereFx.canvas || !state.atmosphereFx.ctx) return;
    var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    var topOffset = getShellbarOffset();
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight - topOffset);

    state.atmosphereFx.dpr = dpr;
    state.atmosphereFx.canvas.style.top = topOffset + 'px';
    state.atmosphereFx.canvas.style.width = w + 'px';
    state.atmosphereFx.canvas.style.height = h + 'px';
    state.atmosphereFx.canvas.width = Math.floor(w * dpr);
    state.atmosphereFx.canvas.height = Math.floor(h * dpr);
    state.atmosphereFx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clearAtmosphereCanvas() {
    if (!state.atmosphereFx.canvas || !state.atmosphereFx.ctx) return;
    state.atmosphereFx.ctx.clearRect(0, 0, state.atmosphereFx.canvas.width, state.atmosphereFx.canvas.height);
  }

  function tickAtmosphereFx(ts) {
    if (!state.atmosphereFx.running) return;
    if (!shouldRunAtmosphereFx()) {
      stopAtmosphereFx();
      return;
    }

    var dt = state.atmosphereFx.lastTs ? (ts - state.atmosphereFx.lastTs) / 1000 : 0.016;
    state.atmosphereFx.lastTs = ts;
    if (dt > 0.05) dt = 0.05;

    spawnMotes(dt);
    updateMotes(dt);
    drawMotes();

    state.atmosphereFx.rafId = requestAnimationFrame(tickAtmosphereFx);
  }

  function spawnMotes(dt) {
    var canvas = state.atmosphereFx.canvas;
    if (!canvas) return;
    var targetCount = 2.5;
    state.atmosphereFx.spawnBudget += dt;

    while (state.atmosphereFx.motes.length < targetCount && state.atmosphereFx.spawnBudget >= 0.35) {
      state.atmosphereFx.spawnBudget -= 0.35 + Math.random() * 0.19;
      state.atmosphereFx.motes.push(makeMote(canvas.clientWidth || window.innerWidth, canvas.clientHeight || (window.innerHeight - getShellbarOffset())));
    }
  }

  function makeMote(width, height) {
    var x = width * (0.08 + Math.random() * 0.84);
    var y = height * (0.08 + Math.random() * 0.84);
    var life = 1.2 + Math.random() * 1.6;
    var dartWindow = 0.14 + Math.random() * 0.16;
    var angle = Math.random() * Math.PI * 2;
    var driftSpeed = 24 + Math.random() * 52;
    var dartAngle = angle + (Math.random() - 0.5) * 1.6;
    var dartSpeed = 120 + Math.random() * 160;
    var palette = getMoteThemePalette();
    return {
      x: x,
      y: y,
      vx: Math.cos(angle) * driftSpeed,
      vy: Math.sin(angle) * driftSpeed,
      life: life,
      age: 0,
      size: 0.88 + Math.random() * 0.9,
      maxAlpha: palette.alphaBase + (Math.random() * palette.alphaJitter),
      hue: normalizeHue(palette.hueBase + (Math.random() - 0.5) * palette.hueJitter),
      sat: clampNum(palette.satBase + (Math.random() - 0.5) * palette.satJitter, 50, 100),
      lit: clampNum(palette.litBase + (Math.random() - 0.5) * palette.litJitter, 20, 92),
      drag: 0.965 + Math.random() * 0.016,
      dartUntil: dartWindow,
      dartX: Math.cos(dartAngle) * dartSpeed,
      dartY: Math.sin(dartAngle) * dartSpeed,
      jitter: 90 + Math.random() * 120,
      wind: (Math.random() - 0.5) * 8,
    };
  }

  function updateMotes(dt) {
    var canvas = state.atmosphereFx.canvas;
    if (!canvas) return;
    var width = canvas.clientWidth || window.innerWidth;
    var height = canvas.clientHeight || (window.innerHeight - getShellbarOffset());
    var next = [];

    for (var i = 0; i < state.atmosphereFx.motes.length; i++) {
      var e = state.atmosphereFx.motes[i];
      e.age += dt;
      var p = e.age / e.life;
      if (p >= 1) continue;

      if (p < e.dartUntil) {
        e.vx += (e.dartX + (Math.random() - 0.5) * e.jitter) * dt;
        e.vy += e.dartY * dt;
      } else {
        e.vx += e.wind * dt;
      }

      e.vx *= Math.pow(e.drag, dt * 60);
      e.vy *= Math.pow(e.drag, dt * 60);

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      if (e.y < -24) continue;
      if (e.x < -24 || e.x > width + 24) continue;
      if (e.y > height + 16) continue;

      next.push(e);
    }

    state.atmosphereFx.motes = next;
  }

  function drawMotes() {
    if (!state.atmosphereFx.canvas || !state.atmosphereFx.ctx) return;
    var ctx = state.atmosphereFx.ctx;
    var w = state.atmosphereFx.canvas.clientWidth || window.innerWidth;
    var h = state.atmosphereFx.canvas.clientHeight || (window.innerHeight - getShellbarOffset());
    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < state.atmosphereFx.motes.length; i++) {
      var e = state.atmosphereFx.motes[i];
      var alpha = moteAlphaEnvelope(e);
      if (alpha <= 0) continue;

      var radius = e.size;
      var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, radius * 4.2);
      g.addColorStop(0, 'hsla(' + e.hue.toFixed(1) + ', ' + e.sat.toFixed(1) + '%, ' + (e.lit + 28).toFixed(1) + '%, ' + Math.min(1, alpha * 1.02).toFixed(3) + ')');
      g.addColorStop(0.32, 'hsla(' + e.hue.toFixed(1) + ', ' + e.sat.toFixed(1) + '%, ' + (e.lit + 10).toFixed(1) + '%, ' + (alpha * 0.66).toFixed(3) + ')');
      g.addColorStop(1, 'hsla(' + e.hue.toFixed(1) + ', ' + e.sat.toFixed(1) + '%, ' + e.lit.toFixed(1) + '%, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius * 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'hsla(' + e.hue.toFixed(1) + ', ' + Math.min(100, e.sat + 10).toFixed(1) + '%, ' + Math.min(96, e.lit + 30).toFixed(1) + '%, ' + (alpha * 0.88).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function moteAlphaEnvelope(e) {
    var p = e.age / e.life;
    if (p <= 0 || p >= 1) return 0;
    if (p < 0.11) return e.maxAlpha * (p / 0.11);
    if (p < 0.68) return e.maxAlpha * (1 - ((p - 0.11) / 0.57) * 0.26);
    return e.maxAlpha * (1 - ((p - 0.68) / 0.32));
  }

  function getShellbarOffset() {
    var value = getComputedStyle(document.documentElement).getPropertyValue('--shellbar-h') || '42px';
    var px = parseFloat(value);
    return isFinite(px) ? px : 42;
  }

  function getMoteThemePalette() {
    var accent = readThemeColorVar('--accent');
    var text = readThemeColorVar('--text');
    var bg = readThemeColorVar('--bg');
    var base = rgbToHsl(accent.r, accent.g, accent.b);
    var textTone = rgbToHsl(text.r, text.g, text.b);
    var bgTone = rgbToHsl(bg.r, bg.g, bg.b);

    var isLightTheme = bgTone.l >= 0.62;

    var hueBase = base.h;
    var satBase = clampNum(base.s * 100, 56, 96);
    var litBase = clampNum(Math.max(44, (base.l * 100) + 8), 44, 76);
    var litJitter = 18;
    var alphaBase = 0.7;
    var alphaJitter = 0.18;

    if (satBase < 62) satBase = 62;
    if (Math.abs(hueBase - textTone.h) < 7 && satBase < 74) satBase = 74;

    if (isLightTheme) {
      // Keep motes darker than bright surfaces so they stay visible on light themes.
      satBase = clampNum(Math.max(satBase, 68), 68, 100);
      litBase = clampNum((base.l * 100) - 18, 24, 44);
      litJitter = 12;
      alphaBase = 0.78;
      alphaJitter = 0.18;
    } else {
      // Slightly brighter for dark themes while keeping warm glow.
      litBase = clampNum(litBase + 8, 48, 86);
      litJitter = 20;
      alphaBase = 0.74;
      alphaJitter = 0.2;
    }

    return {
      hueBase: hueBase,
      hueJitter: 32,
      satBase: satBase,
      satJitter: 16,
      litBase: litBase,
      litJitter: litJitter,
      alphaBase: alphaBase,
      alphaJitter: alphaJitter,
    };
  }

  function readThemeColorVar(varName) {
    var root = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    var body = getComputedStyle(document.body).getPropertyValue(varName).trim();
    var parsed = parseCssColor(root) || parseCssColor(body);
    if (parsed) return parsed;
    return { r: 255, g: 150, b: 90 };
  }

  function parseCssColor(value) {
    if (!value) return null;
    var v = value.trim();
    var hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hex) {
      var h = hex[1];
      if (h.length === 3) {
        return {
          r: parseInt(h[0] + h[0], 16),
          g: parseInt(h[1] + h[1], 16),
          b: parseInt(h[2] + h[2], 16),
        };
      }
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }

    var rgb = v.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      var parts = rgb[1].split(',').map(function (s) { return parseFloat(s.trim()); });
      if (parts.length >= 3) {
        return {
          r: clampNum(parts[0], 0, 255),
          g: clampNum(parts[1], 0, 255),
          b: clampNum(parts[2], 0, 255),
        };
      }
    }
    return null;
  }

  function rgbToHsl(r, g, b) {
    var rn = r / 255;
    var gn = g / 255;
    var bn = b / 255;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;

    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) {
        h = ((gn - bn) / d) + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        h = ((bn - rn) / d) + 2;
      } else {
        h = ((rn - gn) / d) + 4;
      }
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  function clampNum(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeHue(hue) {
    var h = hue % 360;
    if (h < 0) h += 360;
    return h;
  }

  function applyWrapWidth() {
    var w = parseInt(state.settings.wrapWidth, 10);
    if (!state.settings.wrapLines || !(w > 0)) {
      el.terminal.style.removeProperty('--terminal-wrap-width');
    } else {
      el.terminal.style.setProperty('--terminal-wrap-width', w + 'ch');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     PANEL RESIZE HANDLES
     ═══════════════════════════════════════════════════════════════ */

  function initResizeHandles() {
    if (el.resizeLeft)  makeResizable(el.resizeLeft,  el.leftPanels,  'left');
    if (el.resizeRight) makeResizable(el.resizeRight, el.rightPanels, 'right');
  }

  function makeResizable(handle, panelEl, side) {
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      var startX = e.clientX;
      var startW = panelEl.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e) {
        var isRounded = el.workspace.dataset.layout === 'rounded';
        var delta;
        if (side === 'left') {
          delta = isRounded ? (startX - e.clientX) : (e.clientX - startX);
        } else {
          delta = isRounded ? (e.clientX - startX) : (startX - e.clientX);
        }
        var newW  = clampWidth(startW + delta, startW);
        panelEl.style.width = newW + 'px';
        state.settings.panelWidths[side] = newW;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',  onUp);
        handle.classList.remove('dragging');
        document.body.style.cursor    = '';
        document.body.style.userSelect = '';
        saveSettings();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',  onUp);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SETTINGS PERSISTENCE
     ═══════════════════════════════════════════════════════════════ */

  function loadSettings() {
    try {
      var raw    = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      state.settings = ensureDefaultPanelLayout(mergeSettings(cloneDefaultSettings(), parsed));
      var siteTheme  = themeApi ? themeApi.getThemeId() : localStorage.getItem(SITE_THEME_KEY);
      state.settings.theme = resolveTheme(siteTheme || state.settings.theme);
    } catch (_) {
      state.settings = ensureDefaultPanelLayout(cloneDefaultSettings());
    }
    rebuildPalette();
  }

  function saveSettings()    { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); }
  function saveAndRefresh()  { saveSettings(); renderAll(); }

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

    applyFont();
    applyLayout();

    el.cfgFont.value         = state.settings.font || 'JetBrains Mono';
    el.cfgLayout.value       = state.settings.layoutStyle || 'block';
    el.cfgKeepInput.checked  = state.settings.keepInput !== false;
    el.cfgTimestamps.checked = !!state.settings.timestamps;
    el.cfgWrap.checked       = !!state.settings.wrapLines;
    el.cfgParticles.checked  = state.settings.particlesEnabled !== false;
    el.cfgWrapWidth.value    = state.settings.wrapWidth != null ? state.settings.wrapWidth : 80;
    el.cfgHistoryMax.value   = state.settings.historyMax != null ? state.settings.historyMax : 2500;
    el.cfgConsoleWidth.value = state.settings.consoleWidth != null ? state.settings.consoleWidth : 1000;
    el.cfgStackSep.value     = sanitizeStackSep(state.settings.stackSeparator);
    el.cfgTsSelectable.checked  = state.settings.tsSelectable !== false;
    applyTsSelectable();

    el.terminal.classList.toggle('nowrap', !state.settings.wrapLines);
    applyWrapWidth();

    renderBuiltinPanelCfg();
    renderGmcpPanels();
    applyPanelState();

    renderAliases();
    renderTriggers();
    renderMacros();
    renderMacroBar();
    renderAnsiPaletteCfg();
    renderLanguageUi();
  }

  /* ── Built-in panel side config (in Config drawer) ──────── */

  function renderBuiltinPanelCfg() {
    el.builtinPanelCfg.innerHTML = '';
    var sides = state.settings.panelSides;
    var order = state.settings.panelOrder;

    order.forEach(function (panelId, orderIdx) {
      var bp = null;
      for (var bi = 0; bi < BUILTIN_PANELS.length; bi++) {
        if (BUILTIN_PANELS[bi].id === panelId) { bp = BUILTIN_PANELS[bi]; break; }
      }
      if (!bp) return;

      var row = document.createElement('div');
      row.className = 'panel-side-row';

      /* ↑↓ reorder buttons */
      var orderBtns = document.createElement('div');
      orderBtns.className = 'order-btns';

      var upBtn = document.createElement('button');
      upBtn.type = 'button'; upBtn.className = 'order-btn'; upBtn.title = 'Move up';
      upBtn.textContent = '\u2191'; upBtn.disabled = orderIdx === 0;
      (function (idx) {
        upBtn.addEventListener('click', function () {
          var tmp = state.settings.panelOrder[idx - 1];
          state.settings.panelOrder[idx - 1] = state.settings.panelOrder[idx];
          state.settings.panelOrder[idx] = tmp;
          saveSettings(); renderBuiltinPanelCfg(); applyPanelState();
        });
      })(orderIdx);

      var downBtn = document.createElement('button');
      downBtn.type = 'button'; downBtn.className = 'order-btn'; downBtn.title = 'Move down';
      downBtn.textContent = '\u2193'; downBtn.disabled = orderIdx === order.length - 1;
      (function (idx) {
        downBtn.addEventListener('click', function () {
          var tmp = state.settings.panelOrder[idx + 1];
          state.settings.panelOrder[idx + 1] = state.settings.panelOrder[idx];
          state.settings.panelOrder[idx] = tmp;
          saveSettings(); renderBuiltinPanelCfg(); applyPanelState();
        });
      })(orderIdx);

      orderBtns.appendChild(upBtn);
      orderBtns.appendChild(downBtn);

      var lbl = document.createElement('label');
      lbl.textContent = bp.name;

      var sel = document.createElement('select');
      ['left', 'right'].forEach(function (s) {
        var o = document.createElement('option');
        o.value = s;
        o.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        sel.appendChild(o);
      });
      sel.value = sides[bp.id] || 'left';

      (function (bpId, select) {
        select.addEventListener('change', function () {
          state.settings.panelSides[bpId] = select.value;
          saveSettings();
          applyPanelState();
        });
      })(bp.id, sel);

      var tabSel = document.createElement('select');
      ['', 'A', 'B', 'C'].forEach(function (group) {
        var o = document.createElement('option');
        o.value = group;
        o.textContent = group ? ('Tabs ' + group) : 'Standalone';
        tabSel.appendChild(o);
      });
      tabSel.value = (state.settings.panelTabGroup && state.settings.panelTabGroup[bp.id]) || '';
      (function (bpId, select) {
        select.addEventListener('change', function () {
          state.settings.panelTabGroup[bpId] = select.value;
          saveSettings();
          applyPanelState();
        });
      })(bp.id, tabSel);

      row.appendChild(orderBtns);
      row.appendChild(lbl);
      row.appendChild(sel);
      row.appendChild(tabSel);
      el.builtinPanelCfg.appendChild(row);
    });
  }

  /* ── Custom GMCP panels ──────────────────────────────────── */

  function renderGmcpPanels() {
    /* Rebuild config list in drawer */
    el.gmcpPanelList.innerHTML = '';
    state.settings.gmcpPanels.forEach(function (panel, idx) {
      var card = makeItemCard('panel', !!panel.enabled, idx, state.settings.gmcpPanels);

      /* ↑/↓ reorder buttons in card actions */
      var actions = card.querySelector('.item-card-actions');
      if (actions) {
        var upBtn = document.createElement('button');
        upBtn.type = 'button'; upBtn.className = 'order-btn'; upBtn.title = 'Move up';
        upBtn.textContent = '\u2191'; upBtn.disabled = idx === 0;
        (function (i) {
          upBtn.addEventListener('click', function () {
            var tmp = state.settings.gmcpPanels[i - 1];
            state.settings.gmcpPanels[i - 1] = state.settings.gmcpPanels[i];
            state.settings.gmcpPanels[i] = tmp;
            saveAndRefresh();
          });
        })(idx);
        var downBtn = document.createElement('button');
        downBtn.type = 'button'; downBtn.className = 'order-btn'; downBtn.title = 'Move down';
        downBtn.textContent = '\u2193'; downBtn.disabled = idx === state.settings.gmcpPanels.length - 1;
        (function (i) {
          downBtn.addEventListener('click', function () {
            var tmp = state.settings.gmcpPanels[i + 1];
            state.settings.gmcpPanels[i + 1] = state.settings.gmcpPanels[i];
            state.settings.gmcpPanels[i] = tmp;
            saveAndRefresh();
          });
        })(idx);
        actions.insertBefore(downBtn, actions.firstChild);
        actions.insertBefore(upBtn, actions.firstChild);
      }

      card.appendChild(makeItemField('Name', 'text', panel.name || '', function (v) {
        panel.name = v; saveAndRefresh();
      }));
      card.appendChild(makeItemField('GMCP Path', 'text', panel.gmcpPath || '', function (v) {
        panel.gmcpPath = v; saveSettings();
      }));

      /* Side selector for custom panels */
      var sideRow = document.createElement('div');
      sideRow.className = 'item-card-row';
      var sideLbl = document.createElement('label');
      sideLbl.textContent = 'Side';
      var sideSel = document.createElement('select');
      ['left', 'right'].forEach(function (s) {
        var o = document.createElement('option');
        o.value = s; o.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        sideSel.appendChild(o);
      });
      sideSel.value = panel.side || 'left';
      (function (p, sel) {
        sel.addEventListener('change', function () { p.side = sel.value; saveAndRefresh(); });
      })(panel, sideSel);
      sideRow.appendChild(sideLbl);
      sideRow.appendChild(sideSel);
      card.appendChild(sideRow);

      el.gmcpPanelList.appendChild(card);
    });

    /* Rebuild custom panel DOM elements */
    /* Clear old custom panel buttons only (built-in buttons may be parked here) */
    var builtinPanelIds = BUILTIN_PANELS.map(function (bp) { return bp.id; });
    [el.leftPanelBtns, el.rightPanelBtns].forEach(function (container) {
      var toRemove = [];
      for (var i = 0; i < container.children.length; i++) {
        var pid = container.children[i].dataset && container.children[i].dataset.panel;
        if (!pid || builtinPanelIds.indexOf(pid) < 0) toRemove.push(container.children[i]);
      }
      toRemove.forEach(function (node) { node.parentNode.removeChild(node); });
    });
    /* Clear old custom panel elements */
    el.leftGmcpPanels.innerHTML  = '';
    el.rightGmcpPanels.innerHTML = '';

    state.settings.gmcpPanels.forEach(function (panel) {
      if (!panel.enabled) return;
      var panelId = 'gmcp-' + panel.id;
      var side    = panel.side || 'left';

      /* Nav button */
      var btn = document.createElement('button');
      btn.className     = 'panel-nav-btn';
      btn.dataset.panel = panelId;
      btn.type          = 'button';
      btn.title         = panel.name;
      btn.innerHTML     = '<span class="pnav-icon" aria-hidden="true">&#9671;</span>' +
                          '<span class="pnav-label">' + escHtml(panel.name) + '</span>';
      btn.addEventListener('click', function () { togglePanel(panelId); });

      if (side === 'right') {
        el.rightPanelBtns.appendChild(btn);
      } else {
        el.leftPanelBtns.appendChild(btn);
      }

      /* Panel element */
      var div  = document.createElement('div');
      div.className = 'panel';
      div.id        = 'panel-' + panelId;

      var head = document.createElement('div');
      head.className = 'panel-head';
      head.innerHTML = '<span>' + escHtml(panel.name) + '</span>' +
                       '<button class="panel-close" type="button" title="Close">&#x2715;</button>';
      head.querySelector('.panel-close').addEventListener('click', function () { closePanel(panelId); });

      var body = document.createElement('div');
      body.className = 'panel-body ph-centered';
      body.dataset.gmcpPanelId = panel.id;
      body.innerHTML = '<div class="ph-icon" aria-hidden="true">&#9671;</div>' +
                       '<div class="ph-title">' + escHtml(panel.name) + '</div>' +
                       '<div class="ph-sub">Awaiting GMCP<br>' + escHtml(panel.gmcpPath || 'no path set') + '</div>';

      div.appendChild(head);
      div.appendChild(body);

      if (side === 'right') {
        el.rightGmcpPanels.appendChild(div);
      } else {
        el.leftGmcpPanels.appendChild(div);
      }
    });
  }

  /* ── Aliases ─────────────────────────────────────────────── */

  function renderAliases() {
    el.aliasList.innerHTML = '';
    state.settings.aliases.forEach(function (a, idx) {
      var card = makeItemCard('alias', !!a.enabled, idx, state.settings.aliases);
      card.appendChild(makeItemField('Pattern (regex)', 'text', a.pattern || '', function (v) { a.pattern = v; saveSettings(); }));
      card.appendChild(makeItemField('Replacement', 'text', a.replacement || '', function (v) { a.replacement = v; saveSettings(); }));
      el.aliasList.appendChild(card);
    });
  }

  /* ── Triggers ────────────────────────────────────────────── */

  function renderTriggers() {
    el.triggerList.innerHTML = '';
    state.settings.triggers.forEach(function (t, idx) {
      var card = makeItemCard('trigger', !!t.enabled, idx, state.settings.triggers);
      card.appendChild(makeItemField('Pattern (regex)', 'text', t.pattern || '', function (v) { t.pattern = v; saveSettings(); }));
      card.appendChild(makeItemField('Flags', 'text', t.flags || '', function (v) { t.flags = v; saveSettings(); }));

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

      card.appendChild(makeItemField('Value', 'text', t.value || '', function (v) { t.value = v; saveSettings(); }));
      el.triggerList.appendChild(card);
    });
  }

  /* ── Macros ──────────────────────────────────────────────── */

  function renderMacros() {
    el.macroList.innerHTML = '';
    state.settings.macros.forEach(function (m, idx) {
      var card = makeItemCard('macro', !!m.enabled, idx, state.settings.macros);
      card.appendChild(makeItemField('Label',   'text', m.label   || '', function (v) { m.label   = v; saveAndRefresh(); }));
      card.appendChild(makeItemField('Command', 'text', m.command || '', function (v) { m.command = v; saveAndRefresh(); }));
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
      btn.addEventListener('click', function () { sendCommand(m.command); });
      el.macroBar.appendChild(btn);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ITEM CARD BUILDER
     ═══════════════════════════════════════════════════════════════ */

  function makeItemCard(type, enabled, idx, list) {
    var card = document.createElement('div');
    card.className = 'item-card';

    var actions = document.createElement('div');
    actions.className = 'item-card-actions';

    var chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = enabled; chk.title = 'Enable';
    chk.addEventListener('change', function () { list[idx].enabled = !!chk.checked; saveAndRefresh(); });

    var lbl = document.createElement('span');
    lbl.className = 'item-label';
    lbl.textContent = type + ' #' + (idx + 1);

    var rmBtn = document.createElement('button');
    rmBtn.type = 'button'; rmBtn.className = 'del'; rmBtn.title = 'Delete';
    rmBtn.textContent = '\u2715';
    rmBtn.addEventListener('click', function () { list.splice(idx, 1); saveAndRefresh(); });

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
    inp.type = inputType; inp.value = value; inp.placeholder = labelText;
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

  function connectMud(mudId, isReconnect) {
    var mud = LOCKED_MUDS.find(function (m) { return m.id === mudId; });
    if (!mud) { appendSystem('Unknown server profile.'); return; }
    disconnect();
    state.userDisconnected = false;
    if (!isReconnect) state.reconnectAttempts = 0;
    state.selectedMudId = mudId;
    setConnectionState('connecting');
    appendSystem('Connecting to ' + mud.name + ' (' + mud.host + ':' + mud.port + ')\u2026');
    var wsId = ++state.wsGeneration;
    var ws;
    try {
      ws = new WebSocket(bridgeUrl());
    } catch (_) {
      appendSystem('WebSocket open failed.'); setConnectionState('offline'); return;
    }
    state.ws = ws;
    state.activeWsGeneration = wsId;

    ws.addEventListener('open', function () {
      if (state.ws !== ws || state.activeWsGeneration !== wsId) return;
      state.reconnectAttempts = 0;
      sendWs({ type: 'connect', host: mud.host, port: mud.port, tls: !!mud.tls });
      setConnectionState('online'); startKeepalive();
    });
    ws.addEventListener('message', function (e) {
      if (state.ws !== ws || state.activeWsGeneration !== wsId) return;
      handleBridgeMessage(e.data);
    });
    ws.addEventListener('close', function () {
      if (state.ws !== ws || state.activeWsGeneration !== wsId) return;
      stopKeepalive(); setConnectionState('offline');
      state.ws = null;
      state.activeWsGeneration = 0;
      if (!state.userDisconnected && state.selectedMudId) {
        appendSystem('Bridge closed \u2014 attempting to reconnect\u2026');
        scheduleReconnect();
      } else {
        appendSystem('Bridge closed.');
      }
    });
    ws.addEventListener('error', function () {
      if (state.ws !== ws || state.activeWsGeneration !== wsId) return;
      appendSystem('WebSocket error.');
    });
  }

  function disconnect() {
    state.userDisconnected = true;
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    stopKeepalive();
    var ws = state.ws;
    state.ws = null;
    state.activeWsGeneration = 0;
    if (!ws) { setConnectionState('offline'); return; }
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnect' }));
      }
    } catch (_) {}
    try { ws.close(); } catch (_) {}
    setConnectionState('offline');
  }

  function scheduleReconnect() {
    if (state.reconnectTimer) return;
    var MAX_ATTEMPTS = 5;
    var delays = [3000, 6000, 12000, 24000, 30000];
    if (state.reconnectAttempts >= MAX_ATTEMPTS) {
      appendSystem('Auto-reconnect exhausted after ' + MAX_ATTEMPTS + ' attempts \u2014 click Connect to retry.');
      state.reconnectAttempts = 0;
      return;
    }
    var delay = delays[Math.min(state.reconnectAttempts, delays.length - 1)];
    appendSystem('Reconnect attempt ' + (state.reconnectAttempts + 1) + '/' + MAX_ATTEMPTS + ' in ' + (delay / 1000) + 's\u2026');
    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      state.reconnectAttempts++;
      connectMud(state.selectedMudId, true);
    }, delay);
  }

  function setConnectionState(status) {
    state.connected = (status === 'online');
    var labels = { online: '\u25CF Online', offline: '\u25CF Offline', connecting: '\u25CC Connecting\u2026' };
    el.connStatus.textContent = labels[status] || '\u25CF Offline';
    el.connStatus.className   = status;
  }

  function sendWs(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify(payload));
  }

  function startKeepalive() {
    stopKeepalive();
    state.keepaliveTimer = setInterval(function () { sendWs({ type: 'ping', t: Date.now() }); }, 30000);
  }

  function stopKeepalive() {
    if (!state.keepaliveTimer) return;
    clearInterval(state.keepaliveTimer); state.keepaliveTimer = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     BRIDGE MESSAGE HANDLING
     ═══════════════════════════════════════════════════════════════ */

  function handleBridgeMessage(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (_) { appendSystem('Invalid bridge payload.'); return; }
    if (msg.type === 'status')       { appendSystem(msg.message || 'status'); return; }
    if (msg.type === 'data')         {
      if (tryConsumeMapRenderBlob(msg.data || '')) return;
      ingestMudText(msg.data || '');
      return;
    }
    if (msg.type === 'pong')         { return; }
    if (msg.type === 'disconnected') { appendSystem('MUD disconnected.'); return; }
    if (msg.type === 'gmcp')         { handleGmcp(msg.package, msg.data); return; }
  }

  function handleGmcp(pkg, data) {
    if (!pkg) return;
    var normPkg = String(pkg).trim().toLowerCase();
    if (normPkg === 'char.vitals') { updateVitals(data || {}); return; }
    if (normPkg === 'room.info')   { updateRoomInfo(data || {}); return; }
    if (normPkg === 'map.render')  { updateMapRender(data || {}); return; }
    if (normPkg === 'world.time')  { updateWorldTime(data || {}); return; }
    if (normPkg === 'world.weather') { updateWorldWeather(data || {}); return; }
    if (normPkg === 'world.moons') { updateWorldMoons(data || {}); return; }
    if (normPkg === 'comm.channel.text') { pushChannelMessage(data || {}); return; }
    if (normPkg === 'group.info')  { updateGroupInfo(data || {}); return; }
    if (normPkg === 'char.info')   { updateCharStatus(data || {}); return; }
    if (normPkg === 'char.status') { updateCharStatus(data || {}); return; }
    if (normPkg === 'char.stats')  { updateCharStats(data || {}); return; }
    if (normPkg === 'char.worth')  { updateCharWorth(data || {}); return; }
    if (normPkg === 'char.affects'){ updateCharAffects(data || {}); return; }
    if (normPkg === 'char.combat') { updateCharCombat(data || {}); return; }
    if (normPkg === 'char.inventory') { updateInventory(data || {}); return; }
    if (normPkg === 'char.equipment') { updateEquipment(data || {}); return; }

    state.settings.gmcpPanels.forEach(function (panel) {
      if (!panel.enabled || panel.gmcpPath !== pkg) return;
      var body = document.querySelector('[data-gmcp-panel-id="' + panel.id + '"]');
      if (!body) return;
      body.className = 'panel-body';
      body.textContent = JSON.stringify(data, null, 2);
    });
  }

  function mapAnsiFromPayload(data) {
    function unwrapJson(value) {
      var out = value;
      for (var i = 0; i < 4; i++) {
        if (typeof out !== 'string') break;
        var trimmed = out.trim();
        if (!trimmed) return '';
        var first = trimmed.charAt(0);
        if (first !== '{' && first !== '[' && first !== '"') break;
        try {
          out = JSON.parse(trimmed);
        } catch (_) {
          break;
        }
      }
      return out;
    }

    function maybeJsonLikeString(value) {
      if (typeof value !== 'string') return false;
      var trimmed = value.trim();
      if (!trimmed) return false;
      var first = trimmed.charAt(0);
      return first === '{' || first === '[' || first === '"';
    }

    function extractEmbeddedAnsiJson(value) {
      if (typeof value !== 'string') return '';
      var s = value.trim();
      if (!s) return '';

      var firstBrace = s.indexOf('{');
      var lastBrace = s.lastIndexOf('}');
      if (firstBrace < 0 || lastBrace <= firstBrace) return '';

      var candidate = s.slice(firstBrace, lastBrace + 1);
      if (candidate.indexOf('"ansi"') < 0) return '';
      try {
        var parsed = JSON.parse(candidate);
        if (parsed && typeof parsed.ansi === 'string') return parsed.ansi;
      } catch (_) {}
      return '';
    }

    function extractAnsi(value) {
      var normalized = unwrapJson(value);
      if (!normalized) return '';

      if (typeof normalized === 'string') {
        if (maybeJsonLikeString(normalized)) {
          var reparsed = unwrapJson(normalized);
          if (reparsed !== normalized) {
            return extractAnsi(reparsed);
          }
        }
        var embeddedAnsi = extractEmbeddedAnsiJson(normalized);
        if (embeddedAnsi) return embeddedAnsi;
        return normalized;
      }

      if (typeof normalized.ansi === 'string') {
        return normalized.ansi;
      }

      if (typeof normalized.raw === 'string') {
        var rawParsed = unwrapJson(normalized.raw);
        if (rawParsed && typeof rawParsed.ansi === 'string') return rawParsed.ansi;
        return normalized.raw;
      }

      var nestedKeys = ['payload', 'data', 'message'];
      for (var i = 0; i < nestedKeys.length; i++) {
        var next = normalized[nestedKeys[i]];
        if (next == null) continue;
        var extracted = extractAnsi(next);
        if (extracted) return extracted;
      }

      if (Array.isArray(normalized)) {
        for (var j = 0; j < normalized.length; j++) {
          var arrExtracted = extractAnsi(normalized[j]);
          if (arrExtracted) return arrExtracted;
        }
        return '';
      }

      if (typeof normalized === 'object') {
        var keys = Object.keys(normalized);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (key === 'timestamp') continue;
          var deepExtracted = extractAnsi(normalized[key]);
          if (deepExtracted) return deepExtracted;
        }
      }

      return '';
    }

    return extractAnsi(data);
  }

  function updateVitals(data) {
    var prevHp = state.gmcp.vitals ? numOr(state.gmcp.vitals.hp, 0) : null;
    var hp = numOr(data.hp, 0);
    var maxHp = Math.max(1, numOr(data.maxhp, hp || 1));
    var mana = numOr(data.mana != null ? data.mana : data.mp, 0);
    var maxMana = Math.max(1, numOr(data.maxmana, mana || 1));
    var move = numOr(data.move != null ? data.move : data.mv, 0);
    var maxMove = Math.max(1, numOr(data.maxmove, move || 1));

    state.gmcp.vitals = {
      hp: hp, maxhp: maxHp,
      mana: mana, maxmana: maxMana,
      move: move, maxmove: maxMove,
      hunger: numOr(data.hunger, 0),
      thirst: numOr(data.thirst, 0),
      wimpy: numOr(data.wimpy, 0),
      position: data.position != null ? data.position : data.pos,
    };

    el.vHp.textContent = 'HP ' + hp + '/' + maxHp;
    el.vMp.textContent = 'MP ' + mana + '/' + maxMana;
    el.vMv.textContent = 'MV ' + move + '/' + maxMove;
    setSegmentGauge(el.vHpSegs, pct(hp, maxHp), 'hp');
    setSegmentGauge(el.vMpSegs, pct(mana, maxMana), 'mana');
    setSegmentGauge(el.vMvSegs, pct(move, maxMove), 'move');
    if (el.vWimpy) {
      var wimpy = Math.max(0, numOr(data.wimpy, 0));
      var wimpyPct = maxHp > 0 ? Math.max(0, Math.min(100, Math.floor((wimpy * 100) / maxHp))) : 0;
      el.vWimpy.textContent = '';
      el.vWimpy.removeAttribute('data-label');
      el.vWimpy.style.left = wimpyPct + '%';
      el.vWimpy.classList.toggle('active', wimpy > 0);
    }
    updateVitalsPosition(state.gmcp.vitals.position);
    if (prevHp != null && hp < prevHp) {
      playDamageTone();
    }
    el.vitalsStrip.hidden = false;
    pulsePkgBadge('status', 'Char.Vitals');
    renderStatusPanel();
  }

  function playDamageTone() {
    var now = Date.now();
    if (now - state.lastDamageToneAt < 120) return;
    state.lastDamageToneAt = now;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!state.audioCtx) state.audioCtx = new AC();
      var ctx = state.audioCtx;
      var t0 = ctx.currentTime;

      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(112, t0);
      osc.frequency.exponentialRampToValueAtTime(86, t0 + 0.22);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.028, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, t0);
      lp.Q.setValueAtTime(0.7, t0);

      osc.connect(gain);
      gain.connect(lp);
      lp.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    } catch (_) {}
  }

  function updateRoomInfo(data) {
    state.gmcp.roomInfo = data;
    pulsePkgBadge('map', 'Room.Info');
    renderMapPanel();
  }

  function updateMapRender(data) {
    state.gmcp.mapRenderMeta = (data && typeof data === 'object') ? data : null;
    state.gmcp.mapRender = mapAnsiFromPayload(data);
    state.gmcp.mapRenderSeq = (state.gmcp.mapRenderSeq | 0) + 1;
    pulsePkgBadge('map', 'Map.Render');
    renderMapPanel();
  }

  function updateWorldTime(data) {
    state.gmcp.worldTime = data;
    pulsePkgBadge('map', 'World.Time');
    renderMapPanel();
  }

  function updateWorldWeather(data) {
    state.gmcp.worldWeather = data;
    pulsePkgBadge('map', 'World.Weather');
    renderMapPanel();
  }

  function updateWorldMoons(data) {
    state.gmcp.worldMoons = data;
    pulsePkgBadge('map', 'World.Moons');
    renderMapPanel();
  }

  function renderMapPanel() {
    if (!el.mapPanelBody) return;

    var info = state.gmcp.roomInfo;
    var ansi = normalizeMapAnsiForRender(state.gmcp.mapRender);
    var mapMeta = state.gmcp.mapRenderMeta || {};
    var wt = state.gmcp.worldTime || {};
    var ww = state.gmcp.worldWeather || {};
    var wm = state.gmcp.worldMoons || {};
    if (!info && !ansi && !Object.keys(wt).length && !Object.keys(ww).length && !Object.keys(wm).length) return;

    el.mapPanelBody.className = 'panel-body map-panel';
    Array.prototype.forEach.call(el.mapPanelBody.children, function (child) {
      if (!child || !child.classList) return;
      if (child.classList.contains('map-meta')) return;
      if (child.classList.contains('map-ansi')) return;
      child.remove();
    });

    var meta = el.mapPanelBody.querySelector('.map-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'map-meta';
      el.mapPanelBody.appendChild(meta);
    }

    var roomName = info && info.name ? info.name : 'Unknown Room';
    var area = info && info.area ? info.area : 'Unknown Area';
    var terrain = info && info.terrain ? String(info.terrain) : 'unknown';
    var hourText = '--';
    if (wt.hour != null && wt.hour !== '') {
      hourText = String(wt.hour);
    }

    var metaHtml =
      '<div class="map-room-head">' +
      '<div class="map-room-name">' + escHtml(roomName) + '</div>' +
      '<div class="map-room-hour">Hour ' + escHtml(hourText) + '</div>' +
      '</div>' +
      '<div class="map-room-meta">' + escHtml(area) + ' · ' + escHtml(terrain) + '</div>';

    if (metaHtml !== state.gmcp.mapRenderedMetaHtml) {
      meta.innerHTML = metaHtml;
      state.gmcp.mapRenderedMetaHtml = metaHtml;
    }

    var mapAnsi = el.mapPanelBody.querySelector('.map-ansi');
    if (!mapAnsi) {
      mapAnsi = document.createElement('div');
      mapAnsi.className = 'map-ansi';
      el.mapPanelBody.appendChild(mapAnsi);
    }

    var markerHint = extractMapMarkerHint(mapMeta);
    var markerKey = markerHint ? (markerHint.row + ':' + markerHint.col) : '';

    if (!ansi) {
      if (state.gmcp.mapRenderedAnsi !== '') {
        mapAnsi.innerHTML = '<div class="ph-sub" style="opacity:.65">Awaiting GMCP<br>map render</div>';
        state.gmcp.mapRenderedAnsi = '';
        state.gmcp.mapRenderedMarkerKey = '';
        state.gmcp.mapCenteredSeq = 0;
      }
    } else {
      var hasNewMapFrame = (state.gmcp.mapRenderSeq | 0) !== (state.gmcp.mapCenteredSeq | 0);
      if (ansi === state.gmcp.mapRenderedAnsi) {
        if (hasNewMapFrame || (markerKey && markerKey !== state.gmcp.mapRenderedMarkerKey)) {
          var existingContent = mapAnsi.querySelector('.map-ansi-content');
          if (existingContent) {
            state.gmcp.mapCenterSeq += 1;
            centerMapViewportOnPlayer(mapAnsi, existingContent, null, null, state.gmcp.mapCenterSeq);
            state.gmcp.mapRenderedMarkerKey = markerKey;
            state.gmcp.mapCenteredSeq = state.gmcp.mapRenderSeq | 0;
          }
        }
        return;
      }

      var mapContent = document.createElement('div');
      mapContent.className = 'map-ansi-content';
      var rawLines = [];

      String(ansi).split(/\r?\n/).forEach(function (line) {
        if (line === '') return;
        rawLines.push(line);
        var row = document.createElement('div');
        row.className = 'map-ansi-line';
        row.appendChild(window.AnsiRenderer.renderAnsiLine(line, state.ansiPalette));
        mapContent.appendChild(row);
      });

      mapAnsi.replaceChildren(mapContent);
      state.gmcp.mapRenderedAnsi = ansi;
      state.gmcp.mapRenderedMarkerKey = markerKey;
      state.gmcp.mapCenteredSeq = state.gmcp.mapRenderSeq | 0;
      state.gmcp.mapCenterSeq += 1;
      centerMapViewportOnPlayer(mapAnsi, mapContent, null, null, state.gmcp.mapCenterSeq);
    }
  }

  function centerMapViewportOnPlayer(viewport, content, rawLines, markerHint, centerSeq) {
    if (!viewport || !content) return;

    // Wait two frames so layout + font metrics settle before measuring.
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if ((centerSeq | 0) !== (state.gmcp.mapCenterSeq | 0)) return;
      // Map.Render is generated centered on the player's room in-server;
      // keep viewport centered on full rendered content to mirror Mudlet behavior.
      var maxLeft = Math.max(0, content.scrollWidth - viewport.clientWidth);
      var maxTop = Math.max(0, content.scrollHeight - viewport.clientHeight);
      var desiredLeft = Math.floor(maxLeft / 2);
      var desiredTop = Math.floor(maxTop / 2);
      var maxLeft = Math.max(0, content.scrollWidth - viewport.clientWidth);
      var maxTop = Math.max(0, content.scrollHeight - viewport.clientHeight);

      viewport.scrollLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
      viewport.scrollTop = Math.max(0, Math.min(maxTop, desiredTop));
    }); });
  }

  function extractMapMarkerHint(meta) {
    if (!meta || typeof meta !== 'object') return null;

    function num(v) {
      if (typeof v === 'number' && isFinite(v)) return v | 0;
      if (typeof v === 'string' && v.trim() !== '') {
        var n = parseInt(v, 10);
        if (!isNaN(n)) return n;
      }
      return null;
    }

    var row = num(meta.marker_row);
    var col = num(meta.marker_col);
    if (row == null && meta.marker && typeof meta.marker === 'object') row = num(meta.marker.row);
    if (col == null && meta.marker && typeof meta.marker === 'object') col = num(meta.marker.col);
    if (row == null || col == null) return null;
    return { row: row, col: col };
  }

  function normalizeMarkerHint(markerHint, rowCount, rawLines) {
    if (!markerHint || typeof markerHint !== 'object') return null;
    var row = markerHint.row | 0;
    var col = markerHint.col | 0;
    if (row < 0 || row >= (rowCount | 0)) return null;
    var plain = stripAnsiAndControls((rawLines && rawLines[row]) || '');
    var maxCol = Math.max(0, plain.length - 1);
    if (col < 0) col = 0;
    if (col > maxCol) col = maxCol;
    return { row: row, col: col };
  }

  function findLikelyPlayerMapCell(rawLines) {
    if (!Array.isArray(rawLines) || !rawLines.length) return null;

    var plainLines = rawLines.map(stripAnsiAndControls);
    var maxCols = 0;
    plainLines.forEach(function (line) { if (line.length > maxCols) maxCols = line.length; });
    var centerRow = (plainLines.length - 1) / 2;
    var centerCol = Math.max(0, (maxCols - 1) / 2);

    var best = null;

    function consider(row, col, priority) {
      var score = Math.abs(row - centerRow) + Math.abs(col - centerCol);
      if (!best || priority < best.priority || (priority === best.priority && score < best.score)) {
        best = { row: row, col: col, score: score, priority: priority };
      }
    }

    // Best source: derive exact center cell from square bordered map geometry.
    var fromBorder = findPlayerCellFromBorderGeometry(plainLines);
    if (fromBorder) {
      consider(fromBorder.row, fromBorder.col, -1);
    }

    // Prefer the player's own marker from server map colors: {Y* (or {y* fallback).
    rawLines.forEach(function (raw, row) {
      var s = String(raw || '');
      var m = s.match(/\{[Yy]\*/);
      if (!m || m.index == null) return;
      var col = visibleColumnAtRawIndex(s, m.index);
      consider(row, col, 0);
    });

    if (best) return { row: best.row, col: best.col };

    // Fallback: nearest visible '*' if explicit player marker not found.
    plainLines.forEach(function (line, row) {
      for (var col = 0; col < line.length; col++) {
        if (line.charAt(col) !== '*') continue;
        consider(row, col, 1);
      }
    });

    return best ? { row: best.row, col: best.col } : null;
  }

  function findPlayerCellFromBorderGeometry(plainLines) {
    if (!Array.isArray(plainLines) || !plainLines.length) return null;

    var firstBody = -1;
    for (var i = 0; i < plainLines.length; i++) {
      if (/^[|│] /.test(plainLines[i])) {
        firstBody = i;
        break;
      }
    }
    if (firstBody < 0) return null;

    var bodyCount = 0;
    for (var j = firstBody; j < plainLines.length; j++) {
      var line = plainLines[j] || '';
      if (!/^[|│] /.test(line)) break;
      bodyCount++;
    }
    if (bodyCount < 3 || (bodyCount % 3) !== 0) return null;

    var sample = plainLines[firstBody] || '';
    if (sample.length < 4) return null;
    var interiorWidth = sample.length - 3; // left border + space + interior + right border
    if (interiorWidth < 4 || ((interiorWidth - 1) % 3) !== 0) return null;

    var roomsX = (interiorWidth - 1) / 3;
    var roomsY = bodyCount / 3;
    if (roomsX <= 0 || roomsY <= 0 || roomsX !== roomsY) return null;

    var centerRoomX = Math.floor(roomsX / 2);
    var centerRoomY = Math.floor(roomsY / 2);

    var row = firstBody + (centerRoomY * 3) + 1;
    var col = 2 + (centerRoomX * 3) + 1;
    return { row: row, col: col };
  }

  function visibleColumnAtRawIndex(rawLine, rawIndex) {
    if (rawLine == null) return 0;
    var prefix = String(rawLine).slice(0, Math.max(0, rawIndex | 0));
    return stripAnsiAndControls(prefix).length;
  }

  function stripAnsiAndControls(line) {
    if (line == null) return '';
    var text = String(line)
      .replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, '');

    // Preserve escaped literal '{' before removing MUD color tokens.
    text = text.replace(/\{\{/g, '\u0000');
    // Strip MUD color tokens like {Y {x {D, etc.
    text = text.replace(/\{./g, '');
    return text.replace(/\u0000/g, '{');
  }

  function normalizeMapAnsiForRender(value) {
    var text = mapAnsiFromPayload(value);
    if (text == null) return '';
    text = String(text);

    var trimmed = text.trim();
    if (trimmed && trimmed.charAt(0) === '{' && trimmed.indexOf('"ansi"') >= 0) {
      try {
        var parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.ansi === 'string') {
          text = parsed.ansi;
        }
      } catch (_) {
        var m = trimmed.match(/"ansi"\s*:\s*"([\s\S]*?)"\s*(,|})/);
        if (m && m[1]) {
          try {
            text = JSON.parse('"' + m[1].replace(/"/g, '\\"') + '"');
          } catch (_) {
            text = m[1];
          }
        }
      }
    }

    if (text.indexOf('\\n') >= 0 || text.indexOf('\\r') >= 0) {
      text = text
        .replace(/\\r\\n|\\n\\r/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n');
    }

    text = decodeLeakedJsonEscapes(text);
    text = extractBorderedMapBlock(text);
    return text;
  }

  function decodeLeakedJsonEscapes(text) {
    if (typeof text !== 'string' || text.indexOf('\\') < 0) return text;
    var out = text;
    for (var i = 0; i < 2; i++) {
      var prev = out;
      out = out
        .replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
          var code = parseInt(hex, 16);
          return isNaN(code) ? _ : String.fromCharCode(code);
        })
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/')
        .replace(/\\\\/g, '\\');
      if (out === prev) break;
    }
    return out;
  }

  function extractBorderedMapBlock(text) {
    if (typeof text !== 'string' || !text) return '';
    var lines = String(text).split(/\r?\n/);
    if (!lines.length) return text;

    function isTopBorder(line) {
      var s = stripAnsiAndControls(line || '').trim();
      if (!s) return false;
      var starts = s.charAt(0);
      var ends = s.charAt(s.length - 1);
      return (starts === '+' && ends === '+') || (starts === '╔' && ends === '╗');
    }

    function isBottomBorder(line) {
      var s = stripAnsiAndControls(line || '').trim();
      if (!s) return false;
      var starts = s.charAt(0);
      var ends = s.charAt(s.length - 1);
      return (starts === '+' && ends === '+') || (starts === '╚' && ends === '╝');
    }

    var top = -1;
    for (var i = 0; i < lines.length; i++) {
      if (isTopBorder(lines[i])) {
        top = i;
        break;
      }
    }
    if (top < 0) return text;

    var bottom = -1;
    for (var j = top + 1; j < lines.length; j++) {
      if (isBottomBorder(lines[j])) {
        bottom = j;
        break;
      }
    }
    if (bottom < 0 || bottom <= top) return text;

    return lines.slice(top, bottom + 1).join('\n');
  }

  function tryConsumeMapRenderBlob(rawText) {
    if (typeof rawText !== 'string') return false;
    var text = rawText.trim();
    if (!text) return false;

    var lower = text.toLowerCase();
    if (lower.indexOf('map.render') === 0) {
      text = text.slice('map.render'.length).trim();
      lower = text.toLowerCase();
    }

    if (lower.indexOf('"ansi"') < 0 && lower.indexOf('"map.render"') < 0) {
      return false;
    }

    var ansi = normalizeMapAnsiForRender(text);
    if (!ansi) return false;

    updateMapRender({ ansi: ansi, timestamp: Math.floor(Date.now() / 1000) });
    return true;
  }

  function pushChannelMessage(data) {
    var entry = {
      channel: String(data.channel || 'channel'),
      talker: String(data.talker || 'Unknown'),
      text: String(data.text || ''),
      direction: String(data.direction || ''),
      language: String(data.language || ''),
    };

    state.gmcp.channels.push(entry);
    if (state.gmcp.channels.length > 120) {
      state.gmcp.channels = state.gmcp.channels.slice(state.gmcp.channels.length - 120);
    }
    pulsePkgBadge('channels', 'Comm.Channel.Text');
    renderChannelsPanel();
  }

  function renderChannelsPanel() {
    if (!el.channelsLog) return;
    var msgs = filteredChannelMessages();
    updateChannelTabs();

    if (!msgs.length) {
      var emptyLabel = channelTabLabel(state.gmcp.channelTab);
      el.channelsLog.className = 'ph-centered';
      el.channelsLog.innerHTML =
        '<div class="ph-icon" aria-hidden="true">&#8779;</div>' +
        '<div class="ph-title">' + escHtml(emptyLabel) + '</div>' +
        '<div class="ph-sub">No messages in this tab yet</div>';
      return;
    }

    el.channelsLog.className = 'channels-list';
    el.channelsLog.innerHTML = '';

    msgs.forEach(function (msg) {
      var card = document.createElement('div');
      card.className = 'channel-entry';
      var dir = msg.direction ? (' · ' + msg.direction) : '';
      var lang = msg.language ? msg.language : '';
      var styleClass = channelToneClass(msg.channel);
      var utteranceColor = channelUtteranceColor(msg.channel);
      var showSpeaker = !isSystemChannel(msg.channel);
      var speakerHtml = showSpeaker
        ? ('<span class="channel-speaker">' + escHtml(msg.talker) + ':</span> ')
        : '';
      card.innerHTML =
        '<div class="channel-head">' +
          '<span class="channel-name">' + escHtml(msg.channel) + dir + '</span>' +
          '<span class="channel-lang">' + escHtml(lang) + '</span>' +
        '</div>' +
        '<div class="channel-body">' + speakerHtml + '<span class="channel-utterance ' + styleClass + '" style="color:' + escHtml(utteranceColor) + '">' + escHtml(msg.text) + '</span></div>';
      el.channelsLog.appendChild(card);
    });

    el.channelsLog.scrollTop = el.channelsLog.scrollHeight;
  }

  function setChannelTab(tabId) {
    var next = String(tabId || 'all').toLowerCase();
    if (next !== 'all' && next !== 'world' && next !== 'comms' && next !== 'system') {
      next = 'all';
    }
    state.gmcp.channelTab = next;
    renderChannelsPanel();
  }

  function updateChannelTabs() {
    if (!el.channelsTabs) return;
    var active = state.gmcp.channelTab || 'all';
    var counts = {
      all: state.gmcp.channels.length,
      world: 0,
      comms: 0,
      system: 0,
    };

    state.gmcp.channels.forEach(function (msg) {
      var bucket = channelBucket(msg.channel);
      if (counts[bucket] != null) counts[bucket] += 1;
    });

    Array.prototype.forEach.call(el.channelsTabs.querySelectorAll('[data-channel-tab]'), function (btn) {
      var tab = btn.dataset.channelTab;
      var selected = tab === active;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      var label = channelTabLabel(tab);
      var count = counts[tab] != null ? counts[tab] : 0;
      btn.textContent = label + ' (' + count + ')';
    });
  }

  function filteredChannelMessages() {
    var tab = state.gmcp.channelTab || 'all';
    if (tab === 'all') return state.gmcp.channels.slice();
    return state.gmcp.channels.filter(function (msg) {
      return channelBucket(msg.channel) === tab;
    });
  }

  function channelBucket(channelName) {
    if (isSystemChannel(channelName)) return 'system';
    if (isWorldChannel(channelName)) return 'world';
    return 'comms';
  }

  function channelToneClass(channelName) {
    if (isSystemChannel(channelName)) return 'tone-system';
    if (isWorldChannel(channelName)) {
      var key = normalizeChannel(channelName);
      if (key.indexOf('yell') === 0) return 'tone-yell';
      if (key.indexOf('tell') === 0) return 'tone-tell';
      if (key.indexOf('group') === 0) return 'tone-group';
      return 'tone-say';
    }
    var commKey = normalizeChannel(channelName);
    if (commKey.indexOf('cabal') === 0) return 'tone-cabal';
    if (commKey.indexOf('clan') === 0) return 'tone-clan';
    if (commKey.indexOf('newb') === 0) return 'tone-newb';
    if (commKey.indexOf('auction') === 0) return 'tone-auction';
    return 'tone-comms';
  }

  function channelUtteranceColor(channelName) {
    var key = normalizeChannel(channelName);

    // World channels from act_comm.c templates
    if (key === 'say' || key === 'says') return ansi16Color(11);       // {Y
    if (key.indexOf('yell') === 0) return ansi16Color(6);               // {c
    if (key.indexOf('tell') === 0 || key.indexOf('reply') === 0) return ansi16Color(2); // {g
    if (key.indexOf('group') === 0 || key === 'gtell') return ansi16Color(13); // {M

    // Comms channels from act_comm.c / auction.c templates
    if (key.indexOf('newb') === 0 || key.indexOf('newbie') === 0) return ansi16Color(14); // {C
    if (key === 'imm' || key.indexOf('immtalk') === 0) return ansi16Color(9);   // {R
    if (key === 'imp' || key.indexOf('imptalk') === 0) return ansi16Color(10);  // {G
    if (key === 'clan' || key === 'cc' || key.indexOf('clan') === 0) return ansi16Color(12); // {B
    if (key === 'cabal' || key === 'cb' || key.indexOf('cabal') === 0) return ansi16Color(6); // {c
    if (key === 'jcabal') return ansi16Color(12);                        // {B
    if (key.indexOf('auction') === 0 || key === 'achat') return ansi16Color(6); // {c

    // System channel from wiznet formatter ({M payload)
    if (key.indexOf('wiznet') === 0) return ansi16Color(13);            // {M

    // Other gmcp channels in ActCommRegistrar
    if (key.indexOf('pray') === 0) return ansi16Color(15);              // {W
    if (key.indexOf('question') === 0 || key.indexOf('answer') === 0) return ansi16Color(6); // {c
    if (key.indexOf('broadcast') === 0) return ansi16Color(11);         // {Y default branch

    return ansi16Color(7);
  }

  function ansi16Color(index) {
    var idx = Math.max(0, Math.min(15, index | 0));
    if (state.ansiPalette && state.ansiPalette[idx]) return state.ansiPalette[idx];
    if (state.settings && state.settings.palette16 && state.settings.palette16[String(idx)]) {
      return state.settings.palette16[String(idx)];
    }
    return DEFAULT_16[idx] || '#c0c0c0';
  }

  function isSystemChannel(channelName) {
    var key = normalizeChannel(channelName);
    return key.indexOf('wiznet') === 0;
  }

  function isWorldChannel(channelName) {
    var key = normalizeChannel(channelName);
    return key === 'say'
      || key === 'says'
      || key.indexOf('yell') === 0
      || key.indexOf('group') === 0
      || key.indexOf('tell') === 0;
  }

  function normalizeChannel(channelName) {
    return String(channelName || '').toLowerCase().trim();
  }

  function channelTabLabel(tabId) {
    if (tabId === 'world') return 'World';
    if (tabId === 'comms') return 'Comms';
    if (tabId === 'system') return 'System';
    return 'All';
  }

  function updateGroupInfo(data) {
    state.gmcp.groupInfo = data;
    pulsePkgBadge('party', 'Group.Info');
    renderPartyPanel();
  }

  function updateCharStatus(data) {
    state.gmcp.charStatus = data;
    updateVitalsPosition(data.position != null ? data.position : data.pos);
    pulsePkgBadge('status', 'Char.Status');
    renderLanguageUi();
    renderStatusPanel();
  }

  function updateCharStats(data) {
    state.gmcp.charStats = data;
    pulsePkgBadge('status', 'Char.Stats');
    renderStatusPanel();
  }

  function updateCharWorth(data) {
    state.gmcp.charWorth = data;
    pulsePkgBadge('status', 'Char.Worth');
    renderStatusPanel();
  }

  function updateCharAffects(data) {
    state.gmcp.charAffects = data;
    pulsePkgBadge('status', 'Char.Affects');
    renderStatusPanel();
  }

  function updateCharCombat(data) {
    state.gmcp.charCombat = data;
    if (state.combatStaleTimer) {
      clearTimeout(state.combatStaleTimer);
      state.combatStaleTimer = null;
    }

    pulsePkgBadge('status', 'Char.Combat');
    pulsePkgBadge('targets', 'Char.Combat');
    renderStatusPanel();
    renderTargetsPanel();
  }

  function renderTargetsPanel() {
    if (!el.targetsPanelBody) return;
    var c = state.gmcp.charCombat || {};
    var targets = Array.isArray(c.targets) ? c.targets : [];
    if (!targets.length) {
      el.targetsPanelBody.className = 'panel-body ph-centered';
      el.targetsPanelBody.innerHTML =
        '<div class="ph-icon" aria-hidden="true">&#9678;</div>' +
        '<div class="ph-title">Targets</div>' +
        '<div class="ph-sub">No active combat targets</div>';
      return;
    }

    el.targetsPanelBody.className = 'panel-body targets-list';
    el.targetsPanelBody.innerHTML = '';
    targets.forEach(function (t) {
      var name = String(t.name || 'Unknown');
      var targeting = String(t.targeting || 'nobody');
      var condition = String(t.condition || 'unknown');
      var hpPct = Math.max(0, Math.min(100, numOr(t.hp_pct, 0)));
      var card = document.createElement('div');
      card.className = 'target-card';
      card.innerHTML =
        '<div class="target-head">' +
          '<span class="target-name">' + escHtml(name) + '</span>' +
          '<span class="target-cond">' + escHtml(condition) + '</span>' +
        '</div>' +
        '<div class="target-meta">Targeting: ' + escHtml(targeting) + '</div>' +
        gaugeHtml('HP', hpPct, 'hp');
      el.targetsPanelBody.appendChild(card);
    });
  }

  function updateInventory(data) {
    state.gmcp.inventory = Array.isArray(data.items) ? data.items : [];
    pulsePkgBadge('inventory', 'Char.Inventory');
    renderInventoryPanel();
  }

  function updateEquipment(data) {
    state.gmcp.equipment = Array.isArray(data.slots) ? data.slots : [];
    pulsePkgBadge('equipment', 'Char.Equipment');
    renderEquipmentPanel();
  }

  function renderPartyPanel() {
    if (!el.partyList) return;
    var grp = state.gmcp.groupInfo;
    if (!grp || !Array.isArray(grp.members) || !grp.members.length) return;

    var leader = String(grp.leader || '');
    el.partyList.className = 'panel-body party-list';
    el.partyList.innerHTML = '';

    grp.members.forEach(function (m) {
      var name = String(m.name || 'Unknown');
      var lvl = numOr(m.level, 0);
      var cls = String(m.class || (m.is_npc ? 'mob' : ''));
      var race = String(m.race || 'unknown');
      var tnl = Math.max(0, numOr(m.tnl, 0));
      var align = String(m.alignment_name || alignmentName(numOr(m.alignment, 0)));
      var ethos = String(m.ethos || 'none');
      var area = String(m.area || 'Unknown Area');
      var roomName = String(m.room_name || m.room_id || 'Unknown Room');
      var leadMark = (leader && leader === name) ? ' ★' : '';
      var wimpy = Math.max(0, numOr(m.wimpy, 0));

      var hpPct = pct(numOr(m.hp_pct, 0), 100);
      var mpPct = pct(numOr(m.mana_pct, 0), 100);
      var mvPct = pct(numOr(m.mv_pct, 0), 100);

      var maxHp = Math.max(1, numOr(m.maxhp, 1));
      var wimpyPct = maxHp > 0 ? Math.max(0, Math.min(100, Math.floor((wimpy * 100) / maxHp))) : 0;

      var card = document.createElement('div');
      card.className = 'party-card';
      card.innerHTML =
        '<div class="party-head">' +
          '<span class="party-name">' + escHtml(name + leadMark) + '</span>' +
          '<span class="party-tags">Lv ' + lvl + ' · ' + escHtml(race) + ' · ' + escHtml(cls) + '</span>' +
        '</div>' +
        '<div class="party-substats">TNL ' + tnl + ' · ' + escHtml(align) + ' · ' + escHtml(ethos) + '</div>' +
        '<div class="party-loc">' + escHtml(area) + ' · ' + escHtml(roomName) + '</div>' +
        '<div class="party-bars">' +
          gaugeHtml('HP', hpPct, 'hp', { markerPct: wimpyPct, markerLabel: wimpy > 0 ? ('W ' + wimpy) : '' }) +
          gaugeHtml('MP', mpPct, 'mp') +
          gaugeHtml('MV', mvPct, 'mv') +
        '</div>';
      el.partyList.appendChild(card);
    });
  }

  function renderStatusPanel() {
    if (!el.statusPanelBody) return;
    var s = state.gmcp.charStatus || {};
    var st = state.gmcp.charStats || {};
    var w = state.gmcp.charWorth || {};
    var af = state.gmcp.charAffects || {};
    var cb = state.gmcp.charCombat || {};

    var hasAny = Object.keys(s).length || Object.keys(st).length || Object.keys(w).length
      || Object.keys(af).length || Object.keys(cb).length;
    if (!hasAny) return;

    el.statusPanelBody.className = 'panel-body status-panel';
    var groupedAffects = groupAffects(Array.isArray(af.affects) ? af.affects : []);
    var affectsCount = groupedAffects.length;
    var combatCount = Array.isArray(cb.targets) ? cb.targets.length : 0;
    var affectsView = (state.settings && state.settings.affectsView === 'icons') ? 'icons' : 'details';
    var affectsHtml = affectsView === 'icons'
      ? renderAffectsIconGrid(groupedAffects)
      : renderAffectsDetails(groupedAffects);

    var vit = state.gmcp.vitals || {};
    var hpPct = pct(numOr(vit.hp, 0), Math.max(1, numOr(vit.maxhp, 1)));
    var mpPct = pct(numOr(vit.mana, 0), Math.max(1, numOr(vit.maxmana, 1)));
    var mvPct = pct(numOr(vit.move, 0), Math.max(1, numOr(vit.maxmove, 1)));
    var hungerPct = pct(numOr(vit.hunger, 0), 48);
    var thirstPct = pct(numOr(vit.thirst, 0), 48);
    var hungerCritical = isNeedCritical(vit.hunger, s.hunger, 'starving');
    var thirstCritical = isNeedCritical(vit.thirst, s.thirst, 'parched');
    var xpVal = numOr(s.xp, 0);
    var tnlVal = numOr(s.tnl, 0);
    var xpGoal = Math.max(1, xpVal + tnlVal);
    var xpPct = pct(xpVal, xpGoal);
    var title = String(s.title || '').trim();
    var displayName = String(s.name || 'Unknown') + (title ? (' ' + title) : '');
    var levelRaceClass = 'Level ' + numOr(s.level, 0)
      + ' ' + escHtml(titleCaseWords(String(s.race || '?')))
      + ' ' + escHtml(titleCaseWords(String(s.class || '?')));

    el.statusPanelBody.innerHTML =
      '<div class="status-grid">'
      + '<div class="status-card status-card-identity">'
      + '<div class="status-title">Identity</div>'
      + '<div class="status-lines">'
      + '<div class="status-identity-name">' + escHtml(displayName) + '</div>'
      + '<div class="status-identity-line">' + levelRaceClass + '</div>'
      + '<div class="status-identity-line">TNL ' + tnlVal + ' · XP ' + xpVal + '</div>'
      + '<div class="status-affect-timer status-xp-timer" title="XP progress to next level">'
      + '<div class="status-affect-timer-fill status-xp-fill" style="width:' + xpPct + '%"></div>'
      + '</div>'
      + '<div class="status-needs">'
      + renderNeedBar('hunger', hungerPct, hungerCritical, 'Hunger')
      + renderNeedBar('thirst', thirstPct, thirstCritical, 'Thirst')
      + '</div>'
      + '</div>'
      + '</div>'
      + statusCard('Stats', [
        'Gold: ' + numOr(w.gold, 0) + ' · Bank: ' + numOr(w.bank_gold, 0),
        'Cabal Pts: ' + numOr(w.cabal_points, 0),
        'Practice/Train: ' + numOr(s.practice, 0) + ' / ' + numOr(s.trains, 0),
        'Hit/Dam: ' + numOr(st.hitroll, 0) + ' / ' + numOr(st.damroll, 0),
        'STR INT WIS DEX CON: ' + [numOr(st.str, 0), numOr(st.int, 0), numOr(st.wis, 0), numOr(st.dex, 0), numOr(st.con, 0)].join(' '),
        'Affects: ' + affectsCount + ' · Targets: ' + combatCount,
      ])
      + '</div>'
      + '<div class="status-affects">'
      + '<div class="status-head-row">'
      + '<div class="status-title">Affects</div>'
      + '<div class="status-affects-toggle" role="group" aria-label="Affects view">'
      + '<button type="button" class="status-toggle-btn' + (affectsView === 'details' ? ' active' : '') + '" data-affects-view="details">Details</button>'
      + '<button type="button" class="status-toggle-btn' + (affectsView === 'icons' ? ' active' : '') + '" data-affects-view="icons">Icons</button>'
      + '</div>'
      + '</div>'
      + affectsHtml
      + '</div>';
  }

  function renderAffectsDetails(groupedAffects) {
    if (!groupedAffects.length) return '<div class="status-empty">No active affects.</div>';
    return groupedAffects.map(function (a) {
      var modText = a.mods.length ? a.mods.join(' · ') : 'none';
      var levelText = a.level > 0 ? ('L' + a.level) : 'L0';
      return '<div class="status-affect">'
        + '<span class="status-affect-kind">' + escHtml(a.kind) + '</span>'
        + '<span class="status-affect-name">' + escHtml(a.name) + '</span>'
        + '<span class="status-affect-meta">' + escHtml(a.durationLabel) + ' · ' + escHtml(levelText) + ' · ' + escHtml(modText) + '</span>'
        + '<div class="status-affect-timer">'
        + '<div class="status-affect-timer-fill' + (a.permanent ? ' perm' : '') + '" style="width:' + a.timerPct + '%"></div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function renderAffectsIconGrid(groupedAffects) {
    if (!groupedAffects.length) return '<div class="status-empty">No active affects.</div>';

    var sorted = groupedAffects.slice().sort(function (a, b) {
      var ad = a.permanent ? Number.MAX_SAFE_INTEGER : numOr(a.duration, 0);
      var bd = b.permanent ? Number.MAX_SAFE_INTEGER : numOr(b.duration, 0);
      if (bd !== ad) return bd - ad;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return '<div class="status-affects-grid">' + sorted.map(function (a) {
      var iconText = String(a.name || '?').trim().charAt(0).toUpperCase() || '?';
      var timerText = a.permanent ? '∞' : escHtml(a.durationLabel);
      var tooltipParts = [
        String(a.name || 'Unknown effect'),
        'Type: ' + String(a.kind || 'spell'),
        'Duration: ' + String(a.durationLabel || (a.permanent ? 'perm' : 'unknown')),
      ];
      if (a.mods.length) {
        tooltipParts.push('Effects:');
        a.mods.forEach(function (mod) {
          tooltipParts.push('• ' + String(mod || ''));
        });
      } else {
        tooltipParts.push('Effects: No stat modifiers listed');
      }
      var tooltip = tooltipParts.join('\n');
      return '<div class="status-affect-icon">'
        + '<div class="status-affect-icon-hit" data-tooltip="' + escHtml(tooltip) + '"></div>'
        + '<div class="status-affect-glyph">' + escHtml(iconText) + '</div>'
        + '<div class="status-affect-icon-name">' + escHtml(a.name) + '</div>'
        + '<div class="status-affect-icon-time">' + timerText + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function ensureFloatingTooltip() {
    if (el.floatingTooltip && document.body.contains(el.floatingTooltip)) return el.floatingTooltip;
    var node = document.createElement('div');
    node.id = 'status-floating-tooltip';
    node.hidden = true;
    document.body.appendChild(node);
    el.floatingTooltip = node;
    return node;
  }

  function showFloatingTooltip(icon, text) {
    var tip = ensureFloatingTooltip();
    var lines = String(text || '').split(/\n+/).filter(Boolean);
    tip.innerHTML = lines.map(function (line) {
      return '<div class="status-floating-tooltip-line">' + escHtml(line) + '</div>';
    }).join('');
    tip.hidden = false;
    state.floatingTooltip.visible = true;
    positionFloatingTooltip(icon);
  }

  function hideFloatingTooltip() {
    if (!el.floatingTooltip) return;
    el.floatingTooltip.hidden = true;
    state.floatingTooltip.visible = false;
    state.floatingTooltip.anchorRect = null;
  }

  function positionFloatingTooltip(icon) {
    if (!icon || !el.floatingTooltip || el.floatingTooltip.hidden) return;
    var rect = icon.getBoundingClientRect();
    state.floatingTooltip.anchorRect = rect;
    var tip = el.floatingTooltip;
    var margin = 10;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;

    tip.style.left = '0px';
    tip.style.top = '0px';
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;

    var left = rect.left + (rect.width / 2) - (tw / 2);
    left = Math.max(margin, Math.min(vw - tw - margin, left));

    var top = rect.top - th - 12;
    if (top < margin) {
      top = Math.min(vh - th - margin, rect.bottom + 12);
    }

    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function renderNeedBar(kind, pctVal, critical, label) {
    var pctNum = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    var fillClass = kind === 'hunger' ? 'status-need-fill-hunger' : 'status-need-fill-thirst';
    return '<div class="status-need-col status-need-' + escHtml(kind) + '">'
      + '<div class="status-need-label">' + escHtml(label) + '</div>'
      + '<div class="status-affect-timer status-need-timer" title="' + escHtml(label) + ' ' + Math.round(pctNum) + '%">'
      + '<div class="status-affect-timer-fill status-need-fill ' + fillClass + (critical ? ' critical' : '') + '" style="width:' + pctNum + '%"></div>'
      + '</div>'
      + '</div>';
  }

  function isNeedCritical(rawValue, labelValue, dangerToken) {
    if (rawValue != null && numOr(rawValue, 0) <= 0) return true;
    if (typeof labelValue === 'string' && labelValue.toLowerCase().indexOf(String(dangerToken).toLowerCase()) >= 0) return true;
    return false;
  }

  function titleCaseWords(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(function (w) {
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }

  function hpConditionName(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    if (p >= 90) return 'Healthy';
    if (p >= 70) return 'Fine';
    if (p >= 50) return 'Hurt';
    if (p >= 30) return 'Wounded';
    if (p >= 15) return 'Bad';
    if (p >= 1) return 'Awful';
    return 'Dying';
  }

  function manaConditionName(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    if (p >= 95) return 'Full';
    if (p >= 75) return 'Strong';
    if (p >= 55) return 'Focused';
    if (p >= 35) return 'Low';
    if (p >= 15) return 'Thin';
    return 'Drained';
  }

  function moveConditionName(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    if (p >= 95) return 'Unwearied';
    if (p >= 75) return 'Steadfast';
    if (p >= 55) return 'Rested';
    if (p >= 35) return 'Tired';
    if (p >= 15) return 'Weak';
    return 'Exhausted';
  }

  function hungerConditionName(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    if (p >= 75) return 'Sated';
    if (p >= 50) return 'Peckish';
    if (p >= 25) return 'Hungry';
    return 'Starving';
  }

  function thirstConditionName(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    if (p >= 75) return 'Quenched';
    if (p >= 50) return 'Dry';
    if (p >= 25) return 'Thirsty';
    return 'Parched';
  }

  function groupAffects(affects) {
    var groups = Object.create(null);
    var order = [];

    affects.forEach(function (a) {
      var name = String((a && a.name) || 'unknown');
      var duration = parseInt(a && a.duration, 10);
      if (isNaN(duration)) duration = 0;
      var kind = String((a && a.kind) || 'spell');
      var key = name.toLowerCase() + '|' + duration;

      if (!groups[key]) {
        var timer = affectTimerState(name, kind, duration);
        groups[key] = {
          name: name,
          kind: kind,
          duration: duration,
          durationLabel: affectDurationLabel(duration),
          timerPct: timer.pct,
          permanent: timer.permanent,
          level: parseInt((a && a.level), 10) || 0,
          mods: [],
          _seenMods: Object.create(null),
        };
        order.push(key);
      }

      if ((parseInt(a && a.level, 10) || 0) > groups[key].level) {
        groups[key].level = parseInt(a.level, 10) || groups[key].level;
      }

      var loc = String((a && a.location) || 'none');
      var mod = parseInt(a && a.modifier, 10);
      if (isNaN(mod)) mod = 0;
      var modLine = loc + ' ' + formatSigned(mod);
      var seenKey = loc + '|' + mod;
      if (!groups[key]._seenMods[seenKey]) {
        groups[key]._seenMods[seenKey] = true;
        groups[key].mods.push(modLine);
      }
    });

    return order.map(function (k) {
      var g = groups[k];
      delete g._seenMods;
      return g;
    });
  }

  function affectDurationLabel(duration) {
    if (duration < 0) return 'perm';
    return String(duration) + 'h';
  }

  function affectTimerState(name, kind, duration) {
    if (duration < 0) return { pct: 100, permanent: true };
    var key = String(name || 'unknown').toLowerCase() + '|' + String(kind || 'spell').toLowerCase();
    var ceiling = Math.max(1, numOr(state.affectDurationCeilings[key], 0));
    if (duration > ceiling) {
      ceiling = duration;
      state.affectDurationCeilings[key] = ceiling;
    }
    var pctRemain = Math.floor((Math.max(0, duration) * 100) / Math.max(1, ceiling));
    return { pct: Math.max(5, Math.min(100, pctRemain)), permanent: false };
  }

  function formatSigned(value) {
    var n = parseInt(value, 10) || 0;
    return (n >= 0 ? '+' : '') + String(n);
  }

  function extractMoonNames(worldMoons) {
    var out = [];
    if (!worldMoons || typeof worldMoons !== 'object') return out;
    Object.keys(worldMoons).forEach(function (name) {
      var moon = worldMoons[name];
      if (!moon || typeof moon !== 'object') return;
      var phase = moon.phase_name ? String(moon.phase_name) : '';
      if (!phase) return;
      out.push(name + ': ' + phase);
    });
    return out;
  }

  function renderInventoryPanel() {
    if (!el.inventoryPanelBody) return;
    var items = state.gmcp.inventory || [];
    if (!items.length) {
      el.inventoryPanelBody.className = 'panel-body ph-centered';
      el.inventoryPanelBody.innerHTML =
        '<div class="ph-icon" aria-hidden="true">&#9636;</div>' +
        '<div class="ph-title">Inventory</div>' +
        '<div class="ph-sub">No carried items in snapshot</div>';
      return;
    }

    el.inventoryPanelBody.className = 'panel-body item-panel';
    el.inventoryPanelBody.innerHTML = '';
    items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML =
        '<span class="item-icon" aria-hidden="true">&#128717;</span>' +
        '<span class="item-name">' + escHtml(String(it.name || 'Unknown item')) + '</span>' +
        '<span class="item-meta">' + escHtml(String(it.type || '')) + '</span>';
      el.inventoryPanelBody.appendChild(row);
    });
  }

  function renderEquipmentPanel() {
    if (!el.equipmentPanelBody) return;
    var slots = state.gmcp.equipment || [];
    if (!slots.length) {
      el.equipmentPanelBody.className = 'panel-body ph-centered';
      el.equipmentPanelBody.innerHTML =
        '<div class="ph-icon" aria-hidden="true">&#9876;</div>' +
        '<div class="ph-title">Equipment</div>' +
        '<div class="ph-sub">No equipped items in snapshot</div>';
      return;
    }

    el.equipmentPanelBody.className = 'panel-body item-panel';
    el.equipmentPanelBody.innerHTML = '';
    slots.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML =
        '<span class="item-icon" aria-hidden="true">&#9876;</span>' +
        '<span class="item-name">' + escHtml(String(it.name || 'Unknown item')) + '</span>' +
        '<span class="item-meta">' + escHtml(String(it.slot || '')) + '</span>';
      el.equipmentPanelBody.appendChild(row);
    });
  }

  function statusCard(title, lines) {
    return '<div class="status-card">'
      + '<div class="status-title">' + escHtml(title) + '</div>'
      + '<div class="status-lines">' + lines.map(function (line) {
        return '<div>' + line + '</div>';
      }).join('') + '</div>'
      + '</div>';
  }

  function pulsePkgBadge(panelId, pkg) {
    var badge = getPkgBadgeEl(panelId);
    if (!badge) return;
    if (pkg) {
      badge.textContent = '📦 ' + pkg;
    }
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }

  function getPkgBadgeEl(panelId) {
    if (panelId === 'map') return el.pkgMap;
    if (panelId === 'channels') return el.pkgChannels;
    if (panelId === 'party') return el.pkgParty;
    if (panelId === 'status') return el.pkgStatus;
    if (panelId === 'targets') return el.pkgTargets;
    if (panelId === 'inventory') return el.pkgInventory;
    if (panelId === 'equipment') return el.pkgEquipment;
    return null;
  }

  function setSegmentGauge(segNodes, pctVal, kind) {
    if (!segNodes || !segNodes.length) return;
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    var cls = gaugeKindClass(kind);
    var hpColor = (cls === 'hp' || cls === 'opponent') ? healthColorByPct(p) : '';
    var totalSeg = p / 20;
    var full = Math.floor(totalSeg);
    var partial = (totalSeg - full) * 100;
    for (var i = 0; i < segNodes.length; i++) {
      var w = 0;
      if (i < full) {
        w = 100;
      } else if (i === full && full < 5) {
        w = partial;
      }
      segNodes[i].style.width = w + '%';
      if (hpColor) {
        segNodes[i].style.color = hpColor;
      } else {
        segNodes[i].style.removeProperty('color');
      }
    }
  }

  function healthColorByPct(pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    var lightness = 70 - Math.round((p / 100) * 34);
    return 'hsl(0 82% ' + lightness + '%)';
  }

  function gaugeKindClass(kind) {
    if (kind === 'mp') return 'mana';
    if (kind === 'mv') return 'move';
    return kind;
  }

  function updateVitalsPosition(rawPos) {
    if (!el.vPos) return;
    var source = rawPos;
    if (source == null) {
      var cs = state.gmcp.charStatus || {};
      source = cs.position != null ? cs.position : cs.pos;
    }
    if (source == null) {
      var v = state.gmcp.vitals || {};
      source = v.position != null ? v.position : v.pos;
    }
    var out = String(source == null ? 'standing' : source)
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    if (!out) out = 'standing';
    el.vPos.textContent = out.charAt(0).toUpperCase() + out.slice(1);
  }

  function renderLanguageUi() {
    if (!el.btnLanguage) return;
    var snapshot = languageSnapshot();
    el.btnLanguage.textContent = snapshot.selected || 'Common';
    el.btnLanguage.title = 'Select spoken language (' + (snapshot.selected || 'Common') + ')';
    if (!el.languagePicker || el.languagePicker.hidden) {
      setLanguagePickerOpenState(false);
      return;
    }
    renderLanguagePickerList(snapshot);
    setLanguagePickerOpenState(true);
  }

  function languageSnapshot() {
    var s = state.gmcp.charStatus || {};
    var selected = String(
      s.selected_language != null ? s.selected_language
      : (s.selectedLanguage != null ? s.selectedLanguage
      : (s.language != null ? s.language : 'Common'))
    ).trim() || 'Common';

    var list = [];
    if (Array.isArray(s.languages)) {
      list = s.languages.map(function (entry) {
        if (entry == null) return null;
        if (typeof entry === 'string') {
          return { id: entry, proficiency: 0 };
        }
        return {
          id: String(entry.id != null ? entry.id : (entry.language || '')).trim(),
          proficiency: Math.max(0, Math.min(100, numOr(entry.proficiency, 0))),
        };
      }).filter(function (entry) {
        return entry && entry.id;
      });
    }

    if (!list.length && s.language_learned && typeof s.language_learned === 'object') {
      Object.keys(s.language_learned).forEach(function (key) {
        var id = String(key || '').trim();
        if (!id) return;
        list.push({ id: id, proficiency: Math.max(0, Math.min(100, numOr(s.language_learned[key], 0))) });
      });
    }

    if (!list.some(function (entry) { return entry.id.toLowerCase() === 'common'; })) {
      list.push({ id: 'Common', proficiency: 100 });
    }
    if (!list.some(function (entry) { return entry.id.toLowerCase() === selected.toLowerCase(); })) {
      list.push({ id: selected, proficiency: Math.max(0, Math.min(100, numOr(s.selected_language_proficiency, 0))) });
    }

    var byId = Object.create(null);
    list.forEach(function (entry) {
      var key = entry.id.toLowerCase();
      if (!byId[key] || entry.proficiency > byId[key].proficiency) {
        byId[key] = entry;
      }
    });

    var deduped = Object.keys(byId).map(function (key) { return byId[key]; });
    deduped.sort(function (a, b) { return a.id.localeCompare(b.id); });

    return { selected: selected, languages: deduped };
  }

  function toggleLanguagePicker() {
    if (!el.languagePicker) return;
    if (el.languagePicker.hidden) {
      openLanguagePicker();
      return;
    }
    closeLanguagePicker();
  }

  function openLanguagePicker() {
    if (!el.languagePicker) return;
    renderLanguagePickerList(languageSnapshot());
    el.languagePicker.hidden = false;
    setLanguagePickerOpenState(true);
  }

  function closeLanguagePicker() {
    if (!el.languagePicker) return;
    el.languagePicker.hidden = true;
    setLanguagePickerOpenState(false);
  }

  function setLanguagePickerOpenState(open) {
    if (!el.btnLanguage) return;
    el.btnLanguage.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.btnLanguage.dataset.open = open ? 'true' : 'false';
  }

  function renderLanguagePickerList(snapshot) {
    if (!el.languagePickerList) return;
    var selected = (snapshot && snapshot.selected) ? snapshot.selected : 'Common';
    var languages = (snapshot && Array.isArray(snapshot.languages)) ? snapshot.languages : [];
    if (!languages.length) {
      el.languagePickerList.innerHTML = '<button type="button" class="language-picker-item active" data-language-id="Common"><span class="language-picker-name">Common</span><span class="language-picker-prof">100%</span></button>';
      return;
    }

    el.languagePickerList.innerHTML = languages.map(function (entry) {
      var active = entry.id.toLowerCase() === selected.toLowerCase();
      return '<button type="button" class="language-picker-item' + (active ? ' active' : '') + '" data-language-id="' + escHtml(entry.id) + '">'
        + '<span class="language-picker-name">' + escHtml(entry.id) + '</span>'
        + '<span class="language-picker-prof">' + Math.max(0, Math.min(100, numOr(entry.proficiency, 0))) + '%</span>'
        + '</button>';
    }).join('');
  }

  function segmentedFillHtml(kind, pctVal) {
    var p = Math.max(0, Math.min(100, numOr(pctVal, 0)));
    var cls = gaugeKindClass(kind);
    var hpColor = (cls === 'hp' || cls === 'opponent') ? healthColorByPct(p) : '';
    var totalSeg = p / 20;
    var full = Math.floor(totalSeg);
    var partial = (totalSeg - full) * 100;
    var out = '';
    for (var i = 0; i < 5; i++) {
      var w = 0;
      if (i < full) {
        w = 100;
      } else if (i === full && full < 5) {
        w = partial;
      }
      var style = 'width:' + w + '%';
      if (hpColor) style += ';color:' + hpColor;
      out += '<div class="bar-segment-block"><div class="status-bar-fill ' + cls + '" style="' + style + '"></div></div>';
    }
    return out;
  }

  function gaugeHtml(label, pctVal, kind, opts) {
    opts = opts || {};
    var p = Math.max(0, Math.min(100, pctVal));
    var cls = gaugeKindClass(kind);
    var marker = '';
    var markerPct = Math.max(0, Math.min(100, numOr(opts.markerPct, -1)));
    if (markerPct >= 0 && opts.markerLabel) {
      marker = '<span class="wimpy-tick active" style="left:' + markerPct + '%" title="' + escHtml(String(opts.markerLabel)) + '"></span>';
    }
    return '<div class="party-gauge">'
      + '<div class="condition-badge ' + cls + '">'
      + '<div class="status-text">' + label + ' ' + p + '%</div>'
      + '<div class="status-bar-segment">'
      + '<div class="status-bar-segments-grid">' + segmentedFillHtml(kind, p) + '</div>'
      + marker
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function alignmentName(value) {
    var v = numOr(value, 0);
    if (v >= 350) return 'good';
    if (v <= -350) return 'evil';
    return 'neutral';
  }

  /* ═══════════════════════════════════════════════════════════════
     TEXT INGESTION & ANSI RENDERING
     ═══════════════════════════════════════════════════════════════ */

  function ingestMudText(chunk) {
    var text  = state.lineCarry + chunk;
    if (tryConsumeMapRenderBlob(text)) {
      state.lineCarry = '';
      if (state.partialRow) {
        try { el.terminal.removeChild(state.partialRow); } catch (_) {}
        state.partialRow = null;
      }
      return;
    }

    var lines = text.split(/\r?\n/);
    var trailing = lines.pop() || '';
    if (state.partialRow) {
      if (lines.length > 0) {
        var first = lines.shift();
        renderRowContent(state.partialRow, first, runTriggers(first));
        state.partialRow = null;
      } else {
        state.lineCarry = trailing; upsertPartialRow(state.lineCarry); return;
      }
    }
    lines.forEach(function (line) {
      if (tryConsumeMapRenderBlob(line)) return;
      appendAnsiLine(line, runTriggers(line));
    });

    if (tryConsumeMapRenderBlob(trailing)) {
      trailing = '';
    }

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
      } catch (_) {}
    });
    return highlighted;
  }

  function appendAnsiLine(line, highlighted) {
    var row = document.createElement('div');
    renderRowContent(row, line, highlighted);
    var atBottom = el.terminal.scrollTop + el.terminal.clientHeight >= el.terminal.scrollHeight - 40;
    el.terminal.appendChild(row);
    /* track raw data for session persistence (system + game lines) */
    state.scrollback.push({ line: line, highlighted: !!highlighted, time: nowTime() });
    trimTerminal();
    scheduleScrollbackSave();
    if (atBottom) el.terminal.scrollTop = el.terminal.scrollHeight;
    updateTerminalBottomButton();
  }

  function renderRowContent(row, line, highlighted) {
    row.className = highlighted ? 'line highlight' : 'line';
    row.innerHTML = '';
    if (state.settings.timestamps) {
      var ts = document.createElement('span');
      ts.className = 'ts'; ts.textContent = '[' + nowTime() + ']';
      row.appendChild(ts);
    }
    /* Wrap game output in .game-text so --terminal-wrap-width excludes the .ts stamp */
    var wrapper = document.createElement('span');
    wrapper.className = 'game-text';
    wrapper.appendChild(window.AnsiRenderer.renderAnsiLine(line, state.ansiPalette));
    row.appendChild(wrapper);
  }

  function upsertPartialRow(line) {
    if (!line) return;
    if (state.partialRow) { renderRowContent(state.partialRow, line, false); return; }
    var row = document.createElement('div');
    renderRowContent(row, line, false);
    var atBottom = el.terminal.scrollTop + el.terminal.clientHeight >= el.terminal.scrollHeight - 40;
    el.terminal.appendChild(row);
    state.partialRow = row;
    trimTerminal();
    if (atBottom) el.terminal.scrollTop = el.terminal.scrollHeight;
    updateTerminalBottomButton();
  }

  function trimTerminal() {
    var max = (state.settings.historyMax > 0) ? state.settings.historyMax : Infinity;
    while (el.terminal.childNodes.length > max) el.terminal.removeChild(el.terminal.firstChild);
    if (max !== Infinity && state.scrollback.length > max) {
      state.scrollback = state.scrollback.slice(state.scrollback.length - max);
    }
  }

  function appendSystem(text)   { appendAnsiLine('\x1b[1;36m[system]\x1b[0m ' + text, false); }
  function appendOutgoing(text) { appendAnsiLine('\x1b[1;35m>\x1b[0m ' + text, false); }

  /* ── Scrollback persistence ──────────────────────────────── */

  var _scrollbackTimer = null;
  function scheduleScrollbackSave() {
    if (_scrollbackTimer) return;
    _scrollbackTimer = setTimeout(function () {
      _scrollbackTimer = null;
      try {
        localStorage.setItem(SCROLLBACK_KEY, JSON.stringify(state.scrollback));
      } catch (_) { /* storage full — silently skip */ }
    }, 500);
  }

  function loadScrollback() {
    try {
      var raw = localStorage.getItem(SCROLLBACK_KEY);
      if (!raw) return;
      var items = JSON.parse(raw);
      if (!Array.isArray(items)) return;
      /* Rebuild in-memory scrollback directly (avoids double-push and re-triggers) */
      state.scrollback = items.filter(function (item) {
        return item && typeof item.line === 'string';
      }).map(function (item) {
        return { line: item.line, highlighted: !!item.highlighted, time: item.time || '' };
      });
      /* Render to DOM */
      state.scrollback.forEach(function (item) {
        var row = document.createElement('div');
        renderRowContent(row, item.line, item.highlighted);
        el.terminal.appendChild(row);
      });
      trimTerminal();
      el.terminal.scrollTop = el.terminal.scrollHeight;
      updateTerminalBottomButton();
    } catch (_) {}
  }

  function isTerminalAtBottom() {
    if (!el.terminal) return true;
    return el.terminal.scrollTop + el.terminal.clientHeight >= el.terminal.scrollHeight - 40;
  }

  function scrollTerminalToBottom() {
    if (!el.terminal) return;
    el.terminal.scrollTop = el.terminal.scrollHeight;
    updateTerminalBottomButton();
  }

  function updateTerminalBottomButton() {
    if (!el.btnTerminalBottom || !el.terminal) return;
    var hasOverflow = el.terminal.scrollHeight > el.terminal.clientHeight + 16;
    var atBottom = isTerminalAtBottom();
    el.btnTerminalBottom.hidden = !hasOverflow || atBottom;
  }

  /* ═══════════════════════════════════════════════════════════════
     COMMAND SENDING
     ═══════════════════════════════════════════════════════════════ */

  function submitInputCommand(raw) {
    var cmd = String(raw || '');
    if (state.settings.keepInput !== false) {
      requestAnimationFrame(function () { el.cmdInput.select(); });
    } else {
      el.cmdInput.value = '';
    }
    sendCommand(cmd);
  }

  function sendCommand(cmd, opts) {
    if (state.partialRow) { state.partialRow = null; state.lineCarry = ''; }
    opts = opts || {};
    var source = String(cmd || '');
    var out    = opts.skipAliases ? source : applyAliases(source);
    if (typeof out !== 'string') out = String(out || '');

    if (source.trim() === '' && out.trim() === '') {
      if (!opts.suppressEcho) appendOutgoing('');
      sendWs({ type: 'input', data: '\n' }); return;
    }

    var parts = splitStacked(out);
    if (!parts.length) return;

    if (!opts.skipHistory) { pushHistory(source); state.lastCmd = source; }

    parts.forEach(function (part) {
      if (!opts.suppressEcho) appendOutgoing(part);
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
      } catch (_) {}
    });
    return result;
  }

  function splitStacked(text) {
    var sep = sanitizeStackSep(state.settings && state.settings.stackSeparator);
    if (!sep) return [String(text || '')];
    return String(text || '').split(sep).map(function (p) { return p.trim(); }).filter(Boolean);
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
        state.historyIdx = -1; el.cmdInput.value = ''; return;
      }
    }
    el.cmdInput.value = state.cmdHistory[state.historyIdx] || '';
  }

  function pushHistory(cmd) {
    var clean = String(cmd || '').trim();
    if (!clean) return;
    if (state.cmdHistory[state.cmdHistory.length - 1] === clean) { state.historyIdx = -1; return; }
    state.cmdHistory.push(clean);
    if (state.cmdHistory.length > 200) state.cmdHistory.shift();
    state.historyIdx = -1;
  }
  /* ═══════════════════════════════════════════════════════════════
     SETTINGS IMPORT / EXPORT / RESET
     ═══════════════════════════════════════════════════════════════ */

  function exportSettings() {
    var payload = {
      schema: 'freign.play2.settings.export',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: clone(state.settings),
    };
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'freign-play2-settings.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    appendSystem('Settings exported.');
  }

  function importSettingsFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || '{}'));
        var incoming = parsed;
        if (parsed && typeof parsed === 'object' && parsed.settings && typeof parsed.settings === 'object') {
          incoming = parsed.settings;
        }
        var defaults = cloneDefaultSettings();
        state.settings = ensureDefaultPanelLayout(mergeSettings(defaults, incoming || {}));
        rebuildPalette(); saveAndRefresh();
        appendSystem('Settings imported (defaults reset, then profile applied).');
      } catch (_) { appendSystem('Settings import failed: invalid JSON.'); }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  }

  function resetLocalSettings() {
    if (!window.confirm('Reset all FREIGN Play 2 settings? This cannot be undone.')) return;
    disconnect(); clearSavedKeys();
    localStorage.removeItem(SCROLLBACK_KEY);
    state.settings   = ensureDefaultPanelLayout(cloneDefaultSettings());
    state.cmdHistory = []; state.historyIdx = -1;
    state.lineCarry  = ''; state.lastCmd    = '';
    if (state.partialRow && state.partialRow.parentNode) {
      state.partialRow.parentNode.removeChild(state.partialRow);
    }
    state.partialRow = null;
    rebuildPalette(); saveAndRefresh();
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
    out.font           = (FONTS.indexOf(incoming.font) >= 0) ? incoming.font : base.font;
    out.layoutStyle    = oneOf(incoming.layoutStyle, ['block', 'rounded'], base.layoutStyle);
    out.timestamps     = typeof incoming.timestamps === 'boolean' ? incoming.timestamps : base.timestamps;
    out.wrapLines      = typeof incoming.wrapLines   === 'boolean' ? incoming.wrapLines  : base.wrapLines;
    out.stackSeparator = sanitizeStackSep(incoming.stackSeparator);
    out.bridgeUrl      = typeof incoming.bridgeUrl   === 'string'  ? incoming.bridgeUrl  : base.bridgeUrl;
    out.openPanels     = Array.isArray(incoming.openPanels) ? incoming.openPanels.filter(function(v) { return typeof v === 'string'; }) : clone(base.openPanels);

    out.keepInput     = typeof incoming.keepInput === 'boolean' ? incoming.keepInput : base.keepInput;
    out.wrapWidth     = (typeof incoming.wrapWidth === 'number' && incoming.wrapWidth >= 0)
                        ? Math.floor(incoming.wrapWidth) : base.wrapWidth;
    out.historyMax    = (typeof incoming.historyMax === 'number' && incoming.historyMax >= 0)
                        ? Math.floor(incoming.historyMax) : base.historyMax;
    out.consoleWidth  = (typeof incoming.consoleWidth === 'number' && incoming.consoleWidth >= 320)
                        ? Math.min(1920, Math.floor(incoming.consoleWidth)) : base.consoleWidth;
    out.panelOrder = (function () {
      var valid = BUILTIN_PANELS.map(function (bp) { return bp.id; });
      if (!Array.isArray(incoming.panelOrder)) return valid.slice();
      var result = incoming.panelOrder.filter(function (id) { return valid.indexOf(id) >= 0; });
      valid.forEach(function (id) { if (result.indexOf(id) < 0) result.push(id); });
      return result;
    })();
    out.tsSelectable  = typeof incoming.tsSelectable  === 'boolean' ? incoming.tsSelectable  : base.tsSelectable;
    out.logTimestamps = typeof incoming.logTimestamps === 'boolean' ? incoming.logTimestamps : base.logTimestamps;
    out.affectsView   = oneOf(incoming.affectsView, ['details', 'icons'], base.affectsView || 'details');
    var inPW = incoming.panelWidths || {};
    out.panelWidths = {
      left:  clampWidth(inPW.left,  base.panelWidths.left),
      right: clampWidth(inPW.right, base.panelWidths.right),
    };

    out.panelSides = {};
    var src = incoming.panelSides || {};
    BUILTIN_PANELS.forEach(function (bp) {
      out.panelSides[bp.id] = oneOf(src[bp.id], ['left', 'right'], 'left');
    });

    out.panelTabGroup = {};
    var tg = incoming.panelTabGroup || {};
    BUILTIN_PANELS.forEach(function (bp) {
      var v = typeof tg[bp.id] === 'string' ? tg[bp.id] : '';
      out.panelTabGroup[bp.id] = (v === 'A' || v === 'B' || v === 'C') ? v : '';
    });

    out.panelTabActive = {};
    var ta = incoming.panelTabActive || {};
    Object.keys(ta).forEach(function (k) {
      out.panelTabActive[k] = String(ta[k] || '');
    });

    out.aliases = Array.isArray(incoming.aliases)
      ? incoming.aliases.map(function (a) {
          return { enabled: a.enabled !== false, pattern: String(a.pattern || ''), replacement: String(a.replacement || '') };
        })
      : [];

    out.triggers = Array.isArray(incoming.triggers)
      ? incoming.triggers.map(function (t) {
          return {
            enabled: t.enabled !== false, pattern: String(t.pattern || ''), flags: String(t.flags || ''),
            action: oneOf(t.action, ['highlight', 'send', 'notify'], 'highlight'), value: String(t.value || ''),
          };
        })
      : [];

    out.macros = Array.isArray(incoming.macros)
      ? incoming.macros.map(function (m) {
          return { enabled: m.enabled !== false, label: String(m.label || ''), command: String(m.command || '') };
        })
      : [];

    out.gmcpPanels = Array.isArray(incoming.gmcpPanels)
      ? incoming.gmcpPanels.map(function (p) {
          return {
            id: p.id || uid(), name: String(p.name || 'Panel'), gmcpPath: String(p.gmcpPath || ''),
            enabled: p.enabled !== false, side: oneOf(p.side, ['left', 'right'], 'left'),
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

  function rebuildPalette() {
    var p16 = [];
    for (var i = 0; i < 16; i++) p16[i] = state.settings.palette16[String(i)] || DEFAULT_16[i];
    state.ansiPalette = window.AnsiRenderer.buildXtermPalette(p16);
  }

  function resolveTheme(value) {
    if (themeApi && typeof themeApi.resolveThemeId === 'function') return themeApi.resolveThemeId(value);
    var raw = String(value || '').toLowerCase();
    if (raw === 'dark') return 'onyx'; if (raw === 'parchment') return 'pearl';
    return raw || 'amethyst';
  }

  function sanitizeStackSep(v) {
    var s = String(v == null ? '' : v).trim();
    return s ? s.slice(0, 4) : ';';
  }

  function isHexColor(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
  function oneOf(v, vals, d) { return vals.indexOf(v) >= 0 ? v : d; }
  function clampWidth(v, def) { var n = parseInt(v, 10); return (!isNaN(n) && n >= 150 && n <= 600) ? n : (def || 230); }
  function numOr(v, def) { var n = Number(v); return Number.isFinite(n) ? n : def; }
  function pct(v, max) {
    var m = Math.max(1, numOr(max, 1));
    var n = Math.max(0, numOr(v, 0));
    return Math.max(0, Math.min(100, Math.floor((n * 100) / m)));
  }
  function clone(v)   { return JSON.parse(JSON.stringify(v)); }
  function nowTime()  { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
  function uid()      { return Math.random().toString(36).slice(2, 10); }
  function pad2(n)    { return n < 10 ? '0' + n : String(n); }
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Timestamp selectability ──────────────────────────────────────────────── */
  function applyTsSelectable() {
    el.terminal.classList.toggle('ts-selectable', state.settings.tsSelectable !== false);
  }

  /* ── Log export ─────────────────────────────────────────────────────── */
  function exportLog(includeTs) {
    var stripAnsi = /\x1b\[[0-9;]*[mGKHF]/g;
    var lines = state.scrollback.map(function (item) {
      var text = String(item.line || '').replace(stripAnsi, '');
      return (includeTs && item.time) ? '[' + item.time + '] ' + text : text;
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    var now  = new Date();
    var stamp = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) +
                '_' + pad2(now.getHours()) + pad2(now.getMinutes());
    a.href = url; a.download = 'freign-log-' + stamp + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /* ── ANSI palette config UI ───────────────────────────────────────────── */
  function renderAnsiPaletteCfg() {
    if (!el.ansiPaletteCfg) return;
    el.ansiPaletteCfg.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'ansi-color-grid';
    for (var i = 0; i < 16; i++) {
      (function (idx) {
        var row = document.createElement('div');
        row.className = 'ansi-color-row';
        var inp = document.createElement('input');
        inp.type = 'color';
        inp.value = state.settings.palette16[String(idx)] || DEFAULT_16[idx];
        inp.title = ANSI_COLOR_NAMES[idx];
        inp.addEventListener('input', function () {
          state.settings.palette16[String(idx)] = inp.value;
          rebuildPalette();
          saveSettings();
        });
        var lbl = document.createElement('span');
        lbl.textContent = ANSI_COLOR_NAMES[idx];
        lbl.className = 'ansi-color-label';
        var resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'ansi-reset-btn';
        resetBtn.textContent = '\u21ba';
        resetBtn.title = 'Reset to default';
        (function (i2, input) {
          resetBtn.addEventListener('click', function () {
            state.settings.palette16[String(i2)] = DEFAULT_16[i2];
            input.value = DEFAULT_16[i2];
            rebuildPalette();
            saveSettings();
          });
        })(idx, inp);
        row.appendChild(inp);
        row.appendChild(lbl);
        row.appendChild(resetBtn);
        grid.appendChild(row);
      })(i);
    }
    var resetAll = document.createElement('button');
    resetAll.type = 'button';
    resetAll.className = 'full-btn';
    resetAll.style.marginTop = '8px';
    resetAll.textContent = 'Reset All to Defaults';
    resetAll.addEventListener('click', function () {
      for (var j = 0; j < 16; j++) {
        state.settings.palette16[String(j)] = DEFAULT_16[j];
      }
      rebuildPalette();
      saveSettings();
      renderAnsiPaletteCfg();
    });
    el.ansiPaletteCfg.appendChild(grid);
    el.ansiPaletteCfg.appendChild(resetAll);
  }

})();
