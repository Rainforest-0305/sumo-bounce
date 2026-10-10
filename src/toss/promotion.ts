/**
 * 프로모션 리워드(토스 포인트) 지급 — 스모 바운스 「다이묘진 해금하기」 30원. 2026-08-29 신설
 *
 * 조건(President 확정 2026-08-29): 아케이드에서 다이묘진(CHARS unlock:8)을 «해금하는 순간» 1회.
 *   ★훅은 «해금 순간» 하나뿐이다. 부팅 시 기존 챔피언 소급 지급은 «넣지 않는다»
 *     (President: 「이미 얻은 사람한테 괜히 예산 소진되지 않게 해」).
 *   ★「해금」은 «진행 완료»다 — 토스 심사 금지항목(결과·등수 기준 지급)에 걸리지 않는다.
 *
 * ── 저장 규율 ────────────────────────────────────────────────────────────────
 *   ⛔ 게임 세이브 키 `sumoSave` 무접촉. SAVE_VERSION 인상 ⛔. 새 키를 «추가»만 한다:
 *      `sumo:promo.v1:<promotionCode>`  — ★코드별 키(단일 키 ⛔, 08-29 3앱 결함).
 *   storage.ts 를 통해 토스 네이티브 Storage + localStorage 양쪽에 쓴다(광고 카운터와 같은 경로).
 *
 * ── 코드를 «상수로 두지 않는» 이유 ────────────────────────────────────────────
 *   상수로 두면 번들러 상수접기로 호출 블록이 삭제될 수 있다(08-11 광고 실사고). 네온·머니 리그와
 *   같이 index.html <body data-promo-daimyojin-code/-amount> 에 두고 여기서 «읽기만» 한다.
 *   TESTONLY 빌드는 scripts/promo_testonly_patch.mjs 가 그 속성만 TEST_ 접두로 바꾼다.
 *
 * ⛔ 이 파일은 «절대 throw 하지 않는다». 웹(file://)에서는 브릿지가 없으니 조용히 생략한다.
 */
import { storage } from './storage';
import { safeBridge, isInToss } from './env';
import { grantPromotionReward, grantPromotionRewardForGame, type GrantPromotionResult } from './bridge';
import { createPromoClaimer, type PromoOutcome, type PromoRecord } from './promoCore';

export type { PromoOutcome } from './promoCore';

/** 게임(public/game/sumo-bounce-game.js)이 전역 훅에 넘기는 캐릭터 id. */
export const PROMO_CHAR_ID = 'daimyojin';

/** ★코드별 키. 접두는 storage.ts NS('sumo:') 관례를 따른다. */
const RECORD_KEY_PREFIX = 'sumo:promo.v1:';
export function recordKeyFor(code: string): string {
  return RECORD_KEY_PREFIX + code;
}

/** 지급 브릿지 타임아웃 — 서버 왕복이 있어 기본 3s 보다 넉넉히 둔다. */
const GRANT_TIMEOUT_MS = 8000;

function readConfig(): { code: string; amount: number } {
  try {
    const b = document.body;
    const code = (b?.getAttribute('data-promo-daimyojin-code') || '').trim();
    const amount = Number.parseInt(b?.getAttribute('data-promo-daimyojin-amount') || '', 10);
    return { code, amount: Number.isFinite(amount) && amount > 0 ? amount : 0 };
  } catch {
    return { code: '', amount: 0 };
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

const claimer = createPromoClaimer({
  inToss: isInToss,
  readConfig,
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

/** 다이묘진 해금 순간 호출. 절대 throw 하지 않는다. */
export function claimDaimyojinReward(): Promise<PromoOutcome> {
  return claimer.claim();
}

export function alreadyRewarded(): Promise<boolean> {
  return claimer.alreadyRewarded();
}

/**
 * 원본 게임이 부를 수 있도록 전역에 건다 — 게임 스크립트는 public/ 정적 파일이라 모듈 그래프 밖이다
 * (window.__nativeStorageMirror 와 같은 선례). sdk-boot 가 injectGameScript() «전에» 설치한다.
 *
 * 게임 쪽 호출부: finishMatch() 에서 SAVE.cleared 가 PROMO_DAIMYOJIN_STAGE 문턱을 «처음 넘는 순간»
 * persist() 뒤에 window.__sumoPromoUnlock('daimyojin') — fire-and-forget.
 */
export function installPromoHook(): void {
  try {
    (window as unknown as Record<string, unknown>).__sumoPromoUnlock = (charId: unknown): void => {
      if (charId !== PROMO_CHAR_ID) return;
      void claimDaimyojinReward().catch(() => {
        /* 코어가 이미 삼키지만, 만약을 위해 한 번 더 */
      });
    };
  } catch {
    /* 전역 설치 실패해도 게임은 그대로 돈다 */
  }
}
