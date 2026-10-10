# -*- coding: utf-8 -*-
"""
스모 바운스 「부활 1회」 리워드 광고 — 헤드리스 실행 검증 (2026-08-31, venture-frontend)

  npx vite build --mode toss   # 먼저 dist/ 를 만든다(이 스크립트는 dist/ 를 그대로 서빙한다)
  python scripts/verify_revive_headless.py [--shots <디렉터리>]

⛔headless 전용 — 창을 띄우지 않는다(President 화면 점유 금지).

무엇을 검증하나 — «실제 배포 번들»(dist/, --mode toss)을 그대로 띄우고 토스 네이티브
브릿지만 mock 한다. 즉 src/reviveAd.ts 의 진짜 광고 이벤트 처리 코드가 돈다.

  광고 이벤트 4종
    A  정상            requested>show>userEarnedReward>dismissed  → 부활 지급
    C  dismissed 선행  requested>show>dismissed, 5초 «뒤» userEarnedReward
                       → 유예(3s) 만료로 «실패 판정»이 난 뒤에도 늦은 보상을 받아 지급
                       ★President 실기기 제보(안드로이드 보상 유실)의 재현 케이스
    D  타임아웃        show 후 아무 이벤트도 없음 → open_timeout(8s) → 지급 없음·오버레이에 사유
    E  로드 실패       loadFullScreenAd onError → 지급 없음·「불러오지 못했어요」

  게임 규칙
    B  경기당 1회      한 경기에서 두 번째 패배엔 제안이 «안» 뜨고 곧장 결과화면
    F  승수 조건       0:2 완패(내가 이긴 라운드 0)엔 제안이 «안» 뜬다
    G  상태 복원       부활 뒤 scoreP1 유지 · scoreP2 는 winsNeeded-1 로 «한 라운드만» 되감김
    H  지면ID          showFullScreenAd 에 실제로 넘어간 adGroupId 가 부활 지면인지
"""
import argparse
import json
import os
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

# 윈도우 기본 콘솔 코드페이지(cp949)에서는 아래 한글·«» 출력이 UnicodeEncodeError 로 죽어
# «검사는 전부 통과했는데 결과를 못 읽는» 상태가 된다(2026-08-31 실측). 결과를 못 읽으면
# 통과도 통과가 아니다 — 그래서 판정 로직이 아니라 «출력»을 고친다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, 'dist')
REVIVE_AD_GROUP_ID = 'ait.v2.live.XXXXXXXXXXXXXXXX'

MOCK_JS = r"""
(() => {
  const listeners = new Map();
  window.__adCalls = [];
  window.__adPlan = {};
  window.__mockKV = {};
  window.__GRANITE_NATIVE_EMITTER = { on(ev, cb) {
    if (!listeners.has(ev)) listeners.set(ev, []);
    listeners.get(ev).push(cb);
    return () => { const a = listeners.get(ev) || []; const i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); };
  } };
  // 광고 2종만 지원으로 켠다. 다른 isSupported 는 맵에 없어 throw -> safeSync 가 삼켜 미지원 처리.
  window.__CONSTANT_HANDLER_MAP = {
    loadFullScreenAd_isSupported: true,
    showFullScreenAd_isSupported: true,
    getOperationalEnvironment: 'sandbox'
  };
  const emit = (ev, data) => {
    const em = window.__GRANITE_NATIVE_EMITTER;
    if (em && typeof em.emit === 'function') { try { em.emit(ev, data); } catch (e) {} return; }
    (listeners.get(ev) || []).slice().forEach((cb) => { try { cb(data); } catch (e) {} });
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
      setTimeout(() => emit(fn + '/resolve/' + id, res), 5);
      return;
    }
    if (m.type !== 'addEventListener') return;
    const fn = m.functionName, id = m.eventId, plan = window.__adPlan || {};
    if (fn === 'loadFullScreenAd') {
      window.__loadAdGroup = (m.args && m.args.adGroupId) || null;
      if (plan.loadError) { setTimeout(() => emit('loadFullScreenAd/onError/' + id, { message: 'mock load error' }), 30); return; }
      if (plan.loadSilent) return;
      setTimeout(() => emit('loadFullScreenAd/onEvent/' + id, { type: 'loaded' }), 30);
      return;
    }
    if (fn === 'showFullScreenAd') {
      window.__showAdGroup = (m.args && m.args.adGroupId) || null;
      (plan.show || []).forEach((s) => setTimeout(() => emit('showFullScreenAd/onEvent/' + id, s.e), s.t));
      if (plan.showError) setTimeout(() => emit('showFullScreenAd/onError/' + id, { message: 'mock show error' }), plan.showErrorAt || 30);
    }
  } };
})();
"""

# 계측 탭 — window.__sumoTrack 을 감싸면 «래퍼» 이벤트(src/reviveAd.ts 는 analytics.ts 를
# 직접 import 한다)를 놓친다. 두 경로가 만나는 곣은 토스 브릿지의 eventLog 하나뿐이라
# 그걸 읽는다(실측: postMessage {type:'method', functionName:'eventLog', args:[{log_name,...}]}).
EVT_JS = """() => (window.__adCalls || [])
  .filter(m => m.type === 'method' && m.functionName === 'eventLog')
  .map(m => (m.args && m.args[0]) || {})"""

# 문서 가시성을 «가짜로» 조작한다 — 실기기에서 전면 리워드 광고가 뜨면 WebView 문서가
# hidden 이 되는데, 헤드리스에는 그 전환이 없다. 이걸 흉내내야 시나리오 K 를 잴 수 있다.
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

errs = []
notes = []


def ck(cond, msg):
    if cond:
        notes.append('  PASS  ' + msg)
    else:
        errs.append('  FAIL  ' + msg)
    return bool(cond)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    # ?ads=off 로 «전면광고» 게이트만 끈다(리워드는 그 스위치를 안 본다) - 결과화면 버튼 간섭 제거.
    return srv, 'http://127.0.0.1:%d/index.html?ads=off' % srv.server_address[1]


def new_page(browser, url, console):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: console.append((m.type, m.text)) if m.type == 'error' else None)
    page.on('pageerror', lambda e: console.append(('pageerror', str(e))))
    page.add_init_script(MOCK_JS)
    page.add_init_script('try{localStorage.clear()}catch(e){}')
    page.add_init_script(VIS_JS)
    page.goto(url)
    # #sc-title 은 정적 HTML 이라 game.js 주입 «전»에도 매치된다 - 게임 전역이 생길 때까지 기다린다.
    page.wait_for_function("() => typeof window.openSelect === 'function' && typeof window.endRound === 'function'", timeout=20000)
    return ctx, page


def start_arcade(page):
    """실제 UI 경로 함수(openSelect/openVS/launchMatch)를 그대로 호출해 아케이드 1판을 연다."""
    page.evaluate("() => { openSelect('arcade'); openVS(); launchMatch(); }")
    page.wait_for_function("() => document.getElementById('sc-vs').classList.contains('hidden')", timeout=8000)


def win_round(page, winner):
    """게임의 진짜 라운드 종료 함수를 부른다(링아웃이 부르는 그 함수). PLAYING 이 될 때까지 기다린 뒤."""
    # READY(1.7s) -> PLAYING 전이를 기다린다. endRound 는 PLAYING 이 아니면 «조용히» 무시된다.
    time.sleep(2.0)
    page.evaluate('(w) => endRound(w)', winner)
    # ROUND_OVER(2.1s) -> afterRound
    time.sleep(2.6)


def pips(page):
    return page.evaluate("""() => {
      const c = (id) => { const e = document.getElementById(id); return e ? e.querySelectorAll('.pip.on').length : -1; };
      return { p1: c('hud-pips1'), p2: c('hud-pips2') };
    }""")


def offer_open(page):
    return page.evaluate("() => { const e = document.getElementById('sbRv'); return !!e && !e.hidden; }")


def set_plan(page, plan):
    page.evaluate('(p) => { window.__adPlan = p; }', plan)


def wait_ev(page, name, timeout=6.0):
    """계측 이벤트가 나타날 때까지 기다린다. 재개는 광고가 «사라진 뒤 한 박자» 뒤라 즉시 읽으면 놓친다."""
    end = time.time() + timeout
    while time.time() < end:
        if name in evs(page):
            return True
        time.sleep(0.15)
    return False


def evs(page):
    """이번 페이지가 지금까지 보낸 계측 log_name 목록."""
    return [e.get('log_name') for e in page.evaluate(EVT_JS)]


def ev_params(page, name):
    for e in page.evaluate(EVT_JS):
        if e.get('log_name') == name:
            return e.get('params') or {}
    return {}


PLAN_OK = {'show': [{'t': 40, 'e': {'type': 'requested'}}, {'t': 120, 'e': {'type': 'show'}},
                    {'t': 260, 'e': {'type': 'userEarnedReward', 'data': {'unitType': 'revive', 'unitAmount': 1}}},
                    {'t': 320, 'e': {'type': 'dismissed'}}]}
# ★안드로이드 실사고 재현: dismissed 가 «먼저», userEarnedReward 가 유예(3s) «후»에 도착.
PLAN_LATE = {'show': [{'t': 40, 'e': {'type': 'requested'}}, {'t': 120, 'e': {'type': 'show'}},
                      {'t': 300, 'e': {'type': 'dismissed'}},
                      {'t': 5000, 'e': {'type': 'USER_EARNED_REWARD'}}]}
PLAN_TIMEOUT = {'show': []}                     # show 후 아무 이벤트도 없음 -> open_timeout(8s)
PLAN_LOADFAIL = {'loadError': True}             # loadFullScreenAd onError

# ═══ 추론 지급 문턱 (시나리오 L) ═══════════════════════════════════════════
# src/reviveAd.ts 의 INFER_MIN_SHOWN_MS 를 «복사해 박지 않는다» — 아래 L 은 숫자를 단언하는
# 게 아니라 11.9s=미지급 / 12.1s=지급 을 실행으로 «가둬서» 문턱이 (11900, 12100] 안에 있음을
# 증명한다. 상수를 20000 으로 되돌리면 L2 가, 더 낮추면 L1 이 깨진다.
INFER_TARGET_MS = 12000          # 2026-08-31 President 결정: 20000 -> 12000
INFER_BAND_MS = 100              # 경계 양쪽 시험점 (11.9s / 12.1s)
# ★shownMs 는 show 수신 시각부터 «판정 시각»까지다. dismissed 판정은 유예(DISMISS_GRACE_MS)
#   «뒤»에 나므로 shownMs = (닫히기까지 실제 표시시간) + 3s 다. 목표 shownMs 를 맞추려면
#   dismissed 를 그만큼 앞당겨 예약해야 한다. 이 식이 틀리면 L0 의 measured 값이 어긋나 잡힌다.
#   ⚠️따라서 «유저가 실제로 본 시간»의 문턱은 12s 가 아니라 9s 다(유예 3s 가 포함되므로).
DISMISS_GRACE_MS = 3000
SHOW_AT_MS = 120


def plan_infer(shown_ms_target):
    """reward 이벤트가 «끝내 안 오고» dismissed 만 오는 계획. 판정 시점 shownMs 가 목표가 되게 예약."""
    return {'show': [{'t': 40, 'e': {'type': 'requested'}},
                     {'t': SHOW_AT_MS, 'e': {'type': 'show'}},
                     {'t': SHOW_AT_MS + shown_ms_target - DISMISS_GRACE_MS, 'e': {'type': 'dismissed'}}]}


def infer_case(browser, url, console, target_ms):
    """경계 1건 실행 → (측정 shownMs, 지급 여부, ad_seq result, reward_inferred 여부)."""
    ctx, page = new_page(browser, url, console)
    start_arcade(page)
    win_round(page, 1)          # 1 : 0  — 「이긴 라운드가 있어야 제안」 조건 충족
    win_round(page, 2)          # 1 : 1
    set_plan(page, plan_infer(target_ms))
    win_round(page, 2)          # 1 : 2  -> 패배 확정 직전 제안
    page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
    page.click('#sbRvGo')
    end = time.time() + target_ms / 1000.0 + 10.0
    while time.time() < end and 'ad_seq' not in evs(page):
        time.sleep(0.15)
    time.sleep(0.6)                      # 지급이면 revive_grant 가 ad_seq 와 같은 턴에 온다
    p = ev_params(page, 'ad_seq')
    ev = evs(page)
    out = (p.get('shownMs'), 'revive_grant' in ev, p.get('result'), 'reward_inferred' in ev)
    ctx.close()
    return out


def run(shots):
    console = []
    srv, url = serve(DIST)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)  # ⛔headless 고정

        # ═══ A + G + H + B : 정상 보상 · 상태 복원 · 지면ID · 경기당 1회 ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        win_round(page, 1)          # 1 : 0
        win_round(page, 2)          # 1 : 1
        before = pips(page)
        set_plan(page, PLAN_OK)
        win_round(page, 2)          # 1 : 2  -> 패배 확정 직전 제안
        page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
        ck(offer_open(page), 'A: 패배 직전 제안 오버레이가 뜬다')
        ck(page.inner_text('#sbRvB').strip() == '1 / 2', 'A: 획득 라운드 표기 1 / 2 (before=%s)' % before)
        ck(page.evaluate("() => document.getElementById('sc-result').classList.contains('hidden')"),
           'A: 제안 중에는 결과화면이 «아직» 안 뜬다')
        if shots:
            page.screenshot(path=os.path.join(shots, 'sumo_revive_offer.png'))
        page.click('#sbRvGo')
        page.wait_for_function("() => document.getElementById('sbRv').hidden", timeout=12000)
        ck(wait_ev(page, 'revive_resume'), 'A: 재개가 «광고가 사라진 뒤» 한 박자 두고 일어난다')
        ck(page.evaluate('() => window.__showAdGroup') == REVIVE_AD_GROUP_ID,
           'H: showFullScreenAd 에 부활 지면ID 가 넘어갔다')
        ck(page.evaluate('() => window.__loadAdGroup') == REVIVE_AD_GROUP_ID,
           'H: loadFullScreenAd 에 부활 지면ID 가 넘어갔다')
        ev = evs(page)
        ck('revive_offer' in ev and 'revive_accept' in ev and 'revive_grant' in ev and 'revive_resume' in ev,
           'A: 계측 revive_offer>accept>grant>resume 전부 발화 (%s)' % [e for e in ev if e.startswith('revive')])
        time.sleep(0.4)
        after = pips(page)
        ck(after['p1'] == 1, 'G: 이긴 라운드 유지 (scoreP1 %s -> %s)' % (before['p1'], after['p1']))
        ck(after['p2'] == 1, 'G: 상대 라운드가 winsNeeded-1 로 «한 라운드만» 되감김 (scoreP2 -> %s)' % after['p2'])
        ck(page.evaluate("() => document.getElementById('sc-result').classList.contains('hidden')"),
           'G: 부활 뒤 결과화면이 아니라 «경기»가 이어진다')
        if shots:
            page.screenshot(path=os.path.join(shots, 'sumo_revive_after.png'))

        # B: 같은 경기에서 두 번째 패배 -> 제안 없음
        set_plan(page, PLAN_OK)
        win_round(page, 2)          # 1 : 2 again
        page.wait_for_selector('#sc-result:not(.hidden)', timeout=8000)
        ck(not offer_open(page), 'B: 경기당 1회 - 두 번째 패배엔 제안이 안 뜬다')
        ck(len([x for x in evs(page) if x == 'revive_offer']) == 1,
           'B: revive_offer 계측도 경기당 1회뿐')
        ctx.close()

        # ═══ F : 승수 조건 (0승이면 제안 없음) ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        set_plan(page, PLAN_OK)
        win_round(page, 2)          # 0 : 1
        win_round(page, 2)          # 0 : 2
        page.wait_for_selector('#sc-result:not(.hidden)', timeout=8000)
        ck(not offer_open(page), 'F: 0승 완패엔 제안이 안 뜬다(「이긴 횟수가 남아있어야」 조건)')
        ev = evs(page)
        ck('revive_skip' in ev, 'F: revive_skip(no_own_win) 계측이 남는다')
        ctx.close()

        # ═══ C : dismissed 선행 + 늦은 보상 (안드로이드 실사고 재현) ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        win_round(page, 1)
        win_round(page, 2)
        set_plan(page, PLAN_LATE)
        win_round(page, 2)
        page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
        page.click('#sbRvGo')
        # 유예 3s 만료 -> 실패 판정. 그 «뒤» 5s 에 보상 도착 -> 늦은 지급.
        time.sleep(4.2)
        ck(offer_open(page), 'C: 유예 만료 직후엔 아직 실패 상태로 오버레이가 남아 있다')
        page.wait_for_function("() => document.getElementById('sbRv').hidden", timeout=8000)
        wait_ev(page, 'revive_resume')
        ev = evs(page)
        ck('ad_late_reward' in ev, 'C: 늦은 보상(ad_late_reward)이 잡혔다')
        ck('revive_grant' in ev and 'revive_resume' in ev, 'C: 늦게 와도 «지급»된다 (광고만 보고 부활 못 하는 사고 방지)')
        ck(pips(page)['p2'] == 1, 'C: 늦은 지급 뒤에도 상태 복원이 동일하다')
        ctx.close()

        # ═══ D : 타임아웃 ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        win_round(page, 1)
        win_round(page, 2)
        set_plan(page, PLAN_TIMEOUT)
        win_round(page, 2)
        page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
        page.click('#sbRvGo')
        time.sleep(9.5)   # open_timeout 8s + 여유
        ck(offer_open(page), 'D: 타임아웃이면 오버레이가 «닫히지 않고» 남아 사유를 보여준다')
        ck('광고를 끝까지' in page.inner_text('#sbRvBody'), 'D: 사유 문구 노출 (%r)' % page.inner_text('#sbRvBody'))
        ev = evs(page)
        ck('revive_grant' not in ev, 'D: 타임아웃엔 «지급 없음»')
        ck('ad_request_fail' in ev and 'ad_seq' in ev, 'D: 실패 계측(ad_request_fail·ad_seq)이 남는다')
        seq = ev_params(page, 'ad_seq').get('seq')
        ck(isinstance(seq, str) and 'open_timeout' in seq, 'D: ad_seq 가 open_timeout 을 기록 (%r)' % seq)
        if shots:
            page.screenshot(path=os.path.join(shots, 'sumo_revive_fail.png'))
        ctx.close()

        # ═══ E : 로드 실패 ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        win_round(page, 1)
        win_round(page, 2)
        set_plan(page, PLAN_LOADFAIL)
        win_round(page, 2)
        page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
        page.click('#sbRvGo')
        time.sleep(1.5)
        ck(offer_open(page), 'E: 로드 실패에도 오버레이가 남는다')
        ck('불러오지 못했' in page.inner_text('#sbRvBody'), 'E: 「불러오지 못했어요」 (%r)' % page.inner_text('#sbRvBody'))
        ev = evs(page)
        ck('revive_grant' not in ev, 'E: 로드 실패엔 «지급 없음»')
        ctx.close()

        # ═══ K : 광고가 «아직 화면을 덮고 있는 동안»엔 게임을 재개하지 않는다 ═══
        ctx, page = new_page(browser, url, console)
        start_arcade(page)
        win_round(page, 1)
        win_round(page, 2)
        set_plan(page, PLAN_OK)
        win_round(page, 2)
        page.wait_for_selector('#sbRv:not([hidden])', timeout=5000)
        page.evaluate('() => window.__setHidden(true)')   # 광고가 화면을 덮은 상태
        page.click('#sbRvGo')
        time.sleep(2.0)
        ck('revive_grant' in evs(page), 'K: 보상 «지급»은 광고 중에도 즉시 확정된다')
        ck('revive_resume' not in evs(page), 'K: 그러나 «게임 재개»는 광고가 덮고 있는 동안 «보류»된다')
        page.evaluate('() => window.__setHidden(false)')  # 광고 닫힘
        time.sleep(1.2)
        ck('revive_resume' in evs(page), 'K: 화면이 돌아온 «뒤에» 재개된다')
        ctx.close()

        # ═══ L : 추론 지급 «12초 문턱» 경계 (2026-08-31 President 결정 20s -> 12s) ═══
        #   보상 이벤트가 «한 번도 오지 않고» dismissed 만 온 상황 — 이때만 표시시간 추론이 쓰인다.
        #   ★이 레인이 바꾼 건 상수 하나뿐인데 기존 30건 중 «이 경로를 밟는 검사가 0건»이었다.
        #     즉 20000 을 12000 으로 고쳐도 옛 스위트는 전부 초록이었다. L 이 그 구멍을 막는다.
        lo, hi = INFER_TARGET_MS - INFER_BAND_MS, INFER_TARGET_MS + INFER_BAND_MS

        m1, g1, r1, i1 = infer_case(browser, url, console, lo)
        ck(isinstance(m1, (int, float)) and abs(m1 - lo) < 60,
           'L0: 하네스가 실제로 %dms 를 표시했다 (measured=%s) — 이게 어긋나면 아래 판정은 무의미' % (lo, m1))
        ck(g1 is False, 'L1: 11.9초(문턱 미만) 시청 + dismissed = «미지급» (granted=%s)' % g1)
        ck(r1 == 'fail', 'L1: ad_seq result=fail (%r)' % r1)
        ck(i1 is False, 'L1: reward_inferred 계측이 «안» 남는다')

        m2, g2, r2, i2 = infer_case(browser, url, console, hi)
        ck(isinstance(m2, (int, float)) and abs(m2 - hi) < 60,
           'L0: 하네스가 실제로 %dms 를 표시했다 (measured=%s)' % (hi, m2))
        ck(g2 is True, 'L2: 12.1초(문턱 이상) 시청 + dismissed = «지급» (granted=%s)' % g2)
        ck(r2 == 'inferred', 'L2: ad_seq result=inferred (%r)' % r2)
        ck(i2 is True, 'L2: reward_inferred 계측이 남는다(추론 지급은 «추적 가능»해야 한다)')
        # ★L3 은 «측정 시각»이 아니라 «지급 결과가 뒤집히는 지점»을 본다.
        #   처음엔 m1 < 12000 <= m2 만 봤는데, 상수를 20000 으로 되돌린 음성대조에서
        #   L2 는 FAIL 인데 L3 이 «PASS» 했다 — 하네스 타이밍만 재고 결과를 안 봤기 때문이다.
        #   검사기가 잡아야 할 것을 못 잡은 것이므로 조건을 결과 중심으로 바꿨다(2026-08-31).
        ck(isinstance(m1, (int, float)) and isinstance(m2, (int, float))
           and m1 < INFER_TARGET_MS <= m2 and g1 is False and g2 is True,
           'L3: ★%dms 를 사이에 두고 지급이 «뒤집힌다» = 문턱이 (%d, %d] 안 (미지급@%s / 지급@%s)'
           % (INFER_TARGET_MS, lo, hi, m1, m2))

        browser.close()
    srv.shutdown()

    hard = [c for c in console if c[0] == 'pageerror']
    ck(not hard, 'X: 페이지 예외 0건 (%s)' % hard[:3])
    return console


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default=None)
    a = ap.parse_args()
    if a.shots:
        os.makedirs(a.shots, exist_ok=True)
    if not os.path.isfile(os.path.join(DIST, 'index.html')):
        print('dist/index.html 이 없다. 먼저: npx vite build --mode toss')
        sys.exit(2)
    cons = run(a.shots)
    print('\n'.join(notes))
    if errs:
        print('\n=== FAIL %d ===' % len(errs))
        print('\n'.join(errs))
    print('\nconsole errors: %d' % len(cons))
    for c in cons[:8]:
        print('   ', c[0], str(c[1])[:200])
    print('\nRESULT: %s (pass %d / fail %d)' % ('OK' if not errs else 'FAILED', len(notes), len(errs)))
    sys.exit(1 if errs else 0)
