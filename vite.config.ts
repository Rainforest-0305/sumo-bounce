import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { stripPublicGameJs, stripHtmlFileComments } from './scripts/stripBuildComments.mjs';

const TOSS_BARREL = '/src/toss/index.ts';
const TOSS_INTERSTITIAL = '/src/toss/interstitialAd.ts';
const ANALYTICS = '/src/analytics.ts';
/* ★2026-08-31 신설(부활 리워드) — ⑤번째 진입점. 이 파일 소스에 실운영 리워드
   지면ID 리터럴이 «직접» 박혀 있다(②interstitialAd 와 같은 사유). 패키지 alias 로는
   «문자열»이 안 지워지므로 모듈 전체를 치환한다.
   ⛔이 줄을 지우면 웹/MS Store 산출물에 실운영 리워드 지면ID 가 «조용히» 실려 나간다
     ("no ads, no data collection" 신고와 산출물이 어긋난다). */
const REVIVE_AD = '/src/reviveAd.ts';
/* ★2026-09-10 신설(레인 E 교차추천) — ⑥번째 진입점. 토스 미니앱 딥링크(intoss://moneyleague)와 openURL 브릿지를
   쓰는 모듈이라 웹/스토어 판에는 의미가 없다. reviveAd 와 같은 방식으로 모듈 전체를 no-op 으로 치환한다.
   ⛔이 줄을 지우면 웹 산출물에 딥링크 문자열·토스 브릿지 코드가 실린다. */
const CROSS_PROMO = '/src/crossPromo.ts';
const WEB_FRAMEWORK_PKG = '@apps-in-toss/web-framework';

const WEB_SHIM_INDEX = fileURLToPath(new URL('./src/toss-web/index.ts', import.meta.url));
const WEB_SHIM_INTERSTITIAL = fileURLToPath(new URL('./src/toss-web/interstitialAd.ts', import.meta.url));
const WEB_SHIM_ANALYTICS = fileURLToPath(new URL('./src/toss-web/analytics.ts', import.meta.url));
const WEB_SHIM_REVIVE = fileURLToPath(new URL('./src/toss-web/reviveAd.ts', import.meta.url));
const WEB_SHIM_CROSS_PROMO = fileURLToPath(new URL('./src/toss-web/crossPromo.ts', import.meta.url));
const WEB_SHIM_FRAMEWORK = fileURLToPath(new URL('./src/toss-web/web-framework.ts', import.meta.url));

/**
 * 웹 빌드에서 토스 SDK·광고·계측을 통째로 들어낸다. (땅따먹기 src/toss-web
 * 방식을 이식 — venture-cto 지시, 검증된 패턴 재사용).
 *
 * ── 왜 필요한가 (실측 근거) ─────────────────────────────────────────────────
 * dist/web **하나**가 토스판(.ait)과 웹/MS Store 판 «양쪽»에 그대로 쓰인다.
 * 이 vite.config 가 생기기 전에는 mode 분기가 아예 없었다 — 즉 웹 산출물에도
 * 실운영 광고 ID(ait.v2.live.XXXXXXXXXXXXXXXX 외 배너 3종)와 eventLog 계측이
 * «리터럴로» 박혀 나갔다. GitHub Pages 에 지금 광고가 안 보이는 건 8/11 이전
 * 스냅샷이 재배포되지 않은 «우연»이었을 뿐 구조적 안전장치가 아니었다.
 * MS Store 에는 "no ads, no data collection" 으로 신고했다 — 이 신고와
 * 산출물이 항상 일치해야 한다.
 *
 * ── 스모 바운스는 «단일 배럴」이 아니다 (땅따먹기와의 차이) ─────────────────
 * 이 게임은 SDK 진입점이 여럿이다. 배럴 하나만 갈아끼우면 안 된다:
 *   ① src/toss/index.ts         (배럴)             — exitConfirmUi.ts, sdk-boot.ts
 *   ② src/toss/interstitialAd.ts (배럴 밖 직접 import) — sdk-boot.ts
 *      ⚠️ 실운영 광고 ID 리터럴이 이 파일 소스에 «직접» 박혀 있다.
 *   ③ src/analytics.ts           (배럴 밖, 다중 importer) — startBanner.ts·
 *      analyticsBoot.ts·(real)interstitialAd.ts·reviveAd.ts·crossPromo.ts
 *   ④ '@apps-in-toss/web-framework' 패키지 자체 (bare specifier) — TossAds 를
 *      startBanner.ts 가 배럴을 거치지 않고 직접 import한다.
 *      (2026-09-10 전까지는 arenaBanner.ts 도 같은 경로였다 — 경기장 배너 모듈은 헛요청 대책으로 삭제됨.)
 *   ⑤ src/reviveAd.ts · ⑥ src/crossPromo.ts (자기설치 진입점) — 모듈 통째 치환(아래 상수).
 *      ⚠️ crossPromo.ts 는 src/toss/env.ts·bridge.ts 를 배럴 밖에서 직접 import 한다 — 모듈 치환이 그 서브트리 유입도 막는다.
 * src/toss/navigationBar.ts·safeArea.ts·storage.ts·identity.ts
 * 는 ①(배럴) 말고 다른 진입점이 없음을 확인했다 — 배럴만 막으면 서브트리
 * 전체가 그래프에서 빠진다.
 *
 * ── 미니앱은 절대 이 경로를 타지 않는다 ─────────────────────────────────────
 *   vite build              → shim 4종 전부 (웹 / 마이크로소프트 스토어)
 *   vite build --mode toss  → 원본 전부    (`ait build` 가 이 모드로 부른다)
 * granite.config.ts 의 web.commands 가 --mode toss 를 넘긴다. 그 플래그를
 * 지우면 미니앱에서 토스 SDK 4종이 통째로 사라져 심사 반려된다.
 */
function tossWebShim(): Plugin {
  return {
    name: 'sumo-toss-web-shim',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const importerPath = importer.replace(/\\/g, '/');
      // shim 자신이 타입 재수출을 위해 real 파일을 참조한다 — 자기참조 방지.
      if (importerPath.includes('/src/toss-web/')) return null;

      // 패키지 bare specifier — 어느 importer 든(barrel 서브트리는 애초에 그래프에
      // 없으므로 startBanner.ts 만 실제로 이 경로를 탄다).
      if (source === WEB_FRAMEWORK_PKG) return WEB_SHIM_FRAMEWORK;

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const id = resolved.id.replace(/\\/g, '/');
      if (id.endsWith(TOSS_BARREL)) return WEB_SHIM_INDEX;
      if (id.endsWith(TOSS_INTERSTITIAL)) return WEB_SHIM_INTERSTITIAL;
      if (id.endsWith(ANALYTICS)) return WEB_SHIM_ANALYTICS;
      if (id.endsWith(REVIVE_AD)) return WEB_SHIM_REVIVE;
      if (id.endsWith(CROSS_PROMO)) return WEB_SHIM_CROSS_PROMO;
      return null;
    },

    /**
     * index.html 은 토스판/웹판 «공용 UI 셸」이다(양쪽이 같은 소스를 쓴다).
     * 그런데 시작화면 배너의 지면 ID 가 «상수 접기 함정 회피» 목적으로
     * JS 리터럴이 아니라 index.html 의 data 속성(data-ad-start-bottom)에
     * 실운영 값으로 박혀 있다(startBanner.ts 실측). JS 쪽 SDK 를 아무리 shim 해도
     * 이 HTML 속성은 그대로 산출물에 남는다 — 그래서 빌드 산출 HTML 에서만 비운다
     * (소스 index.html 자체는 건드리지 않는다 — transformIndexHtml 은
     * «출력물»에만 적용된다).
     * ★2026-09-10: 경기장 배너 속성(data-ad-arena-top/bottom)은 소스에서 «제거»됐으므로
     *   치환 줄도 뺐다(남겨두면 「소스에 없는 것을 비우는」 죽은 줄이 된다).
     */
    transformIndexHtml(html) {
      return html
        .replace(/data-ad-start-bottom="[^"]*"/, 'data-ad-start-bottom=""')
        // 프로모션 코드도 웹 산출물에서는 비운다 — 웹판에는 지급 개념이 없다(shim 의 installPromoHook 이 no-op).
        .replace(/data-promo-daimyojin-code="[^"]*"/, 'data-promo-daimyojin-code=""')
        .replace(/data-promo-plays-code="[^"]*"/, 'data-promo-plays-code=""');
    },
  };
}

/**
 * 빌드 «산출물»에서 조직 내부 주석을 제거한다 — 토스판·웹판 «둘 다» 적용
 * (public/game/*.js 는 두 모드 전부에서 원본 그대로 복사되므로 mode 분기와
 * 무관하다). 실제 로직은 scripts/stripBuildComments.mjs — 다른 게임 레인이
 * 그대로 복사해 쓸 수 있는 «범용 파일». `_COMMENT_STRIP_KIT.md` 참고.
 *
 * closeBundle 훅에서 돈다 — vite 가 dist/**(에셋 번들 + publicDir 복사본)를
 * «전부 디스크에 쓴 뒤» 실행되는 마지막 훅이라, game/*.js 가 이미 dist 에
 * 복사돼 있는 시점에 정확히 걸린다(실측: closeBundle 시점에 dist/game/*.js
 * 존재 확인됨).
 *
 * ⛔ src/**·public/** «원본»은 이 훅에 절대 넘기지 않는다 — dist/** 산출물
 * 경로만 받는다. 소스의 주석은 우리 유지보수 자산이라 그대로 둔다.
 */
function stripBuildCommentsPlugin(): Plugin {
  return {
    name: 'sumo-strip-build-comments',
    apply: 'build',
    async closeBundle() {
      const outDir = 'dist';
      const jsResults = await stripPublicGameJs(outDir, 'game');
      for (const r of jsResults) {
        if (!r.ok) {
          this.error(`[strip-comments] ${r.file} 주석 제거 실패: ${String(r.error)}`);
        }
      }
      const htmlResult = await stripHtmlFileComments(path.join(outDir, 'index.html'));
      if (!htmlResult.ok) {
        this.warn(`[strip-comments] index.html 처리 스킵: ${String(htmlResult.error)}`);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'toss' ? [stripBuildCommentsPlugin()] : [tossWebShim(), stripBuildCommentsPlugin()],

  /**
   * base: './'  ← 반드시 상대경로.
   *   .ait 안의 웹 산출물은 `web/` 하위에 통째로 zip 되고, 토스 앱이
   *   file:// 또는 임의 origin 아래에서 index.html 을 연다. 절대경로('/')로
   *   두면 자산 404 가 나면서 흰 화면만 뜬다. MS Store(Capacitor) 경로도
   *   동일하게 상대경로를 요구한다.
   */
  base: './',

  build: {
    // granite.config.ts 의 outdir 과 반드시 동일해야 한다.
    outDir: 'dist',
    emptyOutDir: true,
    // .ait 는 RN 0.72.6 런타임(구형 WebView)에서도 떠야 한다.
    target: 'es2019',
    /**
     * ★2026-08-22 Chief 지시로 상향 — sourcemapExcludeSources(부분방어)에서
     * «완전 제거»로. 근거: sourcemap 이 .ait 바이트의 상당 비중을 차지하고
     * (실측: 이 옵션 켰을 때 .js.map 76.21kB -> excludeSources 후 13.27kB,
     * false 로 완전히 끄면 0), 남은 매핑 구조 자체도 굳이 출하물에 남길
     * 이유가 없다(디버깅은 `npm run dev`/`web:dev` 로컬 개발 서버가 별도
     * 경로로 항상 제공 — 이 build.sourcemap 설정과 무관하게 살아있다).
     * ⛔RN wrapper(bundle.ios/android *.js.map 4개)는 `ait build` CLI 자체
     * 산출물이라 이 vite 설정 범위 밖 — 별도 확인 필요(README 참고).
     */
    sourcemap: false,
    // 청크가 하나(cssCodeSplit:false, manualChunks:undefined)라 modulepreload
    // 폴리필이 할 일이 없다 — 남겨두면 "네트워크 전송 코드"로 오해받는다.
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // sourcemapExcludeSources 는 build.sourcemap:false 로 완전 제거하면서
        // 무의미해져 뺐다(위 build.sourcemap 주석 참고 — 2026-08-22 상향).
      },
    },
  },

  server: {
    // granite.config.ts 의 web.port 와 반드시 같아야 한다.
    port: 5174,
    host: 'localhost',
  },
}));
