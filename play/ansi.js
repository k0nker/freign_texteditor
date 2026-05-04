(function () {
  'use strict';

  function buildDefaultPalette16() {
    return [
      '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
      '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
    ];
  }

  function buildXtermPalette(p16) {
    var palette = [];
    var i;
    for (i = 0; i < 16; i++) palette[i] = p16[i];

    var steps = [0, 95, 135, 175, 215, 255];
    for (var r = 0; r < 6; r++) {
      for (var g = 0; g < 6; g++) {
        for (var b = 0; b < 6; b++) {
          var idx = 16 + (36 * r) + (6 * g) + b;
          palette[idx] = rgbToHex(steps[r], steps[g], steps[b]);
        }
      }
    }

    for (i = 0; i < 24; i++) {
      var v = 8 + (i * 10);
      palette[232 + i] = rgbToHex(v, v, v);
    }

    return palette;
  }

  function rgbToHex(r, g, b) {
    function c(v) {
      return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    }
    return '#' + c(r) + c(g) + c(b);
  }

  function parseSgrTokens(chunk) {
    if (!chunk) return [0];
    return chunk.split(';').map(function (part) {
      if (part === '') return 0;
      var n = parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
  }

  function renderAnsiLine(line, palette) {
    var frag = document.createDocumentFragment();
    var state = {
      fg: null,
      bg: null,
      bold: false,
      underline: false,
      inverse: false,
    };

    var escRe = /\x1b\[([0-9;]*)m/g;
    var last = 0;
    var m;

    function emitText(text) {
      if (!text) return;
      var span = document.createElement('span');
      span.textContent = text;
      applyStyle(span, state, palette);
      frag.appendChild(span);
    }

    while ((m = escRe.exec(line)) !== null) {
      emitText(line.slice(last, m.index));
      applySgr(state, parseSgrTokens(m[1]));
      last = escRe.lastIndex;
    }

    emitText(line.slice(last));
    return frag;
  }

  function applyStyle(el, state, palette) {
    var fg = state.fg;
    var bg = state.bg;

    // FREIGN color_table uses SGR 1;3x / 1;4x for bright variants.
    // Emulate terminal brightening so defaults match in-game ANSI output.
    if (state.bold) {
      if (typeof fg === 'number' && fg >= 0 && fg <= 7) fg += 8;
      if (typeof bg === 'number' && bg >= 0 && bg <= 7) bg += 8;
    }

    if (state.inverse) {
      var t = fg;
      fg = bg;
      bg = t;
    }

    el.style.color = fg === null ? '' : (palette[fg] || '');
    el.style.backgroundColor = bg === null ? '' : (palette[bg] || '');
    el.style.fontWeight = state.bold ? '700' : '';
    el.style.textDecoration = state.underline ? 'underline' : '';
  }

  function applySgr(state, tokens) {
    var i = 0;
    while (i < tokens.length) {
      var code = tokens[i++];
      if (code === 0) {
        state.fg = null;
        state.bg = null;
        state.bold = false;
        state.underline = false;
        state.inverse = false;
      } else if (code === 1) {
        state.bold = true;
      } else if (code === 22) {
        state.bold = false;
      } else if (code === 4) {
        state.underline = true;
      } else if (code === 24) {
        state.underline = false;
      } else if (code === 7) {
        state.inverse = true;
      } else if (code === 27) {
        state.inverse = false;
      } else if (code === 39) {
        state.fg = null;
      } else if (code === 49) {
        state.bg = null;
      } else if (code >= 30 && code <= 37) {
        state.fg = code - 30;
      } else if (code >= 90 && code <= 97) {
        state.fg = 8 + (code - 90);
      } else if (code >= 40 && code <= 47) {
        state.bg = code - 40;
      } else if (code >= 100 && code <= 107) {
        state.bg = 8 + (code - 100);
      } else if ((code === 38 || code === 48) && tokens[i] === 5 && typeof tokens[i + 1] === 'number') {
        var idx = tokens[i + 1];
        if (code === 38) state.fg = idx;
        else state.bg = idx;
        i += 2;
      }
    }
  }

  window.AnsiRenderer = {
    buildDefaultPalette16: buildDefaultPalette16,
    buildXtermPalette: buildXtermPalette,
    renderAnsiLine: renderAnsiLine,
  };
})();
