# -*- coding: utf-8 -*-
"""
스모 바운스 — 배너 «요청 규율» + 「머니 리그」 교차추천 카드 헤드리스 실행 검증 (2026-09-10, 레인 E)

  npx vite build --mode toss                       # 먼저 dist/ 를 만든다(이 스크립트는 dist/ 를 그대로 서빙한다)
  python scripts/verify_banner_headless.py [--shots DIR] [--baseline OLD_WEB_DIR] [--out result.json] [--quick]

⛔headless 전용 — 창을 띄우지 않는다(President 화면 점유 금지). 브라우저는 tools/safe_headless_browser.open_browser() 로만 연다.
⛔실 광고 0 — 광고 SDK 스크립트(static.toss.im)는 로드되지 않는다. 가짜 `window.TossAdsSpaceKit` 이 먼저 존재하면
  web-bridge `loadAdsSdk()` 가 스크립트 태그를 «만들지 않고» 그대로 resolve 한다(node_modules 실측 index.js:1245-1251).
  광고 «요청»은 가짜 SDK 의 createSlot → web-bridge customAdFetcher → 브릿지 postMessage `fetchTossAd` 로 나가고,
  그걸 ReactNativeWebView.postMessage mock 이 센다. 즉 여기서 세는 「요청」 = 콘솔 「요청」에 대응하는 SDK 호출이다.

무엇을 검증하나
  T1  타이틀 60초 체류        배너 요청(fetchTossAd) «정확히 1» · createSlot 1 · 호스트 1 · ad_request 1 · ad_rendered 1
  T2  리렌더 내성             setLang 100회 + resize 30회 + showScreen('sc-title') 50회 → 요청 여전히 1
  T4  재진입                  선택 화면 ↔ 타이틀 3회 → 요청 +3(방문마다 1) · 이탈 시 호스트 0
  T3  hidden                  hidden 상태로 타이틀 진입 → 3초 요청 0 · visible → +1 / 붙어 있는 배너는 hidden↔visible 에 재요청 0
  T5  노필                    요청 1 → 10초 재시도 0 · 호스트 0 · ad_request_fail(noFill) 1 · 즉시 재진입 0(backoff) · 31초 뒤 재진입 +1
  A1  경기장 10판             PLAYING 중 #arena-ad-* 0 · 배너 요청 증가 0 · ad_request_fail(kind=banner) 0
  A2  터치 복원               PLAYING 중 상단 배너 자리 touchStart → P1.isCharging (호스트가 없으니 게임 입력이 살아 있다)
  X1  교차추천                첫 결과 카드 1 · 문구 · 열기 → openURL('intoss://moneyleague') 1 · 같은 날 2번째 결과 0 · 이탈 시 제거
  X1b 닫기                    닫기 → 카드 제거 · xpromo_close 1
  X2  토스 밖                 브릿지 없음 → 카드 0 · 배너 호스트 0 · pageerror 0
  X3  날짜 규칙               어제 날짜 시드 → 카드 / 오늘 시드 → 카드 0
  I1  전면형(무접촉·측정만)   ?ads=off 없이 부팅 → loadFullScreenAd 요청 수(기존 프리로드 동작) 보고
  B0  양성대조(구빌드)        --baseline 로 구빌드 web/ 을 같은 하네스에 태우면 PLAYING 중 #arena-ad-* ≥1 · 요청 ≥3 이어야 한다
  S   스크린샷               ko 375/390/430 + en 375(타이틀·결과) · 가로 넘침 0 · '{{'/'undefined' 0
  X   pageerror 0 / console.error 0 (전 페이지 합산)
"""
import argparse
import datetime
import json
import os
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, r'C:\Users\USER\tools')
from safe_headless_browser import open_browser  # noqa: E402  (headless 하드코딩 래퍼 — 조직 규율)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, 'dist')
START_BANNER_ID = 'ait.v2.live.XXXXXXXXXXXXXXXX'
ARENA_IDS = ('ait.v2.live.XXXXXXXXXXXXXXXX', 'ait.v2.live.XXXXXXXXXXXXXXXX')
DEEPLINK = 'intoss://moneyleague'
XPROMO_KEY = 'sumobounce.xpromo.v1'

# ── 브릿지 mock + 가짜 광고 SDK ─────────────────────────────────────────────────────────────
MOCK_JS = r"""
(() => {
  const listeners = new Map();
  window.__adCalls = [];
  window.__adPlan = Object.assign({}, window.__adPlanInit || {});
  // ★네이티브 Storage 흉내. __mockKVInit 로 «부팅 전»에 원장을 심을 수 있다(가드 대조용).
  //   [실측] 예전엔 여기서 무조건 {} 로 덮어 써서, 로드 «뒤»에 심고 reload 하면 시드가 사라졌다.
  window.__mockKV = Object.assign({}, window.__mockKVInit || {});
  window.__bannerSlots = [];
  // ★2026-09-10 Codex 리뷰 결함 3 — 예전엔 이 두 경로가 콜백 예외를 «빈 catch» 로 삼켰다.
  //   그래서 앱 콜백이 던져도 pageerror 0 · console.error 0 이 나왔고, 마지막 X 검사가 그 실패를 «못 봤다».
  //   ⇒ 삼키되 «기록»한다. 기록된 건 최종 판정(ck)에 들어간다. 삼키기를 유지하는 이유는 실제 브릿지도
  //     콜백 예외로 앱을 죽이지 않기 때문이다 — 즉 재현 충실도는 지키고 «가시성»만 되찾는다.
  window.__cbErrors = [];
  const swallow = (where, e) => {
    try { window.__cbErrors.push(where + ': ' + ((e && (e.stack || e.message)) || String(e))); } catch (x) {}
  };
  window.__GRANITE_NATIVE_EMITTER = { on(ev, cb) {
    if (!listeners.has(ev)) listeners.set(ev, []);
    listeners.get(ev).push(cb);
    return () => { const a = listeners.get(ev) || []; const i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); };
  } };
  window.__CONSTANT_HANDLER_MAP = {
    fetchTossAd_isSupported: true,
    fetchAppsInTossAd_isSupported: false,
    loadFullScreenAd_isSupported: true,
    showFullScreenAd_isSupported: true,
    getOperationalEnvironment: 'sandbox',
    getPlatformOS: 'android',
    getTossAppVersion: '5.200.0'
  };
  // ★실측(2026-09-10 진단): 페이지 부팅 중 web-framework 가 window.__GRANITE_NATIVE_EMITTER 를 «자기 이미터»
  //   ({emit, events, on})로 교체한다. 그 뒤 bridge-core 리스너는 새 이미터에 등록되므로, emit 은 반드시 «현재 전역»의
  //   emit 을 먼저 타야 한다(부활 하네스 mock 과 같은 이유). 옛 Map 은 교체 «전» 등록분(있다면)을 위해 함께 돌린다.
  const emit = (ev, data) => {
    const em = window.__GRANITE_NATIVE_EMITTER;
    if (em && typeof em.emit === 'function') { try { em.emit(ev, data); } catch (e) { swallow('emitter:' + ev, e); } }
    (listeners.get(ev) || []).slice().forEach((cb) => { try { cb(data); } catch (e) { swallow('listener:' + ev, e); } });
  };
  window.ReactNativeWebView = { postMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    window.__adCalls.push(m);
    if (m.type === 'method') {
      const fn = m.functionName, id = m.eventId, args = m.args || [];
      let res = null;
      if (fn === 'getStorageItem') res = (args[0] in window.__mockKV) ? window.__mockKV[args[0]] : null;
      else if (fn === 'setStorageItem') { window.__mockKV[args[0]] = args[1]; res = null; }
      else if (fn === 'removeStorageItem') { delete window.__mockKV[args[0]]; res = null; }
      else if (fn === 'getAnonymousKey' || fn === 'getUserKeyForGame') res = { type: 'HASH', hash: 'mockhash' };
      // 프로모션(5판 플레이·다이묘진) 지급 브릿지 — 10판 시나리오가 문턱을 넘으면 실제 코드가 부른다.
      // 응답 형식을 맞춰 주지 않으면 promoCore 가 「알 수 없는 오류」 console.error 를 내 X 검사(콘솔 0)를 오염시킨다.
      else if (/^grantPromotionReward/.test(fn)) { window.__grantN = (window.__grantN || 0) + 1; res = { key: 'MOCKKEY' + window.__grantN }; }
      else if (fn === 'openURL') {
        const plan = window.__adPlan || {};
        if (plan.openSilent) return;                       // 무응답 → 4초 뒤 'unknown'
        if (plan.openFail) { setTimeout(() => emit(fn + '/reject/' + id, { __isError: true, message: 'mock open fail' }), 20); return; }
      }
      setTimeout(() => emit(fn + '/resolve/' + id, res), 5);
      return;
    }
    if (m.type !== 'addEventListener') return;
    const fn = m.functionName, id = m.eventId, plan = window.__adPlan || {};
    if (fn === 'fetchTossAd') {
      // ★배너 «요청». 노필이면 NO_AD, 아니면 광고 1건(styleId 1 = 리스트형).
      const payload = plan.bannerNoFill
        ? { resultType: 'SUCCESS', success: { requestId: 'r' + id, status: 'NO_AD', ads: [] } }
        : { resultType: 'SUCCESS', success: { requestId: 'r' + id, status: 'OK', ads: [{ styleId: '1', mock: true }] } };
      // bannerSlowMs: 응답을 «늦춘다» — 「이전 광고 콜백이 새 방문에 도착」(결함 1) 재현용.
      setTimeout(() => emit('fetchTossAd/onEvent/' + id, payload), (plan.bannerSlowMs | 0) || 20);
      return;
    }
    if (fn === 'loadFullScreenAd') {
      if (plan.loadSilent) return;
      setTimeout(() => emit('loadFullScreenAd/onEvent/' + id, { type: 'loaded' }), 30);
      return;
    }
    if (fn === 'showFullScreenAd') {
      (plan.show || []).forEach((s) => setTimeout(() => emit('showFullScreenAd/onEvent/' + id, s.e), s.t));
    }
  } };
  // ★가짜 광고 SDK — web-bridge getAdsSdk()/loadAdsSdk() 가 이 전역을 보고 «스크립트를 받지 않는다».
  let slotSeq = 0;
  const sdk = {
    _cfg: null, _inited: false,
    isInitialized() { return sdk._inited; },
    init(cfg) { sdk._cfg = cfg; sdk._inited = true; },
    banner: {
      createSlot(el, opts) {
        const rec = { spaceId: opts.spaceId, t: Date.now(), destroyed: false, rendered: false, noFill: false };
        window.__bannerSlots.push(rec);
        const cb = opts.callbacks || {};
        const fetcher = sdk._cfg && sdk._cfg.customAdFetcher;
        const p = fetcher ? fetcher('mock://ad', { spaceUnitId: opts.spaceId }) : Promise.resolve({ resultType: 'FAIL' });
        Promise.resolve(p).then((res) => {
          if (rec.destroyed) return;
          const ok = res && res.resultType === 'SUCCESS' && res.success && res.success.status === 'OK'
            && Array.isArray(res.success.ads) && res.success.ads.length > 0;
          if (!ok) { rec.noFill = true; if (cb.onNoFill) { try { cb.onNoFill({ spaceId: opts.spaceId, slotId: 's' + (++slotSeq) }); } catch (e) { swallow('onNoFill', e); } } return; }
          const h = (window.__adPlan && window.__adPlan.bannerHeight) || 90;
          const c = document.createElement('div');
          c.className = 'mock-creative';
          c.style.cssText = 'height:' + h + 'px;box-sizing:border-box;border-radius:12px;background:#2b2226;color:#c2b5a8;' +
            'font:700 12px/1 sans-serif;display:flex;align-items:center;justify-content:center;';
          c.textContent = 'MOCK AD ' + h + 'px';
          el.appendChild(c);
          rec.rendered = true;
          if (cb.onAdRendered) { try { cb.onAdRendered({ spaceId: opts.spaceId, slotId: 's' + (++slotSeq), adMetadata: { requestId: res.success.requestId } }); } catch (e) { swallow('onAdRendered', e); } }
          setTimeout(() => { if (!rec.destroyed && cb.onAdImpression) { try { cb.onAdImpression({ spaceId: opts.spaceId, adMetadata: { requestId: res.success.requestId } }); } catch (e) { swallow('onAdImpression', e); } } }, 50);
        }).catch((err) => {
          if (rec.destroyed) return;
          rec.noFill = true;
          if (cb.onAdFailedToRender) { try { cb.onAdFailedToRender({ spaceId: opts.spaceId, error: { code: 0, message: 'mock' } }); } catch (e) { swallow('onAdFailedToRender', e); } }
          else swallow('fetch', err);
        });
        return { destroy() { rec.destroyed = true; } };
      },
      destroy() {}, destroyAll() {}
    }
  };
  window.TossAdsSpaceKit = sdk;
})();
"""

VIS_JS = """
(() => {
  window.__fakeHidden = false;
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__fakeHidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__fakeHidden ? 'hidden' : 'visible') });
  } catch (e) {}
  window.__setHidden = (v) => { window.__fakeHidden = !!v; document.dispatchEvent(new Event('visibilitychange')); };
})();
"""

EVT_JS = """() => (window.__adCalls || [])
  .filter(m => m.type === 'method' && m.functionName === 'eventLog')
  .map(m => (m.args && m.args[0]) || {})"""

errs = []
notes = []
summary = {}


def ck(cond, msg):
    (notes if cond else errs).append(('  PASS  ' if cond else '  FAIL  ') + msg)
    return bool(cond)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:%d/index.html' % srv.server_address[1]
    return srv, base


CB_ERRORS = []  # 페이지가 닫히기 «전»에 걷어 둔 콜백 예외(페이지별 누적)


def collect_cb_errors(page, tag):
    for e in cb_errors(page):
        CB_ERRORS.append('[' + tag + '] ' + str(e)[:200])


def close_page(ctx, page, tag='page'):
    """★페이지를 닫기 «전»에 콜백 예외를 걷는다 — 닫은 뒤에는 읽을 수 없다(결함 3)."""
    collect_cb_errors(page, tag)
    ctx.close()


def new_page(browser, url, console, mock=True, plan=None, seed_ls=None, width=390, height=844, seed_kv=None):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True, locale='ko-KR')
    page = ctx.new_page()
    page.on('console', lambda m: console.append((m.type, m.text)) if m.type == 'error' else None)
    page.on('pageerror', lambda e: console.append(('pageerror', str(e))))
    page.add_init_script('try{localStorage.clear()}catch(e){}')
    if seed_ls:
        page.add_init_script('try{' + ';'.join('localStorage.setItem(%s,%s)' % (json.dumps(k), json.dumps(v)) for k, v in seed_ls.items()) + '}catch(e){}')
    if mock:
        page.add_init_script('window.__adPlanInit = ' + json.dumps(plan or {}) + ';')
        if seed_kv:
            page.add_init_script('window.__mockKVInit = ' + json.dumps(seed_kv) + ';')
        page.add_init_script(MOCK_JS)
    page.add_init_script(VIS_JS)
    page.goto(url)
    page.wait_for_function("() => typeof window.openSelect === 'function' && typeof window.endRound === 'function'", timeout=20000)
    return ctx, page


# ── 판독 헬퍼 ────────────────────────────────────────────────────────────────────────────────
def banner_reqs(page):
    return page.evaluate("() => (window.__adCalls || []).filter(m => m.type === 'addEventListener' && m.functionName === 'fetchTossAd').length")


def banner_req_ids(page):
    return page.evaluate("() => (window.__adCalls || []).filter(m => m.type === 'addEventListener' && m.functionName === 'fetchTossAd').map(m => (m.args && m.args.adGroupId) || null)")


def slots(page):
    return page.evaluate('() => (window.__bannerSlots || []).length')


def inter_loads(page):
    return page.evaluate("() => (window.__adCalls || []).filter(m => m.type === 'addEventListener' && m.functionName === 'loadFullScreenAd').length")


def inter_shows(page):
    return page.evaluate("() => (window.__adCalls || []).filter(m => m.type === 'addEventListener' && m.functionName === 'showFullScreenAd').length")


def openurl_calls(page):
    return page.evaluate("() => (window.__adCalls || []).filter(m => m.type === 'method' && m.functionName === 'openURL').map(m => m.args)")


def host_present(page):
    return page.evaluate("() => !!document.getElementById('start-ad-bottom')")


def arena_hosts(page):
    return page.evaluate("() => document.querySelectorAll('#arena-ad-top,#arena-ad-bottom').length")


def card_present(page):
    return page.evaluate("() => !!document.getElementById('sb-xpromo')")


def cb_errors(page):
    """브릿지·SDK 콜백 «안»에서 난 예외. pageerror 로는 안 올라온다(결함 3)."""
    try:
        return page.evaluate('() => (window.__cbErrors || []).slice()')
    except Exception:
        return []


def evs(page):
    return page.evaluate(EVT_JS)


def ev_count(page, name, **params):
    n = 0
    for e in evs(page):
        if e.get('log_name') != name:
            continue
        p = e.get('params') or {}
        if all(p.get(k) == v for k, v in params.items()):
            n += 1
    return n


def wait_until(fn, timeout, step=0.15):
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        time.sleep(step)
    return fn()


def start_arcade(page):
    page.evaluate("() => { openSelect('arcade'); openVS(); launchMatch(); }")
    page.wait_for_function("() => document.getElementById('sc-vs').classList.contains('hidden')", timeout=8000)


def win_round(page, winner):
    time.sleep(2.0)   # READY(1.7s) -> PLAYING. endRound 는 PLAYING 이 아니면 조용히 무시된다.
    page.evaluate('(w) => endRound(w)', winner)
    time.sleep(2.6)   # ROUND_OVER(2.1s) -> afterRound


def result_visible(page):
    return page.evaluate("() => { const e = document.getElementById('sc-result'); return !!e && !e.classList.contains('hidden'); }")


def finish_match_win(page, on_round=None, max_rounds=5):
    """결과 화면이 뜰 때까지 라운드를 이긴다. ★아케이드 후반 스테이지는 3선승(LADDER.wins)이라 2라운드로는 안 끝난다."""
    for _ in range(max_rounds):
        win_round(page, 1)
        if on_round:
            on_round()
        if result_visible(page):
            return
    page.wait_for_selector('#sc-result:not(.hidden)', timeout=4000)


def kst_date(offset_days=0):
    now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9) + datetime.timedelta(days=offset_days)
    return now.strftime('%Y-%m-%d')


def touch_probe(page, x, y):
    """CDP 로 touchStart 만 보내 게임의 window touchstart 리스너가 조준을 시작하는지 본다. 끝나면 touchEnd."""
    cdp = page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    time.sleep(0.25)
    charging = page.evaluate("() => { try { return !!(P1 && (P1.isCharging || P1.touchId !== null)); } catch (e) { return false; } }")
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    cdp.detach()
    return charging


def overflow_report(page, selector):
    return page.evaluate("""(sel) => {
      const root = document.querySelector(sel); if (!root) return { missing: true };
      const W = window.innerWidth; const bad = [];
      root.querySelectorAll('*').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > W + 1 || r.left < -1)) bad.push(el.className || el.tagName); });
      const txt = root.textContent || '';
      return { bad, docOverflow: document.documentElement.scrollWidth > W, raw: /\\{\\{|undefined|\\[object/.test(txt), text: txt.replace(/\\s+/g, ' ').trim().slice(0, 160) };
    }""", selector)


# ── 시나리오 ─────────────────────────────────────────────────────────────────────────────────
def run(shots, baseline, quick):
    console = []
    srv, base = serve(DIST)
    url = base + '?ads=off'   # 전면광고 게이트만 끈다(결과 버튼 간섭 제거). 배너·교차추천은 그 스위치를 안 본다.
    dwell = 12 if quick else 60
    matches = 3 if quick else 10
    shot_dir = shots
    with open_browser() as (_pw, browser):
        # ═══ T1 + T2 + T4 + T3 : 타이틀 체류·리렌더·재진입·hidden (한 페이지) ═══
        ctx, page = new_page(browser, url, console)
        t0 = time.time()
        ck(wait_until(lambda: host_present(page), 8), 'T1: 부팅 뒤 타이틀 배너 호스트가 붙는다 (%.1fs)' % (time.time() - t0))
        ck(banner_req_ids(page) == [START_BANNER_ID], 'T1: 첫 요청의 adGroupId = 시작 배너 지면 (%s)' % banner_req_ids(page))
        ck(wait_until(lambda: ev_count(page, 'ad_rendered', kind='banner') >= 1, 3), 'T1: ad_rendered 계측 1건')
        # T2 — 리렌더 내성 (체류 시간 안에서 수행)
        page.evaluate("""() => { for (let i = 0; i < 100; i++) { setLang(i % 2 ? 'ko' : 'en'); } setLang('ko');
          for (let i = 0; i < 30; i++) window.dispatchEvent(new Event('resize'));
          for (let i = 0; i < 50; i++) showScreen('sc-title'); }""")
        time.sleep(1.0)
        ck(banner_reqs(page) == 1 and slots(page) == 1, 'T2: setLang 100회·resize 30회·showScreen(sc-title) 50회 뒤에도 요청 1·슬롯 1 (reqs=%d slots=%d)' % (banner_reqs(page), slots(page)))
        # 체류 완료까지 대기
        while time.time() - t0 < dwell:
            time.sleep(0.5)
        ck(banner_reqs(page) == 1, 'T1: 타이틀 %d초 체류 뒤 배너 요청 «정확히 1» (reqs=%d)' % (dwell, banner_reqs(page)))
        ck(slots(page) == 1 and host_present(page), 'T1: createSlot 1 · 호스트 유지 (slots=%d host=%s)' % (slots(page), host_present(page)))
        ck(ev_count(page, 'ad_request', kind='banner') == 1, 'T1: ad_request(kind=banner) 계측 1건 (%d)' % ev_count(page, 'ad_request', kind='banner'))
        ck(inter_loads(page) == 0 and inter_shows(page) == 0, 'T1: ?ads=off 이라 전면형 요청 0 (load=%d show=%d)' % (inter_loads(page), inter_shows(page)))
        summary['T1'] = {'dwell_s': dwell, 'banner_reqs': banner_reqs(page), 'slots': slots(page), 'inter_loads': inter_loads(page)}
        if shot_dir:
            page.screenshot(path=os.path.join(shot_dir, 'title_390_ko_after.png'))
        # T4 — 재진입 3회
        before = banner_reqs(page)
        for i in range(3):
            page.evaluate("() => openSelect('arcade')")
            time.sleep(0.4)
            ck(not host_present(page), 'T4-%d: 타이틀 이탈 시 호스트 destroy' % (i + 1))
            page.evaluate('() => goTitle()')
            ck(wait_until(lambda: banner_reqs(page) == before + i + 1, 4), 'T4-%d: 재진입 → 요청 +1 (reqs=%d)' % (i + 1, banner_reqs(page)))
            ck(wait_until(lambda: host_present(page), 3), 'T4-%d: 재진입 뒤 호스트 재부착' % (i + 1))
        ck(banner_reqs(page) == before + 3, 'T4: 재진입 3회 = 요청 +3 (%d → %d)' % (before, banner_reqs(page)))
        # T3 — hidden 중 요청 0
        before = banner_reqs(page)
        page.evaluate("() => openSelect('arcade')")
        time.sleep(0.3)
        page.evaluate('() => window.__setHidden(true)')
        page.evaluate('() => goTitle()')
        time.sleep(3.0)
        ck(banner_reqs(page) == before and not host_present(page), 'T3: hidden 상태로 타이틀 진입 → 3초간 요청 0·호스트 0 (reqs=%d)' % banner_reqs(page))
        page.evaluate('() => window.__setHidden(false)')
        ck(wait_until(lambda: banner_reqs(page) == before + 1, 4), 'T3: visible → 그 방문의 1회를 그때 보낸다 (+1, reqs=%d)' % banner_reqs(page))
        ck(wait_until(lambda: host_present(page), 3), 'T3: visible 뒤 호스트 부착')
        n = banner_reqs(page)
        page.evaluate('() => { window.__setHidden(true); }')
        time.sleep(0.5)
        page.evaluate('() => { window.__setHidden(false); }')
        time.sleep(1.0)
        ck(banner_reqs(page) == n and host_present(page), 'T3: 붙어 있는 배너는 hidden↔visible 에 재요청 0·호스트 유지 (reqs=%d)' % banner_reqs(page))
        summary['T3_T4'] = {'banner_reqs_total': banner_reqs(page)}
        close_page(ctx, page)

        # ═══ T5 : 노필 — 재시도 0 · 백오프 ═══
        ctx, page = new_page(browser, url, console, plan={'bannerNoFill': True})
        t_fail = None
        ok1 = wait_until(lambda: ev_count(page, 'ad_request_fail', kind='banner', reason='noFill') >= 1, 8)
        t_fail = time.time()
        ck(ok1, 'T5: 노필 → ad_request_fail(noFill) 1건')
        ck(banner_reqs(page) == 1 and not host_present(page), 'T5: 노필 뒤 호스트 0·요청 1 (reqs=%d)' % banner_reqs(page))
        time.sleep(3 if quick else 10)
        ck(banner_reqs(page) == 1, 'T5: %d초 뒤에도 요청 1 — 같은 방문 재시도 0 (reqs=%d)' % (3 if quick else 10, banner_reqs(page)))
        page.evaluate("() => openSelect('arcade')")
        time.sleep(0.3)
        page.evaluate('() => goTitle()')
        time.sleep(1.5)
        ck(banner_reqs(page) == 1, 'T5: 실패 직후 재진입 → 요청 0 (백오프 30s) (reqs=%d)' % banner_reqs(page))
        ck(ev_count(page, 'ad_guard_blocked', kind='banner', reason='backoff') >= 1, 'T5: ad_guard_blocked(backoff) 계측')
        if not quick:
            page.evaluate("() => openSelect('arcade')")
            wait_s = max(0.0, 31.0 - (time.time() - t_fail))
            time.sleep(wait_s)
            page.evaluate('() => goTitle()')
            ck(wait_until(lambda: banner_reqs(page) == 2, 4), 'T5: 백오프(30s) 만료 뒤 재진입 → 요청 +1 (reqs=%d)' % banner_reqs(page))
        summary['T5'] = {'banner_reqs': banner_reqs(page)}
        close_page(ctx, page)

        # ═══ A1 + A2 + X1 : 경기장 N판 · 터치 복원 · 교차추천 ═══
        ctx, page = new_page(browser, url, console)
        ck(wait_until(lambda: host_present(page), 8), 'A1: 부팅 배너 1회 부착')
        title_reqs = banner_reqs(page)
        fails_before = ev_count(page, 'ad_request_fail', kind='banner')
        start_arcade(page)
        time.sleep(2.2)   # READY -> PLAYING
        ck(arena_hosts(page) == 0, 'A1: PLAYING 중 경기장 배너 호스트 0')
        ck(not host_present(page), 'A1: PLAYING 중 시작 배너 호스트도 0(타이틀 이탈 destroy)')
        ck(touch_probe(page, 195, 150), 'A2: 옛 상단 배너 자리(195,150) touchStart → P1 조준 시작(터치 구멍 복원)')
        time.sleep(0.6)
        ck(touch_probe(page, 195, 700), 'A2: 옛 하단 배너 자리(195,700) touchStart → P1 조준 시작')
        arena_seen = 0
        arena_probe = {'n': 0}

        def probe_arena():
            arena_probe['n'] += arena_hosts(page)

        for i in range(matches):
            if i > 0:
                page.evaluate('() => resultNext()')          # 아케이드 승리 → 다음 판 VS
                page.wait_for_selector('#sc-vs:not(.hidden)', timeout=8000)
                page.evaluate('() => launchMatch()')
                page.wait_for_function("() => document.getElementById('sc-vs').classList.contains('hidden')", timeout=8000)
                time.sleep(2.2)
            probe_arena()
            finish_match_win(page, on_round=probe_arena)   # 2선승·3선승 스테이지 모두 결과 화면까지
            arena_seen = arena_probe['n']
            if i == 0:
                # ── X1 첫 결과: 카드 1 ──
                ck(wait_until(lambda: card_present(page), 3), 'X1: 첫 결과 화면에 「머니 리그」 카드')
                txt = page.evaluate("() => (document.getElementById('sb-xpromo') || {}).textContent || ''")
                ck('머니 리그' in txt and '1만 명 봇 리그에서 가상 투자' in txt and '열기' in txt and '추천' in txt, 'X1: 카드 문구(추천·머니 리그·부제·열기) (%r)' % txt.strip()[:80])
                ck(page.evaluate("() => { const b = document.querySelector('#sb-xpromo .xpClose'); return !!b && b.getAttribute('aria-label') === '닫기'; }"), 'X1: 닫기 버튼 aria-label')
                sizes = page.evaluate("() => ['.xpGo', '.xpClose'].map(s => { const r = document.querySelector('#sb-xpromo ' + s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
                ck(sizes[0][1] >= 44 and sizes[1][0] >= 24 and sizes[1][1] >= 24, 'X1: 터치 타깃 열기 ≥44 · 닫기 ≥24 (%s)' % sizes)
                ck(ev_count(page, 'xpromo_show') == 1, 'X1: xpromo_show 1')
                rec = page.evaluate("(k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }", XPROMO_KEY)
                ck(bool(rec) and rec.get('d') == kst_date() and rec.get('shows') == 1, 'X1: %s = {d: 오늘(KST), shows: 1} (%s)' % (XPROMO_KEY, rec))
                ov = overflow_report(page, '#sb-xpromo')
                ck(not ov.get('bad') and not ov.get('docOverflow') and not ov.get('raw'), 'X1: 카드 가로 넘침 0·raw 표식 0 (%s)' % ov)
                if shot_dir:
                    page.screenshot(path=os.path.join(shot_dir, 'result_390_ko_card.png'))
                # ★도달성: 끝까지 스크롤하면 카드(열기 버튼까지)가 sticky CTA 바 «위»에 완전히 나와야 한다.
                #   showScreen() 이 .cta-pad 를 카드 삽입 «전»에 계산하므로 모듈이 syncCtaPad 를 다시 불러야 성립한다(실측 결함 → 수정).
                reach = page.evaluate("""() => { const sc = document.getElementById('sc-result'); sc.scrollTop = sc.scrollHeight;
                  const card = document.getElementById('sb-xpromo'), cta = sc.querySelector('.sticky-cta'), pad = sc.querySelector('.cta-pad');
                  const cb = card.getBoundingClientRect(), tb = cta.getBoundingClientRect();
                  return { cardBottom: Math.round(cb.bottom), ctaTop: Math.round(tb.top), padH: pad ? Math.round(pad.getBoundingClientRect().height) : -1,
                           overflow: sc.scrollHeight > sc.clientHeight + 1, cue: sc.classList.contains('can-scroll') }; }""")
                ck(reach['cardBottom'] <= reach['ctaTop'] + 1, 'X1: 끝까지 스크롤 시 카드 바닥(%d) ≤ CTA 바 상단(%d) — 「열기」 도달 가능 (pad=%dpx overflow=%s)' % (reach['cardBottom'], reach['ctaTop'], reach['padH'], reach['overflow']))
                ck((not reach['overflow']) or reach['padH'] > 0, 'X1: 콘텐츠가 넘치면 스크롤 활주로(.cta-pad)가 0 이 아니다 (%s)' % reach)
                if shot_dir:
                    page.screenshot(path=os.path.join(shot_dir, 'result_390_ko_card_scrolled.png'))
                page.evaluate("() => { document.getElementById('sc-result').scrollTop = 0; }")
                page.click('#sb-xpromo .xpGo')
                ck(wait_until(lambda: len(openurl_calls(page)) == 1, 3), 'X1: 「열기」 → openURL 브릿지 1회')
                calls = openurl_calls(page)
                ck(bool(calls) and calls[0] == [DEEPLINK], 'X1: openURL 인자 = [%r] (%s)' % (DEEPLINK, calls))
                ck(ev_count(page, 'xpromo_open') == 1, 'X1: xpromo_open 1')
                # ★연타 방지의 «실체»는 openLockUntil(1.5s) 이다. disabled 는 브릿지가 응답할 때까지의 표시일 뿐이라
                #   mock 이 5ms 에 resolve 하면 이미 풀려 있다 — 그 순간을 단언하면 «구현 세부»를 고정하는 죽은 검사가 된다.
                #   그래서 요구사항 자체(같은 잠금 창 안에서 openURL 이 2회 나가지 않는다)를 강제 클릭으로 검사한다.
                #   (pending 중 버튼이 실제로 잠기는지는 X4[무응답] 이 4초 창에서 확인한다.)
                page.click('#sb-xpromo .xpGo', force=True)
                time.sleep(0.3)
                ck(len(openurl_calls(page)) == 1, 'X1: 잠금 창(1.5s) 안 강제 재탭 → openURL 여전히 1회(연타 방지)')
                ck(ev_count(page, 'xpromo_open') == 1, 'X1: 잠금 창 안 재탭은 계측도 늘지 않는다')
                ck(card_present(page), 'X1: 열기 뒤에도 카드는 남는다(돌아온 유저)')
            if i == 1:
                ck(not card_present(page) and ev_count(page, 'xpromo_show') == 1, 'X1: 같은 날 두 번째 결과 → 카드 0·xpromo_show 여전히 1')
        ck(arena_seen == 0, 'A1: %d판 동안 경기장 배너 호스트 누적 0 (%d)' % (matches, arena_seen))
        ck(banner_reqs(page) == title_reqs, 'A1: %d판 동안 배너 요청 증가 0 (%d → %d)' % (matches, title_reqs, banner_reqs(page)))
        ck(ev_count(page, 'ad_request_fail', kind='banner') == fails_before, 'A1: ad_request_fail(kind=banner) 증가 0')
        # 결과 이탈 시 카드 제거 확인(카드가 있는 상태를 다시 만든다: 어제 시드는 새 페이지에서 — 여기선 첫 카드가 이미 닫힘 없이 남아 있었다가 두 번째 판에서 제거됐는지)
        summary['A1'] = {'matches': matches, 'banner_reqs': banner_reqs(page), 'arena_hosts_seen': arena_seen}
        close_page(ctx, page)

        # ═══ X1b : 닫기 · 결과 이탈 시 제거 ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        finish_match_win(page)
        ck(wait_until(lambda: card_present(page), 3), 'X1b: 카드 표시')
        page.click('#sb-xpromo .xpClose')
        ck(wait_until(lambda: not card_present(page), 2), 'X1b: 닫기 → 카드 제거')
        ck(ev_count(page, 'xpromo_close') == 1, 'X1b: xpromo_close 1')
        rec = page.evaluate("(k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }", XPROMO_KEY)
        ck(bool(rec) and rec.get('closes') == 1, 'X1b: closes 1 기록 (%s)' % rec)
        close_page(ctx, page)

        # ═══ X4 : 열기 «실패»만 사유를 보이고, «무응답»은 문구를 바꾸지 않는다 ═══
        #   무응답(4초)에 실패 문구를 띄우면 거짓말이 된다 — 그 사이 머니 리그가 실제로 열렸을 수 있다.
        for plan_key, label, expect_err, budget in (('openFail', '실패(reject)', True, 4.0), ('openSilent', '무응답(4s)', False, 9.0)):
            ctx, page = new_page(browser, url, console, plan={plan_key: True})
            start_arcade(page)
            finish_match_win(page)
            ck(wait_until(lambda: card_present(page), 3), 'X4[%s]: 카드 표시' % label)
            sub_before = page.evaluate("() => document.querySelector('#sb-xpromo .xpSub').textContent")
            page.click('#sb-xpromo .xpGo')
            if plan_key == 'openSilent':
                # ★브릿지가 «응답하지 않는 동안» 버튼이 실제로 잠기는지 — 4초 창이 있어야 관측할 수 있다.
                time.sleep(1.0)
                ck(page.evaluate("() => document.querySelector('#sb-xpromo .xpGo').disabled"), 'X4[%s]: 응답 대기 중에는 버튼이 잠긴다' % label)
            ck(wait_until(lambda: not page.evaluate("() => document.querySelector('#sb-xpromo .xpGo').disabled"), budget),
               'X4[%s]: 결과가 오면 버튼 잠금 해제(무한 잠금 없음)' % label)
            state = page.evaluate("""() => { const s = document.querySelector('#sb-xpromo .xpSub');
              return { text: s.textContent, err: s.classList.contains('err') }; }""")
            outcome = 'failed' if expect_err else 'unknown'
            ck(ev_count(page, 'xpromo_open_result', outcome=outcome) == 1, 'X4[%s]: xpromo_open_result(outcome=%s) 1건' % (label, outcome))
            if expect_err:
                ck(state['err'] and '열지 못했' in state['text'], 'X4[%s]: 부제가 실패 사유로 바뀐다 (%r)' % (label, state))
            else:
                ck((not state['err']) and state['text'] == sub_before, 'X4[%s]: 부제를 «바꾸지 않는다» (%r)' % (label, state))
            ck(card_present(page), 'X4[%s]: 카드는 남는다(다시 시도 가능)' % label)
            close_page(ctx, page)
        # 결과 화면 이탈 시 카드 제거: 어제 시드 페이지에서 카드 → resultNext → 카드 0
        ctx, page = new_page(browser, url, console, seed_ls={XPROMO_KEY: json.dumps({'d': kst_date(-1), 'shows': 3})})
        start_arcade(page)
        finish_match_win(page)
        ck(wait_until(lambda: card_present(page), 3), 'X3: 어제 날짜 시드 → 오늘 첫 결과에 카드')
        page.evaluate('() => resultNext()')
        time.sleep(0.5)
        ck(not card_present(page), 'X1: 결과 화면 이탈 → 카드 제거')
        close_page(ctx, page)
        ctx, page = new_page(browser, url, console, seed_ls={XPROMO_KEY: json.dumps({'d': kst_date(0), 'shows': 1})})
        start_arcade(page)
        finish_match_win(page)
        time.sleep(0.6)
        ck(not card_present(page) and ev_count(page, 'xpromo_show') == 0, 'X3: 오늘 날짜 시드 → 카드 0·xpromo_show 0')
        close_page(ctx, page)

        # ═══ G : ★전면형 «정책 가드» 대조쌍 (2026-09-10 Partner 결정으로 신설) ═══
        #   기준은 뱀 키우기와 같다: 세션 60초 이내 0회 · 표시 간격 10분 · 하루 3회.
        #   ⛔가드마다 «양성(막힌다)»과 «음성(조건을 풀면 뜬다)»을 짝으로 둔다. 한쪽만 있으면
        #     「가드가 죽어서 항상 통과」와 「가드가 과해서 항상 차단」을 구분하지 못한다.
        #   ★무엇을 재는가: 가드가 «요청(load)을 허용/차단»하는가 + 판정 사유. 표시(show)는 별도로
        #     프리로드 준비 타이밍에 달려 있어 가드만의 신호가 아니다 — 차단 방향에서는 show 0 까지 확인한다.
        now_ms = int(time.time() * 1000)
        for tag, setup, expect_why in (
            ('G1 세션60초', {}, 'session_start'),
            ('G2 음성(60초 경과)', {'advance': 61_000}, 'ok'),
            ('G3 10분 간격', {'advance': 61_000, 'last': now_ms - 60_000}, 'interval'),
            ('G4 음성(10분 경과)', {'advance': 61_000, 'last': now_ms - 601_000}, 'ok'),
            ('G5 하루 3회', {'advance': 61_000, 'last': now_ms - 3_600_000, 'today': 3}, 'daily_cap'),
            ('G6 음성(2회까지)', {'advance': 61_000, 'last': now_ms - 3_600_000, 'today': 2}, 'ok'),
        ):
            seed = {'plays': 1, 'adPending': True, 'lastShownAt': setup.get('last', 0),
                    'shownDay': kst_date() if 'today' in setup else '', 'shownToday': setup.get('today', 0)}
            ctx, page = new_page(browser, base, console, seed_kv={'sumo:ads.v2': json.dumps(seed)})
            page.wait_for_function("() => typeof window.startMatch === 'function'", timeout=20000)
            time.sleep(1.2)  # hydrateAdCounter 가 브릿지로 원장을 읽어올 시간
            if setup.get('advance'):
                page.evaluate("(ms) => { if (window.__sumoAdGuardAdvance) window.__sumoAdGuardAdvance(ms); }", setup['advance'])
            snap = page.evaluate("() => (window.__sumoAdGuardSnapshot ? window.__sumoAdGuardSnapshot() : null)")
            ck(snap is not None, '%s: 가드 진단 훅이 살아 있다' % tag)
            if snap:
                ck(snap['why'] == expect_why, '%s: 판정 why=%s (기대 %s) [session %ds / since %ss / today %d]' % (
                    tag, snap['why'], expect_why, snap['sessionAgeMs'] // 1000,
                    (snap['sinceLastMs'] // 1000) if snap['sinceLastMs'] >= 0 else '없음', snap['shownToday']))
                ck(snap['consts'] == {'sessionMs': 60000, 'gapMs': 600000, 'dailyCap': 3},
                   '%s: 가드 상수가 기준값이다 (%s)' % (tag, snap['consts']))
            # 판 종료 1회 → preload 시도가 «가드를 통과하는가»
            loads0, shows0 = inter_loads(page), inter_shows(page)
            start_arcade(page)
            finish_match_win(page)
            page.evaluate("() => { const b = document.getElementById('btn-res-menu'); if (b) b.click(); }")
            time.sleep(1.5)
            dl, ds = inter_loads(page) - loads0, inter_shows(page) - shows0
            if expect_why == 'ok':
                ck(dl >= 1, '%s ★: 가드 통과 → 전면형 요청이 나간다 (load +%d)' % (tag, dl))
            else:
                ck(dl == 0, '%s ★: 가드 차단 → 전면형 요청 0 (load +%d) — 못 띄울 걸 미리 받지 않는다' % (tag, dl))
                ck(ds == 0, '%s ★: 가드 차단 → 표시 0 (show +%d)' % (tag, ds))
                ck(ev_count(page, 'ad_guard_blocked', kind='interstitial', reason=expect_why) >= 1,
                   '%s: ad_guard_blocked(reason=%s) 계측' % (tag, expect_why))
            close_page(ctx, page)

        # ═══ C1 : ★Codex 결함 1 회귀 — «이전» 광고 콜백이 새 방문의 배너를 죽이지 못한다 ═══
        #   재현: 타이틀에서 노필을 «지연»시켜 콜백이 늦게 오게 만들고, 그 사이 이탈→재진입으로 새 배너를 붙인다.
        #   고치기 전에는 늦게 온 onNoFill 이 전역 host/handle 을 보고 «새» 배너를 destroy 했다(요청 2 / 렌더 3).
        ctx, page = new_page(browser, url, console, plan={'bannerSlowMs': 2500})
        ck(wait_until(lambda: banner_reqs(page) == 1, 8), 'C1: 첫 방문 요청 1')
        page.evaluate("() => openSelect('arcade')")   # 이탈 — 콜백은 아직 안 왔다
        time.sleep(0.3)
        page.evaluate("() => { window.__adPlan.bannerSlowMs = 0; }")  # 두 번째는 정상 속도
        page.evaluate('() => goTitle()')             # 재진입 → 새 부착
        ck(wait_until(lambda: banner_reqs(page) == 2, 6), 'C1: 재진입 요청 +1 (총 2)')
        ck(wait_until(lambda: host_present(page), 4), 'C1: 새 배너 호스트 부착')
        time.sleep(3.2)                              # 이전(느린) 응답이 도착할 시간
        ck(host_present(page), 'C1 ★: 늦게 온 «이전» 광고 콜백이 새 배너를 죽이지 않는다')
        rendered = ev_count(page, 'ad_rendered', kind='banner')
        ck(rendered <= 2, 'C1 ★: 렌더 계측이 요청 수를 넘지 않는다 (요청 2 / 렌더 %d)' % rendered)
        ck(not cb_errors(page), 'C1: 그 과정에서 콜백 예외 0')
        close_page(ctx, page)

        # ═══ C2 : ★Codex 결함 2 회귀 — 저장이 «실패»해도 하루 1회와 닫기 유지가 깨지지 않는다 ═══
        ctx, page = new_page(browser, url, console)
        page.evaluate("""() => {
          // localStorage.setItem 을 «실패»시킨다(용량 초과·시크릿 모드 재현). getItem 은 살려 둔다.
          const ls = window.localStorage;
          Object.defineProperty(window, 'localStorage', { configurable: true, value: {
            getItem: (k) => ls.getItem(k),
            setItem: () => { throw new Error('QuotaExceededError(mock)'); },
            removeItem: (k) => ls.removeItem(k),
            clear: () => ls.clear(),
          } });
        }""")
        start_arcade(page)
        finish_match_win(page)
        ck(wait_until(lambda: card_present(page), 4), 'C2: 저장 실패 기기에서도 카드는 «한 번» 보인다')
        page.click('#sb-xpromo .xpClose')
        ck(wait_until(lambda: not card_present(page), 2), 'C2: 닫기 동작')
        page.evaluate('() => resultNext()')
        page.wait_for_selector('#sc-vs:not(.hidden)', timeout=8000)
        page.evaluate('() => launchMatch()')
        page.wait_for_function("() => document.getElementById('sc-vs').classList.contains('hidden')", timeout=8000)
        time.sleep(2.2)
        finish_match_win(page)
        time.sleep(0.8)
        ck(not card_present(page), 'C2 ★: 저장이 실패해도 같은 날 두 번째 결과 화면에 카드가 «다시 뜨지 않는다»')
        ck(ev_count(page, 'xpromo_show') == 1, 'C2 ★: xpromo_show 는 여전히 1 (저장 실패가 하루 1회를 깨지 않는다)')
        close_page(ctx, page)

        # ═══ C2b : 저장값이 «배열»이어도 기록으로 오인하지 않는다(결함 2 후반) ═══
        ctx, page = new_page(browser, url, console, seed_ls={XPROMO_KEY: '[]'})
        start_arcade(page)
        finish_match_win(page)
        ck(wait_until(lambda: card_present(page), 4), 'C2b: 저장값 [] 는 «기록 없음»으로 다뤄져 카드가 정상 표시된다')
        rec = page.evaluate("(k) => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? 'array' : typeof v; } catch (e) { return 'parse-fail'; } }", XPROMO_KEY)
        ck(rec == 'object', 'C2b ★: 기록이 «정상 객체»로 덮여 쓰인다 (현재 %s)' % rec)
        close_page(ctx, page)

        # ═══ X5 : ★양성대조 — 콜백 «안»의 예외가 판정에 도달하는가(결함 3) ═══
        #   [실측] 예전 하네스는 이 예외를 빈 catch 로 삼켜 pageerror 0 · console.error 0 을 냈다.
        #   여기서 일부러 1회 주입하고, 그것이 «수집»되는지 본다. 수집만 확인하고 CB_ERRORS 는 비운다
        #   (이 주입은 우리가 낸 것이므로 최종 판정을 오염시키면 안 된다).
        ctx, page = new_page(browser, url, console)
        wait_until(lambda: host_present(page), 8)
        # ★«실제 응답 경로»로 주입한다. 부팅 뒤 window.__GRANITE_NATIVE_EMITTER 는 프레임워크 것으로 교체되므로
        #   mock 의 내부 Map 이 아니라 그 이미터를 타야 한다(2026-09-10 실측 — 첫 시도가 이걸 놓쳐 0건이 나왔다).
        page.evaluate("""() => {
          const em = window.__GRANITE_NATIVE_EMITTER;
          em.on('getStorageItem/resolve/INJ', () => { throw new Error('injected-callback-boom'); });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'method', functionName: 'getStorageItem', eventId: 'INJ', args: ['probe'] }));
        }""")
        wait_until(lambda: any('injected-callback-boom' in str(x) for x in cb_errors(page)), 3)
        injected = cb_errors(page)
        ck(any('injected-callback-boom' in str(x) for x in injected),
           'X5: 콜백 내부 예외가 «수집»된다(예전엔 빈 catch 로 사라졌다) (%s)' % str(injected)[:120])
        ck(not [c for c in console if c[0] == 'pageerror'],
           'X5: 그 예외는 pageerror 로는 «안» 올라온다 — 그래서 별도 수집이 필요하다')
        page.evaluate('() => { window.__cbErrors = []; }')
        close_page(ctx, page)

        # ═══ X2 : 토스 밖(브릿지 없음) ═══
        ctx, page = new_page(browser, url, console, mock=False)
        time.sleep(1.5)
        ck(not host_present(page), 'X2: 토스 밖 → 배너 호스트 0')
        start_arcade(page)
        finish_match_win(page)
        time.sleep(0.6)
        ck(not card_present(page), 'X2: 토스 밖 → 결과 화면 카드 0')
        close_page(ctx, page)

        # ═══ I1 : 전면형(무접촉) — 기존 프리로드 요청 수 «측정만» ═══
        ctx, page = new_page(browser, base, console)
        time.sleep(4.0)
        summary['I1'] = {'inter_loads_boot': inter_loads(page), 'inter_shows_boot': inter_shows(page), 'banner_reqs': banner_reqs(page)}
        notes.append('  INFO  I1: 전면형 부팅 프리로드 loadFullScreenAd=%d · showFullScreenAd=%d (기존 동작, 무접촉·보고용)' % (inter_loads(page), inter_shows(page)))
        close_page(ctx, page)

        # ═══ S : 스크린샷 (ko 375/390/430 · en 375) ═══
        if shot_dir:
            for w, lang in ((375, 'ko'), (390, 'ko'), (430, 'ko'), (375, 'en')):
                ctx, page = new_page(browser, url, console, width=w, height=844 if w != 430 else 932)
                if lang == 'en':
                    page.evaluate("() => setLang('en')")
                wait_until(lambda: host_present(page), 6)
                time.sleep(0.4)
                page.screenshot(path=os.path.join(shot_dir, 'title_%d_%s.png' % (w, lang)))
                start_arcade(page)
                finish_match_win(page)
                wait_until(lambda: card_present(page), 3)
                time.sleep(0.7)
                ov = overflow_report(page, '#sc-result')
                ck(not ov.get('bad') and not ov.get('docOverflow'), 'S: 결과 화면 %d/%s 가로 넘침 0 (%s)' % (w, lang, ov.get('bad')))
                ck(card_present(page), 'S: 결과 화면 %d/%s 카드 존재' % (w, lang))
                page.screenshot(path=os.path.join(shot_dir, 'result_%d_%s.png' % (w, lang)))
                reach = page.evaluate("""() => { const sc = document.getElementById('sc-result'); sc.scrollTop = sc.scrollHeight;
                  const cb = document.getElementById('sb-xpromo').getBoundingClientRect(), tb = sc.querySelector('.sticky-cta').getBoundingClientRect();
                  return { cardBottom: Math.round(cb.bottom), ctaTop: Math.round(tb.top) }; }""")
                ck(reach['cardBottom'] <= reach['ctaTop'] + 1, 'S: 결과 화면 %d/%s 끝까지 스크롤 시 카드 전체 도달 (%s)' % (w, lang, reach))
                page.screenshot(path=os.path.join(shot_dir, 'result_%d_%s_scrolled.png' % (w, lang)))
                close_page(ctx, page)

        # ═══ B0 : 양성대조 — 구빌드 web/ 에서는 경기장 배너가 «보인다» ═══
        if baseline:
            srv_b, base_b = serve(baseline)
            ctx, page = new_page(browser, base_b + '?ads=off', console)
            wait_until(lambda: host_present(page), 8)
            r0 = banner_reqs(page)
            start_arcade(page)
            ok_hosts = wait_until(lambda: arena_hosts(page) >= 1, 8)
            time.sleep(2.0)
            r1 = banner_reqs(page)
            ck(ok_hosts, 'B0(구빌드): PLAYING 중 #arena-ad-* 호스트 존재 → 하네스가 경기장 배너를 «본다» (%d)' % arena_hosts(page))
            ck(r1 - r0 >= 2, 'B0(구빌드): 경기 진입으로 배너 요청 +%d(≥2) — 요청 카운터가 산다' % (r1 - r0))
            ids = banner_req_ids(page)
            ck(all(a in ids for a in ARENA_IDS), 'B0(구빌드): 요청 adGroupId 에 경기장 2종 포함 (%s)' % sorted(set(ids)))
            if shot_dir:
                page.screenshot(path=os.path.join(shot_dir, 'baseline_old_playing_390_ko.png'))
            summary['B0'] = {'banner_reqs_after_enter': r1, 'arena_hosts': arena_hosts(page), 'ids': sorted(set(ids))}
            close_page(ctx, page)
            # B0b — 구빌드 «노필 폭주» 재현: arenaBanner.ts 는 onNoFill → reclaim → 다음 250ms tick 재부착 = 재요청.
            #   콘솔 실측 「요청 31,202 → 노출 2,370」의 기계적 원인을 숫자로 남긴다(신빌드는 모듈 자체가 없어 A1 에서 0).
            ctx, page = new_page(browser, base_b + '?ads=off', console, plan={'bannerNoFill': True})
            time.sleep(1.0)
            start_arcade(page)
            time.sleep(2.2)
            r_enter = banner_reqs(page)
            time.sleep(3.0)
            storm = banner_reqs(page) - r_enter
            ck(storm >= 8, 'B0b(구빌드·노필): PLAYING 3초 동안 배너 재요청 %d회(≥8) — 250ms 재부착 폭주 «재현»' % storm)
            summary['B0b'] = {'storm_3s': storm, 'total_reqs': banner_reqs(page)}
            close_page(ctx, page)
            srv_b.shutdown()

    srv.shutdown()
    hard = [c for c in console if c[0] == 'pageerror']
    soft = [c for c in console if c[0] == 'error']
    ck(not hard, 'X: 페이지 예외 0건 (%s)' % hard[:3])
    ck(not soft, 'X: console.error 0건 (%s)' % soft[:3])
    # ★결함 3 — 콜백 «안»의 예외는 pageerror 로 안 올라온다. 따로 걷어서 판정에 넣는다.
    ck(not CB_ERRORS, 'X: 브릿지·SDK 콜백 내부 예외 0건 (%s)' % CB_ERRORS[:3])
    summary['console'] = {'pageerror': len(hard), 'error': len(soft), 'callback': len(CB_ERRORS)}
    return console


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default=None)
    ap.add_argument('--baseline', default=None, help='구빌드 web/ 디렉터리(양성대조 B0)')
    ap.add_argument('--out', default=None)
    ap.add_argument('--quick', action='store_true')
    a = ap.parse_args()
    if a.shots:
        os.makedirs(a.shots, exist_ok=True)
    if not os.path.isfile(os.path.join(DIST, 'index.html')):
        print('dist/index.html 이 없다. 먼저: npx vite build --mode toss')
        sys.exit(2)
    t_start = time.time()
    cons = run(a.shots, a.baseline, a.quick)
    print('\n'.join(notes))
    if errs:
        print('\n=== FAIL %d ===' % len(errs))
        print('\n'.join(errs))
    print('\nconsole entries: %d' % len(cons))
    for c in cons[:8]:
        print('   ', c[0], str(c[1])[:200])
    summary['result'] = 'OK' if not errs else 'FAILED'
    summary['pass'] = len([n for n in notes if n.startswith('  PASS')])
    summary['fail'] = len(errs)
    summary['elapsed_s'] = round(time.time() - t_start, 1)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary, 'notes': notes, 'errs': errs}, f, ensure_ascii=False, indent=2)
    print('\nRESULT: %s (pass %d / fail %d, %.0fs)' % (summary['result'], summary['pass'], summary['fail'], summary['elapsed_s']))
    sys.exit(1 if errs else 0)
