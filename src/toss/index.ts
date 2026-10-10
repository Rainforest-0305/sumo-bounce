/**
 * 앱인토스 SDK 통합 부트스트랩 — 게임 필수 SDK 4종.
 *   ① 사용자 식별키 : identity.ts       (getAnonymousKey → getUserKeyForGame 폴백)
 *   ② Safe Area     : safeArea.ts       (SafeAreaInsets.get / .subscribe)
 *   ③ 네이티브 Storage: storage.ts       (Storage.getItem/setItem/removeItem)
 *   ④ 내비게이션 바 : navigationBar.ts  (graniteEvent back/home + config 선언)
 *
 * ★ 이 함수는 절대 throw 하지 않는다. SDK 하나가 실패해도 게임은 떠야 한다
 *   (토스 밖 = 로컬 dev 에서는 전부 폴백으로 동작 — 이 세션에서 Playwright
 *   헤드리스 크롬으로 실제 확인함, README "로컬 실행/검증" 참고).
 *
 * 원본 게임 전용 로직(원본 lsGet/lsSet 미러 프라이밍, 게임 스크립트 동적
 * 주입, 종료확인 모달)은 여기 안 넣는다 — 이 index.ts 는 트랙 D 의 범용
 * 패턴 그대로이고, 스모 바운스 고유 로직은 src/sdk-boot.ts 에 둔다.
 */
import { resolveIdentity, type Identity } from './identity';
import { initSafeArea } from './safeArea';
import { initNavigationBar } from './navigationBar';
import { storage, KEYS } from './storage';
import { isInToss, safeBridge } from './env';
import { openURL } from './bridge';

export interface TossRuntime {
  identity: Identity;
  inToss: boolean;
  selfTest: SdkSelfTest;
  dispose: () => void;
}

export interface SdkSelfTest {
  userKey: 'ok' | 'fallback' | 'invalid-category';
  safeArea: 'ok' | 'fallback';
  storage: 'ok' | 'fallback';
  navigationBar: 'ok' | 'fallback';
}

export async function initTossSdk(): Promise<TossRuntime> {
  const inToss = isInToss();
  console.log(`[toss-sdk] boot (inToss=${inToss})`);

  // ② Safe Area — 가장 먼저. 레이아웃이 이 값에 의존하므로 첫 페인트 전에 꽂는다.
  const disposeSafeArea = initSafeArea();

  // ④ 내비게이션 바 — 뒤로가기 기본 동작을 즉시 살린다. 종료확인 모달은
  //    sdk-boot.ts 가 pushBackHandler 로 별도 등록한다.
  const disposeNav = initNavigationBar();

  // ① 사용자 식별키
  const identity = await resolveIdentity();

  // ③ 네이티브 Storage 실동작 확인 (write → read → 비교)
  const stamp = `${Date.now()}`;
  await storage.setItem(KEYS.sdkSelfTest, stamp);
  const readBack = await storage.getItem(KEYS.sdkSelfTest);
  const storageOk = readBack === stamp;
  console.log(`[toss-sdk][storage] round-trip ${storageOk ? 'OK' : 'FAILED'} (wrote=${stamp}, read=${readBack})`);

  const selfTest: SdkSelfTest = {
    userKey: identity.invalidCategory ? 'invalid-category' : identity.source === 'toss' ? 'ok' : 'fallback',
    safeArea: inToss ? 'ok' : 'fallback',
    storage: storageOk ? 'ok' : 'fallback',
    navigationBar: inToss ? 'ok' : 'fallback',
  };
  console.log('[toss-sdk] self-test =', selfTest);

  return {
    identity,
    inToss,
    selfTest,
    dispose: () => {
      disposeSafeArea();
      disposeNav();
    },
  };
}

/**
 * 외부 URL 열기(개인정보처리방침 링크) — 2026-08-22 Partner 지시.
 * 토스 안이면 SDK 브릿지(openURL, bridge.ts)를 3초 타임아웃으로 시도하고,
 * 실패하거나 토스 밖이면 `window.open(url, '_blank', 'noopener')` 로
 * 폴백한다. ★절대 throw 하지 않는다 — 이 게이트가 실패해도 게임은 죽으면
 * 안 된다는 이 프로젝트 전체 원칙과 동일하게 맞춘다.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isInToss()) {
    const ok = await safeBridge('openURL', async () => { await openURL(url); return true; }, false);
    if (ok) return;
  }
  try {
    window.open(url, '_blank', 'noopener');
  } catch (err) {
    console.warn('[toss-sdk][openExternalUrl] window.open failed:', err);
  }
}

export { storage, KEYS } from './storage';
export { primeGameStorage, mirrorGameWrite, GAME_STORAGE_KEYS } from './storage';
export { pushBackHandler, exitMiniApp } from './navigationBar';
export { currentIdentity } from './identity';
export { isInToss } from './env';
export { installPromoHook, claimDaimyojinReward, alreadyRewarded, PROMO_CHAR_ID } from './promotion';
export { installPlaysPromoHook, claimPlaysReward, playsAlreadyRewarded, noteMatchEnd, loadCounter, counterKeyFor } from './promoPlays';
export type { Identity } from './identity';
export type { PromoOutcome } from './promotion';
