/**
 * 개인정보처리방침 링크 부팅 — 2026-08-22 Partner 지시.
 *
 * === 왜 필요한가(사고) ===
 * 방침 문서를 5종이나 써놓고 유저가 거기 닿을 «길»을 한 번도 안 만들었다
 * (Partner 실측 — .ait web/ 전수 스캔, privacy 매치 0건). 이 파일이 그
 * 「길」이다. #privacy-link 는 index.html 에 정적 <a href> 로 이미 최종
 * 경로를 박아뒀다 — 이 스크립트는 라벨 텍스트만 언어별로 채운다.
 *
 * === 배치(실측으로 특정) ===
 * 이 프로젝트는 index.html 에 #btnSound·#lang* 같은 «설정 화면 전용 id»가
 * 없다(다른 게임과 구조가 다름, 실측 확인) — 대신 #lang-switcher(우측 상단
 * 고정, 언어토글+음소거)가 그 역할을 한다. #privacy-link 는 그 바로 아래
 * 형제 요소로 둔다(index.html CSS 참고) — 게임플레이·#ad-slots(경기장 배너)
 * 와 항상 분리된 메뉴류 화면에서만 같이 뜬다(showScreen() 이 #lang-switcher
 * 와 동일 조건으로 .off 를 토글, public/game/*.js 1줄 추가).
 *
 * === 2026-08-22 09시대 — 라이브 URL에서 «번들 동봉»으로 전환 ===
 * index.html 의 href 가 이제 상대경로(./privacy.html, public/privacy.html
 * 이 web/privacy.html 로 그대로 복사됨)다. 같은 오리진 안의 정적 파일
 * 네비게이션이라 팝업차단 함정(비동기 뒤의 window.open)이 애초에 발생할
 * 조건 자체가 없다 — 그래서 이전 버전에 있던 isInToss() 분기 + SDK
 * openURL 브릿지 우회 로직을 «뺐다»(PRIVACY_LINK_KIT.md §(g): "번들 동봉은
 * isInToss() 분기가 필요 없는 «한 경로»"). 네이티브 <a target="_blank">
 * 클릭 하나로 웹·토스 채널 전부 처리한다.
 * ⚠️이 전환은 «소스만 준비»된 상태다 — 재빌드·headless 클릭 재검증 전이다
 * (검수 중인 -13 빌드 보존을 위해 재빌드 보류 중). 다음 빌드에서
 * new page 개수·url 을 다시 실측할 것.
 *
 * === game.js 무접촉으로 언어 실시간 반영 ===
 * game.js 의 applyLang() 이 `document.documentElement.lang = curLang`
 * 를 이미 하고 있다(원본 게임 로직 무접촉 원칙 유지 — 이 스크립트가 그걸
 * «관측만» 한다, game.js 를 고쳐서 이벤트를 새로 만들지 않는다).
 */

const LABEL: Record<'ko' | 'en', string> = {
  ko: '개인정보처리방침',
  en: 'Privacy Policy',
};

function currentLang(): 'ko' | 'en' {
  try {
    const saved = window.localStorage.getItem('sumoLang');
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'ko').slice(0, 2).toLowerCase();
  return nav === 'en' ? 'en' : 'ko';
}

function applyLabel(el: HTMLElement): void {
  const lang = currentLang();
  el.textContent = LABEL[lang];
  el.setAttribute('aria-label', LABEL[lang]);
}

function init(): void {
  const link = document.getElementById('privacy-link');
  if (!link) return;
  applyLabel(link);

  try {
    const mo = new MutationObserver(() => applyLabel(link));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch {
    /* MutationObserver 미지원 환경 — 초기 라벨만 유지, throw 하지 않는다. */
  }
}

init();
