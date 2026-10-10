/**
 * 스모 바운스 — «시작화면 하단» 배너 1개.  2026-08-18 신설 · 2026-09-10 요청 규율 재작성(레인 E)
 *
 * President 지시(2026-08-18): 「스모바운스 하단에도 부탁해」
 *   대상 화면 = 타이틀 화면(#sc-title) «하나». 「게임 방법」 버튼 «아래» 여백.
 *
 * ═══ 2026-09-10 왜 다시 썼나 — 콘솔 실측 «배너 요청 31,202 → 노출 2,370 (7.6%)» ═══
 *   헛요청의 주범은 경기장 배너(arenaBanner.ts, 250ms 폴링이 실패 즉시 재부착)였고 그 모듈은
 *   통째로 «제거»됐다. 이 파일은 남는 유일한 배너다. 옛 구조(250ms 폴링 + 세션 영구 dead 플래그)를
 *   개선안(12_광고시청률_개선안 §4 공통 규율)대로 «방문(visit) 단위 상태기계»로 바꿨다:
 *     · 요청은 「보일 때 1회」 — 타이틀 «진입»마다 정확히 1회 attach.
 *     · 노필·렌더 실패·초기화 실패 → 그 방문에서는 재시도 0. 다음 방문은 «백오프»(30s→60s→120s) 뒤에만.
 *     · 타이틀 «이탈» → destroy(+padding 복원). «재진입» → 새 방문 1회.
 *     · `document.hidden` 중엔 요청 0 — 보이게 되면 그 방문의 1회를 그때 보낸다.
 *       이미 붙어 있는 배너는 hidden 이 돼도 «그대로 둔다»(destroy/재부착 = 재요청이므로 안 한다).
 *     · 세션 요청 상한(30). 방문당 1회 규율이 어떤 이유로든 깨져도 폭주는 여기서 끊긴다.
 *   그리고 «250ms 폴링을 없앴다». 화면 전환은 game.js `showScreen()` 이 `.screen` 의 `hidden` 클래스를
 *   토글하는 것으로만 일어나므로 `#sc-title` 의 class 속성에 MutationObserver 를 건다 = «상태 이벤트».
 *   (game.js 는 무접촉. #sc-title 은 정적 HTML 이라 이 모듈이 game.js 보다 먼저 떠도 관찰 가능하다.)
 *   ★같은 값 토글도 mutation 을 울린다(`classList.toggle('hidden', false)` 가 속성을 다시 set 한다) —
 *     그래서 `evaluate()` 는 «전이»만 처리하는 멱등 함수다. game.js 부팅의 showScreen('sc-title') 도 여기로 온다.
 *
 * ── 그대로 가져온 규율(2026-08-18 원문) ─────────────────────────────────────
 *   ① 지면 ID 를 «소스 리터럴»로 두지 않는다 → #ad-slots 의 data-* 에서 런타임에 읽는다
 *      (번들러 상수 접기로 광고 호출이 통째로 사라진 다른 레인 실사고).
 *   ② initialize() → onInitialized 를 «기다린 뒤» attachBanner. 그 전에 부르면
 *      "[toss-ad] Call initialize() before attaching an ad." 로 죽는다.
 *   ③ 등록을 attach «앞»에 한다 — attachBanner 는 예외 시 onAdFailedToRender 를
 *      «동기»로 먼저 부르고 반환한다. 뒤에 등록하면 좀비 호스트가 남는다.
 *   ④ 터치 제외를 «호스트 div 존재»에 묶는다. game.js 의 touchstart 는 window
 *      리스너이고 히트테스트가 없어 «화면 아무 데나»가 유효 입력이다 —
 *      배너 자리를 누르면 게임 조작이 «광고 클릭»이 된다(무효 클릭 = 계정 위험).
 *   ⑤ 숨김이 아니라 «destroy». 안 그러면 다른 화면에서 터치 구멍이 남는다.
 *   ⛔TossAds.destroyAll() 금지 — 자기 핸들만 파기한다.
 *   ㄴ) 예산을 링 기하에서 유도하지 않는다. 타이틀 화면엔 링이 없다.
 *      대신 «.screen 의 padding-bottom 을 배너 높이만큼 늘려» 자리를 예약한다.
 *      ⛔패널·모드 버튼·「게임 방법」의 «위치나 스타일»은 건드리지 않는다.
 *
 * ⛔public/game/sumo-bounce-game.js · src/toss/* · src/sdk-boot.ts · src/reviveAd.ts 전부 «무접촉».
 * ⛔MS Store 산출물 무접촉 — 웹 빌드에서는 `@apps-in-toss/web-framework` 가 shim(isSupported=false)으로
 *   갈아끼워져 이 파일의 «자기 방어선»(safeIsSupported) 이 SDK 호출 전에 멈춘다(src/toss-web/web-framework.ts).
 */
import { TossAds } from '@apps-in-toss/web-framework';
import { track } from './analytics';

/**
 * 토스 밖에서 `TossAds.*.isSupported()` 가 던지는 경우(★fetchTossAd_isSupported 상수 브릿지 부재)를
 * 삼킨다. 토스 안에서는 boolean 을 그대로 돌려준다.
 */
function safeIsSupported(fn: { isSupported(): boolean }): boolean {
  try {
    return fn.isSupported();
  } catch {
    return false;
  }
}

/** 광고가 안 그려지면 아무 자국도 남기지 않는다. 이보다 작으면 붙이지 않는다. */
const MIN_USEFUL = 24;
/** 배너와 「게임 방법」 버튼 사이 최소 숨돌릴 틈. */
const GAP = 8;
const TITLE_SCREEN_ID = 'sc-title';
/**
 * 실패(노필·렌더실패·초기화실패) 뒤 «다음 방문»이 요청을 보낼 수 있는 최소 간격.
 * 연속 실패마다 한 단계씩 늘고 마지막 값에서 멈춘다. 성공하면 0 으로 돌아간다.
 * 값은 개선안(12_광고시청률_개선안 §4 「실패 30→60→120초 백오프」) 그대로.
 */
const FAIL_BACKOFF_MS = [30000, 60000, 120000];
/** 세션당 배너 요청 상한. 방문당 1회 규율이 어떤 이유로든 깨져도 폭주는 여기서 끊긴다. */
const MAX_REQUESTS_PER_SESSION = 30;
/** MutationObserver 를 못 쓰는 환경의 폴백 폴링 간격. 판정만 하고 요청은 방문당 1회 규율이 막는다. */
const FALLBACK_POLL_MS = 1000;

type FailReason = 'noFill' | 'onError' | 'render' | 'init';
type BlockReason = 'backoff' | 'cap';

let host: HTMLDivElement | null = null;
let handle: { destroy(): void } | null = null;
let hostSizer: ResizeObserver | null = null;
let inited = false; // TossAds.initialize() 를 «호출»했는가
let ready = false; // onInitialized 가 «돌아왔는가»
/** 타이틀 «방문» 중인가(진입~이탈). */
let visitActive = false;
/** 이 방문의 1회 요청이 아직 «남아 있는가». 요청을 보내거나 가드에 막히면 false. */
let pendingAttach = false;
/** 연속 실패 수(성공 시 0). */
let failStreak = 0;
/** 실패 백오프 만료 시각(Date.now 기준). 이 시각 전의 방문은 요청 0. */
let nextRetryAt = 0;
/** 세션 누적 요청 수. */
let requestsThisSession = 0;
let installed = false;
/**
 * ★부착 토큰 (2026-09-10 Codex 리뷰 결함 1 반영).
 *   [확인: 모의실행] 타이틀 이탈 → 재진입으로 «새» 배너를 붙인 뒤, «이전» 배너의 onNoFill/onAdRendered 가
 *   뒤늦게 도착하면 콜백이 모듈 전역 host/handle 을 보고 «새» 배너를 죽였다(요청 2회 후 새 핸들 destroyed=true).
 *   렌더 계측도 요청 2회에 3회가 찍혔다 — 우리가 보고하는 숫자 자체가 틀어진다.
 *   ⇒ 부착마다 토큰을 발급하고, 콜백은 «자기 토큰이 아직 현재일 때»만 동작한다.
 */
let attachSeq = 0;
let currentAttach = 0;

/** ★상수 접기 함정 회피: DOM 속성에서 런타임에 읽는다. */
function placementId(): string {
  const el = document.getElementById('ad-slots');
  if (!el) return '';
  return (el.getAttribute('data-ad-start-bottom') || '').trim();
}

function titleScreen(): HTMLElement | null {
  return document.getElementById(TITLE_SCREEN_ID);
}

/** 타이틀 화면이 «실제로» 떠 있는가. .screen.hidden 은 display 가 아니라 opacity 다. */
function isTitleNow(): boolean {
  const sc = titleScreen();
  if (!sc) return false;
  if (sc.classList.contains('hidden')) return false;
  return sc.getBoundingClientRect().height > 0;
}

function isHidden(): boolean {
  try {
    return !!document.hidden;
  } catch {
    return false;
  }
}

/** 배너가 차지한 만큼 .screen 바닥 여백을 넓힌다(패널은 «재배치하지 않는다»). */
function reserve(): void {
  const sc = titleScreen();
  if (!sc || !host) return;
  const h = Math.round(host.getBoundingClientRect().height);
  if (h <= 0) return;
  sc.style.paddingBottom = h + GAP + 'px';
}

function unreserve(): void {
  // 인라인 값만 지운다 → 원래 CSS 규칙(.screen 의 calc(20px + safe-bottom))으로 복귀.
  titleScreen()?.style.removeProperty('padding-bottom');
}

function teardown(): void {
  const h = handle;
  const el = host;
  const rs = hostSizer;
  handle = null;
  host = null; // ★먼저 비운다 — 콜백 재진입 방지
  hostSizer = null;
  currentAttach = 0; // ★이 시점 이후 도착하는 «옛» 콜백은 전부 남의 것이다(결함 1)
  try {
    rs?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    h?.destroy();
  } catch {
    /* SDK 내부 예외는 삼킨다 — 호스트 제거가 더 중요하다 */
  }
  el?.remove(); // ★호스트 제거 = 터치 영역 «구조적» 복원
  unreserve();
}

function makeHost(): HTMLDivElement {
  const d = document.createElement('div');
  d.id = 'start-ad-bottom';
  d.setAttribute('role', 'complementary');
  d.setAttribute('aria-label', 'AD');
  // ★height 를 고정하지 «않는다». SDK 래퍼가 height:100% 라 고정하면 소재가
  //   칸 한가운데 떠서 위쪽에 죽은 여백이 생긴다(경기장 배너 시절 실기기로
  //   확인된 함정). auto 로 두면 래퍼의 100% 가 풀려 «콘텐츠 높이»가 된다.
  // ★비어 있으면 padding 만 남고 배경이 없어 «화면에 아무것도 안 보인다».
  d.style.cssText =
    'position:absolute;left:0;right:0;bottom:0;z-index:21;pointer-events:auto;' +
    'height:auto;overflow:hidden;' +
    'padding:10px calc(12px + var(--sa-right, env(safe-area-inset-right))) ' +
    'calc(10px + var(--sa-bottom, env(safe-area-inset-bottom))) ' +
    'calc(12px + var(--sa-left, env(safe-area-inset-left)));';
  // ★터치 제외 — game.js 의 window 리스너로 «올라가기 전에» 끊는다.
  (['touchstart', 'mousedown', 'pointerdown'] as const).forEach((ev) => {
    d.addEventListener(ev, (e: Event) => e.stopPropagation(), { passive: true });
  });
  const inner = document.createElement('div');
  inner.id = 'start-ad-bottom-inner';
  // 타이틀 패널(.panel)과 같은 결로 폭을 묶는다. 전면 확장은 조잡하다.
  inner.style.cssText = 'max-width:420px;margin:0 auto;';
  d.appendChild(inner);
  return d;
}

function noteFailure(reason: FailReason): void {
  failStreak += 1;
  const idx = Math.min(failStreak - 1, FAIL_BACKOFF_MS.length - 1);
  nextRetryAt = Date.now() + FAIL_BACKOFF_MS[idx];
  track('ad_request_fail', { kind: 'banner', surface: 'title', reason, streak: failStreak });
}

function noteSuccess(): void {
  failStreak = 0;
  nextRetryAt = 0;
}

function noteBlocked(reason: BlockReason): void {
  track('ad_guard_blocked', { kind: 'banner', surface: 'title', reason });
}

/**
 * «요청 1회». 호출 조건(방문 중·보임·준비됨·백오프 밖·상한 안)은 tryAttach 가 전부 확인했다.
 * 여기서 실패하면 그 방문은 끝이다 — 재시도는 다음 방문의 몫이고, 그것도 백오프가 정한다.
 */
function attach(): void {
  const id = placementId();
  const app = document.getElementById('app');
  const sc = titleScreen();
  if (!id || !app || !sc) return;
  // 화면이 배너를 얹을 만큼도 안 되면 애초에 붙이지 않는다.
  if (window.innerHeight < MIN_USEFUL * 6) return;

  const token = ++attachSeq;
  currentAttach = token;
  const el = makeHost();
  host = el;
  app.appendChild(el);
  const inner = el.firstElementChild as HTMLElement;

  requestsThisSession += 1;
  // 개선안 §6 최소 계측 — SDK 호출 «직전»이 ad_request 다.
  track('ad_request', { kind: 'banner', surface: 'title', n: requestsThisSession });

  /** 이 부착이 «아직 현재»인가. 늦게 온 콜백이 다음 방문의 배너를 죽이지 못하게 하는 유일한 문지기(결함 1). */
  const mine = (): boolean => token === currentAttach && host === el;

  const reclaim = (reason: FailReason): void => {
    if (!mine()) return; // 남의 부착에 대한 콜백 — 실패로 세지도, 회수하지도 않는다
    noteFailure(reason);
    teardown();
  };

  try {
    const res = TossAds.attachBanner(id, inner, {
      theme: 'dark', // 타이틀 배경 --bg
      variant: 'card',
      callbacks: {
        onAdRendered: () => {
          if (!mine()) return; // ★계측도 여기서 막는다 — 옛 콜백이 렌더 수를 부풀렸다(요청 2 / 렌더 3)
          // ★그려진 «뒤»에만 자리를 예약하고 배경을 켠다.
          if (el.getBoundingClientRect().height < MIN_USEFUL) {
            reclaim('render');
            return;
          }
          // .screen 은 overflow-y:auto 스크롤 컨테이너다. 작은 화면에서 패널이
          // 넘치면 내용이 배너 «뒤»로 지나간다 — 불투명 배경이 없으면 글자가
          // 배너 여백에 겹쳐 보인다. 색은 게임 배경 --bg «그대로».
          // ⛔렌더 «전»에 칠하면 노필일 때 빈 띠가 남는다. 반드시 여기서.
          el.style.background =
            'linear-gradient(0deg,rgba(14,10,11,.97) 0,rgba(14,10,11,.97) calc(100% - 22px),rgba(14,10,11,0) 100%)';
          reserve();
          watchHostSize();
          noteSuccess();
          track('ad_rendered', { kind: 'banner', surface: 'title' });
        },
        onNoFill: () => reclaim('noFill'),
        onAdFailedToRender: () => reclaim('onError'),
      },
    });
    if (mine()) {
      handle = res;
    } else {
      // 콜백이 «이미» 회수했거나 그 사이 방문이 바뀌었다 — 늦게 받은 핸들도 확실히 파기한다.
      try {
        res.destroy();
      } catch {
        /* ignore */
      }
    }
  } catch {
    reclaim('onError');
  }
}

/**
 * 소재가 SDK 쪽에서 바뀌어 높이가 달라지면 예약(padding)도 따라간다.
 * 옛 코드는 250ms 폴링에서 매 tick reserve() 를 다시 불렀다 — 폴링이 없어졌으니 ResizeObserver 가 그 몫이다.
 */
function watchHostSize(): void {
  if (!host || hostSizer || typeof ResizeObserver === 'undefined') return;
  try {
    hostSizer = new ResizeObserver(() => reserve());
    hostSizer.observe(host);
  } catch {
    hostSizer = null;
  }
}

/**
 * 이 방문의 1회 요청을 «지금 보낼 수 있으면» 보낸다. 못 보내는 이유가 «기다리면 풀리는 것»(hidden·초기화 대기)이면
 * pendingAttach 를 살려 두고, «이 방문에서는 끝인 것»(백오프·상한·미지원·지면 없음)이면 pendingAttach 를 끈다.
 */
function tryAttach(): void {
  if (!visitActive || !pendingAttach || host) return;
  /* ★요청 «직전»에 화면을 다시 확인한다(2026-09-10 Codex 리뷰 결함 4).
   *   [확인: 모의실행] MutationObserver 를 못 쓰는 폴백 환경에서 「hidden 중 타이틀 이탈 → 다음 폴링 전에 visible」
   *   이면 visibilitychange 가 «낡은» visitActive 를 그대로 믿고 요청을 1회 보냈다.
   *   visitActive 는 관측 시점의 «기억»이고, isTitleNow() 는 «지금»이다. 요청은 지금을 근거로만 나간다. */
  if (!isTitleNow()) return;
  if (isHidden()) return; // 보이게 되면 visibilitychange 가 다시 부른다 — 숨김 중 요청 0
  if (Date.now() < nextRetryAt) {
    pendingAttach = false;
    noteBlocked('backoff');
    return;
  }
  if (requestsThisSession >= MAX_REQUESTS_PER_SESSION) {
    pendingAttach = false;
    noteBlocked('cap');
    return;
  }
  if (!placementId()) {
    pendingAttach = false;
    return;
  }
  if (!safeIsSupported(TossAds.attachBanner)) {
    pendingAttach = false;
    track('ad_request_fail', { kind: 'banner', surface: 'title', reason: 'unsupported' });
    return;
  }
  if (!inited) {
    inited = true;
    try {
      // ★initialize → onInitialized «대기». 그 전에 attachBanner 하면 안 된다.
      //   SDK 가 이미 초기화돼 있으면 onInitialized 가 «동기»로 온다 → 아래 tryAttach 재진입이 곧바로 붙인다.
      TossAds.initialize({
        callbacks: {
          onInitialized: () => {
            ready = true;
            tryAttach();
          },
          onInitializationFailed: () => {
            // 옛 코드는 여기서 세션 영구 dead 였다. 이제는 «실패 1회»로 세고 백오프 뒤 방문에서 다시 초기화한다.
            inited = false;
            ready = false;
            pendingAttach = false;
            noteFailure('init');
          },
        },
      });
    } catch {
      inited = false;
      pendingAttach = false;
      noteFailure('init');
    }
    return;
  }
  if (!ready) return; // onInitialized 가 tryAttach 를 다시 부른다
  pendingAttach = false; // 이 방문의 1회를 «지금» 쓴다
  attach();
}

function beginVisit(): void {
  visitActive = true;
  pendingAttach = true;
}

function endVisit(): void {
  visitActive = false;
  pendingAttach = false;
  teardown(); // ⛔숨김이 아니라 destroy — 터치 구멍을 남기지 않는다
}

/** 화면 상태를 다시 판정한다. «전이»만 처리하므로 몇 번 불려도 결과가 같다(멱등). */
function evaluate(): void {
  const onTitle = isTitleNow();
  if (!onTitle) {
    if (visitActive) endVisit();
    return;
  }
  if (!visitActive) beginVisit();
  tryAttach();
}

export function installStartBanner(): void {
  if (installed) return;
  installed = true;

  // 상태 이벤트 = game.js showScreen() 의 hidden 클래스 토글. 폴링은 폴백일 뿐이다.
  const sc = titleScreen();
  if (sc && typeof MutationObserver !== 'undefined') {
    try {
      new MutationObserver(() => evaluate()).observe(sc, { attributes: true, attributeFilter: ['class'] });
    } catch {
      window.setInterval(evaluate, FALLBACK_POLL_MS);
    }
  } else {
    window.setInterval(evaluate, FALLBACK_POLL_MS);
  }

  // 숨김 → 보임: «화면 상태부터 다시 판정»한 뒤(evaluate) 남은 1회가 있으면 보낸다.
  // ⛔tryAttach() 를 직접 부르면 안 된다 — 그 사이 화면이 바뀌었을 수 있다(결함 4).
  try {
    document.addEventListener('visibilitychange', () => {
      if (!isHidden()) evaluate();
    });
  } catch {
    /* ignore */
  }

  let raf = 0;
  const relayout = (): void => {
    window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(() => {
      if (host) reserve(); // 회전·리사이즈 → 예약만 다시 잰다. 재부착(=재요청)은 하지 않는다.
    });
  };
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => window.setTimeout(relayout, 300));

  evaluate();
}
