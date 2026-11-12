/* puzzles_ui.js - تبويب الألغاز (20 لغزاً بمحتوى ثابت، لا يحتاج محركاً) */
(function () {
  'use strict';
  var TC = window.TC, Chess = window.Chess, Position = Chess.Position, Icons = window.Icons;
  var P = window.PUZZLES || [];
  var $ = function (id) { return document.getElementById(id); };
  var LEVELS = [{ n: '250' }, { n: '500' }, { n: '1000–1500' }, { n: '2000–2100' }];

  var lvl = parseInt(TC.lsGet('z.lvl', '0'), 10) || 0, idx = parseInt(TC.lsGet('z.idx', '0'), 10) || 0;
  var solved = {}; try { solved = JSON.parse(TC.lsGet('z.solved', '{}')) || {}; } catch (e) { solved = {}; }
  var pos = null, z = null, step = 0, sel = -1, locked = false, hint = 0, last = null, done = false, wrong = null, shown = false;
  var board = new TC.BoardView($('zBoard'), $('zArrows'), onTap);

  function ofLevel(l) { return P.filter(function (x) { return x.level === l; }); }
  function saveSolved() { TC.lsSet('z.solved', JSON.stringify(solved)); }
  function sideName(s) { return s === 'w' ? 'الأبيض' : 'الأسود'; }

  function renderChips() {
    var h = '';
    LEVELS.forEach(function (L, i) {
      var list = ofLevel(i), ok = list.filter(function (x) { return solved[x.id]; }).length;
      h += '<div class="chip' + (i === lvl ? ' on' : '') + '" data-l="' + i + '"><bdi dir="ltr">' + L.n + '</bdi> <span class="ok">' + ok + '/' + list.length + '</span></div>';
    });
    $('zLevels').innerHTML = h;
    var l2 = '';
    ofLevel(lvl).forEach(function (x, i) {
      l2 += '<div class="chip' + (i === idx ? ' on' : '') + '" data-i="' + i + '">' + (i + 1) + (solved[x.id] ? ' <span class="ok">✓</span>' : '') + '</div>';
    });
    $('zList').innerHTML = l2;
  }

  function solSan() {
    var p = new Position(z.fen), out = [];
    z.sol.forEach(function (u) { var m = p.fromUci(u); out.push(p.san(m)); p.make(m); });
    return out.join(' ');
  }

  function statusText() {
    if (done) return 'أحسنت! حللت اللغز ✓';
    if (locked) return '…';
    return sideName(z.side) + ' يلعب — ابحث عن أفضل نقلة';
  }

  function render() {
    if (!z) return;
    var targets = [];
    if (sel >= 0 && !locked && !done) targets = pos.movesFrom(sel).map(function (m) { return { to: m.to, cap: !!m.captured }; });
    var arrow = null;
    if (shown && !done || (hint >= 2 && !done)) {
      var hm = pos.fromUci(z.sol[step]); if (hm) arrow = { from: hm.from, to: hm.to };
    }
    board.flip = z.side === 'b';
    var hintSq = (hint >= 1 && !done && sel < 0) ? pos.fromUci(z.sol[step]) : null;
    board.render({
      board: pos.board, last: last, sel: sel >= 0 ? sel : (hintSq ? hintSq.from : -1), targets: targets,
      check: pos.inCheck() ? pos.kingSq(pos.turn) : -1, arrow: arrow,
      hl: wrong ? 'rgba(240,50,50,.65)' : (done ? 'rgba(20,176,140,.6)' : null)
    });
    $('zStatus').textContent = wrong ? 'ليست الأفضل — جرّب نقلة أخرى' : statusText();
    $('zNext').classList.toggle('primary', done);
  }

  function info() {
    $('zInfo').innerHTML = '<div class="big">🧩 اللغز ' + (idx + 1) + ' · ' + z.rating + '</div><div class="sub">' + z.theme + ' — ' + sideName(z.side) + ' يلعب</div>' +
      (shown ? '<div class="sub" style="direction:ltr;text-align:left">' + TC.esc(solSan()) + '</div>' : '');
  }

  function load(l, i) {
    var list = ofLevel(l); if (!list.length) return;
    lvl = Math.max(0, Math.min(3, l)); idx = Math.max(0, Math.min(list.length - 1, i));
    TC.lsSet('z.lvl', String(lvl)); TC.lsSet('z.idx', String(idx));
    z = list[idx]; pos = new Position(z.fen); step = 0; sel = -1; locked = false; hint = 0; last = null; done = false; wrong = null; shown = false;
    renderChips(); info(); render();
  }

  function playSound(m) { window.Sound.play(pos.inCheck() ? 'check' : (m.captured ? 'capture' : 'move')); }

  function finish() {
    done = true; solved[z.id] = 1; saveSolved(); window.Sound.play('success'); renderChips(); render();
  }

  function attempt(m) {
    var u = pos.uci(m), ok = (u === z.sol[step]);
    if (!ok && step === z.sol.length - 1) {            // أي نقلة تعطي مات مقبولة في آخر نقلة
      pos.make(m); var mated = pos.inCheck() && pos.moves().length === 0; pos.unmake(); ok = mated;
    }
    if (ok) {
      pos.make(m); last = [m.from, m.to]; step++; sel = -1; hint = 0; wrong = null; playSound(m);
      if (step >= z.sol.length) { finish(); return; }
      locked = true; render();
      setTimeout(function () {
        var om = pos.fromUci(z.sol[step]); if (!om) { locked = false; render(); return; }
        pos.make(om); last = [om.from, om.to]; step++; playSound(om); locked = false; render();
      }, 650);
    } else {
      locked = true; window.Sound.play('wrong');
      pos.make(m); last = [m.from, m.to]; wrong = true; sel = -1; render();
      setTimeout(function () { pos.unmake(); last = null; wrong = null; locked = false; render(); }, 800);
    }
  }

  function onTap(i) {
    if (!z || locked || done) return;
    if (sel >= 0) {
      var c = pos.movesFrom(sel).filter(function (m) { return m.to === i; });
      if (c.length) {
        var pick = c.filter(function (m) { return pos.uci(m) === z.sol[step]; })[0] ||
                   c.filter(function (m) { return m.promo === 'q'; })[0] || c[0];
        attempt(pick); return;
      }
    }
    var p = pos.board[i];
    if (p && Chess.colorOf(p) === pos.turn) sel = (sel === i) ? -1 : i; else sel = -1;
    render();
  }

  $('zLevels').addEventListener('click', function (e) { var t = e.target; while (t && t.getAttribute && !t.getAttribute('data-l')) t = t.parentNode; if (t && t.getAttribute) load(parseInt(t.getAttribute('data-l'), 10), 0); });
  $('zList').addEventListener('click', function (e) { var t = e.target; while (t && t.getAttribute && !t.getAttribute('data-i')) t = t.parentNode; if (t && t.getAttribute) load(lvl, parseInt(t.getAttribute('data-i'), 10)); });
  $('zHint').onclick = function () { if (!z || done || locked) return; hint = Math.min(2, hint + 1); sel = -1; render(); };
  $('zSolution').onclick = function () { if (!z || done || locked) return; shown = true; info(); render(); };
  $('zRetry').onclick = function () { load(lvl, idx); };
  $('zNext').onclick = function () {
    var list = ofLevel(lvl);
    if (idx + 1 < list.length) load(lvl, idx + 1); else if (lvl < 3) load(lvl + 1, 0); else load(0, 0);
  };
  TC.onPieces(function () { render(); });
  if (P.length) load(lvl, idx);
})();
