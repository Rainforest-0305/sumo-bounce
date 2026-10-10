/**
 * 전면광고(인터스티셜) 게이트 v2 — 스모 바운스(sumo-bounce).
 *
 * ═══ 설계 (Partner 승인 2026-08-11 / v2 확정 2026-08-14, 안 «게임 JS 0줄») ═══
 *
 * ★ 원본 게임 파일(`public/game/sumo-bounce-game.js`)을 «한 글자도» 고치지 않는다.
 *   결과 화면 버튼(btn-res-next·btn-res-menu)과 일시정지 버튼(btn-restart·btn-quit)이
 *   `index.html` 에 «정적으로» 있고(각각 600·593·611·612행 실측), 게임 스크립트는
 *   나중에 «주입»되므로, 주입 «전»에 capture 리스너를 달면 게임 리스너보다 «항상 먼저» 실행된다.
 *
 * 동작
 *   1. 「판 종료」 버튼 클릭을 capture 단계에서 «가로챈다».
 *   2. 광고를 띄울 차례가 아니거나 준비가 안 됐으면 «그냥 통과»시킨다(=건너뛰기).
 *   3. 띄울 차례면 stopImmediatePropagation() 으로 원래 핸들러를 막고 광고를 보여준다.
 *   4. 광고가 닫히면 «같은 버튼을 재발화»한다 → 원래 동작이 그대로 실행된다.
 *      ★ 게임 로직을 복제하지 «않는다». 위임이다.
 *
 * ═══ v2 에서 고친 것 ═══
 *  · 경로 누락  : btn-restart · btn-quit 추가 (일시정지 → 다시하기 / 그만두기).
 *                 v1 은 결과화면 버튼 2개만 세서 일시정지 이탈이 «0판»으로 취급됐다.
 *  · DF-1       : preload 타임아웃 + 실패 백오프/상한 + «구독 해지» 처리.
 *  · DF-2 / 3   : {plays, adPending} 스키마 + 네이티브 Storage 영속 + v1 무손실 이관.
 *  · DF-4       : show() 타임아웃을 «열림 상한»과 «하드캡»으로 분리.
 *                 (5초 상한 하나로는 광고를 5초 넘게 «정상 시청»하는 동안
 *                  게임이 광고 «뒤에서» 시작돼 「플레이 중 금지」를 위반했다.)
 *
 * ═══ 「한 판」의 정의 (Partner 최종 결정) ═══
 *   「한 판」 = «매치»다 (3판2선승/5판3선승, game.js:103-110 의 LADDER.wins).
 *   ⛔ 라운드로 세지 «않는다» — 한 매치가 2~5라운드라 2~5배 중복이 된다.
 *   1P·2P 를 «구분하지 않는다» — 같은 코드 경로다(game.js 실측).
 *   ⛔ 최소 자격 조건(1수/5초) «없음» — Partner 철회.
 *      ① 구현하려면 matchStart(게임 js 내부 «지역변수») 접근이 필요해 「게임 js 0줄」이 깨진다.
 *      ② 한 매치가 물리적으로 10초 이상이다(shrinkDuration 13~30s · readyTimer 1.7s ·
 *         roundOverTimer 2.1s × 최소 2라운드) → 리셋 연타로 광고를 뽑는 게 «애초에 불가능».
 *
 * ═══ 중복 계수가 «구조적으로» 불가능한 이유 (game.js 실측) ═══
 *   togglePause() 는 gameState 가 'MENU' 또는 'MATCH_OVER' 면 즉시 return 한다(js:2792).
 *   → 결과화면(MATCH_OVER)에서는 일시정지 자체가 «열리지 않는다».
 *   → 한 매치는 「결과화면 버튼」 «또는» 「일시정지 버튼」 중 «한쪽»으로만 빠져나간다.
 *   추가로 이 파일은 「소유 화면이 실제로 보일 때만 센다」는 가드를 둔다(countGuard 참고).
 *
 * 세이브 안전
 *   게임 세이브 키는 `sumoSave`/`sumoMuted`/`sumoLang` 이다. 여기엔 «손대지 않는다».
 *   광고 카운터는 «별도 키»(`sumo:ads.v2`)를 쓴다. 읽기 실패 시 {plays:0, adPending:false}.
 */
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { storage, KEYS } from './storage';
import { track } from '../analytics';
import { kstDateKey } from '../lib/daykey';

/* ─────────────────────── 상수 — «한 곳»에 모은다 ─────────────────────── */

/**
 * ═══ ★ 2026-08-11 «운영 ID» 상태다 (Partner 승인) ═══
 *   지면 state=ENABLED 확인분.
 *
 * ★★★ 절대 금지 — 이 값이 박힌 번들을 «로컬에서 렌더하지 마라».
 *   granite dev·브라우저·헤드리스(Playwright 포함) 전부 금지.
 *   등록되지 않은 매체에서 실 광고단위를 호출하는 것은 «계정 중단 사유»다.
 *   → 이 상태의 검증은 «번들 정적 검사»만 한다.
 *   → 동작 회귀를 봐야 하면 «테스트 ID 본»으로 되돌려서 봐라.
 *
 * ★ 되돌릴 때: 공식 문서의 «전면광고용 테스트 ID»를 쓴다. 값은 문서에서 다시 확인해라 —
 *   여기 적지 않는다(주석 문자열도 출고물에 실린다, 실측).
 */
const AD_GROUP_ID = 'ait.v2.live.XXXXXXXXXXXXXXXX';

/** 몇 판마다 띄울지. 「2판마다」 = President 지시. */
const AD_EVERY = 2;

/** v1 레거시 카운터 키(raw localStorage). 이관 «전용»으로만 읽는다. */
const AD_STORAGE_KEY_V1 = 'sumobounce.ads.v1';

/* ═══════════════════════════════════════════════════════════════════════════
 * ★★전면형 «정책 가드» — 2026-09-10 Partner 승인(무접촉 제약 해제)으로 신설
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔이 코드에는 원래 «없었다». 있던 것은 AD_EVERY(2판마다·첫 판 제외)뿐이고,
 *   토스 미니앱 광고 정책의 「세션 시작 60초 이내 0회 · 하루 3회 · 10분 간격」은 한 줄도 없었다(실측).
 *   뱀 키우기가 같은 상태에서 실측으로 «7·14·21·28초에 4회 표시»를 재현했다 — 세 가지를 «모두» 위반한다.
 *
 * 왜 넣나(Partner 결정): 정책 위반으로 지면이 제한되면 노출이 «0» 이 된다.
 *   노출이 [추정] 30~50% 줄어드는 것보다 그쪽 손실이 크다.
 *
 * 판정 기준은 뱀 키우기(`16_지렁이게임/.../src/ads/interstitial.ts`)와 «같다». 상수 이름은 그 파일을 따랐다.
 * ★AD_EVERY 는 그대로 둔다. 이 가드는 그 위에 얹히고, «둘 중 엄격한 쪽»이 이긴다.
 * ★되돌리기: 세 상수를 0 으로 두면 각 가드가 꺼진다(0 = 무제한). 코드를 지울 필요가 없다.
 */
/** 세션 시작 후 이 시간 안에는 전면형을 띄우지 않는다. 0 = 끔. */
const MIN_SESSION_AGE_MS = 60_000;
/** 직전 «표시»로부터 이 간격을 두어야 다시 띄운다. 0 = 끔. */
const MIN_GAP_MS = 600_000;
/** 하루(KST) 표시 상한. 0 = 무제한. */
const DAILY_SHOW_CAP = 3;

/** 이 세션이 시작된 시각. ⛔부팅마다 새로 잡힌다 — 앱을 껐다 켜면 60초가 다시 흐른다(정책 의도 그대로). */
const sessionStartedAt = Date.now();
/** 검사기 전용 — 세션 나이를 앞으로 미는 오프셋. 운영에서는 0 이다. */
let sessionAgeOffset = 0;

export type AdGuardWhy = 'ok' | 'session_start' | 'interval' | 'daily_cap';
export interface AdGuardResult {
  ok: boolean;
  why: AdGuardWhy;
  sessionAgeMs: number;
  /** 직전 표시 이후 경과(ms). 표시 이력이 없으면 -1. */
  sinceLastMs: number;
  shownToday: number;
}

/**
 * 지금 전면형을 띄워도 «정책상» 되는가. 순수 판정 함수 — 부작용이 없다(그래서 대조하기 쉽다).
 * ⛔요청(load)도 이 판정을 통과할 때만 나간다. 못 띄울 때 미리 받아두면 요청만 늘고 노출은 안 늘어
 *   광고 시청률(노출/요청)이 떨어진다 — 이번 레인이 배너에서 고친 것과 같은 병이다.
 */
export function adGuards(now: number = Date.now()): AdGuardResult {
  const sessionAgeMs = now - sessionStartedAt + sessionAgeOffset;
  const sinceLastRaw = counter.lastShownAt ? now - counter.lastShownAt : Number.POSITIVE_INFINITY;
  const base = {
    sessionAgeMs,
    sinceLastMs: counter.lastShownAt ? sinceLastRaw : -1,
    shownToday: shownTodayCount(),
  };
  if (MIN_SESSION_AGE_MS > 0 && sessionAgeMs < MIN_SESSION_AGE_MS) return { ok: false, why: 'session_start', ...base };
  if (MIN_GAP_MS > 0 && sinceLastRaw < MIN_GAP_MS) return { ok: false, why: 'interval', ...base };
  if (DAILY_SHOW_CAP > 0 && base.shownToday >= DAILY_SHOW_CAP) return { ok: false, why: 'daily_cap', ...base };
  return { ok: true, why: 'ok', ...base };
}

/** 오늘(KST) 표시 수. 날짜가 바뀌었으면 0 이다 — 저장된 수를 «날짜와 함께» 읽는다. */
function shownTodayCount(): number {
  return counter.shownDay === kstDateKey() ? counter.shownToday : 0;
}

/** 광고가 «실제로 유저에게 도달»한 순간 1회. 여기가 가드의 유일한 갱신 지점이다. */
function noteShown(): void {
  const today = kstDateKey();
  counter.shownToday = (counter.shownDay === today ? counter.shownToday : 0) + 1;
  counter.shownDay = today;
  counter.lastShownAt = Date.now();
}

/** 검사기 전용 — 세션 나이를 앞으로 민다(운영 코드는 부르지 않는다). */
export function __advanceGuardClockForTest(ms: number): void {
  sessionAgeOffset += ms;
}
/** 검사기 전용 — 가드 상태 스냅샷. */
export function __adGuardSnapshot(): AdGuardResult & { consts: { sessionMs: number; gapMs: number; dailyCap: number } } {
  return {
    ...adGuards(),
    consts: { sessionMs: MIN_SESSION_AGE_MS, gapMs: MIN_GAP_MS, dailyCap: DAILY_SHOW_CAP },
  };
}

/**
 * ★DF-1 ① preload 콜백 무응답 상한(ms).
 *   v1 은 타임아웃이 show() 에만 있었다. SDK 가 load 콜백을 «아예 안 주면»
 *   loading 이 영구 true 로 굳어 `if (adReady || loading) return;` 에서
 *   이후 «모든» 재시도가 튕겼다. 이걸 먼저 풀지 않으면 백오프도 무의미하다.
 */
const PRELOAD_TIMEOUT_MS = 5000;

/**
 * ★DF-1 ② 연속 실패 시의 «하한 간격».
 *
 * ★★★ 「[미검증] 이 수열은 Partner 가 정한 «임의값»이다. 업계 수치·SDK 문서 근거 «없음».
 *        실사용 데이터가 쌓이면 재검토할 것. 근거를 물으면 «없다»가 정답이다」
 *      (Partner 지정 문구 — 원문 그대로. 아래 MAX_PRELOAD_FAILS 에도 «똑같이» 적용된다)
 *
 *   ★재시도 트리거는 «타이머가 아니라 유저 행동»(판 종료 신호)이다 — 앱이 놀 때
 *   배터리를 안 먹는다. 백오프는 «같은 판 안에서 연달아 불릴 때»의 하한선으로만 쓴다.
 *   (이 «구조»는 실측했다. 위 «숫자»는 검증되지 않았다 — 둘을 섞지 마라.)
 */
const PRELOAD_BACKOFF_MS = [5000, 15000, 45000, 120000, 300000, 300000];

/**
 * ★DF-1 ② 연속 실패 상한. 넘으면 이 세션에서는 더 시도하지 않는다.
 * ★[미검증] — 위 PRELOAD_BACKOFF_MS 주석의 Partner 자백이 이 값에도 그대로 적용된다.
 */
const MAX_PRELOAD_FAILS = 6;

/**
 * ★DF-4 광고가 «열리지 않는» 경우만의 상한(ms).
 *   'show' 또는 'impression' 이 오면 이 타이머는 «해제»된다.
 *   → 전면광고를 5초 넘게 «정상 시청»하는 동안 게임이 뒤에서 시작되는 일이 없어진다.
 */
const SHOW_OPEN_TIMEOUT_MS = 7000;

/**
 * ★DF-4 광고가 «열린 뒤»의 안전망(ms). 사실상 미발동.
 *   유저가 광고에 «영구히 갇히는» 최악만 막는다.
 *   ★되돌리려면 이 상수 2개(SHOW_OPEN_TIMEOUT_MS·SHOW_HARD_CAP_MS)만 같은 값으로 맞추면 된다.
 */
const SHOW_HARD_CAP_MS = 180000;

/**
 * 「판 종료」로 판정하는 버튼들.
 *  · btn-res-next / btn-res-menu : 결과 화면 (index.html:600 / 593)
 *  · btn-restart  / btn-quit     : 일시정지 화면 (index.html:611 / 612)
 *    → v1 누락분. game.js:2940(startMatch 재시작)·2941(goTitle)이 이 둘이다.
 *
 * ★타이틀 경유 재시작(game.js:2664 launchMatch→startMatch)은 «별도 id 가 필요 없다».
 *   근거(코드): goTitle() 호출처는 js:2778(resultNext 내부)·2932(btn-sel-back)·
 *   2937(btn-res-menu)·2941(btn-quit) «4곳뿐». 이 중 «매치에서» 타이틀로 나가는 경로는
 *   btn-res-menu·btn-quit·btn-res-next(→resultNext) «전부 이 목록 안»이다.
 *   btn-sel-back 은 캐릭터 선택 화면에서만 눌리므로 「판」이 아니다.
 */
const RESULT_BUTTON_IDS = ['btn-res-next', 'btn-res-menu', 'btn-restart', 'btn-quit'] as const;

/**
 * 각 버튼이 «소유»하는 화면 id. 그 화면이 실제로 보일 때만 「판 종료」로 인정한다.
 * 오직 «중복 계수 방지»용이다 — 유저는 보이지 않는 버튼을 누를 수 없다.
 * (game.js showScreen():2407 이 SCREENS 전부에 'hidden' 클래스를 토글한다, 실측)
 */
const BUTTON_OWNER_SCREEN: Record<string, string> = {
  'btn-res-next': 'sc-result',
  'btn-res-menu': 'sc-result',
  'btn-restart': 'sc-pause',
  'btn-quit': 'sc-pause',
};

/* ─────────────────────────── 카운터 (DF-3) ─────────────────────────── */

/**
 * ★adPending 은 «boolean»이다.
 *
 * ★★★ 「정수 카운터로 만들면 빚이 쌓여 매판 광고가 터진다」
 *
 * 다음 사람이 「누적되게 하면 더 좋지 않나」 할 자리다. 하지 마라.
 * 광고를 못 띄운 판이 10판 쌓이면 정수 카운터에서는 그 뒤 «매판» 광고가 나간다.
 * 우리가 원하는 건 「2판마다」의 리듬이 «미뤄질 뿐 깨지지 않는» 것이다.
 */
/**
 * ★2026-09-10 확장 — 정책 가드용 3필드 추가. «순수 추가»라 옛 기록과 호환된다:
 *   옛 값 {plays, adPending} 을 읽으면 lastShownAt=0 · shownDay='' · shownToday=0 으로 시작한다
 *   = 「표시 이력 없음」. 첫 표시에서 정상적으로 채워진다(기존 유저의 plays 는 그대로 보존된다).
 */
type AdCounter = {
  plays: number;
  adPending: boolean;
  /** 마지막 «표시» 시각(epoch ms). 0 = 이력 없음. */
  lastShownAt: number;
  /** shownToday 가 세고 있는 날(KST 'YYYY-MM-DD'). */
  shownDay: string;
  /** 그날 표시 수. */
  shownToday: number;
};

const EMPTY_COUNTER: AdCounter = { plays: 0, adPending: false, lastShownAt: 0, shownDay: '', shownToday: 0 };

let counter: AdCounter = { ...EMPTY_COUNTER };
let hydrated = false;

function parseCounter(raw: string | null): AdCounter | null {
  if (raw == null) return null;
  try {
    const o = JSON.parse(raw);
    const n = o?.plays;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
    const at = typeof o?.lastShownAt === 'number' && Number.isFinite(o.lastShownAt) && o.lastShownAt > 0
      ? Math.floor(o.lastShownAt) : 0;
    const day = typeof o?.shownDay === 'string' ? o.shownDay : '';
    const cnt = typeof o?.shownToday === 'number' && Number.isFinite(o.shownToday) && o.shownToday >= 0
      ? Math.min(999, Math.floor(o.shownToday)) : 0;
    return { plays: Math.floor(n), adPending: o?.adPending === true, lastShownAt: at, shownDay: day, shownToday: cnt };
  } catch {
    return null;
  }
}

/** v1 레거시(raw localStorage, {"plays":n})를 읽는다. 이관 전용. */
function readLegacyV1(): number | null {
  try {
    const raw = window.localStorage.getItem(AD_STORAGE_KEY_V1);
    const parsed = parseCounter(raw);
    return parsed ? parsed.plays : null;
  } catch {
    return null;
  }
}

/**
 * ★DF-3 부팅 시 «비동기» 하이드레이트. sdk-boot.ts 가 installAdGateOnDocument() «전»에 await 한다.
 * ★절대 throw 하지 않는다. 실패하면 {plays:0, adPending:false} 로 시작한다.
 */
export async function hydrateAdCounter(): Promise<void> {
  try {
    const v2 = parseCounter(await storage.getItem(KEYS.adCounter));
    if (v2 !== null) {
      counter = v2;
      hydrated = true;
      return;
    }
    // v2 가 없으면 v1 을 «무손실»로 이관한다. plays 는 그대로 보존된다.
    // adPending 은 false 로 시작한다 — 앱을 켜자마자 광고를 띄우지 «않기» 위해서다.
    const legacyPlays = readLegacyV1();
    if (legacyPlays !== null) {
      counter = { ...EMPTY_COUNTER, plays: legacyPlays };
      persist();
    }
  } catch {
    /* 카운터가 앱을 막으면 안 된다 — 0 에서 시작 */
  } finally {
    hydrated = true;
  }
}

/** 네이티브 Storage + localStorage 동시 기록(storage.ts). fire-and-forget. */
function persist(): void {
  try {
    void storage.setItem(KEYS.adCounter, JSON.stringify(counter));
  } catch {
    /* 저장 실패는 삼킨다 — 광고가 덜 뜰 뿐, 게임은 계속돼야 한다. */
  }
}

/**
 * ★한 판을 «정확히 한 번» 확정한다. plays 를 증가시키는 «단 한 곳»이다.
 *   grep 로 `counter.plays +=` 를 세면 이 파일에 «1건»이어야 한다.
 */
function countPlay(): void {
  counter.plays += 1;
  if (counter.plays % AD_EVERY === 0) counter.adPending = true;
  persist();
}

/** 테스트/진단용 — 현재 카운터 스냅샷. */
export function __counterSnapshot(): AdCounter & { hydrated: boolean } {
  return { ...counter, hydrated };
}

/* ─────────────────────────── 강제 옵션 ─────────────────────────── */

type ForceMode = 'off' | 'always' | 'normal';

function forceMode(): ForceMode {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('ads') === 'off') return 'off';
    if (q.get('ads') === '1') return 'always';
  } catch {
    /* URL 파싱 실패는 무시하고 기본 동작 */
  }
  return 'normal';
}

/**
 * 이번 판 종료에 광고를 띄울 «차례»인가.
 * ★ 첫 판은 제외한다 — plays 1 에서는 안 띄우고 2, 4, 6 … 에서 띄운다.
 *   (plays % 2 === 0 이면 countPlay() 가 adPending 을 세운다)
 */
export function shouldShow(count: number, mode: ForceMode = 'normal'): boolean {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  if (count < AD_EVERY) return false; // 첫 판 제외
  return count % AD_EVERY === 0;
}

/* ─────────────────────────── 광고 로드 (DF-1) ─────────────────────────── */

let adReady = false;
let loading = false;
let preloadFails = 0;
let lastPreloadAt = 0;
let preloadTimer: ReturnType<typeof setTimeout> | null = null;
/** ★loadFullScreenAd 의 «반환값은 해지 함수»다(web-bridge index.d.ts:849-854 실측). */
let unsubscribeLoad: (() => void) | null = null;

function clearPreloadTimer(): void {
  if (preloadTimer !== null) {
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }
}

/** 이전 load 구독을 «반드시» 해지한다 — 재시도 시 구독이 중첩되면 콜백이 겹친다. */
function cancelLoadSubscription(): void {
  const u = unsubscribeLoad;
  unsubscribeLoad = null;
  if (u) {
    try {
      u();
    } catch {
      /* 해지 실패는 무시 */
    }
  }
}

function onPreloadFailure(reason: 'timeout' | 'onError'): void {
  track('ad_request_fail', {kind: 'interstitial', reason: reason});
  clearPreloadTimer();
  cancelLoadSubscription();
  adReady = false;
  loading = false;
  preloadFails += 1;
}

function safeIsSupported(): boolean {
  try {
    return loadFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

/**
 * 다음 광고를 미리 로드해 둔다. 실패해도 «조용히» 넘어간다(광고만 안 뜬다).
 * ★호출처는 «유저 행동»이다: 게이트 설치 시 1회 · 판 종료 신호 · 광고 종료 직후.
 *   타이머로 스스로 깨어나지 «않는다».
 */
export function preload(): void {
  if (adReady || loading) return;
  if (preloadFails >= MAX_PRELOAD_FAILS) return; // ⛔무한 재시도 금지
  /* ★정책상 지금 «띄울 수 없으면» 받지도 않는다(2026-09-10).
   *   못 띄우는데 미리 받아두면 요청만 늘고 노출은 안 늘어 광고 시청률(노출/요청)이 떨어진다 —
   *   이번 레인이 배너에서 고친 것과 «같은 병»이다. 뱀 키우기도 같은 지점에서 막는다. */
  {
    const g = adGuards();
    if (!g.ok) {
      track('ad_guard_blocked', { kind: 'interstitial', stage: 'preload', reason: g.why });
      return;
    }
  }

  // 백오프: 「같은 판 안에서 연달아 불릴 때」의 하한선.
  if (preloadFails > 0) {
    const idx = Math.min(preloadFails - 1, PRELOAD_BACKOFF_MS.length - 1);
    if (Date.now() - lastPreloadAt < PRELOAD_BACKOFF_MS[idx]) return;
  }
  if (!safeIsSupported()) { track('ad_request_fail', {kind: 'interstitial', reason: 'unsupported'}); return; } // ★ isSupported 확인은 «필수»(문서)

  lastPreloadAt = Date.now();
  loading = true;
  cancelLoadSubscription();

  // ★DF-1 ① SDK 가 콜백을 «아예 안 주는» 경우 loading 을 되돌린다.
  preloadTimer = setTimeout(() => {
    preloadTimer = null;
    onPreloadFailure('timeout');
  }, PRELOAD_TIMEOUT_MS);

  try {
    const unsub = loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (e) => {
        if (e?.type === 'loaded') {
          clearPreloadTimer();
          adReady = true;
          loading = false;
          preloadFails = 0;
        }
      },
      onError: () => {
        onPreloadFailure('onError');
      },
    });
    unsubscribeLoad = typeof unsub === 'function' ? unsub : null;
  } catch {
    onPreloadFailure('onError');
  }
}

/* ─────────────────────────── 광고 표시 (DF-4) ─────────────────────────── */

/**
 * 광고를 보여주고, «끝나면» done() 을 부른다.
 * 성공/실패/타임아웃 «어느 경우에도» done() 은 «정확히 한 번» 불린다 —
 * 그래야 유저가 광고에 갇히지 않는다.
 *
 * onOpened() 는 광고가 «실제로 유저에게 도달했다»는 증거가 있을 때만 «한 번» 불린다.
 * 호출자는 이때에만 adPending(빚)을 소비한다.
 */
function show(done: () => void, onOpened: () => void = () => {}): void {
  let finished = false;
  let opened = false;
  // 침묵(⑤) — finish() 가 여러 경로(openTimer/hardTimer 타임아웃 · onError ·
  // failedToShow)에서 공유되므로, 호출 직전에 사유를 적어놓고 finish() 안에서 읽는다.
  // 기본값 'timeout' — 타이머 경로가 가장 흔하다(열림 자체가 안 온 케이스).
  let showFailReason: 'timeout' | 'onError' = 'timeout';
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let hardTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubShow: (() => void) | null = null;

  const clearOpenTimer = () => {
    if (openTimer !== null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };
  const markOpened = () => {
    if (opened) return;
    opened = true;
    clearOpenTimer(); // ★DF-4: 열렸으므로 「안 열림」 상한은 해제한다.
    onOpened();
  };
  const finish = () => {
    if (finished) return;
    // 계측(⑤): 열리지 않고(never opened) 끝나면 실패다 — 타임아웃·onError·failedToShow
    // 전부 이 하나의 조건(opened===false)으로 모인다. 정상 시청 완료(dismissed after opened)는 opened=true 라 안 친다.
    if (!opened) track('ad_request_fail', {kind: 'interstitial', reason: showFailReason});
    finished = true;
    clearOpenTimer();
    if (hardTimer !== null) {
      clearTimeout(hardTimer);
      hardTimer = null;
    }
    if (unsubShow) {
      try {
        unsubShow();
      } catch {
        /* 해지 실패 무시 */
      }
      unsubShow = null;
    }
    adReady = false;
    preload(); // ★ 「닫힌 뒤에는 다시 load 필요」(문서)
    done();
  };

  openTimer = setTimeout(finish, SHOW_OPEN_TIMEOUT_MS);
  hardTimer = setTimeout(finish, SHOW_HARD_CAP_MS);

  try {
    const unsub = showFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (e) => {
        const t = e?.type;
        // 'show'/'impression' = 광고가 «열렸다». 'dismissed' 도 도달의 증거다.
        if (t === 'show' || t === 'impression' || t === 'dismissed') markOpened();
        // dismissed / failedToShow 는 «끝»이다. requested·clicked 는 진행 중.
        if (t === 'failedToShow') showFailReason = 'onError';
        if (t === 'dismissed' || t === 'failedToShow') finish();
      },
      onError: () => { showFailReason = 'onError'; finish(); },
    });
    unsubShow = typeof unsub === 'function' ? unsub : null;
    // 동기 콜백으로 이미 끝났으면 방금 받은 해지 함수를 바로 정리한다.
    if (finished && unsubShow) {
      try {
        unsubShow();
      } catch {
        /* 무시 */
      }
      unsubShow = null;
    }
  } catch {
    finish();
  }
}

/* ─────────────────────────── 게이트 설치 ─────────────────────────── */

/**
 * 재발화 통과 플래그.
 * ★ 이게 없으면 「광고 → 재발화 → 다시 가로채기 → 광고 …」 «무한 루프»가 난다.
 *   유저가 광고를 빠져나오지 못하는, 이 설계에서 가장 나쁜 실패다.
 */
let bypassOnce = false;

/** 광고 표시 중에 들어온 클릭은 «세지 않는다» — 같은 판을 두 번 세는 걸 막는다. */
let adInFlight = false;

/** 테스트에서 주입할 수 있게 분리했다(브라우저에선 기본값이 그대로 쓰인다). */
export interface AdGateDeps {
  isReady?: () => boolean;
  showAd?: (done: () => void, onOpened?: () => void) => void;
  mode?: ForceMode;
  /** 소유 화면 가시성 판정 주입(테스트용). 기본은 document 에서 'hidden' 클래스를 본다. */
  isScreenVisible?: (screenId: string) => boolean;
}

function defaultIsScreenVisible(screenId: string): boolean {
  try {
    const el = document.getElementById(screenId);
    // ★fail-open: 화면 엘리먼트를 못 찾으면 «센다». 가드가 계수를 통째로 죽이면 안 된다.
    if (!el) return true;
    return !el.classList.contains('hidden');
  } catch {
    return true;
  }
}

export function installAdGate(
  getButton: (id: string) => { addEventListener: Function; click: Function } | null,
  deps: AdGateDeps = {}
): void {
  const isReady = deps.isReady ?? (() => adReady);
  const showAd = deps.showAd ?? show;
  const mode = deps.mode ?? forceMode();
  const isScreenVisible = deps.isScreenVisible ?? defaultIsScreenVisible;

  if (mode !== 'off') preload();

  for (const id of RESULT_BUTTON_IDS) {
    const btn = getButton(id);
    if (!btn) continue;
    const ownerScreen = BUTTON_OWNER_SCREEN[id];

    btn.addEventListener(
      'click',
      (event: { stopImmediatePropagation?: () => void; preventDefault?: () => void }) => {
        // ① 재발화로 들어온 클릭이면 «그대로 통과»시킨다(루프 방지).
        if (bypassOnce) {
          bypassOnce = false;
          return;
        }
        // ①-b 광고가 떠 있는 동안 들어온 클릭은 «판»이 아니다.
        if (adInFlight) return;
        // ①-c 소유 화면이 «숨겨져» 있으면 유저가 누를 수 없는 클릭이다 = 중복/합성.
        //
        // ★★★ 「이 한 줄이 없으면 멱등성이 깨져 매판 광고가 뜬다」
        //   (Partner 지정 문구 — 원문 그대로)
        //   [실측] 이 줄을 «제거한» 번들: 결과화면에서 4버튼 동시 클릭 → plays «+4».
        //          정상본: plays «+1». 지우면 「2판마다」가 곧바로 무너진다.
        if (ownerScreen && !isScreenVisible(ownerScreen)) return;

        // ② 판 종료 1회로 센다. 카운트는 광고를 띄우든 말든 «항상» 올린다.
        countPlay();

        // ③ ★DF-1 ③ 재시도 트리거는 «유저 행동»이다 — 판 종료가 그 신호다.
        if (mode !== 'off') preload();

        // ④ 띄울 차례가 아니면 «가로채지 않는다» = 원래 동작 그대로.
        if (mode === 'off') return;
        if (mode !== 'always' && !counter.adPending) return;
        /* ★정책 가드 — 세션 60초·10분 간격·하루 3회. AD_EVERY 와 «둘 중 엄격한 쪽»이 이긴다.
         *   ⛔여기서 막을 때 adPending(빚)은 «소비하지 않는다» — 리듬이 미뤄질 뿐 깨지지 않는다(DF-2 규율 그대로). */
        {
          const g = adGuards();
          if (!g.ok) {
            track('ad_guard_blocked', {
              kind: 'interstitial', stage: 'show', reason: g.why,
              session_age_s: Math.round(g.sessionAgeMs / 1000),
              since_last_s: g.sinceLastMs < 0 ? -1 : Math.round(g.sinceLastMs / 1000),
              shown_today: g.shownToday,
            });
            return;
          }
        }
        // ★DF-2: 준비가 안 됐으면 adPending 을 «유지한 채» 통과한다.
        //   빚을 소비하지 «않으므로» 다음 판 종료 때 곧바로 재시도된다.
        //   「2판마다」 리듬이 «미뤄질 뿐 깨지지 않는다».
        if (!isReady()) return;

        // ⑤ 여기서부터 «가로챈다».
        event.stopImmediatePropagation?.();
        event.preventDefault?.();

        adInFlight = true;
        showAd(
          () => {
            // ⑥ 광고가 끝나면 «같은 버튼»을 재발화 → 원래 동작이 실행된다.
            //
            // ★★DF-5 의 «전제» — 이게 무너지면 아래 setTimeout 은 «불필요»해진다
            //   「이 게이트는 프로그램적 .click() 으로 재발화한다 — 그래서 비동기가 «필요»하다.
            //    재발화 방식을 바꾸면 이 setTimeout 은 «불필요»해지고,
            //    남겨두면 2회 실행 위험이 된다」
            //
            //   ★스모가 이 전제에 «해당»한다: 아래 ⑥ 이 `btn.click()` 을 «직접» 부른다
            //     (설계상 게임 로직을 복제하지 않고 «위임»하기 때문이다 — 파일 상단 참고).
            //   ⛔「4종 공통」이라고 «가정»하지 마라(규율 10). 네온은 프로그램적 .click() 이
            //     0건이라 이 결함이 «발현하지 않는다»고 실측했다. 게임마다 «각자» 확인할 것.
            //   ★표준 근거: 「click in progress」 플래그는 HTMLElement.click() «이» 설정한다.
            //     «사용자 입력»은 이 플래그를 건드리지 않는다 → 실제 탭은 원래 멀쩡했다.
            //   ★2회 실행 위험은 «없음»을 실측했다: 7-B/8-B(16케이스)/8-C 전부 원래 동작 «정확히 1회».
            //     (bypassOnce 가 재발화 클릭을 정확히 한 번만 통과시킨다)
            //   ★검사로 고정: _verify_evidence/adgate_v2_260814/ADGATE_SURVIVAL_CHECK.py 의
            //     「DF-5 전제」 항목이 이 `btn.click()` 재발화가 사라지면 «빨간불»을 낸다.
            //
            // ★DF-5 (2026-08-14 실측 발견, v1 부터 있던 잠복 결함)
            //   `btn.click()` 을 «그 버튼의 click 디스패치 안에서 동기로» 부르면
            //   DOM 의 「click in progress」 플래그 때문에 «아무 일도 안 일어난다».
            //   실측: 동기 재발화 → 로그 ['capture']       (원래 동작 «실행 안 됨»)
            //         비동기 재발화 → 로그 [...,'handler'] (정상)
            //   광고 SDK 가 «동기»로 실패하면(showFullScreenAd 가 throw 하거나
            //   onError 를 동기 호출) finish() 가 같은 태스크에서 돌아 유저의
            //   클릭이 «통째로 삼켜진다» = 버튼이 죽은 것처럼 보인다.
            //   → 재발화를 «다음 태스크»로 미뤄 그 경로를 막는다.
            setTimeout(() => {
              adInFlight = false;
              bypassOnce = true;
              btn.click();
            }, 0);
          },
          () => {
            // ⑦ ★표시가 «실제로 시작된 뒤에만» 빚을 소비한다.
            counter.adPending = false;
            noteShown(); // ★가드 원장도 «도달했을 때만» 갱신한다(요청·로드로는 안 센다)
            persist();
            preloadFails = 0; // 표시 성공 → 백오프 리셋
          }
        );
      },
      true // ★ capture — 게임 리스너보다 «먼저» 잡아야 한다
    );
  }
}

/** 브라우저에서 실제로 부르는 진입점. */
export function installAdGateOnDocument(): void {
  installAdGate((id) => document.getElementById(id));
}

/** 테스트 전용 — 모듈 상태를 초기화한다. */
export function __resetForTest(): void {
  bypassOnce = false;
  adInFlight = false;
  adReady = false;
  loading = false;
  preloadFails = 0;
  lastPreloadAt = 0;
  clearPreloadTimer();
  cancelLoadSubscription();
  counter = { ...EMPTY_COUNTER };
  hydrated = false;
  sessionAgeOffset = 0;
}
