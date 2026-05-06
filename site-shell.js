(function () {
  'use strict';

  var themeApi = window.FreignThemes;
  var SHELLBAR_PARTIAL_PATH = '/_partials/shellbar.html';

  function inferActiveNavFromPath(path) {
    if (!path || path === '/') {
      return 'home';
    }
    if (path.indexOf('/map/') === 0) {
      return 'map';
    }
    if (path.indexOf('/play/') === 0) {
      return 'play';
    }
    if (path.indexOf('/news/') === 0) {
      return 'news';
    }
    if (path.indexOf('/forum/') === 0) {
      return 'forum';
    }
    if (path.indexOf('/who/') === 0) {
      return 'who';
    }
    return '';
  }

  function setActiveNav(activeNav) {
    var navItems = document.querySelectorAll('.fr-nav-item[data-nav]');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].classList.remove('active');
    }
    if (!activeNav) {
      return;
    }
    var activeItem = document.querySelector('.fr-nav-item[data-nav="' + activeNav + '"]');
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }

  function initThemeControl() {
    if (!themeApi) return;

    var select = document.getElementById('site-theme-select');
    if (!select) return;

    var initial = themeApi.getThemeId();
    themeApi.populateSelect(select, initial);
    themeApi.applyTheme(initial, { select: select, persist: true });

    if (select) {
      select.addEventListener('change', function () {
        themeApi.applyTheme(select.value, { select: select, persist: true });
      });
    }
  }

  function initShellbarAndTheme() {
    var mount = document.getElementById('fr-shellbar-mount');
    if (!mount) {
      initThemeControl();
      return;
    }

    fetch(SHELLBAR_PARTIAL_PATH, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Shellbar load failed: ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        mount.innerHTML = html;
        var activeNav = mount.getAttribute('data-active-nav') || inferActiveNavFromPath(window.location.pathname);
        setActiveNav(activeNav);
        initThemeControl();
      })
      .catch(function () {
        initThemeControl();
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initShellbarAndTheme();
  });

  window.FreignTheme = {
    key: themeApi ? themeApi.key : 'freign.site.theme.v1',
    getTheme: function () {
      return themeApi ? themeApi.getThemeId() : 'amethyst';
    },
    setTheme: function (theme) {
      if (!themeApi) return;
      var select = document.getElementById('site-theme-select');
      themeApi.applyTheme(theme, { select: select, persist: true });
    },
    validTheme: function (theme) {
      return themeApi ? themeApi.resolveThemeId(theme) : 'amethyst';
    },
  };
})();
