/**
 * 프로모션 리워드 ② — 스모 바운스 「5판 플레이하기」 50원 고정. 2026-09-01 신설
 *
 * ══ 사양(President 확정 2026-09-01) ═══════════════════════════════════════
 *   조건: 이 빌드가 «깔린 시점 이후»에 «끝난» 매치가 5판이 되는 순간 1회 지급.
 *   ★★★ 「이미 달성한 사람 지급 외」 — 과거 누적 판수를 «절대» 인정하지 않는다.
 *
 * ══ 「이미 달성한 사람」을 어떻게 배제하는가 — 이 파일의 핵심 ════════════════
 *   기존 저장값을 «읽지 않는다». 새 카운터를 «새 키»로 0 부터 시작시킨다:
 *
 *        sumo:promo.plays.v1:<promotionCode>     ← 이 프로모션 코드 «전용» 키
 *
 *   ⛔ 절대 참조 금지 목록(전부 「과거 누적」이 들어 있다):
 *        · `sumoSave`.cleared / .byDiff / .champion  (게임 진행도 — 재설치 전 기록 포함)
 *        · `sumo:ads.v2`.plays                       (전면광고 카운터 — 08-14 부터 누적 중)
 *        · `sumobounce.ads.v1`                       (v1 레거시 카운터)
 *      이 중 «하나라도» 초기값으로 끌어 쓰면 기존 유저 전원이 즉시 5 를 넘겨
 *      예산 4,000원(80건)이 한 번에 날아간다. 그래서 이 파일은 그 키들을
 *      import 도 grep 도 하지 않는다(scripts/check_promo_hooks.mjs 가 «정적으로» 검사한다).
 *
 *   키가 코드별이므로 프로모션 코드가 바뀌면 카운터도 «다시 0» 이다 — 새 프로모션은
 *   새 미션이라는 뜻이고, 08-29 3앱 결함(단일 키 → 코드 교체 시 영구 차단)의 반대편 이득이다.
 *
 * ══ 「1판」의 정의 ═════════════════════════════════════════════════════════
 *   ★ «끝난» 매치 1건 = `finishMatch(winner)` 가 불린 횟수.
 *     - 승패 무관, 모드 무관(아케이드/2P 공통 — 같은 함수를 탄다).
 *     - ⛔ «시작»으로 세지 않는다. 시작으로 세면 시작→즉시 이탈을 5번 반복해
 *       10초 만에 50원을 뽑을 수 있다(중도 이탈 악용).
 *     - 일시정지 → 「그만두기/다시하기」로 빠져나간 매치는 finishMatch 를 타지 «않으므로»
 *       세지 않는다. 이게 의도한 동작이다.
 *     - 한 매치는 물리적으로 10초 이상이다(readyTimer 1.7s + shrinkDuration 13~30s +
 *       roundOverTimer 2.1s × 최소 2라운드 — interstitialAd.ts 실측 주석 참조).
 *       ⇒ 5판 = 최소 1분 이상. 연타 어뷰징이 «구조적으로» 불가능하다.
 *   ⛔ 라운드로 세지 않는다(한 매치가 2~5라운드 → 2~5배 중복).
 *
 * ══ 지급 1회 보장 ═════════════════════════════════════════════════════════
 *   promoCore 의 방어 4중(코드별 기록·in-flight 락·세션 락·토스 4113 복원)을 그대로 쓴다.
 *   카운터 갱신은 «직렬 큐»(chain)로 돌린다 — 저장 왕복이 비동기라 두 번 겹치면
 *   read-modify-write 가 유실될 수 있다(매치 간격상 실현 가능성은 낮지만 구조로 막는다).
 *
 * ⛔ 이 파일은 «절대 throw 하지 않는다». 결과 화면을 막으면 안 된다.
 * ⛔ `sumoSave` 무접촉 · SAVE_VERSION 인상 없음 · 광고 카운터 무접촉.
 */
import { storage } from './storage';
import { safeBridge, isInToss } from './env';
import { grantPromotionReward, grantPromotionRewardForGame, type GrantPromotionResult } from './bridge';
import { createPromoClaimer, type PromoOutcome, type PromoRecord } from './promoCore';

/** 지급 기록 키 접두 — promotion.ts(다이묘진)와 «같은» 접두를 쓴다. 코드가 다르므로 키가 겹치지 않는다. */
const RECORD_KEY_PREFIX = 'sumo:promo.v1:';
/** ★판수 카운터 키 접두 — «이 프로모션 전용». 기존 어떤 키와도 겹치지 않는 새 이름이다. */
const COUNTER_KEY_PREFIX = 'sumo:promo.plays.v1:';

export function recordKeyFor(code: string): string {
  return RECORD_KEY_PREFIX + code;
}
export function counterKeyFor(code: string): string {
  return COUNTER_KEY_PREFIX + code;
}

/** 지급 브릿지 타임아웃 — 서버 왕복이 있어 기본 3s 보다 넉넉히 둔다(promotion.ts 와 동일). */
const GRANT_TIMEOUT_MS = 8000;

/** 목표 판수의 «하드 하한». DOM 값이 비었거나 깨졌을 때만 쓴다. */
const DEFAULT_TARGET = 5;

export interface PlaysCounter {
  v: number;
  /** 이 빌드(이 코드) 기준으로 «끝난» 매치 수. 항상 0 에서 시작한다. */
  n: number;
  /** 카운터가 처음 생긴 시각(= 이 기기의 기준 시점). 증거·디버그용, 판정에는 안 쓴다. */
  since: number;
}

function readConfig(): { code: string; amount: number; target: number } {
  try {
    const b = document.body;
    const code = (b?.getAttribute('data-promo-plays-code') || '').trim();
    const amount = Number.parseInt(b?.getAttribute('data-promo-plays-amount') || '', 10);
    const target = Number.parseInt(b?.getAttribute('data-promo-plays-target') || '', 10);
    return {
      code,
      amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      target: Number.isFinite(target) && target > 0 ? target : DEFAULT_TARGET,
    };
  } catch {
    return { code: '', amount: 0, target: DEFAULT_TARGET };
  }
}

async function loadRecord(code: string): Promise<PromoRecord> {
  try {
    const raw = await storage.getItem(recordKeyFor(code));
    if (!raw) return {};
    const o = JSON.parse(raw) as PromoRecord;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

async function saveRecord(code: string, rec: PromoRecord): Promise<void> {
  await storage.setItem(recordKeyFor(code), JSON.stringify(rec));
}

/**
 * ★ 카운터 읽기. 값이 «없으면 0» 이다 — 다른 어떤 저장값도 초기값으로 끌어오지 않는다.
 *   깨진 값도 0 으로 본다(과거 값을 추측해 채우지 않는다).
 */
export async function loadCounter(code: string): Promise<PlaysCounter> {
  const empty: PlaysCounter = { v: 1, n: 0, since: 0 };
  try {
    const raw = await storage.getItem(counterKeyFor(code));
    if (!raw) return empty;
    const o = JSON.parse(raw) as Partial<PlaysCounter>;
    if (!o || typeof o !== 'object') return empty;
    const n = typeof o.n === 'number' && Number.isFinite(o.n) ? Math.max(0, Math.floor(o.n)) : 0;
    const since = typeof o.since === 'number' && Number.isFinite(o.since) ? o.since : 0;
    return { v: 1, n, since };
  } catch {
    return empty;
  }
}

async function saveCounter(code: string, c: PlaysCounter): Promise<void> {
  await storage.setItem(counterKeyFor(code), JSON.stringify(c));
}

const claimer = createPromoClaimer({
  inToss: isInToss,
  readConfig: () => {
    const { code, amount } = readConfig();
    return { code, amount };
  },
  loadRecord,
  saveRecord,
  callBridge: (method, params) =>
    safeBridge<GrantPromotionResult>(
      method,
      () => (method === 'grantPromotionReward' ? grantPromotionReward({ params }) : grantPromotionRewardForGame({ params })),
      undefined,
      GRANT_TIMEOUT_MS
    ),
  now: () => Date.now(),
});

/** 5판째 도달 시 지급. 절대 throw 하지 않는다. */
export function claimPlaysReward(): Promise<PromoOutcome> {
  return claimer.claim();
}

export function playsAlreadyRewarded(): Promise<boolean> {
  return claimer.alreadyRewarded();
}

/* ── 직렬 큐 — read-modify-write 유실 방지 ────────────────────────────────── */
let chain: Promise<unknown> = Promise.resolve();

export type MatchEndOutcome =
  | { counted: false; reason: 'unconfigured' | 'already' | 'error'; n: number }
  | { counted: true; n: number; target: number; outcome: PromoOutcome | null };

/**
 * 매치 «종료» 1건을 센다. 목표에 도달하면 지급까지 이어서 한다.
 * 게임 쪽에서는 fire-and-forget 으로 부른다(결과 화면을 절대 막지 않는다).
 */
export function noteMatchEnd(): Promise<MatchEndOutcome> {
  const next = chain.then(async (): Promise<MatchEndOutcome> => {
    const { code, target } = readConfig();
    if (!code) {
      console.warn('[promo/plays] 프로모션 코드 미설정 — index.html 의 data-promo-plays-code 확인');
      return { counted: false, reason: 'unconfigured', n: 0 };
    }
    // 이미 받았으면 더 셀 이유가 없다(쓰기도 안 한다).
    const rec = await loadRecord(code);
    if (rec.grantedAt && rec.code === code) return { counted: false, reason: 'already', n: target };

    const cur = await loadCounter(code);
    const now = Date.now();
    const nextCounter: PlaysCounter = {
      v: 1,
      n: cur.n + 1,
      since: cur.since > 0 ? cur.since : now,
    };
    try {
      await saveCounter(code, nextCounter);
    } catch (e) {
      // 저장이 실패해도 계속 간다 — 다음 판에서 같은 n 을 다시 쓴다(지급이 늦어질 뿐 중복은 없다).
      console.error(`[promo/plays] 카운터 저장 실패: ${String(e)}`);
    }
    console.log(`[promo/plays] 판 종료 ${nextCounter.n}/${target}`);
    if (nextCounter.n < target) return { counted: true, n: nextCounter.n, target, outcome: null };

    const outcome = await claimPlaysReward();
    console.log(`[promo/plays] 지급 결과 = ${outcome}`);
    return { counted: true, n: nextCounter.n, target, outcome };
  });
  // 큐가 예외로 끊기지 않게 한다.
  chain = next.catch(() => undefined);
  return next.catch((e) => {
    console.error(`[promo/plays] 예상 밖 예외 — 게임은 계속: ${String(e)}`);
    return { counted: false, reason: 'error', n: 0 } as MatchEndOutcome;
  });
}

/**
 * 게임(public/game/sumo-bounce-game.js)이 부를 수 있도록 전역에 건다.
 * sdk-boot 가 injectGameScript() «전에» 설치한다(다이묘진 훅과 같은 자리).
 *
 * 게임 쪽 호출부: finishMatch() 끝에서 window.__sumoPromoMatchEnd() — fire-and-forget.
 */
export function installPlaysPromoHook(): void {
  try {
    (window as unknown as Record<string, unknown>).__sumoPromoMatchEnd = (): void => {
      void noteMatchEnd();
    };
  } catch {
    /* 전역 설치 실패해도 게임은 그대로 돈다 */
  }
}
