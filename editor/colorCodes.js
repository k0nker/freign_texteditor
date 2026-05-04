// colorCodes.js — Full color code mapping derived from legacy comm.c + ansi.h
// Mirrors ColorCodeSystem.java exactly.

const ANSI_DARK = [
  '#000000', // 0 black
  '#AA0000', // 1 dark red
  '#00AA00', // 2 dark green
  '#AAAA00', // 3 dark yellow
  '#0000AA', // 4 dark blue
  '#AA00AA', // 5 dark magenta
  '#00AAAA', // 6 dark cyan
  '#AAAAAA', // 7 light gray (white)
];

const ANSI_BRIGHT = [
  '#555555', // 0 dark gray (bold black)
  '#FF5555', // 1 bright red
  '#55FF55', // 2 bright green
  '#FFFF55', // 3 bright yellow
  '#5555FF', // 4 bright blue
  '#FF55FF', // 5 bright magenta
  '#55FFFF', // 6 bright cyan
  '#FFFFFF', // 7 white
];

const ORANGE = '#FF5F00';         // xterm 202
const DARK_SLATE_GRAY = '#5F8787'; // xterm 66

// Each entry: { label, fg, bg, bold, underline, blink, isReset, isBg }
// fg/bg are CSS hex color strings or null.
const COLOR_CODES = {
  'x': { label: 'Reset',                   fg: null,           bg: null,         bold: false, underline: false, blink: false, isReset: true,  isBg: false },

  // Dark/Bright foreground
  'r': { label: 'Dark Red',                fg: ANSI_DARK[1],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'R': { label: 'Bright Red',              fg: ANSI_BRIGHT[1],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'g': { label: 'Dark Green',              fg: ANSI_DARK[2],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'G': { label: 'Bright Green',            fg: ANSI_BRIGHT[2],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'y': { label: 'Dark Yellow',             fg: ANSI_DARK[3],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'Y': { label: 'Bright Yellow',           fg: ANSI_BRIGHT[3],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'b': { label: 'Dark Blue',               fg: ANSI_DARK[4],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'B': { label: 'Bright Blue',             fg: ANSI_BRIGHT[4],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'm': { label: 'Dark Magenta',            fg: ANSI_DARK[5],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'M': { label: 'Bright Magenta',          fg: ANSI_BRIGHT[5],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'c': { label: 'Dark Cyan',               fg: ANSI_DARK[6],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'C': { label: 'Bright Cyan',             fg: ANSI_BRIGHT[6],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'w': { label: 'Dark White',              fg: ANSI_DARK[7],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'W': { label: 'Bright White',            fg: ANSI_BRIGHT[7],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  'd': { label: 'Dark Black',              fg: ANSI_DARK[0],  bg: null,         bold: false, underline: false, blink: false, isReset: false, isBg: false },
  'D': { label: 'Bold Black',              fg: ANSI_BRIGHT[0],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },

  // Bold/bright foreground
  //'_': { label: 'Bright Blue (alt)',       fg: ANSI_BRIGHT[4],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },
  //'+': { label: 'Bright Magenta (alt)',    fg: ANSI_BRIGHT[5],bg: null,         bold: true,  underline: false, blink: false, isReset: false, isBg: false },

  // Blink foreground
  //'a': { label: 'Blink Red',               fg: ANSI_DARK[1],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'q': { label: 'Blink Green',             fg: ANSI_DARK[2],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'Q': { label: 'Blink Yellow',            fg: ANSI_DARK[3],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'t': { label: 'Blink Blue',              fg: ANSI_DARK[4],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'T': { label: 'Blink Magenta',           fg: ANSI_DARK[5],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'u': { label: 'Blink Cyan',              fg: ANSI_DARK[6],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'U': { label: 'Blink White',             fg: ANSI_DARK[7],  bg: null,         bold: false, underline: false, blink: true,  isReset: false, isBg: false },
  //'I': { label: 'Blink Bold Red',          fg: ANSI_BRIGHT[1],bg: null,         bold: true,  underline: false, blink: true,  isReset: false, isBg: false },
  //'i': { label: 'Blink Bold Black',        fg: ANSI_BRIGHT[0],bg: null,         bold: true,  underline: false, blink: true,  isReset: false, isBg: false },

  // Underline bold
  //'*': { label: 'Underline Bold Red',      fg: ANSI_BRIGHT[1],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'9': { label: 'Underline Bold Green',    fg: ANSI_BRIGHT[2],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'0': { label: 'Underline Bold Yellow',   fg: ANSI_BRIGHT[3],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'n': { label: 'Underline Bold Blue',     fg: ANSI_BRIGHT[4],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'N': { label: 'Underline Bold Magenta',  fg: ANSI_BRIGHT[5],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'v': { label: 'Underline Bold Cyan',     fg: ANSI_BRIGHT[6],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'V': { label: 'Underline Bold White',    fg: ANSI_BRIGHT[7],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },
  //'z': { label: 'Underline Bold Black',    fg: ANSI_BRIGHT[0],bg: null,         bold: true,  underline: true,  blink: false, isReset: false, isBg: false },

  // Blink + underline
  //'Z': { label: 'Blink+Under Red',         fg: ANSI_DARK[1],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //';': { label: 'Blink+Under Green',       fg: ANSI_DARK[2],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'X': { label: 'Blink+Under Yellow',      fg: ANSI_DARK[3],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'j': { label: 'Blink+Under Blue',        fg: ANSI_DARK[4],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'J': { label: 'Blink+Under Magenta',     fg: ANSI_DARK[5],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'k': { label: 'Blink+Under Cyan',        fg: ANSI_DARK[6],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'K': { label: 'Blink+Under White',       fg: ANSI_DARK[7],  bg: null,         bold: false, underline: true,  blink: true,  isReset: false, isBg: false },
  //'L': { label: 'Blink+Under Bold Red',    fg: ANSI_BRIGHT[1],bg: null,         bold: true,  underline: true,  blink: true,  isReset: false, isBg: false },
  //'l': { label: 'Blink+Under Bold Black',  fg: ANSI_BRIGHT[0],bg: null,         bold: true,  underline: true,  blink: true,  isReset: false, isBg: false },
  //'h': { label: 'Blink+Under Bold Black2', fg: ANSI_BRIGHT[0],bg: null,         bold: true,  underline: true,  blink: true,  isReset: false, isBg: false },
  //'S': { label: 'Blink+Under Bold Yellow', fg: ANSI_BRIGHT[3],bg: null,         bold: true,  underline: true,  blink: true,  isReset: false, isBg: false },

  // Background
  '1': { label: 'BG Red',                  fg: null,           bg: ANSI_DARK[1], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '!': { label: 'BG Bright Red',           fg: null,           bg: ANSI_BRIGHT[1], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '2': { label: 'BG Green',                fg: null,           bg: ANSI_DARK[2], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '@': { label: 'BG Bright Green',         fg: null,           bg: ANSI_BRIGHT[2], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '3': { label: 'BG Yellow',               fg: null,           bg: ANSI_DARK[3], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '#': { label: 'BG Bright Yellow',        fg: null,           bg: ANSI_BRIGHT[3], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '4': { label: 'BG Blue',                 fg: null,           bg: ANSI_DARK[4], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '$': { label: 'BG Bright Blue',          fg: null,           bg: ANSI_BRIGHT[4], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '5': { label: 'BG Magenta',              fg: null,           bg: ANSI_DARK[5], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '%': { label: 'BG Bright Magenta',       fg: null,           bg: ANSI_BRIGHT[5], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '6': { label: 'BG Cyan',                 fg: null,           bg: ANSI_DARK[6], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '^': { label: 'BG Bright Cyan',          fg: null,           bg: ANSI_BRIGHT[6], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '7': { label: 'BG White',                fg: null,           bg: ANSI_DARK[7], bold: false, underline: false, blink: false, isReset: false, isBg: true  },
  '&': { label: 'BG Bright White',         fg: null,           bg: ANSI_BRIGHT[7], bold: false, underline: false, blink: false, isReset: false, isBg: true },
  '8': { label: 'BG Bright Black',         fg: null,           bg: ANSI_BRIGHT[0], bold: false, underline: false, blink: false, isReset: false, isBg: true },

  // Named xterm-256
  //'o': { label: 'Orange',                  fg: ORANGE,         bg: null,         bold: false, underline: false, blink: false, italic: false, strikethrough: false, isReset: false, isBg: false },

  // ── SGR text styles (ColorProcessor.java map.put('e'/E/H/p)) ─────────────
  // {e → ESC[1m  Bold
  'e': { label: 'Bold',                    fg: null,           bg: null,         bold: true,  underline: false, blink: false, italic: false, strikethrough: false, isReset: false, isBg: false, isStyle: true },
  // {E → ESC[3m  Italic
  'E': { label: 'Italic',                  fg: null,           bg: null,         bold: false, underline: false, blink: false, italic: true,  strikethrough: false, isReset: false, isBg: false, isStyle: true },
  // {H → ESC[4m  Underline
  'H': { label: 'Underline',               fg: null,           bg: null,         bold: false, underline: true,  blink: false, italic: false, strikethrough: false, isReset: false, isBg: false, isStyle: true },
  // {p → ESC[9m  Strikethrough
  'p': { label: 'Strikethrough',           fg: null,           bg: null,         bold: false, underline: false, blink: false, italic: false, strikethrough: true,  isReset: false, isBg: false, isStyle: true },

  // Missing blink+under bold codes (ColorProcessor.java / ColorCodeSystem.java)
  //':': { label: 'Blink+Under Bold Blue',    fg: ANSI_BRIGHT[4], bg: null,         bold: true,  underline: true,  blink: true,  italic: false, strikethrough: false, isReset: false, isBg: false },
  //'"': { label: 'Blink+Under Bold Magenta', fg: ANSI_BRIGHT[5], bg: null,         bold: true,  underline: true,  blink: true,  italic: false, strikethrough: false, isReset: false, isBg: false },
  //'f': { label: 'Blink+Under Bold Cyan',    fg: ANSI_BRIGHT[6], bg: null,         bold: true,  underline: true,  blink: true,  italic: false, strikethrough: false, isReset: false, isBg: false },
  //'F': { label: 'Blink+Under Bold White',   fg: ANSI_BRIGHT[7], bg: null,         bold: true,  underline: true,  blink: true,  italic: false, strikethrough: false, isReset: false, isBg: false },
};

/**
 * Convert xterm-256 color number to a CSS hex string.
 * Matches ColorCodeSystem.xterm256ToColor() exactly.
 */
/** xterm-256 6-level cube component: 0→0, 1-5→55+40*v */
function xtermCube(v) { return v === 0 ? 0 : 55 + 40 * v; }

function xterm256ToCss(n) {
  if (n < 0 || n > 255) return '#FFFFFF';
  if (n < 8)  return ANSI_DARK[n];
  if (n < 16) return ANSI_BRIGHT[n - 8];
  if (n < 232) {
    const idx = n - 16;
    const r = xtermCube(Math.floor(idx / 36));
    const g = xtermCube(Math.floor((idx / 6) % 6));
    const b = xtermCube(idx % 6);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const gray = (n - 232) * 10 + 8;
  const h = gray.toString(16).padStart(2, '0');
  return '#' + h + h + h;
}
