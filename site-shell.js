(function () {
  'use strict';

  var themeApi = window.FreignThemes;

  document.addEventListener('DOMContentLoaded', function () {
    var select = document.getElementById('site-theme-select');
    if (!themeApi) return;

    var initial = themeApi.getThemeId();
    themeApi.populateSelect(select, initial);
    themeApi.applyTheme(initial, { select: select, persist: true });

    if (select) {
      select.addEventListener('change', function () {
        themeApi.applyTheme(select.value, { select: select, persist: true });
      });
    }
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
