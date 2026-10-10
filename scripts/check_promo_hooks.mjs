#!/usr/bin/env node
/**
 * ★프로모션 훅(다이묘진 해금 30원) «단위검사» — 실제 `src/toss/promoCore.ts` 를 «불러서» 돌린다. (2026-08-29)
 *
 *   node scripts/check_promo_hooks.mjs            본검사(코어 실행 + 소스 정적검사) + 양성대조
 *
 * ⛔규칙을 이 파일에 «다시 구현하지» 않는다 — 실제 모듈을 import 한다(Node 24 타입 스트리핑).
 *   promoCore.ts 는 런타임 import 0(bridge 는 type-only) 이라 그대로 읽힌다.
 *
 * ★양성대조(검사기가 «잡는지» 먼저 증명 — 「0건은 부재의 증거가 아니다」)
 *   P1 락 제거 사본 → 같은 세션 2회 호출이 «2회» 검출된다
 *   P2 문턱 변조 사본(= 1) → 정적검사가 «불합격»을 낸다
 *   P3 옛 «단일키·코드무관» 사본 → 코드 교체 시 «차단(already)» 결함이 재현된다(현 코어는 granted)
 *
 * ⚠️이 검사기가 «못 보는» 것: 게임이 훅을 «실제로 부르는지»(→ verify_promo_headless.py) ·
 *   .ait 에 «실렸는지»(→ ait_scan_promo.py) · 실기기 브릿지 응답·토스 알림 횟수(→ TESTONLY 실기기).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CODE = '__PROMOTION_CODE__';
const AMOUNT = 30;

const coreSrc = readFileSync(resolve(ROOT, 'src/toss/promoCore.ts'), 'utf8');
const C = await import(pathToFileURL(resolve(ROOT, 'src/toss/promoCore.ts')).href);

const errs = [];
const push = (m) => errs.push(m);
const eq = (a, b, m) => {
  if (a !== b) push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

/* ── 가짜 의존성: 저장은 «코드별 키»(promotion.ts 와 같은 규칙) ─────────────── */
function fakeDeps(opts = {}) {
  const store = new Map(); // key = 'sumo:promo.v1:' + code
  const calls = [];
  let cfg = { code: CODE, amount: AMOUNT, ...(opts.cfg || {}) };
  let seq = 0;
  const keyOf = opts.singleKey ? () => 'single' : (code) => 'sumo:promo.v1:' + code;
  const deps = {
    inToss: () => (opts.inToss === undefined ? true : opts.inToss),
    readConfig: () => cfg,
    loadRecord: async (code) => {
      if (opts.loadFails) throw new Error('load fail');
      return store.get(keyOf(code)) ?? {};
    },
    saveRecord: async (code, rec) => {
      if (opts.saveFails) throw new Error('save fail');
      store.set(keyOf(code), rec);
    },
    callBridge: async (method, params) => {
      calls.push({ method, params });
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      const fn = opts.respond ?? (() => ({ key: 'K' + ++seq }));
      return fn(method, params, calls.length);
    },
    now: () => 1_700_000_000_000,
    log: () => {},
  };
  return { deps, store, calls, setCfg: (c) => (cfg = { ...cfg, ...c }) };
}

/* ── ① 지급 코어(락·기록·브릿지) ─────────────────────────────────────────── */
async function testCore(Core = C, label = '') {
  const L = (m) => `${label}${m}`;
  // 해금 → 정확히 1회, 코드·금액이 카드와 «정확히» 같다
  {
    const { deps, calls, store } = fakeDeps();
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'granted', L('해금 outcome'));
    eq(calls.length, 1, L('해금 → 브릿지 1회'));
    eq(calls[0].method, 'grantPromotionReward', L('현행 API 먼저'));
    eq(calls[0].params.promotionCode, CODE, L('코드 전달'));
    eq(calls[0].params.amount, 30, L('금액 = 카드 금액 30(고정)'));
    const rec = store.get('sumo:promo.v1:' + CODE);
    eq(rec?.grantedAt, 1_700_000_000_000, L('성공 «직후» 기록'));
    eq(rec?.key, 'K1', L('리워드 키 기록'));
    eq(rec?.code, CODE, L('★기록에 프로모션 코드 저장'));
    eq([...store.keys()].join(','), 'sumo:promo.v1:' + CODE, L('★저장 키가 코드별'));
    // 재해금(같은 세션) → 락. 브릿지 여전히 1회
    eq(await c.claim(), 'locked', L('재호출 → locked'));
    eq(calls.length, 1, L('★재호출 → 브릿지 «여전히» 1회'));
    eq(c.settled(), true, L('settled'));
  }
  // ★세션 락: 기록 저장이 «실패»해도 같은 세션에서 두 번 못 부른다
  {
    const { deps, calls } = fakeDeps({ saveFails: true });
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'granted', L('저장 실패해도 granted'));
    eq(await c.claim(), 'locked', L('★저장 실패 + 재호출 → locked'));
    eq(calls.length, 1, L('저장 실패 시나리오 브릿지 1회'));
  }
  // 동시 호출(in-flight) → 1회
  {
    const { deps, calls } = fakeDeps({ delayMs: 20 });
    const c = Core.createPromoClaimer(deps);
    const r = await Promise.all([c.claim(), c.claim(), c.claim()]);
    eq(r.join(','), 'granted,granted,granted', L('동시 3회 = 같은 promise'));
    eq(calls.length, 1, L('★동시 3회 호출 → 브릿지 1회'));
  }
  // 새 세션 + 로컬 기록 있음 → already, 브릿지 0회 (재해금 시 미호출)
  {
    const { deps, calls, store } = fakeDeps();
    store.set('sumo:promo.v1:' + CODE, { grantedAt: 1, code: CODE });
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'already', L('기록 있음(같은 코드) → already'));
    eq(calls.length, 0, L('기록 있음 → 브릿지 0회'));
    eq(await c.alreadyRewarded(), true, L('alreadyRewarded'));
  }
  // 4113 → already + 기록 복원
  {
    const { deps, calls, store } = fakeDeps({ respond: () => ({ errorCode: '4113', message: 'dup' }) });
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'already', L('4113 → already'));
    eq(store.get('sumo:promo.v1:' + CODE)?.viaAlreadyGranted, true, L('4113 → 기록 복원'));
    eq(store.get('sumo:promo.v1:' + CODE)?.code, CODE, L('4113 기록에도 코드 저장'));
    eq(calls.length, 1, L('4113 브릿지 1회'));
    const c2 = Core.createPromoClaimer(deps);
    eq(await c2.claim(), 'already', L('4113 뒤 새 세션 → already(브릿지 안 탐)'));
    eq(calls.length, 1, L('4113 기록 → 새 세션 브릿지 0회 추가'));
  }
  // 4112(예산 소진) → failed, 기록 없음, 세션 락, 새 세션 재시도
  {
    const { deps, calls, store } = fakeDeps({ respond: () => ({ errorCode: '4112', message: 'budget' }) });
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'failed', L('4112 → failed'));
    eq(store.size, 0, L('실패는 기록하지 않는다'));
    eq(await c.claim(), 'locked', L('실패 뒤 같은 세션 재호출 → locked'));
    eq(calls.length, 1, L('실패 시나리오 브릿지 1회'));
    eq(await Core.createPromoClaimer(deps).claim(), 'failed', L('새 세션 재시도'));
    eq(calls.length, 2, L('새 세션 → 브릿지 +1'));
  }
  // 폴백: 현행 undefined → 레거시 호출. 둘 다 undefined → unsupported
  {
    const { deps, calls } = fakeDeps({ respond: (m) => (m === 'grantPromotionReward' ? undefined : { key: 'LEG' }) });
    const c = Core.createPromoClaimer(deps);
    eq(await c.claim(), 'granted', L('레거시 폴백 성공'));
    eq(calls.map((x) => x.method).join(','), 'grantPromotionReward,grantPromotionRewardForGame', L('폴백 순서'));
  }
  {
    const { deps } = fakeDeps({ respond: () => undefined });
    eq(await Core.createPromoClaimer(deps).claim(), 'unsupported', L('둘 다 undefined → unsupported'));
  }
  {
    const { deps, calls } = fakeDeps({ respond: () => 'ERROR' });
    eq(await Core.createPromoClaimer(deps).claim(), 'failed', L('ERROR → failed'));
    eq(calls.length, 2, L('ERROR 는 폴백까지 2회'));
  }
  // 토스 밖(브릿지 없음) → unsupported, 브릿지 0회, 저장 0건 — 무해
  {
    const { deps, calls, store } = fakeDeps({ inToss: false });
    eq(await Core.createPromoClaimer(deps).claim(), 'unsupported', L('토스 밖'));
    eq(calls.length, 0, L('토스 밖 브릿지 0회'));
    eq(store.size, 0, L('토스 밖 저장 0건'));
  }
  // 미설정 → unconfigured
  {
    const { deps, calls } = fakeDeps({ cfg: { code: '', amount: 0 } });
    eq(await Core.createPromoClaimer(deps).claim(), 'unconfigured', L('미설정'));
    eq(calls.length, 0, L('미설정 브릿지 0회'));
  }
  // throw 흡수
  {
    const { deps } = fakeDeps({ respond: () => { throw new Error('boom'); } });
    eq(await Core.createPromoClaimer(deps).claim(), 'failed', L('브릿지 throw → failed(게임은 산다)'));
  }
  {
    const { deps, calls } = fakeDeps({ loadFails: true });
    eq(await Core.createPromoClaimer(deps).claim(), 'granted', L('loadRecord throw → 진행'));
    eq(calls.length, 1, L('loadRecord throw 브릿지 1회'));
  }
  {
    const deps = fakeDeps().deps;
    deps.readConfig = () => { throw new Error('dom gone'); };
    eq(await Core.createPromoClaimer(deps).claim(), 'unconfigured', L('readConfig throw → unconfigured'));
  }
}

/* ── ② 코드 «교체» — 지급 기록은 «코드별»이다(08-29 3앱 실결함) ────────────── */
async function testCodeRotation(Core = C, label = '') {
  const L = (m) => `${label}${m}`;
  const { deps, calls, store, setCfg } = fakeDeps();
  const A = 'CODE_A_OLD', B = 'CODE_B_NEW';
  setCfg({ code: A });
  eq(await Core.createPromoClaimer(deps).claim(), 'granted', L('코드 A 지급'));
  eq(calls.length, 1, L('코드 A 1회'));
  setCfg({ code: B }); // 콘솔에서 코드 교체
  const c = Core.createPromoClaimer(deps);
  eq(await c.alreadyRewarded(), false, L('코드 A 기록은 코드 B 에 대해 false'));
  eq(await c.claim(), 'granted', L('★코드 A 기록 + 코드 B → granted(차단 안 됨)'));
  eq(calls.length, 2, L('★코드 B → 브릿지 +1'));
  eq(calls[1].params.promotionCode, B, L('코드 B 전달'));
  eq([...store.keys()].sort().join(','), `sumo:promo.v1:${A},sumo:promo.v1:${B}`, L('★기록 키가 코드별 2개'));
  eq(await Core.createPromoClaimer(deps).claim(), 'already', L('새 세션 + 같은 코드 B → already'));
  eq(calls.length, 2, L('같은 코드 → 브릿지 0회 추가'));
  // code 없는 옛 기록(같은 키에 우연히) → 다른 프로모션 것으로 본다
  {
    const f = fakeDeps();
    f.store.set('sumo:promo.v1:' + CODE, { grantedAt: 1 });
    eq(await Core.createPromoClaimer(f.deps).claim(), 'granted', L('code 없는 옛 기록 → granted'));
  }
}

/* ── ③ 소스 정적검사(게임·부트 배선) ────────────────────────────────────────── */
function testStatic(gameJs = readFileSync(resolve(ROOT, 'public/game/sumo-bounce-game.js'), 'utf8'), label = '') {
  const L = (m) => `${label}${m}`;
  const count = (s, a) => s.split(a).length - 1;
  eq(count(gameJs, 'const PROMO_DAIMYOJIN_STAGE = 8;'), 1, L('★지급 문턱 = 8 (정본)'));
  eq(count(gameJs, "if (prevCleared < PROMO_DAIMYOJIN_STAGE && SAVE.cleared >= PROMO_DAIMYOJIN_STAGE) promoNotifyDaimyojinUnlock();"), 1, L('finishMatch 훅 1건'));
  eq(count(gameJs, "window.__sumoPromoUnlock('daimyojin')"), 1, L('전역 훅 호출 1건'));
  eq(count(gameJs, ') promoNotifyDaimyojinUnlock();'), 1, L('훅 호출 지점이 finishMatch «하나뿐»(부팅 경로 0)'));
  eq(count(gameJs, 'function promoNotifyDaimyojinUnlock(){'), 1, L('훅 함수 정의 1건'));
  // 다이묘진 unlock:8 == 문턱 (정본 정합) — CHARS 밸런스 무접촉 확인
  const m = gameJs.match(/id:'daimyojin'[\s\S]*?unlock:(\d+)\}/);
  eq(m && m[1], '8', L('CHARS daimyojin.unlock 은 8 그대로'));
  // 부트: 훅 «설치»만, 지급 «호출» 0 — 소급 없음
  const boot = readFileSync(resolve(ROOT, 'src/sdk-boot.ts'), 'utf8');
  eq(count(boot, 'installPromoHook();'), 1, L('sdk-boot installPromoHook 1건'));
  eq(boot.indexOf('installPromoHook();') > 0 && boot.indexOf('installPromoHook();') < boot.lastIndexOf('injectGameScript();'), true, L('훅 설치가 게임 주입보다 먼저'));
  eq(count(boot, 'claimDaimyojinReward'), 0, L('★부팅 경로 grant 호출 0건(소급 없음)'));
  eq(count(boot, 'alreadyRewarded'), 0, L('부팅 경로 기록 조회 0건'));
  const promo = readFileSync(resolve(ROOT, 'src/toss/promotion.ts'), 'utf8');
  eq(count(promo, "'sumo:promo.v1:'"), 1, L('저장 키 접두 sumo:promo.v1:'));
  eq(count(promo, "'sumoSave'") + count(promo, '"sumoSave"'), 0, L('promotion.ts 가 sumoSave 를 코드로 안 만진다'));
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  eq(count(html, `data-promo-daimyojin-code="${CODE}"`), 1, L('index.html 코드 1건(정본)'));
  eq(count(html, 'data-promo-daimyojin-amount="30"'), 1, L('index.html 금액 30'));
  eq(count(html, 'TEST_01M16Q'), 0, L('index.html TEST_ 코드 0건'));
}

/* ── ④ 양성대조 ─────────────────────────────────────────────────────────── */
async function positiveControls() {
  const tmp = resolve(ROOT, '.promo_selftest_tmp');
  mkdirSync(tmp, { recursive: true });
  try {
    // P1: 락 제거 사본 → 같은 세션 2회 호출이 «2회» 나온다(검사기가 잡는다)
    {
      let s = coreSrc;
      const a = "if (sessionDone.has(code)) return Promise.resolve('locked'); // ③";
      const b = 'if (busy) return busy; // ②';
      eq(s.split(a).length - 1, 1, 'P1 세션락 줄 1건');
      eq(s.split(b).length - 1, 1, 'P1 인플라이트 줄 1건');
      s = s.replace(a, '').replace(b, '');
      const p = resolve(tmp, 'promoCore_nolock.ts');
      writeFileSync(p, s);
      const V = await import(pathToFileURL(p).href);
      const { deps, calls } = fakeDeps({ saveFails: true }); // 저장 실패 → 기록으로도 못 막는 상황
      const c = V.createPromoClaimer(deps);
      await c.claim();
      await c.claim();
      eq(calls.length, 2, 'P1 락 제거 사본 → 2회 호출 «검출»');
      const { deps: d2, calls: c2 } = fakeDeps({ delayMs: 20, saveFails: true });
      const v2 = V.createPromoClaimer(d2);
      await Promise.all([v2.claim(), v2.claim()]);
      eq(c2.length, 2, 'P1 인플라이트 제거 사본 → 동시 2회 «검출»');
    }
    // P2: 문턱 변조 사본 → 정적검사 불합격
    {
      const g = readFileSync(resolve(ROOT, 'public/game/sumo-bounce-game.js'), 'utf8');
      const before = errs.length;
      testStatic(g.replace('const PROMO_DAIMYOJIN_STAGE = 8;', 'const PROMO_DAIMYOJIN_STAGE = 1;'), '[P2-variant] ');
      const caught = errs.length - before;
      errs.splice(before); // variant 의 불합격은 «기대한 것» — 지운다
      eq(caught >= 1, true, 'P2 문턱 변조(=1) 사본 → 정적검사가 «잡는다»');
    }
    // P3: 옛 «단일키·코드무관» 사본 → 코드 교체 시 차단(already) 결함 재현. 현 코어는 granted.
    {
      let s = coreSrc;
      const a = "if (rec.grantedAt && rec.code === code) return 'already';";
      eq(s.split(a).length - 1, 1, 'P3 코드 대조 줄 1건');
      s = s.replace(a, "if (rec.grantedAt) return 'already';");
      const p = resolve(tmp, 'promoCore_oldstyle.ts');
      writeFileSync(p, s);
      const OLD = await import(pathToFileURL(p).href);
      const old = fakeDeps({ singleKey: true });
      old.setCfg({ code: 'CODE_A_OLD' });
      await OLD.createPromoClaimer(old.deps).claim();
      old.setCfg({ code: 'CODE_B_NEW' });
      eq(await OLD.createPromoClaimer(old.deps).claim(), 'already', 'P3 옛 방식 사본: 코드 교체 → «차단(already)» 결함 재현');
      eq(old.calls.length, 1, 'P3 옛 방식: 코드 B 브릿지 0회(막힘)');
      // 같은 «단일키» 저장을 써도 현 코어는 code 대조로 막히지 않는다 (키 분리 + code 대조 «이중»)
      const cur = fakeDeps({ singleKey: true });
      cur.setCfg({ code: 'CODE_A_OLD' });
      await C.createPromoClaimer(cur.deps).claim();
      cur.setCfg({ code: 'CODE_B_NEW' });
      eq(await C.createPromoClaimer(cur.deps).claim(), 'granted', 'P3 현 코어: 단일키 저장이어도 code 대조로 granted');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}


/* ── ⑤ 프로모션 ② 「5판 플레이하기」 50원 «정적검사» (2026-09-01) ───────────────
 *   ★가장 중요한 요구사항: 「이미 달성한 사람 지급 외」 = 과거 누적 판수 «불인정».
 *     그 보장의 근거는 «promoPlays.ts 가 기존 저장값을 한 글자도 읽지 않는다»는 것이다.
 *     그래서 여기서 «금칙 키 참조 0건»을 정적으로 못박는다(런타임 증명은
 *     scripts/verify_promo_plays_headless.py 의 P0/P0-pos).
 */
const PLAYS_CODE = '__PROMOTION_CODE__';
const PLAYS_AMOUNT = 50;
const PLAYS_TARGET = 5;

function testPlaysStatic(label = '', srcOverride = null) {
  const L = (m) => `${label}${m}`;
  const count = (s, a) => s.split(a).length - 1;
  const plays = srcOverride ?? readFileSync(resolve(ROOT, 'src/toss/promoPlays.ts'), 'utf8');
  // ★★ 금칙: 「과거 누적」이 들어 있는 저장 키를 «참조조차» 하지 않는다.
  //    (주석에는 「⛔ 절대 참조 금지 목록」으로 이름이 나오므로, 주석을 걷어낸 «코드»에서만 센다.)
  const codeOnly = plays
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ln) => !ln.trim().startsWith('//'))
    .join('\n');
  for (const forbidden of ['sumoSave', 'ads.v2', 'sumobounce.ads.v1', 'cleared', 'byDiff', 'champion', 'KEYS.adCounter']) {
    eq(count(codeOnly, forbidden), 0, L(`★promoPlays.ts 가 «${forbidden}» 를 참조하지 않는다(과거 누적 불인정)`));
  }
  eq(count(plays, "const COUNTER_KEY_PREFIX = 'sumo:promo.plays.v1:';"), 1, L('★카운터 키 접두가 «새 이름»이고 코드별'));
  eq(count(plays, 'COUNTER_KEY_PREFIX + code'), 1, L('★카운터 키 = 접두 + 프로모션 코드'));
  eq(count(plays, "const RECORD_KEY_PREFIX = 'sumo:promo.v1:';"), 1, L('지급 기록 키 접두(코드별) 재사용'));

  // 게임 js — 훅 정의 1건 · 호출 1건(finishMatch 안)
  const gameJs = readFileSync(resolve(ROOT, 'public/game/sumo-bounce-game.js'), 'utf8');
  eq(count(gameJs, 'function promoNotifyMatchEnd(){'), 1, L('훅 함수 정의 1건'));
  eq(count(gameJs, '  promoNotifyMatchEnd();'), 1, L('★훅 호출 «지점 1곳»(finishMatch)'));
  eq(count(gameJs, 'window.__sumoPromoMatchEnd()'), 1, L('전역 훅 호출 1건'));
  // 호출 위치가 finishMatch 본문 안이고, 아케이드 분기 «밖»(= 승패·모드 무관)
  const fm = gameJs.slice(gameJs.indexOf('function finishMatch(winner){'));
  const fmBody = fm.slice(0, fm.indexOf('\nfunction '));
  eq(count(fmBody, 'promoNotifyMatchEnd();'), 1, L('★호출이 finishMatch 본문 안'));
  eq(fmBody.indexOf('promoNotifyMatchEnd();') > fmBody.indexOf("if (mode === 'arcade' && winner === 1){"), true, L('아케이드 분기 뒤(밖)에서 호출 — 모드·승패 무관'));
  const hookFn = gameJs.slice(gameJs.indexOf('function promoNotifyMatchEnd(){'));
  eq(count(hookFn.slice(0, hookFn.indexOf('}')), 'SAVE'), 0, L('★훅 함수가 SAVE 를 읽지도 쓰지도 않는다'));

  // index.html — 코드·금액·목표
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  eq(count(html, `data-promo-plays-code="${PLAYS_CODE}"`), 1, L('index.html 코드 1건(정본)'));
  eq(count(html, `data-promo-plays-amount="${PLAYS_AMOUNT}"`), 1, L('index.html 금액 50'));
  eq(count(html, `data-promo-plays-target="${PLAYS_TARGET}"`), 1, L('index.html 목표 5판'));
  eq(count(html, 'TEST_01M1DTT3'), 0, L('index.html TEST_ 코드 0건(정본)'));

  // sdk-boot — 훅 «설치»만, 지급 «호출» 0
  const boot = readFileSync(resolve(ROOT, 'src/sdk-boot.ts'), 'utf8');
  eq(count(boot, 'installPlaysPromoHook();'), 1, L('sdk-boot installPlaysPromoHook 1건'));
  eq(boot.indexOf('installPlaysPromoHook();') < boot.lastIndexOf('injectGameScript();'), true, L('훅 설치가 게임 주입보다 먼저'));
  eq(count(boot, 'claimPlaysReward'), 0, L('★부팅 경로 grant 호출 0건'));
  eq(count(boot, 'noteMatchEnd'), 0, L('★부팅 경로 카운트 호출 0건'));

  // 웹 shim — no-op
  const shim = readFileSync(resolve(ROOT, 'src/toss-web/index.ts'), 'utf8');
  eq(count(shim, 'export const installPlaysPromoHook'), 1, L('웹 shim no-op 존재'));
  // vite — 웹 산출물에서 코드 비움
  const vite = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');
  eq(count(vite, "data-promo-plays-code=\"\""), 1, L('웹 빌드에서 프로모션 코드 비움'));
}

/* ⑤-b 양성대조 P4: 「금칙 키를 읽는」 결함 사본을 만들면 정적검사가 «잡는다» */
function playsPositiveControl() {
  const plays = readFileSync(resolve(ROOT, 'src/toss/promoPlays.ts'), 'utf8');
  const bad = plays.replace(
    'const n = typeof o.n ===',
    "const legacy = window.localStorage.getItem('sumo:ads.v2');\n    const n0 = typeof o.n ==="
  );
  const before = errs.length;
  testPlaysStatic('[P4-variant] ', bad);
  const caught = errs.length - before;
  errs.splice(before);
  eq(caught >= 1, true, 'P4 «ads.v2 를 읽는» 결함 사본 → 정적검사가 «잡는다»');
}

await testCore();
await testCodeRotation();
testStatic();
await positiveControls();
testPlaysStatic();
playsPositiveControl();

if (errs.length) {
  console.error(`[check_promo_hooks] FAIL ${errs.length}`);
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check_promo_hooks] PASS — 코어(락·기록·폴백·코드별) · 정적(문턱8·훅1지점·부팅소급0) · 양성대조 ②정적(금칙키 0건) · 양성대조 P1/P2/P3/P4');
