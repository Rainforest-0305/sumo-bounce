#!/usr/bin/env node
/**
 * 스모 바운스 그래픽 고도화(2026-08-30) — index.html «스타일·마크업 껍데기만» 패치.
 * body 의 data-promo-* 속성, #ad-slots 의 광고 지면 3종, 모든 id 집합, 모듈 스크립트 진입점은 무접촉(끝에서 검증).
 *   node scripts/gfx_patch_html.mjs
 * 입력: scripts/_pristine_index_20260829-16.html  출력: index.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'scripts/_pristine_index_20260829-16.html');
const OUT = resolve(ROOT, 'index.html');
let html = readFileSync(SRC, 'utf8');
const crlf = html.includes('\r\n');
html = html.replace(/\r\n/g, '\n');
const log = [];
function count(s, sub) { return s.split(sub).length - 1; }
function patch(name, oldS, newS, times = 1) {
  const n = count(html, oldS);
  if (n !== times) throw new Error(`«${name}» anchor found ${n} times (need ${times})`);
  html = html.split(oldS).join(newS);
  log.push(`${name} ×${n}`);
}
/* 보존 대상 스냅샷(패치 전) */
const bodyTag = html.match(/<body[^>]*>/)[0];
const adSlot = html.match(/<div id="ad-slots"[\s\S]*?<\/div>/)[0];
const ids = (html.match(/ id="[^"]+"/g) || []).sort();
const modules = (html.match(/<script type="module"[^>]*>/g) || []);

/* ── 1. 토큰·서체·테마 ── */
patch('tokens',
`:root{
  --bg:#0b0e14; --bg2:#0e131c; --card:#151b26; --card2:#1c2433; --line:rgba(255,255,255,.09);
  --txt:#eef2f7; --dim:#93a1b5; --dim2:#8a97ac;
  --red:#ff5a5f; --blue:#4a9eff; --gold:#ffd23f; --ok:#2fd48f; --vio:#c9a7ff;`,
`:root{
  /* 그래픽 고도화(2026-08-30) 팔레트 규율 — DESIGN.md §2. 변수 «이름»은 기존 규칙이 참조하므로 그대로 두고
     «값»만 3색+먹 체계로: 먹(따뜻한 검정)·등롱 금·주홍(P1)·남색(P2). ok(초록)→남색, vio(보라)→등롱 금 틴트. */
  --bg:#0e0a0b; --bg2:#130d0f; --card:#181113; --card2:#241a1d; --line:rgba(255,236,214,.09);
  --txt:#f6efe6; --dim:#c2b5a8; --dim2:#a89a8c;
  --red:#ff5a5f; --blue:#4a9eff; --gold:#ffc94a; --gold2:#ff9d2e; --ok:#4a9eff; --vio:#ffdd8a; --ink-on-gold:#241703;
  --display:"Anton","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;`);
patch('theme-color', `<meta name="theme-color" content="#0b0e14">`, `<meta name="theme-color" content="#0e0a0b">`);
patch('font-face', `<style>\n:root{`,
`<style>
/* Anton (Google Fonts, SIL OFL 1.1) — latin 서브셋만 self-host(18.6KB, 외부 요청 0). 숫자·영문·VS·READY 만
   디스플레이체, 한글은 unicode-range 밖이라 시스템 한글 서체로 폴백된다. */
@font-face{font-family:"Anton";font-style:normal;font-weight:400;font-display:swap;
  src:url(./fonts/anton-400-latin.woff2) format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{`);
patch('body font',
`  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans KR','Noto Sans JP',sans-serif;`,
`  font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Segoe UI','Helvetica Neue',Arial,'Noto Sans JP',sans-serif;
  font-synthesis:none;`);
patch('selection', `body{font-feature-settings:"tnum";}`, `body{font-feature-settings:"tnum";}
::selection{background:rgba(255,201,74,.35);color:var(--txt)}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}`);

/* ── 2. HUD ── */
patch('pip glow',
`.pip.on.p1{background:var(--red);box-shadow:0 0 10px rgba(255,90,95,.75)}
.pip.on.p2{background:var(--blue);box-shadow:0 0 10px rgba(74,158,255,.75)}`,
`.pip.on{animation:pipPop .34s var(--ez)}
.pip.on.p1{background:var(--red)}
.pip.on.p2{background:var(--blue)}
@keyframes pipPop{0%{transform:scale(1.6)}100%{transform:scale(1)}}`);
patch('hud-round font', `.hud-round{font-size:.7rem;font-weight:900;letter-spacing:.14em;color:var(--dim);text-transform:uppercase}`,
  `.hud-round{font-family:var(--display);font-size:.82rem;font-weight:400;letter-spacing:.1em;color:var(--dim);text-transform:uppercase}`);
patch('hud-timer transition', `.hud-timer i{display:block;height:100%;width:100%;border-radius:2px;background:var(--gold);
  transition:width .2s linear,background .4s ease}
.hud-timer i.warn{background:var(--red)}`,
`.hud-timer i{display:block;height:100%;width:100%;border-radius:2px;background:var(--gold);transition:background .4s ease}
.hud-timer i.warn{background:var(--red);animation:timerPulse .9s ease-in-out infinite}
@keyframes timerPulse{0%,100%{opacity:1}50%{opacity:.55}}`);
patch('chip hot', `.chip.hot{color:#ffe9a8;border-color:rgba(255,210,63,.4);background:rgba(255,210,63,.10)}`,
  `.chip.hot{color:#ffe9a8;border-color:rgba(255,201,74,.4);background:rgba(255,201,74,.10)}`);
patch('gauge transition', `.gauge-track i{display:block;height:100%;width:0%;border-radius:4px;transition:width .05s linear}`,
  `.gauge-track i{display:block;height:100%;width:0%;border-radius:4px}`);
patch('gauge p1', `.gauge.p1 .gauge-track i{background:linear-gradient(90deg,#ff5a5f,#ffd23f)}
.gauge.p2 .gauge-track i{background:linear-gradient(270deg,#4a9eff,#7ef6dc)}
.gauge.full .gauge-track i{box-shadow:0 0 12px currentColor;filter:brightness(1.25)}`,
`.gauge.p1 .gauge-track i{background:linear-gradient(90deg,#ff5a5f,#ffc94a)}
.gauge.p2 .gauge-track i{background:linear-gradient(270deg,#4a9eff,#9fd0ff)}
.gauge.full .gauge-track i{filter:brightness(1.3) saturate(1.1)}`);

/* ── 3. 화면 배경·CTA 바 ── */
patch('screen bg', `  background:radial-gradient(125% 62% at 50% -6%, #16202f 0%, #0d121b 46%, #0b0e14 100%);`,
  `  background:radial-gradient(125% 62% at 50% -6%, #2a1518 0%, #150d0f 46%, #0e0a0b 100%);`);
patch('screen glass', `.screen.glass{background:linear-gradient(180deg,rgba(8,11,17,.78),rgba(8,11,17,.94))}`,
  `.screen.glass{background:linear-gradient(180deg,rgba(12,7,8,.80),rgba(12,7,8,.95))}`);
patch('glass cta', `.screen.glass .sticky-cta{background:#090c12;`, `.screen.glass .sticky-cta{background:#0b0708;`);
patch('glass cta shadow', `  box-shadow:0 -22px 26px -6px #090c12,0 -1px 0 rgba(255,255,255,.08)}`, `  box-shadow:0 -22px 26px -6px #0b0708,0 -1px 0 rgba(255,236,214,.08)}`);
patch('scroll cue', `  border-radius:10px;background:rgba(32,41,58,.97);border:1px solid var(--line);`, `  border-radius:10px;background:rgba(46,32,36,.97);border:1px solid var(--line);`);

/* ── 4. 로고·타이틀 ── */
patch('logo ring',
`.logo .ring{width:44px;height:44px;border-radius:50%;border:5px solid var(--gold);
  box-shadow:0 0 26px rgba(255,210,63,.45),inset 0 0 14px rgba(255,210,63,.25);position:relative;
  animation:ringpulse 3s var(--ez) infinite}
.logo .ring::after{content:"";position:absolute;inset:8px;border-radius:50%;
  background:linear-gradient(135deg,var(--red),var(--blue))}`,
`.logo .ring{width:46px;height:46px;border-radius:50%;border:5px solid var(--gold);
  box-shadow:0 10px 20px -8px rgba(0,0,0,.7);position:relative;background:#1c1214;
  animation:ringpulse 3s var(--ez) infinite}
.logo .ring::after{content:"";position:absolute;inset:8px;border-radius:50%;
  background:linear-gradient(135deg,var(--red) 0 48%,var(--blue) 52% 100%)}`);
patch('h1 title',
`h1.title{font-size:clamp(2.1rem,9vw,3.4rem);font-weight:900;letter-spacing:.01em;line-height:1;
  background:linear-gradient(100deg,#ff8a8f,#ffd23f 45%,#7ec4ff);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 6px 22px rgba(255,150,90,.28))}`,
`/* 단색 잉크 + 주홍 오프셋 그림자(흥행 포스터 글자) — 그라데이션 텍스트·제로오프셋 헤일로는 AI 티(검출기 기준) */
h1.title{font-family:var(--display);font-size:clamp(2.3rem,10vw,3.8rem);font-weight:800;letter-spacing:.01em;line-height:1;
  color:var(--txt);text-shadow:0 4px 0 #a52a2c,0 12px 24px rgba(0,0,0,.55)}`);
patch('sc-title', `h2.sc-title{font-size:clamp(1.25rem,5vw,1.7rem);font-weight:900;letter-spacing:-.01em;text-align:center}`,
  `h2.sc-title{font-size:clamp(1.25rem,5vw,1.7rem);font-weight:800;letter-spacing:-.01em;text-align:center}`);
/* 아이브로우(제목 «위» 라벨) → 제목 «아래» 본문형 한 줄. DOM 순서는 무접촉 — flex order 로만 바꾼다. */
patch('eyebrow', `.eyebrow{font-size:.66rem;font-weight:900;letter-spacing:.18em;color:var(--gold);text-transform:uppercase}`,
`.eyebrow{font-size:.84rem;font-weight:700;letter-spacing:0;color:var(--dim);text-transform:none}
#sc-select .panel>div:first-child,#sc-result .panel>div:first-child{display:flex;flex-direction:column;align-items:center;gap:6px}
#sc-select .panel>div:first-child .eyebrow,#sc-result .panel>div:first-child .eyebrow{order:2}
#sc-select .panel>div:first-child .sc-title{order:1;margin-top:0!important}
#sc-result .panel>div:first-child .bigres{order:1}
#sc-result .panel>div:first-child .sc-sub{order:3;margin-top:2px!important}
#vs-eyebrow{font-size:1.05rem;font-weight:800;color:var(--txt)}`);

/* ── 5. 버튼 ── */
patch('btn primary',
`.btn.primary{background:linear-gradient(100deg,#ffd23f,#ffb03f);color:#20170a;border-color:transparent;
  box-shadow:0 10px 26px rgba(255,180,63,.24)}
.btn.primary:hover{filter:brightness(1.07);box-shadow:0 14px 32px rgba(255,180,63,.34)}`,
`.btn.primary{background:linear-gradient(170deg,#ffd35c,#ffb42e);color:var(--ink-on-gold);border-color:transparent;
  box-shadow:0 10px 22px -8px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.35) inset}
.btn.primary:hover{filter:brightness(1.06);box-shadow:0 14px 26px -8px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.35) inset}`);
patch('btn weight', `  background:var(--card);color:var(--txt);font-size:1rem;font-weight:800;cursor:pointer;`, `  background:var(--card);color:var(--txt);font-size:1rem;font-weight:700;cursor:pointer;`);

/* ── 6. 오늘의 대결 카드 + 출석표 ── */
patch('daily css',
`.daily-bout{display:flex;align-items:center;gap:12px;width:100%;min-height:74px;padding:12px 16px;
  border-radius:var(--r-l);cursor:pointer;text-align:left;font-family:inherit;color:var(--txt);
  background:linear-gradient(100deg,rgba(255,210,63,.14),rgba(255,138,61,.06));
  border:1px solid rgba(255,210,63,.34);
  transition:transform .18s var(--ez),border-color .2s,box-shadow .2s;margin-bottom:11px}
.daily-bout:hover{border-color:rgba(255,210,63,.55);transform:translateY(-2px)}
.daily-bout:active{transform:scale(.985)}
.daily-bout .por{flex:0 0 auto;width:46px;height:46px;border-radius:15px;background:rgba(255,255,255,.06);
  display:flex;align-items:center;justify-content:center}
.daily-bout .por canvas{width:40px;height:40px}
.daily-bout .tx{flex:1 1 auto;min-width:0}
.daily-bout .eyebrow{font-size:.62rem;font-weight:900;letter-spacing:.1em;color:var(--gold);text-transform:uppercase}
.daily-bout .sub{font-size:.8rem;color:var(--dim);line-height:1.35;margin-top:2px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.daily-bout .streak{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-width:38px;padding:3px 6px;border-radius:11px;background:rgba(255,210,63,.16);
  border:1px solid rgba(255,210,63,.4)}
.daily-bout .streak b{font-size:.95rem;font-weight:900;color:var(--gold);line-height:1.1}
.daily-bout .streak span{font-size:.52rem;font-weight:800;color:var(--gold);letter-spacing:.04em;text-transform:uppercase}
.daily-bout.claimed{opacity:.7}
.daily-bout.claimed .eyebrow{color:var(--dim)}`,
`/* 오늘의 대결 카드 = 2행: [초상·제목/부제·연속일] + [출석표 7칸 스트립 + 캡션]. 규칙·지급은 game.js
   claimAttendance()/todaysFeatured() 무접촉 — 스트립은 그 값을 «읽어» 그린다. DOM 단일 카드, 반복 렌더 없음. */
.daily-bout{display:flex;flex-direction:column;gap:9px;width:100%;padding:11px 14px 10px;
  border-radius:var(--r-l);cursor:pointer;text-align:left;font-family:inherit;color:var(--txt);
  background:linear-gradient(160deg,rgba(255,201,74,.13),rgba(255,157,46,.05) 60%,rgba(255,201,74,.02));
  border:1px solid rgba(255,201,74,.32);
  transition:transform .18s var(--ez),border-color .2s,box-shadow .2s;margin-bottom:11px}
.daily-bout:hover{border-color:rgba(255,201,74,.55);transform:translateY(-2px)}
.daily-bout:active{transform:scale(.985)}
.daily-bout .row{display:flex;align-items:center;gap:12px;width:100%;min-height:46px}
.daily-bout .por{flex:0 0 auto;width:46px;height:46px;border-radius:15px;background:rgba(255,236,214,.06);
  display:flex;align-items:center;justify-content:center}
.daily-bout .por canvas{width:40px;height:40px}
.daily-bout .tx{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.daily-bout .eyebrow{font-size:.92rem;font-weight:800;letter-spacing:0;color:var(--txt);text-transform:none;order:0}
.daily-bout .sub{font-size:.78rem;color:var(--dim);line-height:1.35;margin-top:2px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.daily-bout .streak{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-width:44px;padding:3px 7px;border-radius:11px;background:rgba(255,201,74,.14);
  border:1px solid rgba(255,201,74,.38)}
.daily-bout .streak b{font-family:var(--display);font-size:1.25rem;font-weight:400;color:var(--gold);line-height:1;letter-spacing:.02em}
.daily-bout .streak span{font-size:.7rem;font-weight:700;color:var(--gold);letter-spacing:.02em;margin-top:1px}
.daily-bout.claimed .eyebrow{color:var(--gold)}
/* 출석표 스트립 — 7칸. 받은 날 = 체크, 오늘 = 금 테두리(미수령이면 맥동), 7번째 = 특급(크게). */
.att-strip{display:grid;grid-template-columns:repeat(6,1fr) 1.45fr;gap:5px;width:100%}
.att-cell{position:relative;display:flex;align-items:center;justify-content:center;min-height:30px;border-radius:9px;
  background:rgba(255,236,214,.05);background:color-mix(in srgb,var(--c) 14%,rgba(255,236,214,.03));border:1px solid rgba(255,236,214,.09);overflow:hidden}
.att-cell b{font-family:var(--display);font-size:.9rem;font-weight:400;letter-spacing:.04em;color:var(--dim2);line-height:1}
.att-cell.done{background:rgba(255,201,74,.16);border-color:rgba(255,201,74,.35)}
.att-cell.done b{color:var(--gold)}
.att-cell .chk{display:none;position:absolute;right:4px;top:3px;width:5px;height:9px;border-right:2px solid var(--gold);border-bottom:2px solid var(--gold);transform:rotate(40deg)}
.att-cell.done .chk{display:block}
.att-cell.today{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.att-cell.today.open{animation:attPulse 1.6s var(--ez) infinite}
.att-cell.today.open b{color:var(--txt)}
@keyframes attPulse{0%,100%{background:rgba(255,201,74,.10)}50%{background:rgba(255,201,74,.26)}}
.att-cell.peak{min-height:34px;border-radius:11px;background:linear-gradient(160deg,rgba(255,201,74,.12),rgba(255,157,46,.08))}
.att-cell.peak b{font-family:inherit;font-size:.72rem;font-weight:800;letter-spacing:.02em;color:var(--gold)}
.att-cell.peak.done{background:linear-gradient(160deg,#ffd35c,#ffb42e);border-color:transparent}
.att-cell.peak.done b{color:var(--ink-on-gold)}
.att-cell.peak.done .chk{border-color:var(--ink-on-gold)}
.att-cap{font-size:.74rem;color:var(--dim);line-height:1.3;margin-top:-2px}
.daily-bout.claimed .att-cap{color:var(--gold)}`);
patch('daily html',
`      <button class="daily-bout hidden" id="btn-daily" type="button">
        <span class="por"><canvas id="daily-portrait" width="80" height="80"></canvas></span>
        <span class="tx">
          <span class="eyebrow" id="tx-daily-eyebrow">오늘의 대결</span>
          <span class="sub" id="tx-daily-sub"></span>
        </span>
        <span class="streak"><b id="daily-streak-n">0</b><span id="tx-daily-streak-label">일째</span></span>
      </button>`,
`      <button class="daily-bout hidden" id="btn-daily" type="button">
        <span class="row">
          <span class="por"><canvas id="daily-portrait" width="80" height="80"></canvas></span>
          <span class="tx">
            <span class="eyebrow" id="tx-daily-eyebrow">오늘의 대결</span>
            <span class="sub" id="tx-daily-sub"></span>
          </span>
          <span class="streak"><b id="daily-streak-n">0</b><span id="tx-daily-streak-label">일째</span></span>
        </span>
        <!-- 출석표(2026-08-30): 7칸 스트립 + 캡션. game.js renderAttendanceStrip() 가 채운다. 규칙·지급 무접촉. -->
        <span class="att-strip" id="att-strip" aria-hidden="true"></span>
        <span class="att-cap" id="att-cap"></span>
      </button>`);
/* 선택·도움말 화면 제목이 우상단 개인정보 링크(top 58 + 36px)와 겹치지 않게 — 라이브에서도 겹쳤던 결함. */
patch('select top pad', `@media (max-height:660px){`, `#sc-select,#sc-help{padding-top:calc(104px + var(--sa-top, env(safe-area-inset-top)))}
@media (max-height:660px){`);
patch('daily compress 660', `  .daily-bout{min-height:64px;padding:9px 14px}
  .daily-bout .por{width:40px;height:40px}
  .daily-bout .por canvas{width:34px;height:34px}`,
`  .daily-bout{padding:8px 12px 8px;gap:6px}
  .daily-bout .row{min-height:40px}
  .daily-bout .por{width:40px;height:40px}
  .daily-bout .por canvas{width:34px;height:34px}
  .att-cell{min-height:24px}
  .att-cell.peak{min-height:26px}
  .att-cap{display:none}`);

/* ── 7. 모드 카드·진행도 ── */
patch('mode badges',
`.mode .badge.a{background:linear-gradient(135deg,#ffd23f,#ff8a3d);color:#241703}
.mode .badge.v{background:linear-gradient(135deg,#ff5a5f,#4a9eff);color:#fff}
.mode .badge.p{background:linear-gradient(135deg,#2fd48f,#4a9eff);color:#04241a}`,
`.mode .badge{font-family:var(--display);font-weight:400;font-size:1.05rem;letter-spacing:.02em}
.mode .badge.a{background:linear-gradient(160deg,#ffd35c,#ff9d2e);color:var(--ink-on-gold)}
.mode .badge.v{background:linear-gradient(135deg,#ff5a5f 0 48%,#4a9eff 52% 100%);color:#0e0a0b}
.mode .badge.p{background:linear-gradient(160deg,#7fc0ff,#4a9eff);color:#0e1a2e}`);
patch('mode h3', `.mode .tx h3{font-size:1.02rem;font-weight:900;margin-bottom:3px}`, `.mode .tx h2{font-size:1.02rem;font-weight:800;margin-bottom:3px}`);
patch('mode h3 html 1', `<span class="tx"><h3 id="tx-m-arcade">아케이드 토너먼트</h3><p id="tx-m-arcade-d">CPU와 8연전을 홀로 돌파한다.</p></span>`,
  `<span class="tx"><h2 id="tx-m-arcade">아케이드 토너먼트</h2><p id="tx-m-arcade-d">CPU와 12연전을 홀로 돌파한다.</p></span>`);
patch('mode h3 html 2', `<span class="tx"><h3 id="tx-m-versus">로컬 2인 대전</h3><p id="tx-m-versus-d">한 기기에서 두 명이 5판 3선승으로 겨룬다.</p></span>`,
  `<span class="tx"><h2 id="tx-m-versus">로컬 2인 대전</h2><p id="tx-m-versus-d">한 기기에서 두 명이 5판 3선승으로 겨룬다.</p></span>`);
patch('mode h3 html 3', `<span class="tx"><h3 id="tx-m-practice">자유 연습</h3><p id="tx-m-practice-d">경기장과 규칙을 골라 마음껏 연습한다.</p></span>`,
  `<span class="tx"><h2 id="tx-m-practice">자유 연습</h2><p id="tx-m-practice-d">경기장과 규칙을 골라 마음껏 연습한다.</p></span>`);
patch('prog v', `.prog .cell .v{font-size:1.15rem;font-weight:900;margin-top:3px}`,
  `.prog .cell .v{font-family:var(--display);font-size:1.4rem;font-weight:400;letter-spacing:.03em;margin-top:2px;line-height:1.1}`);
patch('prog k', `.prog .cell .k{font-size:.6rem;font-weight:800;letter-spacing:.1em;color:var(--dim2);text-transform:uppercase}`,
  `.prog .cell .k{font-size:.7rem;font-weight:700;letter-spacing:.04em;color:var(--dim2)}`);

/* ── 8. 선택 화면 ── */
patch('ccard sel12', `.ccard.sel12{border-color:var(--vio);box-shadow:0 0 0 3px rgba(201,167,255,.22)}`,
  `.ccard.sel12{border-color:var(--gold);box-shadow:0 0 0 3px rgba(255,201,74,.22)}`);
patch('tagn size', `.ccard .tagn{position:absolute;top:5px;left:5px;font-size:.55rem;font-weight:900;padding:1px 5px;
  border-radius:6px;letter-spacing:.04em}`,
`.ccard .tagn{position:absolute;top:5px;left:5px;font-family:var(--display);font-size:.72rem;font-weight:400;padding:2px 6px 1px;
  border-radius:6px;letter-spacing:.06em;line-height:1.1}`);
patch('tagn colors', `.ccard .tagn.p1{background:var(--red);color:#20170a}
.ccard .tagn.p2{background:var(--blue);color:#20170a}`, `.ccard .tagn.p1{background:var(--red);color:#0e0a0b}
.ccard .tagn.p2{background:var(--blue);color:#0e0a0b}`);
patch('stat bar', `.stat .st i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4a9eff,#ffd23f);
  transition:width .4s var(--ez)}`, `.stat .st i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4a9eff,#ffc94a)}`);
patch('stat label', `.stat .sl{flex:0 0 auto;font-size:.58rem;font-weight:800;color:var(--dim2);width:44px;
  letter-spacing:.05em;text-transform:uppercase}`, `.stat .sl{flex:0 0 auto;font-size:.7rem;font-weight:700;color:var(--dim2);width:44px;
  letter-spacing:.02em}`);
patch('seg diff colors', `.seg button.on[data-d="0"]{color:var(--ok)} .seg button.on[data-d="1"]{color:var(--gold)}`,
  `.seg button.on[data-d="0"]{color:var(--blue)} .seg button.on[data-d="1"]{color:var(--gold)}`);
patch('seg-lab', `.seg-lab span{font-size:.68rem;font-weight:800;letter-spacing:.1em;color:var(--dim2);text-transform:uppercase}`,
  `.seg-lab span{font-size:.78rem;font-weight:700;letter-spacing:.02em;color:var(--dim2)}`);
patch('pick on', `.pick.on{border-color:var(--gold);color:#ffe9a8;background:rgba(255,210,63,.10)}`, `.pick.on{border-color:var(--gold);color:#ffe9a8;background:rgba(255,201,74,.10)}`);
patch('detail ti', `.detail .info .ti{font-size:.72rem;color:var(--gold);font-weight:700;margin-top:2px;line-height:1.3}`,
  `.detail .info .ti{font-size:.76rem;color:var(--gold);font-weight:700;margin-top:2px;line-height:1.3}`);

/* ── 9. VS·결과 ── */
patch('vsbadge', `.vsbadge{font-size:.58rem;font-weight:900;letter-spacing:.1em;padding:3px 9px;border-radius:999px;text-transform:uppercase}`,
  `.vsbadge{font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:3px 10px;border-radius:999px}`);
patch('vsmid',
`.vsmid{flex:0 0 auto;font-size:clamp(1.3rem,5.5vw,2rem);font-weight:900;font-style:italic;
  background:linear-gradient(120deg,#ff5a5f,#ffd23f,#4a9eff);-webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;animation:vspop .55s var(--ez) both .18s}`,
`.vsmid{flex:0 0 auto;font-family:var(--display);font-size:clamp(1.9rem,8vw,2.8rem);font-weight:400;letter-spacing:.04em;
  color:var(--red);text-shadow:0 3px 0 #5a1113,0 8px 16px rgba(0,0,0,.5);animation:vspop .55s var(--ez) both .18s}`);
patch('bigres', `.bigres{font-size:clamp(2rem,10vw,3.4rem);font-weight:900;line-height:1;text-align:center;
  animation:respop .5s var(--ez) both}`, `.bigres{font-family:var(--display);font-size:clamp(2.4rem,12vw,4.2rem);font-weight:800;line-height:1;text-align:center;
  letter-spacing:.02em;animation:respop .5s var(--ez) both}`);
patch('bigres win', `.bigres.win{background:linear-gradient(100deg,#ffd23f,#ff8a3d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.bigres.lose{color:#7c8798}`, `.bigres.win{color:var(--gold);text-shadow:0 4px 0 #8a4a00,0 12px 24px rgba(0,0,0,.55)}
.bigres.lose{color:#a89a8c;text-shadow:0 4px 0 #2a1c1e,0 12px 24px rgba(0,0,0,.55)}`);
patch('statrow', `.statrow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;
  border-bottom:1px solid rgba(255,255,255,.055);gap:10px}`, `.statrow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;
  border-bottom:1px solid rgba(255,236,214,.06);gap:10px;animation:rowIn .45s var(--ez) both}
.statrow:nth-child(1){animation-delay:.10s}.statrow:nth-child(2){animation-delay:.16s}.statrow:nth-child(3){animation-delay:.22s}
.statrow:nth-child(4){animation-delay:.28s}.statrow:nth-child(5){animation-delay:.34s}.statrow:nth-child(6){animation-delay:.40s}.statrow:nth-child(7){animation-delay:.46s}
@keyframes rowIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}`);
patch('statrow v', `.statrow .v{font-size:1rem;font-weight:900;letter-spacing:-.01em}`, `.statrow .v{font-family:var(--display);font-size:1.2rem;font-weight:400;letter-spacing:.03em}`);
patch('unlockbox', `.unlockbox{width:100%;border-radius:var(--r-l);padding:13px 16px;display:flex;align-items:center;gap:12px;
  background:linear-gradient(100deg,rgba(255,210,63,.14),rgba(255,138,61,.07));
  border:1px solid rgba(255,210,63,.34);animation:respop .5s var(--ez) both .2s}`,
`.unlockbox{width:100%;border-radius:var(--r-l);padding:13px 16px;display:flex;align-items:center;gap:12px;
  background:linear-gradient(100deg,rgba(255,201,74,.14),rgba(255,157,46,.07));
  border:1px solid rgba(255,201,74,.34);animation:respop .5s var(--ez) both .2s}`);
patch('unlockbox t', `.unlockbox .t{font-size:.64rem;font-weight:900;letter-spacing:.12em;color:var(--gold);text-transform:uppercase}
.unlockbox .n{font-size:.95rem;font-weight:900;margin-top:2px}`, `.unlockbox .t{font-size:.74rem;font-weight:700;letter-spacing:.02em;color:var(--gold)}
.unlockbox .n{font-size:1rem;font-weight:800;margin-top:2px}`);
patch('lrow cur', `.lrow.cur{border-color:var(--gold);background:rgba(255,210,63,.08);box-shadow:0 0 0 2px rgba(255,210,63,.12)}`,
  `.lrow.cur{border-color:var(--gold);background:rgba(255,201,74,.08);box-shadow:0 0 0 2px rgba(255,201,74,.12)}`);
patch('lrow no', `.lrow .no{flex:0 0 auto;width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.07);
  display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:900;color:var(--dim)}`,
`.lrow .no{flex:0 0 auto;width:22px;height:22px;border-radius:7px;background:rgba(255,236,214,.07);
  display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:.78rem;font-weight:400;color:var(--dim)}`);
patch('lrow cur no', `.lrow.cur .no{background:var(--gold);color:#20170a}`, `.lrow.cur .no{background:var(--gold);color:var(--ink-on-gold)}`);
patch('lrow done', `.lrow.done .no{background:rgba(47,212,143,.2);color:var(--ok);position:relative}`, `.lrow.done .no{background:rgba(74,158,255,.18);color:var(--ok);position:relative}`);
patch('lrow lr', `.lrow .lr{flex:0 1 auto;min-width:0;max-width:48%;text-align:right;font-size:.62rem;font-weight:700;`, `.lrow .lr{flex:0 1 auto;min-width:0;max-width:48%;text-align:right;font-size:.7rem;font-weight:600;`);

/* ── 10. 언어/음소거·개인정보 링크·토스트 ── */
patch('lang-btn blur', `  text-align:center;font-family:inherit;backdrop-filter:blur(6px)}`, `  text-align:center;font-family:inherit}`);
patch('lang-btn bg', `.lang-btn{background:rgba(20,25,34,.82);border:1px solid var(--line);color:var(--dim2);font-size:.72rem;`, `.lang-btn{background:rgba(26,18,20,.9);border:1px solid var(--line);color:var(--dim2);font-size:.78rem;`);
patch('lang-btn hover', `.lang-btn:hover{color:#fff;background:rgba(40,48,62,.9)}
.lang-btn.active{color:#20170a;background:var(--gold);border-color:var(--gold)}`, `.lang-btn:hover{color:#fff;background:rgba(52,36,40,.95)}
.lang-btn.active{color:var(--ink-on-gold);background:var(--gold);border-color:var(--gold)}`);
patch('lang-list bg', `  background:rgba(16,21,30,.96);border:1px solid var(--line);border-radius:14px;padding:6px;`, `  background:rgba(22,15,17,.97);border:1px solid var(--line);border-radius:14px;padding:6px;`);
patch('privacy bg', `  background:rgba(20,25,34,.82);border:1px solid var(--line);color:var(--dim2);
  font-size:.62rem;font-weight:700;text-decoration:none;white-space:nowrap;`, `  background:rgba(26,18,20,.9);border:1px solid var(--line);color:var(--dim2);
  font-size:.7rem;font-weight:700;text-decoration:none;white-space:nowrap;`);
patch('privacy hover', `#privacy-link:hover{color:#fff;background:rgba(40,48,62,.9)}`, `#privacy-link:hover{color:#fff;background:rgba(52,36,40,.95)}`);
patch('toast bg', `  background:rgba(22,28,38,.96);border:1px solid var(--line);border-radius:14px;padding:11px 18px;`, `  background:rgba(30,20,23,.97);border:1px solid var(--line);border-radius:14px;padding:11px 18px;`);
patch('hitem kbd', `.hitem h4 .kbd{font-size:.66rem;font-weight:900;padding:2px 7px;border-radius:6px;
  background:rgba(255,255,255,.09);border:1px solid var(--line);color:var(--txt)}`, `.hitem h4 .kbd{font-family:var(--display);font-size:.74rem;font-weight:400;letter-spacing:.06em;padding:3px 7px 2px;border-radius:6px;
  background:rgba(255,236,214,.09);border:1px solid var(--line);color:var(--txt)}`);
patch('hud-tag', `.hud-tag{font-size:.62rem;font-weight:700;color:var(--dim2);letter-spacing:.06em;text-transform:uppercase}`, `.hud-tag{font-size:.7rem;font-weight:700;color:var(--dim2);letter-spacing:.02em}`);
patch('gauge b', `.gauge b{display:block;font-size:.6rem;font-weight:800;letter-spacing:.1em;color:var(--dim2);`, `.gauge b{display:block;font-size:.7rem;font-weight:700;letter-spacing:.03em;color:var(--dim2);`);

/* ── 10b. 남은 옛 팔레트 리터럴 → 먹/등롱 체계 ── */
patch('touch-solo', `rgba(255,210,63,.10),transparent 62%)}`, `rgba(255,201,74,.10),transparent 62%)}`);
patch('hud plate', `  background:linear-gradient(180deg,rgba(6,9,14,.88) 30%,rgba(6,9,14,0));pointer-events:none;z-index:-1}`, `  background:linear-gradient(180deg,rgba(14,10,11,.88) 30%,rgba(14,10,11,0));pointer-events:none;z-index:-1}`);
patch('foot plate', `  background:linear-gradient(0deg,rgba(6,9,14,.88) 34%,rgba(6,9,14,0));pointer-events:none;z-index:-1}`, `  background:linear-gradient(0deg,rgba(14,10,11,.88) 34%,rgba(14,10,11,0));pointer-events:none;z-index:-1}`);
patch('lockbadge', `  border-radius:var(--r-m);background:rgba(8,10,15,.55);color:#8b98ab}`, `  border-radius:var(--r-m);background:rgba(12,7,8,.58);color:var(--dim2)}`);
patch('mode hover shadow', `.mode:hover{background:var(--card2);border-color:rgba(255,255,255,.2);transform:translateY(-2px);
  box-shadow:0 14px 30px rgba(0,0,0,.4)}`, `.mode:hover{background:var(--card2);border-color:rgba(255,236,214,.2);transform:translateY(-2px);
  box-shadow:0 12px 18px -8px rgba(0,0,0,.5)}`);
/* ── 10c. 서체 크기 «스케일 정규화» — 11.2 / 12 / 12.8 / 14 / 16 / 20 / 22.4 (검출기 flat-type-hierarchy) ── */
{
  const map = {'.66':'.7','.68':'.7','.72':'.75','.74':'.75','.76':'.75','.78':'.8','.82':'.8','.84':'.875','.85':'.875','.86':'.875','.88':'.875','.9':'.875','.92':'.875','.95':'1','1.02':'1','1.05':'1','1.15':'1.25','1.2':'1.25'};
  let n = 0;
  html = html.replace(/font-size:(\.\d+|\d+(?:\.\d+)?)rem/g, (m, v) => { if (map[v]) { n++; return 'font-size:' + map[v] + 'rem'; } return m; });
  log.push('type scale normalize ×' + n);
}

/* ── 10d. 1px 테두리 + 넓은 그림자(검출기) → 짧은 오프셋 그림자 · 남은 흰색 알파 → 종이색 알파 · clamp 폴백 ── */
patch('lang-list shadow', `  box-shadow:0 12px 30px rgba(0,0,0,.55)}`, `  box-shadow:0 8px 12px -6px rgba(0,0,0,.6)}`);
patch('toast shadow', `  transition:opacity .3s var(--ez),transform .3s var(--ez);box-shadow:0 12px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center}`,
  `  transition:opacity .3s var(--ez),transform .3s var(--ez);box-shadow:0 8px 12px -6px rgba(0,0,0,.6);max-width:88vw;text-align:center}`);
patch('cue shadow', `  box-shadow:0 5px 14px rgba(0,0,0,.5)}`, `  box-shadow:0 4px 8px -2px rgba(0,0,0,.5)}`);
patch('seg on shadow', `.seg button.on{background:var(--card2);color:var(--txt);box-shadow:0 4px 14px rgba(0,0,0,.35)}`, `.seg button.on{background:var(--card2);color:var(--txt);box-shadow:0 3px 8px -2px rgba(0,0,0,.4)}`);
{
  const before = html;
  html = html.replace(/rgba\(255,255,255,(\.\d+)\)/g, 'rgba(255,236,214,$1)');
  log.push('white alpha → paper alpha ×' + (count(before, 'rgba(255,255,255,') - count(html, 'rgba(255,255,255,')));
}
patch('h1 size', `h1.title{font-family:var(--display);font-size:clamp(2.3rem,10vw,3.8rem);`, `h1.title{font-family:var(--display);font-size:2.5rem;`);
patch('h1 size wide', `@media (max-width:420px){`, `@media (min-width:430px){h1.title{font-size:2.9rem}}
@media (max-width:420px){`);
{ const before = html; html = html.replace(/color:#fff(?![0-9a-fA-F])/g, 'color:var(--txt)'); log.push('#fff → txt ×' + (count(before, 'color:#fff') - count(html, 'color:#fff'))); }
patch('h2 clamp fallback', `h2.sc-title{font-size:clamp(1.25rem,5vw,1.7rem);`, `h2.sc-title{font-size:1.5rem;font-size:clamp(1.25rem,5vw,1.7rem);`);
patch('bigres clamp fallback', `.bigres{font-family:var(--display);font-size:clamp(2.4rem,12vw,4.2rem);`, `.bigres{font-family:var(--display);font-size:3rem;font-size:clamp(2.4rem,12vw,4.2rem);`);
patch('vsmid clamp fallback', `.vsmid{flex:0 0 auto;font-family:var(--display);font-size:clamp(1.9rem,8vw,2.8rem);`, `.vsmid{flex:0 0 auto;font-family:var(--display);font-size:2.2rem;font-size:clamp(1.9rem,8vw,2.8rem);`);
patch('mode h2 size', `.mode .tx h2{font-size:1rem;font-weight:800;margin-bottom:3px}`, `.mode .tx h2{font-size:1.125rem;font-weight:800;margin-bottom:3px}`);

/* ── 11. 포스트 레이어 스크립트(클래식, 게임 주입 «전») ── */
patch('post script', `<script type="module" src="/src/sdk-boot.ts"></script>`,
`<!-- 그래픽 고도화(2026-08-30): 블룸 포스트 레이어. 의존성 0, WebGL 없으면 조용히 비활성(게임은 단일 캔버스 폴백).
     sdk-boot.ts 가 게임 스크립트를 «동적 주입»하므로 그보다 먼저 로드되는 클래식 스크립트로 둔다. -->
<script src="./game/sumo-post.js"></script>
<script type="module" src="/src/sdk-boot.ts"></script>`);

/* ── 검증: 보존 대상 무변경 ── */
if (html.match(/<body[^>]*>/)[0] !== bodyTag) throw new Error('body tag changed');
if (html.match(/<div id="ad-slots"[\s\S]*?<\/div>/)[0] !== adSlot) throw new Error('ad-slots changed');
const ids2 = (html.match(/ id="[^"]+"/g) || []).sort();
const added = ids2.filter((i) => !ids.includes(i));
const removed = ids.filter((i) => !ids2.includes(i));
if (removed.length) throw new Error('ids removed: ' + removed.join(','));
if (added.join(',') !== ' id="att-cap", id="att-strip"') throw new Error('unexpected ids added: ' + added.join(','));
const modules2 = (html.match(/<script type="module"[^>]*>/g) || []);
if (modules.join('|') !== modules2.join('|')) throw new Error('module scripts changed');
writeFileSync(OUT, crlf ? html.replace(/\n/g, '\r\n') : html);
console.log('patched → ' + OUT + '\n  ' + log.join('\n  '));
