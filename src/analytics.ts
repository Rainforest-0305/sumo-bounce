/**
 * 스모 바운스 — 계측(⑤) 배선. 2026-08-22 Chief 지시(5개 게임 공통 표준).
 *
 * ═══ 전송 채널 ═══
 *   `eventLog()` — `@apps-in-toss/web-bridge`(`web-framework` 가 재수출)의
 *   1차 채널로 확정. [실측] `web-framework/dist-web/index.d.ts` 는 87바이트
 *   `export *` 2줄뿐이라 소스만 봐서는 「없다」로 보이지만 실제로는 재수출된다
 *   (Chief 가 재수출 배럴을 뚫고 확인·양성대조 통과). 샌드박스(토스 밖)에서는
 *   콘솔 출력만 하고 죽지 않는다 — `isInToss()` 가드 불요, 다만 관례대로
 *   try/catch 는 감싼다.
 *
 * ═══ 이벤트 표준 (5개 게임 공통 — 이름을 바꾸지 않는다) ═══
 *   app_enter / run_start / run_end / stage_enter / stage_exit /
 *   screen_view / ad_request_fail / attendance_claim
 *   자세한 log_type·params 스키마는 아래 타입 정의 참고.
 *
 * ═══ 절대 규칙 ═══
 *   🚨PII 통제 책임이 «우리» 쪽이다. SDK 가 필터링해주지 않는다.
 *     params 엔 «익명 카운터·enum» 만. 실명·전화번호·기기ID·좌표 절대 금지.
 *   ⛔Promise 비동기 — 게임 루프(프레임)에서 직접 호출 금지. «상태 전이»
 *     시점에만 부른다. 매 프레임·매 틱 호출 절대 금지.
 *   ⛔이 파일이 실패해도 게임은 절대 죽으면 안 된다 — 전부 try/catch.
 *
 * ═══ [별도 레인 처리 중] 프라이버시 표기 불일치 ═══
 *   13_게임_개인정보처리방침\\build\\sumobounce_privacy.html(8/3 작성)이
 *   "네트워크 통신 자체가 없는 완전 오프라인 게임"이라고 적혀 있는데 실제로는
 *   광고 SDK 가 붙어 있다(8/11 이후 추가로 추정). 정정은 별도 레인 소관 —
 *   이 계측을 얹으면 실제-표기 격차가 더 벌어진다는 점만 인지하고 진행한다
 *   (Chief 지시: "너는 계측을 예정대로 진행하되 이 사실을 알고 있어라").
 */
import { eventLog } from '@apps-in-toss/web-framework';

const GAME = 'sumo';

export type LogType = 'debug' | 'info' | 'warn' | 'error' | 'event' | 'screen' | 'impression' | 'click' | 'popup';
export type Primitive = string | number | boolean | null | undefined;

export type SumoEventName =
  | 'app_enter'
  | 'run_start'
  | 'run_end'
  | 'stage_enter'
  | 'stage_exit'
  | 'screen_view'
  | 'ad_request_fail'
  | 'attendance_claim';

/** log_name 별 고정 log_type — 표준에서 정한 그대로. */
const LOG_TYPE: Record<SumoEventName, LogType> = {
  app_enter: 'event',
  run_start: 'event',
  run_end: 'event',
  stage_enter: 'event',
  stage_exit: 'event',
  screen_view: 'screen',
  ad_request_fail: 'error',
  attendance_claim: 'event',
};

export interface SumoEventProps {
  [key: string]: Primitive;
}

/**
 * ★2026-08-31 «순수 확장»(부활 리워드 레인). 표준 8종은 한 톨도 안 바뀐다.
 *   - name 타입을 넓혔다: 표준 8종은 그대로 자동완성되고, 레인별 보조 이벤트
 *     (revive_offer·ad_seq 등)도 «캐스팅 없이» 통과한다.
 *   - log_type 은 `|| 'event'` 폴백을 뒀다. 이전엔 맵에 없는 이름이 오면 log_type 이
 *     undefined 로 «조용히» 나가서 콘솔 카탈로그에 안 잡혔다(네온 toss/analytics.ts 는
 *     이미 같은 폴백을 갖고 있다 — 두 게임의 계측 규칙을 맞춘다).
 */
export function track(name: SumoEventName | (string & {}), props: SumoEventProps = {}): void {
  try {
    // eventLog 는 Promise 를 돌려주지만 여기서 await 하지 않는다 — 게임 로직이
    // 계측 응답을 기다릴 이유가 없다(fire-and-forget). 실패도 조용히 삼킨다.
    void eventLog({
      log_name: name,
      log_type: (LOG_TYPE as Record<string, LogType>)[name] || 'event',
      params: Object.assign({ game: GAME }, props),
    }).catch(() => {
      /* 전송 실패는 게임에 영향 없이 삼킨다 */
    });
  } catch {
    /* 계측 자체가 게임을 막으면 안 된다 */
  }
}
