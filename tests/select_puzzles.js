// اختيار 20 لغزاً (5 لكل مستوى) والتحقق المستقل منها بـ Stockfish ثم كتابة assets/puzzles.js
const { spawn } = require('child_process'); const readline = require('readline'); const path = require('path'); const fs = require('fs');
const { UciEngine, scoreToCp } = require('../app/src/main/assets/engine.js');
const { Position } = require('../app/src/main/assets/rules.js');
const exe = process.argv[2];
const raw = [].concat(...process.argv.slice(3).map(f => JSON.parse(fs.readFileSync(f, 'utf8'))));
const seen = new Set(); const pool = raw.filter(x => { const k = x.fen.split(' ').slice(0, 4).join(' '); if (seen.has(k)) return false; seen.add(k); return true; });
const child = spawn(exe, [], { cwd: path.dirname(exe) });
const rl = readline.createInterface({ input: child.stdout });
const eng = new UciEngine(l => child.stdin.write(l + '\n')); rl.on('line', l => eng.onLine(l)); child.stderr.on('data', () => {});
const isMate = p => p.inCheck() && p.moves().length === 0;

async function search(fen, ms, exclude) {
  const p = new Position(fen); let legal = p.moves().map(m => p.uci(m)); const o = { fen, movetime: ms };
  if (exclude) { legal = legal.filter(u => u !== exclude); if (!legal.length) return null; o.searchmoves = legal; }
  const r = await eng.search(o); return r.score ? { best: r.best, cp: scoreToCp(r.score) } : null;
}
// تحقق مستقل: كل نقلة للاعب هي الأفضل بفارق واضح (أو تُنهي بمات)
async function recheck(pz) {
  const p = new Position(pz.fen);
  for (let i = 0; i < pz.sol.length; i++) {
    const m = p.fromUci(pz.sol[i]); if (!m) return false;
    if (i % 2 === 0) {
      p.make(m); const mated = isMate(p); p.unmake();
      if (!mated) {
        const a = await search(p.fen(), 1500); if (!a || a.best !== pz.sol[i]) return false;
        const b = await search(p.fen(), 900, pz.sol[i]); if (b && a.cp - b.cp < 150 && !(a.cp > 9000)) return false;
      }
    }
    p.make(m);
  }
  return true;
}
const theme = pz => pz.mateN === 1 ? 'مات في نقلة' : pz.mateN === 2 ? 'مات في نقلتين' : pz.mateN ? 'مات في ' + pz.mateN + ' نقلات' : (pz.gain >= 250 ? 'اربح مادة' : 'ميزة حاسمة');

(async () => {
  await eng.init({ threads: 1, hashMB: 64 });
  const L = [
    pool.filter(x => x.dstar === 1 && x.sol.length === 1).sort((a, b) => (b.mates1 > 0) - (a.mates1 > 0) || b.gain - a.gain),
    pool.filter(x => x.dstar <= 3 && (x.sol.length >= 3 || x.mateN >= 2 || x.dstar >= 2)).sort((a, b) => a.sol.length - b.sol.length || a.dstar - b.dstar),
    pool.filter(x => x.dstar >= 4 && x.dstar <= 9).sort((a, b) => a.dstar - b.dstar),
    pool.filter(x => x.dstar >= 10).sort((a, b) => a.dstar - b.dstar)
  ];
  const ratings = [[250, 250, 250, 250, 250], [500, 500, 500, 500, 500], [1000, 1150, 1300, 1400, 1500], [2000, 2025, 2050, 2075, 2100]];
  const used = new Set(), out = [];
  for (let lv = 0; lv < 4; lv++) {
    const picked = [], games = new Set(); let tried = 0;
    // نوزّع الاختيار على الجانبين وعلى المباريات المختلفة
    const cands = L[lv].filter(x => !used.has(x.fen));
    // تفضيل التنويع: ترتيب بالتناوب بين الأبيض والأسود
    const w = cands.filter(x => x.side === 'w'), b = cands.filter(x => x.side === 'b'), mixed = [];
    for (let i = 0; i < Math.max(w.length, b.length); i++) { if (w[i]) mixed.push(w[i]); if (b[i]) mixed.push(b[i]); }
    for (const c of mixed) {
      if (picked.length >= 5) break;
      if (games.has(c.game) && lv !== 0) continue;
      tried++; const ok = await recheck(c);
      console.log('L' + (lv + 1), ok ? 'OK ' : 'REJ', 'd*' + c.dstar, 'len' + c.sol.length, c.side, theme(c));
      if (ok) { picked.push(c); games.add(c.game); used.add(c.fen); }
    }
    picked.sort((a, b) => a.dstar - b.dstar || a.sol.length - b.sol.length);
    picked.forEach((c, i) => out.push({ id: 'L' + (lv + 1) + '-' + (i + 1), level: lv, rating: ratings[lv][i], fen: c.fen, side: c.side, sol: c.sol, theme: theme(c) }));
    console.log('level', lv + 1, 'picked', picked.length);
  }
  fs.writeFileSync(path.join(__dirname, '../app/src/main/assets/puzzles.js'),
    '/* 20 لغزاً: تم اختيارها وفحصها بمحرك Stockfish (كل نقلة للاعب هي الأفضل بفارق واضح) */\nwindow.PUZZLES = ' + JSON.stringify(out, null, 1) + ';\n');
  console.log('written', out.length);
  child.stdin.write('quit\n'); setTimeout(() => process.exit(0), 200);
})().catch(e => { console.error(e); process.exit(1); });
