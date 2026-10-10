/**
 * 스모 바운스 — 부팅 엔트리 (index.html 이 로드하는 유일한 모듈 스크립트)
 *
 * 이 파일이 하는 일:
 *   1. src/toss (게임 필수 SDK 4종 통합 부트스트랩) 가동 — 사용자 식별키·
 *      Safe Area·네이티브 Storage self-test·내비게이션 바 back/home 배선.
 *      전부 절대 throw 하지 않는다(src/toss/index.ts 참고) — 토스 밖(로컬
 *      dev)에서도 폴백으로 동작한다는 걸 이 세션에서 Playwright 로 실측함.
 *   2. 종료 확인 모달 배선(G3) — src/toss 의 pushBackHandler 위에 얹는다.
 *   3. 원본 게임의 lsGet/lsSet(localStorage) 을 네이티브 Storage 로 미러링
 *      하는 훅 노출 + 프라이밍(await, 게임 스크립트 주입 전에 완료돼야 한다
 *      — src/toss/storage.ts 의 주석 참고).
 *   4. 원본 게임 스크립트(public/game/sumo-bounce-game.js, 원본 index.html
 *      의 <script> 내용을 그대로 옮긴 것 + lsSet 1줄 패치)를 동적으로 주입해
 *      실행한다.
 *
 * ★ 게임 로직 자체는 이 파일에 없다. 원본 게임이 이미 완성돼 있고, 미션
 *   지시가 "게임 코드는 그대로 두고 래핑만"이기 때문이다.
 */
import { initTossSdk, primeGameStorage, mirrorGameWrite, GAME_STORAGE_KEYS, installPromoHook, installPlaysPromoHook } from './toss';
import { installExitConfirm } from './exitConfirmUi';
import { installAdGateOnDocument, hydrateAdCounter, adGuards, __advanceGuardClockForTest, __adGuardSnapshot } from './toss/interstitialAd';
// 트랙 K 긴급수정(2026-08-03): 화면 진단패널(mountDiagPanel) import 완전 삭제.
// 실기기에서 좌상단에 노출된 게 President 스크린샷으로 확인돼 검수요청이
// 취소됐다. 파일은 `_disabled_diagnostic/`으로 옮겨 보존, 복구 절차는 그
// 폴더의 README.md 참고.

declare global {
  interface Window {
    /** public/game/sumo-bounce-game.js 의 패치된 lsSet() 이 호출하는 훅. */
    __nativeStorageMirror?: (key: string, value: string) => void;
    /** 검사기 전용 — 전면형 정책 가드 진단(2026-09-10). 게임 로직은 이 값을 쓰지 않는다. */
    __sumoAdGuardSnapshot?: () => unknown;
    /** 검사기 전용 — 세션 나이를 앞으로 민다. 운영 코드는 부르지 않는다. */
    __sumoAdGuardAdvance?: (ms: number) => void;
  }
}

function injectGameScript(): void {
  const script = document.createElement('script');
  script.src = '/game/sumo-bounce-game.js';
  script.onerror = () => {
    console.error('[sdk-boot] failed to load /game/sumo-bounce-game.js');
  };
  document.body.appendChild(script);
}

async function boot(): Promise<void> {
  // 1+2. SDK 4종 부트스트랩 + 종료확인 모달 배선.
  //    initTossSdk() 는 절대 throw 하지 않지만(내부 전부 safeBridge/safeSync),
  //    혹시 모를 예상 밖 예외까지 여기서 한 번 더 막는다 — 이게 실패해도
  //    게임 자체는 반드시 떠야 한다(injectGameScript 는 아래에서 별도로 돈다).
  try {
    const runtime = await initTossSdk();
    console.log('[sdk-boot] toss sdk ready:', runtime.selfTest);
  } catch (e) {
    console.error('[sdk-boot] initTossSdk() threw unexpectedly:', e);
  }
  installExitConfirm();

  // 3. 네이티브 Storage 미러 훅 노출 + 프라이밍.
  //    게임 스크립트가 실행되기 전에 완료돼야 하므로 여기서 await 한다.
  //    primeGameStorage 는 내부적으로 safeBridge(3초 타임아웃)를 쓰므로
  //    네이티브가 응답을 안 줘도 무한 대기하지 않는다.
  window.__nativeStorageMirror = mirrorGameWrite;

  // 3-a. ★DF-3 전면광고 카운터 하이드레이트 — 네이티브 Storage 는 «비동기»라
  //    게이트 설치 «전»에 await 해야 한다. 안 그러면 첫 클릭이 plays=0 기준으로
  //    세어져 «기존 유저의 위상이 리셋»된다.
  //    ★primeGameStorage 와 «병렬»로 돌린다 — 둘 다 safeBridge(3초 타임아웃)라
  //      직렬로 두면 최악 부팅 지연이 3초 → 6초로 «두 배»가 된다(그만큼 게임
  //      주입이 늦어진다). 병렬이면 최악이 3초 그대로다.
  //    hydrateAdCounter() 는 절대 throw 하지 않고, 실패 시
  //    {plays:0, adPending:false} 로 시작한다(내부 try/catch/finally).
  await Promise.all([primeGameStorage(GAME_STORAGE_KEYS), hydrateAdCounter()]);

  // 3-b. 전면광고 게이트 — ★반드시 injectGameScript() «전»이어야 한다.
  //    결과 화면 버튼(btn-res-next·btn-res-menu)과 일시정지 버튼(btn-restart·
  //    btn-quit)은 index.html 에 «정적»으로 있고 게임 스크립트는 아래에서
  //    «주입»된다. 여기서 capture 리스너를 먼저 달아야 앞선다.
  //    ★ 원본 게임 파일은 «한 글자도» 고치지 않는다.
  try {
    installAdGateOnDocument();
  } catch (e) {
    console.error('[sdk-boot] installAdGate failed (게임은 계속 진행):', e);
  }

  /* 검사기 전용 진단 훅 — 전면형 «정책 가드»(세션 60초·10분 간격·하루 3회)를 밖에서 관측한다.
   * ⛔게임 로직은 이 전역을 읽지 않는다. 읽는 쪽은 scripts/verify_banner_headless.py 뿐이다.
   *   가드 자체는 adGuards() 가 판정하고, 이 훅은 «보기»만 한다(판정 경로를 우회하지 않는다). */
  try {
    window.__sumoAdGuardSnapshot = __adGuardSnapshot;
    window.__sumoAdGuardAdvance = __advanceGuardClockForTest;
    void adGuards; // 트리셰이킹 방지 — 위 두 훅과 «같은 모듈 상태»를 보고 있음을 명시한다
  } catch {
    /* 진단 훅이 없어도 게임은 돈다 */
  }

  // 4. 원본 게임 스크립트 실행.
  // 프로모션(다이묘진 해금 30원) 전역 훅 — 게임 스크립트 «전에» 설치해야 finishMatch 가 찾는다.
  // ⛔부팅 시 소급 지급은 없다(President 2026-08-29). 여기서는 훅 «설치»만 하고 지급을 «부르지 않는다».
  try {
    installPromoHook();
  } catch (e) {
    console.error('[sdk-boot] installPromoHook failed (게임은 계속 진행):', e);
  }

  // 프로모션 ②(5판 플레이하기 50원, 2026-09-01) 전역 훅 — 역시 게임 스크립트 «전에».
  // ⛔여기서도 지급을 «부르지 않는다». 카운터는 새 키로 0 에서 시작하므로 기존 유저 소급 0 이다.
  try {
    installPlaysPromoHook();
  } catch (e) {
    console.error('[sdk-boot] installPlaysPromoHook failed (게임은 계속 진행):', e);
  }

  injectGameScript();
}

void boot();
