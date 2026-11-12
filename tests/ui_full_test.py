# اختبار شامل للواجهة: اللعب + الألغاز + محركان + التحليل (محركات حقيقية)
import asyncio, sys, json, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
EXES = {'sara': '/home/claude/work/sara_x86', 'stockfish': '/home/claude/work/sf_x86'}
ROOT = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../app/src/main/assets')
BOOK = open(ROOT + '/book/openings.txt', encoding='utf8').read()

def sq(u):  # e2 -> index
    return (8 - int(u[1])) * 8 + (ord(u[0]) - 97)

async def main():
    procs, events, tasks = {}, {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)).new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def ev(slot):
            if slot not in events: events[slot] = asyncio.Event()
            return events[slot]
        async def reader(slot, proc):
            while True:
                line = await proc.stdout.readline()
                if not line: break
                if procs.get(slot) is not proc: break
                try: await page.evaluate("([l,s]) => window.onEngineLine && window.onEngineLine(l, s)", [line.decode().strip(), slot])
                except Exception: pass
        async def start(id, slot):
            old = procs.pop(slot, None)
            if old:
                try: old.kill()
                except Exception: pass
            ev(slot).clear()
            exe = EXES[id]
            proc = await asyncio.create_subprocess_exec(exe, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, cwd=os.path.dirname(exe))
            procs[slot] = proc; ev(slot).set(); tasks.append(asyncio.create_task(reader(slot, proc)))
        async def send(line, slot):
            await asyncio.wait_for(ev(slot).wait(), 10)
            procs[slot].stdin.write((line + '\n').encode())
        async def stop(slot):
            old = procs.pop(slot, None)
            if old:
                try: old.kill()
                except Exception: pass
            ev(slot).clear()
        await page.expose_function('__start', start); await page.expose_function('__send', send); await page.expose_function('__stop', stop)
        await page.add_init_script("""
          window.__osc=0; if (window.AudioContext){ const oc=AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator=function(){window.__osc++; return oc.call(this)} }
          window.Android = {
            engines(){ return JSON.stringify([{id:'stockfish',name:'Stockfish 19'},{id:'sara',name:'Sara'}]); },
            startEngine(id, slot){ window.__start(id, slot); return 'ok'; },
            stopEngine(slot){ window.__stop(slot); },
            engineSend(l, slot){ window.__send(l, slot); },
            getBook(){ return %s; }, bookPath(){ return '%s/book/openings.txt'; }, cores(){ return 4; },
            copy(t){ window.__copied = t; }, keepAwake(b){}, diag(){ return 'x'; }
          };""" % (json.dumps(BOOK), ROOT))
        await page.goto('file://' + ROOT + '/index.html')
        await page.wait_for_function("document.getElementById('pStatus').textContent.indexOf('دورك')>=0", timeout=60000)
        print('PLAY ready:', await page.inner_text('#pStatus'))

        # ---------- الألغاز ----------
        await page.click('.tabs button[data-tab="puzzles"]')
        chips = await page.eval_on_selector_all('#zLevels .chip', 'els => els.map(e => e.textContent.trim())')
        print('puzzle levels:', chips)
        z = await page.evaluate("window.PUZZLES[0]")
        # حركة خاطئة
        await page.click('#zBoard .sq[data-i="%d"]' % sq('a2')) if z['side'] == 'w' else None
        await page.click('#zBoard .sq[data-i="%d"]' % sq('a3'))
        await page.wait_for_timeout(200)
        print('wrong move status:', await page.inner_text('#zStatus'))
        await page.wait_for_timeout(1000)
        # الحل الصحيح
        u = z['sol'][0]
        await page.click('#zBoard .sq[data-i="%d"]' % sq(u[:2])); await page.click('#zBoard .sq[data-i="%d"]' % sq(u[2:4]))
        await page.wait_for_function("document.getElementById('zStatus').textContent.indexOf('أحسنت')>=0", timeout=5000)
        print('solved status:', await page.inner_text('#zStatus'), '| chips:', await page.eval_on_selector_all('#zLevels .chip', 'els => els.map(e => e.textContent.trim())'))
        await page.screenshot(path=OUT + '/z1_solved.png')
        # لغز متعدد الخطوات (L2-3: Qh5+ g6 Qxg6#)
        await page.click('#zLevels .chip[data-l="1"]'); await page.click('#zList .chip[data-i="2"]')
        z2 = await page.evaluate("window.PUZZLES.filter(x => x.level === 1)[2]")
        print('multi puzzle:', z2['id'], z2['sol'])
        for k in range(0, len(z2['sol']), 2):
            u = z2['sol'][k]
            await page.wait_for_function("document.getElementById('zStatus').textContent.indexOf('يلعب')>=0 || document.getElementById('zStatus').textContent.indexOf('أحسنت')>=0", timeout=5000)
            await page.click('#zBoard .sq[data-i="%d"]' % sq(u[:2])); await page.click('#zBoard .sq[data-i="%d"]' % sq(u[2:4]))
            await page.wait_for_timeout(1000)
        print('multi status:', await page.inner_text('#zStatus'))
        # لغز فيه ترقية (L1-3)
        await page.click('#zLevels .chip[data-l="0"]'); await page.click('#zList .chip[data-i="2"]')
        z3 = await page.evaluate("window.PUZZLES.filter(x => x.level === 0)[2]"); u = z3['sol'][0]
        await page.click('#zBoard .sq[data-i="%d"]' % sq(u[:2])); await page.click('#zBoard .sq[data-i="%d"]' % sq(u[2:4]))
        await page.wait_for_function("document.getElementById('zStatus').textContent.indexOf('أحسنت')>=0", timeout=5000)
        print('promotion puzzle solved:', z3['sol'])
        await page.click('#zHint'); await page.click('#zNext')

        # ---------- محركان ----------
        await page.click('.tabs button[data-tab="match"]')
        await page.select_option('#mEngW', 'stockfish'); await page.select_option('#mBotW', 'pawn')
        await page.select_option('#mEngB', 'sara'); await page.select_option('#mBotB', 'knight')
        await page.select_option('#mSpeed', '150')
        await page.click('#mStart')
        await page.wait_for_function("document.getElementById('mMoves').textContent.split(' ').filter(x=>x).length >= 14", timeout=90000)
        print('match status:', await page.inner_text('#mStatus'))
        print('match moves:', (await page.inner_text('#mMoves'))[:80])
        await page.screenshot(path=OUT + '/m1_match.png')
        await page.click('#mPause'); n1 = await page.evaluate("document.getElementById('mMoves').textContent.length"); await page.wait_for_timeout(1500)
        n2 = await page.evaluate("document.getElementById('mMoves').textContent.length"); print('paused (no new moves):', n1 == n2)
        await page.click('#mPause'); await page.wait_for_timeout(1500)
        await page.click('#mStop'); print('stopped:', await page.inner_text('#mStatus'))

        # ---------- تحليل مباراة المحركين ----------
        await page.select_option('#aTime', '150') if False else None
        await page.click('#mAnalyze')
        await page.wait_for_function("!document.getElementById('aResult').hidden", timeout=70000)
        print('analysis from match opened; moves listed:', await page.evaluate("document.querySelectorAll('#aMoves .mv[data-ply]').length"))
        await page.click('#aMoves .mv[data-ply="3"]'); await page.screenshot(path=OUT + '/a1_colored.png')
        print('JS errors:', errors)
        for pr in procs.values():
            try: pr.kill()
            except Exception: pass
        await b.close()
asyncio.run(main())
