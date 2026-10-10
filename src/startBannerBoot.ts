/**
 * 스모 바운스 — «시작화면 하단» 배너 진입점. 2026-08-18 · 주석 갱신 2026-09-10(레인 E)
 *
 * ⛔ 왜 sdk-boot.ts 에 안 얹었나:
 *   sdk-boot.ts·src/toss/* 는 트랙①(전면광고) 소유라 «무접촉» 대상이다.
 *   그래서 index.html 에 «별도 module 진입점»으로 분리한다.
 *   (경기장 배너 진입점 arenaBannerBoot.ts 가 같은 이유로 분리돼 있었다 — 2026-09-10 헛요청
 *    대책으로 경기장 배너 모듈은 «삭제»됐고, 이 파일이 유일한 배너 진입점이다.)
 *
 * ★로드 순서 의존이 없다: #sc-title 은 정적 HTML 이라 game.js 주입 «전»에도 존재한다.
 *   startBanner.ts 는 그 요소의 class(hidden) 토글을 MutationObserver 로 보며, game.js 부팅의
 *   showScreen('sc-title') 도 같은 경로로 들어온다(멱등 처리).
 * ★절대 throw 하지 않는다 — 배너가 실패해도 «게임은 반드시 떠야» 한다.
 */
import { installStartBanner } from './startBanner';

try {
  installStartBanner();
} catch (e) {
  console.error('[start-ad] install failed (게임은 계속 진행):', e);
}
