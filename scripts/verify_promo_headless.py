# -*- coding: utf-8 -*-
"""
프로모션 훅 «헤드리스 실행 검증» — .ait 안 web/ 을 그대로 서빙하고 토스 브릿지를 mock 해서
아케이드 승리 «실제 코드 경로»(아케이드→선수선택→VS→startMatch→finishMatch)로 지급 호출을 센다. (2026-08-29)

  python scripts/verify_promo_headless.py <file.ait> --mode canon|testonly

⛔ headless 전용 — 창을 띄우지 않는다(President 화면 점유 금지).

시나리오
  S0  부팅 소급 없음: SAVE.cleared=8(기존 챔피언)로 부팅 → grant 0회. 그 상태로 stage 8 재승리 → 0회(재해금 미호출)
  S1  해금 순간: cleared=문턱-1 → 실제 경로로 매치 진입 → finishMatch(1) → grant «1회», 코드·30 정확, 결과화면 표시,
      콘솔 에러 0. 같은 세션 재트리거 → 여전히 1회(세션 락). 네이티브 Storage·localStorage 에 코드별 키 기록.
  S2  새 실행 + 기록 있음 → 같은 경로 재트리거 → grant 0회(already)
  S3  4113 → 1회 + viaAlreadyGranted 기록
  S4  현행 undefined → 레거시 폴백 순서 2회
  S5  브릿지 없음(토스 밖) → 호출 0·에러 0·결과화면 정상·기록 없음(무해)
"""
import io
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
AMOUNT = 30

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
  // ★SDK 번들이 모듈 초기화 때 window.__GRANITE_NATIVE_EMITTER 를 «자기 것으로 갈아끼운다»(실측: emit/events/on).
  //   네이티브가 하듯 «응답 시점의» 전역 emitter.emit 으로 보낸다. 갈아끼우기 전이면 우리 리스너로.
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
    d = tempfile.mkdtemp(prefix='sumo_promo_web_')
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


def grants(page):
    return page.evaluate("(window.__mockCalls||[]).filter(m=>m.type==='method'&&/^grantPromotionReward/.test(m.functionName))")


def boot(save=None, kv=None, grant=None, toss=True):
    """새 컨텍스트에 넣을 init script 목록(브릿지 mock · 네이티브 KV 시드 · 지급 응답 · localStorage 시드)."""
    scripts = []
    if toss:
        scripts.append(MOCK_JS)
    if kv is not None:
        scripts.append('window.__mockKV = ' + json.dumps(kv) + ';')
    if grant is not None:
        scripts.append('window.__mockGrant = ' + json.dumps(grant) + ';')
    ls = 'try{localStorage.clear();' + (f"localStorage.setItem('sumoSave', {json.dumps(json.dumps(save))});" if save else '') + '}catch(e){}'
    scripts.append(ls)
    return scripts


def new_page(browser, url, scripts, console):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: console.append((m.type, m.text)) if m.type == 'error' else None)
    page.on('pageerror', lambda e: console.append(('pageerror', str(e))))
    for s in scripts:
        page.add_init_script(s)
    page.goto(url)
    page.wait_for_function("typeof finishMatch==='function' && typeof SAVE==='object' && !document.getElementById('sc-title').classList.contains('hidden')", timeout=15000)
    page.wait_for_timeout(300)
    return ctx, page


def play_to_match(page, cleared):
    page.evaluate(f"SAVE.cleared={cleared}; persist();")
    page.click('#btn-mode-arcade')
    page.wait_for_function("!document.getElementById('sc-select').classList.contains('hidden')", timeout=5000)
    page.click('#btn-sel-go')
    page.wait_for_function("!document.getElementById('sc-vs').classList.contains('hidden')", timeout=5000)
    page.click('#btn-vs-go')
    page.wait_for_function("gameState==='READY'||gameState==='PLAYING'", timeout=8000)
    return page.evaluate('stageIdx')


def finish_win(page):
    page.evaluate('finishMatch(1)')
    page.wait_for_timeout(400)
    return page.evaluate("!document.getElementById('sc-result').classList.contains('hidden')")


def main():
    ait = sys.argv[1]
    mode = sys.argv[sys.argv.index('--mode') + 1] if '--mode' in sys.argv else 'canon'
    code = CODE if mode == 'canon' else 'TEST_' + CODE
    stage = 8 if mode == 'canon' else 1
    key = 'sumo:promo.v1:' + code
    root = extract_web(ait)
    srv, url = serve(root)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # S0 부팅 소급 없음 + 재해금 미호출
        con = []
        ctx, page = new_page(browser, url, boot(save={'v': 1, 'cleared': 8, 'byDiff': [0, 0, 8], 'champion': True}), con)
        page.wait_for_timeout(1500)
        eq(len(grants(page)), 0, 'S0 기존 챔피언(cleared=8) 부팅 → grant 0회(소급 없음)')
        eq(page.evaluate("typeof window.__sumoPromoUnlock"), 'function', 'S0 전역 훅은 설치돼 있다')
        si = play_to_match(page, 8)
        # stageIdx = min(cleared, LADDER.length-1) — LADDER 는 12단(실측)이라 cleared=8 이면 9단째(idx 8). 상수를 다시 박지 않고 «유도»한다.
        eq(si, page.evaluate('Math.min(8, LADDER.length - 1)'), 'S0 stageIdx = min(cleared, LADDER.length-1)')
        eq(finish_win(page), True, 'S0 결과화면 표시')
        if mode == 'canon':
            eq(len(grants(page)), 0, 'S0 재해금(이미 cleared>=문턱) 승리 → grant 0회')
        else:
            # ★President(08-29): TESTONLY 는 기존 세이브(cleared=8)라도 «한 판만 이기면» 지급 — 1회. 같은 세션 재승리는 세션 락.
            g0 = grants(page)
            eq(len(g0), 1, 'S0 TESTONLY: cleared=8 세이브로 부팅 → 1판 승리 → grant 1회')
            if g0:
                eq(g0[0]['args'][0]['params']['promotionCode'], code, 'S0 TESTONLY 코드 = TEST_ 접두')
                eq(g0[0]['args'][0]['params']['amount'], AMOUNT, 'S0 TESTONLY 금액 30')
            finish_win(page)
            eq(len(grants(page)), 1, 'S0 TESTONLY: 같은 세션 재승리 → 여전히 1회(세션 락)')
        eq(con, [], 'S0 콘솔 에러 0')
        ctx.close()

        # S1 해금 순간
        con = []
        ctx, page = new_page(browser, url, boot(), con)
        eq(len(grants(page)), 0, 'S1 새 유저 부팅 → grant 0회')
        si = play_to_match(page, stage - 1)
        eq(si, stage - 1, f'S1 stageIdx={stage - 1}')
        eq(finish_win(page), True, 'S1 결과화면 표시(훅이 화면을 막지 않음)')
        g = grants(page)
        eq(len(g), 1, 'S1 해금 순간 → grant «1회»')
        if g:
            eq(g[0]['functionName'], 'grantPromotionReward', 'S1 현행 API')
            eq(g[0]['args'][0]['params']['promotionCode'], code, 'S1 코드 정확')
            eq(g[0]['args'][0]['params']['amount'], AMOUNT, 'S1 금액 30')
        eq(page.evaluate('SAVE.cleared'), stage, 'S1 SAVE.cleared 갱신(게임 밸런스 무접촉)')
        if mode == 'canon':
            eq(page.evaluate("pendingUnlocks.some(u=>u.type==='char'&&u.obj.id==='daimyojin')"), True, 'S1 정본: 그 순간 pendingUnlocks 에 다이묘진')
        # 같은 세션 재트리거 → 세션 락
        page.evaluate(f'SAVE.cleared={stage - 1}; persist();')
        finish_win(page)
        eq(len(grants(page)), 1, 'S1 같은 세션 재트리거 → 여전히 1회(세션 락)')
        kv = page.evaluate('window.__mockKV')
        rec = json.loads(kv.get(key) or '{}')
        eq(bool(rec.get('grantedAt')), True, 'S1 네이티브 Storage 코드별 키 기록')
        eq(rec.get('code'), code, 'S1 기록 code')
        eq(rec.get('key'), 'MOCKKEY1', 'S1 기록 리워드 key')
        lrec = page.evaluate(f"JSON.parse(localStorage.getItem({json.dumps(key)})||'{{}}')")
        eq(lrec.get('code'), code, 'S1 localStorage 에도 기록')
        eq(page.evaluate("localStorage.getItem('sumoSave')!==null"), True, 'S1 sumoSave 존재')
        eq(con, [], 'S1 콘솔 에러 0')
        ctx.close()

        # S2 새 실행 + 기록 → 0회
        con = []
        ctx, page = new_page(browser, url, boot(kv=kv), con)
        play_to_match(page, stage - 1)
        finish_win(page)
        eq(len(grants(page)), 0, 'S2 새 실행 + 기록 있음 → grant 0회(already)')
        eq(con, [], 'S2 콘솔 에러 0')
        ctx.close()

        # S3 4113
        con = []
        ctx, page = new_page(browser, url, boot(grant={'errorCode': '4113', 'message': 'dup'}), con)
        play_to_match(page, stage - 1)
        finish_win(page)
        eq(len(grants(page)), 1, 'S3 4113 → 1회')
        rec = json.loads(page.evaluate('window.__mockKV').get(key) or '{}')
        eq(rec.get('viaAlreadyGranted'), True, 'S3 4113 → viaAlreadyGranted 기록')
        ctx.close()

        # S4 폴백
        con = []
        ctx, page = new_page(browser, url, boot(grant={'__fn': True, 'primary': '__undefined__', 'legacy': {'key': 'LEG'}}), con)
        play_to_match(page, stage - 1)
        finish_win(page)
        g = grants(page)
        eq([x['functionName'] for x in g], ['grantPromotionReward', 'grantPromotionRewardForGame'], 'S4 폴백 순서')
        eq(json.loads(page.evaluate('window.__mockKV').get(key) or '{}').get('key'), 'LEG', 'S4 레거시 key 기록')
        ctx.close()

        # S5 토스 밖(브릿지 없음)
        con = []
        ctx, page = new_page(browser, url, boot(toss=False), con)
        eq(page.evaluate("typeof window.ReactNativeWebView"), 'undefined', 'S5 RN 없음')
        play_to_match(page, stage - 1)
        eq(finish_win(page), True, 'S5 결과화면 표시')
        eq(page.evaluate(f"localStorage.getItem({json.dumps(key)})"), None, 'S5 기록 없음')
        eq(page.evaluate('SAVE.cleared'), stage, 'S5 SAVE 갱신 정상')
        eq(con, [], 'S5 콘솔 에러 0')
        ctx.close()
        browser.close()
    srv.shutdown()
    if errs:
        print(f'[verify_promo_headless] FAIL {len(errs)} ({mode})')
        for e in errs:
            print('  - ' + e)
        sys.exit(1)
    print(f'[verify_promo_headless] PASS ({mode}) S0 소급없음·재해금0 / S1 1회·코드·30·결과화면·세션락·코드별키 / S2 already 0회 / S3 4113 / S4 폴백 / S5 브릿지없음 무해')


if __name__ == '__main__':
    main()
