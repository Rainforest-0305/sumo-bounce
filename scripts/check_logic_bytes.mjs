#!/usr/bin/env node
/**
 * 조작·물리·점수·해금·저장·프로모션·AI «로직 함수·테이블»이 라이브(-16) 와 바이트 단위로 같은지 증명한다.
 *   node scripts/check_logic_bytes.mjs [pristine.js] [patched.js]
 * 방식: 두 파일에서 같은 이름의 최상위 function / const / let 선언 본문을 잘라 비교.
 *       PROTECTED = «반드시 동일», ALLOWED = «달라도 됨(렌더/사운드/UI)», 그 외 이름이 달라지면 실패(= 몰래 바뀐 함수 검출).
 *       양성대조: 보호 함수(fighterCollision)에 공백 1개를 넣은 사본을 넣으면 DETECTED 여야 한다.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const A = process.argv[2] || resolve(ROOT, 'scripts/_pristine_game_20260829-16.js');
const B = process.argv[3] || resolve(ROOT, 'public/game/sumo-bounce-game.js');

const PROTECTED = [
  // 계측·i18n·콘텐츠 테이블
  'track', '__matchesThisSession', 'I18N', 'LANG_ORDER', 'curLang', 't', 'CHARS', 'CHAR_BY_ID', 'STAT_RANGE', 'statPct',
  'ARENAS', 'ARENA_BY_ID', 'RULES', 'RULE_BY_ID', 'LADDER', 'PERS_KEY',
  // 저장·프로모션·해금·출석 규칙
  'lsGet', 'lsSet', 'PROMO_DAIMYOJIN_STAGE', 'promoNotifyDaimyojinUnlock', 'DEF_SAVE', 'SAVE', 'DIFF_TIERS', 'loadSave', 'persist',
  'charUnlocked', 'arenaUnlocked', 'unlockedChars', 'unlockedArenas', 'kstDateKey', 'dateKeyToUTCms', 'DAILY_POOL', 'DAILY_PEAK',
  'todaysFeatured', 'previewStreak', 'grantBonusArena', 'claimAttendance', 'fmt',
  // 오디오 코어(재생 래퍼는 ALLOWED)
  'audioCtx', 'muted', 'chargeOsc', 'initAudio', 'setMuted', 'audioSuspend', 'audioResume', 'tone', 'noiseBurst', 'startCharge', 'stopCharge',
  'playChord', 'playWin', 'playLose', 'playFanfare', 'playUnlockSfx',
  'bgmGain', 'BGM', 'BGM_MIX', 'midiHz', 'seqMap', 'BGM_TRACKS', 'bgmInit', 'bgmVoice', 'bgmNoiseHit', 'bgmTaiko', 'bgmStepAt', 'bgmLen', 'bgmTick',
  'bgmLevel', 'bgmRamp', 'bgmStart', 'bgmStop', 'bgmSuspend', 'bgmResume', 'bgmWanted', 'bgmSwap', 'bgmSync', 'armAudio',
  // 엔진 상수·상태·물리·판정·라운드 흐름
  'PHYS_HZ', 'BASE_R', 'SPAWN_SPREAD', 'FALL_GRACE', 'CHARGE_MAX', 'mode', 'gameState', 'paused', 'stageIdx', 'scoreP1', 'curArena', 'arenaRadius',
  'roundTimer', 'screenShake', 'particles', 'RF', 'invertOn', 'surgeT', 'pullPhase', 'zoneX', 'matchStart', 'roundOutcome', 'stats',
  'hexA', 'makeFighter', 'P1', 'applyChar', 'resetFighter', 'triggerDash', 'fighterCollision', 'resetRuleState', 'updateHazards', 'explode',
  'hazardCollisions', 'physicsStep', 'ringOut', 'pickArenaFor', 'startRound', 'endRound', 'popConfettiRound',
  'update',
  // 입력·AI
  'P1_DIRS', 'P2_DIRS', 'OPPOSITE', 'AUTO_AIM_WINDOW', 'keysDown', 'soloMode', 'canPlay', 'updateKeyAim', 'keyCharge', 'keyRelease',
  'splitYCache', 'splitY', 'ownerFor', 'indicatorFor', 'beginAim', 'moveAim', 'endAim',
  'ai', 'aiConfigure', 'aiReset', 'rotVec', 'aiAim', 'aiShoveQuality', 'aiRepositionAim', 'aiPitSafe', 'aiCenterAim', 'aiDodgeAim', 'aiBegin', 'aiRelease', 'aiUpdate',
  // 선수 그림 기하(히트박스 오해 방지 — bodyPath 무접촉), 초상
  'shade', 'bodyPath', 'drawHair', 'drawMark', 'drawFace', 'paintPortrait', 'drawFloorPattern', 'drawRuleOverlay', 'skids', 'updateSkids',
  // UI 로직·화면 전환·선택·VS·HUD·결과·일시정지·언어·부팅
  '$', 'activeScreen', 'SCREENS', 'sel', 'syncCtaPad', 'updScrollCue', 'shrinkToFit', 'shrinkAll', 'showScreen', 'toastTimer', 'toast', 'charName', 'charTitle',
  'safeSet', 'renderTitle', 'renderHelp', 'needTwo', 'selChar', 'openSelect', 'renderSelect', 'vsCfg', 'openVS', 'launchMatch', 'pipHTML', 'layoutDuo', 'syncHUD',
  'frameHUD', 'showResultScreen', 'resultNext', 'goTitle', 'togglePause', 'applyLang', 'setLang', 'initLang',
  'lastStageKey', 'resizeCanvas', 'checkResize', 'relayoutUI', 'lastTime', 'gameLoop', 'frameNo',
];
/* ── PINNED (2026-08-31 신설) ─────────────────────────────────────────────────
   «의도된 변경이지만 무제한 허용은 아닌» 함수. PROTECTED(바이트 동일)와 ALLOWED(자유)
   사이의 3단계다.

   왜 만들었나: 부활 리워드 훅(2026-08-31 President 지시). startMatch=경기당1회 플래그 초기화 1줄, afterRound=패배 확정 시 finishMatch 앞에서 reviveTryOffer() 1줄.
   이 함수들은 부활 훅 때문에 바뀔 수밖에 없다. 그렇다고 ALLOWED 로 옮기면 이후 «어떤»
   변경도 안 잡힌다 — 게임 수명주기·물리 함수를 무방비로 두는 셈이다. 그래서 «패치 후
   해시»를 못박는다. 부활 훅 외의 변경이 한 글자라도 더 들어오면 그 즉시 FAIL 이다.

   ⛔pristine 파일(_pristine_game_*.js)은 «절대» 갱신하지 마라. 그건 모든 패치 이전의
     원본이고, 덮으면 gfx 패치 24함수의 baseline 이 통째로 날아가 검사기가 무뎌진다.

   해시를 갱신해야 한다면: 먼저 diff 를 떠서 «부활 훅뿐임»을 증명하고, 그 diff 를 보고에
   남긴 뒤에 갱신하라(2026-08-31 Partner 절차). */
const PINNED = new Map([
  ['startMatch', '01368599184af808'],
  ['afterRound', 'f0fd9b47b8a9571a'],
  /* 2026-09-01 프로모션 ②「5판 플레이하기」 훅. 라이브(-19) 대비 diff 는 «정확히 2줄»:
       +  // 프로모션 ②: «끝난» 매치 1건. 모드·승패 무관(아케이드/2P 공통). fire-and-forget.
       +  promoNotifyMatchEnd();
     아케이드 분기 «밖»(닫는 중괄호 뒤)에 둬서 승패·모드와 무관하게 매치 종료 1건마다 불린다.
     점수·물리·해금·저장 로직은 한 글자도 안 바뀌었다. 해시가 어긋나면 그 즉시 FAIL 이다. */
  ['finishMatch', '190bddab0d9f2e55'],
]);

const ALLOWED = new Set([
  // 기존 렌더/이펙트/사운드 래퍼
  'canvas', 'ctx', 'spark', 'dust', 'shock', 'floatText', 'popConfetti', 'playHit', 'playDash', 'playFall', 'playBoom', 'playCount', 'playUI',
  'drawFighterArt', 'drawSkyDetail', 'drawStadium', 'drawBackdrop', 'drawArena', 'drawHazards', 'drawTrail', 'drawFighter', 'drawEffects',
  'fitText', 'drawAnnounce', 'drawAnnounceBody', 'VW', 'draw', 'renderDailyBout',
  // 신규(패치가 추가)
  'POST', 'ctxMain', 'bloomActive', 'glow', 'gfxQ', 'gfxQf', '_cvDesc', '_cvLock', '_cvLocked', '_cvApplyPending', '_tileRaster', 'HUD_FONT', 'BODY_FONT', '_vs', 'vr', 'mixHex',
  'PPOOL', '_ppCur', 'pAlloc', 'pCap', 'dustRing', 'SPOOL', '_spCur',
  'ZZR', 'zzfxG', 'ZZ_MASTER', 'ZZ', 'zz',
  'dynN', 'silHash', 'ridgePath', 'roofPath', 'SIL_FAMILY', 'drawSilhouettes', 'drawCrowd', 'lanternSpots', 'drawLanterns', 'bgC', 'bgTile',
  'flC', 'floorTile', 'bigFont', 'bigText', '_lastDrawT', 'I18N_ATT', 'ta', 'renderAttendanceStrip',
  /* 부활 리워드(2026-08-31 President 지시) - 신규 선언 3종. 기존 로직을 고친 게 아니라
     새로 추가된 것이라 pristine 에 대응물이 없다. reviveTryOffer 는 아케이드+CPU 상대에서만
     제안하고(2인대전/자유연습 제외), 충전 상태를 멈춘 뒤 gameState 를 REVIVE_OFFER 로 바꾼다.
     점수·물리·확률은 건드리지 않는다(본문 실사 완료). 두 플래그는 경기당 1회 제한과 프리즈 시각. */
  'reviveUsed', 'reviveFreezeAt', 'reviveTryOffer',
  /* 프로모션 ②「5판 플레이하기」(2026-09-01 President) — 신규 선언 1종. pristine 에 대응물이 없다.
     전역 훅(window.__sumoPromoMatchEnd)이 있으면 부르기만 한다. 세이브·점수·물리 무접촉. */
  'promoNotifyMatchEnd',
]);

/* 최상위(들여쓰기 0) 함수·const·let 선언 본문 추출: 이름 → 텍스트 */
function extract(src) {
  src = src.replace(/\r\n/g, '\n');
  const out = new Map();
  const re = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=|let\s+([A-Za-z_$][\w$]*)\s*=)/gm;
  let m;
  const starts = [];
  while ((m = re.exec(src))) starts.push({ name: m[1] || m[2] || m[3], idx: m.index, kind: m[1] ? 'fn' : 'decl' });
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k];
    let end;
    if (s.kind === 'fn') {
      let depth = 0, i = src.indexOf('{', s.idx), started = false, inStr = null;
      for (; i < src.length; i++) {
        const ch = src[i];
        if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
        if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
        if (ch === '{') { depth++; started = true; } else if (ch === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
      }
      const next = starts[k + 1] ? starts[k + 1].idx : src.length;
      if (end === undefined || end > next) end = next;
    } else {
      end = starts[k + 1] ? starts[k + 1].idx : src.length;
      const seg = src.slice(s.idx, end);
      const last = seg.lastIndexOf(';');
      end = s.idx + (last >= 0 ? last + 1 : seg.length);
    }
    const text = src.slice(s.idx, end);
    if (!out.has(s.name)) out.set(s.name, text);
    else out.set(s.name, out.get(s.name) + '\n/*dup*/\n' + text);
  }
  return out;
}
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const a = extract(readFileSync(A, 'utf8')), b = extract(readFileSync(B, 'utf8'));
let fail = 0; const changed = [], same = [], missing = [], unexpected = [];
for (const name of PROTECTED) {
  if (!a.has(name)) { missing.push(name); continue; }
  if (!b.has(name)) { fail++; changed.push(`${name}: MISSING in patched`); continue; }
  if (a.get(name) === b.get(name)) same.push(name); else { fail++; changed.push(`${name}: ${sha(a.get(name))} → ${sha(b.get(name))}`); }
}
for (const [name, text] of a) {
  if (PROTECTED.includes(name) || ALLOWED.has(name) || PINNED.has(name)) continue;
  if (!b.has(name) || b.get(name) !== text) { unexpected.push(name); fail++; }
}
const pinnedRes = [];
for (const [name, want] of PINNED) {
  if (!b.has(name)) { fail++; pinnedRes.push(`${name}: MISSING in patched`); continue; }
  const got = sha(b.get(name));
  if (got === want) pinnedRes.push(`${name}: ${got} (pinned OK)`);
  else { fail++; pinnedRes.push(`${name}: ${got} != pinned ${want}  <- 부활 훅 «외»의 변경이 들어왔다`); }
}
const allowedChanged = [...ALLOWED].filter((n) => a.has(n) && b.has(n) && a.get(n) !== b.get(n));
const added = [...b.keys()].filter((n) => !a.has(n));
const addedUnlisted = added.filter((n) => !ALLOWED.has(n));
console.log(`protected identical: ${same.length}/${PROTECTED.length - missing.length}`);
if (missing.length) { console.log(`  (not found in pristine as top-level decl, ignored: ${missing.join(', ')})`); }
console.log(`allowed changed (${allowedChanged.length}): ${allowedChanged.join(', ')}`);
console.log('pinned (부활 훅, 해시 고정):\n  ' + pinnedRes.join('\n  '));
console.log(`added (${added.length}): ${added.join(', ')}`);
if (addedUnlisted.length) { console.log('ADDED BUT NOT LISTED IN ALLOWED: ' + addedUnlisted.join(', ')); fail++; }
if (changed.length) console.log('PROTECTED CHANGED:\n  ' + changed.join('\n  '));
if (unexpected.length) console.log('UNLISTED CHANGED/REMOVED: ' + unexpected.join(', '));
/* 양성대조: 보호 함수 하나에 공백 하나를 넣으면 검출되는가 */
{
  const src = readFileSync(B, 'utf8').replace('function fighterCollision(){\n', 'function fighterCollision(){ \n');
  const c = extract(src);
  const detected = c.get('fighterCollision') !== a.get('fighterCollision');
  console.log('positive control (fighterCollision + 1 space):', detected ? 'DETECTED' : 'NOT DETECTED');
  if (!detected) fail++;
}
/* 문자열 수준 양성대조 2: 프로모션 문턱 상수 */
{
  const src = readFileSync(B, 'utf8');
  const ok = /const PROMO_DAIMYOJIN_STAGE = 8;/.test(src) && (src.match(/promoNotifyDaimyojinUnlock\(\)/g) || []).length === 2;
  console.log('promo threshold=8 & hook call sites==1:', ok ? 'OK' : 'FAIL');
  if (!ok) fail++;
}
console.log(fail ? `RESULT: FAIL (${fail})` : 'RESULT: PASS');
process.exit(fail ? 1 : 0);
