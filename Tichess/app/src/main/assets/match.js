/* match.js - مباراة بين محركين (كل محرك في عملية مستقلة) */
(function () {
  'use strict';
  var TC = window.TC, Chess = window.Chess, Position = Chess.Position, Bots = window.Bots;
  var $ = function (id) { return document.getElementById(id); };
  var board = new TC.BoardView($('mBoard'), $('mArrows'), null);
  var run = 0, paused = false, running = false, pos = new Position(), hist = [], engs = [null, null], lvs = [null, null], conf = [null, null];
  var over = false, resultText = '', filled = false, lastResult = '*';

  function engName(id) { var l = TC.engineList(), n = id; l.forEach(function (e) { if (e.id === id) n = e.name; }); return n; }
  function T() { return parseInt($('mTime').value, 10) || 1000; }
  function label(c, lv) { return engName(c.id) + ' · ' + TC.botName(c.bot) + (lv && lv.rating ? ' ' + lv.rating : ''); }

  function fill() {
    if (filled) return; var list = TC.engineList(); if (!list.length) return; filled = true;
    ['W', 'B'].forEach(function (s) {
      var e = $('mEng' + s), b = $('mBot' + s); e.innerHTML = ''; b.innerHTML = '';
      list.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.name; e.appendChild(o); });
      Bots.BOTS.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.name; b.appendChild(o); });
      var o = document.createElement('option'); o.value = 'max'; o.textContent = '🔥 بلا حدود'; b.appendChild(o);
      b.value = 'max';
      e.onchange = b.onchange = refreshLabels;
    });
    if (list.length > 1) $('mEngB').value = list[1].id;
    refreshLabels();
  }
  // نعرض التقييم داخل خيارات البوتات حسب المحرك المختار
  function refreshLabels() {
    ['W', 'B'].forEach(function (s) {
      var id = $('mEng' + s).value, b = $('mBot' + s);
      for (var i = 0; i < b.options.length; i++) {
        var v = b.options[i].value; if (v === 'max') continue;
        b.options[i].textContent = TC.botName(v) + ' (' + Bots.level(v, id).rating + ')';
      }
    });
  }

  function render() {
    var last = hist.length ? [hist[hist.length - 1].from, hist[hist.length - 1].to] : null;
    board.render({ board: pos.board, last: last, check: pos.inCheck() ? pos.kingSq(pos.turn) : -1 });
    var s = '', p2 = new Position(Chess.START_FEN);
    hist.forEach(function (h) { if (p2.turn === 'w') s += p2.full + '. '; s += h.san + ' '; p2.make(p2.fromUci(h.uci)); });
    $('mMoves').textContent = s || 'ستظهر النقلات هنا';
    $('mMoves').scrollTop = $('mMoves').scrollHeight;
    $('mPause').textContent = paused ? '▶ استئناف' : '⏸ إيقاف مؤقت';
  }
  function status(t) { $('mStatus').textContent = t; }

  function releaseEngines() { TC.killEngine(1); TC.killEngine(2); engs = [null, null]; }

  function start() {
    if (!TC.hasBridge()) { TC.banner('المباراة بين محركين تعمل داخل التطبيق فقط'); return; }
    fill(); run++; var my = run;
    releaseEngines(); TC.killEngine(0);                // نحرر المحرك الرئيسي لتوفير الذاكرة
    conf = [{ id: $('mEngW').value, bot: $('mBotW').value }, { id: $('mEngB').value, bot: $('mBotB').value }];
    lvs = [Bots.level(conf[0].bot, conf[0].id, T()), Bots.level(conf[1].bot, conf[1].id, T())];
    pos = new Position(); hist = []; over = false; paused = false; running = true; resultText = ''; render();
    status('جاري تشغيل المحركين…'); TC.banner('');
    Promise.all([TC.spawnEngine(conf[0].id, 1), TC.spawnEngine(conf[1].id, 2)]).then(function (e) {
      if (my !== run) { releaseEngines(); return; }
      engs = e;
      return Promise.all([Bots.applyLevel(e[0], lvs[0]), Bots.applyLevel(e[1], lvs[1])]);
    }).then(function () {
      if (my !== run) return;
      status('⚪ ' + label(conf[0], lvs[0]) + '  ضد  ⚫ ' + label(conf[1], lvs[1]));
      loop(my);
    }).catch(function (e) { if (my === run) { running = false; TC.banner('تعذّر تشغيل المحركين: ' + e.message); status('تعذّر البدء'); releaseEngines(); } });
  }

  function loop(my) {
    if (my !== run || !running) return;
    if (paused) return;
    var st = pos.status(); if (st.over) { finish(st); return; }
    var i = pos.turn === 'w' ? 0 : 1;
    Bots.pickMove(engs[i], pos, lvs[i]).then(function (m) {
      if (my !== run || !running) return;
      if (!m) { finish(pos.status()); return; }
      var san = pos.san(m); pos.make(m);
      hist.push({ uci: Chess.sqName(m.from) + Chess.sqName(m.to) + (m.promo || ''), san: san, from: m.from, to: m.to });
      window.Sound.play(pos.inCheck() ? 'check' : (m.captured ? 'capture' : 'move'));
      render();
      setTimeout(function () { loop(my); }, parseInt($('mSpeed').value, 10) || 600);
    }).catch(function (e) { if (my === run) { TC.banner('خطأ من المحرك: ' + e.message); running = false; } });
  }

  function finish(st) {
    running = false; over = true; lastResult = st.result;
    var names = [label(conf[0], lvs[0]), label(conf[1], lvs[1])];
    if (st.reason === 'checkmate') resultText = 'كش مات — فاز ' + (st.result === '1-0' ? '⚪ ' + names[0] : '⚫ ' + names[1]);
    else resultText = 'تعادل (' + ({ stalemate: 'طريق مسدود', insufficient: 'مادة غير كافية', fifty: 'قاعدة الخمسين', repetition: 'تكرار' }[st.reason] || '') + ')';
    status(resultText); window.Sound.play(pos.inCheck() ? 'mate' : 'end'); render();
    releaseEngines();
  }

  function stop() {
    run++; running = false; paused = false; releaseEngines(); status('تم إنهاء المباراة'); render();
  }

  $('mStart').onclick = start;
  $('mPause').onclick = function () { if (!running) return; paused = !paused; render(); if (!paused) loop(run); };
  $('mStop').onclick = function () { if (running) stop(); };
  $('mFlip').onclick = function () { board.flip = !board.flip; render(); };
  $('mAnalyze').onclick = function () {
    if (hist.length < 2) { status('ابدأ مباراة أولاً'); return; }
    var res = over ? lastResult : '*';
    TC.analyzePgn(TC.toPgn(Chess.START_FEN, hist.map(function (h) { return h.uci; }), res, conf[0] ? label(conf[0], lvs[0]) : 'White', conf[1] ? label(conf[1], lvs[1]) : 'Black'));
  };
  TC.onTab(function (name) { if (name === 'match') { fill(); render(); } });
  TC.onPieces(render);
  render();
})();
