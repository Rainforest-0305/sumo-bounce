/**
 * 게임 필수 SDK ② — Safe Area
 *
 * ── 구현 방식 ───────────────────────────────────────────────────────────────
 *  SafeAreaInsets.get()            상수 브릿지. 즉시 현재 inset 반환.
 *  SafeAreaInsets.subscribe({...}) 이벤트 브릿지. 회전 등으로 값이 바뀌면 다시 온다.
 *  둘 다 @apps-in-toss/web-framework 공개 export 다.
 *
 *  받은 값을 CSS 변수로 :root 에 꽂는다: --sa-top / --sa-bottom / --sa-left / --sa-right
 *  (원본 게임 index.html 의 12곳 env(safe-area-inset-*) 를 이미
 *  `var(--sa-top, env(safe-area-inset-top))` 형태로 패치해 둬서, 이 변수가
 *  없으면 자동으로 env() 폴백을 쓴다 — src/toss/index.ts 참고)
 *
 * ── 반환 타입 주의 (실측) ───────────────────────────────────────────────────
 *  web-bridge@2.10.8 dist/index.d.ts 기준 top/bottom/left/right 는 **단위
 *  없는 숫자**다. 그대로 CSS 에 넣으면 무효값이라 padding 이 조용히 0 이
 *  된다(에러 없이 실패하는 함정). 반드시 px 를 붙여야 한다. 상수 브릿지가
 *  네이티브 값을 그대로 밀어넣는 자리라 문자열('44'/'44px')이 올 가능성도
 *  배제 못 해 toCssLength() 가 두 경우를 모두 흡수한다.
 *
 * 출처/변경: 트랙 D(territory-clash) src/toss/safeArea.ts 를 가져와
 * (venture-cto 지시) CSS 변수 이름만 이 프로젝트가 이미 index.html 에
 * 적용해 둔 --sa-top/--sa-bottom/--sa-left/--sa-right 로 맞췄다
 * (원본은 --sat/--sar/--sab/--sal).
 */
import { SafeAreaInsets } from '@apps-in-toss/web-framework';
import { safeSync, hasConstant } from './env';

export interface Insets {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function toCssLength(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  if (/[a-z%)]$/i.test(s)) return s; // 이미 단위가 붙어 있으면 그대로 사용
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return `${n}px`;
}

function apply(insets: Partial<Record<keyof Insets, unknown>>): void {
  const root = document.documentElement;
  const map: Array<[keyof Insets, string]> = [
    ['top', '--sa-top'],
    ['right', '--sa-right'],
    ['bottom', '--sa-bottom'],
    ['left', '--sa-left'],
  ];
  for (const [key, cssVar] of map) {
    const v = toCssLength(insets[key]);
    if (v != null) root.style.setProperty(cssVar, v);
  }
}

let unsubscribe: (() => void) | null = null;

/**
 * Safe Area 를 CSS 변수에 반영하고, 변경 구독을 건다.
 * @returns 구독 해제 함수 (게임 종료 시점에 호출)
 */
export function initSafeArea(): () => void {
  if (hasConstant('getSafeAreaInsets')) {
    const initial = safeSync<Record<string, unknown> | null>(
      'SafeAreaInsets.get',
      () => SafeAreaInsets.get() as unknown as Record<string, unknown>,
      null
    );
    if (initial) {
      apply(initial);
      console.log('[toss-sdk][safeArea] initial insets =', initial);
    }
  } else {
    // 상수 핸들러가 없으면(토스 밖) index.html 의 env() 폴백을 그대로 유지한다.
    console.log('[toss-sdk][safeArea] constant bridge unavailable, using CSS env() fallback');
  }

  unsubscribe = safeSync(
    'SafeAreaInsets.subscribe',
    () =>
      SafeAreaInsets.subscribe({
        onEvent: (next) => {
          apply(next);
          console.log('[toss-sdk][safeArea] insets changed =', next);
        },
      }),
    () => {}
  );

  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
