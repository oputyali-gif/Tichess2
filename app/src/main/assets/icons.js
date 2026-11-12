/* icons.js - أيقونات تصنيف النقلات (دوائر ملونة برموز بيضاء) */
(function (root) {
  'use strict';

  var W = '#fff';
  function bang(cx, cy, s) {          // علامة تعجب
    var h = 9 * s, w = 3.1 * s;
    return '<rect x="' + (cx - w / 2) + '" y="' + (cy - 8.6 * s) + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '" fill="' + W + '"/>' +
      '<circle cx="' + cx + '" cy="' + (cy + 5.8 * s) + '" r="' + (1.75 * s) + '" fill="' + W + '"/>';
  }
  function ques(cx, cy, s) {          // علامة استفهام
    return '<path transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')" d="M-3.6 -4.2 C-3.6 -7 -1.6 -8.6 0.4 -8.6 C2.6 -8.6 4.4 -7.2 4.4 -5 C4.4 -3 3 -2.2 1.8 -1.2 C0.8 -0.4 0.6 0.4 0.6 1.6" fill="none" stroke="' + W + '" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + (cx + 0.6 * s) + '" cy="' + (cy + 5.8 * s) + '" r="' + (1.75 * s) + '" fill="' + W + '"/>';
  }

  var GLYPH = {
    brilliant: function () { return bang(8.3, 12.4, 0.95) + bang(15.7, 12.4, 0.95); },
    great: function () { return bang(12, 12.4, 1.1); },
    correct: function () { return '<path d="M5.8 12.6 L10.3 17 L18.4 7.6" fill="none" stroke="' + W + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'; },
    inaccuracy: function () { return ques(8.4, 12.4, 0.82) + bang(16.6, 12.4, 0.82); },
    mistake: function () { return ques(11.4, 12.4, 1.08); },
    blunder: function () { return ques(7.9, 12.4, 0.85) + ques(16.1, 12.4, 0.85); },
    dubious: function () { return ques(11.4, 12.4, 1.0); },
    miss: function () { return '<rect x="5.5" y="10.2" width="13" height="3.6" rx="0.8" fill="' + W + '"/>'; },
    draw: function () { return '<rect x="5.8" y="7.8" width="12.4" height="3.1" rx="0.7" fill="' + W + '"/><rect x="5.8" y="13.1" width="12.4" height="3.1" rx="0.7" fill="' + W + '"/>'; },
    excellent: function () { return '<path d="M12 3.8 L14.5 9.6 L20.6 10.1 L16 14.2 L17.4 20.2 L12 17 L6.6 20.2 L8 14.2 L3.4 10.1 L9.5 9.6 Z" fill="' + W + '" stroke="' + W + '" stroke-width="1" stroke-linejoin="round"/>'; },
    good: function () { return '<path transform="translate(2.8 2.6) scale(0.78)" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="' + W + '"/>'; },
    forced: function () { return '<path d="M13.4 4.8 L21 11.6 L13.4 18.4 V14 C9.2 13.8 6.2 15.4 4.2 19.4 C4.6 13 8 9.6 13.4 9.2 Z" fill="' + W + '" stroke="' + W + '" stroke-width="0.8" stroke-linejoin="round"/>'; },
    book: function () { return '<path d="M12 7 C9.8 5.4 6.8 5 3.6 5.4 V17.6 C6.8 17.2 9.8 17.6 12 19.2 C14.2 17.6 17.2 17.2 20.4 17.6 V5.4 C17.2 5 14.2 5.4 12 7 Z" fill="' + W + '"/><path d="M12 7 V19" stroke="__BG__" stroke-width="1.4" fill="none"/>'; },
    mate: function () { return '<path d="M9.4 5.6 V18.4 M14.6 5.6 V18.4 M5.6 9.4 H18.4 M5.6 14.6 H18.4" fill="none" stroke="' + W + '" stroke-width="2.3" stroke-linecap="round"/>'; }
  };

  var COLORS = {
    brilliant: '#14b08c', great: '#06a7cb', correct: '#45a82e', inaccuracy: '#f7c20f', mistake: '#ff9a0a',
    blunder: '#f03232', dubious: '#d3bd55', miss: '#93a4b3', draw: '#c8a073', excellent: '#8e4fd8', good: '#0cb98a',
    forced: '#08b9d8', book: '#1a7df0', mate: '#333333'
  };

  function svg(cat, px) {
    var g = GLYPH[cat]; if (!g) return '';
    var col = COLORS[cat] || '#888';
    var body = g().replace('__BG__', col);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" style="display:block"><circle cx="12" cy="12" r="11.4" fill="' + col + '"/>' + body + '</svg>';
  }

  var api = { svg: svg, COLORS: COLORS, hasGlyph: function (c) { return !!GLYPH[c]; } };
  root.Icons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
