/**
 * 공개 인덱스에서 export 되지 않는 브릿지들을 직접 만든다.
 *
 * ── 왜 직접 만드는가 (실측 근거) ────────────────────────────────────────────
 * @apps-in-toss/web-framework 는 `export * from '@apps-in-toss/web-bridge'`
 * 뿐인데, web-bridge@2.10.8 의 dist/index.js 최종 export 목록에는
 * **getUserKeyForGame / getAnonymousKey / closeView 가 빠져 있다**
 * (package.json exports 에 서브패스가 없어 deep import 도 막힘). 구현 자체는
 * dist/bridge.js 에 존재한다:
 *   export var getAnonymousKey   = createAsyncBridge("getAnonymousKey");
 *   export var getUserKeyForGame = createAsyncBridge("getUserKeyForGame");
 * [확인 — 이 프로젝트의 node_modules/@apps-in-toss/web-bridge/dist/bridge.js
 *  직접 grep, 2026-08-02] 이 두 줄이 서로 다른 네이티브 메서드명으로 등록돼
 *  있다 — RN 경로(native-modules)처럼 하나가 다른 하나를 호출하는 별칭이
 *  아니다. 그래서 둘 다 필요하다(identity.ts 참고).
 *
 * createAsyncBridge(method) 는 method 문자열을 그대로 네이티브에 postMessage
 * 하는 얇은 래퍼일 뿐이라(bridge-core 실측), SDK 가 공식 export 했든 우리가
 * createAsyncBridge 로 직접 선언했든 런타임 동작은 100% 동일하다. 해킹이
 * 아니라 SDK 가 공식 노출한 확장점이다.
 *
 * ※ import 는 @apps-in-toss/bridge-core 에서 한다.
 *    web-bridge 의 .d.ts 는 createAsyncBridge 를 타입 export 하지 않아서
 *    (런타임 export 목록과 .d.ts export 목록이 어긋나 있다 — 업스트림 불일치)
 *    web-framework 경유로 import 하면 TS 에러가 난다. bridge-core 는 같은
 *    싱글톤 모듈이고 타입도 온전하다.
 *
 * 출처: 트랙 D(땅따먹기/territory-clash) src/toss/bridge.ts 를 그대로 가져옴
 * (venture-cto 지시 — 검증된 패턴 재사용, 재작성 금지).
 */
import { createAsyncBridge } from '@apps-in-toss/bridge-core';

export interface AnonymousKeySuccess {
  type: 'HASH';
  hash: string;
}

/**
 * 게임 필수 SDK ①-a — 사용자 식별키 (레거시 이름)
 *
 * 반환:
 *   { type:'HASH', hash } — 성공
 *   'INVALID_CATEGORY'    — 콘솔에서 앱 카테고리가 '게임'이 아님
 *   'ERROR'               — 알 수 없는 오류
 *   undefined             — 토스 앱 버전이 최소 지원 버전 미만
 *
 * 'INVALID_CATEGORY' 가 뜨면 코드 문제가 아니라 **콘솔 설정 문제**다.
 * granite.config.ts 의 webViewProps.type='game' 과 별개로, 토스 콘솔에서
 * 앱 카테고리를 게임으로 등록해야 이 API 가 열린다.
 */
export const getUserKeyForGame = createAsyncBridge<
  [],
  AnonymousKeySuccess | 'INVALID_CATEGORY' | 'ERROR' | undefined
>('getUserKeyForGame');

/**
 * 게임 필수 SDK ①-b — 사용자 식별키 (신규 이름, 권장)
 *
 * ★★ 웹 경로와 RN 경로에서 동작이 다르다 (실측):
 *   [RN 경로] getUserKeyForGame() 이 getAnonymousKey() 를 부르는 단순 별칭.
 *   [웹 경로] web-bridge@2.10.8 dist/bridge.js — **별칭 관계가 아니다**,
 *     서로 다른 네이티브 메서드 이름으로 나간다.
 *
 * 그래서 웹 경로에서 getAnonymousKey 만 쓰는 것은 위험하다. 네이티브 핸들러
 * 레지스트리에 'getAnonymousKey' 가 없으면 createAsyncBridge 의 Promise 는
 * resolve 도 reject 도 못 받고 **영원히 pending** 이다(브릿지 코어에 타임아웃
 * 없음 — 실측). 부팅 경로에서 await 하면 무한 로딩 = 흰 화면이다.
 *
 * → identity.ts 는 (1) 신규 이름 먼저, (2) safeBridge 3초 타임아웃, (3) 실패 시
 *   레거시 이름으로 폴백 순서로 두 채널을 모두 시도한다.
 *   [확인: 두 브릿지의 메서드명이 다르다는 사실] / [추정: 네이티브가 신규
 *   이름을 아는지 여부 — 실기기 검증 필요]
 */
export const getAnonymousKey = createAsyncBridge<[], AnonymousKeySuccess | 'ERROR' | undefined>(
  'getAnonymousKey'
);

/** 미니앱 종료 (뒤로가기/종료확인 모달에서 사용) */
export const closeView = createAsyncBridge<[], void>('closeView');

/**
 * 햅틱. 이 게임(스모 바운스)은 필수 SDK 범위 밖이라 현재 미사용이지만,
 * territory-clash 원본 패턴을 그대로 유지해 향후 재사용에 대비해 둔다.
 */
export type HapticFeedbackType =
  | 'tickWeak'
  | 'tap'
  | 'tickMedium'
  | 'softMedium'
  | 'basicWeak'
  | 'basicMedium'
  | 'success'
  | 'error'
  | 'wiggle'
  | 'confetti';

export const generateHapticFeedback = createAsyncBridge<[{ type: HapticFeedbackType }], void>(
  'generateHapticFeedback'
);

/** 화면 꺼짐 방지. 필수 SDK 범위 밖이나 원본 패턴 유지(현재 미사용). */
export const setScreenAwakeMode = createAsyncBridge<[{ enabled: boolean }], { enabled: boolean }>(
  'setScreenAwakeMode'
);

/**
 * 외부 URL 열기(개인정보처리방침 링크 등) — 2026-08-22 Partner 지시.
 *
 * ── 실측(이 파일과 동일한 함정) ──────────────────────────────────────────
 * web-bridge@2.10.8 dist/bridge.js 에 `export var openURL =
 * createAsyncBridge("openURL")` 로 실제 존재하지만, web-framework 의
 * 재수출 배럴(dist-web/index.d.ts)에는 노출되지 않는다(getAnonymousKey 와
 * 동일 패턴 — grep 확인). 그래서 여기서 bridge-core 로 직접 선언한다.
 *
 * ⛔ web-bridge/dist/index.js 안에 `openUrlOpener`(src/toss-ad/opener.ts
 * 출처)라는 래퍼가 있는데, 이건 **광고 SDK 내부용**이다(supertoss://web?url=
 * 딥링크로 변환) — 광고 클릭스루 전용 경로라 우리가 쓸 이유가 없다. 순수
 * openURL(원문 그대로 react-native Linking.openURL 를 태움)만 쓴다.
 */
export const openURL = createAsyncBridge<[string], unknown>('openURL');

/* ===========================================================================
   프로모션 리워드(토스 포인트) 지급 브릿지 — 2026-08-29 신설
   ---------------------------------------------------------------------------
   web-bridge@2.10.8 dist/bridge.js 실측(이 프로젝트 node_modules grep):
     grantPromotionReward        = createAsyncBridge("grantPromotionReward")
     grantPromotionRewardForGame = createAsyncBridge("grantPromotionRewardForGame")
   둘 다 dist/index.js 최종 export 에는 빠져 있어(getAnonymousKey 와 같은 사정)
   여기서 createAsyncBridge 로 직접 선언한다.

   파라미터는 «중첩»이다: grantPromotionReward({ params: { promotionCode, amount } })
   반환 4갈래: { key } / { errorCode, message } / 'ERROR' / undefined(구버전 앱)
   ⛔ 네이티브가 응답을 안 주면 «영원히 pending» — 반드시 env.ts 의 safeBridge 로 감싼다.
   (네온스레드·머니 리그 bridge.ts 와 동일 선언 — 검증된 패턴 재사용)
   =========================================================================== */
export interface GrantPromotionSuccess {
  key: string;
}
export interface GrantPromotionFailure {
  errorCode: string;
  message: string;
}
export type GrantPromotionResult = GrantPromotionSuccess | GrantPromotionFailure | 'ERROR' | undefined;

export interface GrantPromotionParams {
  params: { promotionCode: string; amount: number };
}

/** 현행 API. 게임/비게임 공통. */
export const grantPromotionReward = createAsyncBridge<[GrantPromotionParams], GrantPromotionResult>(
  'grantPromotionReward'
);

/** 레거시 API(d.ts `@deprecated`, 게임 전용). 현행이 undefined/'ERROR' 일 때의 폴백으로만 쓴다. */
export const grantPromotionRewardForGame = createAsyncBridge<[GrantPromotionParams], GrantPromotionResult>(
  'grantPromotionRewardForGame'
);
