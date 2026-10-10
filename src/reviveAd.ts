/**
 * 스모 바운스 — 「부활 1회」 리워드 광고. venture-frontend, 2026-08-31.
 *
 * ═══ President 지시 원문 ═══
 *   「리워드: 「부활 1회」(스모 바운스는 생명 하나로 부활하되 상대방을 이긴 횟수가
 *     남아있어야 함, …)」
 *
 * ═══ 「이긴 횟수가 남아있어야 함」을 어떻게 읽었나 (판단 근거를 여기 남긴다) ═══
 *   이 게임엔 「생명(lives)」이라는 변수가 «없다». 있는 것은 «라운드»다:
 *     한 경기(bout) = winsNeeded(2~3) 선승제. scoreP1/scoreP2 가 각자 딴 라운드 수.
 *     패배 = 상대(scoreP2)가 winsNeeded 에 먼저 도달 → finishMatch(2).
 *   ⇒ 이 구조에서 「생명 하나」의 유일한 자연스러운 번역은 «라운드 하나»다.
 *     부활 = 상대의 «마지막 결정타 라운드»를 되돌린다(scoreP2 = winsNeeded - 1).
 *
 *   문장은 두 가지로 읽힌다:
 *     (a) 조건 — 내가 이긴 라운드가 «남아 있어야»(scoreP1 > 0) 부활할 수 있다.
 *     (b) 결과 — 부활해도 내가 이긴 라운드 수가 «유지»된다(초기화되지 않는다).
 *   ⇒ 지시대로 «둘 다» 만족시킨다. (b)는 구조상 공짜다(scoreP1 을 아무도 안 건드린다).
 *     (a)는 실제 게이트로 넣었다(REQUIRE_OWN_WIN) — 0:3 완패(=한 번도 못 이긴 판)에는
 *     부활을 제안하지 않는다. 「접전이었던 판만 되살린다」는 뜻이 되어 문장과도 맞고
 *     광고 가치도 높다(유저가 실제로 아까워하는 순간에만 뜬다).
 *
 * ═══ 어느 모드에 붙이나 ═══
 *   ⭕아케이드 토너먼트만. 여기서만 패배에 «대가»가 있다(다음 판 진출·해금이 날아간다).
 *   ❌로컬 2인 대전(versus) — 한쪽만 광고로 되살아나면 상대 사람에게 불공정하다.
 *   ❌자유 연습(practice) — 져도 잃는 게 0이라 부활에 가치가 없다. 가치 없는 보상에
 *      광고를 붙이는 건 신뢰를 깎는다(심사에서도 지적 대상).
 *
 * ═══ 지면 (Partner 콘솔 실등록) ═══
 *   「스모 바운스 부활 1회」 · REWARDED · 보상 단위 「부활권」×1
 *   ★지면ID 는 아래 REVIVE_AD_GROUP_ID «상수 하나»가 이 앱의 정본이다.
 *     ⛔다른 파일에 이 문자열을 복사하지 마라(전면광고 지면은 toss/interstitialAd.ts 소관).
 *
 * ═══ ★★안드로이드 보상 유실 방어 — 남의 실사고를 그대로 이식했다 ★★ ═══
 *   네온 스레드 `src/skinTrial.ts` 의 「4차 규격(-24)」이 원본이다. 실기기에서
 *   `dismissed`/`open_timeout` 이 «먼저» 오고 `userEarnedReward` 가 늦게 도착해,
 *   광고를 끝까지 봤는데 보상이 finished 가드에 버려지던 사고(President 실기기 제보,
 *   iOS 정상·Android 실패)가 있었다. 부활에서 이게 터지면 「광고만 보고 부활 못 한」
 *   최악의 경험이 된다. 그래서 방어 6종을 그대로 옮겼다:
 *     1. dismissed / hard_cap 판정에 «유예 3,000ms» — 유예 중 reward 오면 즉시 성공.
 *     2. 이벤트 «타입 문자열 정규화»(소문자·영문 외 제거) 후 'userearnedreward' 포함 판정.
 *        e.type 이 아니라 e.name / e.event / e.eventType / e.data.type 에 있어도 읽는다.
 *     3. open_timeout 은 «아무 이벤트도 안 왔을 때»만(8s). requested 만 오고 show/impression
 *        이 없으면 20s 더 기다린다. 판정이 끝난 뒤 15s 안에 늦은 reward 가 오면 그때 지급.
 *     4. reward 이벤트가 끝내 안 와도 show/impression 뒤 «12초 이상» 표시된 뒤 dismissed 면
 *        1회로 인정(reward_inferred). ⛔부활권은 실돈이 아니라 판 안의 소프트 혜택이라
 *        허용한다 — 프로모션 «실돈» 지급 경로엔 이 추론을 절대 켜지 마라.
 *     5. 광고 1회마다 이벤트 시퀀스·타임스탬프·platform 을 track('ad_seq') 로 남긴다
 *        (log_type 'event' 폴백이라 콘솔 카탈로그에 잡힌다 — 실패해도 «순서»를 읽을 수 있다).
 *     6. 실패 사유를 유저에게 «그 자리에서» 알린다(오버레이 안. 토스트는 프리즈 화면에서 놓친다).
 *   ⛔이 파일과 네온 skinTrial.ts 는 «별개 앱»이라 코드를 공유할 수 없다. 한쪽 규격을
 *     고치면 다른 쪽도 같이 봐라(그래서 규격 번호 1~6 을 양쪽에 같은 말로 적어뒀다).
 *
 * ═══ 보상 판정은 «클라이언트»다 (서버 없음) ═══
 *   ⛔이 게임엔 서버가 없다. 지급·중복방지·상한이 전부 로컬이다. 기기 시계 조작·
 *     localStorage 편집·WebView 저장소 초기화로 «반복 수령이 원천 차단되지 않는다».
 *     상한을 이중으로 둔다: (1) 경기당 1회 — 게임 메모리(game.js reviveUsed),
 *     (2) 하루 5회 — localStorage + KST 날짜키. 저장소가 비면 다시 5회가 된다.
 *   ★감수 근거: 보상이 «그 경기 내 진행»뿐이라 악용 이득이 광고 시청 시간보다 작다.
 *     실돈·재화가 붙는 순간 이 설계로는 부족하다 — 그때는 서버 검증이 선행돼야 한다.
 *
 * ═══ 웹/스토어 산출물 ═══
 *   `vite build`(모드 없음)에서 이 모듈은 통째로 `src/toss-web/reviveAd.ts`(no-op)로
 *   치환된다(vite.config.ts). 지면ID 리터럴이 웹 번들에 새지 않게 하려는 것 —
 *   interstitialAd.ts 와 «같은» 사유·같은 방식이다.
 */
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { track } from './analytics';
import { kstDateKey } from './lib/daykey';

/** ★이 앱의 부활 지면 — 이 상수 하나가 정본이다. */
const REVIVE_AD_GROUP_ID = 'ait.v2.live.XXXXXXXXXXXXXXXX';

/** 「이긴 라운드가 남아 있어야 부활 가능」(President 문장 해석 (a)). */
const REQUIRE_OWN_WIN = true;
/** 하루 부활 상한(지급 기준). 실패한 시청은 세지 않는다. */
const DAILY_GRANT_CAP = 5;
/** 한 경기에서 광고를 «시도»할 수 있는 횟수(로드 실패 재시도 허용, 스팸 방지). */
const ATTEMPTS_PER_MATCH = 2;
/** 제안 자동 소멸(ms). 만료되면 «거절»로 처리한다 — 자동 재생은 절대 없다. */
const OFFER_TIMEOUT_MS = 10000;
const REVIVE_KEY = 'sumobounce.revive.v1';
/** 광고가 닫히고 화면이 돌아온 뒤 «한 박자» — 창이 사라지자마자 조작을 요구하지 않는다. */
const RESUME_BEAT_MS = 450;
/** 문서가 계속 hidden 이면(이벤트 유실·특이 플랫폼) 이만큼 뒤엔 그냥 재개한다 — 영구 프리즈 방지. */
const RESUME_HIDDEN_CAP_MS = 90000;

/* ── 광고 타이밍 상수 (네온 skinTrial.ts 4차 규격과 «같은 값». 바꾸려면 양쪽 같이) ── */
const LOAD_TIMEOUT_MS = 8000;
/** show() 뒤 «아무 이벤트도» 안 오면 광고가 안 뜬 것 — 이때만 open_timeout. */
const SHOW_OPEN_TIMEOUT_MS = 8000;
/** requested 는 왔는데 show/impression 이 없을 때의 추가 대기. */
const SHOW_REQUESTED_TIMEOUT_MS = 20000;
const SHOW_HARD_CAP_MS = 180000;
/** dismissed / hard_cap 뒤 reward 를 기다리는 유예(안드로이드 브릿지 지연 대비). */
const DISMISS_GRACE_MS = 3000;
/** reward 이벤트 없이도 «이만큼 표시된 뒤 닫힘»이면 시청으로 인정. */
const INFER_MIN_SHOWN_MS = 12000;  // 2026-08-31 President 결정: 20000 -> 12000.
// 리워드 광고는 15~30초이고 스킵 불가 구간이 끝나야 닫기가 뜬다. 20초 문턱이면
// 「15초 광고를 끝까지 봤는데 보상 이벤트가 유실된」 안드로이드 케이스가 미지급으로 샌다.
// 악용 이득은 판 안 소프트 혜택뿐이라 12초 대기가 이득보다 크다(실돈 경로 아님).
/** 판정이 끝난 뒤에도 이만큼은 늦은 reward 를 받아 지급한다. */
const LATE_REWARD_WINDOW_MS = 15000;
const SEQ_MAX = 24;

export interface ReviveInfo {
  /** 아케이드 몇 번째 판인가(1-base). */
  stage: number;
  /** 내가 딴 라운드 수 — President 문장의 「상대방을 이긴 횟수」. */
  myWins: number;
  /** 상대가 딴 라운드 수(= winsNeeded, 지금 막 도달한 값). */
  theirWins: number;
  /** 선승 조건. */
  needed: number;
}

declare global {
  interface Window {
    /** 래퍼가 설치 → game.js 가 패배 확정 «직전»에 호출. true 면 game.js 는 결과화면을 보류한다. */
    __sumoReviveOffer?: (info: ReviveInfo) => boolean;
    /** game.js 가 설치 → 래퍼가 판정 뒤 «한 번» 호출. ok=true 면 부활. */
    __sumoReviveApply?: (ok: boolean) => boolean;
  }
}

function platformTag(): 'android' | 'ios' | 'other' {
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  } catch {
    /* noop */
  }
  return 'other';
}

function adsUsable(): boolean {
  try {
    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

/* ─────────────────────── 이벤트 정규화 (규격 2) ─────────────────────── */

/** 이벤트 객체에서 타입 문자열을 꺼낸다(e.type 우선, 다른 필드·중첩도 허용). */
export function rawEventType(e: unknown): string {
  try {
    if (typeof e === 'string') return e;
    const o = e as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return 'unknown';
    const cands = [o.type, o.name, o.event, o.eventType, o.eventName, (o.data as Record<string, unknown> | undefined)?.type];
    for (const c of cands) if (typeof c === 'string' && c) return c;
  } catch {
    /* noop */
  }
  return 'unknown';
}

/** 'userEarnedReward' / 'USER_EARNED_REWARD' / 'user-earned-reward' → 'userearnedreward'. */
export function normType(raw: string): string {
  return String(raw).toLowerCase().replace(/[^a-z]/g, '');
}

export function isRewardType(n: string): boolean {
  return n.includes('userearnedreward') || n.includes('earnedreward') || n === 'rewarded' || n === 'reward';
}

/* ─────────────────────── 로드 + 표시 (단발, 유저 탭 트리거) ─────────────────────── */

export interface GrantResult {
  ok: boolean;
  reason?: string;
  /** reward 이벤트 없이 «표시 시간»으로 인정한 경우 true. */
  inferred?: boolean;
  seq?: string;
}

export interface LoadAndShowOptions {
  /** 표시 12s+ 후 dismissed 를 시청으로 인정(규격 4). ⛔실돈 경로 금지. */
  allowInferred?: boolean;
  surface?: string;
  /** 판정(실패) 뒤 15s 안에 뒤늦게 reward 가 오면 «한 번» 불린다(규격 3). */
  onLateReward?: () => void;
}

export function loadAndShow(opts: LoadAndShowOptions = {}): Promise<GrantResult> {
  const allowInferred = !!opts.allowInferred;
  const surface = opts.surface || 'revive';
  const platform = platformTag();
  return new Promise((resolve) => {
    const t0 = Date.now();
    const seq: string[] = [];
    const ms: number[] = [];
    const mark = (tag: string): void => {
      if (seq.length >= SEQ_MAX) return;
      seq.push(tag);
      ms.push(Date.now() - t0);
    };
    let settled = false;
    let unsubLoad: (() => void) | null = null;
    const safeUnsub = (fn: (() => void) | null): void => {
      try {
        if (typeof fn === 'function') fn();
      } catch {
        /* noop */
      }
    };
    /** 규격 5 — 실패해도 «무슨 순서로 왔는지»를 읽을 수 있어야 한다. */
    const report = (result: 'ok' | 'inferred' | 'fail', reason: string, shownMs: number): void => {
      track('ad_seq', { seq: seq.join('>'), ms: ms.join(','), platform, surface, result, reason, shownMs, inferAllowed: allowInferred });
    };

    const finishLoad = (ok: boolean, reason?: string): void => {
      if (settled) return;
      if (loadTimer) {
        clearTimeout(loadTimer);
        loadTimer = null;
      }
      if (!ok) {
        settled = true;
        mark('end:' + (reason || 'load_fail'));
        safeUnsub(unsubLoad);
        report('fail', reason || 'load_fail', 0);
        resolve({ ok: false, reason, seq: seq.join('>') });
        return;
      }
      showNow();
    };

    let loadTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => finishLoad(false, 'load_timeout'), LOAD_TIMEOUT_MS);

    function showNow(): void {
      let earned = false;
      let shownAt = 0;
      let requestedAt = 0;
      let finished = false;
      let unsubShow: (() => void) | null = null;
      let openTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => settle('open_timeout'), SHOW_OPEN_TIMEOUT_MS);
      let reqTimer: ReturnType<typeof setTimeout> | null = null;
      let capTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => deferSettle('hard_cap'), SHOW_HARD_CAP_MS);
      let graceTimer: ReturnType<typeof setTimeout> | null = null;
      let lateFired = false;
      const clearAll = (): void => {
        for (const t of [openTimer, reqTimer, capTimer, graceTimer]) if (t) clearTimeout(t);
        openTimer = reqTimer = capTimer = graceTimer = null;
      };
      const shownMsNow = (): number => {
        const from = shownAt || requestedAt;
        return from ? Date.now() - from : 0;
      };
      const settle = (reason: string): void => {
        if (finished) return;
        finished = true;
        clearAll();
        settled = true;
        const shownMs = shownMsNow();
        mark('end:' + reason);
        // 판정 뒤에도 잠시 듣는다(늦은 reward 지급 + 계측). 창이 닫히면 구독 해제.
        setTimeout(() => safeUnsub(unsubShow), LATE_REWARD_WINDOW_MS);
        if (earned) {
          report('ok', reason, shownMs);
          resolve({ ok: true, seq: seq.join('>') });
          return;
        }
        const closedLike = reason === 'dismissed' || reason === 'hard_cap';
        if (allowInferred && closedLike && shownMs >= INFER_MIN_SHOWN_MS) {
          track('reward_inferred', { platform, surface, shownMs, shownFrom: shownAt ? 'show' : 'requested', reason });
          report('inferred', reason, shownMs);
          resolve({ ok: true, inferred: true, seq: seq.join('>') });
          return;
        }
        report('fail', reason, shownMs);
        resolve({ ok: false, reason, seq: seq.join('>') });
      };
      /** 규격 1 — dismissed / hard_cap 은 «유예» 뒤 판정. 유예 중 reward 가 오면 settle 이 먼저 불린다. */
      const deferSettle = (reason: 'dismissed' | 'hard_cap'): void => {
        if (finished || graceTimer) return;
        graceTimer = setTimeout(() => {
          graceTimer = null;
          settle(reason);
        }, DISMISS_GRACE_MS);
      };
      const onEvent = (e: unknown): void => {
        const raw = rawEventType(e);
        const n = normType(raw);
        mark(raw.slice(0, 24));
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
        if (isRewardType(n)) {
          if (finished) {
            // 규격 3 — 늦은 reward: 판정은 끝났지만 창 안이면 «그때» 지급.
            if (!earned && !lateFired) {
              lateFired = true;
              earned = true;
              track('ad_late_reward', { platform, surface, delayMs: ms.length ? ms[ms.length - 1] : 0 });
              try {
                if (typeof opts.onLateReward === 'function') opts.onLateReward();
              } catch {
                /* noop */
              }
            }
            return;
          }
          earned = true; // 멱등: 여러 번 와도 boolean 한 번만 true
          settle('reward');
          return;
        }
        if (finished) return;
        if (n === 'requested') {
          if (!requestedAt) requestedAt = Date.now();
          if (!shownAt && !reqTimer) reqTimer = setTimeout(() => settle('open_timeout'), SHOW_REQUESTED_TIMEOUT_MS);
          return;
        }
        if (n === 'show' || n === 'impression') {
          if (!shownAt) shownAt = Date.now();
          if (reqTimer) {
            clearTimeout(reqTimer);
            reqTimer = null;
          }
          return;
        }
        if (n === 'clicked' || n === 'loaded' || n === 'unknown') return;
        if (n === 'dismissed' || n === 'closed' || n === 'dismiss') {
          deferSettle('dismissed');
          return;
        }
        if (n === 'failedtoshow' || n === 'failed' || n === 'error') settle('failedToShow');
      };
      mark('show_call');
      try {
        const ret = showFullScreenAd({
          options: { adGroupId: REVIVE_AD_GROUP_ID },
          onEvent,
          onError: () => settle('onError'),
        }) as unknown;
        if (typeof ret === 'function') unsubShow = ret as () => void;
      } catch {
        settle('failedToShow');
      }
    }

    mark('load_call');
    try {
      const ret = loadFullScreenAd({
        options: { adGroupId: REVIVE_AD_GROUP_ID },
        onEvent: (e) => {
          const n = normType(rawEventType(e));
          if (n === 'loaded') {
            mark('loaded');
            safeUnsub(unsubLoad);
            unsubLoad = null;
            finishLoad(true);
          }
        },
        onError: () => finishLoad(false, 'onError'),
      }) as unknown;
      if (typeof ret === 'function') unsubLoad = ret as () => void;
    } catch {
      finishLoad(false, 'onError');
    }
  });
}

/* ─────────────────────── 하루 상한 (게임 세이브 «밖») ─────────────────────── */
/* sumoSave(게임 진행 저장)는 무접촉이다. 별도 키 하나만 쓴다. */

function grantsToday(): number {
  try {
    const raw = window.localStorage.getItem(REVIVE_KEY);
    if (!raw) return 0;
    const o = JSON.parse(raw) as { d?: string; n?: number };
    if (!o || o.d !== kstDateKey()) return 0;
    return typeof o.n === 'number' && o.n > 0 ? o.n : 0;
  } catch {
    return 0;
  }
}

function bumpGrantsToday(): void {
  try {
    window.localStorage.setItem(REVIVE_KEY, JSON.stringify({ d: kstDateKey(), n: grantsToday() + 1 }));
  } catch {
    /* quota/private mode — 상한이 느슨해질 뿐 기능은 산다 */
  }
}

/* ─────────────────────── 문구 ─────────────────────── */

type Lang = 'ko' | 'en';
function uiLang(): Lang {
  try {
    if ((document.documentElement.lang || '').toLowerCase().startsWith('en')) return 'en';
  } catch {
    /* noop */
  }
  return 'ko';
}

const MSG: Record<Lang, Record<string, string>> = {
  ko: {
    kicker: '링 밖으로 밀려났다',
    title: '한 라운드 더 버텨볼까요?',
    body: '이긴 라운드는 그대로. 마지막 한 라운드만 되돌립니다.',
    labStage: '번째 판',
    labWins: '획득 라운드',
    cta: '광고 보고 이어하기',
    ctaLoading: '광고 불러오는 중',
    no: '결과 보기',
    note: '한 경기에 한 번만 쓸 수 있어요',
    failWatch: '광고를 끝까지 봐야 이어할 수 있어요',
    failLoad: '광고를 불러오지 못했어요',
    retry: '다시 시도',
    aria: '이어하기 제안',
  },
  en: {
    kicker: 'Pushed out of the ring',
    title: 'Stay in for one more round?',
    body: 'Your won rounds stay. Only the last one is rolled back.',
    labStage: 'Bout no.',
    labWins: 'Rounds won',
    cta: 'Watch an ad to continue',
    ctaLoading: 'Loading ad',
    no: 'See results',
    note: 'One continue per bout',
    failWatch: 'Watch the ad to the end to continue',
    failLoad: 'Could not load the ad',
    retry: 'Try again',
    aria: 'Continue offer',
  },
};

/* ─────────────────────── 오버레이 (게임 SCREENS 배열 «밖») ───────────────────────
 * ⛔game.js 의 SCREENS/showScreen/activeScreen 에 끼워 넣지 않는다 — 그 배열은 게임이
 *   소유하고 BGM 믹스·CTA 패딩·일시정지 판정이 전부 activeScreen 을 본다. 래퍼 전용
 *   요소를 따로 만들어 충돌면을 0으로 둔다.
 * ⛔backdrop-filter 금지(게임 UI 상시 규칙 — UI 가 게임 루프와 GPU 를 공유한다).
 *   스크림은 «불투명 알파»만. 애니메이션은 opacity/transform 만 — 레이아웃/페인트 유발 0.
 * 팔레트는 DESIGN.md §2 그대로: 먹(#181113 카드) · 등롱 금(CTA) · 주홍(패배 kicker) · 종이(본문).
 */

const CSS = [
  /* z-index 80 — 게임 UI(.screen 10~20)·HUD·토스트(15/70)·언어·프라이버시 링크(60) «위»,
     앱 레벨 모달(출석 99998 / 종료확인 99999) «아래». 부활 제안은 게임 오버레이지
     앱 모달이 아니다 — 종료확인이 뜨면 그쪽이 이겨야 한다. */
  '#sbRv{position:fixed;z-index:80;inset:0;display:flex;align-items:center;justify-content:center;',
  'padding:calc(16px + var(--sa-top,0px)) 16px calc(16px + var(--sa-bottom,0px));',
  'background:rgba(7,4,5,.84);opacity:0;transition:opacity .18s var(--ez,cubic-bezier(.16,1,.3,1));',
  'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",Roboto,"Noto Sans KR",sans-serif}',
  '#sbRv[hidden]{display:none}',
  '#sbRv.on{opacity:1}',
  '#sbRv .rvCard{width:min(100%,380px);box-sizing:border-box;padding:26px 22px 18px;border-radius:26px;',
  /* 한국어는 «어절» 단위로 끊어야 한다 — 실렌더 스크린샷에서 「되돌 / 립니다」로
     단어 가운데가 쌀렸다. overflow-wrap:anywhere 는 긴 단어 로케일의 최후 보루. */
  'word-break:keep-all;overflow-wrap:anywhere;',
  'background:#181113;border:1px solid rgba(255,236,214,.09);',
  'box-shadow:0 18px 44px -12px rgba(0,0,0,.72);text-align:center;',
  'transform:translateY(14px) scale(.985);transition:transform .22s var(--ez,cubic-bezier(.16,1,.3,1))}',
  '#sbRv.on .rvCard{transform:none}',
  '#sbRv .rvKick{margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;color:#ff5a5f}',
  '#sbRv .rvTitle{margin:8px 0 0;font-size:23px;line-height:1.28;font-weight:800;color:#f6efe6;letter-spacing:-.01em}',
  '#sbRv .rvStats{display:flex;justify-content:center;gap:10px;margin:18px 0 0}',
  '#sbRv .rvStats div{flex:1 1 0;min-width:0;padding:10px 6px;border-radius:12px;background:rgba(255,236,214,.05)}',
  '#sbRv .rvStats b{display:block;font-family:"Anton",var(--display,sans-serif);font-size:26px;font-weight:400;',
  'color:#ffc94a;font-variant-numeric:tabular-nums;line-height:1.05}',
  '#sbRv .rvStats span{display:block;margin-top:5px;font-size:11px;font-weight:700;color:#a89a8c}',
  '#sbRv .rvBody{margin:14px 0 0;font-size:14px;line-height:1.55;color:#c2b5a8}',
  '#sbRv .rvBody.err{color:#ff5a5f}',
  '#sbRv .rvGo{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;margin:20px 0 0;',
  'border:1px solid transparent;border-radius:18px;font:inherit;font-size:16px;font-weight:800;letter-spacing:-.01em;cursor:pointer;',
  'background:linear-gradient(170deg,#ffd35c,#ffb42e);color:#241703;',
  'box-shadow:0 12px 22px -10px rgba(0,0,0,.7),0 1px 0 rgba(255,236,214,.35) inset}',
  '#sbRv .rvGo:active{transform:scale(.978)}',
  '#sbRv .rvGo[disabled]{opacity:.55;pointer-events:none}',
  '#sbRv .rvNo{display:block;width:100%;min-height:52px;margin:8px 0 0;border:0;background:transparent;',
  'font:inherit;font-size:15px;font-weight:700;color:#c2b5a8;border-radius:16px;cursor:pointer}',
  '#sbRv .rvNo:active{background:rgba(255,236,214,.05)}',
  '#sbRv .rvNote{margin:10px 0 0;font-size:12px;font-weight:700;color:#a89a8c}',
  '#sbRv .rvBar{height:3px;margin:14px -22px -18px;border-radius:0 0 26px 26px;overflow:hidden;background:rgba(255,236,214,.08)}',
  /* 시간 표시는 «정보»지 주인공이 아니다 — 등롱 금을 그대로 쓰되 알파를 낮춰 CTA 와 경쟁 안 하게. */
  '#sbRv .rvBar i{display:block;height:100%;background:rgba(255,201,74,.5);transform-origin:left center;transform:scaleX(1)}',
  /* ★포커스링을 «지우지 않고» 팀레트로. 기본링은 골드 CTA 위에서 거의 안 보이기도 한다 —
     종이색(paper) 링이 먹지 카드·금 CTA 양쪽 에서 모두 읽힌다. */
  '#sbRv .rvGo:focus-visible,#sbRv .rvNo:focus-visible{outline:2px solid #f6efe6;outline-offset:3px}',
  '#sbRv .rvSpin{width:15px;height:15px;border-radius:50%;border:2px solid rgba(36,23,3,.3);border-top-color:#241703;',
  'animation:sbRvSpin .7s linear infinite}',
  '@keyframes sbRvSpin{to{transform:rotate(360deg)}}',
  /* 가로모드·작은 폰에서 카드가 잘리면 안 된다. */
  '@media (max-height:520px){#sbRv .rvCard{padding:18px 18px 14px}#sbRv .rvTitle{font-size:20px}',
  '#sbRv .rvStats{margin-top:12px}#sbRv .rvStats b{font-size:22px}#sbRv .rvBody{margin-top:10px;font-size:13px}',
  '#sbRv .rvGo{margin-top:14px;min-height:52px}#sbRv .rvBar{margin:10px -18px -14px}}',
  '@media (prefers-reduced-motion:reduce){#sbRv,#sbRv .rvCard{transition:none}#sbRv .rvBar i{transition:none!important}',
  '#sbRv .rvSpin{animation:none}}',
].join('');

interface Ui {
  root: HTMLElement;
  kick: HTMLElement;
  title: HTMLElement;
  a: HTMLElement;
  b: HTMLElement;
  aL: HTMLElement;
  bL: HTMLElement;
  body: HTMLElement;
  go: HTMLButtonElement;
  goLabel: HTMLElement;
  spin: HTMLElement;
  no: HTMLButtonElement;
  note: HTMLElement;
  barFill: HTMLElement;
}

let ui: Ui | null = null;

function buildUi(): Ui | null {
  try {
    if (ui && ui.root.isConnected) return ui;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'sbRv';
    root.hidden = true;
    root.innerHTML =
      '<div class="rvCard" role="dialog" aria-modal="true" aria-labelledby="sbRvTitle">' +
      '<p class="rvKick" id="sbRvKick"></p>' +
      '<h2 class="rvTitle" id="sbRvTitle"></h2>' +
      '<div class="rvStats"><div><b id="sbRvA"></b><span id="sbRvAL"></span></div>' +
      '<div><b id="sbRvB"></b><span id="sbRvBL"></span></div></div>' +
      '<p class="rvBody" id="sbRvBody"></p>' +
      '<button type="button" class="rvGo" id="sbRvGo"><i class="rvSpin" id="sbRvSpin" hidden aria-hidden="true"></i>' +
      '<span id="sbRvGoLabel"></span></button>' +
      '<button type="button" class="rvNo" id="sbRvNo"></button>' +
      '<p class="rvNote" id="sbRvNote"></p>' +
      '<div class="rvBar" aria-hidden="true"><i id="sbRvBarF"></i></div>' +
      '</div>';
    document.body.appendChild(root);

    const pick = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
    ui = {
      root,
      kick: pick('sbRvKick'),
      title: pick('sbRvTitle'),
      a: pick('sbRvA'),
      b: pick('sbRvB'),
      aL: pick('sbRvAL'),
      bL: pick('sbRvBL'),
      body: pick('sbRvBody'),
      go: pick('sbRvGo') as HTMLButtonElement,
      goLabel: pick('sbRvGoLabel'),
      spin: pick('sbRvSpin'),
      no: pick('sbRvNo') as HTMLButtonElement,
      note: pick('sbRvNote'),
      barFill: pick('sbRvBarF'),
    };
    ui.go.addEventListener('click', () => void onAccept());
    ui.no.addEventListener('click', () => finish(false, 'decline'));
    return ui;
  } catch (e) {
    console.error('[reviveAd] UI 생성 실패 (게임은 그대로 결과화면으로 간다):', e);
    return null;
  }
}

/* ─────────────────────── 상태 ─────────────────────── */

let open = false;
let busy = false;
let attempts = 0;
let deadline = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let curInfo: ReviveInfo | null = null;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** 카운트다운을 CSS 트랜지션 «한 번»으로 돌린다 — 프레임마다 도는 JS 가 0이다(60fps 규율). */
function startCountdown(ms: number): void {
  if (!ui) return;
  const f = ui.barFill;
  f.style.transition = 'none';
  f.style.transform = 'scaleX(1)';
  void f.offsetWidth; // reflow 강제 — 없으면 트랜지션이 안 걸린다
  f.style.transition = 'transform ' + ms + 'ms linear';
  f.style.transform = 'scaleX(0)';
  deadline = Date.now() + ms;
  clearTimer();
  timer = setTimeout(() => finish(false, 'timeout'), ms);
}

function stopCountdown(): void {
  clearTimer();
  if (!ui) return;
  const f = ui.barFill;
  const cur = getComputedStyle(f).transform;
  f.style.transition = 'none';
  f.style.transform = cur === 'none' ? 'scaleX(1)' : cur;
}

/** 광고 때문에/유저가 앱을 벗어나면 카운트다운을 멈춘다 — 「보고 왔더니 제안이 사라짐」 방지. */
function onVisibility(): void {
  if (!open) return;
  if (document.hidden) {
    if (!busy) stopCountdown();
    return;
  }
  if (!busy && deadline) startCountdown(Math.max(2000, deadline - Date.now()));
}

function setBusy(on: boolean): void {
  if (!ui) return;
  busy = on;
  ui.go.disabled = on;
  ui.spin.hidden = !on;
  ui.goLabel.textContent = on ? MSG[uiLang()].ctaLoading : MSG[uiLang()].cta;
  ui.no.disabled = on;
  ui.no.style.opacity = on ? '.4' : '';
}

function hide(): void {
  open = false;
  busy = false;
  deadline = 0;
  clearTimer();
  if (!ui) return;
  ui.root.classList.remove('on');
  const el = ui.root;
  setTimeout(() => {
    if (!open) el.hidden = true;
  }, 200);
}

/**
 * ★게임 재개는 «광고가 화면에서 사라진 뒤»에 한다.
 *   userEarnedReward 는 보통 광고가 «아직 떠 있는 동안» 온다(dismissed 보다 먼저).
 *   그 시점에 곧장 재개하면 유저는 광고를 보고 있는데 게임은 뒤에서 이미 흐른다 —
 *   광고를 닫았을 땐 또 죽어 있다. 실기기에서만 드러나는 종류의 버그라 여기 못박아 둔다.
 *   ⛔지급 판정(멱등·상한)은 이미 끝났다. 여기서 미루는 건 «재개 시점»뿐이다.
 */
function applyToGame(ok: boolean): void {
  const call = (): void => {
    try {
      if (typeof window.__sumoReviveApply === 'function') window.__sumoReviveApply(ok);
    } catch (e) {
      console.error('[reviveAd] __sumoReviveApply threw:', e);
    }
  };
  // 거절은 결과화면으로 가는 것뿐이라 기다릴 이유가 없다.
  if (!ok) {
    call();
    return;
  }
  let hidden = false;
  try {
    hidden = !!document.hidden;
  } catch {
    hidden = false;
  }
  if (!hidden) {
    setTimeout(call, RESUME_BEAT_MS);
    return;
  }
  let done = false;
  const go = (): void => {
    if (done) return;
    done = true;
    try {
      document.removeEventListener('visibilitychange', onVis);
    } catch {
      /* noop */
    }
    clearTimeout(cap);
    setTimeout(call, RESUME_BEAT_MS);
  };
  const onVis = (): void => {
    if (!document.hidden) go();
  };
  const cap = setTimeout(go, RESUME_HIDDEN_CAP_MS);
  try {
    document.addEventListener('visibilitychange', onVis);
  } catch {
    go();
  }
}

/** 단 하나의 출구. game.js 로 판정을 되돌리고 오버레이를 닫는다. */
function finish(ok: boolean, reason: string): void {
  if (!open) return;
  const info = curInfo;
  curInfo = null;
  hide();
  if (ok) bumpGrantsToday();
  track(ok ? 'revive_grant' : 'revive_decline', {
    reason,
    platform: platformTag(),
    stage: info ? info.stage : -1,
    my_wins: info ? info.myWins : -1,
    attempts,
  });
  applyToGame(ok);
}

/** 규격 6 — 실패는 오버레이를 «닫지 않고» 그 자리에 사유를 띄운다(프리즈 화면에서 토스트는 놓친다). */
function showFailure(reason: string | undefined): void {
  if (!ui) return;
  const m = MSG[uiLang()];
  const r = reason || '';
  const loadish = r === 'load_timeout' || r === 'load_fail' || r === 'onError' || r === 'failedToShow' || r === 'unsupported';
  ui.body.textContent = loadish ? m.failLoad : m.failWatch;
  ui.body.classList.add('err');
  if (attempts >= ATTEMPTS_PER_MATCH) {
    ui.go.hidden = true;
    ui.no.textContent = m.no;
    startCountdown(4000);
    return;
  }
  ui.goLabel.textContent = m.retry;
  startCountdown(OFFER_TIMEOUT_MS);
}

async function onAccept(): Promise<void> {
  if (!open || busy || !ui) return;
  attempts++;
  stopCountdown();
  setBusy(true);
  ui.body.classList.remove('err');
  track('revive_accept', { platform: platformTag(), attempt: attempts, stage: curInfo ? curInfo.stage : -1 });

  const state = { done: false };
  const grant = (how: string): void => {
    if (state.done) return;
    state.done = true;
    finish(true, how);
  };

  try {
    const res = await loadAndShow({
      surface: 'revive',
      allowInferred: true, // 부활권은 실돈이 아니다 — 헤드 주석 「규격 4」 참고
      onLateReward: () => grant('late'),
    });
    if (res.ok) {
      grant(res.inferred ? 'inferred' : 'reward');
      return;
    }
    track('ad_request_fail', { kind: 'rewarded', surface: 'revive', reason: res.reason || 'unknown', platform: platformTag() });
    if (state.done) return;
    setBusy(false);
    showFailure(res.reason);
  } catch (e) {
    console.error('[reviveAd] loadAndShow threw:', e);
    if (state.done) return;
    setBusy(false);
    showFailure('onError');
  }
}

/* ─────────────────────── game.js 진입점 ─────────────────────── */

/**
 * game.js 가 패배 확정 «직전»에 부른다(finishMatch 전).
 * true 를 돌려주면 game.js 는 결과화면을 보류하고 __sumoReviveApply 를 기다린다.
 * ⛔절대 throw 하지 않는다 — 던지면 게임이 게임오버 상태로 얼어붙는다.
 */
function offer(info: ReviveInfo): boolean {
  try {
    if (open) return false;
    if (!adsUsable()) return false; // 토스 밖·미지원이면 제안 자체를 안 한다
    // President 문장 해석 (a) — 「상대방을 이긴 횟수가 남아있어야 함」.
    if (REQUIRE_OWN_WIN && !(info.myWins > 0)) {
      track('revive_skip', { reason: 'no_own_win', stage: info.stage, platform: platformTag() });
      return false;
    }
    if (grantsToday() >= DAILY_GRANT_CAP) {
      track('revive_capped', { platform: platformTag(), cap: DAILY_GRANT_CAP });
      return false;
    }
    const u = buildUi();
    if (!u) return false;

    const m = MSG[uiLang()];
    curInfo = info;
    attempts = 0;
    open = true;
    u.kick.textContent = m.kicker;
    u.title.textContent = m.title;
    u.body.textContent = m.body;
    u.body.classList.remove('err');
    u.a.textContent = String(info.stage);
    u.aL.textContent = m.labStage;
    u.b.textContent = info.myWins + ' / ' + info.needed;
    u.bL.textContent = m.labWins;
    u.go.hidden = false;
    u.goLabel.textContent = m.cta;
    u.no.textContent = m.no;
    u.note.textContent = m.note;
    u.root.setAttribute('aria-label', m.aria);
    setBusy(false);

    u.root.hidden = false;
    // 다음 프레임에 .on — hidden 해제와 같은 프레임이면 트랜지션이 안 걸린다.
    requestAnimationFrame(() => {
      if (open) u.root.classList.add('on');
    });
    startCountdown(OFFER_TIMEOUT_MS);
    try {
      u.go.focus({ preventScroll: true });
    } catch {
      /* 포커스 실패는 무해 */
    }
    track('revive_offer', { platform: platformTag(), stage: info.stage, my_wins: info.myWins, their_wins: info.theirWins });
    return true;
  } catch (e) {
    console.error('[reviveAd] offer failed (게임은 그대로 결과화면으로 간다):', e);
    open = false;
    curInfo = null;
    return false;
  }
}

export function installReviveAd(): void {
  window.__sumoReviveOffer = offer;
  try {
    document.addEventListener('visibilitychange', onVisibility);
  } catch {
    /* noop */
  }
}

installReviveAd();
