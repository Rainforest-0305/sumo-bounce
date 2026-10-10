#!/usr/bin/env node
/**
 * 스모 바운스 그래픽 고도화(2026-08-30) — 게임 js «렌더·사운드·UI 만» 패치.
 *   node scripts/gfx_patch_game.mjs
 * 입력: scripts/_pristine_game_20260829-16.js (라이브 -16 원본)  출력: public/game/sumo-bounce-game.js
 * 모든 앵커는 «정확히 1회» 존재해야 하며(아니면 throw), 보호 로직 함수는 scripts/check_logic_bytes.mjs 가 바이트 대조한다.
 * 조작·물리·점수·해금·저장·프로모션·광고는 여기서 «한 줄도» 만지지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'scripts/_pristine_game_20260829-16.js');
const OUT = resolve(ROOT, 'public/game/sumo-bounce-game.js');
let js = readFileSync(SRC, 'utf8');
const crlf = js.includes('\r\n');
js = js.replace(/\r\n/g, '\n');
const log = [];
function count(s, sub) { return s.split(sub).length - 1; }
function patch(name, oldS, newS, times = 1) {
  const n = count(js, oldS);
  if (n !== times) throw new Error(`«${name}» anchor found ${n} times (need ${times})`);
  js = js.split(oldS).join(newS);
  log.push(`${name} ×${n}`);
}
/* startAnchor 시작 ~ endAnchor 시작 «직전»까지를 replacement 로 교체 */
function replaceBlock(name, startAnchor, endAnchor, replacement) {
  const a = js.indexOf(startAnchor), a2 = js.indexOf(startAnchor, a + 1);
  if (a < 0 || a2 >= 0) throw new Error(`«${name}» start anchor count != 1`);
  const b = js.indexOf(endAnchor, a + startAnchor.length);
  if (b < 0) throw new Error(`«${name}» end anchor missing`);
  js = js.slice(0, a) + replacement + js.slice(b);
  log.push(`${name} (block)`);
}

/* ───────────────────────── E1. 캔버스·포스트 레이어·서체·품질 ───────────────────────── */
patch('E1 canvas/ctx',
`const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
`,
`const canvas = document.getElementById('gameCanvas');
/* 그래픽 고도화(2026-08-30) — 블룸 포스트 레이어(public/game/sumo-post.js). 있으면 세계는 POST 의
   오프스크린 scene 캔버스에 그리고 #gameCanvas 는 애나운스·비네트 전용 «투명» 캔버스가 된다(글자는
   안 번진다). 없으면(WebGL 불가·?bloom=off) 예전처럼 #gameCanvas 하나에 그린다. ctx 는 draw() 가
   프레임마다 두 컨텍스트 사이를 오가므로 let 이다 — 나머지 렌더 코드는 그대로 ctx 만 쓴다. */
const POST = (typeof window !== 'undefined' && window.SumoPost && window.SumoPost.init(canvas)) ? window.SumoPost : null;
const ctxMain = canvas.getContext('2d', {alpha: !!POST});
let ctx = ctxMain;
if (POST){ canvas.style.background = 'transparent'; canvas.style.position = 'relative'; }
let bloomActive = false;
/* 캔버스 shadowBlur 는 모바일에서 가장 비싼 연산 — 블룸이 켜져 있으면 0(블룸이 대신 번진다), 폴백에서만 원래 값. */
function glow(px){ return bloomActive ? 0 : px; }
/* 품질 2/1/0: 블룸 단계와 연동(강등 시 파티클 상한·배경 동적 레이어도 같이 준다). 블룸 없는 폴백은 1. */
function gfxQ(){ return POST ? (POST.on ? POST.level : 0) : 1; }
/* 실수 품질값(0~2) — 단계 전환 400ms 크로스페이드 동안 파티클 상한·배경 동적 레이어가 «연속»으로 따라간다. */
function gfxQf(){ return POST ? (POST.on ? POST.qf : 0) : 1; }
/* 규칙(2026-08-30, 네온 -22 깜빡임 사고): 캔버스 크기·DPR 은 «플레이 중 바꾸지 않는다». resizeCanvas()(보호 함수,
   바이트 무접촉)가 canvas.width/height 를 대입하면 이 인스턴스 접근자가 받아, 라운드 진행 중이면 보류해 두었다가
   라운드가 끝나거나 화면(일시정지·결과·메뉴)이 떠 있을 때 draw() 첫머리에서 적용한다. 값 자체는 그대로(게임이 계산한 크기). */
const _cvDesc = { w: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), h: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height') };
const _cvLock = { w: null, h: null, pending: false };
function _cvLocked(){ return (gameState === 'PLAYING' || gameState === 'READY') && activeScreen === null && !paused; }
function _cvApplyPending(){
  if (!_cvLock.pending || _cvLocked()) return;
  _cvLock.pending = false;
  if (_cvLock.w !== null){ _cvDesc.w.set.call(canvas, _cvLock.w); _cvLock.w = null; }
  if (_cvLock.h !== null){ _cvDesc.h.set.call(canvas, _cvLock.h); _cvLock.h = null; }
}
if (_cvDesc.w && _cvDesc.h && _cvDesc.w.set && _cvDesc.h.set){
  Object.defineProperty(canvas, 'width', { configurable: true, get(){ return _cvDesc.w.get.call(canvas); },
    set(v){ if (_cvLocked() && v !== _cvDesc.w.get.call(canvas)){ _cvLock.w = v; _cvLock.pending = true; return; } _cvDesc.w.set.call(canvas, v); } });
  Object.defineProperty(canvas, 'height', { configurable: true, get(){ return _cvDesc.h.get.call(canvas); },
    set(v){ if (_cvLocked() && v !== _cvDesc.h.get.call(canvas)){ _cvLock.h = v; _cvLock.pending = true; return; } _cvDesc.h.set.call(canvas, v); } });
}
const HUD_FONT = '"Anton","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
const BODY_FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
try { if (document.fonts && document.fonts.load) document.fonts.load('40px Anton'); } catch(e){}
/* 시각 전용 난수 — 게임 로직의 Math.random() 스트림과 «분리»(이펙트가 판정 난수를 먹지 않는다). */
let _vs = 0x9e3779b9; function vr(){ _vs ^= _vs << 13; _vs >>>= 0; _vs ^= _vs >>> 17; _vs ^= _vs << 5; _vs >>>= 0; return _vs / 4294967296; }
function mixHex(a, b, t){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa>>16)&255) + (((pb>>16)&255) - ((pa>>16)&255))*t, g = ((pa>>8)&255) + (((pb>>8)&255) - ((pa>>8)&255))*t, bl = (pa&255) + ((pb&255) - (pa&255))*t;
  return '#' + (1<<24 | (Math.round(r)<<16) | (Math.round(g)<<8) | Math.round(bl)).toString(16).slice(1);
}
`);

/* ───────────────────────── E2. 이펙트 풀(spark/dust/shock 시그니처 유지) ───────────────────────── */
replaceBlock('E2 effects pool', '// ---------------- effects ----------------\nfunction spark(', '// ---------------- dash ----------------',
`// ---------------- effects ----------------
/* 그래픽 고도화(2026-08-30) — 파티클을 «풀 객체 재사용»으로. 호출 시그니처(spark/dust/shock/floatText)는
   로직(fighterCollision·explode·ringOut·triggerDash·hazardCollisions)이 그대로 부르므로 «절대» 바꾸지 않는다.
   particles/shockwaves «배열» 자체도 로직(startRound/goTitle/update)이 비우고 순회하므로 그대로 두되,
   push 하는 객체를 부팅 때 만든 풀에서 꺼내 쓴다(런타임 할당 0). 살아있는 객체(life>0)는 건너뛴다.
   kind: 0 점(dust) · 1 스트릭 스파크(속도 방향, 흰 코어) · 2 링아웃 흙먼지(무겁고 느림). */
const PPOOL = 320, _pp = new Array(PPOOL);
for (let i=0;i<PPOOL;i++) _pp[i] = {x:0,y:0,vx:0,vy:0,slot:0,color:null,life:0,decay:0.03,size:2,kind:0,core:null};
let _ppCur = 0;
function pAlloc(){
  for (let n=0;n<PPOOL;n++){ const p = _pp[_ppCur]; _ppCur = (_ppCur+1) % PPOOL; if (p.life <= 0) return p; }
  return null;
}
function pCap(){ const f = gfxQf(); return Math.round(f >= 1 ? 200 + (PPOOL - 200)*Math.min(1, f - 1) : 110 + 90*Math.max(0, f)); }
function spark(x, y, impact, nx, ny, palette){
  const cap = pCap();
  const n = Math.min(cap - particles.length, Math.floor(12 + Math.min(22, impact * 0.7)));
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = vr()*Math.PI*2;
    const streak = (i % 3) === 0;
    const s = (vr()*4+2) * (1 + impact*0.045) * (streak ? 1.35 : 1);
    p.x = x; p.y = y;
    p.vx = Math.cos(a)*s + (ny*(vr()-0.5)*s*0.4);
    p.vy = Math.sin(a)*s + (-nx*(vr()-0.5)*s*0.4);
    p.slot = vr()<0.38 ? 0 : (vr()<0.6 ? 1 : 2);
    p.color = palette ? palette[i%palette.length] : null;
    p.kind = streak ? 1 : 0;
    p.life = 1; p.decay = streak ? (vr()*0.04+0.03) : (vr()*0.035+0.018);
    p.size = streak ? (vr()*1.2+1.2) : (vr()*3+1.6);
    particles.push(p);
  }
}
function dust(x, y, n, color){
  const cap = pCap();
  n = Math.min(n, cap - particles.length);
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = vr()*Math.PI*2, s = vr()*1.8+0.3;
    p.x = x; p.y = y; p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s; p.slot = 2; p.color = color; p.kind = 0;
    p.life = 1; p.decay = 0.03+vr()*0.02; p.size = vr()*2.4+1;
    particles.push(p);
  }
}
/* 링아웃 흙먼지 링 — 렌더 쪽(drawFighter)이 떨어지는 «순간»을 감지해 1회 부른다. */
function dustRing(x, y, r, n, color){
  const cap = pCap();
  n = Math.min(n, cap - particles.length);
  for (let i=0;i<n;i++){
    const p = pAlloc(); if (!p) break;
    const a = (i/n)*Math.PI*2 + vr()*0.3, s = 1.6 + vr()*1.4;
    p.x = x + Math.cos(a)*r*0.6; p.y = y + Math.sin(a)*r*0.6; p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s*0.55 - 0.4;
    p.slot = 2; p.color = color; p.kind = 2; p.life = 1; p.decay = 0.016+vr()*0.01; p.size = 2.2+vr()*3.2;
    particles.push(p);
  }
}
const SPOOL = 16, _sp = new Array(SPOOL);
for (let i=0;i<SPOOL;i++) _sp[i] = {x:0,y:0,r:8,max:60,life:0,color:'#fff'};
let _spCur = 0;
function shock(x, y, r, color){
  for (let n=0;n<SPOOL;n++){ const s = _sp[_spCur]; _spCur = (_spCur+1)%SPOOL;
    if (s.life <= 0){ s.x = x; s.y = y; s.r = 8; s.max = r; s.life = 1; s.color = color; shockwaves.push(s); return; } }
}
function floatText(x, y, text, color){ floatTexts.push({x:x, y:y, text:text, color:color, life:1}); }
function popConfetti(n){
  const pal = ['#ffc94a','#ff5a5f','#4a9eff','#ffe9a8','#ff9d2e','#ffffff'];
  for (let i=0;i<n;i++){
    confetti.push({x:(vr()-0.5)*760, y:-420 - vr()*260,
      vx:(vr()-0.5)*2.4, vy:vr()*2.6+1.6, rot:vr()*6.28,
      vr:(vr()-0.5)*0.34, w:vr()*7+4, h:vr()*10+5,
      color:pal[i%pal.length], life:1});
  }
}

`);

/* ───────────────────────── E3. 효과음 — ZzFX(코드 합성, MIT) ───────────────────────── */
patch('E3 zzfx insert', `function playHit(intensity){`,
`/* ZzFX — Zuper Zmall Zound Zynth (Micro Edition). MIT License, Copyright 2019 Frank Force
   https://github.com/KilledByAPixel/ZzFX — 파라미터 배열 하나로 효과음을 «생성»한다(음원 파일 0).
   원본 zzfx() 는 자체 AudioContext 를 만들지만 여기서는 게임의 audioCtx/masterGain(음소거·suspend 연동)으로
   재생하고, 생성 샘플은 키별로 캐시해 재생 시 할당 0. 실패하면 조용히 기존 tone() 경로가 남는다. */
const ZZR = 44100;
function zzfxG(volume,randomness,frequency,attack,sustain,release,shape,shapeCurve,slide,deltaSlide,pitchJump,pitchJumpTime,repeatTime,noise,modulation,bitCrush,delay,sustainVolume,decay,tremolo){
  volume=volume===undefined?1:volume;randomness=randomness||0;frequency=frequency===undefined?220:frequency;attack=attack||0;sustain=sustain||0;release=release===undefined?.1:release;
  shape=shape||0;shapeCurve=shapeCurve===undefined?1:shapeCurve;slide=slide||0;deltaSlide=deltaSlide||0;pitchJump=pitchJump||0;pitchJumpTime=pitchJumpTime||0;repeatTime=repeatTime||0;
  noise=noise||0;modulation=modulation||0;bitCrush=bitCrush||0;delay=delay||0;sustainVolume=sustainVolume===undefined?1:sustainVolume;decay=decay||0;tremolo=tremolo||0;
  const PI2=Math.PI*2,sign=v=>v>0?1:-1;
  let startSlide=slide*=500*PI2/ZZR/ZZR,startFrequency=frequency*=(1+randomness*2*Math.random()-randomness)*PI2/ZZR;
  let t=0,tm=0,i=0,j=1,r=0,c=0,s=0,f,length;
  attack=attack*ZZR+9;decay*=ZZR;sustain*=ZZR;release*=ZZR;delay*=ZZR;
  deltaSlide*=500*PI2/(ZZR*ZZR*ZZR);modulation*=PI2/ZZR;pitchJump*=PI2/ZZR;pitchJumpTime*=ZZR;repeatTime=repeatTime*ZZR|0;
  length=attack+decay+sustain+release+delay|0;
  const b=new Float32Array(length);
  for(;i<length;b[i++]=s){
    if(!(++c%(bitCrush*100|0))){
      s=shape?shape>1?shape>2?shape>3?Math.sin((t%PI2)*(t%PI2)*(t%PI2)):Math.max(Math.min(Math.tan(t),1),-1):1-(2*t/PI2%2+2)%2:1-4*Math.abs(Math.round(t/PI2)-t/PI2):Math.sin(t);
      s=(repeatTime?1-tremolo+tremolo*Math.sin(PI2*i/repeatTime):1)*sign(s)*Math.pow(Math.abs(s),shapeCurve)*volume*(
        i<attack?i/attack:i<attack+decay?1-((i-attack)/decay)*(1-sustainVolume):i<attack+decay+sustain?sustainVolume:i<length-delay?(length-i-delay)/release*sustainVolume:0);
      s=delay?s/2+(delay>i?0:(i<length-delay?1:(length-i)/delay)*b[i-delay|0]/2):s;
    }
    f=(frequency+=slide+=deltaSlide)*Math.cos(modulation*tm++);
    t+=f-f*noise*(1-(Math.sin(i)+1)*1e9%2);
    if(j&&++j>pitchJumpTime){frequency+=pitchJump;startFrequency+=pitchJump;j=0}
    if(repeatTime&&!(++r%repeatTime)){frequency=startFrequency;slide=startSlide;j=j||1}
  }
  return b;
}
const ZZ_MASTER = 0.26, _zzCache = {};
/* [volume,randomness,freq,attack,sustain,release,shape,curve,slide,dSlide,pJump,pJumpT,repeat,noise,mod,crush,delay,susVol,decay,tremolo] */
const ZZ = {
  ui:    [.5,0,540,.004,.02,.07,0,1.5,0,0,0,0,0,0,0,0,0,1,0,0],
  hit:   [1.2,.05,150,.004,.06,.26,3,1.8,-60,0,0,0,0,.45,0,0,0,1,.02,0],
  hitBig:[1.5,.05,110,.004,.09,.36,3,1.9,-70,0,0,0,0,.55,0,0,.03,1,.03,0],
  dash:  [.8,.03,320,.01,.05,.16,1,1.2,-40,0,0,0,0,.25,0,0,0,1,0,0],
  fall:  [1,.02,260,.01,.14,.55,2,1.4,-45,-.1,0,0,0,.2,0,0,.05,1,.05,0],
  boom:  [1.4,.05,90,.01,.12,.5,3,1.9,-30,0,0,0,0,.6,0,0,.04,1,.04,0],
  count: [.6,0,520,.004,.05,.09,2,1.2,0,0,0,0,0,0,0,0,0,1,0,0],
  go:    [.7,0,780,.004,.08,.16,2,1.2,0,0,260,.04,0,0,0,0,0,1,0,0],
  ring:  [.55,0,660,.005,.06,.22,0,1.3,0,0,330,.05,0,0,0,0,.03,1,0,0]
};
function zz(key, when, vol){
  if (!audioCtx || !masterGain || muted) return false;
  try {
    let buf = _zzCache[key];
    if (!buf){ const d = zzfxG.apply(null, ZZ[key]); buf = audioCtx.createBuffer(1, d.length, ZZR); buf.getChannelData(0).set(d); _zzCache[key] = buf; }
    const s = audioCtx.createBufferSource(), g = audioCtx.createGain(); s.buffer = buf; g.gain.value = ZZ_MASTER * (vol === undefined ? 1 : vol);
    s.connect(g); g.connect(masterGain); s.start(audioCtx.currentTime + (when||0));
    return true;
  } catch(e){ return false; }
}
function playHit(intensity){`);
patch('E3 playHit body',
`function playHit(intensity){
  const i = Math.max(0.1, Math.min(1, intensity));
  tone({type:'triangle', f0:70 + i*90, f1:30, dur:0.16 + i*0.16, vol:0.28*i + 0.06, filter:'lowpass', cut:420});
  noiseBurst(0.09 + i*0.08, 0.10 + i*0.16, 900 + i*1400);
}`,
`function playHit(intensity){
  const i = Math.max(0.1, Math.min(1, intensity));
  if (zz(i > 0.6 ? 'hitBig' : 'hit', 0, 0.55 + i*0.6)) return;
  tone({type:'triangle', f0:70 + i*90, f1:30, dur:0.16 + i*0.16, vol:0.28*i + 0.06, filter:'lowpass', cut:420});
  noiseBurst(0.09 + i*0.08, 0.10 + i*0.16, 900 + i*1400);
}`);
patch('E3 playDash body',
`function playDash(charge){
  tone({type:'sine', f0:170 + charge*340, f1:80, dur:0.24, vol:0.15});
  noiseBurst(0.10, 0.05 + charge*0.05, 2200);
}`,
`function playDash(charge){
  if (zz('dash', 0, 0.5 + charge*0.7)) return;
  tone({type:'sine', f0:170 + charge*340, f1:80, dur:0.24, vol:0.15});
  noiseBurst(0.10, 0.05 + charge*0.05, 2200);
}`);
patch('E3 playFall body',
`function playFall(){
  tone({type:'sine', f0:230, f1:40, dur:0.65, vol:0.2});
  noiseBurst(0.3, 0.1, 700);
}`,
`function playFall(){
  if (zz('fall')) return;
  tone({type:'sine', f0:230, f1:40, dur:0.65, vol:0.2});
  noiseBurst(0.3, 0.1, 700);
}`);
patch('E3 playBoom body',
`function playBoom(){
  tone({type:'square', f0:120, f1:30, dur:0.4, vol:0.22, filter:'lowpass', cut:500});
  noiseBurst(0.34, 0.26, 1800);
}`,
`function playBoom(){
  if (zz('boom')) return;
  tone({type:'square', f0:120, f1:30, dur:0.4, vol:0.22, filter:'lowpass', cut:500});
  noiseBurst(0.34, 0.26, 1800);
}`);
patch('E3 playCount body',
`function playCount(hi){ tone({type:'square', f0: hi ? 880 : 520, dur:0.13, vol:0.09, filter:'lowpass', cut:2200}); }`,
`function playCount(hi){ if (zz(hi ? 'go' : 'count')) return; tone({type:'square', f0: hi ? 880 : 520, dur:0.13, vol:0.09, filter:'lowpass', cut:2200}); }`);
patch('E3 playUI body',
`function playUI(){ tone({type:'sine', f0:660, f1:880, dur:0.07, vol:0.055}); }`,
`function playUI(){ if (zz('ui')) return; tone({type:'sine', f0:660, f1:880, dur:0.07, vol:0.055}); }`);

/* ───────────────────────── E4. 선수 그림 — 외곽선·림라이트 ───────────────────────── */
patch('E4 body rim light',
`  g.fillStyle = grd;
  bodyPath(g, r, def.body); g.fill();
  g.shadowBlur = 0;
`,
`  g.fillStyle = grd;
  bodyPath(g, r, def.body); g.fill();
  g.shadowBlur = 0;
  // 림라이트(좌상단 안쪽 가장자리) — 몸통 path 를 clip 한 뒤 살짝 밀어 stroke 하면 안쪽 가장자리만 남는다.
  g.save(); bodyPath(g, r, def.body); g.clip();
  g.translate(r*0.07, r*0.10); g.strokeStyle = 'rgba(255,248,236,0.22)'; g.lineWidth = r*0.16;
  bodyPath(g, r, def.body); g.stroke();
  g.restore();
`);
patch('E4 outline',
`  // outline
  g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = Math.max(1, r*0.05);
  bodyPath(g, r, def.body); g.stroke();
  g.restore();
}`,
`  // outline — 먹선. 배경이 매 순간 바뀌는 오버레이라 실루엣이 항상 읽히도록 진하게.
  g.strokeStyle = 'rgba(14,8,10,0.62)'; g.lineWidth = Math.max(1.2, r*0.075);
  bodyPath(g, r, def.body); g.stroke();
  g.restore();
}`);

/* ───────────────────────── E5. 배경 — 정적 타일 캐시 + 실루엣 + 등롱 + 관중 ───────────────────────── */
replaceBlock('E5 sky/stadium/backdrop', '// ============================== arena rendering ==============================\nfunction drawSkyDetail(', 'function drawFloorPattern(theme){',
`// ============================== arena rendering ==============================
/* 그래픽 고도화(2026-08-30) — 배경을 «정적 타일 1장 + 동적 소수»로 나눈다.
   정적(하늘·태양/달·산·건물·가지·기둥·실루엣·관중·등롱 몸체·스타디움·외곽 어둠)은 아레나·해상도·품질별로
   «1회 래스터»(bgTile) 해 매 프레임 drawImage 1회. 동적(구름·눈·꽃잎·불씨·비·번개·등롱 불꽃)만 위에 얹는다.
   dyn=false 는 타일에, dyn=true 는 프레임에 그린다. 품질 0 에서는 동적 레이어를 «전부» 끈다. */
let _tileRaster = false;
function dynN(n){ if (_tileRaster) return n; const f = gfxQf(); const k = f >= 1 ? 0.5 + 0.5*Math.min(1, f - 1) : 0.5*Math.max(0, f); return Math.ceil(n*k); }
function drawSkyDetail(theme, time, dyn){
  ctx.save();
  const id = theme.id;
  if (id === 'dawn' || id === 'sunset'){
    if (!dyn){
      const sx = id === 'dawn' ? -255 : 250, sy = id === 'dawn' ? -205 : -175;
      const sun = ctx.createRadialGradient(sx, sy, 2, sx, sy, 84);
      sun.addColorStop(0, 'rgba(255,244,196,0.95)');
      sun.addColorStop(0.24, id === 'dawn' ? 'rgba(255,197,145,0.72)' : 'rgba(255,142,93,0.72)');
      sun.addColorStop(1, 'rgba(255,118,92,0)');
      ctx.fillStyle = sun; ctx.fillRect(sx-92, sy-92, 184, 184);
    } else {
      ctx.fillStyle = id === 'dawn' ? 'rgba(255,226,211,0.10)' : 'rgba(72,25,53,0.18)';
      const n = dynN(5);
      for (let i=0;i<n;i++){
        const x = ((time*(2.5+i*0.35) + i*181) % 980) - 490, y = -275 + i*67;
        ctx.beginPath(); ctx.ellipse(x, y, 105+i*13, 10+(i%2)*4, -0.08, 0, Math.PI*2); ctx.fill();
      }
    }
  } else if (id === 'midnight'){
    if (!dyn){
      const moon = ctx.createRadialGradient(270,-245,1,270,-245,55);
      moon.addColorStop(0,'rgba(225,240,255,0.9)'); moon.addColorStop(0.18,'rgba(173,211,255,0.5)');
      moon.addColorStop(1,'rgba(102,159,255,0)');
      ctx.fillStyle = moon; ctx.fillRect(210,-305,120,120);
      for (let i=0;i<46;i++){
        const x = ((i*193)%760)-380, y = ((i*83)%520)-370;
        ctx.globalAlpha = 0.22 + ((i*7)%5)*0.06;
        ctx.fillStyle = i%5===0 ? '#b8d8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, i%7===0?1.7:0.85, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const n = dynN(10);
      ctx.fillStyle = '#ffffff';
      for (let i=0;i<n;i++){
        const x = ((i*193)%760)-380, y = ((i*83)%520)-370;
        ctx.globalAlpha = Math.max(0, Math.sin(time*1.8 + i*2.17))*0.35;
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'snow'){
    if (!dyn){
      ctx.fillStyle = 'rgba(218,237,244,0.2)';
      ctx.beginPath(); ctx.moveTo(-400,30);
      const pk = [[-310,-210],[-245,-125],[-155,-290],[-55,-105],[35,-250],[150,-95],[240,-270],[330,-135],[400,-220]];
      pk.forEach(function(p){ ctx.lineTo(p[0], p[1]); });
      ctx.lineTo(400,80); ctx.closePath(); ctx.fill();
    } else {
      const n = dynN(52);
      for (let i=0;i<n;i++){
        const x = ((i*149 + time*(18+i%4))%860)-430, y = ((i*97 + time*(30+i%5))%820)-410;
        ctx.globalAlpha = 0.22+(i%5)*0.07; ctx.fillStyle = '#f5fdff';
        ctx.beginPath(); ctx.arc(x, y, 1+(i%3)*0.65, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'desert'){
    if (!dyn){
      const sun = ctx.createRadialGradient(-250,-215,4,-250,-215,95);
      sun.addColorStop(0,'rgba(255,239,169,0.92)'); sun.addColorStop(0.22,'rgba(255,187,93,0.58)');
      sun.addColorStop(1,'rgba(255,157,73,0)');
      ctx.fillStyle = sun; ctx.fillRect(-350,-315,200,200);
      ctx.fillStyle = 'rgba(86,42,33,0.24)';
      ctx.beginPath(); ctx.moveTo(-400,80);
      ctx.bezierCurveTo(-250,-40,-85,30,40,-5); ctx.bezierCurveTo(175,-45,270,35,400,-20);
      ctx.lineTo(400,165); ctx.lineTo(-400,165); ctx.closePath(); ctx.fill();
    } else {
      const n = dynN(32);
      for (let i=0;i<n;i++){
        const x = ((i*211 + time*(11+i%3))%900)-450, y = ((i*71 + Math.sin(time+i)*18)%600)-270;
        ctx.globalAlpha = 0.12+(i%4)*0.045; ctx.fillStyle = '#ffe0a0';
        ctx.fillRect(x, y, 1.5+(i%3), 1.5);
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'storm'){
    if (!dyn){
      ctx.fillStyle = 'rgba(5,10,17,0.28)';
      for (let i=0;i<7;i++){ ctx.beginPath(); ctx.ellipse(-350+i*118, -280+(i%2)*38, 125, 45, -0.08, 0, Math.PI*2); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(169,222,231,0.19)'; ctx.lineWidth = 1.2;
      const n = dynN(56);
      ctx.beginPath();
      for (let i=0;i<n;i++){
        const x = ((i*137 + time*105)%940)-470, y = ((i*79 + time*185)%900)-450;
        ctx.moveTo(x,y); ctx.lineTo(x-7,y+21);
      }
      ctx.stroke();
      const flash = Math.sin(time*0.9)*Math.sin(time*3.3);
      if (flash > 0.93){ ctx.fillStyle = 'rgba(200,240,255,' + ((flash-0.93)*3.2) + ')'; ctx.fillRect(-VW/2,-VH/2,VW,VH); }
    }
  } else if (id === 'sakura'){
    if (!dyn){
      const topY = Math.max(-VH/2 + 26, -424);
      for (const s of [-1,1]){
        ctx.strokeStyle = 'rgba(52,28,38,0.85)'; ctx.lineCap = 'round';
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(s*(Math.min(VW/2, 470) + 10), topY);
        ctx.quadraticCurveTo(s*250, topY + 66, s*70, topY + 44);
        ctx.stroke();
        ctx.lineWidth = 7;
        for (let brm=0; brm<3; brm++){
          const bx = s*(250 - brm*76), by = topY + 54 + brm*6;
          ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - s*22, by + 34, bx - s*46, by + 30);
          ctx.stroke();
        }
        for (let i=0;i<16;i++){
          const px = s*(320 - i*20) + Math.sin(i*2.3)*16;
          const py = topY + 36 + Math.cos(i*1.7)*26 + (i%3)*11;
          ctx.globalAlpha = 0.62 + (i%3)*0.12;
          for (let pt=0; pt<5; pt++){
            ctx.fillStyle = (i+pt)%3 ? '#ffbcd4' : '#ffe8f1';
            ctx.beginPath();
            ctx.ellipse(px + Math.cos(pt*1.257)*5, py + Math.sin(pt*1.257)*5, 4.6, 3.4, pt*1.257, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const n = dynN(34);
      for (let i=0;i<n;i++){
        const x = ((i*167 + time*(16+i%5))%880)-440;
        const y = ((i*113 + time*(34+i%4))%860)-430;
        ctx.save(); ctx.translate(x,y); ctx.rotate(time*1.4 + i);
        ctx.globalAlpha = 0.42+(i%4)*0.1; ctx.fillStyle = i%4 ? '#ffb7cf' : '#fff0f5';
        ctx.beginPath(); ctx.ellipse(0,0,4.2,2.3,0,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'volcano'){
    if (!dyn){
      ctx.fillStyle = 'rgba(30,8,4,0.6)';
      ctx.beginPath(); ctx.moveTo(-400,-120); ctx.lineTo(-190,-330); ctx.lineTo(-90,-215);
      ctx.lineTo(60,-350); ctx.lineTo(210,-200); ctx.lineTo(400,-300); ctx.lineTo(400,-40);
      ctx.lineTo(-400,-40); ctx.closePath(); ctx.fill();
      const lava = ctx.createLinearGradient(0,-380,0,-40);
      lava.addColorStop(0,'rgba(255,150,50,0)'); lava.addColorStop(1,'rgba(255,110,30,0.30)');
      ctx.fillStyle = lava; ctx.fillRect(-400,-380,800,340);
    } else {
      const n = dynN(36);
      for (let i=0;i<n;i++){
        const x = ((i*181)%820)-410;
        const y = 340 - ((i*97 + time*(58+i%7)*1.6)%800);
        ctx.globalAlpha = Math.max(0, 0.75 - Math.abs(y)/460);
        ctx.fillStyle = i%3 ? '#ff8a3d' : '#ffe08a';
        ctx.beginPath(); ctx.arc(x, y, 1.4+(i%3)*0.9, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'bamboo'){
    if (!dyn){
      for (let i=0;i<16;i++){
        const x = -400 + i*52 + Math.sin(i)*4;
        ctx.fillStyle = i%2 ? 'rgba(48,102,58,0.55)' : 'rgba(32,78,44,0.6)';
        ctx.fillRect(x, -400, 17, 480);
        ctx.fillStyle = 'rgba(150,210,140,0.16)';
        for (let s=0;s<6;s++) ctx.fillRect(x, -400 + s*82, 17, 4);
      }
      const shaft = ctx.createLinearGradient(-120,-400,180,120);
      shaft.addColorStop(0,'rgba(226,255,196,0.16)'); shaft.addColorStop(1,'rgba(226,255,196,0)');
      ctx.fillStyle = shaft; ctx.fillRect(-400,-400,800,600);
    } else {
      const n = dynN(22);
      for (let i=0;i<n;i++){
        const x = ((i*191 + time*(13+i%4))%880)-440, y = ((i*127 + time*(21+i%3))%840)-420;
        ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(time+i)*0.8);
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#9ade7a';
        ctx.beginPath(); ctx.ellipse(0,0,7,2.2,0.5,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'neon'){
    if (!dyn){
      // 원경 고층 실루엣(새로 추가) → 근경 건물(기존) 순.
      ctx.fillStyle = 'rgba(24,12,44,0.85)';
      for (let i=0;i<9;i++){ const w = 60 + (i%3)*30, h = 260 + ((i*89)%240), x = -430 + i*100; ctx.fillRect(x, -120 - h, w, h); if (i%2) ctx.fillRect(x + w*0.4, -120 - h - 26, 6, 26); }
      for (let i=0;i<15;i++){
        const w = 34 + (i%4)*20, h = 120 + ((i*67)%210);
        const x = -400 + i*54;
        ctx.fillStyle = 'rgba(14,8,26,0.92)'; ctx.fillRect(x, -80 - h, w, h);
        for (let wy=0; wy<h-14; wy+=17){
          for (let wx=0; wx<w-10; wx+=14){
            if ((i*7 + wy + wx) % 3 === 0) continue;
            ctx.globalAlpha = 0.30 + 0.30*(((i*13 + wy*3 + wx) % 7)/7);
            ctx.fillStyle = (i+wy)%2 ? '#5df1ff' : '#ff6ae6';
            ctx.fillRect(x+6+wx, -80-h+10+wy, 6, 8);
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(93,241,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y=-VH/2; y<VH/2; y+=6){ ctx.moveTo(-VW/2,y); ctx.lineTo(VW/2,y); }
      ctx.stroke();
    } else {
      const n = dynN(12);
      for (let i=0;i<n;i++){
        const x = -400 + (i*4)*54 % 810, y = -200 - ((i*67)%210)*0.5;
        ctx.globalAlpha = 0.35 + 0.35*Math.abs(Math.sin(time*1.4 + i*1.7));
        ctx.fillStyle = i%2 ? '#5df1ff' : '#ff6ae6';
        ctx.fillRect(x+8, y, 6, 8);
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'temple'){
    if (!dyn){
      ctx.fillStyle = 'rgba(38,24,8,0.72)';
      ctx.beginPath(); ctx.moveTo(-400,-250); ctx.lineTo(0,-380); ctx.lineTo(400,-250);
      ctx.lineTo(400,-200); ctx.lineTo(-400,-200); ctx.closePath(); ctx.fill();
      for (const px of [-300,-160,160,300]){
        ctx.fillStyle = 'rgba(88,52,16,0.7)'; ctx.fillRect(px-16, -210, 32, 300);
        ctx.fillStyle = 'rgba(255,214,140,0.10)'; ctx.fillRect(px-16, -210, 8, 300);
      }
      for (let i=0;i<6;i++){
        const x = -280 + i*112, y = -178;
        ctx.fillStyle = 'rgba(255,120,70,0.9)';
        ctx.beginPath(); ctx.ellipse(x, y+26, 13, 18, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,36,12,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y-4); ctx.lineTo(x, y+8); ctx.stroke();
        const gl = ctx.createRadialGradient(x, y+26, 2, x, y+26, 46);
        gl.addColorStop(0,'rgba(255,190,110,0.34)'); gl.addColorStop(1,'rgba(255,170,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(x-46, y-20, 92, 92);
      }
    } else {
      const n = dynN(18);
      ctx.fillStyle = '#ffe9b8';
      for (let i=0;i<n;i++){
        const x = ((i*173 + time*9)%860)-430, y = ((i*101 - time*13)%820)-410;
        ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 등불 심지 흔들림(작은 밝은 코어 6개)
      ctx.fillStyle = '#fff1c4';
      for (let i=0;i<6;i++){
        const x = -280 + i*112, y = -152 + Math.sin(time*5.1 + i*1.3)*1.6;
        ctx.globalAlpha = 0.55 + 0.35*Math.abs(Math.sin(time*7 + i*2.1));
        ctx.beginPath(); ctx.ellipse(x, y, 4.5, 7, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'cosmos'){
    if (!dyn){
      for (let i=0;i<70;i++){
        const x = ((i*197)%800)-400, y = ((i*139)%790)-395;
        ctx.globalAlpha = 0.25 + ((i*11)%6)*0.06;
        ctx.fillStyle = i%6===0 ? '#a2a8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(x,y, i%9===0?1.9:0.9, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const pg = ctx.createRadialGradient(-250,-250,10,-250,-250,120);
      pg.addColorStop(0,'#6d5cff'); pg.addColorStop(0.6,'#3b2a8f'); pg.addColorStop(1,'rgba(20,12,60,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(-250,-250,105,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,255,0.30)'; ctx.lineWidth = 4;
      ctx.save(); ctx.translate(-250,-250); ctx.rotate(-0.45);
      ctx.beginPath(); ctx.ellipse(0,0,160,36,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
    } else {
      const n = dynN(16);
      ctx.fillStyle = '#ffffff';
      for (let i=0;i<n;i++){
        const x = ((i*197*3)%800)-400, y = ((i*139*3)%790)-395;
        ctx.globalAlpha = Math.max(0, Math.sin(time*2.2 + i))*0.4;
        ctx.beginPath(); ctx.arc(x,y,1.4,0,Math.PI*2); ctx.fill();
      }
      for (let i=0;i<3;i++){
        const a = time*0.25 + i*2.1;
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#9df8ff';
        ctx.beginPath(); ctx.arc(Math.cos(a)*370, Math.sin(a)*300 - 60, 2.4, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
/* 실루엣 — 아레나 계열별 원경/근경 2겹(값노이즈 능선 또는 지붕선). 색은 «지평선 하늘색→먹» 단계.
   전부 정적 → 타일에 들어간다. 능선은 결정적 해시(아레나마다 seed 다름)라 매 부팅 같은 모양. */
function silHash(i, seed){ let x = (i*374761393 + seed*668265263)|0; x = (x ^ (x>>>13))*1274126177|0; x ^= x>>>16; return (x>>>0)/4294967296; }
function ridgePath(baseY, amp, seed, step, wide){
  const n = Math.ceil(VW/step) + 2, x0 = -VW/2 - step;
  ctx.beginPath(); ctx.moveTo(x0, VH/2 + 20);
  for (let k=0;k<=n;k++){
    const c0 = Math.floor(k/wide), f = (k%wide)/wide;
    const v = silHash(c0, seed)*(1-f) + silHash(c0+1, seed)*f;
    const fine = silHash(k, seed*7)*0.25;
    ctx.lineTo(x0 + k*step, baseY - (v*0.75 + fine)*amp);
  }
  ctx.lineTo(x0 + n*step, VH/2 + 20); ctx.closePath();
}
function roofPath(x, w, y, tiers){
  // 기와지붕 실루엣: 위로 휘는 처마 tiers 단
  ctx.beginPath();
  for (let t=0;t<tiers;t++){
    const ww = w*(1 - t*0.22), yy = y - t*46, h = 30;
    ctx.moveTo(x - ww/2 - 14, yy);
    ctx.quadraticCurveTo(x - ww/2 + 10, yy + 8, x - ww/2 + 16, yy - h);
    ctx.lineTo(x + ww/2 - 16, yy - h);
    ctx.quadraticCurveTo(x + ww/2 - 10, yy + 8, x + ww/2 + 14, yy);
    ctx.closePath();
    ctx.rect(x - ww/2 + 22, yy - h, ww - 44, h + 46);
  }
}
const SIL_FAMILY = {dawn:'ridge', sunset:'ridge', desert:'ridge', snow:'ridge', volcano:'ridge', storm:'ridge',
  midnight:'roof', sakura:'roof', bamboo:'roof', temple:'roof', neon:'none', cosmos:'planet'};
function drawSilhouettes(theme){
  const fam = SIL_FAMILY[theme.id] || 'ridge';
  const hz = mixHex(theme.sky[1], theme.sky[2], 0.35);
  const far = mixHex(hz, '#070405', 0.62), near = mixHex(hz, '#070405', 0.86);
  ctx.save();
  if (fam === 'ridge'){
    ctx.fillStyle = far; ridgePath(-352, 150, theme.id.length*17 + 11, 26, 5); ctx.fill();
    ctx.fillStyle = near; ridgePath(-300, 96, theme.id.length*29 + 23, 20, 4); ctx.fill();
  } else if (fam === 'roof'){
    ctx.fillStyle = far; ridgePath(-372, 110, 41, 30, 6); ctx.fill();
    ctx.fillStyle = near;
    roofPath(-300, 220, -286, 2); ctx.fill();
    roofPath(20, 300, -300, 3); ctx.fill();
    roofPath(330, 200, -280, 2); ctx.fill();
    // 담장 — 아래 화면 끝까지(하늘 밝은 하단이 새어 나오지 않게)
    ctx.fillRect(-VW/2, -262, VW, VH/2 + 262 + 20);
  } else if (fam === 'planet'){
    const pg = ctx.createRadialGradient(0, 1700, 900, 0, 1700, 1420);
    pg.addColorStop(0, '#0b0820'); pg.addColorStop(0.985, '#1b1040'); pg.addColorStop(1, 'rgba(40,30,90,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 1700, 1420, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
/* 관중 — 스타디움 타원 바깥 2줄 점묘(어두운 머리 + 등롱색 하이라이트 소수). 정적. */
function drawCrowd(theme){
  ctx.save();
  for (let row=0; row<2; row++){
    const rx = 404 + row*22, ry = 368 + row*20, n = 62 + row*8;
    for (let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + row*0.05 + silHash(i, row+3)*0.04;
      const x = Math.cos(a)*rx, y = 18 + Math.sin(a)*ry;
      const lit = (i % 9) === (row*4 % 9);
      ctx.fillStyle = lit ? theme.lights[1] : '#0d0a0c';
      ctx.globalAlpha = lit ? 0.55 : 0.62;
      ctx.beginPath(); ctx.arc(x, y, lit ? 2.2 : 4.6, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}
/* 등롱 줄 — 화면 상단을 가로지르는 줄 2가닥 + 등롱(문턱 위 코어 → 블룸). 몸체는 정적(타일), 불꽃 코어는 동적. */
function lanternSpots(){
  const out = [], n = Math.max(3, Math.floor(VW/150));
  for (let i=0;i<n;i++){
    const t = (i + 0.5)/n, x = -VW/2 + t*VW;
    const sag = Math.sin(t*Math.PI);
    out.push({x:x, y:-560 + sag*46 + ((i%2) ? 14 : -6), i:i});
  }
  return out;
}
function drawLanterns(theme, dyn, time){
  if (VH < 1100) return; // 가로/태블릿 — 하늘이 없다
  const spots = lanternSpots();
  const warm = ['neon','cosmos'].indexOf(theme.id) === -1;
  const body = warm ? '#ff9d2e' : theme.lights[0], deep = warm ? '#c8461a' : mixHex(theme.lights[0], '#070405', 0.55);
  ctx.save();
  if (!dyn){
    ctx.strokeStyle = 'rgba(8,5,6,0.9)'; ctx.lineWidth = 2.2;
    for (const yo of [0, 12]){
      ctx.beginPath(); ctx.moveTo(-VW/2, -572 + yo);
      ctx.quadraticCurveTo(0, -500 + yo, VW/2, -572 + yo); ctx.stroke();
    }
    for (const L of spots){
      const ly = L.y + 30;
      ctx.strokeStyle = 'rgba(8,5,6,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(L.x, L.y - 8); ctx.lineTo(L.x, ly - 32); ctx.stroke();
      const g = ctx.createRadialGradient(L.x - 5, ly - 8, 2, L.x, ly, 30);
      g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.45, body); g.addColorStop(1, deep);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,10,6,0.35)'; ctx.lineWidth = 1;
      for (let k=-2;k<=2;k++){ ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); }
      for (let k=1;k<=3;k++){ ctx.beginPath(); ctx.moveTo(L.x - 19, ly - 28 + k*14); ctx.lineTo(L.x + 19, ly - 28 + k*14); ctx.stroke(); }
      ctx.fillStyle = '#1a0f0c'; ctx.fillRect(L.x - 9, ly - 33, 18, 6); ctx.fillRect(L.x - 7, ly + 27, 14, 5);
      ctx.strokeStyle = 'rgba(14,8,10,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(L.x, ly, 20, 28, 0, 0, Math.PI*2); ctx.stroke();
      const halo = ctx.createRadialGradient(L.x, ly, 10, L.x, ly, 92);
      halo.addColorStop(0, warm ? 'rgba(255,190,110,0.22)' : 'rgba(255,255,255,0.10)'); halo.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = halo; ctx.fillRect(L.x - 92, ly - 92, 184, 184);
    }
  } else {
    for (const L of spots){
      const ly = L.y + 30, k = 0.5 + 0.5*Math.sin(time*6.3 + L.i*1.9)*Math.sin(time*2.1 + L.i);
      ctx.globalAlpha = 0.35 + k*0.45; ctx.fillStyle = '#fff2c8';
      ctx.beginPath(); ctx.ellipse(L.x - 3, ly - 4, 6 + k*2, 9 + k*3, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawStadium(theme){
  ctx.save();
  ctx.strokeStyle = 'rgba(4,7,12,0.76)'; ctx.lineWidth = 58;
  ctx.beginPath(); ctx.ellipse(0,18,382,348,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2;
  for (let t=0;t<3;t++){ ctx.beginPath(); ctx.ellipse(0,18,347+t*17,317+t*14,0,0,Math.PI*2); ctx.stroke(); }
  for (let i=0;i<88;i++){
    const a = (i/88)*Math.PI*2, tier = i%3;
    ctx.globalAlpha = 0.2 + (i%5)*0.065;
    ctx.fillStyle = theme.lights[i % theme.lights.length];
    ctx.beginPath(); ctx.arc(Math.cos(a)*(348+tier*16), 18+Math.sin(a)*(318+tier*13), 1.6+(i%2)*0.65, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const side of [-1,1]){
    const lx = side*326, ly = -286;
    const beam = ctx.createLinearGradient(lx, ly, side*100, 20);
    beam.addColorStop(0, theme.lights[0] + '2e'); beam.addColorStop(1, theme.lights[0] + '00');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(lx - side*20, ly+16); ctx.lineTo(side*115, 60);
    ctx.lineTo(side*35, 35); ctx.lineTo(lx + side*20, ly+16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(6,9,15,0.88)'; ctx.fillRect(lx-25, ly-14, 50, 31);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.strokeRect(lx-25, ly-14, 50, 31);
    for (let row=0;row<2;row++) for (let col=0;col<4;col++){
      ctx.fillStyle = theme.lights[(row+col) % theme.lights.length]; ctx.globalAlpha = 0.72;
      ctx.beginPath(); ctx.arc(lx-17+col*11, ly-6+row*13, 3.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
/* 정적 배경 타일 — 아레나·캔버스 크기·품질 키가 바뀔 때만 다시 래스터. 전역 ctx 를 잠시 타일 컨텍스트로 바꿔
   기존 그리기 함수들을 그대로 재사용한다. */
let bgC = null, bgKey = '';
function bgTile(theme){
  const key = theme.id + '|' + canvas.width + 'x' + canvas.height;   // 품질은 키에 «안» 넣는다 — 단계 전환이 타일을 다시 굽지 않게
  if (key === bgKey && bgC) return bgC;
  if (!bgC) bgC = document.createElement('canvas');
  bgC.width = canvas.width; bgC.height = canvas.height;
  const o = bgC.getContext('2d', {alpha:false});
  const saved = ctx, savedBloom = bloomActive; ctx = o; bloomActive = false; _tileRaster = true;
  o.setTransform(1,0,0,1,0,0);
  o.translate(canvas.width/2, canvas.height/2);
  const s = Math.min(canvas.width, canvas.height)/780;
  o.scale(s,s);
  const sky = o.createLinearGradient(0,-VH/2,0,VH/2);
  sky.addColorStop(0, theme.sky[0]); sky.addColorStop(0.5, theme.sky[1]); sky.addColorStop(1, theme.sky[2]);
  o.fillStyle = sky; o.fillRect(-VW/2,-VH/2,VW,VH);
  const hz = o.createRadialGradient(0,90,30,0,90,Math.max(VW,VH)*0.62);
  hz.addColorStop(0, theme.lights[0] + '26'); hz.addColorStop(1, theme.sky[0] + '00');
  o.fillStyle = hz; o.fillRect(-VW/2,-VH/2,VW,VH);
  drawSkyDetail(theme, 0, false);
  drawSilhouettes(theme);
  // 지면 — 스타디움 아래는 하늘이 아니라 «땅»이다(따뜻한 먹, 등롱 빛이 살짝 닿는다).
  const gnd = o.createLinearGradient(0, 300, 0, VH/2);
  gnd.addColorStop(0, 'rgba(10,6,7,0)'); gnd.addColorStop(0.25, 'rgba(10,6,7,0.55)'); gnd.addColorStop(1, 'rgba(7,4,5,0.92)');
  o.fillStyle = gnd; o.fillRect(-VW/2, 300, VW, VH/2 - 300);
  drawCrowd(theme);
  drawStadium(theme);
  drawLanterns(theme, false, 0);
  const outer = o.createRadialGradient(0, 18, 368, 0, 18, Math.max(VW, VH)*0.56);
  outer.addColorStop(0, 'rgba(4,7,12,0)');
  outer.addColorStop(0.40, 'rgba(4,7,12,0.42)');
  outer.addColorStop(1, 'rgba(3,5,9,0.94)');
  o.fillStyle = outer;
  o.fillRect(-VW/2, -VH/2, VW, VH);
  ctx = saved; bloomActive = savedBloom; _tileRaster = false; bgKey = key;
  return bgC;
}
function drawBackdrop(theme){
  const time = performance.now()*0.001;
  const tile = bgTile(theme);
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(tile, 0, 0); ctx.restore();
  const f = gfxQf();
  if (f > 0){
    // 품질 1 미만으로 내려가는 400ms 동안 개수(dynN)와 함께 알파도 같이 줄어 «툭» 사라지지 않는다.
    if (f < 1){ ctx.save(); ctx.globalAlpha = f; }
    drawSkyDetail(theme, time, true); drawLanterns(theme, true, time);
    if (f < 1) ctx.restore();
  }
}
`);

/* ───────────────────────── E6. 링 바닥 — 정적 타일 + 튜브형 경계선 ───────────────────────── */
replaceBlock('E6 drawArena', 'function drawArena(theme){', 'function drawHazards(){',
`/* 링 바닥(외곽 흙띠·바닥 그라데이션·무늬·동심원)은 «정적» → 아레나·배율별 1회 래스터(floorTile). 매 프레임은
   위험띠·살아있는 경계선(튜브: 색 몸체 + 흰 코어 → 코어만 블룸)만 그린다. */
let flC = null, flKey = '';
function floorTile(theme){
  const s = Math.min(canvas.width, canvas.height)/780;
  const R = BASE_R + 30, px = Math.ceil(R*2*s);
  const key = theme.id + '|' + px;
  if (key === flKey && flC) return flC;
  if (!flC) flC = document.createElement('canvas');
  flC.width = px; flC.height = px;
  const o = flC.getContext('2d');
  const saved = ctx, savedBloom = bloomActive; ctx = o; bloomActive = false;
  o.setTransform(s,0,0,s,px/2,px/2);
  o.save();
  o.strokeStyle = theme.outer; o.lineWidth = 14;
  o.shadowColor = theme.boundaryGlow; o.shadowBlur = 12;
  o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.stroke();
  o.restore();
  o.save();
  const grad = o.createRadialGradient(0,0,10,0,0,BASE_R);
  grad.addColorStop(0, theme.arena[0]); grad.addColorStop(1, theme.arena[1]);
  o.fillStyle = grad;
  o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.fill();
  o.restore();
  drawFloorPattern(theme);
  o.save();
  o.strokeStyle = theme.patternColor; o.globalAlpha = 0.42; o.lineWidth = 1.5;
  for (let r=80;r<BASE_R;r+=80){ o.beginPath(); o.arc(0,0,r,0,Math.PI*2); o.stroke(); }
  o.restore();
  // 바닥 안쪽 그림자(링 가장자리에서 안으로 어두워짐 — 두께감)
  o.save();
  const inner = o.createRadialGradient(0,0,BASE_R*0.78,0,0,BASE_R);
  inner.addColorStop(0, 'rgba(0,0,0,0)'); inner.addColorStop(1, 'rgba(0,0,0,0.38)');
  o.fillStyle = inner; o.beginPath(); o.arc(0,0,BASE_R,0,Math.PI*2); o.fill();
  o.restore();
  ctx = saved; bloomActive = savedBloom; flKey = key;
  return flC;
}
function drawArena(theme){
  const tile = floorTile(theme), R = BASE_R + 30;
  ctx.drawImage(tile, -R, -R, R*2, R*2);

  // danger band between the live boundary and the original rim
  if (arenaRadius < BASE_R - 2){
    ctx.save();
    ctx.beginPath(); ctx.arc(0,0,BASE_R,0,Math.PI*2);
    ctx.arc(0,0,arenaRadius,0,Math.PI*2,true);
    ctx.fillStyle = 'rgba(255,70,70,0.10)'; ctx.fill();
    ctx.restore();
  }

  ctx.save();
  const pulse = 1 + Math.sin(performance.now()*0.004)*0.06;
  ctx.strokeStyle = theme.boundary; ctx.lineWidth = 5;
  ctx.shadowColor = theme.boundaryGlow; ctx.shadowBlur = glow(12*pulse);
  ctx.beginPath(); ctx.arc(0,0,arenaRadius,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
  // 튜브 코어 — 경계색을 흰색 쪽으로 섞은 가는 선. 루미넌스 문턱 위라 블룸이 «이 선만» 번지게 한다.
  ctx.strokeStyle = mixHex(theme.boundary, '#ffffff', 0.55); ctx.lineWidth = 1.8; ctx.globalAlpha = 0.85 + (pulse-1)*2;
  ctx.beginPath(); ctx.arc(0,0,arenaRadius,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.boundary; ctx.globalAlpha = 0.025; ctx.fill();
  ctx.restore();
}
`);

/* ───────────────────────── E7. 트레일 — 리본 1스트로크 ───────────────────────── */
replaceBlock('E7 drawTrail', 'function drawTrail(f){', 'function drawFighter(f){',
`function drawTrail(f){
  const n = f.trail.length;
  if (n < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 넓은 소프트 리본(1 스트로크) + 가늘어지는 코어(세그먼트별 폭)
  ctx.globalAlpha = 0.16; ctx.strokeStyle = f.color; ctx.lineWidth = f.radius*1.3;
  ctx.beginPath(); ctx.moveTo(f.trail[0].x, f.trail[0].y);
  for (let i=1;i<n;i++) ctx.lineTo(f.trail[i].x, f.trail[i].y);
  ctx.lineTo(f.x, f.y); ctx.stroke();
  for (let i=1;i<n;i++){
    const p = f.trail[i], q = f.trail[i-1], k = i/n;
    ctx.globalAlpha = p.opacity*0.75*k;
    ctx.strokeStyle = i > n-4 ? mixHex(f.color, '#ffffff', 0.5) : f.color;
    ctx.lineWidth = Math.max(1, f.radius*(0.18 + 0.7*k));
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  ctx.restore();
}
`);

/* ───────────────────────── E8. 선수 — 그림자·차지 링·조준 화살·링아웃/승리 이펙트 ───────────────────────── */
replaceBlock('E8 drawFighter', 'function drawFighter(f){', 'function drawEffects(theme){',
`function drawFighter(f){
  // 렌더 전용 상태 전이 감지(로직 무접촉): 링아웃 «순간» 흙먼지 링, 라운드 승리 «순간» 금 리플.
  if (f.state === 'falling'){ if (!f._fxFall){ f._fxFall = true; dustRing(f.x, f.y, f.radius, 18, f.intoPit ? '#ff8a8f' : '#d9c7a8'); } }
  else f._fxFall = false;
  if (f.winPose > 0){ if (!f._fxWin){ f._fxWin = true; shock(f.x, f.y, f.radius*4.2, '#ffc94a'); shock(f.x, f.y, f.radius*2.6, '#fff2c8'); } }
  else f._fxWin = false;
  if (f.state === 'dead') return;
  ctx.save();
  if (f.state === 'falling') ctx.globalAlpha = Math.max(0, 1 - f.fallProgress);
  else if (f.cooldown > 0) ctx.globalAlpha = 0.72;

  // ground shadow — 두 겹(넓고 옅게 + 좁고 진하게) = 접지감
  if (f.state === 'alive'){
    ctx.save(); ctx.fillStyle = '#000';
    ctx.globalAlpha *= 0.18;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.88, f.radius*1.15, f.radius*0.40, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha *= 1.8;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.86, f.radius*0.86, f.radius*0.26, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 2P only: a faction badge laid UNDER the fighter (색 + 셰브론 모양 + 반쪽 틴트 — 3채널, WCAG 1.4.1).
  if (!soloMode() && f.state === 'alive'){
    const fc = f.id === 1 ? '#ff5a5f' : '#4a9eff';
    const dir = f.id === 1 ? 1 : -1;                 // P1 owns BOTTOM, P2 TOP
    const ry = f.y + f.radius*0.86, rx = f.radius*1.02, rr = f.radius*0.34;
    ctx.save();
    ctx.strokeStyle = fc; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    ctx.shadowColor = fc; ctx.shadowBlur = glow(8);
    ctx.beginPath(); ctx.ellipse(f.x, ry, rx, rr, 0, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = fc; ctx.shadowBlur = glow(6);
    const cy = ry + dir*(rr + 7), cw = 10, ch = 8;
    ctx.beginPath();
    ctx.moveTo(f.x, cy + dir*ch*0.5);
    ctx.lineTo(f.x - cw*0.5, cy - dir*ch*0.5);
    ctx.lineTo(f.x + cw*0.5, cy - dir*ch*0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 모으기 중 바닥 파동(발밑에서 퍼지는 링 2개) — 힘이 «땅에서» 모인다
  if (f.isCharging && f.state === 'alive'){
    const cr0 = f.charge / CHARGE_MAX, tt = performance.now()*0.001;
    ctx.save(); ctx.strokeStyle = f.color; ctx.lineWidth = 1.5;
    for (let k=0;k<2;k++){
      const ph = ((tt*1.4 + k*0.5) % 1);
      ctx.globalAlpha = (1-ph)*0.35*(0.4+cr0*0.6);
      ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius*0.86, f.radius*(0.9+ph*1.6), f.radius*(0.3+ph*0.55), 0, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
  drawFighterArt(ctx, f.x, f.y, f.radius, f.def, {
    charging: f.isCharging, hurt: f.hurt, blink: f.blink,
    squash: f.squash, squashAng: Math.atan2(f.squashNy, f.squashNx),
    glow: bloomActive ? 0 : (f.isCharging ? 16 + (f.charge/CHARGE_MAX)*16 : 10),
    win: f.winPose > 0, bounce: f.winPose > 0 ? f.winPose*7 : 0
  });

  if (f.isCharging){
    const cr = f.charge / CHARGE_MAX;
    const core = mixHex(f.color, '#ffffff', 0.6);
    ctx.save();
    // 회전 눈금 링(색 몸체 + 흰 코어)
    ctx.strokeStyle = f.color; ctx.lineWidth = 3;
    ctx.shadowColor = f.glow; ctx.shadowBlur = glow(10);
    const rr = f.radius*(1.12 + 0.45*((performance.now()*0.0035)%1));
    ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    // charge ring meter — 금 트랙 + 흰 코어(풀차지면 금이 «타오른다»)
    const full = cr > 0.92;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = full ? '#ffc94a' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4; ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = glow(full ? 14 : 0);
    ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, -Math.PI/2, -Math.PI/2 + cr*Math.PI*2); ctx.stroke();
    if (full){ ctx.shadowBlur = 0; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 11, -Math.PI/2, -Math.PI/2 + cr*Math.PI*2); ctx.stroke(); }
    ctx.restore();

    const manual = f.aimDx*f.aimDx + f.aimDy*f.aimDy > AIM_THRESHOLD*AIM_THRESHOLD;
    let gx, gy;
    if (manual){ const d = Math.sqrt(f.aimDx*f.aimDx + f.aimDy*f.aimDy); gx = f.aimDx/d; gy = f.aimDy/d; }
    else { const o = f.id === 1 ? P2 : P1; let ox = o.x-f.x, oy = o.y-f.y;
      const od = Math.sqrt(ox*ox+oy*oy)||1; gx = ox/od; gy = oy/od; }
    const len = f.baseRadius*(2.3 + cr*3.8);
    const sx = f.x + gx*(f.radius+5), sy = f.y + gy*(f.radius+5);
    const ex = f.x + gx*len, ey = f.y + gy*len;
    const ah = 14 + cr*9, aw = ah*0.72, px = -gy, py = gx;
    ctx.save();
    ctx.shadowColor = f.glow; ctx.shadowBlur = glow(manual ? 14 : 7);
    ctx.strokeStyle = f.color; ctx.lineWidth = manual ? 5 : 2.5; ctx.lineCap = 'round';
    ctx.setLineDash(manual ? [] : [3,11]);
    ctx.globalAlpha = 0.3 + cr*0.6;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex - gx*ah*0.72, ey - gy*ah*0.72); ctx.stroke();
    if (manual){ ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.5 + cr*0.5;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex - gx*ah*0.72, ey - gy*ah*0.72); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 0.55 + cr*0.45; ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(ex,ey);
    ctx.lineTo(ex - gx*ah + px*aw*0.5, ey - gy*ah + py*aw*0.5);
    ctx.lineTo(ex - gx*ah - px*aw*0.5, ey - gy*ah - py*aw*0.5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  if (f.cooldown > 0 && f.state === 'alive'){
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.baseRadius+7, -Math.PI/2, -Math.PI/2 + (f.cooldown/0.5)*Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}
`);

/* ───────────────────────── E9. 이펙트 그리기 — 스트릭·충격파 2겹·펀치 텍스트 ───────────────────────── */
replaceBlock('E9 drawEffects', 'function drawEffects(theme){', 'function fitText(',
`function drawEffects(theme){
  ctx.save();
  ctx.lineCap = 'round';
  for (let i=0;i<particles.length;i++){
    const p = particles[i];
    const col = p.color || theme.particles[p.slot % theme.particles.length];
    const a = Math.max(0, p.life);
    if (p.kind === 1){
      // 스트릭 스파크: 속도 방향 선(색) + 짧은 흰 코어 — 코어만 블룸
      const L = 3.2;
      ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = p.size*1.6;
      ctx.beginPath(); ctx.moveTo(p.x - p.vx*L, p.y - p.vy*L); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = p.size*0.7;
      ctx.beginPath(); ctx.moveTo(p.x - p.vx*L*0.5, p.y - p.vy*L*0.5); ctx.lineTo(p.x, p.y); ctx.stroke();
    } else {
      ctx.globalAlpha = p.kind === 2 ? a*0.55 : a;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = glow(p.kind === 2 ? 0 : 6);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 2 ? p.size*(1 + (1-a)*1.4) : p.size, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  for (let i=0;i<shockwaves.length;i++){
    const s = shockwaves[i], a = Math.max(0, s.life);
    ctx.globalAlpha = a*0.55;
    ctx.strokeStyle = s.color; ctx.lineWidth = 3*s.life + 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = a*0.35;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r*0.82, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i=0;i<confetti.length;i++){
    const c = confetti[i];
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.color; ctx.globalAlpha = 0.92;
    ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h); ctx.restore();
  }
  for (let i=0;i<floatTexts.length;i++){
    const f = floatTexts[i], a = Math.max(0, f.life);
    // 펀치: 생성 직후 1.35 → 1 (back-out 이징), 사라질 때 살짝 떠오른다
    const age = 1 - a, pop = age < 0.18 ? 1 + 0.35*(1 - age/0.18)*(1 - age/0.18) : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, a*1.6);
    ctx.translate(f.x, f.y); ctx.scale(pop, pop);
    ctx.font = "400 26px " + HUD_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,6,0.75)'; ctx.lineJoin = 'round'; ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
  }
  ctx.restore();
}
`);

/* ───────────────────────── E10. 애나운스 — 디스플레이 서체·글로우 폴백 ───────────────────────── */
replaceBlock('E10 fitText+announce', 'function fitText(', 'let VW = 800, VH = 800;',
`function fitText(text, maxWidth, weight, startPx, family){
  let px = startPx;
  ctx.font = weight + ' ' + px + "px " + (family || BODY_FONT);
  while (ctx.measureText(text).width > maxWidth && px > 12){
    px -= 2;
    ctx.font = weight + ' ' + px + "px " + (family || BODY_FONT);
  }
  return px;
}
function drawAnnounce(){
  // Solo keeps the single centred call exactly as before.
  if (soloMode()){ ctx.save(); drawAnnounceBody(); ctx.restore(); return; }
  // 2P: one copy per half so neither player reads the round call upside down.
  const ay = Math.max(BASE_R + 92, VH/4);
  ctx.save(); ctx.translate(0, ay); drawAnnounceBody(); ctx.restore();
  ctx.save(); ctx.translate(0, -ay); ctx.rotate(Math.PI); drawAnnounceBody(); ctx.restore();
}
/* 큰 글자 = 디스플레이체(Anton, 라틴만) + 먹 외곽선 오프셋 그림자. 한글 문자열은 시스템 굵은 서체로 폴백된다. */
function bigFont(txt, px){ return /^[ - -⁯]+$/.test(txt) ? ("400 " + px + "px " + HUD_FONT) : ("800 " + px + "px " + BODY_FONT); }
function bigText(txt, x, y, px, fill, shadow){
  ctx.save();
  ctx.font = bigFont(txt, px);
  ctx.lineJoin = 'round';
  ctx.fillStyle = shadow || 'rgba(10,5,6,0.85)'; ctx.fillText(txt, x + px*0.05, y + px*0.06);
  ctx.lineWidth = Math.max(2, px*0.07); ctx.strokeStyle = 'rgba(10,5,6,0.85)'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  ctx.restore();
}
function drawAnnounceBody(){
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (gameState === 'READY'){
    const isGo = readyTimer <= 0.75;
    const txt = isGo ? t('aGo') : t('aReady');
    const k = isGo ? (1 - readyTimer/0.75) : (1 - (readyTimer-0.75)/0.95);
    const pop = 1 + Math.max(0, 0.35 - k*0.9);
    ctx.save(); ctx.translate(0,-16); ctx.scale(pop, pop);
    const px = fitText(txt, 560, /^[ -]+$/.test(txt) ? '400' : '800', 74, /^[ -]+$/.test(txt) ? HUD_FONT : BODY_FONT);
    bigText(txt, 0, 0, px, isGo ? '#ffc94a' : '#f6efe6');
    ctx.restore();
    // rule banner slides in under the call
    const rr = curRule;
    const slide = Math.min(1, (1.7 - readyTimer)/0.4);
    ctx.save();
    ctx.globalAlpha = Math.min(1, slide);
    ctx.translate(0, 62 + (1-slide)*24);
    ctx.fillStyle = 'rgba(14,10,11,0.86)';
    const label = t(rr.k), desc = t(rr.kd);
    ctx.font = "800 20px " + BODY_FONT;
    const w = Math.max(ctx.measureText(label).width, 250) + 60;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(-w/2, -22, w, 44, 22); ctx.fill(); }
    else { ctx.fillRect(-w/2, -22, w, 44); }
    ctx.strokeStyle = 'rgba(255,236,214,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = rr.color;
    ctx.fillText(label, 0, 0);
    ctx.fillStyle = 'rgba(232,220,206,0.94)';
    fitText(desc, 600, '600', 16);
    ctx.fillText(desc, 0, 36);
    ctx.restore();
  }
  if (gameState === 'ROUND_OVER'){
    let col, text, sub;
    if (nextRoundWinner === 0){ col = '#ffc94a'; text = t('aDraw'); sub = t('aDrawSub'); }
    else {
      col = nextRoundWinner === 1 ? '#ff5a5f' : '#4a9eff';
      text = nextRoundWinner === 1 ? t('aWinP1') : t('aWinP2');
      sub = roundOutcome === 'time' ? t('aTimeUpSub') : t('aNext');
    }
    if (roundOutcome === 'time' && nextRoundWinner !== 0) text = t('aTimeUp');
    const k = Math.min(1, (2.1 - roundOverTimer)/0.3);
    const pop = 1 + (1-k)*0.25;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(0, -10 + (1-k)*18); ctx.scale(pop, pop);
    const px = fitText(text, 620, /^[ -]+$/.test(text) ? '400' : '800', 64, /^[ -]+$/.test(text) ? HUD_FONT : BODY_FONT);
    bigText(text, 0, 0, px, col);
    ctx.fillStyle = '#c2b5a8';
    fitText(sub, 600, '600', 18);
    ctx.fillText(sub, 0, 52);
    ctx.restore();
  }
  ctx.restore();
}
`);

/* ───────────────────────── E11. draw() — 블룸 경로 분기 + 프레임 샘플 ───────────────────────── */
replaceBlock('E11 draw', 'function draw(){', '// ============================== UI ==============================',
`let _lastDrawT = 0;
function draw(){
  _cvApplyPending();
  const W = canvas.width, H = canvas.height;
  const sctx = POST ? POST.begin(W, H) : null;
  bloomActive = !!sctx;
  ctx = sctx || ctxMain;
  if (!sctx) ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2, H/2);
  const s = Math.min(W, H)/780;
  VW = W/s; VH = H/s;
  ctx.scale(s,s);
  const theme = curArena;
  drawBackdrop(theme);
  if (screenShake > 0.1){
    ctx.translate((vr()-0.5)*screenShake, (vr()-0.5)*screenShake);
    screenShake *= 0.88;
  }
  drawArena(theme);
  drawRuleOverlay();
  drawHazards();
  drawTrail(P1); drawTrail(P2);
  drawFighter(P1); drawFighter(P2);
  drawEffects(theme);
  ctx.restore();
  if (sctx){
    // 세계 → 블룸 합성(WebGL). 이후 문자·비네트는 «투명 메인 캔버스»에 — 글자는 번지지 않는다.
    POST.end();
    ctx = ctxMain;
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(s,s);
  } else {
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(s,s);
  }
  drawAnnounce();
  // vignette frames the ring and keeps the HUD legible over bright arenas
  const vg = ctx.createRadialGradient(0, 0, Math.min(VW,VH)*0.26, 0, 0, Math.max(VW,VH)*0.56);
  vg.addColorStop(0, 'rgba(7,4,5,0)');
  vg.addColorStop(0.62, 'rgba(7,4,5,0.18)');
  vg.addColorStop(1, 'rgba(7,4,5,0.56)');
  ctx.fillStyle = vg;
  ctx.fillRect(-VW/2, -VH/2, VW, VH);
  if (VH > VW*1.12){
    const edge = Math.min(VW, VH)*0.5;
    const band = ctx.createLinearGradient(0, -VH/2, 0, VH/2);
    band.addColorStop(0, 'rgba(7,4,5,0.92)');
    band.addColorStop(Math.max(0.02, (VH/2 - edge*1.02)/VH), 'rgba(7,4,5,0)');
    band.addColorStop(Math.min(0.98, (VH/2 + edge*1.02)/VH), 'rgba(7,4,5,0)');
    band.addColorStop(1, 'rgba(7,4,5,0.92)');
    ctx.fillStyle = band;
    ctx.fillRect(-VW/2, -VH/2, VW, VH);
  }
  ctx.restore();
  // 60fps 감시 표본(플레이 중만) — 렌더 품질 강등 판단에만 쓰인다.
  if (POST){
    const now = performance.now();
    if (gameState === 'PLAYING' && activeScreen === null){ if (_lastDrawT) POST.sample(now - _lastDrawT); _lastDrawT = now; }
    else _lastDrawT = 0;
  }
}
`);

/* ───────────────────────── E12. 출석표(오늘의 대결) UI — 규칙·금액 무접촉, 표시만 ───────────────────────── */
replaceBlock('E12 renderDailyBout', 'function renderDailyBout(){', '// ---------------- help ----------------',
`/* 출석표 문구 — 기존 I18N 테이블은 바이트 무접촉이라 «별도» 사전으로 둔다. */
const I18N_ATT = {
  ko:{day:'{n}일', dayShort:'{n}', peak:'특급', tomorrow:'내일 오면 {n}일째', tomorrowPeak:'내일 오면 특급 대결 · 경기장 영구 등록', peakEvery:'7일 연속 달성 · 매일 특급 대결 + 경기장 영구 등록', todayDone:'오늘 출석 완료', todayOpen:'오늘 한 판이면 {n}일째'},
  en:{day:'Day {n}', dayShort:'{n}', peak:'PEAK', tomorrow:'Come back tomorrow for day {n}', tomorrowPeak:'Tomorrow: peak bout + arena unlocked for good', peakEvery:'7-day streak · peak bout + a permanent arena every day', todayDone:'Checked in today', todayOpen:'One bout today makes it day {n}'}
};
function ta(k, n){ const L = I18N_ATT[curLang] || I18N_ATT.ko; return fmt(L[k] !== undefined ? L[k] : I18N_ATT.en[k], n); }
/* 7칸 스트립: 1~6 = DAILY_POOL 상대(고정), 7 = 특급(DAILY_PEAK, streak>=7 이면 매일 + 경기장 영구 등록).
   streak 이 8 이상이면 «7+ 매일 특급» 상태로 7칸 전부 채운다. 표시는 claimAttendance/todaysFeatured 를
   «읽기만» 한다 — 지급 규칙은 그 함수들이 그대로 갖고 있다. */
function renderAttendanceStrip(streak, claimedToday){
  const strip = $('att-strip'), cap = $('att-cap');
  if (!strip) return;
  const today = Math.max(1, streak|0);           // claimedToday 면 오늘 = streak, 아니면 오늘 받으면 될 값(previewStreak)
  const filled = claimedToday ? today : today - 1; // 이미 받은 날 수
  let html = '';
  for (let d=1; d<=7; d++){
    const isPeak = d === 7;
    const done = d <= filled || (filled >= 7);
    const isToday = !claimedToday ? (d === Math.min(7, today)) : (d === Math.min(7, today));
    const feat = isPeak ? DAILY_PEAK[0] : DAILY_POOL[d-1];
    const c = CHAR_BY_ID[feat.char];
    let cls = 'att-cell' + (isPeak ? ' peak' : '') + (done ? ' done' : '') + (isToday ? ' today' : '') + (isToday && !claimedToday ? ' open' : '');
    html += '<span class="' + cls + '" style="--c:' + c.color + '"><i class="chk" aria-hidden="true"></i>' +
      '<b>' + (isPeak ? ta('peak') : ta('dayShort', d)) + '</b></span>';
  }
  strip.innerHTML = html;
  if (cap){
    let txt;
    if (filled >= 7) txt = ta('peakEvery');
    else if (!claimedToday) txt = ta('todayOpen', today);
    else if (today === 6) txt = ta('tomorrowPeak');
    else txt = ta('tomorrow', today + 1);
    cap.textContent = txt;
  }
}
function renderDailyBout(){
  const btn = $('btn-daily');
  if (!btn) return;
  const claimedToday = (SAVE.attendance.lastClaimDateKey === kstDateKey());
  const streak = claimedToday ? SAVE.attendance.streak : previewStreak();
  const feat = todaysFeatured(streak);
  const c = CHAR_BY_ID[feat.char], a = ARENA_BY_ID[feat.arena];
  btn.classList.remove('hidden');
  btn.classList.toggle('claimed', claimedToday);
  safeSet('tx-daily-eyebrow', function(){ return claimedToday ? t('dailyClaimedTitle') : t('dailyTitle'); });
  safeSet('tx-daily-sub', function(){ return charName(c) + ' · ' + t(a.k) + ' · ' + t(RULE_BY_ID[feat.rule].k); });
  safeSet('tx-daily-streak-label', function(){ return t('dailyStreakUnit'); });
  const nEl = $('daily-streak-n'); if (nEl) nEl.textContent = String(streak);
  const cv = $('daily-portrait');
  if (cv) paintPortrait(cv, c, 40, {blink:1});
  try { renderAttendanceStrip(streak, claimedToday); } catch(e){ console.error('[attendance strip]', e); }
  btn.onclick = function(){
    playUI();
    claimAttendance();
    const p1char = CHAR_BY_ID[SAVE.lastChar] || CHARS[0];
    startMatch({mode:'practice', c1: p1char, c2: c, cpu:true,
      arena: a, rule: RULE_BY_ID[feat.rule], wins:3, pers:'balance', skill:0.5, diff: SAVE.diff});
    showScreen(null);
    renderDailyBout(); // 다음에 타이틀로 돌아왔을 때 claimed 상태가 바로 반영되도록
  };
}
`);

/* ───────────────────────── E13. 결과 화면 숫자 카운트업 — 화면 전환을 «관찰»(showResultScreen 무접촉) ───────────────────────── */
patch('E13 result countup', `let lastTime = performance.now();
function gameLoop(now){`,
`/* 결과 화면 통계 숫자 카운트업(0→값, 700ms, 의존성 0). showResultScreen()/showScreen() 은 로직 파일이라
   건드리지 않고, #sc-result 의 hidden 클래스가 벗겨지는 순간을 MutationObserver 로 잡는다. UI 전용. */
(function(){
  const sc = $('sc-result'); if (!sc || typeof MutationObserver === 'undefined') return;
  let raf = 0;
  function run(){
    const els = Array.prototype.slice.call(sc.querySelectorAll('.statrow .v'));
    const jobs = [];
    els.forEach(function(el){
      const txt = el.textContent, m = /^(\\d+)(%?)$/.exec(txt.trim());
      if (!m) return;
      jobs.push({el:el, n:+m[1], suf:m[2], txt:txt});
    });
    if (!jobs.length) return;
    const t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    function step(now){
      const k = Math.min(1, (now - t0)/700), e = 1 - Math.pow(1 - k, 3);
      jobs.forEach(function(j){ j.el.textContent = Math.round(j.n*e) + j.suf; });
      if (k < 1) raf = requestAnimationFrame(step); else { raf = 0; jobs.forEach(function(j){ j.el.textContent = j.txt; }); }
    }
    raf = requestAnimationFrame(step);
  }
  let wasHidden = sc.classList.contains('hidden');
  new MutationObserver(function(){
    const hid = sc.classList.contains('hidden');
    if (wasHidden && !hid) run();
    wasHidden = hid;
  }).observe(sc, {attributes:true, attributeFilter:['class']});
})();
let lastTime = performance.now();
function gameLoop(now){`);

/* ───────────────────────── E14. 남은 shadowBlur → glow() (해저드 등 그대로 둔 렌더 코드) ───────────────────────── */
{
  const before = js;
  js = js.replace(/ctx\.shadowBlur = (?!0;)(?!glow\()([^;]+);/g, (m, expr) => `ctx.shadowBlur = glow(${expr});`);
  const n = count(js, 'glow(') - count(before, 'glow(');
  log.push(`E14 shadowBlur→glow ×${n}`);
}

/* ───────────────────────── 검증: 보호 대상이 «문자열로» 그대로 있는지 ───────────────────────── */
for (const must of [
  "function claimAttendance(){", "function todaysFeatured(streakOverride){", "function finishMatch(winner){", "function fighterCollision(){",
  "function physicsStep(h){", "function update(dt){", "const PROMO_DAIMYOJIN_STAGE = 8;", "function promoNotifyDaimyojinUnlock(){",
  "function startMatch(cfg){", "function showResultScreen(){", "function frameHUD(){", "function syncHUD(){", "function loadSave(){", "function persist(){",
]) if (count(js, must) !== 1) throw new Error('protected anchor changed: ' + must);

writeFileSync(OUT, crlf ? js.replace(/\n/g, '\r\n') : js);
console.log('patched → ' + OUT + '\n  ' + log.join('\n  '));
