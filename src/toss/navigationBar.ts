/**
 * 게임 필수 SDK ④ — 내비게이션 바 (런타임부) + 종료 확인(G3) 배선처
 *
 * ── 두 조각으로 이루어져 있다. 둘 다 해야 "적용"이다 ────────────────────────
 *  (A) 선언부 — granite.config.ts 의 navigationBar { ... }. 빌드타임 고정값
 *      (뒤로가기 버튼 유무/제목/투명배경/테마). 여기(웹 코드)에는 안 들어간다.
 *  (B) 런타임부 — 이 파일. graniteEvent 'backEvent'/'homeEvent' 를 받아 처리한다.
 *      (B)를 안 하면 뒤로가기 버튼이 눌려도 아무 일도 안 일어난다 = 반려.
 *
 * ── 종료 확인 모달(G3)과의 관계 ────────────────────────────────────────────
 *  pushBackHandler 로 등록한 핸들러가 true 를 반환하면 "내가 처리했다"는
 *  뜻이라 기본 동작(closeView 자동 호출)이 스킵된다. 스모 바운스의 종료
 *  확인 모달(src/exitConfirmUi.ts)은 이 핸들러 하나로 구현된다:
 *    - 뒤로가기 → 모달 표시 → true 반환(자동 종료 억제)
 *    - 모달의 "종료" 버튼 → exitMiniApp() 직접 호출
 *    - 모달의 "계속하기" 버튼 → 아무 것도 안 함(이미 소비됨)
 *  원본 게임(public/game/sumo-bounce-game.js)은 history API 를 쓰지 않아
 *  (popstate/pushState 0건, 원본 제출체크리스트 C12·C13 실측) 화면별 스택이
 *  없다 — 그래서 이 핸들러는 "어느 화면에 있든" 무조건 종료 확인을 띄운다.
 *
 * 출처/변경: 트랙 D(territory-clash) src/toss/navigationBar.ts 를 그대로
 * 가져왔다(venture-cto 지시 — 검증된 패턴 재사용). partner.addAccessoryButton
 * 관련 옵션은 스모 바운스가 쓰지 않지만(범용 API라 유지), 커스텀 이벤트
 * 이름만 'tc:nav-home' → 'sumo:nav-home' 으로 바꿨다.
 */
import { graniteEvent, tdsEvent, partner } from '@apps-in-toss/web-framework';
import { closeView } from './bridge';
import { isInToss, safeSync, safeBridge } from './env';

/** true 를 반환하면 소비(=앱 종료 안 함), false/void 면 다음 핸들러로 넘어간다. */
export type BackHandler = () => boolean | void;

const backHandlers: BackHandler[] = [];

/**
 * 뒤로가기 핸들러 등록. 나중에 등록된 것이 먼저 호출된다(모달 > 게임 > 메뉴).
 * @returns 해제 함수
 */
export function pushBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.indexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

async function handleBack(): Promise<void> {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    let consumed = false;
    try {
      consumed = backHandlers[i]!() === true;
    } catch (err) {
      console.warn('[toss-sdk][nav] back handler threw:', err);
    }
    if (consumed) return;
  }
  console.log('[toss-sdk][nav] no handler consumed backEvent, closing view');
  await safeBridge('closeView', () => closeView(), undefined);
}

export interface NavigationBarOptions {
  accessoryButton?: { id: string; title: string; iconName: string };
  onAccessoryPress?: (id: string) => void;
}

let disposers: Array<() => void> = [];

/**
 * 내비게이션 바 런타임 연동을 시작한다.
 * @returns 해제 함수
 */
export function initNavigationBar(options: NavigationBarOptions = {}): () => void {
  if (!isInToss()) {
    // 토스 밖(로컬 vite dev 등)에서는 브라우저 뒤로가기를 같은 경로로 잇는다
    // — 로컬 검증 시에도 종료확인 모달 동작을 눈으로 볼 수 있게.
    const onPop = () => void handleBack();
    window.addEventListener('popstate', onPop);
    disposers.push(() => window.removeEventListener('popstate', onPop));
    console.log('[toss-sdk][nav] not in Toss, bound popstate instead');
    return dispose;
  }

  disposers.push(
    safeSync(
      'graniteEvent.backEvent',
      () =>
        graniteEvent.addEventListener('backEvent', {
          onEvent: () => {
            console.log('[toss-sdk][nav] backEvent');
            void handleBack();
          },
          onError: (e) => console.warn('[toss-sdk][nav] backEvent error', e),
        }),
      () => {}
    )
  );

  // withHomeButton:false 라 현재는 안 뜨지만, 켜는 순간 핸들러가 없으면
  // 먹통이 되므로 미리 붙여둔다.
  disposers.push(
    safeSync(
      'graniteEvent.homeEvent',
      () =>
        graniteEvent.addEventListener('homeEvent', {
          onEvent: () => {
            console.log('[toss-sdk][nav] homeEvent');
            window.dispatchEvent(new CustomEvent('sumo:nav-home'));
          },
          onError: (e) => console.warn('[toss-sdk][nav] homeEvent error', e),
        }),
      () => {}
    )
  );

  if (options.accessoryButton) {
    const { id, title, iconName } = options.accessoryButton;
    void safeBridge(
      'partner.addAccessoryButton',
      () => partner.addAccessoryButton({ id, title, icon: { name: iconName } }),
      undefined
    );
    disposers.push(
      safeSync(
        'tdsEvent.navigationAccessoryEvent',
        () =>
          tdsEvent.addEventListener('navigationAccessoryEvent', {
            onEvent: ({ id: pressedId }) => {
              console.log('[toss-sdk][nav] accessory pressed', pressedId);
              options.onAccessoryPress?.(pressedId);
            },
          }),
        () => {}
      )
    );
    disposers.push(() => {
      void safeBridge('partner.removeAccessoryButton', () => partner.removeAccessoryButton(), undefined);
    });
  }

  console.log('[toss-sdk][nav] navigation bar wired (back/home listeners active)');
  return dispose;
}

function dispose(): void {
  for (const d of disposers) {
    try {
      d();
    } catch {
      /* noop */
    }
  }
  disposers = [];
}

/** 게임 코드에서 "지금 미니앱을 닫아라"가 필요할 때 쓴다(종료확인 모달의 "종료" 버튼 등). */
export async function exitMiniApp(): Promise<void> {
  await safeBridge('closeView', () => closeView(), undefined);
}
