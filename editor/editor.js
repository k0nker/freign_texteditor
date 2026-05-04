// editor.js — freign text editor web version
// Mirrors ColorCodeParser.java logic exactly.

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  escOpen: '{',
  escClose: '}',
  widthLimit: 120,
  layout: 'vertical', // 'horizontal' | 'vertical'
  cheatSheetVisible: false,
  fontSize: 13,
  alignment: 'left', // 'left'|'center'|'right'|'justify'
  renderTimer: null,
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const rawEl         = document.getElementById('raw-editor');
const renderedPre   = document.getElementById('rendered-content');
const editorsEl     = document.getElementById('editors');
const cheatSheet    = document.getElementById('cheat-sheet');
const cheatBody     = document.getElementById('cheat-sheet-body');
const findBar       = document.getElementById('find-bar');
const findInput     = document.getElementById('find-input');
const replInput     = document.getElementById('replace-input');
const findCount     = document.getElementById('find-count');
const statusLine    = document.getElementById('status-line');
const statusVis     = document.getElementById('status-vis');
const statusCaret   = document.getElementById('status-caret');
const rulerTopCanvas  = document.getElementById('ruler-top');
const rulerBotCanvas  = document.getElementById('ruler-bot');
const widthSpinner  = document.getElementById('width-limit');
const fontSpinner   = document.getElementById('font-size');
// ── Rendered pane editing state ─────────────────────────────────────────────
let _lastPlainText = '';
let _pendingRenderedCaret = -1;
let _suppressRenderedInput = false;
let _activePane = 'raw'; // 'raw' | 'rendered' — controls whether updateRendered rebuilds the DOM
let _savedRenderedOffsets = null; // selection/caret saved on rendered pane blur, used by insertAtCursor

// ── Undo stack ─────────────────────────────────────────────────────────────
const _undoStack = [];  // { raw, cursor }
let _undoPointer = -1;
let _undoTimer = null;

function pushUndoNow() {
  const snap = { raw: rawEl.value, cursor: rawEl.selectionStart };
  // Truncate any forward history
  _undoStack.splice(_undoPointer + 1);
  if (_undoStack.length > 0 && _undoStack[_undoStack.length - 1].raw === snap.raw) return;
  _undoStack.push(snap);
  if (_undoStack.length > 200) _undoStack.shift(); // else pointer stays valid
  _undoPointer = _undoStack.length - 1;
}

function schedulePushUndo() {
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(pushUndoNow, 400);
}

function doUndo() {
  // Flush any pending delayed push first so we don't lose the current state
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; pushUndoNow(); }
  if (_undoPointer <= 0) return;
  _undoPointer--;
  const snap = _undoStack[_undoPointer];
  rawEl.value = snap.raw;
  rawEl.focus();
  rawEl.setSelectionRange(snap.cursor, snap.cursor);
  scheduleRender();
}
// ── Color code parsing ─────────────────────────────────────────────────────

/**
 * Parse raw text into an array of segments: { text, fg, bg, bold, underline, blink }
 * Mirrors ColorCodeParser.parse().
 */
function parseRaw(raw) {
  const segs = [];
  let fg = null, bg = null, bold = false, underline = false, blink = false, italic = false, strikethrough = false;
  let i = 0;
  const open = state.escOpen;
  const close = state.escClose; // not actually used in current {X} scheme but kept for completeness

  function flush(text) {
    if (text.length === 0) return;
    segs.push({ text, fg, bg, bold, underline, blink, italic, strikethrough });
  }

  let buf = '';
  while (i < raw.length) {
    const ch = raw[i];

    if (ch !== open) {
      buf += ch;
      i++;
      continue;
    }

    // Possible code: next char determines type
    const next = raw[i + 1];

    if (next === undefined) {
      buf += ch;
      i++;
      continue;
    }

    // {{{ → literal {
    if (next === open) {
      flush(buf); buf = '';
      flush(open);
      i += 2;
      continue;
    }

    // {-} → tilde ~
    if (next === '-' && raw[i + 2] === '}') {
      flush(buf); buf = '';
      flush('~');
      i += 3;
      continue;
    }

    // {/} → newline
    if (next === '/' && raw[i + 2] === '}') {
      flush(buf); buf = '';
      flush('\n');
      i += 3;
      continue;
    }

    // {s} or {} → two spaces
    if ((next === 's' || next === '}') && (next === '}' || raw[i + 2] === '}')) {
      if (next === '}') {
        flush(buf); buf = '';
        flush('  ');
        i += 2;
        continue;
      }
      if (next === 's' && raw[i + 2] === '}') {
        flush(buf); buf = '';
        flush('  ');
        i += 3;
        continue;
      }
    }

    // {=NNN} xterm-256 fg
    if (next === '=') {
      const rest = raw.slice(i + 2);
      const fgMatch = rest.match(/^(\d{1,3})\}/);
      if (fgMatch) {
        flush(buf); buf = '';
        fg = xterm256ToCss(parseInt(fgMatch[1], 10));
        i += 2 + fgMatch[0].length;
        continue;
      }
      // {=bNNN} xterm-256 bg
      const bgMatch = rest.match(/^b(\d{1,3})\}/);
      if (bgMatch) {
        flush(buf); buf = '';
        bg = xterm256ToCss(parseInt(bgMatch[1], 10));
        i += 2 + bgMatch[0].length;
        continue;
      }
    }

    // {X single char code (no closing brace)
    const codeChar = next;
    const def = COLOR_CODES[codeChar];
    if (def) {
      flush(buf); buf = '';
      if (def.isReset) {
        fg = null; bg = null; bold = false; underline = false; blink = false; italic = false; strikethrough = false;
      } else {
        if (def.fg !== null) fg = def.fg;
        if (def.bg !== null) bg = def.bg;
        if (def.bold)          bold = true;
        if (def.underline)     underline = true;
        if (def.blink)         blink = true;
        if (def.italic)        italic = true;
        if (def.strikethrough) strikethrough = true;
      }
      i += 2;
      continue;
    }

    // Unknown code → pass through literal
    buf += ch;
    i++;
  }
  flush(buf);
  return segs;
}

/**
 * Strip all color codes from raw text. Returns plain string.
 */
function stripCodes(raw) {
  return parseRaw(raw).map(s => s.text).join('');
}

/**
 * Count visible (non-code) characters in a line.
 */
function visibleLength(raw) {
  return stripCodes(raw).length;
}

// ── Rendering ──────────────────────────────────────────────────────────────

function segToSpan(seg) {
  const span = document.createElement('span');
  span.textContent = seg.text;
  const s = span.style;
  if (seg.fg) s.color = seg.fg;
  if (seg.bg) s.backgroundColor = seg.bg;
  if (seg.bold)      s.fontWeight = 'bold';
  if (seg.italic)    s.fontStyle = 'italic';
  if (seg.blink)     span.classList.add('blink-text');
  const deco = [seg.underline && 'underline', seg.strikethrough && 'line-through'].filter(Boolean).join(' ');
  if (deco) s.textDecoration = deco;
  return span;
}

function updateRendered() {
  // While the user is actively typing in the rendered pane, the rendered DOM is
  // already correct (it is the source being typed into). Re-rendering from raw
  // here would trash the caret and create duplication. Defer until blur.
  if (_activePane === 'rendered') return;
  const raw = rawEl.value;

  // Save rendered caret if pane is focused
  let savedCaret = _pendingRenderedCaret;
  _pendingRenderedCaret = -1;
  const rendHasFocus = document.activeElement === renderedPre || renderedPre.contains(document.activeElement);
  if (savedCaret < 0 && rendHasFocus) savedCaret = getRenderedCaretOffset();

  // Programmatic DOM rebuild (suppress input event handler)
  _suppressRenderedInput = true;
  renderedPre.textContent = '';
  const segs = parseRaw(raw);
  for (const seg of segs) {
    if (seg.text.includes('\n')) {
      const parts = seg.text.split('\n');
      for (let pi = 0; pi < parts.length; pi++) {
        if (parts[pi].length > 0) renderedPre.appendChild(segToSpan({ ...seg, text: parts[pi] }));
        if (pi < parts.length - 1) renderedPre.appendChild(document.createTextNode('\n'));
      }
    } else {
      renderedPre.appendChild(segToSpan(seg));
    }
  }
  _lastPlainText = renderedPre.textContent;
  _suppressRenderedInput = false;

  // Restore caret after DOM settles
  if (savedCaret >= 0) {
    requestAnimationFrame(() => {
      if (rendHasFocus) renderedPre.focus();
      setRenderedCaretOffset(savedCaret);
    });
  }

  // Status update
  const stripped = stripCodes(raw);
  const lineCount = raw.split('\n').length;
  const charCount = stripped.length;
  statusLine.textContent = `${lineCount} line${lineCount !== 1 ? 's' : ''}`;
  statusVis.textContent = `${charCount} chars`;
  drawRulers();
}

function scheduleRender() {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(updateRendered, 80);
}

// ── Alignment ─────────────────────────────────────────────────────────────

function padStr(n) { return ' '.repeat(Math.max(0, n)); }

/**
 * Strip leading visible space characters from a raw string, preserving any
 * color codes that precede them (or are interspersed before the first
 * non-space visible character).
 * e.g. '{=130}   hello' → '{=130}hello'
 *      '   {=130}  hello' → '{=130}hello'
 */
function stripLeadingVisibleSpaces(rawLine) {
  const open = state.escOpen;
  let i = 0;
  let prefix = ''; // color/style codes collected before first visible non-space
  while (i < rawLine.length) {
    const ch = rawLine[i];
    // Color code?
    if (ch === open && i + 1 < rawLine.length) {
      const next = rawLine[i + 1];
      if (next === open)                            { prefix += rawLine.slice(i, i+2); i += 2; continue; }
      if (next === '-' && rawLine[i+2] === '}')    { break; } // ~ = non-space visible char
      if (next === '/' && rawLine[i+2] === '}')    { break; } // newline
      if (next === '}')                             { prefix += rawLine.slice(i, i+2); i += 2; continue; }
      if (next === 's' && rawLine[i+2] === '}')    { prefix += rawLine.slice(i, i+3); i += 3; continue; }
      if (next === '=') {
        const rest = rawLine.slice(i + 2);
        const fgM = rest.match(/^(\d{1,3})\}/);
        if (fgM) { prefix += rawLine.slice(i, i + 2 + fgM[0].length); i += 2 + fgM[0].length; continue; }
        const bgM = rest.match(/^b(\d{1,3})\}/);
        if (bgM) { prefix += rawLine.slice(i, i + 2 + bgM[0].length); i += 2 + bgM[0].length; continue; }
      }
      if (COLOR_CODES[next]) { prefix += rawLine.slice(i, i+2); i += 2; continue; }
    }
    // Literal leading space — skip it
    if (ch === ' ') { i++; continue; }
    // First non-space visible character — stop stripping
    break;
  }
  return prefix + rawLine.slice(i);
}

function applyAlignment(rawLine, alignment, limit) {
  // Strip any leading visible spaces from a prior alignment pass so apply is idempotent.
  const stripped = stripLeadingVisibleSpaces(rawLine);
  const visible = visibleLength(stripped);

  if (alignment === 'left') {
    return stripped;
  }
  if (alignment === 'center') {
    const pad = Math.max(0, Math.floor((limit - visible) / 2));
    return padStr(pad) + stripped;
  }
  if (alignment === 'right') {
    const pad = Math.max(0, limit - visible);
    return padStr(pad) + stripped;
  }
  if (alignment === 'justify') {
    // Work on the stripped line so leading spaces don't skew word positions.
    const plain = stripCodes(stripped);
    const words = [];
    const gaps  = []; // { plainStart, plainLen } — space run between words[i] and words[i+1]
    const re = /\S+/g;
    let m, lastEnd = 0;
    while ((m = re.exec(plain)) !== null) {
      if (words.length > 0) gaps.push({ plainStart: lastEnd, plainLen: m.index - lastEnd });
      words.push(m[0]);
      lastEnd = m.index + m[0].length;
    }
    if (words.length < 2) return stripped;
    const textLen     = words.reduce((a, w) => a + w.length, 0);
    const totalSpaces = limit - textLen;
    if (totalSpaces <= 0) return stripped;
    const nGaps = gaps.length;
    const base  = Math.floor(totalSpaces / nGaps);
    const extra = totalSpaces % nGaps;
    // Map plain positions → raw indices, working on the stripped line.
    const map = buildPlainToRawMap(stripped);
    let result = stripped;
    // Process right-to-left so earlier raw indices stay valid.
    for (let gi = nGaps - 1; gi >= 0; gi--) {
      const { plainStart, plainLen } = gaps[gi];
      const rawStart = map[plainStart];
      const rawEnd = (plainStart + plainLen < map.length)
        ? map[plainStart + plainLen]
        : result.length;
      const spaces = ' '.repeat(base + (gi < extra ? 1 : 0));
      result = result.slice(0, rawStart) + spaces + result.slice(rawEnd);
    }
    return result;
  }
  return stripped; // fallback left
}

/**
 * Apply the given alignment to selected lines in the raw editor.
 */
function applyAlignmentToSelection(alignment) {
  const start = rawEl.selectionStart;
  const end   = rawEl.selectionEnd;
  const raw   = rawEl.value;

  const lineStart = raw.lastIndexOf('\n', start - 1) + 1;
  const lineEnd   = raw.indexOf('\n', end);
  const blockEnd  = lineEnd === -1 ? raw.length : lineEnd;

  const block = raw.slice(lineStart, blockEnd);
  const aligned = block.split('\n').map(l => applyAlignment(l, alignment, state.widthLimit)).join('\n');

  rawEl.setRangeText(aligned, lineStart, blockEnd, 'preserve');
  pushUndoNow();
  scheduleRender();
}

// ── Rulers ────────────────────────────────────────────────────────────────

function drawRuler(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  const fontSize = state.fontSize;
  const charW = measureCharWidth(fontSize);
  const limit = state.widthLimit;

  ctx.font = `${Math.floor(fontSize * 0.75)}px Consolas, monospace`;
  ctx.fillStyle = '#555';

  const cols = Math.floor(W / charW);
  for (let col = 10; col <= cols; col += 10) {
    const x = col * charW;
    ctx.fillText(String(col), x - 12, H - 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, 0, 1, H);
    ctx.fillStyle = '#555';
  }

  // Width limit line
  const limitX = limit * charW;
  if (limitX >= 0 && limitX < W) {
    ctx.fillStyle = '#CC3333';
    ctx.fillRect(limitX, 0, 1, H);
    ctx.fillStyle = '#CC3333';
    ctx.fillText(String(limit), limitX + 2, H - 4);
  }
}

let _cachedCharW = null;
let _cachedFontSize = null;

function measureCharWidth(fontSize) {
  if (_cachedCharW !== null && _cachedFontSize === fontSize) return _cachedCharW;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px Consolas, 'JetBrains Mono', Menlo, 'Courier New', monospace`;
  _cachedCharW = ctx.measureText('M').width;
  _cachedFontSize = fontSize;
  return _cachedCharW;
}

function drawRulers() {
  [rulerTopCanvas, rulerBotCanvas].forEach(c => {
    c.width = c.parentElement.clientWidth || 600;
    c.height = 20;
    drawRuler(c);
  });
}

// ── Rendered pane helpers ────────────────────────────────────────────────────

/**
 * Build a map from plain-text character index to raw-string index.
 * Accounts for color codes being invisible in rendered output.
 */
function buildPlainToRawMap(raw) {
  const map = [];
  const open = state.escOpen;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === open && i + 1 < raw.length) {
      const next = raw[i + 1];
      // {{ → literal {
      if (next === open) { map.push(i); i += 2; continue; }
      // {-} → ~
      if (next === '-' && raw[i + 2] === '}') { map.push(i); i += 3; continue; }
      // {/} → newline
      if (next === '/' && raw[i + 2] === '}') { map.push(i); i += 3; continue; }
      // {} → 2 spaces
      if (next === '}') { map.push(i); map.push(i); i += 2; continue; }
      // {s} → 2 spaces
      if (next === 's' && raw[i + 2] === '}') { map.push(i); map.push(i); i += 3; continue; }
      // {=NNN} or {=bNNN}
      if (next === '=') {
        const rest = raw.slice(i + 2);
        const fgM = rest.match(/^(\d{1,3})\}/);
        if (fgM) { i += 2 + fgM[0].length; continue; }
        const bgM = rest.match(/^b(\d{1,3})\}/);
        if (bgM) { i += 2 + bgM[0].length; continue; }
      }
      // Single-char code
      if (COLOR_CODES[next]) { i += 2; continue; }
    }
    map.push(i);
    i++;
  }
  return map;
}

function plainToRaw(raw, plainPos) {
  if (plainPos <= 0) return 0;
  const map = buildPlainToRawMap(raw);
  if (plainPos >= map.length) return raw.length;
  return map[plainPos];
}

/**
 * Scan raw[0..rawPos) and return the last active fg/bg escape strings.
 * e.g. { fgCode: '{=130}', bgCode: null }
 */
function getActiveStateBeforePos(raw, rawPos) {
  const open = state.escOpen;
  let fgCode = null, bgCode = null;
  let i = 0;
  while (i < rawPos) {
    const ch = raw[i];
    if (ch !== open || i + 1 >= rawPos) { i++; continue; }
    const next = raw[i + 1];
    if (next === open)                              { i += 2; continue; }
    if (next === '-' && raw[i + 2] === '}')         { i += 3; continue; }
    if (next === '/' && raw[i + 2] === '}')         { i += 3; continue; }
    if (next === '}')                               { i += 2; continue; }
    if (next === 's' && raw[i + 2] === '}')         { i += 3; continue; }
    if (next === '=') {
      const rest = raw.slice(i + 2);
      const fgM = rest.match(/^(\d{1,3})\}/);
      if (fgM) { fgCode = `{=${fgM[1]}}`; i += 2 + fgM[0].length; continue; }
      const bgM = rest.match(/^b(\d{1,3})\}/);
      if (bgM) { bgCode = `{=b${bgM[1]}}`; i += 2 + bgM[0].length; continue; }
    }
    const def = COLOR_CODES[next];
    if (def) {
      if (def.isReset)      { fgCode = null; bgCode = null; }
      else if (def.isBg)    { bgCode = `{${next}`; }
      else if (!def.isStyle){ fgCode = `{${next}`; }
      i += 2;
      continue;
    }
    i++;
  }
  return { fgCode, bgCode };
}

/**
 * Given the code being inserted and the state before rawInsertPos,
 * return the closing string to append after a wrapped selection.
 */
function buildResumeCode(code, raw, rawInsertPos) {
  const { fgCode, bgCode } = getActiveStateBeforePos(raw, rawInsertPos);
  // Determine what kind of code this is
  const def = (() => {
    if (code.startsWith('{=b')) return { isStyle: false, isReset: false };
    if (code.startsWith('{=')) return { isStyle: false, isReset: false };
    if (code.length === 2) return COLOR_CODES[code[1]] || { isStyle: false, isReset: false };
    return { isStyle: false, isReset: false };
  })();
  if (def.isReset) {
    // {x wrapping: restore what was before
    return (fgCode || '') + (bgCode || '');
  }
  if (def.isStyle) {
    // Style codes need {x to clear the style, then restore color
    return '{x' + (fgCode || '') + (bgCode || '');
  }
  // Color codes: restore previous fg/bg (if none, reset)
  const resume = (fgCode || '') + (bgCode || '');
  return resume || '{x';
}

function getRenderedCaretOffset() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  if (!renderedPre.contains(range.startContainer)) return -1;
  const r = document.createRange();
  r.selectNodeContents(renderedPre);
  r.setEnd(range.startContainer, range.startOffset);
  return r.toString().length;
}

function getRenderedSelectionOffsets() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!renderedPre.contains(range.commonAncestorContainer)) return null;
  const r = document.createRange();
  r.selectNodeContents(renderedPre);
  r.setEnd(range.startContainer, range.startOffset);
  const start = r.toString().length;
  r.setEnd(range.endContainer, range.endOffset);
  const end = r.toString().length;
  return { start, end };
}

function setRenderedCaretOffset(offset) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let charCount = 0, found = false;
  function walk(node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const end = charCount + node.length;
      if (end >= offset) {
        range.setStart(node, offset - charCount);
        range.collapse(true);
        found = true;
        return;
      }
      charCount = end;
    } else {
      for (const child of node.childNodes) { if (found) break; walk(child); }
    }
  }
  walk(renderedPre);
  if (!found) { range.selectNodeContents(renderedPre); range.collapse(false); }
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Rendered pane input wiring ─────────────────────────────────────────────────

function wireRenderedPane() {
  renderedPre.addEventListener('input', () => {
    if (_suppressRenderedInput) return;
    const newPlain = renderedPre.textContent;
    const oldPlain = _lastPlainText;
    const raw = rawEl.value;
    // Simple diff: find common prefix + suffix
    let pfx = 0;
    while (pfx < oldPlain.length && pfx < newPlain.length && oldPlain[pfx] === newPlain[pfx]) pfx++;
    let sfx = 0;
    const maxSfx = Math.min(oldPlain.length - pfx, newPlain.length - pfx);
    while (sfx < maxSfx && oldPlain[oldPlain.length - 1 - sfx] === newPlain[newPlain.length - 1 - sfx]) sfx++;
    const delCount = oldPlain.length - pfx - sfx;
    const insText  = sfx > 0 ? newPlain.slice(pfx, newPlain.length - sfx) : newPlain.slice(pfx);
    const rawStart = plainToRaw(raw, pfx);
    const rawEnd   = plainToRaw(raw, pfx + delCount);
    rawEl.value = raw.slice(0, rawStart) + insText + raw.slice(rawEnd);
    _pendingRenderedCaret = pfx + insText.length;
    // Update baseline synchronously so rapid keystrokes don't compound diffs.
    // Do NOT call scheduleRender here — the rendered DOM is already correct while
    // the user is typing. Re-render fires on blur (pane switch).
    _lastPlainText = renderedPre.textContent;
  });

  // Track which pane is active so updateRendered knows whether to rebuild the DOM.
  renderedPre.addEventListener('focus', () => {
    _activePane = 'rendered';
    _lastPlainText = renderedPre.textContent;
  });
  renderedPre.addEventListener('blur', () => {
    // Capture the current selection/caret BEFORE focus leaves the pane.
    // window.getSelection() is still valid here; it clears once focus fully moves.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && renderedPre.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      _savedRenderedOffsets = getRenderedSelectionOffsets();
    } else {
      _savedRenderedOffsets = null;
    }
    _activePane = 'raw';
    scheduleRender(); // Re-render from raw to apply any pending color code changes.
  });
  rawEl.addEventListener('focus', () => {
    _activePane = 'raw';
    _savedRenderedOffsets = null; // raw editor is now active; discard stale rendered selection
  });
}

// ── Color insertion ────────────────────────────────────────────────────────

function insertAtCursor(code) {
  // Priority 1: use offsets saved when rendered pane blurred.
  if (_savedRenderedOffsets !== null) {
    const offsets = _savedRenderedOffsets;
    _savedRenderedOffsets = null;
    const raw = rawEl.value;
    const rawStart = plainToRaw(raw, offsets.start);
    const rawEnd   = plainToRaw(raw, offsets.end);
    if (offsets.start !== offsets.end) {
      const selected = raw.slice(rawStart, rawEnd);
      const resume   = buildResumeCode(code, raw, rawStart);
      rawEl.value = raw.slice(0, rawStart) + code + selected + resume + raw.slice(rawEnd);
      _pendingRenderedCaret = offsets.end;
    } else {
      rawEl.value = raw.slice(0, rawStart) + code + raw.slice(rawStart);
      _pendingRenderedCaret = offsets.start;
    }
    pushUndoNow();
    _activePane = 'raw';
    scheduleRender();
    return;
  }

  // Priority 2: live rendered selection still active.
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    if (renderedPre.contains(range.commonAncestorContainer)) {
      const offsets = getRenderedSelectionOffsets();
      if (offsets && offsets.start !== offsets.end) {
        const raw = rawEl.value;
        const rawStart = plainToRaw(raw, offsets.start);
        const rawEnd   = plainToRaw(raw, offsets.end);
        const selected = raw.slice(rawStart, rawEnd);
        const resume   = buildResumeCode(code, raw, rawStart);
        rawEl.value = raw.slice(0, rawStart) + code + selected + resume + raw.slice(rawEnd);
        _pendingRenderedCaret = offsets.end;
        pushUndoNow();
        _activePane = 'raw';
        scheduleRender();
        return;
      }
    }
  }

  // Default: insert at raw editor cursor.
  const start = rawEl.selectionStart;
  const end   = rawEl.selectionEnd;
  const raw   = rawEl.value;

  if (start !== end) {
    const selected = raw.slice(start, end);
    const resume   = buildResumeCode(code, raw, start);
    rawEl.setRangeText(code + selected + resume, start, end, 'end');
  } else {
    rawEl.setRangeText(code, start, end, 'end');
  }
  rawEl.focus();
  pushUndoNow();
  scheduleRender();
}

// ── Sidebar builder ────────────────────────────────────────────────────────

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  // — Layout section —
  const layoutSec = mkSection('Layout');
  const layoutBtns = div('align-buttons');
  ['Vertical', 'Horizontal'].forEach(name => {
    const btn = mkButton(name, () => {
      state.layout = name.toLowerCase();
      applyLayout();
      buildSidebar(); // rebuild to update active state
    });
    if (state.layout === name.toLowerCase()) btn.classList.add('active');
    layoutBtns.appendChild(btn);
  });
  layoutSec.appendChild(layoutBtns);
  sidebar.appendChild(layoutSec);

  // — Alignment section —
  const alignSec = mkSection('Text Align');
  const alignBtns = div('align-buttons');
  ['Left', 'Center', 'Right', 'Justify'].forEach(name => {
    const btn = mkButton(name, () => applyAlignmentToSelection(name.toLowerCase()));
    alignBtns.appendChild(btn);
  });
  alignSec.appendChild(alignBtns);
  sidebar.appendChild(alignSec);

  // — Style shortcuts (one-shot code inserts) —
  const styleSec = mkSection('Style');
  const styleBtns = div('style-buttons');
  [
    { label: 'Bold',    code: '{e' },  // ESC[1m
    { label: 'Italic',  code: '{E' },  // ESC[3m
    { label: 'Under',   code: '{H' },  // ESC[4m
    { label: 'Strike',  code: '{p' },  // ESC[9m
  ].forEach(({ label, code }) => {
    const btn = mkButton(label, () => insertAtCursor(code));
    styleBtns.appendChild(btn);
  });
  styleSec.appendChild(styleBtns);
  sidebar.appendChild(styleSec);

  // — Color swatches (grouped) —
  const fgSec = mkSection('Foreground Colors');
  const fgCodes = Object.entries(COLOR_CODES).filter(([, d]) => !d.isBg && !d.isReset);
  const fgGrid = div('sidebar-swatches');
  fgGrid.style.display = 'flex';
  fgGrid.style.flexWrap = 'wrap';
  fgGrid.style.gap = '2px';
  fgCodes.forEach(([code, def]) => {
    const swatch = mkSwatch(code, def.label, def.fg || '#888');
    fgGrid.appendChild(swatch);
  });
  fgSec.appendChild(fgGrid);
  sidebar.appendChild(fgSec);

  const bgSec = mkSection('Background Colors');
  const bgCodes = Object.entries(COLOR_CODES).filter(([, d]) => d.isBg);
  const bgGrid = div('sidebar-swatches');
  bgGrid.style.display = 'flex';
  bgGrid.style.flexWrap = 'wrap';
  bgGrid.style.gap = '2px';
  bgCodes.forEach(([code, def]) => {
    const swatch = mkSwatch(code, def.label, def.bg || '#888', true);
    bgGrid.appendChild(swatch);
  });
  bgSec.appendChild(bgGrid);
  sidebar.appendChild(bgSec);

  // — Reset —
  const resetSec = mkSection('Reset');
  const resetBtn = mkButton('{x Reset', () => insertAtCursor('{x'));
  resetSec.appendChild(resetBtn);
  sidebar.appendChild(resetSec);

  // — xterm 256 color spectrum (12 per row, 6+6 split, spectrum layout matching help.db entry 198) —
  const xtermSec = mkSection('xterm-256 Colors');
  const spectrum = document.createElement('div');
  spectrum.className = 'xterm-spectrum';

  function makeXtermCell(n) {
    const cell = document.createElement('div');
    cell.className = 'xterm-cell';
    const bg = xterm256ToCss(n);
    cell.style.backgroundColor = bg;
    cell.title = `${n} — ${bg}\nLeft click: fg  Right click: bg`;
    cell.textContent = String(n);
    const r = parseInt(bg.slice(1, 3), 16);
    const g2 = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    cell.style.color = (0.299 * r + 0.587 * g2 + 0.114 * b) > 128 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
    cell.addEventListener('click', () => insertAtCursor(`{=${n}}`));
    cell.addEventListener('contextmenu', e => { e.preventDefault(); insertAtCursor(`{=b${n}}`); });
    return cell;
  }

  function makeXtermRow(h1Start, h2Start) {
    const row = document.createElement('div');
    row.className = 'xterm-row';
    for (let b = 0; b < 6; b++) row.appendChild(makeXtermCell(h1Start + b));
    const gap = document.createElement('div'); gap.className = 'xterm-half-gap'; row.appendChild(gap);
    for (let b = 0; b < 6; b++) row.appendChild(makeXtermCell(h2Start + b));
    return row;
  }

  // 3 color cube groups: g = 0&1, 2&3, 4&5
  for (let gBase = 0; gBase < 6; gBase += 2) {
    const grp = document.createElement('div');
    grp.className = 'xterm-group';
    for (let r = 0; r < 6; r++) {
      grp.appendChild(makeXtermRow(
        16 + 36 * r + 6 * gBase,
        16 + 36 * r + 6 * (gBase + 1)
      ));
    }
    spectrum.appendChild(grp);
  }

  // Grayscale: 232-255
  const grayGrp = document.createElement('div');
  grayGrp.className = 'xterm-group';
  grayGrp.appendChild(makeXtermRow(232, 238));
  grayGrp.appendChild(makeXtermRow(244, 250));
  spectrum.appendChild(grayGrp);

  xtermSec.appendChild(spectrum);
  sidebar.appendChild(xtermSec);
}

function mkSection(title) {
  const sec = document.createElement('div');
  sec.className = 'sidebar-section';
  const h = document.createElement('h4');
  h.textContent = title;
  sec.appendChild(h);
  return sec;
}

function mkButton(label, onClick) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function div(className) {
  const d = document.createElement('div');
  if (className) d.className = className;
  return d;
}

function mkSwatch(code, label, color, isBg) {
  const wrap = document.createElement('div');
  wrap.className = 'code-swatch';
  wrap.title = `{${code} — ${label}`;

  const box = document.createElement('span');
  box.className = 'swatch-box';
  if (isBg) box.style.backgroundColor = color;
  else       box.style.backgroundColor = color;

  const lbl = document.createElement('span');
  lbl.textContent = `{${code}`;
  lbl.style.color = isBg ? '#ccc' : color;

  wrap.appendChild(box);
  wrap.appendChild(lbl);
  wrap.addEventListener('click', () => insertAtCursor(`{${code}`));
  return wrap;
}

// ── Cheat sheet ────────────────────────────────────────────────────────────

function buildCheatSheet() {
  cheatBody.innerHTML = '';
  Object.entries(COLOR_CODES).forEach(([code, def]) => {
    const entry = document.createElement('div');
    entry.className = 'cheat-entry';
    entry.title = def.label;

    const codeSpan = document.createElement('span');
    codeSpan.className = 'cheat-code';
    codeSpan.textContent = `{${code}`;

    const box = document.createElement('span');
    box.className = 'swatch-box';
    box.style.backgroundColor = def.isBg ? (def.bg || '#888') : (def.fg || '#555');

    const lbl = document.createElement('span');
    lbl.textContent = def.label;
    const displayColor = def.isBg ? '#ccc' : (def.fg || '#888');
    lbl.style.color = displayColor;
    if (def.bold) lbl.style.fontWeight = 'bold';
    if (def.underline) lbl.style.textDecoration = 'underline';

    entry.appendChild(codeSpan);
    entry.appendChild(box);
    entry.appendChild(lbl);
    entry.addEventListener('click', () => insertAtCursor(`{${code}`));
    cheatBody.appendChild(entry);
  });
}

// ── Layout ────────────────────────────────────────────────────────────────

function applyLayout() {
  // Reset any manually dragged pane sizes
  document.querySelectorAll('.editor-pane').forEach(p => {
    p.style.flex = ''; p.style.width = ''; p.style.height = '';
  });
  if (state.layout === 'horizontal') {
    editorsEl.classList.add('horizontal');
  } else {
    editorsEl.classList.remove('horizontal');
  }
  drawRulers();
}

function toggleCheatSheet() {
  state.cheatSheetVisible = !state.cheatSheetVisible;
  cheatSheet.classList.toggle('hidden', !state.cheatSheetVisible);
  const cs = document.getElementById('cheat-splitter');
  if (cs) cs.classList.toggle('hidden', !state.cheatSheetVisible);
}

// ── Find/Replace ──────────────────────────────────────────────────────────

let findMatches = [];
let findIndex = -1;

function toggleFindBar() {
  const hidden = findBar.classList.toggle('hidden');
  if (!hidden) {
    findInput.focus();
    findInput.select();
  }
}

function doFind() {
  const needle = findInput.value;
  if (!needle) { findCount.textContent = ''; findMatches = []; return; }
  const raw = rawEl.value;
  findMatches = [];
  let idx = 0;
  while (true) {
    const pos = raw.indexOf(needle, idx);
    if (pos === -1) break;
    findMatches.push(pos);
    idx = pos + 1;
  }
  findCount.textContent = `${findMatches.length} match${findMatches.length !== 1 ? 'es' : ''}`;
  if (findMatches.length > 0) {
    findIndex = 0;
    highlightMatch(findMatches[0], needle.length);
  }
}

function findNext() {
  if (findMatches.length === 0) { doFind(); return; }
  findIndex = (findIndex + 1) % findMatches.length;
  highlightMatch(findMatches[findIndex], findInput.value.length);
}

function findPrev() {
  if (findMatches.length === 0) { doFind(); return; }
  findIndex = (findIndex - 1 + findMatches.length) % findMatches.length;
  highlightMatch(findMatches[findIndex], findInput.value.length);
}

function highlightMatch(pos, len) {
  rawEl.focus();
  rawEl.setSelectionRange(pos, pos + len);
  // scroll into view
  const lineNum = rawEl.value.slice(0, pos).split('\n').length - 1;
  const lineH = state.fontSize * 1.4;
  rawEl.scrollTop = lineNum * lineH;
}

function doReplaceOne() {
  if (findMatches.length === 0) { doFind(); if (findMatches.length === 0) return; }
  const needle = findInput.value;
  const repl   = replInput.value;
  const pos    = findMatches[findIndex >= 0 ? findIndex : 0];
  rawEl.setRangeText(repl, pos, pos + needle.length, 'end');
  scheduleRender();
  doFind();
}

function doReplaceAll() {
  const needle = findInput.value;
  if (!needle) return;
  const repl = replInput.value;
  rawEl.value = rawEl.value.split(needle).join(repl);
  scheduleRender();
  doFind();
}

// ── Copy helpers ───────────────────────────────────────────────────────────

function copyRaw() {
  navigator.clipboard.writeText(rawEl.value).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = rawEl.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function copyRendered() {
  const text = stripCodes(rawEl.value);
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function doStripColors() {
  rawEl.value = stripCodes(rawEl.value);
  scheduleRender();
}

// ── Caret status ───────────────────────────────────────────────────────────

function updateCaretStatus() {
  const pos = rawEl.selectionStart;
  const raw = rawEl.value.slice(0, pos);
  const lines = raw.split('\n');
  const line = lines.length;
  const col  = lines[lines.length - 1].length + 1;
  const visCol = visibleLength(lines[lines.length - 1]) + 1;
  statusCaret.textContent = `Ln ${line}, Col ${col} (vis ${visCol})`;
}

// ── Font size ──────────────────────────────────────────────────────────────

function applyFontSize(size) {
  state.fontSize = size;
  _cachedCharW = null; // invalidate
  rawEl.style.fontSize = size + 'px';
  renderedPre.style.fontSize = size + 'px';
  drawRulers();
  updateWidthGuide();
}

// ── Width guide line ──────────────────────────────────────────────────────

function updateWidthGuide() {
  const charW = measureCharWidth(state.fontSize);
  const x = Math.round(8 + charW * state.widthLimit); // 8px left padding
  const line = `linear-gradient(to right, transparent ${x}px, rgba(255,255,255,0.13) ${x}px, rgba(255,255,255,0.13) ${x + 1}px, transparent ${x + 1}px)`;
  // Only show the guide in the rendered pane — it is accurate there because color
  // codes are rendered as spans and don't consume character positions. In the raw
  // textarea the guide would be wrong because code sequences eat character slots.
  rawEl.style.backgroundImage = 'none';
  document.getElementById('rendered-output').style.backgroundImage = line;
}

// ── Toolbar wiring ─────────────────────────────────────────────────────────

function wireToolbar() {
  document.getElementById('btn-copy-raw').addEventListener('click', copyRaw);
  document.getElementById('btn-copy-rendered').addEventListener('click', copyRendered);
  document.getElementById('btn-strip').addEventListener('click', doStripColors);
  document.getElementById('btn-undo').addEventListener('click', doUndo);
  document.getElementById('btn-find').addEventListener('click', toggleFindBar);
  document.getElementById('btn-cheat').addEventListener('click', toggleCheatSheet);
  document.getElementById('btn-layout').addEventListener('click', () => {
    state.layout = state.layout === 'vertical' ? 'horizontal' : 'vertical';
    applyLayout();
    buildSidebar();
    document.getElementById('btn-layout').textContent = state.layout === 'vertical' ? 'H Split' : 'V Split';
  });

  widthSpinner.value = state.widthLimit;
  widthSpinner.addEventListener('change', () => {
    state.widthLimit = Math.max(20, Math.min(300, parseInt(widthSpinner.value, 10) || 120));
    widthSpinner.value = state.widthLimit;
    drawRulers();
    scheduleRender();
    updateWidthGuide();
  });

  fontSpinner.value = state.fontSize;
  fontSpinner.addEventListener('change', () => {
    const sz = Math.max(8, Math.min(32, parseInt(fontSpinner.value, 10) || 13));
    fontSpinner.value = sz;
    applyFontSize(sz);
  });

  // Background color pickers
  const rawBgPicker  = document.getElementById('raw-bg-color');
  const rendBgPicker = document.getElementById('rend-bg-color');
  rawBgPicker.addEventListener('input', () => {
    rawEl.style.backgroundColor = rawBgPicker.value;
  });
  rendBgPicker.addEventListener('input', () => {
    document.getElementById('rendered-output').style.backgroundColor = rendBgPicker.value;
  });

  // Find bar
  findInput.addEventListener('input', doFind);
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext(); }
    if (e.key === 'Escape') findBar.classList.add('hidden');
  });
  document.getElementById('btn-find-prev').addEventListener('click', findPrev);
  document.getElementById('btn-find-next').addEventListener('click', findNext);
  document.getElementById('btn-replace-one').addEventListener('click', doReplaceOne);
  document.getElementById('btn-replace-all').addEventListener('click', doReplaceAll);
  document.getElementById('btn-find-close').addEventListener('click', () => findBar.classList.add('hidden'));

  // Keyboard shortcut Ctrl+F / Cmd+F
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleFindBar();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      doUndo();
    }
  });
}

// ── Raw editor wiring ──────────────────────────────────────────────────────

function wireRawEditor() {
  rawEl.addEventListener('input', () => { scheduleRender(); schedulePushUndo(); });
  rawEl.addEventListener('keyup', updateCaretStatus);
  rawEl.addEventListener('click', updateCaretStatus);
  rawEl.addEventListener('scroll', drawRulers);
}

// ── Resize observer + splitter drag ───────────────────────────────────────────

function wireSplitters() {
  const paneSplitter  = document.getElementById('pane-splitter');
  const cheatSplitter = document.getElementById('cheat-splitter');
  const panes = document.querySelectorAll('.editor-pane');
  const pane1 = panes[0];
  const pane2 = panes[1];

  /**
   * Attach mouse+touch drag to a handle element.
   * onStart(ev0) is called on drag start and must return a move handler.
   */
  function attachDrag(handle, onStart) {
    function start(e) {
      e.preventDefault();
      handle.classList.add('dragging');
      const ev0 = e.touches ? e.touches[0] : e;
      const onMove = onStart(ev0);
      function move(e2) { onMove(e2.touches ? e2.touches[0] : e2); }
      function up() {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', up);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', up);
    }
    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
  }

  if (paneSplitter && pane1 && pane2) {
    attachDrag(paneSplitter, (ev0) => {
      const isH = state.layout === 'horizontal';
      const startPos   = isH ? ev0.clientX : ev0.clientY;
      const startSize1 = isH ? pane1.offsetWidth  : pane1.offsetHeight;
      const startSize2 = isH ? pane2.offsetWidth  : pane2.offsetHeight;
      const total = startSize1 + startSize2;
      return (ev) => {
        const delta = (isH ? ev.clientX : ev.clientY) - startPos;
        const s1 = Math.max(60, Math.min(total - 60, startSize1 + delta));
        pane1.style.flex = 'none'; pane2.style.flex = 'none';
        if (isH) { pane1.style.width  = s1 + 'px'; pane2.style.width  = (total - s1) + 'px'; }
        else     { pane1.style.height = s1 + 'px'; pane2.style.height = (total - s1) + 'px'; }
        drawRulers();
      };
    });
  }

  if (cheatSplitter) {
    attachDrag(cheatSplitter, (ev0) => {
      const startX = ev0.clientX;
      const startW = cheatSheet.offsetWidth;
      return (ev) => {
        const newW = Math.max(120, Math.min(600, startW + (startX - ev.clientX)));
        cheatSheet.style.width = newW + 'px';
        drawRulers();
      };
    });
  }
}

function wireResize() {
  const ro = new ResizeObserver(() => drawRulers());
  ro.observe(document.getElementById('editors'));
  wireSplitters();
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  buildSidebar();
  buildCheatSheet();
  applyLayout();
  wireToolbar();
  wireRawEditor();
  wireRenderedPane();
  wireResize();
  applyFontSize(state.fontSize);
  updateWidthGuide();
  updateRendered();
  drawRulers();
  // Seed undo stack with the initial document state
  pushUndoNow();
}

document.addEventListener('DOMContentLoaded', init);
