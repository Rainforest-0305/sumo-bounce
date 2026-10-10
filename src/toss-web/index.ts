/**
 * 웹 전용 Toss SDK 대체 shim (브라우저 / Microsoft Store / Capacitor APK 용) — 스모 바운스.
 *
 * ── 왜 존재하는가 ───────────────────────────────────────────────────────────
 * `src/exitConfirmUi.ts`·`src/sdk-boot.ts` 는 `src/toss/index.ts` 배럴을 import
 * 한다. 이 배럴이 끌어오는 `src/toss/navigationBar.ts`·`safeArea.ts` 가
 * `@apps-in-toss/web-framework` 를 직접 import 하는데, 이 배럴은 트리셰이킹이
 * 되지 않아 **토스 SDK(광고 포함)가 통째로 웹 번들에 딸려 들어간다**. 게임은
 * 이 서브트리를 웹/스토어 빌드에서 한 줄도 필요로 하지 않는다.
 *
 * ── 어떻게 갈아끼우는가 ─────────────────────────────────────────────────────
 * vite.config.ts 의 `sumo-toss-web-shim` 플러그인이 `src/toss/index.ts` 로
 * 해석되는 import 를 이 파일로 되돌린다. 배럴만 갈아끼우면 `src/toss/**`
 * 서브트리 전체(bridge.ts·env.ts·identity.ts·navigationBar.ts·safeArea.ts·
 * storage.ts)가 모듈 그래프에서 빠진다 — 배럴 말고 이 서브트리를 직접
 * import 하는 곳이 없음을 확인했다(exitConfirmUi.ts·sdk-boot.ts 전부 배럴
 * 경유). ⚠️예외 1건: `src/toss/interstitialAd.ts` 는 sdk-boot.ts 가 배럴을
 * 거치지 않고 «직접» import 한다 — 그건 별도로 `src/toss-web/interstitialAd.ts`
 * 가 갈아끼운다(vite.config.ts 참고).
 *
 *   vite build              → 이 shim   (웹 / 스토어)
 *   vite build --mode toss  → 진짜 SDK  (`ait build` 가 이 모드로 부른다)
 *
 * ★ 미니앱 빌드는 절대 이 파일을 타지 않는다. 토스 심사 필수 SDK 4종은
 *   `src/toss/**` 원본 그대로 살아 있다.
 *
 * ── 타입 드리프트 방지 ──────────────────────────────────────────────────────
 * 아래 모든 export 는 진짜 모듈의 타입(`typeof RealToss.*`)을 직접 붙여서
 * 선언한다. 원본 시그니처가 바뀌면 이 파일이 **컴파일 에러**로 터진다.
 * `import type` 이라 런타임에는 완전히 제거되며 프레임워크가 딸려오지 않는다
 * (vite.config.ts 의 self-reference 가드가 이 타입 참조를 real 파일로 그대로
 * 흘려보낸다 — 어차피 esbuild 가 타입 전용 import 를 통째로 지운다).
 *
 * 출처: 트랙 D(땅따먹기/territory-clash) src/toss-web/index.ts 를 그대로
 * 이식(venture-cto 지시 — 검증된 패턴 재사용). 이 프로젝트의 barrel export
 * 목록(GAME_STORAGE_KEYS/primeGameStorage/mirrorGameWrite 포함, eventLog·
 * haptic·ageGate·fetchServerTime 없음)에 맞춰 export 목록만 다시 짰다.
 */
import type * as RealToss from '../toss';

// ── 환경 판별 ────────────────────────────────────────────────────────────────
/** 웹 빌드에서는 정의상 토스 밖이다. */
export const isInToss: typeof RealToss.isInToss = () => false;

// ── ③ Storage (localStorage 백엔드) ─────────────────────────────────────────
const NS = 'sumo:'; // src/toss/storage.ts 와 반드시 동일해야 한다(저장 데이터 호환).

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — 무시 */
  }
}

export const storage: typeof RealToss.storage = {
  async getItem(key: string): Promise<string | null> {
    return localGet(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    localSet(key, value);
  },
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

/** 저장 키 정본. src/toss/storage.ts 의 KEYS 와 값이 다르면 컴파일 에러가 난다. */
export const KEYS: typeof RealToss.KEYS = {
  sdkSelfTest: `${NS}sdkSelfTest`,
  gameMirrorPrefix: `${NS}game.mirror.`,
  adCounter: `${NS}ads.v2`,
} as const;

/** 원본 게임이 실제로 쓰는 localStorage 키 3개. src/toss/storage.ts 와 동일해야 한다. */
export const GAME_STORAGE_KEYS: typeof RealToss.GAME_STORAGE_KEYS = ['sumoSave', 'sumoMuted', 'sumoLang'] as const;

/**
 * 웹에는 「네이티브 미러」가 없다 — 미러할 대상 자체가 없으므로 no-op.
 * 원본(src/toss/storage.ts)의 목적은 "네이티브 Storage 로 미러링"인데, 웹
 * 빌드에는 네이티브가 없다. localStorage 는 이미 게임 자체(lsSet)가 직접
 * 쓰고 있으므로 여기서 다시 쓸 이유가 없다(이중 쓰기 방지).
 */
export const mirrorGameWrite: typeof RealToss.mirrorGameWrite = () => {};

/**
 * 웹에는 프라이밍할 네이티브 소스가 없다 — no-op(즉시 resolve).
 * 원본은 "네이티브에 있고 localStorage 에 없는 키를 역주입"하는데, 웹에는
 * 네이티브가 없으므로 항상 아무 일도 하지 않는 게 원본과 동치 동작이다.
 */
export const primeGameStorage: typeof RealToss.primeGameStorage = async () => {};

// ── ④ 뒤로가기 스택 ─────────────────────────────────────────────────────────
type BackHandler = Parameters<typeof RealToss.pushBackHandler>[0];

const backHandlers: BackHandler[] = [];

export const pushBackHandler: typeof RealToss.pushBackHandler = (handler) => {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.indexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
};

/** 원본 navigationBar.ts 의 "토스 밖" 분기와 동일하게 popstate 를 뒤로가기로 잇는다. */
function handleBack(): void {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    try {
      if (backHandlers[i]!() === true) return;
    } catch (err) {
      console.warn('[web-shim][nav] back handler threw:', err);
    }
  }
  // 아무도 소비하지 않았다. 웹에서는 닫을 창이 없으므로 아무 일도 하지 않는다.
}

/** 웹에는 닫을 미니앱이 없다 — 원본도 토스 밖에서는 closeView 브릿지가 no-op 폴백을 탄다. */
export const exitMiniApp: typeof RealToss.exitMiniApp = async () => {};

/* ★프로모션(토스 포인트) — 웹 번들에는 지급 개념이 없다. installPromoHook 은 no-op 이라
 *   전역 __sumoPromoUnlock 이 «설치되지 않고», 게임 쪽 호출부는 typeof 검사로 조용히 지나간다.
 *   웹 번들에는 grantPromotionReward·프로모션 코드가 «0건이어야 정상»이다(check-ad-leak 과 같은 규율). */
export const installPromoHook: typeof RealToss.installPromoHook = () => {};
/* 프로모션 ②(5판 플레이하기) — 웹판도 동일하게 no-op. 전역 __sumoPromoMatchEnd 를 «설치하지 않는다». */
export const installPlaysPromoHook: typeof RealToss.installPlaysPromoHook = () => {};
export const claimPlaysReward: typeof RealToss.claimPlaysReward = async () => 'unsupported';
export const playsAlreadyRewarded: typeof RealToss.playsAlreadyRewarded = async () => false;
export const noteMatchEnd: typeof RealToss.noteMatchEnd = async () => ({ counted: false, reason: 'unconfigured', n: 0 });
export const counterKeyFor: typeof RealToss.counterKeyFor = (code) => NS + 'promo.plays.v1:' + code;
export const loadCounter: typeof RealToss.loadCounter = async () => ({ v: 1, n: 0, since: 0 });
export const claimDaimyojinReward: typeof RealToss.claimDaimyojinReward = async () => 'unsupported';
export const alreadyRewarded: typeof RealToss.alreadyRewarded = async () => false;
export const PROMO_CHAR_ID: typeof RealToss.PROMO_CHAR_ID = 'daimyojin';

/**
 * 외부 URL 열기(개인정보처리방침 링크) — 2026-08-22 Partner 지시.
 * 웹판은 토스 브릿지 자체가 없다 — 원본과 동일하게 `window.open` 폴백만
 * 탄다(원본의 isInToss() 분기가 웹에서는 항상 false 이므로 동치 동작).
 * ⛔토스 SDK 관련 import 를 여기서 «하지 않는다» — 이 shim 의 존재 이유가
 * 그 import 경로 자체를 끊는 것이다.
 */
export const openExternalUrl: typeof RealToss.openExternalUrl = async (url) => {
  try {
    window.open(url, '_blank', 'noopener');
  } catch (err) {
    console.warn('[web-shim][openExternalUrl] window.open failed:', err);
  }
};

// ── 식별키 (로컬 익명 ID) ────────────────────────────────────────────────────
const LOCAL_ID_KEY = 'sumo:localAnonId'; // src/toss/identity.ts 와 동일해야 한다.

let cached: RealToss.Identity | null = null;

function makeLocalId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `local-${c.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveLocalIdentity(): Promise<RealToss.Identity> {
  const existing = await storage.getItem(LOCAL_ID_KEY);
  if (existing) return { userKey: existing, source: 'local', channel: 'local', invalidCategory: false };
  const fresh = makeLocalId();
  await storage.setItem(LOCAL_ID_KEY, fresh);
  return { userKey: fresh, source: 'local', channel: 'local', invalidCategory: false };
}

export const currentIdentity: typeof RealToss.currentIdentity = () => cached;

// ── 부트스트랩 ──────────────────────────────────────────────────────────────
export const initTossSdk: typeof RealToss.initTossSdk = async () => {
  console.log('[web-shim] boot (browser build — Toss SDK not bundled)');

  const onPop = () => handleBack();
  window.addEventListener('popstate', onPop);

  cached = await resolveLocalIdentity();

  // 원본과 같은 위치에 저장 왕복 확인을 남긴다.
  const stamp = `${Date.now()}`;
  await storage.setItem(KEYS.sdkSelfTest, stamp);
  const storageOk = (await storage.getItem(KEYS.sdkSelfTest)) === stamp;

  return {
    identity: cached,
    inToss: false,
    selfTest: {
      userKey: 'fallback',
      safeArea: 'fallback',
      storage: storageOk ? 'ok' : 'fallback',
      navigationBar: 'fallback',
    },
    dispose: () => {
      window.removeEventListener('popstate', onPop);
    },
  };
};

// ── 타입 재수출 (런타임 코드 없음) ──────────────────────────────────────────
export type { TossRuntime, SdkSelfTest, Identity, PromoOutcome } from '../toss';
