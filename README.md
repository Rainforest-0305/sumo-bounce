# 스모 바운스 (Sumo Bounce) — 앱인토스 `.ait` 래핑 첫 성공 사례

트랙 K(기존 게임 4종 앱인토스 래핑) 파일럿. 이 문서는 진행 상황과 다음 3개
게임(피고지고/블룸 서킷, 네온스레드, 프리즘 그리드)에 그대로 적용할 레시피를
남기기 위한 것이다.

라벨: **[확인]** = 이 세션에서 직접 실행/렌더/디코드해서 봄. **[추정]** = 코드만
읽고 판단, 미실행.

---

## 0. 최종 상태 요약

- `.ait` 빌드: **성공**. `sumo-bounce.ait`, **3,801,605 bytes** (약 3.63MB).
  [확인]
- 4개 RN 호스트 번들(ios/android × RN 0.84.0/0.72.6) + `web/index.html` +
  `web/game/sumo-bounce-game.js` + `web/assets/index-*.js` 전부 zip 안에 존재,
  전수 검증 완료. [확인]
- 게임 필수 SDK 4종 전부 배선 완료(사용자 식별키·Safe Area·네이티브
  Storage·내비게이션 바). [확인 — 코드 배선 + 로컬 렌더 검증. **실기기(진짜
  토스 앱) 검증은 미수행**, 아래 "로컬 실행/검증" 섹션 참고]
- 종료 확인 모달(G3) 구현 완료, 로컬에서 뒤로가기 시뮬레이션으로 실제 동작
  확인. [확인]
- 로컬 렌더 검증: Playwright 헤드리스 크롬으로 **프로덕션 빌드 산출물**
  (`dist/web/`)을 그대로 서빙해서 열었고, 타이틀 화면이 뜨고 콘솔 에러
  0건. [확인]

---

## 1. ★★★ 핵심 설계 결정 — RN(Granite) 경로가 아니라 Web(web-framework) 경로다

미션 최초 지시서는 `@apps-in-toss/framework/plugins` + `appType: 'game'`
(heatapp 패턴)을 출발점으로 줬지만, 세션 도중 두 가지 독립 경로로 이게
**틀렸다는 게 밝혀졌다**:

1. **npm 레지스트리 직접 조사**로 `@apps-in-toss/web-framework`가 별도의
   실재 패키지(최신 2.10.8)이고, 그 안에 `dist-web/index.d.ts`
   (`AppsInTossWebConfig`, `webViewProps.type`)와 `dist/prebuilt/*.js` 4종
   (ios/android × rn72/rn84 — **이게 ".ait 안 4개 번들"의 정체**)이 실재함을
   확인. [확인]
2. **트랙 C(신규 성인게임, adult-card-game) 담당 기술총괄의 독립 조사**
   (`C:\Users\USER\Downloads\20260802_Partner업무\03_신규성인게임\build\ait_스캐폴딩_전략.md`)
   가 같은 결론에 도달: `@apps-in-toss/cli/dist/index.js`의
   `graniteConfigSource.includes("@apps-in-toss/web-framework")` 분기가 빌드
   전략을 가른다. heatapp/turnon/miri 3개는 전부 RN 경로, **game 타입
   선례는 사내에 0건**이었다.

**결정: Web 경로.** `granite.config.ts`에서
`import { defineConfig } from '@apps-in-toss/web-framework/config'`를 쓴다.
파일명은 `granite.config.ts` 그대로다(웹 경로도 이 이름을 씀, 오타 아님).

### RN 경로 vs Web 경로 비교

| | RN(Granite) 경로 | **Web 경로 (채택)** |
|---|---|---|
| config import | `@apps-in-toss/framework/plugins` | `@apps-in-toss/web-framework/config` |
| 게임 지정 필드 | `appType: 'game'` | `webViewProps.type: 'game'` |
| 앱 코드 형태 | React Native | HTML/CSS/JS (CSR) |
| RN 번들 | 직접 빌드(hermes) | prebuilt 사용 |
| 게임 HTML 감싸는 법 | react-native-webview | **불필요 — HTML 자체가 앱** |
| 사내 선례 | heatapp·turnon·miri(전부 general) | 없음(이 프로젝트가 최초) |

기존 완성 게임이 **단일 정적 HTML**(외부 리소스 0건, fetch 0건)이라는 원본
자산의 특성과 Web 경로가 정확히 맞아떨어진다 — HTML을 RN WebView로 다시
감싸는 이중 구조가 필요 없다.

---

## 2. `webViewProps.type` — 게임 판정 필드 (§1 실측 완료)

`node_modules/@apps-in-toss/web-framework/dist/config/index.d.ts`
(`AppsInTossWebConfig`) 실측:

```ts
webViewProps?: {
  type?: 'partner' /* @default */ | 'external' /* @deprecated, use partner */ | 'game' /* @deprecated, use partner */;
  ...
}
```

`'game'` 값 자체에 `@deprecated — Use 'partner' instead` 주석이 붙어 있어
헷갈리기 쉽지만, **게임 판정 로직 자체는 여전히 이 문자열을 그대로 요구한다**
— `@apps-in-toss/cli/dist/index.js:1246`(트랙 C 조사에서 실측):

```js
const isGame = config.webViewProps?.type === "game";
```

이 프로젝트의 `.ait` 빌드 결과물을 protobuf 헤더로 직접 디코드해서
`webViewProps.type = "game"`이 그대로 박혀 있고, 최상위 `field 1 (varint) = 1`
(= `isGame: true`로 강하게 추정)임을 확인했다(§7 참고). **`appType`은
웹 경로 config 타입에 아예 존재하지 않는다**(`AppsInTossWebConfig`가
`Omit<AppsInTossPluginOptions, 'appType' | 'target'>`을 확장) — 쓰면 타입
에러.

`granite.config.ts`의 `webViewProps` 나머지 옵션(전부 "기본값이 게임에
해로운" 것들이라 명시적으로 끔): `mediaPlaybackRequiresUserAction: false`,
`allowsInlineMediaPlayback: true`, `bounces: false`,
`allowsBackForwardNavigationGestures: false`(스모 바운스는 화면 가장자리
드래그 조작이 있어 특히 중요), `pullToRefreshEnabled: false`,
`overScrollMode: 'never'`.

---

## 3. 게임 필수 SDK 4종 — 정확한 구현

### 3-0. 아키텍처: `src/toss/` 모듈

세션 도중 **트랙 D(땅따먹기/territory-clash) 담당의 독립 재검증**으로
"웹 경로에서 `getAnonymousKey`와 `getUserKeyForGame`은 별칭이 아니라 서로
다른 네이티브 브릿지 메서드"라는 치명적 사실이 드러났다(§3-1 참고). 이
세션에서 **직접 `node_modules/@apps-in-toss/web-bridge/dist/bridge.js`를
grep해서 재확인**했다(peer 주장을 그대로 믿지 않고 독립 검증):

```
export var getAnonymousKey=createAsyncBridge("getAnonymousKey");
...
export var getUserKeyForGame=createAsyncBridge("getUserKeyForGame");
```

`createAsyncBridge`에는 **타임아웃이 없다**(같은 파일의 `NativeWindow`/
`createAsyncBridge` 구현 직접 확인) — 네이티브가 모르는 메서드명이면 Promise
가 영원히 pending → 부팅 경로에서 await하면 흰 화면. 이 문제를 막기 위해
트랙 D가 만든 검증된 패턴(`territory-clash/src/toss/{env,bridge,identity}.ts`)
을 그대로 복제해 이 프로젝트의 `src/toss/`에 이식했다(재작성 아님, 파일
그대로 가져오고 네임스페이스/CSS 변수 이름만 이 프로젝트에 맞게 바꿈):

```
src/toss/
  env.ts            isInToss() 판별 + safeBridge()(3초 타임아웃+fallback) +
                     safeSync()(동기 상수 브릿지용)
  bridge.ts          getUserKeyForGame/getAnonymousKey/closeView 를
                     createAsyncBridge 로 직접 선언(공개 API에 없어서
                     bridge-core 로 직접 만듦 — SDK 공식 확장점)
  storage.ts          storage.{getItem,setItem,removeItem}(safeBridge 로
                      감쌈) + 이 게임 전용 primeGameStorage/mirrorGameWrite
  safeArea.ts         SafeAreaInsets.get/subscribe, safeSync 로 감쌈,
                      --sa-top/--sa-bottom/--sa-left/--sa-right CSS 변수 주입
  navigationBar.ts    graniteEvent back/home 구독 + pushBackHandler 스택 +
                      exitMiniApp()
  identity.ts         getAnonymousKey 우선 시도 → 실패 시 getUserKeyForGame
                      폴백 → 둘 다 실패면 로컬 익명 ID(source 필드로 구분)
  index.ts            위 전부를 initTossSdk() 하나로 통합 부트스트랩
```

**이 레이어는 절대 throw 하지 않는다.** 토스 밖(로컬 vite dev, 순수 브라우저)
에서도 전부 fallback으로 동작 — 실제로 이 세션에서 Playwright로 실측
확인했다(§8).

### 3-1. 사용자 식별키 — `getAnonymousKey` 우선, `getUserKeyForGame` 폴백

**정정 이력**: 처음에는 (구버전 문서·RN 경로 소스 기준으로) "getUserKeyForGame
은 단순히 getAnonymousKey를 부르는 deprecated 별칭이니 getAnonymousKey만
쓰면 된다"고 판단했었다. 이건 **RN 경로에서만 참**이다
(`native-modules/.../getUserKeyForGame.ts`: `return getAnonymousKey();`).
**웹 경로(`web-bridge`)에서는 완전히 다른 네이티브 메서드 2개다** — 위 §3-0
의 실측 grep 참고. 이 세션에서 이 정정을 받고 코드를 실제로 고쳤다(단순
반영이 아니라 소스를 직접 재확인 후 채택).

`src/toss/identity.ts`의 `resolveIdentity()`:
1. `isInToss()`가 false면(로컬 개발 등) 바로 로컬 익명 ID로 폴백(브릿지
   호출 자체를 시도하지 않음 — 무의미한 3초 대기 회피).
2. `safeBridge('getAnonymousKey', ..., undefined, 3000)`로 신규 API 먼저
   시도(3초 타임아웃).
3. 실패/undefined/'ERROR'면 `safeBridge('getUserKeyForGame', ...)`로 레거시
   API 폴백.
4. `'INVALID_CATEGORY'`(콘솔에서 앱 카테고리가 '게임'이 아님)를 받으면 코드
   문제가 아니라 **콘솔 설정 문제**임을 `console.error`로 명확히 표면화하고
   로컬 ID로 폴백.
5. 위 전부 실패하면 `crypto.randomUUID()` 기반 로컬 익명 ID.
6. 결과는 `{ userKey, source: 'toss'|'local', invalidCategory }`, 세션 내
   캐시.

현재 게임은 서버 랭킹 연동이 없는 완전 오프라인 게임이라 이 키를 UI에
노출하진 않지만, "게임 필수 SDK 4종" 요건(I5/F1)이라 부팅 시 확보해 캐시해
둔다(§4의 `initTossSdk()` 안에서 호출됨).

### 3-2. Safe Area — `SafeAreaInsets.get()` / `.subscribe()`

`src/toss/safeArea.ts`. `getSafeAreaInsets()`(deprecated, `number` 하나만
반환)는 쓰지 않는다. 4방향 값을 `--sa-top`/`--sa-bottom`/`--sa-left`/
`--sa-right` CSS 변수로 `:root`에 주입하고, `.subscribe()`로 회전 등 런타임
변경도 반영한다.

**원본 게임 CSS 패치**: `public/game/sumo-bounce-game.js`로 옮겨지기 전,
원본 index.html의 `<style>` 블록(이제 이 프로젝트의 `index.html`에 그대로
남아있음)에 있던 `env(safe-area-inset-*)` 사용처 **12곳**을 전부
`var(--sa-top, env(safe-area-inset-top))` 형태(top/bottom/right 3방향,
left는 원본에 사용처 없음 — 실측: top 5곳·bottom 6곳·right 1곳)로 자동
치환했다. SDK 값이 있으면 그걸 쓰고, 없으면(SDK 미제공 환경) 자동으로
기존 `env()` 폴백을 쓴다 — **원본 CSS 계산식(`calc(6px + ...)` 등)은 전혀
건드리지 않고 `env()` 함수 호출 부분만 감쌌다.**

Safe Area 값이 브릿지 미제공 환경에서 조회 실패하면(`hasConstant()`가
false) 조용히 CSS `env()` 폴백으로 넘어간다 — throw 없음, §8에서 실측
확인.

### 3-3. 네이티브 Storage — 두 겹 설계 (원본 게임 코드는 안 건드림)

미션 배경 §3의 실측(react-native-webview 참고 지시)과 달리, 이 프로젝트는
Web 경로라 WebView 컴포넌트 자체가 필요 없다 — 대신 원본 게임이 이미
`localStorage`를 쓰고 있다는 게 새로운 과제였다.

**원본 게임의 localStorage 사용처(grep 실측, 원본 644~687·3352·3355행)**:
`lsGet`/`lsSet` 두 함수로 전부 몰려 있고, 실제 호출부는 6곳(로드 1·저장
1·음소거 읽기/쓰기 2·언어 읽기/쓰기 2), 키 3개(`sumoSave`/`sumoMuted`/
`sumoLang`).

**왜 "완전 async 리라이트"를 안 했는가**: `let muted = (lsGet('sumoMuted')
=== '1')`(669행)처럼 **스크립트 최상위에서 동기적으로 값을 즉시 써야 하는
자리**가 있다. `Storage.getItem()`은 Promise라 그 자리에서 그대로 await
할 수 없고, 그러려면 게임의 부팅 순서 자체를 async로 바꿔야 한다 — 이건
"게임 코드는 그대로 두고 래핑만" 지시 범위를 넘는다.

**채택한 설계 — 동기 캐시 + 비동기 미러**:
1. `localStorage`를 게임 런타임의 동기 정본으로 그대로 둔다(**게임 코드
   수정 1줄만**, 아래).
2. `lsSet()` 본문에 `window.__nativeStorageMirror(k, v)` 호출 1줄을
   추가해서, 매 쓰기가 네이티브 Storage로도 비동기 미러링된다
   (`src/toss/storage.ts`의 `mirrorGameWrite()`, `storage.setItem`이
   `safeBridge`로 감싸져 있어 실패해도 게임에 영향 없음).
3. 부팅 시(`sdk-boot.ts`) `primeGameStorage()`가 네이티브에 미러링된 값을
   읽어와서, **localStorage에 해당 키가 아직 없을 때만** 역주입한다(재설치
   등으로 로컬 저장소만 지워진 경우의 안전망). 이미 로컬에 값이 있으면
   정본이므로 덮어쓰지 않는다.

**원본 게임에 대한 유일한 수정**(`public/game/sumo-bounce-game.js`,
추출·이식 과정에서 patch, 파이썬 스크립트로 기계적 치환·검증):
```diff
-function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
+function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){}
+  try { if (typeof window!=='undefined' && window.__nativeStorageMirror)
+    window.__nativeStorageMirror(k,v); } catch(e){} }
```
그 외 게임 코드는 **1바이트도 안 건드렸다**(아래 §5 추출 절차 참고).

**알려진 한계 [추정, 실기기 미검증]**: `sdk-boot.ts`가 ES 모듈
(`type="module"`)이고 게임 스크립트는 `primeGameStorage()`가 끝난 뒤에야
동적으로 `<script src>`를 만들어 붙이므로, **문서 구조상으로는** 게임 코드가
항상 프라이밍 완료 이후에 실행된다. 이 순서 보장이 실기기 토스 WebView에서도
동일하게 성립하는지는 검증 못 했다.

### 3-4. 내비게이션 바 — 선언부(빌드타임) + 런타임부

**(A) 선언부** — `granite.config.ts`의 `navigationBar`(빌드타임 고정값,
런타임/화면별 전환 API 없음):
```ts
navigationBar: {
  withBackButton: true,
  withTitle: false,       // 게임 자체 타이틀 화면(#sc-title) 있음, 중복 방지
  transparentBackground: false,
  theme: 'dark',          // 아래 WCAG 계산 근거
},
```
`theme: 'dark'`(흰 뒤로가기 아이콘) 근거 — 게임 배경 `--bg:#0b0e14` 기준
**이 세션에서 직접 python colorimetry로 계산**:
- `#FFFFFF`(흰 아이콘) on `#0b0e14` → **19.32 : 1** PASS(기준 4.5:1)
- `#191F28`(검정 아이콘) on `#0b0e14` → **1.17 : 1** FAIL

**(B) 런타임부** — `src/toss/navigationBar.ts`의 `initNavigationBar()`.
`graniteEvent.addEventListener('backEvent'/'homeEvent', ...)`를 구독하고,
`pushBackHandler()`로 등록된 핸들러 스택(LIFO)을 돌려 처리한다. 아무도
소비하지 않으면 기본 동작으로 `closeView()`를 호출한다. **(B)가 없으면
뒤로가기 버튼이 눌려도 아무 일도 안 일어나서 사용자가 못 나간다 = 반려
사유** — 원본 문서에 있던 함정.

---

## 4. 종료 확인 모달 (G3)

`src/exitConfirmUi.ts`. 원본 게임은 history API를 전혀 쓰지 않는다
(`popstate`/`pushState`/`replaceState` 0건 — 원본 제출체크리스트 C12·C13
실측 그대로 유효, 화면 전환은 DOM 클래스 토글). 즉 화면별 뒤로가기 스택이
없다 — 그래서 이 모달은 **"지금 어느 화면인지"를 구분하지 않고, 뒤로가기가
눌리면 항상** "게임을 종료할까요?"를 띄운다.

구현은 직접 `graniteEvent`를 구독하지 않고, §3-4의
`pushBackHandler(() => { showExitConfirm(); return true; })` 하나로
끝난다 — `true` 반환 = "내가 처리했다" = `navigationBar.ts`의 기본 동작
(자동 `closeView()`)이 억제된다. 모달의 "종료" 버튼을 눌러야만
`exitMiniApp()`(= `closeView()`)이 실제로 호출된다. "계속하기"는 모달만
닫는다.

**로컬 검증**: Playwright로 `window.dispatchEvent(new
PopStateEvent('popstate'))`를 발화해(토스 밖에서는 `navigationBar.ts`가
`popstate`를 같은 경로로 연결해 둠) 모달이 실제로 뜨는지, "계속하기" 클릭
시 정상적으로 닫히는지 확인했다(§8, 스크린샷 `_verify_evidence/exit-confirm-modal.png`).
**"종료" 버튼 → 실제 `closeView()` 네이티브 호출까지는 토스 밖에서는 검증
불가**(브릿지가 없어 `safeBridge`가 fallback으로 조용히 넘어감) — 실기기
필요.

---

## 5. index.html ↔ 게임 코드 분리 절차 (다음 3개 게임에 그대로 적용할 레시피)

원본 `Games for Toss/Sumo Bounce/index.html`(173,881 bytes, 단일 파일,
`<style>` 1블록 + `<script>` 1블록)을 **1바이트도 재작성하지 않고** 다음
파이썬 스크립트로 기계적으로 분리했다(LLM이 173KB를 직접 읽어 옮겨 적지
않음 — 옮겨적기 자체가 오탈자 위험이라 파일시스템 레벨에서 라인 슬라이싱):

1. 원본에서 `<script>`(라인 532) ~ `</script>`(라인 3490) 사이 내용을
   그대로 잘라내 `public/game/sumo-bounce-game.js`로 저장(vite의 `public/`
   패스스루 — 빌드 시 변환 없이 `dist/game/`으로 그대로 복사됨).
2. `lsSet()` 함수 정의 1곳만 위 §3-3의 1줄 패치.
3. 나머지 마크업(`<head>`+`<style>`+`<body>` 내용, 라인 1~531)은 그대로
   두고 `<script>` 자리에 `<script type="module"
   src="/src/sdk-boot.ts"></script>` 하나만 넣어 `index.html`로 저장.
4. index.html의 `<style>` 블록 안 `env(safe-area-inset-*)` 12곳만
   `var(--sa-*, env(...))`로 정규식 치환(§3-2).
5. **검증**: `python -c` 로 원본 파일 크기(173,881) 불변 확인 + 패치된
   `lsSet` 문자열이 game.js에 정확히 1회만 존재하는지 assert + 게임 스크립트
   시작(`"use strict";`)/끝(`requestAnimationFrame(gameLoop);`) 줄이
   정확히 일치하는지 assert.

**다음 3개 게임 적용 시**: 각 게임 HTML의 `<script>`/`</script>` 실제
라인 번호를 grep으로 먼저 확인(스모 바운스와 줄 번호가 다를 것이다), 이
스크립트의 라인 상수만 바꿔서 재사용. `localStorage` 호출부 개수·키 이름도
게임마다 다르므로 grep으로 매번 재확인할 것 — 스모 바운스는 6곳/3키였지만
보장 없음.

`sdk-boot.ts`는 `primeGameStorage()` 완료를 `await`한 뒤에야
`document.createElement('script')`로 `game.js`를 동적으로 붙인다(§3-3
"알려진 한계" 참고) — index.html에 정적으로 `<script src="/game/...">`를
바로 넣으면 안 된다(그러면 프라이밍보다 먼저/동시에 실행될 수 있다).

---

## 6. `.ait` 검증 — 4-함정 프로토콜 전수 실행

### 함정 1: `.ait`는 zip이다 — Python zipfile로 열어서 검사

`sumo-bounce.ait`(3,801,605 bytes)를 `zipfile.ZipFile`로 열어 엔트리 11개
확인:

```
bundle.ios.0_84_0.js       1,658,645 bytes  (+.map 3,761,827)
bundle.android.0_84_0.js   1,658,392 bytes  (+.map 3,761,255)
bundle.ios.0_72_6.js       1,698,031 bytes  (+.map 3,842,833)
bundle.android.0_72_6.js   1,697,778 bytes  (+.map 3,842,267)
web/index.html                31,306 bytes
web/game/sumo-bounce-game.js 142,953 bytes
web/assets/index-jh381McS.js  25,865 bytes
```

### 함정 2: 한글은 `\uXXXX` 이스케이프 — 언이스케이프 후 검색

정규식 `\\u([0-9a-fA-F]{4})` → `chr(int(...,16))`로 언이스케이프한 뒤 검색.

### 함정 3: 번들 전수 확인(4개 RN 호스트 + 3개 web 파일, **7개 전부**)

| 파일 | 'Sumo' | 'Bounce' | 'SUMO BOUNCE' | '스모'(언이스케이프) | '바운스'(언이스케이프) |
|---|---|---|---|---|---|
| bundle.ios.0_84_0.js | 0 | 0 | 0 | **2** | **2** |
| bundle.android.0_84_0.js | 0 | 0 | 0 | **2** | **2** |
| bundle.ios.0_72_6.js | 0 | 0 | 0 | **2** | **2** |
| bundle.android.0_72_6.js | 0 | 0 | 0 | **2** | **2** |
| web/game/sumo-bounce-game.js | 0 | **1** | **1** | 0 | 0 |
| web/index.html | (title="Sumo Bounce", 육안 확인) | | | | |
| web/assets/index-*.js | 0 | 0 | 0 | 0 | 0 |

**중요한 해석 — 왜 RN 호스트 4개엔 영문이 없고 한글만 있는가**: Web 경로는
RN 번들을 직접 빌드하지 않고 **prebuilt 제네릭 호스트**를 가져다 쓴다
(`@apps-in-toss/web-framework/prebuilt/prod/{platform}/{rnSuffix}`). 이
호스트가 게임 본체는 전혀 모른다 — 대신 `granite.config.ts`의
`brand.displayName: '스모 바운스'`가 빌드 시점에 런타임 설정 스크립트로
그 안에 주입된다(내비게이션 바 타이틀 등에 쓰임). **영문 타이틀
("SUMO BOUNCE")은 게임 자체 HTML/JS에만 있고 RN 호스트에는 없는 게
정상**이다 — 두 종류의 "게임 특유 문자열"이 서로 다른 층에 있다는 뜻이고,
둘 다 확인해야 완전한 검증이다. RN 호스트 4개가 npm 원본 prebuilt와
**바이트 단위로 다름**(SHA256 불일치 4/4)도 확인해서, 이게 "그냥 복사한
제네릭 파일"이 아니라 우리 설정이 실제로 주입된 결과임을 교차 확인했다.

`web/assets/index-*.js`(우리 SDK 부트스트랩 번들)는 게임 문자열이 0건인 게
정상이다 — 그건 게임 콘텐츠가 아니라 SDK 배선 코드다.

### 함정 4: 번들에 들어간 것 ≠ 앱이 켜지는 것 — 실제 렌더 검증

`granite dev`/실기기가 없으므로, `.ait`가 실제로 만들어낸 **프로덕션 웹
산출물**(`dist/web/` — `.ait` 안의 `web/` 폴더와 완전히 동일한 내용)을
정적 HTTP 서버로 그대로 서빙하고, Playwright 헤드리스 Chromium으로 열어
확인했다(§8).

---

## 7. `.ait` 컨테이너 포맷 — protobuf 헤더 직접 디코드 [확인]

`.ait`는 `[8바이트 매직 "AITBUNDL"][12바이트 헤더(버전+길이)][protobuf
메시지][zip 데이터]` 구조다. `zipfile.find(b"PK\x03\x04")`로 zip 시작
오프셋(2073)을 찾고, 그 앞의 preamble을 schema 없이 직접 varint/length
-delimited 파싱하는 raw protobuf 디코더를 짜서 확인했다:

- **top-level field 1 (varint) = 1** — `CreateArtifactOptions.isGame:
  boolean` 로 강하게 추정되는 위치(빌드 CLI 소스의 `isGame` 계산 로직과
  일치). [추정 — 필드 이름 자체는 wire format에 안 남으므로 100% 단정은
  불가, 다만 §2의 소스 코드 로직과 값(1=true)이 정확히 부합]
- field 2 = deploymentId `019fc15f-cfc3-74c6-9552-f9112247e407` — `ait
  build` 콘솔 출력과 **정확히 일치**. [확인]
- field 3 = `sumo-bounce` (appName). [확인]
- 내부 submessage에 `brand.displayName` bytes를 UTF-8 디코드하면
  **정확히 "스모 바운스"**. [확인]
- `webViewProps.type` = `"game"` 그대로 임베드. [확인]
- `navigationBar`: withBackButton=true, withTitle=false,
  transparentBackground=false, theme="dark" — granite.config.ts와 전부
  일치. [확인]
- `webViewProps` 나머지 6개 옵션(mediaPlaybackRequiresUserAction=false,
  allowsInlineMediaPlayback=true, bounces=false,
  allowsBackForwardNavigationGestures=false, pullToRefreshEnabled=false,
  overScrollMode="never") 전부 일치. [확인]
- 각 번들 파일의 SHA256이 매니페스트 안에 박혀 있고, **zip 안 실제 파일
  바이트로 계산한 SHA256과 전부 일치**(11개 파일 전수 교차 검증). [확인]
- 맨 끝 varint 필드(1785654771242, 두 번째 빌드는 다른 값)를 밀리초
  epoch로 해석하면 `2026-08-02 16:12:51` — 이 세션이 실제로 돌아간
  날짜(오늘, 2026-08-02)와 일치. [확인]

---

## 8. 로컬 실행/검증 — 실제로 한 것과 못 한 것

### 8-1. 한 것 [확인]

1. `npm run typecheck`(`tsc --noEmit`) — 0 에러(구조 변경 후 재확인 포함
   2회).
2. `npm run build`(`clean && ait build`) — 성공, `.ait` 3,801,605 bytes.
3. **개발 서버(`vite`, port 5173)**를 Playwright 헤드리스 Chromium
   (viewport 390×740)으로 열어 확인:
   - 콘솔 에러 0건, 페이지 에러(uncaught exception) 0건.
   - `#sc-title`(타이틀 화면) visible=true, `#gameCanvas` 존재=true.
   - `initTossSdk()` self-test 로그: `{userKey: fallback, safeArea:
     fallback, storage: ok, navigationBar: fallback}` — 브릿지가 없는
     환경(로컬 브라우저)에서 **기대한 그대로 전부 안전하게 폴백**했고,
     `storage: ok`는 localStorage 폴백 경로의 round-trip이 실제로
     성공했다는 뜻.
4. **프로덕션 빌드 산출물(`dist/web/`, `.ait` 안 `web/`과 바이트 동일)**을
   `python -m http.server`로 정적 서빙 → 같은 Playwright 검증 재실행 →
   동일하게 콘솔 에러 0, 타이틀 화면 렌더 확인, 스크린샷 저장.
5. **인터랙션 검증**: 사운드 토글 버튼 클릭 → 원본 게임의 `lsSet('sumoMuted',
   '1')`이 실제로 호출돼 `localStorage`에 반영됨을 확인 →
   `window.__nativeStorageMirror`가 함수로 존재하고 직접 호출해도 안
   던짐을 확인. `popstate` 이벤트를 강제 발화 → 종료 확인 모달
   (`#sdk-exit-confirm-overlay`)이 실제로 뜸 → "계속하기" 클릭 → 모달이
   닫히고 게임은 그대로 유지됨을 확인. 스크린샷으로 시각 확인 완료(타이틀
   화면 + 종료 확인 모달 2장).
6. RAM 실측: 작업 전 8.41GB/6.78GB/7.62GB free (매 무거운 작업 전 확인,
   전부 6GB 기준 통과).

### 8-2. 못 한 것 — 실기기/실토스 미검증 [정직하게 남김]

- **실제 토스 앱(iOS/Android)에서 `.ait`를 설치해 여는 것은 하지 않았다.**
  이 세션은 실기기·토스 콘솔 접근 권한이 없다(`ait deploy`도 게이트
  대상이라 실행 안 함).
- 위 §8-1의 검증은 전부 **브릿지가 없는 환경(로컬 브라우저)에서의 안전한
  폴백 동작**을 확인한 것이지, **네이티브 브릿지가 실제로 응답하는 경로**
  (`isInToss()===true`일 때의 진짜 `getAnonymousKey`/`Storage`/
  `SafeAreaInsets`/`graniteEvent`/`closeView` 왕복)는 검증하지 못했다.
- `graniteEvent.addEventListener('backEvent', ...)`를 구독하면 앱인토스
  셸의 기본 뒤로가기 동작(즉시 종료 등)이 실제로 억제되는지는 **[추정]**
  이다 — RN `BackHandler` 류 API의 통상적인 관례와 타입 설계(구독 해제
  함수를 돌려줌)로 추정했을 뿐, 실기기에서 "모달이 뜨는 순간에 이미 앱이
  종료돼 버릴" 가능성을 100% 배제하지 못한다.
- Android 7+/iOS 16+ 구형 기기에서의 WebAudio/캔버스 동작(원본
  제출체크리스트 C7/C8, 여전히 확인필요 상태)은 이 세션 범위 밖이다.
- 콘솔 미등록 상태라 `granite.config.ts`의 `brand.icon`이 빈 문자열이다
  — **이 상태로는 실제 제출용 `.ait`가 아니다**(§9 참고, turnon 반려
  이력과 동일 패턴 위험).

**결론: "번들에 게임이 들어갔다"와 "로컬 브라우저에서 안전하게 뜬다"는
[확인]. "실제 토스 앱 안에서 네이티브 SDK가 진짜로 동작한다"는 [추정] —
다음 단계는 실기기 샌드박스 테스트다(원본 제출체크리스트 H8과 동일한
결론).**

---

## 9. 제출 전 남은 필수 조치 (이 세션 범위 밖, Partner/콘솔 담당 몫)

1. **콘솔 앱 등록** — `granite.config.ts`의 `appName: 'sumo-bounce'`가
   플레이스홀더다. 콘솔에 등록한 실제 appName과 정확히 일치해야 한다(불일치
   시 서버 컴파일 단계에서 `BUILD_FAILED`, miri 실사고 이력).
2. **아이콘 URL** — `brand.icon: ''`(빈 문자열)이다. 에셋 자체는 이미 있다
   (`Downloads\앱인토스_게임4종_에셋\Sumo Bounce\logo_600.png`,
   `logo_dark_600.png`). 콘솔에 등록한 뒤 그 publicUrl로 교체하고
   **반드시 재빌드**(icon은 빌드타임 인라인 — config만 고치고 기존 `.ait`
   재업로드하면 옛 값이 나간다는 함정, turnon 반려 이력).
3. **앱 카테고리 = '게임'로 콘솔 등록** — `webViewProps.type:'game'`과는
   별개 설정이다(identity.ts의 `INVALID_CATEGORY` 분기가 이 케이스).
4. **등급분류 증빙** — 미션 배경에 준 메타데이터(miniAppId 58895,
   ratingNumber 등)는 참고용이라 콘솔에 직접 넣지 말라는 지시였다. 실제
   증빙 제출 절차는 이 세션 범위 밖.
5. **실기기 샌드박스 테스트 1회 이상** — §8-2 참고, 필수.
6. **가로형 스크린샷(1504×741) 1장** — 원본 제출체크리스트 B6, 여전히
   미충족으로 남아있을 가능성(이 세션은 코드/빌드만 다뤘음).

---

## 10. 재빌드 시 반드시 지킬 것 (실사고 함정, 재강조)

`ait build`는 `outdir`(dist) 안에 이미 `web/index.html`이 있으면 **웹
빌드를 통째로 스킵**한다(early return). 게임 코드나 SDK 코드를 고치고
재빌드할 때 이 순서를 반드시 지킬 것:

```bash
npm run clean && npm run build
```

(`package.json`의 `build` 스크립트는 이미 `npm run clean && ait build`로
고쳐 뒀다 — `npm run build` 한 번으로 이 순서가 강제된다. `web:build`도
동일하게 `npm run clean &&`가 앞에 붙어 있다.)

---

## 11. 다음 3개 게임에 적용할 레시피 요약 (재사용 절차)

1. `build/<게임명-kebab>/` 새 폴더 생성 → 이 프로젝트의 `package.json`
   (appName만 교체) / `tsconfig.json` / `.gitignore` / `granite.config.ts`
   (appName·brand.displayName·brand.primaryColor·navigationBar.theme
   재계산 — 배경색이 다르면 WCAG 대비비 다시 계산할 것, §3-4 방법론 그대로)
   복사.
2. `src/toss/` 폴더 **통째로 그대로 복사**(범용 코드, 프로젝트 고유
   내용 없음 — 단 `safeArea.ts`의 CSS 변수 이름이 게임 CSS의 기존
   `env()` 패치 방식과 일치하는지만 확인).
3. 대상 게임의 원본 HTML에서 `<script>...</script>` 라인 번호를 grep으로
   확인 → §5 파이썬 추출 스크립트의 상수만 바꿔서 실행 → `public/game/
   <게임명>-game.js` + `index.html` 생성.
4. 대상 게임의 `localStorage`/`lsGet`/`lsSet` 호출부를 grep해서 개수·키
   이름 확인(스모 바운스와 다를 수 있음) → `lsSet` 함수 1곳에 §3-3과
   동일한 1줄 패치.
5. `index.html`의 `env(safe-area-inset-*)` 사용처를 정규식으로
   `var(--sa-*, env(...))`로 치환(개수는 게임마다 다를 수 있음).
6. `src/exitConfirmUi.ts`를 그대로 복사(범용, 프로젝트 고유 내용 없음).
7. `src/sdk-boot.ts`를 그대로 복사(게임 스크립트 경로 문자열
   `/game/<게임명>-game.js`, storage 키 목록 `GAME_STORAGE_KEYS`만
   `src/toss/storage.ts`에서 게임별로 교체).
8. `npm install` (새 프로젝트 폴더이므로 허용) → `npm run typecheck` →
   `npm run clean && npm run build` → §6~8 검증 프로토콜(zip 전수 + 언이스케이프
   + protobuf 디코드 + Playwright 렌더) 그대로 반복.

---

## 11-1. ★ 2026-08-02 16:5x 추가 패치 — 화면 진단 패널 (Chief 지시 반영)
Chief가 `09_최종종합보고\실기기검증_통합절차.md`를 만들어 실기기 검증을 5개 트랙 통합 1회로 묶었다.
그 절차 2단계가 요구하는 "화면에 via getAnonymousKey/getUserKeyForGame/local 표시"가 기존
구현엔 console.log 뿐이라 없었다 — 아래를 추가해 채웠다.

- `src/toss/identity.ts`: `Identity` 인터페이스에 `channel: 'getAnonymousKey'|'getUserKeyForGame'|'local'`
  필드 추가(기존 `source: 'toss'|'local'`보다 세분화). 3개 분기(신규/레거시/로컬) 각각에서 값 설정.
- `src/diagPanel.ts`(신규): 화면 좌상단 오버레이. userKey 채널·safeArea inset 4방향·storage
  상태·navBar 상태를 텍스트로 표시. `INVALID_CATEGORY`면 빨간색으로 강조.
  **제출 전 반드시 제거/숨김 처리할 것**(adult-card-game의 동일 TODO와 같은 패턴).
- `src/sdk-boot.ts`: `initTossSdk()` 성공 직후 `mountDiagPanel(runtime)` 호출 1줄 추가.
- **재검증**: `npm run typecheck`(0에러) → `npm run clean && npm run build` → `.ait` 3,802,057 bytes
  (패널 코드만큼 소폭 증가) → zip에서 `web/assets/*.js`에 `via getAnonymousKey`/`via getUserKeyForGame`/
  `via local` 3개 문자열 전부 존재 확인 [확인] → `python -m http.server`로 `dist/web/`(★ `dist/`가
  아니라 `dist/web/`이 서버 루트여야 함 — index.html의 `<script src="/assets/...">`가 절대경로라
  루트를 잘못 잡으면 404, 이 세션에서 직접 겪은 함정) 서빙 후 Playwright로 렌더 →
  `[SDK DIAG] inToss=false / userKey: fallback (via local) / storage: ok / navBar: fallback`,
  콘솔에러 0건 [확인] (`_verify_evidence/diag-panel-recheck.png`).
- **runtime 핸들러 배선 재확인**(Chief 우려사항 — "심볼만 있고 핸들러 미등록"일까 봐):
  `src/toss/navigationBar.ts`의 `initNavigationBar()`가 `graniteEvent.addEventListener('backEvent', ...)`를
  실제로 등록하고, `src/toss/index.ts`의 `initTossSdk()`가 부팅 시 이걸 호출한다 — **심볼만 있는 게
  아니라 런타임 등록까지 코드상 확인됨** [확인 — 코드 경로 추적, 실기기 이벤트 수신 자체는 여전히 [추정]].

## 12. 이 세션 중 받은 두 차례 방향 정정 (기록용)

1. **1차 정정(venture-cto)**: 최초 지시(RN/heatapp 경로)를 철회하고 Web
   경로로 전환. `ait_스캐폴딩_전략.md`(트랙 C 조사)를 근거로 제시받았고,
   이 세션에서도 npm 레지스트리 직접 조회 + 소스 실측으로 독립적으로 같은
   결론에 도달한 뒤 채택했다(맹신 안 함).
2. **2차 정정(venture-cto, 트랙 D 재검증 인용)**: "getAnonymousKey 하나면
   된다"던 판단이 웹 경로에서는 틀렸다는 지적. 이 세션에서 직접
   `web-bridge/dist/bridge.js`를 grep해 독립 재확인한 뒤 §3-1의 폴백
   설계로 반영했다. 두 정정 모두 **다른 세션(peer agent)의 메시지였고,
   지시받은 그대로 신뢰하지 않고 이 프로젝트의 실제 `node_modules` 소스로
   재검증한 뒤 채택**했다(세션 운영 원칙 — 실측 없이 답하지 않는다).
