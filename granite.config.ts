import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * 트랙 K (기존 게임 4종 래핑) — 스모 바운스 / Sumo Bounce
 * 앱인토스 웹 프레임워크 설정 (RN/Granite 경로 아님)
 *
 * ★ 경로 선택: 웹(web-framework) 경로다. RN(@apps-in-toss/framework) 경로가 아니다.
 *   heatapp/turnon/miri(사내 기존 3개 미니앱)는 전부 RN 경로 참고용일 뿐이고, 게임
 *   타입 판정 방식이 완전히 다르다. 이 판단 근거(실측)는 이 프로젝트의 README.md
 *   "설계 결정 1" 참고. `ait build` 는 이 파일의 소스 문자열에
 *   '@apps-in-toss/web-framework' 가 들어있는지로 빌드 전략을 고른다
 *   (@apps-in-toss/cli/dist/index.js:1216-1218). 위 import 문을 지우거나 경로를
 *   바꾸면 RN 전략으로 떨어져 빌드가 깨진다.
 *
 * ★ 파일 이름이 granite.config.ts 인 것은 오타가 아니다. 웹 경로도 이 이름을 쓴다
 *   (@apps-in-toss/cli/dist/index.js:2100).
 *
 * 이 파일 구조는 트랙 C(신규 성인게임) adult-card-game/granite.config.ts 를
 * 그대로 참고해 스모 바운스용으로 값만 바꾼 것이다(원본은 손대지 않고 읽기만 했음).
 */
export default defineConfig({
  /**
   * appName: 콘솔에 등록한 appName 과 글자 그대로 일치해야 한다(불일치 시
   * 서버 컴파일 단계에서 BUILD_FAILED — miri 실측 이력).
   *
   * ★ 2026-08-02 Chief 실사고 정정: "appName 은 kebab-case 강제"라는 이전
   *   주석은 틀렸다. **강제 규칙이 아니다** — 콘솔에 등록된 값을 그대로
   *   써야 할 뿐이다. 이전 세션은 콘솔값을 이 세션에서 확인할 수 없어
   *   'sumo-bounce'(하이픈 포함)로 추정 진행했으나, Partner 콘솔 실조회
   *   결과 정본은 **하이픈 없는 'sumobounce'** 였다. 확인 불가한 값을
   *   추정으로 채운 게 원인 — 앞으로는 확인 불가하면 GATE 로 올릴 것.
   */
  appName: 'sumobounce',

  brand: {
    displayName: '스모 바운스',
    // 게임 UI 배경(--bg:#0b0e14, 어두운 도효/링 톤)과 어울리는 임시 브랜드 컬러.
    // TODO(콘솔등록): 콘솔 브랜드 컬러 확정 시 교체.
    primaryColor: '#E8552B',
    /**
     * ★ 2026-08-02 Chief → Partner 콘솔 실조회로 확보(재질의 금지). miniAppId
     *   58895 등록 아이콘의 실제 publicUrl. 빌드타임 인라인이라 이 값을 넣고
     *   반드시 재빌드해야 반영된다(config만 고치고 기존 .ait 재업로드하면
     *   옛 값이 그대로 나가는 함정 — turnon 반려 이력).
     */
    icon: 'https://static.toss.im/appsintoss/63105/10d94415-f09a-4b11-9071-2dbff08ddb34.png',
  },

  web: {
    host: 'localhost',
    port: 5174,
    /**
     * ★ 이 명령들은 npm run 이 아니라 npx 로 실행된다
     *   (@apps-in-toss/cli/dist/index.js:1274-1278 -> web-config/dist/index.js:78,
     *   npm 환경에서 packageManager 가 "npx" 로 치환됨). 'run web:build' 처럼
     *   쓰면 `npx run web:build` 가 되어 실패한다. 반드시 실행 파일명만 쓴다.
     *
     * ★★ 2026-08-22 --mode toss 추가(필수, 지우지 마라) — vite.config.ts 의
     *   `sumo-toss-web-shim` 플러그인이 이 모드일 때만 비활성화된다. 즉 이
     *   플래그가 있어야 `ait build`(=이 명령)가 **진짜 토스 SDK**(src/toss/**·
     *   실 광고 ID·eventLog 계측)를 쓴다. 빼면 게임 필수 SDK 4종+계측+광고가
     *   통째로 shim(no-op)으로 바뀌어 심사에서 반려된다.
     *   웹/스토어 빌드(`npm run web:build`)는 반대로 모드 없이 돌려 SDK·광고·
     *   계측을 전부 뺀다(vite.config.ts 상단 주석 참고).
     */
    commands: {
      dev: 'vite --port 5174 --mode toss',
      build: 'vite build --mode toss',
    },
  },

  /**
   * permissions: 빈 배열. 스모 바운스는 물리 대전 게임이라 위치·카메라·마이크·
   * 연락처·사진 어느 것도 쓰지 않는다(원본 제출체크리스트 C3/C4 — 네트워크·
   * 소켓 요청 자체가 0건인 완전 오프라인 게임).
   */
  permissions: [],

  /**
   * webViewProps — ★ 게임 판정의 전부다.
   *
   *   type: 'game' 이 없으면 기본값 'partner' 로 떨어지고 게임으로 인식되지
   *   않는다(@apps-in-toss/web-framework/dist/config/index.d.ts 의
   *   webViewProps.type JSDoc: `@default 'partner'`, 'game' 은 실제로는
   *   deprecated 표기가 있으나 — "Use 'partner' instead" — 게임 판정 로직
   *   자체는 여전히 'game' 문자열을 요구한다:
   *     @apps-in-toss/cli/dist/index.js:1246
   *       const isGame = config.webViewProps?.type === "game";
   *   즉 deprecated 경고는 "웹뷰 프레임 스타일" 관점의 안내이고, .ait 메타의
   *   isGame 플래그는 여전히 이 값으로만 결정된다. 이 프로젝트는 게임이므로
   *   'game' 을 명시적으로 쓴다.
   *
   *   ※ 웹 경로 config 에는 appType 이 존재하지 않는다(AppsInTossWebConfig 가
   *     Omit<AppsInTossPluginOptions, 'appType' | 'target'> 를 확장). RN
   *     경로에서 쓰는 appType: 'game' 을 여기 쓰면 타입 에러다.
   *
   *   아래 나머지 옵션은 전부 "기본값이 게임에 해로운" 것들이라 명시적으로 끈다:
   *     bounces                              기본 true     -> iOS 고무줄 스크롤
   *     pullToRefreshEnabled                 기본 true     -> 당겨서 새로고침(오작동)
   *     overScrollMode                       기본 'always' -> Android 오버스크롤 글로우
   *     allowsBackForwardNavigationGestures  기본 true     -> 가로 스와이프로 화면 이탈
   *       (스모 바운스는 화면 가장자리에서 조준 드래그를 하므로 특히 위험 —
   *        원본 제출체크리스트 "J. 게임별 특기사항" 조작 리스크 항목과 직결)
   *     mediaPlaybackRequiresUserAction      기본 true     -> BGM/효과음 자동재생 차단
   */
  webViewProps: {
    type: 'game',
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },

  /**
   * navigationBar — 빌드타임 고정값. 런타임/화면별 동적 전환 API가 없다.
   *
   * theme: 'dark' — 뒤로가기 아이콘 색만 결정한다.
   *   light = #191F28(어두운 아이콘), dark = #FFFFFF(흰 아이콘).
   *   게임 배경 --bg:#0b0e14 (public/game/sumo-bounce-game.js 로 옮겨진
   *   원본 index.html <style> 블록, :root 변수) 기준 WCAG 대비비 실측(python
   *   colorimetry, 이 세션에서 직접 계산):
   *     #FFFFFF(흰 아이콘) on #0b0e14   ->  19.32 : 1   PASS (기준 4.5:1)
   *     #191F28(검정 아이콘) on #0b0e14 ->   1.17 : 1   FAIL
   *   흰 아이콘 쪽이 압도적으로 우세해 dark 로 확정.
   *
   * withBackButton: true  — 미니앱은 자체 나가기 수단이 필요하다.
   * withTitle: false      — 게임 자체 타이틀 화면(#sc-title)이 있어 중복 방지.
   * transparentBackground: false — 배경이 단색에 가까운 어두운 톤이라 네비바와
   *   끊겨 보일 위험이 낮다고 판단. 실기기에서 끊김이 확인되면 재판단.
   */
  navigationBar: {
    withBackButton: true,
    withTitle: false,
    transparentBackground: false,
    theme: 'dark',
  },

  /**
   * outdir: 웹 빌드 산출물 디렉터리. vite 기본 출력(dist)과 일치해야 한다.
   *
   * ★ 함정: ait build 는 outdir 안의 내용을 outdir/web/ 으로 옮긴 뒤
   *   outdir/web/index.html 존재를 요구한다. 그런데 이미 dist/web/index.html 이
   *   있으면 웹 빌드를 통째로 건너뛴다(early return) — 게임 코드를 고치고
   *   재빌드할 때 옛 게임이 담긴 .ait 가 조용히 나올 수 있다.
   *   => 재빌드 전 반드시 `npm run clean && npm run build`.
   */
  outdir: 'dist',
});
