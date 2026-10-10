/**
 * 스모 바운스 — 결과 화면 「머니 리그」 교차추천 카드(하루 1회). 레인 E · 2026-09-10 · 2주 실험.
 *
 * ═══ 규칙(공통 지시서 §5) ═══
 *   · 결과 화면(#sc-result)에 «하루 1회». 닫기 가능. 그날 이미 보였으면 안 보인다.
 *   · 「하루」의 정본은 src/lib/daykey.ts 의 kstDateKey()(KST 날짜키). 두 벌 만들지 않는다.
 *   · 열기 = openURL('intoss://moneyleague'). web-framework 재수출 배럴에는 openURL 이 없어(d.ts 실측)
 *     src/toss/bridge.ts 가 createAsyncBridge('openURL') 로 선언해 둔 것을 safeBridge 로 감싸 쓴다.
 *   · 토스 밖(브릿지 없음)에서는 카드를 «그리지 않는다». 웹/스토어 빌드에서는 이 모듈 자체가
 *     src/toss-web/crossPromo.ts(no-op)로 치환된다(vite.config.ts) — 딥링크 문자열도 웹 번들에 안 실린다.
 *   · 노출·열기·닫기는 기존 계측 규약(analytics.ts track → eventLog)으로 남기고, 로컬에도 카운터만 둔다.
 *     ⛔「순사용자 증가」라고 쓰지 않는다 — 여기서 알 수 있는 건 노출·탭 수뿐이다.
 *
 * ═══ 저장 ═══
 *   새 키 `sumobounce.xpromo.v1` = {d: 마지막 노출일(KST), shows, opens, closes}. localStorage 만(부활 리워드
 *   `sumobounce.revive.v1` 과 같은 방식). 게임 세이브(sumoSave)·광고 카운터(sumo:ads.v2) 무접촉.
 *
 * ═══ 화면 ═══
 *   game.js 는 무접촉이다. showScreen() 이 #sc-result 의 hidden 클래스를 토글하므로 MutationObserver 로
 *   hidden→visible 전이를 잡는다(game.js 자신도 결과 화면 카운트업에 같은 방식을 쓴다, 4081행).
 *   카드는 .panel 안 «#res-stats 뒤 · .cta-pad 앞»에 들어간다 — 스크롤 영역이라 sticky CTA(다음 판·메뉴)를
 *   가리지 않고, 전면광고 게이트(결과 버튼 capture 리스너)와 DOM 이 겹치지 않는다.
 *   결과 화면을 벗어나면 카드를 제거한다(같은 날 다시 보이지 않는 건 원장이 막는다).
 *
 * ═══ 게임 오버레이 규칙(CLAUDE.md·DESIGN.md §7) ═══
 *   backdrop-filter 0 · 애니메이션은 opacity/transform 1회 · 터치 타깃 ≥44(열기·닫기) · 색은 DESIGN.md 토큰
 *   (index.html 의 CSS 변수를 그대로 참조, 새 색 0) · 문자열 길이 가정 없음(keep-all + anywhere).
 */
import { isInToss } from './toss/env';
import { openURL } from './toss/bridge';
import { kstDateKey, isDateKey } from './lib/daykey';
import { track } from './analytics';

/**
 * game.js 가 전역에 두는 «스크롤 활주로» 함수(index.html 의 .cta-pad 주석 참고). showScreen() 이 화면을 열 때 한 번
 * 계산하는데, 그 시점엔 이 카드가 아직 없다 — 카드만큼 늘어난 콘텐츠 꼬리가 sticky CTA 바 밑에 깔려 「열기」가
 * 끝까지 스크롤해도 닿지 않는다(2026-09-10 headless 스크린샷 실측). 그래서 삽입·제거 «뒤»에 같은 함수를 다시 부른다.
 * ⛔game.js 는 무접촉 — 이미 있는 전역을 typeof 가드로 «부르기만» 한다(soloGate/reviveAd 가 게임 전역을 읽던 관례).
 */
declare const syncCtaPad: undefined | ((el?: HTMLElement | null) => void);

/** 머니 리그 미니앱 딥링크(Partner 확정값 — 글자 그대로). */
export const MONEY_LEAGUE_URL = 'intoss://moneyleague';

const KEY = 'sumobounce.xpromo.v1';
const RESULT_SCREEN_ID = 'sc-result';
const CARD_ID = 'sb-xpromo';
/** 「열기」 연타 잠금. 브릿지가 앱을 전환하는 동안 두 번 나가지 않게. */
const OPEN_LOCK_MS = 1500;
/**
 * openURL 브릿지 무응답 상한. ⛔bridge-core 는 응답이 없으면 «영원히 pending» 이라 경쟁(race)이 필수다.
 * ★넘긴 경우를 «실패로 단정하지 않는다» — 그 사이 머니 리그가 실제로 열렸을 수 있다(레인 D 정본과 같은 판단).
 */
const OPEN_TIMEOUT_MS = 4000;

/**
 * 열기 결과.
 *   'ok'      네이티브가 resolve 했다
 *   'failed'  reject·동기 throw·토스 밖 — 유저에게 «그 자리에서» 사유를 보인다
 *   'unknown' 무응답 — 열렸을 수도 있다. 문구를 바꾸지 «않는다»(거짓 실패 표시 금지)
 */
type OpenOutcome = 'ok' | 'failed' | 'unknown';

interface XpromoRecord {
  /** 마지막으로 카드가 «보인» 날(KST 'YYYY-MM-DD'). */
  d?: string;
  shows?: number;
  opens?: number;
  closes?: number;
}

/* ─────────────────────── 원장(localStorage) ─────────────────────── */

/**
 * ★세션 기억 (2026-09-10 Codex 리뷰 결함 2 반영).
 *   [확인: 모의실행] `localStorage.setItem` 이 실패하는 기기(용량 초과·시크릿 모드)에서는 저장이 조용히 삼켜져
 *   「하루 1회」와 「닫으면 그날은 안 보임」이 «둘 다» 깨졌다(표시 2회·닫기 1회 뒤 카드 재등장).
 *   ⇒ 저장소를 «유일한 진실»로 두지 않는다. 이 세션 동안의 판정은 메모리가 함께 기억한다.
 *   저장이 되는 기기에서는 종전과 동일하게 동작하고, 안 되는 기기에서는 최소한 «그 세션»은 약속을 지킨다.
 */
let memDay: string | null = null;   // 이 세션에서 카드를 «보인» 날(KST 날짜키)

function read(): XpromoRecord {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    // ★배열도 typeof 로는 'object' 다 — `[]` 가 그대로 통과해 기록처럼 쓰였다(결함 2).
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const rec = o as XpromoRecord;
    // ★날짜키는 «형식까지» 확인한다(레인 D 정본 규율). 깨진 값이면 「오늘 아직 안 보였다」로 본다 —
    //   그래야 「d 에 쓰레기가 들어가 카드가 영영 안 뜨는」 조용한 고장이 안 난다.
    if (!isDateKey(rec.d)) delete rec.d;
    return rec;
  } catch {
    return {}; // 깨진 기록 = 없는 것
  }
}

function write(rec: XpromoRecord): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* quota / private mode — 저장은 못 해도 위 memDay/memClosed 가 이 세션의 약속을 지킨다 */
  }
}

function bump(field: 'shows' | 'opens' | 'closes', stampDay: boolean): void {
  // ★메모리를 «먼저» 갱신한다 — 저장이 실패해도 이 세션의 약속은 지켜야 한다(결함 2).
  //   「닫으면 그날은 다시 안 보인다」도 이 한 줄로 성립한다: 카드를 «보인» 순간 그날이 소진되므로
  //   닫기 뒤 재진입은 canShowToday() 에서 memDay 로 막힌다(저장 실패 여부와 무관).
  if (stampDay) memDay = kstDateKey();
  const rec = read();
  const cur = rec[field];
  rec[field] = (typeof cur === 'number' && Number.isFinite(cur) ? cur : 0) + 1;
  if (stampDay) rec.d = kstDateKey();
  write(rec);
}

/** 오늘 결과 화면에 카드를 띄워도 되는가 — 토스 안 + 오늘 아직 안 보임(저장소 «또는» 이 세션의 기억). */
function canShowToday(): boolean {
  if (!isInToss()) return false;
  const today = kstDateKey();
  if (memDay === today) return false;   // 저장이 실패해도 이 세션에서는 다시 안 보인다
  return read().d !== today;
}

/* ─────────────────────── 문구 ─────────────────────── */

type Lang = 'ko' | 'en';
function uiLang(): Lang {
  try {
    if ((document.documentElement.lang || '').toLowerCase().startsWith('en')) return 'en';
  } catch {
    /* noop */
  }
  return 'ko';
}

const MSG: Record<Lang, Record<string, string>> = {
  ko: {
    tag: '추천',
    title: '머니 리그',
    sub: '1만 명 봇 리그에서 가상 투자',
    go: '열기',
    close: '닫기',
    aria: '머니 리그 추천',
    fail: '머니 리그를 열지 못했어요',
  },
  en: {
    tag: 'Suggested',
    title: 'Money League',
    sub: 'Paper trading in a 10,000-bot league',
    go: 'Open',
    close: 'Close',
    aria: 'Money League suggestion',
    fail: 'Could not open Money League',
  },
};

/* ─────────────────────── 카드 ───────────────────────
 * 팔레트는 index.html :root 변수(DESIGN.md 토큰)만 참조한다 — 새 색 0.
 * 결과 화면의 .statlist(카드 배경 --card · 테두리 --line · 반경 --r-l)와 같은 결로 앉힌다. */

const CSS = [
  '#' + CARD_ID + '{position:relative;width:100%;box-sizing:border-box;padding:14px 14px 12px;',
  'border-radius:var(--r-l,22px);background:var(--card,#181113);border:1px solid var(--line,rgba(255,236,214,.09));',
  'box-shadow:0 14px 28px -12px rgba(0,0,0,.6);color:var(--txt,#f6efe6);text-align:left;',
  'word-break:keep-all;overflow-wrap:anywhere;',
  'animation:sbXpIn .5s var(--ez,cubic-bezier(.16,1,.3,1)) both .18s}',
  '@keyframes sbXpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
  '#' + CARD_ID + ' .xpRow{display:flex;align-items:flex-start;gap:12px}',
  '#' + CARD_ID + ' .xpMark{flex:0 0 auto;width:44px;height:44px;border-radius:14px;background:var(--card2,#241a1d);',
  'display:flex;align-items:center;justify-content:center}',
  '#' + CARD_ID + ' .xpMark svg{width:26px;height:26px;display:block}',
  '#' + CARD_ID + ' .xpText{flex:1 1 auto;min-width:0;padding-top:1px}',
  '#' + CARD_ID + ' .xpTitleRow{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
  '#' + CARD_ID + ' .xpTitle{margin:0;font-size:17px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:var(--txt,#f6efe6)}',
  '#' + CARD_ID + ' .xpTag{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;',
  'font-size:11px;line-height:1;font-weight:700;letter-spacing:.02em;color:var(--dim2,#a89a8c);border:1px solid rgba(255,236,214,.13)}',
  '#' + CARD_ID + ' .xpSub{margin:4px 0 0;font-size:13px;line-height:1.45;color:var(--dim,#c2b5a8)}',
  /* 실패 사유는 «그 자리에서» 보인다(토스트는 결과 화면에서 놓친다 — reviveAd.ts 규격 6과 같은 판단). */
  '#' + CARD_ID + ' .xpSub.err{color:var(--red,#ff5a5f)}',
  '#' + CARD_ID + ' .xpClose{flex:0 0 auto;width:36px;height:36px;margin:-6px -6px 0 0;border:0;border-radius:12px;',
  'background:transparent;color:var(--dim2,#a89a8c);cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit}',
  '#' + CARD_ID + ' .xpClose svg{width:16px;height:16px;display:block}',
  '#' + CARD_ID + ' .xpClose:hover{color:var(--txt,#f6efe6);background:rgba(255,236,214,.06)}',
  '#' + CARD_ID + ' .xpClose:active{transform:scale(.92)}',
  '#' + CARD_ID + ' .xpGo{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:12px 0 0;',
  'border:1px solid rgba(255,236,214,.13);border-radius:var(--r-m,18px);background:var(--card2,#241a1d);color:var(--txt,#f6efe6);',
  'font:inherit;font-size:15px;font-weight:700;letter-spacing:-.01em;cursor:pointer;',
  'transition:background .2s ease,border-color .2s ease,transform .16s var(--ez,cubic-bezier(.16,1,.3,1))}',
  '#' + CARD_ID + ' .xpGo:hover{background:#2c2024;border-color:rgba(255,236,214,.2)}',
  '#' + CARD_ID + ' .xpGo:active{transform:scale(.978)}',
  '#' + CARD_ID + ' .xpGo[disabled]{opacity:.55;pointer-events:none}',
  '@media (prefers-reduced-motion:reduce){#' + CARD_ID + '{animation:none}}',
].join('');

let styleInjected = false;
function ensureStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = CARD_ID + '-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function svg(paths: string[], stroke: string): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', stroke);
  s.setAttribute('stroke-width', '2.2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
  }
  return s;
}

let card: HTMLElement | null = null;
let openLockUntil = 0;

/** 카드가 들어가거나 빠진 «뒤» 결과 화면의 스크롤 활주로(.cta-pad)와 「더 있음」 큐를 게임 로직으로 다시 잰다. */
function relayoutResult(): void {
  try {
    const sc = document.getElementById(RESULT_SCREEN_ID);
    if (sc && typeof syncCtaPad === 'function') syncCtaPad(sc);
  } catch {
    /* 활주로 재계산 실패는 카드가 조금 덜 보일 뿐 — 게임은 산다 */
  }
}

function removeCard(): void {
  const el = card;
  card = null;
  if (!el) return;
  el.remove();
  relayoutResult();
}

function buildCard(): HTMLElement {
  const m = MSG[uiLang()];
  const root = document.createElement('section');
  root.id = CARD_ID;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', m.aria);

  const row = document.createElement('div');
  row.className = 'xpRow';

  const mark = document.createElement('div');
  mark.className = 'xpMark';
  // 오르는 추세선 — 「가상 투자」의 도상. 등롱 금(--gold) 획.
  mark.appendChild(svg(['M4 17.5 9.5 12l3.5 3.5L20 8', 'M15.5 8H20v4.5'], 'var(--gold,#ffc94a)'));

  const text = document.createElement('div');
  text.className = 'xpText';
  const titleRow = document.createElement('div');
  titleRow.className = 'xpTitleRow';
  const title = document.createElement('h3');
  title.className = 'xpTitle';
  title.textContent = m.title;
  const tag = document.createElement('span');
  tag.className = 'xpTag';
  tag.textContent = m.tag; // 라벨은 제목 «옆»에 — 제목 위 아이브로우는 DESIGN.md §7 금지.
  titleRow.appendChild(title);
  titleRow.appendChild(tag);
  const sub = document.createElement('p');
  sub.className = 'xpSub';
  sub.textContent = m.sub;
  text.appendChild(titleRow);
  text.appendChild(sub);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'xpClose';
  close.setAttribute('aria-label', m.close);
  close.appendChild(svg(['M6 6l12 12', 'M18 6L6 18'], 'currentColor'));
  close.addEventListener('click', onClose);

  row.appendChild(mark);
  row.appendChild(text);
  row.appendChild(close);

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'xpGo';
  go.textContent = m.go;
  go.addEventListener('click', () => void onOpen(go));

  root.appendChild(row);
  root.appendChild(go);
  return root;
}

function onClose(): void {
  bump('closes', false);
  track('xpromo_close', { surface: 'result', target: 'moneyleague' });
  removeCard();
}

/**
 * 머니 리그 열기. 절대 throw 하지 않는다.
 * ⛔`safeBridge` 를 쓰지 않는 이유: 그건 실패·타임아웃을 «같은 폴백»으로 뭉갠다. 여기서는 둘을 갈라야
 *   「열지 못했어요」를 «정말 실패했을 때만» 보일 수 있다(무응답에 실패 문구를 띄우면 거짓말이 된다).
 */
async function openLeague(): Promise<OpenOutcome> {
  if (!isInToss()) return 'failed';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<OpenOutcome>([
      openURL(MONEY_LEAGUE_URL).then((): OpenOutcome => 'ok'),
      new Promise<OpenOutcome>((resolve) => {
        timer = setTimeout(() => resolve('unknown'), OPEN_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return 'failed';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function onOpen(btn: HTMLButtonElement): Promise<void> {
  const now = Date.now();
  if (now < openLockUntil) return;
  openLockUntil = now + OPEN_LOCK_MS;
  const mine = card;
  btn.disabled = true;
  bump('opens', false);
  track('xpromo_open', { surface: 'result', target: 'moneyleague' });
  // 실기기에서 intoss://moneyleague 가 실제로 머니 리그를 여는지는 [미확인] — Partner 테스트 푸시로 본다.
  const outcome = await openLeague();
  if (outcome !== 'ok') track('xpromo_open_result', { surface: 'result', target: 'moneyleague', outcome });
  if (card !== mine || !mine) return; // 그 사이 화면이 갈렸다 — 죽은 노드를 건드리지 않는다
  btn.disabled = false;
  const sub = mine.querySelector('.xpSub');
  if (!sub) return;
  const m = MSG[uiLang()];
  // 'unknown'(무응답)은 열렸을 수 있으므로 문구를 바꾸지 않는다. 'failed' 만 사유를 보인다.
  sub.textContent = outcome === 'failed' ? m.fail : m.sub;
  sub.classList.toggle('err', outcome === 'failed');
}

/** 결과 화면이 «막» 보였다. 오늘 첫 번째면 카드를 앉히고 노출일을 «지금» 기록한다(닫기·열기와 무관). */
function onResultShown(sc: HTMLElement): void {
  try {
    if (card && card.isConnected) return;
    if (!canShowToday()) return;
    const panel = sc.querySelector('.panel');
    if (!panel) return;
    ensureStyle();
    card = buildCard();
    const pad = panel.querySelector('.cta-pad');
    if (pad) panel.insertBefore(card, pad);
    else panel.appendChild(card);
    relayoutResult(); // ★카드만큼 늘어난 콘텐츠가 sticky CTA 바 밑에 깔리지 않게 — 활주로·스크롤 큐 재계산
    bump('shows', true);
    track('xpromo_show', { surface: 'result', target: 'moneyleague' });
  } catch (e) {
    console.error('[xpromo] 카드 생성 실패 (결과 화면은 그대로):', e);
    removeCard();
  }
}

export function installCrossPromo(): void {
  try {
    if (!isInToss()) return; // 토스 밖에서는 «통째로» 안 그린다(관찰도 안 한다)
    const sc = document.getElementById(RESULT_SCREEN_ID);
    if (!sc || typeof MutationObserver === 'undefined') return;
    let wasHidden = sc.classList.contains('hidden');
    new MutationObserver(() => {
      const hid = sc.classList.contains('hidden');
      if (wasHidden && !hid) onResultShown(sc);
      else if (!wasHidden && hid) removeCard();
      wasHidden = hid;
    }).observe(sc, { attributes: true, attributeFilter: ['class'] });
  } catch (e) {
    console.error('[xpromo] install failed (게임은 계속 진행):', e);
  }
}

installCrossPromo();
