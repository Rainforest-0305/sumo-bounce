/**
 * 게임 심사 G3 — 종료 확인 모달
 *
 * ★ 원본 게임(public/game/sumo-bounce-game.js)은 history API 를 전혀 쓰지
 *   않는다(popstate 0건, pushState/replaceState 0건 — 원본 제출체크리스트
 *   C12·C13 실측). 화면 전환은 전부 DOM 클래스 토글이다. 즉 OS/하드웨어
 *   뒤로가기에 대응하는 화면 스택이 게임 안에 없다 — 그래서 이 모달은 "지금
 *   어느 화면인지"를 구분하지 않고, 뒤로가기가 눌리면 항상 "정말
 *   종료하시겠습니까?"를 띄운다.
 *
 * ★ 구현은 src/toss/navigationBar.ts 의 pushBackHandler 위에 얹는다(직접
 *   graniteEvent 를 구독하지 않는다) — 이유:
 *     1) navigationBar.ts 가 이미 backEvent 구독 + isInToss 분기(토스 밖에서는
 *        popstate 로 대체) + safeSync 방어를 전부 처리한다. 중복 구현 금지.
 *     2) 핸들러가 true 를 반환하면 기본 동작(자동 closeView)이 억제된다
 *        (navigationBar.ts:handleBack). 모달을 띄우고 "종료" 버튼을 눌러야만
 *        exitMiniApp() 이 실제로 불린다 — 오조작으로 바로 앱이 꺼지는 일이
 *        없다.
 */
import { pushBackHandler, exitMiniApp } from './toss';

const OVERLAY_ID = 'sdk-exit-confirm-overlay';

function buildOverlay(onConfirm: () => void, onCancel: () => void): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'background:rgba(6,8,12,.72)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'width:min(320px,86vw)',
    'background:#151b26',
    'border:1px solid rgba(255,255,255,.09)',
    'border-radius:16px',
    'padding:22px 20px 16px',
    'text-align:center',
    'color:#f2f4f8',
    'box-shadow:0 12px 40px rgba(0,0,0,.45)',
  ].join(';');

  const title = document.createElement('p');
  title.textContent = '게임을 종료할까요?';
  title.style.cssText = 'margin:0 0 6px;font-size:16px;font-weight:700;';

  const sub = document.createElement('p');
  sub.textContent = '진행 중인 대전은 저장되지 않아요.';
  sub.style.cssText = 'margin:0 0 18px;font-size:13px;color:#9aa3b2;';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = '계속하기';
  cancelBtn.style.cssText =
    'flex:1;padding:11px 0;border-radius:10px;border:1px solid rgba(255,255,255,.14);' +
    'background:transparent;color:#f2f4f8;font-size:14px;font-weight:600;';
  cancelBtn.addEventListener('click', onCancel);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = '종료';
  confirmBtn.style.cssText =
    'flex:1;padding:11px 0;border-radius:10px;border:none;' +
    'background:#e8552b;color:#fff;font-size:14px;font-weight:700;';
  confirmBtn.addEventListener('click', onConfirm);

  row.append(cancelBtn, confirmBtn);
  card.append(title, sub, row);
  overlay.append(card);
  return overlay;
}

function showExitConfirm(): void {
  if (document.getElementById(OVERLAY_ID) !== null) {
    return; // 이미 떠 있으면 중복 표시하지 않는다.
  }

  const close = () => {
    document.getElementById(OVERLAY_ID)?.remove();
  };

  const overlay = buildOverlay(
    () => {
      close();
      void exitMiniApp();
    },
    close
  );

  document.body.appendChild(overlay);
}

/**
 * 뒤로가기를 소비해 종료 확인 모달을 띄운다. 항상 true(소비)를 반환하므로
 * navigationBar.ts 의 기본 동작(자동 closeView)은 절대 자동으로 일어나지
 * 않는다 — 사용자가 모달의 "종료"를 눌러야만 exitMiniApp() 이 호출된다.
 * @returns 핸들러 해제 함수
 */
export function installExitConfirm(): () => void {
  return pushBackHandler(() => {
    showExitConfirm();
    return true;
  });
}
