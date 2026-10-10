/**
 * 웹 전용 계측(⑤) 대체 shim — 스모 바운스.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────────────
 * 실제 `src/analytics.ts` 는 `eventLog` 를 `@apps-in-toss/web-framework` 에서
 * import 한다. 이 배럴은 트리셰이킹이 안 되어 광고 SDK 까지 통째로 딸려
 * 온다(analytics.ts 자체 주석에도 "eventLog 는 web-bridge 재수출" 명시).
 * `src/analytics.ts` 는 `arenaBanner.ts`·`startBanner.ts`·`analyticsBoot.ts`·
 * (real) `toss/interstitialAd.ts` 등 «여러 파일»이 직접 import 한다 — barrel
 * 하나로 안 끝나는 이유. 그래서 `./analytics` 로 해석되는 import 자체를
 * vite.config.ts 의 플러그인이 이 파일로 돌린다.
 *
 * ── 웹판 동작 ────────────────────────────────────────────────────────────────
 * "데이터 수집 없음·네트워크 요청 없음" 신고와 실제가 일치해야 한다(MS
 * Store 신고 내용). 그래서 네이티브 브릿지를 아예 참조하지 않고 콘솔에만
 * 남긴다 — 전송은 절대 하지 않는다. (땅따먹기 src/toss-web/index.ts 의
 * eventLog shim 과 동일 원칙.)
 *
 * ★함수 이름은 의도적으로 `eventLog` 를 쓰지 않는다 — 출고물 정적 검사가
 *   토스판/웹판을 문자열 `eventLog` 검출로 대조하기 때문에, 웹판 소스에
 *   그 리터럴을 아예 안 남기는 쪽이 더 확실한 증거가 된다.
 *
 *   vite build              → 이 shim   (웹 / 스토어) — eventLog 0건
 *   vite build --mode toss  → 진짜 계측 (`ait build` 가 이 모드로 부른다)
 */
import type { track as RealTrack, LogType as RealLogType, Primitive as RealPrimitive, SumoEventName as RealSumoEventName, SumoEventProps as RealSumoEventProps } from '../analytics';

export type LogType = RealLogType;
export type Primitive = RealPrimitive;
export type SumoEventName = RealSumoEventName;
export type SumoEventProps = RealSumoEventProps;

export const track: typeof RealTrack = (name, props = {}) => {
  try {
    console.log('[web-shim][track]', name, props);
  } catch {
    /* 계측 자체가 게임을 막으면 안 된다 */
  }
};
