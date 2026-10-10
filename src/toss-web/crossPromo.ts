/**
 * 웹/스토어 전용 「머니 리그」 교차추천 shim (no-op). 2026-09-10 레인 E.
 *
 * 실 파일(`src/crossPromo.ts`)은 토스 미니앱 딥링크(`intoss://moneyleague`)와 토스 브릿지(openURL)를 쓴다 —
 * 웹/MS Store 판에는 열 수 있는 미니앱이 없으므로 카드 자체가 무의미하다. `src/reviveAd.ts` 와 «같은 이유·같은 방식»으로
 * 모듈 전체를 치환한다(vite.config.ts). 웹 번들에는 `intoss://`·`xpromo` 문자열이 «0건이어야 정상»이다.
 */
export function installCrossPromo(): void {
  /* 웹에는 교차추천이 없다 — 아무것도 그리지 않는 것이 이 파일의 «전부»다. */
}
