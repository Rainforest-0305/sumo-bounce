/**
 * 웹 전용 전면광고 게이트 대체 shim — 스모 바운스.
 *
 * ── 왜 별도 파일인가 (barrel shim 과 다른 이유) ──────────────────────────────
 * `src/sdk-boot.ts` 는 `src/toss/interstitialAd.ts` 를 **배럴을 거치지 않고
 * 직접** import 한다(`import { installAdGateOnDocument, hydrateAdCounter }
 * from './toss/interstitialAd'`). 그래서 `src/toss-web/index.ts`(배럴 shim)만
 * 갈아끼워서는 이 파일이 여전히 실제 모듈 그래프에 들어간다.
 *
 * ── 이 파일을 반드시 shim 해야 하는 이유 (barrel 서브트리보다 심각) ─────────
 * 실제 `src/toss/interstitialAd.ts` 에는 **실운영 광고 단위 ID 리터럴**
 * (`ait.v2.live.XXXXXXXXXXXXXXXX`)이 소스 상수로 박혀 있다. TossAds 를
 * npm 패키지 alias 로만 무력화해도 이 문자열 자체는 우리 소스 리터럴이라
 * 번들에 그대로 남는다 — SDK 를 껐는지와 무관하게 «출고물 정적 검사» 기준
 * FAIL 이다. 그래서 이 파일은 통째로 딴 모듈로 갈아끼운다.
 *
 * ── 웹판 동작 ────────────────────────────────────────────────────────────────
 * 전면광고 자체가 개념적으로 없다 — 「판 종료」 버튼을 가로채지 않는다.
 * 원본 버튼 클릭이 그대로 원래 동작(다음 판/메뉴로/재시작/종료)을 수행한다.
 * hydrateAdCounter() 는 프리로드할 것도 카운트할 것도 없으므로 즉시 resolve.
 *
 *   vite build              → 이 shim   (웹 / 스토어) — 가로채기 없음, 광고 ID 0건
 *   vite build --mode toss  → 진짜 게이트 (`ait build` 가 이 모드로 부른다)
 *
 * ── 타입 드리프트 방지 ──────────────────────────────────────────────────────
 * `import type` 이라 런타임에는 완전히 제거된다(AD_GROUP_ID 등 실제 상수도
 * 같이 제거됨 — 타입 전용 참조는 값을 끌고 오지 않는다).
 */
import type { installAdGateOnDocument as RealInstall, hydrateAdCounter as RealHydrate } from '../toss/interstitialAd';

/** 웹판에는 광고 게이트가 없다 — 「판 종료」 버튼은 항상 원래 동작 그대로 실행된다. */
export const installAdGateOnDocument: typeof RealInstall = () => {
  console.log('[web-shim][interstitialAd] no-op (ad gate not bundled in web build)');
};

/** 웹판에는 하이드레이트할 카운터가 없다 — 즉시 resolve. */
export const hydrateAdCounter: typeof RealHydrate = async () => {};
