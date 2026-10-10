# -*- coding: utf-8 -*-
"""
프로모션 ②「5판 플레이하기」 50원 «헤드리스 실행 검증» — .ait 안 web/ 을 그대로 서빙하고
토스 브릿지를 mock 해서 «실제 코드 경로»(아케이드→선수선택→VS→startMatch→finishMatch)로 지급 호출을 센다.
(2026-09-01)

  python scripts/verify_promo_plays_headless.py <file.ait> --mode canon|testonly

⛔ headless 전용 — 창을 띄우지 않는다(President 화면 점유 금지).

★검증 1순위 (President 2026-09-01: 「이미 달성한 사람 지급 외」)
  P0      «기존 누적 판수가 있는 기기»: sumoSave(cleared=8·champion) + sumo:ads.v2{plays:57} +
          sumobounce.ads.v1='57' + 옛 프로모션 기록까지 심어 두고 부팅 → 지급 «0회».
          그 상태로 4판을 끝내도 0회. 5판째에 «비로소» 1회.
  P0-pos  ★양성대조. 같은 기기 상태에서 «새 카운터 키»에만 n=4 를 심으면 1판 만에 지급된다.
          ⇒ P0 의 「0회」가 «검사기가 죽어서» 나온 0 이 아님을 증명한다(2층 양성대조).
  P1      신규 기기: 4판 0회 → 5판째 1회. 코드·금액(50) 정확.
  P2      이미 받은 기기: 5판을 더 해도 0회(already).
  P3      토스 4113 → 1회 + viaAlreadyGranted 기록.
  P4      현행 undefined → 레거시 폴백 순서 2회.
  P5      토스 밖(브릿지 없음) → 호출 0·콘솔 에러 0·결과화면 정상·기록 없음(무해).
"""
import json
import os
import sys
import tempfile
import threading
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

CODE = '__PROMOTION_CODE__'
AMOUNT = 50

MOCK_JS = r"""
(() => {
  const listeners = new Map();
  window.__mockCalls = [];
  if (!window.__mockKV) window.__mockKV = {};
  if (!window.__mockGrant) window.__mockGrant = { key: 'MOCKKEY1' };
  window.__GRANITE_NATIVE_EMITTER = { on(ev, cb) {
    if (!listeners.has(ev)) listeners.set(ev, []);
    listeners.get(ev).push(cb);
    return () => { const a = listeners.get(ev) || []; const i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); };
  } };
  window.__CONSTANT_HANDLER_MAP = {};
  const emit = (ev, data) => {
    const em = window.__GRANITE_NATIVE_EMITTER;
    if (em && typeof em.emit === 'function') { try { em.emit(ev, data); } catch (e) {} return; }
    (listeners.get(ev) || []).slice().forEach((cb) => { try { cb(data); } catch (e) {} });
  };
  window.ReactNativeWebView = { postMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    window.__mockCalls.push(m);
    if (m.type !== 'method') return;
    const fn = m.functionName, id = m.eventId, args = m.args || [];
    let res = null;
    if (fn === 'getStorageItem') res = (args[0] in window.__mockKV) ? window.__mockKV[args[0]] : null;
    else if (fn === 'setStorageItem') { window.__mockKV[args[0]] = args[1]; res = null; }
    else if (fn === 'removeStorageItem') { delete window.__mockKV[args[0]]; res = null; }
    else if (fn === 'getAnonymousKey' || fn === 'getUserKeyForGame') res = { type: 'HASH', hash: 'mockhash' };
    else if (fn === 'grantPromotionReward' || fn === 'grantPromotionRewardForGame') {
      const g = window.__mockGrant;
      res = (g && g.__fn) ? (fn === 'grantPromotionReward' ? g.primary : g.legacy) : g;
      if (res === '__undefined__') res = undefined;
    }
    setTimeout(() => emit(`${fn}/resolve/${id}`, res), 5);
  } };
})();
"""


def extract_web(ait):
    d = tempfile.mkdtemp(prefix='sumo_plays_web_')
    z = zipfile.ZipFile(ait)
    for n in z.namelist():
        if n.startswith('web/') and not n.endswith('/'):
            p = os.path.join(d, n[4:])
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f:
                f.write(z.read(n))
    return d


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/index.html'


errs = []


def eq(a, b, m):
    if a != b:
        errs.append(f'{m}: expected {b!r}, got {a!r}')


def grants(page, code=None):
    """이 프로모션 코드의 지급 호출만 센다 — TESTONLY 빌드에서는 다이묘진 훅도 같이 발화한다."""
    allc = page.evaluate(
        "(window.__mockCalls||[]).filter(m=>m.type==='method'&&/^grantPromotionReward/.test(m.functionName))")
    if code is None:
        return allc
    return [c for c in allc if (((c.get('args') or [{}])[0] or {}).get('params') or {}).get('promotionCode') == code]


# ★「기존 유저」 기기 상태 — 과거 누적이 들어 있는 저장값을 «전부» 심는다.
VETERAN_LS = {
    'sumoSave': json.dumps({'v': 1, 'cleared': 8, 'byDiff': [0, 0, 8], 'champion': True,
                            'diff': 1, 'lastChar': 'kotaro',
                            'attendance': {'streak': 12, 'lastClaimDateKey': '', 'bonusArenas': []}}),
    'sumo:ads.v2': json.dumps({'plays': 57, 'adPending': False}),   # 전면광고 누적 카운터(08-14~)
    'sumobounce.ads.v1': '57',                                      # v1 레거시 카운터
    'sumo:promo.v1:__PROMOTION_CODE__': json.dumps({'grantedAt': 1, 'code': '__PROMOTION_CODE__'}),
    'sumoMuted': '0',
    'sumoLang': 'ko',
}


def boot(ls=None, kv=None, grant=None, toss=True):
    scripts = []
    if toss:
        scripts.append(MOCK_JS)
    if kv is not None:
        scripts.append('window.__mockKV = ' + json.dumps(kv) + ';')
    if grant is not None:
        scripts.append('window.__mockGrant = ' + json.dumps(grant) + ';')
    seed = 'try{localStorage.clear();'
    for k, v in (ls or {}).items():
        seed += f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)});'
    seed += '}catch(e){}'
    scripts.append(seed)
    return scripts


def new_page(browser, url, scripts, console):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: console.append((m.type, m.text)) if m.type == 'error' else None)
    page.on('pageerror', lambda e: console.append(('pageerror', str(e))))
    for s in scripts:
        page.add_init_script(s)
    page.goto(url)
    page.wait_for_function(
        "typeof finishMatch==='function' && typeof SAVE==='object' && "
        "!document.getElementById('sc-title').classList.contains('hidden')", timeout=15000)
    page.wait_for_timeout(400)
    return ctx, page


def enter_match(page):
    page.click('#btn-mode-arcade')
    page.wait_for_function("!document.getElementById('sc-select').classList.contains('hidden')", timeout=5000)
    page.click('#btn-sel-go')
    page.wait_for_function("!document.getElementById('sc-vs').classList.contains('hidden')", timeout=5000)
    page.click('#btn-vs-go')
    page.wait_for_function("gameState==='READY'||gameState==='PLAYING'", timeout=8000)


def finish_match(page, winner=1):
    """실제 게임 함수를 그대로 부른다 — 훅은 finishMatch 안에 있다."""
    page.evaluate(f'finishMatch({winner})')
    page.wait_for_timeout(350)
    return page.evaluate("!document.getElementById('sc-result').classList.contains('hidden')")


def counter(page, code):
    key = 'sumo:promo.plays.v1:' + code
    raw = page.evaluate(f"localStorage.getItem({json.dumps(key)})")
    return json.loads(raw) if raw else None


def main():
    ait = sys.argv[1]
    mode = sys.argv[sys.argv.index('--mode') + 1] if '--mode' in sys.argv else 'canon'
    code = CODE if mode == 'canon' else 'TEST_' + CODE
    target = 5 if mode == 'canon' else 1
    ckey = 'sumo:promo.plays.v1:' + code
    rkey = 'sumo:promo.v1:' + code
    root = extract_web(ait)
    srv, url = serve(root)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ── P0 ★기존 누적 판수가 있는 기기 → 즉시 지급 «안 된다» ───────────────
        con = []
        ctx, page = new_page(browser, url, boot(ls=VETERAN_LS), con)
        eq(page.evaluate("typeof window.__sumoPromoMatchEnd"), 'function', 'P0 매치종료 훅 설치됨')
        eq(len(grants(page, code)), 0, 'P0 ★기존 유저(cleared=8·ads.v2 plays=57) 부팅 → grant 0회')
        eq(counter(page, code), None, 'P0 ★부팅만으로는 카운터도 안 생긴다')
        enter_match(page)
        for i in range(1, target):
            eq(finish_match(page), True, f'P0 {i}판 결과화면 표시')
            eq(len(grants(page, code)), 0, f'P0 ★{i}판 종료 → grant «0회»(과거 누적 불인정)')
            eq((counter(page, code) or {}).get('n'), i, f'P0 카운터 = {i}')
        eq(finish_match(page), True, f'P0 {target}판 결과화면 표시')
        g = grants(page, code)
        eq(len(g), 1, f'P0 ★{target}판째 종료 → grant «1회»')
        if g:
            eq(g[0]['functionName'], 'grantPromotionReward', 'P0 현행 API')
            eq(g[0]['args'][0]['params']['promotionCode'], code, 'P0 코드 정확')
            eq(g[0]['args'][0]['params']['amount'], AMOUNT, 'P0 금액 50')
        eq((counter(page, code) or {}).get('n'), target, f'P0 카운터 = {target}')
        eq(json.loads(page.evaluate('window.__mockKV').get(ckey) or 'null') is not None, True,
           'P0 카운터가 네이티브 Storage 에도 기록')
        rec = json.loads(page.evaluate('window.__mockKV').get(rkey) or '{}')
        eq(rec.get('code'), code, 'P0 지급 기록에 code 저장(코드별)')
        # 더 해도 추가 지급 없다
        finish_match(page)
        eq(len(grants(page, code)), 1, 'P0 이후 추가 판 → 여전히 1회(세션 락)')
        eq(page.evaluate("localStorage.getItem('sumo:ads.v2')"), VETERAN_LS['sumo:ads.v2'],
           'P0 ⛔광고 카운터 무접촉(값 그대로)')
        eq(con, [], 'P0 콘솔 에러 0')
        ctx.close()

        # ── P0-pos ★양성대조: 새 카운터 키에 n=target-1 을 심으면 «1판»에 지급된다 ──
        con = []
        ls2 = dict(VETERAN_LS)
        ls2[ckey] = json.dumps({'v': 1, 'n': target - 1, 'since': 1})
        ctx, page = new_page(browser, url, boot(ls=ls2, kv={ckey: ls2[ckey]}), con)
        eq(len(grants(page, code)), 0, 'P0-pos 부팅만으로는 0회')
        enter_match(page)
        finish_match(page)
        eq(len(grants(page, code)), 1,
           'P0-pos ★카운터가 이미 target-1 이면 1판 만에 지급 «검출» — P0 의 0회는 죽은 검사기가 아니다')
        ctx.close()

        # ── P1 신규 기기 ──────────────────────────────────────────────────────
        con = []
        ctx, page = new_page(browser, url, boot(), con)
        eq(len(grants(page, code)), 0, 'P1 신규 부팅 → 0회')
        enter_match(page)
        for i in range(1, target):
            finish_match(page)
            eq(len(grants(page, code)), 0, f'P1 {i}판 → 0회')
        finish_match(page)
        g = grants(page, code)
        eq(len(g), 1, f'P1 ★{target}판째 → 1회')
        if g:
            eq(g[0]['args'][0]['params']['promotionCode'], code, 'P1 코드 정확')
            eq(g[0]['args'][0]['params']['amount'], AMOUNT, 'P1 금액 50')
        kv = page.evaluate('window.__mockKV')
        eq(con, [], 'P1 콘솔 에러 0')
        ctx.close()

        # ── P2 이미 받은 기기 ─────────────────────────────────────────────────
        con = []
        ctx, page = new_page(browser, url, boot(kv=kv), con)
        enter_match(page)
        for _ in range(target + 1):
            finish_match(page)
        eq(len(grants(page, code)), 0, 'P2 ★이미 받은 기기 → 몇 판을 더 해도 0회(already)')
        eq(con, [], 'P2 콘솔 에러 0')
        ctx.close()

        # ── P3 4113 ───────────────────────────────────────────────────────────
        con = []
        ctx, page = new_page(browser, url, boot(grant={'errorCode': '4113', 'message': 'dup'}), con)
        enter_match(page)
        for _ in range(target):
            finish_match(page)
        eq(len(grants(page, code)), 1, 'P3 4113 → 1회')
        eq(json.loads(page.evaluate('window.__mockKV').get(rkey) or '{}').get('viaAlreadyGranted'), True,
           'P3 4113 → viaAlreadyGranted 기록')
        ctx.close()

        # ── P4 폴백 ───────────────────────────────────────────────────────────
        con = []
        ctx, page = new_page(browser, url,
                             boot(grant={'__fn': True, 'primary': '__undefined__', 'legacy': {'key': 'LEG'}}), con)
        enter_match(page)
        for _ in range(target):
            finish_match(page)
        eq([x['functionName'] for x in grants(page, code)],
           ['grantPromotionReward', 'grantPromotionRewardForGame'], 'P4 폴백 순서')
        eq(json.loads(page.evaluate('window.__mockKV').get(rkey) or '{}').get('key'), 'LEG', 'P4 레거시 key 기록')
        ctx.close()

        # ── P5 토스 밖 ────────────────────────────────────────────────────────
        con = []
        ctx, page = new_page(browser, url, boot(toss=False), con)
        eq(page.evaluate("typeof window.ReactNativeWebView"), 'undefined', 'P5 RN 없음')
        enter_match(page)
        for _ in range(target + 1):
            eq(finish_match(page), True, 'P5 결과화면 표시')
        eq(page.evaluate(f"localStorage.getItem({json.dumps(rkey)})"), None, 'P5 지급 기록 없음')
        eq(con, [], 'P5 콘솔 에러 0')
        ctx.close()
        browser.close()
    srv.shutdown()
    if errs:
        print(f'[verify_promo_plays_headless] FAIL {len(errs)} ({mode})')
        for e in errs:
            print('  - ' + e)
        sys.exit(1)
    print(f'[verify_promo_plays_headless] PASS ({mode}) '
          f'P0 기존유저 {target}판전 0회·{target}판째 1회 / P0-pos 양성대조 / P1 신규 / P2 already / P3 4113 / P4 폴백 / P5 토스밖')


if __name__ == '__main__':
    main()
