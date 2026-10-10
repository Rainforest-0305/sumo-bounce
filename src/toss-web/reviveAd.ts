/**
 * 웹/스토어 전용 「부활 1회」 리워드 shim (no-op).
 *
 * 실 파일(`src/reviveAd.ts`)에는 부활 지면 리터럴(REVIVE_AD_GROUP_ID)이 박혀 있다 —
 * `src/toss/interstitialAd.ts` 와 «같은 이유»로 모듈 전체를 치환한다
 * (패키지 alias 로는 소스 «문자열»이 안 지워진다).
 *
 * 웹/MS Store 판에는 광고 자체가 없다 ⇒ `window.__sumoReviveOffer` 훅을 «설치하지 않는다».
 * game.js 의 부활 분기는 `typeof window.__sumoReviveOffer === 'function'` 가드를 먼저 보므로
 * 훅이 없으면 종전과 100% 동일하게 곧장 finishMatch(2) 로 간다(제안 UI 자체가 안 뜬다).
 * ⇒ MS Store 에 낸 "no ads, no data collection" 신고와 산출물이 계속 일치한다.
 */
export function installReviveAd(): void {
  /* 웹에는 부활 리워드가 없다 — 훅을 설치하지 않는 것이 이 파일의 «전부»다. */
}
