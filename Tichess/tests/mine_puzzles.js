// تعدين ألغاز تكتيكية والتحقق منها بـ Stockfish
// usage: node tests/mine_puzzles.js <stockfish-exe> <out.json> [games]
const { spawn } = require('child_process'); const readline = require('readline'); const path = require('path'); const fs = require('fs');
const { UciEngine, scoreToCp } = require('../app/src/main/assets/engine.js');
const { Position, VAL } = require('../app/src/main/assets/rules.js');
const exe = process.argv[2], OUT = process.argv[3], GAMES = parseInt(process.argv[4] || '40', 10);
const child = spawn(exe, [], { cwd: path.dirname(exe) });
const rl = readline.createInterface({ input: child.stdout });
const eng = new UciEngine(l => child.stdin.write(l + '\n')); rl.on('line', l => eng.onLine(l)); child.stderr.on('data', () => {});
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const rnd = (a, b) => a + Math.random() * (b - a);

function material(p, side) { let s = 0; for (const c of p.board) { if (!c || c.toLowerCase() === 'k') continue; const v = VAL[c.toLowerCase()]; s += (c === c.toUpperCase()) === (side === 'w') ? v : -v; } return s; }
const isMate = p => p.inCheck() && p.moves().length === 0;
function matesIn1(p) { const out = []; for (const m of p.moves()) { p.make(m); if (isMate(p)) out.push(p.uci(m)); p.unmake(); } return out; }
async function sc(fen, depth, exclude) {   // نتيجة من وجهة نظر من عليه الدور
  const p = new Position(fen); let legal = p.moves().map(m => p.uci(m));
  const o = { fen, depth, movetime: 30000 };
  if (exclude) { legal = legal.filter(u => u !== exclude); if (!legal.length) return null; o.searchmoves = legal; }
  const r = await eng.search(o); if (!r.score) return null;
  return { cp: scoreToCp(r.score), mate: r.score.type === 'mate' ? r.score.value : null, best: r.best, pv: r.pv };
}

async function genPositions(st) {
  const seen = new Set(st.cands.map(c => c.fen.split(' ').slice(0, 4).join(' ')));
  for (; st.g < GAMES; st.g++) {
    if (out_of_time()) return false;
    const g = st.g, weak = g % 6 === 0;
    const elo = Math.round(rnd(1350, 2600)), pr = weak ? 0.45 : rnd(0.02, 0.1);
    await eng.ready();
    eng.setOption(['UCI_LimitStrength'], 'true'); eng.setOption(['UCI_Elo'], elo); await eng.ready();
    const p = new Position(); let ply = 0;
    while (ply < 110) {
      const stt = p.status(); if (stt.over) break;
      const legal = p.moves(); let m;
      if (Math.random() < pr) m = legal[Math.floor(Math.random() * legal.length)];
      else { const r = await eng.search({ fen: p.fen(), movetime: 12 }); m = r.best ? p.fromUci(r.best, legal) : legal[0]; }
      p.make(m); ply++;
      if (ply >= 8 && !p.inCheck() && Math.random() < 0.6) {
        const k = p.key(); if (!seen.has(k)) { seen.add(k); st.cands.push({ fen: p.fen(), game: g, ply }); }
      }
    }
    if (g % 20 === 19) { save(); log('games', g + 1, 'positions', st.cands.length); }
  }
  eng.setOption(['UCI_LimitStrength'], 'false'); await eng.ready();
  return true;
}

async function verify(c) {
  const fen = c.fen; const p0 = new Position(fen); const me = p0.turn;
  // أقل عمق يثبت عنده الحل
  const depths = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16];
  const bests = [];
  for (const d of depths) { const r = await sc(fen, d); bests.push(r && r.best); }
  const fin = bests[bests.length - 1]; if (!fin) return null;
  let dstar = depths[depths.length - 1];
  for (let k = depths.length - 1; k >= 0; k--) { if (bests[k] === fin) dstar = depths[k]; else break; }
  // بناء خط الحل
  const p = new Position(fen); const line = []; let ended = '';
  const first = await sc(fen, 18); if (!first || first.best !== fin) return null;
  const firstGap = await sc(fen, 16, first.best); const gap0 = firstGap ? first.cp - firstGap.cp : 99999;
  if (gap0 < 250) return null;
  for (let k = 0; k < 3; k++) {
    const r = await sc(p.fen(), 18); if (!r || !r.best) break;
    if (k > 0) { const g2 = await sc(p.fen(), 16, r.best); const gg = g2 ? r.cp - g2.cp : 99999; if (gg < 150 && !(r.mate && r.mate > 0)) break; }
    const m = p.fromUci(r.best); if (!m) break;
    line.push(r.best); p.make(m);
    if (isMate(p)) { ended = 'mate'; break; }
    if (p.status().over) break;
    const rep = await sc(p.fen(), 16); if (!rep || !rep.best) break;
    const mm = p.fromUci(rep.best); if (!mm) break;
    line.push(rep.best); p.make(mm);
    if (p.status().over) { line.pop(); p.unmake(); break; }
  }
  if (line.length % 2 === 0) { line.pop(); p.unmake(); }     // يجب أن ينتهي الخط بنقلة اللاعب
  if (!line.length) return null;
  // تقييم النهاية
  let mateN = null;
  if (ended === 'mate') mateN = (line.length + 1) / 2;
  else { const fin2 = await sc(p.fen(), 16); if (!fin2) return null; const mine = -fin2.cp; if (mine < 250) return null; }
  const mates1 = matesIn1(new Position(fen));
  const gain = material(p, me) - material(p0, me);
  return { fen, side: me, sol: line, dstar, gap: gap0, mateN, mates1: mates1.length, gain, game: c.game, ply: c.ply };
}

// ---- مرحلي: يحفظ التقدم ويتوقف عند نهاية الميزانية الزمنية (BUDGET بالثواني) ----
const STATE = process.env.STATE || '/home/claude/work/mine_state.json';
const BUDGET = parseInt(process.env.BUDGET || '200', 10) * 1000, T0 = Date.now();
const out_of_time = () => Date.now() - T0 > BUDGET;
let st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { phase: 'gen', g: 0, cands: [], si: 0, keep: [], vi: 0, good: [] };
const save = () => { fs.writeFileSync(STATE, JSON.stringify(st)); fs.writeFileSync(OUT, JSON.stringify(st.good)); };

(async () => {
  await eng.init({ threads: 1, hashMB: 64 }); log(eng.name, 'phase', st.phase);
  if (st.phase === 'gen') { const ok = await genPositions(st); save(); if (!ok) { log('PAUSED gen', st.g, 'positions', st.cands.length); return finish(); } st.phase = 'screen'; save(); log('positions', st.cands.length); }
  if (st.phase === 'screen') {
    for (; st.si < st.cands.length; st.si++) {
      if (out_of_time()) { save(); log('PAUSED screen', st.si, '/', st.cands.length, 'keep', st.keep.length); return finish(); }
      const c = st.cands[st.si];
      const s1 = await sc(c.fen, 10); if (!s1 || !s1.best || s1.cp < 150) continue;
      const s2 = await sc(c.fen, 10, s1.best); if (!s2 || s1.cp - s2.cp < 250) continue;
      const b2 = await sc(c.fen, 2), b4 = await sc(c.fen, 4);
      c.t = (b2 && b2.best !== s1.best ? 2 : 0) + (b4 && b4.best !== s1.best ? 4 : 0);
      st.keep.push(c);
    }
    // الأصعب أولاً، وبحد أقصى 3 لكل مباراة، وسقف عام
    const perGame = {}; st.keep.sort((a, b) => b.t - a.t);
    st.keep = st.keep.filter(c => (perGame[c.game] = (perGame[c.game] || 0) + 1) <= 3).slice(0, 160);
    st.phase = 'verify'; save(); log('screen done ->', st.keep.length, 'hard', st.keep.filter(c => c.t >= 4).length, 'mid', st.keep.filter(c => c.t === 2).length);
  }
  if (st.phase === 'verify') {
    for (; st.vi < st.keep.length; st.vi++) {
      if (out_of_time()) { save(); log('PAUSED verify', st.vi, '/', st.keep.length, 'good', st.good.length); return finish(); }
      const v = await verify(st.keep[st.vi]); if (v) st.good.push(v);
      if (st.vi % 5 === 4) save();
    }
    st.phase = 'done'; save(); log('DONE good', st.good.length);
  }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
function finish() { child.stdin.write('quit\n'); setTimeout(() => process.exit(0), 200); }
