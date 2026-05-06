(function () {
  'use strict';

  var THEME_KEY = 'freign.site.theme.v1';

  // Add or edit themes in THIS file only.
  var THEMES = [
    {
      id: 'amethyst',
      label: 'Amethyst',
      tone: 'dark',
      vars: {
        bg: '#12101a', panel: '#1b1827', 'panel-border': '#3d3452', text: '#ddd8ea',
        muted: '#9e95b4', title: '#d7cee8', 'input-bg': '#232033', 'input-border': '#4a4160',
        accent: '#7f6aa7', 'accent-ink': '#1b1528', 'terminal-bg': '#11101a', 'terminal-border': '#3f3655',
        'terminal-text': '#e6e0f2'
      }
    },
    {
      id: 'cobalt',
      label: 'Cobalt',
      tone: 'dark',
      vars: {
        bg: '#111722', panel: '#17202e', 'panel-border': '#31435b', text: '#c7d4e4',
        muted: '#8ba2bf', title: '#b6d8ff', 'input-bg': '#202c3d', 'input-border': '#3e5573',
        accent: '#6dc0ff', 'accent-ink': '#112339', 'terminal-bg': '#0e141f', 'terminal-border': '#2f4057',
        'terminal-text': '#d5e4f6'
      }
    },
    {
      id: 'onyx',
      label: 'Onyx',
      tone: 'dark',
      vars: {
        bg: '#0a0a0e', panel: '#111118', 'panel-border': '#2a2a38', text: '#c8c0b0',
        muted: '#8f8798', title: '#e0c87a', 'input-bg': '#1a1a24', 'input-border': '#3a3a50',
        accent: '#d9b05f', 'accent-ink': '#20160a', 'terminal-bg': '#0c0c13', 'terminal-border': '#323246',
        'terminal-text': '#ddd0bb'
      }
    },
    {
      id: 'emerald',
      label: 'Emerald',
      tone: 'dark',
      vars: {
        bg: '#0f1713', panel: '#18261f', 'panel-border': '#345043', text: '#d4eadf',
        muted: '#8bb4a2', title: '#9de8c1', 'input-bg': '#1f3128', 'input-border': '#466b59',
        accent: '#49bb84', 'accent-ink': '#0b2418', 'terminal-bg': '#0d1813', 'terminal-border': '#325745',
        'terminal-text': '#def5ea'
      }
    },
    {
      id: 'sapphire',
      label: 'Sapphire',
      tone: 'dark',
      vars: {
        bg: '#0c1222', panel: '#141d33', 'panel-border': '#334a77', text: '#d3ddff',
        muted: '#8ea4d6', title: '#b4c6ff', 'input-bg': '#1b2850', 'input-border': '#435d95',
        accent: '#6fa0ff', 'accent-ink': '#0f1f47', 'terminal-bg': '#0b1224', 'terminal-border': '#324c82',
        'terminal-text': '#dee6ff'
      }
    },
    {
      id: 'ruby',
      label: 'Ruby',
      tone: 'dark',
      vars: {
        bg: '#1b0f16', panel: '#281722', 'panel-border': '#5f3348', text: '#f2d8e3',
        muted: '#c39aa9', title: '#ffc0da', 'input-bg': '#3a1f2f', 'input-border': '#7a445f',
        accent: '#d6658e', 'accent-ink': '#311023', 'terminal-bg': '#190d14', 'terminal-border': '#63354a',
        'terminal-text': '#ffe4ef'
      }
    },
    {
      id: 'garnet',
      label: 'Garnet',
      tone: 'dark',
      vars: {
        bg: '#190d12', panel: '#27131b', 'panel-border': '#582839', text: '#ecd5db',
        muted: '#b88d99', title: '#f5b0c4', 'input-bg': '#3a1826', 'input-border': '#6d3045',
        accent: '#b84b6c', 'accent-ink': '#2a0d18', 'terminal-bg': '#160a10', 'terminal-border': '#53253a',
        'terminal-text': '#f7e0e7'
      }
    },
    {
      id: 'rhodonite',
      label: 'Rhodonite',
      tone: 'dark',
      vars: {
        bg: '#1a0d14', panel: '#281420', 'panel-border': '#6b2e4a', text: '#f0d0de',
        muted: '#c07890', title: '#f5a0c2', 'input-bg': '#381828', 'input-border': '#7e3855',
        accent: '#d04878', 'accent-ink': '#300a1c', 'terminal-bg': '#160a10', 'terminal-border': '#6e304c',
        'terminal-text': '#f5deea'
      }
    },
    {
      id: 'topaz',
      label: 'Topaz',
      tone: 'dark',
      vars: {
        bg: '#5e3608', panel: '#7a4a18', 'panel-border': '#b07028', text: '#fff4dc',
        muted: '#d08030', title: '#ffc87c', 'input-bg': '#7c4818', 'input-border': '#c88030',
        accent: '#e89838', 'accent-ink': '#200c00', 'terminal-bg': '#5a3208', 'terminal-border': '#a86828',
        'terminal-text': '#ffecc8'
      }
    },
    {
      id: 'carnelian',
      label: 'Carnelian',
      tone: 'dark',
      vars: {
        bg: '#191400', panel: '#261e00', 'panel-border': '#5e4c10', text: '#eedfac',
        muted: '#aa9840', title: '#f2cc40', 'input-bg': '#352800', 'input-border': '#706018',
        accent: '#c8a800', 'accent-ink': '#201800', 'terminal-bg': '#141000', 'terminal-border': '#605010',
        'terminal-text': '#f2e8b8'
      }
    },
    {
      id: 'amber',
      label: 'Amber',
      tone: 'dark',
      vars: {
        bg: '#1a1208', panel: '#281c0c', 'panel-border': '#6b4c22', text: '#edd8b8',
        muted: '#b08c5a', title: '#d4a060', 'input-bg': '#382208', 'input-border': '#7a5428',
        accent: '#c07038', 'accent-ink': '#241200', 'terminal-bg': '#150f05', 'terminal-border': '#6c4c20',
        'terminal-text': '#f2e0c0'
      }
    },
    {
      id: 'jade',
      label: 'Jade',
      tone: 'dark',
      vars: {
        bg: '#101919', panel: '#182624', 'panel-border': '#33514c', text: '#d4eae7',
        muted: '#89b8b0', title: '#9ee6d8', 'input-bg': '#203632', 'input-border': '#437169',
        accent: '#52bea9', 'accent-ink': '#0b251f', 'terminal-bg': '#0e1a19', 'terminal-border': '#325e56',
        'terminal-text': '#ddf6f2'
      }
    },
    {
      id: 'obsidian',
      label: 'Obsidian',
      tone: 'dark',
      vars: {
        bg: '#090c11', panel: '#101620', 'panel-border': '#263244', text: '#c6d1df',
        muted: '#7d90a7', title: '#c4d8f2', 'input-bg': '#182233', 'input-border': '#33475f',
        accent: '#6f90ba', 'accent-ink': '#101b2d', 'terminal-bg': '#080d14', 'terminal-border': '#283951',
        'terminal-text': '#d4dfec'
      }
    },
    {
      id: 'pearl',
      label: 'Pearl',
      tone: 'light',
      vars: {
        bg: '#efe5cd', panel: '#f8f0db', 'panel-border': '#b7a27c', text: '#3e3325',
        muted: '#7a6543', title: '#6f4d1f', 'input-bg': '#fff8ea', 'input-border': '#bda883',
        accent: '#9a6a2f', 'accent-ink': '#fff4df', 'terminal-bg': '#fff8e8', 'terminal-border': '#c4af88',
        'terminal-text': '#3b3022'
      }
    },
    {
      id: 'opal',
      label: 'Opal',
      tone: 'light',
      vars: {
        bg: '#f3f3f6', panel: '#fcfcff', 'panel-border': '#b2b7c4', text: '#2f3340',
        muted: '#626a7c', title: '#3f4961', 'input-bg': '#ffffff', 'input-border': '#a8afbf',
        accent: '#6f79c7', 'accent-ink': '#f8f9ff', 'terminal-bg': '#ffffff', 'terminal-border': '#b6bdd0',
        'terminal-text': '#2b3040'
      }
    },
    {
      id: 'quartz',
      label: 'Quartz',
      tone: 'light',
      vars: {
        bg: '#ececef', panel: '#f7f7fa', 'panel-border': '#b5b5be', text: '#2f2f37',
        muted: '#666673', title: '#40404d', 'input-bg': '#ffffff', 'input-border': '#ababba',
        accent: '#7f7f97', 'accent-ink': '#fafaff', 'terminal-bg': '#fefeff', 'terminal-border': '#b9b9c7',
        'terminal-text': '#2a2a33'
      }
    },
    {
      id: 'rose-quartz',
      label: 'Rose Quartz',
      tone: 'light',
      vars: {
        bg: '#f7ecf1', panel: '#fdf5f8', 'panel-border': '#d4a8bb', text: '#3d2430',
        muted: '#8f6070', title: '#7a3355', 'input-bg': '#fff0f4', 'input-border': '#d0a0b5',
        accent: '#c0558a', 'accent-ink': '#ffe8f2', 'terminal-bg': '#fdf2f6', 'terminal-border': '#d8acbf',
        'terminal-text': '#3a2030'
      }
    },
    {
      id: 'citrine',
      label: 'Citrine',
      tone: 'light',
      vars: {
        bg: '#f6f0d5', panel: '#fdfae8', 'panel-border': '#c8b665', text: '#3a3215',
        muted: '#7a7030', title: '#5a4a08', 'input-bg': '#fefce8', 'input-border': '#caba65',
        accent: '#9a8818', 'accent-ink': '#fefce0', 'terminal-bg': '#fdfae0', 'terminal-border': '#ccba68',
        'terminal-text': '#363018'
      }
    }
  ];

  var LEGACY_ALIASES = {
    dark: 'onyx',
    parchment: 'pearl'
  };

  var index = Object.create(null);
  for (var i = 0; i < THEMES.length; i++) {
    index[THEMES[i].id] = THEMES[i];
  }

  function resolveThemeId(themeId) {
    var raw = String(themeId || '').trim().toLowerCase();
    var resolved = LEGACY_ALIASES[raw] || raw;
    return index[resolved] ? resolved : 'amethyst';
  }

  function getTheme(themeId) {
    return index[resolveThemeId(themeId)];
  }

  function readStoredTheme() {
    try {
      return resolveThemeId(localStorage.getItem(THEME_KEY));
    } catch (_) {
      return 'amethyst';
    }
  }

  function writeStoredTheme(themeId) {
    try {
      localStorage.setItem(THEME_KEY, resolveThemeId(themeId));
    } catch (_) {}
  }

  function applyTheme(themeId, options) {
    var opts = options || {};
    var resolved = resolveThemeId(themeId);
    var theme = getTheme(resolved);
    if (!theme) return 'amethyst';

    document.body.setAttribute('data-theme', theme.id);
    document.body.setAttribute('data-theme-tone', theme.tone || 'dark');
    var vars = theme.vars || {};
    for (var key in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
      document.body.style.setProperty('--' + key, vars[key]);
    }

    if (opts.persist !== false) {
      writeStoredTheme(theme.id);
    }

    if (opts.select) {
      opts.select.value = theme.id;
    }

    window.dispatchEvent(new CustomEvent('freign-theme-changed', {
      detail: { themeId: theme.id, tone: theme.tone || 'dark' }
    }));

    return theme.id;
  }

  function populateSelect(selectEl, currentTheme) {
    if (!selectEl) return;

    selectEl.innerHTML = '';
    for (var i = 0; i < THEMES.length; i++) {
      var t = THEMES[i];
      var option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.label;
      selectEl.appendChild(option);
    }

    selectEl.value = resolveThemeId(currentTheme);
  }

  window.FreignThemes = {
    key: THEME_KEY,
    list: function () { return THEMES.slice(); },
    getTheme: getTheme,
    getThemeId: readStoredTheme,
    resolveThemeId: resolveThemeId,
    isLight: function (themeId) { return getTheme(themeId).tone === 'light'; },
    applyTheme: applyTheme,
    setTheme: function (themeId) { return applyTheme(themeId, { persist: true }); },
    populateSelect: populateSelect
  };
})();
