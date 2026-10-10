/**
 * 스모 바운스 — 계측 부팅 진입점. 2026-08-22 (⑤).
 * arenaBannerBoot.ts / startBannerBoot.ts 와 같은 이유로 «별도 진입점»이다 —
 * sdk-boot.ts(트랙①)에 import 를 얹지 않는다. 로드 순서 의존 없음: 게임
 * 스크립트(public/game/sumo-bounce-game.js)가 window.__sumoTrack 을 호출할
 * 때 아직 이 스크립트가 안 붙어 있으면 game.js 쪽의 안전 래퍼가 조용히
 * 무시한다(아래 game.js track() 참고) — 순서가 바뀌어도 죽지 않는다.
 */
import { track, type SumoEventName, type SumoEventProps } from './analytics';

declare global {
  interface Window {
    __sumoTrack?: (name: string, props?: Record<string, string | number | boolean | undefined>) => void;
  }
}

window.__sumoTrack = function (name, props) {
  // game.js(순수 JS, 내부 전용 브릿지)에서 넘어오는 이름은 여기서 신뢰하고
  // SumoEventName 으로 좁혀 넘긴다 — 외부 입력이 아니라 우리 game.js 자체다.
  track(name as SumoEventName, props as SumoEventProps);
};

track('app_enter');
